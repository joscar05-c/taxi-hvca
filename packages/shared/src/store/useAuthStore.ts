import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

import type { Profile } from '../domain/types';

export interface AuthState {
  /** Usuario autenticado (o null si no hay sesión). */
  user: User | null;
  /** Sesión actual de Supabase (o null si no hay sesión). */
  session: Session | null;
  /** Perfil del usuario en la tabla `profiles` (o null si no hay sesión). */
  perfil: Profile | null;
  /** true una vez que verificamos la sesión al abrir la app. */
  isInitialized: boolean;
  /** Actualiza la sesión cuando el listener de Supabase detecta un cambio. */
  setSession: (session: Session | null) => void;
  /** Actualiza el perfil cargado desde la capa de datos. */
  setPerfil: (perfil: Profile | null) => void;
}

/**
 * Única fuente de la verdad (single source of truth) de la autenticación.
 * El listener de `supabase.auth.onAuthStateChange()` alimenta este store
 * vía `setSession`; los componentes se suscriben con `useAuthStore()`.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  perfil: null,
  isInitialized: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isInitialized: true,
    }),
  setPerfil: (perfil) => set({ perfil }),
}));