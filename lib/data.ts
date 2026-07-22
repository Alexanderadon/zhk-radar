import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Zhk, ZhkRaw, ParkingType, DeveloperStats, GuaranteeMatch } from './types';
import { scoreZhk } from './score';

const DATA_DIR = path.join(process.cwd(), 'data');

function loadRaw(): ZhkRaw[] {
  const primary = path.join(DATA_DIR, 'zhk.json');
  const fallback = path.join(DATA_DIR, 'zhk-raw.json');
  const file = existsSync(primary) ? primary : fallback;
  return JSON.parse(readFileSync(file, 'utf-8'));
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

let _cache: Zhk[] | null = null;

export function getAllZhk(): Zhk[] {
  if (_cache) return _cache;
  const raw = loadRaw();
  const guarantees = loadGuarantees();
  const stats = computeDeveloperStats(raw);

  _cache = raw.map((z) => {
    const developerStats = z.developer ? stats.get(z.developer.id) ?? null : null;
    // guarantee lookup: by zhk id, then object name, then developer legal name
    const g =
      guarantees[`zhk:${z.id}`] ??
      guarantees[`obj:${normObj(z.name)}`] ??
      (z.developer ? guarantees[`dev:${normDev(z.developer.name)}`] : undefined) ??
      null;
    const scoreResult = scoreZhk(z, developerStats, g);
    const constructionStatusRu = (z.constructionStatus && STATUS_RU[z.constructionStatus]) || z.constructionStatusRu;
    return { ...z, constructionStatusRu, parkingType: parkingType(z.parking), developerStats, guarantee: g, scoreResult };
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
