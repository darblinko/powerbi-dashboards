/* Page 3: conversion funnel, What-if parameter with projected cards and scenario line, device trends. */
(function () {
  'use strict';
  const M = window.MODEL,
    F = window.FRAME,
    D = window.DATA;
  const S = () => M.getState();
  const ELASTICITY = 1.8;

  const WHATIF_DAX = [
    'Discount % = GENERATESERIES ( 0, 30, 1 )',
    "Discount % Value =\nSELECTEDVALUE ( 'Discount %'[Discount %], 0 )",
    'Price Elasticity = 1.8',
    'Projected Revenue =\nVAR d = [Discount % Value] / 100\nRETURN\n    [Revenue] * ( 1 - d ) * ( 1 + [Price Elasticity] * d )',
    'Projected Gross Margin % =\nVAR d = [Discount % Value] / 100\nVAR ProjCOGS =\n    SUM ( Sales[COGS] ) * ( 1 + [Price Elasticity] * d )\nRETURN\n    DIVIDE ( [Projected Revenue] - ProjCOGS, [Projected Revenue] )'
  ];
  function project(t, pct) {
    const d = pct / 100;
    const units = 1 + ELASTICITY * d;
    const rev = t.rev * (1 - d) * units;
    const cogs = t.cogs * units;
    return { rev, cogs, gp: rev - cogs, margin: rev ? (rev - cogs) / rev : null };
  }

  const STAGES = [
    ['Sessions', 'ses'],
    ['Product views', 'pv'],
    ['Add to cart', 'atc'],
    ['Checkout', 'chk'],
    ['Purchase', 'ord']
  ];
  function funnel(vid) {
    const def = {
      id: vid,
      title: 'Conversion funnel, sessions to purchase',
      fields: ['device', 'channel'],
      last: null,
      dax: [
        'Sessions = SUM ( Sessions[Sessions] )',
        'Product Views = SUM ( Sessions[Product Views] )',
        'Add To Cart = SUM ( Sessions[Add To Cart] )',
        'Checkouts = SUM ( Sessions[Checkouts] )',
        M.MEASURES.orders.dax,
        '% Of First =\nDIVIDE ( [Stage Count], CALCULATE ( [Stage Count], \'Funnel Stage\'[Stage] = "Sessions" ) )'
      ],
      data() {
        return {
          columns: ['Stage', 'Count', '% of first', '% of previous'],
          numeric: [false, true, true, true],
          rows: def.last
        };
      },
      render(body) {
        const t = M.totals(M.rows({ vid }));
        const vals = STAGES.map(s => t[s[1]]);
        const max = vals[0] || 1;
        const pctFirst = vals.map(v => v / max);
        const pctPrev = vals.map((v, i) => (i === 0 ? 1 : v / (vals[i - 1] || 1)));
        def.last = STAGES.map((s, i) => [
          s[0],
          vals[i],
          +(pctFirst[i] * 100).toFixed(2),
          +(pctPrev[i] * 100).toFixed(2)
        ]);
        const pad = vals.map(v => (max - v) / 2);
        const c = F.chart(vid, body);
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            grid: { left: 92, right: 16, top: 8, bottom: 34 },
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'axis',
              axisPointer: { type: 'none' },
              formatter: ps => {
                const i = ps[0].dataIndex;
                return F.tipHtml('', [
                  ['Stage', STAGES[i][0]],
                  ['Count', M.fmt(vals[i], 'int')],
                  ['% of first', M.fmt(pctFirst[i], 'pct2')],
                  ['% of previous', i === 0 ? '100.0%' : M.fmt(pctPrev[i], 'pct')]
                ]);
              }
            }),
            xAxis: { type: 'value', show: false, max },
            yAxis: F.catAxis(
              STAGES.map(s => s[0]),
              {
                inverse: true,
                axisLine: { show: false },
                axisLabel: Object.assign({}, F.axisLabel, { fontSize: 12, color: '#252423' })
              }
            ),
            graphic: [
              {
                type: 'text',
                left: 'center',
                bottom: 6,
                style: {
                  text: 'Sessions to purchase conversion: ' + M.fmt(pctFirst[4], 'pct2'),
                  fill: F.GREY,
                  font: '12px ' + F.FONT
                }
              }
            ],
            series: [
              {
                type: 'bar',
                stack: 'f',
                data: pad,
                itemStyle: { color: 'transparent' },
                silent: true,
                barCategoryGap: '18%'
              },
              {
                type: 'bar',
                stack: 'f',
                itemStyle: { color: F.THEME[0] },
                data: vals.map(v => {
                  const wide = v / max > 0.45;
                  return {
                    value: v,
                    label: { show: true, position: wide ? 'inside' : 'right', color: wide ? '#fff' : '#252423' }
                  };
                }),
                label: {
                  fontSize: 11,
                  fontFamily: F.FONT,
                  formatter: p =>
                    M.fmt(vals[p.dataIndex], 'num') +
                    (p.dataIndex === 0 ? '' : '   ' + M.fmt(pctPrev[p.dataIndex], 'pct') + ' of previous')
                }
              },
              { type: 'bar', stack: 'f', data: pad, itemStyle: { color: 'transparent' }, silent: true }
            ]
          },
          true
        );
      }
    };
    return def;
  }

  function whatIfSlicer(vid) {
    return {
      id: vid,
      type: 'slicer',
      title: 'Discount %',
      noFilterIcon: true,
      dax: WHATIF_DAX.slice(0, 2),
      data() {
        return { columns: ['Discount %'], rows: Array.from({ length: 31 }, (_, i) => [i]) };
      },
      render(body) {
        const v = S().whatIf;
        body.innerHTML =
          '<div class="whatif"><input class="pbi-input wi-num" type="number" min="0" max="30" step="1" value="' +
          v +
          '" aria-label="Discount %">' +
          '<input class="wi-range" type="range" min="0" max="30" step="1" value="' +
          v +
          '" aria-label="Discount % slider" style="--p:' +
          (v / 30) * 100 +
          '%">' +
          '<div class="wi-scale"><span>0</span><span>30</span></div></div>';
        const set = n => M.setState({ whatIf: Math.min(30, Math.max(0, Math.round(+n || 0))) });
        const range = body.querySelector('.wi-range');
        range.addEventListener('input', () => {
          range.style.setProperty('--p', (range.value / 30) * 100 + '%');
          body.querySelector('.wi-num').value = range.value;
        });
        range.addEventListener('change', () => set(range.value));
        body.querySelector('.wi-num').addEventListener('change', e => set(e.target.value));
      }
    };
  }

  function projectedCard(vid, kind) {
    const def = {
      id: vid,
      type: 'card',
      hideTitle: true,
      title: kind === 'rev' ? 'Projected revenue' : 'Projected gross margin %',
      dax: kind === 'rev' ? [WHATIF_DAX[3], WHATIF_DAX[2]] : [WHATIF_DAX[4], WHATIF_DAX[2]],
      cache: null,
      data() {
        const c = def.cache;
        return { columns: [def.title, 'Baseline'], rows: [[c.p, c.b]] };
      },
      render(body) {
        const t = M.totals(M.rows({ vid }));
        const pr = project(t, S().whatIf);
        const base = project(t, 0);
        const p = kind === 'rev' ? pr.rev : pr.margin,
          b = kind === 'rev' ? base.rev : base.margin;
        def.cache = { p, b };
        const delta = kind === 'rev' ? (p - b) / (b || 1) : p - b;
        const txt =
          (delta >= 0 ? '&#9650; +' : '&#9660; ') +
          (delta * 100).toFixed(1) +
          (kind === 'rev' ? '%' : ' pp') +
          ' <span class="kpi-vs">vs baseline ' +
          M.fmt(b, kind === 'rev' ? 'cur' : 'pct') +
          '</span>';
        body.innerHTML =
          '<div class="kpi-label">' +
          def.title +
          '</div><div class="kpi-value">' +
          M.fmt(p, kind === 'rev' ? 'cur' : 'pct') +
          '</div><div class="kpi-delta ' +
          (Math.abs(delta) < 1e-9 ? '' : delta > 0 ? 'good' : 'bad') +
          '">' +
          txt +
          '</div>';
        body.onmousemove = e =>
          F.showTip(
            e,
            F.tipHtml(def.title, [
              ['Discount %', S().whatIf + '%'],
              ['Projected', M.fmt(p, kind === 'rev' ? 'cur' : 'pct')],
              ['Baseline', M.fmt(b, kind === 'rev' ? 'cur' : 'pct')]
            ]) +
              '<div class="tt-dax">' +
              F.escapeHtml(def.dax[0]) +
              '</div>'
          );
        body.onmouseleave = F.hideTip;
      }
    };
    return def;
  }

  function scenarioLine(vid) {
    const def = {
      id: vid,
      title: () => 'Baseline vs scenario at ' + S().whatIf + '% discount',
      fields: ['category'],
      dax: WHATIF_DAX.slice(3),
      last: null,
      data() {
        return {
          columns: ['Month', 'Baseline revenue', 'Scenario revenue', 'Baseline gross profit', 'Scenario gross profit'],
          numeric: [false, true, true, true, true],
          rows: def.last
        };
      },
      render(body) {
        const g = M.groupBy(M.rows({ vid }), r => r.m);
        const [a, b] = M.dateRange(S());
        const labels = [],
          br = [],
          sr = [],
          bg = [],
          sg = [];
        for (let m = a; m <= b; m++) {
          const t = g.get(m) || M.totals([]);
          const base = project(t, 0),
            sc = project(t, S().whatIf);
          labels.push(D.MONTHS[m].short);
          br.push(base.rev);
          sr.push(sc.rev);
          bg.push(base.gp);
          sg.push(sc.gp);
        }
        def.last = labels.map((l, i) => [
          l,
          Math.round(br[i]),
          Math.round(sr[i]),
          Math.round(bg[i]),
          Math.round(sg[i])
        ]);
        const line = (name, data, color, dashed) => ({
          name,
          type: 'line',
          data,
          symbol: 'circle',
          symbolSize: 4,
          showSymbol: false,
          lineStyle: { width: 2, color, type: dashed ? 'dashed' : 'solid' },
          itemStyle: { color }
        });
        const c = F.chart(vid, body);
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            grid: { left: 48, right: 12, top: 44, bottom: 24 },
            legend: Object.assign({}, F.legendBase, {
              itemGap: 8,
              textStyle: Object.assign({}, F.legendBase.textStyle, { fontSize: 10 })
            }),
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'axis',
              formatter: ps =>
                F.tipHtml(
                  ps[0].axisValue,
                  ps.map(p => [p.seriesName, M.fmt(p.value, 'cur')])
                )
            }),
            xAxis: F.catAxis(labels, {
              boundaryGap: false,
              axisLabel: Object.assign({}, F.axisLabel, { formatter: v => v.replace(' 20', " '") })
            }),
            yAxis: F.valueAxis({
              axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact(M.fmt(v, 'cur')) })
            }),
            series: [
              line('Baseline revenue', br, F.THEME[0]),
              line('Scenario revenue', sr, F.THEME[4], true),
              line('Baseline profit', bg, F.THEME[1]),
              line('Scenario profit', sg, F.THEME[6], true)
            ]
          },
          true
        );
      }
    };
    return def;
  }

  function conversionByDevice(vid) {
    const def = {
      id: vid,
      title: 'Conversion rate by device type',
      fields: ['device'],
      dax: [M.MEASURES.conversion.dax],
      last: null,
      data() {
        return def.last;
      },
      render(body) {
        const list = M.rows({ vid });
        const [a, b] = M.dateRange(S());
        const labels = [];
        for (let m = a; m <= b; m++) labels.push(D.MONTHS[m].short);
        const own = F.ownSelection(vid);
        const series = D.DEVICES.map((dv, i) => {
          const g = M.groupBy(
            list.filter(r => r.dev === i),
            r => r.m
          );
          const data = [];
          for (let m = a; m <= b; m++) data.push(g.has(m) ? M.MEASURES.conversion.f(g.get(m)) : null);
          return {
            name: dv,
            type: 'line',
            triggerLineEvent: true,
            data,
            symbol: 'circle',
            symbolSize: 4,
            showSymbol: false,
            lineStyle: { width: 2, color: F.THEME[i], opacity: own && !own.has(dv) ? 0.3 : 1 },
            itemStyle: { color: F.THEME[i] }
          };
        });
        def.last = {
          columns: ['Month'].concat(D.DEVICES),
          rows: labels.map((l, i) =>
            [l].concat(series.map(s => (s.data[i] === null ? '' : +(s.data[i] * 100).toFixed(3))))
          )
        };
        const c = F.chart(vid, body);
        c.setOption(
          {
            animationDuration: 300,
            textStyle: { fontFamily: F.FONT },
            grid: { left: 46, right: 12, top: 28, bottom: 26 },
            legend: Object.assign({}, F.legendBase),
            tooltip: Object.assign({}, F.tooltipBase, {
              trigger: 'axis',
              formatter: ps =>
                F.tipHtml(
                  ps[0].axisValue,
                  ps.map(p => [p.seriesName, M.fmt(p.value, 'pct2')])
                )
            }),
            xAxis: F.catAxis(labels, {
              boundaryGap: false,
              axisLabel: Object.assign({}, F.axisLabel, { formatter: v => v.replace(' 20', " '") })
            }),
            yAxis: F.valueAxis({
              min: 0,
              axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact((v * 100).toFixed(1) + '%') })
            }),
            series
          },
          true
        );
        c.off('click');
        c.on('click', p => F.selectPoint(vid, 'device', p.seriesName, p.event.event.ctrlKey || p.event.event.metaKey));
        F.bindBlankClear(c, vid);
      }
    };
    return def;
  }

  window.WHATIF = { funnel, whatIfSlicer, projectedCard, scenarioLine, conversionByDevice, project };
})();
