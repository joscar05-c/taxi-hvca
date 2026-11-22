import * as Location from 'expo-location';

import {
  HUANCAVELICA_CENTRO,
  PUNTOS_SIMULACION_HVCA,
  type Coordenadas,
  type Profile,
} from '../domain/types';

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
const EXPRESION_PLUS_CODE = /^[A-Z0-9]{4,8}\+[A-Z0-9]{2,4}$/i;
const CACHE_DIRECCIONES_MAX = 40;
const CACHE_RADIO_KM = 0.03;

const cacheDirecciones: Array<{ coords: Coordenadas; direccion: string }> = [];

/**
 * Indica si unas coordenadas están fuera del área operativa de Huancavelica.
 */
export function estaFueraDeHuancavelica(
  coords: Coordenadas,
  radioKm = 100,
): boolean {
  const distanciaKm = calcularDistanciaHaversine(
    coords.latitude,
    coords.longitude,
    HUANCAVELICA_CENTRO.latitude,
    HUANCAVELICA_CENTRO.longitude,
  );
  return distanciaKm > radioKm;
}

/**
 * Avanza linealmente desde `desde` hacia `hacia` una distancia máxima `pasoKm`.
 */
export function avanzarHaciaDestino(
  desde: Coordenadas,
  hacia: Coordenadas,
  pasoKm = 0.08,
): Coordenadas {
  const distancia = calcularDistanciaHaversine(
    desde.latitude,
    desde.longitude,
    hacia.latitude,
    hacia.longitude,
  );
  if (distancia <= pasoKm || distancia === 0) {
    return { latitude: hacia.latitude, longitude: hacia.longitude };
  }

  const ratio = pasoKm / distancia;
  return {
    latitude: desde.latitude + (hacia.latitude - desde.latitude) * ratio,
    longitude: desde.longitude + (hacia.longitude - desde.longitude) * ratio,
  };
}

export async function obtenerDireccionLegible(coords: Coordenadas): Promise<string> {
  const enCache = cacheDirecciones.find(
    (item) =>
      calcularDistanciaHaversine(
        coords.latitude,
        coords.longitude,
        item.coords.latitude,
        item.coords.longitude,
      ) <= CACHE_RADIO_KM,
  );
  if (enCache) {
    return enCache.direccion;
  }

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
      const nombreLimpio =
        primer.name && !EXPRESION_PLUS_CODE.test(primer.name.trim())
          ? primer.name.trim()
          : '';
      const zona = (primer.district || primer.subregion || primer.city || '').trim();
      const calleBase = calleCompleta || nombreLimpio;

      const partes: string[] = [];
      if (calleBase) {
        partes.push(calleBase);
      }
      if (zona && (!calleBase || !calleBase.toLowerCase().includes(zona.toLowerCase()))) {
        partes.push(zona);
      }

      if (partes.length > 0) {
        const direccion = partes.join(', ');
        if (cacheDirecciones.length >= CACHE_DIRECCIONES_MAX) {
          cacheDirecciones.shift();
        }
        cacheDirecciones.push({
          coords: { latitude: coords.latitude, longitude: coords.longitude },
          direccion,
        });
        return direccion;
      }
    }
  } catch {
    // Fallback silencioso si el dispositivo no tiene servicios de geocodificación disponibles
  }

  return formatearReferenciaHuancavelica(coords);
}