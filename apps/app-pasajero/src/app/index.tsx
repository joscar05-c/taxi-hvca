import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import {
  OnboardingCarousel,
  colores,
  useAuthStore,
  useOnboarding,
  type OnboardingSlide,
} from '@hvca/shared';

const SLIDES_PASAJERO: OnboardingSlide[] = [
  {
    id: 'pasajero-mapa',
    etiqueta: 'Mapa en vivo',
    titulo: 'Pide tu taxi en Huancavelica',
    descripcion:
      'Marca tu punto de recojo y tu destino en el mapa en segundos, sin llamadas ni esperas.',
    icono: '🚕',
    colorFondoIcono: '#EFF6FF',
    colorAcento: '#1A3A8F',
  },
  {
    id: 'pasajero-precio',
    etiqueta: 'Tarifa clara',
    titulo: 'Negocia un precio justo',
    descripcion:
      'Propón el monto que deseas pagar, compara ofertas de conductores cercanos y elige la mejor.',
    icono: '🤝',
    colorFondoIcono: '#FEF3C7',
    colorAcento: '#B45309',
  },
  {
    id: 'pasajero-seguridad',
    etiqueta: 'Viaje seguro',
    titulo: 'Viaja con mayor seguridad',
    descripcion:
      'Sigue el recorrido en tiempo real, verifica tu número y consulta los datos del conductor asignado.',
    icono: '🛡️',
    colorFondoIcono: '#ECFDF5',
    colorAcento: '#15803D',
  },
];

export default function PantallaInicialPasajero() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { cargando, completado, marcarCompletado } = useOnboarding('pasajero');

  if (session) {
    return <Redirect href="/(tabs)/mapa" />;
  }

  if (cargando) {
    return (
      <View style={styles.cargando}>
        <ActivityIndicator size="large" color={colores.primario} />
      </View>
    );
  }

  if (completado) {
    return <Redirect href="/login" />;
  }

  return (
    <OnboardingCarousel
      rol="pasajero"
      slides={SLIDES_PASAJERO}
      onCompletar={async (destino) => {
        await marcarCompletado();
        router.replace(destino === 'registro' ? '/registro' : '/login');
      }}
    />
  );
}

const styles = StyleSheet.create({
  cargando: {
    flex: 1,
    backgroundColor: colores.fondo,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
