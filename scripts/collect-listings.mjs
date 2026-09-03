// ЖК-Радар — ВСЕ квартиры Алматы (первичка+вторичка) с krisha map-API.
// Рекурсивное дробление bbox: плотный квадрат (упёрся в лимит страниц) делится на 4 и т.д.
// Diff с прошлым снимком: что продали (исчезло) / добавили за день. NB: krisha ToS — личное, throttle.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ru', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://krisha.kz/map/prodazha/kvartiry/almaty/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CAP = 45, MAXDEPTH = 8; // упёрся в CAP полных страниц → дробим; глубина рекурсии
const floorOf = (t) => { const m = (t || '').match(/(\d+)\/(\d+)\s*этаж/); return m ? `${m[1]}/${m[2]}` : null; };
const thumb = (p) => { const s = p && p[0] && p[0].src; return s ? s.replace(/-full\.(jpg|jpeg|webp)/i, '-400x300.$1') : null; };

const byId = new Map();
let reqs = 0, cells = 0;

async function page(n, w, s, e, p) {
  const url = `https://krisha.kz/a/ajax-map-list/map/prodazha/kvartiry/almaty/?bounds=${n.toFixed(4)},${w.toFixed(4)},${s.toFixed(4)},${e.toFixed(4)}&page=${p}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { const j = await (await fetch(url, { headers: H })).json(); reqs++; return j; } catch { await sleep(600); }
  }
  return null;
}
function absorb(adv) {
  for (const a of adv) {
    if (!a.map || !a.map.lat || byId.has(a.id)) continue;
    byId.set(a.id, { id: a.id, lat: +a.map.lat.toFixed(6), lng: +a.map.lon.toFixed(6), price: a.price || null, rooms: a.rooms || null, square: a.square || null, floor: floorOf(a.title), addr: a.addressTitle || null, complexId: a.complexId || null, market: a.complexId ? 'primary' : 'secondary', photo: thumb(a.photos) });
  }
}

async function scrape(n, w, s, e, depth) {
  const j = await page(n, w, s, e, 1);
  const adv = j && j.adverts && typeof j.adverts === 'object' ? Object.values(j.adverts) : [];
  if (!adv.length) return;
  absorb(adv);
  await sleep(160);
  // много страниц? дробим (если ещё можно), иначе долистываем
  const dense = adv.length >= 20;
  if (dense && depth < MAXDEPTH) {
    const mlat = (n + s) / 2, mlon = (w + e) / 2;
    await scrape(n, w, mlat, mlon, depth + 1);
    await scrape(n, mlon, mlat, e, depth + 1);
    await scrape(mlat, w, s, mlon, depth + 1);
    await scrape(mlat, mlon, s, e, depth + 1);
  } else if (dense) {
    // достигли макс. глубины — долистываем до CAP
    for (let p = 2; p <= CAP; p++) {
      const jj = await page(n, w, s, e, p);
      const a2 = jj && jj.adverts ? Object.values(jj.adverts) : [];
      if (!a2.length) break;
      absorb(a2);
      await sleep(160);
      if (a2.length < 20) break;
    }
  }
  cells++;
  if (cells % 40 === 0) console.log(`  узлов ${cells} | квартир ${byId.size} | запросов ${reqs}`);
}

// широкий bbox — весь город + пригороды
await scrape(43.40, 76.70, 43.05, 77.20, 0);

const list = [...byId.values()];
const prim = list.filter((x) => x.market === 'primary').length;

// diff с прошлым снимком
let sold = 0, added = 0, soldRecent = [];
if (existsSync('data/listings.json')) {
  try {
    const prev = JSON.parse(await readFile('data/listings.json', 'utf-8'));
    const now = new Set(list.map((x) => x.id));
    const prevIds = new Set(prev.map((x) => x.id));
    added = list.filter((x) => !prevIds.has(x.id)).length;
    const soldList = prev.filter((x) => !now.has(x.id));
    sold = soldList.length;
    // накопить недавно проданные (для слоя «продано»)
    const today = new Date().toISOString().slice(0, 10);
    if (existsSync('data/listings-sold.json')) { try { soldRecent = JSON.parse(await readFile('data/listings-sold.json', 'utf-8')); } catch {} }
    soldRecent.push(...soldList.map((x) => ({ ...x, soldDate: today })));
    soldRecent = soldRecent.slice(-3000);
  } catch {}
}

await mkdir('data', { recursive: true });
await writeFile('data/listings.json', JSON.stringify(list), 'utf-8');
await writeFile('data/listings-sold.json', JSON.stringify(soldRecent), 'utf-8');
// Сколько прошло с прошлого снимка. Если обновление пропускали, «+N за день»
// было бы враньём: цифры накоплены за весь пропущенный период.
let intervalDays = 1;
try {
  const prevMeta = JSON.parse(await readFile('data/listings-meta.json', 'utf-8'));
  if (prevMeta.updatedAt) {
    const d = (Date.now() - new Date(prevMeta.updatedAt).getTime()) / 86400000;
    intervalDays = Math.max(1, Math.round(d));
  }
} catch {}
const meta = { updatedAt: new Date().toISOString(), intervalDays, total: list.length, primary: prim, secondary: list.length - prim, addedToday: added, soldToday: sold, soldRecent: soldRecent.length, requests: reqs };
await writeFile('data/listings-meta.json', JSON.stringify(meta, null, 1), 'utf-8');
console.log(`\n✓ ${list.length} квартир (первичка ${prim}, вторичка ${list.length - prim}) | +${added} новых, −${sold} продано | ${reqs} запросов`);
