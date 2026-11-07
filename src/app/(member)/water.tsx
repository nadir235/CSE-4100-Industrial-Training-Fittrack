import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, WaterGlass } from '../../components/charts';
import { AppText, Banner, Button, Card, Chips, EmptyState, Grid, IconButton, Input, ProgressBar, Row, Screen, SectionTitle, Toggle, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { dayKey, fmtDateTime, startOfDay } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { cancelByPrefix, ensureNotificationPermission, notificationsSupported, scheduleWaterReminders } from '../../lib/notifications';
import { sinceDays, sumByDay } from '../../lib/stats';
import { colors } from '../../lib/theme';
import { usePopup } from '../../components/popup';
import type { WaterEntry } from '../../lib/types';

const QUICK = [150, 250, 330, 500, 750];
const INTERVALS = [
  { value: '60', label: 'Every hour' },
  { value: '90', label: 'Every 1.5 h' },
  { value: '120', label: 'Every 2 h' },
  { value: '180', label: 'Every 3 h' },
];

export default function Water() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const { show } = usePopup();
  const entries = useMine<WaterEntry>('water', { order: ['at', 'desc'], where: [['at', '>=', sinceDays(7)]], limit: 400 });
  const [custom, setCustom] = useState('');
  const [goalInput, setGoalInput] = useState('');

  const goal = profile?.waterGoalMl || 2500;
  const today = startOfDay();
  const todayEntries = useMemo(() => entries.data.filter((e) => e.at >= today), [entries.data, today]);
  const total = todayEntries.reduce((s, e) => s + e.ml, 0);
  const remaining = Math.max(0, goal - total);
  const week = useMemo(() => sumByDay(entries.data, 7, (e) => e.ml), [entries.data]);
  const weekAvg = Math.round(week.reduce((s, d) => s + d.value, 0) / 7);
  const rem = profile?.waterReminders || { enabled: false, everyMinutes: 120 };

  const add = async (ml: number) => {
    if (!isFinite(ml) || ml <= 0 || ml > 3000) return toast('Enter an amount between 1 and 3000 ml.', 'warn');
    await run(() => actions.add('water', { ml: Math.round(ml), at: Date.now(), day: dayKey() }));
    if (total < goal && total + ml >= goal) show({ title: 'Water goal reached 💧', body: `You hit your ${goal} ml goal for today. Great job!`, kind: 'water', href: '/water' });
  };

  const saveGoal = async () => {
    const g = Number(goalInput);
    if (!isFinite(g) || g < 500 || g > 8000) return toast('Choose a goal between 500 and 8000 ml.', 'warn');
    await run(() => actions.updateProfile({ waterGoalMl: Math.round(g) }), { success: 'Goal updated' });
    setGoalInput('');
  };

  const setReminders = async (enabled: boolean, everyMinutes: number) => {
    await run(async () => {
      if (enabled) {
        if (!notificationsSupported) {
          toast('Scheduled reminders work in the Android app. Your preference is saved.', 'info');
        } else if (!(await ensureNotificationPermission())) {
          toast('Notification permission was denied. Enable it in system settings.', 'warn');
          return;
        } else {
          await scheduleWaterReminders(everyMinutes);
        }
      } else {
        await cancelByPrefix('water-');
      }
      await actions.updateProfile({ waterReminders: { enabled, everyMinutes } });
    });
  };

  return (
    <Screen title="Water Tracker" subtitle="Stay hydrated through the day">
      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card style={{ alignItems: 'center' }}>
          <WaterGlass value={total / goal} size={150} />
          <AppText variant="h1" style={{ marginTop: 8 }}>{total} <AppText muted>/ {goal} ml</AppText></AppText>
          <View style={{ width: '100%', marginVertical: 8 }}><ProgressBar value={total / goal} color="#4DA3FF" height={10} /></View>
          <AppText muted>{remaining === 0 ? 'Daily goal reached 🎉' : `${remaining} ml remaining (${Math.ceil(remaining / 250)} glasses)`}</AppText>
        </Card>
        <Card>
          <AppText variant="h3" style={{ marginBottom: 10 }}>Quick add</AppText>
          <Row style={{ flexWrap: 'wrap' }} gap={8}>
            {QUICK.map((ml) => <Button key={ml} title={`+${ml} ml`} variant="secondary" size="sm" onPress={() => add(ml)} />)}
          </Row>
          <Row style={{ alignItems: 'flex-start', marginTop: 14 }}>
            <Input style={{ flex: 1, marginBottom: 0 }} value={custom} onChangeText={setCustom} keyboardType="numeric" unit="ml" placeholder="Custom amount" />
            <Button title="Add" onPress={async () => { await add(Number(custom)); setCustom(''); }} loading={busy} />
          </Row>
          <AppText variant="h3" style={{ marginTop: 20, marginBottom: 6 }}>Daily goal</AppText>
          <Row style={{ alignItems: 'flex-start' }}>
            <Input style={{ flex: 1, marginBottom: 0 }} value={goalInput} onChangeText={setGoalInput} keyboardType="numeric" unit="ml" placeholder={`Currently ${goal}`} hint="Tip: the Water Intake calculator can estimate this for you." />
            <Button title="Set" variant="secondary" onPress={saveGoal} loading={busy} />
          </Row>
        </Card>
      </Grid>

      <SectionTitle title="Reminders" />
      <Card>
        {!notificationsSupported ? <Banner tone="info" text="Scheduled reminders are delivered by the Android app. In the browser your settings are saved and sync to your phone." /> : null}
        <Toggle label="Drinking reminders" hint="Between 8:00 and 22:00" value={rem.enabled} onChange={(v) => setReminders(v, rem.everyMinutes)} />
        <Chips value={String(rem.everyMinutes)} onChange={(v) => setReminders(rem.enabled, Number(v))} options={INTERVALS} />
      </Card>

      <SectionTitle title="Last 7 days" />
      <Card>
        <AppText variant="caption" muted style={{ marginBottom: 6 }}>Average {weekAvg} ml/day</AppText>
        <BarChart data={week} color="#4DA3FF" unit="ml" format={(v) => String(Math.round(v))} />
      </Card>

      <SectionTitle title="Today's log" />
      {todayEntries.length === 0 ? (
        <EmptyState icon="cup-water" title="Nothing logged yet today" />
      ) : (
        <View style={{ gap: 6 }}>
          {todayEntries.map((e) => (
            <Card key={e.id} padded={false} style={{ paddingVertical: 6, paddingHorizontal: 14 }}>
              <Row>
                <AppText style={{ flex: 1 }}>{fmtDateTime(e.at)}</AppText>
                <AppText style={{ fontWeight: '700' }}>{e.ml} ml</AppText>
                <IconButton icon="trash-can-outline" size={18} color={colors.textDim} label="Delete" onPress={async () => {
                  if (await confirm({ title: 'Remove this entry?', confirmText: 'Remove', destructive: true })) await run(() => actions.del('water', e.id));
                }} />
              </Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
