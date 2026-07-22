const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const g = (u) => fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } });

// grab main page, find JS bundles, hunt for the runtime API key
const page = await (await g('https://2gis.kz/almaty')).text();
console.log('main page bytes', page.length);
const scripts = [...page.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) => m[1]);
console.log('js bundles:', scripts.length);
// candidate keys directly in page
const inPage = [...page.matchAll(/["']([a-z]{6}\d{4})["']/g)].map((m) => m[1]);
if (inPage.length) console.log('key-like in page:', [...new Set(inPage)].slice(0, 8));

const keys = new Set();
for (const src of scripts.slice(0, 6)) {
  const url = src.startsWith('http') ? src : (src.startsWith('//') ? 'https:' + src : 'https://2gis.kz' + src);
  try {
    const js = await (await g(url)).text();
    for (const m of js.matchAll(/["']([a-z]{6}\d{4})["']/g)) keys.add(m[1]);
    for (const m of js.matchAll(/key['"]?\s*[:=]\s*['"]([A-Za-z0-9]{10,40})['"]/g)) keys.add(m[1]);
  } catch {}
}
console.log('candidate keys from bundles:', [...keys].slice(0, 15));

// test each candidate against catalog API
for (const key of keys) {
  try {
    const r = await g(`https://catalog.api.2gis.com/3.0/items?q=${encodeURIComponent('ЖК Wisteria Алматы')}&fields=items.point,items.photos&key=${key}`);
    const t = await r.text();
    const ok = r.status === 200 && !/incorrect key|forbidden/i.test(t);
    console.log(`test ${key}: ${ok ? 'WORKS' : 'no'} — ${t.slice(0, 90).replace(/\s+/g, ' ')}`);
    if (ok) { console.log('\n>>> WORKING KEY:', key); break; }
  } catch {}
}
