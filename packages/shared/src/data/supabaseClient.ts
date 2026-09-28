import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../domain/types';
import { getEnvVars } from './supabase';

/**
 * Lee y valida las credenciales de Supabase desde variables de entorno.
 * Devuelve valores ya acotados para evitar casts (`as string`) en TypeScript.
 */
function obtenerCredenciales(): {
  url: string;
  anonKey: string;
} {
  const { EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY } =
    getEnvVars();

  if (!EXPO_PUBLIC_SUPABASE_URL) {
    throw new Error(
      'Falta EXPO_PUBLIC_SUPABASE_URL. Defínela en el archivo .env de la app.',
    );
  }
  if (!EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error(
      'Falta EXPO_PUBLIC_SUPABASE_ANON_KEY. Defínela en el archivo .env de la app.',
    );
  }
  if (!/^https?:\/\//.test(EXPO_PUBLIC_SUPABASE_URL)) {
    throw new Error(
      `EXPO_PUBLIC_SUPABASE_URL no es una URL válida: "${EXPO_PUBLIC_SUPABASE_URL}".`,
    );
  }

  return { url: EXPO_PUBLIC_SUPABASE_URL, anonKey: EXPO_PUBLIC_SUPABASE_ANON_KEY };
}

const { url, anonKey } = obtenerCredenciales();

/**
 * Única instancia del cliente Supabase (Singleton).
 * Se crea una vez al cargar el módulo y se reutiliza en toda la app;
 * la sesión persiste en AsyncStorage.
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  url,
  anonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

let instancia: SupabaseClient<Database> | null = null;

/**
 * Acceso defensivo al Singleton. Devuelve siempre la misma instancia que
 * `supabase`; las funciones que reciben la dependencia como parámetro o
 * que prefieren acceso tardío pueden usarlo indistintamente.
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!instancia) instancia = supabase;
  return instancia;
}