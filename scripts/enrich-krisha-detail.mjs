// ЖК-Радар — дообогащение krisha-ЖК (витрина) с их детальных страниц:
// реальные фото + цена + адрес + класс + ЗАСТРОЙЩИК (из меты «застройщика X - актуальные…»).
// Застройщик даёт индикатор «Надёжность» → ЖК перестаёт быть «мало данных».
// Legal: krisha ToS — только личное/троттлинг; фото kcdn хотлинк (как в остальном пайплайне).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const g = (u) => fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const devKey = (s) => s.toLowerCase().replace(/\b(тоо|ао|ип|оао|зао|llp|ilc|компания)\b/g, '').replace(/[^a-zа-яё0-9]/gi, '');
const CLASSES = ['эконом', 'комфорт', 'бизнес', 'премиум', 'элит'];

// карта застройщиков из korter (переиспользуем id/slug, чтобы krisha-ЖК влились в тот же портфель)
const korter = existsSync('data/zhk.json') ? JSON.parse(readFileSync('data/zhk.json', 'utf-8')) : [];
const devMap = new Map();
for (const z of korter) if (z.developer?.name) devMap.set(devKey(z.developer.name), z.developer);
let synth = 810000000;
function resolveDev(name) {
  const clean = name.replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  const key = devKey(clean);
  if (!key || key.length < 2) return null;
  if (devMap.has(key)) return devMap.get(key);
  const slug = '/' + clean.toLowerCase().replace(/тоо|ао\b/g, '').replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  const d = { id: synth++, name: clean, slug };
  devMap.set(key, d);
  return d;
}

function parse(html) {
  const out = {};
  const wd = html.match(/window\.data\s*=\s*(\{[\s\S]*?\});/);
  if (wd) {
    try {
      const c = JSON.parse(wd[1]).complex || {};
      const photos = (c.photos || []).map((p) => p.src).filter(Boolean);
      if (photos.length) { out.image = photos[0]; out.photos = photos.slice(0, 12); }
      else if (c.previewPhoto) out.image = c.previewPhoto.replace(/-120x90/, '-750x470');
      if (c.priceSquareFrom) out.priceSqm = c.priceSquareFrom;
      if (c.priceFrom) out.priceMin = c.priceFrom;
      if (c.address) out.address = c.address;
      const lay = (c.layouts || []).map((l) => l.mainPhotoLarge || l.mainPhoto2x || l.mainPhotoSmall).filter(Boolean);
      if (lay.length) out.layouts = lay.slice(0, 12);
    } catch {}
  }
  // застройщик из меты
  const dm = html.match(/застройщика\s+(.+?)\s+-\s+актуальны/i);
  if (dm) out.developerName = dm[1].replace(/&quot;|&laquo;|&raquo;|«|»/g, '').trim();
  // класс жилья
  const cm = html.match(/Класс жилья[\s\S]{0,140}?>\s*([А-Яа-яЁё]{4,20})\s*</i) || html.match(/"class":"(эконом|комфорт|бизнес|премиум|элит)"/i);
  if (cm) { const cl = cm[1].toLowerCase(); if (CLASSES.includes(cl)) out.classRu = cl; }
  return out;
}

const list = JSON.parse(readFileSync('data/zhk-krisha.json', 'utf-8'));
let ok = 0, withPhoto = 0, withDev = 0, withPrice = 0;
for (let i = 0; i < list.length; i++) {
  const z = list[i];
  if (!z.slug) continue;
  try {
    const res = await g('https://krisha.kz' + z.slug);
    if (res.status !== 200) { await sleep(200); continue; }
    const p = parse(await res.text());
    if (p.image && !z.image) { z.image = p.image; withPhoto++; }
    if (p.photos && (!z.photos || !z.photos.length)) z.photos = p.photos;
    if (p.layouts && (!z.layouts || !z.layouts.length)) z.layouts = p.layouts;
    if (p.priceSqm && !z.priceSqm) { z.priceSqm = p.priceSqm; withPrice++; }
    if (p.priceMin && !z.priceMin) z.priceMin = p.priceMin;
    if (p.address && !z.address) z.address = p.address;
    if (p.classRu && !z.classRu) { z.classRu = p.classRu; z.class = p.classRu; }
    if (p.developerName && !z.developer) { const d = resolveDev(p.developerName); if (d) { z.developer = d; withDev++; } }
    ok++;
  } catch {}
  if ((i + 1) % 40 === 0) { console.log(`  ${i + 1}/${list.length} (ok ${ok}, фото +${withPhoto}, застр +${withDev}, цена +${withPrice})`); writeFileSync('data/zhk-krisha.json', JSON.stringify(list, null, 2), 'utf-8'); }
  await sleep(230);
}
writeFileSync('data/zhk-krisha.json', JSON.stringify(list, null, 2), 'utf-8');
console.log(`\n✓ ${ok}/${list.length} обработано | фото +${withPhoto} | застройщик +${withDev} | цена +${withPrice}`);
