import * as Crypto from 'expo-crypto';
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
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { Profile, RiderStatus, VerificacionTelefono } from '../domain/types';
import { auth, db } from './firebaseClient';

const COLECCION_PERFILES = 'perfiles';
const COLECCION_VERIFICACIONES = 'verificaciones_telefono';
const MAX_INTENTOS_OTP = 5;
const COOLDOWN_REENVIO_MS = 60 * 1000;

function esEntornoDesarrollo(): boolean {
  const g = globalThis as { __DEV__?: boolean; process?: { env?: { NODE_ENV?: string } } };
  if (typeof g.__DEV__ === 'boolean') return g.__DEV__;
  return g.process?.env?.NODE_ENV !== 'production';
}

async function generarCodigoOtpSeguro(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(4);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const numero = view.getUint32(0, false) % 900000;
  return (100000 + numero).toString();
}

async function calcularHashOtp(
  usuarioId: string,
  telefono: string,
  codigo: string,
): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${usuarioId}:${telefono}:${codigo}`,
  );
}

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
      telefono_verificado: false,
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
   * Garantiza que un cliente no pueda sobrescribir su rol ni auto-promoverse.
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
    const rolSeguro: Profile['rol'] =
      datos.rol === 'conductor' ? 'conductor' : 'pasajero';

    const docRef = doc(db, COLECCION_PERFILES, usuarioId);
    const existente = await getDoc(docRef);
    if (existente.exists()) {
      return { id: existente.id, ...existente.data() } as Profile;
    }

    const ahora = new Date().toISOString();
    const nuevoPerfil: Profile = {
      id: usuarioId,
      rol: rolSeguro,
      nombre: datos.nombre,
      telefono: datos.telefono,
      telefono_verificado: datos.telefono_verificado ?? false,
      email: datos.email ?? null,
      foto_url: datos.foto_url ?? null,
      calificacion_promedio: 5.0,
      total_calificaciones: 1,
      estado: 'disponible',
      esta_conectado: false,
      ubicacion_actual: null,
      ubicacion_lat: null,
      ubicacion_lng: null,
      vehiculo: datos.vehiculo ?? null,
      created_at: ahora,
      updated_at: ahora,
    };

    await setDoc(docRef, nuevoPerfil);
    return nuevoPerfil;
  },

  /**
   * Genera y registra un código OTP de 6 dígitos (almacenado como hash SHA-256)
   * para verificar el teléfono del usuario.
   * Solo en desarrollo devuelve `codigoSimuladoParaDev` para pruebas locales.
   */
  async solicitarCodigoVerificacionTelefono(
    numeroTelefono: string,
  ): Promise<{ codigoSimuladoParaDev: string | null; expiraEn: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión para verificar tu teléfono.');

    const telLimpio = numeroTelefono.trim().replace(/[\s\-()]+/g, '');
    if (!/^(?:\+?51)?9\d{8}$/.test(telLimpio)) {
      throw new Error('Ingresa un número de celular peruano válido (9 dígitos comenzando con 9).');
    }

    const verifDocRef = doc(db, COLECCION_VERIFICACIONES, user.uid);
    const verifPrevia = await getDoc(verifDocRef);
    const ahora = new Date();

    if (verifPrevia.exists()) {
      const previaData = verifPrevia.data() as VerificacionTelefono;
      const creadoMs = Date.parse(previaData.created_at);
      if (
        !previaData.verificado &&
        Number.isFinite(creadoMs) &&
        ahora.getTime() - creadoMs < COOLDOWN_REENVIO_MS
      ) {
        const segsRestantes = Math.ceil(
          (COOLDOWN_REENVIO_MS - (ahora.getTime() - creadoMs)) / 1000,
        );
        throw new Error(
          `Por favor espera ${segsRestantes} segundos antes de solicitar un nuevo código.`,
        );
      }
    }

    // Normalizar a formato nacional/internacional
    const soloDigitos = telLimpio.replace(/^\+?51/, '');
    const telNormalizado = `+51 ${soloDigitos}`;

    const esDev = esEntornoDesarrollo();
    const esNumeroPrueba =
      esDev &&
      (soloDigitos === '999999999' ||
        soloDigitos === '987654321' ||
        soloDigitos === '999888777');
    const codigo = esNumeroPrueba
      ? '123456'
      : await generarCodigoOtpSeguro();
    const codigoHash = await calcularHashOtp(user.uid, telNormalizado, codigo);
    const expiraEn = new Date(ahora.getTime() + 10 * 60 * 1000).toISOString(); // 10 min

    await setDoc(verifDocRef, {
      usuario_id: user.uid,
      telefono: telNormalizado,
      codigo_hash: codigoHash,
      expira_en: expiraEn,
      intentos: 0,
      verificado: false,
      created_at: ahora.toISOString(),
    });

    return {
      codigoSimuladoParaDev: esDev ? codigo : null,
      expiraEn,
    };
  },

  /**
   * Confirma el código OTP ingresado por el usuario comparando su hash SHA-256,
   * aplicando límite de intentos (anti fuerza bruta) y marcando el teléfono como verificado.
   */
  async confirmarCodigoTelefono(codigoIngresado: string): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const codigoLimpio = codigoIngresado.trim();
    if (!/^\d{6}$/.test(codigoLimpio)) {
      throw new Error('El código debe tener 6 dígitos numéricos.');
    }

    const verifDocRef = doc(db, COLECCION_VERIFICACIONES, user.uid);
    const verifSnap = await getDoc(verifDocRef);

    if (!verifSnap.exists()) {
      throw new Error('No hay solicitud de código activa. Solicita un nuevo código primero.');
    }

    const data = verifSnap.data() as VerificacionTelefono;
    if (data.verificado) {
      const perfilActual = await this.obtenerPerfil(user.uid);
      if (perfilActual) return perfilActual;
    }

    const intentosActuales = data.intentos ?? 0;
    if (intentosActuales >= MAX_INTENTOS_OTP) {
      throw new Error(
        'Has superado el número máximo de intentos permitidos. Solicita un nuevo código.',
      );
    }

    if (new Date() > new Date(data.expira_en)) {
      throw new Error('El código ha expirado. Por favor solicita uno nuevo.');
    }

    const hashIngresado = await calcularHashOtp(user.uid, data.telefono, codigoLimpio);
    const coincideHash = Boolean(data.codigo_hash && data.codigo_hash === hashIngresado);

    if (!coincideHash) {
      const nuevosIntentos = intentosActuales + 1;
      await updateDoc(verifDocRef, { intentos: nuevosIntentos });
      const restantes = Math.max(0, MAX_INTENTOS_OTP - nuevosIntentos);
      throw new Error(
        restantes > 0
          ? `Código de verificación incorrecto. Te quedan ${restantes} intento(s).`
          : 'Código incorrecto. Has agotado tus intentos; solicita un nuevo código.',
      );
    }

    // Código válido: marcar verificado en Firestore antes de actualizar el perfil
    await updateDoc(verifDocRef, { verificado: true });

    // Actualizar perfil del usuario (las reglas de Firestore verifican que verificado == true)
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

  /**
   * Se suscribe en tiempo real a los cambios de un perfil en Firestore.
   */
  suscribirPerfil(
    usuarioId: string,
    callback: (perfil: Profile | null) => void,
    onError?: (error: Error) => void,
  ): () => void {
    const docRef = doc(db, COLECCION_PERFILES, usuarioId);
    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        callback({ id: snap.id, ...snap.data() } as Profile);
      },
      (error) => {
        console.warn('[authRepository] Error en suscribirPerfil:', error);
        onError?.(error);
      },
    );
  },

  async actualizarDocumentosConductor(datos: {
    vehiculo: string;
    dni_conductor: string;
    licencia_conductor: string;
    soat_conductor: string;
  }): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const docRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(docRef, {
      vehiculo: datos.vehiculo.trim(),
      dni_conductor: datos.dni_conductor.trim(),
      licencia_conductor: datos.licencia_conductor.trim(),
      soat_conductor: datos.soat_conductor.trim(),
      estado_documentos: 'aprobado',
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
      ubicacion_lat: latitud,
      ubicacion_lng: longitud,
      ubicacion_actual: `SRID=4326;POINT(${longitud} ${latitud})`,
      updated_at: ahora,
    });
  },
};