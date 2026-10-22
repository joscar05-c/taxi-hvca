import { useState, useEffect } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { Profile } from '../domain/types';
import { authRepository } from '../data/auth.repository';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from './Button';
import { colores } from './theme';

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
    perfil?.telefono ? perfil.telefono.replace(/^\+51\s?/, '') : '',
  );
  const [codigoOtp, setCodigoOtp] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [codigoDev, setCodigoDev] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  // Temporizador para reenvío de código
  useEffect(() => {
    if (segundosRestantes <= 0) return;
    const interval = setInterval(() => {
      setSegundosRestantes((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [segundosRestantes]);

  // Si el perfil cambia externamente
  useEffect(() => {
    if (perfil?.telefono_verificado) {
      setModoEdicion(false);
    }
  }, [perfil?.telefono_verificado]);

  async function handleSolicitarCodigo() {
    setError(null);
    setExito(null);
    setCodigoDev(null);

    const limpio = numeroTelefono.trim().replace(/[\s\-()]+/g, '');
    if (!/^9\d{8}$/.test(limpio)) {
      setError('Por favor ingresa un número de celular de 9 dígitos que comience con 9.');
      return;
    }

    setCargando(true);
    try {
      const res = await authRepository.solicitarCodigoVerificacionTelefono(limpio);
      setPaso('ingreso_codigo');
      setSegundosRestantes(60);
      setCodigoDev(res.codigoSimuladoParaDev);
      setExito(`Código de 6 dígitos enviado por SMS a +51 ${limpio}`);

      // Alerta informativa para facilitar la prueba inmediata
      Alert.alert(
        'Código SMS Enviado',
        `Se ha enviado un código de verificación a tu celular: +51 ${limpio}\n\nCódigo de prueba: ${res.codigoSimuladoParaDev}`,
      );
    } catch (e: any) {
      setError(e.message || 'No se pudo enviar el código de verificación.');
    } finally {
      setCargando(false);
    }
  }

  async function handleConfirmarCodigo() {
    setError(null);
    setExito(null);

    const limpio = codigoOtp.trim();
    if (limpio.length !== 6) {
      setError('Ingresa el código completo de 6 dígitos.');
      return;
    }

    setCargando(true);
    try {
      const perfilActualizado = await authRepository.confirmarCodigoTelefono(limpio);
      setPerfilStore(perfilActualizado);
      if (onPerfilActualizado) {
        onPerfilActualizado(perfilActualizado);
      }
      setModoEdicion(false);
      setPaso('ingreso_numero');
      setCodigoOtp('');
      setCodigoDev(null);
      setExito('¡Tu número telefónico ha sido verificado con éxito!');
      Alert.alert('Éxito', 'Número telefónico verificado y guardado correctamente.');
    } catch (e: any) {
      setError(e.message || 'Código incorrecto o expirado.');
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
                onChangeText={setCodigoOtp}
                autoFocus
              />

              {codigoDev ? (
                <View style={styles.cajaCodigoDev}>
                  <Text style={styles.textoCodigoDev}>
                    🔑 Código de prueba generado: <Text style={styles.codigoDevNegrita}>{codigoDev}</Text>
                  </Text>
                </View>
              ) : null}

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
                  onPress={() => setPaso('ingreso_numero')}
                  estilo={styles.botonReenviar}
                />
              </View>
            </View>
          )}
        </View>
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
  cajaCodigoDev: {
    marginTop: 8,
    backgroundColor: '#FEF3C7',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  textoCodigoDev: {
    fontSize: 11,
    color: '#92400E',
    textAlign: 'center',
  },
  codigoDevNegrita: {
    fontWeight: '800',
    fontSize: 13,
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
});
