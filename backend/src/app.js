'use strict';
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { errorHandler, HttpError } = require('./lib/middleware');
const { selectGateway } = require('./lib/gateways');
const { aiRouter } = require('./routes/ai');
const { adminRouter } = require('./routes/admin');
const { paymentsRouter } = require('./routes/payments');

/**
 * Builds the Express app. `auth` (token verifier) and `db` (Firestore) are injected so the same
 * code runs against Firebase Admin in production and an in-memory fake in tests.
 */
function createApp({ auth, db, env = process.env, gateway, fetchImpl }) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());

  const origins = (env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true); // native apps & curl send no Origin header
        if (origins.includes(origin)) return cb(null, true);
        cb(new HttpError(403, 'Origin not allowed'));
      },
      allowedHeaders: ['Content-Type', 'Authorization'],
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      maxAge: 600,
    }),
  );
  app.use(rateLimit({ windowMs: 15 * 60_000, limit: 600, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({ limit: '50kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  const gw = gateway || selectGateway(env);
  app.use('/ai', aiRouter({ auth, db, env, fetchImpl }));
  app.use('/admin', adminRouter({ auth, db, env }));
  app.use('/payments', paymentsRouter({ auth, db, gateway: gw, env }));

  app.use((_req, _res, next) => next(new HttpError(404, 'Not found')));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
