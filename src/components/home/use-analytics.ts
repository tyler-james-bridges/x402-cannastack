// src/components/home/use-analytics.ts
// One SWR-style poller shared across LiveMeter, EventStream, UsMap.
// No SWR dep needed — small custom hook.

'use client';

import { useEffect, useState } from 'react';
import type { AnalyticsResponse } from '@/lib/analytics-types';

let cache: AnalyticsResponse | null = null;
const subs = new Set<(d: AnalyticsResponse) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

async function fetchOnce() {
  try {
    const res = await fetch('/api/analytics', { cache: 'no-store' });
    const data = (await res.json()) as AnalyticsResponse;
    if (data.ok) {
      cache = data;
      subs.forEach((s) => s(data));
    }
  } catch {
    /* swallow — next tick will retry */
  }
}

export function useAnalytics(intervalMs = 5000) {
  const [data, setData] = useState<AnalyticsResponse | null>(cache);

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
