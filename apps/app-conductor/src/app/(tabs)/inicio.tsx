import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  HUANCAVELICA_CENTRO,
  Icono,
  PUNTOS_SIMULACION_HVCA,
  RutaVisual,
  authRepository,
  avanzarHaciaDestino,
  calcularDistanciaHaversine,
  colores,
  estaFueraDeHuancavelica,
  extraerCoordenadasPerfil,
  formatearReferenciaHuancavelica,
  obtenerDireccionLegible,
  radios,
  sombras,
  useAuth,
  useBackgroundLocation,
  useForegroundLocation,
  viajesRepository,
  type Coordenadas,
  type Profile,
  type PuntoSimulacionHvca,
  type SolicitudViaje,
} from '@hvca/shared';

import {
  BACKGROUND_LOCATION_TASK,
  setModoSimulacionUbicacion,
} from '../../locationTask';

const DISTANCIA_MAX_KM = 3;

const PASOS_CONDUCTOR = [
  { id: 'aceptado', label: 'Ir al origen' },
  { id: 'en_camino_origen', label: 'En origen' },
  { id: 'en_curso', label: 'En viaje' },
] as const;

type SolicitudCercana = {
  solicitud: SolicitudViaje;
  distanciaKm: number;
};

function indicePasoConductor(estado: SolicitudViaje['estado']): number {
  switch (estado) {
    case 'aceptado':
      return 0;
    case 'en_camino_origen':
      return 1;
    case 'en_curso':
      return 2;
    case 'completado':
      return 3;
    default:
      return -1;
  }
}

function etiquetaEstadoViaje(estado: SolicitudViaje['estado']): string {
  switch (estado) {
    case 'aceptado':
      return 'Dirígete al punto de recojo del pasajero';
    case 'en_camino_origen':
      return 'Esperando al pasajero en el punto de recojo';
    case 'en_curso':
      return 'Viaje en curso hacia el destino';
    case 'completado':
      return 'Viaje finalizado';
    case 'cancelada':
      return 'Viaje cancelado';
    default:
      return estado;
  }
}

function normalizarTelefonoWhatsApp(telefono: string): string | null {
  const digitos = telefono.replace(/\D/g, '');
  if (!digitos) return null;
  if (digitos.length === 9 && digitos.startsWith('9')) {
    return `51${digitos}`;
  }
  return digitos;
}

function obtenerIniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
  }
  return (partes[0] ?? 'P').slice(0, 2).toUpperCase();
}

function esMismoDiaLocal(fechaIso: string, referencia: Date): boolean {
  const d = new Date(fechaIso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === referencia.getFullYear() &&
    d.getMonth() === referencia.getMonth() &&
    d.getDate() === referencia.getDate()
  );
}

export default function PantallaInicio() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, sesion } = useAuth();
  const { isTracking, loading, error: errorTracking, startTracking, stopTracking } =
    useBackgroundLocation(BACKGROUND_LOCATION_TASK);
  const { coords, watching, requestPermissionAndLocate } = useForegroundLocation({
    watch: true,
    accuracy: Location.Accuracy.High,
    distanceInterval: 10,
    timeInterval: 4000,
  });

  const mapRef = useRef<MapView | null>(null);
  const ultimoDirCoordsRef = useRef<Coordenadas | null>(null);
  const ultimoEnvioUbicacionRef = useRef<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);
  const indiceRutaSimRef = useRef(1);
  const cancelacionPropiaRef = useRef<string | null>(null);

  const [direccionConductor, setDireccionConductor] = useState<string | null>(null);
  const [cargandoDireccion, setCargandoDireccion] = useState(false);
  const [seguirEnMapa, setSeguirEnMapa] = useState(true);
  const [mostrarSimulador, setMostrarSimulador] = useState(false);

  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [solicitudesCercanas, setSolicitudesCercanas] = useState<
    SolicitudCercana[]
  >([]);
  const [ofertasEnviadas, setOfertasEnviadas] = useState<Set<string>>(
    new Set(),
  );
  const [viajeActivo, setViajeActivo] = useState<SolicitudViaje | null>(null);
  const [perfilPasajero, setPerfilPasajero] = useState<Profile | null>(null);
  const [viajeParaCalificar, setViajeParaCalificar] =
    useState<SolicitudViaje | null>(null);
  const [estrellasPasajero, setEstrellasPasajero] = useState<number>(5);
  const [gananciasHoy, setGananciasHoy] = useState<number>(0);

  const [contraofertaId, setContraofertaId] = useState<string | null>(null);
  const [precioContraoferta, setPrecioContraoferta] = useState('');

  const idConductor = sesion?.user?.id;
  const primerNombre = (perfil?.nombre?.trim().split(/\s+/)[0] || '').trim();

  // Recuperar automáticamente el viaje activo y ofertas pendientes al abrir la app
  useEffect(() => {
    if (!idConductor) return;
    let activo = true;
    void viajesRepository
      .obtenerViajeActivoConductor(idConductor)
      .then((activa) => {
        if (activo && activa) {
          setViajeActivo(activa);
        }
      })
      .catch((e) => {
        console.warn('[inicio] Error al recuperar viaje activo:', e);
      });

    void viajesRepository
      .obtenerOfertasPendientesConductor(idConductor)
      .then((pendientes) => {
        if (activo && pendientes.length > 0) {
          setOfertasEnviadas((prev) => new Set([...prev, ...pendientes]));
        }
      })
      .catch((e) => {
        console.warn('[inicio] Error al recuperar ofertas pendientes:', e);
      });

    return () => {
      activo = false;
    };
  }, [idConductor]);

  // Calcular ganancias del día en tiempo real desde el historial del conductor
  useEffect(() => {
    if (!idConductor) return;
    return viajesRepository.suscribirHistorialViajes(
      idConductor,
      'conductor',
      (lista) => {
        const hoy = new Date();
        const total = lista
          .filter(
            (v) => v.estado === 'completado' && esMismoDiaLocal(v.created_at, hoy),
          )
          .reduce(
            (acc, v) => acc + Number(v.precio_final ?? v.precio_inicial ?? 0),
            0,
          );
        setGananciasHoy(total);
      },
      () => undefined,
    );
  }, [idConductor]);

  // Suscripción en tiempo real al perfil del pasajero del viaje activo
  const idPasajeroActivo = viajeActivo?.pasajero_id;
  useEffect(() => {
    if (!idPasajeroActivo) {
      setPerfilPasajero(null);
      return;
    }
    return authRepository.suscribirPerfil(idPasajeroActivo, setPerfilPasajero);
  }, [idPasajeroActivo]);

  // Modo simulación Huancavelica para desarrollo y emuladores
  const [simularHuancavelica, setSimularHuancavelica] = useState(false);
  const [simulandoMovimiento, setSimulandoMovimiento] = useState(false);
  const [puntoSimulado, setPuntoSimulado] = useState<PuntoSimulacionHvca>(
    PUNTOS_SIMULACION_HVCA[0],
  );
  const [posicionSimulada, setPosicionSimulada] = useState<Coordenadas | null>(null);

  const esEmuladorFueraDeHvca = useMemo(() => {
    if (!coords) return false;
    return estaFueraDeHuancavelica(coords);
  }, [coords]);

  useEffect(() => {
    if (esEmuladorFueraDeHvca) {
      setSimularHuancavelica(true);
    }
  }, [esEmuladorFueraDeHvca]);

  useEffect(() => {
    void setModoSimulacionUbicacion(simularHuancavelica);
  }, [simularHuancavelica]);

  const ubicacionConductor = useMemo<Coordenadas | null>(() => {
    if (simularHuancavelica) {
      if (simulandoMovimiento && posicionSimulada) {
        return posicionSimulada;
      }
      return { latitude: puntoSimulado.latitude, longitude: puntoSimulado.longitude };
    }
    if (coords) {
      return { latitude: coords.latitude, longitude: coords.longitude };
    }
    return extraerCoordenadasPerfil(perfil);
  }, [simularHuancavelica, simulandoMovimiento, posicionSimulada, puntoSimulado, coords, perfil]);

  // Solicitar ubicación inmediatamente al abrir la app para mostrar mapa y dirección exacta
  useEffect(() => {
    void requestPermissionAndLocate();
  }, [requestPermissionAndLocate]);

  // Dirección legible en vivo según desplazamiento (GPS real o simulador)
  useEffect(() => {
    if (!ubicacionConductor) {
      setDireccionConductor(null);
      return;
    }

    const ultima = ultimoDirCoordsRef.current;
    if (
      ultima &&
      calcularDistanciaHaversine(
        ultima.latitude,
        ultima.longitude,
        ubicacionConductor.latitude,
        ubicacionConductor.longitude,
      ) < 0.025
    ) {
      return;
    }

    let activo = true;
    setCargandoDireccion(true);
    const timer = setTimeout(() => {
      void obtenerDireccionLegible(ubicacionConductor)
        .then((dir) => {
          if (!activo) return;
          ultimoDirCoordsRef.current = ubicacionConductor;
          setDireccionConductor(dir);
        })
        .finally(() => {
          if (activo) {
            setCargandoDireccion(false);
          }
        });
    }, 400);

    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [ubicacionConductor]);

  // Sincronización en primer plano hacia Firestore con throttling mientras está conectado o en viaje
  useEffect(() => {
    if (!idConductor || !ubicacionConductor || (!isTracking && !viajeActivo)) {
      return;
    }

    const ahora = Date.now();
    const previo = ultimoEnvioUbicacionRef.current;
    if (previo) {
      const transcurridoMs = ahora - previo.timestamp;
      if (transcurridoMs < 3500) return;
      const distanciaKm = calcularDistanciaHaversine(
        previo.latitude,
        previo.longitude,
        ubicacionConductor.latitude,
        ubicacionConductor.longitude,
      );
      if (distanciaKm < 0.015 && transcurridoMs < 15000) {
        return;
      }
    }

    ultimoEnvioUbicacionRef.current = {
      latitude: ubicacionConductor.latitude,
      longitude: ubicacionConductor.longitude,
      timestamp: ahora,
    };
    void authRepository
      .actualizarUbicacion(
        ubicacionConductor.latitude,
        ubicacionConductor.longitude,
      )
      .catch(() => {
        ultimoEnvioUbicacionRef.current = previo;
      });
  }, [idConductor, ubicacionConductor, isTracking, viajeActivo]);

  const objetivoSimulacionRef = useRef<Coordenadas | null>(null);
  useEffect(() => {
    if (viajeActivo) {
      objetivoSimulacionRef.current =
        viajeActivo.estado === 'en_curso'
          ? { latitude: viajeActivo.destino_lat, longitude: viajeActivo.destino_lng }
          : { latitude: viajeActivo.origen_lat, longitude: viajeActivo.origen_lng };
    } else if (solicitudesCercanas[0]) {
      objetivoSimulacionRef.current = {
        latitude: solicitudesCercanas[0].solicitud.origen_lat,
        longitude: solicitudesCercanas[0].solicitud.origen_lng,
      };
    } else {
      objetivoSimulacionRef.current = null;
    }
  }, [viajeActivo, solicitudesCercanas]);

  // Simulador de desplazamiento continuo en Huancavelica para pruebas en emulador
  useEffect(() => {
    if (!simularHuancavelica || !simulandoMovimiento) {
      return;
    }

    setPosicionSimulada((prev) =>
      prev ?? { latitude: puntoSimulado.latitude, longitude: puntoSimulado.longitude },
    );

    const intervalo = setInterval(() => {
      setPosicionSimulada((actual) => {
        const base = actual ?? {
          latitude: puntoSimulado.latitude,
          longitude: puntoSimulado.longitude,
        };
        let objetivo = objetivoSimulacionRef.current;

        if (!objetivo) {
          const lista = PUNTOS_SIMULACION_HVCA;
          let puntoObjetivo = lista[indiceRutaSimRef.current % lista.length];
          const dist = calcularDistanciaHaversine(
            base.latitude,
            base.longitude,
            puntoObjetivo.latitude,
            puntoObjetivo.longitude,
          );
          if (dist <= 0.09) {
            indiceRutaSimRef.current = (indiceRutaSimRef.current + 1) % lista.length;
            puntoObjetivo = lista[indiceRutaSimRef.current];
          }
          objetivo = {
            latitude: puntoObjetivo.latitude,
            longitude: puntoObjetivo.longitude,
          };
        }

        return avanzarHaciaDestino(base, objetivo, 0.08);
      });
    }, 2500);

    return () => clearInterval(intervalo);
  }, [simularHuancavelica, simulandoMovimiento, puntoSimulado]);

  // Seguir suavemente al conductor en el mapa mientras seguirEnMapa esté activo
  useEffect(() => {
    if (!seguirEnMapa || !ubicacionConductor || !mapRef.current) {
      return;
    }
    mapRef.current.animateToRegion(
      {
        latitude: ubicacionConductor.latitude,
        longitude: ubicacionConductor.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      },
      450,
    );
  }, [seguirEnMapa, ubicacionConductor]);

  // Asegurar permiso fresco también al conectarse si fue denegado inicialmente
  useEffect(() => {
    if (isTracking) {
      void requestPermissionAndLocate();
    }
  }, [isTracking, requestPermissionAndLocate]);

  function encuadrarRutaViaje() {
    if (!viajeActivo || !mapRef.current) return;
    setSeguirEnMapa(false);
    const puntos: Coordenadas[] = [
      { latitude: viajeActivo.origen_lat, longitude: viajeActivo.origen_lng },
      { latitude: viajeActivo.destino_lat, longitude: viajeActivo.destino_lng },
    ];
    if (ubicacionConductor) {
      puntos.push(ubicacionConductor);
    }
    mapRef.current.fitToCoordinates(puntos, {
      edgePadding: { top: 80, right: 44, bottom: 56, left: 44 },
      animated: true,
    });
  }

  function alternarSeguirConductor() {
    if (seguirEnMapa) {
      setSeguirEnMapa(false);
      return;
    }
    setSeguirEnMapa(true);
    if (ubicacionConductor && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: ubicacionConductor.latitude,
          longitude: ubicacionConductor.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        450,
      );
    }
  }

  const solicitudesPendientesRef = useRef<Map<string, SolicitudViaje>>(new Map());
  const ubicacionRef = useRef(ubicacionConductor);

  const recalcularCercanas = useCallback((pos: Coordenadas | null) => {
    if (!pos) return;
    const filtradas: SolicitudCercana[] = [];
    solicitudesPendientesRef.current.forEach((solicitud) => {
      const distanciaKm = calcularDistanciaHaversine(
        solicitud.origen_lat,
        solicitud.origen_lng,
        pos.latitude,
        pos.longitude,
      );
      if (distanciaKm < DISTANCIA_MAX_KM) {
        filtradas.push({ solicitud, distanciaKm });
      }
    });
    filtradas.sort((a, b) => a.distanciaKm - b.distanciaKm);
    setSolicitudesCercanas(filtradas);
  }, []);

  useEffect(() => {
    ubicacionRef.current = ubicacionConductor;
    recalcularCercanas(ubicacionConductor);
  }, [ubicacionConductor, recalcularCercanas]);

  const manejarNuevaSolicitud = useCallback((solicitud: SolicitudViaje) => {
    solicitudesPendientesRef.current.set(solicitud.id, solicitud);
    const pos = ubicacionRef.current;
    if (!pos) return;

    const distanciaKm = calcularDistanciaHaversine(
      solicitud.origen_lat,
      solicitud.origen_lng,
      pos.latitude,
      pos.longitude,
    );
    if (distanciaKm >= DISTANCIA_MAX_KM) return;

    setSolicitudesCercanas((prev) => {
      const sinEsta = prev.filter((s) => s.solicitud.id !== solicitud.id);
      return [...sinEsta, { solicitud, distanciaKm }].sort(
        (a, b) => a.distanciaKm - b.distanciaKm,
      );
    });
  }, []);

  const manejarSolicitudEliminada = useCallback((solicitudId: string) => {
    solicitudesPendientesRef.current.delete(solicitudId);
    setSolicitudesCercanas((prev) =>
      prev.filter((s) => s.solicitud.id !== solicitudId),
    );
  }, []);

  useEffect(() => {
    if (!isTracking) return;
    return viajesRepository.suscribirNuevasSolicitudes(
      manejarNuevaSolicitud,
      manejarSolicitudEliminada,
    );
  }, [isTracking, manejarNuevaSolicitud, manejarSolicitudEliminada]);

  // Por cada solicitud con oferta enviada (que aún no sea viajeActivo), escuchamos cambios
  useEffect(() => {
    const limpiadores: Array<() => void> = [];
    ofertasEnviadas.forEach((solicitudId) => {
      if (solicitudId === viajeActivo?.id) return;
      limpiadores.push(
        viajesRepository.suscribirCambiosSolicitud(
          solicitudId,
          (solicitud) => {
            if (solicitud.estado === 'buscando') return;

            if (
              solicitud.estado === 'aceptado' &&
              solicitud.conductor_id === idConductor
            ) {
              setViajeActivo(solicitud);
            }

            solicitudesPendientesRef.current.delete(solicitudId);
            setOfertasEnviadas((prev) => {
              const nuevo = new Set(prev);
              nuevo.delete(solicitudId);
              return nuevo;
            });
            setSolicitudesCercanas((prev) =>
              prev.filter((s) => s.solicitud.id !== solicitudId),
            );
          },
          (err) => {
            console.warn('[inicio] Error en suscripción solicitud:', err);
          },
        ),
      );
    });
    return () => {
      limpiadores.forEach((limpiar) => limpiar());
    };
  }, [ofertasEnviadas, idConductor, viajeActivo?.id]);

  // Escuchar reactivamente cambios en el viaje activo
  useEffect(() => {
    if (!viajeActivo?.id) return;
    const unsub = viajesRepository.suscribirCambiosSolicitud(
      viajeActivo.id,
      (solicitudActualizada) => {
        if (solicitudActualizada.estado === 'cancelada') {
          if (cancelacionPropiaRef.current === solicitudActualizada.id) {
            cancelacionPropiaRef.current = null;
          } else {
            Alert.alert(
              'Viaje cancelado',
              'El pasajero ha cancelado el viaje. Regresando a la pantalla de solicitudes.',
            );
          }
          setViajeActivo(null);
          solicitudesPendientesRef.current.delete(solicitudActualizada.id);
          setOfertasEnviadas((prev) => {
            const nuevo = new Set(prev);
            nuevo.delete(solicitudActualizada.id);
            return nuevo;
          });
          setSolicitudesCercanas((prev) =>
            prev.filter((s) => s.solicitud.id !== solicitudActualizada.id),
          );
        } else if (solicitudActualizada.estado !== viajeActivo.estado) {
          setViajeActivo((prev) =>
            prev ? { ...prev, ...solicitudActualizada } : null,
          );
        }
      },
      (err) => {
        console.warn('[inicio] Error en suscripción viajeActivo:', err);
      },
    );
    return () => unsub();
  }, [viajeActivo?.id, viajeActivo?.estado]);

  function validarRequisitosOperativos(): boolean {
    if (!perfil?.telefono_verificado) {
      Alert.alert(
        'Verificación Obligatoria',
        'Por seguridad, debes verificar tu número de celular con el código OTP antes de conectarte o enviar ofertas.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Verificar en Perfil',
            onPress: () => router.push('/(tabs)/perfil'),
          },
        ],
      );
      return false;
    }

    if (perfil?.estado_documentos !== 'aprobado' || !perfil?.vehiculo?.trim()) {
      const estadoDocs = perfil?.estado_documentos;
      const mensajeDocs =
        estadoDocs === 'en_revision'
          ? 'Tus documentos de conductor están en revisión. Podrás conectarte y ofertar apenas sean aprobados por administración.'
          : estadoDocs === 'rechazado'
            ? 'Tus documentos de conductor fueron rechazados. Revisa y actualiza tu documentación en tu Perfil.'
            : 'Debes registrar tu vehículo y documentación (DNI, licencia y SOAT) y contar con aprobación antes de conectarte o enviar ofertas.';

      Alert.alert('Documentación Requerida', mensajeDocs, [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ir a Mi Perfil',
          onPress: () => router.push('/(tabs)/perfil'),
        },
      ]);
      return false;
    }

    return true;
  }

  async function alternarConexion() {
    setMensaje(null);
    setError(null);
    setOperando(true);
    try {
      if (isTracking) {
        await stopTracking();
        await authRepository.actualizarConexion(false);
        setSolicitudesCercanas([]);
        setMensaje('Te desconectaste. Ya no compartes tu ubicación.');
      } else {
        if (!validarRequisitosOperativos()) {
          return;
        }

        const iniciado = await startTracking();
        if (!iniciado) return;

        try {
          await authRepository.actualizarConexion(true);
          setMensaje('Estás en línea y listo para recibir solicitudes.');
        } catch (e) {
          await stopTracking();
          setError(
            e instanceof Error ? e.message : 'No se pudo actualizar tu conexión.',
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setOperando(false);
    }
  }

  function marcarOfertada(solicitudId: string) {
    setOfertasEnviadas((prev) => {
      const nuevo = new Set(prev);
      nuevo.add(solicitudId);
      return nuevo;
    });
  }

  function construirMetaConductor() {
    return {
      conductor_nombre: perfil?.nombre,
      conductor_vehiculo: perfil?.vehiculo ?? null,
      conductor_calificacion: perfil?.calificacion_promedio ?? 5.0,
      conductor_telefono: perfil?.telefono,
    };
  }

  async function aceptarSolicitud(solicitud: SolicitudViaje) {
    if (!sesion?.user) return;

    if (!validarRequisitosOperativos()) {
      return;
    }

    setError(null);
    setMensaje(null);
    setOperando(true);
    try {
      await viajesRepository.enviarOferta(
        solicitud.id,
        sesion.user.id,
        solicitud.precio_inicial,
        construirMetaConductor(),
      );
      marcarOfertada(solicitud.id);
      setMensaje('Oferta enviada al pasajero.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la oferta.');
    } finally {
      setOperando(false);
    }
  }

  function abrirContraoferta(solicitud: SolicitudViaje) {
    setContraofertaId(solicitud.id);
    setPrecioContraoferta((Number(solicitud.precio_inicial) + 1).toFixed(2));
    setError(null);
  }

  async function confirmarContraoferta(solicitud: SolicitudViaje, montoExplicito?: number) {
    if (!sesion?.user) return;

    if (!validarRequisitosOperativos()) {
      return;
    }

    const precio =
      montoExplicito ?? parseFloat(precioContraoferta.trim().replace(',', '.'));
    if (!Number.isFinite(precio) || precio <= 0) {
      setError('Ingresa un precio válido.');
      return;
    }
    if (precio <= solicitud.precio_inicial) {
      setError('La contraoferta debe ser mayor al precio del pasajero.');
      return;
    }

    setError(null);
    setMensaje(null);
    setOperando(true);
    try {
      await viajesRepository.enviarOferta(
        solicitud.id,
        sesion.user.id,
        precio,
        construirMetaConductor(),
      );
      marcarOfertada(solicitud.id);
      setContraofertaId(null);
      setMensaje(`Contraoferta de S/ ${precio.toFixed(2)} enviada.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la contraoferta.');
    } finally {
      setOperando(false);
    }
  }

  async function llegueAlOrigen() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const actualizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'en_camino_origen',
      );
      setViajeActivo(actualizada);
      setMensaje('Avisaste al pasajero que llegaste al punto de recojo.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo actualizar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  async function iniciarViaje() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const actualizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'en_curso',
      );
      setViajeActivo(actualizada);
      setMensaje('Viaje iniciado. En camino hacia el destino.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  async function finalizarViaje() {
    if (!viajeActivo) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const finalizada = await viajesRepository.actualizarEstadoViaje(
        viajeActivo.id,
        'completado',
      );
      setViajeParaCalificar(finalizada);
      setEstrellasPasajero(5);
      setViajeActivo(null);
      setOfertasEnviadas((prev) => {
        const nuevo = new Set(prev);
        nuevo.delete(finalizada.id);
        return nuevo;
      });
      setContraofertaId(null);
      setPrecioContraoferta('');
      setMensaje('Viaje completado. Califica al pasajero para continuar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo finalizar el viaje.');
    } finally {
      setOperando(false);
    }
  }

  function cancelarViajeConductor() {
    if (!viajeActivo) return;
    const solicitudId = viajeActivo.id;
    Alert.alert(
      'Cancelar viaje',
      '¿Confirmas que deseas cancelar este viaje asignado?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              cancelacionPropiaRef.current = solicitudId;
              setOperando(true);
              setError(null);
              setMensaje(null);
              try {
                await viajesRepository.cancelarSolicitud(solicitudId, {
                  canceladoPor: 'conductor',
                });
                setViajeActivo(null);
                solicitudesPendientesRef.current.delete(solicitudId);
                setOfertasEnviadas((prev) => {
                  const nuevo = new Set(prev);
                  nuevo.delete(solicitudId);
                  return nuevo;
                });
                setContraofertaId(null);
                setMensaje('Viaje cancelado.');
              } catch (e) {
                cancelacionPropiaRef.current = null;
                setError(
                  e instanceof Error ? e.message : 'No se pudo cancelar el viaje.',
                );
              } finally {
                setOperando(false);
              }
            })();
          },
        },
      ],
    );
  }

  async function enviarCalificacionPasajero() {
    if (!viajeParaCalificar || !idConductor) return;
    setOperando(true);
    setError(null);
    try {
      await viajesRepository.calificarViaje({
        solicitudId: viajeParaCalificar.id,
        evaluadorId: idConductor,
        evaluadoId: viajeParaCalificar.pasajero_id,
        rolEvaluador: 'conductor',
        estrellas: estrellasPasajero,
      });
      setViajeParaCalificar(null);
      setMensaje('¡Calificación registrada! De nuevo en el radar.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo calificar al pasajero.');
    } finally {
      setOperando(false);
    }
  }

  async function llamarPasajero() {
    const tel = perfilPasajero?.telefono?.trim();
    if (!tel) {
      Alert.alert('Sin teléfono', 'El pasajero no tiene teléfono registrado.');
      return;
    }
    const url = `tel:${tel.replace(/\s+/g, '')}`;
    const puede = await Linking.canOpenURL(url);
    if (puede) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Teléfono del pasajero', tel);
    }
  }

  async function abrirWhatsAppPasajero() {
    const numero = normalizarTelefonoWhatsApp(perfilPasajero?.telefono ?? '');
    if (!numero) {
      Alert.alert('Sin WhatsApp', 'El pasajero no tiene un número celular válido.');
      return;
    }
    const msg = encodeURIComponent(
      `Hola ${perfilPasajero?.nombre ?? ''}, soy tu conductor de Taxi HVCA.`,
    );
    await Linking.openURL(`https://wa.me/${numero}?text=${msg}`);
  }

  async function abrirNavegacionMaps() {
    if (!viajeActivo) return;
    const irADestino = viajeActivo.estado === 'en_curso';
    const lat = irADestino ? viajeActivo.destino_lat : viajeActivo.origen_lat;
    const lng = irADestino ? viajeActivo.destino_lng : viajeActivo.origen_lng;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    await Linking.openURL(url);
  }

  const textoDireccionActual = ubicacionConductor
    ? cargandoDireccion && !direccionConductor
      ? 'Obteniendo dirección exacta...'
      : direccionConductor ?? formatearReferenciaHuancavelica(ubicacionConductor)
    : 'Esperando señal GPS...';

  const distanciaObjetivoViaje = useMemo(() => {
    if (!viajeActivo || !ubicacionConductor) return null;
    const haciaDestino = viajeActivo.estado === 'en_curso';
    const lat = haciaDestino ? viajeActivo.destino_lat : viajeActivo.origen_lat;
    const lng = haciaDestino ? viajeActivo.destino_lng : viajeActivo.origen_lng;
    const km = calcularDistanciaHaversine(
      ubicacionConductor.latitude,
      ubicacionConductor.longitude,
      lat,
      lng,
    );
    return {
      km,
      minutos: Math.max(1, Math.round((km / 22) * 60)),
      haciaDestino,
    };
  }, [viajeActivo, ubicacionConductor]);

  const pasoActualConductor = viajeActivo
    ? indicePasoConductor(viajeActivo.estado)
    : -1;

  const requiereTelefono = !perfil?.telefono_verificado;
  const requiereDocs =
    perfil?.estado_documentos !== 'aprobado' || !perfil?.vehiculo?.trim();

  return (
    <KeyboardAvoidingView
      style={styles.pantalla}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.pantalla}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Mapa operativo protagonista con HUD flotante */}
        <View
          style={[
            styles.contenedorMapaHero,
            { height: (viajeActivo ? 290 : 275) + Math.max(insets.top, 16) },
          ]}
        >
          <MapView
            ref={mapRef}
            style={styles.mapaHero}
            initialRegion={{
              latitude: ubicacionConductor?.latitude ?? HUANCAVELICA_CENTRO.latitude,
              longitude: ubicacionConductor?.longitude ?? HUANCAVELICA_CENTRO.longitude,
              latitudeDelta: 0.012,
              longitudeDelta: 0.012,
            }}
            showsUserLocation={Boolean(coords && !esEmuladorFueraDeHvca)}
            showsMyLocationButton={false}
            onPanDrag={() => {
              if (seguirEnMapa) setSeguirEnMapa(false);
            }}
          >
            {ubicacionConductor ? (
              <Marker
                coordinate={ubicacionConductor}
                title="Tu ubicación"
                description={direccionConductor ?? 'Ubicación actual'}
                pinColor="#F59E0B"
              />
            ) : null}

            {viajeActivo ? (
              <>
                <Marker
                  coordinate={{
                    latitude: viajeActivo.origen_lat,
                    longitude: viajeActivo.origen_lng,
                  }}
                  title="Origen pasajero"
                  description={viajeActivo.origen_direccion ?? 'Punto de recogida'}
                  pinColor="#16A34A"
                />
                <Marker
                  coordinate={{
                    latitude: viajeActivo.destino_lat,
                    longitude: viajeActivo.destino_lng,
                  }}
                  title="Destino"
                  description={viajeActivo.destino_direccion ?? 'Punto de llegada'}
                  pinColor="#DC2626"
                />
                <Polyline
                  coordinates={[
                    {
                      latitude: viajeActivo.origen_lat,
                      longitude: viajeActivo.origen_lng,
                    },
                    {
                      latitude: viajeActivo.destino_lat,
                      longitude: viajeActivo.destino_lng,
                    },
                  ]}
                  strokeColor={colores.primario}
                  strokeWidth={4}
                />
                {ubicacionConductor &&
                (viajeActivo.estado === 'aceptado' ||
                  viajeActivo.estado === 'en_camino_origen') ? (
                  <Polyline
                    coordinates={[
                      ubicacionConductor,
                      {
                        latitude: viajeActivo.origen_lat,
                        longitude: viajeActivo.origen_lng,
                      },
                    ]}
                    strokeColor="#F59E0B"
                    strokeWidth={3}
                    lineDashPattern={[6, 4]}
                  />
                ) : null}
              </>
            ) : (
              solicitudesCercanas.map(({ solicitud, distanciaKm }) => (
                <Marker
                  key={solicitud.id}
                  coordinate={{
                    latitude: solicitud.origen_lat,
                    longitude: solicitud.origen_lng,
                  }}
                  title={`S/ ${Number(solicitud.precio_inicial).toFixed(2)} · ${distanciaKm.toFixed(1)} km`}
                  description={solicitud.origen_direccion ?? 'Solicitud cercana'}
                  pinColor="#16A34A"
                />
              ))
            )}
          </MapView>

          {/* HUD superior flotante: dirección exacta + ganancias de hoy */}
          <View
            pointerEvents="box-none"
            style={[
              styles.hudSuperior,
              { top: Math.max(insets.top, 12) + 4 },
            ]}
          >
            <View style={[styles.pillDireccion, sombras.media]}>
              <View
                style={[
                  styles.puntoEstadoHud,
                  {
                    backgroundColor: isTracking
                      ? colores.exito
                      : colores.textoSuave,
                  },
                ]}
              />
              <View style={styles.flexUno}>
                <Text style={styles.etiquetaHud}>
                  {simulandoMovimiento
                    ? 'Simulación en vivo'
                    : watching || isTracking
                      ? 'GPS en vivo'
                      : 'Ubicación actual'}
                </Text>
                <Text style={styles.direccionHud} numberOfLines={1}>
                  {textoDireccionActual}
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() => router.push('/(tabs)/historial')}
              style={({ pressed }) => [
                styles.pillGanancias,
                sombras.media,
                pressed && styles.presionadoSuave,
              ]}
            >
              <Text style={styles.etiquetaGanancias}>HOY</Text>
              <Text style={styles.valorGanancias}>
                S/ {gananciasHoy.toFixed(2)}
              </Text>
            </Pressable>
          </View>

          {/* Controles inferiores sobre el mapa: chip discreto simulador + centrar/ruta */}
          <View pointerEvents="box-none" style={styles.hudInferior}>
            <Pressable
              onPress={() => setMostrarSimulador((prev) => !prev)}
              style={({ pressed }) => [
                styles.chipModoDemo,
                simularHuancavelica && styles.chipModoDemoActivo,
                sombras.suave,
                pressed && styles.presionadoSuave,
              ]}
            >
              <View
                style={[
                  styles.puntoDemo,
                  {
                    backgroundColor: simulandoMovimiento
                      ? colores.accent
                      : simularHuancavelica
                        ? colores.exito
                        : colores.textoSuave,
                  },
                ]}
              />
              <Text
                style={[
                  styles.textoModoDemo,
                  simularHuancavelica && styles.textoModoDemoActivo,
                ]}
              >
                {simularHuancavelica
                  ? simulandoMovimiento
                    ? 'Simulando'
                    : 'Demo ON'
                  : 'Simulador'}
              </Text>
            </Pressable>

            <View style={styles.filaControlesMapa}>
              {viajeActivo ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.botonMapaFlotante,
                    sombras.suave,
                    pressed && styles.presionadoSuave,
                  ]}
                  onPress={encuadrarRutaViaje}
                >
                  <Text style={styles.textoBotonMapaFlotante}>Ver ruta</Text>
                </Pressable>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.botonMapaFlotante,
                  seguirEnMapa && styles.botonMapaFlotanteActivo,
                  sombras.suave,
                  pressed && styles.presionadoSuave,
                ]}
                onPress={alternarSeguirConductor}
              >
                <Icono
                  nombre="objetivo"
                  size={15}
                  color={seguirEnMapa ? colores.fondo : colores.primario}
                />
                <Text
                  style={[
                    styles.textoBotonMapaFlotante,
                    seguirEnMapa && styles.textoBotonMapaFlotanteActivo,
                  ]}
                >
                  {seguirEnMapa ? 'Siguiendo' : 'Centrar'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* Cuerpo operativo elevado sobre el borde inferior del mapa */}
        <View style={styles.cuerpoOperativo}>
          {/* Barra compacta de estado y conexión (visible cuando no hay viaje activo) */}
          {!viajeActivo ? (
            <View style={[styles.cardConexion, sombras.suave]}>
              <View style={styles.filaConexion}>
                <View style={styles.flexUno}>
                  <View style={styles.filaSaludoEstado}>
                    <View
                      style={[
                        styles.puntoConexion,
                        isTracking
                          ? styles.puntoConexionActivo
                          : styles.puntoConexionInactivo,
                      ]}
                    />
                    <Text style={styles.textoEstadoConexion}>
                      {isTracking ? 'En línea' : 'Desconectado'}
                    </Text>
                  </View>
                  <Text style={styles.subtituloConexion} numberOfLines={1}>
                    {primerNombre ? `Hola, ${primerNombre}` : 'Conductor'}
                    {perfil?.vehiculo?.trim() ? ` · ${perfil.vehiculo}` : ''}
                  </Text>
                </View>

                <Button
                  label={isTracking ? 'Desconectar' : 'Conectarse'}
                  onPress={() => void alternarConexion()}
                  cargando={operando || loading}
                  variante={isTracking ? 'peligro' : 'primario'}
                  tamano="md"
                  estilo={styles.botonConectarCompacto}
                />
              </View>

              {requiereTelefono ? (
                <Pressable
                  style={styles.avisoRequisito}
                  onPress={() => router.push('/(tabs)/perfil')}
                >
                  <Text style={styles.textoAvisoRequisito}>
                    Verifica tu celular en Mi Perfil antes de conectarte →
                  </Text>
                </Pressable>
              ) : null}

              {requiereDocs ? (
                <Pressable
                  style={styles.avisoRequisito}
                  onPress={() => router.push('/(tabs)/perfil')}
                >
                  <Text style={styles.textoAvisoRequisito}>
                    {perfil?.estado_documentos === 'en_revision'
                      ? 'Tus documentos KYC están en revisión. Ver estado en Mi Perfil →'
                      : perfil?.estado_documentos === 'rechazado'
                        ? 'Documentación KYC observada. Corregir en Mi Perfil →'
                        : 'Completa vehículo, DNI, brevete y SOAT en Mi Perfil →'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {errorTracking ? (
            <View style={styles.bannerError}>
              <Text style={styles.textoBannerError}>{errorTracking}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={styles.bannerError}>
              <Text style={styles.textoBannerError}>{error}</Text>
            </View>
          ) : null}
          {mensaje ? (
            <View style={styles.bannerExito}>
              <Text style={styles.textoBannerExito}>{mensaje}</Text>
            </View>
          ) : null}

          {/* Aviso puntual solo si el emulador está fuera de Huancavelica y la simulación apagada */}
          {esEmuladorFueraDeHvca && !simularHuancavelica && !mostrarSimulador ? (
            <Pressable
              style={styles.avisoRequisito}
              onPress={() => setMostrarSimulador(true)}
            >
              <Text style={styles.textoAvisoRequisito}>
                Emulador fuera de Huancavelica detectado. Toca aquí para abrir el Simulador.
              </Text>
            </Pressable>
          ) : null}

          {/* Panel colapsable de Simulación Huancavelica */}
          {mostrarSimulador ? (
            <View style={[styles.cardSimulador, sombras.suave]}>
              <View style={styles.filaSimuladorHeader}>
                <View style={styles.textosSimulador}>
                  <Text style={styles.tituloSimulador}>Simulación Huancavelica</Text>
                  <Text style={styles.descripcionSimulador}>
                    {simularHuancavelica
                      ? `${puntoSimulado.nombre} (${(ubicacionConductor?.latitude ?? puntoSimulado.latitude).toFixed(4)}, ${(ubicacionConductor?.longitude ?? puntoSimulado.longitude).toFixed(4)})`
                      : 'Usando GPS real del dispositivo'}
                  </Text>
                </View>
                <Switch
                  value={simularHuancavelica}
                  onValueChange={(valor) => {
                    setSimularHuancavelica(valor);
                    if (!valor) {
                      setSimulandoMovimiento(false);
                      setPosicionSimulada(null);
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: colores.primario }}
                  thumbColor={simularHuancavelica ? '#ffffff' : '#f4f3f4'}
                />
              </View>

              {simularHuancavelica ? (
                <View style={styles.puntosContainer}>
                  <Text style={styles.subtituloSimulador}>
                    Punto de inicio en Huancavelica:
                  </Text>
                  <View style={styles.filaChips}>
                    {PUNTOS_SIMULACION_HVCA.map((p) => {
                      const seleccionado = puntoSimulado.id === p.id;
                      return (
                        <Pressable
                          key={p.id}
                          style={[
                            styles.chipPunto,
                            seleccionado && styles.chipPuntoActivo,
                          ]}
                          onPress={() => {
                            setPuntoSimulado(p);
                            setPosicionSimulada(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.textoChip,
                              seleccionado && styles.textoChipActivo,
                            ]}
                          >
                            {p.nombre}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <Pressable
                    style={[
                      styles.botonSimularMovimiento,
                      simulandoMovimiento && styles.botonSimularMovimientoActivo,
                    ]}
                    onPress={() => setSimulandoMovimiento((prev) => !prev)}
                  >
                    <Text
                      style={[
                        styles.textoSimularMovimiento,
                        simulandoMovimiento && styles.textoSimularMovimientoActivo,
                      ]}
                    >
                      {simulandoMovimiento
                        ? 'Detener movimiento simulado'
                        : 'Simular movimiento en vivo'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Tarjeta de calificación al pasajero tras completar el viaje */}
          {viajeParaCalificar ? (
            <View style={[styles.cardViajeActivo, sombras.suave]}>
              <Text style={styles.tituloViaje}>¡Viaje completado!</Text>
              <Text style={styles.subtituloViaje}>
                Cobro final: S/{' '}
                {Number(
                  viajeParaCalificar.precio_final ?? viajeParaCalificar.precio_inicial,
                ).toFixed(2)}{' '}
                · Califica al pasajero
              </Text>
              <View style={styles.filaEstrellas}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setEstrellasPasajero(n)}
                    style={styles.botonEstrella}
                  >
                    <Text
                      style={[
                        styles.iconoEstrella,
                        n <= estrellasPasajero
                          ? styles.estrellaActiva
                          : styles.estrellaInactiva,
                      ]}
                    >
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.filaBotones}>
                <Button
                  label="Enviar calificación"
                  onPress={() => void enviarCalificacionPasajero()}
                  cargando={operando}
                  estilo={styles.flexUno}
                />
                <Button
                  label="Omitir"
                  variante="secundario"
                  onPress={() => setViajeParaCalificar(null)}
                  estilo={styles.botonOmitir}
                />
              </View>
            </View>
          ) : null}

          {/* Tarjeta de viaje activo operativa */}
          {viajeActivo ? (
            <View style={[styles.cardViajeActivo, sombras.suave]}>
              {/* Stepper visual de 3 pasos */}
              <View style={styles.stepper}>
                {PASOS_CONDUCTOR.map((paso, idx) => {
                  const completado = pasoActualConductor > idx;
                  const activo = pasoActualConductor === idx;
                  return (
                    <View key={paso.id} style={styles.itemPaso}>
                      <View style={styles.filaNodoPaso}>
                        {idx > 0 ? (
                          <View
                            style={[
                              styles.lineaPaso,
                              pasoActualConductor >= idx && styles.lineaPasoActiva,
                            ]}
                          />
                        ) : (
                          <View style={styles.lineaPasoEspaciador} />
                        )}

                        <View
                          style={[
                            styles.nodoPaso,
                            activo && styles.nodoPasoActivo,
                            completado && styles.nodoPasoCompletado,
                          ]}
                        >
                          {completado ? (
                            <Icono nombre="check" size={12} color={colores.fondo} />
                          ) : (
                            <Text
                              style={[
                                styles.numeroPaso,
                                (activo || completado) && styles.numeroPasoActivo,
                              ]}
                            >
                              {idx + 1}
                            </Text>
                          )}
                        </View>

                        {idx < PASOS_CONDUCTOR.length - 1 ? (
                          <View
                            style={[
                              styles.lineaPaso,
                              pasoActualConductor > idx && styles.lineaPasoActiva,
                            ]}
                          />
                        ) : (
                          <View style={styles.lineaPasoEspaciador} />
                        )}
                      </View>
                      <Text
                        style={[
                          styles.labelPaso,
                          (activo || completado) && styles.labelPasoActivo,
                        ]}
                      >
                        {paso.label}
                      </Text>
                    </View>
                  );
                })}
              </View>

              <View style={styles.cabeceraViajeActivo}>
                <View style={styles.flexUno}>
                  <Text style={styles.tituloViaje}>Viaje en curso</Text>
                  <Text style={styles.subtituloViaje}>
                    {etiquetaEstadoViaje(viajeActivo.estado)}
                  </Text>
                </View>
                <View style={styles.pillPrecioViaje}>
                  <Text style={styles.textoPrecioViaje}>
                    S/{' '}
                    {Number(
                      viajeActivo.precio_final ?? viajeActivo.precio_inicial,
                    ).toFixed(2)}
                  </Text>
                </View>
              </View>

              {distanciaObjetivoViaje ? (
                <View style={styles.bannerDistanciaViaje}>
                  <Icono nombre="mapa" size={15} color={colores.primario} />
                  <Text style={styles.textoDistanciaViaje}>
                    A ~{distanciaObjetivoViaje.minutos} min (
                    {distanciaObjetivoViaje.km < 1
                      ? `${Math.round(distanciaObjetivoViaje.km * 1000)} m`
                      : `${distanciaObjetivoViaje.km.toFixed(1)} km`}
                    ) del{' '}
                    {distanciaObjetivoViaje.haciaDestino
                      ? 'destino'
                      : 'punto de recojo'}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cajaRutaViaje}>
                <RutaVisual
                  etiquetaOrigen="Recojo"
                  etiquetaDestino="Destino"
                  origen={
                    viajeActivo.origen_direccion ??
                    formatearReferenciaHuancavelica({
                      latitude: viajeActivo.origen_lat,
                      longitude: viajeActivo.origen_lng,
                    })
                  }
                  destino={
                    viajeActivo.destino_direccion ??
                    formatearReferenciaHuancavelica({
                      latitude: viajeActivo.destino_lat,
                      longitude: viajeActivo.destino_lng,
                    })
                  }
                />
              </View>

              {perfilPasajero ? (
                <View style={styles.cardPasajero}>
                  <View style={styles.avatarPasajero}>
                    <Text style={styles.textoAvatarPasajero}>
                      {obtenerIniciales(perfilPasajero.nombre)}
                    </Text>
                  </View>
                  <View style={styles.flexUno}>
                    <View style={styles.filaNombrePasajero}>
                      <Text style={styles.pasajeroNombre} numberOfLines={1}>
                        {perfilPasajero.nombre}
                      </Text>
                      <Text style={styles.ratingPasajero}>
                        ★ {perfilPasajero.calificacion_promedio.toFixed(1)}
                      </Text>
                    </View>
                    {perfilPasajero.telefono ? (
                      <Text style={styles.pasajeroTelefono}>
                        {perfilPasajero.telefono}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}

              <View style={styles.filaContactoViaje}>
                <Pressable
                  style={[styles.botonContacto, styles.botonLlamar]}
                  onPress={() => void llamarPasajero()}
                >
                  <Text style={[styles.textoContacto, styles.textoLlamar]}>
                    Llamar
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.botonContacto, styles.botonWhatsApp]}
                  onPress={() => void abrirWhatsAppPasajero()}
                >
                  <Text style={[styles.textoContacto, styles.textoWhatsApp]}>
                    WhatsApp
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.botonContacto, styles.botonNavegar]}
                  onPress={() => void abrirNavegacionMaps()}
                >
                  <Text style={[styles.textoContacto, styles.textoNavegar]}>
                    Navegar
                  </Text>
                </Pressable>
              </View>

              <View style={styles.accionesViaje}>
                {viajeActivo.estado === 'aceptado' ? (
                  <Button
                    label="Llegué al punto de recojo"
                    onPress={() => void llegueAlOrigen()}
                    cargando={operando}
                    tamano="lg"
                  />
                ) : null}
                {viajeActivo.estado === 'en_camino_origen' ? (
                  <Button
                    label="Iniciar viaje"
                    variante="accent"
                    onPress={() => void iniciarViaje()}
                    cargando={operando}
                    tamano="lg"
                  />
                ) : null}
                {viajeActivo.estado === 'en_curso' ? (
                  <Button
                    label="Finalizar viaje"
                    variante="peligro"
                    onPress={() => void finalizarViaje()}
                    cargando={operando}
                    tamano="lg"
                  />
                ) : null}
                {viajeActivo.estado === 'aceptado' ||
                viajeActivo.estado === 'en_camino_origen' ? (
                  <Button
                    label="Cancelar viaje"
                    variante="secundario"
                    onPress={cancelarViajeConductor}
                    deshabilitado={operando}
                  />
                ) : null}
              </View>
            </View>
          ) : null}

          {/* Radar de solicitudes cercanas (legible en 1 segundo al volante) */}
          {isTracking && !viajeActivo ? (
            <View style={styles.seccionRadar}>
              <View style={styles.cabeceraRadar}>
                <View style={styles.filaTituloRadar}>
                  <Text style={styles.radarTitulo}>Solicitudes cercanas</Text>
                  <View style={styles.pillContadorRadar}>
                    <Text style={styles.textoContadorRadar}>
                      {solicitudesCercanas.length}
                    </Text>
                  </View>
                </View>
                <Text style={styles.etiquetaRadio}>Radio {DISTANCIA_MAX_KM} km</Text>
              </View>

              {solicitudesCercanas.length === 0 ? (
                <View style={[styles.cardVacioRadar, sombras.suave]}>
                  <View style={styles.circuloVacioRadar}>
                    <Icono nombre="volante" size={26} color={colores.primario} />
                  </View>
                  <Text style={styles.tituloVacioRadar}>
                    Buscando pasajeros cerca de ti
                  </Text>
                  <Text style={styles.textoVacioRadar}>
                    Las solicitudes a menos de {DISTANCIA_MAX_KM} km aparecerán aquí automáticamente.
                  </Text>
                </View>
              ) : (
                solicitudesCercanas.map(({ solicitud, distanciaKm }) => {
                  const ofertada = ofertasEnviadas.has(solicitud.id);
                  const editandoContra = contraofertaId === solicitud.id;
                  const precioBase = Number(solicitud.precio_inicial);
                  const origenTexto =
                    solicitud.origen_direccion ??
                    formatearReferenciaHuancavelica({
                      latitude: solicitud.origen_lat,
                      longitude: solicitud.origen_lng,
                    });
                  const destinoTexto =
                    solicitud.destino_direccion ??
                    formatearReferenciaHuancavelica({
                      latitude: solicitud.destino_lat,
                      longitude: solicitud.destino_lng,
                    });

                  return (
                    <View
                      key={solicitud.id}
                      style={[styles.tarjetaSolicitud, sombras.suave]}
                    >
                      <View style={styles.cabeceraSolicitud}>
                        <Text style={styles.solicitudPrecio}>
                          S/ {precioBase.toFixed(2)}
                        </Text>
                        <View style={styles.pillDistanciaSolicitud}>
                          <Text style={styles.textoDistanciaSolicitud}>
                            {distanciaKm < 1
                              ? `${Math.round(distanciaKm * 1000)} m`
                              : `${distanciaKm.toFixed(1)} km`}{' '}
                            de ti
                            {solicitud.distancia_km
                              ? ` · Viaje ${solicitud.distancia_km.toFixed(1)} km`
                              : ''}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.rutaSolicitud}>
                        <RutaVisual
                          origen={origenTexto}
                          destino={destinoTexto}
                          compacto
                        />
                      </View>

                      {ofertada ? (
                        <View style={styles.bannerOfertada}>
                          <Icono
                            nombre="check"
                            size={14}
                            color={colores.exitoOscuro}
                          />
                          <Text style={styles.textoOfertada}>
                            Oferta enviada · Esperando al pasajero
                          </Text>
                        </View>
                      ) : editandoContra ? (
                        <View style={styles.cajaContraoferta}>
                          <Text style={styles.etiquetaContraoferta}>
                            Tu contraoferta rápida:
                          </Text>

                          {/* Chips de contraoferta en 1 toque (+S/ 1, +S/ 2, +S/ 3) */}
                          <View style={styles.filaChipsContra}>
                            {[1, 2, 3].map((incremento) => {
                              const monto = precioBase + incremento;
                              return (
                                <Pressable
                                  key={incremento}
                                  onPress={() =>
                                    setPrecioContraoferta(monto.toFixed(2))
                                  }
                                  style={({ pressed }) => [
                                    styles.chipContra,
                                    precioContraoferta === monto.toFixed(2) &&
                                      styles.chipContraActivo,
                                    pressed && styles.presionadoSuave,
                                  ]}
                                >
                                  <Text
                                    style={[
                                      styles.textoChipContra,
                                      precioContraoferta === monto.toFixed(2) &&
                                        styles.textoChipContraActivo,
                                    ]}
                                  >
                                    +S/ {incremento} (S/ {monto.toFixed(0)})
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>

                          <View style={styles.filaInputContra}>
                            <View style={styles.cajaInputContra}>
                              <Text style={styles.prefijoContra}>S/</Text>
                              <TextInput
                                value={precioContraoferta}
                                onChangeText={setPrecioContraoferta}
                                keyboardType="decimal-pad"
                                placeholder={(precioBase + 1).toFixed(2)}
                                placeholderTextColor={colores.textoSuave}
                                testID="input-contraoferta"
                                style={styles.inputContraTexto}
                              />
                            </View>
                            <Button
                              label="Enviar"
                              tamano="sm"
                              onPress={() => void confirmarContraoferta(solicitud)}
                              cargando={operando}
                              estilo={styles.botonEnviarContra}
                            />
                            <Button
                              label="Cerrar"
                              variante="secundario"
                              tamano="sm"
                              onPress={() => setContraofertaId(null)}
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.filaBotones}>
                          <Button
                            label={`Aceptar S/ ${precioBase.toFixed(2)}`}
                            onPress={() => void aceptarSolicitud(solicitud)}
                            cargando={operando}
                            estilo={styles.flexUno}
                          />
                          <Button
                            label="Contraofertar"
                            variante="secundario"
                            onPress={() => abrirContraoferta(solicitud)}
                            estilo={styles.botonContraoferta}
                          />
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  flexUno: {
    flex: 1,
  },
  presionadoSuave: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  /* Mapa Hero con HUD */
  contenedorMapaHero: {
    width: '100%',
    position: 'relative',
    backgroundColor: colores.superficieSecundaria,
  },
  mapaHero: {
    flex: 1,
  },
  hudSuperior: {
    position: 'absolute',
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillDireccion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radios.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  puntoEstadoHud: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  etiquetaHud: {
    fontSize: 10,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  direccionHud: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.texto,
  },
  pillGanancias: {
    backgroundColor: colores.primario,
    borderRadius: radios.lg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: 'center',
    minWidth: 82,
  },
  etiquetaGanancias: {
    fontSize: 9,
    fontWeight: '800',
    color: colores.accent,
    letterSpacing: 0.6,
  },
  valorGanancias: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.fondo,
  },
  hudInferior: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chipModoDemo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: radios.pill,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipModoDemoActivo: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  puntoDemo: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  textoModoDemo: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  textoModoDemoActivo: {
    color: colores.primario,
  },
  filaControlesMapa: {
    flexDirection: 'row',
    gap: 6,
  },
  botonMapaFlotante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radios.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  botonMapaFlotanteActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoBotonMapaFlotante: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  textoBotonMapaFlotanteActivo: {
    color: colores.fondo,
  },
  /* Cuerpo operativo */
  cuerpoOperativo: {
    marginTop: -16,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: colores.superficie,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  cardConexion: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 14,
  },
  filaConexion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filaSaludoEstado: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  puntoConexion: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  puntoConexionActivo: {
    backgroundColor: colores.exito,
  },
  puntoConexionInactivo: {
    backgroundColor: colores.textoSuave,
    opacity: 0.45,
  },
  textoEstadoConexion: {
    fontSize: 17,
    fontWeight: '800',
    color: colores.texto,
  },
  subtituloConexion: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  botonConectarCompacto: {
    minWidth: 126,
    paddingHorizontal: 16,
  },
  avisoRequisito: {
    backgroundColor: colores.accentSuave,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10,
  },
  textoAvisoRequisito: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.accentOscuro,
    lineHeight: 16,
  },
  bannerError: {
    backgroundColor: colores.peligroSuave,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  textoBannerError: {
    color: colores.peligroOscuro,
    fontSize: 13,
    fontWeight: '600',
  },
  bannerExito: {
    backgroundColor: colores.exitoSuave,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  textoBannerExito: {
    color: colores.exitoOscuro,
    fontSize: 13,
    fontWeight: '600',
  },
  /* Simulador colapsable */
  cardSimulador: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaSimuladorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textosSimulador: {
    flex: 1,
    paddingRight: 12,
  },
  tituloSimulador: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.texto,
  },
  descripcionSimulador: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  puntosContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colores.bordeSuave,
    paddingTop: 12,
  },
  subtituloSimulador: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
    marginBottom: 8,
  },
  filaChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipPunto: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radios.pill,
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipPuntoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoChip: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSecundario,
  },
  textoChipActivo: {
    color: colores.fondo,
    fontWeight: '700',
  },
  botonSimularMovimiento: {
    marginTop: 12,
    borderRadius: radios.md,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    alignItems: 'center',
  },
  botonSimularMovimientoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoSimularMovimiento: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.primario,
  },
  textoSimularMovimientoActivo: {
    color: colores.fondo,
  },
  /* Viaje activo */
  cardViajeActivo: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  itemPaso: {
    flex: 1,
    alignItems: 'center',
  },
  filaNodoPaso: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  lineaPaso: {
    flex: 1,
    height: 2,
    backgroundColor: colores.borde,
  },
  lineaPasoActiva: {
    backgroundColor: colores.primario,
  },
  lineaPasoEspaciador: {
    flex: 1,
  },
  nodoPaso: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1.5,
    borderColor: colores.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodoPasoActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  nodoPasoCompletado: {
    backgroundColor: colores.exito,
    borderColor: colores.exito,
  },
  numeroPaso: {
    fontSize: 11,
    fontWeight: '800',
    color: colores.textoSuave,
  },
  numeroPasoActivo: {
    color: colores.fondo,
  },
  labelPaso: {
    fontSize: 11,
    fontWeight: '600',
    color: colores.textoSuave,
    marginTop: 4,
  },
  labelPasoActivo: {
    color: colores.texto,
    fontWeight: '700',
  },
  cabeceraViajeActivo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  tituloViaje: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  subtituloViaje: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  pillPrecioViaje: {
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  textoPrecioViaje: {
    fontSize: 16,
    fontWeight: '800',
    color: colores.primario,
  },
  bannerDistanciaViaje: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    borderRadius: radios.md,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
  },
  textoDistanciaViaje: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.primario,
  },
  cajaRutaViaje: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 12,
    marginBottom: 12,
  },
  cardPasajero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 11,
    marginBottom: 12,
  },
  avatarPasajero: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvatarPasajero: {
    color: colores.fondo,
    fontSize: 14,
    fontWeight: '800',
  },
  filaNombrePasajero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pasajeroNombre: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
    flexShrink: 1,
  },
  ratingPasajero: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  pasajeroTelefono: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  filaContactoViaje: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  botonContacto: {
    flex: 1,
    borderRadius: radios.md,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  botonLlamar: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  botonWhatsApp: {
    backgroundColor: colores.exitoSuave,
    borderColor: colores.exitoBorde,
  },
  botonNavegar: {
    backgroundColor: colores.superficieSecundaria,
    borderColor: colores.borde,
  },
  textoContacto: {
    fontSize: 13,
    fontWeight: '700',
  },
  textoLlamar: {
    color: colores.primario,
  },
  textoWhatsApp: {
    color: colores.exitoOscuro,
  },
  textoNavegar: {
    color: colores.texto,
  },
  accionesViaje: {
    gap: 8,
  },
  /* Calificación */
  filaEstrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 12,
  },
  botonEstrella: {
    padding: 4,
  },
  iconoEstrella: {
    fontSize: 32,
  },
  estrellaActiva: {
    color: '#F59E0B',
  },
  estrellaInactiva: {
    color: '#D1D5DB',
  },
  botonOmitir: {
    minWidth: 96,
  },
  /* Radar de solicitudes */
  seccionRadar: {
    gap: 10,
  },
  cabeceraRadar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  filaTituloRadar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radarTitulo: {
    fontSize: 17,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.2,
  },
  pillContadorRadar: {
    backgroundColor: colores.primario,
    borderRadius: radios.pill,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoContadorRadar: {
    color: colores.fondo,
    fontSize: 12,
    fontWeight: '800',
  },
  etiquetaRadio: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
  },
  cardVacioRadar: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 22,
    alignItems: 'center',
  },
  circuloVacioRadar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tituloVacioRadar: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.texto,
  },
  textoVacioRadar: {
    fontSize: 13,
    color: colores.textoSuave,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  tarjetaSolicitud: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 15,
  },
  cabeceraSolicitud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  solicitudPrecio: {
    fontSize: 22,
    fontWeight: '800',
    color: colores.primario,
    letterSpacing: -0.4,
  },
  pillDistanciaSolicitud: {
    backgroundColor: colores.superficieSecundaria,
    borderRadius: radios.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  textoDistanciaSolicitud: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  rutaSolicitud: {
    marginBottom: 12,
  },
  bannerOfertada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colores.exitoSuave,
    borderWidth: 1,
    borderColor: colores.exitoBorde,
    borderRadius: radios.md,
    paddingVertical: 9,
  },
  textoOfertada: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.exitoOscuro,
  },
  filaBotones: {
    flexDirection: 'row',
    gap: 8,
  },
  botonContraoferta: {
    minWidth: 124,
    paddingHorizontal: 12,
  },
  /* Contraoferta rápida */
  cajaContraoferta: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 10,
    gap: 8,
  },
  etiquetaContraoferta: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  filaChipsContra: {
    flexDirection: 'row',
    gap: 6,
  },
  chipContra: {
    flex: 1,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.sm + 2,
    paddingVertical: 7,
    alignItems: 'center',
  },
  chipContraActivo: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primario,
  },
  textoChipContra: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  textoChipContraActivo: {
    color: colores.primario,
  },
  filaInputContra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cajaInputContra: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colores.fondo,
    borderWidth: 1.5,
    borderColor: colores.primario,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 10,
    height: 38,
  },
  prefijoContra: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.textoSuave,
    marginRight: 4,
  },
  inputContraTexto: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colores.texto,
    paddingVertical: 0,
  },
  botonEnviarContra: {
    minWidth: 74,
  },
});
