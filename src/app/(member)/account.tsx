import React, { useMemo } from 'react';
import { HubList } from '../../components/HubList';
import { AppText, Avatar, Button, Card, Row, Screen, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { useMine } from '../../lib/member';
import type { AppNotification } from '../../lib/types';

export default function Account() {
  const { profile, user, logout } = useAuth();
  const { confirm } = useDialog();
  const notifs = useMine<AppNotification>('notifications', { order: ['at', 'desc'], limit: 50 });
  const unread = useMemo(() => notifs.data.filter((n) => !n.read).length, [notifs.data]);
  return (
    <Screen title="Account">
      <Card style={{ marginBottom: 16 }}>
        <Row gap={14}>
          <Avatar name={profile?.name} uri={profile?.photoData} size={56} />
          <Row style={{ flex: 1 }}>
            <AppText variant="h2" numberOfLines={1} style={{ flex: 1 }}>
              {profile?.name || user?.displayName}
            </AppText>
          </Row>
        </Row>
        <AppText muted style={{ marginTop: 6 }}>
          {user?.email}
        </AppText>
      </Card>
      <HubList
        items={[
          { icon: 'account-circle-outline', title: 'Profile', text: 'Personal info, photo, fitness level', href: '/profile' },
          { icon: 'card-account-details-outline', title: 'Membership', text: 'Plans, payments and receipts', href: '/membership' },
          { icon: 'bell-outline', title: 'Notifications', text: 'Reminders and gym announcements', href: '/notifications', badge: unread },
        ]}
      />
      <Button
        title="Log out"
        icon="logout"
        variant="secondary"
        style={{ marginTop: 24 }}
        onPress={async () => {
          if (await confirm({ title: 'Log out?', confirmText: 'Log out', destructive: true })) await logout();
        }}
      />
    </Screen>
  );
}
