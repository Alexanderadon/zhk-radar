'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from './Logo';
import SiteFooter from './SiteFooter';
import Icon from './Icon';
import { BAND_COLOR, BAND_LABEL, BAND_TEXT, INDICATOR_WEIGHTS } from '../lib/score';
import { cityBySlug } from '../lib/cities';
import { plural } from '../lib/plural';
import type { HeroMap, HeroExample } from '../lib/heroMap';
import type { HomeZhk } from './HomeClient';
import s from './Landing.module.scss';

type Band = 'green' | 'amber' | 'red' | 'grey';
export interface IntroData {
  zhkTotal: number;
  apartments: number;
  cities: { slug: string; name: string; count: number }[];
  heroMap: HeroMap | null;
  example: HeroExample | null;
  assets: { promise: boolean; stalled: boolean; shotDesk: boolean; shotMob: boolean };
}

const BANDS: Band[] = ['green', 'amber', 'red', 'grey'];
const SHORT_BAND: Record<Band, string> = { green: 'Высокая', amber: 'Средняя', red: 'Низкая', grey: 'Мало данных' };
const IND_LABEL: Record<string, string> = { money: 'Госгарантия', reliability: 'Застройщик', seismic: 'Сейсмостойкость', price: 'Цена' };
const NUM_WORD: Record<number, string> = { 2: 'двух', 3: 'трёх', 4: 'четырёх', 5: 'пяти', 6: 'шести', 7: 'семи' };
const novostroek = (n: number) => plural(n, 'новостройка', 'новостройки', 'новостроек');
const fmt = (n: number) => n.toLocaleString('ru-RU');

const QUESTIONS = [
  { key: 'money', q: 'Деньги защищены?', a: 'Есть ли у дома госгарантия КФГЖС.' },
  { key: 'reliability', q: 'Застройщик сдаёт дома?', a: 'Сколько домов сдал, а сколько заморозил.' },
  { key: 'seismic', q: 'Выдержит землетрясение?', a: 'На сколько баллов рассчитан дом.' },
  { key: 'price', q: 'Цена честная?', a: 'Цена за м² против похожих домов.' },
] as const;

const norm = (t: string) => t.toLowerCase().replace(/ё/g, 'е');
/** «ТОО "ИНТЕРЭКС и Компания"» → «ИНТЕРЭКС и Компания»: форма собственности покупателю не нужна. */
const devName = (n: string | null | undefined) => (n ?? '').replace(/^(тоо|ао|ип|тдо)\s+/i, '').replace(/[«»"]/g, '').trim() || null;
const hoverable = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;

/* ---------------- поиск: combobox по ЖК и застройщикам ---------------- */
function SearchBox({ zhks, onOpen }: { zhks: HomeZhk[]; onOpen: (city?: string, q?: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const listId = useId();
  const res = useMemo(() => {
    const n = norm(q.trim());
    if (!n) return [];
    const starts: HomeZhk[] = [], incl: HomeZhk[] = [];
    for (const z of zhks) {
      const nm = norm(z.name), bare = nm.replace(/^(жк|мжк|кг|клубный дом)\s+/, ''), dv = norm(z.developer?.name ?? '');
      if (nm.startsWith(n) || bare.startsWith(n)) starts.push(z);
      else if (nm.includes(n) || dv.includes(n)) incl.push(z);
    }
    const byScore = (a: HomeZhk, b: HomeZhk) => (b.score ?? -1) - (a.score ?? -1);
    return [...starts.sort(byScore), ...incl.sort(byScore)].slice(0, 6);
  }, [q, zhks]);
  const go = (z: HomeZhk) => router.push(`/zhk${z.slug}`);
  const listOpen = open && q.trim().length > 0;

  return (
    <form role="search" action="/" method="get" className={s.search}
      onSubmit={(e) => {
        e.preventDefault();
        if (listOpen && act >= 0 && res[act]) return go(res[act]);
        if (!q.trim()) return onOpen();
        onOpen(res[0]?.citySlug, q.trim());
      }}>
      <label htmlFor={`${listId}-in`} className={s.srOnly}>Найти ЖК</label>
      <span className={s.searchIcon} aria-hidden><Icon name="search" size={20} /></span>
      <input
        id={`${listId}-in`} name="q" className={s.searchInput} placeholder="ЖК или застройщик" autoComplete="off"
        value={q} role="combobox" aria-expanded={listOpen} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={listOpen && act >= 0 ? `${listId}-o${act}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setAct(-1); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { setOpen(false); setAct(-1); }
          else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAct((a) => Math.min(res.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setAct((a) => Math.max(-1, a - 1)); }
        }}
      />
      <button type="submit" className={s.searchBtn}>Проверить</button>
      <div className={s.suggest} id={listId} role="listbox" aria-label="Найденные ЖК" hidden={!listOpen}>
        {listOpen && res.map((z, i) => (
          <div key={z.id} id={`${listId}-o${i}`} role="option" aria-selected={i === act}
            className={`${s.opt} ${i === act ? s.optOn : ''}`}
            onMouseDown={(e) => { e.preventDefault(); go(z); }} onMouseEnter={() => setAct(i)}>
            <span className={s.optDot} style={{ background: BAND_COLOR[z.band] }} />
            <span className={s.optText}>
              <b>{z.name}</b>
              <span>{[devName(z.developer?.name), cityBySlug(z.citySlug).name].filter(Boolean).join(' · ')}</span>
            </span>
            <span className={s.optScore} style={{ color: z.score == null ? 'var(--text-dim)' : BAND_TEXT[z.band] }}>{z.score ?? '—'}</span>
          </div>
        ))}
        {listOpen && !res.length && (
          <div className={s.optEmpty}>
            Не нашли «{q.trim()}». Возможно, ЖК называется иначе&nbsp;— посмотрите на карте.
            <button type="button" onMouseDown={(e) => { e.preventDefault(); onOpen(); }}>Открыть карту</button>
          </div>
        )}
      </div>
    </form>
  );
}

/* ---------------- карта первого экрана ---------------- */
/** Подпись района под карточкой примера не показываем — она торчала бы из-под неё. */
const underCard = (d: { lx: number; ly: number }, map: HeroMap) => {
  if (!map.pick) return false;
  const x = (d.lx / map.w) * 100, y = (d.ly / map.h) * 100;
  return x > map.pick.x - 8 && x < map.pick.x + 56 && Math.abs(y - map.pick.y) < 34;
};

function HeroMapView({ map, ex, zhks, onOpen }: { map: HeroMap; ex: HeroExample | null; zhks: HomeZhk[]; onOpen: (city?: string) => void }) {
  const router = useRouter();
  const stage = useRef<HTMLDivElement>(null);
  const [only, setOnly] = useState<Band | null>(null);
  const [preview, setPreview] = useState<Band | null>(null);
  const [tip, setTip] = useState<{ z: HomeZhk; x: number; y: number } | null>(null);
  const shown = preview ?? only;

  // «?intro&only=green» — лендинг сразу с включённым фильтром (отдельный дубль для видео)
  useEffect(() => {
    const o = new URLSearchParams(location.search).get('only');
    if (o && (BANDS as string[]).includes(o)) setOnly(o as Band);
  }, []);

  // координаты ЖК в единицах viewBox — той же проекцией, что на сервере
  const pts = useMemo(() => {
    const { minX, minY, k } = map.proj;
    return zhks.filter((z) => z.citySlug === 'almaty' && z.lat && z.lng).map((z) => {
      const f = (z.lat! * Math.PI) / 180;
      return { z, x: ((z.lng! + 180) / 360 - minX) * k, y: ((1 - Math.log(Math.tan(f) + 1 / Math.cos(f)) / Math.PI) / 2 - minY) * k };
    });
  }, [zhks, map.proj]);

  const nearest = (cx: number, cy: number) => {
    const el = stage.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const sc = r.width / map.w;
    const vx = (cx - r.left) / sc, vy = (cy - r.top) / sc;
    let best: (typeof pts)[number] | null = null, bd = (12 / sc) ** 2;
    for (const p of pts) {
      if (shown && p.z.band !== shown) continue;
      const d = (p.x - vx) ** 2 + (p.y - vy) ** 2;
      if (d < bd) { bd = d; best = p; }
    }
    return best ? { z: best.z, x: (best.x / map.w) * 100, y: (best.y / map.h) * 100 } : null;
  };

  const cnt = map.counts;
  const total = cnt.total;

  return (
    <div className={s.mapPanel}>
      <div ref={stage} className={s.stage} style={{ ['--ar' as string]: map.w / map.h } as React.CSSProperties} data-only={shown ?? undefined}
        onMouseMove={(e) => { if (hoverable()) setTip(nearest(e.clientX, e.clientY)); }}
        onMouseLeave={() => setTip(null)}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('a,button')) return;
          const hit = nearest(e.clientX, e.clientY);
          if (hit) router.push(`/zhk${hit.z.slug}`); else onOpen('almaty');
        }}>
        <svg className={s.base} viewBox={`0 0 ${map.w} ${map.h}`} role="img" aria-labelledby="hm-t hm-d">
          <title id="hm-t">Карта новостроек Алматы</title>
          <desc id="hm-d">{`Из ${fmt(total)} ${novostroek(total)}: высокая защита — ${cnt.green}, средняя — ${cnt.amber}, низкая — ${cnt.red}, мало данных — ${cnt.grey}.`}</desc>
          <defs>
            <path id="hm-all" d={map.grey} />
            {BANDS.map((b) => <path key={b} id={`hm-${b}`} d={map.lvl[b]} />)}
          </defs>
          <g className={s.districts}>{map.districts.map((d) => <path key={d.ru} d={d.d} />)}</g>
          <clipPath id="hm-clip"><rect width={map.w} height={map.h} /></clipPath>
          {map.faults && <path className={s.faults} d={map.faults} clipPath="url(#hm-clip)" />}
          <use href="#hm-all" className={s.halo} />
          <use href="#hm-all" className={s.greyDots} />
        </svg>
        {/* цветной слой открывается «линией проверки» слева направо — чистый CSS, без JS */}
        <div className={s.colorWrap} aria-hidden>
          <svg className={s.color} viewBox={`0 0 ${map.w} ${map.h}`}>
            {(['grey', 'amber', 'red', 'green'] as Band[]).map((b) => (
              <g key={b} className={s.lvl} data-b={b}>
                <use href={`#hm-${b}`} className={s.halo} />
                <use href={`#hm-${b}`} className={s.dots} style={{ stroke: BAND_COLOR[b] }} />
              </g>
            ))}
          </svg>
        </div>
        {map.districts.filter((d) => d.lx >= 0 && !underCard(d, map)).map((d) => (
          <div key={d.ru} className={s.dLabel} style={{ left: `${(d.lx / map.w) * 100}%`, top: `${(d.ly / map.h) * 100}%` }} aria-hidden>
            <b>{d.ru}</b>{d.kz && <span>{d.kz}</span>}
          </div>
        ))}

        {ex && map.pick && (
          <>
            <span className={s.pin} style={{ left: `${map.pick.x}%`, top: `${map.pick.y}%`, ['--c' as string]: BAND_COLOR[ex.band] } as React.CSSProperties} aria-hidden />
            <span className={s.pinPill} style={{ left: `${map.pick.x}%`, top: `${map.pick.y}%` }} aria-hidden>
              <b style={{ color: BAND_TEXT[ex.band] }}>{ex.score}</b> {ex.name}
            </span>
            <article className={s.card} style={{ left: `${map.pick.x}%`, top: `${map.pick.y}%` }}>
              <div className={s.caps}>{[ex.district ? `${ex.district} р-н` : null, 'Алматы'].filter(Boolean).join(' · ')}</div>
              <h3 className={s.cardName}>{ex.name}</h3>
              <div className={s.cardSub}>{[devName(ex.developer), ex.priceMin ? `от ${(ex.priceMin / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : null].filter(Boolean).join(' · ')}</div>
              <div className={s.cardRule} />
              <div className={s.cardIndex}>
                <div className={s.cardNum} style={{ color: BAND_TEXT[ex.band] }}>{ex.score}<small>/100</small></div>
                <div className={s.cardVerdict}>
                  <b style={{ color: BAND_TEXT[ex.band] }}>{BAND_LABEL[ex.band]}</b>
                </div>
              </div>
              <div className={s.cardRows}>
                {[...ex.indicators].sort((a, b) => (a.score == null ? 1 : 0) - (b.score == null ? 1 : 0)).map((i, n) => (
                  <div key={i.key} className={s.cardRow}>
                    <span>{IND_LABEL[i.key] ?? i.key}</span>
                    <b style={{ color: i.score == null ? 'var(--text-dim)' : BAND_TEXT[i.band] }}>{i.score == null ? 'нет данных' : i.value}</b>
                    <div className={s.cardBar}>{i.score == null ? <i className={s.hatch} /> : <i style={{ width: `${Math.max(3, i.score)}%`, background: BAND_COLOR[i.band], animationDelay: `${2100 + n * 90}ms` }} />}</div>
                  </div>
                ))}
              </div>
              <Link href={`/zhk${ex.slug}`} className={s.cardLink}>Вся проверка <Icon name="right" size={14} /></Link>
            </article>
          </>
        )}

        {tip && (
          <div className={s.tip} style={{ left: `${tip.x}%`, top: `${tip.y}%` }} data-flip={tip.x > 66 ? '1' : undefined} aria-hidden>
            <span className={s.tipRing} />
            <div className={s.tipBox}>
              <b>{tip.z.name}</b>
              <span style={{ color: tip.z.score == null ? 'var(--text-dim)' : BAND_TEXT[tip.z.band] }}>{tip.z.score != null ? `${tip.z.score} · ` : ''}{BAND_LABEL[tip.z.band]}</span>
              {tip.z.district && <em>{tip.z.district} р-н</em>}
            </div>
          </div>
        )}
      </div>

      <div className={s.mapCaption} aria-live="polite">
        <b>Алматы</b>
        {shown
          ? <span style={{ color: BAND_TEXT[shown] }}>{BAND_LABEL[shown]}: {cnt[shown]} из {fmt(total)}</span>
          : <span>{fmt(total)} {novostroek(total)}</span>}
      </div>
      <div className={s.chips} role="group" aria-label="Показать на карте по уровню защиты">
        {BANDS.filter((b) => cnt[b] > 0).map((b) => (
          <button key={b} type="button" className={s.chip} aria-pressed={only === b}
            style={only === b ? { borderColor: BAND_COLOR[b], color: BAND_TEXT[b], background: `${BAND_COLOR[b]}1a` } : undefined}
            onMouseEnter={() => { if (hoverable()) setPreview(b); }}
            onMouseLeave={() => setPreview(null)}
            onClick={() => { setPreview(null); setOnly(only === b ? null : b); }}>
            <i style={{ background: BAND_COLOR[b] }} />{SHORT_BAND[b]}<span>{cnt[b]}</span>
          </button>
        ))}
      </div>
      <div className={s.legendM} aria-hidden>
        {BANDS.filter((b) => cnt[b] > 0).map((b) => <span key={b}><i style={{ background: BAND_COLOR[b] }} />{b === 'grey' ? 'нет данных' : SHORT_BAND[b].toLowerCase()}</span>)}
      </div>
      <button type="button" className={s.allMap} onClick={() => onOpen('almaty')}>Вся карта <Icon name="right" size={15} /></button>
      <span className={s.osm}>Границы районов © OpenStreetMap</span>
      <button type="button" className={s.tapOpen} onClick={() => onOpen('almaty')} aria-label="Открыть карту Алматы" />
    </div>
  );
}

/* ---------------- страница ---------------- */
export default function Landing({ intro, zhks, onOpen, closing }: {
  intro: IntroData;
  zhks: HomeZhk[];
  onOpen: (city?: string, q?: string) => void;
  closing: boolean;
}) {
  const ex = intro.example;
  const nCities = intro.cities.length;

  return (
    <div className={`${s.intro} ${closing ? s.closing : ''}`} data-intro role="region" aria-label="Tirek — о проекте">
      <header className={s.nav}>
        <div className={s.navIn}>
          <Logo size={34} href={null} />
          <nav className={s.navR}>
            <Link href="/methodology" className={s.navLink}>Как считается индекс</Link>
            <button type="button" className={s.navBtn} onClick={() => onOpen()}>
              <span className={s.wide}>Открыть карту</span><span className={s.narrow}>Карта</span><Icon name="right" size={16} />
            </button>
          </nav>
        </div>
      </header>

      <section className={s.hero}>
        <div className={s.panel}>
          <div className={s.panelMain}>
            <h1 className={s.h1}>Сначала<br className={s.brM} /> проверь —<br /> потом покупай</h1>
            <p className={s.lead}>
              Индекс защиты покупателя для {fmt(intro.zhkTotal)} {plural(intro.zhkTotal, 'новостройки', 'новостроек', 'новостроек')} в {NUM_WORD[nCities] ?? nCities} {plural(nCities, 'городе', 'городах', 'городах')} Казахстана.
            </p>
            <SearchBox zhks={zhks} onOpen={onOpen} />
            <div className={s.cities}>
              <span className={s.citiesCap}>Карта:</span>
              {intro.cities.map((c) => (
                <span key={c.slug} className={s.cityItem}>
                  <button type="button" onClick={() => onOpen(c.slug)}>{c.name}</button>
                </span>
              ))}
            </div>
          </div>
        </div>
        {intro.heroMap && <HeroMapView map={intro.heroMap} ex={ex} zhks={zhks} onOpen={onOpen} />}
      </section>

      {/* ---- обещание и реальность: появится, когда будут картинки ---- */}
      {intro.assets.promise && intro.assets.stalled && (
        <section className={`${s.sec} ${s.secWhite}`} aria-labelledby="ld-why">
          <div className={s.wrap}>
            <h2 id="ld-why" className={s.h2}>На рендере каждый дом достроен</h2>
            <div className={s.pair}>
              <figure>
                <img src="/landing/promise-1200.webp" srcSet="/landing/promise-800.webp 800w, /landing/promise-1200.webp 1200w" sizes="(min-width:1100px) 600px, 100vw" width={1200} height={800} alt="Иллюстрация: рекламный рендер жилого комплекса" loading="lazy" decoding="async" />
                <figcaption>Так дом продают</figcaption>
              </figure>
              <figure>
                <img src="/landing/stalled-1200.webp" srcSet="/landing/stalled-800.webp 800w, /landing/stalled-1200.webp 1200w" sizes="(min-width:1100px) 600px, 100vw" width={1200} height={800} alt="Иллюстрация: тот же дом, стройка остановлена" loading="lazy" decoding="async" />
                <figcaption>Так бывает на деле</figcaption>
              </figure>
            </div>
          </div>
        </section>
      )}

      {/* ---- как считается ---- */}
      <section id="questions" className={`${s.sec} ${s.secGrey}`} aria-labelledby="ld-q">
        <div className={s.wrap}>
          <h2 id="ld-q" className={s.h2}>Четыре вопроса к каждому дому</h2>
          <div className={s.qGrid}>
            {QUESTIONS.map((row) => (
              <div key={row.key} className={s.q}>
                <span className={s.qW}><b>{INDICATOR_WEIGHTS[row.key]}%</b> индекса</span>
                <h3>{row.q}</h3>
                <p>{row.a}</p>
              </div>
            ))}
          </div>
          <Link href="/methodology" className={s.textLink}>Как считается индекс <Icon name="right" size={15} /></Link>
        </div>
      </section>

      {/* ---- своя страница и призыв ---- */}
      <section className={`${s.sec} ${s.secWhite}`} aria-labelledby="ld-page">
        <div className={`${s.wrap} ${s.prod}`}>
          <h2 id="ld-page" className={s.h2}>У каждого дома&nbsp;— своя страница</h2>
          <p className={s.sub}>Индекс, застройщик и квартиры в продаже.</p>
          {ex && intro.assets.shotDesk && (
            <Link href={`/zhk${ex.slug}`} className={s.shot}>
              <picture>
                {intro.assets.shotMob && <source media="(max-width: 599px)" srcSet="/landing/zhk-mobile.webp" width={900} height={1800} />}
                <img src="/landing/zhk-desktop.webp" width={1584} height={1161} alt={`Страница ЖК ${ex.name} в Tirek`} loading="lazy" decoding="async" />
              </picture>
            </Link>
          )}
          <button type="button" className={s.cta} onClick={() => onOpen()}>Открыть карту <Icon name="right" size={18} /></button>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
