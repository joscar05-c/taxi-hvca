import {
  getAuth as getNativeAuth,
  PhoneAuthState,
  verifyPhoneNumber as nativeVerifyPhoneNumber,
} from '@react-native-firebase/auth';

export interface ResultadoEnvioSmsNativo {
  verificationId: string;
  codigoAutoVerificado: string | null;
}

/**
 * Inicia la verificación telefónica nativa de Firebase (Google Play Services /
 * Play Integrity en Android; APNs silencioso en iOS) sin abrir navegador ni
 * depender de reCAPTCHA web manual.
 */
export function iniciarVerificacionTelefonoNativa(
  telefonoE164: string,
  forzarReenvio = false,
): Promise<ResultadoEnvioSmsNativo> {
  return new Promise((resolve, reject) => {
    let finalizado = false;

    const listener = nativeVerifyPhoneNumber(
      getNativeAuth(),
      telefonoE164,
      60,
      forzarReenvio,
    );

    listener.on(
      'state_changed',
      (snapshot) => {
        if (finalizado) return;

        if (
          snapshot.state === PhoneAuthState.CODE_SENT ||
          snapshot.state === PhoneAuthState.AUTO_VERIFY_TIMEOUT
        ) {
          if (snapshot.verificationId) {
            finalizado = true;
            resolve({
              verificationId: snapshot.verificationId,
              codigoAutoVerificado: null,
            });
          }
          return;
        }

        if (snapshot.state === PhoneAuthState.AUTO_VERIFIED) {
          finalizado = true;
          resolve({
            verificationId: snapshot.verificationId,
            codigoAutoVerificado: snapshot.code ?? null,
          });
          return;
        }

        if (snapshot.state === PhoneAuthState.ERROR) {
          finalizado = true;
          reject(
            snapshot.error ??
              new Error('No se pudo iniciar la verificación telefónica nativa.'),
          );
        }
      },
      (error) => {
        if (finalizado) return;
        finalizado = true;
        reject(error);
      },
    );
  });
}
