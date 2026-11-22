import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { authRepository, calcularDistanciaHaversine } from '@hvca/shared';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

const INTERVALO_MINIMO_MS = 4000;
const INTERVALO_HEARTBEAT_MS = 15000;
const DISTANCIA_MINIMA_KM = 0.015;

let ultimoEnvio: { latitude: number; longitude: number; timestamp: number } | null = null;

/**
 * Tarea de expo-task-manager que corre en segundo plano. Recibe los puntos
 * reportados por `startLocationUpdatesAsync` y persiste la última ubicación
 * del conductor en `perfiles.ubicacion_actual` con throttling de tiempo/distancia.
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
  const ahora = Date.now();
  const previo = ultimoEnvio;

  if (previo) {
    const transcurridoMs = ahora - previo.timestamp;
    if (transcurridoMs < INTERVALO_MINIMO_MS) return;

    const distanciaKm = calcularDistanciaHaversine(
      previo.latitude,
      previo.longitude,
      latitude,
      longitude,
    );
    if (distanciaKm < DISTANCIA_MINIMA_KM && transcurridoMs < INTERVALO_HEARTBEAT_MS) {
      return;
    }
  }

  ultimoEnvio = { latitude, longitude, timestamp: ahora };
  try {
    await authRepository.actualizarUbicacion(latitude, longitude);
  } catch (e) {
    ultimoEnvio = previo;
    console.warn('[ubicacion-fondo] no se pudo guardar la ubicación:', e);
  }
});