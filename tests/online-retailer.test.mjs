import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardScripts } from '../tools/dashboards.mjs';

const SCRIPTS = ['data.js', 'model.js', 'frame.js', 'visuals.js', 'tilemap.js', 'retention.js', 'whatif.js', 'qna.js'];

// Minimal DOM: enough for frame.js to build an export link, a toast and a dialog.
function fakeDom() {
  const appended = [];
  const element = () => ({
    style: {},
    innerHTML: '',
    click() {},
    remove() {},
    addEventListener() {},
    querySelector: () => ({})
  });
  const document = {
    addEventListener() {},
    createElement: element,
    body: { appendChild: el => appended.push(el) }
  };
  return { document, appended };
}

function load() {
  const dom = fakeDom();
  const evaluate = loadDashboardScripts('online-retailer', SCRIPTS, {
    document: dom.document,
    Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    setTimeout: () => 0
  });
  return { evaluate, appended: dom.appended };
}

const functionTitleDef = () =>
  `({
    id: 'combo-test',
    title: () => 'Revenue and gross margin % by month',
    dax: ['Revenue = SUM ( Sales[Revenue] )'],
    data: () => ({ columns: ['Month', 'Revenue'], rows: [['Oct 2025', 1]] })
  })`;

test('export data names the CSV from a function-valued title', () => {
  const { evaluate, appended } = load();
  evaluate(`FRAME.exportCsv(${functionTitleDef()})`);
  const link = appended.find(el => el.download);
  assert.equal(link.download, 'Revenue_and_gross_margin_by_month_data.csv');
});

test('View DAX dialog header shows the resolved function-valued title', () => {
  const { evaluate, appended } = load();
  evaluate(`FRAME.showDax(${functionTitleDef()})`);
  assert.match(appended[0].innerHTML, /View DAX: Revenue and gross margin % by month</);
});

test('cross-filter source in the filter summary uses the resolved title', () => {
  const { evaluate } = load();
  const lines = evaluate(`(() => {
    FRAME.registry['combo-test'] = ${functionTitleDef()};
    MODEL.setState({ selection: { vid: 'combo-test', field: 'ym', values: ['Dec 2025'], page: MODEL.getState().page } });
    return FRAME.describeFilters({ id: 'other' });
  })()`);
  assert.ok(lines.some(l => l.includes('Cross-filter from Revenue and gross margin % by month')));
});
