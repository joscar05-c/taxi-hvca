import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Input,
  authRepository,
  calcularDistanciaHaversine,
  colores,
  useAuth,
  useBackgroundLocation,
  useForegroundLocation,
  viajesRepository,
  type Coordenadas,
  type SolicitudViaje,
} from '@hvca/shared';

import { BACKGROUND_LOCATION_TASK } from '../../locationTask';

const DISTANCIA_MAX_KM = 3;

type SolicitudCercana = {
  solicitud: SolicitudViaje;
  distanciaKm: number;
};

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

  // Posición del conductor: la del primer plano si ya la tenemos; si no,
  // la última `ubicacion_actual` (EWKT) persistida en la BD.
  const ubicacionConductor = useMemo<Coordenadas | null>(() => {
    if (coords) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    return parsearPuntoPostgis(perfil?.ubicacion_actual ?? null);
  }, [coords, perfil]);

  // Ref para leer la posición dentro del callback realtime sin resuscribir.
  const ubicacionRef = useRef(ubicacionConductor);
  useEffect(() => {
    ubicacionRef.current = ubicacionConductor;
  }, [ubicacionConductor]);

  // Al conectarse pedimos una posición en primer plano para medir distancias.
  useEffect(() => {
    if (isTracking) {
      void requestPermissionAndLocate();
    }
  }, [isTracking, requestPermissionAndLocate]);

  const manejarNuevaSolicitud = useCallback((solicitud: SolicitudViaje) => {
    const pos = ubicacionRef.current;
    if (!pos) return;

    const distanciaKm = calcularDistanciaHaversine(
      solicitud.origen_lat,
      solicitud.origen_lng,
      pos.latitude,
      pos.longitude,
    );
    if (distanciaKm >= DISTANCIA_MAX_KM) return;

    setSolicitudesCercanas((prev) =>
      prev.some((s) => s.solicitud.id === solicitud.id)
        ? prev
        : [...prev, { solicitud, distanciaKm }],
    );
  }, []);

  useEffect(() => {
    if (!isTracking) return;
    return viajesRepository.suscribirNuevasSolicitudes(manejarNuevaSolicitud);
  }, [isTracking, manejarNuevaSolicitud]);

  // Por cada solicitud con oferta enviada, escuchamos si el pasajero la
  // acepta. La suscripción se cancela al cambiar la lista o al desmontar, y
  // especialmente cuando el viaje termina (se quita el id al finalizar).
  const idConductor = sesion?.user?.id;
  useEffect(() => {
    const limpiadores: Array<() => void> = [];
    ofertasEnviadas.forEach((solicitudId) => {
      limpiadores.push(
        viajesRepository.suscribirCambiosSolicitud(solicitudId, (solicitud) => {
          if (solicitud.estado === 'aceptado' && solicitud.conductor_id === idConductor) {
            setViajeActivo(solicitud);
          }
        }),
      );
    });
    return () => {
      limpiadores.forEach((limpiar) => limpiar());
    };
  }, [ofertasEnviadas, idConductor]);

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
      contentContainerStyle={styles.contenido}
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

        {errorTracking ? (
          <Text style={styles.error}>{errorTracking}</Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
      </View>

      {viajeActivo ? (
        <View style={styles.radar}>
          <View style={styles.tarjetaViajeActivo}>
            <Text style={styles.viajeTitulo}>Viaje Activo</Text>
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
              <Button
                label="Llegué al origen"
                onPress={() => void llegueAlOrigen()}
                cargando={operando}
                estilo={styles.botonViaje}
              />
              <Button
                label="Finalizar Viaje"
                variante="peligro"
                onPress={() => void finalizarViaje()}
                cargando={operando}
                estilo={styles.botonViaje}
              />
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
});