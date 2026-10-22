import { useEffect, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

import type { Profile } from '../domain/types';
import { authRepository } from '../data/auth.repository';

// Completa la sesión si se abre en navegador web
WebBrowser.maybeCompleteAuthSession();

export interface UseGoogleLoginResult {
  iniciarConGoogle: () => Promise<void>;
  cargando: boolean;
  error: string | null;
}

export function useGoogleLogin(rol: Profile['rol'] = 'pasajero'): UseGoogleLoginResult {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Solicitar id_token para Firebase Auth
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || undefined,
  });

  useEffect(() => {
    async function procesarRespuesta() {
      if (response?.type === 'success') {
        const idToken = response.params.id_token;
        if (!idToken) {
          setError('No se recibió el token de identidad de Google.');
          setCargando(false);
          return;
        }

        try {
          await authRepository.iniciarSesionConGoogle(idToken, rol);
        } catch (e: any) {
          setError(e.message || 'Error al autenticar con Google en Firebase.');
        } finally {
          setCargando(false);
        }
      } else if (response?.type === 'error') {
        setError(response.error?.message || 'Error en la autenticación con Google.');
        setCargando(false);
      } else if (response?.type === 'dismiss' || response?.type === 'cancel') {
        setCargando(false);
      }
    }

    if (response) {
      void procesarRespuesta();
    }
  }, [response, rol]);

  async function iniciarConGoogle() {
    setError(null);
    setCargando(true);
    try {
      const res = await promptAsync();
      if (res.type !== 'success') {
        setCargando(false);
      }
    } catch (e: any) {
      setCargando(false);
      setError(
        e.message || 'No se pudo abrir la ventana de inicio de sesión de Google.',
      );
    }
  }

  return {
    iniciarConGoogle,
    cargando,
    error,
  };
}
