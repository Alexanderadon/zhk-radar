import HomeClient, { type HomeZhk } from '../components/HomeClient';
import { getAllZhk } from '../lib/data';

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
    band: z.scoreResult.band,
    score: z.scoreResult.score,
    deal: z.deal,
    real: !!(z.realPhotos && z.realPhotos.length),
  }));
  return <HomeClient zhks={zhks} />;
}
