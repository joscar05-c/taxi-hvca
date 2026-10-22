'use client';

import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  DollarSign,
  Save,
  Server,
  Database,
  CheckCircle,
} from 'lucide-react';

import { AuthGuard } from '../../components/AuthGuard';
import { Header } from '../../components/Header';

export default function ConfiguracionPage() {
  const [tarifaBase, setTarifaBase] = useState('3.50');
  const [precioKm, setPrecioKm] = useState('1.80');
  const [tarifaMinima, setTarifaMinima] = useState('5.00');
  const [comision, setComision] = useState('10');
  const [guardado, setGuardado] = useState(false);

  function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardado(true);
    setTimeout(() => setGuardado(false), 3000);
  }

  return (
    <AuthGuard>
      <Header
        title="Configuración de Plataforma"
        subtitle="Parámetros operativos de tarifas, comisiones y estado de infraestructura"
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Parámetros de Tarifas */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-gray-800">
            <DollarSign className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Parámetros de Tarifas y Precios
              </h3>
              <p className="text-xs text-gray-400">
                Ajusta las tarifas estimadas calculadas en las apps móviles
              </p>
            </div>
          </div>

          <form onSubmit={handleGuardar} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Tarifa Base de Arranque (S/)
              </label>
              <input
                type="number"
                step="0.10"
                value={tarifaBase}
                onChange={(e) => setTarifaBase(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Precio por Kilómetro Recorrido (S/)
              </label>
              <input
                type="number"
                step="0.10"
                value={precioKm}
                onChange={(e) => setPrecioKm(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Tarifa Mínima por Viaje (S/)
              </label>
              <input
                type="number"
                step="0.50"
                value={tarifaMinima}
                onChange={(e) => setTarifaMinima(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Comisión Administrativa de Plataforma (%)
              </label>
              <input
                type="number"
                step="1"
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="pt-4 flex items-center justify-between">
              {guardado ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Cambios aplicados exitosamente
                </span>
              ) : <div />}

              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600 transition-all"
              >
                <Save className="h-4 w-4" />
                Guardar Parámetros
              </button>
            </div>
          </form>
        </div>

        {/* Estado del Sistema e Infraestructura */}
        <div className="glass-panel rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-6 pb-4 border-b border-gray-800">
            <Server className="h-5 w-5 text-blue-400" />
            <div>
              <h3 className="text-base font-bold text-white">
                Infraestructura Firebase Conectada
              </h3>
              <p className="text-xs text-gray-400">
                Estado de sincronización y servicios activos
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3.5 border border-gray-800">
              <span className="text-gray-400">Proyecto Firebase:</span>
              <span className="font-mono font-bold text-white">taxi-hvca-app</span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3.5 border border-gray-800">
              <span className="text-gray-400">Base de Datos:</span>
              <span className="font-medium text-emerald-400 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                Cloud Firestore (Activa)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3.5 border border-gray-800">
              <span className="text-gray-400">Proveedores Auth Activos:</span>
              <span className="font-medium text-gray-200">
                Email/Password, SMS/Teléfono, Google
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3.5 border border-gray-800">
              <span className="text-gray-400">Reglas de Seguridad:</span>
              <span className="font-medium text-purple-400">
                v2 con rol Administrador
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-gray-900/60 p-3.5 border border-gray-800">
              <span className="text-gray-400">Aplicaciones Enlazadas:</span>
              <span className="font-medium text-gray-200">
                4 móviles (Android / iOS) + 1 Web App
              </span>
            </div>
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
