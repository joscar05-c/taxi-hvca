'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import {
  Ban,
  Car,
  CheckCircle2,
  Eye,
  ExternalLink,
  Filter,
  MapPin,
  Search,
  Star,
  X,
} from 'lucide-react';

import { db } from '@/lib/firebase';
import type { Profile, SolicitudEstado, SolicitudViaje } from '@/lib/types';
import { useRealtimeSync } from '@/lib/useRealtimeSync';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';

export default function ViajesPage() {
  const [viajes, setViajes] = useState<SolicitudViaje[]>([]);
  const [perfiles, setPerfiles] = useState<Profile[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [cargando, setCargando] = useState(true);
  const [viajeDetalle, setViajeDetalle] = useState<SolicitudViaje | null>(null);
  const [actualizandoId, setActualizandoId] = useState<string | null>(null);

  const aplicarViajes = useCallback((docs: SolicitudViaje[]) => {
    setViajes(docs);
    setViajeDetalle((actual) => {
      if (!actual) return null;
      return docs.find((d) => d.id === actual.id) ?? actual;
    });
    setCargando(false);
  }, []);

  const refrescarSilencioso = useCallback(async () => {
    const q = query(
      collection(db, 'solicitudes_viaje'),
      orderBy('created_at', 'desc'),
    );
    const [snapViajes, snapPerfiles] = await Promise.all([
      getDocs(q),
      getDocs(collection(db, 'perfiles')),
    ]);

    const docsViajes: SolicitudViaje[] = [];
    snapViajes.forEach((d) =>
      docsViajes.push({ id: d.id, ...d.data() } as SolicitudViaje),
    );
    aplicarViajes(docsViajes);

    const docsPerfiles: Profile[] = [];
    snapPerfiles.forEach((d) =>
      docsPerfiles.push({ id: d.id, ...d.data() } as Profile),
    );
    setPerfiles(docsPerfiles);
  }, [aplicarViajes]);

  useRealtimeSync(refrescarSilencioso);

  useEffect(() => {
    const q = query(
      collection(db, 'solicitudes_viaje'),
      orderBy('created_at', 'desc'),
    );

    const unsubViajes = onSnapshot(q, (snap) => {
      const docs: SolicitudViaje[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as SolicitudViaje));
      aplicarViajes(docs);
    });

    const unsubPerfiles = onSnapshot(collection(db, 'perfiles'), (snap) => {
      const docs: Profile[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as Profile));
      setPerfiles(docs);
    });

    return () => {
      unsubViajes();
      unsubPerfiles();
    };
  }, [aplicarViajes]);

  const perfilesMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of perfiles) {
      map[p.id] = p;
    }
    return map;
  }, [perfiles]);

  async function cambiarEstado(id: string, nuevoEstado: SolicitudEstado) {
    const confirmMsg =
      nuevoEstado === 'cancelada'
        ? '¿Estás seguro de cancelar este viaje como administrador?'
        : `¿Cambiar el estado del viaje a "${nuevoEstado}"?`;

    if (!confirm(confirmMsg)) return;

    setActualizandoId(id);
    try {
      await updateDoc(doc(db, 'solicitudes_viaje', id), {
        estado: nuevoEstado,
      });
    } catch (err: any) {
      alert('Error al actualizar viaje: ' + err.message);
    } finally {
      setActualizandoId(null);
    }
  }

  const viajesFiltrados = viajes.filter((v) => {
    const term = busqueda.trim().toLowerCase();
    const pasajero = perfilesMap[v.pasajero_id];
    const conductor = v.conductor_id ? perfilesMap[v.conductor_id] : undefined;

    const matchBusqueda =
      !term ||
      v.id.toLowerCase().includes(term) ||
      v.pasajero_id.toLowerCase().includes(term) ||
      (v.conductor_id && v.conductor_id.toLowerCase().includes(term)) ||
      (pasajero?.nombre && pasajero.nombre.toLowerCase().includes(term)) ||
      (conductor?.nombre && conductor.nombre.toLowerCase().includes(term)) ||
      (v.origen_direccion && v.origen_direccion.toLowerCase().includes(term)) ||
      (v.destino_direccion && v.destino_direccion.toLowerCase().includes(term));

    const matchEstado = filtroEstado === 'todos' || v.estado === filtroEstado;
    return matchBusqueda && matchEstado;
  });

  const pasajeroDetalle = viajeDetalle
    ? perfilesMap[viajeDetalle.pasajero_id]
    : undefined;
  const conductorDetalle =
    viajeDetalle && viajeDetalle.conductor_id
      ? perfilesMap[viajeDetalle.conductor_id]
      : undefined;

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
            placeholder="Buscar por ID, nombre, dirección..."
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
                  <th className="py-3.5">Ruta y Dirección</th>
                  <th className="py-3.5">Tarifa</th>
                  <th className="py-3.5">Fecha</th>
                  <th className="py-3.5 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {viajesFiltrados.map((v) => {
                  const pasajero = perfilesMap[v.pasajero_id];
                  const conductor = v.conductor_id
                    ? perfilesMap[v.conductor_id]
                    : undefined;
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

                      <td className="py-4">
                        <div className="font-semibold text-white">
                          {pasajero?.nombre ?? `${v.pasajero_id.slice(0, 10)}...`}
                        </div>
                        {pasajero?.telefono ? (
                          <div className="text-[11px] text-gray-400">
                            {pasajero.telefono}
                          </div>
                        ) : null}
                      </td>

                      <td className="py-4 text-gray-300">
                        {v.conductor_id ? (
                          <div>
                            <div className="font-semibold text-blue-300">
                              {conductor?.nombre ?? `${v.conductor_id.slice(0, 10)}...`}
                            </div>
                            {conductor?.vehiculo ? (
                              <div className="text-[11px] text-gray-400">
                                {conductor.vehiculo}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">Buscando...</span>
                        )}
                      </td>

                      <td className="py-4 max-w-xs">
                        {v.origen_direccion || v.destino_direccion ? (
                          <div className="mb-1.5 space-y-0.5 text-[11px]">
                            <p className="truncate text-gray-300">
                              🟢 {v.origen_direccion ?? `${v.origen_lat.toFixed(4)}, ${v.origen_lng.toFixed(4)}`}
                            </p>
                            <p className="truncate text-gray-400">
                              🔴 {v.destino_direccion ?? `${v.destino_lat.toFixed(4)}, ${v.destino_lng.toFixed(4)}`}
                            </p>
                          </div>
                        ) : null}
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
                        {v.calificacion_conductor ? (
                          <div className="mt-1 inline-flex items-center gap-1 text-[10px] text-amber-400">
                            <Star className="h-3 w-3 fill-current" />
                            <span>{v.calificacion_conductor}/5</span>
                          </div>
                        ) : null}
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
                          <button
                            onClick={() => setViajeDetalle(v)}
                            title="Ver Detalle en Vivo"
                            className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-500/20 hover:text-blue-300 transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {v.estado !== 'completado' && v.estado !== 'cancelada' && (
                            <>
                              <button
                                disabled={actualizandoId === v.id}
                                onClick={() => void cambiarEstado(v.id, 'completado')}
                                title="Finalizar Viaje"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-teal-500/20 hover:text-teal-300 transition-colors disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </button>
                              <button
                                disabled={actualizandoId === v.id}
                                onClick={() => void cambiarEstado(v.id, 'cancelada')}
                                title="Cancelar Viaje"
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors disabled:opacity-50"
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

      {/* Modal de Detalle de Viaje en Vivo */}
      {viajeDetalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-xl rounded-3xl p-6 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Car className="h-5 w-5 text-emerald-400" />
                  Detalle de Viaje #{viajeDetalle.id.slice(0, 8)}
                </h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Sincronizado en vivo ·{' '}
                  {new Date(viajeDetalle.created_at).toLocaleString('es-PE')}
                </p>
              </div>
              <button
                onClick={() => setViajeDetalle(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-gray-900/70 p-3.5 border border-gray-800">
                <span className="text-gray-400">Estado Actual:</span>
                <StatusBadge status={viajeDetalle.estado} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-900/70 p-3.5 border border-gray-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Pasajero
                  </p>
                  <p className="font-bold text-white">
                    {pasajeroDetalle?.nombre ?? viajeDetalle.pasajero_id.slice(0, 12)}
                  </p>
                  <p className="text-gray-400 mt-0.5">
                    Tel: {pasajeroDetalle?.telefono || 'No registrado'}
                  </p>
                  {pasajeroDetalle ? (
                    <p className="text-amber-400 mt-1">
                      ★ {pasajeroDetalle.calificacion_promedio.toFixed(1)}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl bg-gray-900/70 p-3.5 border border-gray-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                    Conductor Asignado
                  </p>
                  {viajeDetalle.conductor_id ? (
                    <>
                      <p className="font-bold text-blue-300">
                        {conductorDetalle?.nombre ?? viajeDetalle.conductor_id.slice(0, 12)}
                      </p>
                      <p className="text-gray-400 mt-0.5">
                        {conductorDetalle?.vehiculo || 'Vehículo sin registrar'}
                      </p>
                      <p className="text-gray-400 mt-0.5">
                        Tel: {conductorDetalle?.telefono || 'No registrado'}
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-500 italic">Esperando asignación...</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl bg-gray-900/70 p-3.5 border border-gray-800 space-y-1.5">
                <p className="text-gray-300">
                  🟢 <strong className="text-white">Origen:</strong>{' '}
                  {viajeDetalle.origen_direccion ??
                    `${viajeDetalle.origen_lat.toFixed(5)}, ${viajeDetalle.origen_lng.toFixed(5)}`}
                </p>
                <p className="text-gray-300">
                  🔴 <strong className="text-white">Destino:</strong>{' '}
                  {viajeDetalle.destino_direccion ??
                    `${viajeDetalle.destino_lat.toFixed(5)}, ${viajeDetalle.destino_lng.toFixed(5)}`}
                </p>
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-gray-800/80">
                  <span className="text-gray-400">
                    Distancia:{' '}
                    <strong className="text-white">
                      {viajeDetalle.distancia_km
                        ? `${viajeDetalle.distancia_km.toFixed(2)} km`
                        : '—'}
                    </strong>
                  </span>
                  <span className="text-emerald-400 font-bold text-sm">
                    Tarifa: S/{' '}
                    {(viajeDetalle.precio_final ?? viajeDetalle.precio_inicial).toFixed(2)}
                  </span>
                </div>
              </div>

              {viajeDetalle.calificacion_conductor ||
              viajeDetalle.calificacion_pasajero ? (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 flex flex-wrap gap-4 text-amber-300">
                  {viajeDetalle.calificacion_conductor ? (
                    <span>
                      Calificación al conductor: ★ {viajeDetalle.calificacion_conductor}/5
                    </span>
                  ) : null}
                  {viajeDetalle.calificacion_pasajero ? (
                    <span>
                      Calificación al pasajero: ★ {viajeDetalle.calificacion_pasajero}/5
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="pt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-800">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${viajeDetalle.origen_lat},${viajeDetalle.origen_lng}&destination=${viajeDetalle.destino_lat},${viajeDetalle.destino_lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 px-3.5 py-2 text-xs font-semibold text-emerald-400"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Abrir Ruta en Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {viajeDetalle.estado !== 'completado' &&
                viajeDetalle.estado !== 'cancelada' ? (
                  <div className="flex items-center gap-2">
                    <button
                      disabled={actualizandoId === viajeDetalle.id}
                      onClick={() => void cambiarEstado(viajeDetalle.id, 'completado')}
                      className="rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 px-3.5 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50"
                    >
                      Completar
                    </button>
                    <button
                      disabled={actualizandoId === viajeDetalle.id}
                      onClick={() => void cambiarEstado(viajeDetalle.id, 'cancelada')}
                      className="rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 px-3.5 py-2 text-xs font-bold text-rose-300 disabled:opacity-50"
                    >
                      Cancelar Viaje
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
