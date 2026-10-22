'use client';

import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { BadgeDollarSign, Search } from 'lucide-react';

import { db } from '@/lib/firebase';
import type { OfertaConductor } from '@/lib/types';
import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<OfertaConductor[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'ofertas_conductores'),
      orderBy('created_at', 'desc'),
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs: OfertaConductor[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as OfertaConductor));
      setOfertas(docs);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  const ofertasFiltradas = ofertas.filter(
    (o) =>
      o.id.includes(busqueda) ||
      o.solicitud_id.includes(busqueda) ||
      o.conductor_id.includes(busqueda),
  );

  return (
    <AuthGuard>
      <Header
        title="Ofertas de Conductores"
        subtitle="Registro de contraofertas y pujas realizadas por conductores para cada solicitud"
      />

      {/* Barra de Búsqueda */}
      <div className="mb-6 glass-panel p-4 rounded-2xl">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por ID de oferta, solicitud o conductor..."
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
                {ofertasFiltradas.map((o) => (
                  <tr
                    key={o.id}
                    className="hover:bg-gray-800/30 transition-colors duration-150"
                  >
                    <td className="py-4 pl-4 font-mono text-[11px] font-bold text-gray-300">
                      #{o.id.slice(0, 10)}...
                    </td>
                    <td className="py-4 font-mono text-xs text-emerald-400 font-medium">
                      Solicitud: #{o.solicitud_id.slice(0, 10)}...
                    </td>
                    <td className="py-4 font-mono text-xs text-blue-400 font-medium">
                      Conductor: #{o.conductor_id.slice(0, 10)}...
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
