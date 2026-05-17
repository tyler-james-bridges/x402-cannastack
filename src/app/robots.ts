import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: 'https://cannastack.0x402.sh/sitemap.xml',
    host: 'https://cannastack.0x402.sh',
  };
}
