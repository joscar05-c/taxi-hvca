export interface EnvVars {
  EXPO_PUBLIC_SUPABASE_URL?: string;
  EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
}

/**
 * Acceso seguro a variables de entorno sin depender de la declaración de
 * tipos de `process` (Metro inyecta las variables EXPO_PUBLIC_* en runtime).
 */
export function getEnvVars(): EnvVars {
  return (globalThis as { process?: { env?: EnvVars } }).process?.env ?? {};
}