import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { authRepository } from '../data/auth.repository';
import { getSupabaseClient } from '../data/supabaseClient';
import type { Profile } from '../domain/types';

export interface UseAuthResult {
  sesion: Session | null;
  perfil: Profile | null;
  cargando: boolean;
  error: string | null;
  iniciarSesion: (email: string, password: string) => Promise<boolean>;
  cerrarSesion: () => Promise<void>;
}

/** Puente entre la UI y la capa de datos para autenticación. */
export function useAuth(): UseAuthResult {
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Profile | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();

    supabase.auth
      .getSession()
      .then(({ data }) => setSesion(data.session))
      .finally(() => setCargando(false));

    const { data: suscripcion } = supabase.auth.onAuthStateChange((_evento, nuevaSesion) => {
      setSesion(nuevaSesion);
    });

    return () => suscripcion.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!sesion) {
      setPerfil(null);
      return;
    }
    authRepository
      .obtenerPerfilActual()
      .then(setPerfil)
      .catch(() => setPerfil(null));
  }, [sesion?.user.id]);

  async function iniciarSesion(email: string, password: string): Promise<boolean> {
    try {
      setError(null);
      const { data, error } = await getSupabaseClient().auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      setSesion(data.session);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      return false;
    }
  }

  async function cerrarSesion() {
    await getSupabaseClient().auth.signOut();
    setSesion(null);
    setPerfil(null);
  }

  return { sesion, perfil, cargando, error, iniciarSesion, cerrarSesion };
}