import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  where,
} from 'firebase/firestore';

import {
  TARIFAS_POR_DEFECTO,
  type ConfiguracionTarifas,
  type Coordenadas,
  type OfertaConductor,
  type SolicitudEnProgreso,
  type SolicitudEstado,
  type SolicitudViaje,
} from '../domain/types';
import { db } from './firebaseClient';

const COLECCION_SOLICITUDES = 'solicitudes_viaje';
const COLECCION_OFERTAS = 'ofertas_conductores';
const COLECCION_CONFIGURACION = 'configuracion_plataforma';
const DOC_TARIFAS = 'tarifas';

const TRANSICIONES_PERMITIDAS: Record<SolicitudEstado, SolicitudEnProgreso[]> = {
  buscando: ['aceptado'],
  aceptado: ['en_camino_origen'],
  en_camino_origen: ['en_curso'],
  en_curso: ['completado'],
  completado: [],
  cancelada: [],
};

function normalizarConfiguracionTarifas(
  raw?: Partial<ConfiguracionTarifas> | null,
): ConfiguracionTarifas {
  const tarifaBase = Number(raw?.tarifa_base);
  const precioPorKm = Number(raw?.precio_por_km);
  const tarifaMinima = Number(raw?.tarifa_minima);
  const comision = Number(raw?.comision_porcentaje);

  return {
    tarifa_base:
      Number.isFinite(tarifaBase) && tarifaBase >= 0
        ? tarifaBase
        : TARIFAS_POR_DEFECTO.tarifa_base,
    precio_por_km:
      Number.isFinite(precioPorKm) && precioPorKm >= 0
        ? precioPorKm
        : TARIFAS_POR_DEFECTO.precio_por_km,
    tarifa_minima:
      Number.isFinite(tarifaMinima) && tarifaMinima > 0
        ? tarifaMinima
        : TARIFAS_POR_DEFECTO.tarifa_minima,
    comision_porcentaje:
      Number.isFinite(comision) && comision >= 0 && comision <= 100
        ? comision
        : TARIFAS_POR_DEFECTO.comision_porcentaje,
    updated_at: raw?.updated_at ?? TARIFAS_POR_DEFECTO.updated_at,
    updated_by: raw?.updated_by ?? null,
  };
}

/**
 * Capa de datos del flujo de viajes en tiempo real utilizando Cloud Firestore:
 * solicitudes del pasajero, ofertas de los conductores, transacciones atómicas
 * y suscripciones en tiempo real con onSnapshot.
 */
export const viajesRepository = {
  /**
   * Obtiene los parámetros de tarifas vigentes desde `configuracion_plataforma/tarifas`
   * (o devuelve `TARIFAS_POR_DEFECTO` si aún no se han configurado).
   */
  async obtenerConfiguracionTarifas(): Promise<ConfiguracionTarifas> {
    try {
      const ref = doc(db, COLECCION_CONFIGURACION, DOC_TARIFAS);
      const snap = await getDoc(ref);
      if (!snap.exists()) return TARIFAS_POR_DEFECTO;
      return normalizarConfiguracionTarifas(snap.data() as Partial<ConfiguracionTarifas>);
    } catch {
      return TARIFAS_POR_DEFECTO;
    }
  },

  /**
   * Escucha cambios en tiempo real de `configuracion_plataforma/tarifas`.
   */
  suscribirConfiguracionTarifas(
    callback: (config: ConfiguracionTarifas) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const ref = doc(db, COLECCION_CONFIGURACION, DOC_TARIFAS);
    return onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          callback(TARIFAS_POR_DEFECTO);
          return;
        }
        callback(
          normalizarConfiguracionTarifas(snap.data() as Partial<ConfiguracionTarifas>),
        );
      },
      (error) => {
        console.warn('[viajesRepository] Error en suscribirConfiguracionTarifas:', error);
        onError?.(error);
      },
    );
  },

  /**
   * Publica una solicitud de viaje en `solicitudes_viaje` con estado
   * `buscando` (queda visible para los conductores suscritos).
   */
  async crearSolicitud(
    pasajeroId: string,
    origen: Coordenadas,
    destino: Coordenadas,
    precioInicial: number,
  ): Promise<SolicitudViaje> {
    if (!Number.isFinite(precioInicial) || precioInicial <= 0) {
      throw new Error('El precio inicial debe ser un monto válido mayor a 0.');
    }

    const ahora = new Date().toISOString();
    const data: Omit<SolicitudViaje, 'id'> = {
      pasajero_id: pasajeroId,
      origen_lat: origen.latitude,
      origen_lng: origen.longitude,
      destino_lat: destino.latitude,
      destino_lng: destino.longitude,
      precio_inicial: Math.round(precioInicial * 100) / 100,
      estado: 'buscando',
      conductor_id: null,
      precio_final: null,
      created_at: ahora,
    };

    const docRef = await addDoc(collection(db, COLECCION_SOLICITUDES), data);
    return { id: docRef.id, ...data };
  },

  /**
   * Registra o actualiza de forma atómica la oferta de un conductor para una solicitud.
   * Verifica que la solicitud exista y continúe en estado `buscando`.
   */
  async enviarOferta(
    solicitudId: string,
    conductorId: string,
    precio: number,
  ): Promise<OfertaConductor> {
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error('El precio de la oferta debe ser mayor a 0.');
    }

    const precioRedondeado = Math.round(precio * 100) / 100;
    const solicitudRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    const ofertaId = `${solicitudId}_${conductorId}`;
    const ofertaRef = doc(db, COLECCION_OFERTAS, ofertaId);

    return runTransaction(db, async (transaction) => {
      const solicitudSnap = await transaction.get(solicitudRef);
      if (!solicitudSnap.exists()) {
        throw new Error('La solicitud de viaje ya no existe.');
      }

      const solicitudData = solicitudSnap.data() as Omit<SolicitudViaje, 'id'>;
      if (solicitudData.estado !== 'buscando') {
        throw new Error(
          solicitudData.estado === 'cancelada'
            ? 'El pasajero canceló esta solicitud de viaje.'
            : 'Esta solicitud ya fue tomada por otro conductor.',
        );
      }

      const ahora = new Date().toISOString();
      const data: Omit<OfertaConductor, 'id'> = {
        solicitud_id: solicitudId,
        conductor_id: conductorId,
        precio: precioRedondeado,
        created_at: ahora,
      };

      transaction.set(ofertaRef, data);
      return { id: ofertaId, ...data };
    });
  },

  /**
   * El pasajero acepta la oferta de un conductor de forma atómica (`runTransaction`):
   * - Verifica que la solicitud siga en estado `buscando` (evita doble aceptación o aceptar viaje cancelado).
   * - Verifica que la oferta exista en `ofertas_conductores` y coincida en conductor y precio.
   */
  async aceptarOferta(
    solicitudId: string,
    conductorId: string,
    precioFinal: number,
    ofertaId?: string,
  ): Promise<SolicitudViaje> {
    const solicitudRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    const idOfertaEfectivo = ofertaId || `${solicitudId}_${conductorId}`;
    const ofertaRef = doc(db, COLECCION_OFERTAS, idOfertaEfectivo);

    return runTransaction(db, async (transaction) => {
      const solicitudSnap = await transaction.get(solicitudRef);
      if (!solicitudSnap.exists()) {
        throw new Error('No se encontró la solicitud de viaje.');
      }

      const solicitudActual = solicitudSnap.data() as Omit<SolicitudViaje, 'id'>;
      if (solicitudActual.estado === 'cancelada') {
        throw new Error('No se puede aceptar la oferta porque la solicitud fue cancelada.');
      }
      if (solicitudActual.estado !== 'buscando') {
        throw new Error('Esta solicitud ya cuenta con un conductor asignado.');
      }

      const ofertaSnap = await transaction.get(ofertaRef);
      if (!ofertaSnap.exists()) {
        throw new Error('La oferta seleccionada ya no está disponible.');
      }

      const ofertaData = ofertaSnap.data() as Omit<OfertaConductor, 'id'>;
      if (
        ofertaData.solicitud_id !== solicitudId ||
        ofertaData.conductor_id !== conductorId
      ) {
        throw new Error('La oferta no corresponde a esta solicitud o conductor.');
      }

      const precioOferta = Number(ofertaData.precio);
      if (!Number.isFinite(precioOferta) || precioOferta <= 0) {
        throw new Error('El precio de la oferta es inválido.');
      }
      if (Math.abs(precioOferta - Number(precioFinal)) > 0.001) {
        throw new Error(
          'El precio de la oferta cambió recientemente. Revisa la nueva oferta antes de aceptar.',
        );
      }

      transaction.update(solicitudRef, {
        estado: 'aceptado',
        conductor_id: conductorId,
        precio_final: precioOferta,
      });

      return {
        id: solicitudSnap.id,
        ...solicitudActual,
        estado: 'aceptado',
        conductor_id: conductorId,
        precio_final: precioOferta,
      };
    });
  },

  /**
   * Avanza el ciclo de vida del viaje validando estrictamente la transición de estado
   * dentro de una transacción (`aceptado` -> `en_camino_origen` -> `en_curso` -> `completado`).
   */
  async actualizarEstadoViaje(
    solicitudId: string,
    nuevoEstado: SolicitudEnProgreso,
  ): Promise<SolicitudViaje> {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);

    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('No se encontró la solicitud de viaje.');
      }

      const actual = snap.data() as Omit<SolicitudViaje, 'id'>;
      if (actual.estado === 'cancelada') {
        throw new Error('El viaje fue cancelado y no puede continuar.');
      }
      if (actual.estado === 'completado') {
        throw new Error('El viaje ya fue marcado como completado.');
      }

      const permitidos = TRANSICIONES_PERMITIDAS[actual.estado] ?? [];
      if (!permitidos.includes(nuevoEstado)) {
        throw new Error(
          `Transición de estado no permitida (${actual.estado} → ${nuevoEstado}).`,
        );
      }

      transaction.update(docRef, { estado: nuevoEstado });
      return {
        id: snap.id,
        ...actual,
        estado: nuevoEstado,
      };
    });
  },

  /**
   * Cancela una solicitud de viaje de forma atómica verificando que no haya sido completada.
   */
  async cancelarSolicitud(solicitudId: string): Promise<SolicitudViaje> {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);

    return runTransaction(db, async (transaction) => {
      const snap = await transaction.get(docRef);
      if (!snap.exists()) {
        throw new Error('No se encontró la solicitud de viaje.');
      }

      const actual = snap.data() as Omit<SolicitudViaje, 'id'>;
      if (actual.estado === 'completado') {
        throw new Error('No se puede cancelar un viaje que ya fue completado.');
      }
      if (actual.estado === 'cancelada') {
        return { id: snap.id, ...actual };
      }

      transaction.update(docRef, { estado: 'cancelada' });
      return {
        id: snap.id,
        ...actual,
        estado: 'cancelada',
      };
    });
  },

  /**
   * Escucha en tiempo real la aparición de solicitudes en estado `buscando`.
   * Notifica altas/modificaciones y bajas (cuando una solicitud es cancelada o aceptada).
   */
  suscribirNuevasSolicitudes(
    callback: (solicitud: SolicitudViaje) => void,
    onRemoved?: (solicitudId: string) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(
      collection(db, COLECCION_SOLICITUDES),
      where('estado', '==', 'buscando'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            callback({
              id: change.doc.id,
              ...change.doc.data(),
            } as SolicitudViaje);
          } else if (change.type === 'removed') {
            onRemoved?.(change.doc.id);
          }
        });
      },
      (error) => {
        console.warn('[viajesRepository] Error en suscribirNuevasSolicitudes:', error);
        onError?.(error);
      },
    );

    return unsubscribe;
  },

  /**
   * Escucha en tiempo real las ofertas recibidas para una solicitud (creadas o actualizadas).
   * Devuelve una función para cancelar la suscripción.
   */
  suscribirOfertas(
    solicitudId: string,
    callback: (oferta: OfertaConductor) => void,
    onRemoved?: (ofertaId: string) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const q = query(
      collection(db, COLECCION_OFERTAS),
      where('solicitud_id', '==', solicitudId),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            callback({
              id: change.doc.id,
              ...change.doc.data(),
            } as OfertaConductor);
          } else if (change.type === 'removed') {
            onRemoved?.(change.doc.id);
          }
        });
      },
      (error) => {
        console.warn('[viajesRepository] Error en suscribirOfertas:', error);
        onError?.(error);
      },
    );

    return unsubscribe;
  },

  /**
   * Escucha en tiempo real los cambios de estado de una solicitud.
   * Devuelve una función para cancelar la suscripción.
   */
  suscribirCambiosSolicitud(
    solicitudId: string,
    callback: (solicitud: SolicitudViaje) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    const unsubscribe = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          callback({
            id: snap.id,
            ...snap.data(),
          } as SolicitudViaje);
        }
      },
      (error) => {
        console.warn('[viajesRepository] Error en suscribirCambiosSolicitud:', error);
        onError?.(error);
      },
    );

    return unsubscribe;
  },
};
