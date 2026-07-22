export type ConstructionStatus = 'ready' | 'construction' | 'project' | 'suspended' | string;

export interface Developer {
  id: number;
  name: string;
  slug: string;
}

/** Raw ЖК as scraped from korter + enriched from detail pages. */
export interface ZhkRaw {
  id: number;
  slug: string;
  name: string;
  address: string | null;
  city: string;
  district: string | null;
  districtColor?: string | null;
  lat: number | null;
  lng: number | null;
  priceSqm: number | null;
  priceMin: number | null;
  class: string | null;
  classRu: string | null;
  classNorm?: string | null;
  classDetail?: string | null;
  salesStatus: string | null;
  constructionStatus: ConstructionStatus | null;
  constructionStatusRu: string | null;
  developer: Developer | null;
  phone: string | null;
  image: string | null;
  parking?: string | null;
  floors?: string | null;
  floorsNum?: number | null;
  houses?: string | null;
  tech?: string | null;
  walls?: string | null;
  ceilingHeight?: string | null;
  apartments?: string | null;
  finishing?: string | null;
  completion?: string | null;
  queues?: string[];
  housesTotal?: number;
  housesAvail?: number;
  seismicResistance?: number | null;
  photos?: string[];
  layouts?: string[];
  /** real resident photos from 2GIS (hotlinked, attributed). */
  realPhotos?: { url: string; author: string }[];
  realPhotoSource?: string;
  source: string;
  scrapedAt: string;
}

export type ParkingType = 'подземный' | 'наземный' | 'смешанный' | 'нет данных';

export type Band = 'green' | 'amber' | 'red' | 'grey';

/** One named dimension, each on its own 0–100 scale (gradation matters). */
export interface Indicator {
  key: 'money' | 'reliability' | 'seismic' | 'price';
  name: string;
  /** 0..100, or null = нет данных (grey). */
  score: number | null;
  band: Band;
  /** short human interpretation of the value, e.g. "10 баллов", "на 18% дороже медианы". */
  value: string;
  detail: string;
  weight: number;
  sourceType: 'первоисточник' | 'витрина';
  source: string | null;
  sourceUrl?: string | null;
}

export interface ScoreResult {
  /** overall headline 0..100 (weighted mean of available indicators), or null. */
  score: number | null;
  band: Band;
  completeness: number; // 0..1 — share of total weight that had data
  indicators: Indicator[];
}

export interface ScoreContext {
  /** median price/m² by classRu across the catalog, for the price indicator. */
  classMedian: Record<string, number>;
  overallMedian: number;
}

export interface DeveloperStats {
  id: number;
  name: string;
  slug: string;
  total: number;
  ready: number;
  construction: number;
  project: number;
  suspended: number;
  deliveredRatio: number;
}

/** КЖК guarantee match for one developer or object. */
export interface GuaranteeMatch {
  status: 'active' | 'guarantee-case' | 'completed' | null;
  contract?: string;
  object?: string;
  date?: string;
  matchedBy: 'developer' | 'object' | null;
}

export interface Zhk extends ZhkRaw {
  parkingType: ParkingType;
  developerStats: DeveloperStats | null;
  guarantee: GuaranteeMatch | null;
  scoreResult: ScoreResult;
  /** good-value flag: cheaper than its class median AND not high-risk. */
  deal: boolean;
}
