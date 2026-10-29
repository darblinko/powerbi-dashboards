/* Report runtime: mounts the active page, re-renders visuals on every state change, scales the canvas. */
(function () {
  'use strict';
  const M = window.MODEL,
    F = window.FRAME,
    P = window.PAGES,
    C = window.CHROME;
  const PAGE_W = 1280,
    PAGE_H = 720;
  let mounted = [];
  let signature = '';
  let focusTableEl = null;

  const sig = s => [s.page, s.focus, s.focusTable, s.tableMode].join('|');

  function footer(pageEl) {
    const f = document.createElement('div');
    f.className = 'page-footer';
    f.innerHTML =
      '<span>Sample data generated for demonstration. Not drawn from any real system.</span>' +
      '<span>Tables: Sales (8,100 rows), Customers (9,000 rows), Date, Product, Channel, Device, Geography</span>';
    pageEl.appendChild(f);
  }

  function build() {
    const s = M.getState();
    const pageEl = document.getElementById('page');
    F.disposeAll();
    F.hideTip();
    window.TILEMAP.hidePageTip();
    pageEl.innerHTML = '';
    mounted = [];
    focusTableEl = null;
    const page = P.PAGES.find(p => p.id === s.page) || P.PAGES[0];
    const items = page.build();
    const focusItem = s.focus ? items.find(it => it[0].id === s.focus) : null;
    if (focusItem) buildFocus(pageEl, focusItem[0], s);
    else
      items.forEach(([def, x, y, w, h]) => {
        if (def.hiddenWhen && def.hiddenWhen()) return;
        mounted.push(Object.assign({ def }, F.mount(def, pageEl, { x, y, w, h })));
      });
    footer(pageEl);
    signature = sig(s);
  }

  function buildFocus(pageEl, def, s) {
    const back = document.createElement('button');
    back.className = 'focus-back';
    back.innerHTML =
      '<svg viewBox="0 0 16 16" width="14" height="14"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg><span>Back to report</span>';
    back.addEventListener('click', () => M.setState({ focus: null, focusTable: false }));
    pageEl.appendChild(back);
    const h = s.focusTable ? 330 : 652;
    mounted.push(Object.assign({ def }, F.mount(def, pageEl, { x: 8, y: 40, w: 1264, h })));
    if (s.focusTable) {
      focusTableEl = document.createElement('div');
      focusTableEl.className = 'visual vt-table focus-table';
      Object.assign(focusTableEl.style, { left: '8px', top: '378px', width: '1264px', height: '314px' });
      pageEl.appendChild(focusTableEl);
    }
  }

  function renderFocusTable() {
    if (!focusTableEl || !mounted[0]) return;
    const d = mounted[0].def.data();
    const display = v =>
      typeof v === 'number'
        ? Number.isInteger(v)
          ? v.toLocaleString('en-US')
          : v.toLocaleString('en-US', { maximumFractionDigits: 4 })
        : v;
    focusTableEl.innerHTML =
      '<div class="vtitle">Data in this visual (' +
      d.rows.length +
      ' rows)</div><div class="vbody table-scroll">' +
      F.tableHtml({ columns: d.columns, numeric: d.numeric, rows: d.rows, display }) +
      '</div>';
  }

  function renderAll() {
    mounted.forEach(m => {
      try {
        m.def.render(m.body, m.def);
      } catch (err) {
        console.error('Render failed for visual ' + m.def.id, err);
      }
      F.refreshHeader(m.def);
    });
    renderFocusTable();
    applyUi();
  }

  function applyUi() {
    const s = M.getState();
    document.querySelectorAll('#page .visual').forEach(el => {
      el.classList.toggle('spot-dim', !!s.spotlight && el.dataset.vid !== s.spotlight && !!el.dataset.vid);
      el.classList.toggle('selected', el.dataset.vid === s.selectedVisual);
    });
    const bm = document.querySelector('#act-bm span');
    if (bm) bm.textContent = s.bookmark ? 'Bookmarks: ' + s.bookmark : 'Bookmarks';
    window.BOOKMARKS.renderBar();
  }

  function onChange(s, meta) {
    if (meta.uiOnly) {
      applyUi();
      C.renderFilters();
      return;
    }
    if (meta.rebuild || sig(s) !== signature) build();
    renderAll();
    C.renderPages();
    C.renderFilters();
  }

  function fit() {
    const wrap = document.getElementById('canvasWrap');
    const holder = document.getElementById('pageHolder');
    const page = document.getElementById('page');
    const availW = wrap.clientWidth - 24,
      availH = wrap.clientHeight - 24;
    const view = C.ui.view;
    const scale =
      view === 'actual' ? 1 : view === 'width' ? availW / PAGE_W : Math.min(availW / PAGE_W, availH / PAGE_H);
    holder.style.width = PAGE_W * scale + 'px';
    holder.style.height = PAGE_H * scale + 'px';
    page.style.transform = 'scale(' + scale + ')';
    const z = document.getElementById('zoomPct');
    if (z) z.textContent = Math.round(scale * 100) + '%';
  }

  function bindCanvas() {
    document.getElementById('canvasWrap').addEventListener('click', e => {
      const path = e.composedPath();
      if (path.some(n => n.classList && (n.classList.contains('visual') || n.classList.contains('focus-back')))) return;
      const s = M.getState();
      if (s.selection || s.selectedVisual) M.setState({ selection: null, selectedVisual: null });
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && M.getState().focus) M.setState({ focus: null, focusTable: false });
    });
    document.getElementById('zoomFit').addEventListener('click', () => {
      C.ui.view = 'fit';
      fit();
    });
    window.addEventListener('resize', fit);
  }

  function start() {
    if (typeof echarts === 'undefined') {
      document.getElementById('page').innerHTML =
        '<div class="load-error">ECharts could not be loaded from cdnjs.cloudflare.com. Charts require network access to the CDN.</div>';
      return;
    }
    C.init();
    bindCanvas();
    M.onChange(onChange);
    fit();
    build();
    renderAll();
  }

  window.APP = { fit, start };
  document.addEventListener('DOMContentLoaded', start);
})();
