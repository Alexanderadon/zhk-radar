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
// В свёрнутом виде оставляем только ручку и переключатель режима (~77px):
// свёрнутая шторка нужна, чтобы смотреть карту, а не список.
export function useSheet(enabled: boolean, peekPx = 96) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);
  const [index, setIndex] = useState<SnapIndex>(1);
  const [h, setH] = useState(0);
  /**
   * Смещение во время перетаскивания живёт в ref, а не в state, и пишется прямо
   * в style элемента. Через state каждый кадр драга перерисовывал бы весь
   * HomeClient вместе со всем списком карточек — на телефоне это заметный рывок.
   */
  const dragRef = useRef<number | null>(null);
  const g = useRef<{ startY: number; base: number; lastY: number; lastT: number; v: number; active: boolean } | null>(null);
  const pending = useRef<{ y: number; decided: 'drag' | 'scroll' | null } | null>(null);

  // замер ДО отрисовки: иначе первый кадр считает h = 0, а offsetFor(0) при h = 0
  // даёт 0 — «раскрыта на весь экран», и шторка прыгает при загрузке
  useIsoLayoutEffect(() => {
    if (!enabled) {
      // ушли на десктоп: снимаем всё, что писали мимо React, и роняем
      // возможный незавершённый жест — иначе шторка останется «подвисшей»
      setH(0);
      dragRef.current = null;
      if (g.current) g.current.active = false;
      pending.current = null;
      const el = sheetRef.current;
      if (el) { el.style.transform = ''; el.style.transition = ''; }
      return;
    }
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

  const y = enabled ? offsetFor(index) : 0;

  /** Пишем трансформацию мимо React — во время жеста рендеров быть не должно. */
  const paint = (val: number, animate: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = animate ? '' : 'none';
    el.style.transform = `translate3d(0, ${val}px, 0)`;
  };

  const begin = (clientY: number) => {
    if (!enabled) return;
    g.current = { startY: clientY, base: dragRef.current ?? offsetFor(index), lastY: clientY, lastT: performance.now(), v: 0, active: true };
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
    next = Math.min(next, Math.max(0, h - peekPx));
    dragRef.current = next;
    paint(next, false);
  };
  const end = () => {
    const c = g.current;
    if (!enabled || !c?.active) return;
    c.active = false;
    const cur = dragRef.current ?? offsetFor(index);
    dragRef.current = null;

    let best: SnapIndex;
    if (Math.abs(c.v) > 0.5) {
      // Быстрый флик на соседнее положение. v > 0 — палец идёт ВНИЗ, значит
      // шторку надо закрывать, т.е. уменьшать индекс (2 = раскрыта, 0 = свёрнута).
      best = Math.min(2, Math.max(0, index + (c.v > 0 ? -1 : 1))) as SnapIndex;
    } else {
      best = 0; let bestD = Infinity;
      ([0, 1, 2] as SnapIndex[]).forEach((i) => { const d = Math.abs(offsetFor(i) - cur); if (d < bestD) { bestD = d; best = i; } });
    }
    // доводим анимацией сами: если индекс не изменился, ререндера не будет
    paint(offsetFor(best), true);
    setIndex(best);
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

  /**
   * Список тянет шторку только вниз и только когда прокручен в самый верх.
   * Без этого один свайп вверх делал сразу два действия: раскрывал шторку
   * на весь экран И прокручивал список.
   */
  const contentProps = enabled
    ? {
        onPointerDown: (e: React.PointerEvent) => {
          pending.current = { y: e.clientY, decided: null };
        },
        onPointerMove: (e: React.PointerEvent) => {
          const q = pending.current;
          if (q && q.decided === null) {
            const dy = e.clientY - q.y;
            if (Math.abs(dy) < 6) return; // ещё не понятно, куда ведут
            // тянуть шторку можно только вниз и только с самого верха списка
            q.decided = dy > 0 && (scrollRef.current?.scrollTop ?? 0) <= 0 ? 'drag' : 'scroll';
            if (q.decided === 'drag') begin(q.y);
          }
          if (q?.decided === 'drag') move(e.clientY);
        },
        onPointerUp: () => { if (pending.current?.decided === 'drag') end(); pending.current = null; },
        onPointerCancel: () => { if (pending.current?.decided === 'drag') end(); pending.current = null; },
      }
    : {};

  return {
    sheetRef, scrollRef, index, setIndex, y,
    /** Сколько пикселей карты закрыто шторкой — карте нужно, чтобы не центрировать под ней. */
    cover: enabled ? Math.max(0, h - y) : 0,
    // пока не измерено — без анимации, чтобы не было въезда шторки на старте
    dragging: h === 0,
    dragProps, headerDragProps, contentProps,
    expand: () => setIndex(2),
    half: () => setIndex(1),
    collapse: () => setIndex(0),
  };
}
