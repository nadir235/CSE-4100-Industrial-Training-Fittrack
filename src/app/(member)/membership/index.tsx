import React, { useEffect, useMemo, useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Badge, Banner, Button, Card, Chips, EmptyState, Grid, Icon, KeyValue, Loading, Row, Screen, SectionTitle, Sheet, useBusy, useDialog } from '../../../components/ui';
import { useAuth } from '../../../lib/auth';
import { api } from '../../../lib/api';
import { useCol, useDocData } from '../../../lib/db';
import { daysUntil, fmtDate, money } from '../../../lib/format';
import { METHODS, statusTone } from '../../../lib/payments';
import { colors } from '../../../lib/theme';
import type { Payment, PaymentStatus, Plan, Subscription } from '../../../lib/types';

type Config = { gateway: 'mock' | 'sslcommerz'; sandbox: boolean; currency: string };

export default function Membership() {
  const { user } = useAuth();
  const { toast } = useDialog();
  const { busy, run } = useBusy();
  const plans = useCol<Plan>('plans', { where: [['active', '==', true]] });
  const payments = useCol<Payment>(user ? 'payments' : null, { where: [['uid', '==', user?.uid || '']] });
  const sub = useDocData<Subscription>(user ? `subscriptions/${user.uid}` : null);

  const [config, setConfig] = useState<Config | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [method, setMethod] = useState('bkash');
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const live = useDocData<Payment>(paymentId ? `payments/${paymentId}` : null);

  useEffect(() => {
    api<Config>('/payments/config').then(setConfig).catch(() => setConfig(null));
  }, []);

  const sorted = useMemo(() => [...plans.data].sort((a, b) => a.durationDays - b.durationDays), [plans.data]);
  const history = useMemo(() => [...payments.data].sort((a, b) => b.createdAt - a.createdAt), [payments.data]);
  const days = daysUntil(sub.data?.expiresAt);
  const active = sub.data?.status === 'active' && (days ?? 0) > 0;

  const close = () => {
    setPlan(null);
    setPaymentId(null);
    setRedirectUrl(null);
  };

  const checkout = () =>
    run(async () => {
      if (!plan) return;
      const r = await api<{ paymentId: string; redirectUrl?: string }>('/payments/checkout', { body: { planId: plan.id, method } });
      setPaymentId(r.paymentId);
      if (r.redirectUrl) {
        setRedirectUrl(r.redirectUrl);
        Linking.openURL(r.redirectUrl).catch(() => toast('Could not open the payment page.', 'bad'));
      }
    });

  const sandboxPay = (outcome: 'success' | 'fail' | 'cancel') =>
    run(async () => {
      if (!paymentId) return;
      await api(`/payments/${paymentId}/sandbox-pay`, { body: { outcome } });
      await api(`/payments/${paymentId}/verify`, { method: 'POST', body: {} });
    });

  const recheck = () =>
    run(async () => {
      if (!paymentId) return;
      const r = await api<{ status: PaymentStatus }>(`/payments/${paymentId}/verify`, { method: 'POST', body: {} });
      if (r.status === 'pending') toast('Still waiting for the gateway to confirm.', 'info');
    });

  const status = live.data?.status;

  return (
    <Screen title="Membership" subtitle="Plans, payments and receipts">
      <Card accent={active ? colors.success : colors.warning}>
        {sub.loading ? (
          <Loading />
        ) : sub.data ? (
          <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <View>
              <AppText variant="label" muted>Current plan</AppText>
              <AppText variant="h2">{sub.data.planName}</AppText>
              <AppText muted>{active ? `Expires ${fmtDate(sub.data.expiresAt)} · ${days} days left` : sub.data.status === 'inactive' ? 'Deactivated by the gym — contact the front desk.' : `Expired ${fmtDate(sub.data.expiresAt)}`}</AppText>
            </View>
            <Badge text={active ? 'ACTIVE' : sub.data.status === 'inactive' ? 'DEACTIVATED' : 'EXPIRED'} tone={active ? 'good' : 'warn'} />
          </Row>
        ) : (
          <Row><Icon name="card-account-details-outline" color={colors.warning} /><AppText>You don't have a membership yet. Pick a plan below.</AppText></Row>
        )}
      </Card>

      <SectionTitle title={active ? 'Extend your membership' : 'Choose a plan'} />
      {plans.loading ? (
        <Loading />
      ) : sorted.length === 0 ? (
        <EmptyState icon="tag-outline" title="No plans available" text="The gym hasn't published any membership plans yet." />
      ) : (
        <Grid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
          {sorted.map((p) => (
            <Card key={p.id} style={{ flex: 1 }}>
              <AppText variant="h3">{p.name}</AppText>
              <AppText variant="h1" color={colors.primary} style={{ marginVertical: 4 }}>{money(p.price)}</AppText>
              <AppText variant="caption" muted>{p.durationDays} days</AppText>
              <AppText muted style={{ marginVertical: 8 }}>{p.description}</AppText>
              {p.features.map((f) => (
                <Row key={f} gap={6} style={{ marginBottom: 3 }}>
                  <Icon name="check" size={16} color={colors.success} />
                  <AppText variant="caption" style={{ flex: 1 }}>{f}</AppText>
                </Row>
              ))}
              <Button title={active ? 'Extend' : 'Select plan'} onPress={() => { setPlan(p); setMethod('bkash'); }} style={{ marginTop: 12 }} full />
            </Card>
          ))}
        </Grid>
      )}

      <SectionTitle title="Payment history" />
      {history.length === 0 ? (
        <EmptyState icon="receipt-text-outline" title="No payments yet" />
      ) : (
        <View style={{ gap: 8 }}>
          {history.map((p) => (
            <Card key={p.id} onPress={() => router.navigate({ pathname: '/membership/receipt', params: { id: p.id } } as any)}>
              <Row>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{p.planName}</AppText>
                  <AppText variant="caption" muted>{fmtDate(p.createdAt)} · {p.method.toUpperCase()} · {p.txnId}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText style={{ fontWeight: '800' }}>{money(p.amount, p.currency)}</AppText>
                  <Badge text={p.status.toUpperCase()} tone={statusTone(p.status)} />
                </View>
              </Row>
            </Card>
          ))}
        </View>
      )}

      <Sheet visible={!!plan} onClose={close} title={status === 'successful' ? 'Payment successful' : 'Checkout'}>
        {plan ? (
          status === 'successful' ? (
            <View style={{ alignItems: 'center', padding: 12 }}>
              <Icon name="check-decagram" size={56} color={colors.success} />
              <AppText variant="h2" style={{ marginTop: 8 }}>You're all set!</AppText>
              <AppText muted center style={{ marginVertical: 8 }}>Your {plan.name} membership is active. A receipt is available in your payment history.</AppText>
              <Row style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button title="View receipt" variant="secondary" onPress={() => { const id = paymentId; close(); router.navigate({ pathname: '/membership/receipt', params: { id } } as any); }} />
                <Button title="Done" onPress={close} />
              </Row>
            </View>
          ) : paymentId ? (
            <View>
              <KeyValue label="Plan" value={plan.name} />
              <KeyValue label="Amount" value={money(plan.price)} />
              <KeyValue label="Method" value={METHODS.find((m) => m.value === method)?.label || method} />
              <View style={{ marginVertical: 12 }}>
                <Badge text={(status || 'pending').toUpperCase()} tone={statusTone((status || 'pending') as PaymentStatus)} />
              </View>
              {status === 'failed' || status === 'refunded' ? (
                <>
                  <Banner tone="bad" text="The payment did not go through. No membership was activated and you have not been charged." />
                  <Button title="Try again" onPress={() => { setPaymentId(null); setRedirectUrl(null); }} full />
                </>
              ) : config?.gateway === 'mock' ? (
                <>
                  <Banner tone="info" text="SANDBOX MODE — no real money is used. Choose what the test gateway should do. Your membership only activates after the server verifies the result." />
                  <Row style={{ flexWrap: 'wrap' }}>
                    <Button title="Simulate successful payment" icon="check" onPress={() => sandboxPay('success')} loading={busy} />
                    <Button title="Simulate failure" variant="secondary" onPress={() => sandboxPay('fail')} loading={busy} />
                  </Row>
                </>
              ) : (
                <>
                  <AppText muted style={{ marginBottom: 10 }}>Complete the payment in the secure gateway page. This screen updates automatically once the server confirms it.</AppText>
                  <Row style={{ flexWrap: 'wrap' }}>
                    {redirectUrl ? <Button title="Open payment page" icon="open-in-new" onPress={() => Linking.openURL(redirectUrl)} /> : null}
                    <Button title="I've paid — check status" variant="secondary" onPress={recheck} loading={busy} />
                  </Row>
                </>
              )}
            </View>
          ) : (
            <View>
              <KeyValue label="Plan" value={plan.name} />
              <KeyValue label="Duration" value={`${plan.durationDays} days`} />
              <KeyValue label="Total" value={money(plan.price)} />
              <View style={{ height: 12 }} />
              <Chips label="Payment method" value={method} onChange={setMethod} options={METHODS} />
              {config?.gateway === 'mock' ? <Banner tone="info" text="Sandbox payments are enabled — this is a test checkout with dummy money." /> : null}
              <AppText variant="caption" muted style={{ marginBottom: 12 }}>Card details are never stored by FitTrack. Payments are processed by the gateway and verified by our server before your membership changes.</AppText>
              <Button title={`Pay ${money(plan.price)}`} icon="lock" onPress={checkout} loading={busy} full />
            </View>
          )
        ) : null}
      </Sheet>
    </Screen>
  );
}
