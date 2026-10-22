import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
// @ts-expect-error Firebase JS SDK exports getReactNativePersistence in react-native entrypoint
import { getReactNativePersistence } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseEnvVars } from './firebase';

const env = getFirebaseEnvVars();

export const firebaseConfig = {
  apiKey:
    env.EXPO_PUBLIC_FIREBASE_API_KEY ||
    'AIzaSyDZ9fvora5ZPUS_zN40_1N_w_ZIY3ob6uw',
  authDomain:
    env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'taxi-hvca-app.firebaseapp.com',
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'taxi-hvca-app',
  storageBucket:
    env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'taxi-hvca-app.firebasestorage.app',
  messagingSenderId:
    env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '44228988408',
  appId:
    env.EXPO_PUBLIC_FIREBASE_APP_ID ||
    '1:44228988408:web:83938fe95496b894f5da0d',
};

export const app: FirebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  authInstance = getAuth(app);
}

export const auth: Auth = authInstance;
export const db: Firestore = getFirestore(app);
