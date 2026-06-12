// src/components/home/us-map.tsx
// Coverage map: metro pins (always present — the territory we can answer
// questions about) with live query activity layered on top only when it is
// genuinely fresh. Stale activity is omitted, never faked.

'use client';

import { useEffect, useState } from 'react';
import { useAnalytics } from './use-analytics';
import { useCrawlStatus } from './use-crawl-status';
import { coordsFor, METRO_COORDS } from '@/lib/analytics-types';

function project(lat: number, lng: number) {
  const x = (lng + 125) / (125 - 66);
  const y = 1 - (lat - 24) / (49 - 24);
  return {
    x: Math.max(0.02, Math.min(0.98, x)),
    y: Math.max(0.04, Math.min(0.96, y)),
  };
}

const grid: { x: number; y: number }[] = (() => {
  const out: { x: number; y: number }[] = [];
  const cols = 56,
    rows = 22;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c / (cols - 1),
        y = r / (rows - 1);
      const inUs =
        (x - 0.5) ** 2 / 0.34 + (y - 0.55) ** 2 / 0.18 < 1 ||
        (x > 0.78 && x < 0.92 && y > 0.62 && y < 0.84) ||
        (x < 0.18 && y > 0.3 && y < 0.55);
      if (inUs) out.push({ x, y });
    }
  }
  return out;
})();

const PING_WINDOW_MS = 15 * 60 * 1000; // pings: queries < 15 min old
const DOT_WINDOW_MS = 24 * 60 * 60 * 1000; // solid dots: queries < 24h old

export function UsMap() {
  const analytics = useAnalytics(5000);
  const crawl = useCrawlStatus(60_000);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const events = (analytics?.recent ?? [])
    .map((r) => ({ row: r, c: coordsFor(r), age: now - new Date(r.created_at).getTime() }))
    .filter((e) => e.c && e.age < DOT_WINDOW_MS)
    .slice(0, 10);

  const metros = (crawl?.metros ?? [])
    .map((m) => ({ ...m, c: METRO_COORDS[m.name.toLowerCase()] }))
    .filter((m) => m.c);

  return (
    <div className="absolute inset-0">
      <div className="absolute top-2.5 left-3 z-10 text-[10px] font-mono text-[#4F5354] tracking-[1.4px]">
        COVERAGE{metros.length > 0 ? ` · ${metros.filter((m) => m.enabled).length} METROS` : ''}
      </div>
      {grid.map((g, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-[#22262A]"
          style={{
            left: `${g.x * 100}%`,
            top: `${g.y * 100}%`,
            width: 3,
            height: 3,
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
      {/* coverage layer: crawled metros */}
      {metros.map((m) => {
        const [lat, lng] = m.c!;
        const p = project(lat, lng);
        const name = m.name.split(',')[0].toLowerCase();
        return (
          <div
            key={m.id}
            className="absolute flex items-center gap-1"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <span
              className="block"
              style={{
                width: 5,
                height: 5,
                background: m.enabled ? '#7AB8FF' : '#4F5354',
              }}
            />
            <span className="hidden sm:block font-mono text-[9px] text-[#4F5354] whitespace-nowrap">
              {name}
            </span>
          </div>
        );
      })}
      {/* activity layer: only genuinely fresh queries */}
      {events.map((e, i) => {
        const [lat, lng] = e.c!;
        const p = project(lat, lng);
        const live = e.age < PING_WINDOW_MS;
        return (
          <div
            key={`${e.row.created_at}-${i}`}
            className="absolute"
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {live && (
              <span
                className="absolute rounded-full"
                style={{
                  top: '50%',
                  left: '50%',
                  width: 18,
                  height: 18,
                  border: '1px solid #9DFFB5',
                  transform: 'translate(-50%, -50%)',
                  animation: 'mapPing 1.4s ease-out infinite',
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            )}
            <span
              className="block rounded-full"
              style={{
                width: live ? 7 : 4,
                height: live ? 7 : 4,
                background: live ? '#9DFFB5' : '#FFB976',
                boxShadow: live ? '0 0 10px #9DFFB5' : 'none',
              }}
            />
          </div>
        );
      })}
      <style>{`@keyframes mapPing { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 1 } 100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0 } }`}</style>
    </div>
  );
}
