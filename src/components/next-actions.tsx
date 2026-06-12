'use client';

// Renders the `next_actions` block that every paid endpoint returns — the
// human half of the workflow. Each chip links to the matching tool page with
// the suggested params prefilled. Navigation never auto-runs a paid call;
// the user always presses RUN (and pays) themselves.

export type NextAction = {
  action: string;
  description: string;
  endpoint: string;
  body: Record<string, unknown>;
  price_usdc: number;
};

function href(a: NextAction): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(a.body)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const q = qs.toString();
  return `/${a.endpoint}${q ? `?${q}` : ''}`;
}

export function NextActionChips({ actions }: { actions?: NextAction[] }) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-6 pt-4 border-t border-[#22262A]">
      <div className="text-[10px] font-mono text-[#4F5354] tracking-[1.4px] mb-2">
        NEXT · keep digging
      </div>
      <div className="flex flex-col gap-1.5">
        {actions.map((a) => (
          <a
            key={a.action}
            href={href(a)}
            className="block px-3 py-2 rounded border border-[#22262A] bg-[#111315] hover:border-[#9DFFB5]/50 hover:bg-[#142219] group"
          >
            <span className="text-xs text-[#F1F1EE] group-hover:text-[#9DFFB5]">
              {a.description}
            </span>
            <span className="font-mono text-[10px] text-[#4F5354] ml-2">
              /{a.endpoint} · ${a.price_usdc.toFixed(2)}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/**
 * Read prefill values from the page URL (?strain=…&location=…) on the client.
 * Plain window.location read inside useEffect — keeps pages statically
 * prerenderable (no useSearchParams/Suspense requirement).
 */
export function readPrefill(keys: string[]): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const q = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = q.get(k);
    if (v) out[k] = v;
  }
  return out;
}
