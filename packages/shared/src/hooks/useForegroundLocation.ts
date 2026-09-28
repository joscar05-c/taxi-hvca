import { useCallback, useState } from 'react';
import * as Location from 'expo-location';

export interface ForegroundLocationResult {
  /** Coordenadas actuales obtenidas con `getCurrentPositionAsync`. */
  coords: Location.LocationObjectCoords | null;
  /** Estado del permiso tras `requestForegroundPermissionsAsync`. */
  status: Location.PermissionStatus | null;
  loading: boolean;
  error: string | null;
  requestPermissionAndLocate: () => Promise<boolean>;
}

/**
 * Geolocalización en primer plano:
 * solicita permiso (`requestForegroundPermissionsAsync`) y obtiene la
 * posición actual (`getCurrentPositionAsync`). No inicia por sí sola;
 * el consumidor decide cuándo llamar a `requestPermissionAndLocate`.
 */
export function useForegroundLocation(): ForegroundLocationResult {
  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermissionAndLocate = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { status: nuevoStatus } =
        await Location.requestForegroundPermissionsAsync();
      setStatus(nuevoStatus);

      if (nuevoStatus !== 'granted') {
        setError(
          'Permiso de ubicación denegado. Actívalo en los ajustes de tu teléfono.',
        );
        return false;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoords(pos.coords);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { coords, status, loading, error, requestPermissionAndLocate };
}