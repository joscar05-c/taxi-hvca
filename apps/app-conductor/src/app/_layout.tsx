import '../locationTask';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import {
  Icono,
  colores,
  radios,
  sombras,
  useAuthInit,
  useAuthStore,
} from '@hvca/shared';

export default function RootLayout() {
  useAuthInit('conductor');
  const { isInitialized } = useAuthStore();

  // Mientras no verificamos la sesión persistida, mostramos un splash de marca.
  if (!isInitialized) {
    return (
      <View style={styles.splash}>
        <StatusBar style="dark" />
        <View style={[styles.emblema, sombras.media]}>
          <Icono nombre="taxi" size={38} color={colores.fondo} />
        </View>
        <Text style={styles.marca}>Taxi HVCA</Text>
        <Text style={styles.submarca}>Conductor</Text>
        <ActivityIndicator
          size="small"
          color={colores.primario}
          style={styles.spinner}
        />
      </View>
    );
  }

  // El guard de sesión vive en `(tabs)/_layout`: sin sesión → /login.
  // Aquí basta con exponer las rutas; login/registro redirigen a (tabs)
  // cuando `session` existe, así el área privada queda protegida.
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="registro" />
        <Stack.Screen name="oauthredirect" />
        <Stack.Screen name="verificacion-telefono" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblema: {
    width: 72,
    height: 72,
    borderRadius: radios.xl,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  marca: {
    fontSize: 22,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.4,
  },
  submarca: {
    fontSize: 13,
    fontWeight: '600',
    color: colores.exitoOscuro,
    marginTop: 2,
  },
  spinner: {
    marginTop: 24,
  },
});