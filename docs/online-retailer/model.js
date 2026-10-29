/* Semantic model: fields, report state, the single filter context function, DAX-style measures. */
(function () {
  'use strict';
  const D = window.DATA;

  const FIELDS = {
    category: { label: 'Category', table: 'Product', values: D.CATEGORIES, get: r => D.CATEGORIES[r.cat] },
    channel: { label: 'Channel', table: 'Channel', values: D.CHANNELS, get: r => D.CHANNELS[r.ch] },
    device: { label: 'Device type', table: 'Device', values: D.DEVICES, get: r => D.DEVICES[r.dev] },
    state: {
      label: 'State',
      table: 'Geography',
      values: D.STATES.map(s => s.name).sort(),
      get: r => D.STATES[r.st].name
    },
    region: {
      label: 'Region',
      table: 'Geography',
      values: ['Midwest', 'Northeast', 'South', 'West'],
      get: r => D.STATES[r.st].region
    },
    monthName: {
      label: 'Month',
      table: 'Date',
      values: D.MONTHS.slice(3, 15).map(m => m.name),
      get: r => D.MONTHS[r.m].name
    },
    year: {
      label: 'Year',
      table: 'Date',
      values: ['2023', '2024', '2025', '2026'],
      get: r => String(D.MONTHS[r.m].year)
    },
    yq: { label: 'Quarter', table: 'Date', get: r => D.MONTHS[r.m].year + ' Qtr ' + D.MONTHS[r.m].quarter },
    qtr: { label: 'Quarter', table: 'Date', get: r => 'Qtr ' + D.MONTHS[r.m].quarter },
    ym: { label: 'Month', table: 'Date', get: r => D.MONTHS[r.m].short },
    mon: { label: 'Month', table: 'Date', get: r => D.MONTHS[r.m].name }
  };

  function defaultState() {
    return {
      page: 'p1',
      dateRel: { n: 12, unit: 'M' },
      slicerCat: [],
      slicerDevice: 'All',
      filters: {
        all: { channel: basic(), region: basic(), monthName: basic() },
        p1: { state: basic(), category: basic() },
        p2: { state: basic(), category: basic() },
        p3: { device: basic(), category: basic() }
      },
      visualFilters: {},
      selection: null,
      drill: { level: 2, mode: 'expand', parent: [], drillMode: false },
      sort: {},
      whatIf: 10,
      qna: 'revenue by category',
      tableMode: false,
      kiTab: 'influencers',
      kiTarget: 'Yes',
      kiSelected: 0,
      segSelected: null,
      focus: null,
      focusTable: false,
      spotlight: null,
      selectedVisual: null,
      bookmark: null
    };
  }
  function basic() {
    return { mode: 'basic', values: [], op: 'contains', text: '' };
  }

  let STATE = defaultState();
  const listeners = [];
  function setState(patch, meta) {
    STATE = Object.assign({}, STATE, patch);
    listeners.forEach(fn => fn(STATE, meta || {}));
  }
  function getState() {
    return STATE;
  }
  function resetState() {
    STATE = defaultState();
    listeners.forEach(fn => fn(STATE, { rebuild: true }));
  }

  function dateRange(state, shift) {
    const n = state.dateRel.n * (state.dateRel.unit === 'Y' ? 12 : 1);
    const end = D.LAST_MONTH + (shift || 0);
    return [Math.max(0, end - n + 1), end];
  }
  function rangeLabel(state) {
    const [a, b] = dateRange(state);
    const s = D.MONTHS[a],
      e = D.MONTHS[b];
    const lastDay = new Date(e.year, e.month, 0).getDate();
    return s.month + '/1/' + s.year + ' - ' + e.month + '/' + lastDay + '/' + e.year;
  }

  function filterPredicate(f, field) {
    const get = FIELDS[field].get;
    if (f.mode === 'advanced') {
      const text = (f.text || '').toLowerCase();
      if (!text) return null;
      return r => {
        const v = get(r).toLowerCase();
        if (f.op === 'contains') return v.includes(text);
        if (f.op === 'does not contain') return !v.includes(text);
        if (f.op === 'starts with') return v.startsWith(text);
        if (f.op === 'is') return v === text;
        if (f.op === 'is not') return v !== text;
        return true;
      };
    }
    if (!f.values || f.values.length === 0) return null;
    const set = new Set(f.values);
    return r => set.has(get(r));
  }

  /* The one filter context: slicers, filter pane (all pages, page, visual), cross-filter selection.
     opts.vid: the visual asking. opts.ignoreSelection: skip cross-filter. opts.shift: month shift for PY.
     opts.ignoreDate: skip the date slicer. opts.page: page id override. */
  function filterContext(opts) {
    const o = opts || {};
    const s = STATE;
    const preds = [];
    if (!o.ignoreDate) {
      const [a, b] = dateRange(s, o.shift);
      preds.push(r => r.m >= a && r.m <= b);
    }
    if (s.slicerCat.length) {
      const set = new Set(s.slicerCat);
      preds.push(r => set.has(D.CATEGORIES[r.cat]));
    }
    if (s.slicerDevice !== 'All') preds.push(r => D.DEVICES[r.dev] === s.slicerDevice);
    const groups = [s.filters.all, s.filters[o.page || s.page] || {}, s.visualFilters[o.vid] || {}];
    groups.forEach(g =>
      Object.keys(g).forEach(field => {
        const p = filterPredicate(g[field], field);
        if (p) preds.push(p);
      })
    );
    const sel = s.selection;
    if (sel && !o.ignoreSelection && sel.vid !== o.vid && sel.page === s.page) {
      const set = new Set(sel.values);
      const get = FIELDS[sel.field].get;
      const timeField = ['ym', 'yq', 'year'].includes(sel.field);
      if (o.shift && timeField) preds.push(r => set.has(get({ m: r.m - o.shift })));
      else preds.push(r => set.has(get(r)));
    }
    if (o.extra) o.extra.forEach(p => preds.push(p));
    return r => {
      for (let i = 0; i < preds.length; i++) if (!preds[i](r)) return false;
      return true;
    };
  }

  function rows(opts) {
    return D.SALES.filter(filterContext(opts));
  }
  function customers(opts) {
    return D.CUSTOMERS.filter(filterContext(opts));
  }

  function totals(list) {
    const t = { rev: 0, cogs: 0, ord: 0, ret: 0, ses: 0, pv: 0, atc: 0, chk: 0, newOrd: 0 };
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      t.rev += r.rev;
      t.cogs += r.cogs;
      t.ord += r.ord;
      t.ret += r.ret;
      t.ses += r.ses;
      t.pv += r.pv;
      t.atc += r.atc;
      t.chk += r.chk;
      t.newOrd += r.newOrd;
    }
    return t;
  }
  function groupBy(list, keyFn) {
    const map = new Map();
    list.forEach(r => {
      const k = keyFn(r);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(r);
    });
    const out = new Map();
    map.forEach((v, k) => out.set(k, totals(v)));
    return out;
  }

  const div = (a, b) => (b ? a / b : null);
  const MEASURES = {
    revenue: { label: 'Revenue', fmt: 'cur', f: t => t.rev, dax: 'Revenue = SUM ( Sales[Revenue] )' },
    orders: { label: 'Orders', fmt: 'num', f: t => t.ord, dax: 'Orders = SUM ( Sales[Order Count] )' },
    aov: { label: 'AOV', fmt: 'cur2', f: t => div(t.rev, t.ord), dax: 'AOV = DIVIDE ( [Revenue], [Orders] )' },
    conversion: {
      label: 'Conversion rate',
      fmt: 'pct2',
      f: t => div(t.ord, t.ses),
      dax: 'Conversion Rate =\nDIVIDE (\n    [Orders],\n    SUM ( Sessions[Sessions] )\n)'
    },
    margin: {
      label: 'Gross margin %',
      fmt: 'pct',
      f: t => div(t.rev - t.cogs, t.rev),
      dax: 'Gross Margin % =\nDIVIDE (\n    [Revenue] - SUM ( Sales[COGS] ),\n    [Revenue]\n)'
    },
    returnRate: {
      label: 'Return rate',
      fmt: 'pct',
      invert: true,
      f: t => div(t.ret, t.ord),
      dax: 'Return Rate =\nDIVIDE (\n    SUM ( Sales[Returned Orders] ),\n    [Orders]\n)'
    },
    sessions: { label: 'Sessions', fmt: 'num', f: t => t.ses, dax: 'Sessions = SUM ( Sessions[Sessions] )' },
    newOrders: {
      label: 'New customer orders',
      fmt: 'num',
      f: t => t.newOrd,
      dax: 'New Customer Orders =\nCALCULATE (\n    [Orders],\n    Sales[Customer Type] = "New"\n)'
    },
    returningOrders: {
      label: 'Returning customer orders',
      fmt: 'num',
      f: t => t.ord - t.newOrd,
      dax: 'Returning Customer Orders =\nCALCULATE (\n    [Orders],\n    Sales[Customer Type] = "Returning"\n)'
    },
    grossProfit: {
      label: 'Gross profit',
      fmt: 'cur',
      f: t => t.rev - t.cogs,
      dax: 'Gross Profit = [Revenue] - SUM ( Sales[COGS] )'
    },
    cartAbandon: {
      label: 'Cart abandonment rate',
      fmt: 'pct',
      f: t => div(t.atc - t.ord, t.atc),
      dax: 'Cart Abandonment Rate =\nDIVIDE (\n    SUM ( Sessions[Add To Cart] ) - [Orders],\n    SUM ( Sessions[Add To Cart] )\n)'
    }
  };
  function pyDax(key) {
    const name = daxName(key);
    return (
      name +
      ' PY =\nCALCULATE (\n    [' +
      name +
      "],\n    SAMEPERIODLASTYEAR ( 'Date'[Date] )\n)\n\n" +
      name +
      ' vs PY % =\nDIVIDE (\n    [' +
      name +
      '] - [' +
      name +
      ' PY],\n    [' +
      name +
      ' PY]\n)'
    );
  }
  function daxName(key) {
    return MEASURES[key].dax.split(' =')[0];
  }

  function fmt(v, kind) {
    if (v === null || v === undefined || isNaN(v)) return '(Blank)';
    const abs = Math.abs(v);
    const short = (x, d) => {
      if (abs >= 1e9) return (x / 1e9).toFixed(2) + 'bn';
      if (abs >= 1e6) return (x / 1e6).toFixed(d === undefined ? 2 : d) + 'M';
      if (abs >= 1e3) return (x / 1e3).toFixed(d === undefined ? 1 : d) + 'K';
      return String(Math.round(x));
    };
    switch (kind) {
      case 'cur':
        return (v < 0 ? '-$' : '$') + short(abs);
      case 'cur2':
        return '$' + v.toFixed(2);
      case 'pct':
        return (v * 100).toFixed(1) + '%';
      case 'pct2':
        return (v * 100).toFixed(2) + '%';
      case 'num':
        return short(v);
      case 'int':
        return Math.round(v).toLocaleString('en-US');
      case 'curFull':
        return '$' + Math.round(v).toLocaleString('en-US');
      default:
        return String(v);
    }
  }
  function fmtMeasure(key, v) {
    return fmt(v, MEASURES[key].fmt);
  }

  window.MODEL = {
    FIELDS,
    MEASURES,
    getState,
    setState,
    resetState,
    onChange: fn => listeners.push(fn),
    dateRange,
    rangeLabel,
    filterContext,
    rows,
    customers,
    totals,
    groupBy,
    fmt,
    fmtMeasure,
    pyDax,
    daxName,
    basic,
    defaultState
  };
})();
