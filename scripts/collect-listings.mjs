// ЖК-Радар — apartment LISTINGS (первичка+вторичка) from krisha map API, grid bbox scrape.
// ajax-map-list?bounds=northLat,westLon,southLat,eastLon&page=N -> adverts{id:{price,rooms,square,map:{lat,lon},complexId,...}}
// market: complexId>0 => 'primary' (новостройка), else 'secondary' (вторичка).
// NB: krisha ToS restricts automated extraction — personal use, throttled, cached.
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'ru', 'X-Requested-With': 'XMLHttpRequest', 'Referer': 'https://krisha.kz/map/prodazha/kvartiry/almaty/' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (u) => fetch(u, { headers: H }).then((r) => r.json());

// Almaty bbox grid
const LAT0 = 43.14, LAT1 = 43.37, LON0 = 76.74, LON1 = 77.12;
const ROWS = 7, COLS = 9, MAXPAGE = 42;
const dLat = (LAT1 - LAT0) / ROWS, dLon = (LON1 - LON0) / COLS;

function floorOf(t) { const m = (t || '').match(/(\d+)\/(\d+)\s*этаж/); return m ? `${m[1]}/${m[2]}` : null; }

const byId = new Map();
let cells = 0, reqs = 0;
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const n = LAT1 - r * dLat, s = n - dLat, w = LON0 + c * dLon, e = w + dLon;
    cells++;
    for (let page = 1; page <= MAXPAGE; page++) {
      let j;
      try { j = await g(`https://krisha.kz/a/ajax-map-list/map/prodazha/kvartiry/almaty/?bounds=${n.toFixed(4)},${w.toFixed(4)},${s.toFixed(4)},${e.toFixed(4)}&page=${page}`); }
      catch { break; }
      reqs++;
      const adv = j.adverts && typeof j.adverts === 'object' ? Object.values(j.adverts) : [];
      if (!adv.length) break;
      let fresh = 0;
      for (const a of adv) {
        if (!a.map || !a.map.lat || byId.has(a.id)) continue;
        byId.set(a.id, {
          id: a.id, lat: a.map.lat, lng: a.map.lon,
          price: a.price || null, rooms: a.rooms || null, square: a.square || null,
          floor: floorOf(a.title), addr: a.addressTitle || null,
          complexId: a.complexId || null, market: a.complexId ? 'primary' : 'secondary',
          photo: (a.photos && a.photos[0] && a.photos[0].src) || null,
        });
        fresh++;
      }
      await sleep(220);
      if (adv.length < 20) break; // last page of this cell
    }
    if (cells % 9 === 0) console.log(`  ряд ${r + 1}/${ROWS} готов | всего ${byId.size} квартир (${reqs} запросов)`);
  }
}
const list = [...byId.values()];
const prim = list.filter((x) => x.market === 'primary').length;
await mkdir('data', { recursive: true });
await writeFile('data/listings.json', JSON.stringify(list), 'utf-8');
console.log(`\n✓ ${list.length} квартир → data/listings.json | первичка ${prim}, вторичка ${list.length - prim} | ${reqs} запросов`);
