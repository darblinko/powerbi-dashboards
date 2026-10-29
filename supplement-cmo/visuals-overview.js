'use strict';
/* Page 1: Production Overview. KPI cards, Gantt schedule, treemap, line and stacked column combo. */

const KPI_KEYS = ['released', 'rft', 'yield', 'oosOpen', 'otif', 'cycle'];
const KPI_W = (PAGE_W - 24 - 40) / 6;

function openOosAtWeekEnd(oosRows, w) {
  const end = D.DAY0 + w * 7 + 6;
  return oosRows.filter(o => o.openedDay <= end && (!o.closedDay || o.closedDay > end)).length;
}

function kpiSpark(key, c) {
  const weeks = [];
  for (let w = D.LAST_WEEK - 12; w <= D.LAST_WEEK; w++) weeks.push(w);
  if (key === 'oosOpen') return weeks.map(w => openOosAtWeekEnd(c.oos, w));
  const g = groupCtx(c, r => r.week);
  return weeks.map(w => (g.has(w) ? measure(key, g.get(w)) : null));
}

function kpiTipHtml(key, value) {
  const m = MEASURES[key];
  return ttHtml([[m.name, fmtMeasure(key, value)]].concat(m.target !== undefined ? [['Target', fmtMeasure(key, m.target)]] : [])) +
    '<div style="margin-top:6px;color:#C8C6C4;font-size:10px">DAX</div><pre style="margin:2px 0 0;font:10px Consolas,monospace;color:#fff;white-space:pre">' +
    esc(m.dax) + '</pre>';
}

function renderKpi(el, v) {
  const key = v.measureKey;
  if (!el.dataset.built) {
    el.innerHTML = '<div class="kpi-top"><div class="kpi-label"></div></div><div class="kpi-val"></div><div class="kpi-ref"></div><div class="kpi-spark"></div>';
    el.dataset.built = '1';
    el.addEventListener('mouseenter', e => showTip(e, kpiTipHtml(key, el._value)));
    el.addEventListener('mousemove', moveTip);
    el.addEventListener('mouseleave', hideTip);
  }
  const c = ctx(v.id);
  const value = measure(key, c);
  const m = MEASURES[key];
  el._value = value;
  el.querySelector('.kpi-label').textContent = m.name;
  el.querySelector('.kpi-val').textContent = fmtMeasure(key, value);
  const ref = el.querySelector('.kpi-ref');
  if (m.target !== undefined && value !== null) {
    const good = m.lowerIsBetter ? value <= m.target : value >= m.target;
    ref.className = 'kpi-ref ' + (good ? 'good' : 'bad');
    ref.innerHTML = icon(good ? 'kpiGood' : 'kpiBad', 10) + '<span>Target ' + fmtMeasure(key, m.target) + '</span>';
  } else {
    ref.className = 'kpi-ref';
    ref.innerHTML = '<span>13-week trend</span>';
  }
  const spark = kpiSpark(key, c);
  const chart = chartFor(v.id, el.querySelector('.kpi-spark'));
  chart.setOption({
    animation: false, grid: { left: 0, right: 0, top: 2, bottom: 0 },
    xAxis: { type: 'category', show: false, data: spark.map((_, i) => i) },
    yAxis: { type: 'value', show: false, scale: true },
    series: [{ type: 'line', data: spark, symbol: 'none', smooth: true, silent: true, lineStyle: { width: 1.5, color: THEME[0] },
      areaStyle: { color: 'rgba(50,87,168,0.12)' } }]
  }, true);
}

KPI_KEYS.forEach((key, i) => defineVisual({
  id: 'kpi-' + key, page: 'overview', title: MEASURES[key].name, hideTitle: true, className: 'kpi', measureKey: key,
  pos: [12 + i * (KPI_W + 8), 64, KPI_W, 94], measures: [key], render: renderKpi,
  data() {
    const c = ctx('kpi-' + key);
    return { columns: [MEASURES[key].name], rows: [[measure(key, c)]], formats: [MEASURES[key].fmt] };
  }
}));

/* ---------- Gantt schedule ---------- */
const GANTT_MIN = D.TODAY - 3;
const GANTT_MAX = D.TODAY + 21;

function ganttRows() {
  const c = ctx('gantt', { schedule: true });
  return c.schedule.filter(r => r.end > GANTT_MIN && r.start < GANTT_MAX);
}

function ganttLines(rows) {
  const names = D.LINES.map(l => l.name).filter(n => rows.some(r => r.line === n));
  const st = sortState('gantt');
  if (st && st.field === 'load') {
    const load = n => rows.filter(r => r.line === n).reduce((a, r) => a + (r.end - r.start), 0);
    names.sort((a, b) => (st.dir === 'asc' ? load(a) - load(b) : load(b) - load(a)));
  } else if (st && st.dir === 'desc') names.reverse();
  return names;
}

function ganttRenderItem(rows) {
  return (params, api) => {
    const r = rows[api.value(3)];
    const s = api.coord([api.value(1), api.value(0)]);
    const e = api.coord([api.value(2), api.value(0)]);
    const h = api.size([0, 1])[1] * 0.6;
    const cs = params.coordSys;
    const x1 = Math.max(s[0], cs.x);
    const x2 = Math.min(e[0], cs.x + cs.width);
    if (x2 <= x1) return null;
    const op = opacityFor('gantt', { product: r.product, customer: r.customer });
    const children = [{
      type: 'rect', shape: { x: x1, y: s[1] - h / 2, width: x2 - x1, height: h, r: 2 },
      style: { fill: FORM_COLORS[r.form], opacity: op * (r.stage === 'Packaging' ? 0.78 : 1), stroke: r.status === 'In progress' ? '#252423' : null, lineWidth: 1 }
    }];
    if (x2 - x1 > 44) {
      children.push({ type: 'text', silent: true, style: { x: x1 + 4, y: s[1], text: r.batchId.slice(4), fill: '#fff', fontSize: 9, fontFamily: FONT, verticalAlign: 'middle', opacity: op } });
    }
    return { type: 'group', children };
  };
}

function weekendAreas() {
  const out = [];
  for (let d = GANTT_MIN; d < GANTT_MAX; d++) {
    const dow = U.partsOf(d).dow;
    if (dow === 6) out.push([{ xAxis: d }, { xAxis: Math.min(d + 2, GANTT_MAX) }]);
  }
  return out;
}

defineVisual({
  id: 'gantt', page: 'overview', title: 'Production schedule by line, next 3 weeks', pos: [12, 166, 832, 300],
  sortFields: [{ key: 'line', label: 'Line' }, { key: 'load', label: 'Scheduled hours' }], defaultSort: { field: 'line', dir: 'asc' },
  filters: [{ field: 'line', label: 'Line' }],
  render(el) {
    const rows = ganttRows();
    const lines = ganttLines(rows);
    const chart = chartFor('gantt', el);
    const forms = D.FORMS.filter(f => rows.some(r => r.form === f));
    const series = forms.map(form => ({
      name: form, type: 'custom', renderItem: ganttRenderItem(rows), itemStyle: { color: FORM_COLORS[form] },
      encode: { x: [1, 2], y: 0 },
      data: rows.map((r, i) => (r.form === form ? [lines.indexOf(r.line), r.start, r.end, i] : null)).filter(Boolean)
    }));
    series.push({
      name: 'Today', type: 'line', data: [], silent: true,
      markLine: { symbol: 'none', silent: true, data: [{ xAxis: D.TODAY + 0.4 }], lineStyle: { color: '#D13438', width: 1.5, type: 'solid' },
        label: { formatter: 'Today', color: '#D13438', fontSize: 10, fontFamily: FONT, position: 'insideEndTop' } },
      markArea: { silent: true, itemStyle: { color: 'rgba(0,0,0,0.035)' }, data: weekendAreas() }
    });
    chart.setOption({
      animation: false, textStyle: { fontFamily: FONT },
      legend: Object.assign({}, LEGEND, { data: forms }),
      grid: { left: 104, right: 14, top: 44, bottom: 8 },
      tooltip: Object.assign({}, TT, {
        trigger: 'item', formatter: p => {
          const r = rows[p.value[3]];
          return ttHtml([['Batch', r.batchId], ['Product', r.product], ['Customer', r.customer], ['Dosage form', r.form], ['Line', r.line],
            ['Stage', r.stage], ['Start', U.fmtDate(r.start)], ['End', U.fmtDate(r.end)], ['Duration hours', ((r.end - r.start) * 24).toFixed(1)], ['Status', r.status]]);
        }
      }),
      xAxis: {
        type: 'value', position: 'top', min: GANTT_MIN, max: GANTT_MAX, interval: 1,
        axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 9, formatter: d => { const p = U.partsOf(d); return p.m + '/' + p.d; } }),
        splitLine: GRID_LINE, axisLine: { show: false }, axisTick: { show: false }
      },
      yAxis: { type: 'category', data: lines, inverse: true, axisLabel: AXIS_LABEL, axisTick: { show: false }, axisLine: { lineStyle: { color: '#C8C6C4' } }, splitLine: { show: true, lineStyle: { color: '#F3F2F1' } } },
      series
    }, true);
    chart.off('click');
    chart.on('click', p => {
      if (p.seriesType !== 'custom') return;
      const r = rows[p.value[3]];
      select('gantt', { product: r.product, customer: r.customer }, isCtrl(p));
    });
    chart.off('contextmenu');
    chart.on('contextmenu', p => {
      if (p.seriesType !== 'custom') return;
      const ev = p.event.event;
      ev.preventDefault();
      showContextMenu(ev.clientX, ev.clientY, batchContextItems(rows[p.value[3]].batchId));
    });
    el.oncontextmenu = e => e.preventDefault();
  },
  data() {
    const rows = ganttRows();
    return {
      columns: ['Batch ID', 'Line', 'Stage', 'Dosage form', 'Customer', 'Product', 'Start', 'End', 'Status'],
      rows: rows.map(r => [r.batchId, r.line, r.stage, r.form, r.customer, r.product, U.fmtDate(r.start), U.fmtDate(r.end), r.status])
    };
  }
});

/* ---------- Treemap: Customer > Product ---------- */
function treemapNodes() {
  const c = ctx('treemap');
  const d = drillState('treemap');
  const topF = S.filters.find(f => f.id === 'visual:treemap:customer');
  const byCust = [...groupBy(c.batches, b => b.customer)].map(([name, rows]) => ({ name, rows })).sort((a, b) => b.rows.length - a.rows.length);
  const top = topF && topF.n > 0 ? byCust.slice(0, topF.n) : byCust;
  const colorOf = name => THEME[byCust.findIndex(x => x.name === name) % THEME.length];
  const productNodes = (cust, rows) => [...groupBy(rows, b => b.product)].map(([p, pr]) => ({
    name: p, value: pr.length, key: { customer: cust, product: p }, itemStyle: { color: colorOf(cust), opacity: opacityFor('treemap', { customer: cust, product: p }) }
  })).sort((a, b) => b.value - a.value);
  if (d.path.length) {
    const cust = d.path[0].value;
    const hit = byCust.find(x => x.name === cust);
    return { nodes: hit ? productNodes(cust, hit.rows) : [], mode: 'products' };
  }
  if (d.level === 1 && d.flat) {
    return { nodes: top.flatMap(x => productNodes(x.name, x.rows)).sort((a, b) => b.value - a.value).slice(0, 40), mode: 'products' };
  }
  const nested = d.level === 1;
  return {
    mode: nested ? 'nested' : 'customers',
    nodes: top.map(x => ({
      name: x.name, value: x.rows.length, key: { customer: x.name },
      itemStyle: { color: colorOf(x.name), opacity: opacityFor('treemap', { customer: x.name }) },
      children: nested ? productNodes(x.name, x.rows) : undefined
    }))
  };
}

defineVisual({
  id: 'treemap', page: 'overview', title: () => 'Batches by customer' + (drillState('treemap').level ? ' and product' : ''),
  pos: [852, 166, 416, 526], hierarchy: ['customer', 'product'], defaultLevel: 0, measures: ['batches'],
  filters: [{ field: 'customer', kind: 'topn', n: 15, by: 'Batches', label: 'Customer' }, { field: 'form', label: 'Dosage form' }],
  render(el) {
    const { nodes, mode } = treemapNodes();
    const chart = chartFor('treemap', el);
    const total = nodes.reduce((a, n) => a + n.value, 0);
    chart.setOption({
      animation: false,
      tooltip: Object.assign({}, TT, { formatter: p => (!p.data || !p.data.key ? '' : ttHtml((p.data.key.product ? [['Customer', p.data.key.customer], ['Product', p.data.key.product]] : [['Customer', p.data.key.customer]])
        .concat([['Batches', FMT.int(p.value)], ['Share of total', FMT.pct(p.value / total)]]))) }),
      series: [{
        type: 'treemap', data: nodes, roam: false, animation: false, animationDurationUpdate: 0, nodeClick: false, breadcrumb: { show: false }, top: 4, left: 2, right: 2, bottom: 2,
        squareRatio: 0.9, visibleMin: 1,
        label: { show: true, fontFamily: FONT, fontSize: 10, color: '#fff', formatter: p => p.name + '\n' + p.value, overflow: 'truncate' },
        upperLabel: { show: mode === 'nested', height: 18, color: '#fff', fontFamily: FONT, fontSize: 10, fontWeight: 600 },
        itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 1 },
        levels: mode === 'nested' ? [{ itemStyle: { borderWidth: 2, gapWidth: 2, borderColor: '#fff' } }, { itemStyle: { borderWidth: 1, gapWidth: 1, borderColor: 'rgba(255,255,255,0.7)' } }] : []
      }]
    }, true);
    chart.off('click');
    chart.on('click', p => {
      if (!p.data || !p.data.key) return;
      const d = drillState('treemap');
      if (d.mode && !p.data.key.product && d.level === 0) { drillInto('treemap', p.data.key.customer); return; }
      select('treemap', p.data.key, isCtrl(p));
    });
  },
  data() {
    const { nodes } = treemapNodes();
    const flat = nodes.flatMap(n => (n.children ? n.children : [n]));
    return { columns: ['Customer', 'Product', 'Batches'], rows: flat.map(n => [n.key.customer, n.key.product || '', n.value]) };
  }
});

/* ---------- Line and stacked column combo ---------- */
function comboSeriesData() {
  const full = ctx('combo', { selection: false });
  const hl = hasForeignSelection('combo') ? ctx('combo') : null;
  const ax = dateAxis('combo', full.batches);
  const forms = D.FORMS.filter(f => full.batches.some(b => b.form === f));
  const count = (rows, form) => {
    const m = new Map();
    for (const b of rows) {
      if (b.form !== form || !isReleased(b)) continue;
      const k = ax.keyOf(b);
      if (k !== undefined) m.set(k, (m.get(k) || 0) + 1);
    }
    return ax.cats.map(cat => m.get(cat.key) || 0);
  };
  const yieldRows = hl ? hl.batches : full.batches;
  const yields = ax.cats.map(cat => {
    const rows = yieldRows.filter(b => ax.keyOf(b) === cat.key);
    return rows.length ? measure('yield', { batches: rows }) : null;
  });
  return { ax, forms, full: forms.map(f => count(full.batches, f)), hl: hl ? forms.map(f => count(hl.batches, f)) : null, yields };
}

defineVisual({
  id: 'combo', page: 'overview', pos: [12, 474, 832, 218],
  title: () => 'Batches released and average batch yield % by ' + ['year', 'quarter', 'month', 'week'][drillState('combo').level],
  hierarchy: ['year', 'quarter', 'month', 'week'], defaultLevel: 3, measures: ['released', 'yield'],
  filters: [{ field: 'week', kind: 'relative', n: 26, unit: 'weeks', label: 'Manufacture week' }, { field: 'disposition', label: 'Disposition' }],
  render(el) {
    const { ax, forms, full, hl, yields } = comboSeriesData();
    const chart = chartFor('combo', el);
    const series = [];
    forms.forEach((form, fi) => {
      const color = FORM_COLORS[form];
      const solid = (hl ? hl[fi] : full[fi]).map((v, i) => ({
        value: v, itemStyle: { opacity: ax.field ? opacityFor('combo', { [ax.field]: ax.cats[i].key, form }) : 1 }
      }));
      series.push({ name: form, type: 'bar', stack: 'r', data: solid, itemStyle: { color }, barMaxWidth: 34, emphasis: { focus: 'none' } });
      if (hl) series.push({ name: form, type: 'bar', stack: 'r', data: full[fi].map((v, i) => v - hl[fi][i]), itemStyle: { color, opacity: 0.35 }, barMaxWidth: 34 });
    });
    series.push({ name: 'Average batch yield %', type: 'line', yAxisIndex: 1, data: yields, symbol: 'circle', symbolSize: 5, lineStyle: { width: 2, color: '#252423' }, itemStyle: { color: '#252423' }, connectNulls: true });
    chart.setOption({
      animation: false, textStyle: { fontFamily: FONT },
      legend: Object.assign({}, LEGEND, { data: forms.concat(['Average batch yield %']) }),
      grid: { left: 46, right: 50, top: 30, bottom: 24 },
      tooltip: Object.assign({}, TT, {
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.04)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          const rows = [[FIELD_LABELS.week.replace('Manufacture week', 'Period'), ax.cats[i].label]];
          forms.forEach((f, fi) => rows.push([f, FMT.int(full[fi][i]) + (hl ? ' (highlighted ' + hl[fi][i] + ')' : '')]));
          rows.push(['Batches released', FMT.int(full.reduce((a, arr) => a + arr[i], 0))]);
          rows.push(['Average batch yield %', FMT.pct(yields[i])]);
          return ttHtml(rows);
        }
      }),
      xAxis: { type: 'category', data: ax.cats.map(c => c.label), axisLabel: AXIS_LABEL, axisTick: { show: false }, axisLine: { lineStyle: { color: '#C8C6C4' } } },
      yAxis: [
        { type: 'value', name: 'Batches released', nameLocation: 'middle', nameGap: 32, nameTextStyle: AXIS_NAME, axisLabel: AXIS_LABEL, splitLine: GRID_LINE },
        { type: 'value', name: 'Average batch yield %', nameLocation: 'middle', nameGap: 38, nameTextStyle: AXIS_NAME, min: 0.9, max: 1, splitLine: { show: false },
          axisLabel: Object.assign({}, AXIS_LABEL, { formatter: v => (v * 100).toFixed(0) + '%' }) }
      ],
      series
    }, true);
    chart.off('click');
    chart.on('click', p => {
      const cat = ax.cats[p.dataIndex];
      if (!cat) return;
      if (drillState('combo').mode && !drillState('combo').flat) { if (drillInto('combo', cat.key)) return; }
      if (!ax.field) return;
      const key = p.seriesType === 'bar' ? { [ax.field]: cat.key, form: p.seriesName } : { [ax.field]: cat.key };
      select('combo', key, isCtrl(p));
    });
  },
  data() {
    const { ax, forms, full, yields } = comboSeriesData();
    return {
      columns: ['Period'].concat(forms.map(f => 'Batches released ' + f), ['Average batch yield %']),
      rows: ax.cats.map((c, i) => [c.label].concat(forms.map((_, fi) => full[fi][i]), [yields[i]])),
      formats: [null].concat(forms.map(() => 'int'), ['pct'])
    };
  }
});
