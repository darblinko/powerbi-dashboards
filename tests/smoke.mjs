/* global document -- page.evaluate callbacks run in the browser */
// Loads every page under docs/ in headless Chromium and fails on console errors,
// uncaught exceptions, failed requests, or a dashboard that renders no charts.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { serveDirectory } from './static-server.mjs';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));
const PAGES = [
  { path: '', minCharts: 0, tabs: [] },
  {
    path: 'online-retailer/',
    minCharts: 5,
    tabs: ['Customer and Retention', 'Funnel and What-if', 'Executive Summary']
  },
  {
    path: 'auto-parts-supplier/',
    minCharts: 5,
    tabs: ['Cost and Variance', 'Supplier Quality', 'Plant Access (RLS)', 'Plant Performance']
  },
  {
    path: 'supplement-cmo/',
    minCharts: 5,
    tabs: ['Quality and Release', 'Customer Scorecard', 'Production Overview']
  },
  {
    path: 'device-quality/',
    minCharts: 5,
    tabs: ['Complaint Trending', 'CAPA Effectiveness', 'Quality Overview']
  }
];
const PAGES_PANE = '#pagespane, #pages-pane, #pagesPane';
const RENDER_TIMEOUT_MS = 20000;
const SETTLE_MS = 500;

// The data scripts run synchronously while the parser is still working, so a fixed delay after
// networkidle can sample the page before the first render. Poll for the charts instead.
async function countChartsWhenRendered(page, minCharts) {
  const count = () => document.querySelectorAll('canvas, svg').length;
  try {
    await page.waitForFunction(min => document.querySelectorAll('canvas, svg').length >= min, minCharts, {
      timeout: RENDER_TIMEOUT_MS
    });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
  }
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(count);
}

async function checkPage(browser, baseUrl, { path, minCharts, tabs }) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const problems = [];
  page.on('console', message => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => problems.push(`exception: ${error.message}`));
  page.on('requestfailed', request => problems.push(`request failed: ${request.url()}`));
  page.on('response', response => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  await page.goto(baseUrl + path, { waitUntil: 'load' });
  const charts = await countChartsWhenRendered(page, minCharts);
  if (charts < minCharts) problems.push(`rendered ${charts} canvas or svg elements, expected at least ${minCharts}`);
  for (const tab of tabs) {
    await page.locator(PAGES_PANE).getByText(tab, { exact: true }).first().click();
    const tabCharts = await countChartsWhenRendered(page, minCharts);
    if (tabCharts < minCharts) problems.push(`page "${tab}" rendered ${tabCharts} canvas or svg elements`);
  }
  await page.close();
  return { path: path || 'index.html', charts, pages: tabs.length + 1, problems };
}

// Optional arguments restrict the run to the named paths, for example: node tests/smoke.mjs device-quality/
const selected = process.argv.length > 2 ? PAGES.filter(spec => process.argv.includes(spec.path)) : PAGES;
const server = await serveDirectory(DOCS);
const browser = await chromium.launch();
let failed = false;
try {
  for (const spec of selected) {
    const result = await checkPage(browser, server.url, spec);
    console.log(`${result.problems.length ? 'FAIL' : 'ok  '} ${result.path} (${result.pages} report pages)`);
    result.problems.forEach(problem => console.log(`     ${problem}`));
    failed ||= result.problems.length > 0;
  }
} finally {
  await browser.close();
  await server.close();
}
process.exit(failed ? 1 : 0);
