import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllZhk, getZhkBySlug } from '../../../lib/data';
import { BAND_COLOR, BAND_TEXT, BAND_LABEL, SCORE_NAME } from '../../../lib/score';
import { cityBySlug } from '../../../lib/cities';
import Gallery from '../../../components/Gallery';
import DisputeButton from '../../../components/DisputeButton';
import Layouts from '../../../components/Layouts';
import MiniMap from '../../../components/MiniMap';
import Icon from '../../../components/Icon';
import PageBar from '../../../components/PageBar';
import SiteFooter from '../../../components/SiteFooter';
import { Bar, Reveal, ScoreGauge } from '../../../components/Anim';
import s from './zhk.module.scss';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return getAllZhk().map((z) => ({ slug: z.slug.replace(/^\//, '').split('/') }));
}

const findZhk = async (params: Promise<{ slug: string[] }>) => {
  const { slug } = await params;
  return getZhkBySlug(Array.isArray(slug) ? slug.join('/') : slug);
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const z = await findZhk(params);
  if (!z) return {};
  const city = cityBySlug((z as any).citySlug);
  const sc = z.scoreResult.score;
  return {
    title: `${z.name}, ${city.name} — индекс защиты ${sc != null ? `${sc}/100` : 'нет данных'}`,
    description: `${z.name}${z.developer ? ` от ${z.developer.name}` : ''}: ${BAND_LABEL[z.scoreResult.band].toLowerCase()} покупателя по открытым данным — госгарантия, надёжность застройщика, сейсмостойкость, цена против рынка.`,
    openGraph: z.image ? { images: [{ url: z.image }] } : undefined,
  };
}

/** Короткий вывод под индексом — что значит уровень, без оценок застройщика. */
const VERDICT: Record<string, string> = {
  green: 'Сильные сигналы защиты по открытым данным.',
  amber: 'Есть пробелы — смотрите показатели ниже.',
  red: 'Есть серьёзные риск-факторы. Проверьте их до сделки.',
  grey: 'Данных мало для вывода — это не плохо и не хорошо.',
};

const fmtMln = (v: number) => `${(v / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸`;

export default async function ZhkPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const z = await findZhk(params);
  if (!z) notFound();

  const { scoreResult: sr } = z;
  const city = cityBySlug((z as any).citySlug);
  const color = BAND_COLOR[sr.band];
  const renderPhotos = z.photos && z.photos.length ? z.photos : z.image ? [z.image] : [];
  const galleryItems = [
    ...(z.realPhotos || []).map((p) => ({ url: p.url, kind: 'real' as const, author: p.author })),
    ...renderPhotos.map((u) => ({ url: u, kind: 'render' as const })),
  ];
  const priceInd = sr.indicators.find((i) => i.key === 'price');
  const ds = z.developerStats;
  const devSlug = z.developer?.slug.replace(/^\//, '') ?? '';
  const devHref = devSlug && !devSlug.includes('/') ? `/developer/${devSlug}` : null;

  const facts: [string, string | null, boolean][] = [
    ['Класс', z.classRu, false],
    ['Статус', z.constructionStatusRu, false],
    ['Срок сдачи', z.completion || null, false],
    ['Этажность', z.floors || null, false],
    ['Паркинг', z.parkingType !== 'нет данных' ? z.parkingType : null, false],
    ['Квартир', z.apartments || null, false],
    ['Выдерживает', z.seismicResistance ? `${z.seismicResistance} баллов` : 'не раскрыто', !!z.seismicResistance],
  ];

  const specs: [string, string | null][] = [
    ['Очереди строительства', z.queues && z.queues.length ? z.queues.join(' · ') : null],
    ['Подъездов в продаже', z.housesAvail ? `${z.housesAvail} из ${z.housesTotal}` : null],
    ['Технология', z.tech || null],
    ['Стены', z.walls || null],
    ['Высота потолков', z.ceilingHeight || null],
    ['Отделка', z.finishing || null],
    ['Домов в ЖК', z.houses || null],
    ['Паркинг (детально)', z.parking || null],
  ];

  // цена против рынка: столбики «этот ЖК» и «медиана класса» в одном масштабе
  const median = z.priceMedian ?? null;
  const priceMax = z.priceSqm && median ? Math.max(z.priceSqm, median) * 1.08 : 0;

  return (
    <>
    <PageBar />
    <div className={s.page}>
      <div className={s.gallery}>
        <Gallery items={galleryItems} name={z.name} />
      </div>

      <div className={s.layout}>
        <main className={s.main}>
          <div className={`${s.titleBlock} rise`} style={{ animationDelay: '60ms' }}>
            <div className={s.kicker}>{[city.name, z.district ? `${z.district} р-н` : null].filter(Boolean).join(' · ')}</div>
            <h1 className={s.title}>{z.name}</h1>
            <div className={s.dev}>
              Застройщик: {z.developer ? (devHref ? <Link href={devHref}>{z.developer.name}</Link> : <span>{z.developer.name}</span>) : '—'}
            </div>
            {z.address && <div className={s.addr}>{z.address}</div>}
            <div className={s.chips}>
              {z.deal && <span className={`${s.tag} ${s.tagDeal}`}><Icon name="flame" size={13} /> цена ниже рынка</span>}
              {z.classRu && <span className={s.tag}>{z.classRu}</span>}
              {z.constructionStatusRu && <span className={s.tag}>{z.constructionStatusRu}</span>}
              {z.seismicResistance && <span className={s.tag}><Icon name="mountain" size={13} /> {z.seismicResistance} баллов</span>}
            </div>
          </div>

          <div className={s.facts}>
            {facts.filter(([, v]) => v).map(([label, value, hl]) => (
              <div className={s.fact} key={label}>
                <div className={`${s.factVal} ${hl ? s.hl : ''}`}>{value}</div>
                <div className={s.factLabel}>{label}{label === 'Выдерживает' ? ' землетрясение' : ''}</div>
              </div>
            ))}
          </div>
          {city.slug === 'almaty' && (
            <div className={s.seismicNote}>
              <Icon name="mountain" size={14} /> Алматы — сейсмозона <b>9–10 баллов</b> (шкала MSK-64). Дом должен выдерживать землетрясение своей зоны; чем выше балл — тем безопаснее.
            </div>
          )}

          <Reveal as="section" className={s.section}>
            <h2 className={s.sectionTitle}>Из чего сложился индекс</h2>
            <div className={s.sectionHint}>Четыре показателя, у каждого своя шкала 0–100 и источник. Выше — безопаснее; серое — данных нет, а не ноль.</div>
            <div className={s.trust}>
              {sr.indicators.map((ind, n) => (
                <div key={ind.key} className={s.indRow}>
                  <div className={s.indHead}>
                    <span className={s.indName}>{ind.name}</span>
                    <span className={s.indWeight}>вес {ind.weight}%</span>
                    <div className={s.indScore} style={{ color: ind.score == null ? 'var(--text-faint)' : BAND_TEXT[ind.band] }}>
                      {ind.score == null ? '—' : ind.score}<span>/100</span>
                    </div>
                  </div>
                  <div className={s.indBarWrap}>
                    <Bar score={ind.score} band={ind.band} delay={n * 140} height={9} />
                    <div className={s.indValTxt} style={{ color: ind.score == null ? 'var(--text-faint)' : BAND_TEXT[ind.band] }}>{ind.value}</div>
                  </div>
                  {ind.detail && <p className={s.indDetail}>{ind.detail}</p>}
                  <div className={s.indSrcRow}>
                    <span className={`${s.indSrc} ${ind.sourceType === 'первоисточник' ? s.srcPrimary : s.srcShop}`}>{ind.sourceType}</span>
                    {ind.source && (ind.sourceUrl
                      ? <a href={ind.sourceUrl} target="_blank" rel="noopener noreferrer">{ind.source} ↗</a>
                      : <span>{ind.source}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {ds && ds.total > 0 && (
            <Reveal as="section" className={s.section}>
              <h2 className={s.sectionTitle}>История застройщика</h2>
              <div className={s.sectionHint}>Портфель {z.developer?.name} в каталоге новостроек: сколько сдано, строится и заморожено.</div>
              <div className={s.devCard}>
                <div className={s.devTop}>
                  <div>
                    <div className={s.devName}>{z.developer?.name}</div>
                    <div className={s.devSub}>{ds.total} ЖК · сдано {Math.round(ds.deliveredRatio * 100)}%</div>
                  </div>
                  {devHref && <Link href={devHref} className={s.devLink}>Все проекты <Icon name="right" size={15} /></Link>}
                </div>
                <div className={s.devBar} aria-hidden>
                  {([['ready', ds.ready, BAND_COLOR.green], ['construction', ds.construction, BAND_COLOR.amber], ['project', ds.project, '#c3c9d6'], ['suspended', ds.suspended, BAND_COLOR.red]] as const)
                    .filter(([, v]) => v > 0)
                    .map(([k, v, c]) => <i key={k} data-anim="bar" style={{ width: `${(v / ds.total) * 100}%`, background: c }} />)}
                </div>
                <div className={s.devLegend}>
                  <span><i style={{ background: BAND_COLOR.green }} /> сдано {ds.ready}</span>
                  <span><i style={{ background: BAND_COLOR.amber }} /> строится {ds.construction}</span>
                  {ds.project > 0 && <span><i style={{ background: '#c3c9d6' }} /> проект {ds.project}</span>}
                  <span><i style={{ background: BAND_COLOR.red }} /> приостановлено {ds.suspended}</span>
                </div>
              </div>
            </Reveal>
          )}

          {z.layouts && z.layouts.length > 0 && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Планировки</h2>
              <div className={s.sectionHint}>{z.layouts.length} вариантов квартир · нажмите, чтобы приблизить</div>
              <Layouts layouts={z.layouts} />
            </section>
          )}

          {specs.some(([, v]) => v) && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Характеристики дома</h2>
              <div className={s.specs} style={{ marginTop: 12 }}>
                {specs.filter(([, v]) => v).map(([label, value]) => (
                  <div className={s.spec} key={label}>
                    <div className={s.specLabel}>{label}</div>
                    <div className={s.specValue}>{value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {z.lat && z.lng && (
            <section className={s.section}>
              <h2 className={s.sectionTitle}>Где находится</h2>
              <div className={s.sectionHint}>
                {[z.address, z.district ? `${z.district} район` : null].filter(Boolean).join(' · ') || city.name} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{z.lat.toFixed(5)}, {z.lng.toFixed(5)}</span>
              </div>
              <div className={s.geoLinks}>
                <a href={`https://2gis.kz/${city.slug === 'kapchagay' ? 'konaev' : city.slug}?m=${z.lng}%2C${z.lat}%2F17`} target="_blank" rel="noopener noreferrer">Открыть в 2ГИС ↗</a>
                <a href={`https://yandex.ru/maps/?pt=${z.lng},${z.lat}&z=17&l=map`} target="_blank" rel="noopener noreferrer">Яндекс.Карты ↗</a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${z.lat},${z.lng}`} target="_blank" rel="noopener noreferrer">Google Maps ↗</a>
              </div>
              <div className={s.mapMini} style={{ marginTop: 12 }}>
                <MiniMap lat={z.lat} lng={z.lng} color={color} name={z.name} />
              </div>
            </section>
          )}

          <section className={s.section}>
            <div className={s.dispute}>
              <div className={s.disputeText}><b>Нашли ошибку или считаете оценку несправедливой?</b> Мы собираем открытые источники и исправим факт, если пришлёте подтверждение.</div>
              <DisputeButton zhkName={z.name} slug={z.slug} />
            </div>
          </section>

          <div className={s.disclaimer}>
            Не инвестиционная рекомендация. «{SCORE_NAME}» считается по <Link href="/methodology">публичной методике</Link> из проверяемых источников. Цены, сроки и фото — с витрины korter.kz (маркетинг застройщика), проверяйте перед сделкой. Данные собраны {new Date(z.scrapedAt).toLocaleDateString('ru-RU')}.
          </div>
        </main>

        <aside className={s.side}>
          <Reveal className={`${s.indexCard} rise`} style={{ animationDelay: '120ms' }}>
            <div className={s.indexLabel}>{SCORE_NAME}</div>
            <div className={s.indexRow}>
              <ScoreGauge score={sr.score} band={sr.band} size={156} stroke={13} caption="из 100" />
              <div className={s.indexMeta}>
                <div className={s.indexBand} style={{ color: BAND_TEXT[sr.band] }}>{BAND_LABEL[sr.band]}</div>
                <p className={s.indexVerdict}>{VERDICT[sr.band]}</p>
              </div>
            </div>
            {/* шкала зон: где граница «средней» и «высокой» и где стоит этот ЖК */}
            <div className={s.zone} aria-hidden>
              <div className={s.zoneBar}><i style={{ flex: 40, background: BAND_COLOR.red }} /><i style={{ flex: 30, background: BAND_COLOR.amber }} /><i style={{ flex: 30, background: BAND_COLOR.green }} /></div>
              {sr.score != null && <span className={s.zoneMark} data-anim="fade" style={{ left: `${sr.score}%`, borderColor: color }} />}
              <div className={s.zoneTicks}><span>0</span><span style={{ left: '40%' }}>40</span><span style={{ left: '70%' }}>70</span><span style={{ left: '100%' }}>100</span></div>
            </div>
            <div className={s.indexFoot}>
              <span>Данными закрыто {Math.round(sr.completeness * 100)}%</span>
              <Link href="/methodology">Как считается →</Link>
            </div>
          </Reveal>

          <Reveal className={`${s.priceCard} rise`} style={{ animationDelay: '180ms' }}>
            <div className={s.priceTotal}>{z.priceMin ? `от ${fmtMln(z.priceMin)}` : z.priceSqm ? `${z.priceSqm.toLocaleString('ru-RU')} ₸/м²` : 'цена не указана'}</div>
            {z.priceMin && z.priceSqm ? <div className={s.priceUnit}>{z.priceSqm.toLocaleString('ru-RU')} ₸ за м²</div> : null}
            {z.priceSqm && median ? (
              <div className={s.market}>
                <div className={s.marketTitle}>Цена за м² против рынка</div>
                <div className={s.marketRow}>
                  <span>Этот ЖК</span>
                  <div className={s.marketBar}><i data-anim="bar" style={{ width: `${(z.priceSqm / priceMax) * 100}%`, background: priceInd ? BAND_COLOR[priceInd.band] : 'var(--accent)' }} /></div>
                  <b>{Math.round(z.priceSqm / 1000).toLocaleString('ru-RU')} тыс</b>
                </div>
                <div className={s.marketRow}>
                  <span>Медиана {z.classRu ? `«${z.classRu}»` : 'рынка'}</span>
                  <div className={s.marketBar}><i data-anim="bar" style={{ width: `${(median / priceMax) * 100}%`, background: '#b8bfcd', transitionDelay: '150ms' }} /></div>
                  <b>{Math.round(median / 1000).toLocaleString('ru-RU')} тыс</b>
                </div>
                {priceInd && priceInd.score != null && (
                  <div className={s.marketVerdict} style={{ color: BAND_TEXT[priceInd.band] }}>
                    {/дороже/.test(priceInd.value) ? '▲' : /дешевле/.test(priceInd.value) ? '▼' : '≈'} {priceInd.value.replace('медианы', `медианы класса`)}
                  </div>
                )}
              </div>
            ) : null}
            <div className={s.priceWarn}>Цена с витрины korter — маркетинг застройщика, не оценка.</div>
          </Reveal>
        </aside>
      </div>
    </div>
    <SiteFooter />
    </>
  );
}
