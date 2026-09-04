import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Zhk, ZhkRaw, ParkingType, DeveloperStats, GuaranteeMatch, ScoreContext } from './types';
import { scoreZhk } from './score';

const DATA_DIR = path.join(process.cwd(), 'data');

const nameKey = (s: string) =>
  s.toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\b(жк|мжк|кг|таунхаусы|жилой комплекс|клубный дом|residence|резиденс)\b/g, '')
    .replace(/[^a-zа-яё0-9]/gi, '')
    .trim();

function readJSON(file: string): ZhkRaw[] {
  const p = path.join(DATA_DIR, file);
  if (!existsSync(p)) return [];
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return []; }
}

/** Города, у которых собран каталог ЖК. Алматы лежит в прежних файлах. */
const ZHK_CITY_FILES: { slug: string; files: string[] }[] = [
  { slug: 'almaty', files: ['zhk.json', 'zhk-raw.json'] },
  { slug: 'astana', files: ['zhk-raw-astana.json'] },
  { slug: 'shymkent', files: ['zhk-raw-shymkent.json'] },
  { slug: 'taldykorgan', files: ['zhk-raw-taldykorgan.json'] },
  { slug: 'kapchagay', files: ['zhk-raw-kapchagay.json'] },
];

function loadRaw(): ZhkRaw[] {
  const out = loadAlmaty();
  // остальные города: берём первый существующий файл каталога
  for (const c of ZHK_CITY_FILES.slice(1)) {
    for (const f of c.files) {
      const rows = readJSON(f);
      if (rows.length) { rows.forEach((z) => { (z as any).citySlug = c.slug; }); out.push(...rows); break; }
    }
  }
  out.forEach((z) => { if (!(z as any).citySlug) (z as any).citySlug = 'almaty'; });
  return out;
}

function loadAlmaty(): ZhkRaw[] {
  // korter is primary (richer: images, parking, seismic, class); krisha adds coverage.
  const korter = existsSync(path.join(DATA_DIR, 'zhk.json')) ? readJSON('zhk.json') : readJSON('zhk-raw.json');
  const krisha = readJSON('zhk-krisha.json');
  const byName = new Map<string, ZhkRaw>();
  for (const z of korter) if (z.name) byName.set(nameKey(z.name), z);
  for (const z of krisha) {
    if (!z.name || !z.lat || !z.lng) continue;
    const k = nameKey(z.name);
    if (!byName.has(k)) byName.set(k, z); // only add ЖК korter doesn't already have
  }
  return [...byName.values()];
}

function loadGuarantees(): Record<string, GuaranteeMatch> {
  const file = path.join(DATA_DIR, 'guarantees.json');
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, 'utf-8'));
  } catch {
    return {};
  }
}

function parkingType(raw: string | null | undefined): ParkingType {
  if (!raw) return 'нет данных';
  const s = raw.toLowerCase();
  const under = /подземн|поздемн/.test(s);
  const over = /наземн|надземн|крыт|гараж|гостев|улич|личн/.test(s);
  if (under && over) return 'смешанный';
  if (under) return 'подземный';
  if (over) return 'наземный';
  return 'нет данных';
}

function computeDeveloperStats(list: ZhkRaw[]): Map<number, DeveloperStats> {
  const m = new Map<number, DeveloperStats>();
  for (const z of list) {
    if (!z.developer) continue;
    const d = z.developer;
    let s = m.get(d.id);
    if (!s) {
      s = { id: d.id, name: d.name, slug: d.slug, total: 0, ready: 0, construction: 0, project: 0, suspended: 0, deliveredRatio: 0 };
      m.set(d.id, s);
    }
    s.total++;
    if (z.constructionStatus === 'ready') s.ready++;
    else if (z.constructionStatus === 'construction') s.construction++;
    else if (z.constructionStatus === 'project') s.project++;
    else if (z.constructionStatus === 'suspended') s.suspended++;
  }
  for (const s of m.values()) s.deliveredRatio = s.total ? s.ready / s.total : 0;
  return m;
}

const STATUS_RU: Record<string, string> = {
  ready: 'сдан', construction: 'строится', project: 'проект', suspended: 'приостановлен', built: 'сдан', building: 'строится',
};

const normObj = (s: string) =>
  s.toLowerCase().replace(/[«»"'`]/g, '').replace(/\bжилой комплекс\b|\bжк\b|\bмжк\b/g, '').replace(/\s+/g, ' ').trim();
const normDev = (s: string) =>
  s.toLowerCase().replace(/[«»"'`.]/g, '').replace(/\b(тоо|ао|ип|оао|зао)\b/g, '').replace(/\s+/g, ' ').trim();

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function computeContext(list: ZhkRaw[]): ScoreContext {
  const byClass: Record<string, number[]> = {};
  const all: number[] = [];
  for (const z of list) {
    if (!z.priceSqm) continue;
    all.push(z.priceSqm);
    const c = z.classRu || '—';
    (byClass[c] ||= []).push(z.priceSqm);
  }
  const classMedian: Record<string, number> = {};
  for (const c of Object.keys(byClass)) classMedian[c] = median(byClass[c]);
  return { classMedian, overallMedian: median(all) };
}

let _cache: Zhk[] | null = null;

export function getAllZhk(): Zhk[] {
  if (_cache) return _cache;
  const raw = loadRaw();
  const guarantees = loadGuarantees();
  const stats = computeDeveloperStats(raw);
  const ctx = computeContext(raw);

  _cache = raw.map((z) => {
    const developerStats = z.developer ? stats.get(z.developer.id) ?? null : null;
    // guarantee lookup: by zhk id, then object name, then developer legal name
    const g =
      guarantees[`zhk:${z.id}`] ??
      guarantees[`obj:${normObj(z.name)}`] ??
      (z.developer ? guarantees[`dev:${normDev(z.developer.name)}`] : undefined) ??
      null;
    const scoreResult = scoreZhk(z, developerStats, g, ctx);
    const constructionStatusRu = (z.constructionStatus && STATUS_RU[z.constructionStatus]) || z.constructionStatusRu;
    const priceInd = scoreResult.indicators.find((i) => i.key === 'price');
    const deal = !!(priceInd && priceInd.score != null && priceInd.score >= 68 && scoreResult.band !== 'red');
    return { ...z, constructionStatusRu, parkingType: parkingType(z.parking), developerStats, guarantee: g, scoreResult, deal };
  });
  return _cache;
}

export function getZhkBySlug(slug: string): Zhk | undefined {
  const target = decodeURIComponent(slug);
  return getAllZhk().find((z) => z.slug === target || z.slug === `/${target}` || z.slug.replace(/^\//, '') === target);
}

export function getDeveloper(slug: string): { stats: DeveloperStats; zhks: Zhk[] } | undefined {
  const target = decodeURIComponent(slug).replace(/^\//, '');
  const all = getAllZhk();
  const zhks = all.filter((z) => z.developer && (z.developer.slug.replace(/^\//, '') === target || String(z.developer.id) === target));
  if (!zhks.length) return undefined;
  return { stats: zhks[0].developerStats!, zhks };
}

export function getStats() {
  const all = getAllZhk();
  const bands = { green: 0, amber: 0, red: 0, grey: 0 };
  for (const z of all) bands[z.scoreResult.band]++;
  const withSeismic = all.filter((z) => z.seismicResistance).length;
  const developers = new Set(all.map((z) => z.developer?.id).filter(Boolean)).size;
  const scrapedAt = all[0]?.scrapedAt ?? null;
  return { total: all.length, bands, withSeismic, developers, scrapedAt };
}
