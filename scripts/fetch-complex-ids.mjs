// Сопоставление ЖК krisha (слаг страницы) с числовым complexId, которым krisha
// помечает объявления о квартирах. Общего ключа в данных нет: карточки ЖК мы
// знаем по слагу, квартиры — по числу. Число лежит на странице ЖК в data-id.
//
// Результат — data/krisha-complex-ids.json: { [slug]: complexId | null }.
// Скрипт возобновляемый: уже известные слаги не запрашивает.
//
//   node scripts/fetch-complex-ids.mjs            # все недостающие
//   node scripts/fetch-complex-ids.mjs --force    # перепроверить всё
import fs from 'node:fs';
import path from 'node:path';
import { parseComplexId } from '../lib/linkComplexes.ts';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const SRC = path.join(ROOT, 'data', 'zhk-krisha.json');
const OUT = path.join(ROOT, 'data', 'krisha-complex-ids.json');
const FORCE = process.argv.includes('--force');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const zhks = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const known = fs.existsSync(OUT) && !FORCE ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};

// null — страница не отдала id (или отдала неоднозначно): пробуем снова
const todo = zhks.filter((z) => z.slug && (!(z.slug in known) || known[z.slug] === null));
console.log(`ЖК krisha: ${zhks.length}, уже известно: ${Object.keys(known).length}, запросить: ${todo.length}`);

let done = 0, ok = 0, miss = 0, fail = 0;
for (const z of todo) {
  const url = `https://krisha.kz${z.slug}`;
  let id = null;
  for (let attempt = 0; attempt < 2 && id === null; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
      if (r.status === 404) { id = null; break; }
      if (!r.ok) { await sleep(1500); continue; }
      id = parseComplexId(await r.text());
      break;
    } catch {
      await sleep(1500);
    }
  }
  known[z.slug] = id;
  if (id) ok++; else miss++;
  done++;
  if (done % 25 === 0) {
    fs.writeFileSync(OUT, JSON.stringify(known, null, 1));
    console.log(`  ${done}/${todo.length} · найдено ${ok} · без id ${miss}`);
  }
  await sleep(450);
}
fs.writeFileSync(OUT, JSON.stringify(known, null, 1));
console.log(`✓ готово: найдено ${ok}, без id ${miss}, ошибок ${fail}. Всего в карте: ${Object.keys(known).length}`);
