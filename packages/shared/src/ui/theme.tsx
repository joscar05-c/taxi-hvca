import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Paleta central de la marca. Los componentes la consumen vía StyleSheet.create. */
export const colores = {
  primario: '#1A3A8F',
  accent: '#FFC107',
  fondo: '#FFFFFF',
  texto: '#111827',
  textoSuave: '#6B7280',
  borde: '#E5E7EB',
  peligro: '#DC2626',
  exito: '#16A34A',
} as const;

export function PantallaCentrada({ children }: { children: ReactNode }) {
  return <View style={styles.centrado}>{children}</View>;
}

export function Etiqueta({ children }: { children: ReactNode }) {
  return <Text style={styles.etiqueta}>{children}</Text>;
}

const styles = StyleSheet.create({
  centrado: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  etiqueta: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
    marginBottom: 4,
  },
});