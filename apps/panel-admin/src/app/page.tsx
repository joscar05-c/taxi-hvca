'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Car,
  Smartphone,
  ShieldCheck,
  MapPin,
  BadgeDollarSign,
  Star,
  Download,
  ArrowRight,
  CheckCircle2,
  Users,
  Navigation,
  Sparkles,
  HelpCircle,
  ChevronDown,
  Lock,
  Phone,
  Clock,
  ThumbsUp,
  Share2,
} from 'lucide-react';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'pasajero' | 'conductor'>('pasajero');
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<number>(0);

  const rutasHVCA = [
    {
      origen: 'Plaza de Armas',
      destino: 'Barrio Ascensión',
      distancia: '3.2 km',
      estimado: 'S/ 5.00 - 6.50',
    },
    {
      origen: 'Terminal Terrestre HVCA',
      destino: 'Hospital Regional Zacarías Correa',
      distancia: '4.8 km',
      estimado: 'S/ 6.50 - 8.00',
    },
    {
      origen: 'Barrio Santa Ana',
      destino: 'San Cristóbal / Mirador',
      distancia: '2.9 km',
      estimado: 'S/ 5.00 - 6.00',
    },
    {
      origen: 'Av. Andrés Avelino Cáceres',
      destino: 'Plaza de Yananaco',
      distancia: '2.4 km',
      estimado: 'S/ 4.50 - 5.50',
    },
  ];

  const faqs = [
    {
      q: '¿Cómo funciona la negociación del precio del viaje?',
      a: 'Al pedir tu taxi indicas tu punto de partida, tu destino y propones el monto que deseas pagar. Los conductores cercanos reciben tu solicitud y pueden aceptarla o enviar una contraoferta. Tú eliges la opción que mejor te convenga según el precio, el vehículo y la reputación del conductor.',
    },
    {
      q: '¿Qué formas de pago puedo utilizar?',
      a: 'Aceptamos pagos directos al conductor en efectivo y mediante billeteras digitales instantáneas como Yape y Plin, sin comisiones bancarias adicionales.',
    },
    {
      q: '¿Cómo me registro como conductor en Huancavelica?',
      a: 'Descarga la app "Taxi HVCA Conductor", sube tu DNI, brevete A-I o superior vigente, SOAT actualizado y los datos de tu vehículo. Nuestro equipo revisa y aprueba tu cuenta en menos de 24 horas para que empieces a generar ingresos de inmediato.',
    },
    {
      q: '¿Por qué Taxi HVCA es más seguro que tomar taxi en la calle?',
      a: 'Todos los conductores pasan por verificación de antecedentes y documentación. Durante el viaje cuentas con rastreo GPS en tiempo real y puedes compartir tu ubicación con familiares en un solo toque.',
    },
    {
      q: '¿Tiene costo para los conductores?',
      a: 'Durante nuestra etapa de lanzamiento oficial en Huancavelica, la comisión es del 0%. Los conductores se quedan con el 100% de lo generado en cada viaje.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setFaqOpen(faqOpen === idx ? null : idx);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 selection:bg-emerald-500 selection:text-white">
      {/* Glow Effects Top */}
      <div className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 h-[500px] w-[800px] rounded-full bg-emerald-500/15 blur-[140px]" />
      <div className="pointer-events-none fixed top-1/3 -right-60 h-[400px] w-[500px] rounded-full bg-teal-500/10 blur-[130px]" />

      {/* ===================== NAVBAR ===================== */}
      <header className="sticky top-0 z-50 border-b border-gray-800/80 bg-[#0B0F19]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/25 group-hover:scale-105 transition-transform duration-200">
              <Car className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black tracking-tight text-white">
                  Taxi <span className="text-emerald-400">HVCA</span>
                </span>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                  OFICIAL
                </span>
              </div>
              <p className="text-[11px] font-medium text-gray-400">Huancavelica, Perú</p>
            </div>
          </Link>

          {/* Navigation links */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-gray-300">
            <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">
              Cómo Funciona
            </a>
            <a href="#apps" className="hover:text-emerald-400 transition-colors">
              Pasajero & Conductor
            </a>
            <a href="#rutas" className="hover:text-emerald-400 transition-colors">
              Rutas y Tarifas
            </a>
            <a href="#seguridad" className="hover:text-emerald-400 transition-colors">
              Seguridad
            </a>
            <a href="#faqs" className="hover:text-emerald-400 transition-colors">
              Preguntas
            </a>
          </nav>

          {/* Action CTAs */}
          <div className="flex items-center gap-3">
            {/* Direct Admin Access Button */}
            <Link
              href="/admin/login"
              id="btn-admin-access"
              className="flex items-center gap-1.5 rounded-xl bg-gray-900/80 hover:bg-gray-800 border border-gray-700/80 px-3.5 py-2 text-xs font-semibold text-gray-300 hover:text-white transition-all shadow-sm"
              title="Acceso restringido para administradores"
            >
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Panel</span> Admin
            </Link>

            <a
              href="#apps"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-emerald-500/40"
            >
              <Download className="h-4 w-4" />
              <span>Descargar App</span>
            </a>
          </div>
        </div>
      </header>

      {/* ===================== HERO SECTION ===================== */}
      <section className="relative pt-12 pb-20 sm:pt-20 sm:pb-28 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left text column */}
            <div className="lg:col-span-7 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-4 py-1.5 text-xs font-semibold text-emerald-400 mb-6 shadow-inner">
                <Sparkles className="h-3.5 w-3.5" />
                <span>La Primera Plataforma de Taxis Locales en Huancavelica</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.12]">
                Tu viaje seguro, rápido y a{' '}
                <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
                  precio justo
                </span>
              </h1>

              <p className="mt-6 text-base sm:text-lg text-gray-300 max-w-2xl font-normal leading-relaxed">
                Olvídate de pagar de más o esperar bajo el frío. Con <strong>Taxi HVCA</strong> propones
                tu tarifa, negocias directamente con conductores verificados y viajas monitoreado con GPS en tiempo real.
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <a
                  href="#apps"
                  className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-7 py-3.5 text-sm font-bold text-white shadow-xl shadow-emerald-500/30 transition-all hover:scale-[1.02]"
                >
                  <Smartphone className="h-5 w-5" />
                  <span>Descargar para Pasajero</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <a
                  href="#apps"
                  onClick={() => setActiveTab('conductor')}
                  className="flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-2xl bg-gray-900/90 hover:bg-gray-800 border border-gray-700/80 px-6 py-3.5 text-sm font-semibold text-gray-200 transition-all hover:border-emerald-500/40"
                >
                  <Car className="h-5 w-5 text-emerald-400" />
                  <span>Quiero ser Conductor</span>
                </a>
              </div>

              {/* Trust Badges */}
              <div className="mt-10 grid grid-cols-3 gap-4 border-t border-gray-800/80 pt-8 max-w-lg mx-auto lg:mx-0">
                <div className="text-left">
                  <div className="text-xl sm:text-2xl font-black text-white">100%</div>
                  <p className="text-xs text-gray-400 mt-0.5">Choferes Verificados</p>
                </div>
                <div className="text-left">
                  <div className="text-xl sm:text-2xl font-black text-emerald-400">0%</div>
                  <p className="text-xs text-gray-400 mt-0.5">Comisión Lanzamiento</p>
                </div>
                <div className="text-left">
                  <div className="text-xl sm:text-2xl font-black text-teal-300">24/7</div>
                  <p className="text-xs text-gray-400 mt-0.5">Soporte en HVCA</p>
                </div>
              </div>
            </div>

            {/* Right Interactive Showcase */}
            <div className="lg:col-span-5 relative flex justify-center">
              {/* Phone Mockup Frame */}
              <div className="relative w-full max-w-sm rounded-[2.5rem] bg-gradient-to-b from-gray-800 via-gray-900 to-black p-4 shadow-2xl border-4 border-gray-700/70 shadow-emerald-500/10">
                {/* Screen content */}
                <div className="rounded-[2rem] bg-[#0F1424] p-5 overflow-hidden border border-gray-800">
                  {/* Top Phone bar */}
                  <div className="flex items-center justify-between pb-4 border-b border-gray-800/60 text-xs">
                    <span className="font-bold text-emerald-400">Taxi HVCA App</span>
                    <span className="flex items-center gap-1 text-[11px] text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      GPS Activo
                    </span>
                  </div>

                  {/* Simulated Map Card */}
                  <div className="relative my-4 rounded-2xl bg-gray-950 p-4 border border-gray-800 overflow-hidden">
                    <div className="flex items-center gap-2 text-xs text-gray-300 mb-2">
                      <MapPin className="h-4 w-4 text-emerald-400" />
                      <span className="font-semibold">Plaza de Armas Huancavelica</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 pl-6 border-l-2 border-dashed border-gray-700 ml-2 py-2">
                      <Navigation className="h-3.5 w-3.5 text-teal-400" />
                      <span>Hacia Barrio Ascensión</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-900/90 p-2.5 border border-gray-800">
                      <span className="text-[11px] text-gray-400">Tu oferta:</span>
                      <span className="text-sm font-extrabold text-white">S/ 6.00</span>
                    </div>
                  </div>

                  {/* Incoming Driver Offer Card */}
                  <div className="rounded-2xl bg-gradient-to-br from-gray-900 to-[#121B2A] p-4 border border-emerald-500/30 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-bold text-sm">
                          MC
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Manuel Crispín</p>
                          <p className="text-[11px] text-gray-400">Toyota Yaris Blanco</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-xs text-amber-400 font-bold">
                          <Star className="h-3 w-3 fill-current" />
                          <span>4.9</span>
                        </div>
                        <span className="text-[10px] text-gray-400">a 2 min</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-gray-800/80 pt-3">
                      <div>
                        <span className="text-[10px] text-gray-400">Contraoferta Conductor:</span>
                        <div className="text-base font-black text-emerald-400">S/ 6.50</div>
                      </div>

                      <div className="flex gap-1.5">
                        <button className="rounded-xl bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors">
                          Aceptar
                        </button>
                      </div>
                    </div>
                  </div>

                  <p className="mt-4 text-center text-[10px] text-gray-400">
                    ✨ Elige el conductor que más te guste
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== CÓMO FUNCIONA ===================== */}
      <section id="como-funciona" className="py-20 bg-gray-950/60 border-y border-gray-800/80 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Facilidad y Transparencia
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              ¿Cómo funciona Taxi HVCA?
            </h2>
            <p className="mt-3 text-sm sm:text-base text-gray-400">
              Un modelo InDrive diseñado para la geografía y el trato cercano de Huancavelica.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 font-black text-xl mb-6 border border-emerald-500/20 group-hover:scale-110 transition-transform">
                01
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Solicita y pon tu precio</h3>
              <p className="text-xs leading-relaxed text-gray-400">
                Abre la app, selecciona tu punto de recogida, tu destino en cualquier barrio de Huancavelica y ofrece la tarifa que consideres adecuada.
              </p>
            </div>

            {/* Step 2 */}
            <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-teal-500/40 transition-colors">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-500/10 text-teal-400 font-black text-xl mb-6 border border-teal-500/20 group-hover:scale-110 transition-transform">
                02
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Recibe ofertas al instante</h3>
              <p className="text-xs leading-relaxed text-gray-400">
                Los conductores locales ven tu pedido en tiempo real. Pueden aceptar tu precio o enviarte una contraoferta. Tú revisas fotos, modelo del auto y calificación.
              </p>
            </div>

            {/* Step 3 */}
            <div className="glass-panel rounded-3xl p-8 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400 font-black text-xl mb-6 border border-cyan-500/20 group-hover:scale-110 transition-transform">
                03
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Viaja seguro y paga directo</h3>
              <p className="text-xs leading-relaxed text-gray-400">
                El chofer te recoge en tu ubicación. Al terminar, pagas el precio acordado en efectivo o Yape/Plin. ¡Sin sorpresas ni cobros ocultos!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== APPS SELECTOR (PASAJERO / CONDUCTOR) ===================== */}
      <section id="apps" className="py-20 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Dos Aplicaciones, Una Comunidad
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Descarga e Inscríbete Hoy Mismo
            </h2>
          </div>

          {/* Tab Selector */}
          <div className="flex justify-center mb-12">
            <div className="inline-flex rounded-2xl bg-gray-900 p-1.5 border border-gray-800 shadow-xl">
              <button
                onClick={() => setActiveTab('pasajero')}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'pasajero'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Smartphone className="h-4 w-4" />
                <span>Soy Pasajero</span>
              </button>
              <button
                onClick={() => setActiveTab('conductor')}
                className={`flex items-center gap-2 rounded-xl px-6 py-3 text-xs sm:text-sm font-bold transition-all ${
                  activeTab === 'conductor'
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Car className="h-4 w-4" />
                <span>Soy Conductor</span>
              </button>
            </div>
          </div>

          {/* Content according to active tab */}
          {activeTab === 'pasajero' ? (
            <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-emerald-500/20 max-w-5xl mx-auto shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-block rounded-xl bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 mb-4">
                    App para Pasajeros
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                    Viaja cómodo por Huancavelica pagando lo justo
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                    Pide tu vehículo en cualquier momento del día o de la noche. Mira cómo tu taxi se acerca en el mapa y viaja tranquilo.
                  </p>

                  <ul className="space-y-3 mb-8 text-xs sm:text-sm text-gray-300">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>Elige al conductor por precio, modelo de auto o calificación</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>Paga con efectivo, Yape o Plin sin recargos</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>Comparte tu ruta en tiempo real con familiares</span>
                    </li>
                  </ul>

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => alert('Próximamente disponible en Google Play Store y en descarga directa APK.')}
                      className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-500/25 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      <span>Descargar APK Pasajero</span>
                    </button>
                    <span className="text-xs text-gray-400">Android 7.0 o superior</span>
                  </div>
                </div>

                <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
                  <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    ¿Cómo registrarse como Pasajero?
                  </h4>
                  <div className="space-y-4 text-xs text-gray-400">
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex-shrink-0">
                        1
                      </span>
                      <span>Instala la aplicación en tu celular Android.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex-shrink-0">
                        2
                      </span>
                      <span>Ingresa tu número de teléfono y verifica mediante código SMS.</span>
                    </div>
                    <div className="flex gap-3">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex-shrink-0">
                        3
                      </span>
                      <span>Coloca tu nombre completo y ¡listo! Ya puedes solicitar viajes en Huancavelica.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-teal-500/20 max-w-5xl mx-auto shadow-2xl">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-block rounded-xl bg-teal-500/10 px-3 py-1 text-xs font-bold text-teal-400 border border-teal-500/20 mb-4">
                    App para Conductores
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
                    Maneja a tu propio ritmo y maximiza tus ingresos
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed mb-6">
                    Sin intermediarios abusivos. Tú decides qué carreras tomar, ves el destino antes de aceptar y puedes negociar el precio con el cliente.
                  </p>

                  <ul className="space-y-3 mb-8 text-xs sm:text-sm text-gray-300">
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                      <span><strong>0% de comisión</strong> durante los primeros meses de lanzamiento</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                      <span>Conoce el punto de partida y destino exacto antes de aceptar</span>
                    </li>
                    <li className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-teal-400 flex-shrink-0" />
                      <span>Cobro directo: dinero al contado o Yape/Plin a tu cuenta</span>
                    </li>
                  </ul>

                  <div className="flex flex-wrap items-center gap-4">
                    <button
                      onClick={() => alert('Próximamente disponible en Google Play Store y en descarga directa APK.')}
                      className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-lg shadow-teal-500/25 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      <span>Descargar APK Conductor</span>
                    </button>
                    <span className="text-xs text-gray-400">Revisión de documentos en 24h</span>
                  </div>
                </div>

                <div className="bg-gray-900/80 rounded-2xl p-6 border border-gray-800">
                  <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-teal-400" />
                    Requisitos para Afiliarte en Huancavelica
                  </h4>
                  <div className="space-y-3 text-xs text-gray-300">
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-950/60 border border-gray-800/80">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>DNI vigente (Mayor de 20 años)</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-950/60 border border-gray-800/80">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>Licencia de Conducir (Brevete A-I o profesional)</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-950/60 border border-gray-800/80">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>SOAT y Tarjeta de Identificación Vehicular al día</span>
                    </div>
                    <div className="flex items-center gap-2.5 p-2 rounded-lg bg-gray-950/60 border border-gray-800/80">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                      <span>Auto en buenas condiciones estéticas y mecánicas</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===================== RUTAS Y ESTIMADOR INTERACTIVO ===================== */}
      <section id="rutas" className="py-20 bg-gray-950/60 border-y border-gray-800/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Precios Referenciales
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Rutas Populares en Huancavelica
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-gray-400">
              En Taxi HVCA tú tienes la última palabra, pero aquí tienes los rangos sugeridos por la comunidad.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center max-w-5xl mx-auto">
            {/* Route selector list */}
            <div className="lg:col-span-7 space-y-3">
              {rutasHVCA.map((r, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedRoute(i)}
                  className={`w-full text-left p-4 rounded-2xl border transition-all ${
                    selectedRoute === i
                      ? 'bg-emerald-500/10 border-emerald-500/40 shadow-lg'
                      : 'bg-gray-900/60 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <span>{r.origen}</span>
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span>{r.destino}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">Distancia estimada: {r.distancia}</p>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-black text-emerald-400">{r.estimado}</div>
                      <span className="text-[10px] text-gray-400">tarifa sugerida</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Selected Route Preview Card */}
            <div className="lg:col-span-5 glass-panel rounded-3xl p-6 border border-emerald-500/30 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
                <BadgeDollarSign className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">Tarifa Sugerida</h3>
              <p className="text-2xl font-black text-emerald-400 my-2">
                {rutasHVCA[selectedRoute].estimado}
              </p>
              <p className="text-xs text-gray-400 mb-6">
                Ruta: {rutasHVCA[selectedRoute].origen} a {rutasHVCA[selectedRoute].destino} ({rutasHVCA[selectedRoute].distancia})
              </p>

              <div className="rounded-xl bg-gray-900/80 p-3.5 text-[11px] text-gray-300 border border-gray-800 text-left">
                💡 <strong>Recuerda:</strong> Como pasajero puedes ofrecer S/ 4.50, S/ 5.00 o el monto que consideres justo. Los choferes aceptarán o harán una oferta libremente.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== SEGURIDAD ===================== */}
      <section id="seguridad" className="py-20 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Tranquilidad en Cada Kilómetro
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Tu Seguridad es Nuestra Prioridad
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="glass-panel rounded-3xl p-8 border border-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 mb-6">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Conductores Filtrados</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Verificación estricta de identidad, antecedentes policiales, vigencia de SOAT y estado técnico del automóvil antes de habilitar la cuenta.
              </p>
            </div>

            <div className="glass-panel rounded-3xl p-8 border border-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-400 mb-6">
                <Share2 className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Comparte tu Ruta</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Envía un enlace por WhatsApp a tus familiares para que sigan tu recorrido en vivo hasta que llegues sano y salvo a tu destino.
              </p>
            </div>

            <div className="glass-panel rounded-3xl p-8 border border-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-400 mb-6">
                <Star className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white mb-2">Sistema de Calificación Mutua</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                Pasajeros y conductores se califican al finalizar cada viaje. Mantenemos en la plataforma solo a usuarios con excelente comportamiento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===================== FAQS ===================== */}
      <section id="faqs" className="py-20 bg-gray-950/60 border-t border-gray-800/80">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Resolvemos tus Dudas
            </span>
            <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-white">
              Preguntas Frecuentes
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = faqOpen === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl bg-gray-900/60 border border-gray-800/80 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="flex w-full items-center justify-between p-5 text-left text-sm font-bold text-white hover:text-emerald-400 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-400' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 text-xs leading-relaxed text-gray-400 border-t border-gray-800/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===================== FOOTER ===================== */}
      <footer className="border-t border-gray-800 bg-[#070A12] py-12 text-xs text-gray-400">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-gray-800/80">
            {/* Col 1 */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white font-bold">
                  <Car className="h-5 w-5" />
                </div>
                <span className="text-lg font-black text-white">
                  Taxi <span className="text-emerald-400">HVCA</span>
                </span>
              </div>
              <p className="max-w-md text-xs text-gray-400 leading-relaxed mb-4">
                La plataforma de movilidad urbana hecha a la medida de Huancavelica.
                Conectamos de forma transparente a pasajeros y choferes para viajes más seguros, rápidos y económicos.
              </p>
              <p className="text-[11px] text-gray-400">
                📍 Huancavelica, Región Huancavelica, Perú
              </p>
            </div>

            {/* Col 2 */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                Navegación
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#como-funciona" className="hover:text-emerald-400 transition-colors">
                    Cómo Funciona
                  </a>
                </li>
                <li>
                  <a href="#apps" className="hover:text-emerald-400 transition-colors">
                    Descargar App Pasajero
                  </a>
                </li>
                <li>
                  <a href="#apps" className="hover:text-emerald-400 transition-colors">
                    Registrarse como Conductor
                  </a>
                </li>
                <li>
                  <a href="#rutas" className="hover:text-emerald-400 transition-colors">
                    Rutas y Tarifas Sugeridas
                  </a>
                </li>
                <li>
                  <a href="#faqs" className="hover:text-emerald-400 transition-colors">
                    Preguntas Frecuentes
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3 */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white mb-3">
                Administración
              </h4>
              <p className="text-[11px] text-gray-400 mb-3">
                Acceso para el equipo de supervisión y soporte operativo.
              </p>
              <Link
                href="/admin/login"
                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700/80 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>Iniciar Sesión en /admin</span>
              </Link>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left text-[11px] text-gray-400">
            <p>© {new Date().getFullYear()} Taxi HVCA. Todos los derechos reservados.</p>
            <p>Construido con tecnología moderna para Huancavelica 🇵🇪</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
