/* global document -- page.waitForFunction callbacks run in the browser */
// Writes docs/figures/<dashboard>.png, the first report page of each dashboard at 1280 x 800.
// Usage: node tools/screenshots.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { serveDirectory } from '../tests/static-server.mjs';
import { DASHBOARDS } from './dashboards.mjs';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));
const MIN_CHARTS = 5;
const ANIMATION_MS = 2000;

const server = await serveDirectory(DOCS);
const browser = await chromium.launch();
try {
  for (const { dir } of DASHBOARDS) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${server.url}${dir}/`, { waitUntil: 'load' });
    await page.waitForFunction(min => document.querySelectorAll('canvas, svg').length >= min, MIN_CHARTS);
    await page.waitForTimeout(ANIMATION_MS);
    const path = `${DOCS}/figures/${dir}.png`;
    await page.screenshot({ path });
    console.log(`wrote ${path}`);
    await page.close();
  }
} finally {
  await browser.close();
  await server.close();
}
