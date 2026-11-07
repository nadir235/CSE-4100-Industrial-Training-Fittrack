import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, Chips, EmptyState, Grid, Loading, Row, Screen, StatCard, useBusy, useDialog } from '../../components/ui';
import { adminApi } from '../../lib/adminApi';
import { useCol } from '../../lib/db';
import { fmtDateTime, money } from '../../lib/format';
import { statusTone } from '../../lib/payments';
import { colors } from '../../lib/theme';
import type { Payment } from '../../lib/types';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'successful', label: 'Successful' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

export default function Payments() {
  const payments = useCol<Payment>('payments', { order: ['createdAt', 'desc'], limit: 300 });
  const { confirm } = useDialog();
  const { run } = useBusy();
  const [filter, setFilter] = useState('all');
  const list = useMemo(() => payments.data.filter((p) => filter === 'all' || p.status === filter), [payments.data, filter]);
  const revenue = payments.data.filter((p) => p.status === 'successful').reduce((s, p) => s + p.amount, 0);
  const pending = payments.data.filter((p) => p.status === 'pending');

  return (
    <Screen title="Payments" subtitle="Transactions across all members">
      <Grid cols={{ mobile: 2, tablet: 3, desktop: 3 }}>
        <StatCard icon="cash-check" label="Collected" value={money(revenue)} color={colors.success} />
        <StatCard icon="cash-clock" label="Pending" value={String(pending.length)} sub={money(pending.reduce((s, p) => s + p.amount, 0))} color={colors.warning} />
        <StatCard icon="receipt-text" label="Transactions" value={String(payments.data.length)} />
      </Grid>
      <View style={{ height: 12 }} />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />
      {payments.loading ? <Loading /> : list.length === 0 ? (
        <EmptyState icon="cash-remove" title="No payments" />
      ) : (
        <View style={{ gap: 8 }}>
          {list.map((p) => (
            <Card key={p.id}>
              <Row style={{ flexWrap: 'wrap' }}>
                <View style={{ flex: 1, minWidth: 200 }}>
                  <AppText variant="h3">{p.memberName || 'Member'} · {p.planName}</AppText>
                  <AppText variant="caption" muted>{fmtDateTime(p.createdAt)} · {p.method.toUpperCase()} via {p.gateway} · {p.txnId}</AppText>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <AppText style={{ fontWeight: '800' }}>{money(p.amount, p.currency)}</AppText>
                  <Badge text={p.status.toUpperCase()} tone={statusTone(p.status)} />
                </View>
                {p.status === 'successful' ? (
                  <Button title="Refund" size="sm" variant="ghost" onPress={async () => {
                    if (await confirm({ title: 'Mark as refunded?', message: 'This records the refund and removes the purchased days from the member\'s membership. Refund the money through your gateway dashboard.', confirmText: 'Mark refunded', destructive: true })) await run(() => adminApi.refund(p.id), { success: 'Payment marked as refunded' });
                  }} />
                ) : null}
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
