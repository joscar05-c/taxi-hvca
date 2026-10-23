import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

import type {
  Coordenadas,
  OfertaConductor,
  SolicitudEnProgreso,
  SolicitudViaje,
} from '../domain/types';
import { db } from './firebaseClient';

const COLECCION_SOLICITUDES = 'solicitudes_viaje';
const COLECCION_OFERTAS = 'ofertas_conductores';

/**
 * Capa de datos del flujo de viajes en tiempo real utilizando Cloud Firestore:
 * solicitudes del pasajero, ofertas de los conductores y suscripciones en tiempo real con onSnapshot.
 */
export const viajesRepository = {
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
    const ahora = new Date().toISOString();
    const data: Omit<SolicitudViaje, 'id'> = {
      pasajero_id: pasajeroId,
      origen_lat: origen.latitude,
      origen_lng: origen.longitude,
      destino_lat: destino.latitude,
      destino_lng: destino.longitude,
      precio_inicial: precioInicial,
      estado: 'buscando',
      conductor_id: null,
      precio_final: null,
      created_at: ahora,
    };

    const docRef = await addDoc(collection(db, COLECCION_SOLICITUDES), data);
    return { id: docRef.id, ...data };
  },

  /** Registra la oferta de un conductor para una solicitud. */
  async enviarOferta(
    solicitudId: string,
    conductorId: string,
    precio: number,
  ): Promise<OfertaConductor> {
    const ahora = new Date().toISOString();
    const data: Omit<OfertaConductor, 'id'> = {
      solicitud_id: solicitudId,
      conductor_id: conductorId,
      precio,
      created_at: ahora,
    };

    const docRef = await addDoc(collection(db, COLECCION_OFERTAS), data);
    return { id: docRef.id, ...data };
  },

  /** El pasajero acepta la oferta: la solicitud pasa a estado `aceptado`. */
  async aceptarOferta(
    solicitudId: string,
    conductorId: string,
    precioFinal: number,
  ): Promise<SolicitudViaje> {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    await updateDoc(docRef, {
      estado: 'aceptado',
      conductor_id: conductorId,
      precio_final: precioFinal,
    });

    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('No se encontró la solicitud.');
    return { id: snap.id, ...snap.data() } as SolicitudViaje;
  },

  /**
   * Avanza el ciclo de vida del viaje: 'aceptado', 'en_camino_origen',
   * 'en_curso' o 'completado'.
   */
  async actualizarEstadoViaje(
    solicitudId: string,
    nuevoEstado: SolicitudEnProgreso,
  ): Promise<SolicitudViaje> {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    await updateDoc(docRef, { estado: nuevoEstado });

    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('No se encontró la solicitud.');
    return { id: snap.id, ...snap.data() } as SolicitudViaje;
  },

  /**
   * Cancela una solicitud de viaje pasándola a estado `cancelada`.
   */
  async cancelarSolicitud(solicitudId: string): Promise<SolicitudViaje> {
    const docRef = doc(db, COLECCION_SOLICITUDES, solicitudId);
    await updateDoc(docRef, { estado: 'cancelada' });

    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('No se encontró la solicitud.');
    return { id: snap.id, ...snap.data() } as SolicitudViaje;
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