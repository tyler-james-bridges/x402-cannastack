import { PageShell } from '@/components/home/page-shell';
import { PriceHistorySearch } from '@/components/price-history-search';

export const metadata = {
  title: 'Price History',
  description:
    'Track cannabis price changes over time by strain or dispensary. Spot trends and the best time to buy.',
};

export default function PriceHistoryPage() {
  return (
    <PageShell
      eyebrow="price-history · $0.02"
      title={
        <>
          Has the price<br />
          <span className="text-[#9DFFB5]">moved this week?</span>
        </>
      }
      subtitle="Track price changes over time by strain or dispensary. See trend, percent change, and every recorded data point."
    >
      <PriceHistorySearch />
    </PageShell>
  );
}
