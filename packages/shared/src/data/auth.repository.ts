import type { Profile } from '../domain/types';
import { supabase } from './supabaseClient';

export const authRepository = {
  async obtenerPerfilActual(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async obtenerPerfil(usuarioId: string): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', usuarioId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async actualizarVehiculo(vehiculo: string): Promise<Profile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión no iniciada.');

    const { data, error } = await supabase
      .from('profiles')
      .update({ vehiculo })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async actualizarEstado(estado: Profile['estado']): Promise<Profile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión no iniciada.');

    const { data, error } = await supabase
      .from('profiles')
      .update({ estado })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async actualizarConexion(estaConectado: boolean): Promise<Profile> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión no iniciada.');

    const { data, error } = await supabase
      .from('profiles')
      .update({ esta_conectado: estaConectado })
      .eq('id', user.id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  },

  async actualizarUbicacion(latitud: number, longitud: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sesión no iniciada.');

    const { error } = await supabase
      .from('profiles')
      .update({
        ubicacion_actual: `SRID=4326;POINT(${longitud} ${latitud})`,
      })
      .eq('id', user.id);

    if (error) throw error;
  },
};