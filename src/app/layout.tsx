import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'x402-cannastack',
  description:
    'Agent-native cannabis data platform. Dispensary menus, prices, deals, and strain availability via x402.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-black text-white antialiased">{children}</body>
    </html>
  );
}
