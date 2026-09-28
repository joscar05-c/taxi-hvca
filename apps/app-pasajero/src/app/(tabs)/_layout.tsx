import { Redirect, Tabs } from 'expo-router';

import { useAuthStore } from '@hvca/shared';

export default function TabsLayout() {
  const { session } = useAuthStore();

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1A3A8F',
      }}
    >
      <Tabs.Screen name="mapa" options={{ title: 'Mapa' }} />
    </Tabs>
  );
}