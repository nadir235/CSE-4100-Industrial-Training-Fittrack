import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, LineChart } from '../../components/charts';
import { AppText, Button, Card, EmptyState, Grid, IconButton, Input, Row, Screen, SectionTitle, StatCard, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { bmi, bmiCategory } from '../../lib/calc';
import { fmtDate, round } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { sumByWeek } from '../../lib/stats';
import { colors } from '../../lib/theme';
import type { CalcEntry, WeightEntry, WorkoutLog } from '../../lib/types';

export default function Progress() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const weights = useMine<WeightEntry>('weights', { order: ['at', 'desc'], limit: 120 });
  const logs = useMine<WorkoutLog>('workoutLogs', { order: ['at', 'desc'], limit: 300 });
  const calcs = useMine<CalcEntry>('calcHistory', { order: ['at', 'desc'], limit: 200 });
  const [kg, setKg] = useState('');

  const latest = weights.data[0];
  const first = weights.data[weights.data.length - 1];
  const line = useMemo(() => [...weights.data].reverse().map((w) => ({ label: new Date(w.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: w.kg })), [weights.data]);
  const bmiLine = useMemo(() => {
    const cm = profile?.heightCm;
    if (!cm) return [];
    return [...weights.data].reverse().map((w) => ({ label: new Date(w.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: round(bmi(w.kg, cm), 1) }));
  }, [weights.data, profile?.heightCm]);
  const bfLine = useMemo(() => calcs.data.filter((c) => c.type === 'bodyfat').reverse().map((c) => ({ label: new Date(c.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: c.value })), [calcs.data]);
  const weekly = useMemo(() => sumByWeek(logs.data, 8, (l) => l.durationMin), [logs.data]);

  const add = async () => {
    const v = Number(kg);
    if (!isFinite(v) || v < 25 || v > 300) return toast('Enter a weight between 25 and 300 kg.', 'warn');
    await run(async () => {
      await actions.add('weights', { kg: round(v, 1), at: Date.now() });
      await actions.updateProfile({ weightKg: round(v, 1) });
      setKg('');
    }, { success: 'Weight logged' });
  };

  return (
    <Screen title="Progress" subtitle="Your body and training trends">
      <Grid cols={{ mobile: 2, tablet: 4, desktop: 4 }}>
        <StatCard icon="scale-bathroom" label="Current weight" value={latest ? String(latest.kg) : '—'} unit="kg" sub={latest ? fmtDate(latest.at) : undefined} />
        <StatCard icon="swap-vertical" label="Change since first" value={latest && first && latest.id !== first.id ? `${latest.kg - first.kg >= 0 ? '+' : ''}${round(latest.kg - first.kg)}` : '—'} unit="kg" />
        <StatCard icon="human" label="BMI" value={latest && profile?.heightCm ? String(round(bmi(latest.kg, profile.heightCm))) : '—'} sub={latest && profile?.heightCm ? bmiCategory(bmi(latest.kg, profile.heightCm)).label : 'Add height in Profile'} />
        <StatCard icon="dumbbell" label="Workouts logged" value={String(logs.data.length)} />
      </Grid>

      <SectionTitle title="Log weight" />
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <Input style={{ flex: 1, marginBottom: 0 }} value={kg} onChangeText={setKg} keyboardType="decimal-pad" unit="kg" placeholder="e.g. 72.5" />
          <Button title="Save" onPress={add} loading={busy} />
        </Row>
      </Card>

      <SectionTitle title="Charts" />
      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Weight (kg)</AppText><LineChart data={line} unit="kg" /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>BMI</AppText><LineChart data={bmiLine} color={colors.info} emptyText={profile?.heightCm ? 'Log at least two weights' : 'Add your height in Profile to see BMI'} /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Body fat % (from calculator)</AppText><LineChart data={bfLine} color={colors.warning} unit="%" emptyText="Save two Body Fat calculator results" /></Card>
        <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Training minutes per week</AppText><BarChart data={weekly} unit="min" format={(v) => String(Math.round(v))} /></Card>
      </Grid>

      <SectionTitle title="Weight history" />
      {weights.data.length === 0 ? (
        <EmptyState icon="scale-bathroom" title="No weights logged" text="Add your weight above to start tracking." />
      ) : (
        <View style={{ gap: 6 }}>
          {weights.data.slice(0, 30).map((w) => (
            <Card key={w.id} padded={false} style={{ paddingVertical: 8, paddingHorizontal: 14 }}>
              <Row>
                <AppText style={{ flex: 1 }}>{fmtDate(w.at)}</AppText>
                <AppText style={{ fontWeight: '700' }}>{w.kg} kg</AppText>
                <IconButton
                  icon="trash-can-outline"
                  size={18}
                  color={colors.textDim}
                  label="Delete entry"
                  onPress={async () => {
                    if (await confirm({ title: 'Delete this entry?', confirmText: 'Delete', destructive: true })) await run(() => actions.del('weights', w.id));
                  }}
                />
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
