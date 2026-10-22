'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  const envAdmins = process.env.NEXT_PUBLIC_ADMIN_EMAILS || 'locomancocapac@gmail.com';
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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
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
        const docRef = doc(db, 'perfiles', fbUser.uid);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const perfilData = snap.data() as Profile;
          // Verificación estricta: debe tener rol de admin en la base de datos
          if (perfilData.rol === 'admin') {
            setUser(fbUser);
            setProfile({ ...perfilData, id: snap.id });
          } else {
            // Usuario existe pero es pasajero o conductor: Bloqueo inmediato
            await fbSignOut(auth);
            setUser(null);
            setProfile(null);
            setError(
              `Acceso denegado: La cuenta ${fbUser.email} tiene rol de ${perfilData.rol} y no tiene permisos de administrador.`,
            );
          }
        } else {
          // El perfil no existe aún en Firestore. Solo se permite crear perfil admin
          // si su correo coincide con la lista blanca de administradores iniciales.
          const adminsPermitidos = obtenerListaAdminsPermitidos();
          const esAdminAutorizado = emailUsuario && adminsPermitidos.includes(emailUsuario);

          if (esAdminAutorizado) {
            const nuevoAdmin: Profile = {
              id: fbUser.uid,
              rol: 'admin',
              nombre: fbUser.displayName || emailUsuario.split('@')[0] || 'Administrador',
              telefono: fbUser.phoneNumber || '',
              email: emailUsuario,
              calificacion_promedio: 5.0,
              estado: 'disponible',
              esta_conectado: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await setDoc(docRef, nuevoAdmin);
            setUser(fbUser);
            setProfile(nuevoAdmin);
          } else {
            // Un extraño intentó entrar con su cuenta de Google o Email: Bloqueo inmediato
            await fbSignOut(auth);
            setUser(null);
            setProfile(null);
            setError(
              `Acceso denegado: El correo ${fbUser.email} no está autorizado como administrador de Taxi HVCA.`,
            );
          }
        }
      } catch (err: any) {
        console.error('Error al verificar perfil de administrador:', err);
        await fbSignOut(auth);
        setUser(null);
        setProfile(null);
        setError('Error al verificar autorización de administrador.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
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
