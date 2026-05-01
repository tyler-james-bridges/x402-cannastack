import { PriceHistorySearch } from '@/components/price-history-search';

export default function PriceHistoryPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl md:text-4xl font-bold font-mono">price-history</h1>
        <p className="mt-3 text-sm text-white/50 font-mono max-w-xl leading-relaxed">
          Track cannabis price changes over time. Search by strain or dispensary to see historical
          pricing trends and spot the best time to buy.
        </p>

        <div className="mt-10">
          <PriceHistorySearch />
        </div>
      </div>
    </main>
  );
}
