'use strict';
/* Page 2: Quality and Release. Forecast and anomaly line, test type bar, disposition 100% column, smart narrative, OOS table. */

const weekLabel = w => U.fmtDate(D.DAY0 + w * 7);

function oosTrendModel() {
  const c = ctx('oosTrend');
  const f = S.filters.find(x => x.id === 'visual:oosTrend:week');
  const n = f && f.n > 0 ? Math.min(f.n, D.WEEKS) : D.WEEKS;
  const weeks = [];
  for (let w = D.LAST_WEEK - n + 1; w <= D.LAST_WEEK; w++) weeks.push(w);
  const series = detectAnomalies(weeklyOosSeries(c, weeks));
  const fc = holtForecast(
    series.map(p => (p.isAnomaly ? p.expected : p.value)),
    8
  );
  return { c, weeks, series, fc };
}

defineVisual({
  id: 'oosTrend',
  page: 'quality',
  title: 'OOS rate % by week, with forecast and anomaly detection',
  pos: [12, 64, 832, 332],
  measures: ['oosRate'],
  filters: [{ field: 'week', kind: 'relative', n: 52, unit: 'weeks', label: 'Manufacture week' }],
  render(el) {
    const { c, weeks, series, fc } = oosTrendModel();
    const chart = chartFor('oosTrend', el);
    const nA = series.length;
    const labels = weeks.map(weekLabel).concat(fc.map((_, h) => weekLabel(D.LAST_WEEK + h + 1)));
    const pad = arr => arr.concat(new Array(fc.length).fill(null));
    const pre = new Array(nA).fill(null);
    const actual = pad(
      series.map((p, i) => ({ value: p.value, itemStyle: { opacity: opacityFor('oosTrend', { week: weeks[i] }) } }))
    );
    const fcLine = pre.slice(0, nA - 1).concat(
      [series[nA - 1] ? series[nA - 1].value : null],
      fc.map(x => x.value)
    );
    const lower = pre.concat(fc.map(x => x.lo));
    const width = pre.concat(fc.map(x => x.hi - x.lo));
    const anomalies = pad(series.map(p => (p.isAnomaly ? p.value : null)));
    chart.setOption(
      {
        animation: false,
        textStyle: { fontFamily: FONT },
        legend: Object.assign({}, LEGEND, { data: ['OOS rate %', 'Forecast', 'Confidence interval 95%', 'Anomaly'] }),
        grid: { left: 52, right: 18, top: 30, bottom: 30 },
        tooltip: Object.assign({}, TT, {
          trigger: 'axis',
          formatter: ps => {
            const i = ps[0].dataIndex;
            if (i < nA) {
              const p = series[i];
              const rows = [
                ['Week of', labels[i]],
                ['OOS rate %', FMT.pct(p.value)],
                ['Batches', FMT.int(p.batches)],
                ['Batches with OOS', FMT.int(p.oosBatches)]
              ];
              if (p.isAnomaly)
                rows.push(
                  ['Anomaly', 'Expected ' + FMT.pct(p.lo) + ' to ' + FMT.pct(p.hi)],
                  ['', 'Click the point for explanations']
                );
              return ttHtml(rows);
            }
            const x = fc[i - nA];
            return ttHtml([
              ['Week of', labels[i]],
              ['Forecast', FMT.pct(x.value)],
              ['Upper bound', FMT.pct(x.hi)],
              ['Lower bound', FMT.pct(x.lo)]
            ]);
          }
        }),
        xAxis: {
          type: 'category',
          data: labels,
          boundaryGap: false,
          axisLabel: AXIS_LABEL,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#C8C6C4' } },
          name: 'Manufacture week',
          nameLocation: 'middle',
          nameGap: 20,
          nameTextStyle: AXIS_NAME
        },
        yAxis: {
          type: 'value',
          min: 0,
          name: 'OOS rate %',
          nameLocation: 'middle',
          nameGap: 38,
          nameTextStyle: AXIS_NAME,
          splitLine: GRID_LINE,
          axisLabel: Object.assign({}, AXIS_LABEL, { formatter: v => (v * 100).toFixed(0) + '%' })
        },
        series: [
          {
            name: 'Confidence lower',
            type: 'line',
            data: lower,
            stack: 'ci',
            symbol: 'none',
            lineStyle: { opacity: 0 },
            silent: true,
            tooltip: { show: false }
          },
          {
            name: 'Confidence interval 95%',
            type: 'line',
            data: width,
            stack: 'ci',
            symbol: 'none',
            lineStyle: { opacity: 0 },
            silent: true,
            areaStyle: { color: 'rgba(50,87,168,0.16)' },
            itemStyle: { color: 'rgba(50,87,168,0.3)' }
          },
          {
            name: 'OOS rate %',
            type: 'line',
            data: actual,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: true,
            lineStyle: { width: 2, color: THEME[0] },
            itemStyle: { color: THEME[0] }
          },
          {
            name: 'Forecast',
            type: 'line',
            data: fcLine,
            symbol: 'none',
            lineStyle: { width: 2, type: [5, 4], color: THEME[0] },
            itemStyle: { color: THEME[0] }
          },
          {
            name: 'Anomaly',
            type: 'scatter',
            data: anomalies,
            symbol: 'circle',
            symbolSize: 15,
            z: 5,
            itemStyle: { color: 'rgba(209,52,56,0.12)', borderColor: '#D13438', borderWidth: 2 }
          }
        ]
      },
      true
    );
    chart.off('click');
    chart.on('click', p => {
      const i = p.dataIndex;
      if (i >= nA) return;
      const pt = series[i];
      if (pt.isAnomaly && (p.seriesName === 'Anomaly' || p.seriesName === 'OOS rate %')) {
        S.sidePane = Object.assign({ type: 'anomaly', explanations: explainAnomaly(c, pt.week, weeks) }, pt);
        renderSidePane();
        return;
      }
      if (p.seriesName === 'OOS rate %') select('oosTrend', { week: weeks[i] }, isCtrl(p));
    });
  },
  data() {
    const { series, fc } = oosTrendModel();
    const rows = series.map(p => [
      weekLabel(p.week),
      p.value,
      p.batches,
      p.oosBatches,
      p.isAnomaly ? 'Yes' : 'No',
      null,
      null,
      null
    ]);
    fc.forEach((x, h) => rows.push([weekLabel(D.LAST_WEEK + h + 1), null, null, null, '', x.value, x.lo, x.hi]));
    return {
      columns: [
        'Week of',
        'OOS rate %',
        'Batches',
        'Batches with OOS',
        'Anomaly',
        'Forecast',
        'Lower bound',
        'Upper bound'
      ],
      rows,
      formats: [null, 'pct', 'int', 'int', null, 'pct', 'pct', 'pct']
    };
  }
});

defineVisual({
  id: 'narrative',
  page: 'quality',
  title: 'Smart narrative',
  pos: [852, 64, 416, 172],
  className: 'narrative-visual',
  render(el) {
    const sentences = smartNarrative(ctx('narrative'));
    el.innerHTML = '<div class="narrative">' + sentences.map(s => '<p>' + s + '</p>').join('') + '</div>';
  },
  data() {
    const tmp = document.createElement('div');
    return {
      columns: ['Sentence'],
      rows: smartNarrative(ctx('narrative')).map(s => {
        tmp.innerHTML = s;
        return [tmp.textContent];
      })
    };
  }
});

function testBarModel() {
  const count = rows => D.TEST_TYPES.map(t => rows.filter(o => o.testType === t).length);
  const full = count(ctx('testBar', { selection: false }).oos);
  const hl = hasForeignSelection('testBar') ? count(ctx('testBar').oos) : null;
  const st = sortState('testBar');
  const order = D.TEST_TYPES.map((t, i) => i).sort(
    (a, b) =>
      (st.field === 'name' ? D.TEST_TYPES[a].localeCompare(D.TEST_TYPES[b]) : full[a] - full[b]) *
      (st.dir === 'desc' ? -1 : 1)
  );
  return {
    cats: order.map(i => D.TEST_TYPES[i]),
    full: order.map(i => full[i]),
    hl: hl ? order.map(i => hl[i]) : null
  };
}

defineVisual({
  id: 'testBar',
  page: 'quality',
  title: 'OOS results by test type',
  pos: [852, 244, 416, 152],
  measures: ['oosCount'],
  sortFields: [
    { key: 'value', label: 'OOS results' },
    { key: 'name', label: 'Test type' }
  ],
  defaultSort: { field: 'value', dir: 'desc' },
  filters: [{ field: 'status', label: 'Status' }],
  render(el) {
    const { cats, full, hl } = testBarModel();
    const chart = chartFor('testBar', el);
    const label = { show: true, position: 'right', fontSize: 10, color: '#605E5C', fontFamily: FONT };
    const series = hl
      ? [
          {
            name: 'OOS results',
            type: 'bar',
            data: full,
            itemStyle: { color: THEME[0], opacity: 0.4 },
            barWidth: '62%',
            label
          },
          {
            name: 'Highlighted',
            type: 'bar',
            data: hl,
            itemStyle: { color: THEME[0] },
            barWidth: '62%',
            barGap: '-100%'
          }
        ]
      : [
          {
            name: 'OOS results',
            type: 'bar',
            barWidth: '62%',
            label,
            data: full.map((v, i) => ({
              value: v,
              itemStyle: { color: THEME[0], opacity: opacityFor('testBar', { testType: cats[i] }) }
            }))
          }
        ];
    chart.setOption(
      {
        animation: false,
        textStyle: { fontFamily: FONT },
        grid: { left: 88, right: 30, top: 4, bottom: 18 },
        tooltip: Object.assign({}, TT, {
          trigger: 'axis',
          axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.04)' } },
          formatter: ps =>
            ttHtml(
              [
                ['Test type', cats[ps[0].dataIndex]],
                ['OOS results', FMT.int(full[ps[0].dataIndex])]
              ].concat(hl ? [['Highlighted', FMT.int(hl[ps[0].dataIndex])]] : [])
            )
        }),
        xAxis: {
          type: 'value',
          minInterval: 1,
          axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 9 }),
          splitLine: GRID_LINE
        },
        yAxis: {
          type: 'category',
          data: cats,
          inverse: true,
          axisLabel: AXIS_LABEL,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#C8C6C4' } }
        },
        series
      },
      true
    );
    chart.off('click');
    chart.on('click', p => select('testBar', { testType: cats[p.dataIndex] }, isCtrl(p)));
  },
  data() {
    const { cats, full } = testBarModel();
    return { columns: ['Test type', 'OOS results'], rows: cats.map((c, i) => [c, full[i]]) };
  }
});

function dispoModel() {
  const full = ctx('dispo', { selection: false });
  const hl = hasForeignSelection('dispo') ? ctx('dispo') : null;
  const ax = dateAxis('dispo', full.batches);
  const tally = rows => {
    const m = new Map();
    for (const b of rows) {
      const k = ax.keyOf(b);
      if (k === undefined) continue;
      const key = k + '|' + b.disposition;
      m.set(key, (m.get(key) || 0) + 1);
    }
    return DISPOSITIONS.map(d => ax.cats.map(cat => m.get(cat.key + '|' + d) || 0));
  };
  const f = tally(full.batches);
  const totals = ax.cats.map((_, i) => DISPOSITIONS.reduce((a, d, di) => a + f[di][i], 0));
  return { ax, full: f, hl: hl ? tally(hl.batches) : null, totals };
}

defineVisual({
  id: 'dispo',
  page: 'quality',
  pos: [12, 404, 516, 288],
  measures: ['batches'],
  title: () => 'Batch disposition by ' + ['year', 'quarter', 'month'][drillState('dispo').level],
  hierarchy: ['year', 'quarter', 'month'],
  defaultLevel: 2,
  filters: [{ field: 'monthIdx', kind: 'relative', n: 12, unit: 'months', label: 'Manufacture month' }],
  render(el) {
    const { ax, full, hl, totals } = dispoModel();
    const chart = chartFor('dispo', el);
    const pct = (v, i) => (totals[i] ? v / totals[i] : 0);
    const series = [];
    DISPOSITIONS.forEach((d, di) => {
      const color = DISPOSITION_COLORS[d];
      const base = hl ? hl[di] : full[di];
      series.push({
        name: d,
        type: 'bar',
        stack: 'p',
        barWidth: '62%',
        itemStyle: { color },
        label: {
          show: di === 0 && !hl,
          position: 'inside',
          color: '#fff',
          fontSize: 9,
          fontFamily: FONT,
          formatter: p => (p.value > 0.1 ? (p.value * 100).toFixed(0) + '%' : '')
        },
        data: base.map((v, i) => ({
          value: pct(v, i),
          itemStyle: { opacity: ax.field ? opacityFor('dispo', { [ax.field]: ax.cats[i].key, disposition: d }) : 1 }
        }))
      });
      if (hl)
        series.push({
          name: d,
          type: 'bar',
          stack: 'p',
          data: full[di].map((v, i) => pct(v - hl[di][i], i)),
          itemStyle: { color, opacity: 0.35 }
        });
    });
    chart.setOption(
      {
        animation: false,
        textStyle: { fontFamily: FONT },
        legend: Object.assign({}, LEGEND, { data: DISPOSITIONS }),
        grid: { left: 42, right: 10, top: 30, bottom: 24 },
        tooltip: Object.assign({}, TT, {
          trigger: 'axis',
          axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(0,0,0,0.04)' } },
          formatter: ps => {
            const i = ps[0].dataIndex;
            return ttHtml(
              [['Period', ax.cats[i].label]].concat(
                DISPOSITIONS.map((d, di) => [d, FMT.int(full[di][i]) + ' (' + FMT.pct(pct(full[di][i], i)) + ')'])
              )
            );
          }
        }),
        xAxis: {
          type: 'category',
          data: ax.cats.map(c => c.label),
          axisLabel: AXIS_LABEL,
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#C8C6C4' } }
        },
        yAxis: {
          type: 'value',
          min: 0,
          max: 1,
          axisLabel: Object.assign({}, AXIS_LABEL, { formatter: v => (v * 100).toFixed(0) + '%' }),
          splitLine: GRID_LINE
        },
        series
      },
      true
    );
    chart.off('click');
    chart.on('click', p => {
      const cat = ax.cats[p.dataIndex];
      const d = drillState('dispo');
      if (d.mode && !d.flat && drillInto('dispo', cat.key)) return;
      if (ax.field) select('dispo', { [ax.field]: cat.key, disposition: p.seriesName }, isCtrl(p));
    });
  },
  data() {
    const { ax, full, totals } = dispoModel();
    return {
      columns: ['Period'].concat(DISPOSITIONS, ['Total batches']),
      rows: ax.cats.map((c, i) =>
        [c.label].concat(
          DISPOSITIONS.map((_, di) => full[di][i]),
          [totals[i]]
        )
      )
    };
  }
});

/* ---------- OOS investigations table ---------- */
const OOS_COLS = [
  { key: 'id', label: 'Investigation' },
  { key: 'batchId', label: 'Batch ID' },
  { key: 'openedDay', label: 'Opened', fmt: d => U.fmtDate(d) },
  { key: 'testType', label: 'Test type' },
  { key: 'line', label: 'Line' },
  { key: 'customer', label: 'Customer' },
  { key: 'status', label: 'Status' },
  { key: 'ageDays', label: 'Age days' }
];

function oosTableRows() {
  const rows = ctx('oosTable').oos.slice();
  const st = sortState('oosTable');
  const k = st.field;
  rows.sort(
    (a, b) =>
      (typeof a[k] === 'number' ? a[k] - b[k] : String(a[k]).localeCompare(String(b[k]))) * (st.dir === 'desc' ? -1 : 1)
  );
  return rows;
}

defineVisual({
  id: 'oosTable',
  page: 'quality',
  title: 'OOS investigations',
  pos: [536, 404, 732, 288],
  sortFields: OOS_COLS.map(c => ({ key: c.key, label: c.label })),
  defaultSort: { field: 'openedDay', dir: 'desc' },
  measures: ['oosCount', 'oosOpen'],
  filters: [
    { field: 'status', label: 'Status' },
    { field: 'testType', label: 'Test type' }
  ],
  render(el) {
    const rows = oosTableRows();
    const st = sortState('oosTable');
    const maxAge = Math.max(1, ...rows.map(r => r.ageDays));
    const head = OOS_COLS.map(
      c =>
        '<th data-k="' +
        c.key +
        '" class="' +
        (c.key === 'ageDays' ? 'num' : '') +
        '">' +
        c.label +
        (st.field === c.key ? (st.dir === 'desc' ? ' &#9662;' : ' &#9652;') : '') +
        '</th>'
    ).join('');
    const body = rows
      .map(r => {
        const op = opacityFor('oosTable', { batchId: r.batchId });
        const aged = r.status === 'Open' && r.ageDays > 30;
        return (
          '<tr data-b="' +
          r.batchId +
          '" style="opacity:' +
          op +
          '">' +
          OOS_COLS.map(c => {
            if (c.key === 'status')
              return (
                '<td><span class="pill ' + (r.status === 'Open' ? 'open' : 'closed') + '">' + r.status + '</span></td>'
              );
            if (c.key === 'ageDays')
              return (
                '<td class="num"><span class="dbar' +
                (aged ? ' bad' : '') +
                '" style="width:' +
                Math.round((r.ageDays / maxAge) * 46) +
                'px"></span>' +
                r.ageDays +
                '</td>'
              );
            if (c.key === 'batchId') return '<td class="link">' + r.batchId + '</td>';
            return '<td>' + esc(c.fmt ? c.fmt(r[c.key]) : r[c.key]) + '</td>';
          }).join('') +
          '</tr>'
        );
      })
      .join('');
    const open = rows.filter(r => r.status === 'Open').length;
    el.innerHTML =
      '<div class="tbl-wrap"><table class="pbi-table"><thead><tr>' +
      head +
      '</tr></thead><tbody>' +
      body +
      '</tbody><tfoot><tr><td>Total</td><td>' +
      rows.length +
      '</td><td colspan="4"></td><td>' +
      open +
      ' open</td><td></td></tr></tfoot></table></div>';
    el.onclick = e => {
      const th = e.target.closest('th');
      if (th) {
        const cur = sortState('oosTable');
        S.sort.oosTable = {
          field: th.dataset.k,
          dir: cur.field === th.dataset.k && cur.dir === 'desc' ? 'asc' : 'desc'
        };
        return renderAll();
      }
      const tr = e.target.closest('tbody tr');
      if (tr) select('oosTable', { batchId: tr.dataset.b }, e.ctrlKey || e.metaKey);
      else if (S.selection && S.selection.source === 'oosTable') setSelection(null);
    };
    el.oncontextmenu = e => {
      const tr = e.target.closest('tbody tr');
      e.preventDefault();
      if (tr) showContextMenu(e.clientX, e.clientY, batchContextItems(tr.dataset.b));
    };
  },
  data() {
    return {
      columns: OOS_COLS.map(c => c.label),
      rows: oosTableRows().map(r => OOS_COLS.map(c => (c.fmt ? c.fmt(r[c.key]) : r[c.key])))
    };
  }
});
