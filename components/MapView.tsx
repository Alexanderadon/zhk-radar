'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BAND_COLOR, BAND_LABEL } from '../lib/score';

export interface MapPoint {
  id: number;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  band: 'green' | 'amber' | 'red' | 'grey';
  score: number | null;
  priceSqm: number | null;
  priceMin: number | null;
  developer: string | null;
  classRu: string | null;
  statusRu: string | null;
  district: string | null;
  seismic: number | null;
  image: string | null;
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
    if (typeof window !== 'undefined') (window as any)._map = m; // debug/test handle
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16, maxWidth: '272px', className: 'zhk-hover' });

    m.on('load', () => {
      m.addSource('zhk', { type: 'geojson', data: toGeoJSON(points) });
      m.addLayer({
        id: 'zhk-glow', type: 'circle', source: 'zhk',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 20],
          'circle-color': ['get', 'color'], 'circle-opacity': 0.2, 'circle-blur': 0.6,
        },
      });
      m.addLayer({
        id: 'zhk-dot', type: 'circle', source: 'zhk',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 10],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 1.5, 'circle-stroke-color': '#0b0f17',
        },
      });
      m.addLayer({
        id: 'zhk-selected', type: 'circle', source: 'zhk',
        filter: ['==', ['get', 'id'], -1],
        paint: { 'circle-radius': 12, 'circle-color': ['get', 'color'], 'circle-stroke-width': 3, 'circle-stroke-color': '#e7edf5' },
      });
      ready.current = true;

      let hovered: number | null = null;
      const showHover = (e: maplibregl.MapLayerMouseEvent) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        if (p.id === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; }
        hovered = p.id;
        m.getCanvas().style.cursor = 'pointer';
        hover.setLngLat((f.geometry as any).coordinates).setHTML(cardHtml(p)).addTo(m);
      };
      m.on('mouseenter', 'zhk-dot', showHover);
      m.on('mousemove', 'zhk-dot', showHover);
      m.on('mouseleave', 'zhk-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });
      m.on('click', 'zhk-dot', (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as any;
        onSelectRef.current(Number(p.id));
        window.location.href = `/zhk${p.slug}`;
      });
    });

    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m || !ready.current) return;
    const src = m.getSource('zhk') as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(toGeoJSON(points) as any);
  }, [points]);

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
    features: points.filter((p) => p.lat && p.lng).map((p) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        id: p.id, name: p.name, color: BAND_COLOR[p.band], band: p.band,
        score: p.score ?? '', slug: p.slug, priceSqm: p.priceSqm ?? 0, priceMin: p.priceMin ?? 0,
        developer: p.developer ?? '', classRu: p.classRu ?? '', statusRu: p.statusRu ?? '',
        district: p.district ?? '', seismic: p.seismic ?? 0, image: p.image ?? '',
      },
    })),
  };
}

function cardHtml(p: any) {
  const priceSqm = Number(p.priceSqm) ? `${Math.round(Number(p.priceSqm) / 1000).toLocaleString('ru-RU')} тыс ₸/м²` : null;
  const priceMin = Number(p.priceMin) ? `от ${(Number(p.priceMin) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : null;
  const scoreTxt = p.score === '' || p.score == null ? 'мало данных' : `${p.score}`;
  const bandColor = p.color;
  const bandLabel = BAND_LABEL[p.band as keyof typeof BAND_LABEL] || '';
  const chips = [p.classRu, p.statusRu, Number(p.seismic) ? `⛰ ${p.seismic}` : '']
    .filter(Boolean).map((c: string) => `<span style="font-size:11px;padding:2px 7px;border-radius:5px;background:#1b2230;color:#8d97a8">${escapeHtml(c)}</span>`).join('');
  const img = p.image
    ? `<div style="height:118px;background:#1b2230 center/cover no-repeat url('${escapeAttr(p.image)}')"></div>`
    : `<div style="height:60px"></div>`;
  return `<div style="width:260px;font-family:inherit">
    ${img}
    <div style="padding:11px 13px 12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
        <div style="font-weight:650;font-size:14.5px;color:#e7edf5;line-height:1.25">${escapeHtml(p.name)}</div>
        <div style="text-align:center;flex-shrink:0">
          <div style="font-size:20px;font-weight:780;line-height:1;color:${bandColor}">${scoreTxt}</div>
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#5c6576;margin-top:1px">${p.score === '' ? '' : 'балл'}</div>
        </div>
      </div>
      <div style="color:#8d97a8;font-size:12px;margin:3px 0 2px">${escapeHtml(p.developer || '')}${p.district ? ` · ${escapeHtml(p.district)}` : ''}</div>
      <div style="color:${bandColor};font-size:12px;font-weight:600;margin-bottom:8px">${bandLabel}</div>
      ${priceSqm || priceMin ? `<div style="display:flex;gap:10px;align-items:baseline;margin-bottom:8px">
        ${priceSqm ? `<span style="font-size:15px;font-weight:700;color:#e7edf5">${priceSqm}</span>` : ''}
        ${priceMin ? `<span style="font-size:12px;color:#8d97a8">${priceMin}/кв</span>` : ''}
      </div>` : ''}
      <div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div>
      <div style="margin-top:9px;font-size:11px;color:#5c6576">клик → подробно →</div>
    </div>
  </div>`;
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}
function escapeAttr(s: string) {
  return String(s).replace(/'/g, '%27').replace(/"/g, '%22');
}
