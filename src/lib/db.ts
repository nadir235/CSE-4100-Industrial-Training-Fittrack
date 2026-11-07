import { useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  limit as qLimit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type WhereFilterOp,
} from 'firebase/firestore';
import { db } from './firebase';

export type ColOptions = {
  order?: [string, 'asc' | 'desc'];
  limit?: number;
  where?: [string, WhereFilterOp, unknown][];
};

function constraints(opts?: ColOptions): QueryConstraint[] {
  const c: QueryConstraint[] = [];
  opts?.where?.forEach(([f, op, v]) => c.push(where(f, op, v)));
  if (opts?.order) c.push(orderBy(opts.order[0], opts.order[1]));
  if (opts?.limit) c.push(qLimit(opts.limit));
  return c;
}

export type ColState<T> = { data: T[]; loading: boolean; error: string | null };

/** Live collection listener. Pass null path to disable. */
export function useCol<T extends { id: string }>(path: string | null, opts?: ColOptions, group = false): ColState<T> {
  const key = JSON.stringify([path, opts, group]);
  const [state, setState] = useState<ColState<T>>({ data: [], loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: [], loading: false, error: null });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const ref = group ? collectionGroup(db, path) : collection(db, path);
    const q = query(ref, ...constraints(opts));
    const unsub = onSnapshot(
      q,
      (snap) =>
        setState({
          data: snap.docs.map((d) => ({ id: d.id, ...(d.data() as DocumentData) }) as unknown as T),
          loading: false,
          error: null,
        }),
      (err) => setState({ data: [], loading: false, error: err.message }),
    );
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export type DocState<T> = { data: T | null; loading: boolean; error: string | null };

export function useDocData<T>(path: string | null): DocState<T> {
  const [state, setState] = useState<DocState<T>>({ data: null, loading: !!path, error: null });
  useEffect(() => {
    if (!path) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    const unsub = onSnapshot(
      doc(db, path),
      (snap) => setState({ data: snap.exists() ? ({ id: snap.id, ...snap.data() } as unknown as T) : null, loading: false, error: null }),
      (err) => setState({ data: null, loading: false, error: err.message }),
    );
    return unsub;
  }, [path]);
  return state;
}

// ---------- path helpers ----------
export const userPath = (uid: string) => `users/${uid}`;
export const sub = (uid: string, name: string) => `users/${uid}/${name}`;

// ---------- writes ----------
export async function addTo(path: string, data: Record<string, unknown>) {
  const ref = await addDoc(collection(db, path), data);
  return ref.id;
}
export async function setAt(path: string, data: Record<string, unknown>, merge = true) {
  await setDoc(doc(db, path), data, { merge });
}
export async function patch(path: string, data: Record<string, unknown>) {
  await updateDoc(doc(db, path), data);
}
export async function remove(path: string) {
  await deleteDoc(doc(db, path));
}

/** Memoised "since" filter helper for already-sorted data. */
export function useSince<T extends { at: number }>(rows: T[], since: number): T[] {
  return useMemo(() => rows.filter((r) => r.at >= since), [rows, since]);
}
