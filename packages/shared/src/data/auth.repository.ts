import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  PhoneAuthProvider,
  signInWithCredential,
  updatePhoneNumber,
  type ApplicationVerifier,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type { Profile, RiderStatus } from '../domain/types';
import { auth, db } from './firebaseClient';

const COLECCION_PERFILES = 'perfiles';
let cachedRecaptchaSiteKey: string | null = null;

/**
 * Valida un número celular peruano (9 dígitos iniciando en 9, con o sin prefijo +51)
 * y lo devuelve normalizado en formato E.164 estricto (`+519XXXXXXXX`).
 */
export function normalizarTelefonoPeruE164(numeroTelefono: string): string {
  const telLimpio = numeroTelefono.trim().replace(/[\s\-()]+/g, '');
  if (!/^(?:\+?51)?9\d{8}$/.test(telLimpio)) {
    throw new Error(
      'Ingresa un número de celular peruano válido (9 dígitos comenzando con 9).',
    );
  }
  const soloDigitos = telLimpio.replace(/^\+?51/, '');
  return `+51${soloDigitos}`;
}

function traducirErrorPhoneAuth(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  switch (code) {
    case 'auth/invalid-verification-code':
      return 'El código SMS ingresado es incorrecto. Verifica e inténtalo nuevamente.';
    case 'auth/code-expired':
    case 'auth/session-expired':
      return 'El código SMS ha expirado. Solicita un nuevo código.';
    case 'auth/credential-already-in-use':
      return 'Este número de celular ya está vinculado a otra cuenta.';
    case 'auth/requires-recent-login':
      return 'Por seguridad, cierra sesión y vuelve a iniciar sesión antes de cambiar tu número.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos realizados. Espera unos minutos antes de volver a intentarlo.';
    default:
      return error instanceof Error
        ? error.message
        : 'No se pudo validar el código SMS.';
  }
}

function errorRolIncompatible(rolExistente: Profile['rol']): Error {
  const appDestino = rolExistente === 'conductor' ? 'Conductor' : 'Pasajero';
  return new Error(
    `Esta cuenta está registrada como ${rolExistente}. Ingresa desde la aplicación de ${appDestino}.`,
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
   * Inicia sesión con correo y contraseña en Firebase Auth, validando opcionalmente
   * que el rol del perfil coincida con la aplicación actual.
   */
  async iniciarSesionConEmail(
    email: string,
    password: string,
    rolEsperado?: Profile['rol'],
  ): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (rolEsperado) {
      const perfil = await this.obtenerPerfil(cred.user.uid);
      if (perfil && perfil.rol !== rolEsperado) {
        await signOut(auth);
        throw errorRolIncompatible(perfil.rol);
      }
    }
    return cred.user;
  },

  /**
   * Inicia sesión o registra usuario mediante Google Sign-In con su idToken.
   * Impide usar una cuenta de otro rol en la app equivocada.
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
    if (perfil && perfil.rol !== rolPorDefecto) {
      await signOut(auth);
      throw errorRolIncompatible(perfil.rol);
    }

    if (!perfil) {
      perfil = await this.crearPerfil(user.uid, {
        nombre: user.displayName || user.email?.split('@')[0] || 'Usuario',
        telefono: user.phoneNumber || '',
        rol: rolPorDefecto,
        email: user.email,
        foto_url: user.photoURL,
        telefono_verificado: Boolean(user.phoneNumber),
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
      telefono_verificado: Boolean(datos.telefono_verificado),
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
      ...(rolSeguro === 'conductor' ? { estado_documentos: 'pendiente' as const } : {}),
      created_at: ahora,
      updated_at: ahora,
    };

    await setDoc(docRef, nuevoPerfil);
    return nuevoPerfil;
  },

  /**
   * Envía un SMS real mediante Firebase Phone Auth en entorno web (usando RecaptchaVerifier).
   */
  async enviarCodigoSmsWeb(
    numeroTelefono: string,
    appVerifier: ApplicationVerifier,
  ): Promise<{ verificationId: string; telefonoE164: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Debes iniciar sesión para verificar tu teléfono.');

    const telefonoE164 = normalizarTelefonoPeruE164(numeroTelefono);
    const provider = new PhoneAuthProvider(auth);
    try {
      const verificationId = await provider.verifyPhoneNumber(
        telefonoE164,
        appVerifier,
      );
      return { verificationId, telefonoE164 };
    } catch (error) {
      throw new Error(traducirErrorPhoneAuth(error));
    }
  },

  /**
   * Obtiene el siteKey oficial de reCAPTCHA para Firebase Phone Auth
   * desde Google Identity Toolkit y lo guarda en caché en memoria.
   */
  async obtenerRecaptchaSiteKey(): Promise<string> {
    if (cachedRecaptchaSiteKey) {
      return cachedRecaptchaSiteKey;
    }

    const apiKey =
      auth.app.options.apiKey ?? process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '';
    if (!apiKey.trim()) {
      throw new Error(
        'Falta la clave de API de Firebase para iniciar la verificación reCAPTCHA.',
      );
    }

    const respuesta = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getRecaptchaParam?key=${encodeURIComponent(
        apiKey.trim(),
      )}`,
    );
    if (!respuesta.ok) {
      throw new Error(
        'No se pudieron obtener los parámetros de seguridad reCAPTCHA.',
      );
    }

    const datos = (await respuesta.json()) as { recaptchaSiteKey?: unknown };
    if (
      typeof datos.recaptchaSiteKey !== 'string' ||
      !datos.recaptchaSiteKey.trim()
    ) {
      throw new Error(
        'Firebase no devolvió un siteKey reCAPTCHA válido para este proyecto.',
      );
    }

    cachedRecaptchaSiteKey = datos.recaptchaSiteKey.trim();
    return cachedRecaptchaSiteKey;
  },

  /**
   * Envía un SMS real de verificación usando un token reCAPTCHA obtenido
   * dentro de la app (por ejemplo mediante WebView modal in-app).
   */
  async enviarCodigoSmsConTokenRecaptcha(
    numeroTelefono: string,
    recaptchaToken: string,
  ): Promise<{ verificationId: string; telefonoE164: string }> {
    const tokenLimpio = recaptchaToken.trim();
    if (!tokenLimpio) {
      throw new Error('El token de verificación reCAPTCHA está vacío.');
    }

    const appVerifier: ApplicationVerifier = {
      type: 'recaptcha',
      verify: async () => tokenLimpio,
    };

    return this.enviarCodigoSmsWeb(numeroTelefono, appVerifier);
  },

  /**
   * Si Firebase Auth ya tiene un `phoneNumber` vinculado al usuario actual,
   * refresca el token y sincroniza `perfiles/{uid}` con dicho número.
   */
  async sincronizarTelefonoYaVerificadoEnAuth(): Promise<Profile | null> {
    const user = auth.currentUser;
    if (!user || !user.phoneNumber) return null;

    await user.getIdToken(true);
    const perfilDocRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(perfilDocRef, {
      telefono: user.phoneNumber,
      telefono_verificado: true,
      updated_at: ahora,
    });

    return this.obtenerPerfil(user.uid);
  },

  /**
   * Confirma el código SMS de 6 dígitos emitido por Firebase Phone Auth,
   * vincula el número a Firebase Auth (`updatePhoneNumber`), refresca el token JWT
   * y actualiza `perfiles/{uid}` (validado por las reglas con `request.auth.token.phone_number`).
   */
  async confirmarCodigoTelefonoFirebase(
    verificationId: string,
    codigoIngresado: string,
    telefonoE164: string,
  ): Promise<Profile> {
    const user = auth.currentUser;
    if (!user) throw new Error('Sesión no iniciada.');

    const verifLimpio = verificationId.trim();
    if (!verifLimpio) {
      throw new Error(
        'No hay solicitud de verificación activa. Solicita un nuevo código SMS.',
      );
    }

    const codigoLimpio = codigoIngresado.trim();
    if (!/^\d{6}$/.test(codigoLimpio)) {
      throw new Error('El código debe tener 6 dígitos numéricos.');
    }

    const telefonoNormalizado = normalizarTelefonoPeruE164(telefonoE164);
    const credential = PhoneAuthProvider.credential(verifLimpio, codigoLimpio);

    try {
      await updatePhoneNumber(user, credential);
    } catch (error) {
      throw new Error(traducirErrorPhoneAuth(error));
    }

    await user.getIdToken(true);

    const perfilDocRef = doc(db, COLECCION_PERFILES, user.uid);
    const ahora = new Date().toISOString();
    await updateDoc(perfilDocRef, {
      telefono: user.phoneNumber ?? telefonoNormalizado,
      telefono_verificado: true,
      updated_at: ahora,
    });

    const actualizado = await this.obtenerPerfil(user.uid);
    if (!actualizado) {
      throw new Error('No se pudo recuperar el perfil actualizado.');
    }
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
      estado_documentos: 'en_revision',
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