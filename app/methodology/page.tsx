import Link from 'next/link';
import { WEIGHTS } from '../../lib/score';
import { getStats } from '../../lib/data';
import s from './method.module.scss';

export const dynamic = 'force-static';

const ROWS = [
  { key: 'guarantee', label: 'Гарантия долевого участия', src: 'Реестр КФГЖС (khc.kz)', type: 'первоисточник', desc: 'Есть ли у ЖК действующий договор гарантии долевого строительства. «Гарантийный случай» — сильный негатив (застройщик не исполнил обязательства).' },
  { key: 'track', label: 'Трек застройщика', src: 'Портфель на korter.kz (витрина)', type: 'витрина', desc: 'Сколько ЖК застройщик уже сдал против строящихся и приостановленных. Доля сданных = сигнал надёжности. Пока из каталога-витрины — заменяется на завершённый реестр КЖК (первоисточник).' },
  { key: 'age', label: 'Возраст компании', src: 'БИН (кодирует дату регистрации)', type: 'первоисточник', desc: 'Молодое ТОО, зарегистрированное под один проект — выше риск, чем компания с историей. Считается из БИН застройщика.' },
  { key: 'stop', label: 'Признаки остановки стройки', src: 'Гарант-случаи КФГЖС + акиматы', type: 'первоисточник', desc: 'Официально зафиксированные остановки. Каждый флаг обязан ссылаться на официальный акт — иначе не публикуется.' },
  { key: 'courts', label: 'Судебные иски', src: 'Банк судебных актов (office.sud.kz)', type: 'первоисточник', desc: 'Иски к ТОО застройщика: банкротство, споры с дольщиками. Показываем контекст дела, а не голый счётчик.' },
  { key: 'reviews', label: 'Отзывы жильцов', src: '2GIS (дайджест)', type: 'витрина', desc: 'Сентимент отзывов как мягкий модификатор. Не ядро оценки — люди чаще пишут в гневе, чем в благодарности.' },
];

export default function Methodology() {
  const stats = getStats();
  return (
    <div className={s.page}>
      <div className={s.topbar}><Link href="/" className={s.back}>← карта</Link></div>

      <h1 className={s.h1}>Как считается «Индекс защиты покупателя»</h1>
      <p className={s.lead}>
        ЖК-Радар не выносит вердиктов «застройщик мошенник». Он собирает открытые проверяемые сигналы, взвешивает их по фиксированной формуле и показывает балл 0–100, где <b>выше — безопаснее купить</b> — с разбором каждого фактора и ссылкой на первоисточник. Вы всегда видите, из чего сложилась оценка.
      </p>
      <div className={s.callout} style={{ marginTop: 18 }}>
        <b>Что это за число.</b> «Индекс защиты покупателя» отвечает на один вопрос: <b>насколько безопасно здесь покупать</b> — защищены ли деньги (госгарантия КФГЖС), надёжен ли застройщик, безопасен ли объект. 100 = максимум защиты, 0 = максимум риска. Каждый фактор помечен: <span style={{ color: 'var(--green)' }}>первоисточник</span> (госреестр) или <span style={{ color: 'var(--amber)' }}>витрина</span> (данные агрегатора-каталога).
      </div>

      <h2 className={s.h2}>Шесть факторов и их вес</h2>
      <p className={`${s.p} ${s.dim}`}>Веса подобраны по доступности и надёжности источников (после разведки источников, Фаза 0). Сумма = 100.</p>
      <table className={s.table}>
        <thead><tr><th>Вес</th><th>Фактор</th><th>Источник</th></tr></thead>
        <tbody>
          {ROWS.sort((a, b) => WEIGHTS[b.key] - WEIGHTS[a.key]).map((r) => (
            <tr key={r.key}>
              <td className={s.w}>{WEIGHTS[r.key]}</td>
              <td><b>{r.label}</b><br /><span style={{ color: 'var(--text-dim)', fontSize: 13 }}>{r.desc}</span></td>
              <td style={{ color: 'var(--text-dim)', fontSize: 13 }}>
                <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '1px 7px', borderRadius: 5, marginBottom: 5, color: r.type === 'первоисточник' ? 'var(--green)' : 'var(--amber)', background: r.type === 'первоисточник' ? 'rgba(46,204,113,0.1)' : 'rgba(241,196,15,0.1)' }}>{r.type}</span>
                <br />{r.src}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className={s.callout}>
        <b>Формула.</b> Балл = средневзвешенное значение по факторам, <b>у которых есть данные</b>, приведённое к шкале 0–100. Если источник по фактору не подключён или молчит — фактор <span className={s.code}>серый</span> и в расчёт не входит. Мы не заменяем «нет данных» нулём — это было бы клеветой на застройщика. Поэтому у каждого ЖК показана «полнота данных»: какой процент веса методики реально закрыт.
      </div>

      <h2 className={s.h2}>Цветовые зоны</h2>
      <div className={s.bands}>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--green)' }}>Высокая защита</div><div className={s.bandRange}>70–100 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--amber)' }}>Средняя защита</div><div className={s.bandRange}>40–69 баллов</div></div>
        <div className={s.bandCard}><div className={s.bandName} style={{ color: 'var(--red)' }}>Низкая защита</div><div className={s.bandRange}>0–39 баллов</div></div>
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
