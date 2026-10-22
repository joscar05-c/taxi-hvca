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
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isAdmin: false,
  loading: true,
  signInWithEmail: async () => {},
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const docRef = doc(db, 'perfiles', fbUser.uid);
          const snap = await getDoc(docRef);

          if (snap.exists()) {
            setProfile({ id: snap.id, ...snap.data() } as Profile);
          } else {
            // Inicializar perfil administrativo si entra por primera vez al panel
            const nuevoAdmin: Profile = {
              id: fbUser.uid,
              rol: 'admin',
              nombre: fbUser.displayName || fbUser.email?.split('@')[0] || 'Administrador',
              telefono: fbUser.phoneNumber || '',
              email: fbUser.email || '',
              calificacion_promedio: 5.0,
              estado: 'disponible',
              esta_conectado: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await setDoc(docRef, nuevoAdmin);
            setProfile(nuevoAdmin);
          }
        } catch (err) {
          console.error('Error al cargar perfil de administrador:', err);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function signInWithEmail(email: string, pass: string) {
    await signInWithEmailAndPassword(auth, email, pass);
  }

  async function signInWithGoogle() {
    await signInWithPopup(auth, googleProvider);
  }

  async function logout() {
    await fbSignOut(auth);
  }

  const isAdmin = profile?.rol === 'admin' || (user !== null && profile === null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        loading,
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
