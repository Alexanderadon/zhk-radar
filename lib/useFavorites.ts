'use client';
import { useCallback, useEffect, useState } from 'react';

const KEY = 'zhk-radar:favorites:v1';

/**
 * Локальное «избранное» (корзина понравившихся ЖК) — хранится в localStorage,
 * работает без бэкенда и без входа. SSR-safe: на сервере пусто, читаем в useEffect.
 * Синхронизируется между вкладками через событие storage.
 * Google-вход (кросс-девайс синк) — отдельный слой поверх этого (см. TODO в UI).
 */
export function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setIds(JSON.parse(raw));
    } catch {}
    setLoaded(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        try { setIds(e.newValue ? JSON.parse(e.newValue) : []); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  }, [ids, loaded]);

  const toggle = useCallback((id: number) => {
    setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [id, ...cur]));
  }, []);
  const has = useCallback((id: number) => ids.includes(id), [ids]);
  const clear = useCallback(() => setIds([]), []);

  return { ids, has, toggle, clear, count: ids.length, loaded };
}
