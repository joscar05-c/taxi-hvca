export type UserRole = 'pasajero' | 'conductor';

export type RiderStatus = 'disponible' | 'en_viaje' | 'offline';

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
    };
    Views: {};
    Functions: {};
  };
};