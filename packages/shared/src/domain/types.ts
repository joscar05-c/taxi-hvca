export type UserRole = 'pasajero' | 'conductor';

export type RiderStatus = 'disponible' | 'en_viaje' | 'offline';

/** Coordenadas geográficas (WGS84). */
export type Coordenadas = {
  latitude: number;
  longitude: number;
};

/**
 * Perfil de usuario en Supabase. La columna `id` se vincula 1:1 con
 * `auth.users.id`. Debe ser `type` (no `interface`): las interfaces no
 * reciben index signatures implícitas y rompen el tipado del cliente.
 */
export type Profile = {
  id: string;
  rol: UserRole;
  nombre: string;
  telefono: string;
  calificacion_promedio: number;
  estado: RiderStatus;
  esta_conectado: boolean;
  ubicacion_actual: string | null;
  created_at: string;
  updated_at: string;
};

export type RideStatus =
  | 'solicitada'
  | 'aceptada'
  | 'en_ruta_al_pasajero'
  | 'en_viaje'
  | 'finalizada'
  | 'cancelada';

/** Estados del flujo en tiempo real (tabla `solicitudes_viaje`). */
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

export type RideRequest = {
  id: string;
  pasajero_id: string;
  origen_lat: number;
  origen_lng: number;
  destino_lat: number;
  destino_lng: number;
  tarifa_estimada: number;
  estado: RideStatus;
  conductor_id: string | null;
  created_at: string;
};

/**
 * Esquema de la base de datos consumido por el cliente de Supabase.
 * Se ajusta al genérico `GenericSchema` de @supabase/supabase-js v2.
 * OJO: debe ser un `type` (no `interface`) — solo los aliases de tipo
 * reciben la *implicit index signature* que `Table` exige para
 * conformar con `Record<string, GenericTable>`.
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<
          Profile,
          'id' | 'created_at' | 'updated_at' | 'esta_conectado' | 'ubicacion_actual'
        > & {
          id: string;
          esta_conectado?: boolean;
          ubicacion_actual?: string | null;
        };
        Update: Partial<Profile>;
        Relationships: [];
      };
      ride_requests: {
        Row: RideRequest;
        Insert: Omit<
          RideRequest,
          'id' | 'estado' | 'conductor_id' | 'created_at'
        >;
        Update: Partial<Pick<RideRequest, 'estado' | 'conductor_id'>>;
        Relationships: [];
      };
      solicitudes_viaje: {
        Row: SolicitudViaje;
        Insert: Omit<
          SolicitudViaje,
          'id' | 'estado' | 'created_at' | 'conductor_id' | 'precio_final'
        >;
        Update: Partial<SolicitudViaje>;
        Relationships: [];
      };
      ofertas_conductores: {
        Row: OfertaConductor;
        Insert: Omit<OfertaConductor, 'id' | 'created_at'>;
        Update: Partial<OfertaConductor>;
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
  };
};