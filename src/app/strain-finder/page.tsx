import { PageShell } from '@/components/home/page-shell';
import { StrainFinderSearch } from '@/components/strain-finder-search';

export const metadata = {
  title: 'Strain Finder · cannastack',
  description:
    'Find which dispensaries near you carry a specific strain. Cross-dispensary search sorted by price.',
};

export default function StrainFinderPage() {
  return (
    <PageShell
      eyebrow="strain-finder · $0.02"
      title={
        <>
          Find a strain across<br />
          <span className="text-[#9DFFB5]">every menu nearby.</span>
        </>
      }
      subtitle="Search a strain across every dispensary menu in range. Sorted cheapest first. US locations only."
    >
      <StrainFinderSearch />
    </PageShell>
  );
}
