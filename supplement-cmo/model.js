'use strict';
/* Semantic model: fields, filter context, DAX-equivalent measures, formatting. */
const D = window.DATA;
const U = D.util;

const THEME = ['#3257A8', '#37A794', '#8B3D88', '#DD6B7F', '#6B91C9', '#F5C869', '#77C4A8', '#DEA6CF'];
const FORM_COLORS = {
  Capsule: '#3257A8', Tablet: '#37A794', 'Chewable tablet': '#8B3D88', Powder: '#F5C869',
  Softgel: '#DD6B7F', Gummy: '#6B91C9'
};
const DISPOSITION_COLORS = {
  Released: '#3257A8', 'Released with deviation': '#6B91C9', Rejected: '#DD6B7F', 'On hold': '#F5C869'
};
const DISPOSITIONS = ['Released', 'Released with deviation', 'Rejected', 'On hold'];
const FONT = '"Segoe UI", "Segoe UI Web", wf_segoe-ui_normal, Tahoma, Arial, sans-serif';

const FIELD_LABELS = {
  site: 'Site', form: 'Dosage form', customer: 'Customer', product: 'Product', line: 'Line', year: 'Year',
  quarter: 'Quarter', month: 'Month', week: 'Manufacture week', monthIdx: 'Manufacture month',
  testType: 'Test type', tier: 'Customer tier', region: 'Region', disposition: 'Disposition', batchId: 'Batch ID', status: 'Status'
};

const FIELDS = {
  site: r => r.site, form: r => r.form, customer: r => r.customer, product: r => r.product, line: r => r.line,
  year: r => r.year, quarter: r => r.quarter, month: r => r.month, week: r => r.week, monthIdx: r => r.monthIdx,
  testType: r => r.testType, tier: r => r.tier, region: r => r.region, disposition: r => r.disposition,
  batchId: r => (r.batchId !== undefined ? r.batchId : r.id), status: r => r.status
};

function distinct(rows, field) {
  const counts = new Map();
  for (const r of rows) {
    const v = FIELDS[field](r);
    if (v !== undefined && v !== null) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([value, count]) => ({ value, count }));
}

const VALUES = {};
['site', 'form', 'customer', 'year', 'tier', 'region', 'line', 'disposition', 'product'].forEach(f => { VALUES[f] = distinct(D.batches, f); });
VALUES.testType = distinct(D.oos, 'testType');
VALUES.status = distinct(D.oos, 'status');

/* Report state. Replaced field-by-field through setState helpers in app.js. */
const S = {
  page: 'overview', filters: [], selection: null, drill: {}, sort: {}, spotlight: null, focus: null,
  tableView: null, selectedVisual: null, drillBatch: null, drillReturn: 'overview', sidePane: null,
  filtersCollapsed: false, keepAllFilters: true
};

function makeFilter(scope, field, extra) {
  return Object.assign({
    id: scope + ':' + (extra && extra.visual ? extra.visual + ':' : '') + (extra && extra.page ? extra.page + ':' : '') + field,
    scope, field, kind: 'basic', selected: [], adv: null, open: false, mode: 'basic', search: ''
  }, extra || {});
}

function initFilters(visualDefs) {
  const filters = [
    makeFilter('all', 'site'), makeFilter('all', 'form'), makeFilter('all', 'customer'),
    makeFilter('page', 'year', { page: 'overview' }),
    makeFilter('page', 'testType', { page: 'quality' }),
    makeFilter('page', 'tier', { page: 'customer' }),
    makeFilter('page', 'batchId', { page: 'batch', kind: 'drill' })
  ];
  for (const v of Object.values(visualDefs)) {
    for (const spec of v.filters || []) filters.push(makeFilter('visual', spec.field, Object.assign({ visual: v.id }, spec)));
  }
  S.filters = filters;
}

function filtersFor(vid, page) {
  const p = page || (vid && VIS[vid] ? VIS[vid].page : S.page);
  return S.filters.filter(f => f.scope === 'all' || (f.scope === 'page' && f.page === p) || (f.scope === 'visual' && f.visual === vid));
}

function advTest(adv, value) {
  const v = String(value).toLowerCase();
  const t = String(adv.text || '').toLowerCase();
  switch (adv.op) {
    case 'contains': return v.includes(t);
    case 'does not contain': return !v.includes(t);
    case 'starts with': return v.startsWith(t);
    case 'does not start with': return !v.startsWith(t);
    case 'is': return v === t;
    case 'is not': return v !== t;
    default: return true;
  }
}

function filterIsActive(f) {
  if (f.kind === 'relative' || f.kind === 'topn') return f.n > 0;
  if (f.kind === 'drill') return S.page === 'batch' && !!S.drillBatch;
  return f.selected.length > 0 || !!f.adv;
}

function passFilter(f, r) {
  if (f.kind === 'topn' || f.kind === 'drill') return true;
  const v = FIELDS[f.field](r);
  if (v === undefined) return true;
  if (f.kind === 'relative') {
    const max = f.field === 'week' ? D.LAST_WEEK : D.LAST_MONTH;
    return !(f.n > 0) || v >= max - f.n + 1;
  }
  if (f.selected.length && !f.selected.includes(v)) return false;
  if (f.adv) return advTest(f.adv, v);
  return true;
}

function passSelection(r, keys) {
  return keys.some(k => Object.keys(k).every(field => {
    const v = FIELDS[field](r);
    return v === undefined || v === k[field];
  }));
}

function filterRows(rows, filters, keys, extra) {
  return rows.filter(r => filters.every(f => passFilter(f, r)) && (!keys || passSelection(r, keys)) && (!extra || extra(r)));
}

/* One filter context function. Every visual reads its rows through it. */
function ctx(vid, opts) {
  const o = opts || {};
  const filters = filtersFor(vid, o.page);
  const applySel = o.selection !== false && S.selection && S.selection.source !== vid;
  const keys = applySel ? S.selection.keys : null;
  return {
    batches: filterRows(D.batches, filters, keys, o.where),
    oos: filterRows(D.oos, filters, keys, o.where),
    schedule: o.schedule ? filterRows(D.schedule, filters, keys, o.where) : []
  };
}

function hasForeignSelection(vid) {
  return !!(S.selection && S.selection.source !== vid);
}

function isKeySelected(vid, key) {
  if (!S.selection || S.selection.source !== vid) return null;
  return S.selection.keys.some(k => Object.keys(key).every(f => k[f] === key[f]) && Object.keys(k).every(f => key[f] === k[f]));
}

function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (k === undefined || k === null) continue;
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(r);
  }
  return m;
}

function groupCtx(c, keyFn) {
  const out = new Map();
  for (const [k, rows] of groupBy(c.batches, keyFn)) out.set(k, { batches: rows, oos: [] });
  for (const [k, rows] of groupBy(c.oos, keyFn)) {
    if (!out.has(k)) out.set(k, { batches: [], oos: [] });
    out.get(k).oos = rows;
  }
  return out;
}

const div = (a, b) => (b ? a / b : null);
const isReleased = b => b.disposition === 'Released' || b.disposition === 'Released with deviation';

const MEASURES = {
  released: {
    name: 'Batches released', fmt: 'int',
    dax: 'Batches released =\nCALCULATE (\n    COUNTROWS ( Batches ),\n    Batches[Disposition] IN { "Released", "Released with deviation" }\n)',
    f: c => c.batches.filter(isReleased).length
  },
  batches: { name: 'Batches', fmt: 'int', dax: 'Batches =\nCOUNTROWS ( Batches )', f: c => c.batches.length },
  rft: {
    name: 'Right first time %', fmt: 'pct', target: 0.95,
    dax: 'Right first time % =\nDIVIDE (\n    CALCULATE ( COUNTROWS ( Batches ), Batches[Right First Time] = TRUE () ),\n    COUNTROWS ( Batches )\n)',
    f: c => div(c.batches.filter(b => b.rft).length, c.batches.length)
  },
  yield: {
    name: 'Average batch yield %', fmt: 'pct', target: 0.97,
    dax: 'Average batch yield % =\nDIVIDE ( AVERAGE ( Batches[Yield %] ), 100 )',
    f: c => div(c.batches.reduce((a, b) => a + b.yieldPct, 0), c.batches.length * 100)
  },
  oosOpen: {
    name: 'OOS investigations open', fmt: 'int', target: 10, lowerIsBetter: true,
    dax: 'OOS investigations open =\nCALCULATE (\n    COUNTROWS ( \'OOS Investigations\' ),\n    \'OOS Investigations\'[Status] = "Open"\n)',
    f: c => c.oos.filter(o => o.status === 'Open').length
  },
  otif: {
    name: 'On-time-in-full %', fmt: 'pct', target: 0.95,
    dax: 'On-time-in-full % =\nVAR Shipped =\n    CALCULATE ( COUNTROWS ( Batches ), NOT ISBLANK ( Batches[OTIF Flag] ) )\nRETURN\n    DIVIDE ( CALCULATE ( COUNTROWS ( Batches ), Batches[OTIF Flag] = TRUE () ), Shipped )',
    f: c => {
      const shipped = c.batches.filter(b => b.otif !== null);
      return div(shipped.filter(b => b.otif).length, shipped.length);
    }
  },
  cycle: {
    name: 'Release cycle time days', fmt: 'dec1', target: 7, lowerIsBetter: true,
    dax: 'Release cycle time days =\nAVERAGEX (\n    FILTER ( Batches, NOT ISBLANK ( Batches[Release Date] ) ),\n    DATEDIFF ( Batches[Manufacture End Date], Batches[Release Date], DAY )\n)',
    f: c => {
      const rel = c.batches.filter(isReleased);
      return div(rel.reduce((a, b) => a + b.releaseDays, 0), rel.length);
    }
  },
  revenue: {
    name: 'Revenue', fmt: 'cur',
    dax: 'Revenue =\nCALCULATE (\n    SUM ( Batches[Revenue] ),\n    Batches[Disposition] IN { "Released", "Released with deviation" }\n)',
    f: c => c.batches.reduce((a, b) => a + b.revenue, 0)
  },
  cpmu: {
    name: 'Complaints per million units', fmt: 'dec1',
    dax: 'Complaints per million units =\nDIVIDE (\n    SUM ( Batches[Complaint Count] ),\n    CALCULATE ( SUM ( Batches[Units] ), Batches[Disposition] IN { "Released", "Released with deviation" } )\n) * 1000000',
    f: c => {
      const rel = c.batches.filter(isReleased);
      const units = rel.reduce((a, b) => a + b.units, 0);
      const comp = rel.reduce((a, b) => a + b.complaints, 0);
      return units ? (comp / units) * 1e6 : null;
    }
  },
  oosRate: {
    name: 'OOS rate %', fmt: 'pct',
    dax: 'OOS rate % =\nDIVIDE (\n    DISTINCTCOUNT ( \'OOS Investigations\'[Batch ID] ),\n    COUNTROWS ( Batches )\n)',
    f: c => div(new Set(c.oos.map(o => o.batchId)).size, c.batches.length)
  },
  oosCount: {
    name: 'OOS results', fmt: 'int', dax: 'OOS results =\nCOUNTROWS ( \'OOS Investigations\' )', f: c => c.oos.length
  }
};

function measure(key, c) { return MEASURES[key].f(c); }

function shortNum(v, digits) {
  const d = digits === undefined ? 1 : digits;
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(d) + 'bn';
  if (a >= 1e6) return (v / 1e6).toFixed(d) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(d) + 'K';
  return String(Math.round(v));
}

const FMT = {
  int: v => (v === null || v === undefined || isNaN(v) ? '(Blank)' : Math.round(v).toLocaleString('en-US')),
  pct: v => (v === null || v === undefined || isNaN(v) ? '(Blank)' : (v * 100).toFixed(1) + '%'),
  dec1: v => (v === null || v === undefined || isNaN(v) ? '(Blank)' : v.toFixed(1)),
  cur: v => (v === null || v === undefined || isNaN(v) ? '(Blank)' : '$' + shortNum(v, 2)),
  short: v => (v === null || v === undefined || isNaN(v) ? '(Blank)' : shortNum(v))
};
function fmtMeasure(key, v) { return FMT[MEASURES[key].fmt](v); }

/* Date hierarchy used by drillable time axes. */
const DATE_LEVELS = {
  year: { key: r => r.year, full: r => r.year, short: r => r.year, sortShort: r => +r.year },
  quarter: { key: r => r.quarter, full: r => r.year + ' Qtr ' + r.quarter.slice(-1), short: r => 'Qtr ' + r.quarter.slice(-1), sortShort: r => +r.quarter.slice(-1) },
  month: {
    key: r => r.month, full: r => D.MONTHS[+r.month.slice(5) - 1] + ' ' + r.year,
    short: r => D.MONTHS_LONG[+r.month.slice(5) - 1], sortShort: r => +r.month.slice(5)
  },
  week: { key: r => r.week, full: r => U.fmtDate(D.DAY0 + r.week * 7), short: r => U.fmtDate(D.DAY0 + r.week * 7), sortShort: r => r.week }
};

function drillState(vid) {
  if (!S.drill[vid]) S.drill[vid] = { level: VIS[vid].defaultLevel || 0, path: [], flat: false, mode: false };
  return S.drill[vid];
}

/* Returns category descriptors for a date-hierarchy visual at its current drill state. */
function dateAxis(vid, rows) {
  const d = drillState(vid);
  const levels = VIS[vid].hierarchy;
  const lvl = DATE_LEVELS[levels[d.level]];
  const inPath = r => d.path.every(p => DATE_LEVELS[p.level].key(r) === p.value);
  const keyOf = r => (inPath(r) ? (d.flat ? lvl.short(r) : lvl.key(r)) : undefined);
  const cats = new Map();
  for (const r of rows) {
    const k = keyOf(r);
    if (k === undefined) continue;
    const s = d.flat ? lvl.sortShort(r) : r.week;
    const cur = cats.get(k);
    if (!cur) cats.set(k, { key: k, label: d.flat ? lvl.short(r) : lvl.full(r), sort: s });
    else if (s < cur.sort) cur.sort = s;
  }
  const list = [...cats.values()].sort((a, b) => a.sort - b.sort);
  return { cats: list, keyOf, levelName: levels[d.level], field: d.flat ? null : levels[d.level] };
}

function sortState(vid) {
  return S.sort[vid] || VIS[vid].defaultSort || null;
}

/* Visual registry. Visual files register definitions; app.js lays them out. */
const VIS = {};
function defineVisual(def) { VIS[def.id] = def; return def; }
