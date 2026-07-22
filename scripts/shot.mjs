import puppeteer from 'puppeteer-core';

const CHROME = 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';
const OUT = process.argv[2] || '.';
const BASE = 'http://localhost:3300';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--window-size=1440,900', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars'],
  defaultViewport: { width: 1440, height: 900 },
});

async function shot(path, file, waitMap = false, extra = 4000) {
  const page = await browser.newPage();
  await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 120000 }).catch(() => {});
  if (waitMap) {
    // give MapLibre time to fetch tiles + paint
    await sleep(9000);
  } else {
    await sleep(extra);
  }
  await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
  console.log('✓', file);
  await page.close();
}

await shot('/', 'home.png', true);
await shot('/methodology', 'methodology.png', false, 2500);
await shot('/zhk/жк-autograph-алматы', 'detail.png', true);
await shot('/developer/av-capital', 'developer.png', false, 2500);

await browser.close();
console.log('done');
