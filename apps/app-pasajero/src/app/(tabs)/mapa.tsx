import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView from 'react-native-maps';

import { Button, colores, supabase, useForegroundLocation } from '@hvca/shared';

interface CoordenadasCentro {
  latitude: number;
  longitude: number;
}

const ZOOM_INICIAL = 0.01;

export default function PantallaMapa() {
  const { coords, loading, error, requestPermissionAndLocate } =
    useForegroundLocation();
  const [centroMapa, setCentroMapa] = useState<CoordenadasCentro | null>(null);
  const [originCoords, setOriginCoords] = useState<CoordenadasCentro | null>(null);
  const [confirmacion, setConfirmacion] = useState(false);

  // Solicita permiso y ubicación al abrir la pantalla.
  useEffect(() => {
    void requestPermissionAndLocate();
  }, [requestPermissionAndLocate]);

  // Cuando llega la ubicación, centramos el mapa por primera vez.
  useEffect(() => {
    if (coords && !centroMapa) {
      setCentroMapa({
        latitude: coords.latitude,
        longitude: coords.longitude,
      });
    }
  }, [coords, centroMapa]);

  function fijarOrigen() {
    if (!centroMapa) return;
    setOriginCoords(centroMapa);
    setConfirmacion(true);
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
                {error ?? 'No fue posible obtener tu ubicación.'}
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

      {/* Barra inferior */}
      <View style={styles.barraInferior}>
        {confirmacion && originCoords ? (
          <Text style={styles.confirmacion}>
            Origen fijado en {originCoords.latitude.toFixed(5)},{' '}
            {originCoords.longitude.toFixed(5)}
          </Text>
        ) : null}
        <Button
          label="Fijar Origen"
          onPress={fijarOrigen}
          deshabilitado={!centroMapa}
          cargando={loading}
        />
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
  confirmacion: {
    color: colores.exito,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '600',
  },
});