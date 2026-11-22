import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface UseOnboardingResult {
  cargando: boolean;
  completado: boolean;
  marcarCompletado: () => Promise<void>;
  reiniciar: () => Promise<void>;
}

/**
 * Gestiona la persistencia del onboarding inicial por aplicación usando AsyncStorage.
 */
export function useOnboarding(claveApp: 'pasajero' | 'conductor'): UseOnboardingResult {
  const storageKey = `@hvca/onboarding_visto_${claveApp}`;
  const [cargando, setCargando] = useState(true);
  const [completado, setCompletado] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarEstado() {
      try {
        const valor = await AsyncStorage.getItem(storageKey);
        if (activo) {
          setCompletado(valor === 'true');
        }
      } catch {
        if (activo) {
          setCompletado(false);
        }
      } finally {
        if (activo) {
          setCargando(false);
        }
      }
    }

    void cargarEstado();

    return () => {
      activo = false;
    };
  }, [storageKey]);

  const marcarCompletado = useCallback(async () => {
    await AsyncStorage.setItem(storageKey, 'true');
    setCompletado(true);
  }, [storageKey]);

  const reiniciar = useCallback(async () => {
    await AsyncStorage.removeItem(storageKey);
    setCompletado(false);
  }, [storageKey]);

  return {
    cargando,
    completado,
    marcarCompletado,
    reiniciar,
  };
}
