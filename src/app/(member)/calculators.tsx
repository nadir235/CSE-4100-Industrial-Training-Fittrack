import React, { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Banner, Button, Card, Chips, EmptyState, Grid, Icon, IconButton, Input, KeyValue, Row, Screen, SectionTitle, toneColor, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { CALCULATORS, HEALTH_DISCLAIMER, validateFields, type CalcResult } from '../../lib/calc';
import { fmtDateTime } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { colors } from '../../lib/theme';
import type { CalcEntry } from '../../lib/types';

export default function Calculators() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const history = useMine<CalcEntry>('calcHistory', { order: ['at', 'desc'], limit: 200 });

  const [selected, setSelected] = useState(CALCULATORS[0].id);
  const calc = CALCULATORS.find((c) => c.id === selected)!;
  const [values, setValues] = useState<Record<string, Record<string, string>>>({});
  const [result, setResult] = useState<{ id: string; res: CalcResult; prev?: CalcEntry } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Prefill from profile / earlier results the first time a calculator opens
  useEffect(() => {
    setValues((all) => {
      if (all[selected]) return all;
      const lastOf = (t: string) => history.data.find((h) => h.type === t)?.value;
      const pre: Record<string, string> = {};
      for (const f of calc.fields) {
        if (f.key === 'sex' && profile?.sex) pre.sex = profile.sex;
        if (f.key === 'age' && profile?.age) pre.age = String(profile.age);
        if (f.key === 'heightCm' && profile?.heightCm) pre.heightCm = String(profile.heightCm);
        if (f.key === 'weightKg' && profile?.weightKg) pre.weightKg = String(profile.weightKg);
        if (f.key === 'activity') pre.activity = '1.375';
        if (f.key === 'goal') pre.goal = '0';
        if (f.key === 'preset') pre.preset = 'balanced';
        if (f.key === 'climate') pre.climate = 'normal';
        if (f.key === 'calories' && lastOf('calories')) pre.calories = String(lastOf('calories'));
        if (f.key === 'tdee' && lastOf('tdee')) pre.tdee = String(lastOf('tdee'));
        if (f.key === 'exerciseMin') pre.exerciseMin = '30';
      }
      return { ...all, [selected]: pre };
    });
  }, [selected, calc, profile, history.data]);

  const v = values[selected] || {};
  const setField = (k: string, val: string) => setValues((a) => ({ ...a, [selected]: { ...(a[selected] || {}), [k]: val } }));
  const mine = useMemo(() => history.data.filter((h) => h.type === selected), [history.data, selected]);

  const submit = async () => {
    setError(null);
    const problem = validateFields(calc.fields, v);
    if (problem) {
      setError(problem);
      setResult(null);
      return;
    }
    const out = calc.compute(v);
    if ('error' in out) {
      setError(out.error);
      setResult(null);
      return;
    }
    const prev = mine[0];
    setResult({ id: selected, res: out, prev });
    await run(() => actions.add('calcHistory', { type: selected, summary: out.summary, value: out.value, inputs: v, at: Date.now() }));
  };

  const delta = result?.prev ? result.res.value - result.prev.value : null;

  return (
    <Screen title="Health Calculators" subtitle="Estimates for education — not medical advice">
      <Grid cols={{ mobile: 2, tablet: 5, desktop: 5 }} gap={8}>
        {CALCULATORS.map((c) => {
          const on = c.id === selected;
          return (
            <Card key={c.id} onPress={() => { setSelected(c.id); setResult(null); setError(null); }} style={{ borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '1A' : colors.surface }}>
              <Icon name={c.icon} color={on ? colors.primary : colors.textMuted} size={24} />
              <AppText variant="h3" style={{ marginTop: 6 }} numberOfLines={1}>{c.title}</AppText>
            </Card>
          );
        })}
      </Grid>

      <SectionTitle title={calc.title} />
      <AppText muted style={{ marginBottom: 12 }}>{calc.short}</AppText>

      <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
        <Card>
          {calc.fields.map((f) =>
            f.kind === 'select' ? (
              <Chips key={f.key} label={f.label} options={f.options!} value={v[f.key] || ''} onChange={(val) => setField(f.key, val)} />
            ) : (
              <Input key={f.key} label={f.label + (f.optional ? ' (optional)' : '')} unit={f.unit} value={v[f.key] || ''} onChangeText={(t) => setField(f.key, t.replace(',', '.'))} keyboardType="decimal-pad" hint={f.hint} placeholder={f.min !== undefined ? `${f.min}–${f.max}` : undefined} />
            ),
          )}
          {error ? <Banner tone="bad" text={error} /> : null}
          <Button title="Calculate" icon="calculator" full onPress={submit} loading={busy} />
        </Card>

        <View>
          {result && result.id === selected ? (
            <Card accent={toneColor(result.res.tone === 'good' ? 'good' : result.res.tone === 'warn' ? 'warn' : result.res.tone === 'bad' ? 'bad' : 'neutral')}>
              <AppText variant="label" muted>Result</AppText>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginVertical: 6 }}>
                <AppText variant="big">{result.res.headline}</AppText>
                {result.res.unit ? <AppText muted>{result.res.unit}</AppText> : null}
              </View>
              {result.res.rows.map((r) => <KeyValue key={r.label} label={r.label} value={r.value} />)}
              {delta !== null && result.prev ? (
                <AppText style={{ marginTop: 10 }} color={colors.info}>
                  Previous result ({fmtDateTime(result.prev.at)}): {result.prev.value} → {delta === 0 ? 'no change' : `${delta > 0 ? '+' : ''}${Math.round(delta * 10) / 10}`}
                </AppText>
              ) : null}
              <AppText style={{ marginTop: 12 }} muted>What this means: {result.res.meaning}</AppText>
              <AppText variant="caption" muted style={{ marginTop: 6 }}>Saved to your history.</AppText>
            </Card>
          ) : (
            <Card>
              <EmptyState icon="calculator-variant-outline" title="Your result appears here" text="Fill in the form and tap Calculate." />
            </Card>
          )}
        </View>
      </Grid>

      <SectionTitle title={`${calc.title} history`} />
      {mine.length === 0 ? (
        <EmptyState icon="history" title="No saved results yet" />
      ) : (
        <View style={{ gap: 6 }}>
          {mine.slice(0, 15).map((h, i) => {
            const older = mine[i + 1];
            const d = older ? h.value - older.value : null;
            return (
              <Card key={h.id} padded={false} style={{ paddingVertical: 10, paddingHorizontal: 14 }}>
                <Row>
                  <View style={{ flex: 1 }}>
                    <AppText>{h.summary}</AppText>
                    <AppText variant="caption" muted>{fmtDateTime(h.at)}{d !== null ? ` · ${d === 0 ? 'no change' : `${d > 0 ? '+' : ''}${Math.round(d * 10) / 10} vs previous`}` : ''}</AppText>
                  </View>
                  <IconButton icon="trash-can-outline" size={18} color={colors.textDim} label="Delete result" onPress={async () => {
                    if (await confirm({ title: 'Delete this result?', confirmText: 'Delete', destructive: true })) {
                      await run(() => actions.del('calcHistory', h.id));
                      toast('Deleted');
                    }
                  }} />
                </Row>
              </Card>
            );
          })}
        </View>
      )}
      <AppText variant="caption" muted style={{ marginTop: 16 }}>{HEALTH_DISCLAIMER}</AppText>
    </Screen>
  );
}
