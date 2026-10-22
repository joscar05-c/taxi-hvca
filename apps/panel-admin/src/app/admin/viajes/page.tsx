'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  Car,
  Search,
  Filter,
  MapPin,
  ExternalLink,
  Ban,
  CheckCircle2,
} from 'lucide-react';

import { db } from '@/lib/firebase';
import type { SolicitudViaje, SolicitudEstado } from '@/lib/types';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';

export default function ViajesPage() {
  const [viajes, setViajes] = useState<SolicitudViaje[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'solicitudes_viaje'),
      orderBy('created_at', 'desc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs: SolicitudViaje[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as SolicitudViaje));
      setViajes(docs);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  async function cambiarEstado(id: string, nuevoEstado: SolicitudEstado) {
    const confirmMsg =
      nuevoEstado === 'cancelada'
        ? '¿Estás seguro de cancelar este viaje como administrador?'
        : `¿Cambiar el estado del viaje a "${nuevoEstado}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      await updateDoc(doc(db, 'solicitudes_viaje', id), {
        estado: nuevoEstado,
      });
    } catch (err: any) {
      alert('Error al actualizar viaje: ' + err.message);
    }
  }

  const viajesFiltrados = viajes.filter((v) => {
    const matchBusqueda =
      v.id.includes(busqueda) ||
      v.pasajero_id.includes(busqueda) ||
      (v.conductor_id && v.conductor_id.includes(busqueda));

    const matchEstado = filtroEstado === 'todos' || v.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  return (
    <AuthGuard>
      <Header
        title="Gestión de Viajes"
        subtitle="Supervisión en vivo de todas las solicitudes, viajes en curso y finalizados"
      />

      {/* Barra de Filtros */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass-panel p-4 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID de viaje, pasajero o conductor..."
            className="w-full rounded-xl bg-gray-900/80 border border-gray-800 pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 rounded-xl px-3 py-1.5">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            className="bg-transparent text-xs text-gray-200 focus:outline-none cursor-pointer"
          >
            <option value="todos" className="bg-gray-900">Todos los estados</option>
            <option value="buscando" className="bg-gray-900">Buscando Taxi</option>
            <option value="aceptado" className="bg-gray-900">Aceptado</option>
            <option value="en_camino_origen" className="bg-gray-900">En camino a recogida</option>
            <option value="en_curso" className="bg-gray-900">En viaje</option>
            <option value="completado" className="bg-gray-900">Completados</option>
            <option value="cancelada" className="bg-gray-900">Cancelados</option>
          </select>
        </div>
      </div>

      {/* Tabla de Viajes */}
      <div className="glass-panel rounded-2xl overflow-hidden p-1">
        {cargando ? (
          <div className="py-16 text-center text-xs text-gray-400 animate-pulse">
            Sincronizando viajes con Firestore...
          </div>
        ) : viajesFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <Car className="mx-auto h-10 w-10 text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">
              No hay viajes que coincidan con los criterios
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 pl-4">ID / Estado</th>
                  <th className="py-3.5">Pasajero</th>
                  <th className="py-3.5">Conductor</th>
                  <th className="py-3.5">Ruta (Coords)</th>
                  <th className="py-3.5">Tarifa</th>
                  <th className="py-3.5">Fecha</th>
                  <th className="py-3.5 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {viajesFiltrados.map((v) => {
                  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${v.origen_lat},${v.origen_lng}&destination=${v.destino_lat},${v.destino_lng}`;

                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-gray-800/30 transition-colors duration-150"
                    >
                      <td className="py-4 pl-4">
                        <div className="font-mono text-[11px] font-bold text-gray-300">
                          #{v.id.slice(0, 8)}
                        </div>
                        <div className="mt-1">
                          <StatusBadge status={v.estado} />
                        </div>
                      </td>

                      <td className="py-4 font-medium text-white">
                        <span className="font-mono text-xs text-gray-300">
                          {v.pasajero_id.slice(0, 10)}...
                        </span>
                      </td>

                      <td className="py-4 text-gray-300">
                        {v.conductor_id ? (
                          <span className="font-mono text-xs text-blue-400 font-medium">
                            {v.conductor_id.slice(0, 10)}...
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Buscando...</span>
                        )}
                      </td>

                      <td className="py-4">
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900/80 hover:bg-emerald-500/10 px-2.5 py-1 text-gray-300 hover:text-emerald-400 border border-gray-800 hover:border-emerald-500/30 transition-colors text-[11px]"
                        >
                          <MapPin className="h-3 w-3 text-emerald-400" />
                          <span>Ver en Maps</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>

                      <td className="py-4">
                        <div className="font-bold text-white text-sm">
                          S/ {(v.precio_final ?? v.precio_inicial).toFixed(2)}
                        </div>
                        {v.precio_final && v.precio_final !== v.precio_inicial && (
                          <div className="text-[10px] text-gray-400">
                            Inicial: S/ {v.precio_inicial.toFixed(2)}
                          </div>
                        )}
                      </td>

                      <td className="py-4 text-gray-400">
                        <div>
                          {new Date(v.created_at).toLocaleDateString('es-PE')}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(v.created_at).toLocaleTimeString('es-PE', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      <td className="py-4 text-right pr-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {v.estado !== 'completado' && v.estado !== 'cancelada' && (
                            <>
                              <button
                                onClick={() => void cambiarEstado(v.id, 'completado')}
                                title="Finalizar Viaje"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-teal-500/20 hover:text-teal-300 transition-colors"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => void cambiarEstado(v.id, 'cancelada')}
                                title="Cancelar Viaje"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                              >
                                <Ban className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
