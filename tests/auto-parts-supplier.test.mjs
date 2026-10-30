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

test('Get insights reads only the rows the selected role can see', () => {
  const evaluate = load();
  const found = evaluate(`(() => {
    const D = window.PBI_DATA, M = window.PBI_MODEL;
    const wroclawSuppliers = new Set(D.tables.Receipts.filter(r => r.plant === 'Wroclaw').map(r => r.supplier));
    const f = M.insightFindings('Wroclaw');
    return {
      downtimeMachinePlant: D.machines.find(m => m.id === f.downtime.machine).plant,
      supplierSeenAtWroclaw: wroclawSuppliers.has(f.ppm.supplier),
      costPlant: f.cost.row.plant,
      allPlantsCost: M.insightFindings(null).cost.row.plant
    };
  })()`);
  assert.equal(found.downtimeMachinePlant, 'Wroclaw');
  assert.equal(found.supplierSeenAtWroclaw, true);
  assert.equal(found.costPlant, 'Wroclaw');
  assert.equal(found.allPlantsCost, 'Michigan');
});

test('Get insights supplier PPM is computed from the role plant receipts only', () => {
  const evaluate = load();
  const check = evaluate(`(() => {
    const D = window.PBI_DATA, M = window.PBI_MODEL;
    const f = M.insightFindings('Wroclaw');
    const rows = D.tables.Receipts.filter(
      r => r.plant === 'Wroclaw' && r.supplier === f.ppm.supplier && r.month === f.ppm.month
    );
    return { reported: f.ppm.value, recomputed: M.MS.supplierPpm(rows) };
  })()`);
  assert.equal(check.reported, check.recomputed);
});

test('the supplier scatter play axis stays inside the Quarter filter', () => {
  const evaluate = load();
  const result = evaluate(`(() => {
    const M = window.PBI_MODEL;
    const q1 = [{ field: 'Quarter', values: new Set(['Q1 2026']) }];
    const allowed = M.playMonths(q1);
    return {
      allowed: allowed.map(i => window.PBI_DATA.months[i].label),
      unfiltered: M.playMonths([]).length,
      fromSeptember: window.PBI_DATA.months[M.clampPlayMonth(11, allowed)].label,
      inside: M.clampPlayMonth(allowed[1], allowed) === allowed[1]
    };
  })()`);
  assert.deepEqual([...result.allowed], ['Jan 2026', 'Feb 2026', 'Mar 2026']);
  assert.equal(result.unfiltered, 12);
  assert.equal(result.fromSeptember, 'Mar 2026');
  assert.equal(result.inside, true);
});
