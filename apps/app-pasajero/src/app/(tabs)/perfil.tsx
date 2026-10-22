import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';

import {
  Button,
  PantallaCentrada,
  SeccionVerificacionTelefono,
  authRepository,
  colores,
  useAuthStore,
} from '@hvca/shared';

export default function PantallaPerfilPasajero() {
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
    <PantallaCentrada>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Cabecera del Perfil */}
        <View style={styles.headerPerfil}>
          <View style={styles.avatar}>
            <Text style={styles.textoAvatar}>{iniciales}</Text>
          </View>

          <View style={styles.infoUsuario}>
            <Text style={styles.nombre}>{perfil?.nombre || 'Pasajero Taxi HVCA'}</Text>
            <Text style={styles.email}>{session.user.email || 'Sin correo asociado'}</Text>
            <View style={styles.badgeRol}>
              <Text style={styles.textoBadgeRol}>PASAJERO</Text>
            </View>
          </View>
        </View>

        {/* Métrica / Reputación */}
        <View style={styles.filaMetricas}>
          <View style={styles.cardMetrica}>
            <Text style={styles.valorMetrica}>
              ★ {(perfil?.calificacion_promedio ?? 5.0).toFixed(1)}
            </Text>
            <Text style={styles.etiquetaMetrica}>Calificación</Text>
          </View>
          <View style={styles.cardMetrica}>
            <Text style={styles.valorMetrica}>
              {perfil?.telefono_verificado ? '100%' : 'Incompleto'}
            </Text>
            <Text style={styles.etiquetaMetrica}>Perfil</Text>
          </View>
        </View>

        {/* Sección de Validación Telefónica contra números falsos */}
        <SeccionVerificacionTelefono perfil={perfil} />

        {/* Botón de Cierre de Sesión */}
        <Button
          label="Cerrar Sesión"
          variante="peligro"
          onPress={handleCerrarSesion}
          cargando={cerrandoSesion}
          estilo={styles.botonSalir}
        />
      </ScrollView>
    </PantallaCentrada>
  );
}

const styles = StyleSheet.create({
  contenido: {
    width: '100%',
    maxWidth: 480,
    paddingVertical: 20,
  },
  headerPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
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
    color: '#FFFFFF',
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
    backgroundColor: '#EFF6FF',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  textoBadgeRol: {
    color: '#1D4ED8',
    fontSize: 10,
    fontWeight: '800',
  },
  filaMetricas: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  cardMetrica: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  valorMetrica: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.texto,
  },
  etiquetaMetrica: {
    fontSize: 11,
    color: colores.textoSuave,
    marginTop: 2,
  },
  botonSalir: {
    marginTop: 16,
  },
});
