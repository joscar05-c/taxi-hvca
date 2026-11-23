import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from '@expo/dom-webview';
import { RecaptchaVerifier } from 'firebase/auth';

import type { Profile } from '../domain/types';
import {
  authRepository,
  normalizarTelefonoPeruE164,
} from '../data/auth.repository';
import { auth } from '../data/firebaseClient';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from './Button';

const RECAPTCHA_WEB_CONTAINER_ID = 'recaptcha-phone-web';
const DEFAULT_FIREBASE_AUTH_DOMAIN = 'taxi-hvca-app.firebaseapp.com';

const SCRIPT_POLYFILL_STORAGE = `
(function() {
  function createMemoryStorage() {
    var store = {};
    return {
      getItem: function(k) { return Object.prototype.hasOwnProperty.call(store, String(k)) ? store[String(k)] : null; },
      setItem: function(k, v) { store[String(k)] = String(v); },
      removeItem: function(k) { delete store[String(k)]; },
      clear: function() { store = {}; },
      key: function(i) { var keys = Object.keys(store); return i < keys.length ? keys[i] : null; },
      get length() { return Object.keys(store).length; }
    };
  }
  function ensureStorage(name) {
    try {
      var s = window[name];
      if (!s) throw new Error('missing');
      var k = '__taxi_hvca_test__';
      s.setItem(k, '1');
      s.removeItem(k);
    } catch (e) {
      try {
        Object.defineProperty(window, name, {
          value: createMemoryStorage(),
          configurable: true,
          writable: true
        });
      } catch (err) {}
    }
  }
  ensureStorage('localStorage');
  ensureStorage('sessionStorage');
})();
`;

function construirScriptRecaptcha(siteKey: string): string {
  const siteKeyJson = JSON.stringify(siteKey);
  return `
(function() {
  if (window.__taxiHvcaRecaptchaBooted) return;
  window.__taxiHvcaRecaptchaBooted = true;

  function post(payload) {
    try {
      if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    } catch (e) {}
  }

  try {
    document.documentElement.innerHTML = [
      '<head>',
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">',
      '<style>',
      'html, body { margin: 0; padding: 0; background: #ffffff; color: #111827; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; min-height: 100%; overflow-y: auto; }',
      '.wrap { min-height: 100vh; box-sizing: border-box; padding: 24px 8px; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 14px; }',
      '.info { font-size: 14px; color: #4B5563; text-align: center; line-height: 20px; max-width: 320px; padding: 0 8px; }',
      '#recaptcha-container { display: flex; justify-content: center; align-items: center; min-height: 82px; width: 100%; }',
      '.estado { font-size: 13px; color: #2563EB; font-weight: 600; text-align: center; padding: 0 12px; }',
      '</style>',
      '</head>',
      '<body>',
      '<div class="wrap">',
      '  <div class="info">Marca la casilla "No soy un robot" para enviarte el código SMS de 6 dígitos.</div>',
      '  <div id="recaptcha-container"></div>',
      '  <div id="recaptcha-estado" class="estado">Cargando verificación de seguridad...</div>',
      '</div>',
      '</body>'
    ].join('');

    window.__onTaxiRecaptchaLoad = function() {
      var estadoEl = document.getElementById('recaptcha-estado');
      if (estadoEl) estadoEl.textContent = '';
      try {
        window.grecaptcha.render('recaptcha-container', {
          sitekey: ${siteKeyJson},
          size: 'normal',
          theme: 'light',
          callback: function(token) {
            if (estadoEl) estadoEl.textContent = 'Verificación completada. Enviando SMS...';
            post({ type: 'verify', token: token });
          },
          'expired-callback': function() {
            if (estadoEl) estadoEl.textContent = 'La verificación expiró. Marca la casilla nuevamente.';
          },
          'error-callback': function() {
            post({ type: 'error', message: 'Error de conexión con Google reCAPTCHA. Intenta nuevamente.' });
          }
        });
      } catch (renderErr) {
        post({
          type: 'error',
          message: (renderErr && renderErr.message) ? renderErr.message : 'No se pudo inicializar reCAPTCHA.'
        });
      }
    };

    var script = document.createElement('script');
    script.src = 'https://www.google.com/recaptcha/api.js?onload=__onTaxiRecaptchaLoad&render=explicit&hl=es';
    script.async = true;
    script.defer = true;
    script.onerror = function() {
      post({ type: 'error', message: 'No se pudo cargar Google reCAPTCHA. Revisa tu conexión a internet.' });
    };
    document.head.appendChild(script);
  } catch (err) {
    post({
      type: 'error',
      message: (err && err.message) ? err.message : 'Error inesperado al preparar la verificación.'
    });
  }
})();
`;
}

export interface SeccionVerificacionTelefonoProps {
  perfil: Profile | null;
  onPerfilActualizado?: (perfil: Profile) => void;
}

export function SeccionVerificacionTelefono({
  perfil,
  onPerfilActualizado,
}: SeccionVerificacionTelefonoProps) {
  const setPerfilStore = useAuthStore((s) => s.setPerfil);

  const [modoEdicion, setModoEdicion] = useState(
    !perfil?.telefono || !perfil?.telefono_verificado,
  );
  const [paso, setPaso] = useState<'ingreso_numero' | 'ingreso_codigo'>('ingreso_numero');
  const [numeroTelefono, setNumeroTelefono] = useState(
    perfil?.telefono ? perfil.telefono.replace(/^\+51\s?/, '').replace(/\D/g, '') : '',
  );
  const [codigoOtp, setCodigoOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [telefonoPendiente, setTelefonoPendiente] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  const [mostrarModalRecaptcha, setMostrarModalRecaptcha] = useState(false);
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState<string | null>(null);
  const [telefonoParaVerificar, setTelefonoParaVerificar] = useState<string | null>(null);
  const [recaptchaReloadKey, setRecaptchaReloadKey] = useState(0);

  const recaptchaWebRef = useRef<RecaptchaVerifier | null>(null);

  const authDomain = useMemo(() => {
    return (
      auth.app.options.authDomain?.trim() ||
      process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() ||
      DEFAULT_FIREBASE_AUTH_DOMAIN
    );
  }, []);

  const recaptchaScript = useMemo(() => {
    return recaptchaSiteKey ? construirScriptRecaptcha(recaptchaSiteKey) : '';
  }, [recaptchaSiteKey]);

  // Temporizador para reenvío de código
  useEffect(() => {
    if (segundosRestantes <= 0) return;
    const interval = setInterval(() => {
      setSegundosRestantes((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [segundosRestantes]);

  // Limpiar reCAPTCHA web al desmontar
  useEffect(() => {
    return () => {
      if (recaptchaWebRef.current) {
        try {
          recaptchaWebRef.current.clear();
        } catch {
          // Ignorar si ya fue desmontado
        }
        recaptchaWebRef.current = null;
      }
    };
  }, []);

  // Si el perfil cambia externamente
  useEffect(() => {
    if (perfil?.telefono_verificado) {
      setModoEdicion(false);
    }
  }, [perfil?.telefono_verificado]);

  // Sincroniza el campo de teléfono cuando llega el perfil y no hay texto en edición activa
  useEffect(() => {
    if (perfil?.telefono) {
      const limpioPerfil = perfil.telefono
        .replace(/^\+51\s?/, '')
        .replace(/\D/g, '');
      setNumeroTelefono((actual) => (actual.trim().length === 0 ? limpioPerfil : actual));
    }
  }, [perfil?.telefono]);

  async function enviarSmsTrasRecaptcha(telefonoE164: string, recaptchaToken: string) {
    setCargando(true);
    setError(null);
    setExito(null);
    try {
      const res = await authRepository.enviarCodigoSmsConTokenRecaptcha(
        telefonoE164,
        recaptchaToken,
      );
      setVerificationId(res.verificationId);
      setTelefonoPendiente(res.telefonoE164);
      setPaso('ingreso_codigo');
      setSegundosRestantes(60);
      setExito(`Código de 6 dígitos enviado por SMS a ${res.telefonoE164}`);
      Alert.alert(
        'Código SMS Enviado',
        `Se ha enviado un código de verificación de 6 dígitos a tu celular: ${res.telefonoE164}.`,
      );
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo enviar el código de verificación.',
      );
    } finally {
      setCargando(false);
    }
  }

  function handleCerrarModalRecaptcha() {
    setMostrarModalRecaptcha(false);
    setError('Verificación cancelada antes de enviar el código SMS.');
  }

  function handleWebViewMessage(event: { nativeEvent: { data: string } }) {
    let payload: { type?: unknown; token?: unknown; message?: unknown } | null = null;
    try {
      payload = JSON.parse(event.nativeEvent.data) as {
        type?: unknown;
        token?: unknown;
        message?: unknown;
      };
    } catch {
      return;
    }

    if (!payload) return;

    if (payload.type === 'verify' && typeof payload.token === 'string' && payload.token.trim()) {
      const telefonoDestino = telefonoParaVerificar;
      setMostrarModalRecaptcha(false);
      setTelefonoParaVerificar(null);
      if (telefonoDestino) {
        void enviarSmsTrasRecaptcha(telefonoDestino, payload.token);
      }
      return;
    }

    if (payload.type === 'error') {
      setMostrarModalRecaptcha(false);
      setTelefonoParaVerificar(null);
      setError(
        typeof payload.message === 'string' && payload.message.trim()
          ? payload.message
          : 'No se pudo completar la verificación reCAPTCHA.',
      );
    }
  }

  async function handleSolicitarCodigo() {
    setError(null);
    setExito(null);

    let telefonoE164: string;
    try {
      telefonoE164 = normalizarTelefonoPeruE164(numeroTelefono);
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'Por favor ingresa un número de celular de 9 dígitos que comience con 9.',
      );
      return;
    }

    setCargando(true);
    try {
      // Si Firebase Auth ya tiene ese mismo número vinculado, sincronizar sin re-enviar SMS
      if (auth.currentUser?.phoneNumber === telefonoE164) {
        const actualizado = await authRepository.sincronizarTelefonoYaVerificadoEnAuth();
        if (actualizado) {
          setPerfilStore(actualizado);
          onPerfilActualizado?.(actualizado);
          setModoEdicion(false);
          setPaso('ingreso_numero');
          setCodigoOtp('');
          setVerificationId(null);
          setTelefonoPendiente(null);
          setExito('¡Tu número telefónico ya estaba verificado y fue sincronizado!');
          return;
        }
      }

      if (Platform.OS === 'web') {
        if (recaptchaWebRef.current) {
          try {
            recaptchaWebRef.current.clear();
          } catch {
            // Ignorar
          }
          recaptchaWebRef.current = null;
        }
        const verifier = new RecaptchaVerifier(auth, RECAPTCHA_WEB_CONTAINER_ID, {
          size: 'invisible',
        });
        recaptchaWebRef.current = verifier;
        const res = await authRepository.enviarCodigoSmsWeb(telefonoE164, verifier);
        setVerificationId(res.verificationId);
        setTelefonoPendiente(telefonoE164);
        setPaso('ingreso_codigo');
        setSegundosRestantes(60);
        setExito(`Código de 6 dígitos enviado por SMS a ${telefonoE164}`);
        Alert.alert(
          'Código SMS Enviado',
          `Se ha enviado un código de verificación de 6 dígitos a tu celular: ${telefonoE164}.`,
        );
      } else {
        const siteKey = await authRepository.obtenerRecaptchaSiteKey();
        setRecaptchaSiteKey(siteKey);
        setTelefonoParaVerificar(telefonoE164);
        setRecaptchaReloadKey((prev) => prev + 1);
        setMostrarModalRecaptcha(true);
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : 'No se pudo enviar el código de verificación.',
      );
    } finally {
      setCargando(false);
    }
  }

  async function handleConfirmarCodigo() {
    setError(null);
    setExito(null);

    const limpio = codigoOtp.trim();
    if (!/^\d{6}$/.test(limpio)) {
      setError('Ingresa el código completo de 6 dígitos.');
      return;
    }

    if (!verificationId || !telefonoPendiente) {
      setError('La sesión de verificación expiró. Solicita un nuevo código SMS.');
      setPaso('ingreso_numero');
      return;
    }

    setCargando(true);
    try {
      const perfilActualizado =
        await authRepository.confirmarCodigoTelefonoFirebase(
          verificationId,
          limpio,
          telefonoPendiente,
        );
      setPerfilStore(perfilActualizado);
      if (onPerfilActualizado) {
        onPerfilActualizado(perfilActualizado);
      }
      setModoEdicion(false);
      setPaso('ingreso_numero');
      setCodigoOtp('');
      setVerificationId(null);
      setTelefonoPendiente(null);
      setExito('¡Tu número telefónico ha sido verificado con éxito!');
      Alert.alert('Éxito', 'Número telefónico verificado y guardado correctamente.');
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : 'Código incorrecto o expirado.',
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cabecera}>
        <Text style={styles.tituloCard}>Teléfono y Seguridad</Text>
        {perfil?.telefono_verificado && !modoEdicion && (
          <View style={styles.badgeVerificado}>
            <Text style={styles.textoBadge}>VERIFICADO</Text>
          </View>
        )}
      </View>

      {/* Estado 1: Teléfono ya verificado y no está en modo edición */}
      {perfil?.telefono_verificado && !modoEdicion ? (
        <View style={styles.seccionVerificada}>
          <Text style={styles.labelCampo}>Número registrado:</Text>
          <Text style={styles.valorTelefono}>{perfil.telefono}</Text>
          <Text style={styles.subtextoVerificado}>
            Tu cuenta cuenta con autenticación y número verificado contra números falsos.
          </Text>

          <Button
            label="Cambiar número de teléfono"
            variante="secundario"
            onPress={() => {
              setModoEdicion(true);
              setPaso('ingreso_numero');
              setError(null);
              setExito(null);
            }}
            estilo={styles.botonCambiar}
          />
        </View>
      ) : (
        /* Estado 2: Modo edición o teléfono no verificado */
        <View style={styles.seccionFormulario}>
          {!perfil?.telefono_verificado && (
            <View style={styles.alertaAdvertencia}>
              <Text style={styles.textoAdvertencia}>
                ⚠️ Debes verificar tu celular con código SMS para poder solicitar o aceptar viajes con seguridad.
              </Text>
            </View>
          )}

          {exito ? <Text style={styles.mensajeExito}>{exito}</Text> : null}
          {error ? <Text style={styles.mensajeError}>{error}</Text> : null}

          {Platform.OS === 'web' ? <View nativeID={RECAPTCHA_WEB_CONTAINER_ID} /> : null}

          {paso === 'ingreso_numero' ? (
            <View>
              <Text style={styles.labelInput}>Número de celular (Perú)</Text>
              <View style={styles.inputContainer}>
                <View style={styles.prefijoPeru}>
                  <Text style={styles.textoPrefijo}>🇵🇪 +51</Text>
                </View>
                <TextInput
                  style={styles.inputTelefono}
                  placeholder="984 123 456"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  maxLength={11}
                  value={numeroTelefono}
                  onChangeText={(txt) => setNumeroTelefono(txt.replace(/\D/g, ''))}
                />
              </View>

              <Button
                label="Enviar código de verificación"
                onPress={handleSolicitarCodigo}
                cargando={cargando}
                estilo={styles.botonAccion}
              />

              {perfil?.telefono_verificado && (
                <Button
                  label="Cancelar"
                  variante="secundario"
                  onPress={() => {
                    setModoEdicion(false);
                    setError(null);
                  }}
                  estilo={styles.botonCancelar}
                />
              )}
            </View>
          ) : (
            /* Paso 2: Ingreso de Código OTP */
            <View>
              <Text style={styles.labelInput}>Ingresa el código SMS de 6 dígitos</Text>
              <TextInput
                style={styles.inputCodigoOtp}
                placeholder="000000"
                placeholderTextColor="#9CA3AF"
                keyboardType="number-pad"
                maxLength={6}
                value={codigoOtp}
                onChangeText={(txt) => setCodigoOtp(txt.replace(/\D/g, ''))}
                autoFocus
              />

              <Button
                label="Validar y Confirmar Teléfono"
                onPress={handleConfirmarCodigo}
                cargando={cargando}
                estilo={styles.botonAccion}
              />

              <View style={styles.filaAccionesSecundarias}>
                <Button
                  label={
                    segundosRestantes > 0
                      ? `Reenviar en ${segundosRestantes}s`
                      : 'Reenviar código'
                  }
                  variante="secundario"
                  deshabilitado={segundosRestantes > 0 || cargando}
                  onPress={handleSolicitarCodigo}
                  estilo={styles.botonReenviar}
                />

                <Button
                  label="Cambiar número"
                  variante="secundario"
                  onPress={() => {
                    setPaso('ingreso_numero');
                    setVerificationId(null);
                    setCodigoOtp('');
                    setError(null);
                  }}
                  estilo={styles.botonReenviar}
                />
              </View>
            </View>
          )}
        </View>
      )}

      {Platform.OS !== 'web' && (
        <Modal
          visible={mostrarModalRecaptcha}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={handleCerrarModalRecaptcha}
        >
          <View style={styles.modalContenedor}>
            <View style={styles.modalCabecera}>
              <Text style={styles.modalTitulo}>Verificación de seguridad</Text>
              <View style={styles.modalAcciones}>
                <TouchableOpacity
                  onPress={() => setRecaptchaReloadKey((prev) => prev + 1)}
                  style={styles.modalBotonSecundario}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalTextoSecundario}>Recargar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCerrarModalRecaptcha}
                  style={styles.modalBotonCerrar}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalTextoCerrar}>Cancelar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalWebViewContenedor}>
              {mostrarModalRecaptcha && recaptchaSiteKey && recaptchaScript ? (
                <WebView
                  key={`recaptcha-${recaptchaReloadKey}`}
                  source={{ uri: `https://${authDomain}/__/auth/iframe` }}
                  injectedJavaScriptBeforeContentLoaded={SCRIPT_POLYFILL_STORAGE}
                  injectedJavaScript={recaptchaScript}
                  onMessage={handleWebViewMessage}
                  onRenderProcessGone={() => {
                    setError('El visor de verificación se reinició. Intenta nuevamente.');
                    setMostrarModalRecaptcha(false);
                  }}
                  style={styles.modalWebView}
                  containerStyle={styles.modalWebView}
                />
              ) : (
                <View style={styles.modalCargando}>
                  <ActivityIndicator size="large" color="#2563EB" />
                  <Text style={styles.modalCargandoTexto}>
                    Preparando verificación...
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 10,
  },
  tituloCard: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  badgeVerificado: {
    backgroundColor: '#DEF7EC',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#31C48D',
  },
  textoBadge: {
    color: '#03543F',
    fontSize: 10,
    fontWeight: '800',
  },
  seccionVerificada: {
    paddingVertical: 4,
  },
  labelCampo: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  valorTelefono: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginTop: 2,
  },
  subtextoVerificado: {
    fontSize: 12,
    color: '#10B981',
    marginTop: 6,
    lineHeight: 16,
  },
  botonCambiar: {
    marginTop: 14,
    paddingVertical: 10,
    minHeight: 40,
  },
  seccionFormulario: {
    paddingVertical: 2,
  },
  alertaAdvertencia: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  textoAdvertencia: {
    color: '#92400E',
    fontSize: 12,
    lineHeight: 16,
  },
  mensajeExito: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  mensajeError: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  labelInput: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    overflow: 'hidden',
  },
  prefijoPeru: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    borderRightColor: '#D1D5DB',
  },
  textoPrefijo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
  inputTelefono: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  inputCodigoOtp: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    paddingVertical: 12,
    fontSize: 24,
    fontWeight: '800',
    color: '#1E40AF',
    textAlign: 'center',
    letterSpacing: 8,
  },
  botonAccion: {
    marginTop: 14,
  },
  botonCancelar: {
    marginTop: 8,
    paddingVertical: 10,
    minHeight: 40,
  },
  filaAccionesSecundarias: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  botonReenviar: {
    flex: 1,
    paddingVertical: 8,
    minHeight: 38,
  },
  modalContenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop:
      Platform.OS === 'android' ? Math.max(StatusBar.currentHeight ?? 16, 16) : 52,
  },
  modalCabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modalTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flexShrink: 1,
  },
  modalAcciones: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalBotonSecundario: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  modalTextoSecundario: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1D4ED8',
  },
  modalBotonCerrar: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  modalTextoCerrar: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B91C1C',
  },
  modalWebViewContenedor: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalWebView: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalCargando: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  modalCargandoTexto: {
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '500',
  },
});
