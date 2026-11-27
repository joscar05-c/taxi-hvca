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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  BotonGoogle,
  CabeceraAuth,
  Input,
  authRepository,
  colores,
  radios,
  sombras,
  useAuthStore,
  useGoogleLogin,
} from '@hvca/shared';

export default function PantallaRegistro() {
  const insets = useSafeAreaInsets();
  const { session, authError, setAuthError } = useAuthStore();
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
  } = useGoogleLogin('conductor');

  const errorVisible = error || errorGoogle || authError;

  if (session) {
    return <Redirect href="/(tabs)/inicio" />;
  }

  async function registrar() {
    setError(null);
    setAuthError(null);

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
        rol: 'conductor',
      });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la cuenta.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <View style={styles.pantalla}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContenido,
            {
              paddingTop: Math.max(insets.top, 20) + 8,
              paddingBottom: Math.max(insets.bottom, 24) + 12,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.tarjeta, sombras.suave]}>
            <CabeceraAuth
              rol="conductor"
              titulo="Crea tu cuenta"
              subtitulo="Regístrate como conductor para trabajar en Huancavelica."
            />

            <BotonGoogle
              onPress={() => {
                setAuthError(null);
                void iniciarConGoogle();
              }}
              cargando={cargandoGoogle}
              label="Registrarse con Google"
            />

            <View style={styles.separadorContainer}>
              <View style={styles.linea} />
              <Text style={styles.textoSeparador}>o con correo electrónico</Text>
              <View style={styles.linea} />
            </View>

            <Input
              etiqueta="Nombre completo"
              value={nombre}
              onChangeText={setNombre}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Carlos Rojas"
              testID="registro-nombre"
            />
            <Input
              etiqueta="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
              placeholder="carlos@ejemplo.com"
              contenedorEstilo={styles.campo}
              testID="registro-email"
            />
            <Input
              etiqueta="Teléfono"
              value={telefono}
              onChangeText={setTelefono}
              keyboardType="phone-pad"
              autoComplete="tel"
              placeholder="+51 984 123 456"
              contenedorEstilo={styles.campo}
              testID="registro-telefono"
            />
            <Input
              etiqueta="Contraseña"
              value={password}
              onChangeText={setPassword}
              esContrasena
              autoComplete="password-new"
              placeholder="Mínimo 6 caracteres"
              contenedorEstilo={styles.campo}
              testID="registro-password"
            />

            {errorVisible ? (
              <View style={styles.bannerError}>
                <Text style={styles.textoError}>{errorVisible}</Text>
              </View>
            ) : null}

            <Button
              label="Crear cuenta de conductor"
              onPress={registrar}
              cargando={cargando}
              estilo={styles.boton}
            />

            <View style={styles.pieEnlace}>
              <Text style={styles.textoPie}>¿Ya tienes cuenta? </Text>
              <Link href="/login" style={styles.enlace}>
                Inicia sesión
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  flex: { flex: 1 },
  scrollContenido: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  tarjeta: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colores.fondo,
    borderRadius: radios.xl,
    padding: 22,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  campo: {
    marginTop: 14,
  },
  bannerError: {
    marginTop: 14,
    backgroundColor: colores.peligroSuave,
    borderRadius: radios.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textoError: {
    color: colores.peligroOscuro,
    fontSize: 13,
    fontWeight: '600',
  },
  boton: {
    marginTop: 18,
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
    fontWeight: '500',
  },
  pieEnlace: {
    marginTop: 22,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textoPie: {
    fontSize: 14,
    color: colores.textoSuave,
  },
  enlace: {
    fontSize: 14,
    color: colores.primario,
    fontWeight: '700',
  },
});