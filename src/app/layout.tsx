import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Zeta AI — Think deeper. Build beyond.',
  description: 'A thoughtful AI workspace for learning, research, and building.',
  applicationName: 'Zeta AI',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Zeta' },
};
export const viewport: Viewport = { themeColor: '#0b0d0c', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
