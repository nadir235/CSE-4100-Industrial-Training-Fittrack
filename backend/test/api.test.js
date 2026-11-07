'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createFakeDb, createFakeAuth } = require('./fakeFirestore');
const { computeSubscription, DAY_MS } = require('../src/lib/subscription');
const { ruleBasedReply } = require('../src/lib/ai');

const USERS = {
  'tok-alice': { uid: 'alice', email: 'alice@x.com' },
  'tok-bob': { uid: 'bob', email: 'bob@x.com' },
  'tok-admin': { uid: 'boss', email: 'boss@gym.com', admin: true },
};

async function setup({ env = {}, gateway, fetchImpl } = {}) {
  const db = createFakeDb();
  const auth = createFakeAuth(USERS);
  const now = Date.now();
  await db.collection('users').doc('alice').set({ name: 'Alice', email: 'alice@x.com', createdAt: now - 40 * DAY_MS, fitnessLevel: 'intermediate', lastActiveAt: now - DAY_MS, goal: 'build-muscle', availableMinutes: 45 });
  await db.collection('users').doc('bob').set({ name: 'Bob', email: 'bob@x.com', createdAt: now - 2 * DAY_MS, fitnessLevel: 'beginner' });
  await db.collection('users').doc('alice').collection('workoutLogs').doc('w1').set({ title: 'Upper Body Builder', level: 'intermediate', durationMin: 40, calories: 300, at: now - DAY_MS });
  await db.collection('users').doc('alice').collection('aiChat').doc('c1').set({ role: 'user', text: 'secret chat', at: now });
  await db.collection('plans').doc('monthly').set({ name: 'Monthly', price: 1500, durationDays: 30, description: '', features: [], active: true });
  await db.collection('plans').doc('yearly').set({ name: 'Yearly', price: 14000, durationDays: 365, description: '', features: [], active: true });
  await db.collection('plans').doc('hidden').set({ name: 'Hidden', price: 1, durationDays: 1, description: '', features: [], active: false });

  const app = createApp({ auth, db, env: { PAYMENT_GATEWAY: 'mock', CORS_ORIGINS: 'http://localhost:8081', ...env }, gateway, fetchImpl });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, token, body) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null;
    try { json = await res.json(); } catch { /* none */ }
    return { status: res.status, body: json };
  };
  return { db, call, base, close: () => new Promise((r) => server.close(r)) };
}

// ------------------------------------------------------------ auth & roles
test('requests without a valid token are rejected', async () => {
  const t = await setup();
  assert.equal((await t.call('GET', '/payments/config')).status, 401);
  assert.equal((await t.call('GET', '/payments/config', 'tok-nope')).status, 401);
  assert.equal((await t.call('GET', '/admin/stats')).status, 401);
  await t.close();
});

test('members cannot reach admin APIs; admins can', async () => {
  const t = await setup();
  for (const [m, p, b] of [['GET', '/admin/stats'], ['GET', '/admin/members'], ['GET', '/admin/members/alice'], ['POST', '/admin/plans', { name: 'x', price: 1, durationDays: 1 }], ['POST', '/admin/announcements', { title: 'abc', body: 'abc' }], ['POST', '/admin/members/alice/membership', { action: 'deactivate' }], ['POST', '/admin/payments/x/refund', {}]]) {
    const r = await t.call(m, p, 'tok-alice', b);
    assert.equal(r.status, 403, `${m} ${p} should be 403 for a member, got ${r.status}`);
  }
  assert.equal((await t.call('GET', '/admin/stats', 'tok-admin')).status, 200);
  await t.close();
});

test('admins cannot buy memberships or chat with the member AI', async () => {
  const t = await setup();
  assert.equal((await t.call('POST', '/payments/checkout', 'tok-admin', { planId: 'monthly', method: 'card' })).status, 403);
  assert.equal((await t.call('POST', '/ai/chat', 'tok-admin', { message: 'hi' })).status, 403);
  await t.close();
});

test('CORS rejects unknown browser origins and allows configured ones', async () => {
  const t = await setup();
  const http = require('node:http');
  const get = (origin) => new Promise((resolve, reject) => {
    const u = new URL(t.base + '/health');
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Origin: origin } }, (res) => { res.resume(); resolve({ status: res.statusCode, allow: res.headers['access-control-allow-origin'] }); });
    req.on('error', reject);
    req.end();
  });
  const bad = await get('http://evil.example');
  assert.equal(bad.status, 403);
  const good = await get('http://localhost:8081');
  assert.equal(good.status, 200);
  assert.equal(good.allow, 'http://localhost:8081');
  await t.close();
});

// ------------------------------------------------------------ payments
test('checkout prices from the server plan and ignores client-sent amounts', async () => {
  const t = await setup();
  const r = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash', amount: 1, price: 1 });
  assert.equal(r.status, 201);
  assert.equal(r.body.amount, 1500);
  const p = (await t.db.collection('payments').doc(r.body.paymentId).get()).data();
  assert.equal(p.amount, 1500);
  assert.equal(p.status, 'pending');
  assert.equal(p.uid, 'alice');
  assert.match(p.txnId, /^FT-/);
  await t.close();
});

test('checkout validates plan and method', async () => {
  const t = await setup();
  assert.equal((await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'nope', method: 'bkash' })).status, 404);
  assert.equal((await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'hidden', method: 'bkash' })).status, 404);
  assert.equal((await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bitcoin' })).status, 400);
  assert.equal((await t.call('POST', '/payments/checkout', 'tok-alice', {})).status, 400);
  await t.close();
});

test('membership is NOT activated by checkout or by an unpaid verify call', async () => {
  const t = await setup();
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'card' });
  const v = await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal(v.body.status, 'pending');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).exists, false);
  await t.close();
});

test('successful sandbox payment activates once; repeated/concurrent verifies are idempotent', async () => {
  const t = await setup();
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' });
  const results = await Promise.all(Array.from({ length: 6 }, () => t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {})));
  assert.ok(results.every((r) => r.body.status === 'successful'));
  const sub = (await t.db.collection('subscriptions').doc('alice').get()).data();
  assert.equal(sub.status, 'active');
  const days = Math.round((sub.expiresAt - Date.now()) / DAY_MS);
  assert.equal(days, 30, 'exactly one 30-day extension');
  const again = await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal(again.body.status, 'successful');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).data().expiresAt, sub.expiresAt);
  const notes = (await t.db.collection('users').doc('alice').collection('notifications').get()).docs;
  assert.equal(notes.length, 1, 'one payment confirmation');
  await t.close();
});

test('a second purchase extends from the current expiry', async () => {
  const t = await setup();
  for (let i = 0; i < 2; i++) {
    const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'nagad' });
    await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' });
    await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  }
  const sub = (await t.db.collection('subscriptions').doc('alice').get()).data();
  assert.equal(Math.round((sub.expiresAt - Date.now()) / DAY_MS), 60);
  await t.close();
});

test('failed payments never activate a membership', async () => {
  const t = await setup();
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'yearly', method: 'card' });
  await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'fail' });
  const v = await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal(v.body.status, 'failed');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).exists, false);
  // a failed payment cannot later be flipped to successful
  await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' });
  assert.equal((await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {})).body.status, 'failed');
  await t.close();
});

test('double-tap checkout reuses the pending payment instead of creating duplicates', async () => {
  const t = await setup();
  const a = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  const b = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  assert.equal(a.body.paymentId, b.body.paymentId);
  assert.equal((await t.db.collection('payments').get()).docs.length, 1);
  await t.close();
});

test("one member cannot view, simulate or verify another member's payment", async () => {
  const t = await setup();
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  assert.equal((await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-bob', { outcome: 'success' })).status, 404);
  assert.equal((await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-bob', {})).status, 404);
  await t.close();
});

test('a gateway-confirmed amount that differs from the server price is rejected', async () => {
  const gateway = { name: 'fake', sandbox: true, init: async () => ({}), verify: async () => ({ state: 'paid', amount: 1 }) };
  const t = await setup({ gateway });
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'card' });
  const v = await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal(v.body.status, 'failed');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).exists, false);
  await t.close();
});

test('sandbox-pay endpoint does not exist for real gateways', async () => {
  const gateway = { name: 'sslcommerz', sandbox: true, init: async () => ({ redirectUrl: 'https://pay.example' }), verify: async () => ({ state: 'pending' }) };
  const t = await setup({ gateway });
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'card' });
  assert.equal(body.redirectUrl, 'https://pay.example');
  assert.equal((await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' })).status, 404);
  await t.close();
});

test('IPN callback: unconfirmed posts cannot activate; a gateway-confirmed one does (once)', async () => {
  let confirmed = false;
  let verifyCalls = 0;
  const gateway = { name: 'ipn-gw', sandbox: true, init: async () => ({}), verify: async () => { verifyCalls++; return confirmed ? { state: 'paid', amount: 1500 } : { state: 'pending' }; } };
  const t = await setup({ gateway });
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'card' });
  const txn = (await t.db.collection('payments').doc(body.paymentId).get()).data().txnId;
  const ipn = (form) => fetch(t.base + '/payments/sslcommerz/ipn', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });

  // forged "VALID" post while the gateway has NOT confirmed: nothing changes
  let r = await ipn({ tran_id: txn, status: 'VALID', val_id: 'forged' });
  assert.equal(r.status, 200);
  assert.equal(verifyCalls, 1, 'server asked the gateway instead of trusting the body');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).exists, false);

  // unknown transaction id is ignored
  r = await ipn({ tran_id: 'FT-UNKNOWN', status: 'VALID' });
  assert.equal(r.status, 200);

  // gateway confirms -> activates exactly once even if the IPN is delivered twice
  confirmed = true;
  await ipn({ tran_id: txn, status: 'VALID', val_id: 'real' });
  await ipn({ tran_id: txn, status: 'VALID', val_id: 'real' });
  const sub = (await t.db.collection('subscriptions').doc('alice').get()).data();
  assert.equal(Math.round((sub.expiresAt - Date.now()) / DAY_MS), 30);
  assert.equal((await t.db.collection('payments').doc(body.paymentId).get()).data().status, 'successful');
  await t.close();
});

test('production refuses the mock gateway unless explicitly allowed', async () => {
  assert.throws(() => createApp({ auth: createFakeAuth(USERS), db: createFakeDb(), env: { NODE_ENV: 'production', PAYMENT_GATEWAY: 'mock' } }), /disabled in production/);
  assert.doesNotThrow(() => createApp({ auth: createFakeAuth(USERS), db: createFakeDb(), env: { NODE_ENV: 'production', PAYMENT_GATEWAY: 'mock', ALLOW_MOCK_PAYMENTS: 'true' } }));
});

// ------------------------------------------------------------ admin
test('admin plan CRUD with validation', async () => {
  const t = await setup();
  assert.equal((await t.call('POST', '/admin/plans', 'tok-admin', { name: 'Bad', price: -5, durationDays: 30 })).status, 400);
  assert.equal((await t.call('POST', '/admin/plans', 'tok-admin', { name: 'Bad', price: 5, durationDays: 0 })).status, 400);
  const c = await t.call('POST', '/admin/plans', 'tok-admin', { name: 'Weekly Pass', price: 500, durationDays: 7, features: ['Gym access'] });
  assert.equal(c.status, 201);
  const u = await t.call('PUT', `/admin/plans/${c.body.id}`, 'tok-admin', { name: 'Weekly Pass', price: 600, durationDays: 7, active: false });
  assert.equal(u.status, 200);
  assert.equal((await t.db.collection('plans').doc(c.body.id).get()).data().price, 600);
  assert.equal((await t.call('DELETE', `/admin/plans/${c.body.id}`, 'tok-admin')).status, 200);
  assert.equal((await t.call('DELETE', `/admin/plans/${c.body.id}`, 'tok-admin')).status, 404);
  await t.close();
});

test('admin members list: search, filters and stats', async () => {
  const t = await setup();
  await t.call('POST', '/admin/members/alice/membership', 'tok-admin', { action: 'activate', planId: 'monthly' });
  const all = await t.call('GET', '/admin/members', 'tok-admin');
  assert.equal(all.body.members.length, 2);
  assert.equal((await t.call('GET', '/admin/members?search=ali', 'tok-admin')).body.members.length, 1);
  assert.equal((await t.call('GET', '/admin/members?filter=active', 'tok-admin')).body.members[0].uid, 'alice');
  assert.equal((await t.call('GET', '/admin/members?filter=none', 'tok-admin')).body.members[0].uid, 'bob');
  assert.equal((await t.call('GET', '/admin/members?filter=inactive', 'tok-admin')).body.members[0].uid, 'bob');
  const s = (await t.call('GET', '/admin/stats', 'tok-admin')).body;
  assert.equal(s.totalMembers, 2);
  assert.equal(s.activeMembers, 1);
  assert.equal(s.newRegistrations, 1);
  assert.equal(s.activeMemberships, 1);
  assert.equal(s.totalWorkouts, 1);
  assert.equal(s.revenue, 0);
  await t.close();
});

test('member detail exposes only gym-relevant data (no AI chats)', async () => {
  const t = await setup();
  const r = await t.call('GET', '/admin/members/alice', 'tok-admin');
  assert.equal(r.status, 200);
  assert.equal(r.body.profile.name, 'Alice');
  assert.equal(r.body.workouts.length, 1);
  assert.ok(!JSON.stringify(r.body).includes('secret chat'));
  assert.equal((await t.call('GET', '/admin/members/ghost', 'tok-admin')).status, 404);
  await t.close();
});

test('admin can activate then deactivate a membership, and revenue counts successful payments', async () => {
  const t = await setup();
  await t.call('POST', '/admin/members/bob/membership', 'tok-admin', { action: 'activate', planId: 'yearly' });
  assert.equal((await t.db.collection('subscriptions').doc('bob').get()).data().status, 'active');
  await t.call('POST', '/admin/members/bob/membership', 'tok-admin', { action: 'deactivate' });
  assert.equal((await t.db.collection('subscriptions').doc('bob').get()).data().status, 'inactive');
  assert.equal((await t.call('POST', '/admin/members/alice/membership', 'tok-admin', { action: 'deactivate' })).status, 404);

  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' });
  await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal((await t.call('GET', '/admin/stats', 'tok-admin')).body.revenue, 1500);
  await t.close();
});

test('refund marks the payment refunded and removes the purchased days', async () => {
  const t = await setup();
  const { body } = await t.call('POST', '/payments/checkout', 'tok-alice', { planId: 'monthly', method: 'bkash' });
  await t.call('POST', `/payments/${body.paymentId}/sandbox-pay`, 'tok-alice', { outcome: 'success' });
  await t.call('POST', `/payments/${body.paymentId}/verify`, 'tok-alice', {});
  assert.equal((await t.call('POST', `/admin/payments/${body.paymentId}/refund`, 'tok-admin', {})).status, 200);
  assert.equal((await t.db.collection('payments').doc(body.paymentId).get()).data().status, 'refunded');
  assert.equal((await t.db.collection('subscriptions').doc('alice').get()).data().status, 'expired');
  assert.equal((await t.call('POST', `/admin/payments/${body.paymentId}/refund`, 'tok-admin', {})).status, 409, 'cannot refund twice');
  await t.close();
});

test('announcements are delivered to every member inbox', async () => {
  const t = await setup();
  assert.equal((await t.call('POST', '/admin/announcements', 'tok-admin', { title: 'x', body: 'y' })).status, 400);
  const r = await t.call('POST', '/admin/announcements', 'tok-admin', { title: 'Closed Friday', body: 'Gym closed for maintenance.' });
  assert.equal(r.body.delivered, 2);
  for (const uid of ['alice', 'bob']) {
    const n = (await t.db.collection('users').doc(uid).collection('notifications').get()).docs.map((d) => d.data());
    assert.equal(n.length, 1);
    assert.equal(n[0].kind, 'announcement');
    assert.equal(n[0].read, false);
  }
  assert.equal((await t.db.collection('announcements').get()).docs.length, 1);
  await t.close();
});

// ------------------------------------------------------------ AI
test('AI falls back to the built-in coach when no API keys are configured, and stores history', async () => {
  const t = await setup();
  const r = await t.call('POST', '/ai/chat', 'tok-alice', { message: 'Create a weekly plan for me' });
  assert.equal(r.status, 200);
  assert.equal(r.body.provider, 'built-in coach');
  assert.match(r.body.reply, /intermediate/i);
  assert.equal((await t.db.collection('users').doc('alice').collection('aiChat').get()).docs.length, 3); // seeded + user + assistant
  assert.equal((await t.call('POST', '/ai/chat', 'tok-alice', { message: '' })).status, 400);
  assert.equal((await t.call('POST', '/ai/chat', 'tok-alice', { message: 'x'.repeat(1600) })).status, 400);
  const del = await t.call('DELETE', '/ai/history', 'tok-alice');
  assert.equal(del.body.deleted, 3);
  assert.equal((await t.db.collection('users').doc('alice').collection('aiChat').get()).docs.length, 0);
  assert.equal((await t.db.collection('users').doc('bob').collection('aiChat').get()).docs.length, 0);
  await t.close();
});

test('AI uses Gemini first, then Hugging Face when Gemini fails, and never exposes keys', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.includes('generativelanguage.googleapis.com')) {
      if (fetchImpl.geminiDown) return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gemini says: do squats' }] } }] }), { status: 200 });
    }
    if (url.includes('router.huggingface.co')) return new Response(JSON.stringify({ choices: [{ message: { content: 'HF says: do lunges' } }] }), { status: 200 });
    throw new Error('unexpected url ' + url);
  };
  const t = await setup({ env: { GEMINI_API_KEY: 'g-secret', HF_API_TOKEN: 'hf-secret' }, fetchImpl });
  const a = await t.call('POST', '/ai/chat', 'tok-alice', { message: 'What leg exercise?' });
  assert.equal(a.body.provider, 'gemini');
  assert.match(a.body.reply, /Gemini says/);
  const g = calls.find((c) => c.url.includes('generativelanguage'));
  assert.equal(g.init.headers['x-goog-api-key'], 'g-secret');
  const sent = JSON.parse(g.init.body);
  assert.match(sent.systemInstruction.parts[0].text, /Fitness level: intermediate/, 'member data personalises the prompt');
  assert.match(sent.systemInstruction.parts[0].text, /Upper Body Builder/);
  assert.ok(!sent.systemInstruction.parts[0].text.includes('alice@x.com'), 'no email sent to the model');
  assert.ok(!JSON.stringify(a.body).includes('g-secret'));

  fetchImpl.geminiDown = true;
  const b = await t.call('POST', '/ai/chat', 'tok-alice', { message: 'Another one?' });
  assert.equal(b.body.provider, 'huggingface');
  assert.match(b.body.reply, /HF says/);

  const failAll = async () => new Response('boom', { status: 500 });
  const t2 = await setup({ env: { GEMINI_API_KEY: 'g', HF_API_TOKEN: 'h' }, fetchImpl: failAll });
  const c = await t2.call('POST', '/ai/chat', 'tok-alice', { message: 'What should I eat?' });
  assert.equal(c.body.provider, 'built-in coach');
  assert.match(c.body.reply, /nutrition/i);
  await t.close();
  await t2.close();
});

test('rule-based coach refuses medical questions and points to a professional', () => {
  const r = ruleBasedReply('I have chest pain when I run', { level: 'beginner', workoutsLast7Days: 0, recentWorkouts: [], recentRuns: [], avgWaterMlPerDay7d: 0 });
  assert.match(r, /can't give medical advice/i);
});

// ------------------------------------------------------------ pure logic
test('computeSubscription extends active plans and restarts expired ones', () => {
  const now = 1_000_000_000_000;
  const plan = { id: 'p', name: 'P', durationDays: 30 };
  const fresh = computeSubscription(null, plan, now);
  assert.equal(fresh.expiresAt, now + 30 * DAY_MS);
  const active = computeSubscription({ status: 'active', startsAt: now - DAY_MS, expiresAt: now + 10 * DAY_MS }, plan, now);
  assert.equal(active.expiresAt, now + 40 * DAY_MS);
  assert.equal(active.startsAt, now - DAY_MS);
  const expired = computeSubscription({ status: 'active', startsAt: now - 60 * DAY_MS, expiresAt: now - DAY_MS }, plan, now);
  assert.equal(expired.expiresAt, now + 30 * DAY_MS);
  const deactivated = computeSubscription({ status: 'inactive', startsAt: now - DAY_MS, expiresAt: now + 10 * DAY_MS }, plan, now);
  assert.equal(deactivated.expiresAt, now + 30 * DAY_MS);
});
