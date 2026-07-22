import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
const D = path.join(process.cwd(), 'data');
const rd = (f) => { const p = path.join(D, f); return existsSync(p) ? JSON.parse(readFileSync(p, 'utf-8')) : []; };
const nameKey = (s) => s.toLowerCase().replace(/[«»"'`]/g, '').replace(/\b(жк|мжк|кг|таунхаусы|жилой комплекс|клубный дом|residence|резиденс)\b/g, '').replace(/[^a-zа-яё0-9]/gi, '').trim();

const korter = existsSync(path.join(D, 'zhk.json')) ? rd('zhk.json') : rd('zhk-raw.json');
const krisha = rd('zhk-krisha.json');
const byName = new Map();
for (const z of korter) if (z.name) byName.set(nameKey(z.name), { ...z, _src: 'korter' });
for (const z of krisha) { if (!z.name || !z.lat || !z.lng) continue; const k = nameKey(z.name); if (!byName.has(k)) byName.set(k, { ...z, _src: 'krisha' }); }
const all = [...byName.values()];

const hasPhoto = (z) => !!((z.realPhotos && z.realPhotos.length) || (z.photos && z.photos.length) || z.image);
const hasImage = (z) => !!z.image; // именно поле для попапа карты
const hasDev = (z) => !!z.developer;
const hasPrice = (z) => !!z.priceSqm;
const hasSeismic = (z) => !!z.seismicResistance;
// grey ≈ нет developer И НЕ (seismic И price). (гарантии КФГЖС по имени не линкуются → ≈0)
const isGrey = (z) => !hasDev(z) && !(hasSeismic(z) && hasPrice(z));

const by = (src) => all.filter((z) => z._src === src);
function stats(list, label) {
  const grey = list.filter(isGrey).length;
  const noImg = list.filter((z) => !hasImage(z)).length;
  const noPhotoAny = list.filter((z) => !hasPhoto(z)).length;
  const noDev = list.filter((z) => !hasDev(z)).length;
  const noPrice = list.filter((z) => !hasPrice(z)).length;
  const noReal = list.filter((z) => !(z.realPhotos && z.realPhotos.length)).length;
  console.log(`\n== ${label} (${list.length}) ==`);
  console.log(`  grey «мало данных»: ${grey} (${Math.round(grey / list.length * 100)}%)`);
  console.log(`  нет image (попап без фото): ${noImg} | нет вообще любого фото: ${noPhotoAny} | нет РЕАЛЬНОГО 2GIS-фото: ${noReal}`);
  console.log(`  нет developer: ${noDev} | нет priceSqm: ${noPrice}`);
}
stats(all, 'ВСЕГО');
stats(by('korter'), 'korter');
stats(by('krisha'), 'krisha');

// пример: Vesper + первые 8 grey
const vesper = all.find((z) => /vesper/i.test(z.name));
console.log('\n== Vesper ==');
if (vesper) console.log(JSON.stringify({ src: vesper._src, name: vesper.name, slug: vesper.slug, developer: vesper.developer?.name, priceSqm: vesper.priceSqm, seismic: vesper.seismicResistance, image: vesper.image ? 'есть' : 'НЕТ', photos: (vesper.photos || []).length, real: (vesper.realPhotos || []).length, class: vesper.classRu, grey: isGrey(vesper) }, null, 1));
else console.log('не найден');

console.log('\n== примеры grey (первые 10) ==');
for (const z of all.filter(isGrey).slice(0, 10)) console.log(`  [${z._src}] ${z.name} | dev:${z.developer ? 'да' : 'нет'} price:${z.priceSqm || '-'} seis:${z.seismicResistance || '-'} img:${z.image ? 'да' : 'нет'}`);
