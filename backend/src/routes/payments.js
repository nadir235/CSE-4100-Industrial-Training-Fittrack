'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const crypto = require('node:crypto');
const { z } = require('zod');
const { HttpError, requireAuth, requireMember, wrap } = require('../lib/middleware');
const { computeSubscription } = require('../lib/subscription');
const { notificationDoc, notificationData } = require('../lib/notify');

const METHODS = ['bkash', 'nagad', 'sslcommerz', 'card'];
const PENDING_REUSE_MS = 30 * 60_000;

function newTxnId() {
  return `FT-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function paymentsRouter({ auth, db, gateway, env }) {
  const router = express.Router();
  const currency = env.CURRENCY || 'BDT';
  const limiter = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user?.uid || req.ip, validate: { keyGeneratorIpFallback: false } });

  /**
   * Moves a PENDING payment to successful/failed exactly once.
   * Runs in a transaction so duplicate callbacks / double taps can never extend a membership twice.
   */
  async function settle(paymentId, result) {
    const ref = db.collection('payments').doc(paymentId);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new HttpError(404, 'Payment not found');
      const p = snap.data();
      if (p.status !== 'pending') return { status: p.status, changed: false }; // already settled: idempotent

      if (result.state === 'failed') {
        tx.update(ref, { status: 'failed', failedAt: Date.now() });
        return { status: 'failed', changed: true };
      }
      if (result.state !== 'paid') return { status: 'pending', changed: false };

      // Never activate unless the gateway-confirmed amount matches what the SERVER priced.
      if (result.amount !== undefined && Math.abs(Number(result.amount) - Number(p.amount)) > 0.01) {
        tx.update(ref, { status: 'failed', failedAt: Date.now(), failureReason: 'amount-mismatch' });
        return { status: 'failed', changed: true };
      }

      const subRef = db.collection('subscriptions').doc(p.uid);
      const subSnap = await tx.get(subRef);
      const sub = computeSubscription(subSnap.exists ? subSnap.data() : null, { id: p.planId, name: p.planName, durationDays: p.durationDays });

      tx.update(ref, { status: 'successful', verifiedAt: Date.now(), gatewayRef: result.ref || null });
      tx.set(subRef, { ...sub, uid: p.uid });
      tx.set(notificationDoc(db, p.uid), notificationData({
        kind: 'payment',
        title: 'Payment confirmed',
        body: `We received your payment for ${p.planName}. Your membership is active until ${new Date(sub.expiresAt).toLocaleDateString('en-GB')}.`,
      }));
      return { status: 'successful', changed: true };
    });
  }

  async function verifyAndSettle(payment, hints) {
    if (payment.status !== 'pending') return payment.status;
    const result = await gateway.verify(payment, hints || {});
    const out = await settle(payment.id, result);
    return out.status;
  }

  // ---------------- public gateway callbacks (no auth: they are verified server-to-server) ----------------
  const urlencoded = express.urlencoded({ extended: false, limit: '100kb' });

  async function findByTxn(txnId) {
    if (!txnId || typeof txnId !== 'string') return null;
    const q = await db.collection('payments').where('txnId', '==', txnId).limit(1).get();
    if (q.empty) return null;
    const d = q.docs[0];
    return { id: d.id, ...d.data() };
  }

  router.post('/sslcommerz/ipn', rateLimit({ windowMs: 60_000, limit: 120 }), urlencoded, wrap(async (req, res) => {
    const payment = await findByTxn(req.body?.tran_id);
    if (payment && payment.gateway === gateway.name) {
      try {
        await verifyAndSettle(payment, { valId: req.body.val_id });
      } catch (e) {
        console.error('[ipn] verification error', e.message);
      }
    }
    res.status(200).send('OK'); // always 200 so the gateway doesn't hammer us; truth lives in our records
  }));

  router.all('/sslcommerz/return', rateLimit({ windowMs: 60_000, limit: 120 }), urlencoded, wrap(async (req, res) => {
    const payment = await findByTxn(req.body?.tran_id);
    let status = 'pending';
    if (payment && payment.gateway === gateway.name) {
      try {
        status = await verifyAndSettle(payment, { valId: req.body?.val_id });
      } catch {
        status = payment.status;
      }
    }
    const msg = status === 'successful' ? 'Payment received. You can close this page and return to FitTrack.' : status === 'failed' ? 'The payment was not completed. You can close this page and try again in FitTrack.' : 'Your payment is being confirmed. Return to FitTrack — it will update shortly.';
    res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:sans-serif;background:#0B0B0B;color:#fff;text-align:center;padding:48px"><h2 style="color:#E50914">FitTrack</h2><p>${msg}</p></body>`);
  }));

  // ---------------- authenticated ----------------
  router.use(requireAuth(auth));

  router.get('/config', (_req, res) => {
    res.json({ gateway: gateway.name, sandbox: gateway.sandbox, currency });
  });

  const checkoutBody = z.object({ planId: z.string().min(1).max(128), method: z.enum(METHODS) });

  router.post('/checkout', requireMember, limiter, wrap(async (req, res) => {
    const { planId, method } = checkoutBody.parse(req.body);
    const planSnap = await db.collection('plans').doc(planId).get();
    // Price and duration ALWAYS come from the server's plan record, never from the client.
    if (!planSnap.exists || planSnap.data().active !== true) throw new HttpError(404, 'That plan is not available');
    const plan = { id: planSnap.id, ...planSnap.data() };

    // Prevent duplicate pending payments (double taps): reuse a fresh pending one for the same plan.
    const open = await db.collection('payments').where('uid', '==', req.user.uid).where('status', '==', 'pending').get();
    const reuse = open.docs.map((d) => ({ id: d.id, ...d.data() })).find((p) => p.planId === plan.id && p.method === method && Date.now() - p.createdAt < PENDING_REUSE_MS);
    if (reuse) return res.json({ paymentId: reuse.id, redirectUrl: reuse.redirectUrl || undefined, amount: reuse.amount, currency: reuse.currency, reused: true });

    const profile = (await db.collection('users').doc(req.user.uid).get()).data() || {};
    const ref = db.collection('payments').doc();
    const payment = {
      id: ref.id,
      uid: req.user.uid,
      memberName: profile.name || req.user.name || 'Member',
      planId: plan.id,
      planName: plan.name,
      durationDays: plan.durationDays,
      amount: Number(plan.price),
      currency,
      method,
      gateway: gateway.name,
      status: 'pending',
      txnId: newTxnId(),
      createdAt: Date.now(),
    };
    let init;
    try {
      init = await gateway.init(payment, { name: payment.memberName, email: req.user.email, phone: profile.phone });
    } catch (e) {
      console.error('[checkout] gateway init failed:', e.message);
      throw new HttpError(502, 'The payment gateway is unavailable right now. Please try again shortly.');
    }
    const { id: _id, ...stored } = payment;
    await ref.set({ ...stored, ...(init.redirectUrl ? { redirectUrl: init.redirectUrl } : {}) });
    res.status(201).json({ paymentId: ref.id, redirectUrl: init.redirectUrl, amount: payment.amount, currency });
  }));

  async function loadOwned(req) {
    const snap = await db.collection('payments').doc(req.params.id).get();
    if (!snap.exists) throw new HttpError(404, 'Payment not found');
    const p = { id: snap.id, ...snap.data() };
    if (p.uid !== req.user.uid && !req.user.admin) throw new HttpError(404, 'Payment not found'); // don't leak existence
    return p;
  }

  // Sandbox only: simulates the customer completing/cancelling the payment on the gateway's side.
  router.post('/:id/sandbox-pay', requireMember, limiter, wrap(async (req, res) => {
    if (gateway.name !== 'mock') throw new HttpError(404, 'Not found');
    const { outcome } = z.object({ outcome: z.enum(['success', 'fail', 'cancel']) }).parse(req.body);
    const p = await loadOwned(req);
    if (p.status !== 'pending') return res.json({ ok: true, status: p.status });
    await db.collection('payments').doc(p.id).update({ sandboxOutcome: outcome });
    res.json({ ok: true, status: 'pending' });
  }));

  // Asks the gateway for the truth, then settles. Safe to call repeatedly.
  router.post('/:id/verify', limiter, wrap(async (req, res) => {
    const p = await loadOwned(req);
    const status = await verifyAndSettle(p, {});
    res.json({ status });
  }));

  return router;
}

module.exports = { paymentsRouter };
