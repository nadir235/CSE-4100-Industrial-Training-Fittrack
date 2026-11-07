import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { BarChart, ProgressRing } from '../../components/charts';
import { AppText, Badge, Banner, Button, Card, Chips, EmptyState, Grid, Input, Row, Screen, SectionTitle, StatCard, useBusy, useDialog } from '../../components/ui';
import { FASTING_DISCLAIMER, FASTING_SCHEDULES, fastingStage } from '../../data/fasting';
import { DAY_MS, fmtDateTime, fmtDuration, round, startOfWeek } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { cancelId, ensureNotificationPermission, notificationsSupported, scheduleIn } from '../../lib/notifications';
import { lastDays } from '../../lib/stats';
import { dayKey } from '../../lib/format';
import { colors } from '../../lib/theme';
import { usePopup } from '../../components/popup';
import type { FastingSession } from '../../lib/types';

const NOTIF_ID = 'fasting-end';

/** Elapsed fasting time in ms, excluding paused time. */
export function fastElapsedMs(f: FastingSession, now: number): number {
  const end = f.status === 'paused' && f.pausedAt ? f.pausedAt : f.endedAt || now;
  return Math.max(0, end - f.startedAt - (f.pausedMs || 0));
}

export default function Fasting() {
  const actions = useMemberActions();
  const { confirm, toast } = useDialog();
  const { busy, run } = useBusy();
  const sessions = useMine<FastingSession>('fasting', { order: ['startedAt', 'desc'], limit: 100 });
  const [schedule, setSchedule] = useState('16:8');
  const [custom, setCustom] = useState('');
  const [now, setNow] = useState(Date.now());
  const { show } = usePopup();
  const announced = React.useRef<string | null>(null);

  const active = sessions.data.find((s) => s.status === 'active' || s.status === 'paused');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active?.id, active?.status]);

  useEffect(() => {
    if (!active || active.status !== 'active') return;
    if (fastElapsedMs(active, now) >= active.targetHours * 3_600_000 && announced.current !== active.id) {
      announced.current = active.id;
      show({ title: 'Fast complete 🎉', body: `You reached your ${active.targetHours}-hour fast. You can eat now.`, kind: 'fasting', href: '/fasting' });
    }
  }, [active, now, show]);

  const history = sessions.data.filter((s) => s.status === 'completed' || s.status === 'ended-early');
  const weekStart = startOfWeek();
  const weekHist = history.filter((s) => s.startedAt >= weekStart);
  const completedWeek = weekHist.filter((s) => s.status === 'completed').length;
  const hoursWeek = weekHist.reduce((s, f) => s + fastElapsedMs(f, now) / 3_600_000, 0);

  const bars = useMemo(() => {
    const days = lastDays(7);
    const map: Record<string, number> = {};
    for (const f of history) {
      const k = dayKey(f.endedAt || f.startedAt);
      map[k] = (map[k] || 0) + fastElapsedMs(f, now) / 3_600_000;
    }
    return days.map((d) => ({ label: d.label, value: round(map[d.key] || 0, 1) }));
  }, [history, now]);

  const targetHours = schedule === 'custom' ? Number(custom) : FASTING_SCHEDULES.find((s) => s.id === schedule)?.fastHours || 16;

  const start = async () => {
    if (!isFinite(targetHours) || targetHours < 1 || targetHours > 72) return toast('Choose a fasting length between 1 and 72 hours.', 'warn');
    await run(async () => {
      const label = schedule === 'custom' ? `${targetHours}h custom` : schedule;
      await actions.add('fasting', { label, targetHours, startedAt: Date.now(), pausedAt: null, pausedMs: 0, status: 'active' });
      if (notificationsSupported && (await ensureNotificationPermission())) {
        await scheduleIn(NOTIF_ID, targetHours * 3600, 'Fast complete 🎉', `You reached your ${targetHours}-hour fast. You can eat now.`);
      }
    }, { success: 'Fast started' });
  };

  const pause = () =>
    run(async () => {
      if (!active) return;
      await actions.update('fasting', active.id, { status: 'paused', pausedAt: Date.now() });
      await cancelId(NOTIF_ID);
    });

  const resume = () =>
    run(async () => {
      if (!active || !active.pausedAt) return;
      const pausedMs = (active.pausedMs || 0) + (Date.now() - active.pausedAt);
      await actions.update('fasting', active.id, { status: 'active', pausedAt: null, pausedMs });
      const remaining = active.targetHours * 3600 - (Date.now() - active.startedAt - pausedMs) / 1000;
      if (remaining > 0 && notificationsSupported && (await ensureNotificationPermission())) await scheduleIn(NOTIF_ID, remaining, 'Fast complete 🎉', `You reached your ${active.targetHours}-hour fast.`);
    });

  const end = async () => {
    if (!active) return;
    const elapsedH = fastElapsedMs(active, Date.now()) / 3_600_000;
    const reached = elapsedH >= active.targetHours;
    if (!reached && !(await confirm({ title: 'End fast early?', message: `You are at ${round(elapsedH)} of ${active.targetHours} hours. It will be saved as ended early.`, confirmText: 'End fast' }))) return;
    await run(async () => {
      await actions.update('fasting', active.id, { status: reached ? 'completed' : 'ended-early', endedAt: Date.now(), pausedAt: null });
      await cancelId(NOTIF_ID);
    }, { success: reached ? 'Fast completed — well done!' : 'Fast ended' });
  };

  const elapsedMs = active ? fastElapsedMs(active, now) : 0;
  const totalMs = (active?.targetHours || 0) * 3_600_000;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const stage = fastingStage(elapsedMs / 3_600_000);
  const sched = FASTING_SCHEDULES.find((s) => s.id === schedule);

  return (
    <Screen title="Fasting Timer" subtitle="Intermittent fasting tracker">
      <Banner text={FASTING_DISCLAIMER} tone="warn" />

      {active ? (
        <Card style={{ alignItems: 'center', padding: 24 }}>
          <Badge text={active.status === 'paused' ? 'PAUSED' : `${active.label} FAST`} tone={active.status === 'paused' ? 'warn' : 'good'} />
          <View style={{ marginVertical: 16 }}>
            <ProgressRing value={elapsedMs / totalMs} size={230} stroke={16} color={elapsedMs >= totalMs ? colors.success : colors.primary}>
              <AppText variant="label" muted>{elapsedMs >= totalMs ? 'Goal reached' : 'Remaining'}</AppText>
              <AppText variant="big">{elapsedMs >= totalMs ? fmtDuration(elapsedMs / 1000) : fmtDuration(remainingMs / 1000)}</AppText>
              <AppText variant="caption" muted>{round(elapsedMs / 3_600_000)} / {active.targetHours} h</AppText>
            </ProgressRing>
          </View>
          <AppText variant="h3">{stage.title}</AppText>
          <AppText muted center style={{ maxWidth: 420, marginTop: 4 }}>{stage.text}</AppText>
          <AppText variant="caption" muted style={{ marginTop: 8 }}>Started {fmtDateTime(active.startedAt)} · ends ≈ {fmtDateTime(active.startedAt + (active.pausedMs || 0) + totalMs)}</AppText>
          <Row style={{ marginTop: 18, flexWrap: 'wrap', justifyContent: 'center' }}>
            {active.status === 'paused' ? <Button title="Resume" icon="play" onPress={resume} loading={busy} /> : <Button title="Pause" icon="pause" variant="secondary" onPress={pause} loading={busy} />}
            <Button title={elapsedMs >= totalMs ? 'Complete fast' : 'End fast'} icon="stop" variant={elapsedMs >= totalMs ? 'primary' : 'danger'} onPress={end} loading={busy} />
          </Row>
          {!notificationsSupported ? <AppText variant="caption" muted style={{ marginTop: 10 }}>Keep this tab open — end-of-fast alerts are scheduled on the Android app.</AppText> : null}
        </Card>
      ) : (
        <Card>
          <AppText variant="h3" style={{ marginBottom: 10 }}>Choose a schedule</AppText>
          <Chips value={schedule} onChange={setSchedule} options={[...FASTING_SCHEDULES.map((s) => ({ value: s.id, label: s.label })), { value: 'custom', label: 'Custom' }]} />
          {schedule === 'custom' ? (
            <Input label="Fasting hours" value={custom} onChangeText={setCustom} keyboardType="numeric" unit="hours" placeholder="1–72" />
          ) : (
            <AppText muted style={{ marginBottom: 12 }}>{sched?.fastHours} hours fasting · {sched?.eatHours} hours eating — {sched?.blurb}</AppText>
          )}
          <Button title="Start fasting" icon="play" onPress={start} loading={busy} full />
        </Card>
      )}

      <SectionTitle title="This week" />
      <Grid cols={{ mobile: 2, tablet: 3, desktop: 3 }}>
        <StatCard icon="check-circle-outline" label="Completed fasts" value={String(completedWeek)} color={colors.success} />
        <StatCard icon="clock-outline" label="Hours fasted" value={String(round(hoursWeek))} unit="h" />
        <StatCard icon="chart-bar" label="Total sessions" value={String(history.length)} />
      </Grid>
      <Card style={{ marginTop: 12 }}>
        <AppText variant="h3" style={{ marginBottom: 8 }}>Hours fasted per day</AppText>
        <BarChart data={bars} unit="hours" />
      </Card>

      <SectionTitle title="History" />
      {history.length === 0 ? (
        <EmptyState icon="timer-sand-empty" title="No completed fasts yet" />
      ) : (
        <View style={{ gap: 8 }}>
          {history.slice(0, 30).map((f) => {
            const h = fastElapsedMs(f, now) / 3_600_000;
            return (
              <Card key={f.id} padded={false} style={{ padding: 14 }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{f.label} · {round(h)} h</AppText>
                    <AppText variant="caption" muted>{fmtDateTime(f.startedAt)} → {fmtDateTime(f.endedAt)}</AppText>
                  </View>
                  <Badge text={f.status === 'completed' ? 'COMPLETED' : 'ENDED EARLY'} tone={f.status === 'completed' ? 'good' : 'warn'} />
                </Row>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

void DAY_MS;
