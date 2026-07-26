import type { MetadataRoute } from 'next';

/** Чтобы «На экран Домой» на телефоне давал нормальную иконку и запуск без адресной строки. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ЖК-Радар — новостройки Алматы',
    short_name: 'ЖК-Радар',
    description: 'Карта новостроек Алматы с риск-скором застройщика: стоит ли здесь покупать.',
    start_url: '/',
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
