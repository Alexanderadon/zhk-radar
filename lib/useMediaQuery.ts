'use client';
import { useEffect, useState } from 'react';

/**
 * SSR-безопасно: до монтирования всегда false, поэтому серверная и первая
 * клиентская отрисовка совпадают. Хук включает только ПОВЕДЕНИЕ (drag шторки),
 * раскладку делает CSS — визуального скачка при гидратации нет.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    // Подстраховка на поворот экрана: часть встроенных браузеров (в т.ч. WebView
    // внутри мессенджеров) не шлёт change у MediaQueryList, и раскладка застревала
    // бы в ориентации, из которой её открыли.
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      mq.removeEventListener('change', on);
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, [query]);
  return matches;
}

/** Узкий экран — по нему строится раскладка (шторка, модалка фильтров). */
export const useIsMobile = () => useMediaQuery('(max-width: 900px)');

/**
 * Телефон, повёрнутый набок. Шторка снизу тут не работает: под ней остаётся
 * ~40px карты. В этой ориентации список уезжает в колонку справа.
 */
export const useIsPhoneLandscape = () => useMediaQuery('(max-width: 900px) and (max-height: 500px)');

/**
 * Тач-ввод — по нему включается tap-вместо-hover на карте.
 * Отдельно от ширины: на планшете шире 900px hover-подсказок всё равно нет,
 * и без этого тапы по меткам там не работали бы вообще.
 */
export const useIsTouch = () => useMediaQuery('(hover: none), (pointer: coarse)');
