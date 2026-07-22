// ЖК-Радар — КФГЖС / КЖК guarantee registry collector.
// Scrapes khc.kz listing for the two rotating PDF hrefs, downloads them,
// parses text with pdfjs-dist, extracts guarantee rows, writes data/guarantees.json.
// Match keys: obj:<normalized ЖК name> and dev:<normalized legal name>.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const LISTING = 'https://khc.kz/ru/equity/uslugi/357/3260/';

const norm = (s) => s.toLowerCase().replace(/[«»"'`]/g, '').replace(/\bжилой комплекс\b|\bжк\b|\bмжк\b/g, '').replace(/\s+/g, ' ').trim();
const normDev = (s) => s.toLowerCase().replace(/[«»"'`.]/g, '').replace(/\b(тоо|ао|ип|оао|зао)\b/g, '').replace(/\s+/g, ' ').trim();

async function pdfText(buf) {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
  let text = '';
  for (let p = 1; p <= doc.numPages; p++) {
    const content = await (await doc.getPage(p)).getTextContent();
    const items = content.items.filter((i) => i.str).map((i) => ({ x: i.transform[4], y: i.transform[5], s: i.str }));
    items.sort((a, b) => (Math.abs(a.y - b.y) > 3 ? b.y - a.y : a.x - b.x)); // reading order
    text += ' ' + items.map((i) => i.s).join(' ');
  }
  return text.replace(/\s+/g, ' ').trim();
}

// Records are anchored on ALL-CAPS object names «ЖК NAME» / «МЖК NAME» — the one reliable
// column in a heavily interleaved table. For each object we scan a forward window for the
// developer (ТОО ...), region (г. X), contract (ДПГ...), and the «Гарантийный случай» flag.
const CAPS = 'А-ЯЁA-ZҚҰҒӘІҢӨҮҺ';
function parseRecords(text, statusKind) {
  const anchor = new RegExp(`(МЖК|ЖК)\\s+([${CAPS}][${CAPS}0-9 .,\\-«»"'’]{1,55})`, 'g');
  const hits = [...text.matchAll(anchor)];
  const recs = [];
  for (let i = 0; i < hits.length; i++) {
    const start = hits[i].index;
    const end = i + 1 < hits.length ? hits[i + 1].index : Math.min(text.length, start + 600);
    const win = text.slice(start, end);
    const name = (hits[i][1] + ' ' + hits[i][2]).replace(/[«»"'’]/g, '').replace(/\s+/g, ' ').trim().replace(/[ ,.\-]+$/, '');
    const isCase = /гарантийн\w*\s*случа/i.test(win) && !/Действующий договор\s*■?\s*Гарантийный случай/i.test(win);
    const dev = (win.match(/ТОО\s+([A-Z][A-Z0-9 &.\-]{1,40}|[А-ЯЁ][^,«»0-9]{1,40})/) || [])[1];
    const contract = (win.match(/ДПГ[\s-]*\d{2}[\s-]*\d{2}[\s-]*\d{3,}[\/\d]*/) || [])[0]?.replace(/\s/g, '') || null;
    const region = (win.match(/г\.\s?([А-ЯЁ][А-Яа-яЁё-]+)/) || [])[1];
    recs.push({ contract, status: isCase ? 'guarantee-case' : statusKind, developer: dev ? dev.trim() : null, object: name, region: region || null });
  }
  // dedup by object name
  const seen = new Set();
  return recs.filter((r) => { const k = r.object.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
}

async function main() {
  console.log('fetching listing…');
  const html = await (await fetch(LISTING, { headers: { 'User-Agent': UA } })).text();
  const hrefs = [...html.matchAll(/href="([^"]+\.pdf)"/gi)].map((m) => m[1]);
  const abs = [...new Set(hrefs)].map((h) => (h.startsWith('http') ? h : 'https://khc.kz' + h));
  console.log('PDF links:', abs);
  if (abs.length < 1) { console.log('no PDFs found — page structure changed'); return; }

  await mkdir('data', { recursive: true });
  const all = [];
  for (let i = 0; i < abs.length; i++) {
    const url = abs[i];
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    const text = await pdfText(buf);
    const kind = /СТРОЯЩИМСЯ ОБЪЕКТАМ|гарантии по строящ/i.test(text.slice(0, 400)) ? 'active' : 'completed';
    const recs = parseRecords(text, kind);
    console.log(`  PDF ${i + 1} (${kind}): ${text.length} chars → ${recs.length} records, ${recs.filter(r=>r.status==='guarantee-case').length} гарант-случаев`);
    all.push(...recs);
  }

  // build match map
  const map = {};
  let objKeys = 0, devKeys = 0;
  for (const r of all) {
    const entry = { status: r.status, contract: r.contract, object: r.object, developer: r.developer, region: r.region };
    if (r.object) { map[`obj:${norm(r.object)}`] = { ...entry, matchedBy: 'object' }; objKeys++; }
    if (r.developer) {
      const k = `dev:${normDev(r.developer)}`;
      // guarantee-case wins over active/completed for a developer
      if (!map[k] || r.status === 'guarantee-case') { map[k] = { ...entry, matchedBy: 'developer' }; devKeys++; }
    }
  }
  await writeFile('data/guarantees.json', JSON.stringify(map, null, 2), 'utf-8');
  await writeFile('data/guarantees-raw.json', JSON.stringify(all, null, 2), 'utf-8');
  console.log(`\n✓ ${all.length} guarantee records → data/guarantees.json (${objKeys} obj-keys, ${devKeys} dev-keys)`);

  // try to report how many korter ЖК would match
  try {
    const zhk = JSON.parse(await readFile('data/zhk.json', 'utf-8'));
    let hit = 0;
    for (const z of zhk) {
      if (map[`obj:${norm(z.name)}`] || (z.developer && map[`dev:${normDev(z.developer.name)}`])) hit++;
    }
    console.log(`  would match ${hit}/${zhk.length} korter ЖК`);
  } catch {}
}
main();
