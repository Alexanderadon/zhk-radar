'use client';
import { useEffect, useRef, useState } from 'react';
import s from './Gallery.module.scss';

export default function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const list = photos.length ? photos : [];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const thumbsRef = useRef<HTMLDivElement>(null);
  const n = list.length;

  const go = (d: number) => setActive((a) => (a + d + n) % n);

  // keep active thumbnail in view
  useEffect(() => {
    const strip = thumbsRef.current;
    if (!strip) return;
    const el = strip.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [active]);

  // arrow keys (works for both inline and lightbox)
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
          <img className={s.main} src={list[active]} alt={name} onClick={() => setOpen(true)} />
          {n > 1 && (
            <>
              <button className={`${s.arrow} ${s.arrowL}`} aria-label="Предыдущее фото" onClick={() => go(-1)}>‹</button>
              <button className={`${s.arrow} ${s.arrowR}`} aria-label="Следующее фото" onClick={() => go(1)}>›</button>
              <div className={s.counter}>{active + 1} / {n}</div>
            </>
          )}
          <div className={s.zoomHint} onClick={() => setOpen(true)}>увеличить ⤢</div>
        </div>
        {n > 1 && (
          <div className={s.thumbs} ref={thumbsRef}>
            {list.map((src, i) => (
              <button key={src + i} className={`${s.thumb} ${i === active ? s.thumbActive : ''}`} onClick={() => setActive(i)}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className={s.lightbox} onClick={() => setOpen(false)}>
          <button className={s.close} onClick={() => setOpen(false)}>✕</button>
          {n > 1 && <button className={s.nav} style={{ left: 20 }} onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>}
          <img className={s.lightImg} src={list[active]} alt={name} onClick={(e) => e.stopPropagation()} />
          {n > 1 && <button className={s.nav} style={{ right: 20 }} onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>}
          <div className={s.lightCount}>{active + 1} / {n}</div>
        </div>
      )}
    </>
  );
}
