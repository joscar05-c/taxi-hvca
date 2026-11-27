import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DESTINOS_FRECUENTES_HVCA,
  HUANCAVELICA_CENTRO,
  Icono,
  buscarDirecciones,
  calcularDistanciaHaversine,
  colores,
  generarSessionToken,
  obtenerDetalleLugar,
  radios,
  type Coordenadas,
  type FuenteSugerencia,
  type SugerenciaLugar,
} from '@hvca/shared';

export interface BuscadorDireccionesModalProps {
  visible: boolean;
  tipo: 'destino' | 'origen';
  origenReferencia: Coordenadas | null;
  onCerrar: () => void;
  onSeleccionarLugar: (lugar: { coords: Coordenadas; direccion: string }) => void;
  onElegirEnMapa: () => void;
}

const GOOGLE_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';
const ANDROID_PACKAGE = 'com.joscar03.dev.apppasajero';
const ANDROID_CERT = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_SHA1 || undefined;

function formatearDistancia(km?: number): string | null {
  if (typeof km !== 'number' || !Number.isFinite(km)) return null;
  if (km < 1) return `${Math.max(50, Math.round(km * 1000))} m`;
  return `${km.toFixed(1)} km`;
}

export function BuscadorDireccionesModal({
  visible,
  tipo,
  origenReferencia,
  onCerrar,
  onSeleccionarLugar,
  onElegirEnMapa,
}: BuscadorDireccionesModalProps) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput | null>(null);
  const sessionTokenRef = useRef<string>(generarSessionToken());

  const [consulta, setConsulta] = useState('');
  const [sugerencias, setSugerencias] = useState<SugerenciaLugar[]>([]);
  const [fuenteUsada, setFuenteUsada] = useState<FuenteSugerencia | 'ninguna'>(
    'ninguna',
  );
  const [buscando, setBuscando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  const referencia = origenReferencia ?? HUANCAVELICA_CENTRO;

  // Reiniciar estado y token de sesión cada vez que se abre el buscador
  useEffect(() => {
    if (!visible) return;
    sessionTokenRef.current = generarSessionToken();
    setConsulta('');
    setSugerencias([]);
    setFuenteUsada('ninguna');
    setBuscando(false);
    setResolviendoId(null);
    setErrorBusqueda(null);

    const timerFoco = setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    return () => clearTimeout(timerFoco);
  }, [visible, tipo]);

  // Autocompletado con debounce de 350ms y cancelación de solicitudes obsoletas
  useEffect(() => {
    if (!visible) return;
    const texto = consulta.trim();
    if (texto.length < 2) {
      setSugerencias([]);
      setFuenteUsada('ninguna');
      setBuscando(false);
      setErrorBusqueda(null);
      return;
    }

    const controller = new AbortController();
    let cancelado = false;
    setBuscando(true);
    setErrorBusqueda(null);

    const timer = setTimeout(() => {
      void buscarDirecciones(texto, {
        apiKey: GOOGLE_API_KEY || undefined,
        origenReferencia: referencia,
        sessionToken: sessionTokenRef.current,
        androidPackage: ANDROID_PACKAGE,
        androidCert: ANDROID_CERT,
        signal: controller.signal,
      })
        .then((res) => {
          if (cancelado) return;
          setSugerencias(res.sugerencias);
          setFuenteUsada(res.fuenteUsada);
        })
        .catch(() => {
          if (!cancelado && !controller.signal.aborted) {
            setErrorBusqueda('No pudimos consultar direcciones ahora. Intenta nuevamente.');
          }
        })
        .finally(() => {
          if (!cancelado) {
            setBuscando(false);
          }
        });
    }, 350);

    return () => {
      cancelado = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [visible, consulta, referencia]);

  const lugaresFrecuentes = useMemo<SugerenciaLugar[]>(
    () =>
      DESTINOS_FRECUENTES_HVCA.map((d) => {
        const coords: Coordenadas = {
          latitude: d.latitude,
          longitude: d.longitude,
        };
        return {
          id: `freq-${d.id}`,
          titulo: d.nombre,
          subtitulo: d.direccion,
          direccionCompleta: d.direccion,
          fuente: 'local',
          coords,
          distanciaKm: calcularDistanciaHaversine(
            referencia.latitude,
            referencia.longitude,
            coords.latitude,
            coords.longitude,
          ),
        };
      }),
    [referencia],
  );

  async function manejarSeleccion(item: SugerenciaLugar) {
    if (resolviendoId) return;
    setErrorBusqueda(null);
    setResolviendoId(item.id);
    try {
      const detalle = await obtenerDetalleLugar(item, {
        apiKey: GOOGLE_API_KEY || undefined,
        sessionToken: sessionTokenRef.current,
        androidPackage: ANDROID_PACKAGE,
        androidCert: ANDROID_CERT,
      });
      if (!detalle) {
        setErrorBusqueda(
          'No pudimos obtener las coordenadas exactas de ese lugar. Prueba otra opción o fíjalo en el mapa.',
        );
        return;
      }
      onSeleccionarLugar(detalle);
    } finally {
      setResolviendoId(null);
    }
  }

  const mostrandoResultados = consulta.trim().length >= 2;
  const datosLista = mostrandoResultados ? sugerencias : lugaresFrecuentes;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCerrar}
    >
      <KeyboardAvoidingView
        style={styles.pantalla}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Cabecera del buscador */}
        <View
          style={[
            styles.cabecera,
            { paddingTop: Math.max(insets.top, 14) + 6 },
          ]}
        >
          <View style={styles.filaTitulo}>
            <Pressable
              onPress={onCerrar}
              hitSlop={10}
              style={styles.botonVolver}
              accessibilityLabel="Cerrar buscador"
            >
              <Text style={styles.textoVolver}>←</Text>
            </Pressable>
            <Text style={styles.titulo}>
              {tipo === 'origen' ? '¿Dónde te recogemos?' : '¿A dónde vas?'}
            </Text>
          </View>

          <View style={styles.cajaInput}>
            <View
              style={[
                styles.puntoTipo,
                tipo === 'origen' ? styles.puntoOrigen : styles.puntoDestino,
              ]}
            />
            <TextInput
              ref={inputRef}
              value={consulta}
              onChangeText={setConsulta}
              placeholder={
                tipo === 'origen'
                  ? 'Busca tu calle, jirón o referencia...'
                  : 'Ej. Virrey Toledo, Hospital, Terminal, UNH...'
              }
              placeholderTextColor={colores.textoSuave}
              returnKeyType="search"
              autoCorrect={false}
              style={styles.input}
            />
            {buscando ? (
              <ActivityIndicator size="small" color={colores.primario} />
            ) : consulta.length > 0 ? (
              <Pressable
                onPress={() => setConsulta('')}
                hitSlop={10}
                style={styles.botonLimpiar}
                accessibilityLabel="Limpiar búsqueda"
              >
                <Text style={styles.textoLimpiar}>×</Text>
              </Pressable>
            ) : (
              <Icono nombre="lupa" size={18} color={colores.textoSuave} />
            )}
          </View>

          {/* Acción rápida alternativa: elegir manualmente con el pin en el mapa */}
          <Pressable
            onPress={onElegirEnMapa}
            style={({ pressed }) => [
              styles.filaElegirMapa,
              pressed && styles.filaPresionada,
            ]}
          >
            <View style={styles.iconoElegirMapa}>
              <Icono nombre="mapa" size={17} color={colores.primario} activo />
            </View>
            <Text style={styles.textoElegirMapa}>
              Fijar ubicación manualmente en el mapa
            </Text>
          </Pressable>
        </View>

        {errorBusqueda ? (
          <View style={styles.bannerError}>
            <Text style={styles.textoError}>{errorBusqueda}</Text>
          </View>
        ) : null}

        {/* Encabezado de sección */}
        <View style={styles.barraSeccion}>
          <Text style={styles.tituloSeccion}>
            {mostrandoResultados
              ? buscando
                ? 'Buscando direcciones...'
                : sugerencias.length > 0
                  ? `Resultados (${sugerencias.length})`
                  : 'Sin coincidencias exactas'
              : 'Lugares frecuentes en Huancavelica'}
          </Text>
          {mostrandoResultados && fuenteUsada !== 'ninguna' && !buscando ? (
            <Text style={styles.etiquetaFuente}>
              {fuenteUsada === 'google_places' ? 'Google Maps' : 'Huancavelica'}
            </Text>
          ) : null}
        </View>

        <FlatList
          data={datosLista}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.listaContenido,
            { paddingBottom: Math.max(insets.bottom, 20) + 12 },
          ]}
          ListEmptyComponent={
            mostrandoResultados && !buscando ? (
              <View style={styles.cajaVacio}>
                <Text style={styles.tituloVacio}>
                  No encontramos &ldquo;{consulta.trim()}&rdquo;
                </Text>
                <Text style={styles.textoVacio}>
                  Prueba escribir el nombre del jirón, avenida o barrio (ej. Virrey Toledo, Manchego Muñoz, San Cristóbal), o fíjalo directo en el mapa.
                </Text>
                <Pressable
                  onPress={onElegirEnMapa}
                  style={styles.botonVacioMapa}
                >
                  <Text style={styles.textoBotonVacioMapa}>
                    Elegir punto en el mapa
                  </Text>
                </Pressable>
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const cargandoItem = resolviendoId === item.id;
            const distTexto = formatearDistancia(item.distanciaKm);
            return (
              <Pressable
                onPress={() => void manejarSeleccion(item)}
                disabled={Boolean(resolviendoId)}
                style={({ pressed }) => [
                  styles.filaSugerencia,
                  pressed && styles.filaPresionada,
                ]}
              >
                <View style={styles.iconoSugerencia}>
                  {cargandoItem ? (
                    <ActivityIndicator size="small" color={colores.primario} />
                  ) : (
                    <Icono nombre="mapa" size={18} color={colores.textoSecundario} />
                  )}
                </View>

                <View style={styles.textosSugerencia}>
                  <Text style={styles.tituloSugerencia} numberOfLines={1}>
                    {item.titulo}
                  </Text>
                  <Text style={styles.subtituloSugerencia} numberOfLines={1}>
                    {item.subtitulo}
                  </Text>
                </View>

                {distTexto ? (
                  <Text style={styles.distanciaSugerencia}>{distTexto}</Text>
                ) : null}
              </Pressable>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  cabecera: {
    backgroundColor: colores.fondo,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  filaTitulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  botonVolver: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colores.superficieSecundaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoVolver: {
    fontSize: 20,
    fontWeight: '700',
    color: colores.texto,
    marginTop: -2,
  },
  titulo: {
    fontSize: 19,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  cajaInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colores.primario,
    borderRadius: radios.md,
    backgroundColor: colores.fondo,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  puntoTipo: {
    width: 10,
    height: 10,
  },
  puntoOrigen: {
    borderRadius: 5,
    backgroundColor: colores.exito,
  },
  puntoDestino: {
    borderRadius: 3,
    backgroundColor: colores.peligro,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colores.texto,
    paddingVertical: 10,
  },
  botonLimpiar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colores.superficieSecundaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoLimpiar: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.textoSecundario,
    marginTop: -1,
  },
  filaElegirMapa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radios.md,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
  },
  iconoElegirMapa: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoElegirMapa: {
    fontSize: 13,
    fontWeight: '700',
    color: colores.primario,
  },
  bannerError: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: colores.peligroSuave,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  textoError: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.peligroOscuro,
  },
  barraSeccion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  tituloSeccion: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  etiquetaFuente: {
    fontSize: 11,
    fontWeight: '600',
    color: colores.textoSuave,
  },
  listaContenido: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filaSugerencia: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colores.fondo,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaPresionada: {
    opacity: 0.8,
  },
  iconoSugerencia: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colores.superficieSecundaria,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textosSugerencia: {
    flex: 1,
  },
  tituloSugerencia: {
    fontSize: 14,
    fontWeight: '700',
    color: colores.texto,
  },
  subtituloSugerencia: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 2,
  },
  distanciaSugerencia: {
    fontSize: 12,
    fontWeight: '700',
    color: colores.primario,
  },
  cajaVacio: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 20,
    alignItems: 'center',
    marginTop: 8,
  },
  tituloVacio: {
    fontSize: 15,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 6,
    textAlign: 'center',
  },
  textoVacio: {
    fontSize: 13,
    color: colores.textoSuave,
    textAlign: 'center',
    lineHeight: 19,
  },
  botonVacioMapa: {
    marginTop: 14,
    backgroundColor: colores.primario,
    borderRadius: radios.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  textoBotonVacioMapa: {
    color: colores.fondo,
    fontSize: 13,
    fontWeight: '700',
  },
});
