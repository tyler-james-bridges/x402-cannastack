import type { MetadataRoute } from 'next';

const BASE = 'https://cannastack.0x402.sh';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'monthly', priority: 1 },
    { url: `${BASE}/docs`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/status`, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
