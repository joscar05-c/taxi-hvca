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

export default function PantallaRegistro() {
  const { session } = useAuthStore();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacionEnviada, setConfirmacionEnviada] = useState(false);

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
      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            rol: 'pasajero',
          },
        },
      });
      if (error) throw error;

      // Si la confirmación por email está habilitada, la sesión no viene en la
      // respuesta; informamos al usuario.
      setConfirmacionEnviada(true);
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
            Regístrate como pasajero de HVCA.
          </Text>

          <Input
            etiqueta="Nombre completo"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Juan Pérez"
            autoComplete="name"
            testID="registro-nombre"
          />
          <Input
            etiqueta="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            placeholder="tucorreo@ejemplo.com"
            style={styles.campo}
            testID="registro-email"
          />
          <Input
            etiqueta="Teléfono"
            value={telefono}
            onChangeText={setTelefono}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="(55) 1234 5678"
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

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {confirmacionEnviada ? (
            <Text style={styles.exito}>
              Revisa tu correo para confirmar tu cuenta. Ya casi terminas.
            </Text>
          ) : null}

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
  exito: {
    color: colores.exito,
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