import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://cannastack.0x402.sh'),
  title: {
    default: 'Cannastack | Data service retired',
    template: '%s | Cannastack',
  },
  description: 'Cannastack data endpoints are retired pending an authorized provider.',
  openGraph: {
    title: 'Cannastack | Data service retired',
    description: 'No paid data products are active.',
    url: 'https://cannastack.0x402.sh',
    siteName: 'cannastack',
    type: 'website',
  },
  twitter: { card: 'summary', title: 'Cannastack', description: 'Data service retired.' },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B0C0D] text-white antialiased">{children}</body>
    </html>
  );
}
