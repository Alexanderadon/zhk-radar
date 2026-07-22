// ЖК-Радар — ориентиры Алматы (ТРЦ, парки, озёра, вокзалы) с фото + данными о месте из 2GIS.
// Каталог 2GIS даёт координаты, рубрику, рейтинг, число отзывов и обложку фотоальбома (main_photo_url).
// Legal: 2GIS ToS non-commercial/no-store — OK для private/dev; лицензия перед публичным коммерч. запуском.
import { writeFile, mkdir } from 'node:fs/promises';
const KEY_CAT = 'ruregt3044';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const g = (u) => fetch(u, { headers: { 'User-Agent': UA } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// q — точный запрос; name — как показать; kind — для цвета/иконки; want — тип-фильтр (не брать остановку вместо озера)
const PLACES = [
  { q: 'MEGA Alma-Ata Алматы', name: 'MEGA Alma-Ata', kind: 'mall' },
  { q: 'MEGA Park Алматы', name: 'MEGA Park', kind: 'mall' },
  { q: 'Esentai Mall Алматы', name: 'Esentai Mall', kind: 'mall' },
  { q: 'Dostyk Plaza Алматы', name: 'Dostyk Plaza', kind: 'mall' },
  { q: 'Forum Almaty Алматы ТРЦ', name: 'Forum', kind: 'mall' },
  { q: 'Almaty Mall Алматы', name: 'Almaty Mall', kind: 'mall' },
  { q: 'Aport Mall Алматы', name: 'Aport', kind: 'mall' },
  { q: 'ADK Алматы торговый центр', name: 'ADK', kind: 'mall' },
  { q: 'Grand Park Алматы ТРЦ', name: 'Grand Park', kind: 'mall' },
  { q: 'Максима Алматы ТРЦ', name: 'MAXIMA', kind: 'mall' },
  { q: 'Парк Первого Президента Алматы', name: 'Парк Первого Президента', kind: 'park' },
  { q: 'Центральный парк культуры и отдыха Алматы', name: 'Центральный парк', kind: 'park' },
  { q: 'Парк 28 гвардейцев-панфиловцев Алматы', name: 'Парк 28 панфиловцев', kind: 'park' },
  { q: 'Ботанический сад Алматы', name: 'Ботанический сад', kind: 'park' },
  { q: 'Парк Ганди Алматы', name: 'Парк Ганди', kind: 'park' },
  { q: 'Озеро Сайран Алматы', name: 'Озеро Сайран', kind: 'water' },
  { q: 'Каток Медеу Алматы', name: 'Медеу', kind: 'water' },
  { q: 'Зелёный базар Алматы', name: 'Зелёный базар', kind: 'poi' },
  { q: 'Кок-Тобе Алматы', name: 'Кок-Тобе', kind: 'poi' },
  { q: 'Площадь Республики Алматы', name: 'пл. Республики', kind: 'poi' },
  { q: 'Атакент Алматы', name: 'Атакент', kind: 'poi' },
  { q: 'Almaty Arena Алматы', name: 'Almaty Arena', kind: 'poi' },
  { q: 'Halyk Arena Алматы', name: 'Halyk Arena', kind: 'poi' },
  { q: 'Железнодорожный вокзал Алматы-2', name: 'Вокзал Алматы-2', kind: 'transport' },
  { q: 'Железнодорожный вокзал Алматы-1', name: 'Вокзал Алматы-1', kind: 'transport' },
  { q: 'Международный аэропорт Алматы', name: 'Аэропорт Алматы', kind: 'transport' },
];

function addr(it) {
  if (it.address_name) return it.address_name;
  if (typeof it.address === 'string') return it.address;
  const c = it.address?.components?.find((x) => x.street || x.number);
  if (c) return [c.street, c.number].filter(Boolean).join(' ');
  return null;
}

const features = [];
let withPhoto = 0, withRating = 0;
for (const p of PLACES) {
  try {
    const url = `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(p.q)}&region_id=67&fields=items.point,items.address,items.external_content,items.rubrics,items.reviews,items.description&key=${KEY_CAT}&locale=ru_KZ`;
    const j = await (await g(url)).json();
    const items = (j.result?.items || []).filter((it) => it.point);
    // предпочитаем объект с рубрикой/фото (не остановку/станцию без данных)
    const it = items.find((x) => (x.rubrics || []).length || (x.external_content || []).length) || items[0];
    if (!it) { console.log(`  ✗ ${p.name} — нет результата`); continue; }
    const ec = (it.external_content || []).find((e) => e.main_photo_url) || null;
    const photo = ec?.main_photo_url || null;
    const rubric = (it.rubrics || [])[0]?.name || null;
    const rating = it.reviews?.general_rating || it.reviews?.org_rating || null;
    const reviewCount = it.reviews?.general_review_count || it.reviews?.org_review_count || null;
    const props = {
      name: p.name, kind: p.kind,
      rubric, rating: rating || undefined, reviews: reviewCount || undefined,
      address: addr(it) || undefined, photo: photo || undefined,
      desc: (it.description || '').slice(0, 160) || undefined,
    };
    Object.keys(props).forEach((k) => props[k] === undefined && delete props[k]);
    features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [it.point.lon, it.point.lat] }, properties: props });
    if (photo) withPhoto++; if (rating) withRating++;
    console.log(`  ✓ ${p.name} [${p.kind}] ${rating ? '★' + rating : '—'} ${photo ? '📷' : ''} ${rubric || ''}`);
  } catch (e) { console.log(`  ✗ ${p.name}: ${e.message}`); }
  await sleep(300);
}
await mkdir('data', { recursive: true });
const fc = { type: 'FeatureCollection', features };
await writeFile('data/landmarks.geojson', JSON.stringify(fc, null, 1), 'utf-8');
await writeFile('public/landmarks.geojson', JSON.stringify(fc), 'utf-8');
console.log(`\n✓ ${features.length}/${PLACES.length} ориентиров · фото у ${withPhoto} · рейтинг у ${withRating} → landmarks.geojson`);
