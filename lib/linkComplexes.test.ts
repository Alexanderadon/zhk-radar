// node --test lib/linkComplexes.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseComplexId, haversineM, centroid, groupByComplex, matchByCentroid, linkComplexes, matchKey,
  type ZhkLite, type AptLite,
} from './linkComplexes.ts';

// ---------- parseComplexId: id ЖК со страницы krisha ----------

test('parseComplexId: главный источник — window.data.complex.id на странице', () => {
  const html = `<script id="jsdata"> window.data = {"complex":{"id":13619455,"urlAlias":"almaty/kaspii","name":"Каспий"}}</script>`;
  assert.equal(parseComplexId(html), 13619455);
});

test('parseComplexId: у ЖК из нескольких очередей data-id — это соседи, а не он сам', () => {
  // Altai City: пять комплексов-очередей, каждый data-id ×2, и ни один не страница
  const html = `<script id="jsdata"> window.data = {"complex":{"id":8478102,"urlAlias":"almaty/altaicity"}}</script>
    <a data-id="19746462"></a><a data-id="19746462"></a><a data-id="19758194"></a><a data-id="19758194"></a>`;
  assert.equal(parseComplexId(html), 8478102);
});

test('parseComplexId: запасной якорь — data-views-type="complex" data-views-id', () => {
  const html = `<div id="tm-telephone-body" data-views-type="complex" data-views-id="13619455" data-url="/c">`;
  assert.equal(parseComplexId(html), 13619455);
});

test('parseComplexId: берёт data-id, повторённый на странице', () => {
  const html = `<div data-id="13619455"></div> ... <a data-id="13619455">…</a> <span data-id="13619455">`;
  assert.equal(parseComplexId(html), 13619455);
});

test('parseComplexId: не путает с complex-id других ЖК из списков на странице', () => {
  const html = `<li complex-id="8543646"></li><li complex-id="8478766"></li><div data-id="13619455"></div>`;
  assert.equal(parseComplexId(html), 13619455);
});

test('parseComplexId: разные data-id — неоднозначно, null', () => {
  assert.equal(parseComplexId(`<a data-id="13619455"></a><a data-id="99999999"></a>`), null);
});

test('parseComplexId: короткие data-id элементов интерфейса не считаются', () => {
  assert.equal(parseComplexId(`<button data-id="3"></button><i data-id="42"></i>`), null);
});

test('parseComplexId: нет data-id — null', () => {
  assert.equal(parseComplexId(`<html><body>Just a moment...</body></html>`), null);
});

// ---------- геометрия ----------

test('haversineM: одна точка — 0', () => {
  assert.equal(haversineM({ lat: 43.25, lng: 76.9 }, { lat: 43.25, lng: 76.9 }), 0);
});

test('haversineM: центроид квартир ЖК Каспий и его точка — около 45 м', () => {
  const d = haversineM({ lat: 43.29449, lng: 76.83019 }, { lat: 43.29486, lng: 76.83043 });
  assert.ok(d > 38 && d < 52, `получилось ${d.toFixed(1)} м`);
});

test('centroid: одна точка — она же', () => {
  assert.deepEqual(centroid([{ lat: 1, lng: 2 }]), { lat: 1, lng: 2 });
});

test('centroid: медиана не уезжает за одиночным выбросом', () => {
  const pts = Array.from({ length: 9 }, () => ({ lat: 43.2, lng: 76.9 }));
  pts.push({ lat: 44.9, lng: 78.1 }); // объявление с левым геокодом
  assert.deepEqual(centroid(pts), { lat: 43.2, lng: 76.9 });
});

test('groupByComplex: квартиры без complexId не группируются', () => {
  const apts: AptLite[] = [
    { complexId: 7, lat: 43.2, lng: 76.9, city: 'almaty' },
    { complexId: 7, lat: 43.21, lng: 76.91, city: 'almaty' },
    { complexId: null, lat: 43.3, lng: 76.8, city: 'almaty' },
  ];
  const g = groupByComplex(apts);
  assert.equal(g.size, 1);
  assert.equal(g.get(7)!.pts.length, 2);
  assert.equal(g.get(7)!.city, 'almaty');
});

// ---------- подбор ЖК по центроиду ----------

const Z = (id: number, lat: number, lng: number, name = `ЖК ${id}`, citySlug = 'almaty'): ZhkLite =>
  ({ id, name, lat, lng, citySlug });

test('matchByCentroid: ближайший ЖК в радиусе — совпадение', () => {
  const zhks = [Z(1, 43.29486, 76.83043), Z(2, 43.30300, 76.83043)]; // второй ~900 м севернее
  const m = matchByCentroid({ lat: 43.29449, lng: 76.83019 }, zhks, 'almaty');
  assert.equal(m?.zhk.id, 1);
  assert.ok(m!.dist < 60);
});

test('matchByCentroid: дальше maxDist — нет совпадения', () => {
  const zhks = [Z(1, 43.29486, 76.83043)];
  const m = matchByCentroid({ lat: 43.29849, lng: 76.83043 }, zhks, 'almaty', { maxDist: 250 }); // ~400 м
  assert.equal(m, null);
});

test('matchByCentroid: два ЖК почти на одном расстоянии — неоднозначно, нет совпадения', () => {
  // ~80 м и ~95 м: соседние корпуса разных ЖК, гадать нельзя
  const zhks = [Z(1, 43.29522, 76.83019), Z(2, 43.29364, 76.83019)];
  const m = matchByCentroid({ lat: 43.29449, lng: 76.83019 }, zhks, 'almaty');
  assert.equal(m, null);
});

test('matchByCentroid: второй заметно дальше — берём ближайший', () => {
  const zhks = [Z(1, 43.29522, 76.83019), Z(2, 43.29630, 76.83019)]; // ~80 м и ~200 м
  const m = matchByCentroid({ lat: 43.29449, lng: 76.83019 }, zhks, 'almaty');
  assert.equal(m?.zhk.id, 1);
});

test('matchByCentroid: ЖК другого города не рассматривается', () => {
  const zhks = [Z(1, 43.29486, 76.83043, 'ЖК 1', 'astana')];
  assert.equal(matchByCentroid({ lat: 43.29449, lng: 76.83019 }, zhks, 'almaty'), null);
});

test('matchByCentroid: ЖК без координат пропускается', () => {
  const zhks: ZhkLite[] = [{ id: 1, name: 'x', lat: null, lng: null, citySlug: 'almaty' }, Z(2, 43.29486, 76.83043)];
  assert.equal(matchByCentroid({ lat: 43.29449, lng: 76.83019 }, zhks, 'almaty')?.zhk.id, 2);
});

// ---------- linkComplexes: точная привязка + запасная ----------

const apt = (complexId: number, lat: number, lng: number, city = 'almaty'): AptLite => ({ complexId, lat, lng, city });

test('linkComplexes: слаг → complexId → ЖК по имени, how = page', () => {
  const zhks = [Z(900000000, 43.29486, 76.83043, 'Каспий')];
  const apartments = [apt(13619455, 43.29449, 76.83019), apt(13619455, 43.29455, 76.83022)];
  const { map, stats } = linkComplexes({
    apartments, zhks,
    krishaZhks: [{ slug: '/complex/show/almaty/kaspii', name: 'ЖК «Каспий»' }],
    slugToComplexId: { '/complex/show/almaty/kaspii': 13619455 },
  });
  assert.deepEqual(Object.keys(map), ['13619455']);
  assert.equal(map[13619455].zhk, 900000000);
  assert.equal(map[13619455].how, 'page');
  assert.equal(stats.page, 1);
});

test('linkComplexes: имя krisha сопоставляется с записью korter через nameKey', () => {
  // после склейки каталогов в базе остаётся запись korter с другим написанием
  const zhks = [Z(555, 43.29486, 76.83043, 'Клубный дом Tau Residence')];
  const apartments = [apt(77, 43.29449, 76.83019)];
  const { map } = linkComplexes({
    apartments, zhks,
    krishaZhks: [{ slug: '/complex/show/almaty/tau', name: 'Tau Residence' }],
    slugToComplexId: { '/complex/show/almaty/tau': 77 },
  });
  assert.equal(map[77]?.zhk, 555);
});

test('linkComplexes: точная привязка отвергается, если квартиры далеко от ЖК', () => {
  // data-id со страницы указал не на тот комплекс: квартиры за 3 км
  const zhks = [Z(1, 43.29486, 76.83043, 'Каспий'), Z(2, 43.3230, 76.8600, 'Другой')];
  const apartments = [apt(13619455, 43.3229, 76.8601)];
  const { map } = linkComplexes({
    apartments, zhks,
    krishaZhks: [{ slug: '/complex/show/almaty/kaspii', name: 'Каспий' }],
    slugToComplexId: { '/complex/show/almaty/kaspii': 13619455 },
  });
  // не «Каспий» по имени, а «Другой» по центроиду
  assert.equal(map[13619455]?.zhk, 2);
  assert.equal(map[13619455]?.how, 'centroid');
});

test('linkComplexes: complexId без страницы — запасной путь по центроиду', () => {
  const zhks = [Z(42, 43.29486, 76.83043, 'Без слага')];
  const apartments = [apt(31337, 43.29449, 76.83019)];
  const { map, stats } = linkComplexes({ apartments, zhks, krishaZhks: [], slugToComplexId: {} });
  assert.equal(map[31337]?.zhk, 42);
  assert.equal(map[31337]?.how, 'centroid');
  assert.equal(stats.centroid, 1);
});

test('linkComplexes: ни страницы, ни ЖК рядом — комплекс остаётся без привязки', () => {
  const zhks = [Z(42, 43.40, 76.70, 'Далеко')];
  const apartments = [apt(31337, 43.29449, 76.83019)];
  const { map, stats } = linkComplexes({ apartments, zhks, krishaZhks: [], slugToComplexId: {} });
  assert.equal(map[31337], undefined);
  assert.equal(stats.unmatched, 1);
});

test('linkComplexes: привязка не пересекает города', () => {
  const zhks = [Z(42, 43.29486, 76.83043, 'Алматинский', 'almaty')];
  const apartments = [apt(31337, 43.29449, 76.83019, 'astana')]; // те же координаты, но файл Астаны
  const { map } = linkComplexes({ apartments, zhks, krishaZhks: [], slugToComplexId: {} });
  assert.equal(map[31337], undefined);
});

test('matchKey: убирает кавычки, служебные слова и пунктуацию — и для кириллицы тоже', () => {
  // nameKey из data.ts режет только латинские слова:  в JS не знает кириллицы,
  // и «ЖК Каспий» с «Каспий» там не склеиваются. Для привязки квартир так нельзя.
  assert.equal(matchKey('ЖК «Каспий»'), 'каспий');
  assert.equal(matchKey('Клубный дом Tau Residence'), 'tau');
  assert.equal(matchKey('Tau Residence'), 'tau');
  assert.equal(matchKey('Жилой комплекс Nova City'), 'novacity');
});
