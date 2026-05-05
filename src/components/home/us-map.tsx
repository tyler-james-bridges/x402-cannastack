// src/components/home/us-map.tsx
// Stylized US dot map. Pins recent calls; pings the freshest 3.

'use client';

import { useAnalytics } from './use-analytics';
import { coordsFor } from '@/lib/analytics-types';

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

export function UsMap() {
  const data = useAnalytics(3000);
  const events = (data?.recent ?? [])
    .map((r) => ({ row: r, c: coordsFor(r) }))
    .filter((e) => e.c)
    .slice(0, 10);

  return (
    <div className="absolute inset-0">
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
      {events.map((e, i) => {
        const [lat, lng] = e.c!;
        const p = project(lat, lng);
        const fresh = i < 3;
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
            {fresh && (
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
                width: fresh ? 7 : 4,
                height: fresh ? 7 : 4,
                background: fresh ? '#9DFFB5' : '#FFB976',
                boxShadow: fresh ? '0 0 10px #9DFFB5' : 'none',
              }}
            />
          </div>
        );
      })}
      <style>{`@keyframes mapPing { 0% { transform: translate(-50%, -50%) scale(0.4); opacity: 1 } 100% { transform: translate(-50%, -50%) scale(2.6); opacity: 0 } }`}</style>
    </div>
  );
}
