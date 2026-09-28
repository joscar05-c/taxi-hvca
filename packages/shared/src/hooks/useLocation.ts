import { useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface UseLocationResult {
  /** Última posición conocida en primer plano. */
  ubicacion: Location.LocationObjectCoords | null;
  /** Necesario para el mapa inicial antes de que se apruebe el permiso. */
  ultimaUbicacionConocida: Location.LocationObjectCoords | null;
  permissionStatus: Location.PermissionStatus | null;
  error: string | null;
  solicitarPermisos: () => Promise<boolean>;
}

/** Geolocalización en primer plano con solicitud de permisos. */
export function useLocation(): UseLocationResult {
  const [ubicacion, setUbicacion] = useState<Location.LocationObjectCoords | null>(null);
  const [ultimaUbicacionConocida, setUltimaUbicacionConocida] =
    useState<Location.LocationObjectCoords | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) setUltimaUbicacionConocida(pos.coords);
      })
      .catch(() => undefined);
  }, []);

  async function solicitarPermisos(): Promise<boolean> {
    try {
      setError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== 'granted') {
        setError('Permiso de ubicación denegado.');
        return false;
      }

      const posAct = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setUbicacion(posAct.coords);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al obtener la ubicación.');
      return false;
    }
  }

  useEffect(() => {
    if (permissionStatus !== 'granted') return;
    const suscripcion = Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 10 },
      ({ coords }) => setUbicacion(coords),
    );
    return () => {
      suscripcion.then((s) => s.remove()).catch(() => undefined);
    };
  }, [permissionStatus]);

  return {
    ubicacion,
    ultimaUbicacionConocida,
    permissionStatus,
    error,
    solicitarPermisos,
  };
}