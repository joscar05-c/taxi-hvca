import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithCredential,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { Profile, RiderStatus, VerificacionTelefono } from '../domain/types';
import { auth, db } from './firebaseClient';

const COLECCION_PERFILES = 'perfiles';
const COLECCION_VERIFICACIONES = 'verificaciones_telefono';

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
      email: datos.email,
      telefono_verificado: true,
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
   * Inicia sesión o registra usuario mediante Google Sign-In con su idToken.
   */
  async iniciarSesionConGoogle(
    idToken: string,
    rolPorDefecto: Profile['rol'] = 'pasajero',
  ): Promise<{ user: User; perfil: Profile }> {
    const credential = GoogleAuthProvider.credential(idToken);
    const cred = await signInWithCredential(auth, credential);
    const user = cred.user;

    // Verificar si ya tiene perfil en Firestore
    let perfil = await this.obtenerPerfil(user.uid);
    if (!perfil) {
      perfil = await this.crearPerfil(user.uid, {
        nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
        telefono: user.phoneNumber || '',
        rol: rolPorDefecto,
        email: user.email,
        foto_url: user.photoURL,
        telefono_verificado: !!user.phoneNumber,
      });
    }

    return { user, perfil };
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
      email?: string | null;
      foto_url?: string | null;
      telefono_verificado?: boolean;
    },
  ): Promise<Profile> {
    const ahora = new Date().toISOString();
    const nuevoPerfil: Profile = {
      id: usuarioId,
      rol: datos.rol,
      nombre: datos.nombre,
      telefono: datos.telefono,
      telefono_verificado: datos.telefono_verificado ?? (datos.telefono ? true : false),
      email: datos.email ?? null,
      foto_url: datos.foto_url ?? null,
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

  /**
   * Genera y registra un código OTP de 6 dígitos para verificar el teléfono del usuario.
   * En entorno de desarrollo/pruebas, devuelve el código generado para facilitar la validación.
   */
  async solicitarCodigoVerificacionTelefono(
    numeroTelefono: string,
  ): Promise<{ codigoSimuladoParaDev: string; expiraEn: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión para verificar tu teléfono.');

    const telLimpio = numeroTelefono.trim().replace(/[\s\-()]+/g, '');
    if (!/^(?:\+?51)?9\d{8}$/.test(telLimpio)) {
      throw new Error('Ingresa un número de celular peruano válido (9 dígitos comenzando con 9).');
    }

    // Normalizar a formato nacional/internacional
    const soloDigitos = telLimpio.replace(/^\+?51/, '');
    const telNormalizado = `+51 ${soloDigitos}`;

    // Generar código de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + 10 * 60 * 1000).toISOString(); // 10 min

    const verifDocRef = doc(db, COLECCION_VERIFICACIONES, user.uid);
    await setDoc(verifDocRef, {
      usuario_id: user.uid,
      telefono: telNormalizado,
      codigo,
      expira_en: expiraEn,
      intentos: 0,
      verificado: false,
      created_at: ahora.toISOString(),
    });

    return {
      codigoSimuladoParaDev: codigo,
      expiraEn,
    };
  },

  /**
   * Confirma el código OTP ingresado por el usuario y marca el teléfono como verificado.
   */
  async confirmarCodigoTelefono(codigoIngresado: string): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const codigoLimpio = codigoIngresado.trim();
    if (codigoLimpio.length !== 6) {
      throw new Error('El código debe tener 6 dígitos.');
    }

    const verifDocRef = doc(db, COLECCION_VERIFICACIONES, user.uid);
    const verifSnap = await getDoc(verifDocRef);

    if (!verifSnap.exists()) {
      throw new Error('No hay solicitud de código activa. Solicita un nuevo código primero.');
    }

    const data = verifSnap.data() as VerificacionTelefono;
    if (new Date() > new Date(data.expira_en)) {
      throw new Error('El código ha expirado. Por favor solicita uno nuevo.');
    }

    if (data.codigo !== codigoLimpio) {
      await updateDoc(verifDocRef, { intentos: (data.intentos || 0) + 1 });
      throw new Error('Código de verificación incorrecto. Inténtalo nuevamente.');
    }

    // Código válido: marcar verificado en Firestore
    await updateDoc(verifDocRef, { verificado: true });

    // Actualizar perfil del usuario
    const perfilDocRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(perfilDocRef, {
      telefono: data.telefono,
      telefono_verificado: true,
      updated_at: ahora,
    });

    const actualizado = await this.obtenerPerfil(user.uid);
    if (!actualizado) throw new Error('No se pudo recuperar el perfil actualizado.');
    return actualizado;
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