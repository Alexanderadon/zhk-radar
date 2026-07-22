'use client';
import { useEffect, useRef, useState } from 'react';
import s from './Gallery.module.scss';

export interface GalleryItem {
  url: string;
  kind: 'real' | 'render';
  author?: string;
}

export default function Gallery({ items, name }: { items: GalleryItem[]; name: string }) {
  const list = items;
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const n = list.length;
  const cur = list[active];

  const go = (d: number) => setActive((a) => (a + d + n) % n);

  useEffect(() => {
    const el = thumbsRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (n < 2) return;
      if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);

  if (!n) return <div className={`${s.main} ${s.empty}`}>◫</div>;

  return (
    <>
      <div className={s.wrap}>
        <div className={s.mainWrap}>
          <img className={s.main} src={cur.url} alt={name} onClick={() => setOpen(true)} />
          {cur.kind === 'real' ? (
            <div className={`${s.badge} ${s.badgeReal}`}>● реальное фото{cur.author ? ` · ${cur.author}` : ''} · 2ГИС</div>
          ) : (
            <div className={s.badge}>⚠ визуализация застройщика</div>
          )}
          {n > 1 && (
            <>
              <button className={`${s.arrow} ${s.arrowL}`} aria-label="Предыдущее" onClick={() => go(-1)}>‹</button>
              <button className={`${s.arrow} ${s.arrowR}`} aria-label="Следующее" onClick={() => go(1)}>›</button>
              <div className={s.counter}>{active + 1} / {n}</div>
            </>
          )}
          <div className={s.zoomHint} onClick={() => setOpen(true)}>увеличить ⤢</div>
        </div>
        {n > 1 && (
          <div className={s.thumbs} ref={thumbsRef}>
            {list.map((it, i) => (
              <button key={it.url + i} className={`${s.thumb} ${i === active ? s.thumbActive : ''}`} onClick={() => setActive(i)}>
                <img src={it.url} alt="" loading="lazy" />
                {it.kind === 'real' && <span className={s.thumbDot} />}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className={s.lightbox} onClick={() => setOpen(false)}>
          <button className={s.close} onClick={() => setOpen(false)}>✕</button>
          {n > 1 && <button className={s.nav} style={{ left: 20 }} onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>}
          <img className={s.lightImg} src={cur.url} alt={name} onClick={(e) => e.stopPropagation()} />
          {n > 1 && <button className={s.nav} style={{ right: 20 }} onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>}
          <div className={s.lightCount}>
            {cur.kind === 'real' ? `реальное фото${cur.author ? ` · © ${cur.author}` : ''} · 2ГИС` : 'визуализация застройщика · korter'} — {active + 1} / {n}
          </div>
        </div>
      )}
    </>
  );
}
