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
  lat: number | null;
  lng: number | null;
  priceSqm: number | null;
  classRu: string | null;
  constructionStatusRu: string | null;
  developer: { name: string; slug: string } | null;
  parkingType: string;
  seismicResistance: number | null;
  image: string | null;
  band: 'green' | 'amber' | 'red' | 'grey';
  score: number | null;
}

const BANDS: HomeZhk['band'][] = ['green', 'amber', 'red', 'grey'];
const CLASSES = ['эконом', 'комфорт', 'бизнес', 'премиум', 'элит'];
const STATUSES = [
  { key: 'ready', label: 'сдан' },
  { key: 'construction', label: 'строится' },
  { key: 'project', label: 'проект' },
];

export default function HomeClient({ zhks, freshness }: { zhks: HomeZhk[]; freshness: string }) {
  const [q, setQ] = useState('');
  const [band, setBand] = useState<Set<string>>(new Set());
  const [cls, setCls] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Set<string>>(new Set());
  const [parking, setParking] = useState<string | null>(null);
  const [sort, setSort] = useState('score-desc');
  const [selected, setSelected] = useState<number | null>(null);

  const toggle = (set: Set<string>, v: string, upd: (s: Set<string>) => void) => {
    const n = new Set(set);
    n.has(v) ? n.delete(v) : n.add(v);
    upd(n);
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = zhks.filter((z) => {
      if (query && !(z.name.toLowerCase().includes(query) || z.developer?.name.toLowerCase().includes(query) || z.district?.toLowerCase().includes(query))) return false;
      if (band.size && !band.has(z.band)) return false;
      if (cls.size && !(z.classRu && cls.has(z.classRu))) return false;
      if (status.size) {
        const stKey = STATUSES.find((x) => x.label === z.constructionStatusRu)?.key;
        if (!stKey || !status.has(stKey)) return false;
      }
      if (parking === 'подземный' && !(z.parkingType === 'подземный' || z.parkingType === 'смешанный')) return false;
      if (parking === 'seismic' && !z.seismicResistance) return false;
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
  }, [zhks, q, band, cls, status, parking, sort]);

  const points: MapPoint[] = useMemo(
    () => filtered.filter((z) => z.lat && z.lng).map((z) => ({ id: z.id, slug: z.slug, name: z.name, lat: z.lat!, lng: z.lng!, band: z.band, score: z.score, priceSqm: z.priceSqm, developer: z.developer?.name ?? null })),
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
            <div className={s.filterGroup}>
              <span className={s.fLabel}>Риск</span>
              {BANDS.map((b) => (
                <button key={b} className={`${s.pill} ${band.has(b) ? s.pillActive : ''}`} onClick={() => toggle(band, b, setBand)}>
                  <span style={{ color: band.has(b) ? '#061019' : BAND_COLOR[b] }}>●</span> {BAND_LABEL[b]}
                </button>
              ))}
            </div>
            <div className={s.filterGroup}>
              <span className={s.fLabel}>Класс</span>
              {CLASSES.map((c) => (
                <button key={c} className={`${s.pill} ${cls.has(c) ? s.pillActive : ''}`} onClick={() => toggle(cls, c, setCls)}>{c}</button>
              ))}
            </div>
            <div className={s.filterGroup}>
              <span className={s.fLabel}>Статус</span>
              {STATUSES.map((st) => (
                <button key={st.key} className={`${s.pill} ${status.has(st.key) ? s.pillActive : ''}`} onClick={() => toggle(status, st.key, setStatus)}>{st.label}</button>
              ))}
            </div>
            <div className={s.filterGroup}>
              <span className={s.fLabel}>Ещё</span>
              <button className={`${s.pill} ${parking === 'подземный' ? s.pillActive : ''}`} onClick={() => setParking(parking === 'подземный' ? null : 'подземный')}>подземный паркинг</button>
              <button className={`${s.pill} ${parking === 'seismic' ? s.pillActive : ''}`} onClick={() => setParking(parking === 'seismic' ? null : 'seismic')}>есть сейсмобалл</button>
            </div>
          </div>

          <div className={s.resultBar}>
            <span>{filtered.length} ЖК</span>
            <select className={s.sortSel} value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="score-desc">риск: сначала низкий</option>
              <option value="score-asc">риск: сначала высокий</option>
              <option value="price-desc">цена: сначала дорогие</option>
              <option value="price-asc">цена: сначала дешёвые</option>
            </select>
          </div>

          <div className={s.list}>
            {filtered.map((z) => (
              <div key={z.id} className={`${s.card} ${selected === z.id ? s.cardActive : ''}`} onClick={() => setSelected(z.id)}>
                {z.image ? (
                  <img className={s.thumb} src={z.image} alt="" loading="lazy" />
                ) : (
                  <div className={`${s.thumb} ${s.thumbEmpty}`}>◫</div>
                )}
                <div className={s.cardBody}>
                  <div className={s.cardTop}>
                    <div>
                      <Link href={`/zhk${z.slug}`} className={s.cardName} onClick={(e) => e.stopPropagation()}>{z.name}</Link>
                      <div className={s.cardDev}>{z.developer?.name ?? '—'}{z.district ? ` · ${z.district}` : ''}</div>
                    </div>
                    <div className={s.scoreBadge}>
                      <div className={s.scoreNum} style={{ color: BAND_COLOR[z.band] }}>{z.score ?? '—'}</div>
                      <div className={s.scoreCap}>{z.score != null ? 'балл' : 'мало'}</div>
                    </div>
                  </div>
                  <div className={s.cardChips}>
                    {z.classRu && <span className={s.miniChip}>{z.classRu}</span>}
                    {z.constructionStatusRu && <span className={s.miniChip}>{z.constructionStatusRu}</span>}
                    {z.priceSqm && <span className={s.miniChip}>{Math.round(z.priceSqm / 1000)} тыс ₸/м²</span>}
                    {(z.parkingType === 'подземный' || z.parkingType === 'смешанный') && <span className={s.miniChip}>подземный паркинг</span>}
                    {z.seismicResistance && <span className={s.miniChip}>⛰ {z.seismicResistance} балл.</span>}
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ padding: 24, color: 'var(--text-dim)', textAlign: 'center' }}>Ничего не найдено под фильтры.</div>}
          </div>
        </aside>

        <div className={s.mapWrap}>
          <div className={s.legend}>
            {BANDS.map((b) => (
              <div key={b} className={s.legendRow}><span className={s.legendDot} style={{ background: BAND_COLOR[b] }} /> {BAND_LABEL[b]}</div>
            ))}
          </div>
          <MapView points={points} selectedId={selected} onSelect={setSelected} />
        </div>
      </div>
    </div>
  );
}
