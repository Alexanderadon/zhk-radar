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
  seismicResistance?: number | null;
  source: string;
  scrapedAt: string;
}

export type ParkingType = 'подземный' | 'наземный' | 'смешанный' | 'нет данных';

export type FactorKey = 'guarantee' | 'track' | 'age' | 'stop' | 'courts' | 'reviews';

export interface ScoreFactor {
  key: FactorKey;
  label: string;
  weight: number;
  /** 0..1, or null = нет данных (grey, excluded from the score). */
  value: number | null;
  detail: string;
  source: string | null;
  sourceUrl?: string | null;
  /** true = this factor lowers the score (a risk flag). */
  negative?: boolean;
}

export interface ScoreResult {
  /** 0..100, or null when data completeness is too low to be meaningful. */
  score: number | null;
  band: 'green' | 'amber' | 'red' | 'grey';
  completeness: number; // 0..1 — share of total weight that had data
  factors: ScoreFactor[];
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
}
