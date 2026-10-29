/* Page 1 visuals: KPI card, OEE gauge, field parameter slicer, line chart, drill bar, Pareto. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const D = window.PBI_DATA;
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const cc = PBI.cc;

  /* ---------- KPI card ---------- */
  function sparkFor(api, measureName, extra) {
    const m = M.MEASURES[measureName];
    const byMonth = M.groupBy(api.q(m.table, { exclude: ['Month', 'Quarter'], extra }), 'Month');
    return D.months.map(mo => (byMonth.has(mo.idx) ? m.fn(byMonth.get(mo.idx)) : null));
  }
  function drawSpark(api, v, el, values, target) {
    const key = v.id + ':spark';
    if (PBI.charts[key]) PBI.charts[key].dispose();
    const c = echarts.init(el, null, { renderer: 'svg' });
    PBI.charts[key] = c;
    const series = [{
      type: 'line', data: values, showSymbol: false, smooth: false, lineStyle: { width: 1.5, color: v.accent || cc.COLORS[0] },
      areaStyle: { color: v.accent || cc.COLORS[0], opacity: 0.08 }
    }];
    if (target !== null && target !== undefined) {
      series[0].markLine = { silent: true, symbol: 'none', label: { show: false }, lineStyle: { color: '#D13438', type: 'dashed', width: 1 }, data: [{ yAxis: target }] };
    }
    c.setOption({
      animation: false, grid: { left: 2, right: 2, top: 3, bottom: 2 },
      xAxis: { type: 'category', show: false, data: D.months.map(m => m.short) },
      yAxis: { type: 'value', show: false, min: target === 0 ? 0 : 'dataMin', scale: true },
      series
    });
  }
  PBI.kinds.kpi = function (api, v) {
    const m = M.MEASURES[v.measure];
    const res = v.compute ? v.compute(api) : { value: m.fn(api.q(m.table)), fmt: m.fmt };
    const valueText = M.fmt(res.value, res.fmt || (m && m.fmt));
    let sub = res.sub || '';
    if (!sub && v.target !== undefined && res.value !== null) {
      const gap = res.value - v.target;
      const good = v.higherBetter ? gap >= 0 : gap <= 0;
      sub = '<span>' + (v.targetLabel || 'Target ' + M.fmt(v.target, res.fmt || m.fmt)) + '</span><span class="' + (good ? 'ok' : 'bad') + '">' +
        (gap >= 0 ? '+' : '') + M.fmt(gap, (res.fmt || m.fmt) === 'pct' ? 'pct' : res.fmt || m.fmt) + '</span>';
    }
    api.el.innerHTML = '<div class="kpi"><span class="kpi-accent" style="background:' + (v.accent || cc.COLORS[0]) + '"></span>' +
      '<div class="kpi-label">' + PBI.esc(v.label) + '</div><div class="kpi-row"><div class="kpi-value' + (v.small ? ' sm' : '') + '">' + PBI.esc(valueText) + '</div>' +
      (v.spark ? '<div class="kpi-spark"></div>' : '') + '</div><div class="kpi-sub">' + sub + '</div></div>';
    if (v.spark) drawSpark(api, v, api.el.querySelector('.kpi-spark'), res.spark || sparkFor(api, v.measure), v.target);
    const card = api.el.querySelector('.kpi');
    card.addEventListener('mousemove', ev => PBI.tipShow(PBI.ttHtml([[v.label, valueText]], v.dax && M.DAX[v.dax[0]]), ev));
    card.addEventListener('mouseleave', PBI.tipHide);
    api.setTable([{ name: v.label, fmt: res.fmt || m.fmt }], [[res.value]]);
  };

  /* ---------- OEE gauge with target needle ---------- */
  PBI.kinds.gauge = function (api, v) {
    const rows = api.q('Production');
    const value = M.MS.oee(rows);
    const target = 0.85;
    api.setTable([{ name: 'Plant' }, { name: 'OEE', fmt: 'pct' }, { name: 'Target', fmt: 'pct' }], [[v.plant, value, target]]);
    if (value === null) { api.blank('(Blank)'); return; }
    const geom = { startAngle: 200, endAngle: -20, min: 0, max: 1, center: ['50%', '58%'], radius: '88%' };
    const chart = api.chart();
    chart.setOption(cc.base({
      tooltip: cc.tooltip({ trigger: 'item', formatter: () => PBI.ttHtml([['Plant', v.plant], ['OEE', M.fmt(value, 'pct')], ['Target', M.fmt(target, 'pct')], ['Availability', M.fmt(M.MS.availability(rows), 'pct')], ['Performance', M.fmt(M.MS.performance(rows), 'pct')], ['Quality', M.fmt(M.MS.quality(rows), 'pct')]]) }),
      series: [
        Object.assign({}, geom, {
          type: 'gauge', progress: { show: true, width: 20, itemStyle: { color: value >= target ? cc.COLORS[0] : cc.COLORS[0] } },
          axisLine: { lineStyle: { width: 20, color: [[1, '#E6E6E6']] } }, pointer: { show: false }, axisTick: { show: false },
          splitLine: { show: false }, axisLabel: { show: false }, anchor: { show: false }, title: { show: false },
          detail: { valueAnimation: false, offsetCenter: [0, '0%'], fontSize: 22, fontWeight: 600, color: '#252423', fontFamily: cc.FONT, formatter: x => (x * 100).toFixed(1) + '%' },
          data: [{ value }]
        }),
        Object.assign({}, geom, {
          type: 'gauge', silent: true, progress: { show: false }, axisLine: { show: false }, axisTick: { show: false }, splitLine: { show: false },
          axisLabel: { show: false }, anchor: { show: false }, title: { show: false }, detail: { show: false },
          pointer: { show: true, icon: 'rect', length: '30%', width: 3, offsetCenter: [0, '-62%'], itemStyle: { color: '#252423' } },
          data: [{ value: target }]
        })
      ],
      graphic: [
        { type: 'text', left: '13%', bottom: 4, style: { text: '0%', fill: '#605E5C', font: '11px ' + cc.FONT } },
        { type: 'text', right: '10%', bottom: 4, style: { text: '100%', fill: '#605E5C', font: '11px ' + cc.FONT } },
        { type: 'text', left: 'center', bottom: 16, style: { text: 'Target ' + M.fmt(target, 'pct') + '   ' + (value >= target ? '+' : '') + ((value - target) * 100).toFixed(1) + ' pt', fill: value >= target ? '#107C10' : '#A4262C', font: '600 11px ' + cc.FONT } }
      ]
    }), true);
  };

  /* ---------- field parameter button slicer ---------- */
  PBI.kinds.paramSlicer = function (api) {
    const S = api.S;
    api.el.innerHTML = '<div class="btnslicer"><span class="btnslicer-label">Plant KPI</span>' +
      M.FIELD_PARAMS.map(p => '<button data-p="' + PBI.esc(p.name) + '" class="' + (S.fieldParam === p.name ? 'on' : '') + '">' + PBI.esc(p.name) + '</button>').join('') + '</div>';
    api.el.querySelectorAll('button').forEach(b => b.addEventListener('click', ev => {
      ev.stopPropagation();
      S.fieldParam = b.dataset.p;
      PBI.app.refresh();
    }));
    api.setTable([{ name: 'Plant KPI' }, { name: 'Plant KPI Order' }], M.FIELD_PARAMS.map((p, i) => [p.name, i]));
  };

  function currentParam(S) {
    const p = M.FIELD_PARAMS.find(x => x.name === S.fieldParam) || M.FIELD_PARAMS[0];
    return Object.assign({}, p, M.MEASURES[p.name]);
  }

  /* ---------- line chart, field parameter by month and plant ---------- */
  PBI.kinds.paramLine = function (api, v) {
    const p = currentParam(api.S);
    api.setTitle(p.name + ' by Month and Plant');
    v.dax = [p.name, 'Plant KPI'];
    const rows = api.q(p.table);
    const byPlant = M.groupBy(rows, 'Plant');
    const plants = D.plants.map(x => x.name).filter(n => byPlant.has(n));
    if (!plants.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const tableRows = [];
    const series = plants.map(name => {
      const byMonth = M.groupBy(byPlant.get(name), 'Month');
      const data = D.months.map(mo => {
        const val = byMonth.has(mo.idx) ? p.fn(byMonth.get(mo.idx)) : null;
        tableRows.push([mo.label, name, val]);
        return val;
      });
      const colorIdx = D.plants.findIndex(x => x.name === name);
      return { type: 'line', name, data, showSymbol: false, symbolSize: 6, lineStyle: { width: 2 }, color: cc.COLORS[colorIdx], emphasis: { focus: 'series' } };
    });
    if (p.target !== null) {
      series[0].markLine = {
        silent: true, symbol: 'none', lineStyle: { color: '#A4262C', type: 'dashed', width: 1 },
        label: { formatter: p.targetLabel, position: 'insideEndTop', color: '#A4262C', fontSize: 10 }, data: [{ yAxis: p.target }]
      };
    }
    const sel = api.selfSel && api.selfSel.field === 'Month' ? api.selfSel : null;
    if (sel) {
      series.forEach(s2 => {
        s2.showSymbol = true;
        s2.data = s2.data.map((val, i) => ({ value: val, symbol: sel.values.has(i) ? 'circle' : 'none', symbolSize: 9 }));
      });
    }
    const chart = api.chart();
    chart.setOption(cc.base({
      legend: cc.legend('Plant', plants),
      graphic: cc.legendTitle('Plant'),
      grid: { left: 52, right: 16, top: 30, bottom: 40 },
      tooltip: cc.tooltip({
        trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: '#8A8886' } },
        formatter: ps => PBI.ttHtml([['Month', D.months[ps[0].dataIndex].label]].concat(ps.map(x => [x.seriesName, M.fmt(x.value, p.fmt)])))
      }),
      xAxis: cc.axisCat({ data: D.months.map(m => m.short), boundaryGap: false, name: 'Month', nameLocation: 'middle', nameGap: 24 }),
      yAxis: cc.axisVal({ scale: p.fmt === 'pct', axisLabel: { color: '#605E5C', fontSize: 11, formatter: cc.axisFormatter(p.fmt) }, name: p.name, nameLocation: 'middle', nameGap: 40 }),
      series
    }), true);
    api.on('click', e => { api.select('Month', e.dataIndex, !!(e.event && e.event.event && (e.event.event.ctrlKey || e.event.event.metaKey))); });
    api.setTable([{ name: 'Month' }, { name: 'Plant' }, { name: p.name, fmt: p.fmt }], tableRows);
  };

  /* ---------- clustered bar with Plant > Line > Machine hierarchy ---------- */
  function levelKeys(api, v, d) {
    const field = v.hierarchy[d.level];
    const plant = ST.rolePlant();
    let keys = M.fieldValues(field, plant);
    const extra = d.path.map((val, i) => ({ field: v.hierarchy[i], values: new Set([val]) }));
    return { field, keys, extra };
  }
  function parentOf(field, key) {
    if (field === 'Line') return D.lines.find(l => l.id === key).plant;
    if (field === 'Machine') return D.machines.find(m => m.id === key).line;
    return '';
  }
  PBI.kinds.drillBar = function (api, v) {
    const p = currentParam(api.S);
    const d = api.drill();
    const lk = levelKeys(api, v, d);
    api.setTitle(p.name + ' by ' + lk.field + ' and Shift');
    v.dax = [p.name, 'Plant KPI'];
    const present = M.groupBy(api.q(p.table, { sel: false, extra: lk.extra }), lk.field);
    let keys = lk.keys.filter(k => present.has(k));
    if (!keys.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const totals = keys.map(k => p.fn(present.get(k)));
    const sort = api.sort() || { by: 'value', dir: 'desc' };
    const label = k => (d.expanded && d.level > 0 ? parentOf(lk.field, k) + ' | ' : '') + k;
    const order = cc.sortKeys(keys, totals, sort.by === 'value' ? sort : { by: 'label', dir: sort.dir }, label);
    keys = order.map(i => keys[i]);
    const shifts = ['A', 'B', 'C'];
    const tableRows = [];
    const series = [];
    shifts.forEach((sh, si) => {
      const extra = lk.extra.concat([{ field: 'Shift', values: new Set([sh]) }]);
      const r = cc.hlData(api, p.table, lk.field, keys, p.fn, extra);
      keys.forEach((k, i) => tableRows.push([label(k), 'Shift ' + sh, r.full[i]]));
      cc.hlBars({ name: 'Shift ' + sh, color: cc.COLORS[si], full: r.full, hl: r.hl, horizontal: true, barMaxWidth: 14, gap: '25%', label: keys.length <= 4 ? x => M.fmt(x, p.fmt) : null })
        .forEach(s => series.push(s));
    });
    const many = keys.length > 12;
    const chart = api.chart();
    chart.setOption(cc.base({
      legend: cc.legend('Shift', ['Shift A', 'Shift B', 'Shift C']),
      graphic: cc.legendTitle('Shift'),
      grid: { left: 8, right: many ? 26 : 40, top: 28, bottom: 30, containLabel: true },
      tooltip: cc.tooltip({
        trigger: 'item', formatter: e => {
          const i = e.dataIndex;
          const s = tableRows.find(r => r[0] === label(keys[i]) && r[1] === e.seriesName);
          const rows = [[lk.field, label(keys[i])], ['Shift', e.seriesName.replace('Shift ', '')], [p.name, M.fmt(s ? s[2] : null, p.fmt)]];
          if (api.foreignSel) rows.push(['Highlighted', 'Selection from ' + (api.foreignSel.title || 'visual')]);
          if (lk.field === 'Machine') rows.push(['Drill through', 'Right-click a bar']);
          return PBI.ttHtml(rows);
        }
      }),
      yAxis: cc.axisCat({ data: keys.map(label), inverse: true, axisLabel: { color: '#605E5C', fontSize: 11, width: d.expanded ? 150 : 110, overflow: 'truncate' } }),
      xAxis: cc.axisVal({ scale: false, axisLabel: { color: '#605E5C', fontSize: 11, formatter: cc.axisFormatter(p.fmt) }, name: p.name, nameLocation: 'middle', nameGap: 22 }),
      dataZoom: many ? [{ type: 'slider', yAxisIndex: 0, right: 4, width: 10, startValue: 0, endValue: 11, showDetail: false, brushSelect: false, borderColor: 'transparent', fillerColor: '#C8C6C4', handleSize: 0, showDataShadow: false, backgroundColor: '#F3F2F1' }, { type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: false, moveOnMouseWheel: true }] : [],
      series
    }), true);
    api.on('click', e => {
      const key = keys[e.dataIndex];
      if (d.mode && d.level < v.hierarchy.length - 1) { api.drillInto(key); return; }
      const ne = e.event && e.event.event;
      api.select(lk.field, key, !!(ne && (ne.ctrlKey || ne.metaKey)));
    });
    const zr = chart.getZr();
    zr.off('contextmenu');
    zr.on('contextmenu', e => {
      const pt = [e.offsetX, e.offsetY];
      if (!chart.containPixel('grid', pt)) return;
      const raw = chart.convertFromPixel({ gridIndex: 0 }, pt);
      const yv = Array.isArray(raw) ? raw[1] : raw;
      const idx = typeof yv === 'number' ? Math.round(yv) : keys.map(label).indexOf(yv);
      if (!(idx >= 0 && idx < keys.length)) return;
      if (e.event) e.event.preventDefault();
      api.context(e.event, { field: lk.field, value: keys[idx] });
    });
    api.setTable([{ name: lk.field }, { name: 'Shift' }, { name: p.name, fmt: p.fmt }], tableRows);
  };

  /* ---------- Pareto: downtime reasons, bars plus cumulative % ---------- */
  PBI.kinds.pareto = function (api, v) {
    const fn = M.MS.downtimeHours;
    const shown = M.groupBy(api.q('Downtime', { sel: false }), 'Reason');
    const all = M.groupBy(api.q('Downtime', { sel: false, exclude: ['Reason'] }), 'Reason');
    const allTotal = [...all.values()].reduce((s, r) => s + fn(r), 0);
    let keys = [...shown.keys()];
    if (!keys.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const vals = keys.map(k => fn(shown.get(k)));
    const order = cc.sortKeys(keys, vals, api.sort() || { by: 'value', dir: 'desc' }, k => k);
    keys = order.map(i => keys[i]);
    const r = cc.hlData(api, 'Downtime', 'Reason', keys, fn);
    let run = 0;
    const cum = r.full.map(x => { run += x || 0; return allTotal ? run / allTotal : null; });
    const series = cc.hlBars({ name: 'Downtime hours', color: cc.COLORS[1], full: r.full, hl: r.hl, label: x => M.fmt(x, 'num'), barMaxWidth: 54, gap: '22%' });
    series.push({
      type: 'line', name: 'Cumulative %', yAxisIndex: 1, data: cum, color: cc.COLORS[2], symbol: 'circle', symbolSize: 6, lineStyle: { width: 2 },
      label: { show: true, position: 'top', fontSize: 10, color: '#605E5C', formatter: e => (e.value * 100).toFixed(0) + '%' },
      markLine: { silent: true, symbol: 'none', lineStyle: { color: '#A4262C', type: 'dashed', width: 1 }, label: { formatter: '80%', position: 'insideStartTop', color: '#A4262C', fontSize: 10 }, data: [{ yAxis: 0.8 }] }
    });
    const card = (api.S.filtersVisual[v.id] || []).find(c => c.type === 'topn');
    const chart = api.chart();
    chart.setOption(cc.base({
      legend: cc.legend(null, ['Downtime hours', 'Cumulative %']),
      grid: { left: 50, right: 46, top: 30, bottom: 70 },
      tooltip: cc.tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.04)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          const rows = [['Downtime reason', keys[i]], ['Downtime hours', M.fmt(r.full[i], 'hrs')], ['Cumulative %', M.fmt(cum[i], 'pct')], ['Share of all reasons', M.fmt(allTotal ? r.full[i] / allTotal : null, 'pct')]];
          if (r.hl) rows.push(['Highlighted', M.fmt(r.hl[i], 'hrs')]);
          return PBI.ttHtml(rows);
        }
      }),
      xAxis: cc.axisCat({ data: keys, axisLabel: { color: '#605E5C', fontSize: 11, interval: 0, width: 74, overflow: 'break', lineHeight: 13 }, name: 'Downtime reason' + (card ? '  (Top ' + card.topN.n + ' by ' + card.topN.by + ')' : ''), nameLocation: 'middle', nameGap: 52 }),
      yAxis: [
        cc.axisVal({ name: 'Downtime hours', nameLocation: 'middle', nameGap: 38, axisLabel: { color: '#605E5C', fontSize: 11, formatter: cc.axisFormatter('num') } }),
        cc.axisVal({ min: 0, max: 1, splitLine: { show: false }, axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => (x * 100).toFixed(0) + '%' } })
      ],
      series
    }), true);
    cc.onPointClick(api, 'Reason', e => (e.seriesType === 'bar' ? keys[e.dataIndex] : undefined));
    api.setTable([{ name: 'Downtime reason' }, { name: 'Downtime hours', fmt: 'hrs' }, { name: 'Cumulative %', fmt: 'pct' }], keys.map((k, i) => [k, r.full[i], cum[i]]));
  };
})();
