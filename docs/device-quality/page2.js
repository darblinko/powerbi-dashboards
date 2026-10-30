/* page2.js: Complaint Trending page. Control chart, reportability funnel, decision bins, MDR clock table. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const M = PBI.model;
  const C = PBI.charts;
  const MI = D.MONTHS;
  const esc = C.esc;

  function card(id, title, measureKey, fmtFn, rect, noteFn) {
    const meas = M.MEASURES[measureKey];
    return Object.assign(
      {
        id,
        title,
        kind: 'card',
        cls: 'plain-card',
        dax: [{ name: meas.name, expr: meas.dax }],
        table(api) {
          return { columns: [{ label: meas.name, align: 'right' }], rows: [[fmtFn(meas.calc(api.ctx))]] };
        },
        render(body, api) {
          const v = meas.calc(api.ctx);
          body.innerHTML =
            '<div class="pcard"><div class="pcard-val">' +
            fmtFn(v) +
            '</div><div class="pcard-lbl">' +
            esc(noteFn ? noteFn(api) : meas.name) +
            '</div></div>';
        }
      },
      rect
    );
  }

  // ---------- Individuals control chart ----------
  function controlData(ctx) {
    const S = PBI.S.slicers;
    const rows = M.rows('complaints', ctx);
    const units = M.rows('shipments', ctx);
    const cm = M.groupCount(rows, r => r.month);
    const um = new Map();
    units.forEach(r => um.set(r.month, (um.get(r.month) || 0) + r.units));
    const months = [];
    for (let m = S.from; m <= S.to; m++) if (um.get(m)) months.push(m);
    const rates = months.map(m => ((cm.get(m) || 0) / um.get(m)) * 1000);
    const mean = rates.reduce((s, v) => s + v, 0) / (rates.length || 1);
    let mr = 0;
    for (let i = 1; i < rates.length; i++) mr += Math.abs(rates[i] - rates[i - 1]);
    const mrBar = rates.length > 1 ? mr / (rates.length - 1) : 0;
    const ucl = mean + 2.66 * mrBar,
      lcl = Math.max(0, mean - 2.66 * mrBar);
    return {
      months,
      rates,
      counts: months.map(m => cm.get(m) || 0),
      units: months.map(m => um.get(m)),
      mean,
      ucl,
      lcl
    };
  }
  const controlVisual = {
    id: 'ctlChart',
    title: 'Complaint Rate per 1K Units by Month, Individuals Control Chart',
    x: 8,
    y: 160,
    w: 840,
    h: 260,
    fields: ['failureMode', 'product'],
    dax: [{ name: 'Complaint Rate per 1K', expr: M.MEASURES.complaintRate.dax }],
    table(api) {
      const d = controlData(api.ctx);
      return {
        columns: [
          { label: 'Month' },
          { label: 'Complaints', align: 'right' },
          { label: 'Units Shipped', align: 'right' },
          { label: 'Rate per 1K', align: 'right' },
          { label: 'Signal' }
        ],
        rows: d.months.map((m, i) => [
          MI[m].label,
          d.counts[i],
          d.units[i],
          d.rates[i].toFixed(2),
          d.rates[i] > d.ucl || d.rates[i] < d.lcl ? 'Out of control' : ''
        ])
      };
    },
    render(body, api) {
      const d = controlData(api.ctx);
      const chart = api.chart();
      const ooc = r => r > d.ucl || r < d.lcl;
      const line = (name, val, color, type) => ({
        name,
        yAxis: val,
        lineStyle: { color, type, width: 1.5 },
        label: {
          formatter: name + ' ' + val.toFixed(1),
          position: 'insideEndTop',
          color,
          fontSize: 11,
          fontWeight: 600
        }
      });
      chart.setOption(
        C.base({
          grid: { left: 44, right: 30, top: 26, bottom: 40 },
          legend: C.legend({ data: ['Complaint Rate per 1K', 'Out of control'] }),
          tooltip: C.tooltip({
            trigger: 'axis',
            axisPointer: { type: 'line', lineStyle: { color: '#C8C6C4' } },
            formatter: ps => {
              const i = ps[0].dataIndex;
              return C.tipHtml(
                [
                  ['Month', MI[d.months[i]].label],
                  ['Complaint Rate per 1K', d.rates[i].toFixed(2)],
                  ['Complaint Count', M.fmt.int(d.counts[i])],
                  ['Units Shipped', M.fmt.int(d.units[i])],
                  ['Mean / UCL / LCL', d.mean.toFixed(1) + ' / ' + d.ucl.toFixed(1) + ' / ' + d.lcl.toFixed(1)]
                ].concat(ooc(d.rates[i]) ? [['Signal', 'Point beyond control limit']] : [])
              );
            }
          }),
          xAxis: C.catAxis(
            d.months.map(m => MI[m].label),
            { title: 'Month', nameGap: 24, extra: { boundaryGap: false } }
          ),
          yAxis: C.valAxis({
            title: 'Rate per 1K',
            nameGap: 30,
            formatter: v => v.toFixed(0),
            extra: { min: v => Math.max(0, Math.floor((v.min - 2) / 10) * 10) }
          }),
          series: [
            {
              name: 'Complaint Rate per 1K',
              type: 'line',
              data: d.rates.map((r, i) => ({
                value: +r.toFixed(2),
                symbolSize: ooc(r) ? 9 : 5,
                itemStyle: {
                  color: ooc(r) ? '#D64550' : '#118DFF',
                  opacity: api.self && !api.selfHas('month', d.months[i]) ? C.FADE : 1
                }
              })),
              lineStyle: { color: '#118DFF', width: 2 },
              symbol: 'circle',
              showAllSymbol: true,
              markLine: {
                symbol: 'none',
                silent: true,
                data: [
                  line('UCL', d.ucl, '#D64550', 'dashed'),
                  line('Mean', d.mean, '#252423', 'solid'),
                  line('LCL', d.lcl, '#D64550', 'dashed')
                ]
              }
            },
            {
              name: 'Out of control',
              type: 'scatter',
              data: d.rates.map(r => (ooc(r) ? +r.toFixed(2) : null)),
              symbolSize: 11,
              itemStyle: { color: '#D64550' },
              z: 5,
              tooltip: { show: false }
            }
          ]
        }),
        true
      );
      chart.off('click');
      chart.on('click', p => api.click([{ field: 'month', value: d.months[p.dataIndex] }], p.event && p.event.event));
    }
  };

  // ---------- Reportability funnel (Power BI funnel: centered horizontal bars) ----------
  const STAGES = [
    { label: 'Received', field: 'received', value: 'Yes', test: () => true },
    { label: 'Assessed', field: 'assessed', value: 'Yes', test: r => r.assessed === 'Yes' },
    { label: 'Reportable', field: 'reportable', value: 'Yes', test: r => r.reportable === 'Yes' },
    {
      label: 'MDR filed within 30 days',
      field: 'mdrWithin30',
      value: 'Yes',
      test: r => r.mdrFiled && r.daysToMdr <= 30
    }
  ];
  function funnelCounts(ctx) {
    const rows = M.rows('complaints', ctx);
    return STAGES.map(s => rows.filter(s.test).length);
  }
  const funnelVisual = {
    id: 'funnel',
    title: 'Reportability Funnel',
    x: 856,
    y: 160,
    w: 416,
    h: 260,
    highlights: true,
    fields: ['reportable'],
    table(api) {
      const v = funnelCounts(api.ctx);
      return {
        columns: [
          { label: 'Stage' },
          { label: 'Complaint Count', align: 'right' },
          { label: '% of first', align: 'right' },
          { label: '% of previous', align: 'right' }
        ],
        rows: STAGES.map((s, i) => [
          s.label,
          v[i],
          M.fmt.pct(v[i] / (v[0] || 1)),
          i ? M.fmt.pct(v[i] / (v[i - 1] || 1)) : '100.0%'
        ])
      };
    },
    render(body, api) {
      const base = funnelCounts(api.baseCtx);
      const hl = api.external ? funnelCounts(api.ctx) : null;
      const max = base[0] || 1;
      const chart = api.chart();
      const off = arr => arr.map(v => (max - v) / 2);
      const fade = i => api.self && !api.selfHas(STAGES[i].field, STAGES[i].value);
      const series = [
        {
          type: 'bar',
          stack: 'b',
          data: off(base),
          itemStyle: { color: 'transparent' },
          silent: true,
          barGap: '-100%',
          barCategoryGap: '18%',
          tooltip: { show: false }
        },
        {
          type: 'bar',
          stack: 'b',
          name: 'Complaint Count',
          data: base.map((v, i) => ({ value: v, itemStyle: { opacity: hl || fade(i) ? C.FADE : 1 } })),
          itemStyle: { color: '#118DFF' },
          barGap: '-100%',
          label: {
            show: !hl,
            position: 'inside',
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            formatter: p => M.fmt.int(p.value)
          }
        }
      ];
      if (hl)
        series.push(
          {
            type: 'bar',
            stack: 'h',
            data: off(hl),
            itemStyle: { color: 'transparent' },
            silent: true,
            barGap: '-100%',
            tooltip: { show: false }
          },
          {
            type: 'bar',
            stack: 'h',
            name: 'Highlighted',
            data: hl,
            itemStyle: { color: '#118DFF' },
            barGap: '-100%',
            label: {
              show: true,
              position: 'inside',
              color: '#fff',
              fontSize: 12,
              fontWeight: 600,
              formatter: p => M.fmt.int(p.value)
            }
          }
        );
      chart.setOption(
        C.base({
          grid: { left: 150, right: 12, top: 6, bottom: 22 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p => {
              const i = p.dataIndex;
              return C.tipHtml(
                [
                  ['Stage', STAGES[i].label],
                  ['Complaint Count', M.fmt.int(base[i])],
                  ['% of first', M.fmt.pct(base[i] / max)],
                  ['% of previous', i ? M.fmt.pct(base[i] / (base[i - 1] || 1)) : '100.0%']
                ].concat(hl ? [['Highlighted', M.fmt.int(hl[i])]] : [])
              );
            }
          }),
          xAxis: { type: 'value', show: false, max },
          yAxis: C.catAxis(
            STAGES.map((s, i) => s.label + '\n' + M.fmt.pct(base[i] / max) + ' of received'),
            { extra: { inverse: true, axisLabel: { color: C.GREY, fontSize: 11, lineHeight: 15, align: 'right' } } }
          ),
          series
        }),
        true
      );
      chart.off('click');
      chart.on('click', p => {
        if (p.seriesName) api.click([{ field: STAGES[p.dataIndex].field, value: 'Yes' }], p.event && p.event.event);
      });
    }
  };

  // ---------- Stacked bar: days to MDR decision bins by product ----------
  const BINS = ['0-10 days', '11-20 days', '21-30 days', 'Over 30 days', 'Pending'];
  const BIN_COLORS = ['#118DFF', '#12239E', '#E66C37', '#D64550', '#C8C6C4'];
  function binData(ctx) {
    const rows = M.rows('complaints', ctx);
    const m = M.groupCount(rows, r => r.product + '|' + M.decisionBin(r));
    return {
      get: (p, b) => m.get(p + '|' + b) || 0,
      total: p => BINS.reduce((s, b) => s + (m.get(p + '|' + b) || 0), 0)
    };
  }
  const binVisual = {
    id: 'binBar',
    title: 'Days to MDR Decision by Product',
    x: 8,
    y: 428,
    w: 420,
    h: 268,
    highlights: true,
    fields: ['decisionBin', 'product'],
    sortFields: [
      { key: 'value', label: 'Complaint Count' },
      { key: 'name', label: 'Product' }
    ],
    table(api) {
      const b = binData(api.ctx);
      return {
        columns: [{ label: 'Product' }]
          .concat(BINS.map(x => ({ label: x, align: 'right' })))
          .concat([{ label: 'Total', align: 'right' }]),
        rows: D.PRODUCTS.map(p =>
          [p.name].concat(
            BINS.map(x => b.get(p.name, x)),
            [b.total(p.name)]
          )
        )
      };
    },
    render(body, api) {
      const base = binData(api.baseCtx);
      const hl = api.external ? binData(api.ctx) : null;
      let prods = D.PRODUCTS.map(p => p.name).filter(p => base.total(p) > 0);
      prods.sort((a, b) => (api.sort.by === 'name' ? (a > b ? 1 : -1) : base.total(a) - base.total(b)));
      if (api.sort.dir === 'asc') prods.reverse();
      const short = p => M.productByName[p].short;
      const series = [];
      BINS.forEach((bin, bi) => {
        const fade = p => api.self && !api.selfMatch({ product: p, decisionBin: bin });
        series.push({
          type: 'bar',
          name: bin,
          stack: 'b',
          barGap: '-100%',
          barCategoryGap: '30%',
          barMaxWidth: 34,
          itemStyle: { color: BIN_COLORS[bi] },
          data: prods.map(p => ({ value: base.get(p, bin), itemStyle: { opacity: hl || fade(p) ? C.FADE : 1 } }))
        });
        if (hl)
          series.push({
            type: 'bar',
            name: bin,
            stack: 'h',
            barGap: '-100%',
            barMaxWidth: 34,
            itemStyle: { color: BIN_COLORS[bi] },
            data: prods.map(p => hl.get(p, bin))
          });
      });
      const chart = api.chart();
      chart.setOption(
        C.base({
          legend: C.legend({ data: BINS, itemGap: 8 }),
          grid: { left: 64, right: 12, top: 30, bottom: 34 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p =>
              C.tipHtml(
                [
                  ['Product', prods[p.dataIndex]],
                  ['Days to MDR Decision', p.seriesName],
                  ['Complaint Count', M.fmt.int(base.get(prods[p.dataIndex], p.seriesName))]
                ].concat(hl ? [['Highlighted', M.fmt.int(hl.get(prods[p.dataIndex], p.seriesName))]] : [])
              )
          }),
          xAxis: C.valAxis({ title: 'Complaint Count', nameGap: 22 }),
          yAxis: C.catAxis(prods.map(short), { triggerEvent: true }),
          series
        }),
        true
      );
      chart.off('click');
      chart.off('contextmenu');
      chart.on('click', p => {
        if (p.componentType === 'yAxis')
          return api.click([{ field: 'product', value: prods[prods.map(short).indexOf(p.value)] }], p.event.event);
        api.click(
          [
            { field: 'product', value: prods[p.dataIndex] },
            { field: 'decisionBin', value: p.seriesName }
          ],
          p.event && p.event.event
        );
      });
      chart.on('contextmenu', p => {
        p.event.event.preventDefault();
        const prod = p.componentType === 'yAxis' ? prods[prods.map(short).indexOf(p.value)] : prods[p.dataIndex];
        api.contextMenu(p.event.event, 'product', prod);
      });
    }
  };

  // ---------- Table with MDR clock icons ----------
  function clockIcon(days) {
    const c = days <= 20 ? '#1AAB40' : days <= 30 ? '#D9B300' : '#D64550';
    const shape =
      days <= 20
        ? '<circle cx="6" cy="6" r="5.5" fill="' + c + '"/>'
        : days <= 30
          ? '<path d="M6 0.5L11.5 11H0.5z" fill="' + c + '"/>'
          : '<rect x="0.8" y="0.8" width="10.4" height="10.4" transform="rotate(45 6 6)" fill="' + c + '"/>';
    return '<svg width="12" height="12" viewBox="0 0 12 12" class="cf-ic">' + shape + '</svg>';
  }
  const TCOLS = [
    { label: 'Complaint ID', key: r => r.id },
    { label: 'Received', key: r => r.day, fmt: D.fmtDay },
    { label: 'Product', key: r => r.product },
    { label: 'Failure Mode', key: r => r.failureMode },
    { label: 'Reportable', key: r => r.reportable },
    { label: 'Days to Decision', key: r => r.daysToDecision, align: 'right' },
    { label: 'MDR Clock (days)', key: r => M.mdrClockDays(r), align: 'right', icon: true },
    {
      label: 'Status',
      key: r => {
        const t = r.status.replace('Open, ', '');
        return t.charAt(0).toUpperCase() + t.slice(1);
      }
    }
  ];
  function tableRows(api) {
    const s = api.sort;
    const col = TCOLS[s.by] || TCOLS[1];
    const rows = M.rows('complaints', api.ctx)
      .slice()
      .sort((a, b) => {
        const x = col.key(a),
          y = col.key(b);
        return x === y ? 0 : x == null ? -1 : y == null ? 1 : x > y ? 1 : -1;
      });
    if (s.dir === 'desc') rows.reverse();
    return rows;
  }
  const tableVisual = {
    id: 'mdrTable',
    title: 'Complaints Against the 30-Day MDR Clock',
    x: 436,
    y: 428,
    w: 836,
    h: 268,
    fields: ['reportable', 'complaintId'],
    defaultSort: { by: 1, dir: 'desc' },
    sortFields: TCOLS.map((c, i) => ({ key: i, label: c.label })),
    table(api) {
      return {
        columns: TCOLS.map(c => ({ label: c.label, align: c.align })),
        rows: tableRows(api).map(r => TCOLS.map(c => (c.fmt ? c.fmt(c.key(r)) : c.key(r))))
      };
    },
    render(body, api) {
      const all = tableRows(api);
      const shown = all.slice(0, 250);
      const spec = {
        columns: TCOLS.map(c => ({
          label: c.label,
          align: c.align,
          fmt: c.fmt,
          html: c.icon ? v => clockIcon(v) + '<span>' + (v == null ? '' : v) + '</span>' : null
        })),
        rows: shown.map(r => TCOLS.map(c => c.key(r))),
        total: [
          'Total',
          '',
          '',
          '',
          '',
          (M.MEASURES.avgDecision.calc(api.ctx) || 0).toFixed(1),
          M.fmt.int(all.length) + ' rows',
          ''
        ]
      };
      if (all.length > shown.length)
        spec.note = 'Showing the first 250 of ' + M.fmt.int(all.length) + ' rows. Export data returns all rows.';
      body.innerHTML = '';
      body.appendChild(
        PBI.frame.htmlTable(spec, {
          sortable: true,
          sort: api.sort,
          onSort: ci => {
            const s = api.sort;
            PBI.S.sort[api.v.id] = { by: ci, dir: s.by === ci && s.dir === 'desc' ? 'asc' : 'desc' };
            PBI.app.update();
          },
          rowClass: i => (api.self ? (api.selfHas('complaintId', shown[i].id) ? 'sel' : 'fade') : ''),
          onRow: (i, e) => api.click([{ field: 'complaintId', value: shown[i].id }], e),
          onContext: (i, e) => api.contextMenu(e, 'complaintId', shown[i].id)
        })
      );
      const legend = document.createElement('div');
      legend.className = 'cf-legend';
      legend.innerHTML =
        clockIcon(10) + 'At most 20 days' + clockIcon(25) + '21 to 30 days' + clockIcon(40) + 'Over 30 days';
      body.appendChild(legend);
    }
  };

  const visuals = PBI.slicers
    .band('p2', 'Complaint Trending')
    .concat([
      card(
        'c2Count',
        'Complaints Received',
        'complaintCount',
        M.fmt.int,
        { x: 8, y: 68, w: 247, h: 84 },
        () => 'Complaint Count'
      ),
      card(
        'c2Rep',
        'Reportable Complaints',
        'reportableCount',
        M.fmt.int,
        { x: 263, y: 68, w: 247, h: 84 },
        api =>
          M.fmt.pct(M.MEASURES.reportableCount.calc(api.ctx) / (M.MEASURES.complaintCount.calc(api.ctx) || 1)) +
          ' of complaints received'
      ),
      card(
        'c2OnTime',
        'MDR Reports Filed On Time',
        'mdrOnTime',
        M.fmt.pct,
        { x: 518, y: 68, w: 247, h: 84 },
        () => 'Target at least 95.0%'
      ),
      card(
        'c2Avg',
        'Avg Days to MDR Decision',
        'avgDecision',
        M.fmt.dec1,
        { x: 773, y: 68, w: 247, h: 84 },
        () => 'Days from awareness to decision'
      ),
      card(
        'c2Late',
        'Late MDRs',
        'lateMdr',
        M.fmt.int,
        { x: 1028, y: 68, w: 244, h: 84 },
        () => 'Filed or pending beyond 30 days'
      ),
      controlVisual,
      funnelVisual,
      binVisual,
      tableVisual
    ]);
  PBI.pages.trending = {
    name: 'Complaint Trending',
    visuals,
    filterFields: ['failureMode', 'complaintStatus'],
    controlData
  };
  PBI.clockIcon = clockIcon;
})();
