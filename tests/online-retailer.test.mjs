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
    querySelector: () => element(),
    querySelectorAll: () => []
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
    echarts: { init: el => ({ setOption() {}, getDom: () => el, dispose() {} }) },
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

// Renders the Q&A visual for a question under the default state and returns its table rows.
function qnaAnswer(question) {
  const { evaluate } = load();
  const json = evaluate(`(() => {
    MODEL.setState({ qna: ${JSON.stringify(question)} });
    const def = QNA.qnaVisual('qna-test');
    def.render(document.createElement('div'), def);
    return JSON.stringify(def.data().rows.map(([name, value]) => [name, Math.round(value)]));
  })()`);
  return JSON.parse(json);
}

test('Q&A top 1 month by revenue returns the highest month, December 2025', () => {
  assert.deepEqual(qnaAnswer('top 1 month by revenue'), [['Dec 2025', 24966857]]);
});

test('Q&A top 3 months by revenue are ranked by value and listed chronologically', () => {
  assert.deepEqual(qnaAnswer('top 3 month by revenue'), [
    ['Nov 2025', 20729714],
    ['Dec 2025', 24966857],
    ['Aug 2026', 17219106]
  ]);
});

test('Q&A bottom 2 months by revenue returns the two lowest months', () => {
  assert.deepEqual(qnaAnswer('bottom 2 month by revenue'), [
    ['Jan 2026', 11642481],
    ['Feb 2026', 10639216]
  ]);
});

test('Q&A month without Top N still lists all 12 months in order', () => {
  const rows = qnaAnswer('revenue by month');
  assert.equal(rows.length, 12);
  assert.deepEqual(rows[0], ['Oct 2025', 14408485]);
  assert.deepEqual(rows[11], ['Sep 2026', 15125834]);
});

// Renders key influencers for a churn target under the default state and returns the explanation.
function influencerNote(target) {
  const { evaluate } = load();
  return evaluate(`(() => {
    MODEL.setState({ kiTarget: '${target}', kiTab: 'influencers' });
    const def = RETENTION.keyInfluencers('ki-test');
    const body = document.createElement('div');
    def.render(body, def);
    return body.innerHTML.match(/class="ki-note">(.*?)<\\/div>/)[1];
  })()`);
}

test('key influencers note for churn Yes describes customers who churned', () => {
  assert.equal(
    influencerNote('Yes'),
    '62.6% of customers where delivery days is more than 5 churned (449 customers). ' +
      'Among the other customers, 37.8% churned.'
  );
});

test('key influencers note for churn No describes customers who did not churn', () => {
  assert.equal(
    influencerNote('No'),
    '73.4% of customers where first order category is Beauty did not churn (192 customers). ' +
      'Among the other customers, 53.7% did not churn.'
  );
});
