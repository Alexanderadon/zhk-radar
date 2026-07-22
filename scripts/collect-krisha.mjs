// ЖК-Радар — krisha.kz second catalog, ТОЛЬКО для покрытия карты (витрина, НЕ в скор).
// NB: krisha ToS §5.3/5.4 ограничивают автосбор — личное использование, низкий rate, кэш.
import { writeFile, mkdir } from 'node:fs/promises';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const g = (u) => fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });
const CLASS_RE = /(эконом|комфорт|бизнес|премиум|элит)/i;

function parseListing(html) {
  const out = [], seen = new Set();
  const segs = html.split('data-complex-alias="');
  for (let i = 1; i < segs.length; i++) {
    const seg = segs[i];
    const alias = seg.slice(0, seg.indexOf('"'));
    if (!alias || !/^almaty\//i.test(alias) || seen.has(alias)) continue;
    seen.add(alias);
    out.push({
      alias,
      name: (seg.match(/data-name="([^"]*)"/) || [])[1] || null,
      state: (seg.match(/complex-card__state">\s*([^<]+?)\s*</) || [])[1] || null,
      priceSqm: (() => { const p = seg.match(/square-price">\s*от\s*([\d\s]+)\s*₸/); return p ? parseInt(p[1].replace(/\s/g, ''), 10) : null; })(),
    });
  }
  return out;
}
const STATUS = (s) => !s ? null : /сда|заселе|введ/i.test(s) ? 'ready' : /строящ|строится/i.test(s) ? 'construction' : /проект|котлован/i.test(s) ? 'project' : 'construction';

function parseDetail(html) {
  const m = html.match(/"lat":\s*(4[0-9]\.\d+),\s*"lon":\s*(7[0-9]\.\d+)/);
  const dev = (html.match(/Застройщик[\s\S]{0,120}?>([^<]{2,60})<\/a>/) || [])[1]
    || (html.match(/"builder"[^}]*?"name":"([^"]{2,60})"/) || [])[1] || null;
  const priceMin = (() => { const p = html.match(/"minPrice":\s*(\d{6,})/); return p ? parseInt(p[1], 10) : null; })();
  const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || null;
  const photos = [...new Set([...html.matchAll(/https:\/\/[a-z0-9.\-]*(?:kcdn|krisha)[a-z0-9.\-]*\/[^"'\s]+?\.(?:jpg|jpeg|webp)/gi)].map(x => x[0]))].slice(0, 10);
  return { lat: m ? +m[1] : null, lng: m ? +m[2] : null, developer: dev ? dev.trim() : null, priceMin, img, photos };
}

async function main() {
  const cards = [];
  for (let page = 1; page <= 61; page++) {
    let html; try { const r = await g(`https://krisha.kz/complex/search/almaty/?page=${page}`); if (r.status !== 200) break; html = await r.text(); } catch { break; }
    const c = parseListing(html); let fresh = 0;
    for (const x of c) if (!cards.find(y => y.alias === x.alias)) { cards.push(x); fresh++; }
    if (page % 10 === 0) console.log(`  listing ${page}: total ${cards.length}`);
    if (c.length === 0) break;
    await sleep(300);
  }
  console.log(`listing done: ${cards.length}`);

  const scrapedAt = new Date().toISOString();
  const out = [];
  let geo = 0, withImg = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i]; let d = {};
    try { const r = await g(`https://krisha.kz/complex/show/${c.alias}/`); if (r.status === 200) d = parseDetail(await r.text()); } catch {}
    if (d.lat) geo++; if (d.img) withImg++;
    const classNorm = (c.name && (c.name.match(CLASS_RE) || [])[1]) || null;
    const photos = (d.photos && d.photos.length ? d.photos : (d.img ? [d.img] : []));
    out.push({
      id: 900000000 + i, slug: `/complex/show/${c.alias}`, name: c.name || c.alias.split('/')[1],
      address: null, city: 'Алматы', district: null, lat: d.lat, lng: d.lng,
      priceSqm: c.priceSqm, priceMin: d.priceMin || null,
      class: classNorm, classRu: classNorm, classNorm,
      salesStatus: null, constructionStatus: STATUS(c.state), constructionStatusRu: null,
      developer: d.developer ? { id: 800000000 + (i % 1000000), name: d.developer, slug: '/krisha-dev/' + encodeURIComponent(d.developer) } : null,
      phone: null, image: d.img || null, photos, layouts: [],
      parking: null, seismicResistance: null, source: 'krisha', scrapedAt,
    });
    if ((i + 1) % 50 === 0) console.log(`  detail ${i + 1}/${cards.length} (geo ${geo}, img ${withImg})`);
    await sleep(280);
  }
  await mkdir('data', { recursive: true });
  const withGeo = out.filter(z => z.lat && z.lng);
  await writeFile('data/zhk-krisha.json', JSON.stringify(withGeo, null, 2), 'utf-8');
  console.log(`\n✓ krisha: ${out.length} parsed, ${withGeo.length} with geo, ${withImg} with image → data/zhk-krisha.json`);
}
main();
