import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin', 'latin-ext'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Profilo — Twoja wizytówka w sieci',
  description:
    'Jeden stały adres z opisem, kontaktem i linkami do Twoich profili. Gotowy w 5 minut.',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
    apple: '/apple-touch-icon.png',
  },
};

export const viewport: Viewport = { themeColor: '#0F2747' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
