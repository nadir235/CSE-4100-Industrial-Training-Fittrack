import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { BarChart, LineChart } from '../../../components/charts';
import { AppText, Avatar, Badge, Banner, Button, Card, Chips, EmptyState, Grid, KeyValue, Loading, Row, Screen, SectionTitle, Sheet, StatCard, useBusy, useDialog } from '../../../components/ui';
import { adminApi, type MemberDetail } from '../../../lib/adminApi';
import { bmi, bmiCategory } from '../../../lib/calc';
import { daysUntil, fmtDate, fmtDateTime, fmtDuration, fmtPace, money, round } from '../../../lib/format';
import { useCol } from '../../../lib/db';
import { statusTone } from '../../../lib/payments';
import { colors } from '../../../lib/theme';
import type { Plan } from '../../../lib/types';

export default function MemberDetailScreen() {
  const { uid } = useLocalSearchParams<{ uid: string }>();
  const { confirm } = useDialog();
  const { busy, run } = useBusy();
  const plans = useCol<Plan>('plans');
  const [d, setD] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grant, setGrant] = useState(false);
  const [planId, setPlanId] = useState('');

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      setD(await adminApi.member(uid));
    } catch (e: any) {
      setError(e?.message || 'Could not load member');
    } finally {
      setLoading(false);
    }
  }, [uid]);
  useEffect(() => {
    load();
  }, [load]);

  const weightLine = useMemo(() => (d ? [...d.weights].reverse().map((w) => ({ label: new Date(w.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: w.kg })) : []), [d]);
  const bmiLine = useMemo(() => (d?.profile.heightCm ? [...d.weights].reverse().map((w) => ({ label: new Date(w.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: round(bmi(w.kg, d.profile.heightCm!), 1) })) : []), [d]);
  const waterBars = useMemo(() => (d ? d.water.map((w) => ({ label: w.day.slice(5), value: w.ml })) : []), [d]);
  const workoutsByWeek = useMemo(() => {
    if (!d) return [];
    const out: { label: string; value: number }[] = [];
    const now = Date.now();
    for (let i = 7; i >= 0; i--) {
      const end = now - i * 7 * 86_400_000;
      const start = end - 7 * 86_400_000;
      out.push({ label: new Date(start).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: d.workouts.filter((w) => w.at > start && w.at <= end).length });
    }
    return out;
  }, [d]);

  if (loading && !d) return <Screen title="Member" back="/members"><Loading /></Screen>;
  if (error || !d)
    return (
      <Screen title="Member" back="/members">
        <Banner tone="bad" text={error || 'Member not found'} action={<Button title="Retry" size="sm" onPress={load} />} />
      </Screen>
    );

  const p = d.profile;
  const sub = d.subscription;
  const days = daysUntil(sub?.expiresAt);
  const active = sub?.status === 'active' && (days ?? 0) > 0;
  const lastW = d.weights[0]?.kg;
  const runKm = d.running.reduce((s, r) => s + r.distanceKm, 0);

  const deactivate = async () => {
    if (await confirm({ title: 'Deactivate membership?', message: `${p.name} will lose gym access until you re-activate it.`, confirmText: 'Deactivate', destructive: true })) {
      await run(async () => {
        await adminApi.setMembership(uid!, { action: 'deactivate' });
        await load();
      }, { success: 'Membership deactivated' });
    }
  };
  const activate = async () => {
    if (!planId) return;
    await run(async () => {
      await adminApi.setMembership(uid!, { action: 'activate', planId });
      setGrant(false);
      await load();
    }, { success: 'Membership activated' });
  };

  return (
    <Screen title={p.name} subtitle={p.email} back="/members">
      <Card>
        <Row gap={14} style={{ flexWrap: 'wrap' }}>
          <Avatar name={p.name} uri={p.photoData} size={64} />
          <View style={{ flex: 1, minWidth: 200 }}>
            <AppText variant="h3">{p.name}</AppText>
            <AppText muted variant="caption">Registered {fmtDate(p.createdAt)}{p.phone ? ` · ${p.phone}` : ''}</AppText>
            <Row style={{ marginTop: 6 }}>
              <Badge text={p.fitnessLevel.toUpperCase()} tone="info" />
              {p.goal ? <Badge text={p.goal.replace('-', ' ').toUpperCase()} tone="neutral" /> : null}
            </Row>
          </View>
        </Row>
      </Card>

      <SectionTitle title="Membership" />
      <Card accent={active ? colors.success : colors.warning}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <View>
            <AppText variant="h3">{sub ? sub.planName : 'No membership'}</AppText>
            <AppText muted variant="caption">{sub ? (active ? `Expires ${fmtDate(sub.expiresAt)} · ${days} days left` : sub.status === 'inactive' ? 'Deactivated' : `Expired ${fmtDate(sub.expiresAt)}`) : 'Never purchased'}</AppText>
          </View>
          <Row>
            {sub && active ? <Button title="Deactivate" variant="danger" size="sm" onPress={deactivate} loading={busy} /> : null}
            <Button title={active ? 'Extend / change' : 'Activate'} size="sm" onPress={() => { setPlanId(plans.data.find((x) => x.active)?.id || ''); setGrant(true); }} />
          </Row>
        </Row>
      </Card>

      <SectionTitle title="Snapshot" />
      <Grid cols={{ mobile: 2, tablet: 4, desktop: 4 }}>
        <StatCard icon="dumbbell" label="Workouts (recent)" value={String(d.workouts.length)} />
        <StatCard icon="scale-bathroom" label="Weight" value={lastW ? String(lastW) : p.weightKg ? String(p.weightKg) : '—'} unit="kg" />
        <StatCard icon="human" label="BMI" value={(lastW || p.weightKg) && p.heightCm ? String(round(bmi((lastW || p.weightKg)!, p.heightCm))) : '—'} sub={(lastW || p.weightKg) && p.heightCm ? bmiCategory(bmi((lastW || p.weightKg)!, p.heightCm)).label : 'No height on file'} />
        <StatCard icon="run-fast" label="Running (recent)" value={String(round(runKm))} unit="km" color={colors.success} />
      </Grid>

      <SectionTitle title="Progress charts" />
      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Weight (kg)</AppText><LineChart data={weightLine} unit="kg" /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>BMI history</AppText><LineChart data={bmiLine} color={colors.info} emptyText="Needs height and two weights" /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Workouts per week</AppText><BarChart data={workoutsByWeek} format={(v) => String(Math.round(v))} /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Water intake (last 14 days)</AppText><BarChart data={waterBars} color="#4DA3FF" unit="ml" format={(v) => String(Math.round(v))} /></Card>
      </Grid>

      <SectionTitle title="Workout history" />
      {d.workouts.length === 0 ? <EmptyState icon="dumbbell" title="No workouts yet" /> : (
        <View style={{ gap: 6 }}>
          {d.workouts.slice(0, 15).map((w) => (
            <Card key={w.id} padded={false} style={{ padding: 12 }}>
              <Row><View style={{ flex: 1 }}><AppText variant="h3">{w.title}</AppText><AppText variant="caption" muted>{fmtDateTime(w.at)} · {w.durationMin} min · {Math.round(w.calories)} kcal</AppText></View><Badge text={String(w.level).toUpperCase()} tone="neutral" /></Row>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle title="Running" />
      {d.running.length === 0 ? <EmptyState icon="run" title="No runs recorded" /> : (
        <View style={{ gap: 6 }}>
          {d.running.slice(0, 10).map((r) => (
            <Card key={r.id} padded={false} style={{ padding: 12 }}>
              <AppText variant="h3">{r.distanceKm} km · {fmtDuration(r.durationSec)}</AppText>
              <AppText variant="caption" muted>{fmtDateTime(r.at)} · {fmtPace(r.paceSecPerKm)}</AppText>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle title="Fasting history" />
      {d.fasting.length === 0 ? <EmptyState icon="timer-sand-empty" title="No fasting sessions" /> : (
        <View style={{ gap: 6 }}>
          {d.fasting.slice(0, 10).map((f) => (
            <Card key={f.id} padded={false} style={{ padding: 12 }}>
              <Row><View style={{ flex: 1 }}><AppText variant="h3">{f.label}</AppText><AppText variant="caption" muted>{fmtDateTime(f.startedAt)}</AppText></View><Badge text={f.status.toUpperCase().replace('-', ' ')} tone={f.status === 'completed' ? 'good' : f.status === 'active' || f.status === 'paused' ? 'info' : 'warn'} /></Row>
            </Card>
          ))}
        </View>
      )}

      <SectionTitle title="Payment history" />
      {d.payments.length === 0 ? <EmptyState icon="cash-remove" title="No payments" /> : (
        <View style={{ gap: 6 }}>
          {d.payments.map((pay) => (
            <Card key={pay.id} padded={false} style={{ padding: 12 }}>
              <Row>
                <View style={{ flex: 1 }}><AppText variant="h3">{pay.planName}</AppText><AppText variant="caption" muted>{fmtDate(pay.createdAt)} · {pay.method.toUpperCase()} · {pay.txnId}</AppText></View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}><AppText style={{ fontWeight: '800' }}>{money(pay.amount, pay.currency)}</AppText><Badge text={pay.status.toUpperCase()} tone={statusTone(pay.status)} /></View>
              </Row>
            </Card>
          ))}
        </View>
      )}
      <KeyValue label="Age / sex" value={`${p.age ?? '—'} / ${p.sex ?? '—'}`} />

      <Sheet visible={grant} onClose={() => setGrant(false)} title="Activate membership">
        <AppText muted style={{ marginBottom: 10 }}>Grants the selected plan without creating a payment record (use it for complimentary or manually handled memberships). If the member is already active, the plan duration is added to their current expiry.</AppText>
        <Chips value={planId} onChange={setPlanId} options={plans.data.filter((x) => x.active).map((x) => ({ value: x.id, label: `${x.name} · ${money(x.price)}` }))} />
        <Button title="Confirm" onPress={activate} loading={busy} disabled={!planId} full />
      </Sheet>
    </Screen>
  );
}
