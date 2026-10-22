import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { Profile, RiderStatus } from '../domain/types';
import { auth, db } from './firebaseClient';

const COLECCION_PERFILES = 'perfiles';

export const authRepository = {
  /**
   * Registra un nuevo usuario en Firebase Auth y crea su documento en Firestore.
   */
  async registrarConEmail(datos: {
    email: string;
    password: string;
    nombre: string;
    telefono: string;
    rol: Profile['rol'];
    vehiculo?: string | null;
  }): Promise<{ user: User; perfil: Profile }> {
    const cred = await createUserWithEmailAndPassword(
      auth,
      datos.email,
      datos.password,
    );
    const perfil = await this.crearPerfil(cred.user.uid, {
      nombre: datos.nombre,
      telefono: datos.telefono,
      rol: datos.rol,
      vehiculo: datos.vehiculo,
    });
    return { user: cred.user, perfil };
  },

  /**
   * Inicia sesión con correo y contraseña en Firebase Auth.
   */
  async iniciarSesionConEmail(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },

  /**
   * Cierra la sesión activa en Firebase Auth.
   */
  async cerrarSesion(): Promise<void> {
    await signOut(auth);
  },
  /**
   * Obtiene el perfil del usuario autenticado actualmente en Firebase.
   */
  async obtenerPerfilActual(): Promise<Profile | null> {
    const user = auth.currentUser;
    if (!user) return null;
    return this.obtenerPerfil(user.uid);
  },

  /**
   * Obtiene un perfil por su UID de Firebase.
   */
  async obtenerPerfil(usuarioId: string): Promise<Profile | null> {
    const docRef = doc(db, COLECCION_PERFILES, usuarioId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Profile;
  },

  /**
   * Crea o inicializa el documento de perfil en Firestore.
   */
  async crearPerfil(
    usuarioId: string,
    datos: {
      nombre: string;
      telefono: string;
      rol: Profile['rol'];
      vehiculo?: string | null;
    },
  ): Promise<Profile> {
    const ahora = new Date().toISOString();
    const nuevoPerfil: Profile = {
      id: usuarioId,
      rol: datos.rol,
      nombre: datos.nombre,
      telefono: datos.telefono,
      calificacion_promedio: 5.0,
      estado: 'disponible',
      esta_conectado: false,
      ubicacion_actual: null,
      vehiculo: datos.vehiculo ?? null,
      created_at: ahora,
      updated_at: ahora,
    };

    const docRef = doc(db, COLECCION_PERFILES, usuarioId);
    await setDoc(docRef, nuevoPerfil, { merge: true });
    return nuevoPerfil;
  },

  async actualizarVehiculo(vehiculo: string): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const docRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(docRef, { vehiculo, updated_at: ahora });

    const actualizado = await this.obtenerPerfil(user.uid);
    if (!actualizado) throw new Error('No se encontró el perfil.');
    return actualizado;
  },

  async actualizarEstado(estado: RiderStatus): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const docRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(docRef, { estado, updated_at: ahora });

    const actualizado = await this.obtenerPerfil(user.uid);
    if (!actualizado) throw new Error('No se encontró el perfil.');
    return actualizado;
  },

  async actualizarConexion(estaConectado: boolean): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const docRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(docRef, {
      esta_conectado: estaConectado,
      updated_at: ahora,
    });

    const actualizado = await this.obtenerPerfil(user.uid);
    if (!actualizado) throw new Error('No se encontró el perfil.');
    return actualizado;
  },

  async actualizarUbicacion(latitud: number, longitud: number): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const docRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(docRef, {
      ubicacion_actual: `SRID=4326;POINT(${longitud} ${latitud})`,
      updated_at: ahora,
    });
  },
};