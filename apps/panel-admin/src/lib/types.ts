export type UserRole = 'pasajero' | 'conductor' | 'admin';

export type RiderStatus = 'disponible' | 'en_viaje' | 'offline';

export type SolicitudEstado =
  | 'buscando'
  | 'aceptado'
  | 'en_camino_origen'
  | 'en_curso'
  | 'completado'
  | 'cancelada';

export type EstadoDocumentosConductor =
  | 'pendiente'
  | 'en_revision'
  | 'aprobado'
  | 'rechazado';

export interface Profile {
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
  ubicacion_actual?: string | null;
  ubicacion_lat?: number | null;
  ubicacion_lng?: number | null;
  vehiculo?: string | null;
  dni_conductor?: string | null;
  licencia_conductor?: string | null;
  soat_conductor?: string | null;
  estado_documentos?: EstadoDocumentosConductor;
  created_at: string;
  updated_at: string;
}

export interface SolicitudViaje {
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
  created_at: string;
}

export interface OfertaConductor {
  id: string;
  solicitud_id: string;
  conductor_id: string;
  precio: number;
  conductor_nombre?: string;
  conductor_vehiculo?: string | null;
  conductor_calificacion?: number;
  conductor_telefono?: string;
  created_at: string;
}

export interface ConfiguracionTarifas {
  tarifa_base: number;
  precio_por_km: number;
  tarifa_minima: number;
  comision_porcentaje: number;
  updated_at: string;
  updated_by?: string | null;
}
