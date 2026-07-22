import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
await page.goto('http://localhost:3300', { waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
await sleep(6000);
// click the "Квартиры" toggle
const clicked = await page.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => /Квартиры/.test(x.textContent || ''));
  if (b) { b.click(); return true; } return false;
});
console.log('clicked Квартиры:', clicked);
await sleep(9000); // fetch 6MB listings + cluster + render
await page.screenshot({ path: `${OUT}/apartments.png` });
console.log('✓ apartments.png');
await browser.close();
