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
  Icono,
  RutaVisual,
  colores,
  formatearReferenciaHuancavelica,
  radios,
  sombras,
  useAuthStore,
  viajesRepository,
  type SolicitudEstado,
  type SolicitudViaje,
} from '@hvca/shared';

type FiltroHistorial = 'todos' | 'completado' | 'cancelada';

function etiquetaEstado(estado: SolicitudEstado): { texto: string; bg: string; fg: string } {
  switch (estado) {
    case 'completado':
      return { texto: 'Completado', bg: colores.exitoSuave, fg: colores.exitoOscuro };
    case 'cancelada':
      return { texto: 'Cancelado', bg: colores.peligroSuave, fg: colores.peligroOscuro };
    case 'buscando':
      return { texto: 'Buscando', bg: colores.accentSuave, fg: colores.accentOscuro };
    case 'aceptado':
    case 'en_camino_origen':
    case 'en_curso':
      return { texto: 'En progreso', bg: colores.primarioSuave, fg: colores.primario };
  }
}

export default function PantallaHistorialPasajero() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [viajes, setViajes] = useState<SolicitudViaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [calificandoId, setCalificandoId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroHistorial>('todos');

  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) return;
    setCargando(true);
    return viajesRepository.suscribirHistorialViajes(
      userId,
      'pasajero',
      (lista) => {
        setViajes(lista);
        setCargando(false);
      },
      () => {
        setCargando(false);
      },
    );
  }, [userId]);

  const conteos = useMemo(() => {
    let completado = 0;
    let cancelada = 0;
    viajes.forEach((v) => {
      if (v.estado === 'completado') completado += 1;
      if (v.estado === 'cancelada') cancelada += 1;
    });
    return { todos: viajes.length, completado, cancelada };
  }, [viajes]);

  const viajesFiltrados = useMemo(() => {
    if (filtro === 'todos') return viajes;
    return viajes.filter((v) => v.estado === filtro);
  }, [viajes, filtro]);

  if (!session) {
    return <Redirect href="/login" />;
  }

  async function calificarDesdeHistorial(viaje: SolicitudViaje, estrellas: number) {
    if (!userId || !viaje.conductor_id) return;
    setCalificandoId(viaje.id);
    try {
      await viajesRepository.calificarViaje({
        solicitudId: viaje.id,
        evaluadorId: userId,
        evaluadoId: viaje.conductor_id,
        rolEvaluador: 'pasajero',
        estrellas,
      });
      Alert.alert('¡Gracias!', `Calificaste este viaje con ${estrellas} ★`);
    } catch (e) {
      Alert.alert(
        'Error',
        e instanceof Error ? e.message : 'No se pudo registrar la calificación.',
      );
    } finally {
      setCalificandoId(null);
    }
  }

  const opcionesFiltro: Array<{ id: FiltroHistorial; label: string; count: number }> = [
    { id: 'todos', label: 'Todos', count: conteos.todos },
    { id: 'completado', label: 'Completados', count: conteos.completado },
    { id: 'cancelada', label: 'Cancelados', count: conteos.cancelada },
  ];

  return (
    <View style={styles.contenedor}>
      <View
        style={[
          styles.cabecera,
          { paddingTop: Math.max(insets.top, 16) + 4 },
        ]}
      >
        <Text style={styles.titulo}>Mis Viajes</Text>
        <Text style={styles.subtitulo}>
          Historial en tiempo real de tus carreras en Huancavelica
        </Text>

        <View style={styles.filaFiltros}>
          {opcionesFiltro.map((op) => {
            const activo = filtro === op.id;
            return (
              <Pressable
                key={op.id}
                onPress={() => setFiltro(op.id)}
                style={[styles.chipFiltro, activo && styles.chipFiltroActivo]}
              >
                <Text
                  style={[
                    styles.textoChipFiltro,
                    activo && styles.textoChipFiltroActivo,
                  ]}
                >
                  {op.label} ({op.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {cargando ? (
        <View style={styles.centrado}>
          <ActivityIndicator size="large" color={colores.primario} />
          <Text style={styles.textoVacio}>Cargando tu historial...</Text>
        </View>
      ) : viajesFiltrados.length === 0 ? (
        <View style={styles.centrado}>
          <View style={styles.circuloVacio}>
            <Icono nombre="taxi" size={32} color={colores.primario} />
          </View>
          <Text style={styles.tituloVacio}>
            {filtro === 'todos'
              ? 'Aún no tienes viajes registrados'
              : 'No hay viajes en esta categoría'}
          </Text>
          <Text style={styles.textoVacio}>
            {filtro === 'todos'
              ? 'Tus solicitudes y recorridos aparecerán aquí automáticamente.'
              : 'Prueba seleccionar otro filtro para ver el resto de tus carreras.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.lista,
            { paddingBottom: Math.max(insets.bottom, 24) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {viajesFiltrados.map((v) => {
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
              <View key={v.id} style={[styles.tarjeta, sombras.suave]}>
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

                <RutaVisual origen={origenTxt} destino={destinoTxt} compacto />

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

                {v.estado === 'completado' && v.conductor_id ? (
                  v.calificacion_conductor ? (
                    <Text style={styles.calificado}>
                      Tu calificación: {'★'.repeat(v.calificacion_conductor)} (
                      {v.calificacion_conductor}/5)
                    </Text>
                  ) : (
                    <View style={styles.filaCalificar}>
                      <Text style={styles.textoCalificar}>Calificar conductor:</Text>
                      <View style={styles.estrellas}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Pressable
                            key={n}
                            disabled={calificandoId === v.id}
                            onPress={() => void calificarDesdeHistorial(v, n)}
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
    backgroundColor: colores.superficie,
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
    letterSpacing: -0.3,
  },
  subtitulo: {
    fontSize: 13,
    color: colores.textoSuave,
    marginTop: 2,
  },
  filaFiltros: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  chipFiltro: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radios.pill,
    backgroundColor: colores.superficieSecundaria,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  chipFiltroActivo: {
    backgroundColor: colores.primario,
    borderColor: colores.primario,
  },
  textoChipFiltro: {
    fontSize: 12,
    fontWeight: '600',
    color: colores.textoSecundario,
  },
  textoChipFiltroActivo: {
    color: colores.fondo,
    fontWeight: '700',
  },
  centrado: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  circuloVacio: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colores.primarioSuave,
    borderWidth: 1,
    borderColor: colores.primarioBorde,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  tituloVacio: {
    fontSize: 16,
    fontWeight: '700',
    color: colores.texto,
    marginBottom: 4,
    textAlign: 'center',
  },
  textoVacio: {
    fontSize: 13,
    color: colores.textoSuave,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 19,
  },
  lista: {
    padding: 16,
    gap: 12,
  },
  tarjeta: {
    backgroundColor: colores.fondo,
    borderRadius: radios.lg,
    padding: 15,
    borderWidth: 1,
    borderColor: colores.borde,
  },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radios.pill,
  },
  textoBadge: {
    fontSize: 11,
    fontWeight: '700',
  },
  fecha: {
    fontSize: 12,
    color: colores.textoSuave,
  },
  filaInferior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colores.borde,
  },
  precio: {
    fontSize: 17,
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
