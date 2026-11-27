import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  SeccionVerificacionTelefono,
  TarjetaCambioApp,
  authRepository,
  colores,
  radios,
  sombras,
  useAuthStore,
} from '@hvca/shared';

export default function PantallaPerfilPasajero() {
  const insets = useSafeAreaInsets();
  const { session, perfil } = useAuthStore();
  const [cerrandoSesion, setCerrandoSesion] = useState(false);

  if (!session) {
    return <Redirect href="/login" />;
  }

  async function handleCerrarSesion() {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que deseas salir de tu cuenta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, salir',
          style: 'destructive',
          onPress: async () => {
            setCerrandoSesion(true);
            try {
              await authRepository.cerrarSesion();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo cerrar sesión.');
            } finally {
              setCerrandoSesion(false);
            }
          },
        },
      ],
    );
  }

  const iniciales = (perfil?.nombre || session.user.email || 'P')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={styles.pantalla}>
      <View
        style={[
          styles.cabeceraSuperior,
          { paddingTop: Math.max(insets.top, 16) + 4 },
        ]}
      >
        <Text style={styles.tituloPantalla}>Mi Perfil</Text>
        <Text style={styles.subtituloPantalla}>
          Tu cuenta y seguridad de pasajero
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contenido,
          { paddingBottom: Math.max(insets.bottom, 20) + 16 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.columnaCentral}>
          {/* Cabecera del Perfil */}
          <View style={[styles.headerPerfil, sombras.suave]}>
            <View style={styles.avatar}>
              <Text style={styles.textoAvatar}>{iniciales}</Text>
            </View>

            <View style={styles.infoUsuario}>
              <Text style={styles.nombre} numberOfLines={1}>
                {perfil?.nombre || 'Pasajero Taxi HVCA'}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {session.user.email || 'Sin correo asociado'}
              </Text>
              <View style={styles.badgeRol}>
                <Text style={styles.textoBadgeRol}>PASAJERO</Text>
              </View>
            </View>
          </View>

          {/* Métrica / Reputación */}
          <View style={styles.filaMetricas}>
            <View style={[styles.cardMetrica, sombras.suave]}>
              <Text style={styles.valorMetrica}>
                <Text style={styles.estrellaDorada}>★ </Text>
                {(perfil?.calificacion_promedio ?? 5.0).toFixed(1)}
              </Text>
              <Text style={styles.etiquetaMetrica}>Calificación</Text>
            </View>
            <View style={[styles.cardMetrica, sombras.suave]}>
              <View style={styles.filaEstadoMetrica}>
                <View
                  style={[
                    styles.puntoEstado,
                    {
                      backgroundColor: perfil?.telefono_verificado
                        ? colores.exito
                        : colores.accent,
                    },
                  ]}
                />
                <Text style={styles.valorMetrica}>
                  {perfil?.telefono_verificado ? 'Verificado' : 'Pendiente'}
                </Text>
              </View>
              <Text style={styles.etiquetaMetrica}>Teléfono</Text>
            </View>
          </View>

          {/* Sección de Validación Telefónica contra números falsos */}
          <SeccionVerificacionTelefono perfil={perfil} />

          {/* Acceso directo a la app de Conductor */}
          <TarjetaCambioApp
            destino="conductor"
            urlTienda={process.env.EXPO_PUBLIC_CONDUCTOR_STORE_URL}
          />

          {/* Botón de Cierre de Sesión */}
          <Button
            label="Cerrar Sesión"
            variante="peligro"
            onPress={handleCerrarSesion}
            cargando={cerrandoSesion}
            estilo={styles.botonSalir}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: colores.superficie,
  },
  cabeceraSuperior: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colores.fondo,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  tituloPantalla: {
    fontSize: 22,
    fontWeight: '800',
    color: colores.texto,
    letterSpacing: -0.3,
  },
  subtituloPantalla: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  contenido: {
    padding: 16,
    alignItems: 'center',
  },
  columnaCentral: {
    width: '100%',
    maxWidth: 480,
  },
  headerPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: colores.fondo,
    padding: 16,
    borderRadius: radios.lg,
    borderWidth: 1,
    borderColor: colores.borde,
    marginBottom: 12,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colores.primario,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoAvatar: {
    color: colores.fondo,
    fontSize: 22,
    fontWeight: '800',
  },
  infoUsuario: {
    flex: 1,
  },
  nombre: {
    fontSize: 18,
    fontWeight: '700',
    color: colores.texto,
  },
  email: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  badgeRol: {
    backgroundColor: colores.primarioSuave,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radios.sm - 2,
    marginTop: 6,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
  },
  textoBadgeRol: {
    color: colores.primario,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  filaMetricas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  cardMetrica: {
    flex: 1,
    backgroundColor: colores.fondo,
    borderRadius: radios.lg - 2,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaEstadoMetrica: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  puntoEstado: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  estrellaDorada: {
    color: '#F59E0B',
  },
  valorMetrica: {
    fontSize: 17,
    fontWeight: '800',
    color: colores.texto,
  },
  etiquetaMetrica: {
    fontSize: 11,
    color: colores.textoSuave,
    marginTop: 3,
    fontWeight: '600',
  },
  botonSalir: {
    marginTop: 12,
  },
});
