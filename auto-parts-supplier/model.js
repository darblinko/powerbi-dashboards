/* Semantic model: fields, table relationships, filter evaluation, measures, DAX text, formatting. */
(function () {
  'use strict';
  const D = window.PBI_DATA;
  const T = D.tables;

  const THEME = {
    name: 'City park',
    colors: ['#1F7A5C', '#2E86C1', '#F2A541', '#7CB342', '#3BB3B8', '#8E6BB4', '#E06A4E', '#5D6D7E'],
    navy: '#14213D',
    increase: '#1AAB40', decrease: '#D64554', total: '#2E86C1',
    good: '#107C10', bad: '#D13438', warn: '#C19C00'
  };

  const FIELDS = {
    'Fiscal year': { key: 'fy', values: () => ['FY26'] },
    Plant: { key: 'plant', values: () => D.plants.map(p => p.name) },
    Process: { key: 'process', values: () => ['Machining', 'Stamping'] },
    Line: { key: 'line', values: () => D.lines.map(l => l.id) },
    Machine: { key: 'machine', values: () => D.machines.map(m => m.id) },
    Shift: { key: 'shift', values: () => ['A', 'B', 'C'], label: v => 'Shift ' + v },
    Month: { key: 'month', values: () => D.months.map(m => m.idx), label: v => D.months[v].label },
    Quarter: { key: 'quarter', values: () => D.quarters },
    Reason: { key: 'reason', display: 'Downtime reason', values: () => D.reasons },
    Category: { key: 'category', display: 'Cost category', values: () => D.categories },
    Supplier: { key: 'supplier', values: () => D.suppliers.map(s => s.name) },
    Tier: { key: 'tier', display: 'Supplier tier', values: () => ['Tier 2', 'Tier 3', 'Distributor'] },
    Commodity: { key: 'commodity', values: () => [...new Set(D.suppliers.map(s => s.commodity))].sort() },
    PPAP: { key: 'ppap', display: 'PPAP status', values: () => ['Approved', 'Interim', 'Pending', 'Rejected'] },
    OEM: { key: 'oem', display: 'Customer', values: () => D.oems }
  };
  const TABLE_FIELDS = {
    Production: ['Plant', 'Process', 'Line', 'Machine', 'Shift', 'Month', 'Quarter'],
    Downtime: ['Plant', 'Process', 'Line', 'Machine', 'Shift', 'Month', 'Quarter', 'Reason'],
    Cost: ['Plant', 'Month', 'Quarter', 'Category'],
    Receipts: ['Plant', 'Month', 'Quarter', 'Supplier', 'Tier', 'Commodity', 'PPAP'],
    Shipments: ['Plant', 'Month', 'Quarter', 'OEM'],
    EightD: ['Plant', 'Month', 'Quarter', 'Supplier', 'Tier', 'OEM'],
    Maintenance: ['Plant', 'Process', 'Line', 'Machine', 'Month', 'Quarter']
  };
  const TABLE_SETS = Object.fromEntries(Object.entries(TABLE_FIELDS).map(([t, f]) => [t, new Set(f)]));

  const ROLES = [
    { name: 'All plants', plant: null, dax: '(no table filter)', members: 'grp-ops-leadership' },
    { name: 'Plant Manager - Michigan', plant: 'Michigan', dax: "'Plant'[PlantName] = \"Michigan\"", members: 'grp-pm-michigan' },
    { name: 'Plant Manager - Monterrey', plant: 'Monterrey', dax: "'Plant'[PlantName] = \"Monterrey\"", members: 'grp-pm-monterrey' },
    { name: 'Plant Manager - Wroclaw', plant: 'Wroclaw', dax: "'Plant'[PlantName] = \"Wroclaw\"", members: 'grp-pm-wroclaw' }
  ];

  function fieldDisplay(field) { return (FIELDS[field] && FIELDS[field].display) || field; }
  function valueLabel(field, v) {
    const f = FIELDS[field];
    if (v === null || v === undefined) return '(Blank)';
    return f && f.label ? f.label(v) : String(v);
  }
  function fieldValues(field, rolePlant) {
    const all = FIELDS[field].values();
    if (!rolePlant) return all;
    if (field === 'Plant') return all.filter(v => v === rolePlant);
    if (field === 'Line') return D.lines.filter(l => l.plant === rolePlant).map(l => l.id);
    if (field === 'Machine') return D.machines.filter(m => m.plant === rolePlant).map(m => m.id);
    return all;
  }

  /* filters: array of { field, values: Set }. A filter on a field the table does not carry
     does not propagate, as with an inactive relationship. */
  function filterRows(table, filters) {
    const fieldSet = TABLE_SETS[table];
    const active = filters.filter(f => fieldSet.has(f.field)).map(f => ({ key: FIELDS[f.field].key, values: f.values }));
    const rows = T[table];
    if (!active.length) return rows;
    return rows.filter(r => active.every(f => f.values.has(r[f.key])));
  }
  function groupBy(rows, field) {
    const key = FIELDS[field] ? FIELDS[field].key : field;
    const map = new Map();
    rows.forEach(r => {
      const k = r[key];
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    return map;
  }

  const sum = (rows, k) => rows.reduce((s, r) => s + r[k], 0);
  const div = (a, b) => (b ? a / b : null);
  const MS = {
    availability: r => div(sum(r, 'run'), sum(r, 'planned')),
    performance: r => div(r.reduce((s, x) => s + x.total * x.ideal, 0) / 60, sum(r, 'run')),
    quality: r => div(sum(r, 'good'), sum(r, 'total')),
    oee: r => {
      const a = MS.availability(r), p = MS.performance(r), q = MS.quality(r);
      return a === null || p === null || q === null ? null : a * p * q;
    },
    scrapPct: r => div(sum(r, 'scrap'), sum(r, 'total')),
    throughput: r => (r.length ? sum(r, 'good') : null),
    downtimeHours: r => (r.length ? sum(r, 'minutes') / 60 : null),
    budget: r => (r.length ? sum(r, 'budget') : null),
    actual: r => (r.length ? sum(r, 'actual') : null),
    variance: r => (r.length ? sum(r, 'actual') - sum(r, 'budget') : null),
    variancePct: r => div(sum(r, 'actual') - sum(r, 'budget'), sum(r, 'budget')),
    premiumFreight: r => { const f = r.filter(x => x.category === 'Freight premium'); return f.length ? sum(f, 'actual') : null; },
    spend: r => (r.length ? sum(r, 'spend') : null),
    otd: r => div(sum(r, 'onTime'), sum(r, 'deliveries')),
    supplierPpm: r => { const v = div(sum(r, 'defects'), sum(r, 'received')); return v === null ? null : v * 1e6; },
    customerPpm: r => { const v = div(sum(r, 'rejects'), sum(r, 'shipped')); return v === null ? null : v * 1e6; },
    open8D: r => r.filter(x => x.status === 'Open').length,
    failures: r => r.filter(x => x.failure).length,
    mtbf: (prod, events) => div(sum(prod, 'run') / 60, events.filter(x => x.failure).length),
    mttr: events => { const f = events.filter(x => x.failure); return f.length ? sum(f, 'minutes') / 60 / f.length : null; }
  };

  /* Measures addressable by name, for Top N "By value", field parameters and tooltips. */
  const MEASURES = {
    OEE: { table: 'Production', fn: MS.oee, fmt: 'pct' },
    Availability: { table: 'Production', fn: MS.availability, fmt: 'pct' },
    Performance: { table: 'Production', fn: MS.performance, fmt: 'pct' },
    Quality: { table: 'Production', fn: MS.quality, fmt: 'pct' },
    'Scrap %': { table: 'Production', fn: MS.scrapPct, fmt: 'pct2' },
    'Downtime hours': { table: 'Downtime', fn: MS.downtimeHours, fmt: 'num' },
    Throughput: { table: 'Production', fn: MS.throughput, fmt: 'num' },
    'Budgeted cost': { table: 'Cost', fn: MS.budget, fmt: 'cur' },
    'Actual cost': { table: 'Cost', fn: MS.actual, fmt: 'cur' },
    'Cost variance': { table: 'Cost', fn: MS.variance, fmt: 'cur' },
    'Variance %': { table: 'Cost', fn: MS.variancePct, fmt: 'pct' },
    Spend: { table: 'Receipts', fn: MS.spend, fmt: 'cur' },
    'On-time delivery %': { table: 'Receipts', fn: MS.otd, fmt: 'pct' },
    'Supplier PPM': { table: 'Receipts', fn: MS.supplierPpm, fmt: 'ppm' },
    'Customer PPM': { table: 'Shipments', fn: MS.customerPpm, fmt: 'ppm' },
    'Premium freight $': { table: 'Cost', fn: MS.premiumFreight, fmt: 'cur' },
    'Open 8Ds': { table: 'EightD', fn: MS.open8D, fmt: 'int' }
  };

  const FIELD_PARAMS = [
    { name: 'OEE', target: 0.85, targetLabel: 'Target 85%' },
    { name: 'Scrap %', target: 0.02, targetLabel: 'Target 2.0%' },
    { name: 'Downtime hours', target: null },
    { name: 'Throughput', target: null }
  ];

  const DAX = {
    OEE: 'OEE =\n[Availability] * [Performance] * [Quality]',
    Availability: 'Availability =\nDIVIDE (\n    SUM ( Production[RunMinutes] ),\n    SUM ( Production[PlannedMinutes] )\n)',
    Performance: 'Performance =\nDIVIDE (\n    SUMX ( Production, Production[TotalCount] * Production[IdealCycleSec] ) / 60,\n    SUM ( Production[RunMinutes] )\n)',
    Quality: 'Quality =\nDIVIDE (\n    SUM ( Production[GoodCount] ),\n    SUM ( Production[TotalCount] )\n)',
    'Scrap %': 'Scrap % =\nDIVIDE (\n    SUM ( Production[ScrapCount] ),\n    SUM ( Production[TotalCount] )\n)',
    'Downtime hours': 'Downtime hours =\nDIVIDE ( SUM ( Downtime[DurationMinutes] ), 60 )',
    Throughput: 'Throughput =\nSUM ( Production[GoodCount] )',
    'Budgeted cost': 'Budgeted cost =\nSUM ( Cost[BudgetUSD] )',
    'Actual cost': 'Actual cost =\nSUM ( Cost[ActualUSD] )',
    'Cost variance': 'Cost variance =\n[Actual cost] - [Budgeted cost]',
    'Variance %': 'Variance % =\nDIVIDE ( [Cost variance], [Budgeted cost] )',
    'Premium freight $': 'Premium freight $ =\nCALCULATE (\n    [Actual cost],\n    Cost[Category] = "Freight premium"\n)',
    Spend: 'Spend =\nSUM ( Receipts[SpendUSD] )',
    'On-time delivery %': 'On-time delivery % =\nDIVIDE (\n    SUM ( Receipts[OnTimeDeliveries] ),\n    SUM ( Receipts[Deliveries] )\n)',
    'Supplier PPM': 'Supplier PPM =\nDIVIDE (\n    SUM ( Receipts[DefectQty] ),\n    SUM ( Receipts[ReceivedQty] )\n) * 1000000',
    'Customer PPM': 'Customer PPM =\nDIVIDE (\n    SUM ( Shipments[RejectedQty] ),\n    SUM ( Shipments[ShippedQty] )\n) * 1000000',
    'Open 8Ds': 'Open 8Ds =\nCALCULATE (\n    COUNTROWS ( EightD ),\n    EightD[Status] = "Open"\n) + 0',
    'MTBF (h)': 'MTBF (h) =\nVAR RunHours =\n    DIVIDE ( SUM ( Production[RunMinutes] ), 60 )\nVAR Failures =\n    CALCULATE ( COUNTROWS ( Downtime ), Downtime[IsFailure] = TRUE () )\nRETURN\n    DIVIDE ( RunHours, Failures )',
    'MTTR (h)': 'MTTR (h) =\nCALCULATE (\n    DIVIDE ( SUM ( Downtime[DurationMinutes] ) / 60, COUNTROWS ( Downtime ) ),\n    Downtime[IsFailure] = TRUE ()\n)',
    'Failure events': 'Failure events =\nCALCULATE (\n    COUNTROWS ( Downtime ),\n    Downtime[IsFailure] = TRUE ()\n) + 0',
    'Maintenance orders': 'Maintenance orders =\nCOUNTROWS ( Maintenance ) + 0',
    'Cumulative %': 'Cumulative % =\nVAR CurrentHours = [Downtime hours]\nVAR AllHours =\n    CALCULATE ( [Downtime hours], ALL ( Downtime[Reason] ) )\nVAR RunningHours =\n    SUMX (\n        FILTER (\n            ALL ( Downtime[Reason] ),\n            [Downtime hours] >= CurrentHours\n        ),\n        [Downtime hours]\n    )\nRETURN\n    DIVIDE ( RunningHours, AllHours )',
    'Plant KPI': "Plant KPI = {\n    ( \"OEE\", NAMEOF ( 'Measures'[OEE] ), 0 ),\n    ( \"Scrap %\", NAMEOF ( 'Measures'[Scrap %] ), 1 ),\n    ( \"Downtime hours\", NAMEOF ( 'Measures'[Downtime hours] ), 2 ),\n    ( \"Throughput\", NAMEOF ( 'Measures'[Throughput] ), 3 )\n}",
    'Supplier score': 'Supplier score =\nVAR OtdScore = [On-time delivery %] * 50\nVAR PpmScore =\n    50 * MAX ( 0, 1 - DIVIDE ( [Supplier PPM], 1000 ) )\nRETURN\n    ROUND ( OtdScore + PpmScore, 0 )',
    'Visible rows': 'Visible rows =\nCOUNTROWS ( Production ) + COUNTROWS ( Downtime )\n    + COUNTROWS ( Cost ) + COUNTROWS ( Receipts )\n    + COUNTROWS ( Shipments ) + COUNTROWS ( EightD )\n    + COUNTROWS ( Maintenance )',
    'Effective role': 'Effective role =\nIF (\n    ISFILTERED ( \'Plant\'[PlantName] ),\n    SELECTEDVALUE ( \'Plant\'[PlantName], "Multiple plants" ),\n    "All plants"\n)',
    'Plants visible': "Plants visible =\nDISTINCTCOUNT ( 'Plant'[PlantName] )"
  };

  function compact(v, decimalsSmall) {
    const a = Math.abs(v);
    const s = (x, d) => x.toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
    if (a >= 1e9) return s(v / 1e9, a >= 1e11 ? 0 : 2) + 'bn';
    if (a >= 1e6) return s(v / 1e6, a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2) + 'M';
    if (a >= 1e3) return s(v / 1e3, a >= 1e5 ? 0 : a >= 1e4 ? 1 : 2) + 'K';
    return v.toFixed(decimalsSmall === undefined ? 0 : decimalsSmall);
  }
  function fmt(v, kind) {
    if (v === null || v === undefined || Number.isNaN(v)) return '(Blank)';
    switch (kind) {
      case 'pct': return (v * 100).toFixed(1) + '%';
      case 'pct2': return (v * 100).toFixed(2) + '%';
      case 'cur': return (v < 0 ? '-$' : '$') + compact(Math.abs(v));
      case 'curFull': return (v < 0 ? '-$' : '$') + Math.round(Math.abs(v)).toLocaleString('en-US');
      case 'num': return compact(v, 1);
      case 'int': return Math.round(v).toLocaleString('en-US');
      case 'ppm': return Math.round(v).toLocaleString('en-US');
      case 'hrs': return v.toFixed(1);
      default: return String(v);
    }
  }
  function measureFmt(name) { return MEASURES[name] ? MEASURES[name].fmt : 'num'; }

  window.PBI_MODEL = Object.freeze({
    THEME, FIELDS, TABLE_FIELDS, TABLE_SETS, ROLES, MS, MEASURES, FIELD_PARAMS, DAX,
    fieldDisplay, valueLabel, fieldValues, filterRows, groupBy, fmt, measureFmt, compact
  });
})();
