import Link from 'next/link';
import Logo from './Logo';
import { ContactButton } from './DisputeButton';
import s from './SiteFooter.module.scss';

/** Подвал: дисклеймер, откуда данные, как связаться. Один на лендинге и страницах ЖК. */
export default function SiteFooter({ updatedAt }: { updatedAt?: string | null }) {
  return (
    <footer className={s.foot}>
      <div className={s.inner}>
        <div className={s.about}>
          <Logo size={32} onDark href="/" />
          <p className={s.slogan}>Сначала проверь — потом покупай.</p>
          <p className={s.disc}>
            Не инвестиционная рекомендация. Tirek собирает открытые данные и считает индекс по
            {' '}<Link href="/methodology">публичной методике</Link>. Цены, сроки и фото — из каталогов
            и объявлений, сверяйте их перед сделкой.
          </p>
        </div>
        <div className={s.col}>
          <div className={s.h}>Данные</div>
          <a href="https://khc.kz/ru/equity/uslugi/357/3260/" target="_blank" rel="noopener noreferrer">Реестр гарантий КФГЖС</a>
          <a href="https://korter.kz" target="_blank" rel="noopener noreferrer">Каталог новостроек korter.kz</a>
          <a href="https://krisha.kz" target="_blank" rel="noopener noreferrer">Объявления krisha.kz</a>
          <a href="https://2gis.kz" target="_blank" rel="noopener noreferrer">Фото и места — 2ГИС</a>
          <a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">Карта — OpenStreetMap</a>
        </div>
        <div className={s.col}>
          <div className={s.h}>Проект</div>
          <Link href="/#map">Карта новостроек</Link>
          <Link href="/methodology">Как считается индекс</Link>
          <ContactButton className={s.linkBtn} />
          <span className={s.muted}>Ошибка в данных? Кнопка «Оспорить» есть на странице каждого ЖК.</span>
        </div>
      </div>
      <div className={s.bottom}>
        <span>© 2026 Tirek</span>
        {updatedAt && <span>Данные на {new Date(updatedAt).toLocaleDateString('ru-RU')}</span>}
      </div>
    </footer>
  );
}
