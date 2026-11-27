import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { colores } from './theme';

export interface RutaVisualProps {
  origen: string;
  destino: string;
  etiquetaOrigen?: string;
  etiquetaDestino?: string;
  compacto?: boolean;
  estilo?: ViewStyle;
}

/**
 * Conector visual vertical de origen y destino (reemplaza emojis en tarjetas y mapas).
 */
export function RutaVisual({
  origen,
  destino,
  etiquetaOrigen,
  etiquetaDestino,
  compacto = false,
  estilo,
}: RutaVisualProps) {
  return (
    <View style={[styles.contenedor, estilo]}>
      <View style={[styles.columnaPuntos, compacto && styles.columnaPuntosCompacta]}>
        <View style={styles.puntoOrigenExterior}>
          <View style={styles.puntoOrigenInterior} />
        </View>
        <View style={[styles.lineaConectora, compacto && styles.lineaCompacta]} />
        <View style={styles.puntoDestino} />
      </View>

      <View style={[styles.columnaTextos, compacto && styles.columnaTextosCompacta]}>
        <View style={styles.bloqueTexto}>
          {etiquetaOrigen ? (
            <Text style={styles.etiqueta}>{etiquetaOrigen}</Text>
          ) : null}
          <Text
            style={[styles.direccion, compacto && styles.direccionCompacta]}
            numberOfLines={1}
          >
            {origen}
          </Text>
        </View>

        <View style={styles.bloqueTexto}>
          {etiquetaDestino ? (
            <Text style={styles.etiqueta}>{etiquetaDestino}</Text>
          ) : null}
          <Text
            style={[styles.direccion, compacto && styles.direccionCompacta]}
            numberOfLines={1}
          >
            {destino}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  columnaPuntos: {
    alignItems: 'center',
    paddingVertical: 3,
    width: 16,
  },
  columnaPuntosCompacta: {
    paddingVertical: 2,
  },
  puntoOrigenExterior: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colores.exitoSuave,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colores.exito,
  },
  puntoOrigenInterior: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colores.exito,
  },
  lineaConectora: {
    flex: 1,
    width: 2,
    minHeight: 16,
    backgroundColor: colores.borde,
    marginVertical: 3,
    borderRadius: 1,
  },
  lineaCompacta: {
    minHeight: 12,
    marginVertical: 2,
  },
  puntoDestino: {
    width: 11,
    height: 11,
    borderRadius: 3,
    backgroundColor: colores.peligro,
  },
  columnaTextos: {
    flex: 1,
    justifyContent: 'space-between',
    gap: 10,
  },
  columnaTextosCompacta: {
    gap: 6,
  },
  bloqueTexto: {
    justifyContent: 'center',
  },
  etiqueta: {
    fontSize: 10,
    fontWeight: '700',
    color: colores.textoSuave,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 1,
  },
  direccion: {
    fontSize: 14,
    fontWeight: '600',
    color: colores.texto,
  },
  direccionCompacta: {
    fontSize: 13,
    fontWeight: '500',
  },
});
