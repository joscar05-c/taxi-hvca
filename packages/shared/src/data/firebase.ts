export interface FirebaseEnvVars {
  EXPO_PUBLIC_FIREBASE_API_KEY?: string;
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
  EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
  EXPO_PUBLIC_FIREBASE_APP_ID?: string;
}

/**
 * Acceso seguro a variables de entorno de Firebase sin depender de la
 * declaración de tipos de `process` (Metro inyecta EXPO_PUBLIC_* en runtime).
 */
export function getFirebaseEnvVars(): FirebaseEnvVars {
  return (
    (globalThis as { process?: { env?: FirebaseEnvVars } }).process?.env ?? {}
  );
}
