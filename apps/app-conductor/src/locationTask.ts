import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { authRepository } from '@hvca/shared';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

/**
 * Tarea de expo-task-manager que corre en segundo plano. Recibe los puntos
 * reportados por `startLocationUpdatesAsync` y persiste la última ubicación
 * del conductor en `profiles.ubicacion_actual` (columna PostGIS geometry).
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.warn('[ubicacion-fondo] error en la tarea:', error);
    return;
  }

  const { locations } = data as { locations: Location.LocationObject[] };
  const ultima = locations?.[locations.length - 1];
  if (!ultima) return;

  const { latitude, longitude } = ultima.coords;
  try {
    await authRepository.actualizarUbicacion(latitude, longitude);
  } catch (e) {
    console.warn('[ubicacion-fondo] no se pudo guardar la ubicación:', e);
  }
});