import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

import type { Profile } from '../domain/types';
import { authRepository } from '../data/auth.repository';
import { auth } from '../data/firebaseClient';

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
  const iosClientId = (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '').trim();

  const disponible = Platform.OS === 'web' ? true : Boolean(webClientId);

  useEffect(() => {
    if (Platform.OS !== 'web' && webClientId) {
      GoogleSignin.configure({
        webClientId,
        ...(iosClientId ? { iosClientId } : {}),
      });
    }
  }, [webClientId, iosClientId]);

  async function iniciarConGoogle() {
    setError(null);
    setCargando(true);

    try {
      if (Platform.OS === 'web') {
        const cred = await signInWithPopup(auth, new GoogleAuthProvider());
        const user = cred.user;
        const existente = await authRepository.obtenerPerfil(user.uid);
        if (!existente) {
          await authRepository.crearPerfil(user.uid, {
            nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
            telefono: user.phoneNumber || '',
            rol,
            email: user.email,
            foto_url: user.photoURL,
            telefono_verificado: !!user.phoneNumber,
          });
        }
        return;
      }

      if (!webClientId) {
        setError(
          'Google Sign-In requiere configurar EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID en el archivo .env.',
        );
        return;
      }

      GoogleSignin.configure({
        webClientId,
        ...(iosClientId ? { iosClientId } : {}),
      });

      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      }

      // Permite elegir otra cuenta después de cerrar sesión en Firebase
      try {
        if (GoogleSignin.hasPreviousSignIn()) {
          await GoogleSignin.signOut();
        }
      } catch {
        // Ignorar si no había sesión previa inicializada
      }

      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }

      const idToken = response.data.idToken || (await GoogleSignin.getTokens()).idToken;
      if (!idToken) {
        setError('No se recibió el token de identidad de Google.');
        return;
      }

      await authRepository.iniciarSesionConGoogle(idToken, rol);
    } catch (e: unknown) {
      if (isErrorWithCode(e)) {
        switch (e.code) {
          case statusCodes.SIGN_IN_CANCELLED:
            return;
          case statusCodes.IN_PROGRESS:
            setError('Ya hay un inicio de sesión con Google en curso.');
            return;
          case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
            setError(
              'Google Play Services no está disponible o necesita actualizarse en este dispositivo.',
            );
            return;
          case '10':
            setError(
              'Error de configuración OAuth en Android (verifica SHA-1 y Web Client ID en Firebase).',
            );
            return;
          default:
            setError(e.message || 'Error al iniciar sesión con Google.');
            return;
        }
      }

      setError(
        e instanceof Error ? e.message : 'Error al iniciar sesión con Google.',
      );
    } finally {
      setCargando(false);
    }
  }

  return {
    iniciarConGoogle,
    cargando,
    error,
    disponible,
  };
}
