import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');
let mod: NotificationsModule | null | undefined;
/** Loads expo-notifications lazily; returns null where its native part is missing (e.g. an incompatible Expo Go). */
function N(): NotificationsModule | null {
  if (mod !== undefined) return mod;
  if (Platform.OS === 'web') return (mod = null);
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-notifications') as NotificationsModule;
  } catch {
    mod = null;
  }
  return mod;
}

/**
 * Local (on-device) notifications for reminders and timers.
 * - Android / iOS: scheduled with expo-notifications (works with the app closed).
 * - Web: browsers can't schedule while the page is closed, so reminders are not scheduled there;
 *   the in-app notification centre (Firestore) is used for server-sent messages instead.
 */
export const notificationsSupported = Platform.OS !== 'web' && N() !== null;

let configured = false;
export function configureNotifications() {
  if (configured || !notificationsSupported) return;
  const Notifications = N();
  if (!Notifications) return;
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
  const Notifications = N()!;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function cancelByPrefix(prefix: string) {
  if (!notificationsSupported) return;
  const Notifications = N()!;
  const all = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.identifier.startsWith(prefix)).map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

export async function scheduleIn(id: string, seconds: number, title: string, body: string) {
  if (!notificationsSupported || seconds < 1) return false;
  configureNotifications();
  const Notifications = N()!;
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
  const Notifications = N()!;
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
  await N()!.cancelScheduledNotificationAsync(id).catch(() => {});
}
