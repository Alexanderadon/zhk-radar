'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BAND_COLOR } from '../lib/score';

export interface MapPoint {
  id: number;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  band: 'green' | 'amber' | 'red' | 'grey';
  score: number | null;
  priceSqm: number | null;
  developer: string | null;
}

const STYLE = 'https://tiles.openfreemap.org/styles/dark';
const ALMATY: [number, number] = [76.905, 43.238];

export default function MapView({
  points,
  selectedId,
  onSelect,
}: {
  points: MapPoint[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // init once
  useEffect(() => {
    if (map.current || !container.current) return;
    const m = new maplibregl.Map({
      container: container.current,
      style: STYLE,
      center: ALMATY,
      zoom: 11,
      attributionControl: { compact: true },
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    m.on('load', () => {
      m.addSource('zhk', { type: 'geojson', data: toGeoJSON(points) });
      m.addLayer({
        id: 'zhk-glow',
        type: 'circle',
        source: 'zhk',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 15, 16],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.18,
          'circle-blur': 0.6,
        },
      });
      m.addLayer({
        id: 'zhk-dot',
        type: 'circle',
        source: 'zhk',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 15, 8],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#0b0f17',
        },
      });
      m.addLayer({
        id: 'zhk-selected',
        type: 'circle',
        source: 'zhk',
        filter: ['==', ['get', 'id'], -1],
        paint: {
          'circle-radius': 11,
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 3,
          'circle-stroke-color': '#e7edf5',
        },
      });
      ready.current = true;

      const popup = new maplibregl.Popup({ closeButton: true, offset: 14, maxWidth: '260px' });
      m.on('click', 'zhk-dot', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        onSelectRef.current(Number(p.id));
        popup
          .setLngLat((f.geometry as any).coordinates)
          .setHTML(popupHtml(p))
          .addTo(m);
      });
      m.on('mouseenter', 'zhk-dot', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'zhk-dot', () => (m.getCanvas().style.cursor = ''));
    });

    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update data when points change
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const src = m.getSource('zhk') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(toGeoJSON(points) as any);
  }, [points]);

  // highlight + fly to selected
  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    m.setFilter('zhk-selected', ['==', ['get', 'id'], selectedId ?? -1]);
    if (selectedId != null) {
      const p = points.find((x) => x.id === selectedId);
      if (p) m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 13.5), speed: 0.8 });
    }
  }, [selectedId, points]);

  return <div ref={container} style={{ position: 'absolute', inset: 0 }} />;
}

function toGeoJSON(points: MapPoint[]) {
  return {
    type: 'FeatureCollection',
    features: points
      .filter((p) => p.lat && p.lng)
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { id: p.id, name: p.name, color: BAND_COLOR[p.band], score: p.score ?? '—', slug: p.slug, priceSqm: p.priceSqm ?? 0, developer: p.developer ?? '' },
      })),
  };
}

function popupHtml(p: any) {
  const price = Number(p.priceSqm) ? `${(Number(p.priceSqm) / 1000).toLocaleString('ru-RU')} тыс ₸/м²` : 'цена не указана';
  const score = p.score === '—' || p.score == null ? 'мало данных' : `риск-балл ${p.score}`;
  return `<a href="/zhk${p.slug}" style="display:block;padding:12px 14px;">
    <div style="font-weight:650;font-size:14px;margin-bottom:4px;color:#e7edf5">${escapeHtml(p.name)}</div>
    <div style="color:#8d97a8;font-size:12.5px;margin-bottom:6px">${escapeHtml(p.developer || '')}</div>
    <div style="display:flex;gap:10px;font-size:12.5px;color:#c7d0dd"><span>${score}</span><span>·</span><span>${price}</span></div>
  </a>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
