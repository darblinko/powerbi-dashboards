// Writes docs/data.json, the chart data for the README figures and the landing page.
// Usage: node tools/build-data.mjs
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DASHBOARDS, factRowCounts, loadDashboardData } from './dashboards.mjs';

const OUTPUT = fileURLToPath(new URL('../docs/data.json', import.meta.url));
const COMMAND = 'node tools/build-data.mjs';

function sumBy(rows, keyOf, valueOf, keys) {
  const totals = new Map(keys.map(key => [key, 0]));
  rows.forEach(row => totals.set(keyOf(row), (totals.get(keyOf(row)) ?? 0) + valueOf(row)));
  return keys.map(key => totals.get(key));
}

function factRowsChart(loaded) {
  const tiles = DASHBOARDS.map(dashboard => {
    const counts = Object.values(factRowCounts(dashboard, loaded[dashboard.dir]));
    const total = counts.reduce((sum, count) => sum + count, 0);
    return {
      label: dashboard.title,
      value: total.toLocaleString('en-US'),
      note: `${counts.length} tables, ${dashboard.period(loaded[dashboard.dir])}`
    };
  });
  return {
    name: 'fact-rows',
    type: 'stats',
    title: 'Generated fact rows per dashboard',
    subtitle: 'Row counts after each data.js runs; every row is fictional',
    source: `docs/*/data.js via ${COMMAND}`,
    alt: 'Fact row counts: ' + tiles.map(tile => `${tile.label} ${tile.value}`).join(', ') + '.',
    tiles
  };
}

function revenueChart(data) {
  const months = data.MONTHS.map(month => month.idx);
  const revenue = sumBy(
    data.SALES,
    row => row.m,
    row => row.rev,
    months
  ).map(value => Math.round(value / 1000));
  return {
    name: 'retail-revenue',
    type: 'line',
    title: 'Online retailer revenue by month, thousands',
    subtitle: 'Sales table, Oct 2023 to Sep 2026, fictional currency units',
    source: `docs/online-retailer/data.js via ${COMMAND}`,
    alt: `Monthly revenue over ${months.length} months, with peaks in November and December of each year.`,
    format: 'number',
    min: 0,
    x: data.MONTHS.map(month => month.short),
    series: [{ name: 'Revenue', values: revenue }]
  };
}

function supplierPpmChart(data) {
  const months = data.months.map(month => month.idx);
  const ppm = (rows, month) => {
    const inMonth = rows.filter(row => row.month === month);
    const received = inMonth.reduce((sum, row) => sum + row.received, 0);
    const defects = inMonth.reduce((sum, row) => sum + row.defects, 0);
    return Math.round((defects / received) * 1e6);
  };
  const focus = 'Northwind Castings';
  const focusRows = data.tables.Receipts.filter(row => row.supplier === focus);
  const otherRows = data.tables.Receipts.filter(row => row.supplier !== focus);
  return {
    name: 'supplier-ppm',
    type: 'line',
    title: 'Incoming defects per million parts by month',
    subtitle: `${focus} against the other ${data.suppliers.length - 1} suppliers, Receipts table`,
    source: `docs/auto-parts-supplier/data.js via ${COMMAND}`,
    alt: `${focus} defect PPM rises from March to May 2026 while the other suppliers stay level.`,
    format: 'number',
    min: 0,
    x: data.months.map(month => month.label),
    series: [
      { name: 'Northwind', values: months.map(month => ppm(focusRows, month)) },
      { name: 'Others', values: months.map(month => ppm(otherRows, month)) }
    ]
  };
}

function dispositionChart(data) {
  const statuses = ['Released', 'Released with deviation', 'On hold', 'Rejected'];
  const counts = sumBy(
    data.batches,
    row => row.disposition,
    () => 1,
    statuses
  );
  return {
    name: 'batch-disposition',
    type: 'hbar',
    title: 'Supplement batches by disposition',
    subtitle: `${data.batches.length.toLocaleString('en-US')} batches over ${data.WEEKS} weeks, Batches table`,
    source: `docs/supplement-cmo/data.js via ${COMMAND}`,
    alt: statuses.map((status, index) => `${status} ${counts[index]}`).join(', ') + '.',
    format: 'number',
    data: statuses.map((status, index) => ({ label: status, value: counts[index] }))
  };
}

function complaintChart(data) {
  const product = 'Infusion Pump Model B';
  const months = data.MONTHS.map(month => month.idx);
  const rows = data.complaints.filter(row => row.product === product);
  const isDepletion = row => row.subMode === 'Premature depletion';
  const monthly = subset =>
    sumBy(
      subset,
      row => row.month,
      () => 1,
      months
    );
  return {
    name: 'model-b-complaints',
    type: 'line',
    title: `${product} complaints by month`,
    subtitle: 'Premature depletion against all other failure modes, Complaints table',
    source: `docs/device-quality/data.js via ${COMMAND}`,
    alt: 'Premature depletion complaints rise in July to September 2025, the anomaly planted in data.js.',
    format: 'number',
    min: 0,
    x: data.MONTHS.map(month => month.label),
    series: [
      { name: 'Depletion', values: monthly(rows.filter(isDepletion)) },
      { name: 'Other modes', values: monthly(rows.filter(row => !isDepletion(row))) }
    ]
  };
}

export function buildCharts() {
  const loaded = Object.fromEntries(DASHBOARDS.map(dashboard => [dashboard.dir, loadDashboardData(dashboard)]));
  return [
    factRowsChart(loaded),
    revenueChart(loaded['online-retailer']),
    supplierPpmChart(loaded['auto-parts-supplier']),
    dispositionChart(loaded['supplement-cmo']),
    complaintChart(loaded['device-quality'])
  ];
}

function main() {
  const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
  const meta = { repo: 'pbi-portfolio', revision, measured: new Date().toLocaleDateString('en-CA') };
  writeFileSync(OUTPUT, JSON.stringify({ meta, charts: buildCharts() }, null, 2) + '\n');
  console.log(`wrote ${OUTPUT} at ${revision}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
