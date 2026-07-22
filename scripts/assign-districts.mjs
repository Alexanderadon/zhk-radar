// Assign each ЖК to an Almaty district via point-in-polygon against data/districts.geojson.
import { readFile, writeFile } from 'node:fs/promises';

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) && (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function inPolygon(lng, lat, poly) {
  // poly = array of rings; [0]=outer, rest=holes
  if (!pointInRing(lng, lat, poly[0])) return false;
  for (let k = 1; k < poly.length; k++) if (pointInRing(lng, lat, poly[k])) return false;
  return true;
}
function inFeature(lng, lat, geom) {
  if (geom.type === 'Polygon') return inPolygon(lng, lat, geom.coordinates);
  if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => inPolygon(lng, lat, p));
  return false;
}

const districts = JSON.parse(await readFile('data/districts.geojson', 'utf-8')).features;

async function tag(file) {
  let list;
  try { list = JSON.parse(await readFile(file, 'utf-8')); } catch { console.log('skip', file); return; }
  let hit = 0;
  for (const z of list) {
    if (!z.lat || !z.lng) continue;
    const d = districts.find((f) => inFeature(z.lng, z.lat, f.geometry));
    if (d) { z.district = d.properties.name; z.districtColor = d.properties.color; hit++; }
  }
  await writeFile(file, JSON.stringify(list, null, 2), 'utf-8');
  const byD = {}; for (const z of list) if (z.district) byD[z.district] = (byD[z.district] || 0) + 1;
  console.log(`${file}: ${hit}/${list.length} assigned`, byD);
}

await tag('data/zhk.json');
await tag('data/zhk-krisha.json');
await tag('data/listings.json');
