import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardScripts } from '../tools/dashboards.mjs';

function loadModel() {
  return loadDashboardScripts('device-quality', ['data.js', 'model.js']);
}

// Mirrors app.js ctxFor for a date slicer set to months from..to with no other filters.
const sliceSource = (from, to) =>
  `(() => {
    const ctx = [{ field: 'month', test: m => m >= ${from} && m <= ${to} }];
    ctx.asOf = PBIDATA.MONTHS[${to}].last;
    return ctx;
  })()`;

test('Open CAPAs card counts cases opened before the selected date range', () => {
  const evaluate = loadModel();
  const sep2026 = evaluate(`PBIDATA.MONTHS.findIndex(m => m.label === 'Sep 2026')`);
  const card = evaluate(`PBI.model.MEASURES.openCapas.calc(${sliceSource(sep2026, sep2026)})`);
  const spark = evaluate(
    `PBI.model.monthlySeries('openCapas', ${sliceSource(sep2026, sep2026)}, ${sep2026}, ${sep2026})`
  );
  assert.equal(spark[0], 26);
  assert.equal(card, spark[0]);
});

test('CAPA stock measure cards equal the last sparkline point for a partial range', () => {
  const evaluate = loadModel();
  for (const key of ['openCapas', 'capaOverdue', 'avgDaysOpen']) {
    const card = evaluate(`PBI.model.MEASURES.${key}.calc(${sliceSource(20, 26)})`);
    const spark = evaluate(`PBI.model.monthlySeries('${key}', ${sliceSource(20, 26)}, 20, 26)`);
    assert.equal(card, spark[spark.length - 1], key);
  }
});

test('Open CAPAs under a month cross-filter is the stock as of that month end', () => {
  const evaluate = loadModel();
  const ctx = `(() => {
    const ctx = [{ field: 'month', test: m => m >= 0 && m <= 32 }, { field: 'month', test: m => m === 14 }];
    ctx.asOf = PBIDATA.MONTHS[32].last;
    return ctx;
  })()`;
  const card = evaluate(`PBI.model.MEASURES.openCapas.calc(${ctx})`);
  const spark = evaluate(`PBI.model.monthlySeries('openCapas', ${sliceSource(0, 32)}, 14, 14)`);
  assert.equal(card, spark[0]);
});

const REPORT_SCRIPTS = [
  'data.js',
  'model.js',
  'icons.js',
  'charts.js',
  'frame.js',
  'slicers.js',
  'filterspane.js',
  'shell.js',
  'page1.js',
  'page2.js',
  'decomp.js',
  'page3.js'
];

test('Get insights lists control chart signals and the CAPA narrative for the report filters', () => {
  const evaluate = loadDashboardScripts('device-quality', REPORT_SCRIPTS, {
    document: { addEventListener() {} }
  });
  evaluate(`PBI.S = { slicers: { from: 0, to: 32 } }; PBI.model.asOf = PBIDATA.MONTHS[32].last;`);
  const items = evaluate(`PBI.shell.insightItems(${sliceSource(0, 32)})`);
  const narrative = evaluate(`PBI.pages.capa.narrative(${sliceSource(0, 32)})`);
  const signals = evaluate(`(() => {
    const d = PBI.pages.trending.controlData(${sliceSource(0, 32)});
    return d.rates.filter(r => r > d.ucl || r < d.lcl).length;
  })()`);
  assert.ok(items.length >= narrative.length + 1);
  assert.deepEqual(
    items.filter(i => i[0] === 'CAPA').map(i => i[1]),
    narrative
  );
  assert.equal(items.filter(i => i[0] === 'Anomaly').length, signals);
});
