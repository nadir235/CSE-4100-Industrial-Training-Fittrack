import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AppText, Badge, Button, Card, EmptyState, Grid, Icon, Input, Loading, Row, Screen, Sheet, Toggle, useBusy, useDialog } from '../../components/ui';
import { adminApi } from '../../lib/adminApi';
import { useCol } from '../../lib/db';
import { money } from '../../lib/format';
import { colors } from '../../lib/theme';
import type { Plan } from '../../lib/types';

type Draft = { id?: string; name: string; price: string; durationDays: string; description: string; features: string; active: boolean };
const EMPTY: Draft = { name: '', price: '', durationDays: '30', description: '', features: '', active: true };

export default function Plans() {
  const plans = useCol<Plan>('plans');
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const [draft, setDraft] = useState<Draft | null>(null);
  const sorted = useMemo(() => [...plans.data].sort((a, b) => a.durationDays - b.durationDays), [plans.data]);

  const save = async () => {
    if (!draft) return;
    const price = Number(draft.price);
    const days = Number(draft.durationDays);
    if (draft.name.trim().length < 2) return toast('Plan name is required.', 'warn');
    if (!isFinite(price) || price < 0 || price > 1_000_000) return toast('Enter a valid price.', 'warn');
    if (!Number.isInteger(days) || days < 1 || days > 3650) return toast('Duration must be 1–3650 days.', 'warn');
    await run(async () => {
      await adminApi.savePlan({
        id: draft.id,
        name: draft.name.trim(),
        price,
        durationDays: days,
        description: draft.description.trim(),
        features: draft.features.split('\n').map((s) => s.trim()).filter(Boolean),
        active: draft.active,
      });
      setDraft(null);
    }, { success: 'Plan saved' });
  };

  return (
    <Screen title="Membership Plans" subtitle="Create and manage what members can buy" right={<Button title="New plan" icon="plus" size="sm" onPress={() => setDraft({ ...EMPTY })} />}>
      {plans.loading ? <Loading /> : sorted.length === 0 ? (
        <EmptyState icon="tag-outline" title="No plans yet" text="Create your first membership plan." />
      ) : (
        <Grid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
          {sorted.map((p) => (
            <Card key={p.id} accent={p.active ? colors.success : colors.textDim}>
              <Row style={{ justifyContent: 'space-between' }}>
                <AppText variant="h3">{p.name}</AppText>
                <Badge text={p.active ? 'ACTIVE' : 'HIDDEN'} tone={p.active ? 'good' : 'neutral'} />
              </Row>
              <AppText variant="h1" color={colors.primary} style={{ marginVertical: 4 }}>{money(p.price)}</AppText>
              <AppText variant="caption" muted>{p.durationDays} days</AppText>
              <AppText muted style={{ marginVertical: 8 }}>{p.description}</AppText>
              {p.features.map((f) => (
                <Row key={f} gap={6} style={{ marginBottom: 2 }}><Icon name="check" size={15} color={colors.success} /><AppText variant="caption" style={{ flex: 1 }}>{f}</AppText></Row>
              ))}
              <Row style={{ marginTop: 12, flexWrap: 'wrap' }}>
                <Button title="Edit" size="sm" variant="secondary" onPress={() => setDraft({ id: p.id, name: p.name, price: String(p.price), durationDays: String(p.durationDays), description: p.description, features: p.features.join('\n'), active: p.active })} />
                <Button title="Delete" size="sm" variant="ghost" onPress={async () => {
                  if (await confirm({ title: 'Delete plan?', message: 'Existing memberships are not affected. Consider hiding the plan instead.', confirmText: 'Delete', destructive: true })) await run(() => adminApi.deletePlan(p.id), { success: 'Plan deleted' });
                }} />
              </Row>
            </Card>
          ))}
        </Grid>
      )}

      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit plan' : 'New plan'}>
        {draft ? (
          <View>
            <Input label="Plan name" value={draft.name} onChangeText={(t) => setDraft({ ...draft, name: t })} autoCapitalize="words" placeholder="Monthly Membership" />
            <Row style={{ alignItems: 'flex-start' }} gap={12}>
              <Input style={{ flex: 1 }} label="Price (BDT)" value={draft.price} onChangeText={(t) => setDraft({ ...draft, price: t })} keyboardType="numeric" />
              <Input style={{ flex: 1 }} label="Duration (days)" value={draft.durationDays} onChangeText={(t) => setDraft({ ...draft, durationDays: t })} keyboardType="numeric" />
            </Row>
            <Input label="Description" value={draft.description} onChangeText={(t) => setDraft({ ...draft, description: t })} multiline autoCapitalize="sentences" />
            <Input label="Features (one per line)" value={draft.features} onChangeText={(t) => setDraft({ ...draft, features: t })} multiline autoCapitalize="sentences" />
            <Toggle label="Active" hint="Hidden plans can't be purchased" value={draft.active} onChange={(v) => setDraft({ ...draft, active: v })} />
            <Button title="Save plan" onPress={save} loading={busy} full />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
