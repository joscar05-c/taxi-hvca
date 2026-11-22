import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

export default function VerificacionTelefonoRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/perfil');
    }
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#1A3A8F" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
