'use client';
import { useEffect, useState } from 'react';
import s from './Layouts.module.scss';

export default function Layouts({ layouts }: { layouts: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const n = layouts.length;

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowLeft') setOpen((o) => (o == null ? o : (o - 1 + n) % n));
      else if (e.key === 'ArrowRight') setOpen((o) => (o == null ? o : (o + 1) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, n]);

  return (
    <>
      <div className={s.grid}>
        {layouts.map((src, i) => (
          <button key={src} className={s.cell} onClick={() => setOpen(i)} aria-label="Открыть планировку">
            <img className={s.img} src={src} alt="планировка" loading="lazy" />
            <span className={s.zoom}>⤢</span>
          </button>
        ))}
      </div>

      {open != null && (
        <div className={s.lightbox} onClick={() => setOpen(null)}>
          <button className={s.close} onClick={() => setOpen(null)}>✕</button>
          {n > 1 && <button className={s.nav} style={{ left: 20 }} onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + n) % n); }}>‹</button>}
          <img className={s.lightImg} src={layouts[open]} alt="планировка" onClick={(e) => e.stopPropagation()} />
          {n > 1 && <button className={s.nav} style={{ right: 20 }} onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % n); }}>›</button>}
          <div className={s.count}>{open + 1} / {n}</div>
        </div>
      )}
    </>
  );
}
