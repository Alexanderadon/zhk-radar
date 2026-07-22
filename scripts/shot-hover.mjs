import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new',
  args: ['--no-sandbox', '--window-size=1440,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://localhost:3300', { waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
await sleep(9000); // tiles + pins

// pick a ЖК with an image + price, project to pixel, hover
const target = await page.evaluate(() => {
  const m = window._map;
  if (!m) return null;
  const src = m.getSource('zhk');
  const data = src && src._data;
  if (!data) return null;
  // choose a feature with an image and price, near center
  const feats = data.features.filter((f) => f.properties.image && Number(f.properties.priceSqm) > 0);
  const f = feats[Math.floor(feats.length / 2)] || data.features[0];
  const p = m.project(f.geometry.coordinates);
  const rect = m.getCanvas().getBoundingClientRect();
  return { x: Math.round(rect.left + p.x), y: Math.round(rect.top + p.y), name: f.properties.name };
});
console.log('hover target:', target);
if (target) {
  await page.mouse.move(target.x, target.y, { steps: 8 });
  await sleep(1800);
}
await page.screenshot({ path: `${OUT}/hover.png` });
console.log('✓ hover.png');
await browser.close();
