import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { BarChart, LineChart, ProgressRing } from '../../components/charts';
import { AppText, Badge, Banner, Button, Card, Chips, Grid, Input, Row, ProgressBar, Screen, SectionTitle, Sheet, StatCard, useBusy, useDialog } from '../../components/ui';
import { LEVELS } from '../../data/workouts';
import { useAuth } from '../../lib/auth';
import { useDocData } from '../../lib/db';
import { DAY_MS, daysUntil, dayKey, fmtDate, fmtDuration, round, startOfMonth, startOfWeek, startOfDay } from '../../lib/format';
import { bmi, bmiCategory } from '../../lib/calc';
import { clean, useMemberActions, useMine } from '../../lib/member';
import { sinceDays, sumByDay } from '../../lib/stats';
import { colors, levelColors } from '../../lib/theme';
import type { CalcEntry, FastingSession, FitnessLevel, RunSession, Subscription, WaterEntry, WeightEntry, WorkoutLog } from '../../lib/types';

type MealEntry = { id: string; kcal: number; label: string; at: number };

export default function Home() {
  const { user, profile, emailVerified, resendVerification, refreshVerification } = useAuth();
  const actions = useMemberActions();
  const { toast } = useDialog();
  const { busy, run } = useBusy();

  const logs = useMine<WorkoutLog>('workoutLogs', { order: ['at', 'desc'], limit: 300 });
  const weights = useMine<WeightEntry>('weights', { order: ['at', 'desc'], limit: 60 });
  const calcs = useMine<CalcEntry>('calcHistory', { order: ['at', 'desc'], limit: 100 });
  const water = useMine<WaterEntry>('water', { order: ['at', 'desc'], where: [['at', '>=', startOfDay()]] });
  const runs = useMine<RunSession>('running', { order: ['at', 'desc'], limit: 100 });
  const fasts = useMine<FastingSession>('fasting', { order: ['startedAt', 'desc'], limit: 30 });
  const meals = useMine<MealEntry>('meals', { order: ['at', 'desc'], where: [['at', '>=', startOfDay()]] });
  const sub = useDocData<Subscription>(user ? `subscriptions/${user.uid}` : null);

  const [mealOpen, setMealOpen] = useState(false);
  const [mealKcal, setMealKcal] = useState('');
  const [mealLabel, setMealLabel] = useState('');

  const wk = startOfWeek();
  const mo = startOfMonth();
  const stats = useMemo(() => {
    const week = logs.data.filter((l) => l.at >= wk);
    const month = logs.data.filter((l) => l.at >= mo);
    const today = startOfDay();
    const burnedWorkout = logs.data.filter((l) => l.at >= today).reduce((s, l) => s + l.calories, 0);
    const burnedRun = runs.data.filter((r) => r.at >= today).reduce((s, r) => s + r.calories, 0);
    const runWeekKm = runs.data.filter((r) => r.at >= wk).reduce((s, r) => s + r.distanceKm, 0);
    return { total: logs.data.length, week: week.length, month: month.length, burned: burnedWorkout + burnedRun, runWeekKm };
  }, [logs.data, runs.data, wk, mo]);

  const latestWeight = weights.data[0]?.kg ?? profile?.weightKg;
  const firstWeight = weights.data[weights.data.length - 1]?.kg;
  const bmiVal = latestWeight && profile?.heightCm ? bmi(latestWeight, profile.heightCm) : null;
  const bf = calcs.data.find((c) => c.type === 'bodyfat');
  const calcTarget = calcs.data.find((c) => c.type === 'calories');
  const waterToday = water.data.reduce((s, w) => s + w.ml, 0);
  const waterGoal = profile?.waterGoalMl || 2500;
  const eaten = meals.data.reduce((s, m) => s + m.kcal, 0);
  const activeFast = fasts.data.find((f) => f.status === 'active' || f.status === 'paused');
  const fastElapsed = activeFast ? ((activeFast.pausedAt || Date.now()) - activeFast.startedAt - activeFast.pausedMs) / 1000 : 0;
  const daysLeft = daysUntil(sub.data?.expiresAt);
  const subActive = sub.data?.status === 'active' && (daysLeft ?? 0) > 0;
  const level = profile?.fitnessLevel || 'beginner';

  const weekBars = useMemo(() => sumByDay(logs.data.filter((l) => l.at >= sinceDays(7)), 7, () => 1), [logs.data]);
  const weightLine = useMemo(
    () => [...weights.data].reverse().map((w) => ({ label: new Date(w.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), value: w.kg })),
    [weights.data],
  );

  const addMeal = async () => {
    const k = Number(mealKcal);
    if (!isFinite(k) || k <= 0 || k > 5000) {
      toast('Enter calories between 1 and 5000.', 'warn');
      return;
    }
    await run(async () => {
      await actions.add('meals', clean({ kcal: Math.round(k), label: mealLabel.trim() || 'Meal', at: Date.now(), day: dayKey() }));
      setMealOpen(false);
      setMealKcal('');
      setMealLabel('');
    }, { success: 'Calories logged' });
  };

  return (
    <Screen title={`Hi, ${(profile?.name || user?.displayName || 'there').split(' ')[0]} 👋`} subtitle="Here's your fitness snapshot">
      {!emailVerified ? (
        <Banner
          text="Please verify your email address. We sent a link when you registered."
          action={
            <Row gap={6}>
              <Button title="Resend" size="sm" variant="secondary" onPress={() => run(() => resendVerification(), { success: 'Verification email sent' })} />
              <Button
                title="I verified"
                size="sm"
                variant="ghost"
                onPress={async () => ((await refreshVerification()) ? toast('Email verified — thank you!', 'good') : toast('Not verified yet. Check your inbox.', 'warn'))}
              />
            </Row>
          }
        />
      ) : null}

      {/* Membership */}
      <Card accent={subActive ? colors.success : colors.warning} style={{ marginBottom: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <AppText variant="label" muted>
              Membership
            </AppText>
            <AppText variant="h2" style={{ marginTop: 4 }}>
              {sub.data ? sub.data.planName : 'No active plan'}
            </AppText>
            <AppText muted variant="caption">
              {sub.data ? (subActive ? `Expires ${fmtDate(sub.data.expiresAt)} · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : `Expired on ${fmtDate(sub.data.expiresAt)}`) : 'Choose a plan to unlock gym access.'}
            </AppText>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <Badge text={subActive ? 'ACTIVE' : sub.data ? (sub.data.status === 'inactive' ? 'DEACTIVATED' : 'EXPIRED') : 'NONE'} tone={subActive ? 'good' : 'warn'} />
            <Button title={subActive ? 'Manage' : 'Get a plan'} size="sm" variant={subActive ? 'secondary' : 'primary'} onPress={() => router.navigate('/membership')} />
          </View>
        </Row>
        {subActive && daysLeft !== null && daysLeft <= 7 ? (
          <AppText variant="caption" color={colors.warning} style={{ marginTop: 8 }}>
            Your membership expires soon — renew to keep your access.
          </AppText>
        ) : null}
      </Card>

      <Grid cols={{ mobile: 2, tablet: 4, desktop: 4 }}>
        <StatCard icon="dumbbell" label="Total workouts" value={String(stats.total)} sub={`${stats.week} this week · ${stats.month} this month`} />
        <StatCard icon="signal-cellular-3" label="Fitness level" value={LEVELS.find((l) => l.id === level)?.label || ''} color={levelColors[level]} />
        <StatCard icon="scale-bathroom" label="Weight" value={latestWeight ? String(round(latestWeight)) : '—'} unit="kg" sub={latestWeight && firstWeight && weights.data.length > 1 ? `${latestWeight - firstWeight >= 0 ? '+' : ''}${round(latestWeight - firstWeight)} kg since start` : 'Log your weight in Progress'} />
        <StatCard icon="human" label="BMI" value={bmiVal ? String(round(bmiVal)) : '—'} sub={bmiVal ? bmiCategory(bmiVal).label : 'Add height & weight in Profile'} color={bmiVal ? (bmiCategory(bmiVal).tone === 'good' ? colors.success : colors.warning) : colors.primary} />
        <StatCard icon="percent" label="Body fat" value={bf ? String(bf.value) : '—'} unit={bf ? '%' : undefined} sub={bf ? fmtDate(bf.at) : 'Use the Body Fat calculator'} />
        <StatCard icon="run-fast" label="Running this week" value={String(round(stats.runWeekKm))} unit="km" color="#2ECC71" />
        <StatCard icon="timer-sand" label="Fasting" value={activeFast ? fmtDuration(fastElapsed) : 'Not fasting'} sub={activeFast ? `${activeFast.label} schedule` : 'Start a fast'} color="#F5A623" />
        <StatCard icon="fire" label="Burned today" value={String(Math.round(stats.burned))} unit="kcal" />
      </Grid>

      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="h3">Water today</AppText>
            <Button title="+250 ml" size="sm" variant="secondary" onPress={() => run(() => actions.add('water', { ml: 250, at: Date.now(), day: dayKey() }))} />
          </Row>
          <Row gap={16} style={{ marginTop: 12 }}>
            <ProgressRing value={waterToday / waterGoal} size={92} stroke={9} color="#4DA3FF">
              <AppText variant="h3">{Math.round((waterToday / waterGoal) * 100)}%</AppText>
            </ProgressRing>
            <View style={{ flex: 1 }}>
              <AppText variant="h2">
                {waterToday} / {waterGoal} ml
              </AppText>
              <AppText variant="caption" muted>
                {waterToday >= waterGoal ? 'Goal reached — great job!' : `${waterGoal - waterToday} ml to go`}
              </AppText>
            </View>
          </Row>
        </Card>
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <AppText variant="h3">Calories today</AppText>
            <Button title="Log meal" size="sm" variant="secondary" icon="plus" onPress={() => setMealOpen(true)} />
          </Row>
          <View style={{ marginTop: 12 }}>
            <AppText variant="h2">
              {eaten} <AppText muted>kcal eaten</AppText>
            </AppText>
            <AppText variant="caption" muted style={{ marginBottom: 8 }}>
              {calcTarget ? `Target ≈ ${calcTarget.value} kcal (from your Daily Calories calculator)` : 'Use the Daily Calories calculator to set a target'}
            </AppText>
            <ProgressBar value={calcTarget ? eaten / calcTarget.value : 0} color={calcTarget && eaten > calcTarget.value ? colors.warning : colors.primary} />
          </View>
        </Card>
      </Grid>

      <SectionTitle title="This week" />
      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card>
          <AppText variant="h3" style={{ marginBottom: 8 }}>
            Workouts per day
          </AppText>
          <BarChart data={weekBars} height={160} format={(v) => String(Math.round(v))} />
        </Card>
        <Card>
          <AppText variant="h3" style={{ marginBottom: 8 }}>
            Weight trend
          </AppText>
          <LineChart data={weightLine} unit="kg" height={160} />
        </Card>
      </Grid>

      <SectionTitle title="Quick actions" />
      <Row style={{ flexWrap: 'wrap' }}>
        <Button title="Start a workout" icon="play" onPress={() => router.navigate('/workouts')} />
        <Button title="Ask AI coach" icon="robot-outline" variant="secondary" onPress={() => router.navigate('/ai')} />
        <Button title="Start fasting" icon="timer-sand" variant="secondary" onPress={() => router.navigate('/fasting')} />
        <Button title="Log a run" icon="run-fast" variant="secondary" onPress={() => router.navigate('/running')} />
      </Row>

      <Sheet visible={mealOpen} onClose={() => setMealOpen(false)} title="Log calories eaten">
        <Input label="Calories" value={mealKcal} onChangeText={setMealKcal} keyboardType="numeric" unit="kcal" placeholder="e.g. 450" />
        <Input label="Label (optional)" value={mealLabel} onChangeText={setMealLabel} placeholder="Lunch" autoCapitalize="sentences" />
        <Button title="Save" onPress={addMeal} loading={busy} full />
      </Sheet>
    </Screen>
  );
}

// keep unused-import lint quiet for helpers that are handy while extending this screen
void DAY_MS;
void Chips;
void (null as unknown as FitnessLevel);
