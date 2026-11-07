import { Platform } from 'react-native';

/**
 * Browser (system-level) popups for the web app. Only used when the tab is in the background,
 * since the in-app popup already covers the foreground. Native apps use expo-notifications instead.
 */
const N: any = Platform.OS === 'web' && typeof globalThis !== 'undefined' ? (globalThis as any).Notification : undefined;

export const webNotifySupported = !!N;

export function webPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  return N ? (N.permission as 'granted' | 'denied' | 'default') : 'unsupported';
}

/** Must be called from a user gesture (button press). */
export async function requestWebPermission(): Promise<'granted' | 'denied' | 'default' | 'unsupported'> {
  if (!N) return 'unsupported';
  try {
    return (await N.requestPermission()) as 'granted' | 'denied' | 'default';
  } catch {
    return webPermission();
  }
}

export function webNotify(title: string, body?: string) {
  if (!N || N.permission !== 'granted') return;
  const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
  if (!hidden) return;
  try {
    const n = new N(title, { body, tag: `fittrack-${title}` });
    n.onclick = () => {
      try {
        (globalThis as any).focus?.();
        n.close();
      } catch {
        /* ignore */
      }
    };
  } catch {
    /* some browsers only allow notifications through a service worker */
  }
}
