// Key Almaty orientation landmarks (malls, stations, squares) with real coords from Nominatim.
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'zhk-radar/0.1 (personal; fistin103@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PLACES = [
  { q: 'MEGA Alma-Ata, Алматы', name: 'MEGA Alma-Ata', kind: 'mall' },
  { q: 'MEGA Park, Алматы', name: 'MEGA Park', kind: 'mall' },
  { q: 'Esentai Mall, Алматы', name: 'Esentai Mall', kind: 'mall' },
  { q: 'Dostyk Plaza, Алматы', name: 'Dostyk Plaza', kind: 'mall' },
  { q: 'Forum Almaty, Алматы', name: 'Forum', kind: 'mall' },
  { q: 'Almaty Mall, Алматы', name: 'Almaty Mall', kind: 'mall' },
  { q: 'А港 Апорт молл, Алматы', name: 'Aport', kind: 'mall' },
  { q: 'Зелёный базар, Алматы', name: 'Зелёный базар', kind: 'poi' },
  { q: 'Кок-Тобе, Алматы', name: 'Кок-Тобе', kind: 'poi' },
  { q: 'Медеу, Алматы', name: 'Медеу', kind: 'poi' },
  { q: 'Площадь Республики, Алматы', name: 'пл. Республики', kind: 'poi' },
  { q: 'Central Park, Алматы', name: 'Центральный парк', kind: 'poi' },
  { q: 'Железнодорожный вокзал Алматы-2', name: 'Вокзал Алматы-2', kind: 'poi' },
  { q: 'Международный аэропорт Алматы', name: 'Аэропорт', kind: 'poi' },
  { q: 'Almaty Arena, Алматы', name: 'Almaty Arena', kind: 'poi' },
];

const features = [];
for (const p of PLACES) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(p.q)}&format=json&limit=1&accept-language=ru&viewbox=76.7,43.40,77.15,43.10&bounded=1`, { headers: { 'User-Agent': UA } });
    const arr = await r.json();
    const hit = arr[0];
    if (hit) { features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [+hit.lon, +hit.lat] }, properties: { name: p.name, kind: p.kind } }); console.log(`  ✓ ${p.name} ${(+hit.lat).toFixed(3)},${(+hit.lon).toFixed(3)}`); }
    else console.log(`  ✗ ${p.name}`);
  } catch (e) { console.log(`  ✗ ${p.name}: ${e.message}`); }
  await sleep(1100);
}
await mkdir('data', { recursive: true });
const fc = { type: 'FeatureCollection', features };
await writeFile('data/landmarks.geojson', JSON.stringify(fc, null, 1), 'utf-8');
await writeFile('public/landmarks.geojson', JSON.stringify(fc), 'utf-8');
console.log(`\n✓ ${features.length}/${PLACES.length} ориентиров → landmarks.geojson`);
