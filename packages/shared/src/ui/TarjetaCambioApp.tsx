import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icono } from './Icono';
import { colores, radios, sombras } from './theme';

export interface TarjetaCambioAppProps {
  /** Aplicación hacia la que se redirige al usuario. */
  destino: 'conductor' | 'pasajero';
  /** URL personalizada de descarga/tienda cuando la app esté publicada (opcional). */
  urlTienda?: string;
}

const CONFIG_DESTINO = {
  conductor: {
    scheme: 'app-conductor://',
    packageAndroid: 'com.joscar03.dev.appconductor',
    nombreApp: 'Taxi HVCA Conductor',
    badge: 'MODO CONDUCTOR',
    titulo: '¿Manejas taxi en Huancavelica?',
    descripcion:
      'Regístrate en Taxi HVCA Conductor, recibe solicitudes cercanas y genera ingresos a tu ritmo.',
    cta: 'Abrir app Conductor →',
    icono: 'volante' as const,
  },
  pasajero: {
    scheme: 'app-pasajero://',
    packageAndroid: 'com.joscar03.dev.apppasajero',
    nombreApp: 'Taxi HVCA Pasajero',
    badge: 'MODO PASAJERO',
    titulo: '¿Necesitas pedir un taxi?',
    descripcion:
      'Cambia a Taxi HVCA Pasajero para solicitar un viaje cuando no estés conduciendo.',
    cta: 'Abrir app Pasajero →',
    icono: 'mapa' as const,
  },
};

/**
 * Tarjeta promocional/puente entre la app de Pasajero y la app de Conductor.
 * Intenta abrir la app hermana instalada mediante deep link y, si no está instalada,
 * redirige al enlace de tienda configurado o a su ficha de Google Play al publicarse.
 */
export function TarjetaCambioApp({ destino, urlTienda }: TarjetaCambioAppProps) {
  const cfg = CONFIG_DESTINO[destino];
  const haciaConductor = destino === 'conductor';

  async function abrirOtraApp() {
    // 1) Si ya está instalada en el dispositivo (ej. LDPlayer o celular del chofer), abrir directo
    try {
      await Linking.openURL(cfg.scheme);
      return;
    } catch {
      // No está instalada; continuamos al flujo de tienda/publicación
    }

    const enlaceTienda =
      urlTienda?.trim() ||
      (Platform.OS === 'android'
        ? `https://play.google.com/store/apps/details?id=${cfg.packageAndroid}`
        : '');

    if (urlTienda?.trim()) {
      try {
        await Linking.openURL(urlTienda.trim());
        return;
      } catch {
        // Fallback al aviso informativo
      }
    }

    Alert.alert(
      cfg.nombreApp,
      `Aún no tienes instalada ${cfg.nombreApp} en este dispositivo. Cuando esté publicada en la tienda podrás descargarla desde aquí.`,
      enlaceTienda
        ? [
            { text: 'Cerrar', style: 'cancel' },
            {
              text: 'Ver en tienda',
              onPress: () => {
                void Linking.openURL(enlaceTienda).catch(() => undefined);
              },
            },
          ]
        : [{ text: 'Entendido' }],
    );
  }

  return (
    <Pressable
      onPress={() => void abrirOtraApp()}
      style={({ pressed }) => [
        styles.card,
        haciaConductor ? styles.cardConductor : styles.cardPasajero,
        sombras.suave,
        pressed && styles.presionado,
      ]}
      accessibilityRole="button"
      accessibilityLabel={cfg.cta}
    >
      <View style={styles.filaSuperior}>
        <View
          style={[
            styles.emblema,
            haciaConductor ? styles.emblemaConductor : styles.emblemaPasajero,
          ]}
        >
          <Icono
            nombre={cfg.icono}
            size={22}
            color={colores.fondo}
            activo={!haciaConductor}
          />
        </View>

        <View style={styles.contenido}>
          <View
            style={[
              styles.badge,
              haciaConductor ? styles.badgeConductor : styles.badgePasajero,
            ]}
          >
            <Text
              style={[
                styles.textoBadge,
                haciaConductor ? styles.textoBadgeConductor : styles.textoBadgePasajero,
              ]}
            >
              {cfg.badge}
            </Text>
          </View>
          <Text style={styles.titulo}>{cfg.titulo}</Text>
          <Text style={styles.descripcion}>{cfg.descripcion}</Text>
        </View>
      </View>

      <View
        style={[
          styles.barraCta,
          haciaConductor ? styles.barraCtaConductor : styles.barraCtaPasajero,
        ]}
      >
        <Text
          style={[
            styles.textoCta,
            haciaConductor ? styles.textoCtaConductor : styles.textoCtaPasajero,
          ]}
        >
          {cfg.cta}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radios.lg,
    padding: 16,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 4,
  },
  cardConductor: {
    backgroundColor: colores.fondo,
    borderColor: colores.exitoBorde,
  },
  cardPasajero: {
    backgroundColor: colores.fondo,
    borderColor: colores.primarioBorde,
  },
  presionado: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  emblema: {
    width: 44,
    height: 44,
    borderRadius: radios.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemaConductor: {
    backgroundColor: '#059669',
  },
  emblemaPasajero: {
    backgroundColor: colores.primario,
  },
  contenido: {
    flex: 1,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radios.sm - 2,
    borderWidth: 1,
    marginBottom: 5,
  },
  badgeConductor: {
    backgroundColor: colores.exitoSuave,
    borderColor: colores.exitoBorde,
  },
  badgePasajero: {
    backgroundColor: colores.primarioSuave,
    borderColor: colores.primarioBorde,
  },
  textoBadge: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  textoBadgeConductor: {
    color: colores.exitoOscuro,
  },
  textoBadgePasajero: {
    color: colores.primario,
  },
  titulo: {
    fontSize: 15,
    fontWeight: '800',
    color: colores.texto,
  },
  descripcion: {
    fontSize: 12,
    color: colores.textoSuave,
    marginTop: 3,
    lineHeight: 17,
  },
  barraCta: {
    marginTop: 12,
    borderRadius: radios.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  barraCtaConductor: {
    backgroundColor: colores.exitoSuave,
  },
  barraCtaPasajero: {
    backgroundColor: colores.primarioSuave,
  },
  textoCta: {
    fontSize: 13,
    fontWeight: '800',
  },
  textoCtaConductor: {
    color: colores.exitoOscuro,
  },
  textoCtaPasajero: {
    color: colores.primario,
  },
});
