export interface ResultadoEnvioSmsNativo {
  verificationId: string;
  codigoAutoVerificado: string | null;
}

/**
 * Respaldo web para que `@react-native-firebase/auth` nunca entre al bundle web.
 * En navegador la verificación telefónica usa `RecaptchaVerifier` vía `enviarCodigoSmsWeb`.
 */
export async function iniciarVerificacionTelefonoNativa(
  _telefonoE164: string,
  _forzarReenvio = false,
): Promise<ResultadoEnvioSmsNativo> {
  throw new Error(
    'La verificación telefónica nativa solo está disponible en dispositivos Android e iOS.',
  );
}
