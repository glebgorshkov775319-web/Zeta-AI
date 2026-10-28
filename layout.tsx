import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nova — AI workspace',
  description: 'A thoughtful AI workspace for learning, research, and building.',
  applicationName: 'Nova AI',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Nova' },
};
export const viewport: Viewport = { themeColor: '#0b0d0c', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
