import { PageShell } from '@/components/home/page-shell';
import { PriceCompareSearch } from '@/components/price-compare-search';

export const metadata = {
  title: 'Price Compare · cannastack',
  description:
    'Compare cannabis prices across nearby dispensaries. Filter by category and genetics.',
};

export default function PriceComparePage() {
  return (
    <PageShell
      eyebrow="price-compare · $0.02"
      title={
        <>
          Compare prices on any category,<br />
          <span className="text-[#9DFFB5]">across every menu near you.</span>
        </>
      }
      subtitle="Pick a category, filter by genetics, see min/avg/max plus a sorted list of products. US locations only."
    >
      <PriceCompareSearch />
    </PageShell>
  );
}
