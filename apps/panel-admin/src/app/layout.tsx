import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '../lib/authContext';

export const metadata: Metadata = {
  title: 'Taxi HVCA — Panel de Administración',
  description: 'Control y monitoreo en tiempo real de viajes, conductores y pasajeros.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark">
      <body className="bg-[#0B0F19] text-gray-100 antialiased selection:bg-emerald-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
