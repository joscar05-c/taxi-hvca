'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle,
  DollarSign,
  Save,
  Server,
} from 'lucide-react';

import { AuthGuard } from '@/components/AuthGuard';
import { Header } from '@/components/Header';
import { useAuth } from '@/lib/authContext';
import { db } from '@/lib/firebase';
import type { ConfiguracionTarifas } from '@/lib/types';
import { useRealtimeSync } from '@/lib/useRealtimeSync';

const COLECCION_CONFIGURACION = 'configuracion_plataforma';
const DOC_TARIFAS = 'tarifas';

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const [tarifaBase, setTarifaBase] = useState('3.50');
  const [precioKm, setPrecioKm] = useState('1.80');
  const [tarifaMinima, setTarifaMinima] = useState('5.00');
  const [comision, setComision] = useState('10');
  const [ultimaActualizacion, setUltimaActualizacion] = useState<string | null>(null);
  const [actualizadoPor, setActualizadoPor] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guardandoRef = useRef(false);

  const aplicarConfig = useCallback((data: Partial<ConfiguracionTarifas>) => {
    if (guardandoRef.current) return;
    if (typeof data.tarifa_base === 'number') {
      setTarifaBase(data.tarifa_base.toFixed(2));
    }
    if (typeof data.precio_por_km === 'number') {
      setPrecioKm(data.precio_por_km.toFixed(2));
    }
    if (typeof data.tarifa_minima === 'number') {
      setTarifaMinima(data.tarifa_minima.toFixed(2));
    }
    if (typeof data.comision_porcentaje === 'number') {
      setComision(String(data.comision_porcentaje));
    }
    setUltimaActualizacion(data.updated_at ?? null);
    setActualizadoPor(data.updated_by ?? null);
  }, []);

  const refrescarSilencioso = useCallback(async () => {
    if (guardandoRef.current) return;
    const snap = await getDoc(doc(db, COLECCION_CONFIGURACION, DOC_TARIFAS));
    if (snap.exists()) {
      aplicarConfig(snap.data() as Partial<ConfiguracionTarifas>);
    }
    setCargando(false);
  }, [aplicarConfig]);

  useRealtimeSync(refrescarSilencioso);

  useEffect(() => {
    const ref = doc(db, COLECCION_CONFIGURACION, DOC_TARIFAS);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          aplicarConfig(snap.data() as Partial<ConfiguracionTarifas>);
        }
        setCargando(false);
      },
      (err) => {
        console.error('Error al leer configuración de tarifas:', err);
        setError('No se pudo sincronizar la configuración desde Firestore.');
        setCargando(false);
      },
    );

    return () => unsub();
  }, [aplicarConfig]);

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardado(false);

    const numBase = parseFloat(tarifaBase);
    const numKm = parseFloat(precioKm);
    const numMinima = parseFloat(tarifaMinima);
    const numComision = parseFloat(comision);

    if (!Number.isFinite(numBase) || numBase < 0) {
      setError('La tarifa base debe ser un número mayor o igual a 0.');
      return;
    }
    if (!Number.isFinite(numKm) || numKm < 0) {
      setError('El precio por kilómetro debe ser mayor o igual a 0.');
      return;
    }
    if (!Number.isFinite(numMinima) || numMinima <= 0) {
      setError('La tarifa mínima por viaje debe ser mayor a 0.');
      return;
    }
    if (!Number.isFinite(numComision) || numComision < 0 || numComision > 100) {
      setError('La comisión debe estar entre 0% y 100%.');
      return;
    }

    setGuardando(true);
    guardandoRef.current = true;
    try {
      const payload: ConfiguracionTarifas = {
        tarifa_base: Math.round(numBase * 100) / 100,
        precio_por_km: Math.round(numKm * 100) / 100,
        tarifa_minima: Math.round(numMinima * 100) / 100,
        comision_porcentaje: Math.round(numComision * 100) / 100,
        updated_at: new Date().toISOString(),
        updated_by: user?.email ?? user?.uid ?? null,
      };

      await setDoc(doc(db, COLECCION_CONFIGURACION, DOC_TARIFAS), payload);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Error al guardar los parámetros en Firestore.');
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
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
                Sincronizados en tiempo real con las apps móviles mediante Firestore
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={(e) => void handleGuardar(e)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Tarifa Base de Arranque (S/)
              </label>
              <input
                type="number"
                step="0.10"
                min="0"
                disabled={cargando || guardando}
                value={tarifaBase}
                onChange={(e) => setTarifaBase(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Precio por Kilómetro Recorrido (S/)
              </label>
              <input
                type="number"
                step="0.10"
                min="0"
                disabled={cargando || guardando}
                value={precioKm}
                onChange={(e) => setPrecioKm(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Tarifa Mínima por Viaje (S/)
              </label>
              <input
                type="number"
                step="0.50"
                min="0.50"
                disabled={cargando || guardando}
                value={tarifaMinima}
                onChange={(e) => setTarifaMinima(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">
                Comisión Administrativa de Plataforma (%)
              </label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                disabled={cargando || guardando}
                value={comision}
                onChange={(e) => setComision(e.target.value)}
                className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none disabled:opacity-50"
              />
            </div>

            {ultimaActualizacion && (
              <p className="text-[11px] text-gray-500">
                Última actualización: {new Date(ultimaActualizacion).toLocaleString('es-PE')}{' '}
                {actualizadoPor ? `por ${actualizadoPor}` : ''}
              </p>
            )}

            <div className="pt-4 flex items-center justify-between">
              {guardado ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                  <CheckCircle className="h-4 w-4" />
                  Cambios guardados en Firestore
                </span>
              ) : <div />}

              <button
                type="submit"
                disabled={cargando || guardando}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {guardando ? 'Guardando...' : 'Guardar Parámetros'}
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
                v2 con rol Administrador y Transacciones
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
