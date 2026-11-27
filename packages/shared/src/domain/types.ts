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

/** Destinos frecuentes en Huancavelica para selección rápida de 1 toque en el mapa. */
export const DESTINOS_FRECUENTES_HVCA = [
  {
    id: 'plaza_armas',
    nombre: 'Plaza de Armas',
    direccion: 'Plaza de Armas, Huancavelica',
    latitude: -12.7865,
    longitude: -74.9757,
  },
  {
    id: 'terminal',
    nombre: 'Terminal Terrestre',
    direccion: 'Terminal Terrestre (Yananaco), Huancavelica',
    latitude: -12.781,
    longitude: -74.979,
  },
  {
    id: 'hospital',
    nombre: 'Hospital Regional',
    direccion: 'Hospital Departamental, Huancavelica',
    latitude: -12.7834,
    longitude: -74.9682,
  },
  {
    id: 'unh',
    nombre: 'UNH Paturpampa',
    direccion: 'Universidad Nacional de Huancavelica (Paturpampa)',
    latitude: -12.7788,
    longitude: -74.9652,
  },
  {
    id: 'san_cristobal',
    nombre: 'San Cristóbal',
    direccion: 'Barrio San Cristóbal, Huancavelica',
    latitude: -12.7892,
    longitude: -74.971,
  },
  {
    id: 'ascension',
    nombre: 'Ascensión',
    direccion: 'Distrito de Ascensión, Huancavelica',
    latitude: -12.7915,
    longitude: -74.982,
  },
] as const;

export type DestinoFrecuenteHvca = (typeof DESTINOS_FRECUENTES_HVCA)[number];

export type EstadoDocumentosConductor =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado';

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
  total_calificaciones?: number;
  estado: RiderStatus;
  esta_conectado: boolean;
  ubicacion_actual: string | null;
  ubicacion_lat?: number | null;
  ubicacion_lng?: number | null;
  vehiculo: string | null;
  dni_conductor?: string | null;
  licencia_conductor?: string | null;
  soat_conductor?: string | null;
  estado_documentos?: EstadoDocumentosConductor;
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
  origen_direccion?: string | null;
  destino_direccion?: string | null;
  distancia_km?: number | null;
  precio_inicial: number;
  estado: SolicitudEstado;
  conductor_id: string | null;
  precio_final: number | null;
  calificacion_conductor?: number | null;
  calificacion_pasajero?: number | null;
  comentario_calificacion?: string | null;
  cancelado_por?: 'pasajero' | 'conductor' | 'admin' | null;
  motivo_cancelacion?: string | null;
  created_at: string;
};

/** Oferta de precio hecha por un conductor para una solicitud. */
export type OfertaConductor = {
  id: string;
  solicitud_id: string;
  conductor_id: string;
  precio: number;
  conductor_nombre?: string;
  conductor_vehiculo?: string | null;
  conductor_calificacion?: number;
  conductor_telefono?: string;
  created_at: string;
};

/** Registro de calificación mutua al finalizar un viaje. */
export type CalificacionViaje = {
  id: string;
  solicitud_id: string;
  evaluador_id: string;
  evaluado_id: string;
  rol_evaluador: UserRole;
  estrellas: number;
  comentario?: string | null;
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
