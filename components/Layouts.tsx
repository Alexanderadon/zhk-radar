'use client';
import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
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
    // фон не должен прокручиваться под лайтбоксом
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, n]);

  const onWheel = (e: React.WheelEvent) => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.15 : 0.87); };
  // Pointer Events вместо Mouse: иначе на телефоне увеличенный чертёж невозможно сдвинуть
  const onDown = (e: React.PointerEvent) => {
    if (scale <= 1) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX - off.x, y: e.clientY - off.y };
  };
  const onMove = (e: React.PointerEvent) => { if (drag.current) setOff({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); };
  const onUp = () => { drag.current = null; };
  // свайп влево/вправо листает планировки, пока не включён зум
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const onSwipeStart = (e: React.PointerEvent) => { if (scale === 1) swipe.current = { x: e.clientX, y: e.clientY }; };
  const onSwipeEnd = (e: React.PointerEvent) => {
    const sw = swipe.current; swipe.current = null;
    if (!sw || scale !== 1 || n < 2) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
  };

  return (
    <>
      <div className={s.grid}>
        {layouts.map((src, i) => (
          <button key={src} className={s.cell} onClick={() => show(i)} aria-label="Открыть планировку">
            <img className={s.img} src={src} alt="планировка" loading="lazy" />
            <span className={s.zoom}><Icon name="maximize" size={14} /></span>
          </button>
        ))}
      </div>

      {open != null && (
        <div className={s.lightbox} onClick={() => setOpen(null)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onPointerLeave={onUp}>
          <button className={s.close} onClick={() => setOpen(null)} aria-label="Закрыть"><Icon name="x" size={22} /></button>
          {n > 1 && <button className={s.nav} style={{ left: 12 }} onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Предыдущая планировка"><Icon name="left" size={26} /></button>}
          <img
            className={`${s.lightImg} ${scale > 1 ? s.lightImgZoomed : ''}`}
            src={layouts[open]}
            alt={`Планировка ${open + 1} из ${n}`}
            style={{ transform: `translate(${off.x}px, ${off.y}px) scale(${scale})`, cursor: scale > 1 ? (drag.current ? 'grabbing' : 'grab') : 'zoom-in' }}
            onClick={(e) => { e.stopPropagation(); if (scale === 1) zoom(1.6); }}
            onWheel={onWheel}
            onPointerDown={(e) => { onDown(e); onSwipeStart(e); }}
            onPointerUp={onSwipeEnd}
            draggable={false}
          />
          {n > 1 && <button className={s.nav} style={{ right: 12 }} onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Следующая планировка"><Icon name="right" size={26} /></button>}
          <div className={s.zoomBar} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => zoom(0.8)} aria-label="Уменьшить">−</button>
            <span>{Math.round(scale * 100)}%</span>
            <button onClick={() => zoom(1.25)} aria-label="Увеличить">+</button>
            {scale !== 1 && <button className={s.resetBtn} onClick={reset}>сброс</button>}
          </div>
          <div className={s.count}>{open + 1} / {n}{n > 1 ? ' · свайп — листать' : ''} · тап — зум</div>
        </div>
      )}
    </>
  );
}
