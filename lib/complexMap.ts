import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { linkComplexes, type AptLite, type ZhkLite, type ComplexMap } from './linkComplexes';
import { CITIES } from './cities';

const DATA = path.join(process.cwd(), 'data');
const PUBLIC = path.join(process.cwd(), 'public');

const readJSON = <T,>(file: string, fallback: T): T => {
  if (!existsSync(file)) return fallback;
  try { return JSON.parse(readFileSync(file, 'utf8')) as T; } catch { return fallback; }
};

/**
 * complexId krisha → наш ЖК. Считается на сборке: квартиры уже лежат в public/,
 * ЖК — в data/, а слаг→complexId собирает scripts/fetch-complex-ids.mjs.
 * В клиент уходит только сама карта (сотни записей), не 60 тысяч квартир.
 */
export function buildComplexMap(zhks: ZhkLite[]): { map: ComplexMap; stats: ReturnType<typeof linkComplexes>['stats'] } {
  const apartments: AptLite[] = [];
  for (const c of CITIES) {
    const file = path.join(PUBLIC, c.slug === 'almaty' ? 'listings.json' : `listings-${c.slug}.json`);
    const rows = readJSON<{ complexId: number | null; lat: number; lng: number }[]>(file, []);
    for (const r of rows) if (r.complexId) apartments.push({ complexId: r.complexId, lat: r.lat, lng: r.lng, city: c.slug });
  }
  const krishaZhks = readJSON<{ slug: string; name: string }[]>(path.join(DATA, 'zhk-krisha.json'), []);
  const slugToComplexId = readJSON<Record<string, number | null>>(path.join(DATA, 'krisha-complex-ids.json'), {});
  return linkComplexes({ apartments, zhks, krishaZhks, slugToComplexId });
}
