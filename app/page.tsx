import HomeClient, { type HomeZhk } from '../components/HomeClient';
import { getAllZhk } from '../lib/data';
import { buildComplexMap } from '../lib/complexMap';

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
  return <HomeClient zhks={zhks} complexMap={complexMap} />;
}
