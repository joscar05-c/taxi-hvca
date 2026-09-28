import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../domain/types';

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

let client: SupabaseClient<Database> | null = null;

/**
 * Devuelve la instancia única del cliente de Supabase.
 * Los repositorios siempre acceden a Supabase a través de este cliente;
 * ningún componente de UI lo importa de forma directa.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (client) return client;

  const { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } =
    getEnvVars();

  if (!EXPO_PUBLIC_SUPABASE_URL || !EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Faltan EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY en el entorno.',
    );
  }

  client = createClient<Database>(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  return client;
}