'use client';

import React, { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
} from 'firebase/firestore';
import {
  Users,
  Search,
  Filter,
  Shield,
  Car,
  Phone,
  Star,
  CheckCircle,
  XCircle,
  Edit2,
  Save,
  X,
} from 'lucide-react';

import { db } from '../../lib/firebase';
import type { Profile, UserRole } from '../../lib/types';
import { AuthGuard } from '../../components/AuthGuard';
import { Header } from '../../components/Header';
import { StatusBadge } from '../../components/StatusBadge';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<Profile[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('todos');
  const [filtroConexion, setFiltroConexion] = useState<string>('todos');
  const [cargando, setCargando] = useState(true);

  // Modal para edición rápida de usuario
  const [usuarioEditar, setUsuarioEditar] = useState<Profile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editTelefono, setEditTelefono] = useState('');
  const [editVehiculo, setEditVehiculo] = useState('');
  const [editRol, setEditRol] = useState<UserRole>('pasajero');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'perfiles'), (snap) => {
      const docs: Profile[] = [];
      snap.forEach((d) => docs.push({ id: d.id, ...d.data() } as Profile));
      setUsuarios(docs);
      setCargando(false);
    });

    return () => unsub();
  }, []);

  function abrirEdicion(u: Profile) {
    setUsuarioEditar(u);
    setEditNombre(u.nombre);
    setEditTelefono(u.telefono);
    setEditVehiculo(u.vehiculo || '');
    setEditRol(u.rol);
  }

  async function guardarEdicion(e: React.FormEvent) {
    e.preventDefault();
    if (!usuarioEditar) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, 'perfiles', usuarioEditar.id), {
        nombre: editNombre.trim(),
        telefono: editTelefono.trim(),
        vehiculo: editVehiculo.trim() || null,
        rol: editRol,
        updated_at: new Date().toISOString(),
      });
      setUsuarioEditar(null);
    } catch (err: any) {
      alert('Error al actualizar usuario: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleConexion(u: Profile) {
    try {
      await updateDoc(doc(db, 'perfiles', u.id), {
        esta_conectado: !u.esta_conectado,
        updated_at: new Date().toISOString(),
      });
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  }

  const usuariosFiltrados = usuarios.filter((u) => {
    const matchBusqueda =
      u.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      u.telefono.includes(busqueda) ||
      (u.vehiculo && u.vehiculo.toLowerCase().includes(busqueda.toLowerCase())) ||
      u.id.includes(busqueda);

    const matchRol = filtroRol === 'todos' || u.rol === filtroRol;
    const matchConexion =
      filtroConexion === 'todos' ||
      (filtroConexion === 'online' && u.esta_conectado) ||
      (filtroConexion === 'offline' && !u.esta_conectado);

    return matchBusqueda && matchRol && matchConexion;
  });

  return (
    <AuthGuard>
      <Header
        title="Usuarios y Perfiles"
        subtitle="Administra pasajeros, conductores registrados y personal administrativo"
      />

      {/* Barra de Filtros y Búsqueda */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass-panel p-4 rounded-2xl">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-gray-500" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, teléfono, auto o ID..."
            className="w-full rounded-xl bg-gray-900/80 border border-gray-800 pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 rounded-xl px-3 py-1.5">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value)}
              className="bg-transparent text-xs text-gray-200 focus:outline-none cursor-pointer"
            >
              <option value="todos" className="bg-gray-900">Todos los roles</option>
              <option value="pasajero" className="bg-gray-900">Pasajeros</option>
              <option value="conductor" className="bg-gray-900">Conductores</option>
              <option value="admin" className="bg-gray-900">Administradores</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-gray-900/80 border border-gray-800 rounded-xl px-3 py-1.5">
            <select
              value={filtroConexion}
              onChange={(e) => setFiltroConexion(e.target.value)}
              className="bg-transparent text-xs text-gray-200 focus:outline-none cursor-pointer"
            >
              <option value="todos" className="bg-gray-900">Todos los estados</option>
              <option value="online" className="bg-gray-900">En línea</option>
              <option value="offline" className="bg-gray-900">Desconectados</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div className="glass-panel rounded-2xl overflow-hidden p-1">
        {cargando ? (
          <div className="py-16 text-center text-xs text-gray-400 animate-pulse">
            Cargando base de datos de usuarios...
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-10 w-10 text-gray-600 mb-2" />
            <p className="text-sm font-semibold text-gray-300">
              No se encontraron usuarios
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Prueba cambiando los filtros o el término de búsqueda
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-800 bg-gray-900/40 text-gray-400 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 pl-4">Usuario</th>
                  <th className="py-3.5">Rol</th>
                  <th className="py-3.5">Contacto</th>
                  <th className="py-3.5">Vehículo</th>
                  <th className="py-3.5">Calificación</th>
                  <th className="py-3.5">Conexión</th>
                  <th className="py-3.5 text-right pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {usuariosFiltrados.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-800/30 transition-colors duration-150"
                  >
                    <td className="py-4 pl-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                          {u.nombre.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-white">{u.nombre}</p>
                          <p className="text-[10px] text-gray-400 font-mono">
                            ID: {u.id.slice(0, 10)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-4">
                      <StatusBadge role={u.rol} />
                    </td>

                    <td className="py-4 text-gray-300">
                      <div className="flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        <span>{u.telefono || 'Sin teléfono'}</span>
                      </div>
                    </td>

                    <td className="py-4">
                      {u.vehiculo ? (
                        <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                          <Car className="h-3.5 w-3.5 text-blue-400" />
                          <span>{u.vehiculo}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">N/A</span>
                      )}
                    </td>

                    <td className="py-4">
                      <div className="flex items-center gap-1 text-amber-400 font-semibold">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        <span>{u.calificacion_promedio.toFixed(1)}</span>
                      </div>
                    </td>

                    <td className="py-4">
                      <button
                        onClick={() => void toggleConexion(u)}
                        title="Hacer clic para alternar conexión"
                        className="transition-transform active:scale-95"
                      >
                        <StatusBadge isOnline={u.esta_conectado} />
                      </button>
                    </td>

                    <td className="py-4 text-right pr-4">
                      <button
                        onClick={() => abrirEdicion(u)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-emerald-500/20 hover:text-emerald-400 transition-colors"
                        title="Editar Usuario"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Edición Rápida */}
      {usuarioEditar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-gray-700">
            <div className="flex items-center justify-between pb-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Edit2 className="h-5 w-5 text-emerald-400" />
                Editar Perfil de Usuario
              </h3>
              <button
                onClick={() => setUsuarioEditar(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-white hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={guardarEdicion} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={editNombre}
                  onChange={(e) => setEditNombre(e.target.value)}
                  required
                  className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Teléfono
                </label>
                <input
                  type="text"
                  value={editTelefono}
                  onChange={(e) => setEditTelefono(e.target.value)}
                  className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Rol en la Plataforma
                </label>
                <select
                  value={editRol}
                  onChange={(e) => setEditRol(e.target.value as UserRole)}
                  className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  <option value="pasajero">Pasajero</option>
                  <option value="conductor">Conductor</option>
                  <option value="admin">Administrador (Acceso al Panel)</option>
                </select>
              </div>

              {editRol === 'conductor' && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">
                    Vehículo (Modelo / Placa / Color)
                  </label>
                  <input
                    type="text"
                    value={editVehiculo}
                    onChange={(e) => setEditVehiculo(e.target.value)}
                    placeholder="Toyota Yaris Blanco - ABC-123"
                    className="w-full rounded-xl bg-gray-900 border border-gray-800 px-3.5 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setUsuarioEditar(null)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600"
                >
                  <Save className="h-4 w-4" />
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AuthGuard>
  );
}
