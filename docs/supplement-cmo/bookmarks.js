'use strict';
/* Report bookmarks: Bookmarks dropdown, bookmark bar, and state capture applied over a full reset. */

const BOOKMARK_BATCH = 'B25-11532';

/* Each bookmark lists only what differs from the report default; applyBookmark resets everything else first. */
const BOOKMARKS = [
  {
    name: 'Gummy batches, yield decline since 7/13/26',
    page: 'overview',
    slicers: { form: ['Gummy'] }
  },
  {
    name: 'East Plant 2026, batches released and yield by month',
    page: 'overview',
    slicers: { site: ['East Plant'] },
    filters: { 'page:overview:year': { selected: ['2026'] } },
    drill: { combo: { level: 2 } }
  },
  {
    name: 'Insights, trends for all sites',
    page: 'overview',
    sidePane: { type: 'insights', tab: 'Trends' }
  },
  {
    name: 'West Plant OOS anomaly 11/10/25, Tablet press 1 dissolution',
    page: 'quality',
    slicers: { site: ['West Plant'] },
    anomalyWeek: 44
  },
  {
    name: 'Central Plant heavy metals OOS, spike 3/9/26',
    page: 'quality',
    slicers: { site: ['Central Plant'] },
    selection: { source: 'testBar', keys: [{ testType: 'Heavy metals' }] }
  },
  {
    name: 'Open OOS investigations by age',
    page: 'quality',
    filters: { 'visual:oosTable:status': { selected: ['Open'] } },
    sort: { oosTable: { field: 'ageDays', dir: 'desc' } },
    focus: 'oosTable',
    selectedVisual: 'oosTable'
  },
  {
    name: 'Fabrikam Wellness, OTIF decline since 2/2/26',
    page: 'customer',
    selection: { source: 'scatter', keys: [{ customer: 'Fabrikam Wellness' }] }
  },
  {
    name: 'Complaints per M units, Tailspin Kids by product',
    page: 'customer',
    sort: { matrix: { field: 'cpmu', dir: 'desc' } },
    drill: { matrix: { open: ['Tailspin Kids'] } }
  },
  {
    name: 'Strategic tier, revenue against OTIF %',
    page: 'customer',
    filters: { 'page:customer:tier': { selected: ['Strategic'] } },
    spotlight: 'scatter'
  },
  {
    name: 'Batch Record ' + BOOKMARK_BATCH + ', rejected for dissolution OOS',
    page: 'batch',
    drillBatch: BOOKMARK_BATCH,
    drillReturn: 'quality'
  }
];

let activeBookmark = null;
let bookmarkBarOpen = false;

/* Return the report to its default state, the same baseline Power BI restores before applying a bookmark. */
function resetReportState() {
  closeMenus();
  hideTip();
  initFilters(VIS);
  Object.assign(S, {
    page: 'overview',
    selection: null,
    drill: {},
    sort: {},
    spotlight: null,
    focus: null,
    tableView: null,
    selectedVisual: null,
    drillBatch: null,
    drillReturn: 'overview',
    sidePane: null,
    filtersCollapsed: false,
    keepAllFilters: true
  });
}

function applyFilterSpecs(bm) {
  for (const [field, selected] of Object.entries(bm.slicers || {})) slicerFilter(field).selected = selected.slice();
  for (const [id, spec] of Object.entries(bm.filters || {})) {
    const f = findFilter(id);
    if (!f) throw new Error('Bookmark "' + bm.name + '" names an unknown filter ' + id);
    Object.assign(f, spec, { selected: (spec.selected || []).slice(), open: true });
  }
  for (const field of Object.keys(bm.slicers || {})) slicerFilter(field).open = true;
}

function applyDrillSpecs(bm) {
  for (const [vid, spec] of Object.entries(bm.drill || {})) {
    const base = { level: VIS[vid].defaultLevel || 0, path: [], flat: false, mode: false };
    S.drill[vid] = Object.assign(base, spec, { path: (spec.path || []).slice(), open: (spec.open || []).slice() });
  }
}

function anomalyPaneFor(week) {
  const { c, weeks, series } = oosTrendModel();
  const pt = series.find(p => p.week === week);
  if (!pt || !pt.isAnomaly)
    throw new Error('Week ' + week + ' is not detected as an anomaly under the bookmark filters');
  return Object.assign({ type: 'anomaly', explanations: explainAnomaly(c, pt.week, weeks) }, pt);
}

function applyBookmark(index) {
  const bm = BOOKMARKS[index];
  resetReportState();
  applyFilterSpecs(bm);
  applyDrillSpecs(bm);
  S.page = bm.page;
  S.sort = Object.assign({}, bm.sort);
  S.selection = bm.selection
    ? { source: bm.selection.source, keys: bm.selection.keys.map(k => Object.assign({}, k)) }
    : null;
  S.focus = bm.focus || null;
  S.spotlight = bm.spotlight || null;
  S.selectedVisual = bm.selectedVisual || null;
  if (bm.drillBatch) {
    S.drillBatch = bm.drillBatch;
    S.drillReturn = bm.drillReturn;
    Object.assign(
      S.filters.find(f => f.kind === 'drill'),
      { selected: [bm.drillBatch], open: true }
    );
  }
  S.sidePane = bm.sidePane ? Object.assign({}, bm.sidePane) : null;
  if (bm.anomalyWeek !== undefined) {
    try {
      S.sidePane = anomalyPaneFor(bm.anomalyWeek);
    } catch (err) {
      console.error(err);
      toast('The anomaly saved in this bookmark was not found.');
    }
  }
  activeBookmark = index;
  builtPage = null;
  renderAll();
  renderBookmarkBar();
}

/* ---------- Bookmarks dropdown ---------- */
function bookmarkMenuHtml() {
  const items = BOOKMARKS.map(
    (bm, i) =>
      '<div class="menu-item bm-item' +
      (i === activeBookmark ? ' on' : '') +
      '" data-i="' +
      i +
      '">' +
      '<span class="mi-ico">' +
      (i === activeBookmark ? icon('check', 14) : icon('bookmark', 14)) +
      '</span><span class="mi-label" title="' +
      esc(bm.name) +
      '">' +
      esc(bm.name) +
      '</span></div>'
  ).join('');
  return (
    '<div class="menu-head">Report bookmarks</div>' +
    items +
    '<div class="menu-sep"></div>' +
    '<div class="menu-item bm-view" data-act="view"><span class="mi-ico">' +
    (bookmarkBarOpen ? icon('check', 14) : icon('view', 14)) +
    '</span><span class="mi-label">View</span></div>'
  );
}

function showBookmarkMenu(btn) {
  const wasOpen = !!$('.menu.bm-menu');
  closeMenus();
  if (wasOpen) return;
  const m = document.createElement('div');
  m.className = 'menu bm-menu';
  m.innerHTML = bookmarkMenuHtml();
  const r = btn.getBoundingClientRect();
  placeFloating(m, r.right - 380, r.bottom + 2);
  m.addEventListener('mousedown', e => e.stopPropagation());
  m.addEventListener('click', e => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    closeMenus();
    if (item.dataset.act === 'view') return openBookmarkBar();
    applyBookmark(+item.dataset.i);
  });
}

/* ---------- bookmark bar (View) ---------- */
function openBookmarkBar() {
  bookmarkBarOpen = true;
  if (activeBookmark === null) applyBookmark(0);
  else renderBookmarkBar();
}

function closeBookmarkBar() {
  bookmarkBarOpen = false;
  renderBookmarkBar();
}

function stepBookmark(delta) {
  const n = BOOKMARKS.length;
  applyBookmark(((activeBookmark === null ? 0 : activeBookmark) + delta + n) % n);
}

function renderBookmarkBar() {
  let bar = $('#bookmark-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'bookmark-bar';
    bar.className = 'bm-bar';
    $('.canvas-col').insertBefore(bar, $('.statusbar'));
    bar.addEventListener('click', e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      if (b.dataset.act === 'prev') stepBookmark(-1);
      else if (b.dataset.act === 'next') stepBookmark(1);
      else if (b.dataset.act === 'close') closeBookmarkBar();
    });
  }
  bar.classList.toggle('open', bookmarkBarOpen);
  if (!bookmarkBarOpen) {
    bar.innerHTML = '';
    return;
  }
  const i = activeBookmark === null ? 0 : activeBookmark;
  bar.innerHTML =
    '<div class="bm-bar-inner"><span class="bm-name" title="' +
    esc(BOOKMARKS[i].name) +
    '">' +
    esc(BOOKMARKS[i].name) +
    '</span>' +
    '<button class="bm-nav" data-act="prev" title="Previous bookmark">' +
    icon('chevronLeft', 14) +
    '</button>' +
    '<span class="bm-count">' +
    (i + 1) +
    ' of ' +
    BOOKMARKS.length +
    '</span>' +
    '<button class="bm-nav" data-act="next" title="Next bookmark">' +
    icon('chevronRight', 14) +
    '</button>' +
    '<button class="bm-nav bm-close" data-act="close" title="Close">' +
    icon('close', 13) +
    '</button></div>';
}

function initBookmarks() {
  const btn = $('.ac-btn[data-ic="bookmark"]');
  btn.id = 'btn-bookmarks';
  btn.addEventListener('mousedown', e => e.stopPropagation());
  btn.addEventListener('click', () => showBookmarkMenu(btn));
  renderBookmarkBar();
}

window.addEventListener('DOMContentLoaded', initBookmarks);
