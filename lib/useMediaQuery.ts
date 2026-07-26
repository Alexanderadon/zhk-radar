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
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

/** Узкий экран — по нему строится раскладка (шторка, модалка фильтров). */
export const useIsMobile = () => useMediaQuery('(max-width: 900px)');

/**
 * Тач-ввод — по нему включается tap-вместо-hover на карте.
 * Отдельно от ширины: на планшете шире 900px hover-подсказок всё равно нет,
 * и без этого тапы по меткам там не работали бы вообще.
 */
export const useIsTouch = () => useMediaQuery('(hover: none), (pointer: coarse)');
