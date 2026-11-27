import { StyleSheet, Text, View } from 'react-native';

import { Icono } from './Icono';
import { colores, radios, sombras } from './theme';

export interface CabeceraAuthProps {
  rol: 'pasajero' | 'conductor';
  titulo: string;
  subtitulo: string;
}

/**
 * Encabezado de marca reutilizable para pantallas de Login y Registro.
 */
export function CabeceraAuth({ rol, titulo, subtitulo }: CabeceraAuthProps) {
  const esConductor = rol === 'conductor';

  return (
    <View style={styles.contenedor}>
      <View style={styles.filaMarca}>
        <View style={[styles.emblema, sombras.suave]}>
          <Icono nombre="taxi" size={26} color={colores.fondo} />
        </View>
        <View>
          <Text style={styles.marca}>Taxi HVCA</Text>
          <View
            style={[
              styles.badgeRol,
              esConductor ? styles.badgeConductor : styles.badgePasajero,
            ]}
          >
            <Text
              style={[
                styles.textoBadge,
                esConductor ? styles.textoConductor : styles.textoPasajero,
              ]}
            >
              {esConductor ? 'APP CONDUCTOR' : 'APP PASAJERO'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.subtitulo}>{subtitulo}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    marginBottom: 20,
  },
  filaMarca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  emblema: {
    width: 48,
    height: 48,
    borderRadius: radios.lg - 2,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marca: {
    fontSize: 19,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  badgeRol: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radios.sm - 2,
    borderWidth: 1,
    marginTop: 3,
  },
  badgePasajero: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  badgeConductor: {
    backgroundColor: colores.exitoSuave,
    borderColor: colores.exitoBorde,
  },
  textoBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  textoPasajero: {
    color: colores.primario,
  },
  textoConductor: {
    color: colores.exitoOscuro,
  },
  titulo: {
    fontSize: 26,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.4,
  },
  subtitulo: {
    fontSize: 14,
    color: colores.textoSuave,
    marginTop: 4,
    lineHeight: 20,
  },
});
