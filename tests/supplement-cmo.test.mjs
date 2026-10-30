import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardScripts } from '../tools/dashboards.mjs';

function loadModel() {
  return loadDashboardScripts('supplement-cmo', ['data.js', 'model.js', 'analytics.js']);
}

test('a batch selection limits OOS records to the selected batches', () => {
  const evaluate = loadModel();
  const result = JSON.parse(
    evaluate(`(() => {
      initFilters(VIS);
      S.page = 'quality';
      S.selection = { source: 'dispo', keys: [{ month: '2026-09', disposition: 'Released with deviation' }] };
      const c = ctx('oosTrend');
      const selectedIds = new Set(c.batches.map(b => b.id));
      const weeks = [];
      for (let w = 0; w <= D.LAST_WEEK; w++) weeks.push(w);
      const rates = weeklyOosSeries(c, weeks).map(p => p.value).filter(v => v !== null);
      return JSON.stringify({
        batches: c.batches.length,
        foreignOos: c.oos.filter(o => !selectedIds.has(o.batchId)).length,
        maxRate: Math.max(...rates)
      });
    })()`)
  );
  assert.equal(result.batches, 3);
  assert.equal(result.foreignOos, 0);
  assert.ok(result.maxRate <= 1, `weekly OOS rate ${result.maxRate} exceeds 100%`);
});
