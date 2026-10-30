/* page3.js: CAPA Effectiveness page. Cards, decomposition tree, aging bar with target, scatter, smart narrative. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const M = PBI.model;
  const C = PBI.charts;
  const esc = C.esc;
  const BUCKETS = ['0-30', '31-60', '61-90', '90+'];
  const AGING_TARGET = 6;

  function capaCard(id, title, key, fmtFn, rect, target, better) {
    const meas = M.MEASURES[key];
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
          const st = C.statusFor(v, target, better);
          body.innerHTML =
            '<div class="pcard"><div class="pcard-val" style="color:' +
            C.STATUS[st] +
            '">' +
            fmtFn(v) +
            '</div>' +
            '<div class="pcard-lbl">Target ' +
            (better === 'low' ? 'at most ' : 'at least ') +
            fmtFn(target) +
            '</div></div>';
        }
      },
      rect
    );
  }

  function openRows(ctx) {
    return M.openCapaRows(ctx);
  }

  const agingVisual = {
    id: 'aging',
    title: 'Open CAPAs by Aging Bucket (days)',
    x: 848,
    y: 312,
    w: 424,
    h: 188,
    highlights: true,
    fields: ['agingBucket'],
    table(api) {
      const m = M.groupCount(openRows(api.ctx), M.agingBucket);
      return {
        columns: [
          { label: 'Aging Bucket' },
          { label: 'Open CAPAs', align: 'right' },
          { label: 'Target', align: 'right' }
        ],
        rows: BUCKETS.map(b => [b, m.get(b) || 0, AGING_TARGET])
      };
    },
    render(body, api) {
      const base = M.groupCount(openRows(api.baseCtx), M.agingBucket);
      const hl = api.external ? M.groupCount(openRows(api.ctx), M.agingBucket) : null;
      const chart = api.chart();
      const series = C.highlightBars({
        name: 'Open CAPAs',
        base: BUCKETS.map(b => base.get(b) || 0),
        hl: hl ? BUCKETS.map(b => hl.get(b) || 0) : null,
        selfSel: api.self ? i => api.selfHas('agingBucket', BUCKETS[i]) : null,
        labels: true,
        barMaxWidth: 60
      });
      const last = series[series.length - 1];
      last.data = last.data.map((d, i) =>
        i === 3
          ? Object.assign(typeof d === 'object' ? d : { value: d }, {
              itemStyle: Object.assign({}, (d && d.itemStyle) || {}, { color: '#D64550' })
            })
          : d
      );
      if (series.length > 1)
        series[0].data = series[0].data.map((d, i) =>
          i === 3 ? { value: d, itemStyle: { color: '#D64550', opacity: C.FADE } } : d
        );
      last.markLine = {
        symbol: 'none',
        silent: true,
        data: [
          {
            yAxis: AGING_TARGET,
            lineStyle: { color: '#252423', type: 'dashed' },
            label: { formatter: 'Target ' + AGING_TARGET, position: 'end', color: '#252423', fontSize: 11 }
          }
        ]
      };
      chart.setOption(
        C.base({
          grid: { left: 40, right: 56, top: 16, bottom: 36 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p =>
              C.tipHtml(
                [
                  ['Aging Bucket', BUCKETS[p.dataIndex] + ' days'],
                  ['Open CAPAs', M.fmt.int(base.get(BUCKETS[p.dataIndex]) || 0)],
                  ['Target', AGING_TARGET]
                ].concat(hl ? [['Highlighted', M.fmt.int(hl.get(BUCKETS[p.dataIndex]) || 0)]] : [])
              )
          }),
          xAxis: C.catAxis(BUCKETS, { title: 'Days open', nameGap: 22 }),
          yAxis: C.valAxis({ title: 'Open CAPAs', nameGap: 26, extra: { minInterval: 1 } }),
          series
        }),
        true
      );
      chart.off('click');
      chart.on('click', p =>
        api.click([{ field: 'agingBucket', value: BUCKETS[p.dataIndex] }], p.event && p.event.event)
      );
    }
  };

  const scatterVisual = {
    id: 'scatter',
    title: 'Days Open and Severity Index by CAPA',
    x: 848,
    y: 508,
    w: 424,
    h: 188,
    fields: ['capaStatus', 'source'],
    table(api) {
      return {
        columns: [
          { label: 'CAPA ID' },
          { label: 'Days Open', align: 'right' },
          { label: 'Severity Index', align: 'right' },
          { label: 'CAPA Status' },
          { label: 'Title' }
        ],
        rows: M.rows('capa', api.ctx)
          .filter(r => r.day <= M.asOf)
          .map(r => [r.id, M.daysOpen(r), r.severity, M.capaStatus(r), r.title])
      };
    },
    render(body, api) {
      const base = M.rows('capa', api.baseCtx).filter(r => r.day <= M.asOf);
      const keep = api.external ? new Set(M.rows('capa', api.ctx).map(r => r.id)) : null;
      const mk = status =>
        base
          .filter(r => M.capaStatus(r) === status)
          .map(r => ({
            value: [M.daysOpen(r), r.severity],
            id: r.id,
            name: r.title,
            itemStyle: {
              opacity: (keep && !keep.has(r.id)) || (api.self && !api.selfHas('capaId', r.id)) ? 0.15 : 0.85
            }
          }));
      const chart = api.chart();
      chart.setOption(
        C.base({
          legend: C.legend({ data: ['Open', 'Closed'], formatter: n => n }),
          grid: { left: 40, right: 14, top: 26, bottom: 34 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p =>
              C.tipHtml([
                ['CAPA ID', p.data.id],
                ['Title', p.data.name],
                ['Days Open', p.value[0]],
                ['Severity Index', p.value[1].toFixed(1)],
                ['CAPA Status', p.seriesName]
              ])
          }),
          xAxis: C.valAxis({ title: 'Days Open', nameGap: 22, extra: { splitLine: { show: false } } }),
          yAxis: C.valAxis({
            title: 'Severity Index',
            nameGap: 24,
            formatter: v => v,
            extra: { min: 0, max: 10, interval: 2 }
          }),
          series: [
            {
              name: 'Open',
              type: 'scatter',
              symbolSize: 8,
              itemStyle: { color: '#118DFF' },
              data: mk('Open'),
              markLine: {
                symbol: 'none',
                silent: true,
                data: [
                  [
                    {
                      coord: [90, 0],
                      lineStyle: { color: '#D64550', type: 'dashed' },
                      label: { formatter: '90 days', color: '#D64550', fontSize: 10, position: 'end' }
                    },
                    { coord: [90, 8.6] }
                  ]
                ]
              }
            },
            { name: 'Closed', type: 'scatter', symbolSize: 6, itemStyle: { color: '#E66C37' }, data: mk('Closed') }
          ]
        }),
        true
      );
      chart.off('click');
      chart.on('click', p => api.click([{ field: 'capaId', value: p.data.id }], p.event && p.event.event));
    }
  };

  function hl(text) {
    return '<span class="sn-v">' + esc(text) + '</span>';
  }
  function narrative(ctx) {
    const rows = M.rows('capa', ctx).filter(r => r.day <= M.asOf);
    if (!rows.length) return ['No CAPAs match the current filters.'];
    const open = rows.filter(r => M.capaStatus(r) === 'Open');
    const over = open.filter(r => r.dueDay < M.asOf);
    const top = (arr, fn) => [...M.groupCount(arr, fn).entries()].sort((a, b) => b[1] - a[1])[0];
    const src = top(rows, r => r.source),
      rc = top(rows, r => r.rootCause);
    const closed = rows.filter(r => M.capaStatus(r) === 'Closed');
    const eff = closed.filter(r => r.effectiveness === 'Effective').length;
    const old = open.filter(r => M.daysOpen(r) > 90);
    const avgClose = closed.length ? closed.reduce((s, r) => s + M.daysOpen(r), 0) / closed.length : null;
    const S = PBI.S.slicers;
    const out = [
      'Between ' +
        hl(D.MONTHS[S.from].label) +
        ' and ' +
        hl(D.MONTHS[S.to].label) +
        ', ' +
        hl(M.fmt.int(rows.length)) +
        ' CAPAs were opened. ' +
        hl(M.fmt.int(open.length)) +
        ' remain open as of ' +
        hl(D.fmtDay(M.asOf)) +
        ', and ' +
        hl(M.fmt.int(over.length)) +
        ' of those (' +
        hl(M.fmt.pct(open.length ? over.length / open.length : 0)) +
        ') are past the due date.',
      hl(src[0]) +
        ' is the largest CAPA source with ' +
        hl(M.fmt.int(src[1])) +
        ' CAPAs (' +
        hl(M.fmt.pct(src[1] / rows.length)) +
        '). ' +
        hl(rc[0]) +
        ' is the most frequent root cause category at ' +
        hl(M.fmt.int(rc[1])) +
        '.',
      closed.length
        ? 'Of ' +
          hl(M.fmt.int(closed.length)) +
          ' closed CAPAs, ' +
          hl(M.fmt.pct(eff / closed.length)) +
          ' passed the effectiveness check. Average time to close was ' +
          hl(avgClose.toFixed(0) + ' days') +
          '.'
        : 'No CAPAs in the current selection are closed.'
    ];
    if (old.length) {
      const oldest = old.slice().sort((a, b) => M.daysOpen(b) - M.daysOpen(a))[0];
      out.push(
        hl(M.fmt.int(old.length)) +
          ' open CAPAs are older than 90 days. The oldest is ' +
          hl(oldest.id) +
          ' (' +
          esc(oldest.title) +
          ', ' +
          hl(M.daysOpen(oldest) + ' days') +
          ', owner ' +
          hl(oldest.owner) +
          ').'
      );
    } else {
      out.push('No open CAPA in the current selection is older than 90 days.');
    }
    return out;
  }
  const narrativeVisual = {
    id: 'narrative',
    title: 'Smart narrative',
    x: 848,
    y: 68,
    w: 424,
    h: 236,
    cls: 'smart-narr',
    table(api) {
      return { columns: [{ label: 'Sentence' }], rows: narrative(api.ctx).map(s => [s.replace(/<[^>]+>/g, '')]) };
    },
    render(body, api) {
      body.innerHTML =
        '<div class="sn">' +
        narrative(api.ctx)
          .map(s => '<p>' + s + '</p>')
          .join('') +
        '</div>';
    }
  };

  const visuals = PBI.slicers
    .band('p3', 'CAPA Effectiveness')
    .concat([
      capaCard('c3Open', 'Open CAPAs', 'openCapas', M.fmt.int, { x: 8, y: 68, w: 202, h: 108 }, 25, 'low'),
      capaCard('c3Days', 'Avg Days Open', 'avgDaysOpen', M.fmt.dec1, { x: 218, y: 68, w: 202, h: 108 }, 60, 'low'),
      capaCard('c3Over', 'CAPA Overdue %', 'capaOverdue', M.fmt.pct, { x: 428, y: 68, w: 202, h: 108 }, 0.1, 'low'),
      capaCard(
        'c3Eff',
        'Effectiveness Verified %',
        'effectivePct',
        M.fmt.pct,
        { x: 638, y: 68, w: 202, h: 108 },
        0.85,
        'high'
      ),
      narrativeVisual,
      PBI.decomp,
      agingVisual,
      scatterVisual
    ]);
  PBI.pages.capa = { name: 'CAPA Effectiveness', visuals, filterFields: ['source', 'effectiveness'] };
})();
