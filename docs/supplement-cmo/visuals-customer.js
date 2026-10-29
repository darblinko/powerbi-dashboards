'use strict';
/* Page 3: Customer Scorecard. Matrix with conditional formatting, small multiples, scatter with constant lines. */

const MATRIX_COLS = [
  { key: 'revenue', label: 'Revenue', style: 'bar' },
  { key: 'batches', label: 'Batches', style: 'scaleBlue' },
  { key: 'otif', label: 'OTIF %', style: 'kpi' },
  { key: 'cpmu', label: 'Complaints per M units', style: 'scaleRed' },
  { key: 'cycle', label: 'Avg release days', style: 'scaleDiv' }
];

function mixColor(a, b, t) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  const x = Math.max(0, Math.min(1, t));
  return 'rgb(' + pa.map((v, i) => Math.round(v + (pb[i] - v) * x)).join(',') + ')';
}

function metricsOf(c) {
  const out = {};
  for (const col of MATRIX_COLS) out[col.key] = measure(col.key, c);
  return out;
}

function matrixModel() {
  const c = ctx('matrix');
  const d = drillState('matrix');
  d.open = d.open || [];
  const st = sortState('matrix');
  const sorter = (a, b) => {
    const va = st.field === 'name' ? a.name : a.m[st.field];
    const vb = st.field === 'name' ? b.name : b.m[st.field];
    const cmp = typeof va === 'string' ? va.localeCompare(vb) : (va === null ? -1 : va) - (vb === null ? -1 : vb);
    return st.dir === 'desc' ? -cmp : cmp;
  };
  const customers = [...groupCtx(c, b => b.customer)].map(([name, g]) => ({
    name, m: metricsOf(g), key: { customer: name },
    children: [...groupCtx(g, b => b.product)].map(([p, pg]) => ({ name: p, m: metricsOf(pg), key: { customer: name, product: p } })).sort(sorter)
  })).sort(sorter);
  let rows;
  if (d.path.length) {
    const cust = customers.find(x => x.name === d.path[0].value);
    rows = cust ? cust.children.map(ch => ({ ...ch, depth: 0 })) : [];
  } else if (d.level === 1 && d.flat) {
    rows = customers.flatMap(x => x.children.map(ch => ({ ...ch, label: ch.name + ' (' + x.name + ')', depth: 0 }))).sort(sorter);
  } else {
    const all = d.level === 1;
    rows = [];
    for (const x of customers) {
      const open = all || d.open.includes(x.name);
      rows.push({ ...x, depth: 0, expandable: true, open });
      if (open) x.children.forEach(ch => rows.push({ ...ch, depth: 1 }));
    }
  }
  return { rows, total: metricsOf(c), customers };
}

function matrixCell(col, v, range) {
  if (v === null || v === undefined) return '<td class="num"></td>';
  const txt = fmtMeasure(col.key, v);
  const t = range.max > range.min ? (v - range.min) / (range.max - range.min) : 0;
  if (col.style === 'bar') {
    return '<td class="num bar-cell"><span class="mbar" style="width:' + Math.max(2, Math.round(t * 100)) + '%"></span><span class="mtxt">' + txt + '</span></td>';
  }
  if (col.style === 'kpi') {
    const ic = v >= 0.95 ? 'kpiGood' : v >= 0.9 ? 'kpiWarn' : 'kpiBad';
    return '<td class="num"><span class="kpi-ic">' + icon(ic, 10) + '</span>' + txt + '</td>';
  }
  let bg;
  if (col.style === 'scaleBlue') bg = mixColor('#FFFFFF', '#8FA9DC', t);
  else if (col.style === 'scaleRed') bg = mixColor('#FFFFFF', '#EBA0AC', t);
  else bg = t < 0.5 ? mixColor('#9ED3C5', '#FFFFFF', t * 2) : mixColor('#FFFFFF', '#EBA0AC', (t - 0.5) * 2);
  return '<td class="num" style="background:' + bg + '">' + txt + '</td>';
}

defineVisual({
  id: 'matrix', page: 'customer', title: 'Customer performance matrix', pos: [12, 64, 700, 628],
  hierarchy: ['customer', 'product'], defaultLevel: 0, measures: ['revenue', 'batches', 'otif', 'cpmu', 'cycle'],
  sortFields: [{ key: 'name', label: 'Customer' }].concat(MATRIX_COLS.map(c => ({ key: c.key, label: c.label }))),
  defaultSort: { field: 'revenue', dir: 'desc' }, filters: [{ field: 'region', label: 'Region' }],
  render(el) {
    const { rows, total } = matrixModel();
    const st = sortState('matrix');
    const ranges = {};
    for (const col of MATRIX_COLS) {
      const vals = rows.filter(r => r.depth === 0).map(r => r.m[col.key]).filter(v => v !== null);
      ranges[col.key] = { min: Math.min(...vals), max: Math.max(...vals) };
      if (col.style === 'bar') ranges[col.key].min = 0;
    }
    const arrow = k => (st.field === k ? (st.dir === 'desc' ? ' &#9662;' : ' &#9652;') : '');
    const head = '<th data-k="name">Customer' + arrow('name') + '</th>' + MATRIX_COLS.map(c => '<th class="num" data-k="' + c.key + '">' + c.label + arrow(c.key) + '</th>').join('');
    const body = rows.map(r => {
      const op = opacityFor('matrix', r.key);
      const toggle = r.expandable ? '<span class="mx-tog" data-c="' + esc(r.name) + '">' + (r.open ? '&#8722;' : '+') + '</span>' : '<span class="mx-pad"></span>';
      return '<tr class="d' + r.depth + '" data-key="' + esc(JSON.stringify(r.key)) + '" style="opacity:' + op + '"><td class="mx-name" style="padding-left:' + (6 + r.depth * 18) + 'px">' +
        toggle + esc(r.label || r.name) + '</td>' + MATRIX_COLS.map(col => matrixCell(col, r.m[col.key], ranges[col.key])).join('') + '</tr>';
    }).join('');
    const foot = '<tr><td class="mx-name">Total</td>' + MATRIX_COLS.map(col => '<td class="num">' + fmtMeasure(col.key, total[col.key]) + '</td>').join('') + '</tr>';
    el.innerHTML = '<div class="tbl-wrap"><table class="pbi-table matrix"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot></table></div>';
    el.onclick = e => {
      const th = e.target.closest('th');
      if (th) {
        const cur = sortState('matrix');
        S.sort.matrix = { field: th.dataset.k, dir: cur.field === th.dataset.k && cur.dir === 'desc' ? 'asc' : 'desc' };
        return renderAll();
      }
      const tog = e.target.closest('.mx-tog');
      const d = drillState('matrix');
      if (tog) {
        const name = tog.dataset.c;
        d.open = d.open.includes(name) ? d.open.filter(x => x !== name) : [...d.open, name];
        return renderAll();
      }
      const tr = e.target.closest('tbody tr');
      if (!tr) { if (S.selection && S.selection.source === 'matrix') setSelection(null); return; }
      const key = JSON.parse(tr.dataset.key);
      if (d.mode && !key.product && d.level === 0) return drillInto('matrix', key.customer);
      select('matrix', key, e.ctrlKey || e.metaKey);
    };
  },
  data() {
    const { rows } = matrixModel();
    return {
      columns: ['Customer', 'Product'].concat(MATRIX_COLS.map(c => c.label)),
      rows: rows.map(r => [r.key.customer, r.key.product || ''].concat(MATRIX_COLS.map(c => r.m[c.key]))),
      formats: [null, null].concat(MATRIX_COLS.map(c => MEASURES[c.key].fmt))
    };
  }
});

/* ---------- Small multiples: Right first time % by month, one panel per dosage form ---------- */
function smallMultModel() {
  const c = ctx('smallMult');
  const f = S.filters.find(x => x.id === 'visual:smallMult:monthIdx');
  const n = f && f.n > 0 ? f.n : D.LAST_MONTH + 1;
  const months = lastMonths(Math.min(n, D.LAST_MONTH + 1));
  const panels = D.FORMS.map(form => {
    const rows = c.batches.filter(b => b.form === form);
    return { form, values: months.map(m => measure('rft', { batches: rows.filter(b => b.month === m.key) })) };
  });
  return { months, panels };
}

defineVisual({
  id: 'smallMult', page: 'customer', title: 'Right first time % by month and dosage form', pos: [720, 64, 548, 312], measures: ['rft'],
  filters: [{ field: 'monthIdx', kind: 'relative', n: 12, unit: 'months', label: 'Manufacture month' }],
  render(el) {
    const { months, panels } = smallMultModel();
    const chart = chartFor('smallMult', el);
    const W = el.clientWidth;
    const H = el.clientHeight;
    const left = 40;
    const gapX = 14;
    const cw = (W - left - 8 - gapX * 2) / 3;
    const top = 18;
    const gapY = 34;
    const ch = (H - top - 30 - gapY) / 2;
    const all = panels.flatMap(p => p.values).filter(v => v !== null);
    const yMin = all.length ? Math.max(0, Math.floor(Math.min(...all) * 20) / 20) : 0.8;
    const grids = [];
    const xAxes = [];
    const yAxes = [];
    const titles = [];
    const series = [];
    panels.forEach((p, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const gl = left + col * (cw + gapX);
      const gt = top + row * (ch + gapY);
      grids.push({ left: gl, top: gt, width: cw, height: ch });
      titles.push({ text: p.form, left: gl + cw / 2, top: gt - 16, textAlign: 'center', textStyle: { fontSize: 10, fontWeight: 600, color: '#252423', fontFamily: FONT } });
      xAxes.push({ gridIndex: i, type: 'category', data: months.map(m => m.short.slice(0, 3)), axisTick: { show: false },
        axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 8, interval: Math.ceil(months.length / 4) - 1 }), axisLine: { lineStyle: { color: '#C8C6C4' } } });
      yAxes.push({ gridIndex: i, type: 'value', min: yMin, max: 1, splitNumber: 3, splitLine: GRID_LINE,
        axisLabel: Object.assign({}, AXIS_LABEL, { show: col === 0, fontSize: 8, formatter: v => Math.round(v * 100) + '%' }) });
      series.push({ name: p.form, type: 'line', xAxisIndex: i, yAxisIndex: i, data: p.values, symbol: 'circle', symbolSize: 3, connectNulls: true,
        lineStyle: { width: 1.8, color: FORM_COLORS[p.form] }, itemStyle: { color: FORM_COLORS[p.form] },
        markLine: { silent: true, symbol: 'none', data: [{ yAxis: 0.95 }], lineStyle: { color: '#A19F9D', type: 'dashed', width: 1 }, label: { show: false } } });
    });
    chart.setOption({
      animation: false, textStyle: { fontFamily: FONT }, title: titles, grid: grids, xAxis: xAxes, yAxis: yAxes, series,
      tooltip: Object.assign({}, TT, { trigger: 'item', formatter: p => ttHtml([['Dosage form', p.seriesName], ['Month', months[p.dataIndex].short], ['Right first time %', FMT.pct(p.value)], ['Target', '95.0%']]) })
    }, true);
    chart.off('click');
    chart.on('click', p => select('smallMult', { form: p.seriesName, month: months[p.dataIndex].key }, isCtrl(p)));
  },
  data() {
    const { months, panels } = smallMultModel();
    return { columns: ['Dosage form', 'Month', 'Right first time %'], rows: panels.flatMap(p => months.map((m, i) => [p.form, m.short, p.values[i]])), formats: [null, null, 'pct'] };
  }
});

/* ---------- Scatter: revenue against OTIF % ---------- */
function scatterModel() {
  const pts = [...groupCtx(ctx('scatter', { selection: false }), b => b.customer)].map(([name, g]) => ({
    name, tier: g.batches[0].tier, revenue: measure('revenue', g), otif: measure('otif', g), batches: g.batches.length
  })).filter(p => p.otif !== null);
  let hlSet = null;
  if (hasForeignSelection('scatter')) hlSet = new Set(ctx('scatter').batches.map(b => b.customer));
  return { pts, hlSet };
}

defineVisual({
  id: 'scatter', page: 'customer', title: 'Customer revenue and on-time-in-full %', pos: [720, 384, 548, 308], measures: ['revenue', 'otif'],
  render(el) {
    const { pts, hlSet } = scatterModel();
    const chart = chartFor('scatter', el);
    const avgRev = pts.reduce((a, p) => a + p.revenue, 0) / Math.max(1, pts.length);
    const maxB = Math.max(1, ...pts.map(p => p.batches));
    const tiers = ['Strategic', 'Core', 'Emerging'];
    const lowest = pts.slice().sort((a, b) => a.otif - b.otif).slice(0, 2).map(p => p.name);
    const minOtif = Math.min(0.85, ...pts.map(p => p.otif));
    const series = tiers.map((tier, ti) => ({
      name: tier, type: 'scatter',
      data: pts.filter(p => p.tier === tier).map(p => ({
        value: [p.revenue, p.otif], name: p.name, batches: p.batches,
        symbolSize: 7 + 17 * Math.sqrt(p.batches / maxB),
        itemStyle: { color: THEME[ti], opacity: hlSet ? (hlSet.has(p.name) ? 0.9 : 0.25) : 0.85 * opacityFor('scatter', { customer: p.name }), borderColor: '#fff', borderWidth: 0.5 },
        label: { show: lowest.includes(p.name), formatter: p.name, position: 'right', fontSize: 9, color: '#252423', fontFamily: FONT }
      }))
    }));
    series[0].markLine = {
      silent: true, symbol: 'none', lineStyle: { color: '#605E5C', type: 'dashed', width: 1 },
      label: { fontSize: 9, color: '#605E5C', fontFamily: FONT },
      data: [{ yAxis: 0.95, label: { formatter: 'OTIF target 95.0%', position: 'insideEndTop' } },
        { xAxis: avgRev, label: { formatter: 'Average revenue ' + FMT.cur(avgRev), position: 'end' } }]
    };
    chart.setOption({
      animation: false, textStyle: { fontFamily: FONT }, legend: Object.assign({}, LEGEND, { data: tiers }),
      grid: { left: 50, right: 22, top: 42, bottom: 34 },
      tooltip: Object.assign({}, TT, { trigger: 'item', formatter: p => ttHtml([['Customer', p.data.name], ['Customer tier', p.seriesName], ['Revenue', FMT.cur(p.value[0])], ['On-time-in-full %', FMT.pct(p.value[1])], ['Batches', FMT.int(p.data.batches)]]) }),
      xAxis: { type: 'value', name: 'Revenue', nameLocation: 'middle', nameGap: 22, nameTextStyle: AXIS_NAME, splitLine: GRID_LINE,
        axisLabel: Object.assign({}, AXIS_LABEL, { formatter: v => '$' + shortNum(v, 0) }) },
      yAxis: { type: 'value', name: 'On-time-in-full %', nameLocation: 'middle', nameGap: 36, nameTextStyle: AXIS_NAME, min: Math.floor(minOtif * 20) / 20, max: 1, splitLine: GRID_LINE,
        axisLabel: Object.assign({}, AXIS_LABEL, { formatter: v => Math.round(v * 100) + '%' }) },
      series
    }, true);
    chart.off('click');
    chart.on('click', p => { if (p.data && p.data.name) select('scatter', { customer: p.data.name }, isCtrl(p)); });
  },
  data() {
    const { pts } = scatterModel();
    return { columns: ['Customer', 'Customer tier', 'Revenue', 'On-time-in-full %', 'Batches'], rows: pts.map(p => [p.name, p.tier, p.revenue, p.otif, p.batches]), formats: [null, null, 'cur', 'pct', 'int'] };
  }
});
