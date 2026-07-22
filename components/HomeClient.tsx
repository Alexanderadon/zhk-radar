'use client';
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import s from '../app/home.module.scss';
import { BAND_COLOR, BAND_LABEL } from '../lib/score';
import Icon from './Icon';
import { useFavorites } from '../lib/useFavorites';
import type { MapPoint } from './MapView';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

export interface HomeZhk {
  id: number;
  slug: string;
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

export default function HomeClient({ zhks }: { zhks: HomeZhk[] }) {
  const [q, setQ] = useState('');
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
  const favSet = useMemo(() => new Set(fav.ids), [fav.ids]);
  const [aptMeta, setAptMeta] = useState<{ updatedAt: string; total: number; primary: number; secondary: number; addedToday: number; soldToday: number; soldRecent: number } | null>(null);
  const toggleN = (set: Set<number>, v: number, upd: (s: Set<number>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n); };
  useEffect(() => { if (mode === 'apartments' && !aptMeta) fetch('/listings-meta.json').then((r) => r.json()).then(setAptMeta).catch(() => {}); }, [mode, aptMeta]);

  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = zhks.filter((z) => {
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
  }, [zhks, q, band, cls, status, district, extra, sort, priceBucket, finishing, favOnly, favSet]);

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
            <div className={s.tagline}>Krisha показывает, что продаётся. Мы — стоит ли покупать.</div>
          </div>
        </div>
        <div className={s.headerSpacer} />
        <Link href="/methodology" className={s.navlink}>Методология</Link>
        <button type="button" className={`${s.favBtn} ${favOnly ? s.favBtnActive : ''}`} onClick={() => { setFavOnly((v) => !v); setMode('complexes'); }} title="Понравившиеся ЖК — ваша подборка">
          <Icon name="heart" size={15} fill={favOnly ? '#fff' : 'none'} /> Избранное{fav.count ? <span className={s.favBadge}>{fav.count}</span> : null}
        </button>
      </header>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.filters}>
            <div className={s.searchRow}>
              <Icon name="search" size={17} className={s.searchIcon} />
              <input className={s.search} placeholder="Поиск ЖК, застройщика, района…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className={s.modeToggle}>
              <button className={mode === 'complexes' && !favOnly ? s.modeActive : ''} onClick={() => { setMode('complexes'); setFavOnly(false); }}><Icon name="building" size={16} /> ЖК-комплексы</button>
              <button className={mode === 'apartments' ? s.modeActive : ''} onClick={() => { setMode('apartments'); setFavOnly(false); }}><Icon name="key" size={16} /> Квартиры</button>
            </div>

            <div className={s.filterGroup}>
              <span className={s.fLabel}>Цена {mode === 'apartments' ? 'квартиры' : 'от'}</span>
              {PRICES.map((p) => (<button key={p.key} className={`${s.pill} ${priceRange === p.key ? s.pillActive : ''}`} onClick={() => setPriceRange(priceRange === p.key ? null : p.key)}>{p.label}</button>))}
            </div>

            <div className={s.filterGroup}>
              <span className={s.fLabel}>Район</span>
              {DISTRICTS.map((d) => (
                <button key={d.name} className={`${s.pill} ${district === d.name ? s.pillActive : ''}`} onClick={() => setDistrict(district === d.name ? null : d.name)}
                  style={district === d.name ? { background: d.color, borderColor: d.color, color: '#fff' } : { borderColor: d.color + '66' }}>
                  {d.name}
                </button>
              ))}
            </div>

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

          {mode === 'complexes' ? (
            <>
              {favOnly && (
                <div className={s.favBanner}>
                  <span><Icon name="heart" size={14} fill="currentColor" /> Понравившиеся — {fav.count}</span>
                  {fav.count > 0 && <button type="button" onClick={fav.clear}><Icon name="trash" size={13} /> очистить</button>}
                </div>
              )}
              <div className={s.resultBar}>
                <span>{filtered.length} ЖК{district ? ` · ${district}` : ''}</span>
                <select className={s.sortSel} value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="score-desc">защита: сначала высокая</option>
                  <option value="score-asc">защита: сначала низкая</option>
                  <option value="price-desc">цена: сначала дорогие</option>
                  <option value="price-asc">цена: сначала дешёвые</option>
                </select>
              </div>
              <div className={s.list}>
                {filtered.map((z) => (
                  <div key={z.id} className={`${s.card} ${selected === z.id ? s.cardActive : ''}`} onClick={() => setSelected(z.id)}>
                    <button type="button" className={`${s.cardFav} ${fav.has(z.id) ? s.cardFavOn : ''}`} title={fav.has(z.id) ? 'Убрать из избранного' : 'Сохранить в избранное'} onClick={(e) => { e.stopPropagation(); fav.toggle(z.id); }}>
                      <Icon name="heart" size={15} fill={fav.has(z.id) ? 'currentColor' : 'none'} />
                    </button>
                    {z.image ? <img className={s.thumb} src={z.image} alt="" loading="lazy" /> : <div className={`${s.thumb} ${s.thumbEmpty}`}>◫</div>}
                    <div className={s.cardBody}>
                      <div className={s.cardTop}>
                        <div>
                          <Link href={`/zhk${z.slug}`} className={s.cardName} onClick={(e) => e.stopPropagation()}>{z.name}</Link>
                          <div className={s.cardDev}>{z.developer?.name ?? '—'}{z.district ? ` · ${z.district}` : ''}</div>
                        </div>
                        <div className={s.scoreBadge}>
                          <div className={s.scoreNum} style={{ color: BAND_COLOR[z.band] }}>{z.score ?? '—'}</div>
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
                ))}
                {filtered.length === 0 && (
                  favOnly
                    ? <div className={s.favEmpty}><Icon name="heart" size={26} /><div>Пока пусто</div><span>Нажмите ♥ на карточке ЖК или на карте — он появится здесь. Подборка хранится в этом браузере.</span></div>
                    : <div style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center' }}>Ничего не найдено под фильтры.</div>
                )}
              </div>
            </>
          ) : (
            <div className={s.aptPanel}>
              {aptMeta && (
                <div className={s.aptStat}>
                  <div className={s.aptStatTotal}><b>{aptMeta.total.toLocaleString('ru-RU')}</b> квартир на карте</div>
                  <div className={s.aptStatDeltas}>
                    <span className={s.up}>+{aptMeta.addedToday} за день</span>
                    <span className={s.down}>−{aptMeta.soldToday} продано</span>
                  </div>
                  <div className={s.aptStatFoot}><Icon name="refresh" size={11} /> обновляется автоматически · {new Date(aptMeta.updatedAt).toLocaleDateString('ru-RU')}</div>
                </div>
              )}
              <ul className={s.aptSteps}>
                <li><span className={s.stepDot} style={{ background: '#5f95e3' }} /> Кружок с числом — сколько квартир рядом. Нажмите, чтобы приблизить.</li>
                <li><span className={s.stepDot} style={{ background: '#16a34a' }} /> Зелёные — новостройки, серо-синие — вторичка. Наведите: цена, комнаты, площадь.</li>
                <li><span className={s.stepDot} style={{ background: '#111827' }} /> Чёрные метки — ориентиры (ТРЦ, парки, вокзалы) с фото и рейтингом.</li>
              </ul>
              <div className={s.aptSrc}>Объявления — krisha.kz. Риск-скор считается только для ЖК-комплексов.</div>
            </div>
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
          <MapView points={points} selectedId={selected} onSelect={setSelected} activeDistrict={district} mode={mode} aptMarket={aptMarket} aptRooms={aptRooms} showSold={showSold} aptPrice={priceBucket ? { min: priceBucket.min, max: priceBucket.max } : null} favSet={favSet} onToggleFav={fav.toggle} />
        </div>
      </div>
    </div>
  );
}
