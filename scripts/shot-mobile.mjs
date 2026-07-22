import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'], defaultViewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 1 } });
async function shot(path, file, wait = 6000) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:3300' + encodeURI(path), { waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
  await sleep(wait);
  await page.screenshot({ path: `${OUT}/${file}` });
  console.log('✓', file);
  await page.close();
}
await shot('/', 'mobile-home.png', 8000);
await shot('/zhk/жк-qarasai-park-алматы', 'mobile-detail.png', 5000);
await browser.close();
