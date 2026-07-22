'use client';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Публичные ключи (anon key безопасен в браузере — доступ ограничен RLS).
// Если env не заданы — весь Supabase-слой выключен, избранное живёт только в localStorage.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = !!(url && anon);

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseEnabled) return null;
  if (_client) return _client;
  _client = createClient(url as string, anon as string, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}
