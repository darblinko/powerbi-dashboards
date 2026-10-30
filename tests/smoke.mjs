/* global document, window -- page.evaluate callbacks run in the browser */
// Loads every page under docs/ in headless Chromium and fails on console errors, uncaught
// exceptions, failed requests, or a report page with fewer populated charts than expected.
// A populated chart is an ECharts instance with at least one series that holds data; toolbar
// and icon SVGs do not count. The landing page check requires every figure to render.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { serveDirectory } from './static-server.mjs';

const DOCS = fileURLToPath(new URL('../docs', import.meta.url));

// minCharts per report page is the number of ECharts visuals the page lays out. `open` names a
// hidden drillthrough page and the page script call that opens it.
const PAGES = [
  { path: '', landing: true, views: [] },
  {
    path: 'online-retailer/',
    views: [
      { name: 'Executive Summary', minCharts: 4 },
      { tab: 'Customer and Retention', minCharts: 2 },
      { tab: 'Funnel and What-if', minCharts: 5 }
    ]
  },
  {
    path: 'auto-parts-supplier/',
    views: [
      { name: 'Plant Performance', minCharts: 11 },
      { tab: 'Cost and Variance', minCharts: 8 },
      { tab: 'Supplier Quality', minCharts: 5 },
      { tab: 'Plant Access (RLS)', minCharts: 2 },
      { name: 'Machine Detail', open: "PBI.app.drillthrough('MI-M1-C01')", minCharts: 3 }
    ]
  },
  {
    path: 'supplement-cmo/',
    views: [
      { name: 'Production Overview', minCharts: 9 },
      { tab: 'Quality and Release', minCharts: 3 },
      { tab: 'Customer Scorecard', minCharts: 2 },
      { name: 'Batch Record', open: 'openDrillthrough(DATA.batches[0].id)', minCharts: 2 }
    ]
  },
  {
    path: 'device-quality/',
    views: [
      { name: 'Quality Overview', minCharts: 2 },
      { tab: 'Complaint Trending', minCharts: 3 },
      { tab: 'CAPA Effectiveness', minCharts: 2 },
      {
        name: 'Complaint Detail',
        open: "PBI.app.drillthrough('product', PBIDATA.PRODUCTS[0].name)",
        minCharts: 1
      }
    ]
  }
];
const PAGES_PANE = '#pagespane, #pages-pane, #pagesPane';
const RENDER_TIMEOUT_MS = 20000;
const SETTLE_MS = 500;

// Runs in the browser before the page scripts. Defines the counter the polling below reads.
function installChartCounter() {
  window.smokePopulatedCharts = () =>
    [...document.querySelectorAll('[_echarts_instance_]')].filter(element => {
      const chart = window.echarts.getInstanceByDom(element);
      if (!chart || chart.isDisposed() || element.offsetParent === null) return false;
      return (chart.getOption().series || []).some(
        series =>
          (Array.isArray(series.data) && series.data.length) || (Array.isArray(series.nodes) && series.nodes.length)
      );
    }).length;
}

// The data scripts run synchronously while the parser is still working, so a fixed delay after
// load can sample the page before the first render. Poll for the charts instead.
async function countChartsWhenRendered(page, minCharts) {
  try {
    await page.waitForFunction(min => window.echarts && window.smokePopulatedCharts() >= min, minCharts, {
      timeout: RENDER_TIMEOUT_MS
    });
  } catch (error) {
    if (error.name !== 'TimeoutError') throw error;
  }
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(() => (window.echarts ? window.smokePopulatedCharts() : 0));
}

// Every landing figure must hold a rendered chart (SVG marks or stat tiles) and every
// screenshot must decode.
async function landingProblems(page) {
  await page.waitForFunction(() => document.querySelectorAll('figure.chart svg, figure.chart .stat').length > 0, null, {
    timeout: RENDER_TIMEOUT_MS
  });
  return page.evaluate(() => {
    const problems = [];
    document.querySelectorAll('figure.chart[data-chart]').forEach(figure => {
      const marks = figure.querySelectorAll('svg rect, svg path, svg line, svg circle, svg polyline').length;
      if (!marks && !figure.querySelector('.stat')) problems.push(`figure ${figure.dataset.chart} rendered no chart`);
    });
    document.querySelectorAll('figure.shot img').forEach(img => {
      if (!img.complete || !img.naturalWidth) problems.push(`screenshot ${img.getAttribute('src')} did not load`);
    });
    return problems;
  });
}

// Returns a problem string when a hidden drillthrough page did not open.
async function openView(page, view) {
  if (view.tab) await page.locator(PAGES_PANE).getByText(view.tab, { exact: true }).first().click();
  if (!view.open) return null;
  await page.evaluate(view.open);
  const shown = await page.getByText(view.name).first().isVisible();
  return shown ? null : `drillthrough page "${view.name}" did not open`;
}

async function checkPage(browser, baseUrl, { path, landing, views }) {
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
  await page.addInitScript(installChartCounter);
  await page.goto(baseUrl + path, { waitUntil: 'load' });
  if (landing) problems.push(...(await landingProblems(page)));
  for (const view of views) {
    const openProblem = await openView(page, view);
    if (openProblem) problems.push(openProblem);
    const charts = await countChartsWhenRendered(page, view.minCharts);
    if (charts < view.minCharts)
      problems.push(`page "${view.tab || view.name}" rendered ${charts} populated charts, expected ${view.minCharts}`);
  }
  await page.close();
  return { path: path || 'index.html', pages: views.length || 1, problems };
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
