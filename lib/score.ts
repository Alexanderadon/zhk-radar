import type { Zhk, ZhkRaw, DeveloperStats, GuaranteeMatch, ScoreFactor, ScoreResult } from './types';

/**
 * Transparent risk score. Weights come from PLAN.md §3 (post-Phase-0 re-tune).
 * Every factor is either a real 0..1 value from a cited source, or `null` = нет данных.
 * The score is the weighted average over factors THAT HAVE DATA, renormalized to 0..100.
 * We never invent a value: missing sources are grey, not zero.
 */
export const WEIGHTS: Record<string, number> = {
  guarantee: 29,
  track: 23,
  age: 15,
  stop: 12,
  courts: 11,
  reviews: 10,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

function guaranteeFactor(g: GuaranteeMatch | null): Pick<ScoreFactor, 'value' | 'detail' | 'source' | 'sourceUrl' | 'negative'> {
  const source = 'Реестр КФГЖС (khc.kz)';
  const sourceUrl = 'https://khc.kz/ru/equity/uslugi/357/3260/';
  if (!g || !g.status) {
    return { value: null, detail: 'Не найден в реестре гарантий долевого участия. Это слабый сигнал: гарантия КЖК — лишь 1 из 3 легальных путей привлечения средств, отсутствие ≠ риск.', source, sourceUrl };
  }
  if (g.status === 'guarantee-case') {
    return { value: 0.08, detail: `«Гарантийный случай» в реестре КФГЖС${g.contract ? ` (договор ${g.contract})` : ''} — застройщик не исполнил обязательства, сработала гарантия. Сильный негативный сигнал.`, source, sourceUrl, negative: true };
  }
  if (g.status === 'completed') {
    return { value: 0.85, detail: `Объект завершён под гарантией КФГЖС${g.object ? ` («${g.object}»)` : ''} — застройщик уже доводил стройку до сдачи по договору гарантии.`, source, sourceUrl };
  }
  return { value: 1, detail: `Действующий договор гарантии КФГЖС${g.contract ? ` (${g.contract})` : ''} — средства дольщиков под государственной гарантией.`, source, sourceUrl };
}

function trackFactor(s: DeveloperStats | null): Pick<ScoreFactor, 'value' | 'detail' | 'source' | 'sourceUrl' | 'negative'> {
  const source = 'Портфель застройщика (korter.kz)';
  if (!s || s.total === 0) {
    return { value: null, detail: 'Нет данных о портфеле застройщика.', source };
  }
  const sizeBonus = Math.min(s.total, 8) / 8; // more projects = more track to judge
  let value = 0.30 + 0.45 * s.deliveredRatio + 0.10 * sizeBonus;
  let negative = false;
  if (s.suspended > 0) { value -= 0.30 * (s.suspended / s.total); negative = true; }
  value = clamp01(value);
  const parts = [`${s.total} ЖК в портфеле`, `сдано ${s.ready}`, `строится ${s.construction}`];
  if (s.suspended) parts.push(`приостановлено ${s.suspended}`);
  return {
    value,
    detail: `${parts.join(', ')}. Доля сданных ${(s.deliveredRatio * 100).toFixed(0)}%.${s.suspended ? ' Есть приостановленные проекты — штраф к скору.' : ''}`,
    source,
    negative,
  };
}

function stopFactor(zhk: ZhkRaw, g: GuaranteeMatch | null): Pick<ScoreFactor, 'value' | 'detail' | 'source' | 'sourceUrl' | 'negative'> {
  const source = 'Статус стройки (korter) + гарант-случаи КФГЖС';
  if (zhk.constructionStatus === 'suspended') {
    return { value: 0.05, detail: 'Стройка помечена как приостановленная.', source, negative: true };
  }
  if (g?.status === 'guarantee-case') {
    return { value: 0.05, detail: 'Сработал гарантийный случай КФГЖС — фактическая остановка исполнения.', source, negative: true };
  }
  // No authoritative named problem-list for Almaty (Phase 0). Absence of a flag is NOT proof of safety → grey.
  return { value: null, detail: 'Официальных признаков остановки не зафиксировано. По правилу проекта отсутствие флага ≠ гарантия (нет единого поимённого реестра проблемных ЖК Алматы).', source };
}

const GREY = (label: string, note: string): Pick<ScoreFactor, 'value' | 'detail' | 'source'> => ({ value: null, detail: note, source: null });

export function scoreZhk(zhk: ZhkRaw, stats: DeveloperStats | null, guarantee: GuaranteeMatch | null): ScoreResult {
  const g = guaranteeFactor(guarantee);
  const t = trackFactor(stats);
  const st = stopFactor(zhk, guarantee);

  const factors: ScoreFactor[] = [
    { key: 'guarantee', label: 'Гарантия долевого участия', weight: WEIGHTS.guarantee, sourceType: 'первоисточник', ...g },
    { key: 'track', label: 'Трек застройщика', weight: WEIGHTS.track, sourceType: 'витрина', ...t },
    { key: 'age', label: 'Возраст компании', weight: WEIGHTS.age, sourceType: 'первоисточник', ...GREY('Возраст компании', 'Нужен БИН застройщика (кодирует дату регистрации) — госисточник, не подключён в этой сборке.') },
    { key: 'stop', label: 'Признаки остановки стройки', weight: WEIGHTS.stop, sourceType: 'первоисточник', ...st },
    { key: 'courts', label: 'Судебные иски', weight: WEIGHTS.courts, sourceType: 'первоисточник', ...GREY('Суды', 'office.sud.kz за reCAPTCHA — требует ручной сессии с локальной машины (Фаза 1, спайк).') },
    { key: 'reviews', label: 'Отзывы жильцов', weight: WEIGHTS.reviews, sourceType: 'витрина', ...GREY('Отзывы', 'Дайджест 2GIS подключается отдельным коллектором.') },
  ];

  let num = 0, den = 0;
  for (const f of factors) {
    if (f.value != null) { num += f.value * f.weight; den += f.weight; }
  }
  const completeness = den / 100;
  let score: number | null = den > 0 ? Math.round((num / den) * 100) : null;
  let band: ScoreResult['band'];
  // If we know almost nothing, don't pretend we have a verdict.
  if (score == null || completeness < 0.15) { band = 'grey'; if (completeness < 0.15) score = null; }
  else if (score >= 70) band = 'green';
  else if (score >= 40) band = 'amber';
  else band = 'red';

  return { score, band, completeness, factors };
}

export const BAND_COLOR: Record<ScoreResult['band'], string> = {
  green: '#2ecc71',
  amber: '#f1c40f',
  red: '#e74c3c',
  grey: '#8a94a6',
};

// Metric renamed so its direction is obvious: higher = safer. Bands follow the same polarity.
export const BAND_LABEL: Record<ScoreResult['band'], string> = {
  green: 'Высокая защита',
  amber: 'Средняя защита',
  red: 'Низкая защита',
  grey: 'Мало данных',
};

/** The metric's public name + one-sentence definition, shown everywhere it appears. */
export const SCORE_NAME = 'Индекс защиты покупателя';
export const SCORE_DEF =
  '0–100 по открытым данным: выше — безопаснее купить. Складывается из защиты денег (гарантия КФГЖС), надёжности застройщика, сейсмики и др. — каждый фактор со ссылкой на источник.';
