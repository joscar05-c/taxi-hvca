import type { Session } from '@supabase/supabase-js';

import { supabase } from '../data/supabaseClient';
import type { Profile } from '../domain/types';
import { useAuthStore } from '../store/useAuthStore';

export interface UseAuthResult {
  sesion: Session | null;
  perfil: Profile | null;
  isInitialized: boolean;
  iniciarSesion: (email: string, password: string) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  cerrarSesion: () => Promise<void>;
}

/**
 * Hook de solo lectura: no mantiene estado local.
 * Todo se lee de `useAuthStore` (única fuente de la verdad); las acciones
 * disparan Supabase y el listener de `onAuthStateChange` actualiza el store.
 */
export function useAuth(): UseAuthResult {
  const sesion = useAuthStore((state) => state.session);
  const perfil = useAuthStore((state) => state.perfil);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  async function iniciarSesion(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: data.session ? undefined : 'Revisa tu correo para confirmar.' };
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return { sesion, perfil, isInitialized, iniciarSesion, cerrarSesion };
}