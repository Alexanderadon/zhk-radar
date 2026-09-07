import Link from 'next/link';
import { INDICATOR_WEIGHTS } from '../../lib/score';
import { getStats } from '../../lib/data';
import s from './method.module.scss';

export const dynamic = 'force-static';

const ROWS = [
  { key: 'money', label: 'Защита денег дольщика', src: 'Реестр гарантий КФГЖС (khc.kz) + приостановки', type: 'первоисточник', desc: 'Лежат ли деньги под госгарантией. Объявлен «гарантийный случай» или стройку приостановили — балл падает почти до нуля. Гарантия действует — 100.' },
  { key: 'reliability', label: 'Надёжность застройщика', src: 'Портфель на korter.kz (витрина)', type: 'витрина', desc: 'Сколько у застройщика сдано против того, что ещё строится или заморожено. Пока считаем по каталогу-витрине; на очереди завершённый реестр КЖК и суды по БИН — это уже первоисточники.' },
  { key: 'seismic', label: 'Сейсмобезопасность', src: 'Проектная декларация (через korter)', type: 'витрина', desc: 'Проектная сейсмостойкость в баллах. Алматы стоит в зоне 9–10, поэтому 10 баллов дают 100, девять — 78, дальше падает быстро. Застройщик не раскрыл — серый.' },
  { key: 'price', label: 'Цена vs рынок', src: 'Медиана каталога по классу (korter)', type: 'витрина', desc: 'Цена/м² против медианы своего класса. Дешевле медианы — балл выше: меньше переплата. Позже перейдём на медиану stat.gov, это первоисточник.' },
];

export default function Methodology() {
  const stats = getStats();
  return (
    <div className={s.page}>
      <div className={s.topbar}><Link href="/" className={s.back}>← карта</Link></div>

      <h1 className={s.h1}>Как считается «Индекс защиты покупателя»</h1>
      <p className={s.lead}>
        ЖК-Радар никого не называет мошенником. Он берёт открытые данные, которые вы можете перепроверить сами, и считает по одной и той же формуле балл от 0 до 100: <b>выше — безопаснее купить</b>. Рядом с баллом всегда лежит разбор — какой фактор сколько дал и откуда взята цифра.
      </p>
      <div className={s.callout} style={{ marginTop: 18 }}>
        <b>Что это за число.</b> «Индекс защиты покупателя» отвечает на один вопрос: <b>насколько безопасно здесь покупать</b>. Защищены ли деньги госгарантией КФГЖС. Что за застройщик. Что с самим домом. 100 — максимум защиты, 0 — максимум риска. У каждого фактора стоит метка: <span style={{ color: 'var(--green)' }}>первоисточник</span> (госреестр) или <span style={{ color: 'var(--amber)' }}>витрина</span> (данные агрегатора-каталога).
      </div>

      <h2 className={s.h2}>Четыре индикатора и их вес</h2>
      <p className={`${s.p} ${s.dim}`}>Веса расставлены не на глаз: сначала мы посмотрели, какие источники вообще доступны и насколько им можно верить. Сумма — 100.</p>
      <div className={s.tableWrap}>
      <table className={s.table}>
        <thead><tr><th>Вес</th><th>Индикатор (своя шкала 0–100)</th><th>Источник</th></tr></thead>
        <tbody>
          {[...ROWS].sort((a, b) => INDICATOR_WEIGHTS[b.key as keyof typeof INDICATOR_WEIGHTS] - INDICATOR_WEIGHTS[a.key as keyof typeof INDICATOR_WEIGHTS]).map((r) => (
            <tr key={r.key}>
              <td className={s.w}>{INDICATOR_WEIGHTS[r.key as keyof typeof INDICATOR_WEIGHTS]}</td>
              <td><b>{r.label}</b><br /><span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{r.desc}</span></td>
              <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5, marginBottom: 5, color: r.type === 'первоисточник' ? 'var(--green)' : 'var(--amber)', background: r.type === 'первоисточник' ? 'rgba(46,204,113,0.1)' : 'rgba(241,196,15,0.1)' }}>{r.type}</span>
                <br />{r.src}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className={s.callout}>
        <b>Формула.</b> У каждого из четырёх индикаторов своя шкала 0–100: бывает хуже, бывает лучше — это градация, а не «да/нет». Общий «Индекс защиты покупателя» — средневзвешенное тех индикаторов, <b>у которых есть данные</b>. Источник молчит — индикатор <span className={s.code}>серый</span>, в расчёт не идёт. Нулём «нет данных» мы не заменяем: это была бы клевета на застройщика. Поэтому рядом с баллом всегда стоит «полнота данных».
      </div>

      <h2 className={s.h2}>Цветовые зоны</h2>
      <div className={s.bands}>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--green)' }}>Высокая защита</div><div className={s.bandRange}>70–100 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--amber)' }}>Средняя защита</div><div className={s.bandRange}>40–69 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--red)' }}>Низкая защита</div><div className={s.bandRange}>0–39 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--grey)' }}>Мало данных</div><div className={s.bandRange}>полнота &lt; 15%</div></div>
      </div>

      <h2 className={s.h2}>Принципы</h2>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Только проверяемые факты.</b> Ни один негативный флаг не появляется без ссылки на официальный источник — суд, акимат, реестр КФГЖС.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>«Нет данных» — серый, а не красный.</b> ЖК может не значиться в реестре гарантий и при этом быть в полном порядке: гарантия — лишь один из трёх легальных путей привлекать деньги дольщиков.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Данные можно оспорить.</b> Кнопка «Оспорить данные» есть на странице каждого ЖК. Приходите с подтверждением — поправим.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Методика лежит в коде.</b> Веса и формула версионируются вместе с проектом, поэтому любую правку видно в истории изменений.</span></div>

      <h2 className={s.h2}>Охват данных сейчас</h2>
      <p className={s.p}>
        В каталоге <b>{stats.total} ЖК</b> Алматы от <b>{stats.developers} застройщиков</b>. Сейсмостойкость раскрыта у {stats.withSeismic}. Распределение по риску:
        {' '}<span style={{ color: 'var(--green)' }}>{stats.bands.green} низкий</span>,
        {' '}<span style={{ color: 'var(--amber)' }}>{stats.bands.amber} средний</span>,
        {' '}<span style={{ color: 'var(--red)' }}>{stats.bands.red} высокий</span>,
        {' '}<span style={{ color: 'var(--grey)' }}>{stats.bands.grey} мало данных</span>.
      </p>
      <p className={`${s.p} ${s.dim}`}>
        Часть факторов — суды, возраст компании, отзывы — подключается по мере готовности коллекторов. Отсюда и пометка «мало данных» у многих ЖК. Пусть лучше будет видно, где у нас дырка, чем нарисованная точность.
      </p>

      <p className={`${s.p} ${s.dim}`} style={{ marginTop: 30, fontSize: 13 }}>
        ЖК-Радар — независимый агрегатор открытых данных. Не является инвестиционной рекомендацией. Экосистема: воздух Алматы и зарплаты по КЗ — отдельные проекты, интеграция в разработке.
      </p>
    </div>
  );
}
