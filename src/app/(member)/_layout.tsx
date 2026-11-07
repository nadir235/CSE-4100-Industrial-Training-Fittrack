import React, { useEffect, useMemo } from 'react';
import { Stack } from 'expo-router';
import { Shell, type NavItem } from '../../components/layout/Shell';
import { NotificationWatcher } from '../../components/NotificationWatcher';
import { useAuth } from '../../lib/auth';
import { useDocData } from '../../lib/db';
import { cancelId, scheduleIn } from '../../lib/notifications';
import { colors } from '../../lib/theme';
import { useMine } from '../../lib/member';
import type { AppNotification, Subscription } from '../../lib/types';

const ITEMS: NavItem[] = [
  { label: 'Home', icon: 'home-variant', href: '/home', side: true, bottom: true },
  { label: 'Workouts', icon: 'dumbbell', href: '/workouts', side: true, bottom: true },
  { label: 'Progress', icon: 'chart-line', href: '/progress', side: true },
  { label: 'Calculators', icon: 'calculator-variant', href: '/calculators', side: true },
  { label: 'Face Fitness', icon: 'emoticon-happy-outline', href: '/face', side: true },
  { label: 'Fasting', icon: 'timer-sand', href: '/fasting', side: true },
  { label: 'Water', icon: 'water', href: '/water', side: true },
  { label: 'Running', icon: 'run-fast', href: '/running', side: true },
  { label: 'Track', icon: 'view-grid-outline', href: '/track', bottom: true, also: ['/progress', '/calculators', '/face', '/fasting', '/water', '/running'] },
  { label: 'AI Coach', icon: 'robot-outline', href: '/ai', side: true, bottom: true },
  { label: 'Membership', icon: 'card-account-details-outline', href: '/membership', side: true },
  { label: 'Alerts', icon: 'bell-outline', href: '/notifications', side: true, badgeKey: 'notif' },
  { label: 'Profile', icon: 'account-circle-outline', href: '/profile', side: true },
  { label: 'Account', icon: 'account-circle-outline', href: '/account', bottom: true, badgeKey: 'notif', also: ['/profile', '/membership', '/notifications'] },
];

export default function MemberLayout() {
  const { user } = useAuth();
  const notifs = useMine<AppNotification>('notifications', { order: ['at', 'desc'], limit: 50 });
  const unread = useMemo(() => notifs.data.filter((n) => !n.read).length, [notifs.data]);
  const sub = useDocData<Subscription>(user ? `subscriptions/${user.uid}` : null);

  // Membership expiry reminder: 3 days before the plan ends (Android/iOS only; no-op on web).
  useEffect(() => {
    const exp = sub.data?.expiresAt;
    if (!exp || sub.data?.status !== 'active') {
      cancelId('membership-expiry');
      return;
    }
    const secs = (exp - 3 * 86_400_000 - Date.now()) / 1000;
    if (secs > 60) scheduleIn('membership-expiry', secs, 'Membership expiring soon', 'Your gym membership ends in 3 days. Renew in the app to keep access.').catch(() => {});
  }, [sub.data?.expiresAt, sub.data?.status]);

  return (
    <Shell items={ITEMS} badges={{ notif: unread }} roleLabel="MEMBER">
      <NotificationWatcher />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
    </Shell>
  );
}
