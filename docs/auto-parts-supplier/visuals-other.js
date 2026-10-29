/* Shared bar and column visuals, the row-level security page and the Machine Detail drillthrough. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const D = window.PBI_DATA;
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const cc = PBI.cc;

  /* ---------- generic single-series bar or column with highlight ---------- */
  PBI.kinds.bar = function (api, v) {
    const m = M.MEASURES[v.measure] || { table: v.table, fn: v.fn, fmt: v.fmt };
    const fn = v.fn || m.fn;
    const fmtKind = v.fmt || m.fmt;
    const present = M.groupBy(api.q(m.table, { sel: false }), v.field);
    let keys = (v.keys ? v.keys() : M.fieldValues(v.field, ST.rolePlant())).filter(k => present.has(k));
    if (!keys.length) {
      api.blank('(Blank)');
      api.setTable([], []);
      return;
    }
    const labelOf = v.labelShort && v.field === 'Month' ? k => D.months[k].short : k => M.valueLabel(v.field, k);
    const totals = keys.map(k => fn(present.get(k)));
    const sort = api.sort() || v.defaultSort;
    if (sort)
      keys = cc
        .sortKeys(keys, totals, sort.by === 'value' ? sort : { by: 'label', dir: sort.dir }, labelOf)
        .map(i => keys[i]);
    const r = cc.hlData(api, m.table, v.field, keys, fn);
    const series = cc.hlBars({
      name: v.measure,
      color: v.color || cc.COLORS[0],
      full: r.full,
      hl: r.hl,
      horizontal: v.horizontal,
      barMaxWidth: v.barMaxWidth || 26,
      label: x => M.fmt(x, fmtKind)
    });
    const catAxis = cc.axisCat({
      data: keys.map(labelOf),
      inverse: !!v.horizontal,
      axisLabel: { color: '#605E5C', fontSize: 11, interval: 0, width: v.horizontal ? 130 : 70, overflow: 'truncate' }
    });
    const valAxis = cc.axisVal({ axisLabel: { color: '#605E5C', fontSize: 11, formatter: cc.axisFormatter(fmtKind) } });
    const chart = api.chart();
    chart.setOption(
      cc.base({
        grid: v.horizontal
          ? { left: 8, right: 46, top: 8, bottom: 24, containLabel: true }
          : { left: 46, right: 12, top: 22, bottom: 28 },
        tooltip: cc.tooltip({
          trigger: 'item',
          formatter: e =>
            PBI.ttHtml(
              [
                [M.fieldDisplay(v.field), labelOf(keys[e.dataIndex])],
                [v.measure, M.fmt(r.full[e.dataIndex], fmtKind)]
              ].concat(r.hl ? [['Highlighted', M.fmt(r.hl[e.dataIndex], fmtKind)]] : [])
            )
        }),
        xAxis: v.horizontal ? valAxis : catAxis,
        yAxis: v.horizontal ? catAxis : valAxis,
        series
      }),
      true
    );
    cc.onPointClick(api, v.field, e => keys[e.dataIndex]);
    api.setTable(
      [{ name: M.fieldDisplay(v.field) }, { name: v.measure, fmt: fmtKind }],
      keys.map((k, i) => [labelOf(k), r.full[i]])
    );
  };

  /* ---------- clustered column: OEE by quarter and plant ---------- */
  PBI.kinds.oeeColumns = function (api) {
    const plants = M.fieldValues('Plant', ST.rolePlant()).filter(
      p => api.q('Production', { sel: false, extra: [{ field: 'Plant', values: new Set([p]) }] }).length
    );
    const qs = D.quarters;
    if (!plants.length) {
      api.blank('(Blank)');
      api.setTable([], []);
      return;
    }
    const series = [];
    const tbl = [];
    plants.forEach(p => {
      const ci = D.plants.findIndex(x => x.name === p);
      const r = cc.hlData(api, 'Production', 'Quarter', qs, M.MS.oee, [{ field: 'Plant', values: new Set([p]) }]);
      qs.forEach((q, i) => tbl.push([q, p, r.full[i]]));
      cc.hlBars({
        name: p,
        color: cc.COLORS[ci],
        full: r.full,
        hl: r.hl,
        barMaxWidth: 22,
        label: plants.length <= 2 ? x => M.fmt(x, 'pct') : null
      }).forEach(s => series.push(s));
    });
    series[0].markLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { color: '#A4262C', type: 'dashed', width: 1 },
      label: { formatter: 'Target 85%', position: 'insideEndTop', color: '#A4262C', fontSize: 10 },
      data: [{ yAxis: 0.85 }]
    };
    const chart = api.chart();
    chart.setOption(
      cc.base({
        legend: cc.legend('Plant', plants),
        graphic: cc.legendTitle('Plant'),
        grid: { left: 46, right: 12, top: 30, bottom: 26 },
        tooltip: cc.tooltip({
          trigger: 'item',
          formatter: e =>
            PBI.ttHtml([
              ['Quarter', qs[e.dataIndex]],
              ['Plant', e.seriesName],
              ['OEE', M.fmt(tbl.find(t => t[0] === qs[e.dataIndex] && t[1] === e.seriesName)[2], 'pct')]
            ])
        }),
        xAxis: cc.axisCat({ data: qs }),
        yAxis: cc.axisVal({
          min: 0.5,
          max: 1,
          axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => (x * 100).toFixed(0) + '%' }
        }),
        series
      }),
      true
    );
    cc.onPointClick(api, 'Quarter', e => qs[e.dataIndex]);
    api.setTable([{ name: 'Quarter' }, { name: 'Plant' }, { name: 'OEE', fmt: 'pct' }], tbl);
  };

  /* ---------- RLS: role definitions ---------- */
  PBI.kinds.roleTable = function (api) {
    const S = api.S;
    const body = M.ROLES.map(
      r =>
        '<tr class="' +
        (r.name === S.role ? '' : '') +
        '"><td>' +
        (r.name === S.role
          ? '<span class="ico circle" style="background:#117865"></span><b>' + PBI.esc(r.name) + '</b>'
          : '<span class="ico"></span>' + PBI.esc(r.name)) +
        '</td>' +
        '<td>' +
        (r.plant ? 'Plant' : '(all tables)') +
        '</td><td style="font-family:Consolas,monospace;font-size:11px">' +
        PBI.esc(r.dax) +
        '</td><td>' +
        PBI.esc(r.members) +
        '</td>' +
        '</tr>'
    ).join('');
    api.el.innerHTML =
      '<div style="position:absolute;inset:0 4px 4px 4px;overflow:auto"><table class="tbl"><thead><tr><th>Role</th><th>Table</th><th>Table filter DAX expression</th><th>Members</th></tr></thead><tbody>' +
      body +
      '</tbody></table><div style="font-size:11px;color:#605E5C;padding:10px 8px 0;line-height:1.5">The Plant filter propagates through one-to-many relationships to Production, Downtime, Cost, Receipts, Shipments, EightD and Maintenance. ' +
      'Select View as in the action bar to evaluate the report under a role.</div></div>';
    api.el.querySelectorAll('tbody tr').forEach((tr, i) =>
      tr.addEventListener('click', ev => {
        ev.stopPropagation();
        PBI.app.openViewAs(M.ROLES[i].name);
      })
    );
    api.setTable(
      [{ name: 'Role' }, { name: 'Table filter DAX expression' }, { name: 'Members' }],
      M.ROLES.map(r => [r.name, r.dax, r.members])
    );
  };

  /* ---------- RLS: rows visible by table ---------- */
  const FACTS = ['Production', 'Downtime', 'Cost', 'Receipts', 'Shipments', 'EightD', 'Maintenance'];
  function visibleCounts(pageId) {
    const plant = ST.rolePlant();
    const f = plant ? [{ field: 'Plant', values: new Set([plant]) }] : [];
    return FACTS.map(t => ({ table: t, total: D.tables[t].length, visible: M.filterRows(t, f).length }));
  }
  PBI.kinds.rowsByTable = function (api) {
    const counts = visibleCounts(api.page.id);
    const chart = api.chart();
    chart.setOption(
      cc.base({
        legend: cc.legend(null, ['Visible to role', 'Rows in model']),
        grid: { left: 8, right: 54, top: 28, bottom: 24, containLabel: true },
        tooltip: cc.tooltip({
          trigger: 'item',
          formatter: e => {
            const c = counts[e.dataIndex];
            return PBI.ttHtml([
              ['Table', c.table],
              ['Visible to role', M.fmt(c.visible, 'int')],
              ['Rows in model', M.fmt(c.total, 'int')],
              ['Share visible', M.fmt(c.visible / c.total, 'pct')]
            ]);
          }
        }),
        yAxis: cc.axisCat({ data: counts.map(c => c.table), inverse: true }),
        xAxis: cc.axisVal({ axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => M.compact(x, 0) } }),
        series: [
          {
            type: 'bar',
            name: 'Visible to role',
            color: cc.COLORS[0],
            barMaxWidth: 12,
            data: counts.map(c => c.visible),
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              color: '#605E5C',
              formatter: e => M.compact(e.value, 0)
            }
          },
          {
            type: 'bar',
            name: 'Rows in model',
            color: '#C8C6C4',
            barMaxWidth: 12,
            data: counts.map(c => c.total),
            label: {
              show: true,
              position: 'right',
              fontSize: 10,
              color: '#8A8886',
              formatter: e => M.compact(e.value, 0)
            }
          }
        ]
      }),
      true
    );
    api.setTable(
      [{ name: 'Table' }, { name: 'Visible to role', fmt: 'int' }, { name: 'Rows in model', fmt: 'int' }],
      counts.map(c => [c.table, c.visible, c.total])
    );
  };
  PBI.visibleCounts = visibleCounts;

  /* ---------- RLS: plant scorecard ---------- */
  PBI.kinds.plantScorecard = function (api) {
    const cols = ['Plant', 'Country', 'OEE', 'Scrap %', 'Downtime h', 'Cost variance', 'Customer PPM', 'Open 8Ds'];
    const list = M.fieldValues('Plant', ST.rolePlant())
      .map(p => {
        const ex = [{ field: 'Plant', values: new Set([p]) }];
        const prod = api.q('Production', { extra: ex });
        if (!prod.length) return null;
        const pl = D.plants.find(x => x.name === p);
        return [
          p,
          pl.country,
          M.MS.oee(prod),
          M.MS.scrapPct(prod),
          M.MS.downtimeHours(api.q('Downtime', { extra: ex })),
          M.MS.variance(api.q('Cost', { extra: ex })),
          M.MS.customerPpm(api.q('Shipments', { extra: ex })),
          M.MS.open8D(api.q('EightD', { extra: ex }))
        ];
      })
      .filter(Boolean);
    if (!list.length) {
      api.blank('(Blank)');
      api.setTable([], []);
      return;
    }
    const fmts = [null, null, 'pct', 'pct2', 'num', 'cur', 'ppm', 'int'];
    const sel = api.selfSel;
    const body = list
      .map(
        (r, i) =>
          '<tr data-i="' +
          i +
          '" class="' +
          (sel && !sel.values.has(r[0]) ? 'faded' : '') +
          '">' +
          r
            .map((x, j) => {
              let cls = fmts[j] ? 'num' : '';
              if (j === 2) cls += x >= 0.85 ? ' font-good' : ' font-bad';
              if (j === 5) cls += x > 0 ? ' font-bad' : ' font-good';
              return (
                '<td class="' +
                cls +
                '">' +
                (j === 2
                  ? x >= 0.85
                    ? '<span class="ico circle" style="background:#107C10"></span>'
                    : '<span class="ico diamond" style="background:#D13438"></span>'
                  : '') +
                PBI.esc(fmts[j] ? M.fmt(x, fmts[j]) : x) +
                '</td>'
              );
            })
            .join('') +
          '</tr>'
      )
      .join('');
    api.el.innerHTML =
      '<div style="position:absolute;inset:0 4px 4px 4px;overflow:auto"><table class="tbl"><thead><tr>' +
      cols.map((c, j) => '<th class="' + (fmts[j] ? 'num' : '') + '">' + c + '</th>').join('') +
      '</tr></thead><tbody>' +
      body +
      '</tbody></table></div>';
    api.el.querySelectorAll('tbody tr').forEach(tr =>
      tr.addEventListener('click', ev => {
        ev.stopPropagation();
        api.select('Plant', list[+tr.dataset.i][0], ev.ctrlKey || ev.metaKey);
      })
    );
    api.setTable(
      cols.map((c, j) => ({ name: c, fmt: fmts[j] === 'cur' ? 'curFull' : fmts[j] })),
      list
    );
  };

  /* ---------- Machine Detail: downtime events timeline ---------- */
  PBI.kinds.dtTimeline = function (api) {
    const rows = api.q('Downtime');
    if (!rows.length) {
      api.blank('No downtime events for this machine in the current filter context');
      api.setTable([], []);
      return;
    }
    const reasons = D.reasons.filter(r => rows.some(x => x.reason === r));
    const mk = (failure, name, color) => ({
      type: 'scatter',
      name,
      color,
      data: rows.filter(x => x.failure === failure).map(x => ({ value: [x.dateMs, x.reason, x.minutes], ev: x })),
      symbolSize: e => 5 + Math.sqrt(e[2]) * 1.3,
      itemStyle: { opacity: 0.75, borderColor: '#FFFFFF', borderWidth: 0.5 }
    });
    const chart = api.chart();
    chart.setOption(
      cc.base({
        legend: cc.legend('Event type', ['Failure', 'Process loss']),
        graphic: cc.legendTitle('Event type'),
        grid: { left: 8, right: 18, top: 30, bottom: 26, containLabel: true },
        tooltip: cc.tooltip({
          trigger: 'item',
          formatter: e => {
            const x = e.data.ev;
            return PBI.ttHtml([
              ['Event', x.id],
              ['Date', x.date],
              ['Shift', x.shift],
              ['Downtime reason', x.reason],
              ['Duration (min)', String(x.minutes)]
            ]);
          }
        }),
        xAxis: cc.axisVal({
          type: 'time',
          min: D.months[0].startMs,
          max: Date.UTC(2026, 9, 1),
          splitLine: { show: false },
          axisLabel: { color: '#605E5C', fontSize: 11, formatter: '{MMM}' }
        }),
        yAxis: cc.axisCat({ data: reasons, splitLine: { show: true, lineStyle: { color: '#F3F2F1' } } }),
        series: [mk(true, 'Failure', '#D64554'), mk(false, 'Process loss', cc.COLORS[1])]
      }),
      true
    );
    cc.onPointClick(api, 'Reason', e => e.data.ev.reason);
    api.setTable(
      [
        { name: 'Event' },
        { name: 'Date' },
        { name: 'Shift' },
        { name: 'Downtime reason' },
        { name: 'Duration (min)', fmt: 'int' }
      ],
      rows.map(x => [x.id, x.date, x.shift, x.reason, x.minutes])
    );
  };

  /* ---------- Machine Detail: maintenance orders ---------- */
  PBI.kinds.maintTable = function (api) {
    const rows = api
      .q('Maintenance')
      .slice()
      .sort((a, b) => b.dateMs - a.dateMs);
    if (!rows.length) {
      api.blank('No maintenance orders');
      api.setTable([], []);
      return;
    }
    const color = { Completed: '#107C10', 'In progress': '#C19C00', Scheduled: '#2E86C1' };
    const body = rows
      .slice(0, 60)
      .map(
        r =>
          '<tr><td>' +
          r.id +
          '</td><td>' +
          r.date +
          '</td><td>' +
          r.type +
          '</td><td>' +
          PBI.esc(r.description) +
          '</td><td class="num">' +
          r.hours.toFixed(1) +
          '</td>' +
          '<td><span class="ico circle" style="background:' +
          color[r.status] +
          '"></span>' +
          r.status +
          '</td></tr>'
      )
      .join('');
    api.el.innerHTML =
      '<div style="position:absolute;inset:0 4px 4px 4px;overflow:auto"><table class="tbl"><thead><tr><th>Work order</th><th>Date</th><th>Type</th><th>Description</th><th class="num">Hours</th><th>Status</th></tr></thead><tbody>' +
      body +
      '</tbody></table></div>';
    api.setTable(
      [
        { name: 'Work order' },
        { name: 'Date' },
        { name: 'Type' },
        { name: 'Description' },
        { name: 'Hours', fmt: 'hrs' },
        { name: 'Status' }
      ],
      rows.map(r => [r.id, r.date, r.type, r.description, r.hours, r.status])
    );
  };
})();
