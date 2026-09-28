import { useEffect } from 'react';

import { supabase } from '../data/supabaseClient';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Inicializa la autenticación al montar la app:
 * - Recupera la sesión persistida con `getSession()`.
 * - Se suscribe a `onAuthStateChange()` para reflejar cambios en el store.
 * Colocar una sola vez en el root de la app (ej. componente superior).
 */
export function useAuthInit(): void {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    let activo = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!activo) return;
        if (error) {
          console.warn('Error al recuperar la sesión:', error.message);
          setSession(null);
          return;
        }
        setSession(data.session);
      })
      .catch((e: unknown) => {
        if (activo) {
          console.warn('No se pudo recuperar la sesión:', e);
          setSession(null);
        }
      });

    const { data: suscripcion } = supabase.auth.onAuthStateChange(
      (_evento, sesion) => {
        if (activo) setSession(sesion);
      },
    );

    return () => {
      activo = false;
      suscripcion.subscription.unsubscribe();
    };
  }, [setSession]);
}