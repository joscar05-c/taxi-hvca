import { useEffect } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';

import { authRepository } from '../data/auth.repository';
import { auth } from '../data/firebaseClient';
import type { Profile } from '../domain/types';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Inicializa la autenticación al montar la app y la mantiene sincronizada con Firebase Auth.
 * Sin estado local: todo se escribe directamente en `useAuthStore` (SSOT).
 * - Se suscribe a `onAuthStateChanged()` para reflejar cada cambio en el store.
 * - Se suscribe en tiempo real al perfil del usuario en Firestore (`perfiles/{uid}`).
 * - Si se especifica `rolRequerido` y el perfil pertenece a otro rol, cierra sesión
 *   y publica el mensaje de error en `useAuthStore.authError`.
 * Colocar una sola vez en el root de la app (ej. `_layout.tsx`).
 */
export function useAuthInit(rolRequerido?: Profile['rol']): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setPerfil = useAuthStore((state) => state.setPerfil);
  const setAuthError = useAuthStore((state) => state.setAuthError);

  useEffect(() => {
    let activo = true;
    let unsubscribePerfil: (() => void) | null = null;

    function limpiarSuscripcionPerfil() {
      if (unsubscribePerfil) {
        unsubscribePerfil();
        unsubscribePerfil = null;
      }
    }

    const unsubscribeAuth = onAuthStateChanged(
      auth,
      (firebaseUser: FirebaseUser | null) => {
        if (!activo) return;
        limpiarSuscripcionPerfil();
        setSession(firebaseUser);

        if (!firebaseUser) {
          setPerfil(null);
          return;
        }

        unsubscribePerfil = authRepository.suscribirPerfil(
          firebaseUser.uid,
          (perfil) => {
            if (!activo) return;
            if (perfil && rolRequerido && perfil.rol !== rolRequerido) {
              const appDestino =
                perfil.rol === 'conductor' ? 'Conductor' : 'Pasajero';
              setAuthError(
                `Esta cuenta está registrada como ${perfil.rol}. Usa la app de ${appDestino}.`,
              );
              setPerfil(null);
              void authRepository.cerrarSesion();
              return;
            }
            if (perfil) {
              setAuthError(null);
            }
            setPerfil(perfil);
          },
          (e) => {
            if (activo) {
              console.warn('No se pudo cargar el perfil de Firestore:', e);
              setPerfil(null);
            }
          },
        );
      },
    );

    return () => {
      activo = false;
      limpiarSuscripcionPerfil();
      unsubscribeAuth();
    };
  }, [rolRequerido, setSession, setPerfil, setAuthError]);
}