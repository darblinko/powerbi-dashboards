'use strict';
/* Analytics pane equivalents: forecast, anomaly detection, explanations, smart narrative, insights. */

function weeklyOosSeries(c, weeks) {
  const byWeekB = groupBy(c.batches, b => b.week);
  const byWeekO = groupBy(c.oos, o => o.week);
  return weeks.map(w => {
    const bs = byWeekB.get(w) || [];
    const os = byWeekO.get(w) || [];
    return {
      week: w,
      batches: bs.length,
      oosBatches: new Set(os.map(o => o.batchId)).size,
      value: bs.length ? new Set(os.map(o => o.batchId)).size / bs.length : null
    };
  });
}

function median(arr) {
  const s = arr.slice().sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function detectAnomalies(series) {
  return series.map((pt, i) => {
    const neigh = series.filter((p, j) => j !== i && Math.abs(j - i) <= 6 && p.value !== null).map(p => p.value);
    const m = median(neigh);
    const mad = median(neigh.map(v => Math.abs(v - m)));
    const sd = Math.max(1.4826 * mad, 0.021);
    const lo = Math.max(0, m - 3 * sd);
    const hi = m + 3 * sd;
    const isAnomaly = pt.value !== null && pt.batches >= 8 && pt.value > hi && pt.value - m > 0.08;
    return Object.assign({}, pt, { expected: m, lo, hi, isAnomaly });
  });
}

function holtForecast(values, horizon) {
  const alpha = 0.35;
  const beta = 0.08;
  const clean = values.filter(v => v !== null);
  if (clean.length < 6) return [];
  let level = clean.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
  let trend = 0;
  const errors = [];
  for (const y of clean) {
    const fc = level + trend;
    errors.push(y - fc);
    const prev = level;
    level = alpha * y + (1 - alpha) * (level + trend);
    trend = beta * (level - prev) + (1 - beta) * trend;
  }
  const sd = Math.sqrt(errors.slice(4).reduce((a, e) => a + e * e, 0) / Math.max(1, errors.length - 5));
  const out = [];
  for (let h = 1; h <= horizon; h++) {
    const point = Math.max(0, level + h * trend);
    const width = 1.96 * sd * Math.sqrt(1 + 0.12 * (h - 1));
    out.push({ value: point, lo: Math.max(0, point - width), hi: point + width });
  }
  return out;
}

const EXPLAIN_DIMS = ['site', 'line', 'form', 'testType', 'customer'];

function explainAnomaly(c, week, windowWeeks) {
  const inWeek = r => r.week === week;
  const base = r => r.week !== week && windowWeeks.includes(r.week);
  const wb = c.batches.filter(inWeek);
  const bb = c.batches.filter(base);
  const wo = c.oos.filter(inWeek);
  const bo = c.oos.filter(base);
  const distinctB = rows => new Set(rows.map(o => o.batchId)).size;
  const totalExcess = distinctB(wo) - wb.length * (distinctB(bo) / Math.max(1, bb.length));
  if (totalExcess <= 0) return [];
  const out = [];
  for (const dim of EXPLAIN_DIMS) {
    for (const { value } of distinct(wo, dim)) {
      const match = r => FIELDS[dim](r) === value;
      const actual = distinctB(wo.filter(match));
      const denomW = dim === 'testType' ? wb.length : wb.filter(match).length;
      const denomB = dim === 'testType' ? bb.length : bb.filter(match).length;
      const rate = distinctB(bo.filter(match)) / Math.max(1, denomB);
      const expected = denomW * rate;
      const strength = Math.max(0, Math.min(1, (actual - expected) / totalExcess));
      if (actual >= 1 && strength > 0.15) out.push({ dim, value, actual, expected, strength });
    }
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

function lastMonths(n) {
  const out = [];
  for (let i = D.LAST_MONTH - n + 1; i <= D.LAST_MONTH; i++) {
    const y = 2025 + Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push({
      idx: i,
      key: y + '-' + String(m).padStart(2, '0'),
      name: D.MONTHS_LONG[m - 1],
      short: D.MONTHS[m - 1] + ' ' + y
    });
  }
  return out;
}

const bold = s => '<b>' + s + '</b>';

function rftSentence(c) {
  const [first, , last] = lastMonths(3);
  const fb = c.batches.filter(x => x.month === first.key);
  const lb = c.batches.filter(x => x.month === last.key);
  if (!fb.length || !lb.length) return null;
  const r1 = measure('rft', { batches: fb });
  const r2 = measure('rft', { batches: lb });
  const dir = r2 < r1 - 0.0005 ? 'fell' : r2 > r1 + 0.0005 ? 'rose' : 'held';
  let driver = null;
  let best = 0;
  for (const [line, rows] of groupBy(
    c.batches.filter(x => x.month === first.key || x.month === last.key),
    x => x.line
  )) {
    const f1 = rows.filter(x => x.month === first.key && !x.rft).length / fb.length;
    const f2 = rows.filter(x => x.month === last.key && !x.rft).length / lb.length;
    const delta = dir === 'rose' ? f1 - f2 : f2 - f1;
    if (delta > best) {
      best = delta;
      driver = line;
    }
  }
  let s =
    'Right first time ' +
    dir +
    ' from ' +
    bold(FMT.pct(r1)) +
    ' in ' +
    first.name +
    ' to ' +
    bold(FMT.pct(r2)) +
    ' in ' +
    last.name;
  if (driver && dir !== 'held') {
    const dl = lb.filter(x => x.line === driver);
    s +=
      ', driven by ' +
      bold(driver) +
      (dl.length ? ', which recorded ' + bold(FMT.pct(measure('rft', { batches: dl }))) + ' in ' + last.name : '');
  }
  return s + '.';
}

function releasedSentence(c) {
  const [, prev, last] = lastMonths(3);
  const n2 = c.batches.filter(x => x.month === last.key && isReleased(x)).length;
  const n1 = c.batches.filter(x => x.month === prev.key && isReleased(x)).length;
  if (!n1) return null;
  const ch = (n2 - n1) / n1;
  const word = ch >= 0 ? 'more' : 'fewer';
  return (
    bold(FMT.int(n2)) +
    ' batches were released in ' +
    last.name +
    ', ' +
    bold(FMT.pct(Math.abs(ch))) +
    ' ' +
    word +
    ' than in ' +
    prev.name +
    '.'
  );
}

function oosSentence(c) {
  const recent = c.oos.filter(o => o.week > D.LAST_WEEK - 13);
  if (!recent.length) return 'No OOS results were recorded in the last 13 weeks.';
  const top = distinct(recent, 'testType').sort((x, y) => y.count - x.count)[0];
  const prior = c.oos.filter(o => o.week <= D.LAST_WEEK - 13 && o.week > D.LAST_WEEK - 26).length;
  return (
    bold(top.value) +
    ' accounted for ' +
    bold(top.count) +
    ' of the ' +
    bold(recent.length) +
    ' OOS results in the last 13 weeks (' +
    bold(FMT.pct(top.count / recent.length)) +
    '), against ' +
    bold(prior) +
    ' OOS results in the prior 13 weeks.'
  );
}

function dispositionSentence(c) {
  const months = lastMonths(3).map(m => m.key);
  const rows = c.batches.filter(x => months.includes(x.month));
  const rej = rows.filter(x => x.disposition === 'Rejected').length;
  const dev = rows.filter(x => x.disposition === 'Released with deviation').length;
  const open = c.oos.filter(o => o.status === 'Open');
  const aged = open.filter(o => o.ageDays > 30).length;
  return (
    bold(rej) +
    ' batches were rejected and ' +
    bold(dev) +
    ' were released with deviation since ' +
    lastMonths(3)[0].name +
    '; ' +
    bold(open.length) +
    ' OOS investigations remain open, ' +
    bold(aged) +
    ' of them for more than 30 days.'
  );
}

function yieldSentence(c) {
  const lines = [
    ...groupBy(
      c.batches.filter(x => x.week > D.LAST_WEEK - 13),
      x => x.line
    )
  ]
    .map(([line, rows]) => ({ line, y: measure('yield', { batches: rows }), n: rows.length }))
    .filter(x => x.n >= 5);
  if (lines.length < 2) return null;
  lines.sort((x, y) => x.y - y.y);
  return (
    'Over the last 13 weeks average batch yield was lowest on ' +
    bold(lines[0].line) +
    ' at ' +
    bold(FMT.pct(lines[0].y)) +
    ' and highest on ' +
    bold(lines[lines.length - 1].line) +
    ' at ' +
    bold(FMT.pct(lines[lines.length - 1].y)) +
    '.'
  );
}

function smartNarrative(c) {
  if (!c.batches.length) return ['No batches match the current filters.'];
  return [rftSentence(c), releasedSentence(c), oosSentence(c), dispositionSentence(c), yieldSentence(c)].filter(
    Boolean
  );
}

/* Insights pane: computed from the current report filter context. */
function computeInsights() {
  const c = ctx(null, { selection: false });
  const out = [];
  const weeks = [];
  for (let w = D.LAST_WEEK - 51; w <= D.LAST_WEEK; w++) weeks.push(w);
  const series = detectAnomalies(weeklyOosSeries(c, weeks));
  const anomalies = series.filter(p => p.isAnomaly).sort((x, y) => y.value - y.hi - (x.value - x.hi));
  if (anomalies.length) {
    const a = anomalies[0];
    const ex = explainAnomaly(c, a.week, weeks)[0];
    out.push({
      type: 'Anomaly',
      title: 'OOS rate % had an unexpected high on ' + U.fmtDate(D.DAY0 + a.week * 7),
      text:
        'OOS rate % was ' +
        FMT.pct(a.value) +
        ' against an expected range of ' +
        FMT.pct(a.lo) +
        ' to ' +
        FMT.pct(a.hi) +
        '.' +
        (ex
          ? ' Strongest explanation: ' +
            FIELD_LABELS[ex.dim] +
            ' is ' +
            ex.value +
            ' (' +
            Math.round(ex.strength * 100) +
            '%).'
          : ''),
      chart: {
        kind: 'line',
        labels: series.map(p => U.fmtDate(D.DAY0 + p.week * 7)),
        values: series.map(p => p.value),
        mark: series.indexOf(a),
        fmt: 'pct'
      }
    });
  }
  const months = lastMonths(6);
  const lineTrend = [
    ...groupBy(
      c.batches.filter(x => x.monthIdx > D.LAST_MONTH - 6),
      x => x.line
    )
  ]
    .map(([line, rows]) => {
      const vals = months.map(m => measure('rft', { batches: rows.filter(r => r.month === m.key) }));
      return { line, vals, delta: (vals[5] || 0) - (vals[0] || 0), n: rows.length };
    })
    .filter(x => x.n >= 20 && x.vals[0] !== null && x.vals[5] !== null)
    .sort((x, y) => x.delta - y.delta);
  if (lineTrend.length) {
    const t = lineTrend[0];
    out.push({
      type: 'Trend',
      title: 'Right first time % for ' + t.line + ' is trending ' + (t.delta < 0 ? 'down' : 'up'),
      text:
        'Right first time % moved from ' +
        FMT.pct(t.vals[0]) +
        ' in ' +
        months[0].name +
        ' to ' +
        FMT.pct(t.vals[5]) +
        ' in ' +
        months[5].name +
        ', a change of ' +
        (t.delta * 100).toFixed(1) +
        ' points, the largest of any line.',
      chart: { kind: 'line', labels: months.map(m => m.short), values: t.vals, fmt: 'pct' }
    });
  }
  const otif = measure('otif', c);
  const cust = [
    ...groupBy(
      c.batches.filter(x => x.otif !== null),
      x => x.customer
    )
  ]
    .map(([name, rows]) => ({
      name,
      v: measure('otif', { batches: rows }),
      miss: rows.filter(r => !r.otif).length,
      n: rows.length
    }))
    .filter(x => x.n >= 15)
    .sort((x, y) => x.v - y.v)
    .slice(0, 5);
  if (otif !== null && cust.length) {
    out.push({
      type: 'KPI analysis',
      title: 'On-time-in-full % is ' + (otif >= 0.95 ? 'above' : 'below') + ' the 95.0% target',
      text:
        'On-time-in-full % was ' +
        FMT.pct(otif) +
        '. ' +
        cust[0].name +
        ' recorded the lowest value at ' +
        FMT.pct(cust[0].v) +
        ' across ' +
        cust[0].n +
        ' shipped batches, with ' +
        cust[0].miss +
        ' missed.',
      chart: { kind: 'bar', labels: cust.map(x => x.name), values: cust.map(x => x.v), fmt: 'pct', ref: 0.95, min: 0.8 }
    });
  }
  const siteTrend = [
    ...groupBy(
      c.batches.filter(x => x.monthIdx > D.LAST_MONTH - 6 && isReleased(x)),
      x => x.site
    )
  ]
    .map(([site, rows]) => {
      const vals = months.map(m => measure('cycle', { batches: rows.filter(r => r.month === m.key) }));
      return { site, vals, delta: (vals[5] || 0) - (vals[0] || 0) };
    })
    .filter(x => x.vals.every(v => v !== null))
    .sort((x, y) => y.delta - x.delta);
  if (siteTrend.length) {
    const t = siteTrend[0];
    out.push({
      type: 'Trend',
      title: 'Release cycle time days at ' + t.site + ' is trending ' + (t.delta >= 0 ? 'up' : 'down'),
      text:
        'Average release cycle time moved from ' +
        FMT.dec1(t.vals[0]) +
        ' days in ' +
        months[0].name +
        ' to ' +
        FMT.dec1(t.vals[5]) +
        ' days in ' +
        months[5].name +
        '.',
      chart: { kind: 'line', labels: months.map(m => m.short), values: t.vals, fmt: 'dec1' }
    });
  }
  return out;
}
