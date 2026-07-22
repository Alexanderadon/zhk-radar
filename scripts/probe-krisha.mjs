const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36';
const g = (u) => fetch(u, { headers: { 'User-Agent': UA, 'Accept-Language': 'ru' } }).then(r => r.text());

// 1) full card block from listing
const list = await g('https://krisha.kz/complex/search/almaty/?page=2');
const cardStart = list.indexOf('complex-card');
console.log('=== ONE CARD BLOCK ===');
console.log(list.slice(cardStart - 60, cardStart + 900).replace(/\s+/g, ' ').slice(0, 900));
const cards = [...list.matchAll(/data-alias="([^"]+)"/g)].map(m => m[1]);
console.log('\ncards on page 2:', cards.length, '| sample:', cards.slice(0, 6));
const anyLatInList = /"lat"\s*:\s*4[0-9]\.[0-9]/.test(list.replace(/43\.2859|43\.238/g, ''));
console.log('per-card coords in listing?', anyLatInList);

// 2) detail page — coordinates?
const alias = cards[0] || 'almaty/dastur';
const det = await g(`https://krisha.kz/complex/show/${alias}/`);
console.log('\n=== DETAIL', alias, 'bytes', det.length, '===');
for (const kw of ['"lat"', 'latitude', 'data-lat', '"lon"', 'longitude', 'center":', 'coordinates']) {
  const i = det.indexOf(kw);
  if (i > -1) console.log(`"${kw}" @${i}: ${det.slice(i, i + 70).replace(/\s+/g, ' ')}`);
}
