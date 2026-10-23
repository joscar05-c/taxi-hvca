import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import {
  Button,
  Input,
  authRepository,
  calcularDistanciaHaversine,
  colores,
  HUANCAVELICA_CENTRO,
  PUNTOS_SIMULACION_HVCA,
  useAuth,
  useBackgroundLocation,
  useForegroundLocation,
  viajesRepository,
  type Coordenadas,
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

/**
 * Parsea un punto PostGIS (EWKT) como "SRID=4326;POINT(lng lat)" y devuelve
 * sus coordenadas. Devuelve null si el texto no tiene una geometría Point.
 */
function parsearPuntoPostgis(texto: string | null): Coordenadas | null {
  const match = texto?.match(
    /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i,
  );
  if (!match) return null;
  const lat = parseFloat(match[2]);
  const lng = parseFloat(match[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
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
  const [contraofertaId, setContraofertaId] = useState<string | null>(null);
  const [precioContraoferta, setPrecioContraoferta] = useState('');
  const [vehiculo, setVehiculo] = useState('');

  useEffect(() => {
    if (perfil?.vehiculo) setVehiculo(perfil.vehiculo);
  }, [perfil?.vehiculo]);

  // Modo simulación Huancavelica para desarrollo y emuladores
  const [simularHuancavelica, setSimularHuancavelica] = useState(false);
  const [puntoSimulado, setPuntoSimulado] = useState<PuntoSimulacionHvca>(
    PUNTOS_SIMULACION_HVCA[0],
  );

  // Detectar si el GPS actual reporta ubicación fuera de Huancavelica (típico de emuladores en EE.UU.)
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

  // Si detectamos emulador fuera de Huancavelica, activar la simulación por defecto
  useEffect(() => {
    if (esEmuladorFueraDeHvca) {
      setSimularHuancavelica(true);
    }
  }, [esEmuladorFueraDeHvca]);

  // Posición efectiva del conductor: simulada si está activa, de lo contrario GPS
  const ubicacionConductor = useMemo<Coordenadas | null>(() => {
    if (simularHuancavelica) {
      return { latitude: puntoSimulado.latitude, longitude: puntoSimulado.longitude };
    }
    if (coords) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    return parsearPuntoPostgis(perfil?.ubicacion_actual ?? null);
  }, [simularHuancavelica, puntoSimulado, coords, perfil]);

  // Buffer de todas las solicitudes activas para evitar descartar si el GPS tarda en inicializar
  const solicitudesPendientesRef = useRef<Map<string, SolicitudViaje>>(new Map());

  // Ref para leer la posición dentro del callback realtime sin resuscribir.
  const ubicacionRef = useRef(ubicacionConductor);

  // Reevalúa todas las solicitudes buffered contra una posición dada
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

  // Al conectarse pedimos una posición en primer plano para medir distancias.
  useEffect(() => {
    if (isTracking) {
      void requestPermissionAndLocate();
    }
  }, [isTracking, requestPermissionAndLocate]);

  const manejarNuevaSolicitud = useCallback(
    (solicitud: SolicitudViaje) => {
      // Guardar en el buffer persistente
      solicitudesPendientesRef.current.set(solicitud.id, solicitud);
      const pos = ubicacionRef.current;
      if (!pos) return; // Se reevaluará cuando se obtenga la ubicación gracias a recalcularCercanas

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
    },
    [],
  );

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
  const idConductor = sesion?.user?.id;
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
                // Pasajero aceptó a otro conductor: remover oferta de pendientes
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
          (error) => {
            console.warn('[inicio] Error en suscripción solicitud:', error);
          },
        ),
      );
    });
    return () => {
      limpiadores.forEach((limpiar) => limpiar());
    };
  }, [ofertasEnviadas, idConductor]);

  // Escuchar reactivamente cambios en el viaje activo (si el pasajero cancela mientras se viaja)
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
      (error) => {
        console.warn('[inicio] Error en suscripción viajeActivo:', error);
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
      await viajesRepository.enviarOferta(solicitud.id, sesion.user.id, precio);
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
      const idViaje = viajeActivo.id;
      await viajesRepository.actualizarEstadoViaje(idViaje, 'completado');
      setViajeActivo(null);
      setOfertasEnviadas((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(idViaje);
        return nuevo;
      });
      setContraofertaId(null);
      setPrecioContraoferta('');
      setMensaje('Viaje completado. De nuevo en el radar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar el viaje.');
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

      {viajeActivo ? (
        <View style={styles.radar}>
          <View style={styles.tarjetaViajeActivo}>
            <Text style={styles.viajeTitulo}>Viaje Activo</Text>
            <Text style={styles.viajeEstadoTexto}>
              {etiquetaEstadoViaje(viajeActivo.estado)}
            </Text>
            <Text style={styles.viajeOrigen}>
              Origen: {viajeActivo.origen_lat.toFixed(5)},{' '}
              {viajeActivo.origen_lng.toFixed(5)}
            </Text>
            <Text style={styles.viajeDetalle}>
              Destino: {viajeActivo.destino_lat.toFixed(5)},{' '}
              {viajeActivo.destino_lng.toFixed(5)}
            </Text>
            <Text style={styles.viajePrecio}>
              S/{' '}
              {Number(
                viajeActivo.precio_final ?? viajeActivo.precio_inicial,
              ).toFixed(2)}
            </Text>
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
              return (
                <View key={solicitud.id} style={styles.tarjetaSolicitud}>
                  <Text style={styles.solicitudOrigen}>
                    Origen: {solicitud.origen_lat.toFixed(5)},{' '}
                    {solicitud.origen_lng.toFixed(5)}
                  </Text>
                  <Text style={styles.solicitudDetalle}>
                    Destino: {solicitud.destino_lat.toFixed(5)},{' '}
                    {solicitud.destino_lng.toFixed(5)}
                  </Text>
                  <View style={styles.filaPrecio}>
                    <Text style={styles.solicitudPrecio}>
                      S/ {Number(solicitud.precio_inicial).toFixed(2)}
                    </Text>
                    <Text style={styles.solicitudDistancia}>
                      {distanciaKm < 1
                        ? `${Math.round(distanciaKm * 1000)} m`
                        : `${distanciaKm.toFixed(1)} km`}
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
    marginTop: 4,
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
    marginBottom: 12,
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