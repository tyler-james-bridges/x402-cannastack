import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://cannastack.0x402.sh'),
  title: {
    default: 'cannastack · cannabis data, $0.02 per call',
    template: '%s · cannastack',
  },
  description:
    'Agent-native cannabis data. Dispensary menus, prices, deals, and strain availability across the US, priced like an API call via x402.',
  openGraph: {
    title: 'cannastack · cannabis data, $0.02 per call',
    description:
      'Every dispensary menu, price, and deal across the US for $0.02 per query. No keys. No contracts. USDC via x402.',
    url: 'https://cannastack.0x402.sh',
    siteName: 'cannastack',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'cannastack', description: 'Cannabis data, $0.02 per call.' },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
