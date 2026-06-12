// src/components/home/use-crawl-status.ts
// Shared poller for the free discovery endpoint (/api/crawl/status), same
// pattern as use-analytics.ts. Index stats change at crawl cadence (6h), so
// 60s polling is already generous.

'use client';

import { useEffect, useState } from 'react';
import type { CrawlStatusResponse } from '@/lib/analytics-types';

let cache: CrawlStatusResponse | null = null;
const subs = new Set<(d: CrawlStatusResponse) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function fetchOnce() {
  try {
    const res = await fetch('/api/crawl/status', { cache: 'no-store' });
    const data = (await res.json()) as CrawlStatusResponse;
    if (data.ok) {
      cache = data;
      subs.forEach((s) => s(data));
    }
  } catch {
    /* swallow — next tick will retry */
  }
}

export function useCrawlStatus(intervalMs = 60_000) {
  const [data, setData] = useState<CrawlStatusResponse | null>(cache);

  useEffect(() => {
    subs.add(setData);
    if (!cache) fetchOnce();
    if (!timer) timer = setInterval(fetchOnce, intervalMs);
    return () => {
      subs.delete(setData);
      if (subs.size === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    };
  }, [intervalMs]);

  return data;
}
