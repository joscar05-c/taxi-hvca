import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

/** Paleta central de la marca. Los componentes la consumen vía StyleSheet.create. */
export const colores = {
  primario: '#1A3A8F',
  primarioOscuro: '#132C6E',
  primarioSuave: '#EFF6FF',
  primarioBorde: '#BFDBFE',
  accent: '#FFC107',
  accentSuave: '#FEF3C7',
  accentOscuro: '#92400E',
  fondo: '#FFFFFF',
  superficie: '#F8FAFC',
  superficieSecundaria: '#F1F5F9',
  texto: '#111827',
  textoSecundario: '#374151',
  textoSuave: '#6B7280',
  borde: '#E5E7EB',
  bordeSuave: '#F1F5F9',
  peligro: '#DC2626',
  peligroSuave: '#FEE2E2',
  peligroOscuro: '#991B1B',
  exito: '#16A34A',
  exitoSuave: '#DCFCE7',
  exitoOscuro: '#166534',
  exitoBorde: '#86EFAC',
} as const;

export const radios = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const sombras: { suave: ViewStyle; media: ViewStyle } = {
  suave: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  media: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
};

export function PantallaCentrada({
  children,
  fondo = colores.fondo,
}: {
  children: ReactNode;
  fondo?: string;
}) {
  return (
    <View style={[styles.centrado, { backgroundColor: fondo }]}>{children}</View>
  );
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