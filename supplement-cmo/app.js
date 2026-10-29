'use strict';
/* Report runtime: page layout, visual frames, visual header, selection, render loop. */
const PAGE_W = 1280;
const PAGE_H = 720;
const PAGES = [
  { id: 'overview', name: 'Production Overview', subtitle: 'Batch output, yield and the three-week line schedule' },
  { id: 'quality', name: 'Quality and Release', subtitle: 'OOS results, forecast, anomalies and batch disposition' },
  { id: 'customer', name: 'Customer Scorecard', subtitle: 'Revenue, delivery and complaint performance by brand owner' },
  { id: 'batch', name: 'Batch Record', subtitle: 'Drillthrough page', hidden: true }
];
const charts = {};
let builtPage = null;
let zoomMode = 'fit';
let zoomFactor = 1;

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => [...(root || document).querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/* ---------- tooltip and ECharts styling helpers used by visuals ---------- */
const TT = {
  backgroundColor: '#3B3A39', borderWidth: 0, padding: [6, 10], confine: true,
  textStyle: { color: '#FFFFFF', fontSize: 11, fontFamily: FONT },
  extraCssText: 'border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.28);'
};
function ttHtml(rows) {
  return rows.map(([k, v]) => '<div style="display:flex;justify-content:space-between;gap:16px;line-height:18px">' +
    '<span style="color:#C8C6C4">' + esc(k) + '</span><span style="font-weight:600">' + esc(v) + '</span></div>').join('');
}
const AXIS_LABEL = { color: '#605E5C', fontSize: 10, fontFamily: FONT };
const AXIS_NAME = { color: '#605E5C', fontSize: 10, fontFamily: FONT };
const GRID_LINE = { lineStyle: { color: '#EDEBE9', width: 1 } };
const LEGEND = { left: 0, top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 12, textStyle: { color: '#605E5C', fontSize: 10, fontFamily: FONT } };
const isCtrl = p => !!(p && p.event && p.event.event && (p.event.event.ctrlKey || p.event.event.metaKey));
function fade(color, opacity) { return { color, opacity }; }

function chartFor(vid, el) {
  if (!charts[vid] || charts[vid].isDisposed()) {
    charts[vid] = echarts.init(el, null, { renderer: 'canvas' });
    charts[vid].getZr().on('click', e => {
      if (!e.target && S.selection && S.selection.source === vid) setSelection(null);
    });
  }
  return charts[vid];
}

/* ---------- selection (cross-filter and cross-highlight) ---------- */
function setSelection(sel) {
  S.selection = sel;
  renderAll();
}
function select(vid, key, additive) {
  if (!key || !Object.keys(key).length) return;
  const sig = k => JSON.stringify(Object.keys(k).sort().map(f => [f, k[f]]));
  let keys = S.selection && S.selection.source === vid ? S.selection.keys : [];
  const exists = keys.some(k => sig(k) === sig(key));
  if (additive) keys = exists ? keys.filter(k => sig(k) !== sig(key)) : [...keys, key];
  else keys = exists && keys.length === 1 ? [] : [key];
  setSelection(keys.length ? { source: vid, keys } : null);
}
function opacityFor(vid, key) {
  const s = isKeySelected(vid, key);
  return s === null || s ? 1 : 0.4;
}
function partialSelected(vid, key) {
  if (!S.selection || S.selection.source !== vid) return null;
  return S.selection.keys.some(k => Object.keys(key).every(f => k[f] === undefined || k[f] === key[f]));
}

/* ---------- drill ---------- */
function drillAction(vid, action) {
  const d = drillState(vid);
  const max = VIS[vid].hierarchy.length - 1;
  if (action === 'up') {
    if (d.path.length) { d.path = d.path.slice(0, -1); d.level = Math.max(0, d.level - 1); }
    else if (d.level > 0) d.level -= 1;
    if (d.level === 0) d.flat = false;
  } else if (action === 'mode') {
    d.mode = !d.mode;
  } else if (action === 'next' && d.level < max) {
    d.level += 1; d.flat = d.path.length === 0;
  } else if (action === 'expand' && d.level < max) {
    d.level += 1; d.flat = false;
  }
  if (S.selection && S.selection.source === vid) S.selection = null;
  renderAll();
}
function drillInto(vid, value) {
  const d = drillState(vid);
  const levels = VIS[vid].hierarchy;
  if (d.level >= levels.length - 1) return false;
  d.path = [...d.path, { level: levels[d.level], value }];
  d.level += 1; d.flat = false;
  if (S.selection && S.selection.source === vid) S.selection = null;
  renderAll();
  return true;
}
function drillPathLabel(vid) {
  const d = S.drill[vid];
  if (!d || !d.path.length) return '';
  return d.path.map(p => p.value).join(' > ');
}

/* ---------- drillthrough ---------- */
function openDrillthrough(batchId) {
  S.drillReturn = S.page === 'batch' ? S.drillReturn : S.page;
  S.drillBatch = batchId;
  S.filters.find(f => f.kind === 'drill').selected = [batchId];
  goToPage('batch');
}
function goToPage(id) {
  S.page = id;
  S.selection = null; S.focus = null; S.tableView = null; S.selectedVisual = null; S.spotlight = null;
  closeMenus();
  renderAll();
}

/* ---------- frames ---------- */
function headerIcons(v) {
  const btn = (act, ic, title, extra) => '<button class="vh-btn ' + (extra || '') + '" data-act="' + act + '" title="' + title + '">' + icon(ic, 14) + '</button>';
  let h = '';
  if (v.hierarchy) {
    const d = drillState(v.id);
    const max = v.hierarchy.length - 1;
    h += btn('up', 'drillUp', 'Drill up', d.level === 0 && !d.path.length ? 'disabled' : '');
    h += btn('mode', 'drillMode', d.mode ? 'Drill down is on' : 'Click to turn on Drill down', d.mode ? 'on' : '');
    h += btn('next', 'nextLevel', 'Go to the next level in the hierarchy', d.level >= max ? 'disabled' : '');
    h += btn('expand', 'expandAll', 'Expand all down one level in the hierarchy', d.level >= max ? 'disabled' : '');
  }
  h += btn('filters', 'filter', 'Filters and slicers affecting this visual');
  h += btn('focus', 'focus', 'Focus mode');
  h += btn('menu', 'more', 'More options');
  return h;
}

function visualTitle(v) {
  const t = typeof v.title === 'function' ? v.title() : v.title;
  const p = v.hierarchy ? drillPathLabel(v.id) : '';
  return esc(t) + (p ? ' <span class="v-path">' + esc(p) + '</span>' : '');
}

function buildFrame(v) {
  const el = document.createElement('div');
  el.className = 'visual ' + (v.className || '');
  el.dataset.vid = v.id;
  const [x, y, w, h] = v.pos;
  Object.assign(el.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
  el.innerHTML = '<div class="vh">' + (v.noHeader ? '' : headerIcons(v)) + '</div>' +
    (v.hideTitle ? '' : '<div class="v-title">' + visualTitle(v) + '</div>') +
    '<div class="v-body"></div><div class="v-table"></div>';
  el.addEventListener('mousedown', () => selectVisual(v.id));
  el.querySelector('.vh').addEventListener('click', e => {
    const b = e.target.closest('.vh-btn');
    if (!b || b.classList.contains('disabled')) return;
    e.stopPropagation();
    onHeaderAction(v.id, b.dataset.act, b);
  });
  return el;
}

function selectVisual(vid) {
  if (S.selectedVisual === vid) return;
  S.selectedVisual = vid;
  $$('.visual').forEach(f => f.classList.toggle('selected', f.dataset.vid === vid));
  renderFiltersPane();
}

function onHeaderAction(vid, act, btn) {
  if (['up', 'mode', 'next', 'expand'].includes(act)) return drillAction(vid, act);
  if (act === 'focus') { S.focus = S.focus === vid ? null : vid; S.tableView = null; return renderAll(); }
  const r = btn.getBoundingClientRect();
  if (act === 'filters') return showFilterPopover(vid, r);
  if (act === 'menu') return showVisualMenu(vid, r);
}

function pageVisuals() { return Object.values(VIS).filter(v => v.page === S.page); }

function buildPage() {
  Object.keys(charts).forEach(k => { charts[k].dispose(); delete charts[k]; });
  const page = $('#page');
  page.innerHTML = '';
  const meta = PAGES.find(p => p.id === S.page);
  const band = document.createElement('div');
  band.className = 'band';
  band.innerHTML = (S.page === 'batch'
    ? '<button class="back-btn" id="back-btn" title="Back">' + icon('back', 16) + '<span>Back</span></button>'
    : '') + '<div class="band-text"><div class="band-title">' + esc(meta.name) + '</div><div class="band-sub">' +
    esc(meta.subtitle) + ' | Data through 9/27/26</div></div><div class="band-slicers"></div>';
  page.appendChild(band);
  if (S.page === 'batch') band.querySelector('#back-btn').addEventListener('click', () => goToPage(S.drillReturn || 'overview'));
  else renderSlicers(band.querySelector('.band-slicers'));
  for (const v of pageVisuals()) page.appendChild(buildFrame(v));
  const foot = document.createElement('div');
  foot.className = 'page-foot';
  foot.textContent = 'Sample data generated for demonstration. Not drawn from any real system.';
  page.appendChild(foot);
  const back = document.createElement('button');
  back.className = 'focus-back';
  back.innerHTML = icon('chevronLeft', 14) + '<span>Back to report</span>';
  back.addEventListener('click', () => { S.focus = null; S.tableView = null; renderAll(); });
  page.appendChild(back);
  builtPage = S.page;
}

function applyFrameStates() {
  const page = $('#page');
  const focusId = S.focus || S.tableView;
  page.classList.toggle('focus-mode', !!focusId);
  for (const f of $$('.visual', page)) {
    const v = VIS[f.dataset.vid];
    const focused = f.dataset.vid === focusId;
    f.classList.toggle('focused', focused);
    f.classList.toggle('table-mode', S.tableView === v.id);
    f.classList.toggle('dimmed', !!S.spotlight && S.spotlight !== v.id && !focusId);
    f.classList.toggle('selected', S.selectedVisual === v.id);
    const [x, y, w, h] = focused ? [12, 92, PAGE_W - 24, PAGE_H - 116] : v.pos;
    Object.assign(f.style, { left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
    const vh = f.querySelector('.vh');
    if (!v.noHeader) vh.innerHTML = headerIcons(v);
    const t = f.querySelector('.v-title');
    if (t) t.innerHTML = visualTitle(v);
  }
}

function renderVisuals() {
  for (const v of pageVisuals()) {
    const frame = $('.visual[data-vid="' + v.id + '"]');
    if (!frame) continue;
    const body = frame.querySelector('.v-body');
    try {
      v.render(body, v);
      if (charts[v.id]) charts[v.id].resize();
    } catch (err) {
      console.error('Render failed for ' + v.id, err);
      body.innerHTML = '<div class="v-error">This visual could not be displayed.</div>';
    }
    const tbl = frame.querySelector('.v-table');
    tbl.innerHTML = S.tableView === v.id ? dataTableHtml(v) : '';
  }
}

function renderAll() {
  if (builtPage !== S.page) buildPage();
  applyFrameStates();
  renderPagesPane();
  renderFiltersPane();
  refreshSlicers();
  renderVisuals();
  renderSidePane();
}

/* ---------- canvas scaling (Fit to page) ---------- */
function fitPage() {
  const canvas = $('#canvas');
  const wrap = $('#page-wrap');
  const availW = canvas.clientWidth - 32;
  const availH = canvas.clientHeight - 32;
  let scale = zoomMode === 'fit' ? Math.min(availW / PAGE_W, availH / PAGE_H)
    : zoomMode === 'width' ? availW / PAGE_W : zoomFactor;
  scale = Math.max(0.2, scale);
  wrap.style.width = PAGE_W * scale + 'px';
  wrap.style.height = PAGE_H * scale + 'px';
  $('#page').style.transform = 'scale(' + scale + ')';
  $('#zoom-pct').textContent = Math.round(scale * 100) + '%';
  zoomFactor = scale;
}

function initZoom() {
  $('#zoom-select').addEventListener('change', e => { zoomMode = e.target.value; fitPage(); });
  $('#zoom-out').addEventListener('click', () => { zoomMode = 'manual'; zoomFactor = Math.max(0.3, zoomFactor - 0.1); $('#zoom-select').value = 'manual'; fitPage(); });
  $('#zoom-in').addEventListener('click', () => { zoomMode = 'manual'; zoomFactor = Math.min(2, zoomFactor + 0.1); $('#zoom-select').value = 'manual'; fitPage(); });
  new ResizeObserver(fitPage).observe($('#canvas'));
}

function init() {
  initFilters(VIS);
  initChrome();
  initZoom();
  $('#canvas').addEventListener('mousedown', e => {
    if (e.target.id === 'canvas' || e.target.id === 'page-wrap') {
      S.selectedVisual = null;
      if (S.spotlight) { S.spotlight = null; renderAll(); } else { applyFrameStates(); renderFiltersPane(); }
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    closeMenus();
    if (S.focus || S.tableView || S.spotlight) { S.focus = null; S.tableView = null; S.spotlight = null; renderAll(); }
  });
  renderAll();
  fitPage();
}

window.addEventListener('DOMContentLoaded', init);
