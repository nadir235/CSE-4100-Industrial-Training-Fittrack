'use strict';
const { HttpError } = require('../middleware');

/**
 * A gateway implements:
 *   name: string
 *   sandbox: boolean
 *   init(payment, user, ctx)   -> { redirectUrl? }
 *   verify(payment, hints, ctx)-> { state: 'paid' | 'failed' | 'pending', amount?: number, ref?: string }
 *
 * `verify` MUST ask the gateway (server-to-server) — never trust anything the client or a redirect says.
 */
function selectGateway(env = process.env) {
  const which = (env.PAYMENT_GATEWAY || 'mock').toLowerCase();
  if (which === 'sslcommerz') return require('./sslcommerz').create(env);
  if (which === 'mock') {
    if (env.NODE_ENV === 'production' && env.ALLOW_MOCK_PAYMENTS !== 'true') {
      throw new HttpError(500, 'The mock payment gateway is disabled in production. Set PAYMENT_GATEWAY to a real gateway.');
    }
    return require('./mock').create();
  }
  throw new Error(`Unknown PAYMENT_GATEWAY "${which}"`);
}

module.exports = { selectGateway };
