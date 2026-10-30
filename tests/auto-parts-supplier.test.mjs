import test from 'node:test';
import assert from 'node:assert/strict';
import { loadDashboardScripts } from '../tools/dashboards.mjs';

function load() {
  return loadDashboardScripts('auto-parts-supplier', ['data.js', 'model.js', 'state.js']);
}

test('Machine Detail keeps the source page slicers (Keep all filters)', () => {
  const evaluate = load();
  const rows = evaluate(`(() => {
    const ST = window.PBI_STATE, M = window.PBI_MODEL;
    ST.S.slicers.plant = { Quarter: new Set(['Q1 2026']), Shift: new Set(['B']) };
    const onSource = M.filterRows(
      'Production',
      ST.filterContext('plant', null).concat([{ field: 'Machine', values: new Set(['MI-M1-C01']) }])
    ).length;
    ST.startDrillthrough('MI-M1-C01');
    ST.S.page = 'machine';
    const onDetail = M.filterRows('Production', ST.filterContext('machine', 'p5-kpis')).length;
    return { onSource, onDetail };
  })()`);
  assert.deepEqual({ ...rows }, { onSource: 13, onDetail: 13 });
});
