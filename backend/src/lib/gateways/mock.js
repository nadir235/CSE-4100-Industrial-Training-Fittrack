'use strict';

/**
 * Built-in SANDBOX gateway for development. It behaves like a real gateway from the app's point
 * of view: the customer "pays" on the gateway side (POST /payments/:id/sandbox-pay records the
 * outcome in the server's payment record) and the server then verifies that stored gateway
 * state. Nothing about success is accepted from the client's say-so on the verify call.
 */
function create() {
  return {
    name: 'mock',
    sandbox: true,
    async init() {
      return {}; // no redirect: the app shows the sandbox simulator
    },
    async verify(payment) {
      const outcome = payment.sandboxOutcome;
      if (outcome === 'success') return { state: 'paid', amount: payment.amount, ref: `MOCK-${payment.txnId}` };
      if (outcome === 'fail' || outcome === 'cancel') return { state: 'failed' };
      return { state: 'pending' };
    },
  };
}

module.exports = { create };
