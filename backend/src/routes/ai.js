'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { z } = require('zod');
const { requireAuth, requireMember, wrap } = require('../lib/middleware');
const { answer } = require('../lib/ai');

function aiRouter({ auth, db, env, fetchImpl }) {
  const router = express.Router();
  router.use(requireAuth(auth), requireMember);
  router.use(rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false, keyGenerator: (req) => req.user.uid, validate: { keyGeneratorIpFallback: false } }));

  const chatBody = z.object({ message: z.string().trim().min(1).max(1500) });

  router.post('/chat', wrap(async (req, res) => {
    const { message } = chatBody.parse(req.body);
    const col = db.collection('users').doc(req.user.uid).collection('aiChat');

    const prev = await col.orderBy('at', 'desc').limit(10).get();
    const history = prev.docs.map((d) => d.data()).reverse().map((m) => ({ role: m.role, text: m.text }));

    const now = Date.now();
    await col.doc().set({ role: 'user', text: message, at: now });
    const { text, provider } = await answer({ db, uid: req.user.uid, message, history, env, fetchImpl });
    await col.doc().set({ role: 'assistant', text, at: Math.max(Date.now(), now + 1), provider });
    res.json({ reply: text, provider });
  }));

  router.delete('/history', wrap(async (req, res) => {
    const col = db.collection('users').doc(req.user.uid).collection('aiChat');
    const snap = await col.get();
    for (let i = 0; i < snap.docs.length; i += 400) {
      const batch = db.batch();
      snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    res.json({ ok: true, deleted: snap.docs.length });
  }));

  return router;
}

module.exports = { aiRouter };
