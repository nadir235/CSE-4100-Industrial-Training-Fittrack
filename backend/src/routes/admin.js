'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { HttpError, requireAuth, requireAdmin, wrap } = require('../lib/middleware');
const { computeSubscription, DAY_MS } = require('../lib/subscription');
const { notificationDoc, notificationData } = require('../lib/notify');

const planBody = z.object({
  name: z.string().trim().min(2).max(60),
  price: z.number().min(0).max(1_000_000),
  durationDays: z.number().int().min(1).max(3650),
  description: z.string().trim().max(300).default(''),
  features: z.array(z.string().trim().min(1).max(80)).max(12).default([]),
  active: z.boolean().default(true),
});

const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const monthKey = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

function adminRouter({ auth, db, env }) {
  const router = express.Router();
  const currency = env.CURRENCY || 'BDT';
  router.use(requireAuth(auth), requireAdmin);
  router.use(rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user.uid, validate: { keyGeneratorIpFallback: false } }));

  const loadUsers = async () => (await db.collection('users').get()).docs.map((d) => ({ uid: d.id, ...d.data() }));
  const loadSubs = async () => new Map((await db.collection('subscriptions').get()).docs.map((d) => [d.id, d.data()]));
  const isActive = (s, now = Date.now()) => !!s && s.status === 'active' && s.expiresAt > now;

  // ---------------------------------------------------------------- stats
  router.get('/stats', wrap(async (_req, res) => {
    const now = Date.now();
    const [users, subs, paySnap] = await Promise.all([loadUsers(), loadSubs(), db.collection('payments').get()]);
    const payments = paySnap.docs.map((d) => d.data());

    let totalWorkouts = 0;
    for (const group of chunk(users, 40)) {
      const counts = await Promise.all(group.map((u) => db.collection('users').doc(u.uid).collection('workoutLogs').count().get()));
      totalWorkouts += counts.reduce((s, c) => s + c.data().count, 0);
    }

    const activeMembers = users.filter((u) => u.lastActiveAt && now - u.lastActiveAt <= 30 * DAY_MS).length;
    const subList = [...subs.values()];
    const revenueByMonth = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
      const key = monthKey(d.getTime());
      revenueByMonth.push({ label: d.toLocaleDateString('en-GB', { month: 'short' }), value: payments.filter((p) => p.status === 'successful' && monthKey(p.verifiedAt || p.createdAt) === key).reduce((s, p) => s + p.amount, 0) });
    }
    const signupsByWeek = [];
    for (let i = 7; i >= 0; i--) {
      const end = now - i * 7 * DAY_MS;
      const start = end - 7 * DAY_MS;
      signupsByWeek.push({ label: new Date(start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: users.filter((u) => u.createdAt > start && u.createdAt <= end).length });
    }
    const pending = payments.filter((p) => p.status === 'pending');
    res.json({
      totalMembers: users.length,
      activeMembers,
      inactiveMembers: users.length - activeMembers,
      newRegistrations: users.filter((u) => now - u.createdAt <= 30 * DAY_MS).length,
      activeMemberships: subList.filter((s) => isActive(s, now)).length,
      expiredMemberships: subList.filter((s) => !isActive(s, now)).length,
      totalWorkouts,
      revenue: payments.filter((p) => p.status === 'successful').reduce((s, p) => s + p.amount, 0),
      pendingPayments: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.amount, 0),
      revenueByMonth,
      signupsByWeek,
      currency,
    });
  }));

  // ---------------------------------------------------------------- members
  router.get('/members', wrap(async (req, res) => {
    const search = String(req.query.search || '').trim().toLowerCase().slice(0, 80);
    const filter = String(req.query.filter || 'all');
    const now = Date.now();
    const [users, subs] = await Promise.all([loadUsers(), loadSubs()]);
    let rows = users.map((u) => {
      const s = subs.get(u.uid);
      return {
        uid: u.uid,
        name: u.name || '',
        email: u.email || '',
        createdAt: u.createdAt || 0,
        fitnessLevel: u.fitnessLevel || 'beginner',
        lastActive: u.lastActiveAt || null,
        membership: s ? { planName: s.planName, status: s.status, expiresAt: s.expiresAt } : null,
      };
    });
    if (search) rows = rows.filter((r) => r.name.toLowerCase().includes(search) || r.email.toLowerCase().includes(search));
    if (filter === 'active') rows = rows.filter((r) => r.membership && isActive(r.membership, now));
    else if (filter === 'expired') rows = rows.filter((r) => r.membership && !isActive(r.membership, now));
    else if (filter === 'none') rows = rows.filter((r) => !r.membership);
    else if (filter === 'inactive') rows = rows.filter((r) => !r.lastActive || now - r.lastActive > 30 * DAY_MS);
    rows.sort((a, b) => b.createdAt - a.createdAt);
    res.json({ members: rows.slice(0, 500) });
  }));

  router.get('/members/:uid', wrap(async (req, res) => {
    const uid = req.params.uid;
    const userRef = db.collection('users').doc(uid);
    const snap = await userRef.get();
    if (!snap.exists) throw new HttpError(404, 'Member not found');
    const p = snap.data();
    const sinceWater = Date.now() - 14 * DAY_MS;
    const [sub, pays, wl, wt, run, water, fast] = await Promise.all([
      db.collection('subscriptions').doc(uid).get(),
      db.collection('payments').where('uid', '==', uid).get(),
      userRef.collection('workoutLogs').orderBy('at', 'desc').limit(50).get(),
      userRef.collection('weights').orderBy('at', 'desc').limit(60).get(),
      userRef.collection('running').orderBy('at', 'desc').limit(30).get(),
      userRef.collection('water').where('at', '>=', sinceWater).get(),
      userRef.collection('fasting').orderBy('startedAt', 'desc').limit(20).get(),
    ]);
    const waterByDay = {};
    water.docs.forEach((d) => { const w = d.data(); waterByDay[w.day] = (waterByDay[w.day] || 0) + (w.ml || 0); });

    // Only the fields a gym needs — no AI chats, no meals, no calculator inputs, no face/other logs.
    res.json({
      profile: { uid, name: p.name, email: p.email, phone: p.phone, createdAt: p.createdAt, fitnessLevel: p.fitnessLevel, goal: p.goal, age: p.age, sex: p.sex, heightCm: p.heightCm, weightKg: p.weightKg, photoData: p.photoData },
      subscription: sub.exists ? { id: sub.id, ...sub.data() } : null,
      payments: pays.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt).map(({ redirectUrl, sandboxOutcome, ...rest }) => rest),
      workouts: wl.docs.map((d) => { const x = d.data(); return { id: d.id, title: x.title, level: x.level, durationMin: x.durationMin, calories: x.calories, at: x.at }; }),
      weights: wt.docs.map((d) => ({ id: d.id, kg: d.data().kg, at: d.data().at })),
      running: run.docs.map((d) => { const x = d.data(); return { id: d.id, distanceKm: x.distanceKm, durationSec: x.durationSec, paceSecPerKm: x.paceSecPerKm, at: x.at }; }),
      water: Object.entries(waterByDay).sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, ml]) => ({ day, ml })),
      fasting: fast.docs.map((d) => { const x = d.data(); return { id: d.id, label: x.label, startedAt: x.startedAt, endedAt: x.endedAt, status: x.status, targetHours: x.targetHours }; }),
    });
  }));

  const membershipBody = z.object({ action: z.enum(['activate', 'deactivate']), planId: z.string().min(1).max(128).optional() });
  router.post('/members/:uid/membership', wrap(async (req, res) => {
    const uid = req.params.uid;
    const { action, planId } = membershipBody.parse(req.body);
    const user = await db.collection('users').doc(uid).get();
    if (!user.exists) throw new HttpError(404, 'Member not found');
    const subRef = db.collection('subscriptions').doc(uid);

    if (action === 'deactivate') {
      const s = await subRef.get();
      if (!s.exists) throw new HttpError(404, 'This member has no membership');
      await subRef.update({ status: 'inactive', deactivatedAt: Date.now(), deactivatedBy: req.user.uid });
      await notificationDoc(db, uid).set(notificationData({ kind: 'membership', title: 'Membership deactivated', body: 'Your gym membership was deactivated. Please contact the front desk.' }));
      return res.json({ ok: true });
    }
    if (!planId) throw new HttpError(400, 'planId is required to activate a membership');
    const planSnap = await db.collection('plans').doc(planId).get();
    if (!planSnap.exists) throw new HttpError(404, 'Plan not found');
    const existing = await subRef.get();
    const sub = computeSubscription(existing.exists ? existing.data() : null, { id: planSnap.id, ...planSnap.data() });
    await subRef.set({ ...sub, uid, grantedBy: req.user.uid });
    await notificationDoc(db, uid).set(notificationData({ kind: 'membership', title: 'Membership activated', body: `Your ${sub.planName} membership is active until ${new Date(sub.expiresAt).toLocaleDateString('en-GB')}.` }));
    res.json({ ok: true, subscription: sub });
  }));

  // ---------------------------------------------------------------- plans
  router.post('/plans', wrap(async (req, res) => {
    const data = planBody.parse(req.body);
    const ref = db.collection('plans').doc();
    await ref.set({ ...data, createdAt: Date.now() });
    res.status(201).json({ id: ref.id });
  }));
  router.put('/plans/:id', wrap(async (req, res) => {
    const data = planBody.parse(req.body);
    const ref = db.collection('plans').doc(req.params.id);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Plan not found');
    await ref.update({ ...data, updatedAt: Date.now() });
    res.json({ ok: true });
  }));
  router.delete('/plans/:id', wrap(async (req, res) => {
    const ref = db.collection('plans').doc(req.params.id);
    if (!(await ref.get()).exists) throw new HttpError(404, 'Plan not found');
    await ref.delete();
    res.json({ ok: true });
  }));

  // ---------------------------------------------------------------- announcements
  const announceBody = z.object({ title: z.string().trim().min(3).max(100), body: z.string().trim().min(3).max(1000) });
  router.post('/announcements', wrap(async (req, res) => {
    const { title, body } = announceBody.parse(req.body);
    const at = Date.now();
    await db.collection('announcements').doc().set({ title, body, at, by: req.user.uid });
    const users = await loadUsers();
    for (const group of chunk(users, 400)) {
      const batch = db.batch();
      group.forEach((u) => batch.set(notificationDoc(db, u.uid), { title, body, kind: 'announcement', at, read: false }));
      await batch.commit();
    }
    res.status(201).json({ delivered: users.length });
  }));

  // ---------------------------------------------------------------- refunds
  router.post('/payments/:id/refund', wrap(async (req, res) => {
    const ref = db.collection('payments').doc(req.params.id);
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, 'Payment not found');
      const p = snap.data();
      if (p.status !== 'successful') throw new HttpError(409, 'Only successful payments can be refunded');
      const subRef = db.collection('subscriptions').doc(p.uid);
      const subSnap = await tx.get(subRef);
      tx.update(ref, { status: 'refunded', refundedAt: Date.now(), refundedBy: req.user.uid });
      if (subSnap.exists) {
        const s = subSnap.data();
        const expiresAt = s.expiresAt - (p.durationDays || 0) * DAY_MS;
        tx.update(subRef, { expiresAt, status: expiresAt > Date.now() ? s.status : 'expired' });
      }
    });
    res.json({ ok: true });
  }));

  return router;
}

module.exports = { adminRouter };
