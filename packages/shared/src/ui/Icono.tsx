import { StyleSheet, View, type ColorValue } from 'react-native';

import { colores } from './theme';

export type NombreIcono =
  | 'mapa'
  | 'volante'
  | 'viajes'
  | 'perfil'
  | 'ojo'
  | 'ojoCerrado'
  | 'taxi';

export interface IconoProps {
  nombre: NombreIcono;
  size?: number;
  color?: ColorValue;
  activo?: boolean;
}

/**
 * Íconos geométricos en React Native puro (sin dependencias nativas adicionales).
 */
export function Icono({
  nombre,
  size = 22,
  color = colores.texto,
  activo = false,
}: IconoProps) {
  const trazo = Math.max(1.8, Math.round(size * 0.095 * 10) / 10);

  if (nombre === 'mapa') {
    const cabeza = Math.round(size * 0.64);
    const punto = Math.round(size * 0.24);
    const punta = Math.round(size * 0.28);
    return (
      <View style={[styles.caja, { width: size, height: size }]}>
        <View
          style={{
            width: cabeza,
            height: cabeza,
            borderRadius: cabeza / 2,
            borderWidth: activo ? 0 : trazo,
            borderColor: color,
            backgroundColor: activo ? color : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: punto,
              height: punto,
              borderRadius: punto / 2,
              backgroundColor: activo ? colores.fondo : color,
            }}
          />
        </View>
        <View
          style={{
            width: 0,
            height: 0,
            marginTop: -2,
            borderLeftWidth: punta * 0.85,
            borderRightWidth: punta * 0.85,
            borderTopWidth: punta + 2,
            borderLeftColor: 'transparent',
            borderRightColor: 'transparent',
            borderTopColor: color,
          }}
        />
      </View>
    );
  }

  if (nombre === 'volante') {
    const aro = Math.round(size * 0.88);
    const centro = Math.round(size * 0.24);
    const brazo = Math.round(aro * 0.34);
    return (
      <View style={[styles.caja, { width: size, height: size }]}>
        <View
          style={{
            width: aro,
            height: aro,
            borderRadius: aro / 2,
            borderWidth: trazo + (activo ? 0.4 : 0),
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Barra horizontal del volante */}
          <View
            style={{
              position: 'absolute',
              width: aro - trazo * 2,
              height: trazo,
              backgroundColor: color,
              top: aro * 0.42 - trazo / 2,
            }}
          />
          {/* Brazo inferior del volante */}
          <View
            style={{
              position: 'absolute',
              width: trazo,
              height: brazo,
              backgroundColor: color,
              bottom: 0,
            }}
          />
          {/* Núcleo central */}
          <View
            style={{
              width: centro,
              height: centro,
              borderRadius: centro / 2,
              backgroundColor: activo ? color : colores.fondo,
              borderWidth: trazo * 0.85,
              borderColor: color,
            }}
          />
        </View>
      </View>
    );
  }

  if (nombre === 'viajes') {
    const nodo = Math.round(size * 0.26);
    const barraW = Math.round(size * 0.48);
    const barraH = Math.max(2, Math.round(size * 0.1));
    return (
      <View
        style={[
          styles.filaCentrada,
          { width: size, height: size, gap: Math.max(3, Math.round(size * 0.12)) },
        ]}
      >
        <View style={styles.columnaRuta}>
          <View
            style={{
              width: nodo,
              height: nodo,
              borderRadius: nodo / 2,
              borderWidth: trazo * 0.9,
              borderColor: color,
              backgroundColor: activo ? color : 'transparent',
            }}
          />
          <View
            style={{
              width: Math.max(1.5, trazo * 0.75),
              height: Math.round(size * 0.22),
              backgroundColor: color,
              opacity: 0.55,
              marginVertical: 1,
            }}
          />
          <View
            style={{
              width: nodo,
              height: nodo,
              borderRadius: nodo / 2,
              backgroundColor: color,
            }}
          />
        </View>
        <View style={{ justifyContent: 'space-between', height: Math.round(size * 0.7) }}>
          <View
            style={{
              width: barraW,
              height: barraH,
              borderRadius: barraH,
              backgroundColor: color,
            }}
          />
          <View
            style={{
              width: Math.round(barraW * 0.78),
              height: barraH,
              borderRadius: barraH,
              backgroundColor: color,
              opacity: activo ? 0.95 : 0.7,
            }}
          />
        </View>
      </View>
    );
  }

  if (nombre === 'perfil') {
    const cabeza = Math.round(size * 0.38);
    const hombrosW = Math.round(size * 0.76);
    const hombrosH = Math.round(size * 0.38);
    return (
      <View style={[styles.caja, { width: size, height: size, gap: Math.round(size * 0.07) }]}>
        <View
          style={{
            width: cabeza,
            height: cabeza,
            borderRadius: cabeza / 2,
            borderWidth: activo ? 0 : trazo,
            borderColor: color,
            backgroundColor: activo ? color : 'transparent',
          }}
        />
        <View
          style={{
            width: hombrosW,
            height: hombrosH,
            borderTopLeftRadius: hombrosW / 2,
            borderTopRightRadius: hombrosW / 2,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            borderWidth: activo ? 0 : trazo,
            borderBottomWidth: activo ? 0 : trazo,
            borderColor: color,
            backgroundColor: activo ? color : 'transparent',
          }}
        />
      </View>
    );
  }

  if (nombre === 'ojo' || nombre === 'ojoCerrado') {
    const ancho = Math.round(size * 0.9);
    const alto = Math.round(size * 0.56);
    const pupila = Math.round(size * 0.24);
    return (
      <View style={[styles.caja, { width: size, height: size }]}>
        <View
          style={{
            width: ancho,
            height: alto,
            borderRadius: alto,
            borderWidth: trazo,
            borderColor: color,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: pupila,
              height: pupila,
              borderRadius: pupila / 2,
              backgroundColor: color,
            }}
          />
        </View>
        {nombre === 'ojoCerrado' ? (
          <View
            style={{
              position: 'absolute',
              width: Math.round(size * 0.96),
              height: trazo,
              borderRadius: trazo,
              backgroundColor: color,
              transform: [{ rotate: '-35deg' }],
            }}
          />
        ) : null}
      </View>
    );
  }

  // nombre === 'taxi'
  const techoW = Math.round(size * 0.56);
  const techoH = Math.round(size * 0.24);
  const cuerpoW = Math.round(size * 0.88);
  const cuerpoH = Math.round(size * 0.34);
  const faro = Math.max(3, Math.round(size * 0.13));
  const llantaW = Math.max(4, Math.round(size * 0.16));
  const llantaH = Math.max(3, Math.round(size * 0.12));

  return (
    <View style={[styles.caja, { width: size, height: size }]}>
      {/* Letrero superior de taxi */}
      <View
        style={{
          width: Math.round(size * 0.28),
          height: Math.max(3, Math.round(size * 0.12)),
          borderTopLeftRadius: 3,
          borderTopRightRadius: 3,
          backgroundColor: colores.accent,
          marginBottom: 1,
        }}
      />
      {/* Cabina */}
      <View
        style={{
          width: techoW,
          height: techoH,
          borderTopLeftRadius: Math.round(size * 0.18),
          borderTopRightRadius: Math.round(size * 0.18),
          backgroundColor: color,
          marginBottom: -1,
        }}
      />
      {/* Carrocería */}
      <View
        style={{
          width: cuerpoW,
          height: cuerpoH,
          borderRadius: Math.round(size * 0.12),
          backgroundColor: color,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: Math.round(size * 0.1),
        }}
      >
        <View
          style={{
            width: faro,
            height: faro,
            borderRadius: faro / 2,
            backgroundColor: colores.accent,
          }}
        />
        <View
          style={{
            width: Math.round(size * 0.26),
            height: Math.max(2, Math.round(size * 0.08)),
            borderRadius: 2,
            backgroundColor: colores.fondo,
            opacity: 0.7,
          }}
        />
        <View
          style={{
            width: faro,
            height: faro,
            borderRadius: faro / 2,
            backgroundColor: colores.accent,
          }}
        />
      </View>
      {/* Ruedas */}
      <View
        style={{
          width: Math.round(cuerpoW * 0.78),
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: -1,
        }}
      >
        <View
          style={{
            width: llantaW,
            height: llantaH,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
        <View
          style={{
            width: llantaW,
            height: llantaH,
            borderBottomLeftRadius: 3,
            borderBottomRightRadius: 3,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caja: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  filaCentrada: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnaRuta: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
