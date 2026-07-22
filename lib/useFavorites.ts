'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, supabaseEnabled } from './supabase';

const KEY = 'zhk-radar:favorites:v1';

const readLocal = (): number[] => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const writeLocal = (ids: number[]) => { try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {} };

export interface AuthUser { id: string; email: string | null; name: string | null; avatar: string | null; }

function toUser(u: any): AuthUser | null {
  if (!u) return null;
  const md = u.user_metadata || {};
  return { id: u.id, email: u.email ?? null, name: md.name ?? md.full_name ?? null, avatar: md.avatar_url ?? md.picture ?? null };
}

/**
 * Избранное (корзина понравившихся ЖК).
 * База — localStorage: работает без входа и офлайн.
 * Если задан Supabase + пользователь вошёл через Google — избранное синхронизируется
 * с таблицей public.favorites (кросс-девайс). При входе локальная подборка сливается
 * с облачной (объединение), так что гостевые лайки не теряются.
 */
export function useFavorites() {
  const [ids, setIds] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [syncing, setSyncing] = useState(false);

  const idsRef = useRef<number[]>(ids); idsRef.current = ids;
  const userRef = useRef<AuthUser | null>(user); userRef.current = user;

  // локальная загрузка + синхронизация между вкладками
  useEffect(() => {
    setIds(readLocal());
    setLoaded(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) { try { setIds(e.newValue ? JSON.parse(e.newValue) : []); } catch {} } };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => { if (loaded) writeLocal(ids); }, [ids, loaded]);

  // авторизация + слияние облачного избранного
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    const mergeOnLogin = async (au: AuthUser) => {
      setSyncing(true);
      try {
        const local = readLocal();
        const { data } = await sb.from('favorites').select('zhk_id');
        const remote = (data || []).map((r: any) => r.zhk_id as number);
        const merged = Array.from(new Set([...local, ...remote]));
        const toInsert = local.filter((id) => !remote.includes(id)).map((id) => ({ user_id: au.id, zhk_id: id }));
        if (toInsert.length) await sb.from('favorites').upsert(toInsert, { onConflict: 'user_id,zhk_id' });
        setIds(merged); writeLocal(merged);
      } catch {}
      setSyncing(false);
    };

    sb.auth.getSession().then(({ data }) => {
      const au = toUser(data.session?.user);
      setUser(au);
      if (au) mergeOnLogin(au);
    }).catch(() => {});

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      const au = toUser(session?.user);
      const wasLoggedIn = !!userRef.current;
      setUser(au);
      if (au && !wasLoggedIn) mergeOnLogin(au);
    });
    return () => { sub.subscription.unsubscribe(); };
  }, []);

  const toggle = useCallback((id: number) => {
    const has = idsRef.current.includes(id);
    const next = has ? idsRef.current.filter((x) => x !== id) : [id, ...idsRef.current];
    setIds(next);
    const sb = getSupabase(); const u = userRef.current;
    if (sb && u) {
      if (has) sb.from('favorites').delete().match({ user_id: u.id, zhk_id: id }).then(() => {}, () => {});
      else sb.from('favorites').upsert({ user_id: u.id, zhk_id: id }, { onConflict: 'user_id,zhk_id' }).then(() => {}, () => {});
    }
  }, []);

  const clear = useCallback(() => {
    setIds([]);
    const sb = getSupabase(); const u = userRef.current;
    if (sb && u) sb.from('favorites').delete().eq('user_id', u.id).then(() => {}, () => {});
  }, []);

  const has = useCallback((id: number) => ids.includes(id), [ids]);

  const signInGoogle = useCallback(() => {
    const sb = getSupabase(); if (!sb) return;
    sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  }, []);

  const signOut = useCallback(() => {
    const sb = getSupabase(); if (sb) sb.auth.signOut().then(() => {}, () => {});
    setUser(null);
  }, []);

  return { ids, has, toggle, clear, count: ids.length, loaded, user, syncing, signInGoogle, signOut, authEnabled: supabaseEnabled };
}
