// ЖК-Радар — REAL resident photos from 2GIS (geo/view album, ~99% user-shot).
// Hotlink + attribution; keep only copyright.code=='user'. Legal: 2GIS ToS non-commercial/no-store —
// OK for private/dev; needs a 2GIS content licence before public commercial launch.
import { readFile, writeFile } from 'node:fs/promises';
const KEY_CAT = 'ruregt3044', KEY_PHOTO = 'gYu1s9N1wP';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const g = (u) => fetch(u, { headers: { 'User-Agent': UA } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// distinctive tokens of the ЖК name, to guard against attaching the wrong building's photos
const tokens = (s) => s.toLowerCase().replace(/жк|мжк|кг|жилой комплекс|клубный дом|таунхаусы|residence|резиденс/gi, '')
  .replace(/[^a-zа-яё0-9 ]/gi, ' ').split(/\s+/).filter((w) => w.length > 3);

async function resolve(name) {
  const url = `https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent(name + ' Алматы')}&region_id=67&fields=items.address,items.external_content,items.rubrics&key=${KEY_CAT}&locale=ru_KZ`;
  const j = await (await g(url)).json();
  const items = j.result?.items || [];
  if (!items.length) return null;
  const want = new Set(tokens(name));
  const scored = items.map((it) => {
    const view = (it.external_content || []).find((e) => e.subtype === 'view');
    const isZhk = /жил|новострой|комплекс/i.test((it.rubrics || [])[0]?.name || '');
    const itToks = new Set(tokens(it.name || ''));
    const overlap = [...want].filter((w) => [...itToks].some((t) => t.includes(w) || w.includes(t))).length;
    return { it, views: view ? +view.count : 0, isZhk, overlap };
  }).sort((a, b) => (b.overlap - a.overlap) || (b.isZhk - a.isZhk) || (b.views - a.views));
  const best = scored[0];
  if (!best || best.overlap === 0) return null; // name doesn't match -> skip (no wrong photos)
  const objId = best.it.address?.building_id || String(best.it.id).split('_')[0];
  return { objId, views: best.views, matched: best.it.name };
}

async function photos(objId) {
  const j = await (await g(`https://api.photo.2gis.com/2.0/photo/get?object_type=geo&object_id=${objId}&album_code=view&limit=20&key=${KEY_PHOTO}&locale=ru_RU`)).json();
  const list = j.result?.items || j.result?.[0]?.items || [];
  const seen = new Set();
  return list.filter((p) => p.copyright?.code === 'user' && p.url && !seen.has(p.id) && seen.add(p.id))
    .map((p) => ({ url: p.url, author: (p.copyright?.title || p.owner || 'пользователь 2ГИС').trim() })).slice(0, 12);
}

const file = process.argv[2] || 'data/zhk.json';
const list = JSON.parse(await readFile(file, 'utf-8'));
let resolved = 0, withReal = 0, totalPhotos = 0;
for (let i = 0; i < list.length; i++) {
  const z = list[i];
  try {
    const r = await resolve(z.name);
    if (r) { resolved++; if (r.views > 0 && r.objId) { const ph = await photos(r.objId); if (ph.length) { z.realPhotos = ph; z.realPhotoSource = '2gis'; withReal++; totalPhotos += ph.length; } await sleep(250); } }
  } catch {}
  if ((i + 1) % 30 === 0) console.log(`  ${i + 1}/${list.length} (resolved ${resolved}, real-photos ${withReal})`);
  await sleep(250);
}
await writeFile(file, JSON.stringify(list, null, 2), 'utf-8');
console.log(`\n✓ ${file}: resolved ${resolved}/${list.length}, ${withReal} ЖК with REAL photos (${totalPhotos} photos total)`);
