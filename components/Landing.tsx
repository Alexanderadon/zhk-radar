'use client';
import Link from 'next/link';
import Logo from './Logo';
import SiteFooter from './SiteFooter';
import Icon from './Icon';
import { CountUp, Reveal, ScoreGauge, Bar } from './Anim';
import { BAND_LABEL, BAND_TEXT, INDICATOR_WEIGHTS } from '../lib/score';
import s from './Landing.module.scss';

type Band = 'green' | 'amber' | 'red' | 'grey';
export interface IntroData {
  zhkTotal: number;
  developers: number;
  apartments: number;
  updatedAt: string | null;
  cities: { slug: string; name: string; count: number }[];
  showcase: {
    slug: string; name: string; developer: string | null; district: string | null; image: string;
    priceMin: number | null; priceSqm: number | null; score: number | null; band: Band;
    indicators: { key: string; name: string; score: number | null; band: Band; value: string }[];
  } | null;
}

const SHORT: Record<string, string> = {
  money: 'Деньги дольщика', reliability: 'Застройщик', seismic: 'Сейсмостойкость', price: 'Цена против рынка',
};

const INSIDE = [
  { key: 'money', icon: 'shield', title: 'Защита денег', text: 'Есть ли у дома договор госгарантии КФГЖС: если застройщик не достроит, деньги дольщиков вернёт государство.', src: 'первоисточник · реестр КФГЖС' },
  { key: 'reliability', icon: 'building', title: 'Надёжность застройщика', text: 'Сколько домов он уже сдал, а сколько строит или заморозил. Короткий трек — не приговор, но повод присмотреться.', src: 'каталог korter.kz' },
  { key: 'seismic', icon: 'mountain', title: 'Сейсмостойкость', text: 'На сколько баллов рассчитан дом. Алматы стоит в зоне 9–10 баллов — меньшая цифра должна насторожить.', src: 'проектная декларация' },
  { key: 'price', icon: 'flame', title: 'Цена против рынка', text: 'Цена за м² против медианы своего класса: видно, где переплата, а где цена ниже рынка.', src: 'каталог korter.kz' },
] as const;

export default function Landing({ intro, onOpen, closing }: {
  intro: IntroData;
  onOpen: (city?: string) => void;
  closing: boolean;
}) {
  const sc = intro.showcase;
  const thousands = Math.round(intro.apartments / 1000);
  const date = intro.updatedAt ? new Date(intro.updatedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : null;

  return (
    <div className={`${s.intro} ${closing ? s.closing : ''}`} data-intro role="region" aria-label="О проекте Tirek">
      <header className={s.nav}>
        <Logo size={36} href={null} />
        <nav className={s.navLinks}>
          <Link href="/methodology">Как считается индекс</Link>
          <button type="button" className={s.navBtn} onClick={() => onOpen()}>Карта <Icon name="right" size={15} /></button>
        </nav>
      </header>

      <section className={s.hero}>
        <div className={s.heroText}>
          <div className={`${s.eyebrow} rise`}>
            <span className={s.pulse} aria-hidden />
            {date ? `Обновлено ${date}` : 'Обновляется каждый день'} · {intro.cities.length} городов Казахстана
          </div>
          <h1 className={s.h1}>
            Сначала <span className={s.mark}>проверь</span> —<br />потом покупай
          </h1>
          <p className={`${s.lead} rise`} style={{ animationDelay: '120ms' }}>
            Индекс защиты покупателя для каждой новостройки: есть ли госгарантия для дольщиков,
            как застройщик сдаёт дома, выдержит ли дом землетрясение и не переплачиваете ли вы.
            Всё — по открытым данным, у каждой цифры есть источник.
          </p>
          <div className={`${s.ctaRow} rise`} style={{ animationDelay: '180ms' }}>
            <button type="button" className={s.cta} onClick={() => onOpen()}>
              Открыть карту <Icon name="right" size={18} />
            </button>
            <Link href="/methodology" className={s.ctaGhost}>Как считается индекс</Link>
          </div>
          <div className={`${s.cities} rise`} style={{ animationDelay: '220ms' }}>
            {intro.cities.map((c) => (
              <button key={c.slug} type="button" className={s.city} onClick={() => onOpen(c.slug)}>
                {c.name}{c.count >= 10 && <span>{c.count}</span>}
              </button>
            ))}
          </div>
        </div>

        {sc && (
          <Reveal className={s.showcase} as="aside">
            <Link href={`/zhk${sc.slug}`} className={s.scCard} aria-label={`Пример: ${sc.name}`}>
              <div className={s.scPhoto}>
                <img src={sc.image} alt="" loading="eager" decoding="async" />
                <span className={s.scTag}>пример карточки</span>
              </div>
              <div className={s.scBody}>
                <div className={s.scHead}>
                  <div className={s.scTitle}>
                    <b>{sc.name}</b>
                    <span>{[sc.developer, sc.district ? `${sc.district} р-н` : null].filter(Boolean).join(' · ')}</span>
                    {sc.priceMin && <em>от {(sc.priceMin / 1e6).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸</em>}
                  </div>
                  <ScoreGauge score={sc.score} band={sc.band} size={112} stroke={10} caption="из 100" />
                </div>
                <div className={s.scBand} style={{ color: BAND_TEXT[sc.band] }}>
                  <Icon name="shieldSolid" size={14} /> {BAND_LABEL[sc.band]}
                </div>
                <div className={s.scBars}>
                  {sc.indicators.map((i, n) => (
                    <div key={i.key} className={s.scRow}>
                      <span>{SHORT[i.key] ?? i.name}</span>
                      <Bar score={i.score} band={i.band} delay={300 + n * 120} height={7} />
                      <b style={{ color: i.score == null ? 'var(--text-faint)' : BAND_TEXT[i.band] }}>{i.score ?? '—'}</b>
                    </div>
                  ))}
                </div>
              </div>
            </Link>
          </Reveal>
        )}
      </section>

      <section className={s.stats} aria-label="Tirek в цифрах">
        <div className={s.stat}><b><CountUp value={intro.zhkTotal} grouped /></b><span>новостроек с индексом</span></div>
        <div className={s.stat}><b><CountUp value={intro.cities.length} duration={600} /></b><span>городов: Алматы, Астана, Шымкент…</span></div>
        <div className={s.stat}><b><CountUp value={thousands} grouped /> тыс.</b><span>квартир в продаже на карте</span></div>
        <div className={s.stat}><b>24 ч</b><span>квартиры обновляются каждую ночь</span></div>
      </section>

      <Reveal className={s.inside} as="section">
        <div className={s.sectionHead}>
          <h2 className={s.h2}>Что внутри индекса</h2>
          <p>Четыре показателя, у каждого своя шкала 0–100 и свой вес. Нет данных — серый, а не ноль: мы ничего не додумываем.</p>
        </div>
        <div className={s.cards}>
          {INSIDE.map((c, n) => (
            <div key={c.key} className={s.card} data-anim="fade" style={{ transitionDelay: `${n * 90}ms` }}>
              <div className={s.cardIcon}><Icon name={c.icon} size={20} /></div>
              <div className={s.cardWeight}>{INDICATOR_WEIGHTS[c.key]}%</div>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
              <span className={s.cardSrc}>{c.src}</span>
            </div>
          ))}
        </div>
        <div className={s.scale} data-anim="fade" style={{ transitionDelay: '380ms' }}>
          <div className={s.scaleBar}><i style={{ flex: 40, background: 'var(--red)' }} /><i style={{ flex: 30, background: '#f2b230' }} /><i style={{ flex: 30, background: '#22a45d' }} /></div>
          <div className={s.scaleLabels}>
            <span style={{ flex: 40 }}><b style={{ color: BAND_TEXT.red }}>0–39</b> низкая защита</span>
            <span style={{ flex: 30 }}><b style={{ color: BAND_TEXT.amber }}>40–69</b> средняя</span>
            <span style={{ flex: 30 }}><b style={{ color: BAND_TEXT.green }}>70–100</b> высокая</span>
          </div>
        </div>
        <div className={s.bottomCta}>
          <button type="button" className={s.cta} onClick={() => onOpen()}>Открыть карту <Icon name="right" size={18} /></button>
          <span>{intro.developers.toLocaleString('ru-RU')} застройщиков · {intro.zhkTotal.toLocaleString('ru-RU')} ЖК · бесплатно и без регистрации</span>
        </div>
      </Reveal>

      <SiteFooter updatedAt={intro.updatedAt} />
    </div>
  );
}
