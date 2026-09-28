import '../locationTask';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuthInit, useAuthStore } from '@hvca/shared';

export default function RootLayout() {
  useAuthInit();
  const { isInitialized, session } = useAuthStore();

  // Mientras no verificamos la sesión persistida, mostramos un splash.
  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#1A3A8F" />
      </View>
    );
  }

  // El guard de sesión vive en `(tabs)/_layout`: sin sesión → /login.
  // Aquí basta con exponer las rutas; login/registro redirigen a (tabs)
  // cuando `session` existe, así el área privada queda protegida.
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});