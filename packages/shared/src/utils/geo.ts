import * as Location from 'expo-location';

import { PUNTOS_SIMULACION_HVCA, type Coordenadas, type Profile } from '../domain/types';

const RADIO_TIERRA_KM = 6371;

/**
 * Distancia en kilómetros entre dos coordenadas usando la fórmula de
 * Haversine (superficie esférica). Aproximada, no toma relieve.
 */
export function calcularDistanciaHaversine(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return RADIO_TIERRA_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Extrae las coordenadas actuales de un perfil priorizando los campos numéricos
 * `ubicacion_lat` / `ubicacion_lng` y haciendo fallback al string EWKT `POINT(lng lat)`.
 */
export function extraerCoordenadasPerfil(
  perfil: Pick<Profile, 'ubicacion_lat' | 'ubicacion_lng' | 'ubicacion_actual'> | null | undefined,
): Coordenadas | null {
  if (
    typeof perfil?.ubicacion_lat === 'number' &&
    Number.isFinite(perfil.ubicacion_lat) &&
    typeof perfil?.ubicacion_lng === 'number' &&
    Number.isFinite(perfil.ubicacion_lng)
  ) {
    return { latitude: perfil.ubicacion_lat, longitude: perfil.ubicacion_lng };
  }

  const match = perfil?.ubicacion_actual?.match(
    /POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i,
  );
  if (!match || !match[1] || !match[2]) return null;
  const lat = parseFloat(match[2]);
  const lng = parseFloat(match[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { latitude: lat, longitude: lng };
}

/**
 * Formatea unas coordenadas a una referencia rápida dentro de Huancavelica.
 */
export function formatearReferenciaHuancavelica(coords: Coordenadas): string {
  let puntoMasCercano: (typeof PUNTOS_SIMULACION_HVCA)[number] | null = null;
  let menorDistanciaKm = Infinity;

  for (const punto of PUNTOS_SIMULACION_HVCA) {
    const d = calcularDistanciaHaversine(
      coords.latitude,
      coords.longitude,
      punto.latitude,
      punto.longitude,
    );
    if (d < 0.8 && d < menorDistanciaKm) {
      menorDistanciaKm = d;
      puntoMasCercano = punto;
    }
  }

  if (puntoMasCercano) {
    return `Cerca de ${puntoMasCercano.nombre}`;
  }

  return `Huancavelica (${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)})`;
}

/**
 * Resuelve una dirección legible mediante geocodificación inversa de Expo Location,
 * con fallback automático a la referencia local en Huancavelica.
 */
export async function obtenerDireccionLegible(coords: Coordenadas): Promise<string> {
  try {
    const resultados = await Location.reverseGeocodeAsync({
      latitude: coords.latitude,
      longitude: coords.longitude,
    });
    const primer = resultados[0];
    if (primer) {
      const calleCompleta = [primer.street, primer.streetNumber]
        .filter(Boolean)
        .join(' ')
        .trim();
      const zona = primer.district || primer.subregion || primer.city;
      const partes = [
        calleCompleta || primer.name || null,
        zona || null,
      ].filter((p): p is string => Boolean(p && p.trim().length > 0));

      if (partes.length > 0) {
        return partes.join(', ');
      }
    }
  } catch {
    // Fallback silencioso si el dispositivo no tiene servicios de geocodificación disponibles
  }

  return formatearReferenciaHuancavelica(coords);
}