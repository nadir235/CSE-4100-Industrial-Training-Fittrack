import React, { useMemo, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { BarChart } from '../../../components/charts';
import { AppText, Badge, Button, Card, Chips, EmptyState, Grid, Icon, IconButton, Row, Screen, SectionTitle, useBusy, useDialog } from '../../../components/ui';
import { EXERCISES, EXERCISE_BY_ID, LEVELS, PROGRAMS, estimateMinutes, howToVideoUrl } from '../../../data/workouts';
import { useAuth } from '../../../lib/auth';
import { metCalories } from '../../../lib/calc';
import { fmtDateTime } from '../../../lib/format';
import { useMemberActions, useMine } from '../../../lib/member';
import { sumByWeek } from '../../../lib/stats';
import { colors, levelColors } from '../../../lib/theme';
import type { CustomWorkout, FitnessLevel, WeightEntry, WorkoutLog } from '../../../lib/types';

type Tab = 'programs' | 'mine' | 'favorites' | 'history';

export default function Workouts() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { confirm, toast } = useDialog();
  const { run } = useBusy();
  const [tab, setTab] = useState<Tab>('programs');
  const [level, setLevel] = useState<FitnessLevel>(profile?.fitnessLevel || 'beginner');

  const customs = useMine<CustomWorkout>('customWorkouts', { order: ['createdAt', 'desc'] });
  const logs = useMine<WorkoutLog>('workoutLogs', { order: ['at', 'desc'], limit: 200 });
  const weights = useMine<WeightEntry>('weights', { order: ['at', 'desc'], limit: 1 });
  const kg = weights.data[0]?.kg || profile?.weightKg || 70;
  const favs = profile?.favoriteExercises || [];
  const programs = useMemo(() => PROGRAMS.filter((p) => p.level === level), [level]);
  const weekly = useMemo(() => sumByWeek(logs.data, 8, () => 1), [logs.data]);

  const toggleFav = (id: string) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id];
    run(() => actions.updateProfile({ favoriteExercises: next }));
  };

  const saveLevel = () => run(() => actions.updateProfile({ fitnessLevel: level }), { success: `Your fitness level is now ${level}` });

  return (
    <Screen title="Workouts" subtitle="Pick a program or build your own routine">
      <Chips
        value={tab}
        onChange={setTab}
        options={[
          { value: 'programs', label: 'Programs' },
          { value: 'mine', label: `My routines (${customs.data.length})` },
          { value: 'favorites', label: `Favorites (${favs.length})` },
          { value: 'history', label: 'History' },
        ]}
      />

      {tab === 'programs' ? (
        <>
          <Chips value={level} onChange={setLevel} options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
          <Row style={{ marginBottom: 12, flexWrap: 'wrap' }}>
            <AppText muted style={{ flex: 1, minWidth: 200 }}>
              {LEVELS.find((l) => l.id === level)?.blurb}
            </AppText>
            {profile?.fitnessLevel !== level ? <Button title="Set as my level" size="sm" variant="secondary" onPress={saveLevel} /> : <Badge text="YOUR LEVEL" tone="good" />}
          </Row>
          <Grid>
            {programs.map((p) => {
              const mins = estimateMinutes(p.exercises.map((e) => ({ id: e.id, sets: e.sets, reps: e.reps, rest: e.rest })));
              return (
                <Card key={p.id} onPress={() => router.navigate({ pathname: '/workouts/[id]', params: { id: p.id } } as any)} accent={levelColors[p.level]}>
                  <Badge text={p.focus.toUpperCase()} color={levelColors[p.level]} />
                  <AppText variant="h3" style={{ marginTop: 8 }}>
                    {p.name}
                  </AppText>
                  <AppText variant="caption" muted style={{ marginTop: 4, minHeight: 34 }}>
                    {p.description}
                  </AppText>
                  <Row gap={14} style={{ marginTop: 10 }}>
                    <Row gap={4}><Icon name="clock-outline" size={15} color={colors.textMuted} /><AppText variant="caption" muted>{mins} min</AppText></Row>
                    <Row gap={4}><Icon name="format-list-numbered" size={15} color={colors.textMuted} /><AppText variant="caption" muted>{p.exercises.length} exercises</AppText></Row>
                    <Row gap={4}><Icon name="fire" size={15} color={colors.textMuted} /><AppText variant="caption" muted>~{Math.round(metCalories(p.met, kg, mins))} kcal</AppText></Row>
                  </Row>
                </Card>
              );
            })}
          </Grid>
        </>
      ) : null}

      {tab === 'mine' ? (
        <>
          <Button title="Create routine" icon="plus" onPress={() => router.navigate('/workouts/builder')} style={{ alignSelf: 'flex-start', marginBottom: 12 }} />
          {customs.data.length === 0 ? (
            <EmptyState icon="clipboard-text-outline" title="No custom routines yet" text="Build your own workout from the exercise library and set your own sets, reps and rest." />
          ) : (
            <Grid>
              {customs.data.map((c) => {
                const mins = estimateMinutes(c.exercises.map((e) => ({ id: e.exerciseId, sets: e.sets, reps: e.reps, rest: e.restSec })));
                return (
                  <Card key={c.id}>
                    <Badge text={c.level.toUpperCase()} color={levelColors[c.level]} />
                    <AppText variant="h3" style={{ marginTop: 8 }}>
                      {c.name}
                    </AppText>
                    <AppText variant="caption" muted>
                      {c.exercises.length} exercises · ~{mins} min{c.days?.length ? ` · ${c.days.join(', ')}` : ''}
                    </AppText>
                    <Row style={{ marginTop: 12, flexWrap: 'wrap' }} gap={8}>
                      <Button title="Start" size="sm" icon="play" onPress={() => router.navigate({ pathname: '/workouts/[id]', params: { id: `custom-${c.id}` } } as any)} />
                      <Button title="Edit" size="sm" variant="secondary" onPress={() => router.navigate({ pathname: '/workouts/builder', params: { edit: c.id } } as any)} />
                      <Button
                        title="Delete"
                        size="sm"
                        variant="ghost"
                        onPress={async () => {
                          if (await confirm({ title: 'Delete routine?', message: `"${c.name}" will be removed permanently.`, confirmText: 'Delete', destructive: true })) {
                            await run(() => actions.del('customWorkouts', c.id), { success: 'Routine deleted' });
                          }
                        }}
                      />
                    </Row>
                  </Card>
                );
              })}
            </Grid>
          )}
        </>
      ) : null}

      {tab === 'favorites' ? (
        favs.length === 0 ? (
          <EmptyState icon="star-outline" title="No favorite exercises" text="Tap the star on any exercise inside a workout to save it here." action={<Button title="Browse the library" size="sm" onPress={() => setTab('programs')} />} />
        ) : (
          <Grid>
            {favs.map((id) => EXERCISE_BY_ID[id]).filter(Boolean).map((ex) => (
              <Card key={ex.id}>
                <Row>
                  <Icon name={ex.icon} size={26} color={colors.primary} />
                  <AppText variant="h3" style={{ flex: 1 }}>{ex.name}</AppText>
                  <IconButton icon="star" color={colors.warning} onPress={() => toggleFav(ex.id)} label="Remove favorite" />
                </Row>
                <AppText variant="caption" muted>{ex.muscle} · {ex.equipment}</AppText>
                <AppText style={{ marginTop: 8 }}>{ex.description}</AppText>
                <Pressable onPress={() => Linking.openURL(howToVideoUrl(ex.name)).catch(() => toast('Could not open link', 'bad'))} style={{ marginTop: 8 }}>
                  <AppText color={colors.primary} style={{ fontWeight: '700' }}>Watch demonstration ↗</AppText>
                </Pressable>
              </Card>
            ))}
          </Grid>
        )
      ) : null}

      {tab === 'history' ? (
        <>
          <Card style={{ marginBottom: 12 }}>
            <AppText variant="h3" style={{ marginBottom: 8 }}>Workouts per week</AppText>
            <BarChart data={weekly} format={(v) => String(Math.round(v))} />
          </Card>
          {logs.data.length === 0 ? (
            <EmptyState icon="history" title="No workouts yet" text="Complete a workout and it will show up here." />
          ) : (
            <View style={{ gap: 8 }}>
              {logs.data.slice(0, 50).map((l) => (
                <Card key={l.id} padded={false} style={{ padding: 14 }}>
                  <Row>
                    <Icon name="check-circle" color={colors.success} />
                    <View style={{ flex: 1 }}>
                      <AppText variant="h3">{l.title}</AppText>
                      <AppText variant="caption" muted>{fmtDateTime(l.at)} · {l.durationMin} min · {Math.round(l.calories)} kcal · {l.exerciseCount} exercises</AppText>
                    </View>
                    <Badge text={String(l.level).toUpperCase()} color={levelColors[l.level] || colors.textMuted} />
                  </Row>
                </Card>
              ))}
            </View>
          )}
        </>
      ) : null}

      <SectionTitle title="Exercise library" />
      <AppText muted variant="caption">
        {EXERCISES.length} exercises are available when building your own routine.
      </AppText>
    </Screen>
  );
}
