/* model.js: field registry, filter context evaluation, DAX-mirroring measures, formatters. */
(function () {
  'use strict';
  const D = window.PBIDATA;
  const MI = D.MONTHS;
  const ALL = ['complaints', 'shipments', 'capa', 'ncr', 'prod'];
  const C = ['complaints'];
  const A = ['capa'];
  const productByName = {};
  D.PRODUCTS.forEach(p => {
    productByName[p.name] = p;
  });

  const model = { asOf: D.END_DAY };

  function capaStatus(r) {
    return r.closedDay != null && r.closedDay <= model.asOf ? 'Closed' : 'Open';
  }
  function daysOpen(r) {
    const end = capaStatus(r) === 'Closed' ? r.closedDay : model.asOf;
    return Math.max(0, end - r.day);
  }
  function agingBucket(r) {
    if (capaStatus(r) === 'Closed') return 'Closed';
    const d = daysOpen(r);
    return d <= 30 ? '0-30' : d <= 60 ? '31-60' : d <= 90 ? '61-90' : '90+';
  }
  function mdrClockDays(r) {
    if (r.reportable === 'Yes') return r.mdrFiled ? r.daysToMdr : r.elapsed;
    if (r.reportable === 'No') return r.daysToDecision;
    return r.elapsed;
  }
  function decisionBin(r) {
    const d = r.daysToDecision;
    if (d == null) return 'Pending';
    return d <= 10 ? '0-10 days' : d <= 20 ? '11-20 days' : d <= 30 ? '21-30 days' : 'Over 30 days';
  }
  const uniq = (rows, fn) => [...new Set(rows.map(fn))].sort();

  const FIELDS = {
    month: { label: 'Date', table: 'Date', tables: ALL, get: r => r.month },
    year: { label: 'Year', table: 'Date', tables: ALL, get: r => MI[r.month].year, values: () => [2024, 2025, 2026] },
    yq: { label: 'Quarter', table: 'Date', tables: ALL, get: r => MI[r.month].yq },
    quarter: { label: 'Quarter', table: 'Date', tables: ALL, get: r => 'Qtr ' + MI[r.month].q },
    monthName: { label: 'Month', table: 'Date', tables: ALL, get: r => MI[r.month].name },
    product: {
      label: 'Product',
      table: 'Product',
      tables: ALL,
      get: r => r.product,
      values: () => D.PRODUCTS.map(p => p.name)
    },
    family: {
      label: 'Product Family',
      table: 'Product',
      tables: ALL,
      get: r => productByName[r.product].family,
      values: () => ['Infusion device', 'Accessory']
    },
    region: {
      label: 'Region',
      table: 'Region',
      tables: ['complaints', 'shipments', 'capa'],
      get: r => r.region,
      values: () => D.REGIONS
    },
    category: {
      label: 'Complaint Category',
      table: 'Complaints',
      tables: C,
      get: r => r.category,
      values: () => D.CATEGORIES
    },
    failureMode: {
      label: 'Failure Mode',
      table: 'Complaints',
      tables: C,
      get: r => r.failureMode,
      values: () => Object.keys(D.FM_TREE)
    },
    subMode: {
      label: 'Failure Sub Mode',
      table: 'Complaints',
      tables: C,
      get: r => r.subMode,
      values: () => [].concat(...Object.values(D.FM_TREE))
    },
    reportable: {
      label: 'Reportable',
      table: 'Complaints',
      tables: C,
      get: r => r.reportable,
      values: () => ['Yes', 'No', 'Pending']
    },
    assessed: { label: 'Assessed', table: 'Complaints', tables: C, get: r => r.assessed, values: () => ['Yes', 'No'] },
    mdrWithin30: {
      label: 'MDR Filed Within 30 Days',
      table: 'Complaints',
      tables: C,
      get: r => (r.mdrFiled && r.daysToMdr <= 30 ? 'Yes' : 'No'),
      values: () => ['Yes', 'No']
    },
    received: { label: 'Received', table: 'Complaints', tables: C, get: () => 'Yes', values: () => ['Yes'] },
    decisionBin: {
      label: 'Days to MDR Decision',
      table: 'Complaints',
      tables: C,
      get: decisionBin,
      values: () => ['0-10 days', '11-20 days', '21-30 days', 'Over 30 days', 'Pending']
    },
    complaintId: { label: 'Complaint ID', table: 'Complaints', tables: C, get: r => r.id, values: null },
    complaintStatus: {
      label: 'Complaint Status',
      table: 'Complaints',
      tables: C,
      get: r => r.status,
      values: () => ['Closed', 'Open, investigation', 'Open, MDR decision pending']
    },
    source: { label: 'CAPA Source', table: 'CAPA', tables: A, get: r => r.source, values: () => D.SOURCES },
    rootCause: {
      label: 'Root Cause Category',
      table: 'CAPA',
      tables: A,
      get: r => r.rootCause,
      values: () => uniq(D.capa, r => r.rootCause)
    },
    process: {
      label: 'Process',
      table: 'CAPA',
      tables: A,
      get: r => r.process,
      values: () => uniq(D.capa, r => r.process)
    },
    owner: {
      label: 'Owner Department',
      table: 'CAPA',
      tables: A,
      get: r => r.owner,
      values: () => uniq(D.capa, r => r.owner)
    },
    capaStatus: { label: 'CAPA Status', table: 'CAPA', tables: A, get: capaStatus, values: () => ['Open', 'Closed'] },
    agingBucket: {
      label: 'Aging Bucket',
      table: 'CAPA',
      tables: A,
      get: agingBucket,
      values: () => ['0-30', '31-60', '61-90', '90+', 'Closed']
    },
    capaId: { label: 'CAPA ID', table: 'CAPA', tables: A, get: r => r.id, values: null },
    effectiveness: {
      label: 'Effectiveness Check',
      table: 'CAPA',
      tables: A,
      get: r => r.effectiveness,
      values: () => ['Effective', 'Not effective', 'Verification pending', 'Not started']
    },
    defect: { label: 'NCR Defect Type', table: 'NCR', tables: ['ncr'], get: r => r.defect, values: () => D.DEFECTS }
  };

  // A filter object is { field, type: 'basic'|'advanced'|'exclude', values: Set, op, text }.
  function predicate(f) {
    if (!f) return null;
    if (f.type === 'advanced') {
      if (!f.text) return null;
      const t = String(f.text).toLowerCase();
      const ops = {
        contains: v => String(v).toLowerCase().includes(t),
        'does not contain': v => !String(v).toLowerCase().includes(t),
        'starts with': v => String(v).toLowerCase().startsWith(t),
        is: v => String(v).toLowerCase() === t,
        'is not': v => String(v).toLowerCase() !== t
      };
      return ops[f.op] || null;
    }
    if (!f.values || f.values.size === 0) return null;
    if (f.type === 'exclude') return v => !f.values.has(v);
    return v => f.values.has(v);
  }
  function isActive(f) {
    return predicate(f) != null;
  }
  function describe(f) {
    if (!isActive(f)) return 'is (All)';
    if (f.type === 'advanced') return f.op + ' "' + f.text + '"';
    const vals = [...f.values];
    const prefix = f.type === 'exclude' ? 'is not ' : 'is ';
    return prefix + (vals.length <= 2 ? vals.join(', ') : vals.length + ' selected');
  }

  function rows(table, ctx) {
    const src = D[table];
    const rel = ctx.filter(c => FIELDS[c.field].tables.includes(table));
    if (!rel.length) return src;
    return src.filter(r => {
      for (let i = 0; i < rel.length; i++) if (!rel[i].test(FIELDS[rel[i].field].get(r))) return false;
      return true;
    });
  }
  function withMonth(ctx, test) {
    const out = ctx.filter(c => c.field !== 'month');
    out.push({ field: 'month', test });
    out.asOf = ctx.asOf;
    return out;
  }
  function groupCount(rowsIn, fn) {
    const m = new Map();
    rowsIn.forEach(r => {
      const k = fn(r);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }
  const sum = (arr, fn) => arr.reduce((s, r) => s + fn(r), 0);

  function withAsOf(ctx, fn) {
    const prev = model.asOf;
    model.asOf = ctx.asOf != null ? ctx.asOf : prev;
    try {
      return fn();
    } finally {
      model.asOf = prev;
    }
  }
  function openCapaRows(ctx) {
    return withAsOf(ctx, () => rows('capa', ctx).filter(r => r.day <= model.asOf && capaStatus(r) === 'Open'));
  }

  const MEASURES = {
    complaintCount: {
      name: 'Complaint Count',
      kind: 'flow',
      dax: 'Complaint Count = COUNTROWS ( Complaints )',
      calc: ctx => rows('complaints', ctx).length
    },
    unitsShipped: {
      name: 'Units Shipped',
      kind: 'flow',
      dax: 'Units Shipped = SUM ( Shipments[Units] )',
      calc: ctx => sum(rows('shipments', ctx), r => r.units)
    },
    complaintRate: {
      name: 'Complaint Rate per 1K',
      kind: 'flow',
      dax: 'Complaint Rate per 1K =\nDIVIDE ( [Complaint Count], [Units Shipped] ) * 1000',
      calc: ctx => {
        const u = MEASURES.unitsShipped.calc(ctx);
        return u ? (rows('complaints', ctx).length / u) * 1000 : null;
      }
    },
    reportableCount: {
      name: 'Reportable Complaints',
      kind: 'flow',
      dax: 'Reportable Complaints =\nCALCULATE ( [Complaint Count], Complaints[Reportable] = "Yes" )',
      calc: ctx => rows('complaints', ctx).filter(r => r.reportable === 'Yes').length
    },
    mdrOnTime: {
      name: 'MDR On-Time %',
      kind: 'flow',
      dax: 'MDR On-Time % =\nDIVIDE (\n    CALCULATE (\n        COUNTROWS ( Complaints ),\n        Complaints[MDR Filed] = TRUE (),\n        Complaints[Days to MDR] <= 30\n    ),\n    CALCULATE ( COUNTROWS ( Complaints ), Complaints[MDR Filed] = TRUE () )\n)',
      calc: ctx => {
        const f = rows('complaints', ctx).filter(r => r.mdrFiled);
        return f.length ? f.filter(r => r.daysToMdr <= 30).length / f.length : null;
      }
    },
    lateMdr: {
      name: 'Late MDRs',
      kind: 'flow',
      dax: 'Late MDRs =\nCALCULATE (\n    COUNTROWS ( Complaints ),\n    Complaints[Reportable] = "Yes",\n    Complaints[Days to MDR] > 30\n)',
      calc: ctx => rows('complaints', ctx).filter(r => r.reportable === 'Yes' && r.daysToMdr > 30).length
    },
    avgDecision: {
      name: 'Avg Days to MDR Decision',
      kind: 'flow',
      dax: 'Avg Days to MDR Decision =\nAVERAGEX (\n    FILTER ( Complaints, NOT ISBLANK ( Complaints[Days to Decision] ) ),\n    Complaints[Days to Decision]\n)',
      calc: ctx => {
        const f = rows('complaints', ctx).filter(r => r.daysToDecision != null);
        return f.length ? sum(f, r => r.daysToDecision) / f.length : null;
      }
    },
    capaCount: {
      name: 'CAPA Count',
      kind: 'flow',
      dax: 'CAPA Count = COUNTROWS ( CAPA )',
      calc: ctx => rows('capa', ctx).length
    },
    openCapas: {
      name: 'Open CAPAs',
      kind: 'stock',
      dax: "Open CAPAs =\nVAR AsOf = MAX ( 'Date'[Date] )\nRETURN\n    CALCULATE (\n        COUNTROWS ( CAPA ),\n        CAPA[Open Date] <= AsOf,\n        OR ( ISBLANK ( CAPA[Closed Date] ), CAPA[Closed Date] > AsOf )\n    )",
      calc: ctx => openCapaRows(ctx).length
    },
    capaOverdue: {
      name: 'CAPA Overdue %',
      kind: 'stock',
      dax: "CAPA Overdue % =\nVAR AsOf = MAX ( 'Date'[Date] )\nVAR OverdueCount =\n    CALCULATE ( [Open CAPAs], CAPA[Due Date] < AsOf )\nRETURN\n    DIVIDE ( OverdueCount, [Open CAPAs] )",
      calc: ctx => {
        const o = openCapaRows(ctx);
        const asOf = ctx.asOf != null ? ctx.asOf : model.asOf;
        return o.length ? o.filter(r => r.dueDay < asOf).length / o.length : null;
      }
    },
    avgDaysOpen: {
      name: 'Avg Days Open',
      kind: 'stock',
      dax: "Avg Days Open =\nVAR AsOf = MAX ( 'Date'[Date] )\nRETURN\n    AVERAGEX (\n        FILTER ( CAPA, ISBLANK ( CAPA[Closed Date] ) || CAPA[Closed Date] > AsOf ),\n        DATEDIFF ( CAPA[Open Date], AsOf, DAY )\n    )",
      calc: ctx => {
        const o = openCapaRows(ctx);
        return o.length ? withAsOf(ctx, () => sum(o, daysOpen) / o.length) : null;
      }
    },
    effectivePct: {
      name: 'Effectiveness Verified %',
      kind: 'stock',
      dax: 'Effectiveness Verified % =\nDIVIDE (\n    CALCULATE ( COUNTROWS ( CAPA ), CAPA[Effectiveness] = "Effective" ),\n    CALCULATE ( COUNTROWS ( CAPA ), NOT ISBLANK ( CAPA[Closed Date] ) )\n)',
      calc: ctx =>
        withAsOf(ctx, () => {
          const c = rows('capa', ctx).filter(r => capaStatus(r) === 'Closed');
          return c.length ? c.filter(r => r.effectiveness === 'Effective').length / c.length : null;
        })
    },
    ncrCount: {
      name: 'NCR Count',
      kind: 'flow',
      dax: 'NCR Count = COUNTROWS ( NCR )',
      calc: ctx => rows('ncr', ctx).length
    },
    fpy: {
      name: 'First Pass Yield',
      kind: 'flow',
      dax: 'First Pass Yield =\nDIVIDE (\n    SUM ( Production[Units Passed First Pass] ),\n    SUM ( Production[Units Tested] )\n)',
      calc: ctx => {
        const p = rows('prod', ctx);
        const t = sum(p, r => r.tested);
        return t ? sum(p, r => r.passed) / t : null;
      }
    }
  };

  // Monthly series for sparklines: flow measures per month, stock measures as of each month end.
  function monthlySeries(key, ctx, from, to) {
    const m = MEASURES[key];
    const out = [];
    for (let i = from; i <= to; i++) {
      const c = m.kind === 'stock' ? withMonth(ctx, x => x <= i) : withMonth(ctx, x => x === i);
      c.asOf = MI[i].last;
      out.push(m.calc(c));
    }
    return out;
  }

  const fmt = {
    int: v => (v == null ? '(Blank)' : Math.round(v).toLocaleString('en-US')),
    dec1: v => (v == null ? '(Blank)' : v.toFixed(1)),
    pct: v => (v == null ? '(Blank)' : (v * 100).toFixed(1) + '%'),
    k: v => {
      if (v == null) return '(Blank)';
      const a = Math.abs(v);
      if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
      if (a >= 1e4) return (v / 1e3).toFixed(1) + 'K';
      return Math.round(v).toLocaleString('en-US');
    }
  };

  Object.assign(model, {
    FIELDS,
    MEASURES,
    predicate,
    isActive,
    describe,
    rows,
    withMonth,
    groupCount,
    sum,
    capaStatus,
    daysOpen,
    agingBucket,
    mdrClockDays,
    decisionBin,
    monthlySeries,
    fmt,
    productByName
  });
  window.PBI = window.PBI || {};
  window.PBI.model = model;
})();
