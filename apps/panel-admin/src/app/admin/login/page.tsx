'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Car, Mail, Lock, AlertCircle, ArrowRight, ShieldCheck, Loader2, ArrowLeft } from 'lucide-react';

import { useAuth } from '@/lib/authContext';

export default function AdminLoginPage() {
  const router = useRouter();
  const {
    user,
    loading,
    error: authContextError,
    signInWithEmail,
    signInWithGoogle,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mensajeError = error || authContextError;

  useEffect(() => {
    if (!loading && user) {
      router.replace('/admin');
    }
  }, [user, loading, router]);

  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Por favor completa todos los campos.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmail(email.trim().toLowerCase(), password);
      router.replace('/admin');
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found') {
        setError('Correo electrónico o contraseña incorrectos.');
      } else {
        setError(err.message || 'No se pudo iniciar sesión.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    setError(null);
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/admin');
    } catch (err: any) {
      console.error(err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message || 'No se pudo iniciar sesión con Google.');
      }
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0B0F19] px-4 py-12 overflow-hidden">
      {/* Background ambient glowing orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-emerald-600/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />

      {/* Back to public site button */}
      <div className="absolute top-6 left-6 z-10">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-xl bg-gray-900/60 hover:bg-gray-800/80 px-4 py-2 text-xs font-medium text-gray-400 hover:text-white border border-gray-800 transition-colors backdrop-blur-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Volver al portal público</span>
        </Link>
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-xl shadow-emerald-500/25">
            <Car className="h-7 w-7" />
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20 mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>MÓDULO DE SEGURIDAD / ADMIN</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Consola Taxi HVCA
          </h1>
          <p className="mt-1.5 text-sm text-gray-400">
            Ingresa con tu cuenta de administrador autorizada
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-3xl p-8 shadow-2xl">
          {mensajeError && (
            <div className="mb-6 flex items-start gap-3 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3.5 text-rose-400 text-xs">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{mensajeError}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                Correo Electrónico
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@taxihvca.com"
                  required
                  className="w-full rounded-xl bg-gray-900/80 border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-300">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-gray-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full rounded-xl bg-gray-900/80 border border-gray-800 pl-10 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || googleLoading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/25 hover:from-emerald-600 hover:to-teal-600 focus:outline-none transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Ingresar con Correo</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-gray-800" />
            <span className="text-xs font-medium text-gray-400">o accede con</span>
            <div className="h-px flex-1 bg-gray-800" />
          </div>

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting || googleLoading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 py-3 text-sm font-semibold text-gray-200 shadow-sm transition-all duration-200 disabled:opacity-50"
          >
            {googleLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Ingresar con Google</span>
          </button>

          {/* Security footnote */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Consola Segura — Acceso exclusivo para administradores</span>
          </div>
        </div>
      </div>
    </div>
  );
}
