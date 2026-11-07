import { useAuth } from './auth';
import { addTo, patch, remove, setAt, sub, useCol, userPath, type ColOptions } from './db';
import type { UserProfile } from './types';

export function useUid(): string {
  const { user } = useAuth();
  if (!user) throw new Error('Not signed in');
  return user.uid;
}

/** Live list from one of the signed-in member's sub-collections. */
export function useMine<T extends { id: string }>(name: string, opts?: ColOptions) {
  const { user } = useAuth();
  return useCol<T>(user ? sub(user.uid, name) : null, opts);
}

// Logging any of these counts as "activity" (used by the gym's active/inactive member stats).
const ACTIVITY = new Set(['workoutLogs', 'running', 'water', 'fasting', 'faceLogs', 'meals', 'weights']);

export function useMemberActions() {
  const uid = useUid();
  return {
    uid,
    add: async (name: string, data: Record<string, unknown>) => {
      const id = await addTo(sub(uid, name), data);
      if (ACTIVITY.has(name)) setAt(userPath(uid), { lastActiveAt: Date.now() }, true).catch(() => {});
      return id;
    },
    set: (name: string, id: string, data: Record<string, unknown>) => setAt(`${sub(uid, name)}/${id}`, data, false),
    update: (name: string, id: string, data: Record<string, unknown>) => patch(`${sub(uid, name)}/${id}`, data),
    del: (name: string, id: string) => remove(`${sub(uid, name)}/${id}`),
    updateProfile: (data: Partial<UserProfile>) => setAt(userPath(uid), data as Record<string, unknown>, true),
  };
}

/** Strip `undefined` (Firestore rejects it). */
export function clean<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}
