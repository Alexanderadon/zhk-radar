import Link from 'next/link';
import s from './Logo.module.scss';

/**
 * Знак Tirek: пологая кровля на одной колонне — «тірек», опора. Кровля золотая,
 * колонна белая на лазурите. Рисунок тот же, что в app/icon.svg (фавикон).
 */
export function TirekMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden focusable="false">
      <rect width="64" height="64" rx="16" fill="#1F2E7A" />
      <path d="M9 29 L32 15 L55 29" fill="none" stroke="#F2B53A" strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="21" y="29" width="22" height="5" rx="1.5" fill="#fff" />
      <rect x="27" y="33" width="10" height="13" fill="#fff" />
      <rect x="21" y="45" width="22" height="5" rx="1.5" fill="#fff" />
    </svg>
  );
}

/** Знак + надпись. onDark — для тёмных подложек (надпись белая). */
export default function Logo({ size = 36, href = '/', onDark = false, onClick }: {
  size?: number; href?: string | null; onDark?: boolean; onClick?: (e: React.MouseEvent) => void;
}) {
  const inner = (
    <>
      <TirekMark size={size} className={s.mark} />
      <span className={s.word} style={{ fontSize: Math.round(size * 0.62) }}>tirek</span>
    </>
  );
  const cls = `${s.logo} ${onDark ? s.onDark : ''}`;
  return href == null
    ? <span className={cls} aria-label="Tirek">{inner}</span>
    : <Link href={href} className={cls} aria-label="Tirek — на главную" onClick={onClick}>{inner}</Link>;
}
