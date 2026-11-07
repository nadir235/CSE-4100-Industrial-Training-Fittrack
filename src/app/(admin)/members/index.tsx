import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Avatar, Badge, Banner, Card, Chips, EmptyState, Input, Loading, Row, Screen } from '../../../components/ui';
import { adminApi, type MemberRow } from '../../../lib/adminApi';
import { daysUntil, fmtDate } from '../../../lib/format';
import { colors } from '../../../lib/theme';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active membership' },
  { value: 'expired', label: 'Expired' },
  { value: 'none', label: 'No membership' },
  { value: 'inactive', label: 'Inactive (30d)' },
];

export default function Members() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [rows, setRows] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError(null);
    adminApi
      .members(q, filter)
      .then((r) => live && setRows(r.members))
      .catch((e) => live && setError(e?.message || 'Could not load members'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [q, filter]);

  return (
    <Screen title="Members" subtitle={`${rows.length} member${rows.length === 1 ? '' : 's'} shown`}>
      <Input value={search} onChangeText={setSearch} placeholder="Search by name or email" />
      <Chips value={filter} onChange={setFilter} options={FILTERS} />
      {error ? <Banner tone="bad" text={error} /> : null}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <EmptyState icon="account-search-outline" title="No members found" text="Try a different search or filter." />
      ) : (
        <View style={{ gap: 8 }}>
          {rows.map((m) => {
            const d = daysUntil(m.membership?.expiresAt);
            const active = m.membership?.status === 'active' && (d ?? 0) > 0;
            return (
              <Card key={m.uid} onPress={() => router.navigate({ pathname: '/members/[uid]', params: { uid: m.uid } } as any)}>
                <Row gap={12}>
                  <Avatar name={m.name} size={42} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" numberOfLines={1}>{m.name}</AppText>
                    <AppText variant="caption" muted numberOfLines={1}>{m.email}</AppText>
                    <AppText variant="caption" muted>
                      Joined {fmtDate(m.createdAt)} · {m.fitnessLevel} · {m.lastActive ? `last active ${fmtDate(m.lastActive)}` : 'no activity yet'}
                    </AppText>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge text={m.membership ? (active ? 'ACTIVE' : m.membership.status === 'inactive' ? 'DEACTIVATED' : 'EXPIRED') : 'NO PLAN'} tone={active ? 'good' : m.membership ? 'warn' : 'neutral'} />
                    {m.membership ? <AppText variant="caption" muted>{m.membership.planName}</AppText> : null}
                  </View>
                </Row>
              </Card>
            );
          })}
        </View>
      )}
      <AppText variant="caption" muted style={{ marginTop: 16, color: colors.textDim }}>
        Administrators see only the information needed to run the gym. Open a profile to view fitness progress.
      </AppText>
    </Screen>
  );
}
