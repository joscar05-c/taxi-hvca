'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  collection,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { BadgeDollarSign, Search, Star } from 'lucide-react';

import { db } from '@/lib/firebase';
import type { OfertaConductor, Profile, SolicitudViaje } from '@/lib/types';
import { useRealtimeSync } from '@/lib/useRealtimeSync';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { StatusBadge } from '@/components/StatusBadge';

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<OfertaConductor[]>([]);
  const [perfiles, setPerfiles] = useState<Profile[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudViaje[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  const refrescarSilencioso = useCallback(async () => {
    const qOfertas = query(
      collection(db, 'ofertas_conductores'),
      orderBy('created_at', 'desc'),
    );
    const [snapOfertas, snapPerfiles, snapViajes] = await Promise.all([
      getDocs(qOfertas),
      getDocs(collection(db, 'perfiles')),
      getDocs(collection(db, 'solicitudes_viaje')),
    ]);

    const docsOfertas: OfertaConductor[] = [];
    snapOfertas.forEach((d) =>
      docsOfertas.push({ id: d.id, ...d.data() } as OfertaConductor),
    );
    setOfertas(docsOfertas);

    const docsPerfiles: Profile[] = [];
    snapPerfiles.forEach((d) =>
      docsPerfiles.push({ id: d.id, ...d.data() } as Profile),
    );
    setPerfiles(docsPerfiles);

    const docsViajes: SolicitudViaje[] = [];
    snapViajes.forEach((d) =>
      docsViajes.push({ id: d.id, ...d.data() } as SolicitudViaje),
    );
    setSolicitudes(docsViajes);
    setCargando(false);
  }, []);

  useRealtimeSync(refrescarSilencioso);

  useEffect(() => {
    const qOfertas = query(
      collection(db, 'ofertas_conductores'),
      orderBy('created_at', 'desc'),
    );

    const unsubOfertas = onSnapshot(qOfertas, (snap) => {
      const docs: OfertaConductor[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as OfertaConductor));
      setOfertas(docs);
      setCargando(false);
    });

    const unsubPerfiles = onSnapshot(collection(db, 'perfiles'), (snap) => {
      const docs: Profile[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as Profile));
      setPerfiles(docs);
    });

    const unsubViajes = onSnapshot(collection(db, 'solicitudes_viaje'), (snap) => {
      const docs: SolicitudViaje[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as SolicitudViaje));
      setSolicitudes(docs);
    });

    return () => {
      unsubOfertas();
      unsubPerfiles();
      unsubViajes();
    };
  }, []);

  const perfilesMap = useMemo(() => {
    const map: Record<string, Profile> = {};
    for (const p of perfiles) map[p.id] = p;
    return map;
  }, [perfiles]);

  const solicitudesMap = useMemo(() => {
    const map: Record<string, SolicitudViaje> = {};
    for (const s of solicitudes) map[s.id] = s;
    return map;
  }, [solicitudes]);

  const ofertasFiltradas = ofertas.filter((o) => {
    const term = busqueda.trim().toLowerCase();
    if (!term) return true;
    const cond = perfilesMap[o.conductor_id];
    const nombreCond = (cond?.nombre ?? o.conductor_nombre ?? '').toLowerCase();
    const vehiculoCond = (cond?.vehiculo ?? o.conductor_vehiculo ?? '').toLowerCase();
    return (
      o.id.toLowerCase().includes(term) ||
      o.solicitud_id.toLowerCase().includes(term) ||
      o.conductor_id.toLowerCase().includes(term) ||
      nombreCond.includes(term) ||
      vehiculoCond.includes(term)
    );
  });

  return (
    <AuthGuard>
      <Header
        title="Ofertas de Conductores"
        subtitle="Registro en tiempo real de contraofertas y pujas realizadas por conductores"
      />

      {/* Barra de Búsqueda */}
      <div className="mb-6 glass-panel p-4 rounded-2xl">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID, conductor o vehículo..."
            className="w-full rounded-xl bg-gray-900/80 border border-gray-800 pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Tabla de Ofertas */}
      <div className="glass-panel rounded-2xl overflow-hidden p-1">
        {cargando ? (
          <div className="py-16 text-center text-xs text-gray-400 animate-pulse">
            Cargando ofertas de conductores...
          </div>
        ) : ofertasFiltradas.length === 0 ? (
          <div className="py-16 text-center">
            <BadgeDollarSign className="mx-auto h-10 w-10 text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">
              No hay ofertas de conductores registradas aún
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Aparecerán cuando los conductores envíen ofertas de precio a los pasajeros
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 pl-4">ID Oferta</th>
                  <th className="py-3.5">Solicitud Asociada</th>
                  <th className="py-3.5">Conductor Ofertante</th>
                  <th className="py-3.5">Precio Propuesto</th>
                  <th className="py-3.5 text-right pr-4">Fecha y Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {ofertasFiltradas.map((o) => {
                  const perfilCond = perfilesMap[o.conductor_id];
                  const sol = solicitudesMap[o.solicitud_id];
                  const nombreCond =
                    perfilCond?.nombre ??
                    o.conductor_nombre ??
                    `Conductor #${o.conductor_id.slice(0, 8)}`;
                  const vehiculoCond =
                    perfilCond?.vehiculo ?? o.conductor_vehiculo ?? null;
                  const ratingCond =
                    perfilCond?.calificacion_promedio ?? o.conductor_calificacion;

                  return (
                    <tr
                      key={o.id}
                      className="hover:bg-gray-800/30 transition-colors duration-150"
                    >
                      <td className="py-4 pl-4 font-mono text-[11px] font-bold text-gray-300">
                        #{o.id.slice(0, 10)}...
                      </td>
                      <td className="py-4">
                        <div className="font-mono text-xs text-emerald-400 font-medium">
                          #{o.solicitud_id.slice(0, 10)}...
                        </div>
                        {sol ? (
                          <div className="mt-1">
                            <StatusBadge status={sol.estado} />
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4">
                        <div className="flex items-center gap-2 font-semibold text-white">
                          <span>{nombreCond}</span>
                          {typeof ratingCond === 'number' ? (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-amber-400">
                              <Star className="h-3 w-3 fill-current" />
                              {ratingCond.toFixed(1)}
                            </span>
                          ) : null}
                        </div>
                        {vehiculoCond ? (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            {vehiculoCond}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-4">
                        <span className="font-bold text-white text-sm bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          S/ {o.precio.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-4 text-right pr-4 text-gray-400">
                        {new Date(o.created_at).toLocaleString('es-PE', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
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
