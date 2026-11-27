import * as Location from 'expo-location';

import {
  DESTINOS_FRECUENTES_HVCA,
  HUANCAVELICA_CENTRO,
  type Coordenadas,
} from '../domain/types';
import { calcularDistanciaHaversine } from './geo';

export type FuenteSugerencia =
  | 'google_places'
  | 'openstreetmap'
  | 'local'
  | 'nativo';

export interface SugerenciaLugar {
  id: string;
  titulo: string;
  subtitulo: string;
  direccionCompleta: string;
  fuente: FuenteSugerencia;
  /** Presente cuando la sugerencia proviene de Google Places y requiere Place Details para coordenadas. */
  placeId?: string;
  /** Coordenadas ya resueltas (disponibles de inmediato en OSM, locales y nativo). */
  coords?: Coordenadas;
  /** Distancia aproximada en km desde el punto de referencia (origen o centro de Huancavelica). */
  distanciaKm?: number;
}

export interface OpcionesBusquedaLugares {
  apiKey?: string;
  origenReferencia?: Coordenadas | null;
  sessionToken?: string;
  androidPackage?: string;
  androidCert?: string;
  signal?: AbortSignal;
}

export interface ResultadoBusquedaLugares {
  sugerencias: SugerenciaLugar[];
  fuenteUsada: FuenteSugerencia | 'ninguna';
  googleBloqueado?: boolean;
}

const RADIO_SESGO_METROS = 20000;
const RADIO_MAX_OSM_KM = 60;

/**
 * Genera un token UUID v4 por sesión de autocompletado de Google Places
 * (agrupa las teclas + selección final como una sola sesión facturable).
 */
export function generarSessionToken(): string {
  const segmento = (len: number) =>
    Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join(
      '',
    );
  return `${segmento(8)}-${segmento(4)}-4${segmento(3)}-a${segmento(3)}-${segmento(12)}`;
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buscarLocales(
  query: string,
  referencia: Coordenadas,
): SugerenciaLugar[] {
  const q = normalizarTexto(query);
  if (q.length < 2) return [];

  return DESTINOS_FRECUENTES_HVCA.filter((d) => {
    const texto = normalizarTexto(`${d.nombre} ${d.direccion}`);
    return texto.includes(q);
  }).map((d) => {
    const coords: Coordenadas = { latitude: d.latitude, longitude: d.longitude };
    return {
      id: `local-${d.id}`,
      titulo: d.nombre,
      subtitulo: d.direccion,
      direccionCompleta: d.direccion,
      fuente: 'local',
      coords,
      distanciaKm: calcularDistanciaHaversine(
        referencia.latitude,
        referencia.longitude,
        coords.latitude,
        coords.longitude,
      ),
    };
  });
}

function construirHeadersGoogle(
  apiKey: string,
  fieldMask?: string,
  androidPackage?: string,
  androidCert?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
  };
  if (fieldMask) {
    headers['X-Goog-FieldMask'] = fieldMask;
  }
  if (androidPackage) {
    headers['X-Android-Package'] = androidPackage;
  }
  if (androidCert) {
    headers['X-Android-Cert'] = androidCert.replace(/:/g, '').toUpperCase();
  }
  return headers;
}

/**
 * 1) Intento principal: Google Places API (New) — Autocomplete.
 */
async function buscarConGooglePlacesNew(
  query: string,
  referencia: Coordenadas,
  opciones: OpcionesBusquedaLugares,
): Promise<{ sugerencias: SugerenciaLugar[]; bloqueado: boolean } | null> {
  if (!opciones.apiKey) return null;

  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: construirHeadersGoogle(
        opciones.apiKey,
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.distanceMeters',
        opciones.androidPackage,
        opciones.androidCert,
      ),
      body: JSON.stringify({
        input: query,
        languageCode: 'es',
        regionCode: 'PE',
        includedRegionCodes: ['PE'],
        origin: {
          latitude: referencia.latitude,
          longitude: referencia.longitude,
        },
        locationBias: {
          circle: {
            center: {
              latitude: HUANCAVELICA_CENTRO.latitude,
              longitude: HUANCAVELICA_CENTRO.longitude,
            },
            radius: RADIO_SESGO_METROS,
          },
        },
        ...(opciones.sessionToken ? { sessionToken: opciones.sessionToken } : {}),
      }),
      signal: opciones.signal,
    });

    if (!resp.ok) {
      return { sugerencias: [], bloqueado: resp.status === 403 || resp.status === 401 };
    }

    const data = (await resp.json()) as {
      suggestions?: Array<{
        placePrediction?: {
          placeId?: string;
          text?: { text?: string };
          structuredFormat?: {
            mainText?: { text?: string };
            secondaryText?: { text?: string };
          };
          distanceMeters?: number;
        };
      }>;
    };

    const lista: SugerenciaLugar[] = [];
    for (const item of data.suggestions ?? []) {
      const pred = item.placePrediction;
      if (!pred?.placeId) continue;
      const titulo =
        pred.structuredFormat?.mainText?.text?.trim() ||
        pred.text?.text?.trim() ||
        '';
      if (!titulo) continue;
      const subtitulo =
        pred.structuredFormat?.secondaryText?.text?.trim() || 'Huancavelica, Perú';
      const direccionCompleta =
        pred.text?.text?.trim() || `${titulo}, ${subtitulo}`;

      lista.push({
        id: `gp-${pred.placeId}`,
        placeId: pred.placeId,
        titulo,
        subtitulo,
        direccionCompleta,
        fuente: 'google_places',
        distanciaKm:
          typeof pred.distanceMeters === 'number'
            ? pred.distanceMeters / 1000
            : undefined,
      });
    }

    return { sugerencias: lista, bloqueado: false };
  } catch (e) {
    if (opciones.signal?.aborted) throw e;
    return null;
  }
}

/**
 * 2) Intento alternativo: Google Places API clásica (por si la clave tiene Places Legacy habilitada).
 */
async function buscarConGooglePlacesLegacy(
  query: string,
  referencia: Coordenadas,
  opciones: OpcionesBusquedaLugares,
): Promise<{ sugerencias: SugerenciaLugar[]; bloqueado: boolean } | null> {
  if (!opciones.apiKey) return null;

  try {
    const params = new URLSearchParams({
      input: query,
      language: 'es',
      components: 'country:pe',
      location: `${HUANCAVELICA_CENTRO.latitude},${HUANCAVELICA_CENTRO.longitude}`,
      radius: String(RADIO_SESGO_METROS),
      origin: `${referencia.latitude},${referencia.longitude}`,
      key: opciones.apiKey,
    });
    if (opciones.sessionToken) {
      params.set('sessiontoken', opciones.sessionToken);
    }

    const headers: Record<string, string> = {};
    if (opciones.androidPackage) {
      headers['X-Android-Package'] = opciones.androidPackage;
    }
    if (opciones.androidCert) {
      headers['X-Android-Cert'] = opciones.androidCert
        .replace(/:/g, '')
        .toUpperCase();
    }

    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      { headers, signal: opciones.signal },
    );
    if (!resp.ok) {
      return { sugerencias: [], bloqueado: resp.status === 403 || resp.status === 401 };
    }

    const data = (await resp.json()) as {
      status?: string;
      predictions?: Array<{
        place_id?: string;
        description?: string;
        distance_meters?: number;
        structured_formatting?: {
          main_text?: string;
          secondary_text?: string;
        };
      }>;
    };

    if (data.status === 'REQUEST_DENIED') {
      return { sugerencias: [], bloqueado: true };
    }
    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      return null;
    }

    const lista: SugerenciaLugar[] = [];
    for (const p of data.predictions ?? []) {
      if (!p.place_id) continue;
      const titulo =
        p.structured_formatting?.main_text?.trim() ||
        p.description?.trim() ||
        '';
      if (!titulo) continue;
      const subtitulo =
        p.structured_formatting?.secondary_text?.trim() || 'Huancavelica, Perú';

      lista.push({
        id: `gp-${p.place_id}`,
        placeId: p.place_id,
        titulo,
        subtitulo,
        direccionCompleta: p.description?.trim() || `${titulo}, ${subtitulo}`,
        fuente: 'google_places',
        distanciaKm:
          typeof p.distance_meters === 'number'
            ? p.distance_meters / 1000
            : undefined,
      });
    }

    return { sugerencias: lista, bloqueado: false };
  } catch (e) {
    if (opciones.signal?.aborted) throw e;
    return null;
  }
}

/**
 * 3) Respaldo abierto (Photon / OpenStreetMap) sesgado a Huancavelica, Perú.
 */
async function buscarConPhoton(
  query: string,
  referencia: Coordenadas,
  signal?: AbortSignal,
): Promise<SugerenciaLugar[]> {
  try {
    const qConCiudad = normalizarTexto(query).includes('huancavelica')
      ? query
      : `${query}, Huancavelica`;
    const params = new URLSearchParams({
      q: qConCiudad,
      lat: String(HUANCAVELICA_CENTRO.latitude),
      lon: String(HUANCAVELICA_CENTRO.longitude),
      limit: '8',
    });

    const resp = await fetch(`https://photon.komoot.io/api/?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal,
    });
    if (!resp.ok) return [];

    const data = (await resp.json()) as {
      features?: Array<{
        geometry?: { coordinates?: [number, number] };
        properties?: {
          osm_id?: number;
          osm_type?: string;
          name?: string;
          street?: string;
          housenumber?: string;
          district?: string;
          city?: string;
          county?: string;
          state?: string;
          countrycode?: string;
        };
      }>;
    };

    const resultados: SugerenciaLugar[] = [];
    const vistos = new Set<string>();

    for (const feat of data.features ?? []) {
      const coordsArr = feat.geometry?.coordinates;
      const props = feat.properties;
      if (!coordsArr || coordsArr.length < 2 || !props) continue;

      const [lng, lat] = coordsArr;
      if (props.countrycode && props.countrycode.toUpperCase() !== 'PE') {
        continue;
      }

      const distHvca = calcularDistanciaHaversine(
        HUANCAVELICA_CENTRO.latitude,
        HUANCAVELICA_CENTRO.longitude,
        lat,
        lng,
      );
      if (distHvca > RADIO_MAX_OSM_KM) continue;

      const calle = [props.street, props.housenumber].filter(Boolean).join(' ').trim();
      const titulo = (props.name || calle || props.district || '').trim();
      if (!titulo) continue;

      const partesSub = [
        calle && calle !== titulo ? calle : null,
        props.district && props.district !== titulo ? props.district : null,
        props.city || props.county || 'Huancavelica',
      ].filter((p): p is string => Boolean(p && p.trim().length > 0));
      const subtitulo = Array.from(new Set(partesSub)).join(', ');

      const claveDedup = normalizarTexto(`${titulo}|${subtitulo}`);
      if (vistos.has(claveDedup)) continue;
      vistos.add(claveDedup);

      const coords: Coordenadas = { latitude: lat, longitude: lng };
      resultados.push({
        id: `osm-${props.osm_type ?? 'n'}-${props.osm_id ?? resultados.length}-${lat.toFixed(4)}`,
        titulo,
        subtitulo,
        direccionCompleta: subtitulo ? `${titulo}, ${subtitulo}` : titulo,
        fuente: 'openstreetmap',
        coords,
        distanciaKm: calcularDistanciaHaversine(
          referencia.latitude,
          referencia.longitude,
          lat,
          lng,
        ),
      });
    }

    return resultados.sort(
      (a, b) => (a.distanciaKm ?? 999) - (b.distanciaKm ?? 999),
    );
  } catch (e) {
    if (signal?.aborted) throw e;
    return [];
  }
}

/**
 * 4) Último respaldo usando el geocodificador nativo de Android/iOS (`expo-location`).
 */
async function buscarConGeocoderNativo(
  query: string,
  referencia: Coordenadas,
): Promise<SugerenciaLugar[]> {
  try {
    const texto = normalizarTexto(query).includes('huancavelica')
      ? query
      : `${query}, Huancavelica, Perú`;
    const encontrados = await Location.geocodeAsync(texto);
    return encontrados
      .slice(0, 4)
      .filter((loc) => {
        const d = calcularDistanciaHaversine(
          HUANCAVELICA_CENTRO.latitude,
          HUANCAVELICA_CENTRO.longitude,
          loc.latitude,
          loc.longitude,
        );
        return d <= RADIO_MAX_OSM_KM;
      })
      .map((loc, idx) => {
        const coords: Coordenadas = {
          latitude: loc.latitude,
          longitude: loc.longitude,
        };
        return {
          id: `nat-${idx}-${loc.latitude.toFixed(4)}`,
          titulo: query.trim(),
          subtitulo: 'Huancavelica, Perú',
          direccionCompleta: `${query.trim()}, Huancavelica`,
          fuente: 'nativo',
          coords,
          distanciaKm: calcularDistanciaHaversine(
            referencia.latitude,
            referencia.longitude,
            loc.latitude,
            loc.longitude,
          ),
        };
      });
  } catch {
    return [];
  }
}

/**
 * Busca direcciones y lugares con autocompletado:
 * 1) Google Places API (New) / Legacy si hay `apiKey` habilitada.
 * 2) Respaldo automático con Photon/OpenStreetMap + destinos frecuentes locales + geocoder nativo.
 */
export async function buscarDirecciones(
  query: string,
  opciones: OpcionesBusquedaLugares = {},
): Promise<ResultadoBusquedaLugares> {
  const limpio = query.trim();
  const referencia = opciones.origenReferencia ?? HUANCAVELICA_CENTRO;

  if (limpio.length < 2) {
    return { sugerencias: [], fuenteUsada: 'ninguna' };
  }

  let googleBloqueado = false;

  if (opciones.apiKey) {
    const resNew = await buscarConGooglePlacesNew(limpio, referencia, opciones);
    if (resNew && resNew.sugerencias.length > 0) {
      return {
        sugerencias: resNew.sugerencias,
        fuenteUsada: 'google_places',
        googleBloqueado: false,
      };
    }
    if (resNew?.bloqueado) {
      googleBloqueado = true;
    }

    const resLegacy = await buscarConGooglePlacesLegacy(limpio, referencia, opciones);
    if (resLegacy && resLegacy.sugerencias.length > 0) {
      return {
        sugerencias: resLegacy.sugerencias,
        fuenteUsada: 'google_places',
        googleBloqueado: false,
      };
    }
    if (resLegacy?.bloqueado) {
      googleBloqueado = true;
    }
  }

  const locales = buscarLocales(limpio, referencia);
  const osm = await buscarConPhoton(limpio, referencia, opciones.signal);

  const combinados: SugerenciaLugar[] = [...locales];
  const titulosExistentes = new Set(locales.map((l) => normalizarTexto(l.titulo)));
  for (const item of osm) {
    if (!titulosExistentes.has(normalizarTexto(item.titulo))) {
      combinados.push(item);
      titulosExistentes.add(normalizarTexto(item.titulo));
    }
  }

  if (combinados.length > 0) {
    return {
      sugerencias: combinados.slice(0, 8),
      fuenteUsada: osm.length > 0 ? 'openstreetmap' : 'local',
      googleBloqueado,
    };
  }

  const nativos = await buscarConGeocoderNativo(limpio, referencia);
  return {
    sugerencias: nativos,
    fuenteUsada: nativos.length > 0 ? 'nativo' : 'ninguna',
    googleBloqueado,
  };
}

/**
 * Resuelve las coordenadas exactas de una sugerencia seleccionada.
 * Si ya trae `coords` (OSM / local / nativo) las devuelve al instante;
 * si proviene de Google Places (`placeId`), consulta Place Details.
 */
export async function obtenerDetalleLugar(
  sugerencia: SugerenciaLugar,
  opciones: Pick<
    OpcionesBusquedaLugares,
    'apiKey' | 'sessionToken' | 'androidPackage' | 'androidCert'
  > = {},
): Promise<{ coords: Coordenadas; direccion: string } | null> {
  if (sugerencia.coords) {
    return {
      coords: sugerencia.coords,
      direccion: sugerencia.direccionCompleta || sugerencia.titulo,
    };
  }

  if (!sugerencia.placeId || !opciones.apiKey) {
    return null;
  }

  // 1) Places API (New) — Place Details
  try {
    const params = new URLSearchParams({ languageCode: 'es' });
    if (opciones.sessionToken) {
      params.set('sessionToken', opciones.sessionToken);
    }
    const resp = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(sugerencia.placeId)}?${params.toString()}`,
      {
        headers: construirHeadersGoogle(
          opciones.apiKey,
          'id,displayName,formattedAddress,location',
          opciones.androidPackage,
          opciones.androidCert,
        ),
      },
    );
    if (resp.ok) {
      const data = (await resp.json()) as {
        displayName?: { text?: string };
        formattedAddress?: string;
        location?: { latitude?: number; longitude?: number };
      };
      if (
        typeof data.location?.latitude === 'number' &&
        typeof data.location?.longitude === 'number'
      ) {
        return {
          coords: {
            latitude: data.location.latitude,
            longitude: data.location.longitude,
          },
          direccion:
            data.displayName?.text?.trim() ||
            data.formattedAddress?.trim() ||
            sugerencia.direccionCompleta,
        };
      }
    }
  } catch {
    // Continuar con Places Details clásico
  }

  // 2) Places API clásica — Place Details
  try {
    const params = new URLSearchParams({
      place_id: sugerencia.placeId,
      fields: 'name,formatted_address,geometry',
      language: 'es',
      key: opciones.apiKey,
    });
    if (opciones.sessionToken) {
      params.set('sessiontoken', opciones.sessionToken);
    }
    const headers: Record<string, string> = {};
    if (opciones.androidPackage) {
      headers['X-Android-Package'] = opciones.androidPackage;
    }
    if (opciones.androidCert) {
      headers['X-Android-Cert'] = opciones.androidCert
        .replace(/:/g, '')
        .toUpperCase();
    }

    const resp = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      { headers },
    );
    if (resp.ok) {
      const data = (await resp.json()) as {
        result?: {
          name?: string;
          formatted_address?: string;
          geometry?: { location?: { lat?: number; lng?: number } };
        };
      };
      const lat = data.result?.geometry?.location?.lat;
      const lng = data.result?.geometry?.location?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        return {
          coords: { latitude: lat, longitude: lng },
          direccion:
            data.result?.name?.trim() ||
            data.result?.formatted_address?.trim() ||
            sugerencia.direccionCompleta,
        };
      }
    }
  } catch {
    // Fallback abajo
  }

  // 3) Fallback nativo con el texto de la sugerencia
  try {
    const geocod = await Location.geocodeAsync(sugerencia.direccionCompleta);
    if (geocod[0]) {
      return {
        coords: {
          latitude: geocod[0].latitude,
          longitude: geocod[0].longitude,
        },
        direccion: sugerencia.direccionCompleta,
      };
    }
  } catch {
    // Sin resultado
  }

  return null;
}
