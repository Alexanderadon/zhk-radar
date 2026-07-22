'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BAND_COLOR, BAND_LABEL } from '../lib/score';

export interface MapPoint {
  id: number; slug: string; name: string; lat: number; lng: number;
  band: 'green' | 'amber' | 'red' | 'grey'; score: number | null;
  priceSqm: number | null; priceMin: number | null; developer: string | null;
  classRu: string | null; statusRu: string | null; district: string | null;
  seismic: number | null; image: string | null; real: boolean; deal: boolean;
}

export interface Apt {
  id: number; lat: number; lng: number; price: number | null; rooms: number | null;
  square: number | null; floor: string | null; addr: string | null;
  complexId: number | null; market: 'primary' | 'secondary'; photo: string | null; district?: string | null;
}

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const ALMATY: [number, number] = [76.905, 43.238];

export default function MapView({
  points, selectedId, onSelect, activeDistrict,
  mode = 'complexes', aptMarket, aptRooms, showSold, aptPrice,
}: {
  points: MapPoint[]; selectedId: number | null; onSelect: (id: number) => void; activeDistrict?: string | null;
  mode?: 'complexes' | 'apartments'; aptMarket?: Set<string>; aptRooms?: Set<number>; showSold?: boolean; aptPrice?: { min: number; max: number } | null;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const allApts = useRef<Apt[] | null>(null);
  const loadingApts = useRef(false);
  const allSold = useRef<any[] | null>(null);
  const applyModeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (map.current || !container.current) return;
    const m = new maplibregl.Map({ container: container.current, style: STYLE, center: ALMATY, zoom: 11, attributionControl: { compact: true } });
    map.current = m;
    if (typeof window !== 'undefined') (window as any)._map = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    const hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 16, maxWidth: '272px', className: 'zhk-hover' });

    m.on('load', async () => {
      try {
        const districts = await (await fetch('/districts.geojson')).json();
        m.addSource('districts', { type: 'geojson', data: districts });
        m.addLayer({ id: 'district-fill', type: 'fill', source: 'districts', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['case', ['==', ['get', 'name'], activeDistrict ?? '__none__'], 0.28, 0.1] } } as any);
        m.addLayer({ id: 'district-line', type: 'line', source: 'districts', paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-opacity': 0.7 } });
        m.addLayer({ id: 'district-label', type: 'symbol', source: 'districts', layout: { 'text-field': ['get', 'name'], 'text-size': 15, 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': true, 'text-ignore-placement': true }, paint: { 'text-color': ['get', 'color'], 'text-halo-color': '#ffffff', 'text-halo-width': 2, 'text-opacity': 0.95 } });
      } catch {}

      // ---- LANDMARKS (ориентиры: ТРЦ, вокзалы, площади) ----
      try {
        const lm = await (await fetch('/landmarks.geojson')).json();
        m.addSource('landmarks', { type: 'geojson', data: lm });
        m.addLayer({ id: 'landmark-dot', type: 'circle', source: 'landmarks', paint: { 'circle-radius': ['match', ['get', 'kind'], 'mall', 6, 4.5], 'circle-color': ['match', ['get', 'kind'], 'mall', '#111827', '#374151'], 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });
        m.addLayer({ id: 'landmark-label', type: 'symbol', source: 'landmarks', minzoom: 10.5, layout: { 'text-field': ['get', 'name'], 'text-size': 11.5, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.05], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': '#111827', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      } catch {}

      // ---- COMPLEXES (ЖК) ----
      m.addSource('zhk', { type: 'geojson', data: toGeoJSON(points), cluster: true, clusterMaxZoom: 13, clusterRadius: 52 });
      const notCluster = ['!', ['has', 'point_count']] as any;
      m.addLayer({ id: 'clusters', type: 'circle', source: 'zhk', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#4a9eff', 30, '#3a86e0', 120, '#2b6cb0'], 'circle-opacity': 0.92, 'circle-radius': ['step', ['get', 'point_count'], 15, 15, 20, 50, 26, 150, 34], 'circle-stroke-width': 4, 'circle-stroke-color': 'rgba(74,158,255,0.25)' } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'zhk', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({ id: 'zhk-glow', type: 'circle', source: 'zhk', filter: notCluster, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 20], 'circle-color': ['get', 'color'], 'circle-opacity': 0.22, 'circle-blur': 0.6 } });
      m.addLayer({ id: 'zhk-dot', type: 'circle', source: 'zhk', filter: notCluster, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 10], 'circle-color': ['get', 'color'], 'circle-stroke-width': ['case', ['get', 'deal'], 3, 1.6], 'circle-stroke-color': ['case', ['get', 'deal'], '#16a34a', '#ffffff'] } });
      m.addLayer({ id: 'zhk-selected', type: 'circle', source: 'zhk', filter: ['==', ['get', 'id'], -1], paint: { 'circle-radius': 12, 'circle-color': ['get', 'color'], 'circle-stroke-width': 3.5, 'circle-stroke-color': '#2f6bed' } });

      // ---- APARTMENTS (квартиры) — heatmap на обзоре, точки на приближении ----
      m.addSource('apt', { type: 'geojson', data: emptyFC() });
      m.addLayer({
        id: 'apt-heat', type: 'heatmap', source: 'apt', layout: { visibility: 'none' },
        paint: {
          'heatmap-weight': 0.25,
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.18, 14, 0.6],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 8, 12, 14, 14, 20],
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'],
            0, 'rgba(59,130,246,0)', 0.15, 'rgba(59,130,246,0.35)', 0.35, 'rgba(34,197,94,0.5)',
            0.55, 'rgba(234,179,8,0.6)', 0.75, 'rgba(249,115,22,0.72)', 1, 'rgba(224,41,63,0.82)'],
          'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.72, 14.5, 0],
        },
      });
      m.addLayer({
        id: 'apt-dot', type: 'circle', source: 'apt', layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 3, 17, 8],
          'circle-color': ['match', ['get', 'market'], 'primary', '#16a34a', '#6b8bb0'],
          'circle-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0.15, 14.5, 0.95],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 13, 0, 15, 1.3],
          'circle-stroke-color': '#ffffff',
        },
      });
      // ---- SOLD (недавно продано) ----
      m.addSource('sold', { type: 'geojson', data: emptyFC() });
      m.addLayer({ id: 'sold-dot', type: 'circle', source: 'sold', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9], 'circle-color': '#e74c3c', 'circle-opacity': 0.85, 'circle-stroke-width': 1.4, 'circle-stroke-color': '#ffffff' } });
      ready.current = true;

      // complex handlers
      m.on('click', 'clusters', (e) => { const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]; if (!f) return; (m.getSource('zhk') as any).getClusterExpansionZoom((f.properties as any).cluster_id).then((z: number) => m.easeTo({ center: (f.geometry as any).coordinates, zoom: Math.min(z + 0.5, 16) })).catch(() => {}); });
      m.on('mouseenter', 'clusters', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'clusters', () => (m.getCanvas().style.cursor = ''));

      let hovered: any = null;
      const hoverZhk = (e: maplibregl.MapLayerMouseEvent) => { const f = e.features?.[0]; if (!f) return; const p = f.properties as any; if (('z' + p.id) === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; } hovered = 'z' + p.id; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(cardHtml(p)).addTo(m); };
      m.on('mouseenter', 'zhk-dot', hoverZhk); m.on('mousemove', 'zhk-dot', hoverZhk);
      m.on('mouseleave', 'zhk-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });
      m.on('click', 'zhk-dot', (e) => { const f = e.features?.[0]; if (!f) return; const p = f.properties as any; onSelectRef.current(Number(p.id)); window.location.href = `/zhk${p.slug}`; });

      const hoverApt = (e: maplibregl.MapLayerMouseEvent) => { const f = e.features?.[0]; if (!f) return; const p = f.properties as any; if (('a' + p.id) === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; } hovered = 'a' + p.id; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(aptHtml(p)).addTo(m); };
      m.on('mouseenter', 'apt-dot', hoverApt); m.on('mousemove', 'apt-dot', hoverApt);
      m.on('mouseleave', 'apt-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });
      m.on('click', 'apt-dot', (e) => { const f = e.features?.[0]; if (!f) return; window.open(`https://krisha.kz/a/show/${(f.properties as any).id}`, '_blank'); });

      const hoverSold = (e: maplibregl.MapLayerMouseEvent) => { const f = e.features?.[0]; if (!f) return; const p = f.properties as any; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(soldHtml(p)).addTo(m); };
      m.on('mouseenter', 'sold-dot', hoverSold); m.on('mousemove', 'sold-dot', hoverSold);
      m.on('mouseleave', 'sold-dot', () => { m.getCanvas().style.cursor = ''; hover.remove(); });

      applyModeRef.current();
    });

    return () => { m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setVis(m: maplibregl.Map, layers: string[], v: 'visible' | 'none') { for (const l of layers) if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', v); }
  const COMPLEX_LAYERS = ['clusters', 'cluster-count', 'zhk-glow', 'zhk-dot', 'zhk-selected'];
  const APT_LAYERS = ['apt-heat', 'apt-dot'];

  function filteredApts(): Apt[] {
    const all = allApts.current || [];
    return all.filter((a) => {
      if (aptMarket && aptMarket.size && !aptMarket.has(a.market)) return false;
      if (aptRooms && aptRooms.size && !(a.rooms && aptRooms.has(Math.min(a.rooms, 4)))) return false;
      if (aptPrice && !(a.price && a.price >= aptPrice.min && a.price < aptPrice.max)) return false;
      if (activeDistrict && a.district !== activeDistrict) return false;
      return true;
    });
  }

  async function applyMode() {
    const m = map.current; if (!m || !ready.current) return;
    if (mode === 'apartments') {
      setVis(m, COMPLEX_LAYERS, 'none');
      if (!allApts.current && !loadingApts.current) {
        loadingApts.current = true;
        try { allApts.current = await (await fetch('/listings.json')).json(); } catch { allApts.current = []; }
        loadingApts.current = false;
      }
      const src = m.getSource('apt') as maplibregl.GeoJSONSource | undefined;
      if (src) src.setData(aptFC(filteredApts()) as any);
      setVis(m, APT_LAYERS, 'visible');
      // sold layer
      if (showSold) {
        if (!allSold.current) { try { allSold.current = await (await fetch('/listings-sold.json')).json(); } catch { allSold.current = []; } }
        const ss = m.getSource('sold') as maplibregl.GeoJSONSource | undefined;
        if (ss) ss.setData(soldFC(allSold.current || []) as any);
        setVis(m, ['sold-dot'], 'visible');
      } else setVis(m, ['sold-dot'], 'none');
    } else {
      setVis(m, [...APT_LAYERS, 'sold-dot'], 'none');
      setVis(m, COMPLEX_LAYERS, 'visible');
    }
  }

  applyModeRef.current = applyMode;
  useEffect(() => { applyMode(); /* eslint-disable-next-line */ }, [mode, aptMarket, aptRooms, showSold, aptPrice, activeDistrict]);
  useEffect(() => { const m = map.current; if (!m || !ready.current) return; const src = m.getSource('zhk') as maplibregl.GeoJSONSource | undefined; if (src) src.setData(toGeoJSON(points) as any); }, [points]);
  useEffect(() => { const m = map.current; if (!m || !ready.current) return; if (m.getLayer('district-fill')) m.setPaintProperty('district-fill', 'fill-opacity', ['case', ['==', ['get', 'name'], activeDistrict ?? '__none__'], 0.28, 0.1] as any); }, [activeDistrict]);
  useEffect(() => { const m = map.current; if (!m || !ready.current) return; m.setFilter('zhk-selected', ['==', ['get', 'id'], selectedId ?? -1]); if (selectedId != null) { const p = points.find((x) => x.id === selectedId); if (p) m.flyTo({ center: [p.lng, p.lat], zoom: Math.max(m.getZoom(), 13.5), speed: 0.8 }); } }, [selectedId, points]);

  return <div ref={container} style={{ position: 'absolute', inset: 0 }} />;
}

function emptyFC() { return { type: 'FeatureCollection', features: [] }; }
function soldFC(sold: any[]) {
  return { type: 'FeatureCollection', features: sold.filter((a) => a.lat && a.lng).map((a) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { id: a.id, price: a.price ?? 0, rooms: a.rooms ?? 0, square: a.square ?? 0, addr: a.addr ?? '', soldDate: a.soldDate ?? '', market: a.market ?? '' } })) };
}
function soldHtml(p: any) {
  const price = Number(p.price) ? `${(Number(p.price) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : '';
  const line = [Number(p.rooms) ? `${p.rooms}-комн.` : '', Number(p.square) ? `${p.square} м²` : ''].filter(Boolean).join(' · ');
  return `<div style="width:230px;font-family:inherit;padding:11px 13px 12px">
    <div style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#e0293f;padding:2px 8px;border-radius:6px;margin-bottom:7px">продано${p.soldDate ? ` · ${p.soldDate}` : ''}</div>
    <div style="font-size:16px;font-weight:750;color:#14181f;letter-spacing:-.01em">${price}</div>
    <div style="font-size:12.5px;color:#5b6472;margin:2px 0 3px">${line}</div>
    <div style="font-size:12px;color:#97a0ad">${escapeHtml(p.addr || '')}</div>
  </div>`;
}
function aptFC(apts: Apt[]) {
  return { type: 'FeatureCollection', features: apts.filter((a) => a.lat && a.lng).map((a) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { id: a.id, price: a.price ?? 0, rooms: a.rooms ?? 0, square: a.square ?? 0, floor: a.floor ?? '', addr: a.addr ?? '', market: a.market, photo: a.photo ?? '' } })) };
}
function toGeoJSON(points: MapPoint[]) {
  return { type: 'FeatureCollection', features: points.filter((p) => p.lat && p.lng).map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, color: BAND_COLOR[p.band], band: p.band, score: p.score ?? '', slug: p.slug, priceSqm: p.priceSqm ?? 0, priceMin: p.priceMin ?? 0, developer: p.developer ?? '', classRu: p.classRu ?? '', statusRu: p.statusRu ?? '', district: p.district ?? '', seismic: p.seismic ?? 0, image: p.image ?? '', real: !!p.real, deal: !!p.deal } })) };
}

function aptHtml(p: any) {
  const price = Number(p.price) ? `${(Number(p.price) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : 'цена не указана';
  const line = [Number(p.rooms) ? `${p.rooms}-комн.` : '', Number(p.square) ? `${p.square} м²` : '', p.floor ? `${p.floor} эт.` : ''].filter(Boolean).join(' · ');
  const mk = p.market === 'primary' ? '<span style="color:#16a34a;font-weight:600">новостройка</span>' : '<span style="color:#6b7480;font-weight:600">вторичка</span>';
  const img = (p.photo && p.photo !== '') ? `<div style="height:118px;background:#eef1f4 center/cover no-repeat url('${escapeAttr(p.photo)}')"></div>` : '';
  return `<div style="width:242px;font-family:inherit">${img}<div style="padding:11px 13px 12px">
    <div style="font-size:18px;font-weight:770;color:#14181f;letter-spacing:-.01em">${price}</div>
    <div style="font-size:12.5px;color:#5b6472;margin:3px 0 4px">${line}</div>
    <div style="font-size:12px;color:#97a0ad">${escapeHtml(p.addr || '')}</div>
    <div style="font-size:11.5px;margin-top:7px">${mk} <span style="color:#b3bbc6">·</span> <span style="color:#2f6bed;font-weight:600">открыть на krisha ↗</span></div>
  </div></div>`;
}
function cardHtml(p: any) {
  const priceMin = Number(p.priceMin) ? `от ${(Number(p.priceMin) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : null;
  const priceSqm = Number(p.priceSqm) ? `${Math.round(Number(p.priceSqm) / 1000).toLocaleString('ru-RU')} тыс ₸/м²` : null;
  const scoreTxt = p.score === '' || p.score == null ? 'мало данных' : `${p.score}`;
  const bandColor = p.color, bandLabel = BAND_LABEL[p.band as keyof typeof BAND_LABEL] || '';
  const chips = [p.classRu, p.statusRu, p.district ? p.district + ' р-н' : '', Number(p.seismic) ? `${p.seismic} балл` : ''].filter(Boolean).map((c: string) => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#f1f4f7;color:#5b6472">${escapeHtml(c)}</span>`).join('');
  const img = (p.image && p.image !== '') ? `<div style="height:120px;background:#eef1f4 center/cover no-repeat url('${escapeAttr(p.image)}')"></div>` : `<div style="height:44px"></div>`;
  const flag = p.deal === true || p.deal === 'true';
  return `<div style="width:262px;font-family:inherit">${img}<div style="padding:11px 13px 12px">
    ${flag ? '<div style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#16a34a;padding:2px 9px;border-radius:6px;margin-bottom:7px">Выгодно</div>' : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div style="font-weight:680;font-size:14.5px;color:#14181f;line-height:1.25">${escapeHtml(p.name)}</div><div style="text-align:center;flex-shrink:0"><div style="font-size:21px;font-weight:800;line-height:1;color:${bandColor}">${scoreTxt}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#97a0ad;margin-top:1px">${p.score === '' ? '' : 'защита'}</div></div></div>
    <div style="color:#5b6472;font-size:12px;margin:3px 0 3px">${escapeHtml(p.developer || '')}</div>
    <div style="color:${bandColor};font-size:12px;font-weight:650;margin-bottom:9px">${bandLabel}</div>
    ${priceMin || priceSqm ? `<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:9px">${priceMin ? `<span style="font-size:16px;font-weight:770;color:#14181f;letter-spacing:-.01em">${priceMin}</span>` : ''}${priceSqm ? `<span style="font-size:12px;color:#97a0ad">${priceSqm}</span>` : ''}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div>
    <div style="margin-top:9px;font-size:11px;color:#2f6bed;font-weight:600">Подробно →</div>
  </div></div>`;
}
function escapeHtml(s: string) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
function escapeAttr(s: string) { return String(s).replace(/'/g, '%27').replace(/"/g, '%22'); }
