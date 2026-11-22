import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Input,
  TARIFAS_POR_DEFECTO,
  authRepository,
  calcularDistanciaHaversine,
  calcularTarifa,
  colores,
  estaFueraDeHuancavelica,
  extraerCoordenadasPerfil,
  formatearReferenciaHuancavelica,
  HUANCAVELICA_CENTRO,
  obtenerDireccionLegible,
  useAuth,
  useForegroundLocation,
  viajesRepository,
  type ConfiguracionTarifas,
  type Coordenadas,
  type OfertaConductor,
  type Profile,
  type SolicitudEstado,
  type SolicitudViaje,
} from '@hvca/shared';

const ZOOM_INICIAL = 0.01;

function textoEstadoViaje(estado: SolicitudEstado): string {
  switch (estado) {
    case 'aceptado':
      return 'El conductor va en camino a tu ubicación.';
    case 'en_camino_origen':
      return 'Tu conductor llegó a la recogida. ¡Sube al taxi!';
    case 'en_curso':
      return 'Viaje hacia tu destino.';
    case 'completado':
      return 'Viaje completado. ¡Gracias por viajar!';
    case 'cancelada':
      return 'El viaje fue cancelado.';
    case 'buscando':
      return 'Esperando confirmación del conductor...';
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

export default function PantallaMapa() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { perfil, sesion, cerrarSesion } = useAuth();
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

  const [viajeVerificado, setViajeVerificado] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState<'destino' | 'origen'>('destino');
  const [direccionBajoPin, setDireccionBajoPin] = useState<string | null>(null);
  const [cargandoDireccionPin, setCargandoDireccionPin] = useState(false);

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

  // Previsualización en vivo de la calle/referencia bajo el pin central mientras el usuario mueve el mapa
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

  const { distanciaKm, tarifaSugerida } = useMemo(() => {
    if (!originCoords || !destinoCoords) {
      return { distanciaKm: null, tarifaSugerida: null };
    }
    const km = calcularDistanciaHaversine(
      originCoords.latitude,
      originCoords.longitude,
      destinoCoords.latitude,
      destinoCoords.longitude,
    );
    const desglose = calcularTarifa({
      distanciaKm: km,
      duracionMin: Math.max(3, Math.round(km * 3)),
      tarifaBase: configPlataforma.tarifa_base,
      tarifaPorKm: configPlataforma.precio_por_km,
      tarifaPorMin: 0,
      tarifaMinima: configPlataforma.tarifa_minima,
    });
    return {
      distanciaKm: km,
      tarifaSugerida: desglose.total,
    };
  }, [originCoords, destinoCoords, configPlataforma]);

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
      edgePadding: { top: 90, right: 60, bottom: 290, left: 60 },
      animated: true,
    });
  }

  function centrarEnHuancavelica(punto: Coordenadas = HUANCAVELICA_CENTRO) {
    moverCamaraA(punto);
    setMensaje('Mapa centrado en Huancavelica.');
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
      setMensaje('Origen actualizado. Revisa la ruta y tu tarifa.');
    } else {
      setMensaje('Origen fijado. Mueve el mapa para elegir tu destino.');
    }
  }

  function fijarDestino() {
    if (!centroMapa) return;
    const punto = centroMapa;
    setDestinoCoords(punto);
    setDestinoDireccion(formatearReferenciaHuancavelica(punto));
    setModoSeleccion('destino');
    setMensaje('Destino fijado. Revisa la tarifa sugerida o propón la tuya.');
    setError(null);
    void obtenerDireccionLegible(punto).then((dir) => {
      setDestinoDireccion(dir);
    });

    if (originCoords) {
      ajustarRutaEnMapa(originCoords, punto);
    }

    if (originCoords && !tarifa.trim()) {
      const km = calcularDistanciaHaversine(
        originCoords.latitude,
        originCoords.longitude,
        punto.latitude,
        punto.longitude,
      );
      const desglose = calcularTarifa({
        distanciaKm: km,
        duracionMin: Math.max(3, Math.round(km * 3)),
        tarifaBase: configPlataforma.tarifa_base,
        tarifaPorKm: configPlataforma.precio_por_km,
        tarifaPorMin: 0,
        tarifaMinima: configPlataforma.tarifa_minima,
      });
      setTarifa(desglose.total.toFixed(2));
    }
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
    const orig = viajeAceptado.origen_direccion ?? `${viajeAceptado.origen_lat.toFixed(4)}, ${viajeAceptado.origen_lng.toFixed(4)}`;
    const dest = viajeAceptado.destino_direccion ?? `${viajeAceptado.destino_lat.toFixed(4)}, ${viajeAceptado.destino_lng.toFixed(4)}`;
    const linkMaps = `https://www.google.com/maps/dir/?api=1&origin=${viajeAceptado.origen_lat},${viajeAceptado.origen_lng}&destination=${viajeAceptado.destino_lat},${viajeAceptado.destino_lng}`;
    await Share.share({
      message: `🚕 Estoy viajando con Taxi HVCA.\nConductor: ${perfilConductor?.nombre ?? 'Asignado'} (${perfilConductor?.vehiculo ?? 'Vehículo'})\nOrigen: ${orig}\nDestino: ${dest}\nSeguir ruta: ${linkMaps}`,
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
        edgePadding: { top: 90, right: 60, bottom: 290, left: 60 },
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
          onRegionChangeComplete={(region) => {
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
              title={`🚕 ${perfilConductor?.nombre ?? 'Tu conductor'}`}
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
            <ActivityIndicator size="large" color={colores.primario} />
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

      {/* Pin central fijo para elegir destino (o ajustar origen) */}
      {mostrandoPin ? (
        <View pointerEvents="none" style={styles.pin}>
          <View
            style={[
              styles.pinEtiqueta,
              modoSeleccion === 'origen'
                ? styles.pinEtiquetaOrigen
                : styles.pinEtiquetaDestino,
            ]}
          >
            <Text style={styles.pinEtiquetaTexto}>
              {modoSeleccion === 'origen' ? '📍 Origen' : '🏁 Destino'}
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
        </View>
      ) : null}

      {/* Cerrar sesión (acceso rápido) */}
      <Pressable
        onPress={() => void cerrarSesion()}
        style={[
          styles.logout,
          { top: Math.max(insets.top, 12), left: Math.max(insets.left, 12) },
        ]}
      >
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </Pressable>

      {/* Botón flotante para centrar en ubicación actual o encuadrar viaje activo */}
      <Pressable
        onPress={() => {
          if (enViaje) {
            encuadrarViajeActivo();
          } else {
            void irAMiUbicacion();
          }
        }}
        style={[
          styles.botonUbicacionFlotante,
          { top: Math.max(insets.top, 12), right: Math.max(insets.right, 12) },
        ]}
      >
        <Text style={styles.botonUbicacionTexto}>
          {enViaje ? '🎯 Centrar' : '🎯 Mi ubicación'}
        </Text>
      </Pressable>

      {/* Barra inferior: preparación, búsqueda u ofertas */}
      {!enViaje ? (
        <View
          style={[
            styles.barraInferior,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {!solicitud ? (
            modoSeleccion === 'origen' || !originCoords ? (
              <>
                <View style={styles.cajaPreviaPin}>
                  <Text style={styles.etiquetaPreviaPin}>🟢 Recojo bajo el pin:</Text>
                  <Text style={styles.textoPreviaPin} numberOfLines={1}>
                    {cargandoDireccionPin
                      ? 'Buscando dirección...'
                      : direccionBajoPin ?? 'Mueve el mapa a tu punto de recogida'}
                  </Text>
                </View>
                <View style={styles.filaAccionesMapa}>
                  <Button
                    label="Confirmar origen"
                    onPress={fijarOrigen}
                    deshabilitado={!centroMapa}
                    estilo={styles.botonMitad}
                  />
                  <Button
                    label="🎯 Usar GPS"
                    variante="secundario"
                    onPress={() => void usarMiGpsComoOrigen()}
                    estilo={styles.botonMitad}
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.filaPuntoFijado}>
                  <Text style={styles.ayudaPunto} numberOfLines={1}>
                    🟢 Origen:{' '}
                    {origenDireccion ??
                      `${originCoords.latitude.toFixed(4)}, ${originCoords.longitude.toFixed(4)}`}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setModoSeleccion('origen');
                      moverCamaraA(originCoords);
                      setMensaje('Mueve el mapa y confirma tu nuevo origen.');
                    }}
                  >
                    <Text style={styles.enlaceCambiar}>Cambiar</Text>
                  </Pressable>
                </View>

                {destinoCoords ? (
                  <View style={styles.filaPuntoFijado}>
                    <Text style={styles.ayudaPunto} numberOfLines={1}>
                      🔴 Destino:{' '}
                      {destinoDireccion ??
                        `${destinoCoords.latitude.toFixed(4)}, ${destinoCoords.longitude.toFixed(4)}`}
                    </Text>
                    <Pressable
                      onPress={() => {
                        setDestinoCoords(null);
                        setDestinoDireccion(null);
                        setModoSeleccion('destino');
                      }}
                    >
                      <Text style={styles.enlaceCambiar}>Cambiar</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.cajaPreviaPin}>
                      <Text style={styles.etiquetaPreviaPin}>
                        🏁 Destino bajo el pin (mueve el mapa):
                      </Text>
                      <Text style={styles.textoPreviaPin} numberOfLines={1}>
                        {cargandoDireccionPin
                          ? 'Buscando calle o referencia...'
                          : direccionBajoPin ?? 'Mueve el mapa hasta tu destino'}
                      </Text>
                    </View>
                    <View style={styles.filaAccionesMapa}>
                      <Button
                        label="Confirmar destino"
                        onPress={fijarDestino}
                        deshabilitado={!centroMapa}
                        estilo={styles.botonMitad}
                      />
                      <Button
                        label="📍 Plaza"
                        variante="secundario"
                        onPress={() => centrarEnHuancavelica()}
                        estilo={styles.botonMitad}
                      />
                    </View>
                  </>
                )}

                {destinoCoords ? (
                  <>
                    {tarifaSugerida !== null && distanciaKm !== null ? (
                      <Pressable
                        style={styles.chipTarifaSugerida}
                        onPress={() => setTarifa(tarifaSugerida.toFixed(2))}
                      >
                        <Text style={styles.textoChipSugerida}>
                          💡 Tarifa sugerida ({distanciaKm.toFixed(1)} km): S/{' '}
                          {tarifaSugerida.toFixed(2)} · Toca para usar
                        </Text>
                      </Pressable>
                    ) : null}

                    <Input
                      etiqueta="Tu tarifa propuesta"
                      value={tarifa}
                      onChangeText={setTarifa}
                      keyboardType="decimal-pad"
                      placeholder="S/ 5.00"
                      testID="input-tarifa"
                      style={styles.inputTarifa}
                    />
                    {!perfil?.telefono_verificado && (
                      <Pressable
                        style={styles.alertaVerificacion}
                        onPress={() => router.push('/(tabs)/perfil')}
                      >
                        <Text style={styles.textoAlertaVerificacion}>
                          🔒 Teléfono no verificado. Toca aquí para validarlo con tu código OTP antes de pedir taxi.
                        </Text>
                      </Pressable>
                    )}
                    <Button
                      label="Pedir Taxi"
                      onPress={() => void pedirTaxi()}
                      cargando={operando}
                      deshabilitado={!tarifa.trim()}
                      estilo={styles.boton}
                    />
                  </>
                ) : null}
              </>
            )
          ) : (
            <>
              <Text style={styles.buscando}>Buscando conductores...</Text>
              <Text style={styles.ayuda}>
                Tu tarifa ofrecida: S/ {Number(solicitud.precio_inicial).toFixed(2)}
                {solicitud.distancia_km ? ` · ${solicitud.distancia_km.toFixed(1)} km` : ''}
              </Text>
              {ofertas.length === 0 ? (
                <Text style={styles.ayuda}>
                  Aún no llegan ofertas. Los conductores cercanos podrán participar.
                </Text>
              ) : (
                <ScrollView
                  style={styles.listaOfertas}
                  contentContainerStyle={styles.listaContenido}
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
                      <View key={oferta.id} style={styles.tarjetaOferta}>
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
                            🚗 {vehiculoCond}
                          </Text>
                          <Text style={styles.ofertaPrecio}>
                            S/ {Number(oferta.precio).toFixed(2)}
                          </Text>
                        </View>
                        <Button
                          label="Aceptar"
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
                estilo={styles.boton}
              />
            </>
          )}
        </View>
      ) : (
        /* Tarjeta flotante: el viaje ya fue aceptado (match realizado) */
        <View
          style={[
            styles.tarjetaViaje,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.viajeTitulo}>
            {viajeAceptado.estado === 'completado'
              ? '¡Llegaste a tu destino!'
              : viajeAceptado.estado === 'cancelada'
                ? 'Viaje cancelado'
                : 'Viaje en curso'}
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
              <Text style={styles.textoEtaConductor}>
                🚕 A ~{infoConductorViaje.minutos} min ({infoConductorViaje.km.toFixed(1)} km){' '}
                {infoConductorViaje.haciaDestino
                  ? 'de tu destino'
                  : 'de tu punto de recogida'}
              </Text>
            </View>
          ) : null}
          <View style={styles.viajeDivisor} />
          {perfilConductor ? (
            <>
              <View style={styles.viajeFila}>
                <Text style={styles.viajeEtiqueta}>Conductor</Text>
                <Text style={styles.viajeValor}>
                  {perfilConductor.nombre} (★{' '}
                  {perfilConductor.calificacion_promedio.toFixed(1)})
                </Text>
              </View>
              <View style={styles.viajeFila}>
                <Text style={styles.viajeEtiqueta}>Vehículo</Text>
                <Text style={styles.viajeValor}>
                  {perfilConductor.vehiculo?.trim()
                    ? perfilConductor.vehiculo
                    : 'No registrado'}
                </Text>
              </View>
            </>
          ) : null}
          <View style={styles.viajeFila}>
            <Text style={styles.viajeEtiqueta}>Precio final</Text>
            <Text style={styles.viajeValor}>
              S/{' '}
              {Number(
                viajeAceptado.precio_final ?? viajeAceptado.precio_inicial,
              ).toFixed(2)}
            </Text>
          </View>

          {viajeAceptado.estado !== 'completado' &&
          viajeAceptado.estado !== 'cancelada' ? (
            <View style={styles.filaContactoViaje}>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void llamarConductor()}
              >
                <Text style={styles.textoContacto}>📞 Llamar</Text>
              </Pressable>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void abrirWhatsAppConductor()}
              >
                <Text style={styles.textoContacto}>💬 WhatsApp</Text>
              </Pressable>
              <Pressable
                style={styles.botonContacto}
                onPress={() => void compartirRutaViaje()}
              >
                <Text style={styles.textoContacto}>📤 Compartir</Text>
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
                estilo={styles.boton}
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
              estilo={styles.boton}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
  },
  mapa: {
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
    gap: 16,
    padding: 24,
    backgroundColor: colores.fondo,
  },
  estadoTexto: {
    color: colores.textoSuave,
    textAlign: 'center',
  },
  botonReintentar: {
    minWidth: 200,
  },
  pin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 120,
    height: 90,
    justifyContent: 'flex-end',
    alignItems: 'center',
    transform: [{ translateX: -60 }, { translateY: -90 }],
  },
  pinCirculo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colores.primario,
    borderWidth: 3,
    borderColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  pinPunto: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colores.accent,
  },
  pinTriangulo: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 14,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colores.primario,
  },
  logout: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutTexto: {
    color: colores.primario,
    fontWeight: '600',
  },
  barraInferior: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colores.fondo,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  mensaje: {
    color: colores.exito,
    marginBottom: 8,
    fontWeight: '600',
  },
  error: {
    color: colores.peligro,
    marginBottom: 8,
  },
  ayuda: {
    color: colores.textoSuave,
    fontSize: 13,
    marginBottom: 8,
  },
  filaPuntoFijado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 6,
  },
  ayudaPunto: {
    flex: 1,
    color: colores.texto,
    fontSize: 13,
    fontWeight: '500',
  },
  enlaceCambiar: {
    color: colores.primario,
    fontSize: 12,
    fontWeight: '700',
  },
  chipTarifaSugerida: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  textoChipSugerida: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  botonMitad: {
    flex: 1,
    marginBottom: 12,
  },
  inputTarifa: {
    marginBottom: 12,
  },
  boton: {
    marginTop: 6,
  },
  buscando: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 4,
  },
  listaOfertas: {
    maxHeight: 200,
    marginVertical: 8,
  },
  listaContenido: {
    gap: 8,
  },
  tarjetaOferta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#FAFAFA',
  },
  tarjetaTexto: {
    flex: 1,
    marginRight: 12,
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
    fontSize: 15,
    fontWeight: '800',
    color: colores.primario,
    marginTop: 4,
  },
  botonAceptar: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  tarjetaViaje: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  viajeTitulo: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.exito,
    marginBottom: 4,
  },
  viajeEstado: {
    fontSize: 14,
    color: colores.texto,
    marginBottom: 12,
  },
  viajeDivisor: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colores.borde,
    marginBottom: 12,
  },
  viajeFila: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  viajeEtiqueta: {
    fontSize: 14,
    color: colores.textoSuave,
  },
  viajeValor: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  filaContactoViaje: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  botonContacto: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: colores.borde,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
  },
  textoContacto: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.texto,
  },
  cajaCalificacion: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 6,
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
    marginBottom: 8,
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
  filaAccionesMapa: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  alertaVerificacion: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  textoAlertaVerificacion: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 16,
    textAlign: 'center',
  },
  pinEtiqueta: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 4,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  pinEtiquetaOrigen: {
    backgroundColor: '#16A34A',
  },
  pinEtiquetaDestino: {
    backgroundColor: '#DC2626',
  },
  pinEtiquetaTexto: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  pinCirculoOrigen: {
    backgroundColor: '#16A34A',
  },
  pinCirculoDestino: {
    backgroundColor: '#DC2626',
  },
  pinTrianguloOrigen: {
    borderTopColor: '#16A34A',
  },
  pinTrianguloDestino: {
    borderTopColor: '#DC2626',
  },
  botonUbicacionFlotante: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colores.borde,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  botonUbicacionTexto: {
    color: colores.primario,
    fontSize: 13,
    fontWeight: '700',
  },
  cajaPreviaPin: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colores.borde,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 4,
  },
  etiquetaPreviaPin: {
    fontSize: 11,
    fontWeight: '700',
    color: colores.textoSuave,
    marginBottom: 2,
  },
  textoPreviaPin: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
  },
  badgeEtaConductor: {
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textoEtaConductor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1D4ED8',
    textAlign: 'center',
  },
});
