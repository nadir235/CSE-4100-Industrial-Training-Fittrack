import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp | undefined;
let authInstance: FirebaseAuth.Auth | undefined;
let dbInstance: Firestore | undefined;

if (isFirebaseConfigured) {
  app = getApps().length ? getApp() : initializeApp(config);
  if (Platform.OS === 'web') {
    authInstance = FirebaseAuth.getAuth(app);
  } else {
    // getReactNativePersistence is exported from the React Native build of firebase/auth.
    const rnPersistence = (FirebaseAuth as any).getReactNativePersistence;
    try {
      authInstance = FirebaseAuth.initializeAuth(app, { persistence: rnPersistence(AsyncStorage) });
    } catch {
      // already initialised (fast refresh)
      authInstance = FirebaseAuth.getAuth(app);
    }
  }
  dbInstance = getFirestore(app);
}

export const auth = authInstance as FirebaseAuth.Auth;
export const db = dbInstance as Firestore;
