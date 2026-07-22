// ЖК-Радар — krisha.kz second catalog collector (SSR). Polite throttle.
// NB: krisha ToS §5.3/5.4 restrict automated extraction — personal use, low rate, cached.
// Listing gives name/status/price/m²; detail gives coordinates + developer + class.
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (u) => fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });

function parseListing(html) {
  const out = [];
  const segs = html.split('data-complex-alias="');
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const alias = seg.slice(0, seg.indexOf('"'));
    if (!alias || !/^almaty\//i.test(alias)) continue;
    const name = (seg.match(/data-name="([^"]*)"/) || [])[1] || null;
    const region = (seg.match(/data-complex-region="([^"]*)"/) || [])[1] || null;
    const state = (seg.match(/complex-card__state">\s*([^<]+?)\s*</) || [])[1] || null;
    const priceSqm = (() => {
      const p = seg.match(/square-price">\s*от\s*([\d\s]+)\s*₸/);
      return p ? parseInt(p[1].replace(/\s/g, ''), 10) : null;
    })();
    out.push({ alias, name, region, state, priceSqm });
  }
  // dedup by alias
  const seen = new Set();
  return out.filter((c) => { if (seen.has(c.alias)) return false; seen.add(c.alias); return true; });
}

const STATUS = (s) => {
  if (!s) return null;
  if (/сда|заселе|введ/i.test(s)) return 'ready';
  if (/строящ|строится/i.test(s)) return 'construction';
  if (/проект|котлован/i.test(s)) return 'project';
  return 'construction';
};

function parseDetail(html) {
  const m = html.match(/"lat":\s*(4[0-9]\.\d+),\s*"lon":\s*(7[0-9]\.\d+)/);
  const dev = (html.match(/Застройщик[^<]*<[^>]*>\s*<[^>]*>\s*([^<]{2,60})</) || [])[1]
    || (html.match(/"builder"[^}]*?"name":"([^"]{2,60})"/) || [])[1] || null;
  const klass = (html.match(/Класс[^<]*<\/[^>]*>\s*<[^>]*>\s*([А-Яа-яё-]+)/) || [])[1] || null;
  const priceMin = (() => { const p = html.match(/"minPrice":\s*(\d{6,})/) || html.match(/от\s*([\d\s]{7,})\s*₸/); return p ? parseInt(p[1].replace(/\s/g, ''), 10) : null; })();
  return { lat: m ? +m[1] : null, lng: m ? +m[2] : null, developer: dev ? dev.trim() : null, klass, priceMin };
}

const CLASS_RE = /(эконом|комфорт|бизнес|премиум|элит)/i;

async function main() {
  // 1) listing pages
  const cards = [];
  for (let page = 1; page <= 61; page++) {
    let html;
    try { const r = await g(`https://krisha.kz/complex/search/almaty/?page=${page}`); if (r.status !== 200) { console.log(`  listing ${page}: HTTP ${r.status}`); break; } html = await r.text(); }
    catch (e) { console.log(`  listing ${page}: ${e.message}`); break; }
    const c = parseListing(html);
    let fresh = 0;
    for (const x of c) if (!cards.find((y) => y.alias === x.alias)) { cards.push(x); fresh++; }
    if (page % 10 === 0 || fresh === 0) console.log(`  listing ${page}: +${fresh} (total ${cards.length})`);
    if (c.length === 0) break;
    await sleep(350);
  }
  console.log(`listing done: ${cards.length} unique complexes`);

  // 2) detail pages for coordinates
  const scrapedAt = new Date().toISOString();
  const out = [];
  let ok = 0, geo = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    let d = {};
    try { const r = await g(`https://krisha.kz/complex/show/${c.alias}/`); if (r.status === 200) d = parseDetail(await r.text()); }
    catch {}
    if (d.lat) geo++;
    const classNorm = (c.name && (c.name.match(CLASS_RE) || [])[1]) || (d.klass && (d.klass.match(CLASS_RE) || [])[1]) || null;
    out.push({
      id: 900000000 + i,
      slug: `/complex/show/${c.alias}`,
      name: c.name || c.alias.split('/')[1],
      address: null,
      city: 'Алматы',
      district: null,
      lat: d.lat, lng: d.lng,
      priceSqm: c.priceSqm, priceMin: d.priceMin || null,
      class: classNorm, classRu: classNorm, classNorm,
      salesStatus: null,
      constructionStatus: STATUS(c.state), constructionStatusRu: null,
      developer: d.developer ? { id: 800000000 + hash(d.developer), name: d.developer, slug: '/krisha-dev/' + encodeURIComponent(d.developer) } : null,
      phone: null, image: null,
      parking: null, seismicResistance: null,
      source: 'krisha', scrapedAt,
    });
    ok++;
    if ((i + 1) % 40 === 0) console.log(`  detail ${i + 1}/${cards.length} (geo ${geo})`);
    await sleep(300);
  }
  await mkdir('data', { recursive: true });
  const withGeo = out.filter((z) => z.lat && z.lng);
  await writeFile('data/zhk-krisha.json', JSON.stringify(withGeo, null, 2), 'utf-8');
  console.log(`\n✓ krisha: ${out.length} parsed, ${withGeo.length} with geo → data/zhk-krisha.json`);
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) % 1000000; }
main();
