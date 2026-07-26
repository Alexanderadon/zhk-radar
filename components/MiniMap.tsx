'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';

export default function MiniMap({ lat, lng, color, name }: { lat: number; lng: number; color: string; name: string }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (map.current || !container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: [lng, lat],
      zoom: 15,
      attributionControl: { compact: true },
      interactive: true,
      // без этого свайп по карте внутри страницы двигает карту, а не страницу —
      // пользователь «залипает» и не может доскроллить дальше
      cooperativeGestures: true,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.touchZoomRotate.disableRotation();
    m.touchPitch.disable();
    m.on('load', () => {
      m.addSource('pt', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} } as any });
      m.addLayer({ id: 'glow', type: 'circle', source: 'pt', paint: { 'circle-radius': 26, 'circle-color': color, 'circle-opacity': 0.18, 'circle-blur': 0.7 } });
      m.addLayer({ id: 'dot', type: 'circle', source: 'pt', paint: { 'circle-radius': 9, 'circle-color': color, 'circle-stroke-width': 3, 'circle-stroke-color': '#e7edf5' } });
    });
    return () => { m.remove(); map.current = null; };
  }, [lat, lng, color, name]);

  return <div ref={container} style={{ position: 'absolute', inset: 0 }} />;
}
