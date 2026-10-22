import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

import { colores } from './theme';

export interface BotonGoogleProps {
  onPress: () => void;
  label?: string;
  cargando?: boolean;
  deshabilitado?: boolean;
  estilo?: ViewStyle;
}

export function BotonGoogle({
  onPress,
  label = 'Continuar con Google',
  cargando = false,
  deshabilitado = false,
  estilo,
}: BotonGoogleProps) {
  const inactivo = deshabilitado || cargando;

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      style={({ pressed }) => [
        styles.boton,
        pressed && !inactivo && styles.presionado,
        inactivo && styles.deshabilitado,
        estilo,
      ]}
      accessibilityRole="button"
    >
      {cargando ? (
        <ActivityIndicator color={colores.primario} />
      ) : (
        <View style={styles.contenido}>
          {/* Logo Google Minimalista con colores oficiales */}
          <View style={styles.iconoGoogle}>
            <Text style={styles.letraG}>G</Text>
          </View>
          <Text style={styles.texto}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  presionado: {
    backgroundColor: '#F3F4F6',
    opacity: 0.9,
  },
  deshabilitado: {
    opacity: 0.5,
  },
  contenido: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  iconoGoogle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letraG: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    fontFamily: 'System',
  },
  texto: {
    color: '#1F2937',
    fontSize: 15,
    fontWeight: '600',
  },
});
