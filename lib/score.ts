import type { ZhkRaw, DeveloperStats, GuaranteeMatch, Indicator, ScoreResult, ScoreContext, Band } from './types';

/**
 * Four named indicators, each on its own 0–100 scale (gradation: worse ↔ better).
 * The headline "Индекс защиты покупателя" is the weighted mean of the indicators that
 * have data. Missing data → grey, never zero (we don't invent). Every indicator cites
 * its source and is tagged первоисточник (govt registry) or витрина (aggregator).
 */
export const INDICATOR_WEIGHTS: Record<Indicator['key'], number> = {
  money: 35,
  reliability: 30,
  seismic: 20,
  price: 15,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const bandOf = (score: number | null): Band =>
  score == null ? 'grey' : score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';

function moneyIndicator(zhk: ZhkRaw, g: GuaranteeMatch | null): Indicator {
  const base = {
    key: 'money' as const, name: 'Защита денег дольщика', weight: INDICATOR_WEIGHTS.money,
    sourceType: 'первоисточник' as const, source: 'Реестр КФГЖС (khc.kz)',
    sourceUrl: 'https://khc.kz/ru/equity/uslugi/357/3260/',
  };
  if (zhk.constructionStatus === 'suspended')
    return { ...base, score: 5, band: 'red', value: 'стройка приостановлена', detail: 'Объект помечен как приостановленный — деньги под риском.' };
  if (g?.status === 'guarantee-case')
    return { ...base, score: 6, band: 'red', value: 'гарантийный случай', detail: `Сработала госгарантия КФГЖС${g.contract ? ` (${g.contract})` : ''}: застройщик не исполнил обязательства.` };
  if (g?.status === 'active')
    return { ...base, score: 100, band: 'green', value: 'действующая гарантия', detail: `Действующий договор гарантии КФГЖС${g.contract ? ` (${g.contract})` : ''} — деньги под госгарантией.` };
  if (g?.status === 'completed')
    return { ...base, score: 85, band: 'green', value: 'сдан под гарантией', detail: 'Застройщик уже доводил стройку до сдачи по договору госгарантии.' };
  return { ...base, score: null, band: 'grey', value: 'нет данных', detail: 'Не найден в реестре гарантий КФГЖС. Слабый сигнал: гарантия — 1 из 3 легальных путей, отсутствие ≠ риск. Реестр не сцеплён с каталогом по имени (нужен homeportal.kz).' };
}

function reliabilityIndicator(s: DeveloperStats | null): Indicator {
  const base = {
    key: 'reliability' as const, name: 'Надёжность застройщика', weight: INDICATOR_WEIGHTS.reliability,
    sourceType: 'витрина' as const, source: 'Портфель на korter.kz',
  };
  if (!s || s.total === 0) return { ...base, score: null, band: 'grey', value: 'нет данных', detail: 'Нет данных о портфеле застройщика.' };
  const sizeBonus = Math.min(s.total, 8) / 8;
  let score = 30 + 45 * s.deliveredRatio + 10 * sizeBonus;
  if (s.suspended > 0) score -= 30 * (s.suspended / s.total);
  score = Math.round(clamp(score));
  const parts = [`${s.total} ЖК`, `сдано ${s.ready}`, `строится ${s.construction}`];
  if (s.suspended) parts.push(`приостановлено ${s.suspended}`);
  return { ...base, score, band: bandOf(score), value: `${Math.round(s.deliveredRatio * 100)}% сдано`, detail: `${parts.join(', ')}. Пока из каталога-витрины — заменяется на завершённый реестр КЖК (первоисточник) + суды по БИН.` };
}

function seismicIndicator(zhk: ZhkRaw): Indicator {
  const base = {
    key: 'seismic' as const, name: 'Сейсмобезопасность', weight: INDICATOR_WEIGHTS.seismic,
    sourceType: 'витрина' as const, source: 'Проектная декларация (через korter)',
  };
  const b = zhk.seismicResistance;
  if (!b) return { ...base, score: null, band: 'grey', value: 'не раскрыта', detail: 'Застройщик не раскрыл проектную сейсмостойкость. Алматы — зона 9–10 баллов; отсутствие цифры — минус к прозрачности.' };
  const map: Record<number, number> = { 10: 100, 9: 78, 8: 50, 7: 30 };
  const score = map[b] ?? (b > 10 ? 100 : 15);
  return { ...base, score, band: bandOf(score), value: `${b} баллов`, detail: `Проектная сейсмостойкость ${b} баллов. Для Алматы (зона 9–10) норма — 9–10; ${b >= 9 ? 'соответствует зоне' : 'ниже нормы зоны'}.` };
}

function priceIndicator(zhk: ZhkRaw, ctx: ScoreContext): Indicator {
  const base = {
    key: 'price' as const, name: 'Цена vs рынок', weight: INDICATOR_WEIGHTS.price,
    sourceType: 'витрина' as const, source: 'Медиана каталога по классу (korter)',
  };
  const median = (zhk.classRu && ctx.classMedian[zhk.classRu]) || ctx.overallMedian;
  if (!zhk.priceSqm || !median) return { ...base, score: null, band: 'grey', value: 'нет цены', detail: 'Цена не указана — сравнить с рынком нельзя.' };
  const ratio = zhk.priceSqm / median;
  const score = Math.round(clamp(60 - (ratio - 1) * 130));
  const diff = Math.round((ratio - 1) * 100);
  const label = diff > 3 ? `на ${diff}% дороже медианы` : diff < -3 ? `на ${-diff}% дешевле медианы` : 'на уровне медианы';
  return { ...base, score, band: bandOf(score), value: label, detail: `${zhk.priceSqm.toLocaleString('ru-RU')} ₸/м² против медианы класса «${zhk.classRu || '—'}» ${Math.round(median).toLocaleString('ru-RU')} ₸/м². Сравнение внутри каталога — заменяется на медиану stat.gov (первоисточник).` };
}

export function scoreZhk(zhk: ZhkRaw, stats: DeveloperStats | null, guarantee: GuaranteeMatch | null, ctx: ScoreContext): ScoreResult {
  const indicators: Indicator[] = [
    moneyIndicator(zhk, guarantee),
    reliabilityIndicator(stats),
    seismicIndicator(zhk),
    priceIndicator(zhk, ctx),
  ];
  let num = 0, den = 0;
  for (const ind of indicators) if (ind.score != null) { num += ind.score * ind.weight; den += ind.weight; }
  const completeness = den / 100;
  let score: number | null = den > 0 ? Math.round(num / den) : null;
  let band: Band;
  // Need a real "protection" signal (money or reliability), not price alone, to show a verdict.
  // Price(15) or seismic(20) alone → grey «мало данных». Reliability(30)/money(35) → shows.
  if (score == null || completeness < 0.25) { band = 'grey'; if (completeness < 0.25) score = null; }
  else band = bandOf(score);
  return { score, band, completeness, indicators };
}

export const BAND_COLOR: Record<Band, string> = {
  green: '#2ecc71', amber: '#f1c40f', red: '#e74c3c', grey: '#8a94a6',
};

// Higher = safer, so bands read as protection level.
export const BAND_LABEL: Record<Band, string> = {
  green: 'Высокая защита', amber: 'Средняя защита', red: 'Низкая защита', grey: 'Мало данных',
};

export const SCORE_NAME = 'Индекс защиты покупателя';
export const SCORE_DEF =
  '0–100 по открытым данным: выше — безопаснее купить. Это средневзвешенное четырёх индикаторов ниже, у каждого своя шкала 0–100 (бывает хуже, бывает лучше) и ссылка на источник.';
