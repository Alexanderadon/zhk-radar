// ЖК-Радар — обогатить korter-ЖК этапами (очереди) + срок сдачи (квартал) с детальных страниц.
import { readFile, writeFile } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parse(html) {
  // очереди
  const queues = [...new Set([...html.matchAll(/"queueId":\d+,"name":"([^"]{1,40})"/g)].map((m) => m[1].trim()))];
  // срок сдачи: берём самый поздний квартал "N кв. 20YY" / "IV кв 20YY"
  const qs = [...html.matchAll(/([IVX]{1,3}|[1-4])\s*кв\.?\s*(20[2-3]\d)/gi)].map((m) => ({ q: m[1], y: +m[2], raw: `${m[1]} кв. ${m[2]}` }));
  let completion = null;
  if (qs.length) { qs.sort((a, b) => b.y - a.y); completion = qs[0].raw; }
  // домов/подъездов в продаже
  const houses = [...html.matchAll(/"houseId":\d+,"salesStatus":"([a-z]+)"/g)].map((m) => m[1]);
  const housesAvail = houses.filter((s) => s === 'available').length;
  return { queues, completion, housesTotal: houses.length, housesAvail };
}

const list = JSON.parse(await readFile('data/zhk.json', 'utf-8'));
let ok = 0, withQ = 0, withC = 0;
for (let i = 0; i < list.length; i++) {
  const z = list[i];
  if (z.source !== 'korter' && !z.slug?.startsWith('/жк') && !z.slug?.startsWith('/')) continue;
  try {
    const res = await fetch(encodeURI('https://korter.kz' + z.slug), { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
    if (res.status === 200) {
      const p = parse(await res.text());
      if (p.queues.length) { z.queues = p.queues; withQ++; }
      if (p.completion) { z.completion = p.completion; withC++; }
      z.housesTotal = p.housesTotal; z.housesAvail = p.housesAvail;
      ok++;
    }
  } catch {}
  if ((i + 1) % 30 === 0) console.log(`  ${i + 1}/${list.length} (queues ${withQ}, completion ${withC})`);
  await sleep(320);
}
await writeFile('data/zhk.json', JSON.stringify(list, null, 2), 'utf-8');
console.log(`\n✓ ${ok}/${list.length} | очереди у ${withQ}, срок сдачи у ${withC}`);
