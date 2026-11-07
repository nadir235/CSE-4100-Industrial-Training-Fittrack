import { api } from './api';
import type { Payment, Plan, Subscription } from './types';

export type AdminStats = {
  totalMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  newRegistrations: number;
  activeMemberships: number;
  expiredMemberships: number;
  totalWorkouts: number;
  revenue: number;
  pendingPayments: number;
  pendingAmount: number;
  revenueByMonth: { label: string; value: number }[];
  signupsByWeek: { label: string; value: number }[];
  currency: string;
};

export type MemberRow = {
  uid: string;
  name: string;
  email: string;
  createdAt: number;
  fitnessLevel: string;
  lastActive: number | null;
  membership: { planName: string; status: string; expiresAt: number } | null;
};

export type MemberDetail = {
  profile: {
    uid: string;
    name: string;
    email: string;
    phone?: string;
    createdAt: number;
    fitnessLevel: string;
    goal?: string;
    age?: number;
    sex?: string;
    heightCm?: number;
    weightKg?: number;
    photoData?: string;
  };
  subscription: Subscription | null;
  payments: Payment[];
  workouts: { id: string; title: string; level: string; durationMin: number; calories: number; at: number }[];
  weights: { id: string; kg: number; at: number }[];
  running: { id: string; distanceKm: number; durationSec: number; paceSecPerKm: number; at: number }[];
  water: { day: string; ml: number }[];
  fasting: { id: string; label: string; startedAt: number; endedAt?: number; status: string; targetHours: number }[];
};

export const adminApi = {
  stats: () => api<AdminStats>('/admin/stats'),
  members: (search: string, filter: string) => api<{ members: MemberRow[] }>(`/admin/members?search=${encodeURIComponent(search)}&filter=${encodeURIComponent(filter)}`),
  member: (uid: string) => api<MemberDetail>(`/admin/members/${uid}`),
  setMembership: (uid: string, body: { action: 'activate' | 'deactivate'; planId?: string }) => api(`/admin/members/${uid}/membership`, { body }),
  savePlan: (plan: Partial<Plan> & { id?: string }) => (plan.id ? api(`/admin/plans/${plan.id}`, { method: 'PUT', body: plan }) : api('/admin/plans', { body: plan })),
  deletePlan: (id: string) => api(`/admin/plans/${id}`, { method: 'DELETE' }),
  announce: (title: string, body: string) => api<{ delivered: number }>('/admin/announcements', { body: { title, body } }),
  refund: (id: string) => api(`/admin/payments/${id}/refund`, { body: {} }),
};
