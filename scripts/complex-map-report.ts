// Отчёт о привязке квартир к ЖК: сколько квартир покрыто, что отвергнуто и почему.
//   node scripts/complex-map-report.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { linkComplexes, groupByComplex, centroid, haversineM, matchKey, type AptLite, type ZhkLite } from '../lib/linkComplexes.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const read = <T,>(p: string): T => JSON.parse(readFileSync(path.join(ROOT, p), 'utf8'));

// финальный список ЖК собирает data.ts (TS с импортами без расширений — Node его не
// прочитает), поэтому здесь повторяем только то, что нужно отчёту: id, имя, точка, город
const korter = read<any[]>('data/zhk.json');
const krisha = read<any[]>('data/zhk-krisha.json');
const byKey = new Map<string, any>();
const nameKey = (s: string) => s.toLowerCase().replace(/[«»"'`]/g, '').replace(/\b(жк|мжк|кг|таунхаусы|жилой комплекс|клубный дом|residence|резиденс)\b/g, '').replace(/[^a-zа-яё0-9]/gi, '');
for (const z of korter) if (z.name) byKey.set(nameKey(z.name), { ...z, citySlug: 'almaty' });
for (const z of krisha) if (z.name && z.lat && z.lng && !byKey.has(nameKey(z.name))) byKey.set(nameKey(z.name), { ...z, citySlug: 'almaty' });
const zhks: ZhkLite[] = [...byKey.values()].map((z) => ({ id: z.id, name: z.name, lat: z.lat, lng: z.lng, citySlug: 'almaty' }));

const apts = read<any[]>('public/listings.json');
const apartments: AptLite[] = apts.filter((a) => a.complexId).map((a) => ({ complexId: a.complexId, lat: a.lat, lng: a.lng, city: 'almaty' }));
const slugToComplexId = read<Record<string, number | null>>('data/krisha-complex-ids.json');

const { map, stats } = linkComplexes({ apartments, zhks, krishaZhks: krisha, slugToComplexId });
console.log('Алматы, комплексов:', stats);

const covered = apartments.filter((a) => map[a.complexId!]).length;
console.log(`квартир первички: ${apartments.length}, привязано: ${covered} (${(covered / apartments.length * 100).toFixed(1)}%)`);

// топ непривязанных по числу квартир — что мы теряем
const groups = groupByComplex(apartments);
const lost = [...groups.entries()].filter(([id]) => !map[id]).sort((a, b) => b[1].pts.length - a[1].pts.length).slice(0, 8);
console.log('\nкрупнейшие без привязки (complexId, квартир, адрес первой):');
for (const [id, g] of lost) {
  const first = apts.find((a) => a.complexId === id);
  const c = centroid(g.pts);
  const near = zhks.filter((z) => z.lat && z.lng).map((z) => ({ n: z.name, d: Math.round(haversineM(c, { lat: z.lat!, lng: z.lng! })) })).sort((a, b) => a.d - b.d).slice(0, 2);
  console.log(`  ${id}  ${String(g.pts.length).padStart(4)}  ${first?.addr ?? ''}  → ближайшие: ${near.map((x) => `${x.n} (${x.d} м)`).join(', ')}`);
}

// отвергнутые точные привязки — страница указала не туда, или у ЖК левая точка
console.log('\nотвергнутые «page» (квартиры дальше 600 м от точки ЖК):');
for (const kz of krisha) {
  const id = slugToComplexId[kz.slug]; if (!id) continue;
  const g = groups.get(id); if (!g) continue;
  const z = zhks.find((z) => matchKey(z.name) === matchKey(kz.name));
  if (!z || !z.lat) continue;
  const d = Math.round(haversineM(centroid(g.pts), { lat: z.lat, lng: z.lng! }));
  if (d > 600) console.log(`  ${kz.name.padEnd(28)} ${String(g.pts.length).padStart(3)} кв · ${d} м · сейчас: ${map[id] ? map[id].how : 'нет'}`);
}
