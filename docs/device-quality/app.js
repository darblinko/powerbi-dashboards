/* app.js: report state, filter context assembly, selection, navigation. Bookmarks are in bookmarks.js. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const M = PBI.model;
  const MI = D.MONTHS;
  PBI.pageOrder = ['overview', 'trending', 'capa', 'detail'];

  function allVisuals() {
    return [].concat(...PBI.pageOrder.map(p => PBI.pages[p].visuals));
  }
  function initialState(prev) {
    const drill = {};
    allVisuals()
      .filter(v => v.hierarchy)
      .forEach(v => {
        drill[v.id] = { level: 0, path: [], mode: false, expanded: false };
      });
    drill.colDate = { level: 1, path: [], mode: false, expanded: true };
    return {
      page: 'overview',
      prevPage: null,
      slicers: { from: 0, to: MI.length - 1, products: new Set(), regions: new Set() },
      pageFilters: { overview: {}, trending: {}, capa: {}, detail: {} },
      allFilters: {},
      visualFilters: {},
      selection: null,
      selectedVisual: null,
      drill,
      sort: {},
      expand: {},
      drillthrough: null,
      focus: null,
      spotlight: null,
      filtersOpen: prev ? prev.filtersOpen : true,
      pagesOpen: prev ? prev.pagesOpen : true,
      fexpanded: new Set(),
      view: prev ? prev.view : 'fit',
      decomp: { levels: ['source', 'rootCause'], picks: ['Complaint'], ai: [] }
    };
  }

  function push(out, field, f, src) {
    const test = M.predicate(f);
    if (test) out.push({ field, test, src, text: M.describe(f) });
  }
  function ctxFor(vid, opts) {
    const S = PBI.S;
    const o = opts || {};
    const out = [];
    const sl = S.slicers;
    out.push({
      field: 'month',
      test: m => m >= sl.from && m <= sl.to,
      src: 'Slicer: Received Date',
      text: 'is between ' + D.fmtDay(MI[sl.from].first) + ' and ' + D.fmtDay(MI[sl.to].last),
      slicer: sl.from > 0 || sl.to < MI.length - 1
    });
    push(out, 'product', { type: 'basic', values: sl.products }, 'Slicer: Product');
    push(out, 'region', { type: 'basic', values: sl.regions }, 'Slicer: Region');
    Object.keys(S.allFilters).forEach(k => push(out, k, S.allFilters[k], 'Filters on all pages'));
    const pageKey = S.page === 'detail' ? S.prevPage : S.page;
    const pf = S.pageFilters[pageKey] || {};
    Object.keys(pf).forEach(k =>
      push(out, k, pf[k], S.page === 'detail' ? 'Source page filter (kept)' : 'Filters on this page')
    );
    const vf = S.visualFilters[vid] || {};
    Object.keys(vf).forEach(k => push(out, k, vf[k], 'Filters on this visual'));
    if (S.page === 'detail' && S.drillthrough) {
      const d = S.drillthrough;
      out.push({ field: d.field, test: v => v === d.value, src: 'Drillthrough', text: 'is ' + d.value });
    }
    const dr = S.drill[vid];
    if (dr)
      dr.path.forEach(p =>
        out.push({ field: p.field, test: v => v === p.value, src: 'Drill down', text: 'is ' + p.value })
      );
    const sel = S.selection;
    if (o.withSelection !== false && sel && sel.page === S.page && sel.visualId !== vid) {
      const title = (PBI.pages[S.page].visuals.find(v => v.id === sel.visualId) || {}).title || 'visual';
      sel.filters.forEach(f =>
        out.push({
          field: f.field,
          test: v => f.values.has(v),
          src: 'Cross-filter from ' + title,
          text: 'is ' + [...f.values].join(', ')
        })
      );
    }
    out.asOf = MI[sl.to].last;
    return out;
  }
  function filtersAffecting(vid) {
    return ctxFor(vid)
      .filter(c => c.field !== 'month' || c.slicer)
      .map(c => ({ field: M.FIELDS[c.field].label, text: c.text, src: c.src }));
  }

  function sameFilters(sel, filters) {
    return (
      sel.filters.length === filters.length &&
      filters.every(f => sel.filters.some(s => s.field === f.field && s.values.size === 1 && s.values.has(f.value)))
    );
  }
  function select(vid, filters, multi) {
    const S = PBI.S;
    const cur = S.selection && S.selection.page === S.page && S.selection.visualId === vid ? S.selection : null;
    const fresh = () => ({
      page: S.page,
      visualId: vid,
      filters: filters.map(f => ({ field: f.field, values: new Set([f.value]) }))
    });
    if (cur && filters.length === 1 && cur.filters.length === 1 && cur.filters[0].field === filters[0].field) {
      const set = new Set(cur.filters[0].values);
      const v = filters[0].value;
      if (multi) {
        set.has(v) ? set.delete(v) : set.add(v);
        S.selection = set.size
          ? { page: S.page, visualId: vid, filters: [{ field: filters[0].field, values: set }] }
          : null;
      } else {
        S.selection = set.size === 1 && set.has(v) ? null : fresh();
      }
    } else if (cur && sameFilters(cur, filters)) {
      S.selection = null;
    } else {
      S.selection = fresh();
    }
    update();
  }
  function clearSelection() {
    const S = PBI.S;
    if (S.selection || S.spotlight) {
      S.selection = null;
      S.spotlight = null;
      update();
    }
  }

  function pageEl() {
    return document.getElementById('page');
  }
  function markSelected() {
    const S = PBI.S;
    pageEl()
      .querySelectorAll('.visual')
      .forEach(c => {
        c.classList.toggle('selected', c.dataset.vid === S.selectedVisual);
        c.classList.toggle('spot', c.dataset.vid === S.spotlight);
      });
    pageEl().classList.toggle('spotlit', !!S.spotlight);
  }
  function update() {
    const S = PBI.S;
    M.asOf = MI[S.slicers.to].last;
    PBI.frame.renderAll(pageEl(), PBI.pages[S.page]);
    markSelected();
    PBI.filters.render();
    PBI.tooltipPage.reset();
  }
  function rebuild() {
    const S = PBI.S;
    PBI.frame.buildPage(pageEl(), PBI.pages[S.page]);
    PBI.shell.fit();
    update();
  }
  function clearTransient() {
    const S = PBI.S;
    S.selection = null;
    S.selectedVisual = null;
    S.focus = null;
    S.spotlight = null;
    PBI.tooltipPage.hide();
    PBI.frame.closeMenus();
  }
  function goPage(id) {
    const S = PBI.S;
    if (id !== 'detail') S.drillthrough = null;
    S.page = id;
    clearTransient();
    PBI.shell.renderPagesPane();
    rebuild();
  }
  function drillthrough(field, value) {
    const S = PBI.S;
    if (S.page !== 'detail') S.prevPage = S.page;
    S.drillthrough = { field, value };
    S.page = 'detail';
    clearTransient();
    PBI.shell.renderPagesPane();
    rebuild();
  }
  function back() {
    goPage(PBI.S.prevPage || 'overview');
  }
  function reset() {
    PBI.S = initialState(PBI.S);
    PBI.shell.renderPagesPane();
    rebuild();
  }

  function init() {
    PBI.S = initialState(null);
    PBI.shell.init();
    PBI.shell.renderPagesPane();
    document.getElementById('canvaswrap').addEventListener('mousedown', e => {
      if (e.target.closest('.visual') || e.target.closest('.focus-back')) return;
      const S = PBI.S;
      if (S.selection || S.spotlight || S.selectedVisual) {
        S.selection = null;
        S.spotlight = null;
        S.selectedVisual = null;
        update();
      }
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && (PBI.S.spotlight || PBI.S.focus)) {
        PBI.S.spotlight = null;
        if (PBI.S.focus) {
          PBI.S.focus = null;
          rebuild();
        } else update();
      }
    });
    rebuild();
  }

  PBI.app = {
    ctxFor,
    filtersAffecting,
    select,
    clearSelection,
    update,
    rebuild,
    goPage,
    drillthrough,
    back,
    reset,
    initialState,
    markSelected
  };
  if (typeof echarts === 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
      document.getElementById('page').innerHTML =
        '<div class="vis-error">ECharts could not be loaded from cdnjs.cloudflare.com. Charts need network access.</div>';
    });
    return;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
