'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PhoneAuthProvider, RecaptchaVerifier } from 'firebase/auth';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

import { auth } from '@/lib/firebase';

const REGEX_TELEFONO_E164 = /^\+519\d{8}$/;

function validarUrlRetorno(rawRedirect: string | null): string | null {
  if (!rawRedirect) return null;
  const trimmed = rawRedirect.trim();
  const esDev = process.env.NODE_ENV !== 'production';
  const permitidoPorPrefijo =
    trimmed.startsWith('app-pasajero://') ||
    trimmed.startsWith('app-conductor://') ||
    (esDev && trimmed.startsWith('exp://'));

  if (!permitidoPorPrefijo) return null;

  try {
    const parsed = new URL(trimmed);
    const protocolosPermitidos = esDev
      ? ['app-pasajero:', 'app-conductor:', 'exp:']
      : ['app-pasajero:', 'app-conductor:'];
    if (!protocolosPermitidos.includes(parsed.protocol)) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function traducirErrorFirebaseWeb(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'El número telefónico no tiene un formato internacional válido (+519XXXXXXXX).';
    case 'auth/too-many-requests':
      return 'Se realizaron demasiados intentos desde este dispositivo. Espera unos minutos.';
    case 'auth/quota-exceeded':
      return 'Se superó la cuota temporal de mensajes SMS del proyecto Firebase.';
    case 'auth/captcha-check-failed':
      return 'La validación reCAPTCHA falló o expiró. Inténtalo nuevamente.';
    case 'auth/network-request-failed':
      return 'Error de conexión al contactar con Firebase. Verifica tu internet.';
    default:
      return error instanceof Error
        ? error.message
        : 'No se pudo enviar el código de verificación por SMS.';
  }
}

function VerificarTelefonoContenido() {
  const searchParams = useSearchParams();
  const phone = useMemo(() => (searchParams.get('phone') ?? '').trim(), [searchParams]);
  const rawRedirect = searchParams.get('redirect');
  const redirectValido = useMemo(() => validarUrlRetorno(rawRedirect), [rawRedirect]);

  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const verifierRef = useRef<RecaptchaVerifier | null>(null);
  const enProcesoRef = useRef(false);

  const [estado, setEstado] = useState<'esperando_captcha' | 'enviando' | 'enviado' | 'error'>(
    'esperando_captcha',
  );
  const [error, setError] = useState<string | null>(null);
  const [returnUrl, setReturnUrl] = useState<string | null>(null);
  const [intentoId, setIntentoId] = useState(0);

  const parametrosValidos = REGEX_TELEFONO_E164.test(phone) && Boolean(redirectValido);

  const construirUrlRetorno = useCallback(
    (params: Record<string, string>) => {
      if (!redirectValido) return null;
      const target = new URL(redirectValido);
      Object.entries(params).forEach(([k, v]) => {
        target.searchParams.set(k, v);
      });
      return target.toString();
    },
    [redirectValido],
  );

  const cancelarYVolver = useCallback(() => {
    const cancelUrl = construirUrlRetorno({ error: 'cancelled' });
    if (cancelUrl) {
      window.location.replace(cancelUrl);
    }
  }, [construirUrlRetorno]);

  useEffect(() => {
    if (!parametrosValidos || !recaptchaContainerRef.current) return;

    let cancelado = false;
    enProcesoRef.current = false;
    setEstado('esperando_captcha');
    setError(null);
    setReturnUrl(null);

    const container = recaptchaContainerRef.current;
    container.innerHTML = '';

    const verifier = new RecaptchaVerifier(auth, container, {
      size: 'normal',
      callback: () => {
        if (!cancelado) {
          setEstado('enviando');
        }
      },
      'expired-callback': () => {
        if (!cancelado) {
          setError('El reCAPTCHA expiró. Por favor vuelve a completarlo.');
          setEstado('error');
        }
      },
    });
    verifierRef.current = verifier;

    async function iniciarVerificacion() {
      if (enProcesoRef.current) return;
      enProcesoRef.current = true;
      try {
        await verifier.render();
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(phone, verifier);
        if (cancelado) return;

        const targetUrl = construirUrlRetorno({
          verificationId,
          phone,
        });
        if (!targetUrl) {
          setError('URL de retorno inválida.');
          setEstado('error');
          return;
        }

        setReturnUrl(targetUrl);
        setEstado('enviado');
        window.location.replace(targetUrl);
      } catch (err) {
        if (cancelado) return;
        setError(traducirErrorFirebaseWeb(err));
        setEstado('error');
      } finally {
        enProcesoRef.current = false;
      }
    }

    void iniciarVerificacion();

    return () => {
      cancelado = true;
      if (verifierRef.current) {
        try {
          verifierRef.current.clear();
        } catch {
          // Ignorar si el widget ya fue desmontado
        }
        verifierRef.current = null;
      }
    };
  }, [parametrosValidos, phone, construirUrlRetorno, intentoId]);

  if (!parametrosValidos) {
    return (
      <div className="w-full max-w-md rounded-3xl bg-gray-900/90 border border-rose-500/30 p-7 shadow-2xl text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h1 className="text-lg font-bold text-white">Solicitud de verificación inválida</h1>
        <p className="mt-2 text-xs text-gray-400 leading-relaxed">
          {!REGEX_TELEFONO_E164.test(phone)
            ? 'El número telefónico debe estar en formato peruano E.164 (+519XXXXXXXX).'
            : 'La dirección de retorno a la aplicación móvil no está autorizada.'}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl bg-gray-900/90 border border-gray-800 p-7 shadow-2xl">
      <div className="text-center mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Smartphone className="h-6 w-6" />
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-400 border border-emerald-500/20 mb-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>VERIFICACIÓN SMS · TAXI HVCA</span>
        </div>
        <h1 className="text-xl font-bold text-white">Confirma que eres tú</h1>
        <p className="mt-1.5 text-xs text-gray-400">
          Enviaremos un código SMS de 6 dígitos al número{' '}
          <strong className="text-white">{phone}</strong>
        </p>
      </div>

      {error ? (
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {estado === 'enviado' && returnUrl ? (
        <div className="space-y-4 text-center">
          <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-300">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-emerald-400" />
            <p className="font-bold">¡Código SMS enviado!</p>
            <p className="mt-1 text-gray-300">
              Regresando automáticamente a Taxi HVCA para ingresar tu código...
            </p>
          </div>
          <a
            href={returnUrl}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-xs font-bold text-white shadow-lg"
          >
            Volver a la app ahora
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl bg-gray-950/70 border border-gray-800 p-4 flex flex-col items-center justify-center min-h-[104px]">
            <div ref={recaptchaContainerRef} />
            {estado === 'enviando' ? (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Enviando código SMS a {phone}...</span>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-2.5">
            {estado === 'error' ? (
              <button
                type="button"
                onClick={() => setIntentoId((n) => n + 1)}
                className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white transition-colors"
              >
                Reintentar verificación
              </button>
            ) : null}

            <button
              type="button"
              onClick={cancelarYVolver}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-800/70 hover:bg-gray-800 border border-gray-700 px-4 py-2.5 text-xs font-semibold text-gray-300 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Cancelar y volver a la app</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerificarTelefonoPage() {
  return (
    <main className="min-h-screen bg-[#0B0F19] text-gray-100 flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Cargando verificación...</span>
          </div>
        }
      >
        <VerificarTelefonoContenido />
      </Suspense>
    </main>
  );
}
