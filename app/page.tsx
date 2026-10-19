import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import HomeClient, { type HomeZhk } from '../components/HomeClient';
import type { IntroData } from '../components/Landing';
import { getAllZhk } from '../lib/data';
import { buildComplexMap } from '../lib/complexMap';
import { CITIES } from '../lib/cities';
import { buildHeroMap } from '../lib/heroMap';

export const dynamic = 'force-static';

export default function Home() {
  const all = getAllZhk();
  const zhks: HomeZhk[] = all.map((z) => ({
    id: z.id,
    slug: z.slug,
    citySlug: (z as any).citySlug ?? 'almaty',
    name: z.name,
    district: z.district,
    districtColor: z.districtColor ?? null,
    lat: z.lat,
    lng: z.lng,
    priceSqm: z.priceSqm,
    priceMin: z.priceMin,
    classRu: z.classRu,
    constructionStatus: z.constructionStatus ?? null,
    constructionStatusRu: z.constructionStatusRu,
    salesStatus: z.salesStatus ?? null,
    developer: z.developer ? { name: z.developer.name, slug: z.developer.slug } : null,
    parkingType: z.parkingType,
    seismicResistance: z.seismicResistance ?? null,
    finishing: z.finishing ?? null,
    image: z.image,
    // до пяти снимков на карточку в списке: реальные фото (2GIS) вперёд, потом
    // рендеры застройщика. Пять — компромисс: 841 ЖК × 5 ссылок ≈ 330 КБ до
    // сжатия, полный набор весил бы втрое больше и лежал бы в HTML каждой загрузки.
    photos: Array.from(new Set([...(z.realPhotos ?? []).map((p) => p.url), ...(z.photos ?? []), ...(z.image ? [z.image] : [])])).slice(0, 5),
    photoCount: new Set([...(z.realPhotos ?? []).map((p) => p.url), ...(z.photos ?? []), ...(z.image ? [z.image] : [])]).size,
    band: z.scoreResult.band,
    score: z.scoreResult.score,
    deal: z.deal,
    real: !!(z.realPhotos && z.realPhotos.length),
  }));
  // квартира → ЖК: единственное, чего нет ни у krisha, ни у korter
  const { map, stats } = buildComplexMap(zhks.map((z) => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng, citySlug: z.citySlug })));
  if (process.env.NODE_ENV !== 'production' || process.env.VERCEL) {
    console.log(`[complexMap] комплексов ${stats.complexes}: по странице ${stats.page}, по центроиду ${stats.centroid}, без привязки ${stats.unmatched}, отвергнуто ${stats.pageRejected}`);
  }
  const complexMap: Record<number, { zhk: number; how: 'page' | 'centroid' }> = {};
  for (const [k, v] of Object.entries(map)) complexMap[Number(k)] = { zhk: v.zhk, how: v.how };
  return <HomeClient zhks={zhks} complexMap={complexMap} intro={introData(all)} />;
}

/**
 * Данные первого экрана. Всё считается из тех же файлов, что и карта, — на
 * лендинге не может оказаться число, которого нет в данных.
 */
function introData(all: ReturnType<typeof getAllZhk>): IntroData {
  let apartments = 0;
  for (const c of CITIES) {
    const f = path.join(process.cwd(), 'data', c.slug === 'almaty' ? 'listings-meta.json' : `listings-meta-${c.slug}.json`);
    if (!existsSync(f)) continue;
    try {
      const m = JSON.parse(readFileSync(f, 'utf-8'));
      apartments += Number(m.total) || 0;
    } catch {}
  }
  const cities = CITIES.map((c) => ({ slug: c.slug, name: c.name, count: all.filter((z) => ((z as any).citySlug ?? 'almaty') === c.slug).length }));
  const { map, example } = buildHeroMap(all);
  // иллюстрации и скрины лежат в public/landing; блок рисуется, только если файл есть
  const has = (f: string) => existsSync(path.join(process.cwd(), 'public', 'landing', f));

  return {
    zhkTotal: all.length,
    apartments,
    cities,
    heroMap: map,
    example,
    assets: {
      promise: has('promise-1200.webp'),
      stalled: has('stalled-1200.webp'),
      shotDesk: has('zhk-desktop.webp'),
      shotMob: has('zhk-mobile.webp'),
    },
  };
}
