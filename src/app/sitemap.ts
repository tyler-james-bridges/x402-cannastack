import type { MetadataRoute } from 'next';

const BASE = 'https://cannastack.0x402.sh';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/docs`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/status`, lastModified: now, changeFrequency: 'hourly', priority: 0.6 },
    { url: `${BASE}/strain-finder`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/price-compare`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/deal-scout`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE}/price-history`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];
}
