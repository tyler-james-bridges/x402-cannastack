import { PageShell } from '@/components/home/page-shell';

export const metadata = {
  title: 'Status',
  description: 'Cannastack public data service retirement status.',
};

export default function StatusPage() {
  return (
    <PageShell
      eyebrow="Status / retired"
      title={<>Public data service: retired.</>}
      subtitle="This is a deliberate service state, not an availability incident. Data access remains disabled pending an authorized provider."
    >
      <section className="max-w-3xl overflow-hidden rounded-lg border border-[#314036] bg-[#101512]">
        <div className="flex items-center gap-3 border-b border-[#314036] px-5 py-4 sm:px-7">
          <span className="h-2.5 w-2.5 rounded-full bg-[#A2A6A4]" />
          <h2 className="font-mono text-xs uppercase tracking-[0.16em]">Retired by policy</h2>
        </div>
        <dl className="divide-y divide-[#22262A] px-5 sm:px-7">
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]"><dt className="text-sm text-[#A2A6A4]">Data endpoints</dt><dd className="text-sm">0 active</dd></div>
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]"><dt className="text-sm text-[#A2A6A4]">Legacy requests</dt><dd className="text-sm">HTTP 410 Gone</dd></div>
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]"><dt className="text-sm text-[#A2A6A4]">x402 challenges</dt><dd className="text-sm">Not issued for retired routes</dd></div>
          <div className="grid gap-1 py-5 sm:grid-cols-[12rem_1fr]"><dt className="text-sm text-[#A2A6A4]">Reactivation condition</dt><dd className="text-sm">An authorized data provider</dd></div>
        </dl>
      </section>
    </PageShell>
  );
}
