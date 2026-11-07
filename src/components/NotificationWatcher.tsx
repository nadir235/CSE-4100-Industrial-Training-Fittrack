import { useEffect, useRef } from 'react';
import { useMine } from '../lib/member';
import { webNotify } from '../lib/webNotify';
import type { AppNotification } from '../lib/types';
import { usePopup } from './popup';

const FRESH_MS = 10 * 60_000; // never pop up something that is already old

/**
 * Watches the member's notification inbox and shows a popup the moment a NEW unread one arrives
 * (gym announcements, payment confirmations, membership changes...). The first snapshot after
 * sign-in is treated as "already seen" so old items don't pop up again.
 */
export function NotificationWatcher() {
  const { show } = usePopup();
  const list = useMine<AppNotification>('notifications', { order: ['at', 'desc'], limit: 50 });
  const seen = useRef<Set<string>>(new Set());
  const ready = useRef(false);

  useEffect(() => {
    if (list.loading) return;
    if (!ready.current) {
      list.data.forEach((n) => seen.current.add(n.id));
      ready.current = true;
      return;
    }
    // oldest first so several arrivals pop up in order
    [...list.data].reverse().forEach((n) => {
      if (seen.current.has(n.id)) return;
      seen.current.add(n.id);
      if (n.read || Date.now() - n.at > FRESH_MS) return;
      show({ title: n.title, body: n.body, kind: n.kind });
      webNotify(n.title, n.body);
    });
  }, [list.data, list.loading, show]);

  return null;
}
