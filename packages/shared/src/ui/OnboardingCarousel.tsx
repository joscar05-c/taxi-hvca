import { useRef, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Button } from './Button';
import { colores } from './theme';

export interface OnboardingSlide {
  id: string;
  etiqueta: string;
  titulo: string;
  descripcion: string;
  icono: string;
  colorFondoIcono: string;
  colorAcento: string;
}

export interface OnboardingCarouselProps {
  rol: 'pasajero' | 'conductor';
  slides: OnboardingSlide[];
  onCompletar: (destino: 'login' | 'registro') => void | Promise<void>;
}

/**
 * Carrusel de bienvenida deslizable de 3 pasos compartido entre las apps móviles.
 */
export function OnboardingCarousel({
  rol,
  slides,
  onCompletar,
}: OnboardingCarouselProps) {
  const { width } = useWindowDimensions();
  const flatListRef = useRef<FlatList<OnboardingSlide>>(null);
  const [indiceActual, setIndiceActual] = useState(0);
  const [procesando, setProcesando] = useState(false);

  const esUltimoSlide = slides.length === 0 || indiceActual >= slides.length - 1;
  const etiquetaRol = rol === 'conductor' ? 'Conductor' : 'Pasajero';

  async function manejarCompletar(destino: 'login' | 'registro') {
    if (procesando) return;
    setProcesando(true);
    try {
      await onCompletar(destino);
    } finally {
      setProcesando(false);
    }
  }

  function avanzarSlide() {
    if (slides.length === 0 || procesando) return;
    const siguiente = Math.min(slides.length - 1, indiceActual + 1);
    flatListRef.current?.scrollToIndex({ index: siguiente, animated: true });
    setIndiceActual(siguiente);
  }

  function alTerminarScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0 || slides.length === 0) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const nuevoIndice = Math.round(offsetX / width);
    setIndiceActual(Math.max(0, Math.min(slides.length - 1, nuevoIndice)));
  }

  return (
    <SafeAreaView style={styles.contenedor}>
      {/* Cabecera de marca y botón omitir */}
      <View style={styles.cabecera}>
        <View style={styles.marcaRow}>
          <Text style={styles.marca}>TAXI HVCA</Text>
          <View style={styles.badgeRol}>
            <Text style={styles.textoBadgeRol}>{etiquetaRol}</Text>
          </View>
        </View>

        {!esUltimoSlide ? (
          <Pressable
            onPress={() => void manejarCompletar('login')}
            disabled={procesando}
            hitSlop={10}
            style={({ pressed }) => [styles.botonOmitir, pressed && styles.omitirPresionado]}
            accessibilityRole="button"
          >
            <Text style={styles.textoOmitir}>Omitir</Text>
          </Pressable>
        ) : (
          <View style={styles.espacioOmitir} />
        )}
      </View>

      {/* Carrusel deslizable */}
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        keyExtractor={(item) => item.id}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={alTerminarScroll}
        renderItem={({ item }) => (
          <View style={[styles.slideExterior, { width }]}>
            <View style={styles.slideInterior}>
              <View style={[styles.aroExterno, { borderColor: item.colorFondoIcono }]}>
                <View style={[styles.circuloIcono, { backgroundColor: item.colorFondoIcono }]}>
                  <Text style={styles.icono}>{item.icono}</Text>
                </View>
              </View>

              <View style={[styles.pildoraEtiqueta, { borderColor: item.colorAcento }]}>
                <Text style={[styles.textoEtiqueta, { color: item.colorAcento }]}>
                  {item.etiqueta}
                </Text>
              </View>

              <Text style={styles.titulo}>{item.titulo}</Text>
              <Text style={styles.descripcion}>{item.descripcion}</Text>
            </View>
          </View>
        )}
      />

      {/* Pie con paginación y acciones */}
      <View style={styles.pie}>
        <View style={styles.paginacionRow}>
          <View style={styles.puntosRow}>
            {slides.map((slide, index) => {
              const activo = index === indiceActual;
              return (
                <View
                  key={slide.id}
                  style={[styles.punto, activo ? styles.puntoActivo : styles.puntoInactivo]}
                />
              );
            })}
          </View>
          {slides.length > 0 ? (
            <Text style={styles.contadorPasos}>
              {indiceActual + 1} de {slides.length}
            </Text>
          ) : null}
        </View>

        <View style={styles.acciones}>
          {esUltimoSlide ? (
            <>
              <Button
                label="Iniciar sesión"
                onPress={() => void manejarCompletar('login')}
                cargando={procesando}
                estilo={styles.botonCompleto}
              />
              <Button
                label="Crear cuenta"
                variante="secundario"
                onPress={() => void manejarCompletar('registro')}
                deshabilitado={procesando}
                estilo={styles.botonCompleto}
              />
            </>
          ) : (
            <Button
              label="Siguiente"
              onPress={avanzarSlide}
              deshabilitado={procesando}
              estilo={styles.botonCompleto}
            />
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 12 : 12,
    paddingBottom: 28,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  marcaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  marca: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colores.primario,
  },
  badgeRol: {
    backgroundColor: '#FEF3C7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  textoBadgeRol: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  botonOmitir: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  omitirPresionado: {
    opacity: 0.6,
  },
  textoOmitir: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.textoSuave,
  },
  espacioOmitir: {
    width: 48,
    height: 24,
  },
  slideExterior: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  slideInterior: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
  },
  aroExterno: {
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  circuloIcono: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icono: {
    fontSize: 58,
  },
  pildoraEtiqueta: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
    backgroundColor: colores.fondo,
  },
  textoEtiqueta: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: colores.texto,
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 12,
  },
  descripcion: {
    fontSize: 15,
    color: colores.textoSuave,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 6,
  },
  pie: {
    width: '100%',
    maxWidth: 468,
    alignSelf: 'center',
    paddingHorizontal: 24,
    gap: 18,
  },
  paginacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  puntosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  punto: {
    height: 8,
    borderRadius: 999,
  },
  puntoActivo: {
    width: 26,
    backgroundColor: colores.primario,
  },
  puntoInactivo: {
    width: 8,
    backgroundColor: '#D1D5DB',
  },
  contadorPasos: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.textoSuave,
  },
  acciones: {
    gap: 10,
  },
  botonCompleto: {
    width: '100%',
  },
});
