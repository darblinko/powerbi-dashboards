/* Page 2: customer cards, cohort retention matrix, Key influencers, new versus returning area. */
(function () {
  'use strict';
  const M = window.MODEL, F = window.FRAME, D = window.DATA, V = window.VISUALS;
  const S = () => M.getState();

  const CUST = {
    newCustomers: { label: 'New customers', fmt: 'num', f: l => l.length,
      dax: 'New Customers =\nCALCULATE (\n    DISTINCTCOUNT ( Customers[Customer ID] ),\n    USERELATIONSHIP ( Customers[First Order Date], \'Date\'[Date] )\n)' },
    repeatRate: { label: 'Repeat customer rate', fmt: 'pct', f: l => (l.length ? l.filter(c => c.act.length > 1).length / l.length : null),
      dax: 'Repeat Customer Rate =\nDIVIDE (\n    CALCULATE ( [New Customers], Customers[Order Count] > 1 ),\n    [New Customers]\n)' },
    churnRate: { label: '6-month churn rate', fmt: 'pct', invert: true, f: l => { const d = l.filter(c => c.churn); return d.length ? d.filter(c => c.churn === 'Yes').length / d.length : null; },
      dax: 'Churn Rate 6M =\nDIVIDE (\n    CALCULATE ( [New Customers], Customers[Customer Churn] = "Yes" ),\n    CALCULATE ( [New Customers], NOT ISBLANK ( Customers[Customer Churn] ) )\n)' },
    deliveryDays: { label: 'Avg delivery days, first order', fmt: 'dec', invert: true, f: l => (l.length ? l.reduce((s, c) => s + c.dd, 0) / l.length : null),
      dax: 'Avg Delivery Days =\nAVERAGE ( Customers[Delivery Days] )' }
  };
  const fmtC = (key, v) => (CUST[key].fmt === 'dec' ? (v === null ? '(Blank)' : v.toFixed(2)) : M.fmt(v, CUST[key].fmt));

  function custCard(vid, key) {
    const meas = CUST[key];
    const def = {
      id: vid, type: 'card', title: meas.label, hideTitle: true, dax: [meas.dax], cache: null,
      data() { const c = def.cache; return { columns: [meas.label, meas.label + ' PY'], rows: [[c.cur, c.py]] }; },
      render(body) {
        const cur = meas.f(M.customers({ vid }));
        const pyList = M.customers({ vid, shift: -12 });
        const hasPy = M.dateRange(S())[0] - 12 >= 0;
        const py = hasPy ? meas.f(pyList) : null;
        def.cache = { cur, py };
        const isRate = meas.fmt === 'pct';
        const delta = py && cur !== null ? (isRate ? cur - py : (cur - py) / py) : null;
        const good = delta === null || Math.abs(delta) < 0.0005 ? null : (meas.invert ? delta <= 0 : delta >= 0);
        const txt = delta === null ? 'Prior year (Blank)' : (delta >= 0 ? '&#9650; +' : '&#9660; ') + (delta * 100).toFixed(1) + (isRate ? ' pp' : '%') + ' <span class="kpi-vs">vs prior year</span>';
        const g = new Map();
        M.customers({ vid }).forEach(c => { if (!g.has(c.m)) g.set(c.m, []); g.get(c.m).push(c); });
        const [a, b] = M.dateRange(S());
        const spark = [];
        for (let m = a; m <= b; m++) spark.push(g.has(m) ? meas.f(g.get(m)) : null);
        body.innerHTML = '<div class="kpi-label">' + meas.label + '</div><div class="kpi-value">' + fmtC(key, cur) + '</div>' +
          '<div class="kpi-delta ' + (good === null ? '' : good ? 'good' : 'bad') + '">' + txt + '</div>' + V.sparkSvg(spark, F.THEME[1]);
        body.onmousemove = e => F.showTip(e, F.tipHtml(meas.label, [[meas.label, fmtC(key, cur)], [meas.label + ' PY', fmtC(key, py)]]) +
          '<div class="tt-dax">' + F.escapeHtml(meas.dax) + '</div>');
        body.onmouseleave = F.hideTip;
      }
    };
    return def;
  }

  /* ---------- Cohort retention matrix ---------- */
  const COHORT_COLS = 12;
  function cohortMatrix(vid) {
    const def = {
      id: vid, type: 'matrix', title: 'Cohort retention % by months since first order',
      fields: ['channel', 'category'], dax: ['Retention % =\nVAR CohortSize =\n    CALCULATE ( [New Customers], ALL ( \'Months Since First\' ) )\nRETURN\n    DIVIDE ( [Active Customers], CohortSize )'],
      last: null,
      data() { return def.last; },
      render(body) {
        const list = M.customers({ vid });
        const byM = new Map();
        list.forEach(c => { if (!byM.has(c.m)) byM.set(c.m, []); byM.get(c.m).push(c); });
        const months = Array.from(byM.keys()).sort((a, b) => a - b).slice(-12);
        const cell = (cs, k, m) => (m + k > D.LAST_MONTH ? null : cs.filter(c => c.act.includes(k)).length / cs.length);
        const matrix = months.map(m => { const cs = byM.get(m); return { m, n: cs.length, vals: Array.from({ length: COHORT_COLS }, (_, k) => cell(cs, k, m)) }; });
        const totals = Array.from({ length: COHORT_COLS }, (_, k) => {
          let num = 0, den = 0;
          matrix.forEach(r => { if (r.vals[k] !== null) { num += r.vals[k] * r.n; den += r.n; } });
          return den ? num / den : null;
        });
        const flat = [];
        matrix.forEach(r => r.vals.forEach((v, k) => { if (k > 0 && v !== null) flat.push(v); }));
        const hi = Math.max.apply(null, flat.concat([0.01]));
        const color = (v, k) => {
          if (v === null) return '';
          const t = k === 0 ? 1 : Math.min(1, v / hi);
          const lo = [255, 255, 255], top = [50, 87, 168];
          const c = lo.map((x, i) => Math.round(x + (top[i] - x) * t));
          return 'background:rgb(' + c.join(',') + ');color:' + (t > 0.55 ? '#fff' : '#252423');
        };
        const own = F.ownSelection(vid);
        const head = '<tr><th class="corner">Acquisition month</th><th class="num">Customers</th>' +
          Array.from({ length: COHORT_COLS }, (_, k) => '<th class="num">' + k + '</th>').join('') + '</tr>';
        const rowsHtml = matrix.map(r => '<tr data-k="' + D.MONTHS[r.m].short + '" class="' + (own && !own.has(D.MONTHS[r.m].short) ? 'dim' : '') + '"><td>' +
          D.MONTHS[r.m].short + '</td><td class="num">' + r.n.toLocaleString('en-US') + '</td>' +
          r.vals.map((v, k) => '<td class="num cf" style="' + color(v, k) + '">' + (v === null ? '' : k === 0 ? '100%' : (v * 100).toFixed(1) + '%') + '</td>').join('') + '</tr>').join('');
        const totalN = matrix.reduce((s, r) => s + r.n, 0);
        const totalHtml = '<tr class="total"><td>Total</td><td class="num">' + totalN.toLocaleString('en-US') + '</td>' +
          totals.map(v => '<td class="num">' + (v === null ? '' : (v * 100).toFixed(1) + '%') + '</td>').join('') + '</tr>';
        body.innerHTML = '<div class="matrix-caption">Columns: Months since first order. Background colour: Retention %, lowest to highest.</div>' +
          '<div class="matrix-scroll"><table class="pbi-table pbi-matrix">' + '<thead>' + head + '</thead><tbody>' + rowsHtml + totalHtml + '</tbody></table></div>';
        def.last = { columns: ['Acquisition month', 'Customers'].concat(Array.from({ length: COHORT_COLS }, (_, k) => 'Month ' + k)),
          rows: matrix.map(r => [D.MONTHS[r.m].short, r.n].concat(r.vals.map(v => (v === null ? '' : +(v * 100).toFixed(2))))) };
        body.querySelectorAll('tbody tr[data-k]').forEach(tr => tr.addEventListener('click', e => F.selectPoint(vid, 'ym', tr.dataset.k, e.ctrlKey || e.metaKey)));
        body.querySelectorAll('td.cf').forEach((td, i) => td.addEventListener('mousemove', e => {
          const r = matrix[Math.floor(i / COHORT_COLS)], k = i % COHORT_COLS;
          if (r.vals[k] === null) return F.hideTip();
          F.showTip(e, F.tipHtml('', [['Acquisition month', D.MONTHS[r.m].short], ['Months since first order', k], ['Retention %', (r.vals[k] * 100).toFixed(1) + '%'],
            ['Active customers', Math.round(r.vals[k] * r.n)], ['Cohort size', r.n]]));
        }));
        body.querySelector('tbody').addEventListener('mouseleave', F.hideTip);
      }
    };
    return def;
  }

  /* ---------- Key influencers ---------- */
  function conditions() {
    const out = [{ factor: 'Delivery days', label: 'Delivery days is more than 5', test: c => c.dd > 5 }];
    D.CATEGORIES.forEach((v, i) => out.push({ factor: 'First order category', label: 'First order category is ' + v, test: c => c.cat === i }));
    D.CHANNELS.forEach((v, i) => out.push({ factor: 'Acquisition channel', label: 'Acquisition channel is ' + v, test: c => c.ch === i }));
    D.DEVICES.forEach((v, i) => out.push({ factor: 'Device type', label: 'Device type is ' + v, test: c => c.dev === i }));
    out.push({ factor: 'Discount on first order', label: 'Discount on first order is Yes', test: c => c.disc });
    out.push({ factor: 'Discount on first order', label: 'Discount on first order is No', test: c => !c.disc });
    D.AGE_BANDS.forEach((v, i) => out.push({ factor: 'Age band', label: 'Age band is ' + v, test: c => c.age === i }));
    return out;
  }
  const FACTOR_BINS = {
    'Delivery days': { values: ['2', '3', '4', '5', '6', '7', '8', '9'], get: c => String(c.dd), selected: v => +v > 5 },
    'First order category': { values: D.CATEGORIES, get: c => D.CATEGORIES[c.cat] },
    'Acquisition channel': { values: D.CHANNELS, get: c => D.CHANNELS[c.ch] },
    'Device type': { values: D.DEVICES, get: c => D.DEVICES[c.dev] },
    'Discount on first order': { values: ['Yes', 'No'], get: c => (c.disc ? 'Yes' : 'No') },
    'Age band': { values: D.AGE_BANDS, get: c => D.AGE_BANDS[c.age] }
  };
  function kiPopulation(vid) {
    return M.customers({ vid }).filter(c => c.churn);
  }
  function influencers(pop, target) {
    const isT = c => c.churn === target;
    return conditions().map(cond => {
      const inS = pop.filter(cond.test), outS = pop.filter(c => !cond.test(c));
      const rIn = inS.length ? inS.filter(isT).length / inS.length : 0;
      const rOut = outS.length ? outS.filter(isT).length / outS.length : 0;
      return Object.assign({}, cond, { n: inS.length, rIn, rOut, mult: rOut ? rIn / rOut : 0 });
    }).filter(x => x.n >= 30 && x.mult >= 1.05).sort((a, b) => b.mult - a.mult).slice(0, 8);
  }
  function segments(pop, target, infl) {
    const avg = pop.filter(c => c.churn === target).length / (pop.length || 1);
    const conds = infl.slice(0, 8);
    const segs = [];
    for (let i = 0; i < conds.length; i++) for (let j = i + 1; j < conds.length; j++) {
      if (conds[i].factor === conds[j].factor) continue;
      const set = pop.filter(c => conds[i].test(c) && conds[j].test(c));
      if (set.length < 40) continue;
      const rate = set.filter(c => c.churn === target).length / set.length;
      if (rate > avg) segs.push({ conds: [conds[i].label, conds[j].label], n: set.length, rate });
    }
    return { avg, list: segs.sort((a, b) => b.rate - a.rate).slice(0, 6) };
  }

  function keyInfluencers(vid) {
    const def = {
      id: vid, type: 'ki', title: 'Key influencers', hideTitle: true, fields: ['channel', 'category'], last: null,
      dax: ['Customer Churn =\nIF (\n    Customers[Orders In Months 1 To 6] = 0,\n    "Yes",\n    "No"\n)'],
      data() { return def.last; },
      render(body) {
        const s = S();
        const target = s.kiTarget || 'Yes';
        const pop = kiPopulation(vid);
        const infl = influencers(pop, target);
        def.last = { columns: ['Influencer', 'Likelihood multiplier', 'Customer churn is ' + target + ' %', 'Count'],
          rows: infl.map(x => [x.label, +x.mult.toFixed(2), +(x.rIn * 100).toFixed(2), x.n]) };
        const tabs = '<div class="ki-tabs"><button class="ki-tab' + (s.kiTab === 'influencers' ? ' on' : '') + '" data-t="influencers">Key influencers</button>' +
          '<button class="ki-tab' + (s.kiTab === 'segments' ? ' on' : '') + '" data-t="segments">Top segments</button></div>';
        const q = '<div class="ki-q">' + (s.kiTab === 'influencers' ? 'What influences ' : 'When is ') +
          '<button class="ki-dd">Customer churn <span class="chev">&#8964;</span></button> ' + (s.kiTab === 'influencers' ? 'to be' : 'more likely to be') +
          ' <button class="ki-dd ki-target">' + target + ' <span class="chev">&#8964;</span></button>?</div>';
        let inner;
        if (pop.length < 60) inner = '<div class="ki-empty">Not enough data to determine influencers. The current filters leave ' + pop.length + ' customers with an observed churn outcome; at least 60 are required. Churn is observed for customers acquired 6 or more months before the last data month.</div>';
        else if (s.kiTab === 'influencers') inner = influencerPanel(infl, pop, target, s);
        else inner = segmentPanel(segments(pop, target, infl), pop, target, s);
        body.innerHTML = tabs + q + inner;
        body.querySelectorAll('.ki-tab').forEach(b => b.addEventListener('click', () => M.setState({ kiTab: b.dataset.t, segSelected: null })));
        body.querySelector('.ki-target').addEventListener('click', e => {
          e.stopPropagation();
          F.openMenu(e.currentTarget, ['Yes', 'No'].map(v => ({ label: v, checked: target === v, action: () => M.setState({ kiTarget: v, kiSelected: 0, segSelected: null }) })), { alignLeft: true });
        });
        body.querySelectorAll('.ki-row').forEach(r => r.addEventListener('click', () => M.setState({ kiSelected: +r.dataset.i })));
        body.querySelectorAll('.seg-bubble').forEach(b => b.addEventListener('click', () => M.setState({ segSelected: +b.dataset.i })));
        const back = body.querySelector('.seg-back');
        if (back) back.addEventListener('click', () => M.setState({ segSelected: null }));
        const chartEl = body.querySelector('.ki-chart');
        if (chartEl && infl.length) drawInfluencerChart(vid, chartEl, infl[Math.min(s.kiSelected, infl.length - 1)], pop, target);
      }
    };
    return def;
  }

  function influencerPanel(infl, pop, target, s) {
    if (!infl.length) return '<div class="ki-empty">No influencers found for Customer churn is ' + target + ' under the current filters.</div>';
    const sel = Math.min(s.kiSelected, infl.length - 1);
    const left = '<div class="ki-left"><div class="ki-left-head"><span>When...</span><span class="ki-lh-r">....the likelihood of Customer churn being ' + target + ' increases by</span></div>' +
      infl.map((x, i) => '<div class="ki-row' + (i === sel ? ' sel' : '') + '" data-i="' + i + '"><span class="ki-cond">' + x.label + '</span>' +
        '<span class="ki-bubble" style="width:' + (30 + Math.min(14, x.mult * 5)) + 'px;height:' + (30 + Math.min(14, x.mult * 5)) + 'px">' + x.mult.toFixed(2) + 'x</span></div>').join('') + '</div>';
    const x = infl[sel];
    const right = '<div class="ki-right"><div class="ki-right-head">Customer churn is more likely to be ' + target + ' when <b>' + x.label + '</b></div>' +
      '<div class="ki-chart"></div><div class="ki-note">' + (x.rIn * 100).toFixed(1) + '% of customers where ' + x.label.charAt(0).toLowerCase() + x.label.slice(1) +
      ' churned (' + x.n.toLocaleString('en-US') + ' customers). The rest average ' + (x.rOut * 100).toFixed(1) + '%.</div></div>';
    return '<div class="ki-body">' + left + right + '</div>';
  }

  function drawInfluencerChart(vid, el, x, pop, target) {
    const bins = FACTOR_BINS[x.factor];
    const selTest = bins.selected || (v => x.label.endsWith(' is ' + v));
    const vals = bins.values.map(v => { const set = pop.filter(c => bins.get(c) === v); return { v, n: set.length, r: set.length ? set.filter(c => c.churn === target).length / set.length : 0 }; }).filter(b => b.n > 0);
    const c = F.chart(vid + '-ki', el);
    c.setOption({
      animationDuration: 300, textStyle: { fontFamily: F.FONT },
      grid: { left: 46, right: 96, top: 18, bottom: 38 },
      tooltip: Object.assign({}, F.tooltipBase, { trigger: 'item', formatter: p => F.tipHtml('', [[x.factor, vals[p.dataIndex].v],
        ['%Customer churn is ' + target, (vals[p.dataIndex].r * 100).toFixed(1) + '%'], ['Count', vals[p.dataIndex].n]]) }),
      xAxis: F.catAxis(vals.map(b => b.v), { name: x.factor, nameLocation: 'middle', nameGap: 24, axisLabel: Object.assign({}, F.axisLabel, { interval: 0, fontSize: 10 }) }),
      yAxis: F.valueAxis({ name: '%Customer churn is ' + target, nameLocation: 'middle', nameGap: 34, axisLabel: Object.assign({}, F.axisLabel, { formatter: v => Math.round(v * 100) + '%' }) }),
      series: [{ type: 'bar', barMaxWidth: 34, data: vals.map(b => ({ value: b.r, itemStyle: { color: selTest(b.v) ? '#3257A8' : '#B3C3E3' } })),
        label: { show: true, position: 'top', fontSize: 10, color: F.GREY, formatter: p => (p.value * 100).toFixed(1) + '%' },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dotted', color: '#605E5C', width: 1.5 },
          label: { formatter: 'Average (excluding\nselected): ' + (x.rOut * 100).toFixed(1) + '%', position: 'end', fontSize: 10, color: F.GREY, lineHeight: 13 },
          data: [{ yAxis: x.rOut }] } }]
    }, true);
  }

  function segmentPanel(seg, pop, target, s) {
    if (!seg.list.length) return '<div class="ki-empty">No segments found where Customer churn is ' + target + ' above the average of ' + (seg.avg * 100).toFixed(1) + '%.</div>';
    if (s.segSelected !== null && seg.list[s.segSelected]) {
      const x = seg.list[s.segSelected];
      return '<div class="seg-detail"><button class="seg-back">&#8249; Back to all segments</button>' +
        '<div class="seg-d-grid"><div class="seg-d-bubble">' + (x.rate * 100).toFixed(1) + '%</div><div>' +
        '<div class="seg-d-title">Segment ' + (s.segSelected + 1) + '</div>' +
        '<div class="seg-d-line">Customer churn is ' + target + ' ' + (x.rate * 100).toFixed(1) + '% of the time.</div>' +
        '<div class="seg-d-line">This is ' + ((x.rate - seg.avg) * 100).toFixed(1) + ' percentage points higher than the average (' + (seg.avg * 100).toFixed(1) + '%).</div>' +
        '<div class="seg-d-sub">Segment definition</div><ul>' + x.conds.map(cn => '<li>' + cn + '</li>').join('') + '</ul>' +
        '<div class="seg-d-line">' + x.n.toLocaleString('en-US') + ' data points (' + (x.n / pop.length * 100).toFixed(1) + '% of the data)</div>' +
        '<div class="seg-bar"><span style="width:' + (x.rate * 100) + '%"></span><i style="left:' + (seg.avg * 100) + '%"></i></div>' +
        '<div class="seg-bar-l"><span>Segment ' + (x.rate * 100).toFixed(1) + '%</span><span>Average ' + (seg.avg * 100).toFixed(1) + '%</span></div></div></div></div>';
    }
    const maxN = Math.max.apply(null, seg.list.map(x => x.n));
    const lo = Math.floor(seg.avg * 10) / 10, hi = Math.min(1, Math.ceil(Math.max.apply(null, seg.list.map(x => x.rate)) * 10) / 10 + 0.05);
    const yPct = r => 6 + (1 - (r - lo) / (hi - lo)) * 82;
    const ticks = [];
    for (let t = lo; t <= hi + 1e-9; t += 0.1) ticks.push(t);
    const grid = ticks.map(t => '<div class="seg-tick" style="top:' + yPct(t) + '%"><span>' + Math.round(t * 100) + '%</span></div>').join('') +
      '<div class="seg-avg" style="top:' + yPct(seg.avg) + '%"><span>Average ' + (seg.avg * 100).toFixed(1) + '%</span></div>';
    const bubbles = seg.list.map((x, i) => {
      const d = 46 + 40 * Math.sqrt(x.n / maxN);
      const left = 14 + (i + 0.5) * (84 / seg.list.length);
      return '<button class="seg-bubble" data-i="' + i + '" style="width:' + d + 'px;height:' + d + 'px;left:calc(' + left + '% - ' + d / 2 + 'px);top:calc(' + yPct(x.rate) + '% - ' + d / 2 + 'px)" title="Segment ' + (i + 1) + ': ' +
        x.conds.join(' and ') + ', ' + x.n + ' customers">' + (x.rate * 100).toFixed(1) + '%</button>' +
        '<div class="seg-cap" style="left:' + left + '%;top:calc(' + yPct(x.rate) + '% + ' + (d / 2 + 4) + 'px)">Segment ' + (i + 1) + '</div>';
    }).join('');
    return '<div class="seg-wrap"><div class="seg-axis">%Customer churn is ' + target + '</div><div class="seg-plot">' + grid + bubbles + '</div>' +
      '<div class="seg-hint">Bubble size: number of customers in the segment. Vertical position: %Customer churn is ' + target + '. Select a segment to see its definition.</div></div>';
  }

  /* ---------- New versus returning stacked area ---------- */
  function newVsReturning(vid) {
    const def = {
      id: vid, title: 'Orders by customer type, new versus returning', fields: ['channel', 'category'], last: null,
      dax: [M.MEASURES.newOrders.dax, M.MEASURES.returningOrders.dax],
      data() { return { columns: ['Month', 'New customer orders', 'Returning customer orders'], numeric: [false, true, true], rows: def.last }; },
      render(body) {
        const g = M.groupBy(M.rows({ vid }), r => r.m);
        const [a, b] = M.dateRange(S());
        const months = [];
        for (let m = a; m <= b; m++) months.push(m);
        const labels = months.map(m => D.MONTHS[m].short);
        const nw = months.map(m => (g.has(m) ? g.get(m).newOrd : 0));
        const rt = months.map(m => (g.has(m) ? g.get(m).ord - g.get(m).newOrd : 0));
        def.last = labels.map((l, i) => [l, nw[i], rt[i]]);
        const c = F.chart(vid, body);
        const area = (name, data, color) => ({ name, type: 'line', stack: 'orders', data, symbol: 'circle', symbolSize: 4, showSymbol: false,
          lineStyle: { width: 1.5, color }, itemStyle: { color }, areaStyle: { color, opacity: 0.55 } });
        c.setOption({
          animationDuration: 300, textStyle: { fontFamily: F.FONT },
          grid: { left: 50, right: 14, top: 30, bottom: 34 },
          legend: Object.assign({}, F.legendBase, { data: ['New customer orders', 'Returning customer orders'] }),
          tooltip: Object.assign({}, F.tooltipBase, { trigger: 'axis', formatter: ps => F.tipHtml(ps[0].axisValue, ps.map(p => [p.seriesName, M.fmt(p.value, 'int')]).concat([
            ['New customer share', M.fmt(nw[ps[0].dataIndex] / (nw[ps[0].dataIndex] + rt[ps[0].dataIndex] || 1), 'pct')]])) }),
          xAxis: F.catAxis(labels, { boundaryGap: false, name: 'Month', nameLocation: 'middle', nameGap: 22, axisLabel: Object.assign({}, F.axisLabel, { formatter: v => v.replace(' 20', " '") }) }),
          yAxis: F.valueAxis({ name: 'Orders', nameLocation: 'middle', nameGap: 38, axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact(M.fmt(v, 'num')) }) }),
          series: [area('New customer orders', nw, F.THEME[0]), area('Returning customer orders', rt, F.THEME[1])]
        }, true);
        c.off('click');
        c.on('click', p => F.selectPoint(vid, 'ym', labels[p.dataIndex], p.event.event.ctrlKey || p.event.event.metaKey));
        F.bindBlankClear(c, vid);
      }
    };
    return def;
  }

  window.RETENTION = { custCard, cohortMatrix, keyInfluencers, newVsReturning };
})();
