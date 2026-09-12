'use client';
import { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from './Icon';
import s from '../app/home.module.scss';
import { BAND_LABEL, BAND_TEXT } from '../lib/score';
import type { Apt } from './MapView';
import type { HomeZhk } from './HomeClient';

/** Хост фотографий krisha одинаков у всех объявлений — в данных его не держим. */
const PHOTO_ROOT = 'https://krisha-photos.kcdn.online/webp/';

/** Варианты, которые отдаёт CDN krisha (проверено HEAD-запросами): 800x600 и 1200x900 — 404. */
const PHOTO_SIZE = { full: 'full', card: '750x470', thumb: '400x300' } as const;

/** Все снимки объявления: папка одна, номера лежат отдельным списком. */
export function aptPhotos(a: Apt, size: keyof typeof PHOTO_SIZE = 'full'): string[] {
  const suffix = PHOTO_SIZE[size];
  if (a.pd && a.pi) {
    const ext = a.pe || 'jpg';
    const dir = a.pd.startsWith('http') ? a.pd : PHOTO_ROOT + a.pd;
    return a.pi.split(',').filter(Boolean).map((i) => `${dir}/${i}-${suffix}.${ext}`);
  }
  // старый срез данных: галереи нет, но одну картинку показать можем
  return a.photo ? [a.photo] : [];
}

// значения krisha: specialist 22133, owner 21277, company 1263, complex 311
const OWNER_TYPE: Record<string, string> = {
  owner: 'собственник',
  specialist: 'риелтор',
  agent: 'риелтор',
  company: 'агентство',
  complex: 'застройщик',
};

const fmtM = (v: number | null) =>
  v ? `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : 'цена не указана';

/**
 * Карточка квартиры внутри приложения. Раньше единственным способом посмотреть
 * фотографии был уход на krisha — то есть выход из приложения на первом же
 * интересном объявлении. Ссылка осталась, но уже как последний шаг.
 */
export default function AptCard({ apt, onBack, link }: {
  apt: Apt; onBack: () => void;
  /** ЖК, в котором продаётся квартира, и как мы это установили. */
  link?: { zhk: HomeZhk; how: 'page' | 'centroid' } | null;
}) {
  const photos = aptPhotos(apt);
  const [idx, setIdx] = useState(0);
  const strip = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<Set<number>>(new Set());

  // индекс считаем по прокрутке: нативный scroll-snap ведёт себя привычнее
  // любого самодельного драга — инерция, отскок и жесты «назад» остаются системными
  const onScroll = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    setIdx((prev) => (prev === i ? prev : i));
  }, []);

  const go = (d: number) => {
    const el = strip.current;
    if (!el) return;
    const i = Math.min(photos.length - 1, Math.max(0, idx + d));
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  };

  const sqm = apt.price && apt.square ? Math.round(apt.price / apt.square / 1000) : null;
  const ownerType = apt.ot ? OWNER_TYPE[String(apt.ot).toLowerCase()] : null;
  const params = [
    apt.rooms ? `${apt.rooms}-комн.` : null,
    apt.square ? `${apt.square} м²` : null,
    apt.floor ? `${apt.floor} этаж` : null,
  ].filter(Boolean);

  return (
    <div className={s.aptCard}>
      <div className={s.aptCardBar}>
        <button type="button" className={s.aptCardBack} onClick={onBack} aria-label="Назад к списку">
          <Icon name="left" size={18} /> К списку
        </button>
      </div>

      <div className={s.aptCardScroll}>
        {photos.length > 0 ? (
          <div className={s.aptGal}>
            <div className={s.aptGalStrip} ref={strip} onScroll={onScroll}>
              {photos.map((url, i) => (
                <div className={s.aptGalSlide} key={url}>
                  {failed.has(i)
                    ? <div className={s.aptGalDead} aria-hidden>фото недоступно</div>
                    : <img
                        src={url}
                        alt={`Фото ${i + 1} из ${photos.length}`}
                        loading={i === 0 ? 'eager' : 'lazy'}
                        onError={() => setFailed((f) => new Set(f).add(i))}
                      />}
                </div>
              ))}
            </div>
            {photos.length > 1 && (
              <>
                <div className={s.aptGalCount}>{idx + 1} / {photos.length}</div>
                <button type="button" className={`${s.aptGalNav} ${s.aptGalPrev}`} onClick={() => go(-1)} disabled={idx === 0} aria-label="Предыдущее фото"><Icon name="left" size={19} /></button>
                <button type="button" className={`${s.aptGalNav} ${s.aptGalNext}`} onClick={() => go(1)} disabled={idx === photos.length - 1} aria-label="Следующее фото"><Icon name="right" size={19} /></button>
              </>
            )}
          </div>
        ) : (
          <div className={s.aptGalEmpty} aria-hidden>◫ фотографий нет</div>
        )}

        <div className={s.aptCardBody}>
          <div className={s.aptCardPrice}>{fmtM(apt.price)}</div>
          {sqm && <div className={s.aptCardSqm}>{sqm} тыс ₸ за м²</div>}

          <div className={s.aptCardParams}>
            {params.map((p) => <span key={p} className={s.miniChip}>{p}</span>)}
            <span className={s.miniChip} style={apt.market === 'primary' ? { color: 'var(--green)', background: 'var(--green-soft)' } : undefined}>
              {apt.market === 'primary' ? 'новостройка' : 'вторичка'}
            </span>
          </div>

          {apt.addr && (
            <div className={s.aptCardRow}>
              <Icon name="pin" size={15} />
              <span>{apt.addr}</span>
            </div>
          )}
          {(apt.ow || ownerType) && (
            <div className={s.aptCardRow}>
              <Icon name="info" size={15} />
              <span>{[apt.ow, ownerType].filter(Boolean).join(' · ')}</span>
            </div>
          )}

          {link && (
            <Link href={`/zhk${link.zhk.slug}`} className={s.aptZhk}>
              <span className={s.aptZhkHead}>
                <span className={s.aptZhkLabel}><Icon name="shieldSolid" size={13} /> Защита покупателя в этом ЖК</span>
                <span className={s.aptZhkScore} style={{ color: BAND_TEXT[link.zhk.band] }}>
                  {link.zhk.score ?? '—'}<small>/100</small>
                </span>
              </span>
              <span className={s.aptZhkName}>{link.zhk.name}</span>
              <span className={s.aptZhkSub}>
                {link.zhk.score != null ? BAND_LABEL[link.zhk.band] : 'мало данных'}
                {link.zhk.developer ? ` · ${link.zhk.developer.name}` : ''}
                {link.how === 'centroid' ? ' · привязка по координатам' : ''}
              </span>
              <span className={s.aptZhkGo}>Разбор ЖК <Icon name="right" size={13} /></span>
            </Link>
          )}

          <p className={s.aptCardNote}>
            Описание, планировку и контакты продавца показывает krisha — мы их не копируем.
            Здесь только то, что нужно, чтобы решить, стоит ли туда идти.
          </p>
        </div>
      </div>

      <div className={s.aptCardFoot}>
        <a className={s.aptCardGo} href={`https://krisha.kz/a/show/${apt.id}`} target="_blank" rel="noopener noreferrer">
          Смотреть на Krisha <Icon name="external" size={15} />
        </a>
      </div>
    </div>
  );
}
