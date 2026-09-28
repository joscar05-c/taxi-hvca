import type { Profile } from '../domain/types';
import { getSupabaseClient } from './supabase';

export const authRepository = {
  async obtenerPerfilActual(): Promise<Profile | null> {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async actualizarEstado(estado: Profile['estado']): Promise<Profile> {
    const supabase = getSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
};