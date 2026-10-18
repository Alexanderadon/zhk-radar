import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Zhk } from './types';

/**
 * Векторная карта Алматы для первого экрана: те же точки, что в приложении,
 * но нарисованные на сервере одним SVG. Ни MapLibre, ни картинок — первый экран
 * рисуется сразу и не ждёт ни тайлов, ни JS.
 *
 * Проекция — Web Mercator, как у карты приложения, в единицах viewBox
 * шириной 1000. Параметры проекции уходят и на клиент: по ним подсказка
 * находит ЖК под курсором, не перекладывая координаты в HTML второй раз.
 */

type Band = 'green' | 'amber' | 'red' | 'grey';
export interface HeroMap {
  w: number; h: number;
  proj: { minX: number; minY: number; k: number };
  grey: string;
  lvl: Record<Band, string>;
  districts: { d: string; lx: number; ly: number; ru: string; kz: string }[];
  faults: string;
  counts: Record<Band, number> & { total: number };
  pick: { x: number; y: number } | null;
}
export interface HeroExample {
  slug: string; name: string; developer: string | null; district: string | null;
  priceMin: number | null; score: number | null; band: Band; covered: number;
  indicators: { key: string; score: number | null; band: Band; value: string; sourceType: string }[];
}

const W = 1000;
const KZ: Record<string, string> = {
  'Алатауский': 'Алатау ауданы', 'Алмалинский': 'Алмалы ауданы', 'Ауэзовский': 'Әуезов ауданы',
  'Бостандыкский': 'Бостандық ауданы', 'Жетысуский': 'Жетісу ауданы', 'Медеуский': 'Медеу ауданы',
  'Наурызбайский': 'Наурызбай ауданы', 'Турксибский': 'Түрксіб ауданы',
};

const mx = (lng: number) => (lng + 180) / 360;
const my = (lat: number) => { const f = (lat * Math.PI) / 180; return (1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2; };
const r1 = (n: number) => Math.round(n * 10) / 10;
const pct = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * p)))]; };

/** Дуглас–Пекер: выкидываем точки, отклоняющиеся от хорды меньше чем на eps. */
function simplify(pts: number[][], eps: number): number[][] {
  if (pts.length < 3) return pts;
  const [ax, ay] = pts[0], [bx, by] = pts[pts.length - 1];
  const len = Math.hypot(bx - ax, by - ay);
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    // у замкнутого кольца начало совпадает с концом — тогда меряем расстояние до точки
    const d = len === 0 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((by - ay) * pts[i][0] - (bx - ax) * pts[i][1] + bx * ay - by * ax) / len;
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  return [...simplify(pts.slice(0, idx + 1), eps).slice(0, -1), ...simplify(pts.slice(idx), eps)];
}

const readGeo = (rel: string) => {
  const p = path.join(process.cwd(), rel);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return null; }
};

/** Пример для карточки: зелёный ЖК Алматы с данными по госгарантии, не коттеджный городок. */
export function pickExample(all: Zhk[], place: (z: Zhk) => { x: number; y: number } | null, preferred?: string | null): Zhk | null {
  const covered = (z: Zhk) => z.scoreResult.indicators.filter((i) => i.score != null).length;
  const money = (z: Zhk) => (z.scoreResult.indicators.find((i) => i.key === 'money')?.score != null ? 1 : 0);
  const cands = all
    .filter((z) => ((z as any).citySlug ?? 'almaty') === 'almaty' && z.scoreResult.band === 'green' && z.priceMin && z.lat && z.lng
      && !/^кг\b|коттедж/i.test(z.name) && !/коттедж/i.test(z.classRu ?? ''))
    .sort((a, b) => money(b) - money(a) || covered(b) - covered(a) || (b.scoreResult.score ?? 0) - (a.scoreResult.score ?? 0));
  // точка должна стоять там, где справа от неё влезет карточка
// и сверху, на разреженном севере, — чтобы карточка не закрыла ядро города
  const inZone = (z: Zhk, xMax: number, yMin: number, yMax: number) => { const p = place(z); return !!p && p.x >= 18 && p.x <= xMax && p.y >= yMin && p.y <= yMax; };
  // ЖК, чья страница снята для лендинга, — если он всё ещё подходит, берём его:
  // карточка на карте, таблица «вопросов» и скрин должны рассказывать про один дом
  const pref = preferred ? cands.find((z) => z.slug === preferred && covered(z) >= 3 && inZone(z, 60, 10, 85)) : null;
  if (pref) return pref;
  const full = (z: Zhk) => covered(z) >= 3;
  return cands.find((z) => full(z) && inZone(z, 45, 20, 45)) ?? cands.find((z) => full(z) && inZone(z, 45, 15, 72))
    ?? cands.find((z) => full(z) && inZone(z, 60, 10, 85)) ?? cands.find((z) => inZone(z, 45, 20, 72)) ?? cands[0] ?? null;
}

export function buildHeroMap(all: Zhk[]): { map: HeroMap | null; example: HeroExample | null } {
  const almaty = all.filter((z) => ((z as any).citySlug ?? 'almaty') === 'almaty' && z.lat && z.lng);
  if (almaty.length < 10) return { map: null, example: null };

  // рамка по точкам: 4–96 перцентиль + поле 8%. Плотная часть города заполняет кадр,
  // а редкие окраины и ЖК с ошибочными координатами уходят за край (панель их обрезает)
  const xs = almaty.map((z) => mx(z.lng!)), ys = almaty.map((z) => my(z.lat!));
// центр — медиана (плотное ядро города посередине кадра), размер — размах 4–96% × 1.16
  const cx = pct(xs, 0.5), cy = pct(ys, 0.5);
  const spanX = (pct(xs, 0.96) - pct(xs, 0.04)) * 1.16, spanY = (pct(ys, 0.96) - pct(ys, 0.04)) * 1.16;
  const x0 = cx - spanX / 2, x1 = cx + spanX / 2, y0 = cy - spanY / 2, y1 = cy + spanY / 2;
  const k = W / (x1 - x0);
  const h = Math.round((y1 - y0) * k);
  const P = (lng: number, lat: number): [number, number] => [(mx(lng) - x0) * k, (my(lat) - y0) * k];

  const lvl = { grey: '', amber: '', red: '', green: '' } as Record<Band, string>;
  const counts = { grey: 0, amber: 0, red: 0, green: 0, total: almaty.length };
  let grey = '';
  for (const z of almaty) {
    const [x, y] = P(z.lng!, z.lat!);
    const seg = `M${r1(x)} ${r1(y)}h0`;
    grey += seg;
    lvl[z.scoreResult.band] += seg;
    counts[z.scoreResult.band]++;
  }

  // районы: упрощаем и проецируем; подпись — в центре масс, если он внутри рамки
  const districts: HeroMap['districts'] = [];
  const geo = readGeo('data/districts.geojson');
  for (const f of geo?.features ?? []) {
    const name: string = f.properties?.name;
    const polys = f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : [];
    let d = '', ax = 0, ay = 0, aa = 0;
    for (const poly of polys) {
      const ring = simplify(poly[0].map(([lng, lat]: number[]) => P(lng, lat)), 1.5);
      d += 'M' + ring.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z';
      for (let i = 0; i < ring.length - 1; i++) {
        const c = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        aa += c; ax += (ring[i][0] + ring[i + 1][0]) * c; ay += (ring[i][1] + ring[i + 1][1]) * c;
      }
    }
    if (!d || !name) continue;
    const lx = aa ? ax / (3 * aa) : -1, ly = aa ? ay / (3 * aa) : -1;
    const inside = lx > 40 && lx < W - 40 && ly > 30 && ly < h - 30;
    districts.push({ d, lx: inside ? r1(lx) : -1, ly: inside ? r1(ly) : -1, ru: name, kz: KZ[name] ?? '' });
  }

  // разломы внутри города — тонким пунктиром
  let faults = '';
  const fl = readGeo('public/faults.geojson');
  for (const f of fl?.features ?? []) {
    if (f.properties?.src !== 'city') continue;
    const lines = f.geometry?.type === 'LineString' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiLineString' ? f.geometry.coordinates : [];
    for (const line of lines) {
      const pts = simplify(line.map(([lng, lat]: number[]) => P(lng, lat)), 1);
      faults += 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L');
    }
  }

  const place = (z: Zhk) => { if (!z.lat || !z.lng) return null; const [x, y] = P(z.lng, z.lat); return { x: (x / W) * 100, y: (y / h) * 100 }; };
  const pref = readGeo('data/landing-example.json')?.slug ?? null;
  const ex = pickExample(all, place, pref);
  const pick = ex ? place(ex) : null;

  const map: HeroMap = {
    w: W, h, proj: { minX: x0, minY: y0, k },
    grey, lvl, districts, faults, counts,
    pick: pick ? { x: r1(pick.x), y: r1(pick.y) } : null,
  };
  const example: HeroExample | null = ex ? {
    slug: ex.slug, name: ex.name, developer: ex.developer?.name ?? null, district: ex.district,
    priceMin: ex.priceMin, score: ex.scoreResult.score, band: ex.scoreResult.band,
    covered: ex.scoreResult.indicators.filter((i) => i.score != null).length,
    indicators: ex.scoreResult.indicators.map((i) => ({ key: i.key, score: i.score, band: i.band, value: i.value, sourceType: i.sourceType })),
  } : null;
  return { map, example };
}
