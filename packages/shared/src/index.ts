// Capa de dominio (tipos + lógica pura)
export * from './domain/types';
export * from './domain/fare';

// Capa de datos (repositorios y cliente Firebase)
export { app, auth, db, firebaseConfig } from './data/firebaseClient';
export { getFirebaseEnvVars } from './data/firebase';
export type { FirebaseEnvVars } from './data/firebase';
export { authRepository, normalizarTelefonoPeruE164 } from './data/auth.repository';
export { viajesRepository } from './data/viajes.repository';

// Utilidades
export {
  avanzarHaciaDestino,
  calcularDistanciaHaversine,
  estaFueraDeHuancavelica,
  extraerCoordenadasPerfil,
  formatearReferenciaHuancavelica,
  obtenerDireccionLegible,
} from './utils/geo';
export {
  buscarDirecciones,
  generarSessionToken,
  obtenerDetalleLugar,
} from './utils/places';
export type {
  FuenteSugerencia,
  OpcionesBusquedaLugares,
  ResultadoBusquedaLugares,
  SugerenciaLugar,
} from './utils/places';

// Capa de presentación reutilizable
export { Button } from './ui/Button';
export type { ButtonProps } from './ui/Button';
export { BotonGoogle } from './ui/BotonGoogle';
export type { BotonGoogleProps } from './ui/BotonGoogle';
export { CabeceraAuth } from './ui/CabeceraAuth';
export type { CabeceraAuthProps } from './ui/CabeceraAuth';
export { Icono } from './ui/Icono';
export type { IconoProps, NombreIcono } from './ui/Icono';
export { Input } from './ui/Input';
export type { InputProps } from './ui/Input';
export { OnboardingCarousel } from './ui/OnboardingCarousel';
export type {
  OnboardingCarouselProps,
  OnboardingSlide,
} from './ui/OnboardingCarousel';
export { RutaVisual } from './ui/RutaVisual';
export type { RutaVisualProps } from './ui/RutaVisual';
export { SeccionVerificacionTelefono } from './ui/SeccionVerificacionTelefono';
export type { SeccionVerificacionTelefonoProps } from './ui/SeccionVerificacionTelefono';
export { TarjetaCambioApp } from './ui/TarjetaCambioApp';
export type { TarjetaCambioAppProps } from './ui/TarjetaCambioApp';
export { PantallaCentrada, Etiqueta, colores, radios, sombras } from './ui/theme';

// Hooks compartidos
export { useAuth } from './hooks/useAuth';
export type { UseAuthResult } from './hooks/useAuth';
export { useAuthInit } from './hooks/useAuthInit';
export { useGoogleLogin } from './hooks/useGoogleLogin';
export type { UseGoogleLoginResult } from './hooks/useGoogleLogin';
export { useOnboarding } from './hooks/useOnboarding';
export type { UseOnboardingResult } from './hooks/useOnboarding';
export { useLocation } from './hooks/useLocation';
export type { UseLocationResult } from './hooks/useLocation';
export { useForegroundLocation } from './hooks/useForegroundLocation';
export type {
  ForegroundLocationOptions,
  ForegroundLocationResult,
} from './hooks/useForegroundLocation';
export { useBackgroundLocation } from './hooks/useBackgroundLocation';
export type { UseBackgroundLocationResult } from './hooks/useBackgroundLocation';

// Estado global
export { useAuthStore } from './store/useAuthStore';
export type { AuthState, SessionCompat } from './store/useAuthStore';