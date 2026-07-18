import Link from 'next/link';
import { ENDPOINTS } from '@/lib/endpoints';

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
    <div className="relative min-h-svh bg-[#0B0C0D] text-[#F1F1EE]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_75%_0%,rgba(157,255,181,0.12),transparent_52%)]" />
      <header className="relative border-b border-[#22262A]">
        <div className="mx-auto flex max-w-6xl items-center px-5 py-4 sm:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2.5 font-mono text-xs font-bold tracking-[0.16em]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#9DFFB5]" />
            CANNASTACK
          </Link>
          <nav className="ml-auto flex gap-3 font-mono text-xs text-[#A2A6A4]">
            <Link href="/docs" className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-[#9DFFB5]">Docs</Link>
            <Link href="/status" className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-[#9DFFB5]">Status</Link>
          </nav>
        </div>
      </header>

      <main>
        <div className="relative mx-auto min-w-0 max-w-6xl px-5 sm:px-8">
          <section className="max-w-3xl border-l border-[#314036] py-14 pl-5 sm:py-20 sm:pl-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#9DFFB5]">{eyebrow}</p>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.04] tracking-[-0.035em] sm:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#A2A6A4] sm:text-lg">{subtitle}</p>
          </section>

          <section className="min-w-0 border-t border-[#22262A] py-8 sm:py-10">{children}</section>
        </div>
      </main>

      <footer className="relative mt-10 border-t border-[#22262A]">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-x-6 gap-y-2 px-5 py-6 font-mono text-xs text-[#919793] sm:px-8">
          <span>Cannastack / caller-supplied input only</span>
          <span className="sm:ml-auto">{ENDPOINTS.length} published paid processors</span>
        </div>
      </footer>
    </div>
  );
}
