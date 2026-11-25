import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'PlayNex — Elevate Your Game',
    template: '%s · PlayNex',
  },
  applicationName: 'PlayNex',
  description:
    'The all-in-one sports platform connecting players, turfs & academies, and sports stores.',
  appleWebApp: {
    capable: true,
    title: 'PlayNex',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F5F7FA] text-[#172033] font-sans antialiased selection:bg-[#2563EB] selection:text-white">
        {children}
      </body>
    </html>
  );
}
