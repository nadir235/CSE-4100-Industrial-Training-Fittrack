import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from './firebase';
import type { UserProfile } from './types';

export type Role = 'member' | 'admin' | null;

type AuthCtx = {
  user: User | null;
  role: Role;
  profile: UserProfile | null;
  loading: boolean;
  emailVerified: boolean;
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string, as: 'member' | 'admin') => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerification: () => Promise<void>;
  refreshVerification: () => Promise<boolean>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function friendlyAuthError(e: any): string {
  const code: string = e?.code || '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists.';
    case 'auth/weak-password':
      return 'Password is too weak. Use at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact the gym.';
    default:
      return e?.message || 'Something went wrong. Please try again.';
  }
}

async function readRole(user: User, force = false): Promise<Role> {
  const res = await user.getIdTokenResult(force);
  return res.claims.admin === true ? 'admin' : 'member';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [verified, setVerified] = useState(false);
  const gate = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return onAuthStateChanged(auth, async (u) => {
      if (gate.current) return; // login()/register() will apply state itself
      if (!u) {
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        const r = await readRole(u);
        setUser(u);
        setVerified(u.emailVerified);
        setRole(r);
      } catch {
        setUser(u);
        setRole('member');
      }
      setLoading(false);
    });
  }, []);

  // Member profile listener
  useEffect(() => {
    if (!user || role !== 'member') {
      setProfile(null);
      return;
    }
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => setProfile(snap.exists() ? (snap.data() as UserProfile) : null),
      () => setProfile(null),
    );
  }, [user, role]);

  const register = useCallback(async (name: string, email: string, password: string) => {
    gate.current = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      const profileDoc: UserProfile = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: 'member',
        createdAt: Date.now(),
        fitnessLevel: 'beginner',
        waterGoalMl: 2500,
        favoriteExercises: [],
        active: true,
      };
      await setDoc(doc(db, 'users', cred.user.uid), profileDoc);
      try {
        await sendEmailVerification(cred.user);
      } catch {
        /* non-fatal; user can resend from the dashboard */
      }
      setUser(cred.user);
      setVerified(cred.user.emailVerified);
      setRole('member');
      setLoading(false);
    } finally {
      gate.current = false;
    }
  }, []);

  const login = useCallback(async (email: string, password: string, as: 'member' | 'admin') => {
    gate.current = true;
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const r = await readRole(cred.user, true); // force-refresh so new admin claims apply immediately
      if (as === 'admin' && r !== 'admin') {
        await signOut(auth);
        throw new Error('This account does not have administrator access.');
      }
      if (as === 'member' && r === 'admin') {
        await signOut(auth);
        throw new Error('Administrator accounts must use "Login as Admin".');
      }
      setUser(cred.user);
      setVerified(cred.user.emailVerified);
      setRole(r);
      setLoading(false);
    } finally {
      gate.current = false;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerification = useCallback(async () => {
    if (auth.currentUser) await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshVerification = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const v = auth.currentUser.emailVerified;
    setVerified(v);
    return v;
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      user,
      role,
      profile,
      loading,
      emailVerified: verified,
      register,
      login,
      logout,
      resetPassword,
      resendVerification,
      refreshVerification,
    }),
    [user, role, profile, loading, verified, register, login, logout, resetPassword, resendVerification, refreshVerification],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
