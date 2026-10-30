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

test('the narrative counts releases by release date', () => {
  const evaluate = loadModel();
  const result = JSON.parse(
    evaluate(`(() => {
      initFilters(VIS);
      const releasedIn = (y, m) =>
        D.batches.filter(b => {
          const p = U.partsOf(b.releaseDay);
          return isReleased(b) && p.y === y && p.m === m;
        }).length;
      return JSON.stringify({
        august: releasedIn(2026, 8),
        september: releasedIn(2026, 9),
        narrative: smartNarrative(ctx('narrative'))
      });
    })()`)
  );
  assert.equal(result.august, 156);
  assert.equal(result.september, 151);
  assert.ok(
    result.narrative.includes('<b>151</b> batches were released in September, <b>3.2%</b> fewer than in August.'),
    result.narrative.join('\n')
  );
});

test('the release cycle time DAX filters on the same released dispositions as the measure', () => {
  const evaluate = loadModel();
  const result = JSON.parse(
    evaluate(`(() => {
      const released = D.batches.filter(isReleased);
      const mean = rows => rows.reduce((a, b) => a + b.releaseDays, 0) / rows.length;
      return JSON.stringify({
        total: D.batches.length,
        released: released.length,
        withReleaseDay: D.batches.filter(b => b.releaseDay !== undefined && b.releaseDay !== null).length,
        measure: MEASURES.cycle.f({ batches: D.batches }),
        releasedMean: mean(released),
        allMean: mean(D.batches),
        dax: MEASURES.cycle.dax
      });
    })()`)
  );
  assert.equal(result.total, 3214);
  assert.equal(result.withReleaseDay, 3214);
  assert.equal(result.released, 3144);
  assert.equal(result.measure, result.releasedMean);
  assert.notEqual(result.measure, result.allMean);
  assert.match(result.dax, /Batches\[Disposition\] IN \{ "Released", "Released with deviation" \}/);
  assert.doesNotMatch(result.dax, /NOT ISBLANK \( Batches\[Release Date\] \)/);
});
