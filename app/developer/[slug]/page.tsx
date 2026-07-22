import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAllZhk, getDeveloper } from '../../../lib/data';
import { BAND_COLOR, BAND_LABEL } from '../../../lib/score';
import s from './dev.module.scss';

export const dynamic = 'force-static';

export function generateStaticParams() {
  const seen = new Set<string>();
  const params: { slug: string }[] = [];
  for (const z of getAllZhk()) {
    if (!z.developer) continue;
    const slug = z.developer.slug.replace(/^\//, '');
    if (slug && !seen.has(slug)) { seen.add(slug); params.push({ slug }); }
  }
  return params;
}

export default async function DeveloperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = getDeveloper(slug);
  if (!data) notFound();
  const { stats, zhks } = data;

  const scored = zhks.filter((z) => z.scoreResult.score != null);
  const avg = scored.length ? Math.round(scored.reduce((a, z) => a + (z.scoreResult.score || 0), 0) / scored.length) : null;
  const sorted = [...zhks].sort((a, b) => (b.scoreResult.score ?? -1) - (a.scoreResult.score ?? -1));

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <Link href="/" className={s.back}>← карта</Link>
      </div>

      <div className={s.head}>
        <h1 className={s.name}>{stats.name}</h1>
        <div className={s.sub}>Застройщик · {stats.total} {plural(stats.total, 'жилой комплекс', 'жилых комплекса', 'жилых комплексов')} в Алматы</div>
      </div>

      <div className={s.statgrid}>
        <div className={s.stat}><div className={s.statNum} style={{ color: avg != null ? BAND_COLOR[band(avg)] : 'var(--grey)' }}>{avg ?? '—'}</div><div className={s.statLabel}>средний риск-балл</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--green)' }}>{stats.ready}</div><div className={s.statLabel}>сдано</div></div>
        <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--amber)' }}>{stats.construction}</div><div className={s.statLabel}>строится</div></div>
        <div className={s.stat}><div className={s.statNum}>{stats.project}</div><div className={s.statLabel}>на этапе проекта</div></div>
        {stats.suspended > 0 && <div className={s.stat}><div className={s.statNum} style={{ color: 'var(--red)' }}>{stats.suspended}</div><div className={s.statLabel}>приостановлено</div></div>}
        <div className={s.stat}><div className={s.statNum}>{Math.round(stats.deliveredRatio * 100)}%</div><div className={s.statLabel}>доля сданных</div></div>
      </div>

      <div className={s.sectionTitle}>Портфель проектов</div>
      <div>
        {sorted.map((z) => (
          <Link key={z.id} href={`/zhk${z.slug}`} className={s.row}>
            {z.image ? <img className={s.thumb} src={z.image} alt="" /> : <div className={s.thumb} />}
            <div className={s.rowBody}>
              <div className={s.rowName}>{z.name}</div>
              <div className={s.rowMeta}>
                {[z.classRu, z.constructionStatusRu, z.priceSqm ? `${Math.round(z.priceSqm / 1000)} тыс ₸/м²` : null].filter(Boolean).join(' · ')}
              </div>
            </div>
            <span className={`chip band-${z.scoreResult.band}`}>{BAND_LABEL[z.scoreResult.band]}</span>
            <div className={s.rowScore} style={{ color: BAND_COLOR[z.scoreResult.band] }}>{z.scoreResult.score ?? '—'}</div>
          </Link>
        ))}
      </div>

      <div className={s.note}>
        Совокупные показатели застройщика рассчитаны по его портфелю в каталоге новостроек Алматы (korter.kz). «Доля сданных» — сильный, но не исчерпывающий сигнал: молодой застройщик с одним строящимся ЖК не обязательно хуже — у него просто короткий трек. Балл каждого ЖК считается по <Link href="/methodology" style={{ color: 'var(--accent-dim)' }}>публичной методике</Link>.
      </div>
    </div>
  );
}

function band(score: number): 'green' | 'amber' | 'red' {
  return score >= 70 ? 'green' : score >= 40 ? 'amber' : 'red';
}
function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
