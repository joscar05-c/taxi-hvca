import type { Metadata } from 'next';
import '../styles/globals.css';
import { AuthProvider } from '../lib/authContext';

export const metadata: Metadata = {
  title: 'Taxi HVCA — Tu viaje seguro y a precio justo en Huancavelica',
  description:
    'Pide taxi o afíliate como conductor en Huancavelica. Negocia tu tarifa libremente, viaja con GPS en tiempo real y choferes 100% verificados.',
  keywords: [
    'taxi huancavelica',
    'taxi hvca',
    'app taxi huancavelica',
    'conductores huancavelica',
    'viajes huancavelica',
  ],
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
