export interface RawDispensary {
  source: string;
  sourceId: string;
  name: string;
  slug?: string;
  address?: string;
  city?: string;
  state?: string;
  lat?: number;
  lng?: number;
  type?: string;
  rating?: number;
  reviewsCount?: number;
  hasDeals?: boolean;
  webUrl?: string;
}

export interface RawMenuItem {
  sourceItemId?: string;
  name: string;
  category?: string;
  brand?: string;
  genetics?: string;
  description?: string;
  thcPct?: number;
  cbdPct?: number;
  priceUnit?: number;
  priceHalfGram?: number;
  priceGram?: number;
  priceEighth?: number;
  priceQuarter?: number;
  priceHalfOunce?: number;
  priceOunce?: number;
  orderable?: boolean;
}

export interface DataSourceAdapter {
  name: string;
  findDispensaries(lat: number, lng: number, radiusMi: number): Promise<RawDispensary[]>;
  fetchMenu(sourceId: string): Promise<RawMenuItem[]>;
}

export interface ExtractedDispensary {
  dispensary: RawDispensary;
  menuItems: RawMenuItem[];
}

export type CrawlRunStatus = 'running' | 'success' | 'failed';

export type CrawlRunStage = 'setup' | 'extract' | 'transform' | 'load' | 'cleanup';

export interface CrawlWarning {
  stage: CrawlRunStage;
  message: string;
  sourceId?: string;
  itemName?: string;
}

export interface Metro {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radius_mi: number;
  enabled: boolean;
}

export interface CrawlResult {
  runId?: number;
  metroId: number;
  source: string;
  status?: CrawlRunStatus;
  dispensariesFound: number;
  itemsCrawled: number;
  itemsNew: number;
  itemsUpdated: number;
  itemsSkipped?: number;
  itemsStale?: number;
  errors: number;
  warningCount?: number;
  durationMs: number;
}
