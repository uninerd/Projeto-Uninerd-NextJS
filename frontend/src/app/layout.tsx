import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthProvider } from '@/ui/contexts/AuthContext';
import './globals.css';
export const metadata: Metadata = {
  title: 'Uninerd | Agendamento médico', description: 'Agende consultas e exames e acompanhe sua agenda no Uninerd.',
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="pt-BR"><body><Suspense fallback={<p className="p-8">Carregando...</p>}><AuthProvider>{children}</AuthProvider></Suspense></body></html>;
}
