// ЖК-Радар — korter.kz catalog collector (runs from local Almaty IP).
// Paginates the Almaty new-buildings listing, extracts window.INITIAL_STATE,
// normalizes every ЖК, writes data/zhk-raw.json. Polite ~800ms throttle.
import { writeFile, mkdir } from 'node:fs/promises';
import { extractInitialState, findObjectsWithGeo } from './lib/extract-state.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36';
const BASE = 'https://korter.kz/новостройки-алматы';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CLASS_MAP = { economy: 'эконом', comfort: 'комфорт', business: 'бизнес', premium: 'премиум', elite: 'элит' };
const STATUS_MAP = { project: 'проект', building: 'строится', built: 'сдан', suspended: 'приостановлен' };

function normalize(b, scrapedAt) {
  const dev = (b.developers && b.developers[0]) || null;
  return {
    id: b.buildingId,
    slug: b.url,
    name: b.name,
    address: b.address || null,
    city: b.mainGeoObject?.name || 'Алматы',
    district: b.subLocalityNominative || null,
    lat: b.location?.lat ?? null,
    lng: b.location?.lng ?? null,
    priceSqm: b.minPriceSqm ?? null,
    priceMin: b.minPrice ?? null,
    class: b.status || null,
    classRu: CLASS_MAP[b.status] || b.status || null,
    salesStatus: b.salesStatus || null,
    constructionStatus: b.constructionStatus || null,
    constructionStatusRu: STATUS_MAP[b.constructionStatus] || b.constructionStatus || null,
    developer: dev ? { id: dev.developerId, name: dev.name, slug: dev.link } : null,
    phone: b.phone || null,
    image: b.images?.[0]?.mediaSrc?.default?.x1 || null,
    source: 'korter',
    scrapedAt,
  };
}

async function fetchPage(page) {
  const url = encodeURI(BASE + (page > 1 ? `?page=${page}` : ''));
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru,en;q=0.9' } });
  if (res.status !== 200) throw new Error(`page ${page} → HTTP ${res.status}`);
  const html = await res.text();
  const state = extractInitialState(html);
  if (!state || state.__parseError) throw new Error(`page ${page} → extract failed`);
  return findObjectsWithGeo(state).filter((o) => typeof o.buildingId === 'number' && o.name);
}

const scrapedAt = new Date().toISOString();
const byId = new Map();
let emptyStreak = 0;
for (let page = 1; page <= 20; page++) {
  let buildings;
  try {
    buildings = await fetchPage(page);
  } catch (e) {
    console.log(`  page ${page}: ${e.message} — stopping`);
    break;
  }
  let fresh = 0;
  for (const b of buildings) {
    if (!byId.has(b.buildingId)) { byId.set(b.buildingId, normalize(b, scrapedAt)); fresh++; }
  }
  console.log(`  page ${page}: ${buildings.length} objects, +${fresh} new (total ${byId.size})`);
  if (buildings.length === 0 || fresh === 0) { emptyStreak++; if (emptyStreak >= 2) break; } else emptyStreak = 0;
  await sleep(800);
}

const list = [...byId.values()].sort((a, b) => (b.priceSqm || 0) - (a.priceSqm || 0));
await mkdir('data', { recursive: true });
await writeFile('data/zhk-raw.json', JSON.stringify(list, null, 2), 'utf-8');

const withGeo = list.filter((z) => z.lat && z.lng).length;
const withDev = list.filter((z) => z.developer).length;
const withPrice = list.filter((z) => z.priceSqm).length;
console.log(`\n✓ ${list.length} ЖК → data/zhk-raw.json`);
console.log(`  geo: ${withGeo}  developer: ${withDev}  price: ${withPrice}`);
console.log(`  classes:`, Object.entries(list.reduce((a, z) => { a[z.classRu || '?'] = (a[z.classRu || '?'] || 0) + 1; return a; }, {})));
console.log(`  status:`, Object.entries(list.reduce((a, z) => { a[z.constructionStatusRu || '?'] = (a[z.constructionStatusRu || '?'] || 0) + 1; return a; }, {})));
