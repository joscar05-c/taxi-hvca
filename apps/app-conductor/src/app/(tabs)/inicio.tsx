import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import {
  Button,
  Input,
  authRepository,
  calcularDistanciaHaversine,
  colores,
  extraerCoordenadasPerfil,
  formatearReferenciaHuancavelica,
  HUANCAVELICA_CENTRO,
  PUNTOS_SIMULACION_HVCA,
  useAuth,
  useBackgroundLocation,
  useForegroundLocation,
  viajesRepository,
  type Coordenadas,
  type Profile,
  type PuntoSimulacionHvca,
  type SolicitudViaje,
} from '@hvca/shared';

import { BACKGROUND_LOCATION_TASK } from '../../locationTask';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DISTANCIA_MAX_KM = 3;

type SolicitudCercana = {
  solicitud: SolicitudViaje;
  distanciaKm: number;
};

function etiquetaEstadoViaje(estado: SolicitudViaje['estado']): string {
  switch (estado) {
    case 'aceptado':
      return 'En camino al pasajero';
    case 'en_camino_origen':
      return 'Esperando al pasajero en el origen';
    case 'en_curso':
      return 'Viaje en curso hacia el destino';
    case 'completado':
      return 'Viaje finalizado';
    case 'cancelada':
      return 'Viaje cancelado';
    default:
      return estado;
  }
}

function normalizarTelefonoWhatsApp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length === 9 && digitos.startsWith('9')) {
    return `51${digitos}`;
  }
  return digitos;
}

export default function PantallaInicio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, sesion, cerrarSesion } = useAuth();
  const { isTracking, loading, error: errorTracking, startTracking, stopTracking } =
    useBackgroundLocation(BACKGROUND_LOCATION_TASK);
  const { coords, requestPermissionAndLocate } = useForegroundLocation();

  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solicitudesCercanas, setSolicitudesCercanas] = useState<
    SolicitudCercana[]
  >([]);
  const [ofertasEnviadas, setOfertasEnviadas] = useState<Set<string>>(
    new Set(),
  );
  const [viajeActivo, setViajeActivo] = useState<SolicitudViaje | null>(null);
  const [perfilPasajero, setPerfilPasajero] = useState<Profile | null>(null);
  const [viajeParaCalificar, setViajeParaCalificar] =
    useState<SolicitudViaje | null>(null);
  const [estrellasPasajero, setEstrellasPasajero] = useState<number>(5);

  const [contraofertaId, setContraofertaId] = useState<string | null>(null);
  const [precioContraoferta, setPrecioContraoferta] = useState('');
  const [vehiculo, setVehiculo] = useState('');

  const idConductor = sesion?.user?.id;

  useEffect(() => {
    if (perfil?.vehiculo) setVehiculo(perfil.vehiculo);
  }, [perfil?.vehiculo]);

  // Recuperar automáticamente el viaje activo asignado al conductor al abrir la app
  useEffect(() => {
    if (!idConductor) return;
    let activo = true;
    void viajesRepository
      .obtenerViajeActivoConductor(idConductor)
      .then((activa) => {
        if (activo && activa) {
          setViajeActivo(activa);
        }
      })
      .catch((e) => {
        console.warn('[inicio] Error al recuperar viaje activo:', e);
      });
    return () => {
      activo = false;
    };
  }, [idConductor]);

  // Suscripción en tiempo real al perfil del pasajero del viaje activo
  const idPasajeroActivo = viajeActivo?.pasajero_id;
  useEffect(() => {
    if (!idPasajeroActivo) {
      setPerfilPasajero(null);
      return;
    }
    return authRepository.suscribirPerfil(idPasajeroActivo, setPerfilPasajero);
  }, [idPasajeroActivo]);

  // Modo simulación Huancavelica para desarrollo y emuladores
  const [simularHuancavelica, setSimularHuancavelica] = useState(false);
  const [puntoSimulado, setPuntoSimulado] = useState<PuntoSimulacionHvca>(
    PUNTOS_SIMULACION_HVCA[0],
  );

  const esEmuladorFueraDeHvca = useMemo(() => {
    if (!coords) return false;
    const d = calcularDistanciaHaversine(
      coords.latitude,
      coords.longitude,
      HUANCAVELICA_CENTRO.latitude,
      HUANCAVELICA_CENTRO.longitude,
    );
    return d > 100;
  }, [coords]);

  useEffect(() => {
    if (esEmuladorFueraDeHvca) {
      setSimularHuancavelica(true);
    }
  }, [esEmuladorFueraDeHvca]);

  const ubicacionConductor = useMemo<Coordenadas | null>(() => {
    if (simularHuancavelica) {
      return { latitude: puntoSimulado.latitude, longitude: puntoSimulado.longitude };
    }
    if (coords) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    return extraerCoordenadasPerfil(perfil);
  }, [simularHuancavelica, puntoSimulado, coords, perfil]);

  // En modo simulación conectado, persistimos el punto simulado para que el pasajero lo vea en vivo
  useEffect(() => {
    if (!idConductor || !simularHuancavelica || (!isTracking && !viajeActivo)) {
      return;
    }
    void authRepository
      .actualizarUbicacion(puntoSimulado.latitude, puntoSimulado.longitude)
      .catch(() => undefined);
  }, [idConductor, simularHuancavelica, puntoSimulado, isTracking, viajeActivo]);

  const solicitudesPendientesRef = useRef<Map<string, SolicitudViaje>>(new Map());
  const ubicacionRef = useRef(ubicacionConductor);

  const recalcularCercanas = useCallback((pos: Coordenadas | null) => {
    if (!pos) return;
    const filtradas: SolicitudCercana[] = [];
    solicitudesPendientesRef.current.forEach((solicitud) => {
      const distanciaKm = calcularDistanciaHaversine(
        solicitud.origen_lat,
        solicitud.origen_lng,
        pos.latitude,
        pos.longitude,
      );
      if (distanciaKm < DISTANCIA_MAX_KM) {
        filtradas.push({ solicitud, distanciaKm });
      }
    });
    setSolicitudesCercanas(filtradas);
  }, []);

  useEffect(() => {
    ubicacionRef.current = ubicacionConductor;
    recalcularCercanas(ubicacionConductor);
  }, [ubicacionConductor, recalcularCercanas]);

  useEffect(() => {
    if (isTracking) {
      void requestPermissionAndLocate();
    }
  }, [isTracking, requestPermissionAndLocate]);

  const manejarNuevaSolicitud = useCallback((solicitud: SolicitudViaje) => {
    solicitudesPendientesRef.current.set(solicitud.id, solicitud);
    const pos = ubicacionRef.current;
    if (!pos) return;

    const distanciaKm = calcularDistanciaHaversine(
      solicitud.origen_lat,
      solicitud.origen_lng,
      pos.latitude,
      pos.longitude,
    );
    if (distanciaKm >= DISTANCIA_MAX_KM) return;

    setSolicitudesCercanas((prev) => {
      const sinEsta = prev.filter((s) => s.solicitud.id !== solicitud.id);
      return [...sinEsta, { solicitud, distanciaKm }];
    });
  }, []);

  const manejarSolicitudEliminada = useCallback((solicitudId: string) => {
    solicitudesPendientesRef.current.delete(solicitudId);
    setSolicitudesCercanas((prev) =>
      prev.filter((s) => s.solicitud.id !== solicitudId),
    );
  }, []);

  useEffect(() => {
    if (!isTracking) return;
    return viajesRepository.suscribirNuevasSolicitudes(
      manejarNuevaSolicitud,
      manejarSolicitudEliminada,
    );
  }, [isTracking, manejarNuevaSolicitud, manejarSolicitudEliminada]);

  // Por cada solicitud con oferta enviada, escuchamos si el pasajero la acepta o cancela.
  useEffect(() => {
    const limpiadores: Array<() => void> = [];
    ofertasEnviadas.forEach((solicitudId) => {
      limpiadores.push(
        viajesRepository.suscribirCambiosSolicitud(
          solicitudId,
          (solicitud) => {
            if (solicitud.estado === 'aceptado') {
              if (solicitud.conductor_id === idConductor) {
                setViajeActivo(solicitud);
              } else {
                setOfertasEnviadas((prev) => {
                  const nuevo = new Set(prev);
                  nuevo.delete(solicitudId);
                  return nuevo;
                });
                setSolicitudesCercanas((prev) =>
                  prev.filter((s) => s.solicitud.id !== solicitudId),
                );
              }
            } else if (solicitud.estado === 'cancelada') {
              setOfertasEnviadas((prev) => {
                const nuevo = new Set(prev);
                nuevo.delete(solicitudId);
                return nuevo;
              });
              setSolicitudesCercanas((prev) =>
                prev.filter((s) => s.solicitud.id !== solicitudId),
              );
              setViajeActivo((actual) => {
                if (actual?.id === solicitudId) {
                  Alert.alert(
                    'Viaje cancelado',
                    'El pasajero ha cancelado la solicitud de viaje.',
                  );
                  return null;
                }
                return actual;
              });
            }
          },
          (err) => {
            console.warn('[inicio] Error en suscripción solicitud:', err);
          },
        ),
      );
    });
    return () => {
      limpiadores.forEach((limpiar) => limpiar());
    };
  }, [ofertasEnviadas, idConductor]);

  // Escuchar reactivamente cambios en el viaje activo
  useEffect(() => {
    if (!viajeActivo?.id) return;
    const unsub = viajesRepository.suscribirCambiosSolicitud(
      viajeActivo.id,
      (solicitudActualizada) => {
        if (solicitudActualizada.estado === 'cancelada') {
          Alert.alert(
            'Viaje cancelado',
            'El pasajero ha cancelado el viaje. Regresando a la pantalla de solicitudes.',
          );
          setViajeActivo(null);
          setOfertasEnviadas((prev) => {
            const nuevo = new Set(prev);
            nuevo.delete(solicitudActualizada.id);
            return nuevo;
          });
          setSolicitudesCercanas((prev) =>
            prev.filter((s) => s.solicitud.id !== solicitudActualizada.id),
          );
        } else if (solicitudActualizada.estado !== viajeActivo.estado) {
          setViajeActivo((prev) =>
            prev ? { ...prev, ...solicitudActualizada } : null,
          );
        }
      },
      (err) => {
        console.warn('[inicio] Error en suscripción viajeActivo:', err);
      },
    );
    return () => unsub();
  }, [viajeActivo?.id, viajeActivo?.estado]);

  async function alternarConexion() {
    setMensaje(null);
    setError(null);
    setOperando(true);
    try {
      if (isTracking) {
        await stopTracking();
        await authRepository.actualizarConexion(false);
        setSolicitudesCercanas([]);
        setMensaje('Te desconectaste. Ya no compartes tu ubicación.');
      } else {
        if (!perfil?.telefono_verificado) {
          Alert.alert(
            'Verificación Obligatoria',
            'Por seguridad, debes verificar tu número de celular con el código OTP antes de conectarte para recibir viajes.',
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Verificar en Perfil',
                onPress: () => router.push('/(tabs)/perfil'),
              },
            ],
          );
          return;
        }

        const iniciado = await startTracking();
        if (!iniciado) return;

        try {
          await authRepository.actualizarConexion(true);
          setMensaje('Estás conectado. Compartimos tu ubicación en segundo plano.');
        } catch (e) {
          await stopTracking();
          setError(
            e instanceof Error ? e.message : 'No se pudo actualizar tu conexión.',
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setOperando(false);
    }
  }

  function marcarOfertada(solicitudId: string) {
    setOfertasEnviadas((prev) => {
      const nuevo = new Set(prev);
      nuevo.add(solicitudId);
      return nuevo;
    });
  }

  function construirMetaConductor() {
    return {
      conductor_nombre: perfil?.nombre,
      conductor_vehiculo: perfil?.vehiculo ?? null,
      conductor_calificacion: perfil?.calificacion_promedio ?? 5.0,
      conductor_telefono: perfil?.telefono,
    };
  }

  async function aceptarSolicitud(solicitud: SolicitudViaje) {
    if (!sesion?.user) return;

    if (!perfil?.telefono_verificado) {
      Alert.alert(
        'Verificación Obligatoria',
        'Por seguridad, debes verificar tu número de celular antes de enviar ofertas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Verificar en Perfil',
            onPress: () => router.push('/(tabs)/perfil'),
          },
        ],
      );
      return;
    }

    setError(null);
    setMensaje(null);
    setOperando(true);
    try {
      await viajesRepository.enviarOferta(
        solicitud.id,
        sesion.user.id,
        solicitud.precio_inicial,
        construirMetaConductor(),
      );
      marcarOfertada(solicitud.id);
      setMensaje('Oferta enviada al pasajero.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la oferta.');
    } finally {
      setOperando(false);
    }
  }

  function abrirContraoferta(solicitud: SolicitudViaje) {
    setContraofertaId(solicitud.id);
    setPrecioContraoferta(String(solicitud.precio_inicial));
    setError(null);
  }

  async function confirmarContraoferta(solicitud: SolicitudViaje) {
    if (!sesion?.user || contraofertaId !== solicitud.id) return;

    if (!perfil?.telefono_verificado) {
      Alert.alert(
        'Verificación Obligatoria',
        'Por seguridad, debes verificar tu número de celular antes de enviar ofertas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Verificar en Perfil',
            onPress: () => router.push('/(tabs)/perfil'),
          },
        ],
      );
      return;
    }

    const precio = parseFloat(precioContraoferta.trim().replace(',', '.'));
    if (!Number.isFinite(precio) || precio <= 0) {
      setError('Ingresa un precio válido.');
      return;
    }
    if (precio <= solicitud.precio_inicial) {
      setError('La contraoferta debe ser mayor al precio del pasajero.');
      return;
    }

    setError(null);
    setMensaje(null);
    setOperando(true);
    try {
      await viajesRepository.enviarOferta(
        solicitud.id,
        sesion.user.id,
        precio,
        construirMetaConductor(),
      );
      marcarOfertada(solicitud.id);
      setContraofertaId(null);
      setMensaje('Contraoferta enviada.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la contraoferta.');
    } finally {
      setOperando(false);
    }
  }

  async function llegueAlOrigen() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const actualizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'en_camino_origen',
      );
      setViajeActivo(actualizada);
      setMensaje('Avisaste al pasajero que llegaste al origen.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  async function iniciarViaje() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const actualizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'en_curso',
      );
      setViajeActivo(actualizada);
      setMensaje('Viaje iniciado. En curso hacia el destino.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  async function finalizarViaje() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const finalizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'completado',
      );
      setViajeParaCalificar(finalizada);
      setEstrellasPasajero(5);
      setViajeActivo(null);
      setOfertasEnviadas((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(finalizada.id);
        return nuevo;
      });
      setContraofertaId(null);
      setPrecioContraoferta('');
      setMensaje('Viaje completado. Califica al pasajero para continuar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  async function enviarCalificacionPasajero() {
    if (!viajeParaCalificar || !idConductor) return;
    setOperando(true);
    setError(null);
    try {
      await viajesRepository.calificarViaje({
        solicitudId: viajeParaCalificar.id,
        evaluadorId: idConductor,
        evaluadoId: viajeParaCalificar.pasajero_id,
        rolEvaluador: 'conductor',
        estrellas: estrellasPasajero,
      });
      setViajeParaCalificar(null);
      setMensaje('¡Calificación registrada! De nuevo en el radar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calificar al pasajero.');
    } finally {
      setOperando(false);
    }
  }

  async function guardarVehiculo() {
    setError(null);
    setMensaje(null);
    setOperando(true);
    try {
      await authRepository.actualizarVehiculo(vehiculo.trim());
      setMensaje('Vehículo guardado.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el vehículo.');
    } finally {
      setOperando(false);
    }
  }

  async function llamarPasajero() {
    const tel = perfilPasajero?.telefono?.trim();
    if (!tel) {
      Alert.alert('Sin teléfono', 'El pasajero no tiene teléfono registrado.');
      return;
    }
    const url = `tel:${tel.replace(/\s+/g, '')}`;
    const puede = await Linking.canOpenURL(url);
    if (puede) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Teléfono del pasajero', tel);
    }
  }

  async function abrirWhatsAppPasajero() {
    const numero = normalizarTelefonoWhatsApp(perfilPasajero?.telefono ?? '');
    if (!numero) {
      Alert.alert('Sin WhatsApp', 'El pasajero no tiene un número celular válido.');
      return;
    }
    const msg = encodeURIComponent(
      `Hola ${perfilPasajero?.nombre ?? ''}, soy tu conductor de Taxi HVCA.`,
    );
    await Linking.openURL(`https://wa.me/${numero}?text=${msg}`);
  }

  async function abrirNavegacionMaps() {
    if (!viajeActivo) return;
    const irADestino = viajeActivo.estado === 'en_curso';
    const lat = irADestino ? viajeActivo.destino_lat : viajeActivo.origen_lat;
    const lng = irADestino ? viajeActivo.destino_lng : viajeActivo.origen_lng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    await Linking.openURL(url);
  }

  return (
    <ScrollView
      style={styles.contenedor}
      contentContainerStyle={[
        styles.contenido,
        { paddingTop: Math.max(insets.top, 24) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.cabecera}>
        <Text style={styles.saludo}>Hola,</Text>
        <Text style={styles.nombre}>{perfil?.nombre ?? 'Conductor'}</Text>
      </View>

      <View style={styles.central}>
        <View style={styles.tarjeta}>
          <View
            style={[
              styles.punto,
              isTracking ? styles.puntoActivo : styles.puntoInactivo,
            ]}
          />
          <Text style={styles.estadoTexto}>
            {isTracking ? 'Conectado' : 'Desconectado'}
          </Text>
          <Text style={styles.estadoDetalle}>
            {isTracking
              ? 'Tu ubicación se comparte con el mapa incluso con la pantalla bloqueada.'
              : 'Conéctate para empezar a recibir solicitudes y aparecer en el mapa.'}
          </Text>
        </View>

        <Button
          label={isTracking ? 'Desconectarse' : 'Conectarse'}
          onPress={() => void alternarConexion()}
          cargando={operando || loading}
          variante={isTracking ? 'peligro' : 'primario'}
          estilo={styles.boton}
        />

        {!perfil?.telefono_verificado && (
          <Pressable
            style={styles.avisoVerificacionConductor}
            onPress={() => router.push('/(tabs)/perfil')}
          >
            <Text style={styles.textoAvisoVerificacionConductor}>
              🔒 Teléfono no verificado. Toca aquí para validarlo en tu Perfil con un código OTP antes de conectarte.
            </Text>
          </Pressable>
        )}

        {errorTracking ? (
          <Text style={styles.error}>{errorTracking}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
      </View>

      {/* Selector de Simulación de Ubicación Huancavelica */}
      <View style={styles.cardSimulador}>
        <View style={styles.filaSimuladorHeader}>
          <View style={styles.textosSimulador}>
            <Text style={styles.tituloSimulador}>📍 Simulación Huancavelica</Text>
            <Text style={styles.descripcionSimulador}>
              {simularHuancavelica
                ? `${puntoSimulado.nombre} (${puntoSimulado.latitude.toFixed(4)}, ${puntoSimulado.longitude.toFixed(4)})`
                : 'Ubicación GPS de tu dispositivo'}
            </Text>
          </View>
          <Switch
            value={simularHuancavelica}
            onValueChange={setSimularHuancavelica}
            trackColor={{ false: '#D1D5DB', true: colores.primario }}
            thumbColor={simularHuancavelica ? '#ffffff' : '#f4f3f4'}
          />
        </View>

        {esEmuladorFueraDeHvca && !simularHuancavelica && (
          <View style={styles.avisoEmulador}>
            <Text style={styles.textoAvisoEmulador}>
              ⚠️ Emulador detectado fuera de Huancavelica. Activa la simulación para recibir viajes locales (a menos de 3 km).
            </Text>
          </View>
        )}

        {simularHuancavelica && (
          <View style={styles.puntosContainer}>
            <Text style={styles.subtituloSimulador}>Punto de inicio en Huancavelica:</Text>
            <View style={styles.filaChips}>
              {PUNTOS_SIMULACION_HVCA.map((p) => {
                const seleccionado = puntoSimulado.id === p.id;
                return (
                  <Pressable
                    key={p.id}
                    style={[styles.chipPunto, seleccionado && styles.chipPuntoActivo]}
                    onPress={() => setPuntoSimulado(p)}
                  >
                    <Text
                      style={[styles.textoChip, seleccionado && styles.textoChipActivo]}
                    >
                      {p.nombre}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Tarjeta de calificación al pasajero tras completar el viaje */}
      {viajeParaCalificar ? (
        <View style={styles.radar}>
          <View style={styles.tarjetaViajeActivo}>
            <Text style={styles.viajeTitulo}>¡Viaje Finalizado!</Text>
            <Text style={styles.viajeDetalle}>
              Califica tu experiencia con el pasajero (S/{' '}
              {Number(
                viajeParaCalificar.precio_final ?? viajeParaCalificar.precio_inicial,
              ).toFixed(2)}
              )
            </Text>
            <View style={styles.filaEstrellas}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setEstrellasPasajero(n)}
                  style={styles.botonEstrella}
                >
                  <Text
                    style={[
                      styles.iconoEstrella,
                      n <= estrellasPasajero
                        ? styles.estrellaActiva
                        : styles.estrellaInactiva,
                    ]}
                  >
                    ★
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filaBotones}>
              <Button
                label="Enviar calificación"
                onPress={() => void enviarCalificacionPasajero()}
                cargando={operando}
                estilo={styles.botonViaje}
              />
              <Button
                label="Omitir"
                variante="secundario"
                onPress={() => setViajeParaCalificar(null)}
                estilo={styles.botonViaje}
              />
            </View>
          </View>
        </View>
      ) : null}

      {viajeActivo ? (
        <View style={styles.radar}>
          <View style={styles.tarjetaViajeActivo}>
            <Text style={styles.viajeTitulo}>Viaje Activo</Text>
            <Text style={styles.viajeEstadoTexto}>
              {etiquetaEstadoViaje(viajeActivo.estado)}
            </Text>

            {/* Mapa compacto del viaje */}
            <View style={styles.mapaCompactoContenedor}>
              <MapView
                style={styles.mapaCompacto}
                initialRegion={{
                  latitude: viajeActivo.origen_lat,
                  longitude: viajeActivo.origen_lng,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: viajeActivo.origen_lat,
                    longitude: viajeActivo.origen_lng,
                  }}
                  title="Origen"
                  pinColor="#16A34A"
                />
                <Marker
                  coordinate={{
                    latitude: viajeActivo.destino_lat,
                    longitude: viajeActivo.destino_lng,
                  }}
                  title="Destino"
                  pinColor="#DC2626"
                />
                {ubicacionConductor ? (
                  <Marker
                    coordinate={ubicacionConductor}
                    title="Tu ubicación"
                    pinColor="#F59E0B"
                  />
                ) : null}
                <Polyline
                  coordinates={[
                    {
                      latitude: viajeActivo.origen_lat,
                      longitude: viajeActivo.origen_lng,
                    },
                    {
                      latitude: viajeActivo.destino_lat,
                      longitude: viajeActivo.destino_lng,
                    },
                  ]}
                  strokeColor={colores.primario}
                  strokeWidth={4}
                />
              </MapView>
            </View>

            {perfilPasajero ? (
              <View style={styles.cajaPasajero}>
                <Text style={styles.pasajeroNombre}>
                  👤 Pasajero: {perfilPasajero.nombre} (★{' '}
                  {perfilPasajero.calificacion_promedio.toFixed(1)})
                </Text>
                {perfilPasajero.telefono ? (
                  <Text style={styles.pasajeroTelefono}>
                    📱 {perfilPasajero.telefono}
                  </Text>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.viajeOrigen}>
              🟢 Origen:{' '}
              {viajeActivo.origen_direccion ??
                formatearReferenciaHuancavelica({
                  latitude: viajeActivo.origen_lat,
                  longitude: viajeActivo.origen_lng,
                })}
            </Text>
            <Text style={styles.viajeDetalle}>
              🔴 Destino:{' '}
              {viajeActivo.destino_direccion ??
                formatearReferenciaHuancavelica({
                  latitude: viajeActivo.destino_lat,
                  longitude: viajeActivo.destino_lng,
                })}
            </Text>
            <Text style={styles.viajePrecio}>
              S/{' '}
              {Number(
                viajeActivo.precio_final ?? viajeActivo.precio_inicial,
              ).toFixed(2)}
            </Text>

            <View style={styles.filaContactoViaje}>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void llamarPasajero()}
              >
                <Text style={styles.textoContacto}>📞 Llamar</Text>
              </Pressable>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void abrirWhatsAppPasajero()}
              >
                <Text style={styles.textoContacto}>💬 WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void abrirNavegacionMaps()}
              >
                <Text style={styles.textoContacto}>🗺️ Maps</Text>
              </Pressable>
            </View>

            <View style={styles.filaBotones}>
              {viajeActivo.estado === 'aceptado' ? (
                <Button
                  label="Llegué al origen"
                  onPress={() => void llegueAlOrigen()}
                  cargando={operando}
                  estilo={styles.botonViaje}
                />
              ) : null}
              {viajeActivo.estado === 'en_camino_origen' ? (
                <Button
                  label="Iniciar viaje"
                  variante="accent"
                  onPress={() => void iniciarViaje()}
                  cargando={operando}
                  estilo={styles.botonViaje}
                />
              ) : null}
              {viajeActivo.estado === 'en_curso' ? (
                <Button
                  label="Finalizar Viaje"
                  variante="peligro"
                  onPress={() => void finalizarViaje()}
                  cargando={operando}
                  estilo={styles.botonViaje}
                />
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {isTracking && !viajeActivo ? (
        <View style={styles.radar}>
          <View style={styles.bloqueVehiculo}>
            <Text style={styles.radarTitulo}>Mi vehículo</Text>
            <Input
              etiqueta="Vehículo (marca, placa)"
              value={vehiculo}
              onChangeText={setVehiculo}
              placeholder="Toyota Corolla · ABC-123"
              testID="input-vehiculo"
              style={styles.inputVehiculo}
            />
            <Button
              label="Guardar vehículo"
              variante="secundario"
              onPress={() => void guardarVehiculo()}
              cargando={operando}
              estilo={styles.botonGuardarVehiculo}
            />
          </View>
          <Text style={styles.radarTitulo}>Solicitudes cercanas</Text>
          {solicitudesCercanas.length === 0 ? (
            <Text style={styles.vacio}>
              Aún no hay solicitudes a menos de {DISTANCIA_MAX_KM} km de tu
              ubicación.
            </Text>
          ) : (
            solicitudesCercanas.map(({ solicitud, distanciaKm }) => {
              const ofertada = ofertasEnviadas.has(solicitud.id);
              const origenTexto =
                solicitud.origen_direccion ??
                formatearReferenciaHuancavelica({
                  latitude: solicitud.origen_lat,
                  longitude: solicitud.origen_lng,
                });
              const destinoTexto =
                solicitud.destino_direccion ??
                formatearReferenciaHuancavelica({
                  latitude: solicitud.destino_lat,
                  longitude: solicitud.destino_lng,
                });

              return (
                <View key={solicitud.id} style={styles.tarjetaSolicitud}>
                  <Text style={styles.solicitudOrigen}>
                    🟢 Origen: {origenTexto}
                  </Text>
                  <Text style={styles.solicitudDetalle}>
                    🔴 Destino: {destinoTexto}
                  </Text>
                  <View style={styles.filaPrecio}>
                    <Text style={styles.solicitudPrecio}>
                      S/ {Number(solicitud.precio_inicial).toFixed(2)}
                    </Text>
                    <Text style={styles.solicitudDistancia}>
                      {distanciaKm < 1
                        ? `${Math.round(distanciaKm * 1000)} m de ti`
                        : `${distanciaKm.toFixed(1)} km de ti`}
                    </Text>
                  </View>

                  {ofertada ? (
                    <Text style={styles.ofertada}>Oferta enviada ✓</Text>
                  ) : (
                    <>
                      {contraofertaId === solicitud.id ? (
                        <Input
                          etiqueta="Tu contraoferta (S/)"
                          value={precioContraoferta}
                          onChangeText={setPrecioContraoferta}
                          keyboardType="decimal-pad"
                          placeholder="S/ 6.00"
                          testID="input-contraoferta"
                          style={styles.inputContraoferta}
                        />
                      ) : null}
                      <View style={styles.filaBotones}>
                        <Button
                          label={`Aceptar (S/ ${Number(
                            solicitud.precio_inicial,
                          ).toFixed(2)})`}
                          onPress={() => void aceptarSolicitud(solicitud)}
                          cargando={operando}
                          estilo={styles.botonOferta}
                        />
                        {contraofertaId === solicitud.id ? (
                          <Button
                            label="Enviar contraoferta"
                            onPress={() => void confirmarContraoferta(solicitud)}
                            cargando={operando}
                            estilo={styles.botonOferta}
                          />
                        ) : (
                          <Button
                            label="Contraofertar"
                            variante="secundario"
                            onPress={() => abrirContraoferta(solicitud)}
                            estilo={styles.botonOferta}
                          />
                        )}
                      </View>
                    </>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : null}

      <Pressable onPress={() => void cerrarSesion()} style={styles.logout}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  contenido: {
    padding: 24,
    paddingBottom: 32,
  },
  cabecera: {
    marginTop: 8,
    marginBottom: 16,
  },
  saludo: {
    fontSize: 16,
    color: colores.textoSuave,
  },
  nombre: {
    fontSize: 26,
    fontWeight: '700',
    color: colores.texto,
  },
  central: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  tarjeta: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 24,
    marginBottom: 24,
  },
  punto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  puntoActivo: {
    backgroundColor: colores.exito,
  },
  puntoInactivo: {
    backgroundColor: colores.textoSuave,
    opacity: 0.4,
  },
  estadoTexto: {
    fontSize: 20,
    fontWeight: '700',
    color: colores.texto,
  },
  estadoDetalle: {
    marginTop: 8,
    fontSize: 14,
    color: colores.textoSuave,
    textAlign: 'center',
  },
  boton: {
    minHeight: 72,
    borderRadius: 24,
  },
  error: {
    marginTop: 16,
    color: colores.peligro,
    textAlign: 'center',
  },
  mensaje: {
    marginTop: 16,
    color: colores.exito,
    textAlign: 'center',
  },
  radar: {
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    marginTop: 24,
  },
  radarTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 12,
  },
  vacio: {
    color: colores.textoSuave,
  },
  tarjetaSolicitud: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 16,
    marginBottom: 12,
    backgroundColor: '#FAFAFA',
  },
  solicitudOrigen: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  solicitudDetalle: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 4,
  },
  filaPrecio: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  solicitudPrecio: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.primario,
  },
  solicitudDistancia: {
    fontSize: 13,
    color: colores.textoSuave,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  botonOferta: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  inputContraoferta: {
    marginBottom: 12,
  },
  ofertada: {
    color: colores.exito,
    fontWeight: '600',
  },
  tarjetaViajeActivo: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.primario,
    padding: 16,
    backgroundColor: '#FAFAFA',
  },
  viajeTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.primario,
    marginBottom: 4,
  },
  viajeEstadoTexto: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.primario,
    marginBottom: 12,
  },
  mapaCompactoContenedor: {
    height: 190,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 12,
  },
  mapaCompacto: {
    flex: 1,
  },
  cajaPasajero: {
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 10,
  },
  pasajeroNombre: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  pasajeroTelefono: {
    fontSize: 12,
    color: '#1D4ED8',
    marginTop: 2,
  },
  viajeOrigen: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  viajeDetalle: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 4,
  },
  viajePrecio: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.primario,
    marginTop: 8,
    marginBottom: 8,
  },
  filaContactoViaje: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  botonContacto: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  textoContacto: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  filaEstrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 10,
  },
  botonEstrella: {
    padding: 4,
  },
  iconoEstrella: {
    fontSize: 30,
  },
  estrellaActiva: {
    color: '#F59E0B',
  },
  estrellaInactiva: {
    color: '#D1D5DB',
  },
  botonViaje: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: 8,
  },
  bloqueVehiculo: {
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  inputVehiculo: {
    marginBottom: 12,
  },
  botonGuardarVehiculo: {
    minHeight: 44,
  },
  logout: {
    alignSelf: 'center',
    padding: 12,
    marginTop: 8,
  },
  logoutTexto: {
    color: colores.textoSuave,
    fontWeight: '600',
  },
  cardSimulador: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  filaSimuladorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textosSimulador: {
    flex: 1,
    paddingRight: 12,
  },
  tituloSimulador: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.texto,
  },
  descripcionSimulador: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  avisoEmulador: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  textoAvisoEmulador: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 16,
  },
  puntosContainer: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  subtituloSimulador: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
    marginBottom: 8,
  },
  filaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPunto: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chipPuntoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoChip: {
    fontSize: 12,
    fontWeight: '500',
    color: colores.texto,
  },
  textoChipActivo: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  avisoVerificacionConductor: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  textoAvisoVerificacionConductor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
    textAlign: 'center',
  },
});
