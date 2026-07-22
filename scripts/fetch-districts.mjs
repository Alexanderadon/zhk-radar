// ЖК-Радар — Almaty district boundaries (8 районов) as GeoJSON, from Nominatim (OSM).
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'zhk-radar/0.1 (personal project; contact fistin103@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// name -> display color (distinct per district)
const DISTRICTS = [
  { name: 'Алатауский', color: '#e67e22' },
  { name: 'Алмалинский', color: '#3498db' },
  { name: 'Ауэзовский', color: '#9b59b6' },
  { name: 'Бостандыкский', color: '#1abc9c' },
  { name: 'Жетысуский', color: '#e74c3c' },
  { name: 'Медеуский', color: '#2ecc71' },
  { name: 'Наурызбайский', color: '#f1c40f' },
  { name: 'Турксибский', color: '#e84393' },
];

const features = [];
for (const d of DISTRICTS) {
  const q = encodeURIComponent(`${d.name} район, Алматы`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&polygon_geojson=1&limit=1&accept-language=ru`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    const arr = await res.json();
    const hit = arr.find((x) => x.geojson && /Polygon/i.test(x.geojson.type));
    if (hit) {
      features.push({
        type: 'Feature',
        properties: { name: d.name, color: d.color, osm_id: hit.osm_id, display: hit.display_name },
        geometry: hit.geojson,
      });
      console.log(`  ✓ ${d.name}: ${hit.geojson.type} (osm ${hit.osm_id})`);
    } else {
      console.log(`  ✗ ${d.name}: no polygon (${arr[0]?.type || 'nothing'})`);
    }
  } catch (e) { console.log(`  ✗ ${d.name}: ${e.message}`); }
  await sleep(1100); // Nominatim rate limit
}
await mkdir('data', { recursive: true });
await writeFile('data/districts.geojson', JSON.stringify({ type: 'FeatureCollection', features }, null, 1), 'utf-8');
console.log(`\n✓ ${features.length}/8 districts → data/districts.geojson`);
