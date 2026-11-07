import React from 'react';
import { Stack } from 'expo-router';
import { Shell, type NavItem } from '../../components/layout/Shell';
import { colors } from '../../lib/theme';

const ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'view-dashboard-outline', href: '/dashboard', side: true, bottom: true },
  { label: 'Members', icon: 'account-group-outline', href: '/members', side: true, bottom: true },
  { label: 'Payments', icon: 'cash-multiple', href: '/payments', side: true, bottom: true },
  { label: 'Plans', icon: 'tag-multiple-outline', href: '/plans', side: true, bottom: true },
  { label: 'Announcements', icon: 'bullhorn-outline', href: '/announcements', side: true },
  { label: 'More', icon: 'dots-horizontal', href: '/more', bottom: true, also: ['/announcements'] },
];

export default function AdminLayout() {
  return (
    <Shell items={ITEMS} roleLabel="ADMINISTRATOR">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'fade' }} />
    </Shell>
  );
}
