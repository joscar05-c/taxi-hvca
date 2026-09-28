import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView from 'react-native-maps';

import {
  Button,
  Input,
  colores,
  supabase,
  useAuth,
  useForegroundLocation,
  viajesRepository,
  type Coordenadas,
  type OfertaConductor,
  type SolicitudViaje,
} from '@hvca/shared';

const ZOOM_INICIAL = 0.01;

export default function PantallaMapa() {
  const { sesion } = useAuth();
  const { coords, loading, error: errorUbicacion, requestPermissionAndLocate } =
    useForegroundLocation();
  const [centroMapa, setCentroMapa] = useState<Coordenadas | null>(null);
  const [originCoords, setOriginCoords] = useState<Coordenadas | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<Coordenadas | null>(null);
  const [tarifa, setTarifa] = useState('');
  const [solicitud, setSolicitud] = useState<SolicitudViaje | null>(null);
  const [ofertas, setOfertas] = useState<OfertaConductor[]>([]);
  const [aceptada, setAceptada] = useState(false);
  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void requestPermissionAndLocate();
  }, [requestPermissionAndLocate]);

  useEffect(() => {
    if (coords && !centroMapa) {
      setCentroMapa({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }
  }, [coords, centroMapa]);

  // Suscripción en tiempo real a las ofertas de la solicitud activa.
  useEffect(() => {
    if (!solicitud) return;
    setOfertas([]);
    return viajesRepository.suscribirOfertas(solicitud.id, (oferta) => {
      setOfertas((prev) => [...prev, oferta]);
    });
  }, [solicitud]);

  function fijarOrigen() {
    if (!centroMapa) return;
    setOriginCoords(centroMapa);
    setMensaje('Origen fijado. Si quieres, mueve el mapa para fijar el destino.');
    setError(null);
  }

  function fijarDestino() {
    if (!centroMapa) return;
    setDestinoCoords(centroMapa);
    setMensaje('Destino fijado.');
    setError(null);
  }

  async function pedirTaxi() {
    if (!originCoords || !sesion?.user) return;

    const precio = parseFloat(tarifa.trim().replace(',', '.'));
    if (Number.isNaN(precio) || precio <= 0) {
      setError('Ingresa una tarifa válida, por ejemplo 5.00.');
      return;
    }

    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const creada = await viajesRepository.crearSolicitud(
        sesion.user.id,
        originCoords,
        destinoCoords ?? centroMapa ?? originCoords,
        precio,
      );
      setSolicitud(creada);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud.');
    } finally {
      setOperando(false);
    }
  }

  async function aceptarOferta(oferta: OfertaConductor) {
    if (!solicitud) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      await viajesRepository.aceptarOferta(
        solicitud.id,
        oferta.conductor_id,
        oferta.precio,
      );
      setAceptada(true);
      setMensaje('Oferta aceptada. El conductor va en camino.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar la oferta.');
    } finally {
      setOperando(false);
    }
  }

  function cancelarSolicitud() {
    setSolicitud(null);
    setOfertas([]);
    setAceptada(false);
    setMensaje(null);
    setError(null);
  }

  return (
    <View style={styles.contenedor}>
      {coords && centroMapa ? (
        <MapView
          style={styles.mapa}
          initialRegion={{
            latitude: centroMapa.latitude,
            longitude: centroMapa.longitude,
            latitudeDelta: ZOOM_INICIAL,
            longitudeDelta: ZOOM_INICIAL,
          }}
          showsUserLocation
          showsMyLocationButton={false}
          onRegionChangeComplete={(region) =>
            setCentroMapa({
              latitude: region.latitude,
              longitude: region.longitude,
            })
          }
        />
      ) : (
        <View style={styles.estadoOverlay}>
          {loading ? (
            <ActivityIndicator size="large" color={colores.primario} />
          ) : (
            <>
              <Text style={styles.estadoTexto}>
                {errorUbicacion ?? 'No fue posible obtener tu ubicación.'}
              </Text>
              <Button
                label="Permitir ubicación"
                onPress={() => void requestPermissionAndLocate()}
                estilo={styles.botonReintentar}
              />
            </>
          )}
        </View>
      )}

      {/* Pin central fijo (no es un Marker arrastrable) */}
      {coords ? (
        <View pointerEvents="none" style={styles.pin}>
          <View style={styles.pinCirculo}>
            <View style={styles.pinPunto} />
          </View>
          <View style={styles.pinTriangulo} />
        </View>
      ) : null}

      {/* Cerrar sesión (acceso rápido para pruebas) */}
      <Pressable onPress={() => void supabase.auth.signOut()} style={styles.logout}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </Pressable>

      {/* Barra inferior: preparación, búsqueda u ofertas */}
      <View style={styles.barraInferior}>
        {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!solicitud ? (
          !originCoords ? (
            <>
              <Text style={styles.ayuda}>
                Mueve el mapa hasta tu ubicación de recogida y fija el origen.
              </Text>
              <Button
                label="Fijar Origen"
                onPress={fijarOrigen}
                deshabilitado={!centroMapa}
              />
            </>
          ) : (
            <>
              <Text style={styles.ayuda}>
                Origen: {originCoords.latitude.toFixed(5)},{' '}
                {originCoords.longitude.toFixed(5)}
              </Text>
              {destinoCoords ? (
                <Text style={styles.ayuda}>
                  Destino: {destinoCoords.latitude.toFixed(5)},{' '}
                  {destinoCoords.longitude.toFixed(5)}
                </Text>
              ) : (
                <Button
                  label="Fijar Destino"
                  variante="secundario"
                  onPress={fijarDestino}
                  estilo={styles.botonMitad}
                />
              )}
              <Input
                etiqueta="Tu tarifa propuesta"
                value={tarifa}
                onChangeText={setTarifa}
                keyboardType="decimal-pad"
                placeholder="S/ 5.00"
                testID="input-tarifa"
                style={styles.inputTarifa}
              />
              <Button
                label="Pedir Taxi"
                onPress={() => void pedirTaxi()}
                cargando={operando}
                deshabilitado={!tarifa.trim()}
                estilo={styles.boton}
              />
            </>
          )
        ) : !aceptada ? (
          <>
            <Text style={styles.buscando}>Buscando conductores...</Text>
            <Text style={styles.ayuda}>
              Tu tarifa ofrecida: S/ {Number(solicitud.precio_inicial).toFixed(2)}
            </Text>
            {ofertas.length === 0 ? (
              <Text style={styles.ayuda}>
                Aún no llegan ofertas. Los conductores cercanos podrán participar.
              </Text>
            ) : (
              <ScrollView
                style={styles.listaOfertas}
                contentContainerStyle={styles.listaContenido}
              >
                {ofertas.map((oferta) => (
                  <View key={oferta.id} style={styles.tarjetaOferta}>
                    <View style={styles.tarjetaTexto}>
                      <Text style={styles.ofertaTitulo}>
                        Conductor · {oferta.conductor_id.slice(0, 8)}
                      </Text>
                      <Text style={styles.ofertaPrecio}>
                        S/ {Number(oferta.precio).toFixed(2)}
                      </Text>
                    </View>
                    <Button
                      label="Aceptar"
                      onPress={() => void aceptarOferta(oferta)}
                      cargando={operando}
                      estilo={styles.botonAceptar}
                    />
                  </View>
                ))}
              </ScrollView>
            )}
            <Button
              label="Cancelar solicitud"
              variante="secundario"
              onPress={cancelarSolicitud}
              estilo={styles.boton}
            />
          </>
        ) : (
          <>
            <Text style={styles.aceptada}>¡Viaje aceptado!</Text>
            <Text style={styles.ayuda}>
              El conductor va en camino. Te avisaremos cuando llegue a la
              recogida.
            </Text>
            <Button
              label="Nueva solicitud"
              onPress={cancelarSolicitud}
              estilo={styles.boton}
            />
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  mapa: {
    flex: 1,
  },
  estadoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
    backgroundColor: colores.fondo,
  },
  estadoTexto: {
    color: colores.textoSuave,
    textAlign: 'center',
  },
  botonReintentar: {
    minWidth: 200,
  },
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    alignItems: 'center',
    transform: [{ translateX: -20 }, { translateY: -54 }],
  },
  pinCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.primario,
    borderWidth: 3,
    borderColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pinPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colores.fondo,
  },
  pinTriangulo: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colores.primario,
  },
  logout: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutTexto: {
    color: colores.primario,
    fontWeight: '600',
  },
  barraInferior: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colores.fondo,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  mensaje: {
    color: colores.exito,
    marginBottom: 8,
    fontWeight: '600',
  },
  error: {
    color: colores.peligro,
    marginBottom: 8,
  },
  ayuda: {
    color: colores.textoSuave,
    fontSize: 13,
    marginBottom: 8,
  },
  botonMitad: {
    marginBottom: 12,
  },
  inputTarifa: {
    marginBottom: 12,
  },
  boton: {
    marginTop: 4,
  },
  buscando: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 4,
  },
  listaOfertas: {
    maxHeight: 180,
    marginVertical: 8,
  },
  listaContenido: {
    gap: 8,
  },
  tarjetaOferta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  tarjetaTexto: {
    flex: 1,
    marginRight: 12,
  },
  ofertaTitulo: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  ofertaPrecio: {
    fontSize: 14,
    color: colores.textoSuave,
    marginTop: 2,
  },
  botonAceptar: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  aceptada: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.exito,
    marginBottom: 4,
  },
});