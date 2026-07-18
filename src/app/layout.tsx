import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://cannastack.0x402.sh'),
  title: {
    default: 'Cannastack | Bring your own menu',
    template: '%s | Cannastack',
  },
  description:
    'Source-neutral normalization, comparison, and ranking for caller-supplied menu snapshots.',
  openGraph: {
    title: 'Cannastack | Bring your own menu',
    description: 'Process caller-supplied menu snapshots through three x402 endpoints.',
    url: 'https://cannastack.0x402.sh',
    siteName: 'cannastack',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Cannastack',
    description: 'Source-neutral processing for caller-supplied menu snapshots.',
  },
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0B0C0D] text-white antialiased">{children}</body>
    </html>
  );
}
