'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Car } from 'lucide-react';

import { useAuth } from '../lib/authContext';
import { Sidebar } from './Sidebar';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
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
          Cargando panel administrativo...
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
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
