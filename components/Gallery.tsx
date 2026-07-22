'use client';
import { useState } from 'react';
import s from './Gallery.module.scss';

export default function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const list = photos.length ? photos : [];
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  if (!list.length) {
    return <div className={`${s.main} ${s.empty}`}>◫</div>;
  }

  return (
    <>
      <div className={s.wrap}>
        <div className={s.mainWrap} onClick={() => setOpen(true)}>
          <img className={s.main} src={list[active]} alt={name} />
          {list.length > 1 && <div className={s.counter}>{active + 1} / {list.length}</div>}
          <div className={s.zoomHint}>нажмите, чтобы увеличить</div>
        </div>
        {list.length > 1 && (
          <div className={s.thumbs}>
            {list.slice(0, 8).map((src, i) => (
              <button key={src} className={`${s.thumb} ${i === active ? s.thumbActive : ''}`} onClick={() => setActive(i)}>
                <img src={src} alt="" loading="lazy" />
              </button>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className={s.lightbox} onClick={() => setOpen(false)}>
          <button className={s.close} onClick={() => setOpen(false)}>✕</button>
          <button className={s.nav} style={{ left: 20 }} onClick={(e) => { e.stopPropagation(); setActive((active - 1 + list.length) % list.length); }}>‹</button>
          <img className={s.lightImg} src={list[active]} alt={name} onClick={(e) => e.stopPropagation()} />
          <button className={s.nav} style={{ right: 20 }} onClick={(e) => { e.stopPropagation(); setActive((active + 1) % list.length); }}>›</button>
          <div className={s.lightCount}>{active + 1} / {list.length}</div>
        </div>
      )}
    </>
  );
}
