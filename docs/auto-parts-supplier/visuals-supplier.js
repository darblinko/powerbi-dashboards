/* Page 3 visuals: scatter chart with a Play axis and trace, supplier scorecard table. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const D = window.PBI_DATA;
  const PBI = window.PBI;
  const cc = PBI.cc;
  const TIERS = ['Tier 2', 'Tier 3', 'Distributor'];
  const TIER_COLOR = { 'Tier 2': cc.COLORS[1], 'Tier 3': cc.COLORS[2], Distributor: cc.COLORS[5] };
  const supplierTier = Object.fromEntries(D.suppliers.map(s => [s.name, s.tier]));

  function seriesByMonth(rows) {
    const out = new Map();
    M.groupBy(rows, 'Supplier').forEach((list, sup) => {
      const g = M.groupBy(list, 'Month');
      out.set(
        sup,
        D.months.map(mo => {
          const r = g.get(mo.idx);
          return r ? { otd: M.MS.otd(r), ppm: M.MS.supplierPpm(r), spend: M.MS.spend(r) } : null;
        })
      );
    });
    return out;
  }

  function ensureHolder(api, v) {
    let holder = api.el.querySelector('.sc-chart');
    if (!holder) {
      if (PBI.charts[v.id]) {
        PBI.charts[v.id].dispose();
        delete PBI.charts[v.id];
      }
      api.el.innerHTML =
        '<div class="sc-chart" style="position:absolute;left:0;right:0;top:0;bottom:44px"></div>' +
        '<div class="playbar"><button class="play-btn" title="Play">' +
        window.PBI_ICON('play', 11) +
        '</button>' +
        '<div class="play-track"><input type="range" min="0" max="11" step="1"><div class="play-ticks">' +
        D.months.map(m => '<span>' + m.short + '</span>').join('') +
        '</div></div><span class="play-label"></span></div>';
      holder = api.el.querySelector('.sc-chart');
      api.el.querySelector('.play-btn').addEventListener('click', ev => {
        ev.stopPropagation();
        PBI.app.togglePlay(v.id);
      });
      const input = api.el.querySelector('input');
      input.addEventListener('input', () => {
        api.S.play.month = +input.value;
        PBI.app.refreshVisual(v.id);
      });
      input.addEventListener('click', ev => ev.stopPropagation());
    }
    let c = PBI.charts[v.id];
    if (!c || c.isDisposed() || c.getDom() !== holder) {
      c = echarts.init(holder, null, { renderer: 'svg' });
      PBI.charts[v.id] = c;
      c.getZr().on('click', e => {
        if (!e.target && api.S.selection[api.page.id]) {
          api.S.selection[api.page.id] = null;
          PBI.app.refresh();
        }
      });
    }
    return c;
  }

  PBI.kinds.playScatter = function (api, v) {
    const S = api.S;
    const sel = S.selection[api.page.id];
    const supSel = sel && sel.field === 'Supplier' ? sel.values : null;
    const rows = api.q('Receipts', { exclude: ['Month', 'Quarter'], sel: !supSel });
    const data = seriesByMonth(rows);
    const chart = ensureHolder(api, v);
    const mi = S.play.month;
    api.el.querySelector('input').value = mi;
    api.el.querySelector('.play-label').textContent = D.months[mi].label;
    api.el.querySelector('.play-btn').innerHTML = window.PBI_ICON(S.play.playing ? 'pause' : 'play', 11);
    let maxPpm = 0,
      minOtd = 1,
      maxSpend = 1;
    data.forEach(arr =>
      arr.forEach(p => {
        if (p) {
          maxPpm = Math.max(maxPpm, p.ppm);
          minOtd = Math.min(minOtd, p.otd);
          maxSpend = Math.max(maxSpend, p.spend);
        }
      })
    );
    const yMax = Math.ceil((maxPpm * 1.08) / 500) * 500 || 500;
    const xMin = Math.floor((minOtd - 0.02) * 50) / 50;
    const size = s => 8 + Math.sqrt(s / maxSpend) * 44;
    const tableRows = [];
    const series = TIERS.map(tier => ({
      id: 'tier-' + tier,
      type: 'scatter',
      name: tier,
      color: TIER_COLOR[tier],
      data: [...data.entries()]
        .filter(([sup, arr]) => supplierTier[sup] === tier && arr[mi])
        .map(([sup, arr]) => {
          const p = arr[mi];
          tableRows.push([sup, tier, D.months[mi].label, p.otd, p.ppm, p.spend]);
          return {
            name: sup,
            value: [p.otd, p.ppm, p.spend],
            symbolSize: size(p.spend),
            itemStyle: { opacity: supSel && !supSel.has(sup) ? 0.18 : 0.85, borderColor: '#FFFFFF', borderWidth: 1 },
            label: {
              show: !!(supSel && supSel.has(sup)) || p.ppm > yMax * 0.45,
              formatter: sup,
              position: 'right',
              fontSize: 10,
              color: '#252423'
            }
          };
        }),
      emphasis: { focus: 'none', itemStyle: { borderColor: '#252423', borderWidth: 1.5 } },
      animationDurationUpdate: 700,
      animationEasingUpdate: 'linear'
    }));
    (supSel ? [...supSel] : []).forEach(sup => {
      const arr = data.get(sup);
      if (!arr) return;
      const pts = [];
      for (let i = 0; i <= mi; i++)
        if (arr[i]) pts.push({ value: [arr[i].otd, arr[i].ppm], name: D.months[i].short, mi: i });
      series.push({
        id: 'trace-' + sup,
        type: 'line',
        name: 'trace',
        data: pts.map(p => ({ value: p.value, name: p.name })),
        silent: true,
        color: TIER_COLOR[supplierTier[sup]],
        lineStyle: { width: 1.5, type: 'solid', opacity: 0.7 },
        symbol: 'circle',
        symbolSize: 6,
        label: { show: true, formatter: e => e.name, position: 'top', fontSize: 9, color: '#605E5C' },
        animation: false,
        z: 1
      });
    });
    chart.setOption(
      cc.base({
        legend: cc.legend('Supplier tier', TIERS),
        graphic: cc.legendTitle('Supplier tier').concat([
          {
            type: 'text',
            right: 26,
            top: 40,
            z: -1,
            silent: true,
            style: { text: D.months[mi].label, fill: '#E1DFDD', font: '600 40px ' + cc.FONT, align: 'right' }
          }
        ]),
        grid: { left: 62, right: 22, top: 32, bottom: 40 },
        tooltip: cc.tooltip({
          trigger: 'item',
          formatter: e =>
            e.seriesName === 'trace'
              ? ''
              : PBI.ttHtml([
                  ['Supplier', e.name],
                  ['Supplier tier', e.seriesName],
                  ['Month', D.months[mi].label],
                  ['On-time delivery %', M.fmt(e.value[0], 'pct')],
                  ['Supplier PPM', M.fmt(e.value[1], 'ppm')],
                  ['Spend', M.fmt(e.value[2], 'cur')]
                ])
        }),
        xAxis: cc.axisVal({
          min: xMin,
          max: 1,
          name: 'On-time delivery %',
          nameLocation: 'middle',
          nameGap: 24,
          axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => (x * 100).toFixed(0) + '%' }
        }),
        yAxis: cc.axisVal({
          min: 0,
          max: yMax,
          name: 'Supplier PPM',
          nameLocation: 'middle',
          nameGap: 44,
          axisLabel: { color: '#605E5C', fontSize: 11, formatter: x => M.compact(x, 0) }
        }),
        series
      }),
      { replaceMerge: ['series'] }
    );
    chart.off('click');
    chart.on('click', e => {
      if (e.seriesType !== 'scatter') return;
      const ne = e.event && e.event.event;
      api.select('Supplier', e.name, !!(ne && (ne.ctrlKey || ne.metaKey)));
    });
    api.setTable(
      [
        { name: 'Supplier' },
        { name: 'Supplier tier' },
        { name: 'Month' },
        { name: 'On-time delivery %', fmt: 'pct' },
        { name: 'Supplier PPM', fmt: 'ppm' },
        { name: 'Spend', fmt: 'curFull' }
      ],
      tableRows
    );
  };

  /* ---------- supplier scorecard with icons and data bars ---------- */
  function ppapIcon(status) {
    if (status === 'Approved') return '<span class="ico circle" style="background:#107C10"></span>';
    if (status === 'Interim') return '<span class="ico tri"></span>';
    if (status === 'Rejected') return '<span class="ico diamond" style="background:#D13438"></span>';
    return '<span class="ico circle" style="background:#A19F9D"></span>';
  }
  function otdIcon(x) {
    if (x === null) return '';
    if (x >= 0.95) return '<span class="ico circle" style="background:#107C10"></span>';
    if (x >= 0.9) return '<span class="ico tri"></span>';
    return '<span class="ico diamond" style="background:#D13438"></span>';
  }
  const score = (otd, ppm) =>
    otd === null || ppm === null ? null : Math.round(otd * 50 + 50 * Math.max(0, 1 - ppm / 1000));
  const COLS = [
    { name: 'Supplier', key: 'sup' },
    { name: 'Tier', key: 'tier' },
    { name: 'PPAP', key: 'ppap' },
    { name: 'OTD %', key: 'otd', fmt: 'pct' },
    { name: 'PPM', key: 'ppm', fmt: 'ppm' },
    { name: 'Spend', key: 'spend', fmt: 'cur' },
    { name: '8Ds', key: 'open', fmt: 'int' },
    { name: 'Score', key: 'score', fmt: 'int' }
  ];

  PBI.kinds.scorecard = function (api, v) {
    const rows = api.q('Receipts');
    const eightD = M.groupBy(api.q('EightD'), 'Supplier');
    const list = [...M.groupBy(rows, 'Supplier').entries()].map(([sup, r]) => {
      const s = D.suppliers.find(x => x.name === sup);
      const otd = M.MS.otd(r),
        ppm = M.MS.supplierPpm(r);
      return {
        sup,
        tier: s.tier,
        ppap: s.ppap,
        otd,
        ppm,
        spend: M.MS.spend(r),
        open: eightD.has(sup) ? M.MS.open8D(eightD.get(sup)) : 0,
        score: score(otd, ppm)
      };
    });
    if (!list.length) {
      api.blank('(Blank)');
      api.setTable([], []);
      return;
    }
    const sort = api.sort() || { by: 'Spend', dir: 'desc' };
    const col = COLS.find(c => c.name === sort.by) || COLS[5];
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) =>
      col.fmt
        ? dir * ((a[col.key] || 0) - (b[col.key] || 0))
        : dir * String(a[col.key]).localeCompare(String(b[col.key]))
    );
    const maxPpm = Math.max(1, ...list.map(x => x.ppm || 0));
    const maxSpend = Math.max(1, ...list.map(x => x.spend || 0));
    const sel = api.selfSel;
    const head = COLS.map(
      c =>
        '<th class="' +
        (c.fmt ? 'num' : '') +
        '" data-c="' +
        c.name +
        '">' +
        c.name +
        (c.name === col.name ? '<span class="sortmark">' + (dir < 0 ? '&#9660;' : '&#9650;') + '</span>' : '') +
        '</th>'
    ).join('');
    const body = list
      .map((x, i) => {
        const faded = sel && !sel.values.has(x.sup);
        return (
          '<tr data-i="' +
          i +
          '" class="' +
          (faded ? 'faded' : '') +
          '"><td>' +
          PBI.esc(x.sup) +
          '</td><td>' +
          x.tier +
          '</td><td>' +
          ppapIcon(x.ppap) +
          x.ppap +
          '</td>' +
          '<td class="num">' +
          otdIcon(x.otd) +
          M.fmt(x.otd, 'pct') +
          '</td>' +
          '<td class="num cellbar"><span class="bar" style="background:#F4B9BE;width:' +
          (((x.ppm || 0) / maxPpm) * 60).toFixed(1) +
          'px"></span><span class="' +
          (x.ppm > 500 ? 'font-bad' : '') +
          '">' +
          M.fmt(x.ppm, 'ppm') +
          '</span></td>' +
          '<td class="num cellbar"><span class="bar blue" style="width:' +
          (((x.spend || 0) / maxSpend) * 64).toFixed(1) +
          'px"></span><span>' +
          M.fmt(x.spend, 'cur') +
          '</span></td>' +
          '<td class="num ' +
          (x.open > 0 ? 'font-bad' : '') +
          '">' +
          x.open +
          '</td>' +
          '<td class="num ' +
          (x.score >= 85 ? 'font-good' : x.score < 70 ? 'font-bad' : '') +
          '">' +
          M.fmt(x.score, 'int') +
          '</td></tr>'
        );
      })
      .join('');
    const tot = {
      otd: M.MS.otd(rows),
      ppm: M.MS.supplierPpm(rows),
      spend: M.MS.spend(rows),
      open: list.reduce((s, x) => s + x.open, 0)
    };
    const foot =
      '<tr><td>Total</td><td></td><td></td><td class="num">' +
      M.fmt(tot.otd, 'pct') +
      '</td><td class="num">' +
      M.fmt(tot.ppm, 'ppm') +
      '</td><td class="num">' +
      M.fmt(tot.spend, 'cur') +
      '</td><td class="num">' +
      tot.open +
      '</td><td class="num">' +
      M.fmt(score(tot.otd, tot.ppm), 'int') +
      '</td></tr>';
    api.el.innerHTML =
      '<div style="position:absolute;inset:0 4px 4px 4px;overflow:auto"><table class="tbl compact"><thead><tr>' +
      head +
      '</tr></thead><tbody>' +
      body +
      '</tbody><tfoot>' +
      foot +
      '</tfoot></table></div>';
    api.el.querySelectorAll('th').forEach(th =>
      th.addEventListener('click', ev => {
        ev.stopPropagation();
        const same = sort.by === th.dataset.c;
        api.S.sort[v.id] = { by: th.dataset.c, dir: same && sort.dir === 'desc' ? 'asc' : 'desc' };
        PBI.app.refresh();
      })
    );
    api.el.querySelectorAll('tbody tr').forEach(tr => {
      const x = list[+tr.dataset.i];
      tr.addEventListener('click', ev => {
        ev.stopPropagation();
        api.select('Supplier', x.sup, ev.ctrlKey || ev.metaKey);
      });
      tr.addEventListener('mousemove', ev =>
        PBI.tipShow(
          PBI.ttHtml([
            ['Supplier', x.sup],
            ['Commodity', D.suppliers.find(s => s.name === x.sup).commodity],
            ['On-time delivery %', M.fmt(x.otd, 'pct')],
            ['Supplier PPM', M.fmt(x.ppm, 'ppm')],
            ['Supplier score', M.fmt(x.score, 'int')]
          ]),
          ev
        )
      );
      tr.addEventListener('mouseleave', PBI.tipHide);
    });
    api.setTable(
      COLS.map(c => ({ name: c.name, fmt: c.fmt === 'cur' ? 'curFull' : c.fmt })),
      list.map(x => COLS.map(c => x[c.key]))
    );
  };
})();
