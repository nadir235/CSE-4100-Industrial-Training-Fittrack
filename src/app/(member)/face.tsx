import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { ProgressRing } from '../../components/charts';
import { AppText, Badge, Banner, Button, Card, Chips, EmptyState, Grid, Icon, IconButton, Input, ProgressBar, Row, Screen, SectionTitle, Sheet, useBusy, useDialog } from '../../components/ui';
import { DEFAULT_FACE_ROUTINE, FACE_CATEGORIES, FACE_DISCLAIMER, FACE_EXERCISES, FACE_EXERCISE_BY_ID, type FaceCategory } from '../../data/face';
import { dayKey, fmtDuration, startOfDay } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { colors } from '../../lib/theme';
import type { FaceLog, FaceRoutine } from '../../lib/types';

export default function Face() {
  const actions = useMemberActions();
  const { confirm, toast } = useDialog();
  const { busy, run } = useBusy();
  const routines = useMine<FaceRoutine>('faceRoutines', { order: ['createdAt', 'desc'] });
  const logs = useMine<FaceLog>('faceLogs', { order: ['at', 'desc'], limit: 300 });

  const [cat, setCat] = useState<FaceCategory | 'All'>('All');
  const [openId, setOpenId] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ id?: string; name: string; ids: string[] } | null>(null);
  const [player, setPlayer] = useState<{ title: string; ids: string[] } | null>(null);

  const today = dayKey();
  const doneToday = useMemo(() => new Set(logs.data.filter((l) => l.day === today).map((l) => l.exerciseId)), [logs.data, today]);
  const streak = useMemo(() => {
    const days = new Set(logs.data.map((l) => l.day));
    let n = 0;
    let t = startOfDay();
    if (!days.has(dayKey(t))) t -= 86_400_000;
    while (days.has(dayKey(t))) {
      n++;
      t -= 86_400_000;
    }
    return n;
  }, [logs.data]);

  const list = FACE_EXERCISES.filter((e) => cat === 'All' || e.category === cat);
  const daily = DEFAULT_FACE_ROUTINE;
  const dailyDone = daily.filter((id) => doneToday.has(id)).length;

  const markDone = (id: string) => run(() => actions.add('faceLogs', { exerciseId: id, at: Date.now(), day: today }));

  const saveRoutine = async () => {
    if (!builder) return;
    if (builder.name.trim().length < 2) return toast('Name your routine.', 'warn');
    if (builder.ids.length === 0) return toast('Pick at least one exercise.', 'warn');
    await run(async () => {
      const data = { name: builder.name.trim(), exerciseIds: builder.ids, createdAt: Date.now() };
      if (builder.id) await actions.set('faceRoutines', builder.id, data);
      else await actions.add('faceRoutines', data);
      setBuilder(null);
    }, { success: 'Routine saved' });
  };

  return (
    <Screen title="Face Fitness" subtitle="Face yoga, jaw, cheek, forehead and neck routines">
      <Banner tone="info" text={FACE_DISCLAIMER} />

      <Card accent={colors.primary}>
        <Row gap={16}>
          <ProgressRing value={dailyDone / daily.length} size={84} stroke={9}>
            <AppText variant="h3">{dailyDone}/{daily.length}</AppText>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Daily routine</AppText>
            <AppText variant="caption" muted>{daily.length} gentle exercises · about 6 minutes{streak ? ` · ${streak}-day streak 🔥` : ''}</AppText>
            <Button title="Start daily routine" icon="play" size="sm" style={{ marginTop: 8, alignSelf: 'flex-start' }} onPress={() => setPlayer({ title: 'Daily routine', ids: daily })} />
          </View>
        </Row>
      </Card>

      <SectionTitle title="My routines" right={<Button title="New" icon="plus" size="sm" onPress={() => setBuilder({ name: '', ids: [] })} />} />
      {routines.data.length === 0 ? (
        <EmptyState icon="clipboard-list-outline" title="No custom routines" text="Combine any face exercises into your own routine." />
      ) : (
        <Grid>
          {routines.data.map((r) => (
            <Card key={r.id}>
              <AppText variant="h3">{r.name}</AppText>
              <AppText variant="caption" muted>{r.exerciseIds.length} exercises · ~{Math.round(r.exerciseIds.reduce((s, id) => s + (FACE_EXERCISE_BY_ID[id]?.durationSec || 0), 0) / 60)} min</AppText>
              <Row style={{ marginTop: 10, flexWrap: 'wrap' }} gap={8}>
                <Button title="Start" size="sm" icon="play" onPress={() => setPlayer({ title: r.name, ids: r.exerciseIds })} />
                <Button title="Edit" size="sm" variant="secondary" onPress={() => setBuilder({ id: r.id, name: r.name, ids: r.exerciseIds })} />
                <Button title="Delete" size="sm" variant="ghost" onPress={async () => {
                  if (await confirm({ title: 'Delete routine?', confirmText: 'Delete', destructive: true })) await run(() => actions.del('faceRoutines', r.id));
                }} />
              </Row>
            </Card>
          ))}
        </Grid>
      )}

      <SectionTitle title="Exercises" />
      <Chips value={cat} onChange={setCat} options={[{ value: 'All', label: 'All' }, ...FACE_CATEGORIES.map((c) => ({ value: c, label: c }))]} />
      <Grid>
        {list.map((e) => {
          const open = openId === e.id;
          const done = doneToday.has(e.id);
          return (
            <Card key={e.id}>
              <Pressable onPress={() => setOpenId(open ? null : e.id)}>
                <Row>
                  <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary + '26', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={e.icon} size={24} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3">{e.name}</AppText>
                    <AppText variant="caption" muted>{e.category} · {e.durationSec}s · {e.reps}</AppText>
                  </View>
                  {done ? <Badge text="DONE" tone="good" /> : null}
                </Row>
              </Pressable>
              {open ? (
                <View style={{ marginTop: 10 }}>
                  {e.steps.map((s, i) => (
                    <AppText key={i} style={{ marginBottom: 4 }}>{i + 1}. {s}</AppText>
                  ))}
                  <AppText variant="caption" color={colors.warning} style={{ marginTop: 4 }}>{e.note}</AppText>
                  <Pressable onPress={() => Linking.openURL(`https://www.youtube.com/results?search_query=${encodeURIComponent(e.name + ' face yoga demonstration')}`).catch(() => toast('Could not open link', 'bad'))} style={{ marginTop: 8 }}>
                    <AppText color={colors.primary} style={{ fontWeight: '700' }}>Watch demonstration ↗</AppText>
                  </Pressable>
                  <Row style={{ marginTop: 10 }}>
                    <Button title="Do it now" size="sm" icon="play" onPress={() => setPlayer({ title: e.name, ids: [e.id] })} />
                    {!done ? <Button title="Mark done" size="sm" variant="secondary" onPress={() => markDone(e.id)} /> : null}
                  </Row>
                </View>
              ) : null}
            </Card>
          );
        })}
      </Grid>

      {/* routine builder */}
      <Sheet visible={!!builder} onClose={() => setBuilder(null)} title={builder?.id ? 'Edit routine' : 'New routine'}>
        {builder ? (
          <>
            <Input label="Name" value={builder.name} onChangeText={(t) => setBuilder({ ...builder, name: t })} placeholder="Morning glow" autoCapitalize="sentences" />
            <AppText variant="caption" muted style={{ marginBottom: 6, fontWeight: '600' }}>Pick exercises ({builder.ids.length})</AppText>
            {FACE_EXERCISES.map((e) => {
              const on = builder.ids.includes(e.id);
              return (
                <Pressable key={e.id} onPress={() => setBuilder({ ...builder, ids: on ? builder.ids.filter((x) => x !== e.id) : [...builder.ids, e.id] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Icon name={on ? 'checkbox-marked' : 'checkbox-blank-outline'} color={on ? colors.primary : colors.textDim} />
                  <View style={{ flex: 1 }}>
                    <AppText>{e.name}</AppText>
                    <AppText variant="caption" muted>{e.category} · {e.durationSec}s</AppText>
                  </View>
                </Pressable>
              );
            })}
            <Button title="Save routine" onPress={saveRoutine} loading={busy} full style={{ marginTop: 14 }} />
          </>
        ) : null}
      </Sheet>

      {player ? <Player title={player.title} ids={player.ids} onClose={() => setPlayer(null)} onDone={markDone} /> : null}
    </Screen>
  );
}

function Player({ title, ids, onClose, onDone }: { title: string; ids: string[]; onClose: () => void; onDone: (id: string) => void }) {
  const [i, setI] = useState(0);
  const [left, setLeft] = useState(FACE_EXERCISE_BY_ID[ids[0]]?.durationSec || 30);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const doneRef = useRef<Set<string>>(new Set());
  const ex = FACE_EXERCISE_BY_ID[ids[i]];

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const next = (complete: boolean) => {
    if (complete && ex && !doneRef.current.has(ex.id)) {
      doneRef.current.add(ex.id);
      onDone(ex.id);
    }
    if (i + 1 >= ids.length) {
      setRunning(false);
      setFinished(true);
      return;
    }
    const n = FACE_EXERCISE_BY_ID[ids[i + 1]];
    setI(i + 1);
    setLeft(n?.durationSec || 30);
    setRunning(false);
  };

  useEffect(() => {
    if (running && left <= 0) next(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, running]);

  return (
    <Sheet visible onClose={onClose} title={title}>
      {finished ? (
        <View style={{ alignItems: 'center', padding: 16 }}>
          <Icon name="check-circle" size={52} color={colors.success} />
          <AppText variant="h2" style={{ marginTop: 8 }}>Routine complete</AppText>
          <AppText muted center style={{ marginTop: 4 }}>Nice work — your completions have been saved.</AppText>
          <Button title="Close" onPress={onClose} style={{ marginTop: 16 }} />
        </View>
      ) : ex ? (
        <View>
          <ProgressBar value={i / ids.length} />
          <AppText variant="caption" muted style={{ marginTop: 6 }}>Exercise {i + 1} of {ids.length}</AppText>
          <Row style={{ marginTop: 10 }}>
            <Icon name={ex.icon} size={32} color={colors.primary} />
            <AppText variant="h2" style={{ flex: 1 }}>{ex.name}</AppText>
          </Row>
          <View style={{ marginVertical: 12 }}>
            {ex.steps.map((s, k) => <AppText key={k} style={{ marginBottom: 4 }}>{k + 1}. {s}</AppText>)}
          </View>
          <View style={{ alignItems: 'center', marginVertical: 10 }}>
            <ProgressRing value={Math.max(0, left) / ex.durationSec} size={130} stroke={11}>
              <AppText variant="h1">{fmtDuration(Math.max(0, left))}</AppText>
            </ProgressRing>
          </View>
          <Row style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button title={running ? 'Pause' : 'Start'} icon={running ? 'pause' : 'play'} onPress={() => setRunning((r) => !r)} />
            <Button title="Done" variant="secondary" onPress={() => next(true)} />
            <Button title="Skip" variant="ghost" onPress={() => next(false)} />
          </Row>
        </View>
      ) : null}
    </Sheet>
  );
}

void IconButton;
