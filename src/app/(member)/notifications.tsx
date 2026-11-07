import React, { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppText, Banner, Button, Card, EmptyState, Icon, Input, Row, Screen, SectionTitle, Toggle, useBusy, useDialog } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { fmtDateTime } from '../../lib/format';
import { useMemberActions, useMine } from '../../lib/member';
import { cancelId, ensureNotificationPermission, notificationsSupported, scheduleDaily } from '../../lib/notifications';
import { requestWebPermission, webNotifySupported, webPermission } from '../../lib/webNotify';
import { usePopup } from '../../components/popup';
import { colors } from '../../lib/theme';
import type { AppNotification } from '../../lib/types';

const ICONS: Record<string, string> = {
  announcement: 'bullhorn-outline',
  payment: 'credit-card-check-outline',
  membership: 'card-account-details-outline',
  workout: 'dumbbell',
  recommendation: 'lightbulb-on-outline',
  water: 'water',
  fasting: 'timer-sand',
};

export default function Notifications() {
  const { profile } = useAuth();
  const actions = useMemberActions();
  const { toast } = useDialog();
  const { show } = usePopup();
  const { run } = useBusy();
  const [webPerm, setWebPerm] = useState(webPermission());
  const list = useMine<AppNotification>('notifications', { order: ['at', 'desc'], limit: 100 });
  const rem = profile?.workoutReminder || { enabled: false, hour: 18, minute: 0 };
  const [time, setTime] = useState('18:00');

  useEffect(() => {
    setTime(`${String(rem.hour).padStart(2, '0')}:${String(rem.minute).padStart(2, '0')}`);
  }, [rem.hour, rem.minute]);

  const saveReminder = async (enabled: boolean) => {
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
    if (!m) return toast('Use 24-hour time like 18:30.', 'warn');
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    await run(async () => {
      if (enabled) {
        if (!notificationsSupported) toast('Scheduled reminders are delivered by the Android app. Your preference is saved.', 'info');
        else if (!(await ensureNotificationPermission())) return void toast('Notification permission was denied.', 'warn');
        else await scheduleDaily('workout-daily', hour, minute, 'Time to train 💪', 'Your workout is waiting — even 15 minutes counts.');
      } else await cancelId('workout-daily');
      await actions.updateProfile({ workoutReminder: { enabled, hour, minute } });
    }, { success: enabled ? 'Reminder set' : 'Reminder turned off' });
  };

  const unread = list.data.filter((n) => !n.read);
  const markAll = () => run(async () => { await Promise.all(unread.map((n) => actions.update('notifications', n.id, { read: true }))); });

  return (
    <Screen title="Notifications" subtitle="Reminders and gym announcements" right={unread.length ? <Button title="Mark all read" size="sm" variant="secondary" onPress={markAll} /> : undefined}>
      <Card>
        <Toggle label="Daily workout reminder" hint="Get nudged at the time you choose" value={rem.enabled} onChange={saveReminder} />
        <Input label="Reminder time (24h)" value={time} onChangeText={setTime} placeholder="18:00" hint="Tap the switch again after changing the time to update it." />
        {!notificationsSupported ? <Banner tone="info" text="Browser reminders can't fire while the page is closed. Use the Android app for scheduled alerts." /> : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <AppText variant="h3">Popup alerts</AppText>
        <AppText muted style={{ marginVertical: 6 }}>New announcements and payment updates pop up on screen while you use the app.</AppText>
        <Row style={{ flexWrap: 'wrap' }}>
          <Button title="Preview popup" size="sm" variant="secondary" icon="bell-ring-outline" onPress={() => show({ title: 'Popup alerts are on', body: 'This is how new announcements will look.', kind: 'announcement' })} />
          {webNotifySupported && webPerm !== 'granted' ? (
            <Button title={webPerm === 'denied' ? 'Blocked in browser settings' : 'Enable browser popups'} size="sm" disabled={webPerm === 'denied'} onPress={async () => setWebPerm(await requestWebPermission())} />
          ) : null}
        </Row>
        {webNotifySupported && webPerm === 'granted' ? <AppText variant="caption" muted style={{ marginTop: 8 }}>Browser popups are on — you'll get one when this tab is in the background.</AppText> : null}
      </Card>

      <SectionTitle title="Inbox" />
      {list.data.length === 0 ? (
        <EmptyState icon="bell-outline" title="You're all caught up" text="Gym announcements, payment confirmations and membership reminders appear here." />
      ) : (
        <View style={{ gap: 8 }}>
          {list.data.map((n) => (
            <Pressable key={n.id} onPress={() => !n.read && actions.update('notifications', n.id, { read: true })}>
              <Card accent={n.read ? undefined : colors.primary}>
                <Row gap={12} style={{ alignItems: 'flex-start' }}>
                  <Icon name={ICONS[n.kind] || 'bell-outline'} color={n.read ? colors.textDim : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <AppText variant="h3" color={n.read ? colors.textMuted : colors.text}>{n.title}</AppText>
                    <AppText muted style={{ marginTop: 2 }}>{n.body}</AppText>
                    <AppText variant="caption" muted style={{ marginTop: 4 }}>{fmtDateTime(n.at)}</AppText>
                  </View>
                </Row>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
