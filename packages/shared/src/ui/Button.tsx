import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type ViewStyle,
} from 'react-native';

import { colores } from './theme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variante?: 'primario' | 'secundario' | 'peligro';
  deshabilitado?: boolean;
  cargando?: boolean;
  estilo?: ViewStyle;
}

export function Button({
  label,
  onPress,
  variante = 'primario',
  deshabilitado = false,
  cargando = false,
  estilo,
}: ButtonProps) {
  const inactivo = deshabilitado || cargando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.base,
        styles[variante],
        pressed && !inactivo && styles.presionado,
        inactivo && styles.deshabilitado,
        estilo,
      ]}
      accessibilityRole="button"
    >
      {cargando ? (
        <ActivityIndicator color={colores.fondo} />
      ) : (
        <Text style={styles[variante === 'primario' ? 'textoPrimario' : 'textoSecundario']}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primario: { backgroundColor: colores.primario },
  secundario: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.borde },
  peligro: { backgroundColor: colores.peligro },
  presionado: { opacity: 0.85 },
  deshabilitado: { opacity: 0.5 },
  textoPrimario: { color: colores.fondo, fontSize: 16, fontWeight: '600' },
  textoSecundario: { color: colores.texto, fontSize: 16, fontWeight: '600' },
});