import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Stepper } from '../../../components/Stepper';
import { AppText, Button, Card, Chips, EmptyState, Icon, IconButton, Input, Row, Screen, SectionTitle, Sheet, useBusy, useDialog } from '../../../components/ui';
import { EXERCISES, EXERCISE_BY_ID, LEVELS, estimateMinutes } from '../../../data/workouts';
import { useDocData, sub } from '../../../lib/db';
import { useMemberActions, useUid } from '../../../lib/member';
import { colors } from '../../../lib/theme';
import type { CustomExercise, CustomWorkout, FitnessLevel } from '../../../lib/types';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function Builder() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const uid = useUid();
  const actions = useMemberActions();
  const { toast } = useDialog();
  const { busy, run } = useBusy();
  const existing = useDocData<CustomWorkout>(edit ? `${sub(uid, 'customWorkouts')}/${edit}` : null);

  const [name, setName] = useState('');
  const [level, setLevel] = useState<FitnessLevel>('beginner');
  const [items, setItems] = useState<CustomExercise[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (edit && existing.data && !loaded) {
      setName(existing.data.name);
      setLevel(existing.data.level);
      setItems(existing.data.exercises);
      setDays(existing.data.days || []);
      setLoaded(true);
    }
  }, [edit, existing.data, loaded]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return EXERCISES.filter((e) => !s || e.name.toLowerCase().includes(s) || e.muscle.toLowerCase().includes(s));
  }, [q]);

  const minutes = estimateMinutes(items.map((i) => ({ id: i.exerciseId, sets: i.sets, reps: i.reps, rest: i.restSec })));

  const addExercise = (id: string) => {
    const ex = EXERCISE_BY_ID[id];
    setItems((arr) => [...arr, { exerciseId: id, sets: 3, reps: ex.unit === 'sec' ? 30 : 10, restSec: 45 }]);
    toast(`${ex.name} added`, 'good');
  };
  const update = (i: number, patch: Partial<CustomExercise>) => setItems((arr) => arr.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const move = (i: number, dir: -1 | 1) =>
    setItems((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const c = [...arr];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });

  const save = async () => {
    if (name.trim().length < 2) return toast('Give your routine a name.', 'warn');
    if (items.length === 0) return toast('Add at least one exercise.', 'warn');
    await run(async () => {
      const data = { name: name.trim(), level, exercises: items, days, createdAt: existing.data?.createdAt || Date.now() };
      if (edit) await actions.set('customWorkouts', edit, data);
      else await actions.add('customWorkouts', data);
      router.replace('/workouts');
    }, { success: 'Routine saved' });
  };

  return (
    <Screen title={edit ? 'Edit routine' : 'Create routine'} subtitle={items.length ? `${items.length} exercises · ~${minutes} min` : 'Choose exercises, sets and reps'} back="/workouts">
      <Input label="Routine name" value={name} onChangeText={setName} placeholder="e.g. Monday Push Day" autoCapitalize="sentences" />
      <Chips value={level} onChange={setLevel} label="Difficulty" options={LEVELS.map((l) => ({ value: l.id, label: l.label }))} />
      <AppText variant="caption" muted style={{ marginBottom: 6, fontWeight: '600' }}>Schedule (optional)</AppText>
      <Row style={{ flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {DAYS.map((d) => {
          const on = days.includes(d);
          return <Button key={d} title={d} size="sm" variant={on ? 'primary' : 'secondary'} onPress={() => setDays((a) => (on ? a.filter((x) => x !== d) : [...a, d]))} />;
        })}
      </Row>

      <SectionTitle title="Exercises" right={<Button title="Add" icon="plus" size="sm" onPress={() => setPicker(true)} />} />
      {items.length === 0 ? (
        <EmptyState icon="dumbbell" title="No exercises yet" text="Tap Add to pick from the library." />
      ) : (
        <View style={{ gap: 10 }}>
          {items.map((it, i) => {
            const ex = EXERCISE_BY_ID[it.exerciseId];
            return (
              <Card key={i}>
                <Row>
                  <Icon name={ex.icon} color={colors.primary} />
                  <AppText variant="h3" style={{ flex: 1 }}>{ex.name}</AppText>
                  <IconButton icon="arrow-up" size={18} onPress={() => move(i, -1)} label="Move up" />
                  <IconButton icon="arrow-down" size={18} onPress={() => move(i, 1)} label="Move down" />
                  <IconButton icon="trash-can-outline" size={20} color={colors.danger} onPress={() => setItems((a) => a.filter((_, idx) => idx !== i))} label="Remove" />
                </Row>
                <Row style={{ flexWrap: 'wrap', justifyContent: 'space-around', marginTop: 12, gap: 12 }}>
                  <Stepper label="Sets" value={it.sets} min={1} max={10} onChange={(v) => update(i, { sets: v })} />
                  <Stepper label={ex.unit === 'sec' ? 'Seconds' : 'Reps'} value={it.reps} min={1} max={ex.unit === 'sec' ? 600 : 100} step={ex.unit === 'sec' ? 5 : 1} onChange={(v) => update(i, { reps: v })} />
                  <Stepper label="Rest (s)" value={it.restSec} min={0} max={300} step={5} onChange={(v) => update(i, { restSec: v })} />
                </Row>
              </Card>
            );
          })}
        </View>
      )}

      <Button title="Save routine" icon="content-save" full onPress={save} loading={busy} style={{ marginTop: 20 }} />

      <Sheet visible={picker} onClose={() => setPicker(false)} title="Exercise library">
        <Input value={q} onChangeText={setQ} placeholder="Search by name or muscle" />
        {filtered.map((e) => (
          <Row key={e.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Icon name={e.icon} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <AppText>{e.name}</AppText>
              <AppText variant="caption" muted>{e.muscle}</AppText>
            </View>
            <Button title="Add" size="sm" variant="secondary" onPress={() => addExercise(e.id)} />
          </Row>
        ))}
        {filtered.length === 0 ? <AppText muted>No exercises match.</AppText> : null}
      </Sheet>
    </Screen>
  );
}
