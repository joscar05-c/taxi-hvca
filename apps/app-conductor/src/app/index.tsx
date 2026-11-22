import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import {
  OnboardingCarousel,
  colores,
  useAuthStore,
  useOnboarding,
  type OnboardingSlide,
} from '@hvca/shared';

const SLIDES_CONDUCTOR: OnboardingSlide[] = [
  {
    id: 'conductor-radar',
    etiqueta: 'Radar en vivo',
    titulo: 'Conéctate cuando tú decidas',
    descripcion:
      'Activa tu estado disponible y recibe al instante solicitudes de pasajeros en toda Huancavelica.',
    icono: '🧭',
    colorFondoIcono: '#EFF6FF',
    colorAcento: '#1A3A8F',
  },
  {
    id: 'conductor-ofertas',
    etiqueta: 'Control total',
    titulo: 'Envía tu oferta al instante',
    descripcion:
      'Revisa origen, destino y tarifa sugerida antes de aceptar o enviar tu contraoferta.',
    icono: '⚡',
    colorFondoIcono: '#FEF3C7',
    colorAcento: '#B45309',
  },
  {
    id: 'conductor-documentos',
    etiqueta: 'Confianza',
    titulo: 'Perfil y documentos en regla',
    descripcion:
      'Valida tu celular y registra tu vehículo y brevete para brindar más seguridad y concretar más viajes.',
    icono: '🪪',
    colorFondoIcono: '#ECFDF5',
    colorAcento: '#15803D',
  },
];

export default function PantallaInicialConductor() {
  const router = useRouter();
  const { session } = useAuthStore();
  const { cargando, completado, marcarCompletado } = useOnboarding('conductor');

  if (session) {
    return <Redirect href="/(tabs)/inicio" />;
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
      rol="conductor"
      slides={SLIDES_CONDUCTOR}
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
