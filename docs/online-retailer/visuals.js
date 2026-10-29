/* Page 1 visuals and the shared slicers. Each factory returns a visual definition. */
(function () {
  'use strict';
  const M = window.MODEL,
    F = window.FRAME,
    D = window.DATA;
  const S = () => M.getState();

  /* ---------- Slicers (synced across pages) ---------- */
  function titleBox(title, subtitle) {
    return {
      id: 'title-' + title.replace(/\W+/g, ''),
      type: 'text',
      noHeader: true,
      noChrome: true,
      render(body) {
        body.innerHTML = '<div class="report-title">' + title + '</div><div class="report-sub">' + subtitle + '</div>';
      }
    };
  }

  function dateSlicer(vid) {
    return {
      id: vid,
      type: 'slicer',
      noHeader: true,
      title: 'Date',
      render(body) {
        const s = S();
        body.innerHTML =
          '<div class="rel-row"><select class="pbi-select" data-k="dir"><option>Last</option></select>' +
          '<input class="pbi-input rel-n" type="number" min="1" max="36" value="' +
          s.dateRel.n +
          '" aria-label="Number of periods">' +
          '<select class="pbi-select" data-k="unit"><option value="M">Months (Calendar)</option><option value="Y">Years (Calendar)</option></select></div>' +
          '<div class="rel-range">' +
          M.rangeLabel(s) +
          '</div>';
        body.querySelector('[data-k=unit]').value = s.dateRel.unit;
        const apply = () => {
          const unit = body.querySelector('[data-k=unit]').value;
          const max = unit === 'Y' ? 3 : 36;
          const n = Math.min(max, Math.max(1, parseInt(body.querySelector('.rel-n').value, 10) || 1));
          M.setState({ dateRel: { n, unit }, selection: null });
        };
        body.querySelector('.rel-n').addEventListener('change', apply);
        body.querySelector('[data-k=unit]').addEventListener('change', apply);
      }
    };
  }

  function categorySlicer(vid) {
    return {
      id: vid,
      type: 'slicer',
      noHeader: true,
      title: 'Category',
      render(body) {
        const s = S();
        body.innerHTML =
          '<div class="tile-row">' +
          D.CATEGORIES.map(
            c =>
              '<button class="tile' + (s.slicerCat.includes(c) ? ' on' : '') + '" data-v="' + c + '">' + c + '</button>'
          ).join('') +
          '</div>';
        body.querySelectorAll('.tile').forEach(b =>
          b.addEventListener('click', e => {
            const v = b.dataset.v;
            const cur = S().slicerCat;
            let next;
            if (e.ctrlKey || e.metaKey) next = cur.includes(v) ? cur.filter(x => x !== v) : cur.concat([v]);
            else next = cur.length === 1 && cur[0] === v ? [] : [v];
            M.setState({ slicerCat: next, selection: null });
          })
        );
      }
    };
  }

  function deviceSlicer(vid) {
    return {
      id: vid,
      type: 'slicer',
      noHeader: true,
      title: 'Device type',
      render(body) {
        const s = S();
        body.innerHTML =
          '<button class="dropdown-box"><span>' +
          s.slicerDevice +
          '</span>' +
          '<svg viewBox="0 0 16 16" width="12" height="12"><path d="M3 6l5 5 5-5" fill="none" stroke="#252423" stroke-width="1.4"/></svg></button>';
        const btn = body.querySelector('.dropdown-box');
        btn.addEventListener('click', e => {
          e.stopPropagation();
          const opts = ['All'].concat(D.DEVICES).map(d => ({
            label: d === 'All' ? 'Select all' : d,
            checked: S().slicerDevice === d,
            action: () => M.setState({ slicerDevice: d, selection: null })
          }));
          F.openMenu(btn, opts, { alignLeft: true, cls: 'dropdown-list' });
        });
      }
    };
  }

  /* ---------- KPI cards ---------- */
  function monthlySeries(key, opts) {
    const g = M.groupBy(M.rows(opts), r => r.m);
    const [a, b] = M.dateRange(S());
    const out = [];
    for (let m = a; m <= b; m++) out.push(g.has(m) ? M.MEASURES[key].f(g.get(m)) : null);
    return out;
  }
  function sparkSvg(vals, color) {
    const clean = vals.map(v => (v === null ? 0 : v));
    const w = 180,
      h = 26;
    const lo = Math.min.apply(null, clean),
      hi = Math.max.apply(null, clean);
    const span = hi - lo || 1;
    const pts = clean.map((v, i) => [(i / Math.max(1, clean.length - 1)) * w, h - 2 - ((v - lo) / span) * (h - 4)]);
    const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    const last = pts[pts.length - 1];
    return (
      '<svg class="spark" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '" preserveAspectRatio="none">' +
      '<polygon points="' +
      area +
      '" fill="' +
      color +
      '" opacity="0.12"/>' +
      '<polyline points="' +
      line +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="1.5" vector-effect="non-scaling-stroke"/>' +
      (last ? '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2" fill="' + color + '"/>' : '') +
      '</svg>'
    );
  }
  function kpiCard(vid, key) {
    const meas = M.MEASURES[key];
    const def = {
      id: vid,
      type: 'card',
      title: meas.label,
      hideTitle: true,
      dax: [meas.dax, M.pyDax(key)],
      cache: null,
      data() {
        const c = def.cache || {};
        return { columns: [meas.label, meas.label + ' PY', meas.label + ' vs PY %'], rows: [[c.cur, c.py, c.delta]] };
      },
      render(body) {
        const cur = meas.f(M.totals(M.rows({ vid })));
        const py = meas.f(M.totals(M.rows({ vid, shift: -12 })));
        const hasPy = py !== null && M.dateRange(S(), -12)[0] >= 0 && M.dateRange(S())[0] - 12 >= 0;
        const isRate = meas.fmt.startsWith('pct');
        const delta = hasPy && cur !== null && py ? (isRate ? cur - py : (cur - py) / py) : null;
        def.cache = { cur, py, delta };
        const dp = meas.fmt === 'pct2' ? 2 : 1;
        const good = delta === null || Math.abs(delta) < 0.00005 ? null : meas.invert ? delta <= 0 : delta >= 0;
        const arrow = delta === null ? '' : delta >= 0 ? '&#9650;' : '&#9660;';
        const deltaText =
          delta === null
            ? 'Prior year (Blank)'
            : arrow +
              ' ' +
              (isRate
                ? (delta >= 0 ? '+' : '') + (delta * 100).toFixed(dp) + ' pp'
                : (delta >= 0 ? '+' : '') + (delta * 100).toFixed(1) + '%') +
              ' <span class="kpi-vs">vs prior year</span>';
        body.innerHTML =
          '<div class="kpi-label">' +
          meas.label +
          '</div><div class="kpi-value">' +
          M.fmtMeasure(key, cur) +
          '</div>' +
          '<div class="kpi-delta ' +
          (good === null ? '' : good ? 'good' : 'bad') +
          '">' +
          deltaText +
          '</div>' +
          sparkSvg(monthlySeries(key, { vid }), F.THEME[0]);
        body.onmousemove = e =>
          F.showTip(
            e,
            F.tipHtml(meas.label, [
              [meas.label, M.fmtMeasure(key, cur)],
              [meas.label + ' PY', hasPy ? M.fmtMeasure(key, py) : '(Blank)'],
              [
                'vs PY',
                delta === null ? '(Blank)' : isRate ? (delta * 100).toFixed(dp) + ' pp' : (delta * 100).toFixed(1) + '%'
              ]
            ]) +
              '<div class="tt-dax">' +
              F.escapeHtml(meas.dax) +
              '</div>'
          );
        body.onmouseleave = F.hideTip;
      }
    };
    return def;
  }

  /* ---------- Combo chart with Year > Quarter > Month hierarchy ---------- */
  const LEVEL_FIELDS = { expand: ['year', 'yq', 'ym'], next: ['year', 'qtr', 'mon'] };
  function comboKeys(rowsList) {
    const d = S().drill;
    const field = LEVEL_FIELDS[d.mode][d.level];
    const get = M.FIELDS[field].get;
    const order = new Map();
    rowsList.forEach(r => {
      const k = get(r);
      const mo = D.MONTHS[r.m];
      const rank = field === 'qtr' ? mo.quarter : field === 'mon' ? mo.month : r.m;
      if (!order.has(k) || order.get(k) > rank) order.set(k, rank);
    });
    const keys = Array.from(order.keys()).sort((a, b) => order.get(a) - order.get(b));
    return { field, get, keys };
  }
  function parentPreds() {
    return S().drill.parent.map(p => {
      const g = M.FIELDS[p.field].get;
      return r => g(r) === p.value;
    });
  }
  function drillUp() {
    const d = S().drill;
    if (d.level === 0) return;
    const parent = d.parent.length >= d.level ? d.parent.slice(0, -1) : d.parent;
    M.setState({ drill: Object.assign({}, d, { level: d.level - 1, parent, mode: 'expand' }), selection: null });
  }
  function drillNext(mode) {
    const d = S().drill;
    if (d.level === 2) return;
    M.setState({
      drill: Object.assign({}, d, { level: d.level + 1, mode: d.parent.length ? 'expand' : mode }),
      selection: null
    });
  }
  function comboChart(vid) {
    const def = {
      id: vid,
      title: () => 'Revenue and gross margin % by ' + ['year', 'quarter', 'month'][S().drill.level],
      hierarchy: true,
      fields: ['year', 'channel'],
      dax: [M.MEASURES.revenue.dax, M.MEASURES.margin.dax],
      last: null,
      data() {
        const l = def.last;
        return {
          columns: [M.FIELDS[l.field].label, 'Revenue', 'Gross margin %'],
          numeric: [false, true, true],
          rows: l.keys.map((k, i) => [k, l.full[i], l.margin[i] === null ? '' : +(l.margin[i] * 100).toFixed(2)])
        };
      },
      render(body) {
        const extra = parentPreds();
        const fullRows = M.rows({ vid, ignoreSelection: true, extra });
        const selRows = M.rows({ vid, extra });
        const { field, get, keys } = comboKeys(fullRows);
        const gFull = M.groupBy(fullRows, get),
          gSel = M.groupBy(selRows, get);
        const full = keys.map(k => (gFull.has(k) ? gFull.get(k).rev : 0));
        const hl = keys.map(k => (gSel.has(k) ? gSel.get(k).rev : 0));
        const margin = keys.map(k => (gSel.has(k) ? M.MEASURES.margin.f(gSel.get(k)) : null));
        def.last = { field, keys, full, margin };
        const c = F.chart(vid, body);
        const bars = F.highlightSeries(vid, keys, full, hl, F.THEME[0], { barCategoryGap: '28%' });
        bars.forEach(b => {
          b.name = b.name === 'All' ? 'Revenue (all)' : 'Revenue';
        });
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            grid: { left: 52, right: 46, top: 30, bottom: 34 },
            legend: Object.assign({}, F.legendBase, { data: ['Revenue', 'Gross margin %'] }),
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'axis',
              axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.05)' } },
              formatter: ps => {
                const i = ps[0].dataIndex;
                const rowsT = [
                  [M.FIELDS[field].label, keys[i]],
                  ['Revenue', M.fmt(F.hasForeignSelection(vid) ? hl[i] : full[i], 'cur')],
                  ['Gross margin %', M.fmt(margin[i], 'pct')]
                ];
                if (F.hasForeignSelection(vid)) rowsT.push(['Revenue (all)', M.fmt(full[i], 'cur')]);
                return (
                  F.tipHtml('', rowsT) +
                  (S().drill.drillMode && S().drill.level < 2 ? '<div class="tt-hint">Click to drill down</div>' : '')
                );
              }
            }),
            xAxis: F.catAxis(keys, {
              name: M.FIELDS[field].label,
              nameLocation: 'middle',
              nameGap: 22,
              axisLabel: Object.assign({}, F.axisLabel, {
                interval: 0,
                fontSize: keys.length > 18 ? 9 : 11,
                rotate: 0,
                formatter: v => (keys.length > 14 && field === 'ym' ? v.replace(' 20', " '") : v)
              })
            }),
            yAxis: [
              F.valueAxis({
                name: 'Revenue',
                nameLocation: 'middle',
                nameGap: 40,
                axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact(M.fmt(v, 'cur')) })
              }),
              F.valueAxis({
                name: 'Gross margin %',
                nameLocation: 'middle',
                nameGap: 34,
                splitLine: { show: false },
                min: v => Math.max(0, Math.floor(v.min * 20) / 20 - 0.05),
                max: v => Math.ceil(v.max * 20) / 20,
                interval: 0.05,
                axisLabel: Object.assign({}, F.axisLabel, { formatter: v => Math.round(v * 100) + '%' })
              })
            ],
            series: bars.concat([
              {
                name: 'Gross margin %',
                type: 'line',
                yAxisIndex: 1,
                data: margin,
                symbol: 'circle',
                symbolSize: 5,
                lineStyle: { width: 2, color: F.THEME[3] },
                itemStyle: { color: F.THEME[3] },
                z: 5
              }
            ])
          },
          true
        );
        c.off('click');
        c.on('click', p => {
          if (p.seriesType !== 'bar') return;
          const key = keys[p.dataIndex];
          const d = S().drill;
          if (d.drillMode && d.level < 2) {
            M.setState({
              drill: Object.assign({}, d, {
                level: d.level + 1,
                mode: 'expand',
                parent: d.parent.concat([{ field, value: key }])
              }),
              selection: null
            });
          } else F.selectPoint(vid, field, key, p.event.event.ctrlKey || p.event.event.metaKey);
        });
        F.bindBlankClear(c, vid);
      }
    };
    return def;
  }

  /* ---------- Bar chart by a dimension (channel, category) ---------- */
  function dimBar(vid, opts) {
    const fieldDef = M.FIELDS[opts.field];
    const meas = M.MEASURES[opts.measure];
    const def = {
      id: vid,
      title: opts.title,
      fields: [opts.field],
      dax: [meas.dax],
      last: null,
      sortable: [
        { key: 'value', label: meas.label },
        { key: 'category', label: fieldDef.label }
      ],
      defaultSort: { by: 'value', dir: 'desc' },
      data() {
        const l = def.last;
        return {
          columns: [fieldDef.label, meas.label],
          numeric: [false, true],
          rows: l.cats.map((c, i) => [c, l.full[i]])
        };
      },
      render(body) {
        const get = fieldDef.get;
        const gFull = M.groupBy(M.rows({ vid, ignoreSelection: true }), get);
        const gSel = M.groupBy(M.rows({ vid }), get);
        const sort = S().sort[vid] || def.defaultSort;
        let cats = fieldDef.values.filter(v => gFull.has(v));
        const val = k => meas.f(gFull.get(k));
        cats.sort(
          (a, b) => (sort.by === 'value' ? val(a) - val(b) : a.localeCompare(b)) * (sort.dir === 'desc' ? -1 : 1)
        );
        const full = cats.map(k => meas.f(gFull.get(k)));
        const hl = cats.map(k => (gSel.has(k) ? meas.f(gSel.get(k)) : 0));
        def.last = { cats, full };
        const horizontal = opts.orient === 'h';
        const c = F.chart(vid, body);
        const series = F.highlightSeries(vid, cats, full, hl, opts.color || F.THEME[0], { barCategoryGap: '30%' });
        const top = series[series.length - 1];
        top.label = {
          show: true,
          position: horizontal ? 'right' : 'top',
          color: F.GREY,
          fontSize: 11,
          fontFamily: F.FONT,
          formatter: p => M.fmtMeasure(opts.measure, typeof p.value === 'object' ? p.value.value : p.value)
        };
        const catAx = F.catAxis(horizontal ? cats.slice().reverse() : cats, {
          name: horizontal ? '' : fieldDef.label,
          nameLocation: 'middle',
          nameGap: 24,
          axisLabel: Object.assign({}, F.axisLabel, { interval: 0 })
        });
        const valAx = F.valueAxis({
          name: meas.label,
          nameLocation: 'middle',
          nameGap: horizontal ? 24 : 42,
          axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact(M.fmtMeasure(opts.measure, v)) })
        });
        if (horizontal)
          series.forEach(sr => {
            sr.data = sr.data.slice().reverse();
          });
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            grid: horizontal
              ? { left: 78, right: 56, top: 6, bottom: 34 }
              : { left: 56, right: 12, top: 18, bottom: 40 },
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'item',
              formatter: p => {
                const k = horizontal ? cats[cats.length - 1 - p.dataIndex] : cats[p.dataIndex];
                const rowsT = [
                  [fieldDef.label, k],
                  [meas.label, M.fmtMeasure(opts.measure, gSel.has(k) ? meas.f(gSel.get(k)) : 0)]
                ];
                if (F.hasForeignSelection(vid)) rowsT.push([meas.label + ' (all)', M.fmtMeasure(opts.measure, val(k))]);
                return F.tipHtml('', rowsT);
              }
            }),
            xAxis: horizontal ? valAx : catAx,
            yAxis: horizontal ? catAx : valAx,
            series
          },
          true
        );
        c.off('click');
        c.on('click', p => {
          const k = horizontal ? cats[cats.length - 1 - p.dataIndex] : cats[p.dataIndex];
          F.selectPoint(vid, opts.field, k, p.event.event.ctrlKey || p.event.event.metaKey);
        });
        F.bindBlankClear(c, vid);
      }
    };
    return def;
  }

  /* ---------- Category table (swap target of the chart and table buttons) ---------- */
  function categoryTable(vid) {
    const keys = ['revenue', 'aov', 'margin', 'returnRate'];
    const def = {
      id: vid,
      type: 'table',
      title: 'Category performance',
      fields: ['category'],
      dax: keys.map(k => M.MEASURES[k].dax),
      sortable: [
        { key: 'value', label: 'Revenue' },
        { key: 'category', label: 'Category' }
      ],
      defaultSort: { by: 'value', dir: 'desc' },
      last: null,
      data() {
        return def.last;
      },
      render(body) {
        const g = M.groupBy(M.rows({ vid }), r => D.CATEGORIES[r.cat]);
        const sort = S().sort[vid] || def.defaultSort;
        const cats = D.CATEGORIES.filter(c => g.has(c)).sort(
          (a, b) =>
            (sort.by === 'value' ? g.get(a).rev - g.get(b).rev : a.localeCompare(b)) * (sort.dir === 'desc' ? -1 : 1)
        );
        const all = M.totals(M.rows({ vid }));
        const fmtRow = t => keys.map(k => M.fmtMeasure(k, M.MEASURES[k].f(t)));
        def.last = {
          columns: ['Category'].concat(keys.map(k => M.MEASURES[k].label)),
          numeric: [false, true, true, true, true],
          rows: cats.map(c => [c].concat(keys.map(k => M.MEASURES[k].f(g.get(c)))))
        };
        const own = F.ownSelection(vid);
        body.innerHTML = F.tableHtml(
          {
            columns: def.last.columns,
            numeric: def.last.numeric,
            rows: cats.map(c => [c].concat(fmtRow(g.get(c)))),
            total: ['Total'].concat(fmtRow(all))
          },
          { rowAttr: r => ' data-k="' + r[0] + '" class="' + (own && !own.has(r[0]) ? 'dim' : '') + '"' }
        );
        body
          .querySelectorAll('tbody tr[data-k]')
          .forEach(tr =>
            tr.addEventListener('click', e => F.selectPoint(vid, 'category', tr.dataset.k, e.ctrlKey || e.metaKey))
          );
      }
    };
    return def;
  }

  function swapButtons(vid) {
    return {
      id: vid,
      type: 'button',
      noHeader: true,
      noChrome: true,
      render(body) {
        const t = S().tableMode;
        body.innerHTML =
          '<div class="seg-buttons"><button class="seg' +
          (t ? '' : ' on') +
          '" data-m="chart">Show as chart</button>' +
          '<button class="seg' +
          (t ? ' on' : '') +
          '" data-m="table">Show as table</button></div>';
        body
          .querySelectorAll('.seg')
          .forEach(b =>
            b.addEventListener('click', () => M.setState({ tableMode: b.dataset.m === 'table', bookmark: null }))
          );
      }
    };
  }

  /* ---------- Donut ---------- */
  function deviceDonut(vid) {
    const def = {
      id: vid,
      title: 'Orders by device type',
      fields: ['device'],
      dax: [M.MEASURES.orders.dax],
      last: null,
      data() {
        return { columns: ['Device type', 'Orders'], numeric: [false, true], rows: def.last };
      },
      render(body) {
        const g = M.groupBy(M.rows({ vid }), r => D.DEVICES[r.dev]);
        const own = F.ownSelection(vid);
        const items = D.DEVICES.filter(d => g.has(d)).map((d, i) => ({
          name: d,
          value: g.get(d).ord,
          itemStyle: { color: F.THEME[i], opacity: own && !own.has(d) ? 0.4 : 1 }
        }));
        def.last = items.map(i => [i.name, i.value]);
        const total = items.reduce((s, i) => s + i.value, 0);
        const c = F.chart(vid, body);
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            legend: Object.assign({}, F.legendBase, { data: items.map(i => i.name) }),
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'item',
              formatter: p =>
                F.tipHtml('', [
                  ['Device type', p.name],
                  ['Orders', M.fmt(p.value, 'int')],
                  ['% of total', M.fmt(p.value / total, 'pct')]
                ])
            }),
            series: [
              {
                type: 'pie',
                radius: ['48%', '74%'],
                center: ['50%', '57%'],
                data: items,
                avoidLabelOverlap: true,
                label: {
                  color: F.GREY,
                  fontSize: 11,
                  fontFamily: F.FONT,
                  formatter: p => M.fmt(p.value, 'num') + ' (' + p.percent.toFixed(1) + '%)'
                },
                labelLine: { length: 8, length2: 8, lineStyle: { color: '#C8C6C4' } },
                emphasis: { scale: false }
              }
            ]
          },
          true
        );
        c.off('click');
        c.on('click', p => F.selectPoint(vid, 'device', p.name, p.event.event.ctrlKey || p.event.event.metaKey));
        F.bindBlankClear(c, vid);
      }
    };
    return def;
  }

  window.VISUALS = {
    titleBox,
    dateSlicer,
    categorySlicer,
    deviceSlicer,
    kpiCard,
    comboChart,
    dimBar,
    categoryTable,
    swapButtons,
    deviceDonut,
    drillUp,
    drillNext,
    monthlySeries,
    sparkSvg
  };
})();
