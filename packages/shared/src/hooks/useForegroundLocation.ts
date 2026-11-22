import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface ForegroundLocationOptions {
  /** Si es `true`, mantiene escucha continua con `watchPositionAsync` cuando hay permiso. */
  watch?: boolean;
  /** Nivel de precisión para lectura inicial y escucha continua. Por defecto `Balanced`. */
  accuracy?: Location.Accuracy;
  /** Distancia mínima en metros entre actualizaciones continuas. Por defecto `15`. */
  distanceInterval?: number;
  /** Intervalo mínimo en ms entre actualizaciones continuas. Por defecto `5000`. */
  timeInterval?: number;
  /** Precisión máxima aceptada en metros tras fijar una posición inicial. Por defecto `80`. */
  maxAccuracyMeters?: number;
}

export interface ForegroundLocationResult {
  /** Coordenadas actuales o más recientes del GPS en primer plano. */
  coords: Location.LocationObjectCoords | null;
  /** Estado del permiso tras `requestForegroundPermissionsAsync`. */
  status: Location.PermissionStatus | null;
  loading: boolean;
  /** Indica si la escucha continua (`watchPositionAsync`) está activa. */
  watching: boolean;
  error: string | null;
  requestPermissionAndLocate: () => Promise<boolean>;
}

/**
 * Geolocalización en primer plano:
 * solicita permiso (`requestForegroundPermissionsAsync`), obtiene la posición
 * inicial (`getLastKnownPositionAsync` + `getCurrentPositionAsync`) y, si
 * `options.watch` es `true`, observa desplazamientos continuos.
 */
export function useForegroundLocation(
  options?: ForegroundLocationOptions,
): ForegroundLocationResult {
  const watch = options?.watch ?? false;
  const accuracy = options?.accuracy ?? Location.Accuracy.Balanced;
  const distanceInterval = options?.distanceInterval ?? 15;
  const timeInterval = options?.timeInterval ?? 5000;
  const maxAccuracyMeters = options?.maxAccuracyMeters ?? 80;

  const [coords, setCoords] = useState<Location.LocationObjectCoords | null>(null);
  const [status, setStatus] = useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [watching, setWatching] = useState(false);
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

      try {
        const ultima = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
        if (ultima?.coords) {
          setCoords((prev) => prev ?? ultima.coords);
        }
      } catch {
        // Algunos emuladores no tienen caché previa; continuamos con getCurrentPositionAsync
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy });
      setCoords(pos.coords);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo obtener la ubicación.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [accuracy]);

  useEffect(() => {
    if (!watch || status !== 'granted') {
      setWatching(false);
      return;
    }

    let activo = true;
    let sub: Location.LocationSubscription | null = null;

    void Location.watchPositionAsync(
      {
        accuracy,
        distanceInterval,
        timeInterval,
      },
      (loc) => {
        if (!activo) return;
        setCoords((prev) => {
          if (
            prev &&
            loc.coords.accuracy != null &&
            loc.coords.accuracy > maxAccuracyMeters
          ) {
            return prev;
          }
          return loc.coords;
        });
      },
    )
      .then((suscripcion) => {
        if (!activo) {
          suscripcion.remove();
          return;
        }
        sub = suscripcion;
        setWatching(true);
      })
      .catch(() => {
        if (activo) {
          setWatching(false);
        }
      });

    return () => {
      activo = false;
      setWatching(false);
      sub?.remove();
    };
  }, [watch, status, accuracy, distanceInterval, timeInterval, maxAccuracyMeters]);

  return { coords, status, loading, watching, error, requestPermissionAndLocate };
}