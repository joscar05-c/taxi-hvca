import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { colores, radios, sombras } from './theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro' | 'accent';
  tamano?: 'sm' | 'md' | 'lg';
  icono?: ReactNode;
  deshabilitado?: boolean;
  cargando?: boolean;
  estilo?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variante = 'primario',
  tamano = 'md',
  icono,
  deshabilitado = false,
  cargando = false,
  estilo,
}: ButtonProps) {
  const inactivo = deshabilitado || cargando;
  const textoBlanco = variante === 'primario' || variante === 'peligro';
  const conElevacion =
    !inactivo && (variante === 'primario' || variante === 'accent');

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.base,
        styles[tamano],
        styles[variante],
        conElevacion && sombras.suave,
        pressed && !inactivo && styles.presionado,
        inactivo && styles.deshabilitado,
        estilo,
      ]}
      accessibilityRole="button"
    >
      {cargando ? (
        <ActivityIndicator color={textoBlanco ? colores.fondo : colores.texto} />
      ) : (
        <View style={styles.contenido}>
          {icono ? <View style={styles.icono}>{icono}</View> : null}
          <Text
            style={[
              styles[textoBlanco ? 'textoPrimario' : 'textoSecundario'],
              tamano === 'sm' && styles.textoSm,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radios.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 38,
  },
  md: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    minHeight: 54,
  },
  primario: { backgroundColor: colores.primario },
  secundario: {
    backgroundColor: colores.fondo,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  peligro: { backgroundColor: colores.peligro },
  accent: { backgroundColor: colores.accent },
  presionado: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  deshabilitado: { opacity: 0.5 },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icono: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoPrimario: { color: colores.fondo, fontSize: 16, fontWeight: '700' },
  textoSecundario: { color: colores.texto, fontSize: 16, fontWeight: '700' },
  textoSm: { fontSize: 13 },
});