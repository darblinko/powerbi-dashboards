'use strict';
/* Service chrome: pages pane, filters pane, synced slicers. */

function initChrome() {
  $('#btn-insights').addEventListener('click', () => {
    S.sidePane = S.sidePane && S.sidePane.type === 'insights' ? null : { type: 'insights', tab: 'Top' };
    renderSidePane();
  });
  $('#btn-reset').addEventListener('click', () => {
    initFilters(VIS);
    S.selection = null; S.drill = {}; S.sort = {}; S.spotlight = null; S.focus = null; S.tableView = null;
    renderAll();
    toast('Report reset to default.');
  });
  $('#btn-refresh').addEventListener('click', () => { renderAll(); toast('Visuals refreshed.'); });
  $('#btn-pages-collapse').addEventListener('click', () => $('#pages-pane').classList.toggle('collapsed'));
  const fp = $('#filters-pane');
  fp.addEventListener('click', onFiltersClick);
  fp.addEventListener('change', onFiltersChange);
  fp.addEventListener('input', onFiltersInput);
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.menu, .popover, .sl-drop, .slicer, .ctx-menu')) closeMenus();
  });
}

/* ---------- pages pane ---------- */
function renderPagesPane() {
  const list = $('#pages-list');
  list.innerHTML = PAGES.filter(p => !p.hidden).map(p =>
    '<div class="page-item' + (p.id === S.page ? ' active' : '') + '" data-page="' + p.id + '">' + esc(p.name) + '</div>').join('');
  $$('.page-item', list).forEach(el => el.addEventListener('click', () => goToPage(el.dataset.page)));
  const meta = PAGES.find(p => p.id === S.page);
  $('#crumb-page').textContent = meta.name;
}

/* ---------- filters pane ---------- */
function filterLabel(f) { return f.label || FIELD_LABELS[f.field]; }

function filterSummary(f) {
  if (f.kind === 'relative') return f.n > 0 ? 'is in the last ' + f.n + ' ' + f.unit : 'is (All)';
  if (f.kind === 'topn') return f.n > 0 ? 'Top ' + f.n + ' by ' + f.by : 'is (All)';
  if (f.kind === 'drill') return S.drillBatch ? 'is ' + S.drillBatch : 'is (All)';
  if (f.adv) return f.adv.op + ' "' + f.adv.text + '"';
  if (!f.selected.length) return 'is (All)';
  return 'is ' + f.selected.slice(0, 3).join(', ') + (f.selected.length > 3 ? ' and ' + (f.selected.length - 3) + ' more' : '');
}

const ADV_OPS = ['contains', 'does not contain', 'starts with', 'does not start with', 'is', 'is not'];

function basicListHtml(f) {
  const values = (VALUES[f.field] || []).filter(v => !f.search || String(v.value).toLowerCase().includes(f.search.toLowerCase()));
  const all = !f.selected.length;
  let h = '<input class="fc-search" data-fid="' + f.id + '" placeholder="Search" value="' + esc(f.search) + '">';
  h += '<div class="fc-list"><label class="fc-opt"><input type="checkbox" data-fid="' + f.id + '" data-i="-1"' + (all ? ' checked' : '') +
    '><span>Select all</span></label>';
  for (const v of values) {
    const i = VALUES[f.field].indexOf(v);
    h += '<label class="fc-opt"><input type="checkbox" data-fid="' + f.id + '" data-i="' + i + '"' + (f.selected.includes(v.value) ? ' checked' : '') +
      '><span>' + esc(v.value) + '</span><em>' + v.count.toLocaleString('en-US') + '</em></label>';
  }
  return h + '</div>';
}

function advancedHtml(f) {
  const a = f.adv || { op: 'contains', text: '' };
  return '<div class="fc-note">Show items when the value</div><select class="fc-op" data-fid="' + f.id + '">' +
    ADV_OPS.map(o => '<option' + (o === a.op ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<input class="fc-text" data-fid="' + f.id + '" value="' + esc(a.text) + '">' +
    '<button class="fc-apply" data-act="apply-adv" data-fid="' + f.id + '">Apply filter</button>';
}

function cardBodyHtml(f) {
  if (f.kind === 'relative') {
    return '<div class="fc-note">Filter type</div><div class="fc-static">Relative date filtering</div>' +
      '<div class="fc-note">Show items when the value</div><div class="fc-row"><span class="fc-static">is in the last</span>' +
      '<input class="fc-num" type="number" min="0" data-fid="' + f.id + '" value="' + f.n + '"><span class="fc-static">' + f.unit + '</span></div>' +
      '<button class="fc-apply" data-act="apply-num" data-fid="' + f.id + '">Apply filter</button>';
  }
  if (f.kind === 'topn') {
    return '<div class="fc-note">Filter type</div><div class="fc-static">Top N</div><div class="fc-note">Show items</div>' +
      '<div class="fc-row"><span class="fc-static">Top</span><input class="fc-num" type="number" min="0" data-fid="' + f.id + '" value="' + f.n + '"></div>' +
      '<div class="fc-note">By value</div><div class="fc-static fc-well">' + esc(f.by) + '</div>' +
      '<button class="fc-apply" data-act="apply-num" data-fid="' + f.id + '">Apply filter</button>';
  }
  if (f.kind === 'drill') {
    return '<div class="fc-static">' + (S.drillBatch ? esc(S.drillBatch) : 'Drill through from a batch on another page.') + '</div>' +
      '<label class="fc-opt"><input type="checkbox" data-act="keep" ' + (S.keepAllFilters ? 'checked' : '') + '><span>Keep all filters</span></label>';
  }
  const mode = '<select class="fc-mode" data-fid="' + f.id + '"><option value="basic"' + (f.mode === 'basic' ? ' selected' : '') +
    '>Basic filtering</option><option value="advanced"' + (f.mode === 'advanced' ? ' selected' : '') + '>Advanced filtering</option></select>';
  return '<div class="fc-note">Filter type</div>' + mode + (f.mode === 'advanced' ? advancedHtml(f) : basicListHtml(f));
}

function cardHtml(f) {
  const active = filterIsActive(f);
  return '<div class="fcard' + (active ? ' active' : '') + (f.open ? ' open' : '') + '" data-fid="' + f.id + '">' +
    '<div class="fc-head" data-act="toggle" data-fid="' + f.id + '"><div class="fc-titles"><div class="fc-title">' + esc(filterLabel(f)) +
    '</div><div class="fc-sub">' + esc(filterSummary(f)) + '</div></div><div class="fc-tools">' +
    (active && f.kind !== 'drill' ? '<button class="fc-tool" data-act="clear" data-fid="' + f.id + '" title="Clear filter">' + icon('eraser', 13) + '</button>' : '') +
    '<span class="fc-tool">' + icon(f.open ? 'chevronUp' : 'chevronDown', 13) + '</span></div></div>' +
    (f.open ? '<div class="fc-body">' + cardBodyHtml(f) + '</div>' : '') + '</div>';
}

function sectionHtml(title, list, emptyText) {
  return '<div class="fp-section"><div class="fp-sec-title">' + title + '</div>' +
    (list.length ? list.map(cardHtml).join('') : '<div class="fp-empty">' + emptyText + '</div>') + '</div>';
}

function renderFiltersPane() {
  const pane = $('#filters-pane');
  const focusInfo = document.activeElement && document.activeElement.closest && document.activeElement.closest('#filters-pane')
    ? { cls: document.activeElement.className, fid: document.activeElement.dataset.fid } : null;
  pane.classList.toggle('collapsed', S.filtersCollapsed);
  if (S.filtersCollapsed) {
    pane.innerHTML = '<button class="fp-expand" data-act="expand-pane" title="Expand Filters pane">' + icon('chevronDoubleLeft', 14) +
      '<span>Filters</span></button>';
    return;
  }
  const sel = S.selectedVisual && VIS[S.selectedVisual] && VIS[S.selectedVisual].page === S.page ? S.selectedVisual : null;
  let h = '<div class="fp-head"><span>Filters</span><button class="fp-collapse" data-act="collapse-pane" title="Collapse">' +
    icon('chevronDouble', 14) + '</button></div><div class="fp-searchbox">' + icon('search', 13) + '<input placeholder="Search" disabled></div><div class="fp-body">';
  if (sel) h += sectionHtml('Filters on this visual', S.filters.filter(f => f.scope === 'visual' && f.visual === sel), 'No visual-level filters.');
  h += sectionHtml('Filters on this page', S.filters.filter(f => f.scope === 'page' && f.page === S.page), 'No page-level filters.');
  h += sectionHtml('Filters on all pages', S.filters.filter(f => f.scope === 'all'), 'No report-level filters.');
  pane.innerHTML = h + '</div>';
  if (focusInfo && focusInfo.fid && focusInfo.cls) {
    const el = pane.querySelector('.' + focusInfo.cls.split(' ')[0] + '[data-fid="' + focusInfo.fid + '"]');
    if (el) { el.focus(); if (el.setSelectionRange && el.type === 'text') el.setSelectionRange(el.value.length, el.value.length); }
  }
}

const findFilter = id => S.filters.find(f => f.id === id);

function onFiltersClick(e) {
  const t = e.target.closest('[data-act]');
  if (!t) return;
  const f = findFilter(t.dataset.fid);
  const act = t.dataset.act;
  if (act === 'collapse-pane' || act === 'expand-pane') { S.filtersCollapsed = act === 'collapse-pane'; return renderFiltersPane(); }
  if (act === 'toggle' && f) { if (e.target.closest('[data-act="clear"]')) return; f.open = !f.open; return renderFiltersPane(); }
  if (act === 'clear' && f) {
    e.stopPropagation();
    Object.assign(f, { selected: [], adv: null, search: '' });
    if (f.kind === 'relative' || f.kind === 'topn') f.n = 0;
    return renderAll();
  }
  if (act === 'apply-adv' && f) {
    const op = $('.fc-op[data-fid="' + f.id + '"]').value;
    const text = $('.fc-text[data-fid="' + f.id + '"]').value.trim();
    f.adv = text ? { op, text } : null;
    f.selected = [];
    return renderAll();
  }
  if (act === 'apply-num' && f) {
    const n = parseInt($('.fc-num[data-fid="' + f.id + '"]').value, 10);
    f.n = Number.isFinite(n) && n > 0 ? n : 0;
    return renderAll();
  }
}

function onFiltersChange(e) {
  const t = e.target;
  if (t.dataset.act === 'keep') { S.keepAllFilters = t.checked; return; }
  const f = findFilter(t.dataset.fid);
  if (!f) return;
  if (t.classList.contains('fc-mode')) { f.mode = t.value; if (f.mode === 'basic') f.adv = null; return renderAll(); }
  if (t.type === 'checkbox') {
    const i = +t.dataset.i;
    if (i < 0) f.selected = [];
    else {
      const v = VALUES[f.field][i].value;
      f.selected = f.selected.includes(v) ? f.selected.filter(x => x !== v) : [...f.selected, v];
    }
    f.adv = null;
    renderAll();
  }
}

function onFiltersInput(e) {
  const t = e.target;
  if (!t.classList.contains('fc-search')) return;
  const f = findFilter(t.dataset.fid);
  if (f) { f.search = t.value; renderFiltersPane(); }
}

/* ---------- synced slicers (dropdown style) ---------- */
const SLICER_FIELDS = ['site', 'form', 'customer'];

function slicerFilter(field) { return S.filters.find(f => f.scope === 'all' && f.field === field); }

function slicerText(f) {
  if (!f.selected.length) return 'All';
  if (f.selected.length === 1) return f.selected[0];
  return 'Multiple selections';
}

function renderSlicers(container) {
  container.innerHTML = SLICER_FIELDS.map(field =>
    '<div class="slicer" data-field="' + field + '"><div class="sl-head"><span>' + esc(FIELD_LABELS[field]) + '</span>' +
    '<button class="sl-clear" title="Clear selections">' + icon('eraser', 12) + '</button></div>' +
    '<div class="sl-box"><span class="sl-val"></span>' + icon('chevronDown', 12) + '</div></div>').join('');
  $$('.slicer', container).forEach(el => {
    const field = el.dataset.field;
    el.querySelector('.sl-box').addEventListener('click', () => toggleSlicerDrop(el, field));
    el.querySelector('.sl-clear').addEventListener('click', ev => {
      ev.stopPropagation();
      slicerFilter(field).selected = [];
      renderAll();
    });
  });
  refreshSlicers();
}

function refreshSlicers() {
  $$('.slicer').forEach(el => {
    const f = slicerFilter(el.dataset.field);
    el.querySelector('.sl-val').textContent = slicerText(f);
    el.classList.toggle('active', f.selected.length > 0);
  });
  const drop = $('.sl-drop');
  if (drop) fillSlicerDrop(drop, drop.dataset.field);
}

function toggleSlicerDrop(el, field) {
  const existing = $('.sl-drop');
  if (existing) { const same = existing.dataset.field === field; existing.remove(); if (same) return; }
  const drop = document.createElement('div');
  drop.className = 'sl-drop';
  drop.dataset.field = field;
  const page = $('#page');
  const left = el.offsetLeft + el.offsetParent.offsetLeft;
  Object.assign(drop.style, { left: Math.min(left, PAGE_W - 240) + 'px', top: '52px', width: Math.max(el.offsetWidth, 220) + 'px' });
  page.appendChild(drop);
  drop.addEventListener('change', ev => {
    const f = slicerFilter(field);
    const i = +ev.target.dataset.i;
    if (i < 0) f.selected = [];
    else {
      const v = VALUES[field][i].value;
      f.selected = f.selected.includes(v) ? f.selected.filter(x => x !== v) : [...f.selected, v];
    }
    renderAll();
  });
  drop.addEventListener('input', ev => {
    if (!ev.target.classList.contains('sl-search')) return;
    drop.dataset.search = ev.target.value;
    fillSlicerDrop(drop, field);
    const s = drop.querySelector('.sl-search');
    s.focus(); s.setSelectionRange(s.value.length, s.value.length);
  });
  fillSlicerDrop(drop, field);
}

function fillSlicerDrop(drop, field) {
  const f = slicerFilter(field);
  const q = (drop.dataset.search || '').toLowerCase();
  const vals = VALUES[field].map((v, i) => ({ v, i })).filter(x => !q || String(x.v.value).toLowerCase().includes(q));
  drop.innerHTML = (VALUES[field].length > 8 ? '<input class="sl-search" placeholder="Search" value="' + esc(drop.dataset.search || '') + '">' : '') +
    '<div class="sl-list"><label class="sl-opt"><input type="checkbox" data-i="-1"' + (!f.selected.length ? ' checked' : '') + '><span>Select all</span></label>' +
    vals.map(x => '<label class="sl-opt"><input type="checkbox" data-i="' + x.i + '"' + (f.selected.includes(x.v.value) ? ' checked' : '') +
      '><span>' + esc(x.v.value) + '</span></label>').join('') + '</div>';
}
