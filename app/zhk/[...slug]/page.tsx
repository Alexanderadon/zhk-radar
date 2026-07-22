import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllZhk, getZhkBySlug } from '../../../lib/data';
import { BAND_COLOR, BAND_LABEL, SCORE_NAME } from '../../../lib/score';
import Gallery from '../../../components/Gallery';
import Layouts from '../../../components/Layouts';
import MiniMap from '../../../components/MiniMap';
import Icon from '../../../components/Icon';
import s from './zhk.module.scss';

export const dynamic = 'force-static';

function marketArrow(v: string): string {
  if (/дороже/i.test(v)) return '▲';
  if (/дешевле/i.test(v)) return '▼';
  return '≈';
}

export function generateStaticParams() {
  return getAllZhk().map((z) => ({ slug: z.slug.replace(/^\//, '').split('/') }));
}

export default async function ZhkPage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;
  const z = getZhkBySlug(Array.isArray(slug) ? slug.join('/') : slug);
  if (!z) notFound();

  const { scoreResult: sr } = z;
  const color = BAND_COLOR[sr.band];
  const renderPhotos = z.photos && z.photos.length ? z.photos : z.image ? [z.image] : [];
  const galleryItems = [
    ...(z.realPhotos || []).map((p) => ({ url: p.url, kind: 'real' as const, author: p.author })),
    ...renderPhotos.map((u) => ({ url: u, kind: 'render' as const })),
  ];
  const priceInd = sr.indicators.find((i) => i.key === 'price');

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

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <Link href="/" className={s.back}>← к карте</Link>
        <div className={s.crumbSpacer} />
        <Link href="/methodology" className={s.back}>как считается защита?</Link>
      </div>

      <div className={s.gallery}>
        <Gallery items={galleryItems} name={z.name} />
      </div>

      <div className={s.headRow}>
        <div className={s.titleBlock}>
          <h1 className={s.title}>{z.name}</h1>
          <div className={s.dev}>
            Застройщик: {(() => {
              if (!z.developer) return '—';
              const ds = z.developer.slug.replace(/^\//, '');
              return ds && !ds.includes('/') ? <Link href={`/developer/${ds}`}>{z.developer.name}</Link> : <span style={{ color: 'var(--text)' }}>{z.developer.name}</span>;
            })()}
          </div>
          {z.address && <div className={s.addr}>{z.address}</div>}
          <div className={s.chips}>
            {z.classRu && <span className={s.tag}>{z.classRu}</span>}
            {z.constructionStatusRu && <span className={s.tag}>{z.constructionStatusRu}</span>}
            {z.district && <span className={s.tag}>{z.district} р-н</span>}
            {z.seismicResistance && <span className={s.tag}><Icon name="mountain" size={13} /> {z.seismicResistance} баллов</span>}
          </div>
        </div>

        <aside className={s.buyPanel}>
          {z.priceMin ? (
            <>
              <div className={s.priceTotal}>от {(z.priceMin / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸</div>
              {z.priceSqm && <div className={s.priceUnit}>{z.priceSqm.toLocaleString('ru-RU')} ₸/м² · за квартиру</div>}
            </>
          ) : (
            <div className={s.priceTotal}>{z.priceSqm ? `${z.priceSqm.toLocaleString('ru-RU')} ₸/м²` : 'цена не указана'}</div>
          )}
          {priceInd && priceInd.score != null && (
            <div className={s.marketBadge} style={{ color: BAND_COLOR[priceInd.band], background: `${BAND_COLOR[priceInd.band]}1a` }}>
              {marketArrow(priceInd.value)} {priceInd.value.replace('медианы', `похожих ${z.classRu || ''}`.trim())}
            </div>
          )}
          {z.deal && <div className={s.dealBadge}><Icon name="flame" size={15} /> выгодная цена — дешевле похожих ЖК</div>}
          <div className={s.priceWarn}>цена с витрины korter — маркетинг, не оценка</div>
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
            <div className={s.factLabel}>{label}{label === 'Выдерживает' ? ' землетрясение' : ''}</div>
          </div>
        ))}
      </div>
      <div className={s.seismicNote}>
        <Icon name="mountain" size={14} /> Алматы — сейсмозона <b>9–10 баллов</b> (шкала MSK-64). Дом должен выдерживать землетрясение своей зоны; чем выше балл — тем безопаснее.
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
          <div className={s.sectionHint}>{z.layouts.length} вариантов квартир · нажмите, чтобы приблизить</div>
          <Layouts layouts={z.layouts} />
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
          <div className={s.sectionHint}>
            {[z.address, z.district ? `${z.district} район` : null].filter(Boolean).join(' · ') || 'Алматы'} · <span style={{ fontVariantNumeric: 'tabular-nums' }}>{z.lat.toFixed(5)}, {z.lng.toFixed(5)}</span>
          </div>
          <div className={s.geoLinks}>
            <a href={`https://2gis.kz/almaty?m=${z.lng}%2C${z.lat}%2F17`} target="_blank" rel="noopener noreferrer">Открыть в 2ГИС ↗</a>
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
