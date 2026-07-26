import type { Metadata, Viewport } from 'next';
import './globals.scss';

// viewportFit: cover — иначе на iPhone с «чёлкой» нижняя панель уезжает под home-indicator
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
};

export const metadata: Metadata = {
  title: 'ЖК-Радар — карта новостроек Алматы с риск-скором застройщиков',
  description:
    'Krisha показывает, что продаётся. ЖК-Радар показывает, стоит ли это покупать: прозрачный риск-балл застройщика из открытых проверяемых данных — гарантии долевого участия, трек застройщика, сейсмостойкость, паркинг.',
  keywords: ['новостройки Алматы', 'ЖК Алматы', 'застройщики Казахстана', 'риск застройщика', 'долевое строительство'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
