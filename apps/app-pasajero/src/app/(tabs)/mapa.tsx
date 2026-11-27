import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  DESTINOS_FRECUENTES_HVCA,
  HUANCAVELICA_CENTRO,
  Icono,
  RutaVisual,
  TARIFAS_POR_DEFECTO,
  authRepository,
  calcularDistanciaHaversine,
  calcularTarifa,
  colores,
  estaFueraDeHuancavelica,
  extraerCoordenadasPerfil,
  formatearReferenciaHuancavelica,
  obtenerDireccionLegible,
  radios,
  sombras,
  useAuth,
  useForegroundLocation,
  viajesRepository,
  type ConfiguracionTarifas,
  type Coordenadas,
  type DestinoFrecuenteHvca,
  type OfertaConductor,
  type Profile,
  type SolicitudEstado,
  type SolicitudViaje,
} from '@hvca/shared';

import { BuscadorDireccionesModal } from '../../components/BuscadorDireccionesModal';

const ZOOM_INICIAL = 0.01;

const PASOS_VIAJE = [
  { id: 'aceptado', label: 'En camino' },
  { id: 'en_camino_origen', label: 'En origen' },
  { id: 'en_curso', label: 'En viaje' },
] as const;

function indicePasoViaje(estado: SolicitudEstado): number {
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

function textoEstadoViaje(estado: SolicitudEstado): string {
  switch (estado) {
    case 'aceptado':
      return 'El conductor va en camino a tu ubicación.';
    case 'en_camino_origen':
      return 'Tu conductor llegó al punto de recojo. ¡Sube al taxi!';
    case 'en_curso':
      return 'Viaje en curso hacia tu destino.';
    case 'completado':
      return 'Viaje completado. ¡Gracias por viajar con Taxi HVCA!';
    case 'cancelada':
      return 'El viaje fue cancelado.';
    case 'buscando':
      return 'Esperando confirmación de conductores cercanos...';
  }
}

function etiquetaCortaEstado(estado: SolicitudEstado): string {
  switch (estado) {
    case 'aceptado':
      return 'Conductor en camino';
    case 'en_camino_origen':
      return 'Conductor en origen';
    case 'en_curso':
      return 'Viaje en curso';
    case 'completado':
      return 'Viaje completado';
    case 'cancelada':
      return 'Viaje cancelado';
    case 'buscando':
      return 'Buscando taxi';
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
  return (partes[0] ?? 'C').slice(0, 2).toUpperCase();
}

export default function PantallaMapa() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, sesion } = useAuth();
  const {
    coords,
    status: gpsStatus,
    loading: gpsLoading,
    error: errorUbicacion,
    requestPermissionAndLocate,
  } = useForegroundLocation({
    watch: true,
    distanceInterval: 15,
    timeInterval: 5000,
  });

  const mapRef = useRef<MapView | null>(null);
  const origenInicializadoRef = useRef(false);
  const ultimoEncuadreRef = useRef<string | null>(null);
  const arrastrandoRef = useRef(false);
  const animPin = useRef(new Animated.Value(0)).current;

  const [viajeVerificado, setViajeVerificado] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState<'destino' | 'origen'>('destino');
  const [buscadorTipo, setBuscadorTipo] = useState<'destino' | 'origen' | null>(null);
  const [direccionBajoPin, setDireccionBajoPin] = useState<string | null>(null);
  const [cargandoDireccionPin, setCargandoDireccionPin] = useState(false);
  const [tarifaEnfocada, setTarifaEnfocada] = useState(false);

  const [centroMapa, setCentroMapa] = useState<Coordenadas | null>(null);
  const [originCoords, setOriginCoords] = useState<Coordenadas | null>(null);
  const [destinoCoords, setDestinoCoords] = useState<Coordenadas | null>(null);
  const [origenDireccion, setOrigenDireccion] = useState<string | null>(null);
  const [destinoDireccion, setDestinoDireccion] = useState<string | null>(null);
  const [tarifa, setTarifa] = useState('');
  const [configPlataforma, setConfigPlataforma] =
    useState<ConfiguracionTarifas>(TARIFAS_POR_DEFECTO);

  const [solicitud, setSolicitud] = useState<SolicitudViaje | null>(null);
  const [ofertas, setOfertas] = useState<OfertaConductor[]>([]);
  const [perfilesOfertas, setPerfilesOfertas] = useState<Record<string, Profile>>({});
  const fetchedConductoresRef = useRef<Set<string>>(new Set());

  const [viajeAceptado, setViajeAceptado] = useState<SolicitudViaje | null>(null);
  const [perfilConductor, setPerfilConductor] = useState<Profile | null>(null);
  const [estrellasSeleccionadas, setEstrellasSeleccionadas] = useState<number>(5);
  const [calificacionEnviada, setCalificacionEnviada] = useState(false);

  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enViaje = viajeAceptado !== null;
  const userId = sesion?.user?.id;
  const primerNombre = (perfil?.nombre?.trim().split(/\s+/)[0] || '').trim();

  useEffect(() => {
    void requestPermissionAndLocate();
  }, [requestPermissionAndLocate]);

  // Suscripción a parámetros globales de tarifas configurados desde el panel admin
  useEffect(() => {
    return viajesRepository.suscribirConfiguracionTarifas(setConfigPlataforma);
  }, []);

  // Recuperación automática del viaje activo al abrir la app
  useEffect(() => {
    if (!userId) {
      setViajeVerificado(true);
      return;
    }
    let activo = true;

    async function recuperarViaje() {
      try {
        const activa = await viajesRepository.obtenerViajeActivoPasajero(userId!);
        if (!activo || !activa) return;

        const orig: Coordenadas = {
          latitude: activa.origen_lat,
          longitude: activa.origen_lng,
        };
        const dest: Coordenadas = {
          latitude: activa.destino_lat,
          longitude: activa.destino_lng,
        };
        origenInicializadoRef.current = true;
        setOriginCoords(orig);
        setDestinoCoords(dest);
        setOrigenDireccion(
          activa.origen_direccion ?? formatearReferenciaHuancavelica(orig),
        );
        setDestinoDireccion(
          activa.destino_direccion ?? formatearReferenciaHuancavelica(dest),
        );
        setCentroMapa(orig);

        if (activa.estado === 'buscando') {
          setSolicitud(activa);
        } else {
          setViajeAceptado(activa);
        }
      } catch (e) {
        console.warn('[mapa] Error al recuperar viaje activo:', e);
      } finally {
        if (activo) {
          setViajeVerificado(true);
        }
      }
    }

    void recuperarViaje();
    return () => {
      activo = false;
    };
  }, [userId]);

  // Autodetección del origen al abrir el mapa
  useEffect(() => {
    if (!viajeVerificado || solicitud || viajeAceptado || origenInicializadoRef.current) {
      return;
    }

    if (coords) {
      const fuera = estaFueraDeHuancavelica(coords);
      const origenInicial: Coordenadas = fuera
        ? HUANCAVELICA_CENTRO
        : { latitude: coords.latitude, longitude: coords.longitude };

      origenInicializadoRef.current = true;
      setOriginCoords(origenInicial);
      setCentroMapa(origenInicial);
      setModoSeleccion('destino');
      setOrigenDireccion(null);
      void obtenerDireccionLegible(origenInicial).then(setOrigenDireccion);
      mapRef.current?.animateToRegion(
        {
          ...origenInicial,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        450,
      );
      return;
    }

    if (!gpsLoading && gpsStatus !== null) {
      origenInicializadoRef.current = true;
      setOriginCoords(HUANCAVELICA_CENTRO);
      setCentroMapa(HUANCAVELICA_CENTRO);
      setModoSeleccion('destino');
      void obtenerDireccionLegible(HUANCAVELICA_CENTRO).then(setOrigenDireccion);
    }
  }, [viajeVerificado, solicitud, viajeAceptado, coords, gpsLoading, gpsStatus]);

  const mostrandoPin =
    Boolean(centroMapa) &&
    !solicitud &&
    !enViaje &&
    (modoSeleccion === 'origen' || !originCoords || !destinoCoords);

  // Previsualización en vivo de la calle/referencia bajo el pin central
  useEffect(() => {
    if (!mostrandoPin || !centroMapa) {
      setDireccionBajoPin(null);
      setCargandoDireccionPin(false);
      return;
    }

    let cancelado = false;
    setCargandoDireccionPin(true);
    const timer = setTimeout(() => {
      void obtenerDireccionLegible(centroMapa)
        .then((dir) => {
          if (!cancelado) {
            setDireccionBajoPin(dir);
          }
        })
        .finally(() => {
          if (!cancelado) {
            setCargandoDireccionPin(false);
          }
        });
    }, 450);

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [mostrandoPin, centroMapa]);

  const { distanciaKm, duracionEstMin, tarifaSugerida } = useMemo(() => {
    if (!originCoords || !destinoCoords) {
      return { distanciaKm: null, duracionEstMin: null, tarifaSugerida: null };
    }
    const km = calcularDistanciaHaversine(
      originCoords.latitude,
      originCoords.longitude,
      destinoCoords.latitude,
      destinoCoords.longitude,
    );
    const durMin = Math.max(3, Math.round(km * 3));
    const desglose = calcularTarifa({
      distanciaKm: km,
      duracionMin: durMin,
      tarifaBase: configPlataforma.tarifa_base,
      tarifaPorKm: configPlataforma.precio_por_km,
      tarifaPorMin: 0,
      tarifaMinima: configPlataforma.tarifa_minima,
    });
    return {
      distanciaKm: km,
      duracionEstMin: durMin,
      tarifaSugerida: desglose.total,
    };
  }, [originCoords, destinoCoords, configPlataforma]);

  function calcularTarifaParaRuta(origen: Coordenadas, destino: Coordenadas): number {
    const km = calcularDistanciaHaversine(
      origen.latitude,
      origen.longitude,
      destino.latitude,
      destino.longitude,
    );
    const desglose = calcularTarifa({
      distanciaKm: km,
      duracionMin: Math.max(3, Math.round(km * 3)),
      tarifaBase: configPlataforma.tarifa_base,
      tarifaPorKm: configPlataforma.precio_por_km,
      tarifaPorMin: 0,
      tarifaMinima: configPlataforma.tarifa_minima,
    });
    return desglose.total;
  }

  function moverCamaraA(punto: Coordenadas, delta = ZOOM_INICIAL) {
    setCentroMapa(punto);
    mapRef.current?.animateToRegion(
      {
        latitude: punto.latitude,
        longitude: punto.longitude,
        latitudeDelta: delta,
        longitudeDelta: delta,
      },
      450,
    );
  }

  function ajustarRutaEnMapa(origen: Coordenadas, destino: Coordenadas) {
    mapRef.current?.fitToCoordinates([origen, destino], {
      edgePadding: { top: 100, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  }

  function centrarEnHuancavelica(punto: Coordenadas = HUANCAVELICA_CENTRO) {
    moverCamaraA(punto);
    setMensaje('Mapa centrado en Plaza de Armas.');
  }

  async function irAMiUbicacion() {
    setError(null);
    const actual = coords ?? (await requestPermissionAndLocate());
    if (!actual) {
      centrarEnHuancavelica();
      return;
    }

    const fuera = estaFueraDeHuancavelica(actual);
    const punto: Coordenadas = fuera
      ? HUANCAVELICA_CENTRO
      : { latitude: actual.latitude, longitude: actual.longitude };
    moverCamaraA(punto);
    setMensaje(
      fuera
        ? 'Emulador fuera de Huancavelica: centrado en Plaza de Armas.'
        : 'Mapa centrado en tu ubicación actual.',
    );
  }

  async function usarMiGpsComoOrigen() {
    setError(null);
    const actual = coords ?? (await requestPermissionAndLocate());
    if (!actual) {
      moverCamaraA(HUANCAVELICA_CENTRO);
      return;
    }

    const fuera = estaFueraDeHuancavelica(actual);
    const punto: Coordenadas = fuera
      ? HUANCAVELICA_CENTRO
      : { latitude: actual.latitude, longitude: actual.longitude };
    setOriginCoords(punto);
    setOrigenDireccion(formatearReferenciaHuancavelica(punto));
    setModoSeleccion('destino');
    moverCamaraA(punto);
    void obtenerDireccionLegible(punto).then(setOrigenDireccion);
    if (destinoCoords) {
      ajustarRutaEnMapa(punto, destinoCoords);
    }
    setMensaje(
      fuera
        ? 'Origen fijado en Plaza de Armas (emulador). Elige tu destino.'
        : 'Origen actualizado con tu GPS actual.',
    );
  }

  function manejarInicioArrastre() {
    if (!mostrandoPin || arrastrandoRef.current) return;
    arrastrandoRef.current = true;
    Animated.timing(animPin, {
      toValue: 1,
      duration: 120,
      useNativeDriver: true,
    }).start();
  }

  function manejarFinArrastre() {
    if (!arrastrandoRef.current) return;
    arrastrandoRef.current = false;
    Animated.spring(animPin, {
      toValue: 0,
      friction: 6,
      tension: 140,
      useNativeDriver: true,
    }).start();
  }

  // Suscripción en tiempo real a las ofertas de la solicitud activa.
  useEffect(() => {
    if (!solicitud || enViaje) return;
    setOfertas([]);
    return viajesRepository.suscribirOfertas(
      solicitud.id,
      (oferta) => {
        setOfertas((prev) => {
          const sinEsta = prev.filter(
            (o) => o.id !== oferta.id && o.conductor_id !== oferta.conductor_id,
          );
          return [...sinEsta, oferta];
        });
      },
      (ofertaIdEliminada) => {
        setOfertas((prev) => prev.filter((o) => o.id !== ofertaIdEliminada));
      },
      (err) => {
        console.warn('[mapa] Error en suscripción de ofertas:', err);
      },
    );
  }, [solicitud, enViaje]);

  // Cargar perfiles reales de los conductores que envían ofertas
  useEffect(() => {
    ofertas.forEach((oferta) => {
      const id = oferta.conductor_id;
      if (!fetchedConductoresRef.current.has(id)) {
        fetchedConductoresRef.current.add(id);
        void authRepository
          .obtenerPerfil(id)
          .then((p) => {
            if (p) {
              setPerfilesOfertas((prev) => ({ ...prev, [id]: p }));
            }
          })
          .catch(() => {
            fetchedConductoresRef.current.delete(id);
          });
      }
    });
  }, [ofertas]);

  // Suscripción en tiempo real a los cambios de estado del viaje aceptado.
  const idViajeAceptado = viajeAceptado?.id;
  useEffect(() => {
    if (!idViajeAceptado) return;
    return viajesRepository.suscribirCambiosSolicitud(
      idViajeAceptado,
      (solicitudActualizada) => setViajeAceptado(solicitudActualizada),
    );
  }, [idViajeAceptado]);

  // Suscripción en tiempo real al perfil y ubicación GPS del conductor asignado.
  const idConductorAsignado = viajeAceptado?.conductor_id;
  useEffect(() => {
    if (!idConductorAsignado) {
      setPerfilConductor(null);
      return;
    }
    return authRepository.suscribirPerfil(idConductorAsignado, (p) => {
      setPerfilConductor(p);
    });
  }, [idConductorAsignado]);

  const coordsConductor = useMemo(
    () => extraerCoordenadasPerfil(perfilConductor),
    [perfilConductor],
  );

  function fijarOrigen() {
    if (!centroMapa) return;
    const punto = centroMapa;
    setOriginCoords(punto);
    setOrigenDireccion(formatearReferenciaHuancavelica(punto));
    setModoSeleccion('destino');
    setError(null);
    void obtenerDireccionLegible(punto).then((dir) => {
      setOrigenDireccion(dir);
    });
    if (destinoCoords) {
      ajustarRutaEnMapa(punto, destinoCoords);
      setMensaje('Origen actualizado. Revisa la ruta y tu oferta.');
    } else {
      setMensaje(null);
    }
  }

  function fijarDestino() {
    if (!centroMapa) return;
    const punto = centroMapa;
    setDestinoCoords(punto);
    setDestinoDireccion(
      direccionBajoPin ?? formatearReferenciaHuancavelica(punto),
    );
    setModoSeleccion('destino');
    setMensaje(null);
    setError(null);
    void obtenerDireccionLegible(punto).then((dir) => {
      setDestinoDireccion(dir);
    });

    if (originCoords) {
      ajustarRutaEnMapa(originCoords, punto);
      const totalSugerido = calcularTarifaParaRuta(originCoords, punto);
      setTarifa(totalSugerido.toFixed(2));
    }
  }

  function seleccionarDestinoRapido(lugar: DestinoFrecuenteHvca) {
    const punto: Coordenadas = {
      latitude: lugar.latitude,
      longitude: lugar.longitude,
    };
    setDestinoCoords(punto);
    setDestinoDireccion(lugar.direccion);
    setCentroMapa(punto);
    setModoSeleccion('destino');
    setError(null);
    setMensaje(null);

    if (originCoords) {
      ajustarRutaEnMapa(originCoords, punto);
      const totalSugerido = calcularTarifaParaRuta(originCoords, punto);
      setTarifa(totalSugerido.toFixed(2));
    } else {
      moverCamaraA(punto);
    }
  }

  function manejarSeleccionBuscador(lugar: { coords: Coordenadas; direccion: string }) {
    const tipoActivo = buscadorTipo;
    setBuscadorTipo(null);
    setError(null);
    setMensaje(null);

    if (tipoActivo === 'origen') {
      setOriginCoords(lugar.coords);
      setOrigenDireccion(lugar.direccion);
      setModoSeleccion('destino');
      if (destinoCoords) {
        ajustarRutaEnMapa(lugar.coords, destinoCoords);
        const totalSugerido = calcularTarifaParaRuta(lugar.coords, destinoCoords);
        setTarifa(totalSugerido.toFixed(2));
      } else {
        moverCamaraA(lugar.coords);
      }
      return;
    }

    // Selección de destino desde el buscador
    setDestinoCoords(lugar.coords);
    setDestinoDireccion(lugar.direccion);
    setCentroMapa(lugar.coords);
    setModoSeleccion('destino');

    if (originCoords) {
      ajustarRutaEnMapa(originCoords, lugar.coords);
      const totalSugerido = calcularTarifaParaRuta(originCoords, lugar.coords);
      setTarifa(totalSugerido.toFixed(2));
    } else {
      moverCamaraA(lugar.coords);
    }
  }

  function manejarElegirEnMapaDesdeBuscador() {
    const tipoActivo = buscadorTipo;
    setBuscadorTipo(null);
    setError(null);
    setMensaje(null);

    if (tipoActivo === 'origen') {
      setModoSeleccion('origen');
      if (originCoords) {
        moverCamaraA(originCoords);
      }
      return;
    }

    setDestinoCoords(null);
    setDestinoDireccion(null);
    setModoSeleccion('destino');
  }

  function ajustarTarifa(delta: number) {
    setError(null);
    const actual = parseFloat(tarifa.trim().replace(',', '.'));
    const base = Number.isNaN(actual)
      ? (tarifaSugerida ?? configPlataforma.tarifa_minima)
      : actual;
    const nuevo = Math.max(
      configPlataforma.tarifa_minima,
      Math.round((base + delta) * 2) / 2,
    );
    setTarifa(nuevo.toFixed(2));
  }

  async function pedirTaxi() {
    if (!originCoords || !sesion?.user) return;

    if (!perfil?.telefono_verificado) {
      Alert.alert(
        'Verificación Obligatoria',
        'Por seguridad de todos los usuarios, debes verificar tu número de celular con el código SMS antes de solicitar un taxi.',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Verificar en Perfil',
            onPress: () => router.push('/(tabs)/perfil'),
          },
        ],
      );
      return;
    }

    const precio = parseFloat(tarifa.trim().replace(',', '.'));
    if (Number.isNaN(precio) || precio <= 0) {
      setError(
        `Ingresa una tarifa válida, por ejemplo ${configPlataforma.tarifa_minima.toFixed(2)}.`,
      );
      return;
    }
    if (precio < configPlataforma.tarifa_minima) {
      setError(
        `La tarifa mínima configurada es S/ ${configPlataforma.tarifa_minima.toFixed(2)}.`,
      );
      return;
    }

    const destinoFinal = destinoCoords ?? centroMapa ?? originCoords;
    const distKm = calcularDistanciaHaversine(
      originCoords.latitude,
      originCoords.longitude,
      destinoFinal.latitude,
      destinoFinal.longitude,
    );

    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const creada = await viajesRepository.crearSolicitud(
        sesion.user.id,
        originCoords,
        destinoFinal,
        precio,
        {
          origen_direccion:
            origenDireccion ?? formatearReferenciaHuancavelica(originCoords),
          destino_direccion:
            destinoDireccion ?? formatearReferenciaHuancavelica(destinoFinal),
          distancia_km: Math.round(distKm * 100) / 100,
        },
      );
      setDestinoCoords(destinoFinal);
      setSolicitud(creada);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la solicitud.');
    } finally {
      setOperando(false);
    }
  }

  async function aceptarOferta(oferta: OfertaConductor) {
    if (!solicitud) return;
    setOperando(true);
    setError(null);
    setMensaje(null);
    try {
      const viaje = await viajesRepository.aceptarOferta(
        solicitud.id,
        oferta.conductor_id,
        oferta.precio,
        oferta.id,
      );
      setViajeAceptado(viaje);
      setOfertas([]);
      setEstrellasSeleccionadas(5);
      setCalificacionEnviada(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo aceptar la oferta.');
    } finally {
      setOperando(false);
    }
  }

  async function cancelarSolicitud() {
    const solicitudActiva = solicitud ?? viajeAceptado;
    if (
      solicitudActiva &&
      solicitudActiva.estado !== 'completado' &&
      solicitudActiva.estado !== 'cancelada'
    ) {
      setOperando(true);
      try {
        await viajesRepository.cancelarSolicitud(solicitudActiva.id, {
          canceladoPor: 'pasajero',
        });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : 'No se pudo cancelar la solicitud.',
        );
      } finally {
        setOperando(false);
      }
    }
    setSolicitud(null);
    setOfertas([]);
    setViajeAceptado(null);
    setPerfilConductor(null);
    origenInicializadoRef.current = false;
    setOriginCoords(null);
    setDestinoCoords(null);
    setOrigenDireccion(null);
    setDestinoDireccion(null);
    setModoSeleccion('destino');
    setDireccionBajoPin(null);
    setTarifa('');
    setEstrellasSeleccionadas(5);
    setCalificacionEnviada(false);
    setMensaje(null);
    setError(null);
  }

  async function llamarConductor() {
    const tel = perfilConductor?.telefono?.trim();
    if (!tel) {
      Alert.alert('Sin teléfono', 'El conductor no tiene un teléfono registrado.');
      return;
    }
    const url = `tel:${tel.replace(/\s+/g, '')}`;
    const puede = await Linking.canOpenURL(url);
    if (puede) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Teléfono del conductor', tel);
    }
  }

  async function abrirWhatsAppConductor() {
    const numero = normalizarTelefonoWhatsApp(perfilConductor?.telefono ?? '');
    if (!numero) {
      Alert.alert('Sin WhatsApp', 'El conductor no tiene un celular válido.');
      return;
    }
    const msg = encodeURIComponent(
      `Hola ${perfilConductor?.nombre ?? ''}, soy tu pasajero de Taxi HVCA.`,
    );
    await Linking.openURL(`https://wa.me/${numero}?text=${msg}`);
  }

  async function compartirRutaViaje() {
    if (!viajeAceptado) return;
    const orig =
      viajeAceptado.origen_direccion ??
      `${viajeAceptado.origen_lat.toFixed(4)}, ${viajeAceptado.origen_lng.toFixed(4)}`;
    const dest =
      viajeAceptado.destino_direccion ??
      `${viajeAceptado.destino_lat.toFixed(4)}, ${viajeAceptado.destino_lng.toFixed(4)}`;
    const linkMaps = `https://www.google.com/maps/dir/?api=1&origin=${viajeAceptado.origen_lat},${viajeAceptado.origen_lng}&destination=${viajeAceptado.destino_lat},${viajeAceptado.destino_lng}`;
    await Share.share({
      message: `Estoy viajando con Taxi HVCA.\nConductor: ${perfilConductor?.nombre ?? 'Asignado'} (${perfilConductor?.vehiculo ?? 'Vehículo'})\nOrigen: ${orig}\nDestino: ${dest}\nSeguir ruta: ${linkMaps}`,
    });
  }

  async function enviarCalificacionConductor() {
    if (!viajeAceptado || !userId || !viajeAceptado.conductor_id) return;
    setOperando(true);
    setError(null);
    try {
      await viajesRepository.calificarViaje({
        solicitudId: viajeAceptado.id,
        evaluadorId: userId,
        evaluadoId: viajeAceptado.conductor_id,
        rolEvaluador: 'pasajero',
        estrellas: estrellasSeleccionadas,
      });
      setCalificacionEnviada(true);
      setMensaje('¡Gracias por calificar tu viaje!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo enviar la calificación.');
    } finally {
      setOperando(false);
    }
  }

  const puntoOrigenMapa = viajeAceptado
    ? { latitude: viajeAceptado.origen_lat, longitude: viajeAceptado.origen_lng }
    : solicitud
      ? { latitude: solicitud.origen_lat, longitude: solicitud.origen_lng }
      : originCoords;

  const puntoDestinoMapa = viajeAceptado
    ? { latitude: viajeAceptado.destino_lat, longitude: viajeAceptado.destino_lng }
    : solicitud
      ? { latitude: solicitud.destino_lat, longitude: solicitud.destino_lng }
      : destinoCoords;

  function encuadrarViajeActivo() {
    if (!mapRef.current) return;
    const puntos = [puntoOrigenMapa, puntoDestinoMapa, coordsConductor].filter(
      (p): p is Coordenadas => Boolean(p),
    );
    if (puntos.length >= 2) {
      mapRef.current.fitToCoordinates(puntos, {
        edgePadding: { top: 96, right: 60, bottom: 320, left: 60 },
        animated: true,
      });
    } else if (puntos[0]) {
      moverCamaraA(puntos[0], 0.015);
    }
  }

  // Encuadra automáticamente al pasajero, destino y conductor al iniciar o cambiar el estado del viaje
  useEffect(() => {
    if (!viajeAceptado) {
      ultimoEncuadreRef.current = null;
      return;
    }
    const clave = `${viajeAceptado.id}:${viajeAceptado.estado}:${Boolean(coordsConductor)}`;
    if (ultimoEncuadreRef.current === clave) return;
    ultimoEncuadreRef.current = clave;

    const timer = setTimeout(() => {
      encuadrarViajeActivo();
    }, 250);
    return () => clearTimeout(timer);
  }, [viajeAceptado?.id, viajeAceptado?.estado, coordsConductor]);

  const infoConductorViaje = useMemo(() => {
    if (!viajeAceptado || !coordsConductor) return null;
    const haciaDestino = viajeAceptado.estado === 'en_curso';
    const objetivo = haciaDestino ? puntoDestinoMapa : puntoOrigenMapa;
    if (!objetivo) return null;
    const km = calcularDistanciaHaversine(
      coordsConductor.latitude,
      coordsConductor.longitude,
      objetivo.latitude,
      objetivo.longitude,
    );
    const minutos = Math.max(1, Math.round((km / 22) * 60));
    return { km, minutos, haciaDestino };
  }, [viajeAceptado, coordsConductor, puntoOrigenMapa, puntoDestinoMapa]);

  const gpsFueraDeHvca = Boolean(coords && estaFueraDeHuancavelica(coords));
  const tarifaNumerica = parseFloat(tarifa.trim().replace(',', '.'));
  const puedeRestarTarifa =
    !Number.isNaN(tarifaNumerica) && tarifaNumerica > configPlataforma.tarifa_minima;

  const etiquetaSuperior = enViaje
    ? etiquetaCortaEstado(viajeAceptado.estado)
    : solicitud
      ? 'Buscando conductores'
      : modoSeleccion === 'origen'
        ? 'Ajusta tu recogida'
        : primerNombre
          ? `Hola, ${primerNombre}`
          : 'Taxi HVCA';

  const colorPuntoSuperior = enViaje
    ? viajeAceptado.estado === 'cancelada'
      ? colores.peligro
      : colores.exito
    : solicitud
      ? colores.accent
      : modoSeleccion === 'origen'
        ? colores.exito
        : colores.primario;

  const pinTranslateY = animPin.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10],
  });
  const sombraScale = animPin.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.72],
  });
  const sombraOpacity = animPin.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.16],
  });

  const textoOrigenActual =
    origenDireccion ??
    (originCoords
      ? `${originCoords.latitude.toFixed(4)}, ${originCoords.longitude.toFixed(4)}`
      : 'Detectando ubicación...');

  const textoDestinoActual =
    destinoDireccion ??
    (destinoCoords
      ? `${destinoCoords.latitude.toFixed(4)}, ${destinoCoords.longitude.toFixed(4)}`
      : '');

  const pasoActualViaje = viajeAceptado ? indicePasoViaje(viajeAceptado.estado) : -1;

  return (
    <View style={styles.contenedor}>
      {centroMapa ? (
        <MapView
          ref={mapRef}
          style={styles.mapa}
          initialRegion={{
            latitude: centroMapa.latitude,
            longitude: centroMapa.longitude,
            latitudeDelta: ZOOM_INICIAL,
            longitudeDelta: ZOOM_INICIAL,
          }}
          showsUserLocation={Boolean(coords && !gpsFueraDeHvca)}
          showsMyLocationButton={false}
          onPanDrag={manejarInicioArrastre}
          onRegionChangeComplete={(region) => {
            manejarFinArrastre();
            if (!solicitud && !enViaje) {
              setCentroMapa({
                latitude: region.latitude,
                longitude: region.longitude,
              });
            }
          }}
        >
          {puntoOrigenMapa ? (
            <Marker
              coordinate={puntoOrigenMapa}
              title="Origen"
              description={origenDireccion ?? 'Punto de recogida'}
              pinColor="#16A34A"
            />
          ) : null}

          {puntoDestinoMapa ? (
            <Marker
              coordinate={puntoDestinoMapa}
              title="Destino"
              description={destinoDireccion ?? 'Punto de llegada'}
              pinColor="#DC2626"
            />
          ) : null}

          {puntoOrigenMapa && puntoDestinoMapa ? (
            <Polyline
              coordinates={[puntoOrigenMapa, puntoDestinoMapa]}
              strokeColor={colores.primario}
              strokeWidth={4}
            />
          ) : null}

          {enViaje && coordsConductor ? (
            <Marker
              coordinate={coordsConductor}
              title={perfilConductor?.nombre ?? 'Tu conductor'}
              description={perfilConductor?.vehiculo ?? 'Ubicación en tiempo real'}
              pinColor="#F59E0B"
            />
          ) : null}

          {enViaje &&
          coordsConductor &&
          puntoOrigenMapa &&
          (viajeAceptado?.estado === 'aceptado' ||
            viajeAceptado?.estado === 'en_camino_origen') ? (
            <Polyline
              coordinates={[coordsConductor, puntoOrigenMapa]}
              strokeColor="#F59E0B"
              strokeWidth={3}
              lineDashPattern={[6, 4]}
            />
          ) : null}
        </MapView>
      ) : (
        <View style={styles.estadoOverlay}>
          {gpsLoading || !viajeVerificado ? (
            <>
              <ActivityIndicator size="large" color={colores.primario} />
              <Text style={styles.estadoTexto}>Ubicándote en Huancavelica...</Text>
            </>
          ) : (
            <>
              <Text style={styles.estadoTexto}>
                {errorUbicacion ?? 'No fue posible obtener tu ubicación.'}
              </Text>
              <Button
                label="Permitir ubicación"
                onPress={() => void requestPermissionAndLocate()}
                estilo={styles.botonReintentar}
              />
            </>
          )}
        </View>
      )}

      {/* Pin central animado para elegir destino o ajustar origen */}
      {mostrandoPin ? (
        <View pointerEvents="none" style={styles.pinContenedor}>
          <Animated.View
            style={[
              styles.pinCuerpo,
              { transform: [{ translateY: pinTranslateY }] },
            ]}
          >
            <View
              style={[
                styles.pinEtiqueta,
                modoSeleccion === 'origen'
                  ? styles.pinEtiquetaOrigen
                  : styles.pinEtiquetaDestino,
              ]}
            >
              <Text style={styles.pinEtiquetaTexto}>
                {modoSeleccion === 'origen' ? 'Recoger aquí' : 'Destino'}
              </Text>
            </View>
            <View
              style={[
                styles.pinCirculo,
                modoSeleccion === 'origen'
                  ? styles.pinCirculoOrigen
                  : styles.pinCirculoDestino,
              ]}
            >
              <View style={styles.pinPunto} />
            </View>
            <View
              style={[
                styles.pinTriangulo,
                modoSeleccion === 'origen'
                  ? styles.pinTrianguloOrigen
                  : styles.pinTrianguloDestino,
              ]}
            />
          </Animated.View>
          <Animated.View
            style={[
              styles.pinSombra,
              {
                opacity: sombraOpacity,
                transform: [{ scale: sombraScale }],
              },
            ]}
          />
        </View>
      ) : null}

      {/* Controles flotantes superiores */}
      <View
        pointerEvents="box-none"
        style={[
          styles.barraSuperiorFlotante,
          {
            top: Math.max(insets.top, 12) + 4,
            left: Math.max(insets.left, 14),
            right: Math.max(insets.right, 14),
          },
        ]}
      >
        <View style={[styles.pillEstadoSuperior, sombras.media]}>
          <View
            style={[
              styles.puntoSuperior,
              { backgroundColor: colorPuntoSuperior },
            ]}
          />
          <Text style={styles.textoEstadoSuperior} numberOfLines={1}>
            {etiquetaSuperior}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            if (enViaje) {
              encuadrarViajeActivo();
            } else {
              void irAMiUbicacion();
            }
          }}
          style={({ pressed }) => [
            styles.botonUbicacionFlotante,
            sombras.media,
            pressed && styles.botonFlotantePresionado,
          ]}
          accessibilityLabel={enViaje ? 'Centrar mapa en el viaje' : 'Ir a mi ubicación'}
        >
          <Icono nombre="objetivo" size={18} color={colores.primario} />
          <Text style={styles.botonUbicacionTexto}>
            {enViaje ? 'Centrar' : 'Mi ubicación'}
          </Text>
        </Pressable>
      </View>

      {/* Panel inferior moderno (Bottom Sheet) */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        pointerEvents="box-none"
        style={styles.keyboardBottom}
      >
        {!enViaje ? (
          <View
            style={[
              styles.sheet,
              sombras.media,
              { paddingBottom: Math.max(insets.bottom, 12) + 4 },
            ]}
          >
            <View style={styles.handle} />

            {mensaje ? (
              <View style={styles.bannerInfo}>
                <Text style={styles.textoBannerInfo}>{mensaje}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.bannerError}>
                <Text style={styles.textoBannerError}>{error}</Text>
              </View>
            ) : null}

            {!solicitud ? (
              modoSeleccion === 'origen' || !originCoords ? (
                <>
                  <Text style={styles.tituloSheet}>Ajusta tu punto de recogida</Text>
                  <View style={styles.cajaPreviaPin}>
                    <View style={styles.puntoOrigenSencillo} />
                    <View style={styles.flexUno}>
                      <Text style={styles.etiquetaPreviaPin}>Recoger aquí</Text>
                      <Text style={styles.textoPreviaPin} numberOfLines={1}>
                        {cargandoDireccionPin
                          ? 'Buscando dirección...'
                          : direccionBajoPin ?? 'Mueve el mapa a tu punto de recogida'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.filaAccionesMapa}>
                    <Button
                      label="Confirmar origen"
                      onPress={fijarOrigen}
                      deshabilitado={!centroMapa}
                      estilo={styles.botonMitad}
                    />
                    <Button
                      label="Usar GPS"
                      variante="secundario"
                      icono={<Icono nombre="objetivo" size={16} color={colores.primario} />}
                      onPress={() => void usarMiGpsComoOrigen()}
                      estilo={styles.botonMitad}
                    />
                  </View>
                </>
              ) : !destinoCoords ? (
                <>
                  <Text style={styles.tituloSheet}>¿A dónde te llevamos?</Text>

                  {/* Barra de búsqueda protagonista (abre autocompletado de direcciones) */}
                  <Pressable
                    onPress={() => setBuscadorTipo('destino')}
                    style={({ pressed }) => [
                      styles.barraBuscador,
                      pressed && styles.botonFlotantePresionado,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="Buscar dirección de destino"
                  >
                    <Icono nombre="lupa" size={18} color={colores.primario} />
                    <Text style={styles.placeholderBuscador} numberOfLines={1}>
                      Buscar calle, lugar o dirección...
                    </Text>
                  </Pressable>

                  {/* Origen autodetectado */}
                  <View style={styles.filaOrigenCompacto}>
                    <View style={styles.puntoOrigenSencillo} />
                    <View style={styles.flexUno}>
                      <Text style={styles.etiquetaMini}>Origen detectado</Text>
                      <Text style={styles.valorMini} numberOfLines={1}>
                        {textoOrigenActual}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => setBuscadorTipo('origen')}
                      hitSlop={8}
                    >
                      <Text style={styles.enlaceCambiar}>Cambiar</Text>
                    </Pressable>
                  </View>

                  {/* Destino en vivo bajo el pin (opcional si mueve el mapa) */}
                  <View style={styles.cajaPreviaPin}>
                    <View style={styles.puntoDestinoSencillo} />
                    <View style={styles.flexUno}>
                      <Text style={styles.etiquetaPreviaPin}>
                        O mueve el mapa para fijar punto exacto
                      </Text>
                      <Text style={styles.textoPreviaPin} numberOfLines={1}>
                        {cargandoDireccionPin
                          ? 'Buscando calle o referencia...'
                          : direccionBajoPin ?? 'Arrastra el mapa hasta tu destino'}
                      </Text>
                    </View>
                  </View>

                  {/* Destinos frecuentes de Huancavelica */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listaChipsDestinos}
                    style={styles.scrollDestinos}
                  >
                    {DESTINOS_FRECUENTES_HVCA.map((lugar) => (
                      <Pressable
                        key={lugar.id}
                        onPress={() => seleccionarDestinoRapido(lugar)}
                        style={({ pressed }) => [
                          styles.chipDestino,
                          pressed && styles.chipDestinoPresionado,
                        ]}
                      >
                        <Text style={styles.textoChipDestino}>{lugar.nombre}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <Button
                    label="Confirmar destino en el mapa"
                    onPress={fijarDestino}
                    deshabilitado={!centroMapa}
                  />
                </>
              ) : (
                <>
                  {/* Tarjeta de ruta editable con conector visual */}
                  <View style={styles.tarjetaRutaEditable}>
                    <View style={styles.columnaPuntosRuta}>
                      <View style={styles.puntoOrigenExterior}>
                        <View style={styles.puntoOrigenInterior} />
                      </View>
                      <View style={styles.lineaRutaEditable} />
                      <View style={styles.puntoDestinoSencillo} />
                    </View>

                    <View style={styles.columnaFilasRuta}>
                      <View style={styles.filaEditableRuta}>
                        <View style={styles.flexUno}>
                          <Text style={styles.etiquetaMini}>Origen</Text>
                          <Text style={styles.valorMini} numberOfLines={1}>
                            {textoOrigenActual}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setBuscadorTipo('origen')}
                          hitSlop={8}
                        >
                          <Text style={styles.enlaceCambiar}>Editar</Text>
                        </Pressable>
                      </View>

                      <View style={styles.divisorSuave} />

                      <View style={styles.filaEditableRuta}>
                        <View style={styles.flexUno}>
                          <Text style={styles.etiquetaMini}>Destino</Text>
                          <Text style={styles.valorMini} numberOfLines={1}>
                            {textoDestinoActual}
                          </Text>
                        </View>
                        <Pressable
                          onPress={() => setBuscadorTipo('destino')}
                          hitSlop={8}
                        >
                          <Text style={styles.enlaceCambiar}>Editar</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>

                  {/* Resumen de distancia y tarifa sugerida */}
                  {tarifaSugerida !== null && distanciaKm !== null ? (
                    <View style={styles.filaResumenTarifa}>
                      <Text style={styles.metaRuta}>
                        {distanciaKm.toFixed(1)} km · ~{duracionEstMin} min
                      </Text>
                      <Pressable
                        style={styles.chipSugerida}
                        onPress={() => setTarifa(tarifaSugerida.toFixed(2))}
                      >
                        <Text style={styles.textoChipSugerida}>
                          Sugerida: S/ {tarifaSugerida.toFixed(2)}
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}

                  {/* Control rápido de tarifa estilo inDrive (- S/ 1 | S/ Input | + S/ 1) */}
                  <View style={styles.filaControlTarifa}>
                    <Pressable
                      onPress={() => ajustarTarifa(-1)}
                      disabled={!puedeRestarTarifa}
                      style={({ pressed }) => [
                        styles.botonAjusteTarifa,
                        !puedeRestarTarifa && styles.botonAjusteDeshabilitado,
                        pressed && puedeRestarTarifa && styles.botonFlotantePresionado,
                      ]}
                    >
                      <Text style={styles.textoAjusteTarifa}>- S/ 1</Text>
                    </Pressable>

                    <View
                      style={[
                        styles.cajaTarifaCentral,
                        tarifaEnfocada && styles.cajaTarifaEnfocada,
                      ]}
                    >
                      <Text style={styles.prefijoMoneda}>S/</Text>
                      <TextInput
                        value={tarifa}
                        onChangeText={setTarifa}
                        keyboardType="decimal-pad"
                        placeholder={configPlataforma.tarifa_minima.toFixed(2)}
                        placeholderTextColor={colores.textoSuave}
                        onFocus={() => setTarifaEnfocada(true)}
                        onBlur={() => setTarifaEnfocada(false)}
                        testID="input-tarifa"
                        style={styles.inputTarifaCentro}
                      />
                    </View>

                    <Pressable
                      onPress={() => ajustarTarifa(1)}
                      style={({ pressed }) => [
                        styles.botonAjusteTarifa,
                        pressed && styles.botonFlotantePresionado,
                      ]}
                    >
                      <Text style={styles.textoAjusteTarifa}>+ S/ 1</Text>
                    </Pressable>
                  </View>

                  {!perfil?.telefono_verificado ? (
                    <Pressable
                      style={styles.alertaVerificacion}
                      onPress={() => router.push('/(tabs)/perfil')}
                    >
                      <Text style={styles.textoAlertaVerificacion}>
                        Verifica tu número de celular en Mi Perfil para pedir un taxi.
                      </Text>
                    </Pressable>
                  ) : null}

                  <Button
                    label={
                      !Number.isNaN(tarifaNumerica) && tarifaNumerica > 0
                        ? `Pedir Taxi · S/ ${tarifaNumerica.toFixed(2)}`
                        : 'Pedir Taxi'
                    }
                    onPress={() => void pedirTaxi()}
                    cargando={operando}
                    deshabilitado={!tarifa.trim()}
                    tamano="lg"
                  />
                </>
              )
            ) : (
              /* Estado: buscando conductores y mostrando ofertas */
              <>
                <View style={styles.cabeceraBuscando}>
                  <View style={styles.filaTituloBuscando}>
                    <ActivityIndicator size="small" color={colores.primario} />
                    <Text style={styles.buscando}>Buscando conductores...</Text>
                  </View>
                  <View style={styles.pillPrecioOfrecido}>
                    <Text style={styles.textoPrecioOfrecido}>
                      S/ {Number(solicitud.precio_inicial).toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={styles.resumenRutaBuscando}>
                  <RutaVisual
                    origen={
                      solicitud.origen_direccion ??
                      formatearReferenciaHuancavelica({
                        latitude: solicitud.origen_lat,
                        longitude: solicitud.origen_lng,
                      })
                    }
                    destino={
                      solicitud.destino_direccion ??
                      formatearReferenciaHuancavelica({
                        latitude: solicitud.destino_lat,
                        longitude: solicitud.destino_lng,
                      })
                    }
                    compacto
                  />
                </View>

                {ofertas.length === 0 ? (
                  <View style={styles.cajaEsperandoOfertas}>
                    <Text style={styles.textoEsperandoOfertas}>
                      Los conductores cercanos están viendo tu oferta. Sus propuestas aparecerán aquí al instante.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.listaOfertas}
                    contentContainerStyle={styles.listaContenido}
                    showsVerticalScrollIndicator={false}
                  >
                    {ofertas.map((oferta) => {
                      const perfilCond = perfilesOfertas[oferta.conductor_id];
                      const nombreCond =
                        perfilCond?.nombre ??
                        oferta.conductor_nombre ??
                        `Conductor · ${oferta.conductor_id.slice(0, 6)}`;
                      const ratingCond =
                        perfilCond?.calificacion_promedio ??
                        oferta.conductor_calificacion ??
                        5.0;
                      const vehiculoCond =
                        perfilCond?.vehiculo ??
                        oferta.conductor_vehiculo ??
                        'Vehículo registrado';

                      return (
                        <View
                          key={oferta.id}
                          style={[styles.tarjetaOferta, sombras.suave]}
                        >
                          <View style={styles.avatarOferta}>
                            <Text style={styles.textoAvatarOferta}>
                              {obtenerIniciales(nombreCond)}
                            </Text>
                          </View>
                          <View style={styles.tarjetaTexto}>
                            <View style={styles.filaNombreOferta}>
                              <Text style={styles.ofertaTitulo} numberOfLines={1}>
                                {nombreCond}
                              </Text>
                              <Text style={styles.ofertaRating}>
                                ★ {ratingCond.toFixed(1)}
                              </Text>
                            </View>
                            <Text style={styles.ofertaVehiculo} numberOfLines={1}>
                              {vehiculoCond}
                            </Text>
                            <Text style={styles.ofertaPrecio}>
                              S/ {Number(oferta.precio).toFixed(2)}
                            </Text>
                          </View>
                          <Button
                            label="Aceptar"
                            tamano="sm"
                            onPress={() => void aceptarOferta(oferta)}
                            cargando={operando}
                            estilo={styles.botonAceptar}
                          />
                        </View>
                      );
                    })}
                  </ScrollView>
                )}

                <Button
                  label="Cancelar solicitud"
                  variante="secundario"
                  onPress={() => void cancelarSolicitud()}
                  cargando={operando}
                  estilo={styles.botonCancelar}
                />
              </>
            )}
          </View>
        ) : (
          /* Panel de viaje activo con stepper de 3 pasos */
          <View
            style={[
              styles.sheet,
              sombras.media,
              { paddingBottom: Math.max(insets.bottom, 12) + 4 },
            ]}
          >
            <View style={styles.handle} />

            {mensaje ? (
              <View style={styles.bannerInfo}>
                <Text style={styles.textoBannerInfo}>{mensaje}</Text>
              </View>
            ) : null}
            {error ? (
              <View style={styles.bannerError}>
                <Text style={styles.textoBannerError}>{error}</Text>
              </View>
            ) : null}

            {/* Stepper visual de progreso del viaje */}
            {viajeAceptado.estado !== 'cancelada' ? (
              <View style={styles.stepper}>
                {PASOS_VIAJE.map((paso, idx) => {
                  const completado = pasoActualViaje > idx;
                  const activo = pasoActualViaje === idx;
                  return (
                    <View key={paso.id} style={styles.itemPaso}>
                      <View style={styles.filaNodoPaso}>
                        {idx > 0 ? (
                          <View
                            style={[
                              styles.lineaPaso,
                              pasoActualViaje >= idx && styles.lineaPasoActiva,
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

                        {idx < PASOS_VIAJE.length - 1 ? (
                          <View
                            style={[
                              styles.lineaPaso,
                              pasoActualViaje > idx && styles.lineaPasoActiva,
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
            ) : null}

            <Text
              style={[
                styles.viajeTitulo,
                viajeAceptado.estado === 'cancelada' && styles.viajeTituloCancelado,
              ]}
            >
              {viajeAceptado.estado === 'completado'
                ? '¡Llegaste a tu destino!'
                : viajeAceptado.estado === 'cancelada'
                  ? 'Viaje cancelado'
                  : etiquetaCortaEstado(viajeAceptado.estado)}
            </Text>
            <Text style={styles.viajeEstado}>
              {viajeAceptado.estado === 'cancelada' &&
              viajeAceptado.cancelado_por === 'conductor'
                ? 'El conductor canceló el viaje. Puedes solicitar otro taxi.'
                : textoEstadoViaje(viajeAceptado.estado)}
            </Text>

            {infoConductorViaje &&
            viajeAceptado.estado !== 'completado' &&
            viajeAceptado.estado !== 'cancelada' ? (
              <View style={styles.badgeEtaConductor}>
                <Icono nombre="taxi" size={16} color={colores.primario} />
                <Text style={styles.textoEtaConductor}>
                  A ~{infoConductorViaje.minutos} min ({infoConductorViaje.km.toFixed(1)} km){' '}
                  {infoConductorViaje.haciaDestino
                    ? 'de tu destino'
                    : 'de tu punto de recogida'}
                </Text>
              </View>
            ) : null}

            {/* Tarjeta del conductor y precio acordado */}
            <View style={styles.cardConductorViaje}>
              <View style={styles.avatarConductor}>
                <Text style={styles.textoAvatarConductor}>
                  {obtenerIniciales(perfilConductor?.nombre ?? 'C')}
                </Text>
              </View>
              <View style={styles.flexUno}>
                <View style={styles.filaNombreConductor}>
                  <Text style={styles.nombreConductor} numberOfLines={1}>
                    {perfilConductor?.nombre ?? 'Conductor asignado'}
                  </Text>
                  {perfilConductor ? (
                    <Text style={styles.ratingConductor}>
                      ★ {perfilConductor.calificacion_promedio.toFixed(1)}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.vehiculoConductor} numberOfLines={1}>
                  {perfilConductor?.vehiculo?.trim()
                    ? perfilConductor.vehiculo
                    : 'Vehículo en servicio'}
                </Text>
              </View>
              <View style={styles.pillPrecioFinal}>
                <Text style={styles.textoPrecioFinal}>
                  S/{' '}
                  {Number(
                    viajeAceptado.precio_final ?? viajeAceptado.precio_inicial,
                  ).toFixed(2)}
                </Text>
              </View>
            </View>

            {viajeAceptado.estado !== 'completado' &&
            viajeAceptado.estado !== 'cancelada' ? (
              <View style={styles.filaContactoViaje}>
                <Pressable
                  style={[styles.botonContacto, styles.botonLlamar]}
                  onPress={() => void llamarConductor()}
                >
                  <Text style={[styles.textoContacto, styles.textoLlamar]}>
                    Llamar
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.botonContacto, styles.botonWhatsApp]}
                  onPress={() => void abrirWhatsAppConductor()}
                >
                  <Text style={[styles.textoContacto, styles.textoWhatsApp]}>
                    WhatsApp
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.botonContacto}
                  onPress={() => void compartirRutaViaje()}
                >
                  <Text style={styles.textoContacto}>Compartir</Text>
                </Pressable>
              </View>
            ) : null}

            {viajeAceptado.estado === 'completado' &&
            !calificacionEnviada &&
            !viajeAceptado.calificacion_conductor ? (
              <View style={styles.cajaCalificacion}>
                <Text style={styles.tituloCalificacion}>
                  Califica a tu conductor
                </Text>
                <View style={styles.filaEstrellas}>
                  {[1, 2, 3, 4, 5].map((estrella) => (
                    <Pressable
                      key={estrella}
                      onPress={() => setEstrellasSeleccionadas(estrella)}
                      style={styles.botonEstrella}
                    >
                      <Text
                        style={[
                          styles.iconoEstrella,
                          estrella <= estrellasSeleccionadas
                            ? styles.estrellaActiva
                            : styles.estrellaInactiva,
                        ]}
                      >
                        ★
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  label="Enviar calificación"
                  onPress={() => void enviarCalificacionConductor()}
                  cargando={operando}
                />
              </View>
            ) : null}

            {viajeAceptado.estado === 'completado' ||
            viajeAceptado.estado === 'cancelada' ? (
              <Button
                label="Nueva solicitud"
                variante={
                  viajeAceptado.estado === 'completado' &&
                  !calificacionEnviada &&
                  !viajeAceptado.calificacion_conductor
                    ? 'secundario'
                    : 'primario'
                }
                onPress={() => void cancelarSolicitud()}
                estilo={styles.botonNuevaSolicitud}
              />
            ) : null}
          </View>
        )}
      </KeyboardAvoidingView>

      <BuscadorDireccionesModal
        visible={buscadorTipo !== null}
        tipo={buscadorTipo ?? 'destino'}
        origenReferencia={originCoords ?? centroMapa}
        onCerrar={() => setBuscadorTipo(null)}
        onSeleccionarLugar={manejarSeleccionBuscador}
        onElegirEnMapa={manejarElegirEnMapaDesdeBuscador}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  mapa: {
    flex: 1,
  },
  flexUno: {
    flex: 1,
  },
  estadoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    backgroundColor: colores.superficie,
  },
  estadoTexto: {
    color: colores.textoSuave,
    textAlign: 'center',
    fontSize: 14,
  },
  botonReintentar: {
    minWidth: 200,
  },
  /* Pin central animado */
  pinContenedor: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 140,
    height: 98,
    justifyContent: 'flex-end',
    alignItems: 'center',
    transform: [{ translateX: -70 }, { translateY: -94 }],
  },
  pinCuerpo: {
    alignItems: 'center',
  },
  pinSombra: {
    width: 18,
    height: 6,
    borderRadius: 9,
    backgroundColor: '#0F172A',
    marginTop: 2,
  },
  pinEtiqueta: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radios.pill,
    marginBottom: 4,
    elevation: 4,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  pinEtiquetaOrigen: {
    backgroundColor: colores.exito,
  },
  pinEtiquetaDestino: {
    backgroundColor: colores.peligro,
  },
  pinEtiquetaTexto: {
    color: colores.fondo,
    fontSize: 11,
    fontWeight: '800',
  },
  pinCirculo: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colores.primario,
    borderWidth: 3,
    borderColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pinCirculoOrigen: {
    backgroundColor: colores.exito,
  },
  pinCirculoDestino: {
    backgroundColor: colores.peligro,
  },
  pinPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colores.fondo,
  },
  pinTriangulo: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 13,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colores.primario,
    marginTop: -2,
  },
  pinTrianguloOrigen: {
    borderTopColor: colores.exito,
  },
  pinTrianguloDestino: {
    borderTopColor: colores.peligro,
  },
  /* Controles superiores */
  barraSuperiorFlotante: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pillEstadoSuperior: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radios.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  puntoSuperior: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  textoEstadoSuperior: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.texto,
  },
  botonUbicacionFlotante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: radios.pill,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  botonFlotantePresionado: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  botonUbicacionTexto: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: '700',
  },
  /* Bottom Sheet */
  keyboardBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colores.fondo,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colores.borde,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colores.borde,
    alignSelf: 'center',
    marginBottom: 12,
  },
  tituloSheet: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.texto,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  barraBuscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1.5,
    borderColor: colores.primarioBorde,
    borderRadius: radios.md,
    paddingHorizontal: 14,
    minHeight: 48,
    marginBottom: 10,
  },
  placeholderBuscador: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colores.textoSecundario,
  },
  bannerInfo: {
    backgroundColor: colores.primarioSuave,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  textoBannerInfo: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: '600',
  },
  bannerError: {
    backgroundColor: colores.peligroSuave,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  textoBannerError: {
    color: colores.peligroOscuro,
    fontSize: 12,
    fontWeight: '600',
  },
  filaOrigenCompacto: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radios.md,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 8,
  },
  cajaPreviaPin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1.5,
    borderColor: colores.primarioBorde,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  puntoOrigenSencillo: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colores.exito,
  },
  puntoDestinoSencillo: {
    width: 10,
    height: 10,
    borderRadius: 3,
    backgroundColor: colores.peligro,
  },
  etiquetaMini: {
    fontSize: 10,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  valorMini: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.texto,
    marginTop: 1,
  },
  etiquetaPreviaPin: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.primario,
    marginBottom: 1,
  },
  textoPreviaPin: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
  },
  enlaceCambiar: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollDestinos: {
    marginBottom: 12,
  },
  listaChipsDestinos: {
    gap: 8,
    paddingRight: 8,
  },
  chipDestino: {
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.pill,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipDestinoPresionado: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  textoChipDestino: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSecundario,
  },
  filaAccionesMapa: {
    flexDirection: 'row',
    gap: 10,
  },
  botonMitad: {
    flex: 1,
  },
  /* Tarjeta de ruta editable */
  tarjetaRutaEditable: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg - 2,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  columnaPuntosRuta: {
    width: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  puntoOrigenExterior: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colores.exitoSuave,
    borderWidth: 1.5,
    borderColor: colores.exito,
    alignItems: 'center',
    justifyContent: 'center',
  },
  puntoOrigenInterior: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colores.exito,
  },
  lineaRutaEditable: {
    flex: 1,
    width: 2,
    backgroundColor: colores.borde,
    marginVertical: 4,
  },
  columnaFilasRuta: {
    flex: 1,
  },
  filaEditableRuta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  divisorSuave: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colores.borde,
    marginVertical: 7,
  },
  /* Tarifa estilo inDrive */
  filaResumenTarifa: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  metaRuta: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  chipSugerida: {
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    borderRadius: radios.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textoChipSugerida: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: '700',
  },
  filaControlTarifa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  botonAjusteTarifa: {
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.md,
    paddingHorizontal: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botonAjusteDeshabilitado: {
    opacity: 0.4,
  },
  textoAjusteTarifa: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.texto,
  },
  cajaTarifaCentral: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colores.borde,
    borderRadius: radios.md,
    backgroundColor: colores.superficie,
    height: 48,
    paddingHorizontal: 12,
  },
  cajaTarifaEnfocada: {
    borderColor: colores.primario,
    backgroundColor: colores.fondo,
  },
  prefijoMoneda: {
    fontSize: 16,
    fontWeight: '800',
    color: colores.textoSuave,
    marginRight: 4,
  },
  inputTarifaCentro: {
    minWidth: 68,
    fontSize: 20,
    fontWeight: '800',
    color: colores.texto,
    textAlign: 'center',
    paddingVertical: 0,
  },
  alertaVerificacion: {
    backgroundColor: colores.accentSuave,
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 12,
  },
  textoAlertaVerificacion: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.accentOscuro,
    lineHeight: 16,
    textAlign: 'center',
  },
  /* Buscando y ofertas */
  cabeceraBuscando: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  filaTituloBuscando: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  buscando: {
    fontSize: 17,
    fontWeight: '800',
    color: colores.texto,
  },
  pillPrecioOfrecido: {
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    borderRadius: radios.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  textoPrecioOfrecido: {
    fontSize: 13,
    fontWeight: '800',
    color: colores.primario,
  },
  resumenRutaBuscando: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 12,
    marginBottom: 10,
  },
  cajaEsperandoOfertas: {
    backgroundColor: colores.superficie,
    borderRadius: radios.md,
    padding: 12,
    marginBottom: 12,
  },
  textoEsperandoOfertas: {
    fontSize: 13,
    color: colores.textoSuave,
    lineHeight: 18,
    textAlign: 'center',
  },
  listaOfertas: {
    maxHeight: 210,
    marginBottom: 10,
  },
  listaContenido: {
    gap: 8,
  },
  tarjetaOferta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.lg - 2,
    padding: 12,
    backgroundColor: colores.fondo,
  },
  avatarOferta: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvatarOferta: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.primario,
  },
  tarjetaTexto: {
    flex: 1,
  },
  filaNombreOferta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  ofertaTitulo: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
  },
  ofertaRating: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  ofertaVehiculo: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  ofertaPrecio: {
    fontSize: 16,
    fontWeight: '800',
    color: colores.primario,
    marginTop: 3,
  },
  botonAceptar: {
    paddingHorizontal: 14,
  },
  botonCancelar: {
    marginTop: 2,
  },
  /* Stepper y viaje activo */
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  viajeTitulo: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  viajeTituloCancelado: {
    color: colores.peligro,
  },
  viajeEstado: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
    marginBottom: 10,
  },
  badgeEtaConductor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  textoEtaConductor: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.primario,
  },
  cardConductorViaje: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colores.superficie,
    borderRadius: radios.lg - 2,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 12,
    marginBottom: 10,
  },
  avatarConductor: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvatarConductor: {
    color: colores.fondo,
    fontSize: 15,
    fontWeight: '800',
  },
  filaNombreConductor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nombreConductor: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
    flexShrink: 1,
  },
  ratingConductor: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  vehiculoConductor: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  pillPrecioFinal: {
    backgroundColor: colores.primarioSuave,
    borderRadius: radios.sm + 2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
  },
  textoPrecioFinal: {
    fontSize: 14,
    fontWeight: '800',
    color: colores.primario,
  },
  filaContactoViaje: {
    flexDirection: 'row',
    gap: 8,
  },
  botonContacto: {
    flex: 1,
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: radios.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  botonLlamar: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  botonWhatsApp: {
    backgroundColor: colores.exitoSuave,
    borderColor: colores.exitoBorde,
  },
  textoContacto: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.textoSecundario,
  },
  textoLlamar: {
    color: colores.primario,
  },
  textoWhatsApp: {
    color: colores.exitoOscuro,
  },
  cajaCalificacion: {
    marginTop: 4,
    padding: 12,
    borderRadius: radios.md,
    backgroundColor: colores.superficie,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 8,
  },
  tituloCalificacion: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.texto,
    textAlign: 'center',
    marginBottom: 6,
  },
  filaEstrellas: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 10,
  },
  botonEstrella: {
    padding: 4,
  },
  iconoEstrella: {
    fontSize: 28,
  },
  estrellaActiva: {
    color: '#F59E0B',
  },
  estrellaInactiva: {
    color: '#D1D5DB',
  },
  botonNuevaSolicitud: {
    marginTop: 6,
  },
});
