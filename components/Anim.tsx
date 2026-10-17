'use client';
import { useEffect, useRef } from 'react';
import { BAND_COLOR, BAND_TEXT } from '../lib/score';

/*
 * Микроанимации без библиотек. Правило одно: сервер отдаёт КОНЕЧНОЕ состояние
 * (число, заполненную шкалу), а начальное задаёт CSS только при включённом JS
 * (класс .js на <html> ставит скрипт в <head>). Без JS страница честно показывает
 * цифры, с JS — они «считаются» при появлении на экране.
 *
 * Чего избегаем (замерено Lighthouse): анимации width — это пересчёт вёрстки в
 * каждом кадре; setState на появлении — перерисовка всего поддерева React. Оба
 * отнимали у главной картинки ~2 с отрисовки на телефоне. Поэтому полоски
 * растут через transform, а «появился в кадре» — это атрибут на DOM-узле.
 */

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Запуск после загрузки страницы (или через 1.2 с, если картинки грузятся долго):
 * анимация не должна делить главный поток с первой отрисовкой.
 */
function afterLoad(cb: () => void) {
  if (document.readyState === 'complete') { const t = window.setTimeout(cb, 60); return () => clearTimeout(t); }
  let done = false;
  const run = () => { if (!done) { done = true; cb(); } };
  const t = window.setTimeout(run, 1200);
  window.addEventListener('load', run, { once: true });
  return () => { done = true; clearTimeout(t); window.removeEventListener('load', run); };
}

/** Один раз, когда элемент попал в кадр (и страница догрузилась). */
function onceVisible(el: Element, threshold: number, cb: () => void) {
  if (reduced() || !('IntersectionObserver' in window)) { cb(); return () => {}; }
  let stopWait = () => {};
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    stopWait = afterLoad(cb);
  }, { threshold });
  io.observe(el);
  return () => { io.disconnect(); stopWait(); };
}

/** Обёртка: дочерние [data-anim] стартуют, когда блок появился в кадре. */
export function Reveal({ children, className, style, as: Tag = 'div' }: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; as?: 'div' | 'section' | 'aside';
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return onceVisible(el, 0.2, () => { el.dataset.reveal = '1'; });
  }, []);
  return <Tag ref={ref as any} className={className} style={style} data-reveal="0">{children}</Tag>;
}

const fmt = (n: number, grouped: boolean) => (grouped ? n.toLocaleString('ru-RU') : String(n));

/** Число «считается» от нуля до значения, когда попадает в кадр. */
export function CountUp({ value, duration = 1100, grouped = false }: { value: number; duration?: number; grouped?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const stop = onceVisible(el, 0.3, () => {
      if (reduced()) { el.dataset.on = '1'; return; }
      const t0 = performance.now();
      let last = -1;
      el.textContent = fmt(0, grouped);
      el.dataset.on = '1';
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const v = Math.round(value * (1 - Math.pow(1 - p, 3)));
        if (v !== last) { el.textContent = fmt(v, grouped); last = v; }
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => { stop(); cancelAnimationFrame(raf); };
  }, [value, duration, grouped]);
  return <span ref={ref} data-count>{fmt(value, grouped)}</span>;
}

type Band = 'green' | 'amber' | 'red' | 'grey';

/**
 * Кольцо индекса 0–100: дуга в 270°, цвет уровня защиты, число в центре.
 * Засечки на 40 и 70 — границы зон.
 */
export function ScoreGauge({ score, band, size = 168, stroke = 14, caption }: {
  score: number | null; band: Band; size?: number; stroke?: number; caption?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    return onceVisible(el, 0.4, () => { el.dataset.reveal = '1'; });
  }, []);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const val = score == null ? 0 : Math.max(0, Math.min(100, score));
  const tick = (p: number) => {
    const a = (135 + 270 * p) * (Math.PI / 180);
    const r1 = r - stroke / 2 - 3, r2 = r - stroke / 2 - 8;
    const c = size / 2;
    return <line key={p} x1={c + r1 * Math.cos(a)} y1={c + r1 * Math.sin(a)} x2={c + r2 * Math.cos(a)} y2={c + r2 * Math.sin(a)} stroke="#c6ccd8" strokeWidth="2" strokeLinecap="round" />;
  };
  return (
    <div ref={ref} className="gauge" style={{ width: size, height: size }} data-reveal="0" role="img" aria-label={score == null ? 'Индекс защиты: мало данных' : `Индекс защиты ${score} из 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e9ecf2" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${arc} ${C}`} transform={`rotate(135 ${size / 2} ${size / 2})`} />
        {score != null && (
          <circle data-anim="arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BAND_COLOR[band]} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(arc * val) / 100} ${C}`} transform={`rotate(135 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dasharray 1.3s var(--ease-out)' }} />
        )}
        {[0.4, 0.7].map(tick)}
      </svg>
      <div className="gaugeNum" style={{ color: BAND_TEXT[band], fontSize: size * 0.3 }}>
        {score == null ? '—' : <CountUp value={score} duration={1300} />}
      </div>
      {caption && <div className="gaugeCap" style={{ fontSize: Math.max(10, size * 0.072) }}>{caption}</div>}
    </div>
  );
}

/** Полоска показателя 0–100: растёт при появлении (внутри Reveal или сама по себе). */
export function Bar({ score, band, delay = 0, height = 8 }: { score: number | null; band: Band; delay?: number; height?: number }) {
  return (
    <div className="bar" style={{ height }}>
      {score == null
        ? <i className="barGrey" />
        : <i data-anim="bar" style={{ width: `${Math.max(3, score)}%`, background: BAND_COLOR[band], transitionDelay: `${delay}ms` }} />}
    </div>
  );
}
