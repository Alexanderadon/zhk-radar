import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllZhk, getZhkBySlug } from '../../../lib/data';
import { BAND_COLOR, BAND_LABEL, SCORE_NAME } from '../../../lib/score';
import Gallery from '../../../components/Gallery';
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
  const photos = z.photos && z.photos.length ? z.photos : z.image ? [z.image] : [];

  const facts: [string, string | null, boolean][] = [
    ['Класс', z.classRu, false],
    ['Статус', z.constructionStatusRu, false],
    ['Этажность', z.floors || null, false],
    ['Паркинг', z.parkingType !== 'нет данных' ? z.parkingType : null, false],
    ['Квартир', z.apartments || null, false],
    ['Сейсмостойкость', z.seismicResistance ? `${z.seismicResistance} баллов` : null, true],
  ];

  const specs: [string, string | null][] = [
    ['Технология', z.tech || null],
    ['Стены', z.walls || null],
    ['Высота потолков', z.ceilingHeight || null],
    ['Отделка', z.finishing || null],
    ['Домов в ЖК', z.houses || null],
    ['Паркинг (детально)', z.parking || null],
  ];

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <Link href="/" className={s.back}>← к карте</Link>
        <div className={s.crumbSpacer} />
        <Link href="/methodology" className={s.back}>как считается защита?</Link>
      </div>

      <div className={s.gallery}>
        <Gallery photos={photos} name={z.name} />
      </div>

      <div className={s.headRow}>
        <div className={s.titleBlock}>
          <h1 className={s.title}>{z.name}</h1>
          <div className={s.dev}>
            Застройщик: {z.developer ? <Link href={`/developer/${z.developer.slug.replace(/^\//, '')}`}>{z.developer.name}</Link> : '—'}
          </div>
          {z.address && <div className={s.addr}>{z.address}</div>}
          <div className={s.chips}>
            {z.classRu && <span className={s.tag}>{z.classRu}</span>}
            {z.constructionStatusRu && <span className={s.tag}>{z.constructionStatusRu}</span>}
            {z.district && <span className={s.tag}>{z.district} р-н</span>}
            {z.seismicResistance && <span className={s.tag}>⛰ {z.seismicResistance} баллов</span>}
          </div>
        </div>

        <aside className={s.buyPanel}>
          <div className={s.price}>{z.priceSqm ? `${z.priceSqm.toLocaleString('ru-RU')} ₸/м²` : 'цена не указана'}</div>
          {z.priceMin && <div className={s.priceSub}>от {(z.priceMin / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸ за квартиру</div>}
          <div className={s.priceWarn}>⚠ цена с витрины korter — маркетинг, не оценка</div>
          <div className={s.protect}>
            <div className={s.protectNum} style={{ color }}>{sr.score ?? '—'}</div>
            <div className={s.protectMeta}>
              <div className={s.protectLabel} style={{ color }}>{BAND_LABEL[sr.band]}</div>
              <div className={s.protectSub}>{SCORE_NAME} · <Link href="/methodology">что это?</Link></div>
            </div>
          </div>
        </aside>
      </div>

      <div className={s.facts}>
        {facts.filter(([, v]) => v).map(([label, value, hl]) => (
          <div className={s.fact} key={label}>
            <div className={`${s.factVal} ${hl ? s.hl : ''}`}>{value}</div>
            <div className={s.factLabel}>{label}</div>
          </div>
        ))}
      </div>

      <section className={s.section}>
        <div className={s.sectionTitle}>Насколько безопасно покупать</div>
        <div className={s.sectionHint}>Четыре индикатора, каждый со своей шкалой 0–100. Выше — безопаснее.</div>
        <div className={s.trust}>
          {sr.indicators.map((ind) => {
            const c = BAND_COLOR[ind.band];
            return (
              <div key={ind.key} className={s.indRow} title={ind.detail}>
                <div>
                  <span className={s.indName}>{ind.name}</span>
                  <span
                    className={s.indSrc}
                    style={{
                      color: ind.sourceType === 'первоисточник' ? 'var(--green)' : 'var(--amber)',
                      background: ind.sourceType === 'первоисточник' ? 'rgba(46,204,113,0.1)' : 'rgba(241,196,15,0.1)',
                    }}
                  >
                    {ind.sourceType}
                  </span>
                </div>
                <div className={s.indBarWrap}>
                  <div className={s.indBar}>
                    {ind.score == null ? <div className={s.indGrey} /> : <div className={s.indFill} style={{ width: `${ind.score}%`, background: c }} />}
                  </div>
                  <div className={s.indValTxt}>{ind.value}</div>
                </div>
                <div className={s.indScore} style={{ color: ind.score == null ? 'var(--grey)' : c }}>
                  {ind.score == null ? '—' : ind.score}<span>/100</span>
                </div>
              </div>
            );
          })}
          <div className={s.trustFoot}>
            <span>Данными закрыто {Math.round(sr.completeness * 100)}% — серое ещё не подключено.</span>
            <Link href="/methodology">Как считается защита →</Link>
          </div>
        </div>
      </section>

      {z.layouts && z.layouts.length > 0 && (
        <section className={s.section}>
          <div className={s.sectionTitle}>Планировки</div>
          <div className={s.sectionHint}>{z.layouts.length} вариантов квартир</div>
          <div className={s.layoutGrid}>
            {z.layouts.map((src) => <img key={src} className={s.layoutImg} src={src} alt="планировка" loading="lazy" />)}
          </div>
        </section>
      )}

      {specs.some(([, v]) => v) && (
        <section className={s.section}>
          <div className={s.sectionTitle}>Характеристики дома</div>
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
          <div className={s.sectionTitle}>Где находится</div>
          <div className={s.mapMini} style={{ marginTop: 12 }}>
            <MiniMap lat={z.lat} lng={z.lng} color={color} name={z.name} />
          </div>
        </section>
      )}

      <section className={s.section}>
        <div className={s.dispute}>
          <div className={s.disputeText}>Заметили ошибку в данных или считаете оценку несправедливой? ЖК-Радар агрегирует открытые источники и исправит факт с подтверждением.</div>
          <a className="btn" href={`mailto:hello@zhk-radar.kz?subject=${encodeURIComponent('Оспорить данные: ' + z.name)}`}>Оспорить данные</a>
        </div>
      </section>

      <div className={s.disclaimer}>
        ЖК-Радар — агрегатор открытых данных, не инвестиционная рекомендация. «{SCORE_NAME}» считается по <Link href="/methodology">публичной методике</Link> из проверяемых источников. Цены, сроки и фото — с витрины korter.kz (маркетинг застройщика), проверяйте перед сделкой. Данные собраны {new Date(z.scrapedAt).toLocaleDateString('ru-RU')}.
      </div>
    </div>
  );
}
