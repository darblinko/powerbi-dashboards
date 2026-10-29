/* page1.js: Quality Overview page. KPI cards, date hierarchy column chart, donut, matrix. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const M = PBI.model;
  const C = PBI.charts;
  const MI = D.MONTHS;
  const esc = C.esc;

  // ---------- KPI card with target, status and sparkline ----------
  function kpi(def, rect) {
    const meas = M.MEASURES[def.measure];
    return Object.assign(
      {
        id: def.id,
        title: def.title,
        kind: 'card',
        cls: 'kpi-card',
        dax: [{ name: meas.name, expr: meas.dax }],
        table(api) {
          const S = PBI.S.slicers;
          const series = M.monthlySeries(def.measure, api.ctx, S.from, S.to);
          return {
            columns: [{ label: 'Month' }, { label: meas.name, align: 'right' }],
            rows: series.map((v, i) => [MI[S.from + i].label, v == null ? '' : def.fmt(v)])
          };
        },
        render(body, api) {
          const S = PBI.S.slicers;
          const value = meas.calc(api.ctx);
          const target = typeof def.target === 'function' ? def.target() : def.target;
          const st = C.statusFor(value, target, def.better);
          const from = Math.max(S.from, S.to - 11);
          const series = M.monthlySeries(def.measure, api.ctx, from, S.to);
          const diff = value == null ? null : value - target;
          const sign = diff > 0 ? '+' : '';
          const color = C.STATUS[st];
          const w = Math.max(60, api.w - 4);
          body.innerHTML =
            '<div class="kpi" title="' +
            esc(meas.name + ': ' + def.fmt(value)) +
            '">' +
            '<div class="kpi-accent" style="background:' +
            color +
            '"></div>' +
            '<div class="kpi-row"><span class="kpi-val">' +
            def.fmt(value) +
            '</span><span class="kpi-unit">' +
            esc(def.unit || '') +
            '</span></div>' +
            '<div class="kpi-tgt">Target ' +
            (def.better === 'low' ? 'at most ' : 'at least ') +
            def.fmt(target) +
            '<span class="kpi-var" style="color:' +
            color +
            '">' +
            (diff == null ? '' : sign + def.fmtVar(diff)) +
            '</span></div>' +
            '<div class="kpi-spark">' +
            C.sparkSvg(series, w, 30, color) +
            '</div>' +
            '<div class="kpi-foot"><span>' +
            MI[from].short +
            ' ' +
            String(MI[from].year).slice(2) +
            '</span><span>' +
            MI[S.to].short +
            ' ' +
            String(MI[S.to].year).slice(2) +
            '</span></div></div>';
        }
      },
      rect
    );
  }
  const monthsInRange = () => PBI.S.slicers.to - PBI.S.slicers.from + 1;
  const pp = v => (v * 100 >= 0 ? '' : '') + (v * 100).toFixed(1) + ' pp';
  const KPIS = [
    {
      id: 'kRate',
      title: 'Complaint Rate per 1K Units',
      measure: 'complaintRate',
      target: 24,
      better: 'low',
      fmt: M.fmt.dec1,
      fmtVar: v => v.toFixed(1),
      unit: 'per 1,000'
    },
    {
      id: 'kMdr',
      title: 'MDR Reports Filed On Time',
      measure: 'mdrOnTime',
      target: 0.95,
      better: 'high',
      fmt: M.fmt.pct,
      fmtVar: pp
    },
    {
      id: 'kOpen',
      title: 'Open CAPAs',
      measure: 'openCapas',
      target: 25,
      better: 'low',
      fmt: M.fmt.int,
      fmtVar: v => String(Math.round(v)),
      unit: 'as of period end'
    },
    {
      id: 'kOver',
      title: 'CAPA Overdue %',
      measure: 'capaOverdue',
      target: 0.1,
      better: 'low',
      fmt: M.fmt.pct,
      fmtVar: pp
    },
    {
      id: 'kNcr',
      title: 'NCR Count',
      measure: 'ncrCount',
      target: () => 20 * monthsInRange(),
      better: 'low',
      fmt: M.fmt.int,
      fmtVar: v => String(Math.round(v)),
      unit: 'nonconformances'
    },
    { id: 'kFpy', title: 'First Pass Yield', measure: 'fpy', target: 0.95, better: 'high', fmt: M.fmt.pct, fmtVar: pp }
  ];

  // ---------- Column chart with Year > Quarter > Month hierarchy ----------
  function levelSpec(d) {
    const L = d.level;
    const hasYear = d.path.some(p => p.field === 'year' || p.field === 'yq');
    if (L === 0) return { field: 'year', key: r => MI[r.month].year, label: k => String(k), order: k => k };
    if (L === 1) {
      if (hasYear || d.expanded)
        return { field: 'yq', key: r => MI[r.month].yq, label: k => (hasYear ? k.slice(5) : k), order: k => k };
      return { field: 'quarter', key: r => 'Qtr ' + MI[r.month].q, label: k => k, order: k => k };
    }
    if (hasYear || d.expanded || d.path.length) {
      return { field: 'month', key: r => r.month, label: k => (hasYear ? MI[k].name : MI[k].label), order: k => k };
    }
    return {
      field: 'monthName',
      key: r => MI[r.month].name,
      label: k => k,
      order: k => D.MONTHS.findIndex(m => m.name === k)
    };
  }
  function columnData(api) {
    const spec = levelSpec(api.drill);
    const baseRows = M.rows('complaints', api.baseCtx);
    const baseMap = M.groupCount(baseRows, spec.key);
    const hlMap = api.external ? M.groupCount(M.rows('complaints', api.ctx), spec.key) : null;
    let keys = [...baseMap.keys()].sort((a, b) => spec.order(a) - spec.order(b) || (a > b ? 1 : -1));
    const s = api.sort;
    if (s.by === 'value') keys.sort((a, b) => baseMap.get(a) - baseMap.get(b));
    if (s.dir === 'desc') keys.reverse();
    if (s.by === 'axis' && s.dir === 'asc') {
      /* already chronological */
    }
    return { spec, keys, base: keys.map(k => baseMap.get(k)), hl: hlMap ? keys.map(k => hlMap.get(k) || 0) : null };
  }
  const columnVisual = {
    id: 'colDate',
    title: 'Complaint Count by Year, Quarter and Month',
    x: 8,
    y: 184,
    w: 760,
    h: 252,
    hierarchy: [
      { field: 'year', label: 'Year' },
      { field: 'quarter', label: 'Quarter' },
      { field: 'month', label: 'Month' }
    ],
    fields: ['reportable', 'category'],
    highlights: true,
    sortFields: [
      { key: 'axis', label: 'Received Date' },
      { key: 'value', label: 'Complaint Count' }
    ],
    defaultSort: { by: 'axis', dir: 'asc' },
    table(api) {
      const d = columnData(api);
      return {
        columns: [
          { label: d.spec.field === 'year' ? 'Year' : d.spec.field.includes('q') ? 'Quarter' : 'Month' },
          { label: 'Complaint Count', align: 'right' }
        ],
        rows: d.keys.map((k, i) => [d.spec.label(k), d.hl ? d.hl[i] : d.base[i]])
      };
    },
    render(body, api) {
      const d = columnData(api);
      const chart = api.chart();
      const labels = d.keys.map(d.spec.label);
      const selfSel = api.self ? i => api.selfHas(d.spec.field, d.keys[i]) : null;
      const axisName = { year: 'Year', yq: 'Quarter', quarter: 'Quarter', month: 'Month', monthName: 'Month' }[
        d.spec.field
      ];
      chart.setOption(
        C.base({
          grid: { left: 44, right: 8, top: 22, bottom: 40 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p =>
              C.tipHtml(
                [
                  [axisName, labels[p.dataIndex]],
                  ['Complaint Count', M.fmt.int(d.base[p.dataIndex])]
                ].concat(d.hl ? [['Highlighted', M.fmt.int(d.hl[p.dataIndex])]] : [])
              )
          }),
          xAxis: C.catAxis(labels, { title: axisName, nameGap: 24 }),
          yAxis: C.valAxis({ title: 'Complaint Count', nameGap: 34 }),
          series: C.highlightBars({
            name: 'Complaint Count',
            base: d.base,
            hl: d.hl,
            selfSel,
            labels: d.keys.length <= 14,
            barMaxWidth: 56
          })
        }),
        true
      );
      chart.off('click');
      chart.on('click', p =>
        api.click([{ field: d.spec.field, value: d.keys[p.dataIndex] }], p.event && p.event.event)
      );
      body.title = api.drill.mode ? 'Drill down is on: click a column to drill into it' : '';
    }
  };

  // ---------- Donut by complaint category ----------
  const donutVisual = {
    id: 'donutCat',
    title: 'Complaint Count by Complaint Category',
    x: 776,
    y: 184,
    w: 496,
    h: 252,
    fields: ['category'],
    sortFields: [
      { key: 'value', label: 'Complaint Count' },
      { key: 'name', label: 'Complaint Category' }
    ],
    table(api) {
      const m = M.groupCount(M.rows('complaints', api.ctx), r => r.category);
      const total = M.sum([...m.values()], x => x);
      return {
        columns: [
          { label: 'Complaint Category' },
          { label: 'Complaint Count', align: 'right' },
          { label: '% of Total', align: 'right' }
        ],
        rows: D.CATEGORIES.filter(c => m.has(c)).map(c => [c, m.get(c), M.fmt.pct(m.get(c) / total)])
      };
    },
    render(body, api) {
      const m = M.groupCount(M.rows('complaints', api.ctx), r => r.category);
      let cats = D.CATEGORIES.filter(c => m.has(c));
      if (api.sort.by === 'value') cats.sort((a, b) => m.get(b) - m.get(a));
      else cats.sort();
      if (api.sort.dir === 'asc') cats.reverse();
      const chart = api.chart();
      chart.setOption(
        C.base({
          legend: C.legend({ type: 'scroll', orient: 'vertical', left: 0, top: 4, bottom: 4 }),
          tooltip: { show: false },
          series: [
            {
              type: 'pie',
              radius: ['44%', '70%'],
              center: ['64%', '52%'],
              avoidLabelOverlap: true,
              label: {
                color: C.GREY,
                fontSize: 11,
                formatter: p => M.fmt.k(p.value) + ' (' + p.percent.toFixed(0) + '%)'
              },
              labelLine: { length: 8, length2: 8, lineStyle: { color: '#C8C6C4' } },
              itemStyle: { borderColor: '#fff', borderWidth: 1 },
              emphasis: { scale: true, scaleSize: 4 },
              data: cats.map(c => ({
                name: c,
                value: m.get(c),
                itemStyle: {
                  color: C.THEME[D.CATEGORIES.indexOf(c)],
                  opacity: api.self && !api.selfHas('category', c) ? C.FADE : 1
                }
              }))
            }
          ]
        }),
        true
      );
      chart.off('click');
      chart.off('mouseover');
      chart.off('mouseout');
      chart.off('contextmenu');
      chart.on(
        'click',
        p => p.componentType === 'series' && api.click([{ field: 'category', value: p.name }], p.event.event)
      );
      chart.on(
        'mouseover',
        p => p.componentType === 'series' && PBI.tooltipPage.show(p.event.event, 'category', p.name)
      );
      chart.on('mouseout', () => PBI.tooltipPage.hide());
      chart.on('contextmenu', p => {
        p.event.event.preventDefault();
        PBI.tooltipPage.hide();
        api.contextMenu(p.event.event, 'category', p.name);
      });
      if (!body.__moveBound) {
        body.__moveBound = true;
        body.addEventListener('mousemove', e => PBI.tooltipPage.move(e));
      }
    }
  };

  // ---------- Matrix: failure mode > sub mode by product, heatmap ----------
  function heat(v, max) {
    const t = max ? Math.min(1, v / max) : 0;
    const mix = (a, b) => Math.round(a + (b - a) * t);
    return {
      bg: 'rgb(' + mix(255, 17) + ',' + mix(255, 141) + ',' + mix(255, 255) + ')',
      fg: t > 0.55 ? '#fff' : '#252423'
    };
  }
  function matrixModel(api) {
    const rows = M.rows('complaints', api.ctx);
    const prods = D.PRODUCTS.map(p => p.name).filter(n => rows.some(r => r.product === n));
    const cnt = {},
      tot = {},
      colTot = {};
    rows.forEach(r => {
      [
        ['fm', r.failureMode],
        ['sub', r.failureMode + '|' + r.subMode]
      ].forEach(([lvl, k]) => {
        cnt[lvl + k + '#' + r.product] = (cnt[lvl + k + '#' + r.product] || 0) + 1;
        tot[lvl + k] = (tot[lvl + k] || 0) + 1;
      });
      colTot[r.product] = (colTot[r.product] || 0) + 1;
    });
    const d = api.drill;
    const flat = d.level === 1 && !d.expanded;
    const fms = Object.keys(D.FM_TREE).filter(f => tot['fm' + f]);
    const s = api.sort;
    const order = (list, keyFn, nameFn) => {
      const out = list
        .slice()
        .sort((a, b) => (s.by === 'name' ? (nameFn(a) > nameFn(b) ? 1 : -1) : keyFn(a) - keyFn(b)));
      return s.dir === 'desc' ? out.reverse() : out;
    };
    const lines = [];
    if (flat) {
      const subs = [];
      fms.forEach(f =>
        D.FM_TREE[f].forEach(sb => {
          if (tot['sub' + f + '|' + sb]) subs.push([f, sb]);
        })
      );
      order(
        subs,
        x => tot['sub' + x[0] + '|' + x[1]],
        x => x[1]
      ).forEach(([f, sb]) => lines.push({ lvl: 'sub', key: f + '|' + sb, label: sb, fm: f, sub: sb }));
    } else {
      const exp = PBI.S.expand[api.v.id] || new Set();
      order(
        fms,
        f => tot['fm' + f],
        f => f
      ).forEach(f => {
        const open = d.expanded || exp.has(f);
        lines.push({ lvl: 'fm', key: f, label: f, fm: f, open, tree: true });
        if (open)
          order(
            D.FM_TREE[f].filter(sb => tot['sub' + f + '|' + sb]),
            sb => tot['sub' + f + '|' + sb],
            sb => sb
          ).forEach(sb => lines.push({ lvl: 'sub', key: f + '|' + sb, label: sb, fm: f, sub: sb, child: true }));
      });
    }
    let max = 0;
    lines.forEach(l =>
      prods.forEach(p => {
        if (l.lvl === (flat ? 'sub' : 'fm')) max = Math.max(max, cnt[l.lvl + l.key + '#' + p] || 0);
      })
    );
    return { rows, prods, cnt, tot, colTot, lines, max, flat };
  }
  const matrixVisual = {
    id: 'mxFail',
    title: 'Complaint Count by Failure Mode and Product',
    x: 8,
    y: 444,
    w: 1264,
    h: 252,
    hierarchy: [
      { field: 'failureMode', label: 'Failure Mode' },
      { field: 'subMode', label: 'Failure Sub Mode' }
    ],
    fields: ['failureMode', 'product'],
    sortFields: [
      { key: 'value', label: 'Complaint Count' },
      { key: 'name', label: 'Failure Mode' }
    ],
    onDrill(act) {
      if (act === 'drillUp') PBI.S.expand[this.id] = new Set();
    },
    table(api) {
      const mm = matrixModel(api);
      return {
        columns: [{ label: mm.flat ? 'Failure Sub Mode' : 'Failure Mode' }].concat(
          mm.prods.map(p => ({ label: p, align: 'right' })),
          [{ label: 'Total', align: 'right' }]
        ),
        rows: mm.lines.map(l =>
          [(l.child ? '    ' : '') + l.label].concat(
            mm.prods.map(p => mm.cnt[l.lvl + l.key + '#' + p] || 0),
            [mm.tot[l.lvl + l.key]]
          )
        )
      };
    },
    render(body, api) {
      const mm = matrixModel(api);
      const sel = l => ({ failureMode: l.fm, subMode: l.sub });
      const fadeCell = (l, p) => api.self && !api.selfMatch(Object.assign({ product: p }, sel(l)));
      let html =
        '<div class="mx-scroll"><table class="matrix"><thead><tr><th class="mx-rh">' +
        (mm.flat ? 'Failure Sub Mode' : 'Failure Mode') +
        '</th>' +
        mm.prods.map(p => '<th class="mx-ch" data-prod="' + esc(p) + '">' + esc(p) + '</th>').join('') +
        '<th class="mx-ch mx-totc">Total</th></tr></thead><tbody>';
      mm.lines.forEach((l, i) => {
        const tog = l.tree
          ? '<span class="mx-tog" data-fm="' + esc(l.fm) + '">' + (l.open ? '&minus;' : '+') + '</span>'
          : '';
        html +=
          '<tr class="mx-' +
          l.lvl +
          (l.open ? ' mx-open' : '') +
          '" data-i="' +
          i +
          '"><td class="mx-rh' +
          (l.child ? ' mx-ind' : '') +
          '">' +
          tog +
          esc(l.label) +
          '</td>';
        mm.prods.forEach(p => {
          const v = mm.cnt[l.lvl + l.key + '#' + p] || 0;
          const useHeat = l.lvl === (mm.flat ? 'sub' : 'fm') || l.child;
          const h = useHeat ? heat(v, mm.max) : { bg: '', fg: '' };
          html +=
            '<td class="mx-c' +
            (fadeCell(l, p) ? ' fade' : '') +
            '" data-prod="' +
            esc(p) +
            '" style="background:' +
            h.bg +
            ';color:' +
            h.fg +
            '">' +
            (v ? M.fmt.int(v) : '') +
            '</td>';
        });
        html += '<td class="mx-c mx-totc">' + M.fmt.int(mm.tot[l.lvl + l.key]) + '</td></tr>';
      });
      html +=
        '</tbody><tfoot><tr><td class="mx-rh">Total</td>' +
        mm.prods.map(p => '<td class="mx-c">' + M.fmt.int(mm.colTot[p] || 0) + '</td>').join('') +
        '<td class="mx-c mx-totc">' +
        M.fmt.int(mm.rows.length) +
        '</td></tr></tfoot></table></div>';
      body.innerHTML = html;
      body.onclick = e => {
        const togEl = e.target.closest('.mx-tog');
        if (togEl) {
          const set = (PBI.S.expand[api.v.id] = PBI.S.expand[api.v.id] || new Set());
          set.has(togEl.dataset.fm) ? set.delete(togEl.dataset.fm) : set.add(togEl.dataset.fm);
          return PBI.app.update();
        }
        const td = e.target.closest('td, th');
        if (!td) return PBI.app.clearSelection();
        const tr = td.closest('tr');
        const l = tr && tr.dataset.i != null ? mm.lines[+tr.dataset.i] : null;
        const fmFilter = l
          ? l.lvl === 'sub'
            ? { field: 'subMode', value: l.sub }
            : { field: 'failureMode', value: l.fm }
          : null;
        if (td.classList.contains('mx-ch') && td.dataset.prod)
          return api.click([{ field: 'product', value: td.dataset.prod }], e);
        if (!l) return;
        if (td.classList.contains('mx-rh')) return api.click([fmFilter], e);
        if (td.dataset.prod) return api.click([fmFilter, { field: 'product', value: td.dataset.prod }], e);
      };
      body.onmousemove = e => {
        const td = e.target.closest('[data-prod]');
        if (td) PBI.tooltipPage.show(e, 'product', td.dataset.prod);
        else PBI.tooltipPage.hide();
      };
      body.onmouseleave = () => PBI.tooltipPage.hide();
      body.oncontextmenu = e => {
        const td = e.target.closest('[data-prod]');
        if (!td) return;
        e.preventDefault();
        PBI.tooltipPage.hide();
        api.contextMenu(e, 'product', td.dataset.prod);
      };
    }
  };

  const visuals = PBI.slicers
    .band('p1', 'Quality Overview')
    .concat(KPIS.map((k, i) => kpi(k, { x: 8 + i * 212, y: 68, w: 204, h: 108 })))
    .concat([columnVisual, donutVisual, matrixVisual]);

  PBI.pages = PBI.pages || {};
  PBI.pages.overview = { name: 'Quality Overview', visuals, filterFields: ['category', 'reportable'] };
  PBI.KPIS = KPIS;
  PBI.kpi = kpi;
})();
