import React from 'react';
import { HubList } from '../../components/HubList';
import { AppText, Avatar, Button, Card, Row, Screen, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';

export default function AdminMore() {
  const { user, logout } = useAuth();
  const { confirm } = useDialog();
  return (
    <Screen title="More">
      <Card style={{ marginBottom: 16 }}>
        <Row gap={14}>
          <Avatar name={user?.displayName || user?.email || 'Admin'} size={48} />
          <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>{user?.email}</AppText>
        </Row>
      </Card>
      <HubList items={[{ icon: 'bullhorn-outline', title: 'Announcements', text: 'Send a message to every member', href: '/announcements' }]} />
      <Button title="Log out" icon="logout" variant="secondary" style={{ marginTop: 24 }} onPress={async () => {
        if (await confirm({ title: 'Log out?', confirmText: 'Log out', destructive: true })) await logout();
      }} />
    </Screen>
  );
}
