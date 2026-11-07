'use strict';

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Verifies the Firebase ID token and attaches req.user = { uid, email, admin }. */
function requireAuth(auth) {
  return async (req, _res, next) => {
    try {
      const h = req.headers.authorization || '';
      const m = /^Bearer (.+)$/.exec(h);
      if (!m) throw new HttpError(401, 'Missing authorization token');
      let decoded;
      try {
        decoded = await auth.verifyIdToken(m[1]);
      } catch {
        throw new HttpError(401, 'Invalid or expired session. Please sign in again.');
      }
      req.user = { uid: decoded.uid, email: decoded.email || null, name: decoded.name || null, admin: decoded.admin === true };
      next();
    } catch (e) {
      next(e);
    }
  };
}

/** Admin role comes ONLY from the verified token's custom claim — never from the request body. */
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.admin !== true) return next(new HttpError(403, 'Administrator access required'));
  next();
}

function requireMember(req, _res, next) {
  if (!req.user || req.user.admin === true) return next(new HttpError(403, 'This action is for gym members'));
  next();
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function errorHandler(err, _req, res, _next) {
  if (err && err.name === 'ZodError') {
    const first = err.issues?.[0];
    return res.status(400).json({ error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input' });
  }
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong on the server.' : err.message });
}

module.exports = { HttpError, requireAuth, requireAdmin, requireMember, wrap, errorHandler };
