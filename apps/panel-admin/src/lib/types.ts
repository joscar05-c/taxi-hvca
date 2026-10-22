export type UserRole = 'pasajero' | 'conductor' | 'admin';

export type RiderStatus = 'disponible' | 'en_viaje' | 'offline';

export type SolicitudEstado =
  | 'buscando'
  | 'aceptado'
  | 'en_camino_origen'
  | 'en_curso'
  | 'completado'
  | 'cancelada';

export interface Profile {
  id: string;
  rol: UserRole;
  nombre: string;
  telefono: string;
  email?: string;
  calificacion_promedio: number;
  estado: RiderStatus;
  esta_conectado: boolean;
  ubicacion_actual?: string | null;
  vehiculo?: string | null;
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
  precio_inicial: number;
  estado: SolicitudEstado;
  conductor_id: string | null;
  precio_final: number | null;
  created_at: string;
}

export interface OfertaConductor {
  id: string;
  solicitud_id: string;
  conductor_id: string;
  precio: number;
  created_at: string;
}
