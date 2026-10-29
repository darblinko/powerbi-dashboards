/* Filled map drawn as a tile-grid map of the 50 states, with a report page tooltip. */
(function () {
  'use strict';
  const M = window.MODEL, F = window.FRAME, D = window.DATA;
  const COLS = 12, ROWS = 8;
  const LOW = [221, 229, 244], HIGH = [50, 87, 168];

  function shade(t) {
    const c = LOW.map((lo, i) => Math.round(lo + (HIGH[i] - lo) * t));
    return 'rgb(' + c.join(',') + ')';
  }

  function stateMap(vid) {
    const def = {
      id: vid, title: 'Revenue by state', fields: ['state', 'region'], dax: [M.MEASURES.revenue.dax], last: null,
      sortable: null,
      data() {
        return { columns: ['State', 'Region', 'Revenue', 'Orders'], numeric: [false, false, true, true],
          rows: def.last.slice().sort((a, b) => b[2] - a[2]) };
      },
      render(body) {
        const g = M.groupBy(M.rows({ vid }), r => r.st);
        const own = F.ownSelection(vid);
        const vals = D.STATES.map((s, i) => (g.has(i) ? g.get(i).rev : 0));
        const max = Math.max.apply(null, vals) || 1;
        const min = Math.min.apply(null, vals.filter(v => v > 0).concat([max]));
        def.last = D.STATES.map((s, i) => [s.name, s.region, vals[i], g.has(i) ? g.get(i).ord : 0]);
        const w = body.clientWidth || 480, h = body.clientHeight || 250;
        const legendH = 26;
        const cell = Math.min((w - 8) / COLS, (h - legendH - 4) / ROWS);
        const ox = (w - cell * COLS) / 2, oy = 2;
        const gap = Math.max(2, cell * 0.08);
        const tiles = D.STATES.map((s, i) => {
          const x = ox + s.col * cell, y = oy + s.row * cell;
          const t = vals[i] ? Math.sqrt((vals[i] - min) / (max - min || 1)) : 0;
          const dim = own && !own.has(s.name);
          const fill = vals[i] ? shade(t) : '#F3F2F1';
          const txt = t > 0.55 ? '#fff' : '#252423';
          return '<g class="tile-st' + (dim ? ' dim' : '') + (own && own.has(s.name) ? ' sel' : '') + '" data-i="' + i + '">' +
            '<rect x="' + (x + gap / 2) + '" y="' + (y + gap / 2) + '" width="' + (cell - gap) + '" height="' + (cell - gap) + '" rx="2" fill="' + fill + '"/>' +
            '<text x="' + (x + cell / 2) + '" y="' + (y + cell / 2 - (cell > 34 ? 4 : -4)) + '" fill="' + txt + '" font-size="' + Math.max(9, cell * 0.3) + '" text-anchor="middle" font-weight="600">' + s.abbr + '</text>' +
            (cell > 34 ? '<text x="' + (x + cell / 2) + '" y="' + (y + cell / 2 + 10) + '" fill="' + txt + '" font-size="' + Math.max(8, cell * 0.21) + '" text-anchor="middle">' + M.fmt(vals[i], 'cur').replace('.00', '') + '</text>' : '') +
            '</g>';
        }).join('');
        const ly = h - legendH + 6;
        const legend = '<defs><linearGradient id="mapGrad"><stop offset="0" stop-color="' + shade(0) + '"/><stop offset="1" stop-color="' + shade(1) + '"/></linearGradient></defs>' +
          '<text x="4" y="' + (ly + 9) + '" font-size="11" fill="#605E5C">Revenue</text>' +
          '<text x="58" y="' + (ly + 9) + '" font-size="10" fill="#605E5C">' + M.fmt(min, 'cur') + '</text>' +
          '<rect x="100" y="' + ly + '" width="120" height="10" fill="url(#mapGrad)"/>' +
          '<text x="226" y="' + (ly + 9) + '" font-size="10" fill="#605E5C">' + M.fmt(max, 'cur') + '</text>' +
          '<text x="' + (w - 4) + '" y="' + (ly + 9) + '" font-size="10" fill="#A19F9D" text-anchor="end">Hover a state for the State detail tooltip page</text>';
        body.innerHTML = '<svg class="tilemap" width="' + w + '" height="' + h + '">' + legend + tiles + '</svg>';
        bind(body, vid);
      }
    };
    return def;
  }

  function bind(body, vid) {
    const svgEl = body.querySelector('svg');
    svgEl.addEventListener('click', e => {
      const gEl = e.target.closest('.tile-st');
      if (!gEl) { F.clearSelection(vid); return; }
      F.selectPoint(vid, 'state', D.STATES[+gEl.dataset.i].name, e.ctrlKey || e.metaKey);
    });
    svgEl.addEventListener('mousemove', e => {
      const gEl = e.target.closest('.tile-st');
      if (!gEl) { hidePageTip(); return; }
      showPageTip(e, vid, +gEl.dataset.i);
    });
    svgEl.addEventListener('mouseleave', hidePageTip);
  }

  /* Report page tooltip "Tooltip: State detail" (hidden page, 320 x 240). */
  let tipPage = null, tipChart = null, tipState = -1;
  function ensureTipPage() {
    if (tipPage) return;
    tipPage = document.createElement('div');
    tipPage.className = 'page-tooltip';
    tipPage.innerHTML = '<div class="pt-head"><span class="pt-state"></span><span class="pt-region"></span></div>' +
      '<div class="pt-cards"><div><div class="pt-l">Revenue</div><div class="pt-v pt-rev"></div></div>' +
      '<div><div class="pt-l">AOV</div><div class="pt-v pt-aov"></div></div>' +
      '<div><div class="pt-l">Top category</div><div class="pt-v pt-cat"></div></div></div>' +
      '<div class="pt-chart-title">Revenue trend by month</div><div class="pt-chart"></div>' +
      '<div class="pt-foot">Report page tooltip: State detail</div>';
    document.body.appendChild(tipPage);
  }
  function showPageTip(evt, vid, stIdx) {
    ensureTipPage();
    tipPage.style.display = 'block';
    position(evt);
    if (stIdx === tipState) return;
    tipState = stIdx;
    const st = D.STATES[stIdx];
    const list = M.rows({ vid, extra: [r => r.st === stIdx] });
    const t = M.totals(list);
    const byCat = M.groupBy(list, r => D.CATEGORIES[r.cat]);
    let top = '(Blank)', topRev = -1;
    byCat.forEach((v, k) => { if (v.rev > topRev) { topRev = v.rev; top = k; } });
    tipPage.querySelector('.pt-state').textContent = st.name;
    tipPage.querySelector('.pt-region').textContent = st.region + ' region';
    tipPage.querySelector('.pt-rev').textContent = M.fmt(t.rev, 'cur');
    tipPage.querySelector('.pt-aov').textContent = M.fmtMeasure('aov', M.MEASURES.aov.f(t));
    tipPage.querySelector('.pt-cat').textContent = top + (topRev > 0 ? ' (' + M.fmt(topRev / t.rev, 'pct') + ')' : '');
    const g = M.groupBy(list, r => r.m);
    const [a, b] = M.dateRange(M.getState());
    const cats = [], vals = [];
    for (let m = a; m <= b; m++) { cats.push(D.MONTHS[m].short); vals.push(g.has(m) ? g.get(m).rev : 0); }
    const el = tipPage.querySelector('.pt-chart');
    if (!tipChart) tipChart = echarts.init(el);
    tipChart.setOption({
      animation: false, textStyle: { fontFamily: F.FONT },
      grid: { left: 44, right: 10, top: 8, bottom: 22 },
      xAxis: F.catAxis(cats, { axisLabel: Object.assign({}, F.axisLabel, { fontSize: 9, formatter: v => v.slice(0, 3) }) }),
      yAxis: F.valueAxis({ axisLabel: Object.assign({}, F.axisLabel, { fontSize: 9, formatter: v => F.compact(M.fmt(v, 'cur')) }), splitNumber: 3 }),
      series: [{ type: 'line', data: vals, symbol: 'none', smooth: false, lineStyle: { color: F.THEME[0], width: 2 },
        areaStyle: { color: 'rgba(50,87,168,0.12)' } }]
    }, true);
  }
  function position(evt) {
    const w = 320, h = 240;
    let x = evt.clientX + 16, y = evt.clientY + 16;
    if (x + w > window.innerWidth - 6) x = evt.clientX - w - 16;
    if (y + h > window.innerHeight - 6) y = evt.clientY - h - 16;
    tipPage.style.left = Math.max(4, x) + 'px';
    tipPage.style.top = Math.max(4, y) + 'px';
  }
  function hidePageTip() { if (tipPage) tipPage.style.display = 'none'; tipState = -1; }

  window.TILEMAP = { stateMap, hidePageTip };
})();
