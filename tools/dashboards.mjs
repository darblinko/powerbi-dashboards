// Runs each dashboard's data.js outside the browser so the tests and the chart build read the
// same generated tables the pages render.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DOCS = fileURLToPath(new URL('../docs/', import.meta.url));

export const DASHBOARDS = [
  {
    dir: 'online-retailer',
    title: 'Online retailer',
    global: 'DATA',
    period: data => `${data.MONTHS.length} months`,
    facts: data => ({ Sales: data.SALES, Customers: data.CUSTOMERS })
  },
  {
    dir: 'auto-parts-supplier',
    title: 'Auto parts',
    global: 'PBI_DATA',
    period: data => `${data.months.length} months`,
    facts: data => data.tables
  },
  {
    dir: 'supplement-cmo',
    title: 'Supplements',
    global: 'DATA',
    period: data => `${data.WEEKS} weeks`,
    facts: data => ({ Batches: data.batches, OOS: data.oos, Schedule: data.schedule })
  },
  {
    dir: 'device-quality',
    title: 'Device quality',
    global: 'PBIDATA',
    period: data => `${data.MONTHS.length} months`,
    facts: data => ({
      Complaints: data.complaints,
      Shipments: data.shipments,
      CAPA: data.capa,
      NCR: data.ncr,
      Production: data.prod
    })
  }
];

export function dataScriptPath(dir) {
  return `${DOCS}${dir}/data.js`;
}

export function loadDashboardData(dashboard) {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(dataScriptPath(dashboard.dir), 'utf8'), context, {
    filename: `${dashboard.dir}/data.js`
  });
  const data = context.window[dashboard.global];
  if (!data) throw new Error(`docs/${dashboard.dir}/data.js did not set window.${dashboard.global}`);
  return data;
}

export function factRowCounts(dashboard, data) {
  return Object.fromEntries(Object.entries(dashboard.facts(data)).map(([name, rows]) => [name, rows.length]));
}
