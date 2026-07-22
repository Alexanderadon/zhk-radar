// ЖК-Радар — enrich each ЖК from its korter detail page:
// structured characteristics (class, parking, floors, tech, walls, ceiling, apartments,
// completion) + seismic resistance parsed from the prose description.
import { readFile, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CLASS_RE = /(эконом|комфорт|бизнес|премиум|элит)/i;

// name-in-detail -> our field
const WANT = {
  'Класс': 'classDetail',
  'Паркинг': 'parking',
  'Этажность': 'floors',
  'Количество домов': 'houses',
  'Технология строительства': 'tech',
  'Стены': 'walls',
  'Высота потолков': 'ceilingHeight',
  'Количество квартир': 'apartments',
  'Отделка квартир': 'finishing',
  'Срок сдачи': 'completion',
};

function parseDetail(html) {
  const out = {};
  const re = /"name":"([^"]+)","value":"([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const field = WANT[m[1]];
    if (field && !(field in out)) out[field] = m[2].trim();
  }
  // class word from "IV класс (эконом)"
  if (out.classDetail) {
    const c = out.classDetail.match(CLASS_RE);
    if (c) out.classNorm = c[1].toLowerCase();
  }
  // floors as number
  if (out.floors) { const n = parseInt(out.floors, 10); if (!isNaN(n)) out.floorsNum = n; }
  // seismic from prose
  const s = html.match(/сейсм[а-яё]*[^<>.]{0,45}?(\d{1,2})\s*балл/i);
  if (s) out.seismicResistance = parseInt(s[1], 10);
  return out;
}

const list = JSON.parse(await readFile('data/zhk-raw.json', 'utf-8'));
let ok = 0, seismic = 0, failed = 0;
for (let i = 0; i < list.length; i++) {
  const z = list[i];
  try {
    const res = await fetch(encodeURI('https://korter.kz' + z.slug), { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
    if (res.status !== 200) { failed++; continue; }
    const det = parseDetail(await res.text());
    Object.assign(z, det);
    if (z.classNorm) z.classRu = z.classNorm;
    ok++;
    if (z.seismicResistance) seismic++;
  } catch { failed++; }
  if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${list.length} (ok ${ok}, seismic ${seismic}, fail ${failed})`);
  await sleep(500);
}
await writeFile('data/zhk.json', JSON.stringify(list, null, 2), 'utf-8');
console.log(`\n✓ enriched ${ok}/${list.length} → data/zhk.json`);
console.log(`  with seismic: ${seismic}  with parking: ${list.filter(z=>z.parking).length}  with class: ${list.filter(z=>z.classNorm).length}  with completion: ${list.filter(z=>z.completion).length}`);
console.log(`  parking types:`, Object.entries(list.reduce((a,z)=>{if(z.parking)a[z.parking]=(a[z.parking]||0)+1;return a;},{})));
console.log(`  classes:`, Object.entries(list.reduce((a,z)=>{a[z.classRu||'?']=(a[z.classRu||'?']||0)+1;return a;},{})));
