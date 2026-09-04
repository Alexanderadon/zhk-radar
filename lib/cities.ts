/**
 * Реестр городов. Всё, что отличает один город от другого, живёт здесь:
 * центр карты, рамка для скрапинга krisha и слуг каталога korter.
 *
 * hasCityFaults — есть ли ГОРОДСКАЯ карта разломов. Она нашлась только для
 * Алматы (статья Frontiers 2024). Для остальных городов таких публикаций нет,
 * а Астана вообще стоит на устойчивой платформе — рисовать там слой значило бы
 * имитировать данные, поэтому тумблер разломов показывается только там, где
 * есть что показать.
 */
export interface City {
  slug: string;
  name: string;
  nameIn: string;            // «в Алматы», для подписей
  center: [number, number];
  zoom: number;
  /** рамка для скрапинга: север, запад, юг, восток */
  bbox: [number, number, number, number];
  krisha: string;            // слуг города на krisha.kz
  korter: string | null;     // слуг каталога новостроек на korter.kz
  hasCityFaults: boolean;
  /** Есть ли границы районов: пока собраны только для Алматы. */
  hasDistricts: boolean;
}

export const CITIES: City[] = [
  {
    slug: 'almaty', name: 'Алматы', nameIn: 'Алматы',
    center: [76.905, 43.238], zoom: 11,
    bbox: [43.40, 76.70, 43.05, 77.20],
    krisha: 'almaty', korter: 'новостройки-алматы', hasCityFaults: true, hasDistricts: true,
  },
  {
    slug: 'astana', name: 'Астана', nameIn: 'Астане',
    center: [71.43, 51.13], zoom: 11,
    bbox: [51.25, 71.20, 51.00, 71.70],
    krisha: 'astana', korter: 'новостройки-астаны', hasCityFaults: false, hasDistricts: false,
  },
  {
    slug: 'shymkent', name: 'Шымкент', nameIn: 'Шымкенте',
    center: [69.62, 42.32], zoom: 11.5,
    bbox: [42.42, 69.48, 42.22, 69.78],
    krisha: 'shymkent', korter: 'новостройки-шымкента', hasCityFaults: false, hasDistricts: false,
  },
  {
    slug: 'taldykorgan', name: 'Талдыкорган', nameIn: 'Талдыкоргане',
    center: [78.37, 45.01], zoom: 12,
    bbox: [45.07, 78.28, 44.94, 78.47], 
    krisha: 'taldykorgan', korter: 'новостройки-талдыкоргана', hasCityFaults: false, hasDistricts: false,
  },
  {
    slug: 'kapchagay', name: 'Капчагай', nameIn: 'Капчагае',
    center: [77.06, 43.87], zoom: 12,
    bbox: [43.93, 76.98, 43.80, 77.15],
    krisha: 'konaev', korter: 'новостройки-капчагая', hasCityFaults: false, hasDistricts: false,
  },
];

export const DEFAULT_CITY = CITIES[0];
export const cityBySlug = (s: string | null | undefined) =>
  CITIES.find((c) => c.slug === s) ?? DEFAULT_CITY;
