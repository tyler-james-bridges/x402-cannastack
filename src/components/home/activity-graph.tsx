// src/components/home/activity-graph.tsx
// GitHub-style contribution squares for the index: one cell per day, colored
// by real activity (items crawled + price changes + paid queries). Weeks run
// left→right ending today; rows are weekdays. Right-anchored so small screens
// see the most recent weeks first. Every cell is real history — no theater.

'use client';

import { useAnalytics } from './use-analytics';
import { useCrawlStatus } from './use-crawl-status';
import type { ActivityDay } from '@/lib/analytics-types';

const WEEKS = 26;
// Palette ramp, dark → bright (level 0 = no activity that day)
const LEVELS = ['#15181A', '#123622', '#1A5C36', '#37925B', '#9DFFB5'];

type Cell = { day: string; level: number; title: string } | null;

function score(d: ActivityDay): number {
  // Queries are rare and precious; crawled items are plentiful. Weight so a
  // normal crawl day registers and busy days climb the ramp.
  return d.queries * 25 + d.price_changes + d.items_crawled / 50;
}

function buildCells(activity: ActivityDay[]): Cell[][] {
  const byDay = new Map(activity.map((a) => [a.day, a]));
  const scores = activity.map(score).filter((s) => s > 0).sort((a, b) => a - b);
  const q = (p: number) => scores[Math.min(scores.length - 1, Math.floor(scores.length * p))] ?? 1;
  const thresholds = [q(0.25), q(0.5), q(0.75)];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // End the grid on today's weekday; start WEEKS back on a Sunday.
  const end = new Date(today);
  const start = new Date(end);
  start.setDate(start.getDate() - (WEEKS * 7 - 1) - end.getDay());

  const weeks: Cell[][] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const week: Cell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if (cursor > end) {
        week.push(null);
        continue;
      }
      const key = cursor.toISOString().slice(0, 10);
      const a = byDay.get(key);
      const s = a ? score(a) : 0;
      const level =
        s === 0 ? 0 : s <= thresholds[0] ? 1 : s <= thresholds[1] ? 2 : s <= thresholds[2] ? 3 : 4;
      const pretty = cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const parts = a
        ? [
            a.items_crawled > 0 ? `${a.items_crawled.toLocaleString()} items crawled` : null,
            a.price_changes > 0 ? `${a.price_changes.toLocaleString()} price changes` : null,
            a.queries > 0 ? `${a.queries} paid quer${a.queries === 1 ? 'y' : 'ies'}` : null,
          ].filter(Boolean)
        : [];
      week.push({
        day: key,
        level,
        title: `${pretty} · ${parts.length ? parts.join(' · ') : 'no activity'}`,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}

export function ActivityGraph() {
  const analytics = useAnalytics(60_000);
  const crawl = useCrawlStatus(60_000);

  const weeks = buildCells(analytics?.activity ?? []);
  const metros = (crawl?.metros ?? []).filter((m) => m.enabled);

  return (
    <div className="h-full flex flex-col p-3.5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10px] font-mono text-[#4F5354] tracking-[1.4px]">
          INDEX ACTIVITY · {WEEKS} WEEKS
        </span>
        <span className="hidden sm:flex items-center gap-1 text-[9px] font-mono text-[#4F5354]">
          less
          {LEVELS.map((c) => (
            <span key={c} className="w-[9px] h-[9px] rounded-[2px]" style={{ background: c }} />
          ))}
          more
        </span>
      </div>

      {/* right-anchored: small screens clip the oldest weeks, never the newest */}
      <div className="flex-1 flex items-center justify-end overflow-hidden">
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) =>
                cell ? (
                  <span
                    key={di}
                    title={cell.title}
                    className="w-[11px] h-[11px] sm:w-[13px] sm:h-[13px] rounded-[2px]"
                    style={{ background: LEVELS[cell.level] }}
                  />
                ) : (
                  <span key={di} className="w-[11px] h-[11px] sm:w-[13px] sm:h-[13px]" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-[10px] font-mono text-[#4F5354] leading-relaxed truncate">
        coverage · {metros.length > 0 ? (
          <>
            <span className="text-[#7AB8FF]">{metros.length} metros</span>
            {' · '}
            {metros
              .slice(0, 6)
              .map((m) => m.name.split(',')[0].toLowerCase())
              .join(' · ')}
            {metros.length > 6 ? ` · +${metros.length - 6} more` : ''}
          </>
        ) : (
          '—'
        )}
      </div>
    </div>
  );
}
