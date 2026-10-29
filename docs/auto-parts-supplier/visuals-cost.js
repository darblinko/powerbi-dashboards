/* Page 2 visuals: waterfall, ribbon chart, cost variance matrix, variance by category bar. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const D = window.PBI_DATA;
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const cc = PBI.cc;
  const TH = M.THEME;

  /* ---------- waterfall ---------- */
  PBI.kinds.waterfall = function (api) {
    const rows = api.q('Cost');
    if (!rows.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const byCat = M.groupBy(rows, 'Category');
    const budget = M.MS.budget(rows), actual = M.MS.actual(rows);
    const cats = D.categories.filter(c => byCat.has(c));
    const deltas = cats.map(c => M.MS.variance(byCat.get(c)));
    const labels = ['Budgeted cost'].concat(cats, ['Actual cost']);
    const base = [0], inc = [null], dec = [null], tot = [budget];
    let running = budget;
    const levels = [budget];
    deltas.forEach(dv => {
      if (dv >= 0) { base.push(running); inc.push(dv); dec.push(null); } else { base.push(running + dv); inc.push(null); dec.push(-dv); }
      tot.push(null);
      running += dv;
      levels.push(running);
    });
    base.push(0); inc.push(null); dec.push(null); tot.push(actual);
    const lo = Math.min(...levels, actual), hi = Math.max(...levels, actual);
    const span = Math.max(hi - lo, Math.abs(hi) * 0.002);
    const mag = Math.pow(10, Math.floor(Math.log10(span)));
    const axisMin = Math.max(0, Math.floor((lo - span * 1.2) / mag) * mag);
    const sel = api.selfSel && api.selfSel.field === 'Category' ? api.selfSel.values : null;
    const op = i => (sel && i > 0 && i < labels.length - 1 && !sel.has(labels[i]) ? 0.4 : 1);
    const item = (vals, color) => vals.map((x, i) => (x === null ? null : { value: x, itemStyle: { color, opacity: op(i) } }));
    const lab = (fmtFn) => ({ show: true, position: 'top', fontSize: 10, color: '#605E5C', formatter: fmtFn });
    const chart = api.chart();
    chart.setOption(cc.base({
      legend: cc.legend('Category', ['Increase', 'Decrease', 'Total']),
      graphic: cc.legendTitle('Category'),
      grid: { left: 56, right: 14, top: 30, bottom: 44 },
      tooltip: cc.tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.04)' } },
        formatter: ps => {
          const i = ps[0].dataIndex;
          if (i === 0 || i === labels.length - 1) return PBI.ttHtml([['Category', labels[i]], [labels[i], M.fmt(tot[i], 'curFull')]]);
          const dv = deltas[i - 1];
          return PBI.ttHtml([['Category', labels[i]], ['Cost variance', (dv >= 0 ? '+' : '') + M.fmt(dv, 'curFull')], ['Variance %', M.fmt(M.MS.variancePct(byCat.get(labels[i])), 'pct')], ['Running total', M.fmt(levels[i], 'cur')]]);
        }
      }),
      xAxis: cc.axisCat({ data: labels, axisLabel: { color: '#605E5C', fontSize: 11, interval: 0, width: 72, overflow: 'break' } }),
      yAxis: cc.axisVal({ min: axisMin, name: 'Cost (USD)', nameLocation: 'middle', nameGap: 44, axisLabel: { color: '#605E5C', fontSize: 11, formatter: v => M.fmt(v, 'cur') } }),
      series: [
        { type: 'bar', name: 'base', stack: 'wf', silent: true, itemStyle: { color: 'transparent' }, data: base, tooltip: { show: false } },
        { type: 'bar', name: 'Increase', stack: 'wf', barCategoryGap: '28%', color: TH.increase, data: item(inc, TH.increase), label: lab(e => '+' + M.fmt(e.value, 'cur')) },
        { type: 'bar', name: 'Decrease', stack: 'wf', color: TH.decrease, data: item(dec, TH.decrease), label: lab(e => '-' + M.fmt(e.value, 'cur')) },
        { type: 'bar', name: 'Total', stack: 'wf', color: TH.total, data: item(tot, TH.total), label: lab(e => M.fmt(e.value, 'cur')) }
      ]
    }), true);
    api.on('click', e => {
      const i = e.dataIndex;
      if (i === 0 || i === labels.length - 1) return;
      const ne = e.event && e.event.event;
      api.select('Category', labels[i], !!(ne && (ne.ctrlKey || ne.metaKey)));
    });
    api.setTable([{ name: 'Category' }, { name: 'Amount', fmt: 'curFull' }, { name: 'Running total', fmt: 'curFull' }],
      labels.map((l, i) => [l, i === 0 ? budget : i === labels.length - 1 ? actual : deltas[i - 1], levels[Math.min(i, levels.length - 1)]]));
  };

  /* ---------- ribbon chart: supplier spend rank by quarter ---------- */
  function ribbonPath(x1, t1, b1, x2, t2, b2) {
    const xm = (x1 + x2) / 2;
    return 'M' + x1 + ' ' + t1 + 'C' + xm + ' ' + t1 + ' ' + xm + ' ' + t2 + ' ' + x2 + ' ' + t2 + 'L' + x2 + ' ' + b2 + 'C' + xm + ' ' + b2 + ' ' + xm + ' ' + b1 + ' ' + x1 + ' ' + b1 + 'Z';
  }
  PBI.kinds.ribbon = function (api) {
    const rows = api.q('Receipts');
    if (!rows.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const bySup = M.groupBy(rows, 'Supplier');
    const top = [...bySup.entries()].map(([k, r]) => [k, M.MS.spend(r)]).sort((a, b) => b[1] - a[1]).slice(0, 8).map(x => x[0]);
    const qs = D.quarters;
    const spend = top.map(s => { const g = M.groupBy(bySup.get(s), 'Quarter'); return qs.map(q => (g.has(q) ? M.MS.spend(g.get(q)) : 0)); });
    const totals = qs.map((_, qi) => spend.reduce((a, s) => a + s[qi], 0));
    const gap = Math.max(...totals) * 0.012;
    const pos = top.map(() => qs.map(() => [0, 0]));
    const rank = top.map(() => qs.map(() => 0));
    qs.forEach((_, qi) => {
      const order = top.map((_, si) => si).sort((a, b) => spend[a][qi] - spend[b][qi]);
      let y = 0;
      order.forEach((si, k) => { pos[si][qi] = [y, y + spend[si][qi]]; rank[si][qi] = top.length - k; y += spend[si][qi] + gap; });
    });
    const sel = api.selfSel && api.selfSel.field === 'Supplier' ? api.selfSel.values : null;
    const series = top.map((s, si) => {
      const color = cc.COLORS[si % cc.COLORS.length];
      const dim = sel && !sel.has(s);
      return {
        type: 'custom', name: s, color,
        data: qs.map((q, qi) => [qi, pos[si][qi][0], pos[si][qi][1], qi < qs.length - 1 ? pos[si][qi + 1][0] : -1, qi < qs.length - 1 ? pos[si][qi + 1][1] : -1, spend[si][qi]]),
        renderItem: (params, a) => {
          const qi = a.value(0);
          const p0 = a.coord([qi, a.value(1)]), p1 = a.coord([qi, a.value(2)]);
          const bw = a.size([1, 0])[0] * 0.4;
          const children = [{ type: 'rect', shape: { x: p0[0] - bw / 2, y: p1[1], width: bw, height: Math.max(1, p0[1] - p1[1]) }, style: { fill: color, opacity: dim ? 0.3 : 1 } }];
          if (a.value(3) >= 0) {
            const n0 = a.coord([qi + 1, a.value(3)]), n1 = a.coord([qi + 1, a.value(4)]);
            children.push({ type: 'path', shape: { pathData: ribbonPath(p0[0] + bw / 2, p1[1], p0[1], n0[0] - bw / 2, n1[1], n0[1]) }, style: { fill: color, opacity: dim ? 0.12 : 0.42 } });
          }
          if (p0[1] - p1[1] > 15) {
            children.push({ type: 'text', style: { text: M.fmt(a.value(5), 'cur'), x: p0[0], y: (p0[1] + p1[1]) / 2, align: 'center', verticalAlign: 'middle', fill: '#FFFFFF', font: '600 10px ' + cc.FONT, opacity: dim ? 0.5 : 1 } });
          }
          return { type: 'group', children };
        }
      };
    });
    const chart = api.chart();
    chart.setOption(cc.base({
      legend: cc.legend('Supplier', top, { type: 'scroll', right: 8, pageIconSize: 9, pageTextStyle: { fontSize: 10, color: '#605E5C' } }),
      graphic: cc.legendTitle('Supplier'),
      grid: { left: 52, right: 14, top: 30, bottom: 28 },
      tooltip: cc.tooltip({
        trigger: 'item', formatter: e => {
          const si = top.indexOf(e.seriesName), qi = e.value[0];
          return PBI.ttHtml([['Supplier', e.seriesName], ['Quarter', qs[qi]], ['Spend', M.fmt(spend[si][qi], 'curFull')], ['Rank', String(rank[si][qi])]]);
        }
      }),
      xAxis: cc.axisCat({ data: qs }),
      yAxis: cc.axisVal({ max: Math.max(...totals) + gap * top.length, axisLabel: { color: '#605E5C', fontSize: 11, formatter: v => M.fmt(v, 'cur') } }),
      series
    }), true);
    api.on('click', e => { const ne = e.event && e.event.event; api.select('Supplier', e.seriesName, !!(ne && (ne.ctrlKey || ne.metaKey))); });
    const tbl = [];
    top.forEach((s, si) => qs.forEach((q, qi) => tbl.push([s, q, spend[si][qi], rank[si][qi]])));
    api.setTable([{ name: 'Supplier' }, { name: 'Quarter' }, { name: 'Spend', fmt: 'curFull' }, { name: 'Rank', fmt: 'int' }], tbl);
  };

  /* ---------- matrix: cost variance by plant (and category) by month ---------- */
  function matrixRows(api, v, rows) {
    const d = api.drill();
    const plants = M.fieldValues('Plant', ST.rolePlant());
    const byPlant = M.groupBy(rows, 'Plant');
    const out = [];
    if (d.level === 1 && !d.expanded) {
      const src = d.path.length ? (byPlant.get(d.path[0]) || []) : rows;
      const byCat = M.groupBy(src, 'Category');
      D.categories.filter(c => byCat.has(c)).forEach(c => out.push({ label: c, lvl: 0, field: 'Category', key: c, rows: byCat.get(c) }));
      return out;
    }
    plants.filter(p => byPlant.has(p)).forEach(p => {
      const open = (d.level === 1 && d.expanded) || api.S.matrixExpanded.has(p);
      out.push({ label: p, lvl: 0, field: 'Plant', key: p, rows: byPlant.get(p), toggle: d.level === 0 ? (open ? '-' : '+') : null });
      if (open) {
        const byCat = M.groupBy(byPlant.get(p), 'Category');
        D.categories.filter(c => byCat.has(c)).forEach(c => out.push({ label: c, lvl: 1, field: 'Category', key: c, rows: byCat.get(c) }));
      }
    });
    return out;
  }
  PBI.kinds.matrix = function (api, v) {
    const rows = api.q('Cost');
    const list = matrixRows(api, v, rows);
    if (!list.length) { api.blank('(Blank)'); api.setTable([], []); return; }
    const cells = list.map(r => { const g = M.groupBy(r.rows, 'Month'); return D.months.map(mo => (g.has(mo.idx) ? M.MS.variance(g.get(mo.idx)) : null)).concat([M.MS.variance(r.rows)]); });
    const totalRow = (() => { const g = M.groupBy(rows, 'Month'); return D.months.map(mo => (g.has(mo.idx) ? M.MS.variance(g.get(mo.idx)) : null)).concat([M.MS.variance(rows)]); })();
    const maxMonth = Math.max(1, ...cells.flatMap(c => c.slice(0, 12).map(x => Math.abs(x || 0))));
    const maxTotal = Math.max(1, ...cells.map(c => Math.abs(c[12] || 0)));
    const sel = api.selfSel;
    const cell = (x, max, isTotal) => {
      if (x === null) return '<td' + (isTotal ? ' class="coltotal"' : '') + '></td>';
      const w = Math.min(48, Math.abs(x) / max * 48);
      const bar = '<span class="mbar ' + (x > 0 ? 'pos' : 'neg') + '" style="' + (x > 0 ? 'left:50%' : 'right:50%') + ';width:' + w.toFixed(1) + '%"></span>';
      return '<td class="' + (isTotal ? 'coltotal ' : '') + '">' + bar + '<span class="mval ' + (x > 0 ? 'font-bad' : 'font-good') + '">' + M.fmt(x, 'cur') + '</span></td>';
    };
    let h = '<div style="position:absolute;inset:0 6px 4px 8px;overflow:auto"><table class="matrix"><thead><tr><th>' + (list[0].field === 'Plant' ? 'Plant' : 'Category') + '</th>' +
      D.months.map(m => '<th>' + m.short + '</th>').join('') + '<th>Total</th></tr></thead><tbody>';
    list.forEach((r, i) => {
      const faded = sel && !(sel.field === r.field && sel.values.has(r.key));
      h += '<tr class="lvl' + r.lvl + (faded ? ' faded' : '') + '" data-i="' + i + '"><td title="' + PBI.esc(r.label) + '">' + (r.toggle ? '<span class="tog" data-t="' + PBI.esc(r.key) + '">' + r.toggle + '</span>' : '') + PBI.esc(r.label) + '</td>' +
        cells[i].slice(0, 12).map(x => cell(x, maxMonth, false)).join('') + cell(cells[i][12], maxTotal, true) + '</tr>';
    });
    h += '<tr class="total"><td>Total</td>' + totalRow.slice(0, 12).map(x => '<td class="' + (x > 0 ? 'font-bad' : 'font-good') + '">' + M.fmt(x, 'cur') + '</td>').join('') +
      '<td class="coltotal ' + (totalRow[12] > 0 ? 'font-bad' : 'font-good') + '">' + M.fmt(totalRow[12], 'cur') + '</td></tr></tbody></table></div>';
    api.el.innerHTML = h;
    api.el.querySelectorAll('.tog').forEach(t => t.addEventListener('click', ev => {
      ev.stopPropagation();
      const set = new Set(api.S.matrixExpanded);
      if (set.has(t.dataset.t)) set.delete(t.dataset.t); else set.add(t.dataset.t);
      api.S.matrixExpanded = set;
      PBI.app.refresh();
    }));
    api.el.querySelectorAll('tbody tr[data-i]').forEach(tr => {
      const r = list[+tr.dataset.i];
      tr.firstChild.addEventListener('click', ev => {
        ev.stopPropagation();
        const d = api.drill();
        if (d.mode && r.field === 'Plant' && d.level === 0) { api.drillInto(r.key); return; }
        api.select(r.field, r.key, ev.ctrlKey || ev.metaKey);
      });
      tr.addEventListener('mousemove', ev => {
        const td = ev.target.closest('td');
        const ci = td ? [...tr.children].indexOf(td) - 1 : -1;
        if (ci < 0) { PBI.tipHide(); return; }
        const val = cells[+tr.dataset.i][ci];
        PBI.tipShow(PBI.ttHtml([[r.field, r.label], ['Month', ci < 12 ? D.months[ci].label : 'Total'], ['Cost variance', M.fmt(val, 'curFull')]]), ev);
      });
      tr.addEventListener('mouseleave', PBI.tipHide);
    });
    api.setTable([{ name: list[0].field }].concat(D.months.map(m => ({ name: m.label, fmt: 'curFull' })), [{ name: 'Total', fmt: 'curFull' }]),
      list.map((r, i) => [r.label].concat(cells[i])));
  };

  /* ---------- variance % by category, conditional colours ---------- */
  PBI.kinds.categoryBar = function (api) {
    const keys0 = D.categories;
    const r0 = cc.hlData(api, 'Cost', 'Category', keys0, M.MS.variancePct);
    const order = cc.sortKeys(keys0, r0.full, api.sort() || { by: 'value', dir: 'desc' }, k => k);
    const keys = order.map(i => keys0[i]);
    const full = order.map(i => r0.full[i]);
    const hl = r0.hl ? order.map(i => r0.hl[i]) : null;
    if (full.every(x => x === null)) { api.blank('(Blank)'); api.setTable([], []); return; }
    const series = cc.hlBars({ name: 'Variance %', full, hl, horizontal: true, barMaxWidth: 20, colorAt: i => ((full[i] || 0) > 0 ? TH.decrease : TH.increase), label: x => M.fmt(x, 'pct') });
    const chart = api.chart();
    chart.setOption(cc.base({
      grid: { left: 8, right: 52, top: 8, bottom: 26, containLabel: true },
      tooltip: cc.tooltip({ trigger: 'item', formatter: e => PBI.ttHtml([['Category', keys[e.dataIndex]], ['Variance %', M.fmt(full[e.dataIndex], 'pct')]].concat(hl ? [['Highlighted', M.fmt(hl[e.dataIndex], 'pct')]] : [])) }),
      yAxis: cc.axisCat({ data: keys, inverse: true }),
      xAxis: cc.axisVal({ axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => (x * 100).toFixed(0) + '%' } }),
      series
    }), true);
    cc.onPointClick(api, 'Category', e => keys[e.dataIndex]);
    api.setTable([{ name: 'Category' }, { name: 'Variance %', fmt: 'pct' }], keys.map((k, i) => [k, full[i]]));
  };
})();
