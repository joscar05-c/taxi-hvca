import { create } from 'zustand';
import type { User as FirebaseUser } from 'firebase/auth';

import type { Profile } from '../domain/types';

export interface SessionCompat {
  user: {
    id: string;
    uid: string;
    email: string | null;
    phoneNumber?: string | null;
  };
}

export interface AuthState {
  /** Usuario nativo autenticado en Firebase (o null si no hay sesión). */
  user: FirebaseUser | null;
  /** Objeto de sesión compatible para pantallas existentes (o null si no hay sesión). */
  session: SessionCompat | null;
  /** Perfil del usuario en Firestore `perfiles` (o null si no hay sesión). */
  perfil: Profile | null;
  /** true una vez que verificamos el estado de autenticación al abrir la app. */
  isInitialized: boolean;
  /** Actualiza el usuario/sesión cuando el listener de Firebase Auth detecta un cambio. */
  setSession: (user: FirebaseUser | null) => void;
  /** Actualiza el perfil cargado desde la capa de datos. */
  setPerfil: (perfil: Profile | null) => void;
}

/**
 * Única fuente de la verdad (single source of truth) de la autenticación.
 * El listener `onAuthStateChanged` de Firebase Auth alimenta este store
 * vía `setSession`; los componentes se suscriben con `useAuthStore()`.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  session: null,
  perfil: null,
  isInitialized: false,
  setSession: (user) =>
    set({
      user,
      session: user
        ? {
            user: {
              id: user.uid,
              uid: user.uid,
              email: user.email,
              phoneNumber: user.phoneNumber,
            },
          }
        : null,
      isInitialized: true,
    }),
  setPerfil: (perfil) => set({ perfil }),
}));