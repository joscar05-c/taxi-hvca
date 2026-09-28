import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';

export interface AuthState {
  /** Usuario autenticado (o null si no hay sesión). */
  user: User | null;
  /** Sesión actual de Supabase (o null si no hay sesión). */
  session: Session | null;
  /** true una vez que verificamos la sesión al abrir la app. */
  isInitialized: boolean;
  /** Actualiza el estado cuando el listener de Supabase detecta un cambio. */
  setSession: (session: Session | null) => void;
}

/**
 * Estado global de autenticación.
 * El listener de `supabase.auth.onAuthStateChange()` alimenta este store
 * vía `setSession`; los componentes se suscriben con `useAuthStore()`.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  isInitialized: false,
  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isInitialized: true,
    }),
}));