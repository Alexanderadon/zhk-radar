/**
 * Привязка квартир krisha к нашим ЖК.
 *
 * У квартиры krisha есть числовой complexId, у нашей карточки ЖК — слаг
 * страницы krisha (и только у тех, что пришли из krisha). Общего ключа нет.
 * Склеиваем в два прохода:
 *  1. «page» — точно: со страницы ЖК на krisha читаем data-id (это и есть
 *     complexId), имя ЖК krisha сводим к нашей записи через matchKey. Результат
 *     проверяем геометрией — если квартиры комплекса лежат далеко от точки
 *     ЖК, страница указала не туда, и такую пару не берём.
 *  2. «centroid» — запасной: медианная точка квартир комплекса и ближайший ЖК
 *     того же города. Только если он в радиусе и второй кандидат заметно
 *     дальше — соседние корпуса разных ЖК угадывать нельзя.
 *
 * Чистые функции без IO, чтобы их можно было прогнать node --test.
 */

export type Pt = { lat: number; lng: number };
export type ZhkLite = { id: number; name: string; lat: number | null; lng: number | null; citySlug: string };
export type AptLite = { complexId: number | null; lat: number; lng: number; city: string };
export type LinkHow = 'page' | 'centroid';
export type ComplexLink = { zhk: number; how: LinkHow; dist: number };
export type ComplexMap = Record<number, ComplexLink>;

/** Ближе этого запасной путь считается совпадением. */
const CENTROID_MAX_M = 250;
/** Второй кандидат должен быть хотя бы во столько раз дальше первого. */
const CENTROID_MIN_MARGIN = 1.5;
/** Точная привязка со страницы отвергается, если квартиры дальше этого от ЖК. */
const PAGE_SANITY_M = 600;

/**
 * Ключ имени для склейки. В отличие от nameKey из data.ts режет служебные
 * слова и по-русски: там стоит \b, а он в JS не знает кириллицы, и «ЖК Каспий»
 * с «Каспий» не склеиваются.
 */
export function matchKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'`]/g, ' ')
    .replace(/(^|[^a-zа-яё0-9])(жк|мжк|кг|таунхаусы|жилой комплекс|клубный дом|residence|резиденс)(?=$|[^a-zа-яё0-9])/g, '$1')
    .replace(/[^a-zа-яё0-9]/gi, '');
}

/**
 * complexId со страницы ЖК krisha. Якоря по надёжности: window.data.complex.id
 * (объект самой страницы), data-views-id блока телефона, и только потом data-id
 * кнопок. Последний обманчив: у ЖК с несколькими очередями там id соседей,
 * а complex-id="…" встречается сотнями — это списки других ЖК.
 */
export function parseComplexId(html: string): number | null {
  // страница сама говорит, кто она: window.data = {"complex":{"id":…}}
  const js = html.match(/window\.data\s*=\s*\{\s*"complex"\s*:\s*\{\s*"id"\s*:\s*(\d{5,10})/);
  if (js) return Number(js[1]);
  const views = html.match(/data-views-type="complex"\s+data-views-id="(\d{5,10})"/);
  if (views) return Number(views[1]);
  // последний шанс — data-id кнопок «в избранное»/«позвонить»; у ЖК с очередями
  // так лежат id соседей, поэтому при разночтении не гадаем
  const counts = new Map<number, number>();
  for (const m of html.matchAll(/\bdata-id="(\d{6,9})"/g)) {
    const id = Number(m[1]);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  if (!counts.size) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return null;
  return sorted[0][0];
}

export function haversineM(a: Pt, b: Pt): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Медианная точка: одно объявление с левым геокодом центр не сдвигает. */
export function centroid(pts: Pt[]): Pt {
  return { lat: median(pts.map((p) => p.lat)), lng: median(pts.map((p) => p.lng)) };
}

export function groupByComplex(apts: AptLite[]): Map<number, { pts: Pt[]; city: string }> {
  const out = new Map<number, { pts: Pt[]; city: string }>();
  for (const a of apts) {
    if (!a.complexId || !a.lat || !a.lng) continue;
    const g = out.get(a.complexId);
    if (g) g.pts.push({ lat: a.lat, lng: a.lng });
    else out.set(a.complexId, { pts: [{ lat: a.lat, lng: a.lng }], city: a.city });
  }
  return out;
}

export function matchByCentroid(
  c: Pt,
  zhks: ZhkLite[],
  city: string,
  opts: { maxDist?: number; minMargin?: number } = {},
): { zhk: ZhkLite; dist: number } | null {
  const maxDist = opts.maxDist ?? CENTROID_MAX_M;
  const minMargin = opts.minMargin ?? CENTROID_MIN_MARGIN;
  const ranked = zhks
    .filter((z) => z.citySlug === city && z.lat != null && z.lng != null)
    .map((z) => ({ zhk: z, dist: haversineM(c, { lat: z.lat as number, lng: z.lng as number }) }))
    .sort((a, b) => a.dist - b.dist);
  const best = ranked[0];
  if (!best || best.dist > maxDist) return null;
  const second = ranked[1];
  if (second && second.dist < best.dist * minMargin) return null;
  return best;
}

export function linkComplexes(args: {
  apartments: AptLite[];
  zhks: ZhkLite[];
  /** записи krisha из zhk-krisha.json — у них есть слаг страницы */
  krishaZhks: { slug: string; name: string }[];
  /** слаг страницы → complexId, собрано scripts/fetch-complex-ids.mjs */
  slugToComplexId: Record<string, number | null>;
}): { map: ComplexMap; stats: { complexes: number; page: number; centroid: number; unmatched: number; pageRejected: number } } {
  const { apartments, zhks, krishaZhks, slugToComplexId } = args;
  const groups = groupByComplex(apartments);
  const map: ComplexMap = {};
  const stats = { complexes: groups.size, page: 0, centroid: 0, unmatched: 0, pageRejected: 0 };

  // имя → наши ЖК (одно имя может встретиться в нескольких городах)
  const byKey = new Map<string, ZhkLite[]>();
  for (const z of zhks) {
    const k = matchKey(z.name);
    if (!k) continue;
    const arr = byKey.get(k);
    if (arr) arr.push(z); else byKey.set(k, [z]);
  }

  // 1. точный путь
  for (const kz of krishaZhks) {
    const id = slugToComplexId[kz.slug];
    if (!id) continue;
    const g = groups.get(id);
    if (!g || map[id]) continue;
    const candidates = (byKey.get(matchKey(kz.name)) ?? []).filter((z) => z.citySlug === g.city && z.lat != null && z.lng != null);
    if (!candidates.length) continue;
    const c = centroid(g.pts);
    const ranked = candidates
      .map((z) => ({ zhk: z, dist: haversineM(c, { lat: z.lat as number, lng: z.lng as number }) }))
      .sort((a, b) => a.dist - b.dist);
    if (ranked[0].dist > PAGE_SANITY_M) { stats.pageRejected++; continue; }
    map[id] = { zhk: ranked[0].zhk.id, how: 'page', dist: Math.round(ranked[0].dist) };
    stats.page++;
  }

  // 2. запасной путь для остального
  for (const [id, g] of groups) {
    if (map[id]) continue;
    const m = matchByCentroid(centroid(g.pts), zhks, g.city);
    if (m) { map[id] = { zhk: m.zhk.id, how: 'centroid', dist: Math.round(m.dist) }; stats.centroid++; }
    else stats.unmatched++;
  }

  return { map, stats };
}
