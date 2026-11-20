import { Redirect } from 'expo-router';

import { useAuthStore } from '@hvca/shared';

export default function RutaNoEncontradaConductor() {
  const { session } = useAuthStore();
  return <Redirect href={session ? '/(tabs)/inicio' : '/login'} />;
}
