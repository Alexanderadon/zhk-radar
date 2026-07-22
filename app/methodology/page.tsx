import Link from 'next/link';
import { WEIGHTS } from '../../lib/score';
import { getStats } from '../../lib/data';
import s from './method.module.scss';

export const dynamic = 'force-static';

const ROWS = [
  { key: 'guarantee', label: 'Гарантия долевого участия', src: 'Реестр КФГЖС (khc.kz)', desc: 'Есть ли у ЖК действующий договор гарантии долевого строительства. «Гарантийный случай» — сильный негатив (застройщик не исполнил обязательства).' },
  { key: 'track', label: 'Трек застройщика', src: 'Портфель на korter.kz + завершённый реестр КЖК', desc: 'Сколько ЖК застройщик уже сдал против строящихся и приостановленных. Доля сданных = ключевой сигнал надёжности.' },
  { key: 'age', label: 'Возраст компании', src: 'БИН (кодирует дату регистрации)', desc: 'Молодое ТОО, зарегистрированное под один проект — выше риск, чем компания с историей. Считается из БИН застройщика.' },
  { key: 'stop', label: 'Признаки остановки стройки', src: 'Гарант-случаи КФГЖС + мониторинг новостей + акиматы', desc: 'Официально зафиксированные остановки. Каждый флаг обязан ссылаться на официальный акт — иначе не публикуется.' },
  { key: 'courts', label: 'Судебные иски', src: 'Банк судебных актов (office.sud.kz)', desc: 'Иски к ТОО застройщика: банкротство, споры с дольщиками. Показываем контекст дела, а не голый счётчик.' },
  { key: 'reviews', label: 'Отзывы жильцов', src: '2GIS (дайджест)', desc: 'Сентимент отзывов как мягкий модификатор. Не ядро оценки — люди чаще пишут в гневе, чем в благодарности.' },
];

export default function Methodology() {
  const stats = getStats();
  return (
    <div className={s.page}>
      <div className={s.topbar}><Link href="/" className={s.back}>← карта</Link></div>

      <h1 className={s.h1}>Как считается риск-балл</h1>
      <p className={s.lead}>
        ЖК-Радар не выносит вердиктов «застройщик мошенник». Он собирает открытые проверяемые сигналы, взвешивает их по фиксированной формуле и показывает балл 0–100 — <b>с разбором каждого фактора и ссылкой на первоисточник</b>. Вы всегда видите, из чего сложилась оценка.
      </p>

      <h2 className={s.h2}>Шесть факторов и их вес</h2>
      <p className={`${s.p} ${s.dim}`}>Веса подобраны по доступности и надёжности источников (после разведки источников, Фаза 0). Сумма = 100.</p>
      <table className={s.table}>
        <thead><tr><th>Вес</th><th>Фактор</th><th>Источник</th></tr></thead>
        <tbody>
          {ROWS.sort((a, b) => WEIGHTS[b.key] - WEIGHTS[a.key]).map((r) => (
            <tr key={r.key}>
              <td className={s.w}>{WEIGHTS[r.key]}</td>
              <td><b>{r.label}</b><br /><span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{r.desc}</span></td>
              <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>{r.src}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={s.callout}>
        <b>Формула.</b> Балл = средневзвешенное значение по факторам, <b>у которых есть данные</b>, приведённое к шкале 0–100. Если источник по фактору не подключён или молчит — фактор <span className={s.code}>серый</span> и в расчёт не входит. Мы не заменяем «нет данных» нулём — это было бы клеветой на застройщика. Поэтому у каждого ЖК показана «полнота данных»: какой процент веса методики реально закрыт.
      </div>

      <h2 className={s.h2}>Цветовые зоны</h2>
      <div className={s.bands}>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--green)' }}>Низкий риск</div><div className={s.bandRange}>70–100 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--amber)' }}>Средний риск</div><div className={s.bandRange}>40–69 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--red)' }}>Высокий риск</div><div className={s.bandRange}>0–39 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--grey)' }}>Мало данных</div><div className={s.bandRange}>полнота &lt; 15%</div></div>
      </div>

      <h2 className={s.h2}>Принципы</h2>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Только проверяемые факты.</b> Ни один негативный флаг не появляется без ссылки на официальный источник: суд, акимат, реестр КФГЖС.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>«Нет данных» — это серый, а не красный.</b> Отсутствие ЖК в реестре гарантий не делает его плохим: гарантия — лишь один из трёх легальных путей привлечения средств.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Данные можно оспорить.</b> На странице каждого ЖК есть кнопка «Оспорить данные». Факт с подтверждением исправляется.</span></div>
      <div className={s.principle}><span className={s.principleIcon}>→</span><span className={s.principleText}><b>Методика открыта и версионируется.</b> Веса и формула лежат в коде проекта; изменения видны в истории.</span></div>

      <h2 className={s.h2}>Охват данных сейчас</h2>
      <p className={s.p}>
        В каталоге <b>{stats.total} ЖК</b> Алматы от <b>{stats.developers} застройщиков</b>. Сейсмостойкость раскрыта у {stats.withSeismic}. Распределение по риску:
        {' '}<span style={{ color: 'var(--green)' }}>{stats.bands.green} низкий</span>,
        {' '}<span style={{ color: 'var(--amber)' }}>{stats.bands.amber} средний</span>,
        {' '}<span style={{ color: 'var(--red)' }}>{stats.bands.red} высокий</span>,
        {' '}<span style={{ color: 'var(--grey)' }}>{stats.bands.grey} мало данных</span>.
      </p>
      <p className={`${s.p} ${s.dim}`}>
        Часть факторов (суды, возраст компании, отзывы) подключается по мере готовности коллекторов — поэтому у многих ЖК сейчас видна честная пометка «мало данных». Это осознанный выбор: лучше показать неполноту, чем выдумать точность.
      </p>

      <p className={`${s.p} ${s.dim}`} style={{ marginTop: 30, fontSize: 13 }}>
        ЖК-Радар — независимый агрегатор открытых данных. Не является инвестиционной рекомендацией. Экосистема: воздух Алматы и зарплаты по КЗ — отдельные проекты, интеграция в разработке.
      </p>
    </div>
  );
}
