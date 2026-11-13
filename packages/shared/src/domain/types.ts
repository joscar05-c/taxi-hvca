export type UserRole = 'pasajero' | 'conductor';

export type RiderStatus = 'disponible' | 'en_viaje' | 'offline';

/** Coordenadas geográficas (WGS84). */
export type Coordenadas = {
  latitude: number;
  longitude: number;
};

/** Coordenadas céntricas de Huancavelica para referencia y simulación en desarrollo/emulador. */
export const HUANCAVELICA_CENTRO: Coordenadas = {
  latitude: -12.7865,
  longitude: -74.9757,
};

/** Puntos representativos de Huancavelica para simulador y pruebas de campo. */
export const PUNTOS_SIMULACION_HVCA = [
  { id: 'plaza', nombre: 'Plaza de Armas', latitude: -12.7865, longitude: -74.9757 },
  { id: 'san_cristobal', nombre: 'San Cristóbal', latitude: -12.7892, longitude: -74.971 },
  { id: 'terminal', nombre: 'Terminal (Yananaco)', latitude: -12.781, longitude: -74.979 },
  { id: 'ascension', nombre: 'Ascensión', latitude: -12.7915, longitude: -74.982 },
] as const;

export type PuntoSimulacionHvca = (typeof PUNTOS_SIMULACION_HVCA)[number];

/**
 * Perfil de usuario en Cloud Firestore (`perfiles/{uid}`).
 * El campo `id` se vincula 1:1 con el UID de Firebase Authentication.
 */
export type Profile = {
  id: string;
  rol: UserRole;
  nombre: string;
  telefono: string;
  telefono_verificado?: boolean;
  email?: string | null;
  foto_url?: string | null;
  calificacion_promedio: number;
  estado: RiderStatus;
  esta_conectado: boolean;
  ubicacion_actual: string | null;
  vehiculo: string | null;
  created_at: string;
  updated_at: string;
};

/** Estado y registro del código SMS para verificación de número telefónico (`verificaciones_telefono/{uid}`). */
export type VerificacionTelefono = {
  usuario_id: string;
  telefono: string;
  codigo_hash: string;
  /** @deprecated Solo compatibilidad de lectura; nunca persistir código en texto plano. */
  codigo?: string;
  expira_en: string;
  intentos: number;
  verificado: boolean;
  created_at: string;
};

/** Estados del flujo en tiempo real (colección `solicitudes_viaje`). */
export type SolicitudEstado =
  | 'buscando'
  | 'aceptado'
  | 'en_camino_origen'
  | 'en_curso'
  | 'completado'
  | 'cancelada';

/**
 * Estados de avance permitidos por `actualizarEstadoViaje`: el viaje ya tiene
 * conductor (match), el conductor va por el pasajero, el pasajero subió o el
 * viaje terminó.
 */
export type SolicitudEnProgreso =
  | 'aceptado'
  | 'en_camino_origen'
  | 'en_curso'
  | 'completado';

/**
 * Solicitud de viaje publicada por un pasajero. El conductor hace ofertas
 * y el pasajero elige una (`precio_final` + `conductor_id` al aceptar).
 */
export type SolicitudViaje = {
  id: string;
  pasajero_id: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  precio_inicial: number;
  estado: SolicitudEstado;
  conductor_id: string | null;
  precio_final: number | null;
  created_at: string;
};

/** Oferta de precio hecha por un conductor para una solicitud. */
export type OfertaConductor = {
  id: string;
  solicitud_id: string;
  conductor_id: string;
  precio: number;
  created_at: string;
};

/** Parámetros globales de tarifas y comisiones gestionados desde el Panel Admin. */
export type ConfiguracionTarifas = {
  tarifa_base: number;
  precio_por_km: number;
  tarifa_minima: number;
  comision_porcentaje: number;
  updated_at: string;
  updated_by?: string | null;
};

export const TARIFAS_POR_DEFECTO: ConfiguracionTarifas = {
  tarifa_base: 3.5,
  precio_por_km: 1.8,
  tarifa_minima: 5.0,
  comision_porcentaje: 10,
  updated_at: '',
  updated_by: null,
};
