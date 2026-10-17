import type { MetadataRoute } from 'next';

/** Чтобы «На экран Домой» на телефоне давал нормальную иконку и запуск без адресной строки. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Tirek — новостройки с индексом защиты покупателя',
    short_name: 'Tirek',
    description: 'Карта новостроек Казахстана: индекс защиты покупателя 0–100 по открытым данным.',
    start_url: '/#map',
    display: 'standalone',
    background_color: '#f4f6f8',
    theme_color: '#ffffff',
    lang: 'ru',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
