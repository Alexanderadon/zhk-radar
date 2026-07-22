'use client';
import { useEffect, useRef, useState } from 'react';
import s from './Layouts.module.scss';

export default function Layouts({ layouts }: { layouts: string[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const [scale, setScale] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const n = layouts.length;

  const reset = () => { setScale(1); setOff({ x: 0, y: 0 }); };
  const show = (i: number) => { setOpen(i); reset(); };
  const step = (d: number) => { if (open == null) return; setOpen((open + d + n) % n); reset(); };
  const zoom = (factor: number) => setScale((s) => Math.min(5, Math.max(1, s * factor)));

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null);
      else if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === '+' || e.key === '=') zoom(1.25);
      else if (e.key === '-') zoom(0.8);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, n]);

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 0.87); };
  const onDown = (e: React.MouseEvent) => { if (scale > 1) drag.current = { x: e.clientX - off.x, y: e.clientY - off.y }; };
  const onMove = (e: React.MouseEvent) => { if (drag.current) setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };

  return (
    <>
      <div className={s.grid}>
        {layouts.map((src, i) => (
          <button key={src} className={s.cell} onClick={() => show(i)} aria-label="Открыть планировку">
            <img className={s.img} src={src} alt="планировка" loading="lazy" />
            <span className={s.zoom}>⤢</span>
          </button>
        ))}
      </div>

      {open != null && (
        <div className={s.lightbox} onClick={() => setOpen(null)} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>
          <button className={s.close} onClick={() => setOpen(null)}>✕</button>
          {n > 1 && <button className={s.nav} style={{ left: 20 }} onClick={(e) => { e.stopPropagation(); step(-1); }}>‹</button>}
          <img
            className={s.lightImg}
            src={layouts[open]}
            alt="планировка"
            style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${scale})`, cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in' }}
            onClick={(e) => { e.stopPropagation(); if (scale === 1) zoom(1.6); }}
            onWheel={onWheel}
            onMouseDown={onDown}
            draggable={false}
          />
          {n > 1 && <button className={s.nav} style={{ right: 20 }} onClick={(e) => { e.stopPropagation(); step(1); }}>›</button>}
          <div className={s.zoomBar} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => zoom(0.8)}>−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => zoom(1.25)}>+</button>
            {scale !== 1 && <button className={s.resetBtn} onClick={reset}>сброс</button>}
          </div>
          <div className={s.count}>{open + 1} / {n} · колесо — зум, тянуть — двигать</div>
        </div>
      )}
    </>
  );
}
