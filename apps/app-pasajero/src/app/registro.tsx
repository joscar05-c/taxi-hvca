import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, Redirect } from 'expo-router';

import {
  Button,
  BotonGoogle,
  Input,
  PantallaCentrada,
  authRepository,
  colores,
  useAuthStore,
  useGoogleLogin,
} from '@hvca/shared';

export default function PantallaRegistro() {
  const { session } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    iniciarConGoogle,
    cargando: cargandoGoogle,
    error: errorGoogle,
  } = useGoogleLogin('pasajero');

  const errorVisible = error || errorGoogle;

  if (session) {
    return <Redirect href="/(tabs)/mapa" />;
  }

  async function registrar() {
    setError(null);

    if (!nombre.trim() || !email.trim() || !telefono.trim() || !password) {
      setError('Completa todos los campos.');
      return;
    }

    setCargando(true);
    try {
      await authRepository.registrarConEmail({
        email: email.trim().toLowerCase(),
        password,
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        rol: 'pasajero',
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
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
          <Text style={styles.titulo}>Crea tu cuenta</Text>
          <Text style={styles.subtitulo}>
            Regístrate como pasajero para moverte por Huancavelica.
          </Text>

          {/* Botón de Google Principal */}
          <BotonGoogle
            onPress={iniciarConGoogle}
            cargando={cargandoGoogle}
            label="Registrarse con Google"
          />

          {/* Separador */}
          <View style={styles.separadorContainer}>
            <View style={styles.linea} />
            <Text style={styles.textoSeparador}>o con correo electrónico</Text>
            <View style={styles.linea} />
          </View>

          <Input
            etiqueta="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
            autoComplete="name"
            placeholder="Juan Pérez"
            testID="registro-nombre"
          />
          <Input
            etiqueta="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="juan@ejemplo.com"
            style={styles.campo}
            testID="registro-email"
          />
          <Input
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="+51 984 123 456"
            style={styles.campo}
            testID="registro-telefono"
          />
          <Input
            etiqueta="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password-new"
            placeholder="Mínimo 6 caracteres"
            style={styles.campo}
            testID="registro-password"
          />

          {errorVisible ? <Text style={styles.error}>{errorVisible}</Text> : null}

          <Button
            label="Crear cuenta"
            onPress={registrar}
            cargando={cargando}
            estilo={styles.boton}
          />

          <Link href="/login" style={styles.enlace}>
            ¿Ya tienes cuenta? Inicia sesión
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
    paddingVertical: 16,
  },
  titulo: {
    fontSize: 28,
    fontWeight: '700',
    color: colores.texto,
  },
  subtitulo: {
    fontSize: 14,
    color: colores.textoSuave,
    marginBottom: 20,
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
  separadorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  linea: {
    flex: 1,
    height: 1,
    backgroundColor: colores.borde,
  },
  textoSeparador: {
    paddingHorizontal: 12,
    fontSize: 12,
    color: colores.textoSuave,
  },
  enlace: {
    marginTop: 20,
    textAlign: 'center',
    color: colores.primario,
    fontWeight: '600',
  },
});