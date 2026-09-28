import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';

export interface UseBackgroundLocationResult {
  /** true si la tarea de ubicación está activa. */
  isTracking: boolean;
  loading: boolean;
  error: string | null;
  /** Pide permisos (foreground + background) e inicia el tracking. */
  startTracking: () => Promise<boolean>;
  /** Detiene la tarea de ubicación. */
  stopTracking: () => Promise<void>;
}

/**
 * Seguimiento de ubicación en segundo plano vía `expo-task-manager`.
 * La tarea debe existir y estar registrada en la app (ej. `locationTask.ts`).
 * En iOS requiere un development build: Expo Go no soporta background location.
 */
export function useBackgroundLocation(
  taskName: string = 'BACKGROUND_LOCATION_TASK',
): UseBackgroundLocationResult {
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sincroniza el estado inicial si la tarea quedó activa de una sesión previa.
  useEffect(() => {
    let activo = true;
    Location.hasStartedLocationUpdatesAsync(taskName)
      .then((iniciado) => {
        if (activo) setIsTracking(iniciado);
      })
      .catch(() => undefined);
    return () => {
      activo = false;
    };
  }, [taskName]);

  async function startTracking(): Promise<boolean> {
    setError(null);
    setLoading(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== 'granted') {
        setError('Se necesita permiso de ubicación en primer plano.');
        return false;
      }

      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== 'granted') {
        setError(
          'Se necesita permiso de ubicación en segundo plano. Actívalo en los ajustes del teléfono.',
        );
        return false;
      }

      const iniciado = await Location.hasStartedLocationUpdatesAsync(taskName);
      if (!iniciado) {
        await Location.startLocationUpdatesAsync(taskName, {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 10,
          deferredUpdatesInterval: 5000,
        });
      }

      setIsTracking(true);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el seguimiento.');
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function stopTracking(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const iniciado = await Location.hasStartedLocationUpdatesAsync(taskName);
      if (iniciado) {
        await Location.stopLocationUpdatesAsync(taskName);
      }
      setIsTracking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo detener el seguimiento.');
    } finally {
      setLoading(false);
    }
  }

  return { isTracking, loading, error, startTracking, stopTracking };
}