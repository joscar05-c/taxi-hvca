'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Car, ShieldAlert, LogOut } from 'lucide-react';

import { useAuth } from '../lib/authContext';
import { Sidebar } from './Sidebar';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/admin/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] text-white">
        <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-xl shadow-emerald-500/20">
          <Car className="h-8 w-8 text-white" />
          <Loader2 className="absolute -bottom-2 -right-2 h-6 w-6 animate-spin text-emerald-400" />
        </div>
        <p className="text-sm font-medium text-gray-400 animate-pulse">
          Verificando credenciales de administrador...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Si está autenticado en Firebase pero no tiene rol de administrador
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B0F19] px-4 text-center">
        <div className="glass-panel w-full max-w-md rounded-3xl p-8 border border-rose-500/30 shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-white">Acceso Restringido (403)</h2>
          <p className="mt-2 text-xs text-gray-400">
            La cuenta <span className="font-semibold text-gray-200">{user.email}</span> no cuenta con privilegios de Administrador para gestionar la plataforma Taxi HVCA.
          </p>

          <button
            onClick={() => void logout()}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 hover:bg-rose-500/20 py-2.5 text-xs font-bold text-gray-300 hover:text-rose-400 border border-gray-800 hover:border-rose-500/30 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar Sesión y Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex">
      <Sidebar />
      <main className="ml-72 flex-1 p-8 overflow-y-auto min-h-screen">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
