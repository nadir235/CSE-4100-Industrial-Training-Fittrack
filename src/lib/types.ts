export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced';
export type Sex = 'male' | 'female';

export type UserProfile = {
  name: string;
  email: string;
  role?: 'member';
  createdAt: number;
  fitnessLevel: FitnessLevel;
  goal?: string;
  sex?: Sex;
  age?: number;
  heightCm?: number;
  weightKg?: number;
  phone?: string;
  photoData?: string; // small base64 data URL (no Firebase Storage needed)
  waterGoalMl: number;
  waterReminders?: { enabled: boolean; everyMinutes: number };
  workoutReminder?: { enabled: boolean; hour: number; minute: number };
  favoriteExercises?: string[];
  availableMinutes?: number;
  active?: boolean;
};

export type WorkoutLog = {
  id: string;
  title: string;
  level: FitnessLevel | 'custom';
  durationMin: number;
  calories: number;
  exerciseCount: number;
  at: number;
};

export type CustomExercise = { exerciseId: string; sets: number; reps: number; restSec: number };
export type CustomWorkout = {
  id: string;
  name: string;
  level: FitnessLevel;
  exercises: CustomExercise[];
  days?: string[];
  createdAt: number;
};

export type WeightEntry = { id: string; kg: number; at: number };
export type CalcEntry = { id: string; type: string; summary: string; value: number; inputs: Record<string, string>; at: number };
export type WaterEntry = { id: string; ml: number; at: number; day: string };

export type FastingSession = {
  id: string;
  label: string;
  targetHours: number;
  startedAt: number;
  endedAt?: number;
  pausedAt?: number | null;
  pausedMs: number;
  status: 'active' | 'paused' | 'completed' | 'ended-early';
};

export type RunSession = {
  id: string;
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
  calories: number;
  at: number;
  source: 'gps' | 'manual';
  route?: { lat: number; lng: number }[];
  note?: string;
};

export type FaceRoutine = { id: string; name: string; exerciseIds: string[]; createdAt: number };
export type FaceLog = { id: string; exerciseId: string; at: number; day: string };

export type AiMessage = { id: string; role: 'user' | 'assistant'; text: string; at: number; provider?: string };

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: string;
  at: number;
  read: boolean;
};

export type Plan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  description: string;
  features: string[];
  active: boolean;
};

export type Subscription = {
  id: string;
  planId: string;
  planName: string;
  status: 'active' | 'expired' | 'inactive';
  startsAt: number;
  expiresAt: number;
};

export type PaymentStatus = 'pending' | 'successful' | 'failed' | 'refunded';
export type Payment = {
  id: string;
  uid: string;
  memberName?: string;
  planId: string;
  planName: string;
  amount: number;
  currency: string;
  method: string;
  gateway: string;
  status: PaymentStatus;
  txnId: string;
  createdAt: number;
  verifiedAt?: number;
};

export type Announcement = { id: string; title: string; body: string; at: number; by?: string };
