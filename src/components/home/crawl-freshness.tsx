// Tiny client island: relative time + crawler-health dot for the index
// freshness line. Everything around it stays server-rendered.

'use client';

import { useEffect, useState } from 'react';

const CRAWL_INTERVAL_H = 6;

export function CrawlFreshness({ lastCrawl }: { lastCrawl: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!lastCrawl) {
    return (
      <span className="text-[13px] font-mono text-[#4F5354]">
        index warming up · first crawl pending
      </span>
    );
  }

  const ageMs = now - new Date(lastCrawl).getTime();
  const ageH = ageMs / 3_600_000;
  const h = Math.floor(ageH);
  const m = Math.floor((ageMs % 3_600_000) / 60_000);
  const ago = h > 0 ? `${h}h ${m}m ago` : `${m}m ago`;

  const color = ageH < CRAWL_INTERVAL_H ? '#9DFFB5' : ageH < 12 ? '#FFB976' : '#FF7361';
  const nextH = Math.max(0, Math.ceil(CRAWL_INTERVAL_H - ageH));

  return (
    <span className="text-[13px] font-mono text-[#8A8E8C] inline-flex items-center gap-2">
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
      />
      {ageH >= 12 ? (
        <>crawler behind · last run <span style={{ color }}>{ago}</span></>
      ) : (
        <>
          last crawl <span style={{ color }}>{ago}</span>
          <span className="text-[#4F5354]">· next in ~{nextH}h</span>
        </>
      )}
    </span>
  );
}
