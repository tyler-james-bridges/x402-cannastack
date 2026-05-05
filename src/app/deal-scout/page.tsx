import { PageShell } from '@/components/home/page-shell';
import { DealScoutSearch } from '@/components/deal-scout-search';

export const metadata = {
  title: 'Deal Scout · cannastack',
  description: 'Find dispensaries with active deals near you. Filter by category.',
};

export default function DealScoutPage() {
  return (
    <PageShell
      eyebrow="deal-scout · $0.02"
      title={
        <>
          Find dispensaries running<br />
          <span className="text-[#9DFFB5]">deals near you, right now.</span>
        </>
      }
      subtitle="Active sales and specials, sorted by rating. Optionally filter by product category. US locations only."
    >
      <DealScoutSearch />
    </PageShell>
  );
}
