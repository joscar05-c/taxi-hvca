'use client';

import React, { useEffect, useState } from 'react';
import { Clock, ShieldAlert, Sparkles } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export function Header({ title, subtitle, actionButton }: HeaderProps) {
  const [hora, setHora] = useState('');

  useEffect(() => {
    function actualizarHora() {
      const ahora = new Date();
      setHora(
        ahora.toLocaleTimeString('es-PE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }),
      );
    }
    actualizarHora();
    const interval = setInterval(actualizarHora, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2.5">
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
            <Sparkles className="h-3 w-3" />
            En Vivo
          </span>
        </div>
        {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {hora && (
          <div className="hidden md:flex items-center gap-2 rounded-xl bg-gray-900/80 px-3 py-2 text-xs font-medium text-gray-300 border border-gray-800">
            <Clock className="h-3.5 w-3.5 text-gray-400" />
            <span>{hora}</span>
          </div>
        )}

        {actionButton}
      </div>
    </header>
  );
}
