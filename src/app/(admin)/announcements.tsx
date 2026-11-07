import React, { useState } from 'react';
import { View } from 'react-native';
import { AppText, Banner, Button, Card, EmptyState, Input, Row, Screen, SectionTitle, useBusy, useDialog } from '../../components/ui';
import { adminApi } from '../../lib/adminApi';
import { useCol } from '../../lib/db';
import { fmtDateTime } from '../../lib/format';
import type { Announcement } from '../../lib/types';

export default function Announcements() {
  const list = useCol<Announcement>('announcements', { order: ['at', 'desc'], limit: 50 });
  const { toast, confirm } = useDialog();
  const { busy, run } = useBusy();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  const send = async () => {
    if (title.trim().length < 3) return toast('Add a short title.', 'warn');
    if (body.trim().length < 3) return toast('Write the announcement message.', 'warn');
    if (!(await confirm({ title: 'Send to all members?', message: 'Every registered member will receive this in their notification inbox.', confirmText: 'Send' }))) return;
    await run(async () => {
      const r = await adminApi.announce(title.trim(), body.trim());
      setTitle('');
      setBody('');
      toast(`Delivered to ${r.delivered} member${r.delivered === 1 ? '' : 's'}`, 'good');
    });
  };

  return (
    <Screen title="Announcements" subtitle="Message every gym member" keyboard>
      <Card>
        <Input label="Title" value={title} onChangeText={setTitle} autoCapitalize="sentences" placeholder="Gym closed on Friday" />
        <Input label="Message" value={body} onChangeText={setBody} multiline autoCapitalize="sentences" placeholder="Details for members…" />
        <Button title="Send announcement" icon="send" onPress={send} loading={busy} full />
      </Card>
      <Banner tone="info" text="Members see announcements in their in-app inbox, and on Android as a notification when the app is next opened." />
      <SectionTitle title="Sent" />
      {list.data.length === 0 ? <EmptyState icon="bullhorn-outline" title="Nothing sent yet" /> : (
        <View style={{ gap: 8 }}>
          {list.data.map((a) => (
            <Card key={a.id}>
              <AppText variant="h3">{a.title}</AppText>
              <AppText muted style={{ marginTop: 2 }}>{a.body}</AppText>
              <Row style={{ marginTop: 6 }}><AppText variant="caption" muted>{fmtDateTime(a.at)}</AppText></Row>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}
