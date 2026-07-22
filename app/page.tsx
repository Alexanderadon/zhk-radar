import HomeClient, { type HomeZhk } from '../components/HomeClient';
import { getAllZhk, getStats } from '../lib/data';

export const dynamic = 'force-static';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Home() {
  const all = getAllZhk();
  const stats = getStats();
  const zhks: HomeZhk[] = all.map((z) => ({
    id: z.id,
    slug: z.slug,
    name: z.name,
    district: z.district,
    lat: z.lat,
    lng: z.lng,
    priceSqm: z.priceSqm,
    priceMin: z.priceMin,
    classRu: z.classRu,
    constructionStatusRu: z.constructionStatusRu,
    developer: z.developer ? { name: z.developer.name, slug: z.developer.slug } : null,
    parkingType: z.parkingType,
    seismicResistance: z.seismicResistance ?? null,
    image: z.image,
    band: z.scoreResult.band,
    score: z.scoreResult.score,
  }));
  return <HomeClient zhks={zhks} freshness={formatDate(stats.scrapedAt)} />;
}
