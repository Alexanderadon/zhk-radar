import type { Metadata, Viewport } from 'next';
import { Unbounded } from 'next/font/google';
import './globals.scss';

// Шрифты: заголовки и лого — Unbounded (кириллица и казахские буквы есть), текст —
// системный (SF / Segoe UI / Roboto, тоже с казахскими). Inter как веб-шрифт
// добавлял ~180 КБ и пересчёт вёрстки при подмене — страница ЖК теряла ~2.5 с LCP.
// subsets — только то, что грузится заранее; латиница и cyrillic-ext с ә ғ қ ң ө ү һ
// качаются по unicode-range, когда такие буквы есть на странице.
const display = Unbounded({ subsets: ['cyrillic'], variable: '--ff-display', display: 'swap' });

// viewportFit: cover — иначе на iPhone с «чёлкой» нижняя панель уезжает под home-indicator
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

const DESCRIPTION =
  'Индекс защиты покупателя для каждой новостройки: госгарантия для дольщиков, надёжность застройщика, сейсмостойкость и цена против рынка — по открытым данным. Алматы, Астана, Шымкент, Талдыкорган, Капчагай.';

export const metadata: Metadata = {
  metadataBase: new URL('https://tirek-kz.vercel.app'),
  title: { default: 'Tirek — новостройки Казахстана с индексом защиты покупателя', template: '%s · Tirek' },
  description: DESCRIPTION,
  applicationName: 'Tirek',
  keywords: ['новостройки Алматы', 'новостройки Астаны', 'ЖК Казахстан', 'застройщики Казахстана', 'проверка застройщика', 'долевое строительство', 'гарантия КФГЖС'],
  openGraph: {
    type: 'website', siteName: 'Tirek', locale: 'ru_KZ',
    title: 'Tirek — сначала проверь, потом покупай',
    description: DESCRIPTION,
  },
  twitter: { card: 'summary_large_image', title: 'Tirek — сначала проверь, потом покупай', description: DESCRIPTION },
};

/**
 * Лендинг стоит на «/» поверх карты. Кто уже открывал карту (или пришёл по
 * ссылке «/#map»), видит карту сразу: класс ставится до первой отрисовки,
 * поэтому лендинг не мигает. «?intro» показывает его принудительно — для записи видео.
 */
const SKIP_INTRO = `try{var d=document.documentElement,l=location;d.classList.add('js');if(l.pathname==='/'&&l.search.indexOf('intro')<0&&(l.hash==='#map'||l.search.indexOf('q=')>=0||localStorage.getItem('tirek:map')==='1'))d.classList.add('skip-intro')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={display.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIP_INTRO }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
