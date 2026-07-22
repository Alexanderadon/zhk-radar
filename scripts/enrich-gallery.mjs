// ЖК-Радар — pull the full photo gallery + floor-plan layouts from each korter detail page.
import { readFile, writeFile } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extract(html) {
  const photoIds = [], layoutIds = [], seenP = new Set(), seenL = new Set();
  for (const m of html.matchAll(/storage\.googleapis\.com\/[a-z0-9\-]+\/buildings-v2\/\d+x\d+\/(\d+)\.jpg/gi)) {
    if (!seenP.has(m[1])) { seenP.add(m[1]); photoIds.push(m[1]); }
  }
  for (const m of html.matchAll(/storage\.googleapis\.com\/[a-z0-9\-]+\/layouts-v2\/\d+x\d+\/(\d+)\.jpg/gi)) {
    if (!seenL.has(m[1])) { seenL.add(m[1]); layoutIds.push(m[1]); }
  }
  const photos = photoIds.slice(0, 12).map((id) => `https://storage.googleapis.com/bd-kz-01/buildings-v2/840x630/${id}.jpg`);
  const layouts = layoutIds.slice(0, 8).map((id) => `https://storage.googleapis.com/bd-kz-01/layouts-v2/340x340/${id}.jpg`);
  return { photos, layouts };
}

const list = JSON.parse(await readFile('data/zhk.json', 'utf-8'));
let ok = 0, withPhotos = 0;
for (let i = 0; i < list.length; i++) {
  const z = list[i];
  try {
    const res = await fetch(encodeURI('https://korter.kz' + z.slug), { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
    if (res.status === 200) {
      const { photos, layouts } = extract(await res.text());
      z.photos = photos.length ? photos : (z.image ? [z.image] : []);
      z.layouts = layouts;
      ok++;
      if (photos.length) withPhotos++;
    }
  } catch {}
  if ((i + 1) % 30 === 0) console.log(`  ${i + 1}/${list.length} (photos ${withPhotos})`);
  await sleep(350);
}
await writeFile('data/zhk.json', JSON.stringify(list, null, 2), 'utf-8');
console.log(`\n✓ ${ok}/${list.length} enriched, ${withPhotos} with photo galleries`);
console.log(`  avg photos: ${(list.reduce((a, z) => a + (z.photos?.length || 0), 0) / list.length).toFixed(1)}, avg layouts: ${(list.reduce((a, z) => a + (z.layouts?.length || 0), 0) / list.length).toFixed(1)}`);
