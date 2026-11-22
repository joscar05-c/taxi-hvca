import { Redirect } from 'expo-router';

import { useAuthStore } from '@hvca/shared';

export default function RutaNoEncontradaPasajero() {
  const { session } = useAuthStore();
  return <Redirect href={session ? '/(tabs)/mapa' : '/login'} />;
}
