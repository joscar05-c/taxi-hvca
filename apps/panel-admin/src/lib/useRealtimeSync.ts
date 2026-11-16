'use client';

import { useEffect, useRef } from 'react';

/**
 * Sincronización híbrida silenciosa en segundo plano para vistas web en vivo:
 * - Refresca inmediatamente al recuperar foco (`focus`), visibilidad (`visibilitychange`) o conexión (`online`).
 * - Ejecuta *polling* silencioso periódico mientras la pestaña está visible.
 * Nunca activa spinners visuales para evitar parpadeo en la UI.
 */
export function useRealtimeSync(
  refreshFn: () => void | Promise<void>,
  intervalMs = 15000,
): void {
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  useEffect(() => {
    let inFlight = false;
    let disposed = false;

    const ejecutarSilencioso = async () => {
      if (disposed || inFlight) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      inFlight = true;
      try {
        await refreshRef.current();
      } catch (err) {
        console.warn('[useRealtimeSync] Error en sincronización silenciosa:', err);
      } finally {
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void ejecutarSilencioso();
      }
    };

    const onFocusOrOnline = () => {
      void ejecutarSilencioso();
    };

    window.addEventListener('focus', onFocusOrOnline);
    window.addEventListener('online', onFocusOrOnline);
    document.addEventListener('visibilitychange', onVisibilityChange);

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void ejecutarSilencioso();
      }
    }, intervalMs);

    return () => {
      disposed = true;
      window.removeEventListener('focus', onFocusOrOnline);
      window.removeEventListener('online', onFocusOrOnline);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [intervalMs]);
}
