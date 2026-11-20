import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
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
  disponible: boolean;
}

export function useGoogleLogin(rol: Profile['rol'] = 'pasajero'): UseGoogleLoginResult {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const webClientId = (process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '').trim();
  const androidClientId = (process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '').trim();
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

  const clientIdPlataforma =
    Platform.select({
      android: androidClientId,
      ios: iosClientId,
      default: webClientId,
    }) ?? '';

  const variableRequerida =
    Platform.select({
      android: 'EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID',
      ios: 'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
      default: 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    }) ?? 'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID';

  const disponible = Boolean(clientIdPlataforma);

  // Solicitar id_token para Firebase Auth; cadena vacía evita excepciones en render si falta .env
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId,
    androidClientId,
    iosClientId,
  });

  useEffect(() => {
    async function procesarRespuesta() {
      if (!disponible) {
        return;
      }

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
  }, [response, rol, disponible]);

  async function iniciarConGoogle() {
    setError(null);
    setCargando(true);

    if (!disponible) {
      setCargando(false);
      setError(
        `Google Sign-In requiere configurar ${variableRequerida} en el archivo .env.`,
      );
      return;
    }

    if (!request) {
      setCargando(false);
      setError(
        'La solicitud de autenticación de Google aún no está lista. Intenta nuevamente.',
      );
      return;
    }

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
    disponible,
  };
}
