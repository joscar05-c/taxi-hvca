import { useEffect } from 'react';

import { authRepository } from '../data/auth.repository';
import { supabase } from '../data/supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Inicializa la autenticación al montar la app y la mantiene sincronizada.
 * Sin estado local: todo se escribe directamente en `useAuthStore` (SSOT).
 * - Recupera la sesión persistida con `getSession()` y el perfil asociado.
 * - Se suscribe a `onAuthStateChange()` para reflejar cada cambio en el store.
 * Colocar una sola vez en el root de la app (ej. componente superior).
 */
export function useAuthInit(): void {
  const setSession = useAuthStore((state) => state.setSession);
  const setPerfil = useAuthStore((state) => state.setPerfil);

  useEffect(() => {
    let activo = true;

    async function sincronizarSesion(sesion: Session | null) {
      if (!activo) return;
      setSession(sesion);

      if (!sesion) {
        setPerfil(null);
        return;
      }

      try {
        const perfil = await authRepository.obtenerPerfilActual();
        if (activo) setPerfil(perfil);
      } catch (e) {
        if (activo) {
          console.warn('No se pudo cargar el perfil:', e);
          setPerfil(null);
        }
      }
    }

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.warn('Error al recuperar la sesión:', error.message);
          void sincronizarSesion(null);
          return;
        }
        void sincronizarSesion(data.session);
      })
      .catch((e: unknown) => {
        if (activo) {
          console.warn('No se pudo recuperar la sesión:', e);
          void sincronizarSesion(null);
        }
      });

    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      async (_evento, sesion) => {
        await sincronizarSesion(sesion);
      },
    );

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, [setSession, setPerfil]);
}