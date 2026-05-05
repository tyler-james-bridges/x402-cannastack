import Link from 'next/link';
import { LiveMeter } from './live-meter';

export function PageShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#0B0C0D] text-[#F1F1EE] font-sans">
      <div className="flex items-center gap-4 px-6 py-3 border-b border-[#22262A] text-xs font-mono">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-wide hover:text-[#9DFFB5]">
          <span className="w-2.5 h-2.5 bg-[#9DFFB5] rounded-sm shadow-[0_0_12px_#9DFFB5]" />
          CANNASTACK
        </Link>
        <span className="text-[#4F5354]">/</span>
        <span className="text-[#8A8E8C] truncate">{eyebrow}</span>
        <LiveMeter variant="strip" className="ml-auto" />
      </div>

      <section className="px-6 lg:px-9 py-8 border-b border-[#22262A]">
        <Link
          href="/"
          className="text-[11px] font-mono text-[#4F5354] tracking-[1.4px] hover:text-[#9DFFB5]"
        >
          ← BACK
        </Link>
        <h1 className="text-[36px] lg:text-[44px] font-semibold leading-[1.04] tracking-[-1px] mt-3">
          {title}
        </h1>
        <p className="text-base text-[#8A8E8C] mt-3 leading-relaxed max-w-[640px]">{subtitle}</p>
      </section>

      <section className="px-6 lg:px-9 py-7">{children}</section>

      <footer className="px-6 lg:px-9 py-6 border-t border-[#22262A] text-xs font-mono text-[#4F5354] flex flex-wrap gap-4">
        <span>cannastack · public cannabis data, priced like an API call</span>
      </footer>
    </main>
  );
}
