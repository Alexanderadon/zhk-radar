// Cross-check my point-in-polygon district assignment against Nominatim reverse-geocode.
import { readFile } from 'node:fs/promises';
const UA = 'zhk-radar/0.1 (personal; fistin103@gmail.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const list = JSON.parse(await readFile('data/zhk.json', 'utf-8')).filter((z) => z.lat && z.lng && z.district);
// sample ~3 per district
const byD = {};
for (const z of list) { (byD[z.district] ||= []).push(z); }
const sample = [];
for (const d of Object.keys(byD)) sample.push(...byD[d].slice(0, 3));

const norm = (s) => (s || '').replace(/\s*район\s*/i, '').replace(/ауданы?/i, '').trim().toLowerCase();
let ok = 0, bad = 0, unknown = 0;
for (const z of sample) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${z.lat}&lon=${z.lng}&format=json&accept-language=ru&zoom=14`;
  try {
    const j = await (await fetch(url, { headers: { 'User-Agent': UA } })).json();
    const a = j.address || {};
    const nomD = a.city_district || a.district || a.county || a.suburb || a.municipality || '';
    const match = norm(nomD).includes(norm(z.district)) || norm(z.district).includes(norm(nomD));
    if (!nomD) { unknown++; console.log(`  ? ${z.name} | мой: ${z.district} | Nominatim: (нет района) [${a.suburb || a.neighbourhood || ''}]`); }
    else if (match) { ok++; }
    else { bad++; console.log(`  ✗ ${z.name} | мой: ${z.district} | Nominatim: ${nomD} | addr: ${z.address || ''}`); }
  } catch (e) { console.log('  err', z.name, e.message); }
  await sleep(1100);
}
console.log(`\nСовпало: ${ok}/${sample.length} | расхождений: ${bad} | Nominatim без района: ${unknown}`);
