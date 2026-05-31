import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata: Metadata = {
  title: 'Liquor Inventory',
  description: 'Beer, wine & spirits inventory and restock manager',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Inventory',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-slate-900 text-slate-100">
        <meta name="theme-color" content="#f59e0b" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
