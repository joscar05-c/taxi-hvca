import React from 'react';
import type { SolicitudEstado, UserRole } from '../lib/types';

interface StatusBadgeProps {
  status?: SolicitudEstado;
  role?: UserRole;
  isOnline?: boolean;
}

export function StatusBadge({ status, role, isOnline }: StatusBadgeProps) {
  if (isOnline !== undefined) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isOnline
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-gray-700/30 text-gray-400 border border-gray-700/50'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
          }`}
        />
        {isOnline ? 'En línea' : 'Desconectado'}
      </span>
    );
  }

  if (role) {
    const config = {
      admin: {
        label: 'Administrador',
        bg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      },
      conductor: {
        label: 'Conductor',
        bg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
      },
      pasajero: {
        label: 'Pasajero',
        bg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      },
    }[role];

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.bg}`}
      >
        {config.label}
      </span>
    );
  }

  if (status) {
    const statusMap: Record<
      SolicitudEstado,
      { label: string; bg: string; dot: string }
    > = {
      buscando: {
        label: 'Buscando Taxi',
        bg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400 animate-ping',
      },
      aceptado: {
        label: 'Aceptado',
        bg: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        dot: 'bg-blue-400',
      },
      en_camino_origen: {
        label: 'En camino a recogida',
        bg: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
        dot: 'bg-indigo-400',
      },
      en_curso: {
        label: 'En viaje',
        bg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400 animate-pulse',
      },
      completado: {
        label: 'Completado',
        bg: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
        dot: 'bg-teal-400',
      },
      cancelada: {
        label: 'Cancelado',
        bg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        dot: 'bg-rose-400',
      },
    };

    const cfg = statusMap[status] ?? {
      label: status,
      bg: 'bg-gray-700/30 text-gray-300 border-gray-600',
      dot: 'bg-gray-400',
    };

    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }

  return null;
}
