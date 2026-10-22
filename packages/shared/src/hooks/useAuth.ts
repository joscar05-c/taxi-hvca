import { signInWithEmailAndPassword, signOut } from 'firebase/auth';

import { auth } from '../data/firebaseClient';
import type { Profile } from '../domain/types';
import { useAuthStore, type SessionCompat } from '../store/useAuthStore';

export interface UseAuthResult {
  sesion: SessionCompat | null;
  perfil: Profile | null;
  isInitialized: boolean;
  iniciarSesion: (email: string, password: string) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  cerrarSesion: () => Promise<void>;
}

/**
 * Hook de autenticación: sin estado local.
 * Todo se lee de `useAuthStore` (única fuente de la verdad); las acciones
 * disparan Firebase Auth y el listener de `onAuthStateChanged` actualiza el store.
 */
export function useAuth(): UseAuthResult {
  const sesion = useAuthStore((state) => state.session);
  const perfil = useAuthStore((state) => state.perfil);
  const isInitialized = useAuthStore((state) => state.isInitialized);

  async function iniciarSesion(email: string, password: string) {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : 'No se pudo iniciar sesión.',
      };
    }
  }

  async function cerrarSesion() {
    await signOut(auth);
  }

  return { sesion, perfil, isInitialized, iniciarSesion, cerrarSesion };
}