'use client';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import s from '../app/home.module.scss';
import { BAND_COLOR, BAND_TEXT, BAND_LABEL } from '../lib/score';
import Icon from './Icon';
import { useFavorites } from '../lib/useFavorites';
import { useIsMobile, useIsTouch } from '../lib/useMediaQuery';
import { useSheet } from '../lib/useSheet';
import { CITIES, cityBySlug } from '../lib/cities';
import type { MapPoint, MapDetail } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div className={s.mapSkeleton} /> });

function GoogleG() {
  return (
    <svg width="15" height="15" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C39.9 41 44 36 44 24c0-1.3-.1-2.3-.4-3.5z" />
    </svg>
  );
}

export interface HomeZhk {
  id: number;
  slug: string;
  citySlug: string;
  name: string;
  district: string | null;
  districtColor: string | null;
  lat: number | null;
  lng: number | null;
  priceSqm: number | null;
  priceMin: number | null;
  classRu: string | null;
  constructionStatus: string | null;
  constructionStatusRu: string | null;
  salesStatus: string | null;
  developer: { name: string; slug: string } | null;
  parkingType: string;
  seismicResistance: number | null;
  finishing: string | null;
  image: string | null;
  band: 'green' | 'amber' | 'red' | 'grey';
  score: number | null;
  deal: boolean;
  real: boolean;
}

const BANDS: HomeZhk['band'][] = ['green', 'amber', 'red', 'grey'];
const CLASSES = ['эконом', 'комфорт', 'бизнес', 'премиум', 'элит'];
const STATUSES = [
  { key: 'ready', label: 'сдан' },
  { key: 'construction', label: 'строится' },
  { key: 'project', label: 'проект' },
];
const FINISHINGS = [
  { key: 'черновая', label: 'черновая', re: /чернов/i },
  { key: 'предчистовая', label: 'предчистовая', re: /предчист/i },
  { key: 'чистовая', label: 'чистовая', re: /(?<!пред)чистов/i },
];
const PRICES = [
  { key: 'lt25', label: 'до 25 млн', min: 0, max: 25e6 },
  { key: '25-50', label: '25–50 млн', min: 25e6, max: 50e6 },
  { key: '50-100', label: '50–100 млн', min: 50e6, max: 100e6 },
  { key: 'gt100', label: 'от 100 млн', min: 100e6, max: Infinity },
];
const DISTRICTS = [
  { name: 'Алмалинский', color: '#3498db' },
  { name: 'Ауэзовский', color: '#9b59b6' },
  { name: 'Бостандыкский', color: '#1abc9c' },
  { name: 'Жетысуский', color: '#e74c3c' },
  { name: 'Медеуский', color: '#2ecc71' },
  { name: 'Наурызбайский', color: '#f1c40f' },
  { name: 'Турксибский', color: '#e84393' },
  { name: 'Алатауский', color: '#e67e22' },
];

/**
 * Карточка ЖК в списке. Вынесена и обёрнута в memo: список рендерит 824 штуки,
 * и без этого выбор одного ЖК (тап по карте) перерисовывал бы их все.
 */
const ZhkCard = memo(function ZhkCard({
  z, isSelected, isFav, canFav, onSelect, onFav, register,
}: {
  z: HomeZhk; isSelected: boolean; isFav: boolean; canFav: boolean;
  onSelect: (id: number) => void; onFav: (id: number) => void;
  register: (id: number, el: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={(el) => register(z.id, el)}
      className={`${s.card} ${isSelected ? s.cardActive : ''}`}
      onClick={() => onSelect(z.id)}
    >
      {canFav && <button type="button" className={`${s.cardFav} ${isFav ? s.cardFavOn : ''}`} title={isFav ? 'Убрать из избранного' : 'Сохранить в избранное'} aria-label={isFav ? `Убрать ${z.name} из избранного` : `Сохранить ${z.name} в избранное`} aria-pressed={isFav} onClick={(e) => { e.stopPropagation(); onFav(z.id); }}>
        <Icon name="heart" size={15} fill={isFav ? 'currentColor' : 'none'} />
      </button>}
      {z.image ? <img className={s.thumb} src={z.image} alt="" loading="lazy" /> : <div className={`${s.thumb} ${s.thumbEmpty}`} aria-hidden>◫</div>}
      <div className={s.cardBody}>
        <div className={s.cardTop}>
          <div>
            <Link href={`/zhk${z.slug}`} className={s.cardName} onClick={(e) => e.stopPropagation()}>{z.name}</Link>
            <div className={s.cardDev}>{z.developer?.name ?? '—'}{z.district ? ` · ${z.district}` : ''}</div>
          </div>
          <div className={s.scoreBadge}>
            <div className={s.scoreNum} style={{ color: BAND_TEXT[z.band] }}>{z.score ?? '—'}</div>
            <div className={s.scoreCap}>{z.score != null ? 'защита' : 'мало'}</div>
          </div>
        </div>
        <div className={s.cardChips}>
          {z.deal && <span className={s.miniChip} style={{ background: 'var(--green)', color: '#fff', fontWeight: 650 }}><Icon name="flame" size={11} /> выгодно</span>}
          {z.real && <span className={s.miniChip} style={{ color: 'var(--green)', background: 'var(--green-soft)' }}><Icon name="camera" size={11} /> реальные фото</span>}
          {z.classRu && <span className={s.miniChip}>{z.classRu}</span>}
          {z.constructionStatusRu && <span className={s.miniChip}>{z.constructionStatusRu}</span>}
          {z.priceMin ? <span className={s.miniChip}>от {(z.priceMin / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸</span> : z.priceSqm ? <span className={s.miniChip}>{Math.round(z.priceSqm / 1000)} тыс ₸/м²</span> : null}
          {z.seismicResistance && <span className={s.miniChip}><Icon name="mountain" size={11} /> {z.seismicResistance}</span>}
        </div>
      </div>
    </div>
  );
});

/** Карточка объекта, выбранного тапом по карте. На тач-устройствах заменяет hover-попап. */
function MapDetailCard({ detail, onClose }: { detail: MapDetail; onClose: () => void }) {
  const fmtM = (v: number | null) => (v ? `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : null);
  return (
    // появляется по тапу по карте — без aria-live скринридер о ней не сообщит
    <div className={s.mapDetail} role="status" aria-live="polite">
      <button type="button" className={s.mapDetailClose} onClick={onClose} aria-label="Закрыть карточку"><Icon name="x" size={17} /></button>
      {detail.kind === 'apt' && (
        <>
          <div className={s.mdHead}>
            {detail.photo ? <img className={s.mdPhoto} src={detail.photo} alt="" loading="lazy" /> : <div className={`${s.mdPhoto} ${s.mdPhotoEmpty}`} aria-hidden>◫</div>}
            <div className={s.mdInfo}>
              <div className={s.mdPrice}>{fmtM(detail.price) ?? 'цена не указана'}</div>
              <div className={s.mdSub}>
                {[detail.rooms ? `${detail.rooms}-комн.` : null, detail.square ? `${detail.square} м²` : null, detail.floor || null].filter(Boolean).join(' · ')}
              </div>
              {detail.addr && <div className={s.mdAddr}>{detail.addr}</div>}
            </div>
          </div>
          <div className={s.mdChips}>
            <span className={s.miniChip} style={detail.market === 'primary' ? { color: 'var(--green)', background: 'var(--green-soft)' } : undefined}>
              {detail.market === 'primary' ? 'новостройка' : 'вторичка'}
            </span>
            {detail.price && detail.square ? <span className={s.miniChip}>{Math.round(detail.price / detail.square / 1000)} тыс ₸/м²</span> : null}
          </div>
          <a className={s.mdAction} href={`https://krisha.kz/a/show/${detail.id}`} target="_blank" rel="noopener noreferrer">
            Открыть на Krisha <Icon name="external" size={14} />
          </a>
        </>
      )}
      {detail.kind === 'landmark' && (
        <>
          <div className={s.mdHead}>
            {detail.photo ? <img className={s.mdPhoto} src={detail.photo} alt="" loading="lazy" /> : <div className={`${s.mdPhoto} ${s.mdPhotoEmpty}`} aria-hidden>◫</div>}
            <div className={s.mdInfo}>
              <div className={s.mdTitle}>{detail.name}</div>
              <div className={s.mdSub}>{[detail.kindRu, detail.rating ? `★ ${detail.rating}` : null].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        </>
      )}
      {detail.kind === 'fault' && (
        <div className={s.mdHead}>
          <div className={s.mdInfo}>
            <div className={s.mdTitle}>{detail.name}</div>
            <div className={s.mdSub}>
              {[detail.mw ? `магнитуда ${detail.mw}` : null, detail.lenKm ? `длина очага ${detail.lenKm} км` : null].filter(Boolean).join(' · ')}
            </div>
            {detail.note && <div className={s.mdAddr} style={{ whiteSpace: 'normal' }}>{detail.note}</div>}
            <div className={s.mdSub} style={{ marginTop: 6 }}>Источник: {detail.src}</div>
          </div>
        </div>
      )}
      {detail.kind === 'sold' && (
        <div className={s.mdHead}>
          <div className={s.mdInfo}>
            <div className={s.mdTitle}>Недавно продано</div>
            <div className={s.mdPrice}>{fmtM(detail.price) ?? '—'}</div>
            <div className={s.mdSub}>{[detail.rooms ? `${detail.rooms}-комн.` : null, detail.square ? `${detail.square} м²` : null, detail.addr].filter(Boolean).join(' · ')}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomeClient({ zhks }: { zhks: HomeZhk[] }) {
  const [q, setQ] = useState('');
  const [citySlug, setCitySlug] = useState('almaty');
  const city = cityBySlug(citySlug);
  // запоминаем выбор между заходами
  useEffect(() => { try { const v = localStorage.getItem('city'); if (v) setCitySlug(v); } catch {} }, []);
  useEffect(() => { try { localStorage.setItem('city', citySlug); } catch {} }, [citySlug]);
  const [band, setBand] = useState<Set<string>>(new Set());
  const [cls, setCls] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Set<string>>(new Set());
  const [district, setDistrict] = useState<string | null>(null);
  const [extra, setExtra] = useState<Set<string>>(new Set()); // deal, newbuilt, parking, seismic
  const [sort, setSort] = useState('score-desc');
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<'complexes' | 'apartments'>('complexes');
  const [aptMarket, setAptMarket] = useState<Set<string>>(new Set());
  const [aptRooms, setAptRooms] = useState<Set<number>>(new Set());
  const [showSold, setShowSold] = useState(false);
  const [priceRange, setPriceRange] = useState<string | null>(null);
  const priceBucket = PRICES.find((p) => p.key === priceRange) || null;
  const [finishing, setFinishing] = useState<Set<string>>(new Set());
  const [favOnly, setFavOnly] = useState(false);
  const fav = useFavorites();
  // избранное показываем только вошедшим: без входа подборку некуда сохранять
  // между устройствами, а кнопка создавала бы ложное ожидание
  const canFav = !!fav.user;
  const favSet = useMemo(() => new Set(fav.ids), [fav.ids]);
  const [aptMeta, setAptMeta] = useState<{ updatedAt: string; intervalDays?: number; total: number; primary: number; secondary: number; addedToday: number; soldToday: number; soldRecent: number } | null>(null);
  const toggleN = (set: Set<number>, v: number, upd: (s: Set<number>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n); };
  const [aptMetaError, setAptMetaError] = useState(false);
  useEffect(() => {
    if (mode !== 'apartments' || aptMeta) return;
    setAptMetaError(false);
    fetch(citySlug === 'almaty' ? '/listings-meta.json' : `/listings-meta-${citySlug}.json`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(setAptMeta)
      // раньше ошибка глоталась молча и блок статистики просто не появлялся
      .catch(() => setAptMetaError(true));
  }, [mode, aptMeta, citySlug]);

  // ---- мобильная оболочка: шторка поверх карты + модалка фильтров ----
  const isMobile = useIsMobile();
  const isTouch = useIsTouch();
  const sheet = useSheet(isMobile);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showFaults, setShowFaults] = useState(false);
  const [mapDetail, setMapDetail] = useState<MapDetail | null>(null);
  const cardRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  // Колбэки для карточек должны быть стабильными, иначе memo не сработает
  // и список всё равно перерисовывался бы целиком.
  const favToggleRef = useRef(fav.toggle);
  favToggleRef.current = fav.toggle;
  const onCardSelect = useCallback((id: number) => setSelected(id), []);
  const onCardFav = useCallback((id: number) => favToggleRef.current(id), []);
  const registerCard = useCallback((id: number, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el); else cardRefs.current.delete(id);
  }, []);

  const activeCount =
    band.size + cls.size + status.size + extra.size + finishing.size +
    aptMarket.size + aptRooms.size + (district ? 1 : 0) + (priceRange ? 1 : 0) + (showSold ? 1 : 0);

  const resetFilters = useCallback(() => {
    setBand(new Set()); setCls(new Set()); setStatus(new Set()); setExtra(new Set()); setFinishing(new Set());
    setAptMarket(new Set()); setAptRooms(new Set()); setDistrict(null); setPriceRange(null); setShowSold(false);
  }, []);

  // Модалка фильтров: блокируем прокрутку фона, Esc, ловушка фокуса и inert
  // на остальном — иначе с клавиатуры/скринридера можно уйти за пределы модалки.
  const filterHostRef = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!filtersOpen) return;
    const host = filterHostRef.current;
    restoreFocus.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // помечаем inert всё, кроме поддерева модалки: идём от неё вверх и
    // выключаем соседей на каждом уровне (body.children сам по себе бесполезен —
    // модалка лежит глубоко внутри дерева)
    const inerted: HTMLElement[] = [];
    for (let node: HTMLElement | null = host; node && node !== document.body; node = node.parentElement) {
      for (const sib of Array.from(node.parentElement?.children ?? [])) {
        if (sib !== node && !(sib as HTMLElement).inert) { (sib as HTMLElement).inert = true; inerted.push(sib as HTMLElement); }
      }
    }

    const FOCUSABLE = 'button:not([disabled]), a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    host?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setFiltersOpen(false); return; }
      if (e.key !== 'Tab' || !host) return;
      const items = Array.from(host.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
      inerted.forEach((el) => { el.inert = false; });
      restoreFocus.current?.focus?.();
    };
  }, [filtersOpen]);

  // тап по метке на карте (тач): вместо «телепорта» — карточка в шторке
  const handleMapDetail = useCallback((d: MapDetail | null) => {
    if (!d) { setMapDetail(null); return; }
    if (d.kind === 'zhk') {
      // у ЖК своя карточка уже есть в списке — показываем её, а не пустой блок
      // (MapDetailCard умеет только apt/landmark/sold)
      setMapDetail(null);
      setSelected(d.id);
      sheet.setIndex(1);
      requestAnimationFrame(() => cardRefs.current.get(d.id)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      return;
    }
    setMapDetail(d);
    sheet.setIndex(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // карточка объекта не должна «переживать» смену режима карты
  useEffect(() => { setMapDetail(null); }, [mode]);
  useEffect(() => { setAptMeta(null); }, [citySlug]);

  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = zhks.filter((z) => {
      if (z.citySlug !== citySlug) return false;   // показываем только выбранный город
      if (favOnly && !favSet.has(z.id)) return false;
      if (query && !(z.name.toLowerCase().includes(query) || z.developer?.name.toLowerCase().includes(query) || z.district?.toLowerCase().includes(query))) return false;
      if (band.size && !band.has(z.band)) return false;
      if (cls.size && !(z.classRu && cls.has(z.classRu))) return false;
      if (status.size) { const k = STATUSES.find((x) => x.label === z.constructionStatusRu)?.key; if (!k || !status.has(k)) return false; }
      if (district && z.district !== district) return false;
      if (extra.has('deal') && !z.deal) return false;
      if (extra.has('newbuilt') && !(z.constructionStatus === 'ready' && z.salesStatus !== 'sold')) return false;
      if (extra.has('parking') && !(z.parkingType === 'подземный' || z.parkingType === 'смешанный')) return false;
      if (extra.has('seismic') && !z.seismicResistance) return false;
      if (extra.has('real') && !z.real) return false;
      if (priceBucket) { if (!z.priceMin || !(z.priceMin >= priceBucket.min && z.priceMin < priceBucket.max)) return false; }
      if (finishing.size && !(z.finishing && FINISHINGS.some((f) => finishing.has(f.key) && f.re.test(z.finishing!)))) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === 'score-desc') return (b.score ?? -1) - (a.score ?? -1);
      if (sort === 'score-asc') return (a.score ?? 999) - (b.score ?? 999);
      if (sort === 'price-desc') return (b.priceSqm ?? 0) - (a.priceSqm ?? 0);
      if (sort === 'price-asc') return (a.priceSqm ?? Infinity) - (b.priceSqm ?? Infinity);
      return 0;
    });
    return list;
  }, [zhks, q, band, cls, status, district, extra, sort, priceBucket, finishing, favOnly, favSet, citySlug]);

  const points: MapPoint[] = useMemo(
    () => filtered.filter((z) => z.lat && z.lng).map((z) => ({
      id: z.id, slug: z.slug, name: z.name, lat: z.lat!, lng: z.lng!, band: z.band, score: z.score,
      priceSqm: z.priceSqm, priceMin: z.priceMin, developer: z.developer?.name ?? null,
      classRu: z.classRu, statusRu: z.constructionStatusRu, district: z.district, seismic: z.seismicResistance, image: z.image, real: z.real, deal: z.deal,
    })),
    [filtered]
  );

  return (
    <div className={s.shell}>
      <header className={s.header}>
        <div className={s.brand}>
          <div className={s.logoMark} aria-hidden>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" fill="#fff" stroke="none" opacity="0.15" />
              <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11z" />
              <circle cx="12" cy="10" r="2.2" fill="#fff" stroke="none" />
            </svg>
          </div>
          <div>
            <div className={s.logo}>ЖК<span className={s.radar}>·Радар</span></div>
            {/* на узком экране длинная версия обрезалась на полуслове */}
            <div className={s.tagline}><span className={s.taglineFull}>Krisha показывает, что продаётся. Мы — стоит ли покупать.</span><span className={s.taglineShort}>Стоит ли это покупать</span></div>
          </div>
        </div>
        <label className={s.citySel}>
          <Icon name="pin" size={15} />
          <select value={citySlug} onChange={(e) => { setCitySlug(e.target.value); setSelected(null); setDistrict(null); }} aria-label="Город">
            {CITIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </label>
        <div className={s.headerSpacer} />
        <Link href="/methodology" className={s.navlink}>Методология</Link>
        {canFav && <button type="button" className={`${s.favBtn} ${favOnly ? s.favBtnActive : ''}`} onClick={() => { setFavOnly((v) => !v); setMode('complexes'); }} title="Понравившиеся ЖК — ваша подборка" aria-label={`Избранное${fav.count ? `, сохранено: ${fav.count}` : ''}`} aria-pressed={favOnly}>
          <Icon name="heart" size={15} fill={favOnly ? '#fff' : 'none'} /> Избранное{fav.count ? <span className={s.favBadge}>{fav.count}</span> : null}
        </button>}
        {fav.authEnabled && (fav.user ? (
          <button type="button" className={s.authBtn} onClick={fav.signOut} title={`${fav.user.email || fav.user.name || ''} — выйти`} aria-label="Выйти из аккаунта">
            {fav.user.avatar ? <img src={fav.user.avatar} alt="" className={s.authAvatar} /> : <span className={s.authAvatar}>{(fav.user.name || fav.user.email || '?').slice(0, 1).toUpperCase()}</span>}
            Выйти
          </button>
        ) : (
          <button type="button" className={s.authBtn} onClick={fav.signInGoogle} title="Войти через Google — синхронизировать избранное между устройствами" aria-label="Войти через Google"><GoogleG /> Войти</button>
        ))}
      </header>

      <div className={s.body}>
        <div className={s.controls}>
          <div className={s.searchRow}>
            <Icon name="search" size={17} className={s.searchIcon} />
            <input className={s.search} placeholder="Поиск ЖК, застройщика, района…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button type="button" className={s.searchClear} aria-label="Очистить поиск" onClick={() => setQ('')}><Icon name="x" size={15} /></button>}
          </div>
          <div className={s.controlsRow}>
            <div className={s.modeToggle}>
              <button className={mode === 'complexes' && !favOnly ? s.modeActive : ''} onClick={() => { setMode('complexes'); setFavOnly(false); }}><Icon name="building" size={16} /> <span>ЖК-комплексы</span></button>
              <button className={mode === 'apartments' ? s.modeActive : ''} onClick={() => { setMode('apartments'); setFavOnly(false); }}><Icon name="key" size={16} /> <span>Квартиры</span></button>
            </div>
            <button type="button" className={`${s.filterBtn} ${activeCount ? s.filterBtnOn : ''}`} onClick={() => setFiltersOpen(true)} aria-label={`Фильтры${activeCount ? `, активно: ${activeCount}` : ''}`}>
              <Icon name="sliders" size={16} />
              <span>Фильтры</span>
              {activeCount > 0 && <span className={s.filterCount}>{activeCount}</span>}
            </button>
          </div>
        </div>

        <div ref={filterHostRef} className={`${s.filterHost} ${filtersOpen ? s.filterHostOpen : ''}`} role={isMobile ? 'dialog' : undefined} aria-modal={isMobile && filtersOpen ? true : undefined} aria-label="Фильтры">
            <div className={s.filterHostBar}>
              <b>Фильтры</b>
              <button type="button" className={s.filterClose} onClick={() => setFiltersOpen(false)} aria-label="Закрыть фильтры"><Icon name="x" size={19} /></button>
            </div>
            <div className={s.filterScroll}>

            <div className={s.filterGroup}>
              <span className={s.fLabel}>Цена {mode === 'apartments' ? 'квартиры' : 'от'}</span>
              {PRICES.map((p) => (<button key={p.key} className={`${s.pill} ${priceRange === p.key ? s.pillActive : ''}`} onClick={() => setPriceRange(priceRange === p.key ? null : p.key)}>{p.label}</button>))}
            </div>

            {city.hasDistricts && <div className={s.filterGroup}>
              <span className={s.fLabel}>Район</span>
              {DISTRICTS.map((d) => (
                <button key={d.name} className={`${s.pill} ${district === d.name ? s.pillActive : ''}`} onClick={() => setDistrict(district === d.name ? null : d.name)}
                  style={district === d.name ? { background: d.color, borderColor: d.color, color: '#fff' } : { borderColor: d.color + '66' }}>
                  {d.name}
                </button>
              ))}
            </div>}

            {mode === 'complexes' ? (
              <>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Выгода и готовность</span>
                  <button className={`${s.pill} ${extra.has('deal') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'deal', setExtra)}><Icon name="flame" size={14} /> выгодные</button>
                  <button className={`${s.pill} ${extra.has('newbuilt') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'newbuilt', setExtra)}>сдан и в продаже</button>
                  <button className={`${s.pill} ${extra.has('real') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'real', setExtra)}><Icon name="camera" size={14} /> реальные фото</button>
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Защита покупателя</span>
                  {BANDS.map((b) => (
                    <button key={b} className={`${s.pill} ${band.has(b) ? s.pillActive : ''}`} onClick={() => toggle(band, b, setBand)}
                      style={band.has(b) ? undefined : { borderColor: BAND_COLOR[b] + '66' }}>
                      {BAND_LABEL[b]}
                    </button>
                  ))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Класс</span>
                  {CLASSES.map((c) => (<button key={c} className={`${s.pill} ${cls.has(c) ? s.pillActive : ''}`} onClick={() => toggle(cls, c, setCls)}>{c}</button>))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Отделка</span>
                  {FINISHINGS.map((f) => (<button key={f.key} className={`${s.pill} ${finishing.has(f.key) ? s.pillActive : ''}`} onClick={() => toggle(finishing, f.key, setFinishing)}>{f.label}</button>))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Статус · паркинг · сейсмо</span>
                  {STATUSES.map((st) => (<button key={st.key} className={`${s.pill} ${status.has(st.key) ? s.pillActive : ''}`} onClick={() => toggle(status, st.key, setStatus)}>{st.label}</button>))}
                  <button className={`${s.pill} ${extra.has('parking') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'parking', setExtra)}>подземный паркинг</button>
                  <button className={`${s.pill} ${extra.has('seismic') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'seismic', setExtra)}>сейсмобалл</button>
                </div>
              </>
            ) : (
              <>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Рынок</span>
                  <button className={`${s.pill} ${aptMarket.has('primary') ? s.pillActive : ''}`} onClick={() => toggle(aptMarket, 'primary', setAptMarket)} style={aptMarket.has('primary') ? undefined : { borderColor: '#16a34a66' }}>первичка (новостройки)</button>
                  <button className={`${s.pill} ${aptMarket.has('secondary') ? s.pillActive : ''}`} onClick={() => toggle(aptMarket, 'secondary', setAptMarket)} style={aptMarket.has('secondary') ? undefined : { borderColor: '#6b8bb066' }}>вторичка</button>
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Комнат</span>
                  {[1, 2, 3, 4].map((r) => (<button key={r} className={`${s.pill} ${aptRooms.has(r) ? s.pillActive : ''}`} onClick={() => toggleN(aptRooms, r, setAptRooms)}>{r}{r === 4 ? '+' : ''}</button>))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Статус продажи</span>
                  <button className={`${s.pill} ${showSold ? s.pillActive : ''}`} onClick={() => setShowSold(!showSold)} style={showSold ? undefined : { borderColor: '#e0293f66' }}>недавно продано</button>
                </div>
              </>
            )}
            </div>
            <div className={s.filterFoot}>
              <button type="button" className={s.filterReset} onClick={resetFilters} disabled={!activeCount}>Сбросить</button>
              <button type="button" className={s.filterApply} onClick={() => setFiltersOpen(false)}>
                {mode === 'complexes' ? `Показать ${filtered.length}` : 'Показать на карте'}
              </button>
            </div>
          </div>
        {filtersOpen && <div className={s.filterScrim} onClick={() => setFiltersOpen(false)} aria-hidden />}

        <aside
          ref={sheet.sheetRef as React.RefObject<HTMLElement>}
          className={`${s.sidebar} ${sheet.dragging ? s.sidebarDragging : ''}`}
          style={isMobile ? { transform: `translate3d(0, ${sheet.y}px, 0)` } : undefined}
        >
          <div className={s.grip} {...sheet.dragProps}>
            <button
              type="button"
              className={s.gripBar}
              aria-label={sheet.index === 2 ? 'Свернуть список' : 'Развернуть список'}
              onClick={() => sheet.setIndex(sheet.index === 2 ? 0 : ((sheet.index + 1) as 0 | 1 | 2))}
            />
          </div>

          {mapDetail && <MapDetailCard detail={mapDetail} onClose={() => setMapDetail(null)} />}

          {mode === 'complexes' ? (
            <>
              {favOnly && (
                <div className={s.favBanner}>
                  <span><Icon name="heart" size={14} fill="currentColor" /> Понравившиеся — {fav.count}</span>
                  {fav.count > 0 && <button type="button" onClick={fav.clear}><Icon name="trash" size={13} /> очистить</button>}
                </div>
              )}
              <div className={s.resultBar} {...sheet.headerDragProps}>
                <span>{filtered.length} ЖК{district ? ` · ${district}` : ''}</span>
                <select className={s.sortSel} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
                  <option value="score-desc">защита: сначала высокая</option>
                  <option value="score-asc">защита: сначала низкая</option>
                  <option value="price-desc">цена: сначала дорогие</option>
                  <option value="price-asc">цена: сначала дешёвые</option>
                </select>
              </div>
              <div className={s.list} ref={sheet.scrollRef as React.RefObject<HTMLDivElement>} {...sheet.contentProps}>
                {filtered.map((z) => (
                  <ZhkCard
                    key={z.id}
                    z={z}
                    isSelected={selected === z.id}
                    isFav={favSet.has(z.id)}
                    canFav={canFav}
                    onSelect={onCardSelect}
                    onFav={onCardFav}
                    register={registerCard}
                  />
                ))}
                {filtered.length === 0 && (
                  favOnly
                    ? <div className={s.favEmpty}><Icon name="heart" size={26} /><div>Пока пусто</div><span>Нажмите ♥ на карточке ЖК или на карте — он появится здесь. Подборка хранится в этом браузере{fav.authEnabled && !fav.user ? ', войдите через Google, чтобы синхронизировать между устройствами' : ''}.</span></div>
                    : <div style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center' }}>Ничего не найдено под фильтры.</div>
                )}
              </div>
            </>
          ) : (
            <>
            {/* заголовок шторки: на десктопе дублировал бы счётчик из .aptStat ниже */}
            <div className={`${s.resultBar} ${s.sheetOnly}`} {...sheet.headerDragProps}>
              <span>{aptMeta ? `${aptMeta.total.toLocaleString('ru-RU')} квартир` : 'Квартиры на карте'}{district ? ` · ${district}` : ''}</span>
            </div>
            <div className={s.aptPanel} ref={sheet.scrollRef as React.RefObject<HTMLDivElement>} {...sheet.contentProps}>
              {aptMeta && (
                <div className={s.aptStat}>
                  <div className={s.aptStatTotal}><b>{aptMeta.total.toLocaleString('ru-RU')}</b> квартир на карте</div>
                  {(aptMeta.addedToday > 0 || aptMeta.soldToday > 0) && (
                    <div className={s.aptStatDeltas}>
                      <span className={s.up}>+{aptMeta.addedToday} {(aptMeta.intervalDays ?? 1) > 1 ? `за ${aptMeta.intervalDays} дн.` : 'за день'}</span>
                      <span className={s.down}>−{aptMeta.soldToday} продано</span>
                    </div>
                  )}
                  {/* Пишем только проверяемый факт — дату снимка. Обещать
                      «обновляется ежедневно» приложение не вправе: оно не знает,
                      работает ли автоматика, и на первом снимке интервал тоже 1. */}
                  <div className={s.aptStatFoot}>
                    <Icon name="refresh" size={11} /> данные на {new Date(aptMeta.updatedAt).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              )}
              {aptMetaError && (
                <div className={s.aptStatError} role="status">
                  По городу {city.name} данные о квартирах ещё не собраны. ЖК-комплексы работают.
                  <button type="button" onClick={() => setAptMeta(null)}>Повторить</button>
                </div>
              )}
              <ul className={s.aptSteps}>
                <li><span className={s.stepDot} style={{ background: '#5f95e3' }} /> Кружок с числом — сколько квартир рядом. Нажмите, чтобы приблизить.</li>
                <li><span className={s.stepDot} style={{ background: '#16a34a' }} /> Зелёные — новостройки, серо-синие — вторичка. Нажмите на метку: цена, комнаты, площадь.</li>
                <li><span className={s.stepDot} style={{ background: '#111827' }} /> Чёрные метки — ориентиры (ТРЦ, парки, вокзалы) с фото и рейтингом.</li>
              </ul>
              <div className={s.aptSrc}>Объявления — krisha.kz. Риск-скор считается только для ЖК-комплексов.</div>
            </div>
            </>
          )}
        </aside>

        <div className={s.mapWrap}>
          {mode === 'complexes' ? (
            <div className={s.legend}>
              {BANDS.map((b) => (<div key={b} className={s.legendRow}><span className={s.legendDot} style={{ background: BAND_COLOR[b] }} /> {BAND_LABEL[b]}</div>))}
              <div className={s.legendRow} style={{ marginTop: 4, borderTop: '1px solid var(--border-soft)', paddingTop: 8, color: 'var(--green)' }}><Icon name="flame" size={13} /> выгодная цена</div>
            </div>
          ) : (
            <div className={s.legend}>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#5f95e3' }} /> кластер — число предложений</div>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#16a34a' }} /> первичка (новостройка)</div>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#6b8bb0' }} /> вторичка</div>
              <div className={s.legendRow} style={{ marginTop: 4, borderTop: '1px solid var(--border-soft)', paddingTop: 8 }}><span className={s.legendDot} style={{ background: '#111827' }} /> ориентиры (ТРЦ, вокзалы)</div>
            </div>
          )}
          {city.hasCityFaults && <button
            type="button"
            className={`${s.faultsBtn} ${showFaults ? s.faultsBtnOn : ''}`}
            onClick={() => setShowFaults((v) => !v)}
            aria-pressed={showFaults}
            title="Активные разломы по данным GEM — региональный масштаб, не городская карта микрорайонирования"
          >
            <span className={s.faultsDash} aria-hidden />
            Разломы
          </button>}
          {showFaults && (
            <div className={s.faultsNote} role="status">
              <button type="button" className={s.faultsNoteClose} onClick={() => setShowFaults(false)} aria-label="Скрыть разломы"><Icon name="x" size={15} /></button>
              <b>Оранжевый пунктир</b> — сеть разломов внутри города (оцифровано со статьи
              Frontiers 2024, CC BY). <b>Сплошные красные</b> — очаги землетрясений 1887, 1889,
              1911, разрушавших Алматы (отчёт JICA/OYO 2009).
              Точность привязки измерена: медиана 281 м, у части линий до 900 м — это сопоставимо
              с зоной отчуждения 300 м, поэтому <b>по конкретному дому судить нельзя</b>.
            </div>
          )}
          <MapView points={points} selectedId={selected} onSelect={setSelected} activeDistrict={district} mode={mode} aptMarket={aptMarket} aptRooms={aptRooms} showSold={showSold} aptPrice={priceBucket ? { min: priceBucket.min, max: priceBucket.max } : null} favSet={favSet} onToggleFav={fav.toggle} touchMode={isTouch} onDetail={handleMapDetail} showFaults={showFaults} citySlug={citySlug} cityCenter={city.center} cityZoom={city.zoom} />
        </div>
      </div>
    </div>
  );
}
