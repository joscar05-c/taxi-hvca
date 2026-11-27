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

export default function PantallaLogin() {
  const insets = useSafeAreaInsets();
  const { session, authError, setAuthError } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    iniciarConGoogle,
    cargando: cargandoGoogle,
    error: errorGoogle,
  } = useGoogleLogin('conductor');

  const errorVisible = error || errorGoogle || authError;

  // Si ya hay sesión, el área autenticada lo redirige a la ruta principal.
  if (session) {
    return <Redirect href="/(tabs)/inicio" />;
  }

  async function iniciarSesion() {
    setError(null);
    setAuthError(null);
    if (!email.trim() || !password) {
      setError('Completa el correo y la contraseña.');
      return;
    }

    setCargando(true);
    try {
      await authRepository.iniciarSesionConEmail(
        email.trim().toLowerCase(),
        password,
        'conductor',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
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
              paddingTop: Math.max(insets.top, 24) + 12,
              paddingBottom: Math.max(insets.bottom, 24) + 12,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.tarjeta, sombras.suave]}>
            <CabeceraAuth
              rol="conductor"
              titulo="Inicia sesión"
              subtitulo="Conéctate y recibe carreras en tiempo real en Huancavelica."
            />

            <Input
              etiqueta="Correo electrónico"
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
              esContrasena
              autoComplete="password"
              placeholder="••••••••"
              testID="login-password"
              contenedorEstilo={styles.campo}
            />

            {errorVisible ? (
              <View style={styles.bannerError}>
                <Text style={styles.textoError}>{errorVisible}</Text>
              </View>
            ) : null}

            <Button
              label="Entrar"
              onPress={iniciarSesion}
              cargando={cargando}
              estilo={styles.boton}
            />

            <View style={styles.separadorContainer}>
              <View style={styles.linea} />
              <Text style={styles.textoSeparador}>o continúa con</Text>
              <View style={styles.linea} />
            </View>

            <BotonGoogle
              onPress={() => {
                setAuthError(null);
                void iniciarConGoogle();
              }}
              cargando={cargandoGoogle}
              label="Ingresar con Google"
            />

            <View style={styles.pieEnlace}>
              <Text style={styles.textoPie}>¿No tienes cuenta? </Text>
              <Link href="/registro" style={styles.enlace}>
                Regístrate
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