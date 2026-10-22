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
  apiKey: env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
};

if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    'Configuración de Firebase incompleta: verifica las variables EXPO_PUBLIC_FIREBASE_* en tu archivo .env',
  );
}

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
