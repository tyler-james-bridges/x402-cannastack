const ROWS: { name: string; price: number; desc: string; href?: string }[] = [
  { name: 'strain-finder', price: 0.02, desc: 'cross-menu strain search', href: '/strain-finder' },
  { name: 'price-compare', price: 0.02, desc: 'category price spread',    href: '/price-compare' },
  { name: 'deal-scout',    price: 0.02, desc: 'active deals nearby',      href: '/deal-scout' },
  { name: 'price-history', price: 0.02, desc: 'price changes over time',  href: '/price-history' },
];

export function RateCard() {
  return (
    <div>
      <div className="text-[11px] font-mono text-[#4F5354] tracking-[1.6px] mb-3">ENDPOINTS</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {ROWS.map((r) => {
          const inner = (
            <>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[13px] font-semibold text-[#F1F1EE]">{r.name}</span>
                <span className="font-mono text-[13px] text-[#9DFFB5]">${r.price.toFixed(2)}</span>
              </div>
              <div className="text-[11px] text-[#8A8E8C] mt-1">{r.desc}</div>
            </>
          );
          return r.href ? (
            <a key={r.name} href={r.href} className="block border border-[#22262A] hover:border-[#9DFFB5]/40 px-3.5 py-3 rounded bg-[#111315] transition-colors">
              {inner}
            </a>
          ) : (
            <div key={r.name} className="border border-[#22262A] px-3.5 py-3 rounded bg-[#111315]">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
