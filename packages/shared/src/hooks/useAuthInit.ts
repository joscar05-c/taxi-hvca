import { useEffect } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';

import { authRepository } from '../data/auth.repository';
import { auth } from '../data/firebaseClient';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Inicializa la autenticación al montar la app y la mantiene sincronizada con Firebase Auth.
 * Sin estado local: todo se escribe directamente en `useAuthStore` (SSOT).
 * - Se suscribe a `onAuthStateChanged()` para reflejar cada cambio en el store.
 * - Recupera el perfil del usuario desde Firestore (`perfiles/{uid}`).
 * Colocar una sola vez en el root de la app (ej. `_layout.tsx`).
 */
export function useAuthInit(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setPerfil = useAuthStore((state) => state.setPerfil);

  useEffect(() => {
    let activo = true;

    async function sincronizarUsuario(firebaseUser: FirebaseUser | null) {
      if (!activo) return;
      setSession(firebaseUser);

      if (!firebaseUser) {
        setPerfil(null);
        return;
      }

      try {
        const perfil = await authRepository.obtenerPerfil(firebaseUser.uid);
        if (activo) setPerfil(perfil);
      } catch (e) {
        if (activo) {
          console.warn('No se pudo cargar el perfil de Firestore:', e);
          setPerfil(null);
        }
      }
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void sincronizarUsuario(firebaseUser);
    });

    return () => {
      activo = false;
      unsubscribe();
    };
  }, [setSession, setPerfil]);
}