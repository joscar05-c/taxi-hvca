import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  authRepository,
  colores,
  useAuth,
  useBackgroundLocation,
} from '@hvca/shared';

import { BACKGROUND_LOCATION_TASK } from '../../locationTask';

export default function PantallaInicio() {
  const { perfil, cerrarSesion } = useAuth();
  const { isTracking, loading, error, startTracking, stopTracking } =
    useBackgroundLocation(BACKGROUND_LOCATION_TASK);
  const [operando, setOperando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function alternarConexion() {
    setMensaje(null);
    setOperando(true);
    try {
      if (isTracking) {
        await stopTracking();
        await authRepository.actualizarConexion(false);
        setMensaje('Te desconectaste. Ya no compartes tu ubicación.');
      } else {
        const iniciado = await startTracking();
        if (!iniciado) return;

        try {
          await authRepository.actualizarConexion(true);
          setMensaje('Estás conectado. Compartimos tu ubicación en segundo plano.');
        } catch (e) {
          await stopTracking();
          setMensaje(
            e instanceof Error ? e.message : 'No se pudo actualizar tu conexión.',
          );
        }
      }
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : 'Ocurrió un error inesperado.');
    } finally {
      setOperando(false);
    }
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.cabecera}>
        <Text style={styles.saludo}>Hola,</Text>
        <Text style={styles.nombre}>
          {perfil?.nombre ?? 'Conductor'}
        </Text>
      </View>

      <View style={styles.central}>
        <View style={styles.tarjeta}>
          <View style={[styles.punto, isTracking ? styles.puntoActivo : styles.puntoInactivo]} />
          <Text style={styles.estadoTexto}>
            {isTracking ? 'Conectado' : 'Desconectado'}
          </Text>
          <Text style={styles.estadoDetalle}>
            {isTracking
              ? 'Tu ubicación se comparte con el mapa incluso con la pantalla bloqueada.'
              : 'Conéctate para empezar a recibir solicitudes y aparecer en el mapa.'}
          </Text>
        </View>

        <Button
          label={isTracking ? 'Desconectarse' : 'Conectarse'}
          onPress={() => void alternarConexion()}
          cargando={operando || loading}
          variante={isTracking ? 'peligro' : 'primario'}
          estilo={styles.boton}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {mensaje ? <Text style={styles.mensaje}>{mensaje}</Text> : null}
      </View>

      <Pressable onPress={() => void cerrarSesion()} style={styles.logout}>
        <Text style={styles.logoutTexto}>Cerrar sesión</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: colores.fondo,
    padding: 24,
    justifyContent: 'space-between',
  },
  cabecera: {
    marginTop: 8,
  },
  saludo: {
    fontSize: 16,
    color: colores.textoSuave,
  },
  nombre: {
    fontSize: 26,
    fontWeight: '700',
    color: colores.texto,
  },
  central: {
    flex: 1,
    justifyContent: 'center',
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  tarjeta: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colores.borde,
    padding: 24,
    marginBottom: 24,
  },
  punto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 10,
  },
  puntoActivo: {
    backgroundColor: colores.exito,
  },
  puntoInactivo: {
    backgroundColor: colores.textoSuave,
    opacity: 0.4,
  },
  estadoTexto: {
    fontSize: 20,
    fontWeight: '700',
    color: colores.texto,
  },
  estadoDetalle: {
    marginTop: 8,
    fontSize: 14,
    color: colores.textoSuave,
    textAlign: 'center',
  },
  boton: {
    minHeight: 72,
    borderRadius: 24,
  },
  error: {
    marginTop: 16,
    color: colores.peligro,
    textAlign: 'center',
  },
  mensaje: {
    marginTop: 16,
    color: colores.exito,
    textAlign: 'center',
  },
  logout: {
    alignSelf: 'center',
    padding: 12,
  },
  logoutTexto: {
    color: colores.textoSuave,
    fontWeight: '600',
  },
});