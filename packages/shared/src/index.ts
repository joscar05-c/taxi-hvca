// Capa de dominio (tipos + lógica pura)
export * from './domain/types';
export * from './domain/fare';

// Capa de datos (repositorios y cliente Supabase)
export { supabase, getSupabaseClient } from './data/supabaseClient';
export { getEnvVars } from './data/supabase';
export type { EnvVars } from './data/supabase';
export { authRepository } from './data/auth.repository';
export { rideRepository } from './data/ride.repository';

// Capa de presentación reutilizable
export { Button } from './ui/Button';
export type { ButtonProps } from './ui/Button';
export { Input } from './ui/Input';
export type { InputProps } from './ui/Input';
export { PantallaCentrada, Etiqueta, colores } from './ui/theme';

// Hooks compartidos
export { useAuth } from './hooks/useAuth';
export type { UseAuthResult } from './hooks/useAuth';
export { useAuthInit } from './hooks/useAuthInit';
export { useLocation } from './hooks/useLocation';
export type { UseLocationResult } from './hooks/useLocation';

// Estado global
export { useAuthStore } from './store/useAuthStore';
export type { AuthState } from './store/useAuthStore';