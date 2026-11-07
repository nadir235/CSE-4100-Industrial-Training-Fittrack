import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { ProgressRing } from '../../../components/charts';
import { AppText, Badge, Button, Card, EmptyState, Icon, IconButton, Loading, ProgressBar, Row, Screen, SectionTitle, useBusy, useDialog } from '../../../components/ui';
import { EXERCISE_BY_ID, PROGRAMS, estimateMinutes, howToVideoUrl } from '../../../data/workouts';
import { useAuth } from '../../../lib/auth';
import { metCalories } from '../../../lib/calc';
import { useDocData, sub } from '../../../lib/db';
import { fmtDuration } from '../../../lib/format';
import { useMemberActions, useMine, useUid } from '../../../lib/member';
import { colors, levelColors } from '../../../lib/theme';
import type { CustomWorkout, WeightEntry } from '../../../lib/types';

type Item = { title: string; level: string; met: number; description?: string; list: { id: string; sets: number; reps: number; rest: number }[] };

export default function WorkoutDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const uid = useUid();
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { confirm, toast } = useDialog();
  const { run } = useBusy();

  const isCustom = !!id && id.startsWith('custom-');
  const custom = useDocData<CustomWorkout>(isCustom ? `${sub(uid, 'customWorkouts')}/${id.slice(7)}` : null);
  const weights = useMine<WeightEntry>('weights', { order: ['at', 'desc'], limit: 1 });
  const kg = weights.data[0]?.kg || profile?.weightKg || 70;
  const favs = profile?.favoriteExercises || [];

  const item: Item | null = useMemo(() => {
    if (isCustom) {
      const c = custom.data;
      if (!c) return null;
      return { title: c.name, level: c.level, met: c.level === 'advanced' ? 6.5 : c.level === 'intermediate' ? 5 : 3.8, list: c.exercises.map((e) => ({ id: e.exerciseId, sets: e.sets, reps: e.reps, rest: e.restSec })) };
    }
    const p = PROGRAMS.find((x) => x.id === id);
    return p ? { title: p.name, level: p.level, met: p.met, description: p.description, list: p.exercises.map((e) => ({ id: e.id, sets: e.sets, reps: e.reps, rest: e.rest })) } : null;
  }, [id, isCustom, custom.data]);

  const [mode, setMode] = useState<'overview' | 'session' | 'done'>('overview');
  const [open, setOpen] = useState<string | null>(null);
  const [exIdx, setExIdx] = useState(0);
  const [setNum, setSetNum] = useState(1);
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const [workEnd, setWorkEnd] = useState<number | null>(null);
  const [restEnd, setRestEnd] = useState(0);
  const [startedAt, setStartedAt] = useState(0);
  const [setsDone, setSetsDone] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<{ min: number; kcal: number } | null>(null);
  const finishing = useRef(false);

  useEffect(() => {
    if (mode !== 'session') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    activateKeepAwakeAsync('workout').catch(() => {});
    return () => {
      clearInterval(t);
      deactivateKeepAwake('workout').catch(() => {});
    };
  }, [mode]);

  const buzz = () => {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const finish = useCallback(
    async (partial: boolean) => {
      if (!item || finishing.current) return;
      finishing.current = true;
      const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60000));
      const kcal = Math.round(metCalories(item.met, kg, minutes));
      try {
        await actions.add('workoutLogs', {
          title: item.title + (partial ? ' (partial)' : ''),
          level: item.level,
          durationMin: minutes,
          calories: kcal,
          exerciseCount: partial ? Math.min(exIdx + 1, item.list.length) : item.list.length,
          at: Date.now(),
        });
        setResult({ min: minutes, kcal });
        setMode('done');
        buzz();
      } catch (e: any) {
        toast(e?.message || 'Could not save workout', 'bad');
      } finally {
        finishing.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item, startedAt, kg, exIdx],
  );

  const cur = item?.list[exIdx];
  const curEx = cur ? EXERCISE_BY_ID[cur.id] : undefined;

  const completeSet = useCallback(() => {
    if (!item || !cur) return;
    setSetsDone((n) => n + 1);
    setWorkEnd(null);
    const lastSet = setNum >= cur.sets;
    const lastEx = exIdx >= item.list.length - 1;
    if (lastSet && lastEx) {
      finish(false);
      return;
    }
    if (cur.rest > 0) {
      setPhase('rest');
      setRestEnd(Date.now() + cur.rest * 1000);
    } else advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, cur, setNum, exIdx, finish]);

  const advance = () => {
    if (!item || !cur) return;
    if (setNum < cur.sets) setSetNum(setNum + 1);
    else {
      setExIdx(exIdx + 1);
      setSetNum(1);
    }
    setPhase('work');
    setWorkEnd(null);
  };

  // rest finished
  useEffect(() => {
    if (mode === 'session' && phase === 'rest' && now >= restEnd) {
      buzz();
      advance();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, mode, restEnd]);

  // timed exercise finished
  useEffect(() => {
    if (mode === 'session' && phase === 'work' && workEnd && now >= workEnd) completeSet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, phase, mode, workEnd]);

  const start = () => {
    finishing.current = false;
    setExIdx(0);
    setSetNum(1);
    setPhase('work');
    setWorkEnd(null);
    setSetsDone(0);
    setStartedAt(Date.now());
    setNow(Date.now());
    setMode('session');
  };

  const endEarly = async () => {
    if (setsDone === 0) {
      setMode('overview');
      return;
    }
    if (await confirm({ title: 'End workout?', message: 'Your progress so far will be saved to your history.', confirmText: 'End & save' })) finish(true);
  };

  const toggleFav = (exId: string) => {
    const next = favs.includes(exId) ? favs.filter((f) => f !== exId) : [...favs, exId];
    run(() => actions.updateProfile({ favoriteExercises: next }));
  };

  if (isCustom && custom.loading) return <Screen title="Workout" back><Loading /></Screen>;
  if (!item)
    return (
      <Screen title="Workout" back="/workouts">
        <EmptyState icon="alert-circle-outline" title="Workout not found" action={<Button title="Back to workouts" onPress={() => router.replace('/workouts')} />} />
      </Screen>
    );

  const mins = estimateMinutes(item.list);

  // ---------------------------------------------------------- done
  if (mode === 'done' && result)
    return (
      <Screen title="Workout complete 🎉">
        <Card style={{ alignItems: 'center', padding: 32 }}>
          <Icon name="trophy" size={56} color={colors.warning} />
          <AppText variant="h1" style={{ marginTop: 12 }}>{item.title}</AppText>
          <Row gap={32} style={{ marginTop: 20 }}>
            <View style={{ alignItems: 'center' }}><AppText variant="h1">{result.min}</AppText><AppText muted variant="caption">minutes</AppText></View>
            <View style={{ alignItems: 'center' }}><AppText variant="h1">{result.kcal}</AppText><AppText muted variant="caption">kcal (estimate)</AppText></View>
          </Row>
          <Row style={{ marginTop: 24, flexWrap: 'wrap' }}>
            <Button title="View history" variant="secondary" onPress={() => router.replace('/workouts')} />
            <Button title="Done" onPress={() => router.replace('/home')} />
          </Row>
        </Card>
      </Screen>
    );

  // ---------------------------------------------------------- session
  if (mode === 'session' && cur && curEx) {
    const elapsed = (now - startedAt) / 1000;
    const timed = curEx.unit === 'sec';
    const restLeft = Math.max(0, Math.ceil((restEnd - now) / 1000));
    const workLeft = workEnd ? Math.max(0, Math.ceil((workEnd - now) / 1000)) : cur.reps;
    const totalSets = item.list.reduce((s, e) => s + e.sets, 0);
    const nextEx = phase === 'rest' ? (setNum < cur.sets ? curEx : EXERCISE_BY_ID[item.list[exIdx + 1]?.id]) : undefined;
    return (
      <Screen title={item.title} subtitle={`Elapsed ${fmtDuration(elapsed)} · Exercise ${exIdx + 1} of ${item.list.length}`} right={<Button title="End" size="sm" variant="ghost" onPress={endEarly} />}>
        <ProgressBar value={setsDone / totalSets} />
        {phase === 'rest' ? (
          <Card style={{ alignItems: 'center', padding: 28, marginTop: 16 }}>
            <AppText variant="label" color={colors.info}>Rest</AppText>
            <ProgressRing value={restLeft / Math.max(1, cur.rest)} size={190} stroke={14} color={colors.info}>
              <AppText variant="big">{restLeft}</AppText>
              <AppText muted variant="caption">seconds</AppText>
            </ProgressRing>
            <AppText muted style={{ marginTop: 16 }}>Up next: <AppText style={{ fontWeight: '700' }}>{nextEx?.name || 'Finish'}</AppText></AppText>
            <Row style={{ marginTop: 16 }}>
              <Button title="+15 s" variant="secondary" size="sm" onPress={() => setRestEnd((r) => r + 15000)} />
              <Button title="Skip rest" onPress={() => { setRestEnd(0); }} />
            </Row>
          </Card>
        ) : (
          <Card style={{ alignItems: 'center', padding: 28, marginTop: 16 }}>
            <Icon name={curEx.icon} size={46} color={colors.primary} />
            <AppText variant="h1" center style={{ marginTop: 8 }}>{curEx.name}</AppText>
            <AppText muted>{curEx.muscle}</AppText>
            <Badge text={`SET ${setNum} OF ${cur.sets}`} tone="info" />
            <View style={{ marginVertical: 20, alignItems: 'center' }}>
              {timed ? (
                <ProgressRing value={workEnd ? workLeft / cur.reps : 1} size={170} stroke={13}>
                  <AppText variant="big">{workLeft}</AppText>
                  <AppText muted variant="caption">seconds</AppText>
                </ProgressRing>
              ) : (
                <>
                  <AppText variant="big">{cur.reps}</AppText>
                  <AppText muted>reps</AppText>
                </>
              )}
            </View>
            <AppText center muted style={{ maxWidth: 520 }}>{curEx.description}</AppText>
            <AppText center variant="caption" color={colors.warning} style={{ marginTop: 8, maxWidth: 520 }}>Tip: {curEx.tips}</AppText>
            <Row style={{ marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              {timed && !workEnd ? <Button title="Start timer" icon="play" onPress={() => setWorkEnd(Date.now() + cur.reps * 1000)} /> : null}
              {timed && workEnd ? <Button title="Finish early" variant="secondary" onPress={completeSet} /> : null}
              {!timed ? <Button title="Set done" icon="check" onPress={completeSet} /> : null}
            </Row>
          </Card>
        )}
      </Screen>
    );
  }

  // ---------------------------------------------------------- overview
  return (
    <Screen title={item.title} subtitle={item.description} back="/workouts">
      <Row style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Badge text={item.level.toUpperCase()} color={levelColors[item.level]} />
        <Badge text={`~${mins} MIN`} tone="neutral" />
        <Badge text={`~${Math.round(metCalories(item.met, kg, mins))} KCAL`} tone="neutral" />
        <Badge text={`${item.list.length} EXERCISES`} tone="neutral" />
      </Row>
      <Button title="Start workout" icon="play" full onPress={start} />
      <SectionTitle title="Exercises" />
      <View style={{ gap: 10 }}>
        {item.list.map((e, i) => {
          const ex = EXERCISE_BY_ID[e.id];
          if (!ex) return null;
          const expanded = open === `${i}`;
          return (
            <Card key={i} padded={false}>
              <Pressable onPress={() => setOpen(expanded ? null : `${i}`)} style={{ padding: 14 }}>
                <Row gap={12}>
                  <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={ex.icon} size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{ex.name}</AppText>
                    <AppText variant="caption" muted>
                      {e.sets} sets × {e.reps}{ex.unit === 'sec' ? ' sec' : ' reps'} · rest {e.rest}s · {ex.muscle}
                    </AppText>
                  </View>
                  <IconButton icon={favs.includes(ex.id) ? 'star' : 'star-outline'} color={favs.includes(ex.id) ? colors.warning : colors.textMuted} onPress={() => toggleFav(ex.id)} label="Toggle favorite" />
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.textDim} />
                </Row>
              </Pressable>
              {expanded ? (
                <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                  <AppText>{ex.description}</AppText>
                  <AppText variant="caption" color={colors.warning} style={{ marginTop: 6 }}>Tip: {ex.tips}</AppText>
                  <AppText variant="caption" muted style={{ marginTop: 6 }}>Equipment: {ex.equipment}</AppText>
                  <Pressable onPress={() => Linking.openURL(howToVideoUrl(ex.name)).catch(() => toast('Could not open link', 'bad'))} style={{ marginTop: 10 }}>
                    <AppText color={colors.primary} style={{ fontWeight: '700' }}>Watch demonstration video ↗</AppText>
                  </Pressable>
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>
      <AppText variant="caption" muted style={{ marginTop: 16 }}>
        Calorie figures are estimates based on exercise intensity and your weight. Stop if you feel pain, dizziness or chest discomfort, and check with a doctor before starting a new program.
      </AppText>
    </Screen>
  );
}
