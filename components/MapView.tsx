'use client';
import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BAND_COLOR, BAND_TEXT, BAND_LABEL } from '../lib/score';

export interface MapPoint {
  id: number; slug: string; name: string; lat: number; lng: number;
  band: 'green' | 'amber' | 'red' | 'grey'; score: number | null;
  priceSqm: number | null; priceMin: number | null; developer: string | null;
  classRu: string | null; statusRu: string | null; district: string | null;
  seismic: number | null; image: string | null; real: boolean; deal: boolean;
}

/** Что показать в карточке после тапа по карте (на тач-устройствах вместо hover-попапа). */
export type MapDetail =
  | { kind: 'zhk'; id: number; slug: string; name: string }
  | { kind: 'apt'; id: number; price: number | null; rooms: number | null; square: number | null; floor: string | null; addr: string | null; market: 'primary' | 'secondary'; photo: string | null }
  | { kind: 'landmark'; name: string; kindRu: string | null; rating: number | null; photo: string | null }
  | { kind: 'sold'; price: number | null; rooms: number | null; square: number | null; addr: string | null }
  | { kind: 'fault'; name: string; mw: number | null; lenKm: number | null; src: string; note: string | null };

export interface Apt {
  id: number; lat: number; lng: number; price: number | null; rooms: number | null;
  square: number | null; floor: string | null; addr: string | null;
  complexId: number | null; market: 'primary' | 'secondary'; photo: string | null; district?: string | null;
}

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const ALMATY: [number, number] = [76.905, 43.238];

export default function MapView({
  points, selectedId, onSelect, activeDistrict,
  mode = 'complexes', aptMarket, aptRooms, showSold, aptPrice, favSet, onToggleFav, touchMode = false, onDetail, showFaults = false,
}: {
  points: MapPoint[]; selectedId: number | null; onSelect: (id: number) => void; activeDistrict?: string | null;
  mode?: 'complexes' | 'apartments'; aptMarket?: Set<string>; aptRooms?: Set<number>; showSold?: boolean; aptPrice?: { min: number; max: number } | null;
  favSet?: Set<number>; onToggleFav?: (id: number) => void;
  /** На тач-устройствах тап по метке не «телепортирует», а открывает карточку в шторке. */
  touchMode?: boolean; onDetail?: (d: MapDetail | null) => void;
  /** Слой тектонических разломов поверх карты. */
  showFaults?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ready = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const favSetRef = useRef<Set<number> | undefined>(favSet);
  favSetRef.current = favSet;
  const onToggleFavRef = useRef<((id: number) => void) | undefined>(onToggleFav);
  onToggleFavRef.current = onToggleFav;
  const touchModeRef = useRef(touchMode);
  touchModeRef.current = touchMode;
  const onDetailRef = useRef<((d: MapDetail | null) => void) | undefined>(onDetail);
  onDetailRef.current = onDetail;
  const allApts = useRef<Apt[] | null>(null);
  const loadingApts = useRef(false);
  const allSold = useRef<any[] | null>(null);
  const applyModeRef = useRef<() => void>(() => {});
  const navCleanup = useRef<() => void>(() => {});

  useEffect(() => {
    if (map.current || !container.current) return;
    const m = new maplibregl.Map({ container: container.current, style: STYLE, center: ALMATY, zoom: 11, attributionControl: false });
    map.current = m;
    if (typeof window !== 'undefined') (window as any)._map = m;
    // На узком экране низ занят шторкой, поэтому зум уезжает вправо-вверх,
    // а копирайт — влево-вниз (иначе оба оказываются под шторкой).
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // Угол зависит от ширины, поэтому переезжает при повороте экрана —
    // иначе после поворота планшета кнопки остаются не на месте.
    const mq = window.matchMedia('(max-width: 900px)');
    let nav: maplibregl.NavigationControl | null = null;
    const placeNav = () => {
      if (nav) m.removeControl(nav);
      nav = new maplibregl.NavigationControl({ showCompass: false });
      m.addControl(nav, mq.matches ? 'top-right' : 'bottom-right');
    };
    placeNav();
    mq.addEventListener('change', placeNav);
    navCleanup.current = () => { mq.removeEventListener('change', placeNav); nav = null; };
    // компаса нет, поэтому случайный поворот/наклон пальцами было бы нечем вернуть
    m.touchZoomRotate.disableRotation();
    m.touchPitch.disable();
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
        const lmColor = ['match', ['get', 'kind'], 'mall', '#111827', 'park', '#15803d', 'water', '#0891b2', 'transport', '#b45309', '#374151'] as any;
        m.addLayer({ id: 'landmark-dot', type: 'circle', source: 'landmarks', paint: { 'circle-radius': ['match', ['get', 'kind'], 'mall', 6, 'park', 5.5, 5], 'circle-color': lmColor, 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' } });
        m.addLayer({ id: 'landmark-label', type: 'symbol', source: 'landmarks', minzoom: 10.5, layout: { 'text-field': ['get', 'name'], 'text-size': 11.5, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.05], 'text-anchor': 'top', 'text-optional': true }, paint: { 'text-color': lmColor, 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
      } catch {}

      // ---- ТЕКТОНИЧЕСКИЕ РАЗЛОМЫ (включаются тумблером) ----
      // Источник: GEM Global Active Faults (CC BY-SA). Масштаб РЕГИОНАЛЬНЫЙ —
      // это не городская карта сейсмомикрорайонирования с 27 разломами и зонами 300 м.
      try {
        const fl = await (await fetch('/faults.geojson')).json();
        m.addSource('faults', { type: 'geojson', data: fl });
        m.addLayer({
          id: 'faults-halo', type: 'line', source: 'faults', filter: ['==', ['get', 'src'], 'jica'],
          layout: { visibility: 'none', 'line-cap': 'round' },
          paint: { 'line-color': '#b91c1c', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 10, 14, 26], 'line-opacity': 0.14, 'line-blur': 4 },
        });
        // Региональные активные разломы GEM — тонким пунктиром (фон)
        m.addLayer({
          id: 'faults-line', type: 'line', source: 'faults', filter: ['==', ['get', 'src'], 'gem'],
          layout: { visibility: 'none', 'line-cap': 'round' },
          paint: { 'line-color': '#9a3412', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.4, 14, 2.6], 'line-dasharray': [3, 2], 'line-opacity': 0.75 },
        });
        // Городская сеть разломов (Frontiers 2024, CC BY) — то, что проходит по самому городу
        m.addLayer({
          id: 'faults-city', type: 'line', source: 'faults', filter: ['==', ['get', 'src'], 'city'],
          layout: { visibility: 'none', 'line-cap': 'round' },
          paint: { 'line-color': '#c2410c', 'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.2, 15, 3 ], 'line-dasharray': [2.5, 1.5], 'line-opacity': 0.85 },
        });
        // Очаги исторических землетрясений (JICA) — сплошным, они важнее
        m.addLayer({
          id: 'faults-jica', type: 'line', source: 'faults', filter: ['==', ['get', 'src'], 'jica'],
          layout: { visibility: 'none', 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#b91c1c', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 3, 14, 6], 'line-opacity': 0.95 },
        });
        m.addLayer({
          id: 'faults-label', type: 'symbol', source: 'faults', filter: ['==', ['get', 'src'], 'jica'],
          layout: { visibility: 'none', 'symbol-placement': 'line-center', 'text-field': ['get', 'name'], 'text-size': 11.5, 'text-font': ['Noto Sans Regular'], 'text-offset': [0, 1.1] },
          paint: { 'text-color': '#7f1d1d', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
        });
      } catch {}

      // «пилюля» под ценники — нужна и для ЖК, и для квартир, поэтому создаём до слоёв
      try { if (!m.hasImage('price-pill')) m.addImage('price-pill', makePricePill(), { pixelRatio: 2, stretchX: [[16, 112]], stretchY: [[12, 32]], content: [14, 8, 114, 36] }); } catch {}

      // ---- COMPLEXES (ЖК) ----
      m.addSource('zhk', { type: 'geojson', data: toGeoJSON(points) as any, cluster: true, clusterMaxZoom: 13, clusterRadius: 52 });
      const notCluster = ['!', ['has', 'point_count']] as any;
      m.addLayer({ id: 'clusters', type: 'circle', source: 'zhk', filter: ['has', 'point_count'], paint: { 'circle-color': ['step', ['get', 'point_count'], '#4a9eff', 30, '#3a86e0', 120, '#2b6cb0'], 'circle-opacity': 0.92, 'circle-radius': ['step', ['get', 'point_count'], 15, 15, 20, 50, 26, 150, 34], 'circle-stroke-width': 4, 'circle-stroke-color': 'rgba(74,158,255,0.25)' } });
      m.addLayer({ id: 'cluster-count', type: 'symbol', source: 'zhk', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({ id: 'zhk-glow', type: 'circle', source: 'zhk', filter: notCluster, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 20], 'circle-color': ['get', 'color'], 'circle-opacity': 0.22, 'circle-blur': 0.6 } });
      m.addLayer({ id: 'zhk-dot', type: 'circle', source: 'zhk', filter: notCluster, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 6, 15, 10], 'circle-color': ['get', 'color'], 'circle-stroke-width': ['case', ['get', 'deal'], 3, 1.6], 'circle-stroke-color': ['case', ['get', 'deal'], '#16a34a', '#ffffff'] } });
      // Ценники ЖК: при приближении вместо «точка + наведение» видно сами цены.
      // Коллизия выключена — все ценники видны сразу (как у квартир).
      m.addLayer({
        id: 'zhk-price', type: 'symbol', source: 'zhk', filter: notCluster, minzoom: 12.5,
        layout: {
          'icon-image': 'price-pill', 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 5, 1, 5],
          'text-field': ['get', 'priceLabel'], 'text-size': 10.5, 'text-font': ['Noto Sans Regular'],
          'text-offset': [0, -1.7], 'text-anchor': 'center',
          'text-allow-overlap': true, 'icon-allow-overlap': true, 'text-ignore-placement': true, 'icon-ignore-placement': true,
          'symbol-sort-key': ['-', 200, ['/', ['get', 'priceMin'], 1000000]],
        },
        paint: { 'text-color': ['get', 'textColor'] },
      });
      m.addLayer({ id: 'zhk-selected', type: 'circle', source: 'zhk', filter: ['==', ['get', 'id'], -1], paint: { 'circle-radius': 12, 'circle-color': ['get', 'color'], 'circle-stroke-width': 3.5, 'circle-stroke-color': '#2f6bed' } });
      m.addLayer({ id: 'zhk-fav', type: 'circle', source: 'zhk', filter: ['in', ['get', 'id'], ['literal', []]] as any, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 14], 'circle-color': 'rgba(224,41,63,0)', 'circle-stroke-width': 2.6, 'circle-stroke-color': '#e0293f', 'circle-stroke-opacity': 0.92 } });

      // ---- APARTMENTS (квартиры) — кластеры на обзоре, отдельные квартиры при приближении ----
      m.addSource('apt', { type: 'geojson', data: emptyFC() as any, cluster: true, clusterMaxZoom: 15, clusterRadius: 50 });
      const aptNotCluster = ['!', ['has', 'point_count']] as any;
      m.addLayer({
        id: 'apt-cluster', type: 'circle', source: 'apt', filter: ['has', 'point_count'], layout: { visibility: 'none' },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], '#8fb8f2', 50, '#5f95e3', 300, '#3d74cc', 1500, '#265aa8'],
          'circle-opacity': 0.92,
          'circle-radius': ['step', ['get', 'point_count'], 15, 50, 19, 300, 25, 1500, 33],
          'circle-stroke-width': 3.5, 'circle-stroke-color': 'rgba(95,149,227,0.22)',
        },
      });
      m.addLayer({ id: 'apt-cluster-count', type: 'symbol', source: 'apt', filter: ['has', 'point_count'], layout: { visibility: 'none', 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12.5, 'text-font': ['Noto Sans Regular'] }, paint: { 'text-color': '#ffffff' } });
      m.addLayer({
        id: 'apt-dot', type: 'circle', source: 'apt', filter: aptNotCluster, layout: { visibility: 'none' },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 4, 17, 8.5],
          'circle-color': ['match', ['get', 'market'], 'primary', '#16a34a', '#6b8bb0'],
          'circle-opacity': 0.92,
          'circle-stroke-width': 1.4, 'circle-stroke-color': '#ffffff',
        },
      });
      // ценник-пилюля прямо на карте (видно цену сразу, без наведения); коллизия прячет наложения
      m.addLayer({
        id: 'apt-price', type: 'symbol', source: 'apt', filter: aptNotCluster, minzoom: 14, layout: {
          visibility: 'none',
          'icon-image': 'price-pill', 'icon-text-fit': 'both', 'icon-text-fit-padding': [1, 5, 1, 5],
          'text-field': ['get', 'priceLabel'], 'text-size': 10.5, 'text-font': ['Noto Sans Regular'],
          'text-offset': [0, -1.5], 'text-anchor': 'center',
          // все ценники всегда видны — коллизию отключаем (юзер не будет наводить/зумить каждую точку)
          'text-allow-overlap': true, 'icon-allow-overlap': true, 'text-ignore-placement': true, 'icon-ignore-placement': true,
          'symbol-sort-key': ['-', 200, ['/', ['get', 'price'], 1000000]],
        },
        paint: { 'text-color': ['match', ['get', 'market'], 'primary', '#15803d', '#334155'] },
      });
      // ---- SOLD (недавно продано) ----
      m.addSource('sold', { type: 'geojson', data: emptyFC() as any });
      m.addLayer({ id: 'sold-dot', type: 'circle', source: 'sold', layout: { visibility: 'none' }, paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 16, 9], 'circle-color': '#e74c3c', 'circle-opacity': 0.85, 'circle-stroke-width': 1.4, 'circle-stroke-color': '#ffffff' } });
      ready.current = true;

      // complex handlers
      // на тач кластеры разбирает делегированный обработчик — иначе easeTo сработает дважды
      m.on('click', 'clusters', (e) => { if (touchModeRef.current) return; const f = m.queryRenderedFeatures(e.point, { layers: ['clusters'] })[0]; if (!f) return; (m.getSource('zhk') as any).getClusterExpansionZoom((f.properties as any).cluster_id).then((z: number) => m.easeTo({ center: (f.geometry as any).coordinates, zoom: Math.min(z + 0.5, 16) })).catch(() => {}); });
      m.on('mouseenter', 'clusters', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'clusters', () => (m.getCanvas().style.cursor = ''));

      let hovered: any = null;
      const hoverZhk = (e: maplibregl.MapLayerMouseEvent) => { if (touchModeRef.current) return; const f = e.features?.[0]; if (!f) return; const p = f.properties as any; if (('z' + p.id) === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; } hovered = 'z' + p.id; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(cardHtml(p, !!favSetRef.current?.has(Number(p.id)))).addTo(m); };
      m.on('mouseenter', 'zhk-dot', hoverZhk); m.on('mousemove', 'zhk-dot', hoverZhk);
      m.on('mouseleave', 'zhk-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });
      // на тач весь разбор клика делает делегированный обработчик ниже (с увеличенной зоной попадания)
      m.on('click', 'zhk-dot', (e) => {
        if (touchModeRef.current) return;
        const f = e.features?.[0]; if (!f) return; const p = f.properties as any;
        onSelectRef.current(Number(p.id));
        window.location.href = `/zhk${p.slug}`;
      });

      const hoverApt = (e: maplibregl.MapLayerMouseEvent) => { if (touchModeRef.current) return; const f = e.features?.[0]; if (!f) return; const p = f.properties as any; if (('a' + p.id) === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; } hovered = 'a' + p.id; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(aptHtml(p)).addTo(m); };
      m.on('mouseenter', 'apt-dot', hoverApt); m.on('mousemove', 'apt-dot', hoverApt);
      m.on('mouseleave', 'apt-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });
      m.on('click', 'apt-dot', (e) => {
        if (touchModeRef.current) return;
        const f = e.features?.[0]; if (!f) return;
        window.open(`https://krisha.kz/a/show/${(f.properties as any).id}`, '_blank');
      });

      // apartment clusters: click to zoom in, cursor feedback
      m.on('click', 'apt-cluster', (e) => { if (touchModeRef.current) return; const f = m.queryRenderedFeatures(e.point, { layers: ['apt-cluster'] })[0]; if (!f) return; (m.getSource('apt') as any).getClusterExpansionZoom((f.properties as any).cluster_id).then((z: number) => m.easeTo({ center: (f.geometry as any).coordinates, zoom: Math.min(z + 0.5, 17) })).catch(() => {}); });
      m.on('mouseenter', 'apt-cluster', () => (m.getCanvas().style.cursor = 'pointer'));
      m.on('mouseleave', 'apt-cluster', () => (m.getCanvas().style.cursor = ''));

      const hoverSold = (e: maplibregl.MapLayerMouseEvent) => { if (touchModeRef.current) return; const f = e.features?.[0]; if (!f) return; const p = f.properties as any; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(soldHtml(p)).addTo(m); };
      m.on('mouseenter', 'sold-dot', hoverSold); m.on('mousemove', 'sold-dot', hoverSold);
      m.on('mouseleave', 'sold-dot', () => { m.getCanvas().style.cursor = ''; hover.remove(); });

      // landmark (ориентир) — фото + рейтинг + категория места
      const hoverLandmark = (e: maplibregl.MapLayerMouseEvent) => { if (touchModeRef.current) return; const f = e.features?.[0]; if (!f) return; const p = f.properties as any; if (('l' + p.name) === hovered) { hover.setLngLat((f.geometry as any).coordinates); return; } hovered = 'l' + p.name; m.getCanvas().style.cursor = 'pointer'; hover.setLngLat((f.geometry as any).coordinates).setHTML(landmarkHtml(p)).addTo(m); };
      m.on('mouseenter', 'landmark-dot', hoverLandmark); m.on('mousemove', 'landmark-dot', hoverLandmark);
      m.on('mouseleave', 'landmark-dot', () => { hovered = null; m.getCanvas().style.cursor = ''; hover.remove(); });

      // ---- ТАЧ: один делегированный клик с увеличенной зоной попадания ----
      // Палец толще курсора: метка радиусом 6px практически непопадаема, поэтому
      // ищем объекты в квадрате ±22px вокруг точки касания и берём ближайший по приоритету.
      // Раньше у ориентиров и «продано» click-обработчика не было вовсе — вся их
      // информация жила в hover, т.е. с телефона была недоступна в принципе.
      const TAP = 22;
      m.on('click', (e) => {
        if (!touchModeRef.current) return;
        const box: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - TAP, e.point.y - TAP], [e.point.x + TAP, e.point.y + TAP],
        ];
        const pick = (layer: string) => (m.getLayer(layer) ? m.queryRenderedFeatures(box, { layers: [layer] })[0] : undefined);

        const cl = pick('clusters');
        if (cl) { (m.getSource('zhk') as any).getClusterExpansionZoom((cl.properties as any).cluster_id).then((z: number) => m.easeTo({ center: (cl.geometry as any).coordinates, zoom: Math.min(z + 0.5, 16) })).catch(() => {}); return; }
        const ac = pick('apt-cluster');
        if (ac) { (m.getSource('apt') as any).getClusterExpansionZoom((ac.properties as any).cluster_id).then((z: number) => m.easeTo({ center: (ac.geometry as any).coordinates, zoom: Math.min(z + 0.5, 17) })).catch(() => {}); return; }

        const z = pick('zhk-dot');
        if (z) { const p = z.properties as any; onSelectRef.current(Number(p.id)); onDetailRef.current?.({ kind: 'zhk', id: Number(p.id), slug: p.slug, name: p.name }); return; }
        // sold-dot добавлен последним и рисуется ПОВЕРХ apt-dot, поэтому и
        // разбирается раньше: иначе тап по красной метке «продано» открывал бы
        // карточку лежащей под ней квартиры
        const sd = pick('sold-dot');
        if (sd) { const p = sd.properties as any; onDetailRef.current?.({ kind: 'sold', price: p.price ? Number(p.price) : null, rooms: p.rooms ? Number(p.rooms) : null, square: p.square ? Number(p.square) : null, addr: p.addr || null }); return; }
        // ценник-пилюля — самая заметная цель для пальца в режиме «Квартиры»
        // (крупнее самой точки), поэтому она тоже открывает карточку
        const a = pick('apt-dot') || pick('apt-price');
        if (a) {
          const p = a.properties as any;
          onDetailRef.current?.({
            kind: 'apt', id: Number(p.id), price: p.price ? Number(p.price) : null, rooms: p.rooms ? Number(p.rooms) : null,
            square: p.square ? Number(p.square) : null, floor: p.floor || null, addr: p.addr || null,
            market: p.market === 'primary' ? 'primary' : 'secondary', photo: p.photo || null,
          });
          return;
        }
        const lm = pick('landmark-dot') || pick('landmark-label');
        // в landmarks.geojson русская категория лежит в rubric; поля kindRu нет
        if (lm) { const p = lm.properties as any; onDetailRef.current?.({ kind: 'landmark', name: p.name, kindRu: p.rubric || p.desc || null, rating: p.rating ? Number(p.rating) : null, photo: p.photo || null }); return; }

        // Разломы разбираем последними: линия широкая и иначе перехватывала бы
        // тапы по домам. Без этой ветки тап по разлому проваливался в «пустое
        // место» и закрывал открытую карточку.
        const fl = pick('faults-jica') || pick('faults-city') || pick('faults-line');
        if (fl) {
          const q = fl.properties as any;
          onDetailRef.current?.({
            kind: 'fault', name: q.name || 'Активный разлом',
            mw: q.mw ? Number(q.mw) : null, lenKm: q.len_km ? Number(q.len_km) : null,
            src: q.src === 'jica' ? 'JICA / OYO, 2009' : q.src === 'city' ? 'Frontiers in Built Environment, 2024 (CC BY)' : 'GEM Global Active Faults',
            note: q.note || null,
          });
          return;
        }

        onDetailRef.current?.(null); // тап по пустому месту — закрыть карточку
      });

      // heart-в-попапе ЖК: делегированный клик по кнопке внутри popup-DOM
      m.getContainer().addEventListener('click', (ev) => {
        const btn = (ev.target as HTMLElement).closest('[data-fav-zhk]') as HTMLElement | null;
        if (!btn) return;
        ev.stopPropagation(); ev.preventDefault();
        const id = Number(btn.getAttribute('data-fav-zhk'));
        onToggleFavRef.current?.(id);
        const nowFav = btn.getAttribute('data-fav') !== '1';
        btn.setAttribute('data-fav', nowFav ? '1' : '0');
        btn.innerHTML = heartSvg(nowFav);
      });

      applyModeRef.current();
    });

    return () => { navCleanup.current(); m.remove(); map.current = null; ready.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setVis(m: maplibregl.Map, layers: string[], v: 'visible' | 'none') { for (const l of layers) if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', v); }
  const COMPLEX_LAYERS = ['clusters', 'cluster-count', 'zhk-glow', 'zhk-dot', 'zhk-price', 'zhk-selected', 'zhk-fav'];
  const APT_LAYERS = ['apt-cluster', 'apt-cluster-count', 'apt-dot', 'apt-price'];

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
  useEffect(() => { const m = map.current; if (!m || !ready.current) return; if (m.getLayer('zhk-fav')) m.setFilter('zhk-fav', ['in', ['get', 'id'], ['literal', favSet ? [...favSet] : []]] as any); }, [favSet]);

  // Разломы включаются/выключаются тумблером. Ждём готовности стиля: слой
  // добавляется асинхронно после загрузки geojson.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      for (const id of ['faults-halo', 'faults-line', 'faults-city', 'faults-jica', 'faults-label']) {
        if (m.getLayer(id)) m.setLayoutProperty(id, 'visibility', showFaults ? 'visible' : 'none');
      }
    };
    if (m.isStyleLoaded()) apply();
    m.on('idle', apply);
    return () => { m.off('idle', apply); };
  }, [showFaults]);

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
    <div style="font-size:12px;color:#6b7480">${escapeHtml(p.addr || '')}</div>
  </div>`;
}
/** Ценник ЖК на карте: «от N млн», а если минимальной цены нет — цена за м². */
function zhkPriceLabel(p: MapPoint): string {
  if (p.priceMin) return `от ${Math.round(p.priceMin / 1_000_000)} млн`;
  if (p.priceSqm) return `${Math.round(p.priceSqm / 1000)} тыс/м²`;
  return '';
}
function priceShort(p: number | null): string {
  if (!p) return '';
  if (p >= 1_000_000) return `${Math.round(p / 1_000_000)} млн`;
  return `${Math.round(p / 1_000)} тыс`;
}
function aptFC(apts: Apt[]) {
  return { type: 'FeatureCollection', features: apts.filter((a) => a.lat && a.lng).map((a) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [a.lng, a.lat] }, properties: { id: a.id, price: a.price ?? 0, priceLabel: priceShort(a.price), rooms: a.rooms ?? 0, square: a.square ?? 0, floor: a.floor ?? '', addr: a.addr ?? '', market: a.market, photo: a.photo ?? '' } })) };
}
// белая скруглённая «пилюля» под цену (9-slice, углы не растягиваются)
function roundRectPath(x: CanvasRenderingContext2D, X: number, Y: number, w: number, h: number, r: number) {
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath();
}
function makePricePill() {
  const pr = 2, w = 64, h = 22, r = 8;
  const c = document.createElement('canvas'); c.width = w * pr; c.height = h * pr;
  const x = c.getContext('2d')!; x.scale(pr, pr);
  x.fillStyle = '#ffffff'; roundRectPath(x, 0.5, 0.5, w - 1, h - 1, r); x.fill();
  x.lineWidth = 1; x.strokeStyle = 'rgba(20,24,31,0.16)'; roundRectPath(x, 0.5, 0.5, w - 1, h - 1, r); x.stroke();
  const d = x.getImageData(0, 0, c.width, c.height);
  return { data: new Uint8Array(d.data.buffer), width: c.width, height: c.height };
}
function toGeoJSON(points: MapPoint[]) {
  return { type: 'FeatureCollection', features: points.filter((p) => p.lat && p.lng).map((p) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { id: p.id, name: p.name, color: BAND_COLOR[p.band], textColor: BAND_TEXT[p.band], band: p.band, score: p.score ?? '', slug: p.slug, priceSqm: p.priceSqm ?? 0, priceMin: p.priceMin ?? 0, priceLabel: zhkPriceLabel(p), developer: p.developer ?? '', classRu: p.classRu ?? '', statusRu: p.statusRu ?? '', district: p.district ?? '', seismic: p.seismic ?? 0, image: p.image ?? '', real: !!p.real, deal: !!p.deal } })) };
}

function aptHtml(p: any) {
  const price = Number(p.price) ? `${(Number(p.price) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : 'цена не указана';
  const line = [Number(p.rooms) ? `${p.rooms}-комн.` : '', Number(p.square) ? `${p.square} м²` : '', p.floor ? `${p.floor} эт.` : ''].filter(Boolean).join(' · ');
  const mk = p.market === 'primary' ? '<span style="color:#16a34a;font-weight:600">новостройка</span>' : '<span style="color:#6b7480;font-weight:600">вторичка</span>';
  const img = (p.photo && p.photo !== '') ? `<div style="height:118px;background:#eef1f4 center/cover no-repeat url('${escapeAttr(p.photo)}')"></div>` : '';
  return `<div style="width:242px;font-family:inherit">${img}<div style="padding:11px 13px 12px">
    <div style="font-size:18px;font-weight:770;color:#14181f;letter-spacing:-.01em">${price}</div>
    <div style="font-size:12.5px;color:#5b6472;margin:3px 0 4px">${line}</div>
    <div style="font-size:12px;color:#6b7480">${escapeHtml(p.addr || '')}</div>
    <div style="font-size:11.5px;margin-top:7px">${mk} <span style="color:#b3bbc6">·</span> <span style="color:#2f6bed;font-weight:600">открыть на krisha ↗</span></div>
  </div></div>`;
}
function heartSvg(filled: boolean) {
  return `<svg width="17" height="17" viewBox="0 0 24 24" fill="${filled ? '#e0293f' : 'none'}" stroke="${filled ? '#e0293f' : '#8b95a3'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}
function landmarkHtml(p: any) {
  const kindLabel: Record<string, string> = { mall: 'ТРЦ', park: 'парк', water: 'отдых', transport: 'транспорт', poi: 'место' };
  const img = (p.photo && p.photo !== '') ? `<div style="height:130px;background:#eef1f4 center/cover no-repeat url('${escapeAttr(p.photo)}')"></div>` : '';
  const rating = Number(p.rating) ? `<span style="color:#d68a00;font-weight:700">★ ${p.rating}</span>${Number(p.reviews) ? ` <span style="color:#6b7480">${Number(p.reviews).toLocaleString('ru-RU')} отзывов</span>` : ''}` : '';
  return `<div style="width:236px;font-family:inherit">${img}<div style="padding:10px 13px 12px">
    <div style="font-size:15px;font-weight:720;color:#14181f;letter-spacing:-.01em">${escapeHtml(p.name)}</div>
    <div style="font-size:12px;color:#5b6472;margin:2px 0 5px">${escapeHtml(p.rubric || kindLabel[p.kind] || 'место')}</div>
    ${rating ? `<div style="font-size:12.5px;margin-bottom:3px">${rating}</div>` : ''}
    ${p.address ? `<div style="font-size:11.5px;color:#6b7480">${escapeHtml(p.address)}</div>` : ''}
  </div></div>`;
}
function cardHtml(p: any, isFav = false) {
  const priceMin = Number(p.priceMin) ? `от ${(Number(p.priceMin) / 1_000_000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} млн ₸` : null;
  const priceSqm = Number(p.priceSqm) ? `${Math.round(Number(p.priceSqm) / 1000).toLocaleString('ru-RU')} тыс ₸/м²` : null;
  const scoreTxt = p.score === '' || p.score == null ? 'мало данных' : `${p.score}`;
  // заливочный цвет бэнда нечитаем как текст (жёлтый ~1.7:1) — для подписей берём тёмный вариант
  const bandColor = p.textColor || BAND_TEXT[p.band as keyof typeof BAND_TEXT] || p.color;
  const bandLabel = BAND_LABEL[p.band as keyof typeof BAND_LABEL] || '';
  const chips = [p.classRu, p.statusRu, p.district ? p.district + ' р-н' : '', Number(p.seismic) ? `${p.seismic} балл` : ''].filter(Boolean).map((c: string) => `<span style="font-size:11px;padding:2px 8px;border-radius:6px;background:#f1f4f7;color:#5b6472">${escapeHtml(c)}</span>`).join('');
  const img = (p.image && p.image !== '') ? `<div style="height:120px;background:#eef1f4 center/cover no-repeat url('${escapeAttr(p.image)}')"></div>` : `<div style="height:44px"></div>`;
  const flag = p.deal === true || p.deal === 'true';
  const favBtn = `<button class="map-fav-btn" data-fav-zhk="${p.id}" data-fav="${isFav ? 1 : 0}" title="Сохранить в избранное" style="position:absolute;top:9px;right:9px;z-index:3;width:32px;height:32px;border:none;border-radius:50%;background:rgba(255,255,255,.94);box-shadow:0 1px 5px rgba(20,24,31,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0">${heartSvg(isFav)}</button>`;
  return `<div style="width:262px;font-family:inherit;position:relative">${favBtn}${img}<div style="padding:11px 13px 12px">
    ${flag ? '<div style="display:inline-block;font-size:11px;font-weight:700;color:#fff;background:#16a34a;padding:2px 9px;border-radius:6px;margin-bottom:7px">Выгодно</div>' : ''}
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px"><div style="font-weight:680;font-size:14.5px;color:#14181f;line-height:1.25">${escapeHtml(p.name)}</div><div style="text-align:center;flex-shrink:0"><div style="font-size:21px;font-weight:800;line-height:1;color:${bandColor}">${scoreTxt}</div><div style="font-size:9px;text-transform:uppercase;letter-spacing:.04em;color:#6b7480;margin-top:1px">${p.score === '' ? '' : 'защита'}</div></div></div>
    <div style="color:#5b6472;font-size:12px;margin:3px 0 3px">${escapeHtml(p.developer || '')}</div>
    <div style="color:${bandColor};font-size:12px;font-weight:650;margin-bottom:9px">${bandLabel}</div>
    ${priceMin || priceSqm ? `<div style="display:flex;gap:9px;align-items:baseline;margin-bottom:9px">${priceMin ? `<span style="font-size:16px;font-weight:770;color:#14181f;letter-spacing:-.01em">${priceMin}</span>` : ''}${priceSqm ? `<span style="font-size:12px;color:#6b7480">${priceSqm}</span>` : ''}</div>` : ''}
    <div style="display:flex;flex-wrap:wrap;gap:5px">${chips}</div>
    <div style="margin-top:9px;font-size:11px;color:#2f6bed;font-weight:600">Подробно →</div>
  </div></div>`;
}
function escapeHtml(s: string) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }
function escapeAttr(s: string) { return String(s).replace(/'/g, '%27').replace(/"/g, '%22'); }
