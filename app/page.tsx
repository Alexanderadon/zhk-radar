import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import HomeClient, { type HomeZhk } from '../components/HomeClient';
import type { IntroData } from '../components/Landing';
import { getAllZhk } from '../lib/data';
import { buildComplexMap } from '../lib/complexMap';
import { CITIES } from '../lib/cities';

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
 * Цифры и пример карточки для первого экрана. Всё считается из тех же файлов,
 * что и карта, — на лендинге не может оказаться число, которого нет в данных.
 */
function introData(all: ReturnType<typeof getAllZhk>): IntroData {
  let apartments = 0;
  let updatedAt: string | null = null;
  for (const c of CITIES) {
    const f = path.join(process.cwd(), 'data', c.slug === 'almaty' ? 'listings-meta.json' : `listings-meta-${c.slug}.json`);
    if (!existsSync(f)) continue;
    try {
      const m = JSON.parse(readFileSync(f, 'utf-8'));
      apartments += Number(m.total) || 0;
      if (m.updatedAt && (!updatedAt || m.updatedAt > updatedAt)) updatedAt = m.updatedAt;
    } catch {}
  }
  const cities = CITIES.map((c) => ({ slug: c.slug, name: c.name, count: all.filter((z) => ((z as any).citySlug ?? 'almaty') === c.slug).length }));

  // Пример — зелёный ЖК Алматы с фото, ценой и всеми четырьмя показателями:
  // на первом экране должна стоять полная карточка, а не «мало данных».
  const full = (z: (typeof all)[number]) => z.scoreResult.indicators.filter((i) => i.score != null).length;
  const pick = all
    .filter((z) => ((z as any).citySlug ?? 'almaty') === 'almaty' && z.scoreResult.band === 'green' && z.image && z.priceMin && full(z) >= 3)
    .sort((a, b) => full(b) - full(a) || (b.realPhotos?.length ? 1 : 0) - (a.realPhotos?.length ? 1 : 0) || (b.scoreResult.score ?? 0) - (a.scoreResult.score ?? 0))[0];

  return {
    zhkTotal: all.length,
    developers: new Set(all.map((z) => z.developer?.id).filter(Boolean)).size,
    apartments,
    updatedAt,
    cities,
    showcase: pick ? {
      slug: pick.slug, name: pick.name, developer: pick.developer?.name ?? null, district: pick.district,
      image: pick.realPhotos?.[0]?.url ?? pick.image!, priceMin: pick.priceMin, priceSqm: pick.priceSqm,
      score: pick.scoreResult.score, band: pick.scoreResult.band,
      indicators: pick.scoreResult.indicators.map((i) => ({ key: i.key, name: i.name, score: i.score, band: i.band, value: i.value })),
    } : null,
  };
}
