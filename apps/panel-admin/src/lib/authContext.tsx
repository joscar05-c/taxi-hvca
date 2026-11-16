'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

import { auth, db, googleProvider } from './firebase';
import type { Profile } from './types';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  error: null,
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
});

function obtenerListaAdminsPermitidos(): string[] {
  const envAdmins =
    process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'locomancocapac@gmail.com';
  return envAdmins
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    let unsubPerfil: (() => void) | null = null;
    let cleanupFocusListeners: (() => void) | null = null;

    function limpiarSuscripcionesUsuario() {
      if (unsubPerfil) {
        unsubPerfil();
        unsubPerfil = null;
      }
      if (cleanupFocusListeners) {
        cleanupFocusListeners();
        cleanupFocusListeners = null;
      }
    }

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!activo) return;
      limpiarSuscripcionesUsuario();
      setLoading(true);
      setError(null);

      if (!fbUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      const emailUsuario = fbUser.email?.trim().toLowerCase() || '';

      try {
        const tokenResult = await fbUser.getIdTokenResult();
        if (!activo) return;
        const tieneClaimAdmin = tokenResult.claims.admin === true;
        const docRef = doc(db, 'perfiles', fbUser.uid);
        let bootstrapEnCurso = false;

        const procesarSnapshot = async (
          snapData: Profile | null,
          docId: string,
        ) => {
          if (!activo) return;

          if (snapData) {
            if (snapData.rol === 'admin' || tieneClaimAdmin) {
              setUser(fbUser);
              setProfile({ ...snapData, id: docId, rol: 'admin' });
              setLoading(false);
            } else {
              limpiarSuscripcionesUsuario();
              await fbSignOut(auth);
              if (!activo) return;
              setUser(null);
              setProfile(null);
              setError(
                `Acceso denegado: La cuenta ${fbUser.email} tiene rol de ${snapData.rol} y no tiene permisos de administrador.`,
              );
              setLoading(false);
            }
            return;
          }

          if (bootstrapEnCurso) return;
          const adminsPermitidos = obtenerListaAdminsPermitidos();
          const esAdminAutorizado =
            tieneClaimAdmin ||
            (Boolean(emailUsuario) && adminsPermitidos.includes(emailUsuario));

          if (esAdminAutorizado) {
            bootstrapEnCurso = true;
            const ahora = new Date().toISOString();
            const nuevoAdmin: Profile = {
              id: fbUser.uid,
              rol: 'admin',
              nombre:
                fbUser.displayName || emailUsuario.split('@')[0] || 'Administrador',
              telefono: fbUser.phoneNumber || '',
              email: emailUsuario,
              calificacion_promedio: 5.0,
              estado: 'disponible',
              esta_conectado: true,
              created_at: ahora,
              updated_at: ahora,
            };
            await setDoc(docRef, nuevoAdmin);
            if (!activo) return;
            setUser(fbUser);
            setProfile(nuevoAdmin);
            setLoading(false);
          } else {
            limpiarSuscripcionesUsuario();
            await fbSignOut(auth);
            if (!activo) return;
            setUser(null);
            setProfile(null);
            setError(
              `Acceso denegado: El correo ${fbUser.email} no está autorizado como administrador de Taxi HVCA.`,
            );
            setLoading(false);
          }
        };

        unsubPerfil = onSnapshot(
          docRef,
          (snap) => {
            void procesarSnapshot(
              snap.exists() ? (snap.data() as Profile) : null,
              snap.id,
            ).catch((err) => {
              console.error('Error al procesar snapshot admin:', err);
              setLoading(false);
            });
          },
          async (err) => {
            console.error('Error en suscripción de perfil admin:', err);
            limpiarSuscripcionesUsuario();
            await fbSignOut(auth);
            if (!activo) return;
            setUser(null);
            setProfile(null);
            setError('Error al verificar autorización de administrador.');
            setLoading(false);
          },
        );

        const refrescarSilencioso = () => {
          if (!activo || document.visibilityState === 'hidden') return;
          void getDoc(docRef)
            .then((snap) =>
              procesarSnapshot(
                snap.exists() ? (snap.data() as Profile) : null,
                snap.id,
              ),
            )
            .catch(() => undefined);
        };

        window.addEventListener('focus', refrescarSilencioso);
        document.addEventListener('visibilitychange', refrescarSilencioso);
        cleanupFocusListeners = () => {
          window.removeEventListener('focus', refrescarSilencioso);
          document.removeEventListener('visibilitychange', refrescarSilencioso);
        };
      } catch (err: any) {
        console.error('Error al verificar perfil de administrador:', err);
        await fbSignOut(auth);
        if (!activo) return;
        setUser(null);
        setProfile(null);
        setError('Error al verificar autorización de administrador.');
        setLoading(false);
      }
    });

    return () => {
      activo = false;
      limpiarSuscripcionesUsuario();
      unsubscribeAuth();
    };
  }, []);

  async function signInWithEmail(email: string, pass: string) {
    setError(null);
    await signInWithEmailAndPassword(auth, email, pass);
  }

  async function signInWithGoogle() {
    setError(null);
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    setError(null);
    await fbSignOut(auth);
  }

  const isAdmin = profile?.rol === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
        error,
        signInWithEmail,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
