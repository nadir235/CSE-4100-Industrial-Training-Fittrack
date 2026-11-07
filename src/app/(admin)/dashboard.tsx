import React, { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { BarChart } from '../../components/charts';
import { AppText, Banner, Button, Card, Grid, Loading, Row, Screen, SectionTitle, StatCard } from '../../components/ui';
import { adminApi, type AdminStats } from '../../lib/adminApi';
import { money } from '../../lib/format';
import { colors } from '../../lib/theme';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await adminApi.stats());
    } catch (e: any) {
      setError(e?.message || 'Could not load statistics');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <Screen title="Gym Dashboard" subtitle="Overview of members, memberships and revenue" right={<Button title="Refresh" icon="refresh" size="sm" variant="secondary" onPress={load} />}>
      {error ? <Banner tone="bad" text={error} action={<Button title="Retry" size="sm" onPress={load} />} /> : null}
      {loading && !stats ? <Loading /> : null}
      {stats ? (
        <>
          <SectionTitle title="Members" />
          <Grid cols={{ mobile: 2, tablet: 3, desktop: 4 }}>
            <StatCard icon="account-group" label="Total members" value={String(stats.totalMembers)} />
            <StatCard icon="account-check" label="Active members" value={String(stats.activeMembers)} sub="Activity in last 30 days" color={colors.success} />
            <StatCard icon="account-clock" label="Inactive members" value={String(stats.inactiveMembers)} color={colors.warning} />
            <StatCard icon="account-plus" label="New (30 days)" value={String(stats.newRegistrations)} color={colors.info} />
          </Grid>
          <SectionTitle title="Memberships & revenue" />
          <Grid cols={{ mobile: 2, tablet: 3, desktop: 4 }}>
            <StatCard icon="card-account-details" label="Active memberships" value={String(stats.activeMemberships)} color={colors.success} />
            <StatCard icon="card-off-outline" label="Expired memberships" value={String(stats.expiredMemberships)} color={colors.danger} />
            <StatCard icon="cash-check" label="Membership revenue" value={money(stats.revenue, stats.currency)} />
            <StatCard icon="cash-clock" label="Pending payments" value={String(stats.pendingPayments)} sub={money(stats.pendingAmount, stats.currency)} color={colors.warning} />
            <StatCard icon="dumbbell" label="Workouts logged" value={String(stats.totalWorkouts)} />
          </Grid>
          <SectionTitle title="Trends" />
          <Grid cols={{ mobile: 1, tablet: 2, desktop: 2 }}>
            <Card><AppText variant="h3" style={{ marginBottom: 8 }}>Revenue by month ({stats.currency})</AppText><BarChart data={stats.revenueByMonth} format={(v) => String(Math.round(v))} /></Card>
            <Card><AppText variant="h3" style={{ marginBottom: 8 }}>New registrations per week</AppText><BarChart data={stats.signupsByWeek} color={colors.info} format={(v) => String(Math.round(v))} /></Card>
          </Grid>
          <SectionTitle title="Shortcuts" />
          <Row style={{ flexWrap: 'wrap' }}>
            <Button title="View members" icon="account-group-outline" onPress={() => router.navigate('/members')} />
            <Button title="Manage plans" icon="tag-multiple-outline" variant="secondary" onPress={() => router.navigate('/plans')} />
            <Button title="Send announcement" icon="bullhorn-outline" variant="secondary" onPress={() => router.navigate('/announcements')} />
          </Row>
        </>
      ) : null}
    </Screen>
  );
}
