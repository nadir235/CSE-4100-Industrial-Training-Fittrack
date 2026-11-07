'use strict';

/**
 * SSLCommerz (sandbox or live). Supports bKash, Nagad and cards via the hosted payment page.
 * Docs: https://developer.sslcommerz.com/doc/v4/
 *
 * NOTE: written against the public docs; it has not been run against a live sandbox store from
 * the build environment. Test it with your own sandbox credentials (see README).
 */
const METHOD_TO_CARDS = {
  bkash: 'bkash',
  nagad: 'nagad',
  card: 'visacard,mastercard,amexcard',
  sslcommerz: '',
};

function create(env) {
  const storeId = env.SSLCZ_STORE_ID;
  const storePass = env.SSLCZ_STORE_PASSWD;
  const sandbox = env.SSLCZ_SANDBOX !== 'false';
  if (!storeId || !storePass) throw new Error('SSLCZ_STORE_ID and SSLCZ_STORE_PASSWD are required for PAYMENT_GATEWAY=sslcommerz');
  const host = sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
  const publicUrl = (env.PUBLIC_URL || '').replace(/\/$/, '');

  async function getJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`SSLCommerz HTTP ${res.status}`);
    return res.json();
  }

  return {
    name: 'sslcommerz',
    sandbox,

    async init(payment, user) {
      const body = new URLSearchParams({
        store_id: storeId,
        store_passwd: storePass,
        total_amount: payment.amount.toFixed(2),
        currency: payment.currency,
        tran_id: payment.txnId,
        success_url: `${publicUrl}/payments/sslcommerz/return?result=success`,
        fail_url: `${publicUrl}/payments/sslcommerz/return?result=failed`,
        cancel_url: `${publicUrl}/payments/sslcommerz/return?result=cancelled`,
        ipn_url: `${publicUrl}/payments/sslcommerz/ipn`,
        product_name: payment.planName,
        product_category: 'Gym membership',
        product_profile: 'non-physical-goods',
        shipping_method: 'NO',
        num_of_item: '1',
        emi_option: '0',
        cus_name: user.name || 'Member',
        cus_email: user.email || 'member@example.com',
        cus_add1: 'N/A',
        cus_city: 'Dhaka',
        cus_postcode: '1000',
        cus_country: 'Bangladesh',
        cus_phone: user.phone || '01700000000',
        value_a: payment.id,
      });
      const cards = METHOD_TO_CARDS[payment.method];
      if (cards) body.set('multi_card_name', cards);
      const res = await fetch(`${host}/gwprocess/v4/api.php`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      const json = await res.json();
      if (json.status !== 'SUCCESS' || !json.GatewayPageURL) throw new Error(`SSLCommerz refused the session: ${json.failedreason || 'unknown reason'}`);
      return { redirectUrl: json.GatewayPageURL };
    },

    async verify(payment, hints = {}) {
      const q = (o) => new URLSearchParams({ ...o, store_id: storeId, store_passwd: storePass, format: 'json' }).toString();

      // Preferred: validate by val_id (from the IPN). The val_id is only a lookup key — the gateway's answer is what counts.
      if (hints.valId) {
        const v = await getJson(`${host}/validator/api/validationserverAPI.php?${q({ val_id: hints.valId })}`);
        if (v.tran_id !== payment.txnId) return { state: 'failed' }; // val_id belongs to a different transaction
        if (v.status === 'VALID' || v.status === 'VALIDATED') return { state: 'paid', amount: Number(v.currency_amount || v.amount), ref: v.bank_tran_id || hints.valId };
        if (v.status === 'INVALID_TRANSACTION') return { state: 'failed' };
        return { state: 'pending' };
      }

      // Fallback: ask the gateway about our own tran_id.
      const t = await getJson(`${host}/validator/api/merchantTransIDvalidationAPI.php?${q({ tran_id: payment.txnId })}`);
      const rows = Array.isArray(t.element) ? t.element : t.status ? [t] : [];
      const ok = rows.find((r) => r.status === 'VALID' || r.status === 'VALIDATED');
      if (ok) {
        // re-validate the val_id so we never act on a lookup alone
        if (ok.val_id) return this.verify(payment, { valId: ok.val_id });
        return { state: 'paid', amount: Number(ok.currency_amount || ok.amount), ref: ok.bank_tran_id };
      }
      if (rows.some((r) => ['FAILED', 'CANCELLED', 'EXPIRED'].includes(r.status))) return { state: 'failed' };
      return { state: 'pending' };
    },
  };
}

module.exports = { create };
