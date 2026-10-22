// Capa de dominio (tipos + lógica pura)
export * from './domain/types';
export * from './domain/fare';

// Capa de datos (repositorios y cliente Firebase)
export { app, auth, db, firebaseConfig } from './data/firebaseClient';
export { getFirebaseEnvVars } from './data/firebase';
export type { FirebaseEnvVars } from './data/firebase';
export { authRepository } from './data/auth.repository';
export { viajesRepository } from './data/viajes.repository';

// Utilidades
export { calcularDistanciaHaversine } from './utils/geo';

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
export { useForegroundLocation } from './hooks/useForegroundLocation';
export type { ForegroundLocationResult } from './hooks/useForegroundLocation';
export { useBackgroundLocation } from './hooks/useBackgroundLocation';
export type { UseBackgroundLocationResult } from './hooks/useBackgroundLocation';

// Estado global
export { useAuthStore } from './store/useAuthStore';
export type { AuthState, SessionCompat } from './store/useAuthStore';