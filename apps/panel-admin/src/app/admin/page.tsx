'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  updateDoc,
  doc,
} from 'firebase/firestore';
import {
  Car,
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  MapPin,
  ExternalLink,
  Ban,
  Activity,
} from 'lucide-react';

import { db } from '@/lib/firebase';
import type { Profile, SolicitudViaje } from '@/lib/types';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { StatCard } from '@/components/StatCard';
import { StatusBadge } from '@/components/StatusBadge';

export default function DashboardAdminPage() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudViaje[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // 1. Escucha en tiempo real de todos los perfiles
    const unsubPerfiles = onSnapshot(collection(db, 'perfiles'), (snap) => {
      const docs: Profile[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as Profile));
      setUsuarios(docs);
    });

    // 2. Escucha en tiempo real de solicitudes de viaje
    const qViajes = query(
      collection(db, 'solicitudes_viaje'),
      orderBy('created_at', 'desc'),
      limit(25),
    );

    const unsubViajes = onSnapshot(qViajes, (snap) => {
      const docs: SolicitudViaje[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as SolicitudViaje));
      setSolicitudes(docs);
      setCargando(false);
    });

    return () => {
      unsubPerfiles();
      unsubViajes();
    };
  }, []);

  // Métricas calculadas en tiempo real
  const totalConductores = usuarios.filter((u) => u.rol === 'conductor').length;
  const conductoresEnLinea = usuarios.filter(
    (u) => u.rol === 'conductor' && u.esta_conectado,
  ).length;
  const totalPasajeros = usuarios.filter((u) => u.rol === 'pasajero').length;

  const viajesActivos = solicitudes.filter(
    (s) =>
      s.estado === 'buscando' ||
      s.estado === 'aceptado' ||
      s.estado === 'en_camino_origen' ||
      s.estado === 'en_curso',
  ).length;

  const viajesCompletados = solicitudes.filter((s) => s.estado === 'completado').length;

  const volumenEstimado = solicitudes
    .filter((s) => s.estado === 'completado' && s.precio_final)
    .reduce((acc, curr) => acc + (curr.precio_final || 0), 0);

  async function cancelarViaje(id: string) {
    if (!confirm('¿Seguro que deseas cancelar este viaje como administrador?')) return;
    try {
      await updateDoc(doc(db, 'solicitudes_viaje', id), { estado: 'cancelada' });
    } catch (e: any) {
      alert('Error al cancelar: ' + e.message);
    }
  }

  return (
    <AuthGuard>
      <Header
        title="Panel General"
        subtitle="Monitoreo operativo y métricas de la plataforma en tiempo real"
      />

      {/* Grid de Métricas Principales */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          title="Viajes en Curso / Activos"
          value={viajesActivos}
          icon={<Activity className="h-6 w-6 text-emerald-400" />}
          change={viajesActivos > 0 ? 'En movimiento' : 'Sin viajes activos'}
          trend={viajesActivos > 0 ? 'up' : 'neutral'}
          subtext="Actualizado en vivo"
          accentColor="from-emerald-500/20 to-teal-500/5"
        />

        <StatCard
          title="Conductores Conectados"
          value={`${conductoresEnLinea} / ${totalConductores}`}
          icon={<Car className="h-6 w-6 text-blue-400" />}
          change={`${
            totalConductores > 0
              ? Math.round((conductoresEnLinea / totalConductores) * 100)
              : 0
          }% activos`}
          trend="up"
          subtext="Disponibles en mapa"
          accentColor="from-blue-500/20 to-indigo-500/5"
        />

        <StatCard
          title="Pasajeros Registrados"
          value={totalPasajeros}
          icon={<Users className="h-6 w-6 text-amber-400" />}
          change="+100% Retención"
          subtext="Comunidad activa"
          accentColor="from-amber-500/20 to-orange-500/5"
        />

        <StatCard
          title="Viajes Completados"
          value={viajesCompletados}
          icon={<CheckCircle2 className="h-6 w-6 text-teal-400" />}
          change={`S/ ${volumenEstimado.toFixed(2)}`}
          trend="up"
          subtext="Volumen completado"
          accentColor="from-teal-500/20 to-cyan-500/5"
        />
      </div>

      {/* Tablas / Paneles de Actividad */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Viajes Recientes en Tiempo Real */}
        <div className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Car className="h-5 w-5 text-emerald-400" />
                Flujo de Viajes en Tiempo Real
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Solicitudes creadas y monitoreadas vía Firestore
              </p>
            </div>

            <Link
              href="/admin/viajes"
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Ver todos ({solicitudes.length})
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {cargando ? (
            <div className="py-12 text-center text-xs text-gray-400 animate-pulse">
              Cargando viajes en vivo...
            </div>
          ) : solicitudes.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-gray-900/40 border border-gray-800/80">
              <Car className="mx-auto h-8 w-8 text-gray-600 mb-2" />
              <p className="text-sm font-medium text-gray-300">
                Aún no hay solicitudes de viaje registradas
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Aparecerán aquí automáticamente tan pronto un pasajero pida un viaje
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="pb-3 pl-2">Estado</th>
                    <th className="pb-3">Pasajero / Conductor</th>
                    <th className="pb-3">Precio Estimado</th>
                    <th className="pb-3">Fecha y Hora</th>
                    <th className="pb-3 text-right pr-2">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/60">
                  {solicitudes.slice(0, 8).map((sol) => (
                    <tr
                      key={sol.id}
                      className="hover:bg-gray-800/40 transition-colors duration-150"
                    >
                      <td className="py-3.5 pl-2">
                        <StatusBadge status={sol.estado} />
                      </td>
                      <td className="py-3.5">
                        <div className="font-medium text-gray-200">
                          Pasajero: {sol.pasajero_id.slice(0, 8)}...
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {sol.conductor_id
                            ? `Conductor: ${sol.conductor_id.slice(0, 8)}...`
                            : 'Sin conductor aún'}
                        </div>
                      </td>
                      <td className="py-3.5">
                        <span className="font-bold text-white text-sm">
                          S/ {(sol.precio_final ?? sol.precio_inicial).toFixed(2)}
                        </span>
                        {sol.precio_final && sol.precio_final !== sol.precio_inicial && (
                          <span className="ml-1 text-[10px] text-gray-400 line-through">
                            S/ {sol.precio_inicial.toFixed(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 text-gray-400">
                        {new Date(sol.created_at).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 text-right pr-2">
                        {sol.estado !== 'completado' && sol.estado !== 'cancelada' && (
                          <button
                            onClick={() => void cancelarViaje(sol.id)}
                            title="Cancelar Viaje"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors"
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Conductores Conectados Recientes */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-400" />
                Conductores Activos
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Estado y vehículo en servicio
              </p>
            </div>

            <Link
              href="/admin/usuarios"
              className="text-xs font-semibold text-blue-400 hover:text-blue-300"
            >
              Ver todos
            </Link>
          </div>

          {usuarios.filter((u) => u.rol === 'conductor').length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-gray-900/40 border border-gray-800/80">
              <Users className="mx-auto h-8 w-8 text-gray-600 mb-2" />
              <p className="text-xs text-gray-400">No hay conductores registrados</p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {usuarios
                .filter((u) => u.rol === 'conductor')
                .slice(0, 6)
                .map((cond) => (
                  <div
                    key={cond.id}
                    className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3 border border-gray-800/70"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-blue-400 font-bold text-xs border border-blue-500/30">
                        {cond.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{cond.nombre}</p>
                        <p className="text-[11px] text-gray-400">
                          {cond.vehiculo || 'Sin vehículo registrado'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <StatusBadge isOnline={cond.esta_conectado} />
                      <div className="mt-1 text-[10px] text-amber-400">
                        ★ {cond.calificacion_promedio.toFixed(1)}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
