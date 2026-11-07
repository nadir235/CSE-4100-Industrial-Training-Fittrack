import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Local (on-device) notifications for reminders and timers.
 * - Android / iOS: scheduled with expo-notifications (works with the app closed).
 * - Web: browsers can't schedule while the page is closed, so reminders are not scheduled there;
 *   the in-app notification centre (Firestore) is used for server-sent messages instead.
 */
export const notificationsSupported = Platform.OS !== 'web';

let configured = false;
export function configureNotifications() {
  if (configured || !notificationsSupported) return;
  configured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'FitTrack reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#E50914',
    }).catch(() => {});
  }
}

/** Asks for permission only when the user actually turns a reminder on. */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  configureNotifications();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function cancelByPrefix(prefix: string) {
  if (!notificationsSupported) return;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function scheduleIn(id: string, seconds: number, title: string, body: string) {
  if (!notificationsSupported || seconds < 1) return false;
  configureNotifications();
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.ceil(seconds), channelId: 'default' },
  });
  return true;
}

export async function scheduleDaily(id: string, hour: number, minute: number, title: string, body: string) {
  if (!notificationsSupported) return false;
  configureNotifications();
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: 'default' },
  });
  return true;
}

/** Water reminders: repeating every N minutes between 8:00 and 22:00 as daily triggers. */
export async function scheduleWaterReminders(everyMinutes: number) {
  if (!notificationsSupported) return false;
  await cancelByPrefix('water-');
  const startMin = 8 * 60;
  const endMin = 22 * 60;
  let count = 0;
  for (let t = startMin; t <= endMin && count < 24; t += Math.max(30, everyMinutes)) {
    await scheduleDaily(`water-${t}`, Math.floor(t / 60), t % 60, 'Time to hydrate 💧', 'Have a glass of water and log it in FitTrack.');
    count++;
  }
  return true;
}

export async function cancelId(id: string) {
  if (!notificationsSupported) return;
  await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
}
