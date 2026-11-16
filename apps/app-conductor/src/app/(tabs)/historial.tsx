import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  colores,
  formatearReferenciaHuancavelica,
  useAuthStore,
  viajesRepository,
  type SolicitudEstado,
  type SolicitudViaje,
} from '@hvca/shared';

function etiquetaEstado(estado: SolicitudEstado): { texto: string; bg: string; fg: string } {
  switch (estado) {
    case 'completado':
      return { texto: 'Completado', bg: '#DCFCE7', fg: '#166534' };
    case 'cancelada':
      return { texto: 'Cancelado', bg: '#FEE2E2', fg: '#991B1B' };
    case 'buscando':
      return { texto: 'Buscando', bg: '#FEF3C7', fg: '#92400E' };
    case 'aceptado':
    case 'en_camino_origen':
    case 'en_curso':
      return { texto: 'En progreso', bg: '#DBEAFE', fg: '#1E40AF' };
  }
}

export default function PantallaHistorialConductor() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [viajes, setViajes] = useState<SolicitudViaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [calificandoId, setCalificandoId] = useState<string | null>(null);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    setCargando(true);
    return viajesRepository.suscribirHistorialViajes(
      userId,
      'conductor',
      (lista) => {
        setViajes(lista);
        setCargando(false);
      },
      () => {
        setCargando(false);
      },
    );
  }, [userId]);

  const resumen = useMemo(() => {
    const completados = viajes.filter((v) => v.estado === 'completado');
    const ingresos = completados.reduce(
      (acc, v) => acc + Number(v.precio_final ?? v.precio_inicial ?? 0),
      0,
    );
    return {
      totalCompletados: completados.length,
      totalIngresos: ingresos,
    };
  }, [viajes]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  async function calificarPasajeroDesdeHistorial(
    viaje: SolicitudViaje,
    estrellas: number,
  ) {
    if (!userId) return;
    setCalificandoId(viaje.id);
    try {
      await viajesRepository.calificarViaje({
        solicitudId: viaje.id,
        evaluadorId: userId,
        evaluadoId: viaje.pasajero_id,
        rolEvaluador: 'conductor',
        estrellas,
      });
      Alert.alert('¡Gracias!', `Calificaste al pasajero con ${estrellas} ★`);
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo registrar la calificación.',
      );
    } finally {
      setCalificandoId(null);
    }
  }

  return (
    <View style={[styles.contenedor, { paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.cabecera}>
        <Text style={styles.titulo}>Mis Viajes e Ingresos</Text>
        <Text style={styles.subtitulo}>
          Resumen en tiempo real de tus carreras realizadas
        </Text>

        <View style={styles.filaResumen}>
          <View style={styles.cardResumen}>
            <Text style={styles.valorResumen}>{resumen.totalCompletados}</Text>
            <Text style={styles.etiquetaResumen}>Viajes Completados</Text>
          </View>
          <View style={styles.cardResumen}>
            <Text style={[styles.valorResumen, { color: colores.exito }]}>
              S/ {resumen.totalIngresos.toFixed(2)}
            </Text>
            <Text style={styles.etiquetaResumen}>Ingresos Totales</Text>
          </View>
        </View>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Text style={styles.textoVacio}>Cargando historial...</Text>
        </View>
      ) : viajes.length === 0 ? (
        <View style={styles.centrado}>
          <Text style={styles.iconoVacio}>🚕</Text>
          <Text style={styles.tituloVacio}>Aún no tienes carreras registradas</Text>
          <Text style={styles.textoVacio}>
            Conéctate en la pestaña Inicio para aceptar solicitudes cercanas.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
        >
          {viajes.map((v) => {
            const badge = etiquetaEstado(v.estado);
            const origenTxt =
              v.origen_direccion ??
              formatearReferenciaHuancavelica({
                latitude: v.origen_lat,
                longitude: v.origen_lng,
              });
            const destinoTxt =
              v.destino_direccion ??
              formatearReferenciaHuancavelica({
                latitude: v.destino_lat,
                longitude: v.destino_lng,
              });
            const precioMostrado = v.precio_final ?? v.precio_inicial;

            return (
              <View key={v.id} style={styles.tarjeta}>
                <View style={styles.filaSuperior}>
                  <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.textoBadge, { color: badge.fg }]}>
                      {badge.texto}
                    </Text>
                  </View>
                  <Text style={styles.fecha}>
                    {new Date(v.created_at).toLocaleString('es-PE', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>

                <Text style={styles.rutaLinea} numberOfLines={1}>
                  🟢 {origenTxt}
                </Text>
                <Text style={styles.rutaLinea} numberOfLines={1}>
                  🔴 {destinoTxt}
                </Text>

                <View style={styles.filaInferior}>
                  <Text style={styles.precio}>
                    S/ {Number(precioMostrado).toFixed(2)}
                  </Text>
                  {v.distancia_km ? (
                    <Text style={styles.distancia}>
                      {v.distancia_km.toFixed(1)} km
                    </Text>
                  ) : null}
                </View>

                {v.estado === 'completado' ? (
                  v.calificacion_pasajero ? (
                    <Text style={styles.calificado}>
                      Calificaste al pasajero: {'★'.repeat(v.calificacion_pasajero)} (
                      {v.calificacion_pasajero}/5)
                    </Text>
                  ) : (
                    <View style={styles.filaCalificar}>
                      <Text style={styles.textoCalificar}>Calificar pasajero:</Text>
                      <View style={styles.estrellas}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Pressable
                            key={n}
                            disabled={calificandoId === v.id}
                            onPress={() => void calificarPasajeroDesdeHistorial(v, n)}
                            style={styles.botonEstrella}
                          >
                            <Text style={styles.estrella}>★</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  )
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  cabecera: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: colores.fondo,
    borderBottomWidth: 1,
    borderBottomColor: colores.borde,
  },
  titulo: {
    fontSize: 22,
    fontWeight: '800',
    color: colores.texto,
  },
  subtitulo: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  filaResumen: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cardResumen: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colores.borde,
  },
  valorResumen: {
    fontSize: 18,
    fontWeight: '800',
    color: colores.primario,
  },
  etiquetaResumen: {
    fontSize: 11,
    color: colores.textoSuave,
    marginTop: 2,
    fontWeight: '600',
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconoVacio: {
    fontSize: 40,
    marginBottom: 10,
  },
  tituloVacio: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 4,
  },
  textoVacio: {
    fontSize: 13,
    color: colores.textoSuave,
    textAlign: 'center',
    marginTop: 6,
  },
  lista: {
    padding: 16,
    gap: 12,
  },
  tarjeta: {
    backgroundColor: colores.fondo,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  textoBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  fecha: {
    fontSize: 12,
    color: colores.textoSuave,
  },
  rutaLinea: {
    fontSize: 13,
    color: colores.texto,
    marginBottom: 4,
  },
  filaInferior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  precio: {
    fontSize: 16,
    fontWeight: '800',
    color: colores.primario,
  },
  distancia: {
    fontSize: 12,
    color: colores.textoSuave,
    fontWeight: '600',
  },
  calificado: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  filaCalificar: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textoCalificar: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSuave,
  },
  estrellas: {
    flexDirection: 'row',
    gap: 6,
  },
  botonEstrella: {
    paddingHorizontal: 3,
  },
  estrella: {
    fontSize: 20,
    color: '#F59E0B',
  },
});
