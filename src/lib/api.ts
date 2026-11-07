import { Platform } from 'react-native';
import { auth } from './firebase';

const BASE = (process.env.EXPO_PUBLIC_API_URL || (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000')).replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) {
    const user = auth?.currentUser;
    if (!user) throw new ApiError('Please sign in again.', 401);
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: opts.method || (opts.body ? 'POST' : 'GET'),
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(`Cannot reach the server at ${BASE}. Is the backend running?`, 0);
  }
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new ApiError(json?.error || `Request failed (${res.status})`, res.status);
  return json as T;
}

export const API_BASE_URL = BASE;
