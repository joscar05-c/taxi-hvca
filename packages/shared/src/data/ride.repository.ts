import type { RideRequest, RideStatus } from '../domain/types';
import { getSupabaseClient } from './supabase';

const TABLA = 'ride_requests';

export const rideRepository = {
  /** Crea una solicitud de viaje desde el origen hacia el destino. */
  async crearSolicitud(input: {
    pasajeroId: string;
    origen: { lat: number; lng: number };
    destino: { lat: number; lng: number };
    tarifaEstimada: number;
  }): Promise<RideRequest> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLA)
      .insert({
        pasajero_id: input.pasajeroId,
        origen_lat: input.origen.lat,
        origen_lng: input.origen.lng,
        destino_lat: input.destino.lat,
        destino_lng: input.destino.lng,
        tarifa_estimada: input.tarifaEstimada,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async obtenerSolicitudesPendientes(): Promise<RideRequest[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLA)
      .select('*')
      .eq('estado', 'solicitada')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  },

  async actualizarSolicitud(
    id: string,
    cambios: { estado?: RideStatus; conductorId?: string },
  ): Promise<RideRequest> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(TABLA)
      .update({
        estado: cambios.estado,
        conductor_id: cambios.conductorId,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },
};