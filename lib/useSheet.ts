'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export type SnapIndex = 0 | 1 | 2;

// на сервере useLayoutEffect ругается — там всё равно enabled = false
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Мобильная «шторка» поверх карты (паттерн krisha / 2GIS / Airbnb).
 * Три положения: peek → half → full. Тянется за ручку, за шапку
 * и за сам список — но только когда список прокручен в самый верх.
 *
 * Возвращает пропсы, которые навешиваются на существующую разметку сайдбара,
 * поэтому DOM один и тот же на десктопе и на мобиле — без рассинхрона гидратации.
 * На десктопе (enabled = false) хук не делает ничего.
 */
export function useSheet(enabled: boolean, peekPx = 118) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState<SnapIndex>(1);
  const [h, setH] = useState(0);
  const [drag, setDrag] = useState<number | null>(null);
  const g = useRef<{ startY: number; base: number; lastY: number; lastT: number; v: number; active: boolean } | null>(null);

  // замер ДО отрисовки: иначе первый кадр считает h = 0, а offsetFor(0) при h = 0
  // даёт 0 — «раскрыта на весь экран», и шторка прыгает при загрузке
  useIsoLayoutEffect(() => {
    if (!enabled) { setH(0); return; }
    const measure = () => setH(sheetRef.current?.offsetHeight ?? 0);
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && sheetRef.current) ro.observe(sheetRef.current);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => { ro?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('orientationchange', measure); };
  }, [enabled]);

  const offsetFor = useCallback(
    (i: SnapIndex) => {
      if (!h) return 0;
      // peek задан в px, остальные — долей высоты; на низком экране (ландшафт)
      // доля может оказаться меньше peek, поэтому фиксируем порядок положений
      const half = Math.max(h * 0.52, peekPx + 1);
      const visible = i === 0 ? peekPx : i === 1 ? Math.min(half, h) : h;
      return Math.max(0, h - visible);
    },
    [h, peekPx]
  );

  const y = enabled ? (drag ?? offsetFor(index)) : 0;

  const begin = (clientY: number) => {
    if (!enabled) return;
    g.current = { startY: clientY, base: offsetFor(index), lastY: clientY, lastT: performance.now(), v: 0, active: true };
  };
  const move = (clientY: number) => {
    const c = g.current;
    if (!enabled || !c?.active) return;
    const now = performance.now();
    const dt = now - c.lastT;
    if (dt > 0) c.v = (clientY - c.lastY) / dt; // px/ms, >0 — тянут вниз
    c.lastY = clientY; c.lastT = now;
    let next = c.base + (clientY - c.startY);
    if (next < 0) next = next / 3; // резиновое сопротивление сверху
    setDrag(Math.min(next, Math.max(0, h - peekPx)));
  };
  const end = () => {
    const c = g.current;
    if (!enabled || !c?.active) return;
    c.active = false;
    const cur = drag ?? offsetFor(index);
    if (Math.abs(c.v) > 0.5) {
      // Быстрый флик на соседнее положение. v > 0 — палец идёт ВНИЗ, значит
      // шторку надо закрывать, т.е. уменьшать индекс (2 = раскрыта, 0 = свёрнута).
      setIndex((i) => Math.min(2, Math.max(0, i + (c.v > 0 ? -1 : 1))) as SnapIndex);
    } else {
      let best: SnapIndex = 0, bestD = Infinity;
      ([0, 1, 2] as SnapIndex[]).forEach((i) => { const d = Math.abs(offsetFor(i) - cur); if (d < bestD) { bestD = d; best = i; } });
      setIndex(best);
    }
    setDrag(null);
  };

  const dragProps = enabled
    ? {
        onPointerDown: (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); begin(e.clientY); },
        onPointerMove: (e: React.PointerEvent) => move(e.clientY),
        onPointerUp: end,
        onPointerCancel: end,
      }
    : {};

  // шапку тоже можно тянуть, но не за интерактивные элементы (select сортировки и т.п.)
  const headerDragProps = enabled
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          if ((e.target as HTMLElement).closest('button, select, a, input, label')) return;
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
          begin(e.clientY);
        },
        onPointerMove: (e: React.PointerEvent) => move(e.clientY),
        onPointerUp: end,
        onPointerCancel: end,
      }
    : {};

  // список тянет шторку только если он уже наверху — иначе это обычная прокрутка
  const contentProps = enabled
    ? {
        onPointerDown: (e: React.PointerEvent) => { if ((scrollRef.current?.scrollTop ?? 0) <= 0) begin(e.clientY); },
        onPointerMove: (e: React.PointerEvent) => move(e.clientY),
        onPointerUp: end,
        onPointerCancel: end,
      }
    : {};

  return {
    sheetRef, scrollRef, index, setIndex, y,
    // пока не измерено — без анимации, чтобы не было въезда шторки на старте
    dragging: drag !== null || h === 0,
    dragProps, headerDragProps, contentProps,
    expand: () => setIndex(2),
    half: () => setIndex(1),
    collapse: () => setIndex(0),
  };
}
