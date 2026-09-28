import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { Link, Redirect } from 'expo-router';

import {
  Button,
  Input,
  PantallaCentrada,
  colores,
  supabase,
  useAuthStore,
} from '@hvca/shared';

export default function PantallaLogin() {
  const { session } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si ya hay sesión, el área autenticada lo redirige a la ruta principal.
  if (session) {
    return <Redirect href="/(tabs)/mapa" />;
  }

  async function iniciarSesion() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Completa el correo y la contraseña.');
      return;
    }

    setCargando(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      // El listener de onAuthStateChange actualiza el store y redirige.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <PantallaCentrada>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.contenido}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.titulo}>Inicia sesión</Text>
          <Text style={styles.subtitulo}>
            Bienvenido de vuelta a la app de pasajero.
          </Text>

          <Input
            etiqueta="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            testID="login-email"
          />
          <Input
            etiqueta="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            placeholder="••••••••"
            testID="login-password"
            style={styles.campo}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Button
            label="Entrar"
            onPress={iniciarSesion}
            cargando={cargando}
            estilo={styles.boton}
          />

          <Link href="/registro" style={styles.enlace}>
            ¿No tienes cuenta? Regístrate
          </Link>
        </ScrollView>
      </KeyboardAvoidingView>
    </PantallaCentrada>
  );
}

const styles = StyleSheet.create({
  flex: { width: '100%' },
  contenido: {
    width: '100%',
    maxWidth: 420,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: colores.texto,
  },
  subtitulo: {
    fontSize: 14,
    color: colores.textoSuave,
    marginBottom: 24,
  },
  campo: {
    marginTop: 12,
  },
  error: {
    color: colores.peligro,
    marginTop: 12,
  },
  boton: {
    marginTop: 16,
  },
  enlace: {
    marginTop: 20,
    textAlign: 'center',
    color: colores.primario,
    fontWeight: '600',
  },
});