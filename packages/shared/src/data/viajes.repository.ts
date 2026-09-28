import type { Coordenadas, OfertaConductor, SolicitudViaje } from '../domain/types';
import { supabase } from './supabaseClient';

/** Canal Realtime compartido para las solicitudes nuevas. */
const CANAL_NUEVAS_SOLICITUDES = 'nuevas-solicitudes';

/**
 * Capa de datos del flujo de viajes en tiempo real: solicitudes del pasajero
 * y ofertas de los conductores, más suscripciones vía WebSockets de Supabase.
 */
export const viajesRepository = {
  /**
   * Publica una solicitud de viaje en `solicitudes_viaje` con estado
   * `buscando` (queda visible para los conductores suscritos).
   */
  async crearSolicitud(
    pasajeroId: string,
    origen: Coordenadas,
    destino: Coordenadas,
    precioInicial: number,
  ): Promise<SolicitudViaje> {
    const { data, error } = await supabase
      .from('solicitudes_viaje')
      .insert({
        pasajero_id: pasajeroId,
        origen_lat: origen.latitude,
        origen_lng: origen.longitude,
        destino_lat: destino.latitude,
        destino_lng: destino.longitude,
        precio_inicial: precioInicial,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /** Registra la oferta de un conductor para una solicitud. */
  async enviarOferta(
    solicitudId: string,
    conductorId: string,
    precio: number,
  ): Promise<OfertaConductor> {
    const { data, error } = await supabase
      .from('ofertas_conductores')
      .insert({
        solicitud_id: solicitudId,
        conductor_id: conductorId,
        precio,
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /** El pasajero acepta la oferta: la solicitud pasa a estado `aceptado`. */
  async aceptarOferta(
    solicitudId: string,
    conductorId: string,
    precioFinal: number,
  ): Promise<SolicitudViaje> {
    const { data, error } = await supabase
      .from('solicitudes_viaje')
      .update({
        estado: 'aceptado',
        conductor_id: conductorId,
        precio_final: precioFinal,
      })
      .eq('id', solicitudId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Escucha en tiempo real la aparición de solicitudes en estado `buscando`.
   * Devuelve una función para cancelar la suscripción.
   */
  suscribirNuevasSolicitudes(
    callback: (solicitud: SolicitudViaje) => void,
  ): () => void {
    const canal = supabase
      .channel(CANAL_NUEVAS_SOLICITUDES)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'solicitudes_viaje',
          filter: 'estado=eq.buscando',
        },
        (payload) => callback(payload.new as SolicitudViaje),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  },

  /**
   * Escucha en tiempo real las ofertas recibidas para una solicitud.
   * Devuelve una función para cancelar la suscripción.
   */
  suscribirOfertas(
    solicitudId: string,
    callback: (oferta: OfertaConductor) => void,
  ): () => void {
    const canal = supabase
      .channel(`ofertas-${solicitudId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ofertas_conductores',
          filter: `solicitud_id=eq.${solicitudId}`,
        },
        (payload) => callback(payload.new as OfertaConductor),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(canal);
    };
  },
};