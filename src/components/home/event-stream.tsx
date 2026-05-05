// src/components/home/event-stream.tsx
// Tail of recent calls. Polls /api/analytics, animates new rows in.

'use client';

import { useAnalytics } from './use-analytics';
import { PRICE_USDC } from '@/lib/analytics-types';

function ago(ts: string) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 1) return 'now';
  if (s < 60) return `-${s.toFixed(1)}s`;
  if (s < 3600) return `-${Math.floor(s / 60)}m`;
  return `-${Math.floor(s / 3600)}h`;
}

export function EventStream() {
  const data = useAnalytics(2000);
  const recent = data?.recent ?? [];

  return (
    <div className="flex flex-col min-w-0">
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">
        EVENT STREAM · tail -f
      </div>
      <div className="flex-1 overflow-hidden relative min-h-[280px]">
        <div className="absolute inset-0 overflow-y-auto">
          {recent.length === 0 && (
            <div className="text-xs font-mono text-[#4F5354] py-2">waiting for traffic…</div>
          )}
          {recent.map((e, i) => {
            const price = PRICE_USDC[e.endpoint] ?? 0.02;
            const fresh = i === 0;
            return (
              <div
                key={`${e.created_at}-${i}`}
                className="grid items-center py-1.5 border-b border-[#22262A] text-xs font-mono"
                style={{
                  gridTemplateColumns: '52px 1fr 100px 56px',
                  gap: 10,
                  opacity: i === 0 ? 1 : Math.max(0.32, 1 - i * 0.04),
                }}
              >
                <span className={fresh ? 'text-[#9DFFB5]' : 'text-[#4F5354]'}>{ago(e.created_at)}</span>
                <span className="text-[#F1F1EE] truncate">
                  <span className="text-[#8A8E8C]">POST </span>/{e.endpoint}
                </span>
                <span className="text-[#8A8E8C] truncate">{e.location_query ?? '—'}</span>
                <span className={`text-right ${fresh ? 'text-[#9DFFB5]' : 'text-[#8A8E8C]'}`}>
                  −${price.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
