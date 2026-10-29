import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DASHBOARDS, factRowCounts, loadDashboardData } from '../tools/dashboards.mjs';
import { buildCharts } from '../tools/build-data.mjs';

// The README and the landing page quote these counts. A change here means both need updating.
const EXPECTED_ROWS = {
  'online-retailer': { Sales: 8100, Customers: 9000 },
  'auto-parts-supplier': {
    Production: 5616,
    Downtime: 9306,
    Cost: 288,
    Receipts: 336,
    Shipments: 120,
    EightD: 109,
    Maintenance: 1831
  },
  'supplement-cmo': { Batches: 3214, OOS: 87, Schedule: 298 },
  'device-quality': { Complaints: 2559, Shipments: 905, CAPA: 211, NCR: 650, Production: 181 }
};

for (const dashboard of DASHBOARDS) {
  test(`${dashboard.dir} generates the expected fact tables`, () => {
    assert.deepEqual(factRowCounts(dashboard, loadDashboardData(dashboard)), EXPECTED_ROWS[dashboard.dir]);
  });

  test(`${dashboard.dir} generates identical data on every run`, () => {
    const first = JSON.stringify(dashboard.facts(loadDashboardData(dashboard)));
    const second = JSON.stringify(dashboard.facts(loadDashboardData(dashboard)));
    assert.equal(first, second);
  });
}

test('docs/data.json matches the generated data (run npm run build:data)', () => {
  const published = JSON.parse(readFileSync(new URL('../docs/data.json', import.meta.url), 'utf8'));
  // The round trip drops the vm realm prototypes so only the JSON content is compared.
  assert.deepEqual(published.charts, JSON.parse(JSON.stringify(buildCharts())));
});
