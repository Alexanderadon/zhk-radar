import Link from 'next/link';
import Logo from './Logo';
import Icon from './Icon';
import s from './PageBar.module.scss';

/** Верхняя панель страниц ЖК, застройщика и методологии: лого, назад к карте, методология. */
export default function PageBar({ methodology = true }: { methodology?: boolean }) {
  return (
    <header className={s.bar}>
      <div className={s.inner}>
        <Logo size={30} href="/#map" />
        <Link href="/#map" className={s.back}><Icon name="left" size={16} /> К карте</Link>
        <div className={s.spacer} />
        {methodology && <Link href="/methodology" className={s.link}>Как считается индекс</Link>}
      </div>
    </header>
  );
}
