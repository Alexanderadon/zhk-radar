# Google-вход + синхронизация избранного (Supabase)

Избранное работает **без входа** — хранится в браузере (localStorage). Этот гайд
включает вход через Google, чтобы подборка синхронизировалась между устройствами.
Весь код уже написан и включается сам, как только заданы переменные окружения.

## Что делает Александр (один раз, ~10 минут)

1. **Supabase-проект**
   - Зайти в [supabase.com](https://supabase.com) под своим аккаунтом → New project
     (можно переиспользовать существующий из resto-miniapp).
   - Settings → API: скопировать **Project URL** и **anon public** key.

2. **Таблица `favorites`**
   - SQL Editor → выполнить файл [`supabase/migrations/0001_favorites.sql`](supabase/migrations/0001_favorites.sql)
     (создаёт таблицу + RLS: каждый видит только своё).

3. **Google-провайдер** (это единственный шаг, где нужен Google Cloud)
   - [Google Cloud Console](https://console.cloud.google.com) → APIs & Services →
     Credentials → **Create OAuth client ID** → Web application.
   - Authorized redirect URI: `https://<ВАШ-ПРОЕКТ>.supabase.co/auth/v1/callback`
     (точное значение Supabase показывает на странице провайдера).
   - Скопировать Client ID и Client secret.
   - Supabase → Authentication → Providers → **Google** → включить, вставить
     Client ID и Client secret. Секрет живёт только в Supabase, **не в коде**.
   - Authentication → URL Configuration → добавить в Redirect URLs адрес сайта
     (`http://localhost:3300` для локали и прод-домен Vercel).

4. **Переменные окружения**
   - Локально: создать `.env.local` по образцу [`.env.example`](.env.example).
   - На Vercel: Project → Settings → Environment Variables добавить
     `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`, передеплоить.

## Что происходит в коде (уже готово)

- `lib/supabase.ts` — клиент; если env нет, слой выключен (localStorage-only).
- `lib/useFavorites.ts` — при входе локальная подборка **сливается** с облачной
  (объединение, гостевые лайки не теряются); дальше toggle пишет и в localStorage,
  и в таблицу. Кнопка «Войти/Выйти» в шапке появляется только когда Supabase задан.
