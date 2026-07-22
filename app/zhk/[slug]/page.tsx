import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllZhk, getZhkBySlug } from '../../../lib/data';
import { BAND_COLOR, BAND_LABEL, SCORE_NAME, SCORE_DEF } from '../../../lib/score';
import MiniMap from '../../../components/MiniMap';
import s from './zhk.module.scss';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getAllZhk().map((z) => ({ slug: z.slug.replace(/^\//, '') }));
}

export default async function ZhkPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const z = getZhkBySlug(slug);
  if (!z) notFound();

  const { scoreResult: sr } = z;
  const color = BAND_COLOR[sr.band];
  const price = z.priceSqm ? `${z.priceSqm.toLocaleString('ru-RU')} ₸/м²` : 'цена не указана';
  const dash = 2 * Math.PI * 66;
  const pct = sr.score != null ? sr.score / 100 : 0;

  const specs: [string, string | null][] = [
    ['Класс', z.classDetail || z.classRu],
    ['Статус', z.constructionStatusRu],
    ['Этажность', z.floors || null],
    ['Домов в ЖК', z.houses || null],
    ['Паркинг', z.parking || null],
    ['Технология', z.tech || null],
    ['Стены', z.walls || null],
    ['Высота потолков', z.ceilingHeight || null],
    ['Квартир', z.apartments || null],
    ['Сейсмостойкость', z.seismicResistance ? `${z.seismicResistance} баллов` : null],
  ];

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <Link href="/" className={s.back}>← карта</Link>
        <div className={s.crumbSpacer} />
        <Link href="/methodology" className={s.back}>как считается балл?</Link>
      </div>

      <div className={s.hero}>
        {z.image ? <img className={s.heroImg} src={z.image} alt={z.name} /> : <div className={`${s.heroImg} ${s.heroImgEmpty}`}>◫</div>}
        <div className={s.heroInfo}>
          <h1 className={s.title}>{z.name}</h1>
          <div className={s.dev}>
            Застройщик:{' '}
            {z.developer ? <Link href={`/developer/${z.developer.slug.replace(/^\//, '')}`}>{z.developer.name}</Link> : '—'}
          </div>
          {z.address && <div className={s.addr}>{z.address}</div>}
          <div className={s.heroChips}>
            <span className={`chip band-${sr.band}`}><span className="dot" style={{ background: color }} />{BAND_LABEL[sr.band]}</span>
            {z.classRu && <span className={s.factorWeight} style={{ padding: '4px 10px', fontSize: 13 }}>{z.classRu}</span>}
            {z.district && <span className={s.factorWeight} style={{ padding: '4px 10px', fontSize: 13 }}>{z.district}</span>}
          </div>
          <div className={s.priceBox}>
            <div className={s.priceMain}>{price}</div>
            {z.priceMin && <div className={s.priceSub}>от {z.priceMin.toLocaleString('ru-RU')} ₸ за квартиру</div>}
            <div className={s.priceSub} style={{ marginTop: 8, color: 'var(--amber)', fontSize: 12 }}>
              ⚠ витрина korter — маркетинг застройщика, не оценка
            </div>
          </div>
        </div>
      </div>

      <section className={s.section}>
        <div className={s.sectionTitle}>{SCORE_NAME} — из чего сложился</div>
        <p style={{ margin: '-6px 0 18px', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.55, maxWidth: 680 }}>{SCORE_DEF}</p>
        <div className={s.scoreWrap}>
          <div className={s.scoreDial}>
            <div className={s.dial}>
              <svg width="150" height="150" viewBox="0 0 150 150">
                <circle cx="75" cy="75" r="66" fill="none" stroke="var(--panel-2)" strokeWidth="10" />
                <circle cx="75" cy="75" r="66" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={dash} strokeDashoffset={dash * (1 - pct)} transform="rotate(-90 75 75)" />
              </svg>
              <div className={s.dialNum}>
                <div className={s.dialScore} style={{ color }}>{sr.score ?? '—'}</div>
                <div className={s.dialMax}>из 100</div>
              </div>
            </div>
            <div className={s.dialBand} style={{ color }}>{BAND_LABEL[sr.band]}</div>
            <div className={s.completeness}>
Данными закрыто {Math.round(sr.completeness * 100)}% веса.<br />Серые индикаторы ниже — пока без данных.
            </div>
          </div>

          <div className={s.factors}>
            {sr.indicators.map((ind) => {
              const c = BAND_COLOR[ind.band];
              return (
                <div key={ind.key} className={s.factor}>
                  <div className={s.factorHead}>
                    <span className={s.factorName}>{ind.name}</span>
                    <span className={s.factorWeight}>вес {ind.weight}</span>
                    <span
                      className={s.factorWeight}
                      style={{
                        color: ind.sourceType === 'первоисточник' ? 'var(--green)' : 'var(--amber)',
                        background: ind.sourceType === 'первоисточник' ? 'rgba(46,204,113,0.1)' : 'rgba(241,196,15,0.1)',
                      }}
                      title={ind.sourceType === 'первоисточник' ? 'Государственный / официальный реестр' : 'Данные агрегатора-витрины (маркетинг застройщика)'}
                    >
                      {ind.sourceType}
                    </span>
                    <div className={s.factorSpacer} />
                    <span className={s.factorVal} style={{ color: c, fontVariantNumeric: 'tabular-nums' }}>
                      {ind.score == null ? '—' : `${ind.score}`}<span style={{ color: 'var(--text-faint)', fontWeight: 500 }}>/100</span>
                    </span>
                  </div>
                  <div className={s.bar}>
                    {ind.score == null ? <div className={s.barGrey} /> : <div className={s.barFill} style={{ width: `${ind.score}%`, background: c }} />}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c, marginBottom: 5 }}>{ind.value}</div>
                  <div className={s.factorDetail}>{ind.detail}</div>
                  {ind.source && (
                    <div className={s.factorSource}>
                      Источник: {ind.sourceUrl ? <a href={ind.sourceUrl} target="_blank" rel="noopener noreferrer">{ind.source} ↗</a> : ind.source}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.sectionTitle}>Характеристики</div>
        <div className={s.specs}>
          {specs.filter(([, v]) => v).map(([label, value]) => (
            <div className={s.spec} key={label}>
              <div className={s.specLabel}>{label}</div>
              <div className={`${s.specValue} ${label === 'Сейсмостойкость' ? s.seismic : ''}`}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {z.lat && z.lng && (
        <section className={s.section}>
          <div className={s.sectionTitle}>Расположение</div>
          <div className={s.mapMini}>
            <MiniMap lat={z.lat} lng={z.lng} color={color} name={z.name} />
          </div>
        </section>
      )}

      <section className={s.section}>
        <div className={s.dispute}>
          <div className={s.disputeText}>
            Заметили ошибку в данных или считаете оценку несправедливой? ЖК-Радар агрегирует открытые источники и всегда готов исправить факт с подтверждением.
          </div>
          <a className="btn" href={`mailto:hello@zhk-radar.kz?subject=${encodeURIComponent('Оспорить данные: ' + z.name)}`}>Оспорить данные</a>
        </div>
      </section>

      <div className={s.disclaimer}>
        ЖК-Радар — агрегатор открытых данных, а не инвестиционная рекомендация. Риск-балл рассчитывается по <Link href="/methodology" style={{ color: 'var(--accent-dim)' }}>публичной методике</Link> из проверяемых источников; каждый фактор приведён со ссылкой. Цены, сроки и характеристики взяты из карточки застройщика (korter.kz) и являются маркетинговыми — проверяйте перед сделкой. Данные собраны {new Date(z.scrapedAt).toLocaleDateString('ru-RU')}.
      </div>
    </div>
  );
}
