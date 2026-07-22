'use client';
import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import s from '../app/home.module.scss';
import { BAND_COLOR, BAND_LABEL } from '../lib/score';
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

export default function HomeClient({ zhks, freshness }: { zhks: HomeZhk[]; freshness: string }) {
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
  const toggleN = (set: Set<number>, v: number, upd: (s: Set<number>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n); };

  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => {
    const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); upd(n);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = zhks.filter((z) => {
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
  }, [zhks, q, band, cls, status, district, extra, sort]);

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
          <div className={s.logo}>ЖК<span className={s.radar}>·Радар</span></div>
          <div className={s.tagline}>Krisha показывает, что продаётся. Мы — стоит ли покупать.</div>
        </div>
        <div className={s.headerSpacer} />
        <Link href="/methodology" className={s.navlink}>Методология</Link>
        <div className={s.freshness}><span className={s.freshDot} /> данные от {freshness}</div>
      </header>

      <div className={s.body}>
        <aside className={s.sidebar}>
          <div className={s.filters}>
            <div className={s.searchRow}>
              <input className={s.search} placeholder="Поиск ЖК, застройщика, района…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className={s.modeToggle}>
              <button className={mode === 'complexes' ? s.modeActive : ''} onClick={() => setMode('complexes')}>🏢 ЖК-комплексы</button>
              <button className={mode === 'apartments' ? s.modeActive : ''} onClick={() => setMode('apartments')}>🚪 Квартиры</button>
            </div>

            {mode === 'complexes' ? (
              <>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Район</span>
                  {DISTRICTS.map((d) => (
                    <button key={d.name} className={`${s.pill} ${district === d.name ? s.pillActive : ''}`} onClick={() => setDistrict(district === d.name ? null : d.name)}
                      style={district === d.name ? { background: d.color, borderColor: d.color, color: '#0b0f17' } : { borderColor: d.color + '66' }}>
                      <span style={{ color: district === d.name ? '#0b0f17' : d.color }}>●</span> {d.name}
                    </button>
                  ))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Выгода и готовность</span>
                  <button className={`${s.pill} ${extra.has('deal') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'deal', setExtra)}>🔥 выгодные</button>
                  <button className={`${s.pill} ${extra.has('newbuilt') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'newbuilt', setExtra)}>сдан и в продаже</button>
                  <button className={`${s.pill} ${extra.has('real') ? s.pillActive : ''}`} onClick={() => toggle(extra, 'real', setExtra)}>📷 реальные фото</button>
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Защита покупателя</span>
                  {BANDS.map((b) => (
                    <button key={b} className={`${s.pill} ${band.has(b) ? s.pillActive : ''}`} onClick={() => toggle(band, b, setBand)}>
                      <span style={{ color: band.has(b) ? '#061019' : BAND_COLOR[b] }}>●</span> {BAND_LABEL[b]}
                    </button>
                  ))}
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Класс</span>
                  {CLASSES.map((c) => (<button key={c} className={`${s.pill} ${cls.has(c) ? s.pillActive : ''}`} onClick={() => toggle(cls, c, setCls)}>{c}</button>))}
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
                  <button className={`${s.pill} ${aptMarket.has('primary') ? s.pillActive : ''}`} onClick={() => toggle(aptMarket, 'primary', setAptMarket)}><span style={{ color: aptMarket.has('primary') ? '#061019' : 'var(--green)' }}>●</span> первичка (новостройки)</button>
                  <button className={`${s.pill} ${aptMarket.has('secondary') ? s.pillActive : ''}`} onClick={() => toggle(aptMarket, 'secondary', setAptMarket)}><span style={{ color: aptMarket.has('secondary') ? '#061019' : '#7b8aa0' }}>●</span> вторичка</button>
                </div>
                <div className={s.filterGroup}>
                  <span className={s.fLabel}>Комнат</span>
                  {[1, 2, 3, 4].map((r) => (<button key={r} className={`${s.pill} ${aptRooms.has(r) ? s.pillActive : ''}`} onClick={() => toggleN(aptRooms, r, setAptRooms)}>{r}{r === 4 ? '+' : ''}</button>))}
                </div>
              </>
            )}
          </div>

          {mode === 'complexes' ? (
            <>
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
                        {z.deal && <span className={s.miniChip} style={{ background: 'var(--green)', color: '#061019', fontWeight: 700 }}>🔥 выгодно</span>}
                        {z.real && <span className={s.miniChip} style={{ color: 'var(--green)' }}>📷 реальные фото</span>}
                        {z.classRu && <span className={s.miniChip}>{z.classRu}</span>}
                        {z.constructionStatusRu && <span className={s.miniChip}>{z.constructionStatusRu}</span>}
                        {z.priceMin ? <span className={s.miniChip}>от {(z.priceMin / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸</span> : z.priceSqm ? <span className={s.miniChip}>{Math.round(z.priceSqm / 1000)} тыс ₸/м²</span> : null}
                        {z.seismicResistance && <span className={s.miniChip}>⛰ {z.seismicResistance}</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center' }}>Ничего не найдено под фильтры.</div>}
              </div>
            </>
          ) : (
            <div className={s.list}>
              <div className={s.aptHint}>
                <b>Квартиры на карте — первичка и вторичка.</b><br />
                Синие пузыри = сколько квартир в районе. Приблизь — разделятся на отдельные. Наведи на квартиру: цена, комнаты, площадь, адрес. Клик → объявление на krisha.
                <div className={s.aptLegend}>
                  <span><span className={s.legendDot} style={{ background: '#2ecc71' }} /> первичка (новостройка)</span>
                  <span><span className={s.legendDot} style={{ background: '#7b8aa0' }} /> вторичка</span>
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-faint)' }}>Данные объявлений — krisha.kz. Риск-скор считается только для ЖК-комплексов (вкладка слева).</div>
              </div>
            </div>
          )}
        </aside>

        <div className={s.mapWrap}>
          {mode === 'complexes' ? (
            <div className={s.legend}>
              {BANDS.map((b) => (<div key={b} className={s.legendRow}><span className={s.legendDot} style={{ background: BAND_COLOR[b] }} /> {BAND_LABEL[b]}</div>))}
              <div className={s.legendRow} style={{ marginTop: 4, borderTop: '1px solid var(--border-soft)', paddingTop: 6 }}><span className={s.legendDot} style={{ background: 'transparent', border: '2px solid #fff' }} /> 🔥 выгодная цена</div>
            </div>
          ) : (
            <div className={s.legend}>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#2ecc71' }} /> первичка</div>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#7b8aa0' }} /> вторичка</div>
              <div className={s.legendRow}><span className={s.legendDot} style={{ background: '#5a4fd0' }} /> пузырь = кол-во квартир</div>
            </div>
          )}
          <MapView points={points} selectedId={selected} onSelect={setSelected} activeDistrict={district} mode={mode} aptMarket={aptMarket} aptRooms={aptRooms} />
        </div>
      </div>
    </div>
  );
}
