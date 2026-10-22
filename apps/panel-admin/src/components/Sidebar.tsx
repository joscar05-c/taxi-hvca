'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Car,
  BadgeDollarSign,
  Settings,
  LogOut,
  Radio,
  ShieldCheck,
} from 'lucide-react';

import { useAuth } from '../lib/authContext';

export function Sidebar() {
  const pathname = usePathname();
  const { user, profile, logout } = useAuth();

  const navItems = [
    { href: '/admin', label: 'Panel General', icon: LayoutDashboard },
    { href: '/admin/usuarios', label: 'Usuarios y Perfiles', icon: Users },
    { href: '/admin/viajes', label: 'Viajes en Vivo', icon: Car },
    { href: '/admin/ofertas', label: 'Ofertas Conductores', icon: BadgeDollarSign },
    { href: '/admin/configuracion', label: 'Configuración', icon: Settings },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 z-40 flex w-72 flex-col justify-between border-r border-gray-800 bg-[#0B0F19]/95 backdrop-blur-xl">
      {/* Brand header */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
            <Car className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">Taxi HVCA</h1>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                ADMIN
              </span>
            </div>
            <p className="text-xs text-gray-400">Panel de Control</p>
          </div>
        </div>

        {/* Realtime Status Indicator */}
        <div className="mt-5 flex items-center justify-between rounded-xl bg-gray-900/80 px-3.5 py-2.5 border border-gray-800/80">
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-gray-300">Firebase Firestore</span>
          </div>
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-4 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/10 text-emerald-400 border border-emerald-500/30 shadow-sm'
                  : 'text-gray-400 hover:bg-gray-800/60 hover:text-gray-200'
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-transform duration-200 ${
                  isActive ? 'text-emerald-400 scale-110' : 'text-gray-400'
                }`}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User profile & Logout */}
      <div className="border-t border-gray-800/80 p-4">
        <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-900/60 p-3 border border-gray-800">
          {user?.photoURL ? (
            <img
              src={user.photoURL}
              alt="Avatar"
              className="h-10 w-10 rounded-full object-cover border border-emerald-500/30"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 font-bold text-sm">
              {(profile?.nombre || user?.email || 'A').slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-semibold text-white">
              {profile?.nombre || user?.displayName || 'Administrador'}
            </p>
            <p className="truncate text-xs text-gray-400">
              {user?.email || 'admin@taxihvca.com'}
            </p>
          </div>

          <ShieldCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
        </div>

        <button
          onClick={() => void logout()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900/60 hover:bg-rose-500/15 py-2.5 text-xs font-semibold text-gray-400 hover:text-rose-400 border border-gray-800 hover:border-rose-500/30 transition-all duration-200"
        >
          <LogOut className="h-4 w-4" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}
