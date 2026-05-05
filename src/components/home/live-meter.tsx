// src/components/home/live-meter.tsx
// USDC-settled counter. Snaps to the real value from /api/analytics every
// 5s; between polls it ticks up smoothly using a bounded random drift so
// the meter always feels alive, but never exceeds the next real reading.

'use client';

import { useEffect, useRef, useState } from 'react';
import { useAnalytics } from './use-analytics';

function fmt(n: number) {
  return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function LiveMeter({
  variant = 'hero',
  className = '',
}: {
  variant?: 'hero' | 'strip';
  className?: string;
}) {
  const data = useAnalytics(5000);
  const [display, setDisplay] = useState(0);
  const targetRef = useRef(0);

  useEffect(() => {
    if (data) targetRef.current = data.usdc_24h;
  }, [data]);

  useEffect(() => {
    const id = setInterval(() => {
      setDisplay((d) => {
        const target = targetRef.current;
        // Drift toward target; if behind, catch up; if ahead, hold.
        if (d < target) return d + Math.min(target - d, Math.random() * 0.06 + 0.02);
        return d;
      });
    }, 480);
    return () => clearInterval(id);
  }, []);

  if (variant === 'strip') {
    return (
      <span className={`text-[#8A8E8C] ${className}`}>
        settled 24h <span className="text-[#9DFFB5]">{fmt(display)}</span>
        <span className="text-[#4F5354] mx-2">·</span>
        {data ? data.reqs_24h.toLocaleString() : '—'} reqs
      </span>
    );
  }

  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px]">
        USDC SETTLED · LAST 24H
      </div>
      <div
        className="font-mono font-medium tabular-nums leading-none mt-1.5 text-[#F1F1EE]"
        style={{ fontSize: 64, letterSpacing: -1.5 }}
      >
        {fmt(display)}
        <span
          className="inline-block ml-1.5 align-top bg-[#9DFFB5]"
          style={{ width: 11, height: 56, animation: 'meterBlink 1s steps(2) infinite' }}
        />
      </div>
      <div className="text-[13px] text-[#8A8E8C] font-mono mt-2.5">
        {data ? data.reqs_24h.toLocaleString() : '—'} reqs · ~
        {data ? Math.round(data.reqs_24h / 24 / 60) : '—'}/min
      </div>
      <style>{`@keyframes meterBlink { 50% { opacity: 0.2 } }`}</style>
    </div>
  );
}
