import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { BarChart } from '../../components/charts';
import { RouteMap } from '../../components/RouteMap';
import { AppText, Badge, Banner, Button, Card, Chips, EmptyState, Grid, IconButton, Input, Row, Screen, SectionTitle, Sheet, StatCard, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { runCalories } from '../../lib/calc';
import { fmtDateTime, fmtDuration, fmtPace, round, startOfMonth, startOfWeek } from '../../lib/format';
import { acceptFix, paceSecPerKm, thinRoute, type LatLng } from '../../lib/geo';
import { useMemberActions, useMine } from '../../lib/member';
import { sumByWeek } from '../../lib/stats';
import { colors } from '../../lib/theme';
import type { RunSession, WeightEntry } from '../../lib/types';

type Phase = 'idle' | 'running' | 'paused';

export default function Running() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const runs = useMine<RunSession>('running', { order: ['at', 'desc'], limit: 200 });
  const weights = useMine<WeightEntry>('weights', { order: ['at', 'desc'], limit: 1 });
  const kg = weights.data[0]?.kg || profile?.weightKg || 70;

  const [phase, setPhase] = useState<Phase>('idle');
  const [dist, setDist] = useState(0);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsState, setGpsState] = useState<'searching' | 'ok' | 'off'>('off');
  const [manualOpen, setManualOpen] = useState(false);
  const [mKm, setMKm] = useState('');
  const [mMin, setMMin] = useState('');
  const [mNote, setMNote] = useState('');

  const sub = useRef<Location.LocationSubscription | null>(null);
  const lastFix = useRef<{ p: LatLng; t: number } | null>(null);
  const baseElapsed = useRef(0);
  const resumedAt = useRef(0);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  // timer
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(baseElapsed.current + (Date.now() - resumedAt.current) / 1000), 500);
    return () => clearInterval(t);
  }, [phase]);

  const stopWatching = useCallback(() => {
    sub.current?.remove();
    sub.current = null;
    setGpsState('off');
  }, []);
  useEffect(() => () => { sub.current?.remove(); deactivateKeepAwake('run').catch(() => {}); }, []);

  const startWatching = useCallback(async (): Promise<boolean> => {
    // Ask for location only now — when the user starts a run.
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) {
      setGpsError('Location permission was denied. You can still log this run manually.');
      return false;
    }
    setGpsError(null);
    setGpsState('searching');
    try {
      sub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
        (loc) => {
          if (phaseRef.current !== 'running') return;
          const p = { lat: loc.coords.latitude, lng: loc.coords.longitude };
          const prev = lastFix.current;
          const dt = prev ? (loc.timestamp - prev.t) / 1000 : 0;
          const { accept, km } = acceptFix(prev?.p || null, p, loc.coords.accuracy, dt);
          setGpsState('ok');
          if (!accept) return;
          lastFix.current = { p, t: loc.timestamp };
          setDist((d) => d + km);
          setRoute((r) => [...r, p]);
        },
      );
      return true;
    } catch (e: any) {
      setGpsError(`GPS unavailable (${e?.message || 'unknown error'}). You can log this run manually.`);
      setGpsState('off');
      return false;
    }
  }, []);

  const begin = async () => {
    setDist(0);
    setRoute([]);
    setElapsed(0);
    baseElapsed.current = 0;
    lastFix.current = null;
    const ok = await startWatching();
    if (!ok) {
      // keep timing without GPS so the user can still record duration; distance entered at the end
      toast('Timing without GPS — enter distance when you finish.', 'info');
    }
    resumedAt.current = Date.now();
    setPhase('running');
    activateKeepAwakeAsync('run').catch(() => {});
  };

  const pause = () => {
    baseElapsed.current += (Date.now() - resumedAt.current) / 1000;
    setElapsed(baseElapsed.current);
    setPhase('paused');
    lastFix.current = null; // avoid counting the gap while paused
  };
  const resume = () => {
    resumedAt.current = Date.now();
    setPhase('running');
  };

  const [finish, setFinish] = useState<{ km: string } | null>(null);

  const stop = async () => {
    const total = phase === 'running' ? baseElapsed.current + (Date.now() - resumedAt.current) / 1000 : baseElapsed.current;
    baseElapsed.current = total;
    setElapsed(total);
    setPhase('paused');
    stopWatching();
    deactivateKeepAwake('run').catch(() => {});
    setFinish({ km: dist > 0 ? String(round(dist, 2)) : '' });
  };

  const save = async () => {
    if (!finish) return;
    const km = Number(finish.km);
    if (!isFinite(km) || km <= 0 || km > 300) return toast('Enter a distance between 0.01 and 300 km.', 'warn');
    if (elapsed < 10) return toast('That run was too short to save.', 'warn');
    await run(async () => {
      const gps = dist > 0 && Math.abs(km - dist) < 0.05;
      await actions.add('running', {
        distanceKm: round(km, 2),
        durationSec: Math.round(elapsed),
        paceSecPerKm: Math.round(paceSecPerKm(km, elapsed)),
        calories: Math.round(runCalories(kg, km)),
        at: Date.now(),
        source: gps ? 'gps' : 'manual',
        ...(gps && route.length > 1 ? { route: thinRoute(route) } : {}),
      });
      setFinish(null);
      setPhase('idle');
      setDist(0);
      setRoute([]);
      setElapsed(0);
    }, { success: 'Run saved' });
  };

  const discard = async () => {
    if (await confirm({ title: 'Discard this run?', message: 'It will not be saved.', confirmText: 'Discard', destructive: true })) {
      setFinish(null);
      setPhase('idle');
      setDist(0);
      setRoute([]);
      setElapsed(0);
    }
  };

  const saveManual = async () => {
    const km = Number(mKm);
    const min = Number(mMin);
    if (!isFinite(km) || km <= 0 || km > 300) return toast('Enter a distance between 0.01 and 300 km.', 'warn');
    if (!isFinite(min) || min <= 0 || min > 1440) return toast('Enter a duration in minutes (1–1440).', 'warn');
    await run(async () => {
      await actions.add('running', {
        distanceKm: round(km, 2),
        durationSec: Math.round(min * 60),
        paceSecPerKm: Math.round(paceSecPerKm(km, min * 60)),
        calories: Math.round(runCalories(kg, km)),
        at: Date.now(),
        source: 'manual',
        ...(mNote.trim() ? { note: mNote.trim() } : {}),
      });
      setManualOpen(false);
      setMKm('');
      setMMin('');
      setMNote('');
    }, { success: 'Run added' });
  };

  const wk = startOfWeek();
  const mo = startOfMonth();
  const sum = (since: number, f: (r: RunSession) => number) => runs.data.filter((r) => r.at >= since).reduce((s, r) => s + f(r), 0);
  const weeklyKm = useMemo(() => sumByWeek(runs.data, 8, (r) => r.distanceKm).map((p) => ({ ...p, value: round(p.value, 1) })), [runs.data]);
  const best = runs.data.reduce<RunSession | null>((b, r) => (r.distanceKm >= 1 && (!b || r.paceSecPerKm < b.paceSecPerKm) ? r : b), null);

  const curPace = paceSecPerKm(dist, elapsed);

  return (
    <Screen title="Running" subtitle="Track runs with GPS or add them manually" right={phase === 'idle' ? <Button title="Add manually" size="sm" variant="secondary" icon="plus" onPress={() => setManualOpen(true)} /> : undefined}>
      {Platform.OS === 'web' ? <Banner tone="info" text="GPS in a browser needs location permission and works best on a phone. You can always add a run manually." /> : null}
      {gpsError ? <Banner tone="warn" text={gpsError} /> : null}

      {phase === 'idle' ? (
        <Card style={{ alignItems: 'center', padding: 28 }}>
          <AppText variant="h2">Ready to run?</AppText>
          <AppText muted center style={{ marginVertical: 8, maxWidth: 420 }}>We only ask for location when you start. Distance, pace and route are recorded while the app is open.</AppText>
          <Button title="Start run" icon="play" onPress={begin} />
        </Card>
      ) : (
        <Card style={{ padding: 22 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Badge text={phase === 'running' ? 'RECORDING' : 'PAUSED'} tone={phase === 'running' ? 'good' : 'warn'} />
            <Badge text={gpsState === 'ok' ? 'GPS OK' : gpsState === 'searching' ? 'SEARCHING GPS…' : 'NO GPS'} tone={gpsState === 'ok' ? 'good' : 'neutral'} />
          </Row>
          <Row style={{ justifyContent: 'space-around', marginVertical: 18, flexWrap: 'wrap' }} gap={20}>
            <View style={{ alignItems: 'center' }}><AppText variant="big">{fmtDuration(elapsed)}</AppText><AppText muted variant="caption">time</AppText></View>
            <View style={{ alignItems: 'center' }}><AppText variant="big">{round(dist, 2).toFixed(2)}</AppText><AppText muted variant="caption">km</AppText></View>
            <View style={{ alignItems: 'center' }}><AppText variant="big">{fmtPace(curPace).replace(' /km', '')}</AppText><AppText muted variant="caption">pace /km</AppText></View>
          </Row>
          <RouteMap points={route} />
          <Row style={{ justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            {phase === 'running' ? <Button title="Pause" icon="pause" variant="secondary" onPress={pause} /> : <Button title="Resume" icon="play" onPress={resume} />}
            <Button title="Stop & save" icon="stop" variant="danger" onPress={stop} />
          </Row>
          <AppText variant="caption" muted center style={{ marginTop: 10 }}>≈ {Math.round(runCalories(kg, dist))} kcal so far (estimate)</AppText>
        </Card>
      )}

      <SectionTitle title="Statistics" />
      <Grid cols={{ mobile: 2, tablet: 4, desktop: 4 }}>
        <StatCard icon="calendar-week" label="This week" value={String(round(sum(wk, (r) => r.distanceKm)))} unit="km" sub={`${runs.data.filter((r) => r.at >= wk).length} runs`} color={colors.success} />
        <StatCard icon="calendar-month" label="This month" value={String(round(sum(mo, (r) => r.distanceKm)))} unit="km" sub={`${runs.data.filter((r) => r.at >= mo).length} runs`} color={colors.success} />
        <StatCard icon="speedometer" label="Best pace (≥1 km)" value={best ? fmtPace(best.paceSecPerKm).replace(' /km', '') : '—'} unit="/km" />
        <StatCard icon="fire" label="Calories this month" value={String(Math.round(sum(mo, (r) => r.calories)))} unit="kcal" />
      </Grid>
      <Card style={{ marginTop: 12 }}>
        <AppText variant="h3" style={{ marginBottom: 8 }}>Weekly distance</AppText>
        <BarChart data={weeklyKm} color={colors.success} unit="km" />
      </Card>

      <SectionTitle title="Run history" />
      {runs.data.length === 0 ? (
        <EmptyState icon="run" title="No runs yet" text="Start a run or add one manually." />
      ) : (
        <View style={{ gap: 10 }}>
          {runs.data.slice(0, 40).map((r) => (
            <Card key={r.id}>
              <Row>
                <View style={{ flex: 1 }}>
                  <AppText variant="h3">{r.distanceKm} km · {fmtDuration(r.durationSec)}</AppText>
                  <AppText variant="caption" muted>{fmtDateTime(r.at)} · {fmtPace(r.paceSecPerKm)} · {Math.round(r.calories)} kcal</AppText>
                  {r.note ? <AppText variant="caption" muted>{r.note}</AppText> : null}
                </View>
                <Badge text={r.source === 'gps' ? 'GPS' : 'MANUAL'} tone={r.source === 'gps' ? 'good' : 'neutral'} />
                <IconButton icon="trash-can-outline" size={18} color={colors.textDim} label="Delete run" onPress={async () => {
                  if (await confirm({ title: 'Delete this run?', confirmText: 'Delete', destructive: true })) await run(() => actions.del('running', r.id));
                }} />
              </Row>
              {r.route && r.route.length > 1 ? <View style={{ marginTop: 10 }}><RouteMap points={r.route} height={130} /></View> : null}
            </Card>
          ))}
        </View>
      )}

      <Sheet visible={!!finish} onClose={() => setFinish(null)} title="Save your run">
        <AppText muted style={{ marginBottom: 10 }}>Time {fmtDuration(elapsed)}. Confirm or correct the distance.</AppText>
        <Input label="Distance" unit="km" value={finish?.km || ''} onChangeText={(t) => setFinish({ km: t.replace(',', '.') })} keyboardType="decimal-pad" hint={dist > 0 ? `GPS measured ${round(dist, 2)} km` : 'No GPS distance was recorded'} />
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title="Save run" onPress={save} loading={busy} />
          <Button title="Discard" variant="ghost" onPress={discard} />
        </Row>
      </Sheet>

      <Sheet visible={manualOpen} onClose={() => setManualOpen(false)} title="Add a run manually">
        <Input label="Distance" unit="km" value={mKm} onChangeText={(t) => setMKm(t.replace(',', '.'))} keyboardType="decimal-pad" placeholder="5.0" />
        <Input label="Duration" unit="min" value={mMin} onChangeText={(t) => setMMin(t.replace(',', '.'))} keyboardType="decimal-pad" placeholder="30" />
        <Input label="Note (optional)" value={mNote} onChangeText={setMNote} autoCapitalize="sentences" placeholder="Morning park loop" />
        <Button title="Save run" onPress={saveManual} loading={busy} full />
      </Sheet>
    </Screen>
  );
}

void Chips;
