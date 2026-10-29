/* Power BI Service chrome: app bar, left rail, action bar, pages pane, filters pane, bookmarks, view. */
(function () {
  'use strict';
  const M = window.MODEL, F = window.FRAME, P = window.PAGES, D = window.DATA;
  const S = () => M.getState();
  const ui = { expanded: new Set(), filtersOpen: true, pagesOpen: true, view: 'fit', search: '' };

  const I = {
    waffle: '<svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">' + [2, 7, 12].map(x => [2, 7, 12].map(y => '<rect x="' + x + '" y="' + y + '" width="2.4" height="2.4"/>').join('')).join('') + '</svg>',
    search: '<svg viewBox="0 0 16 16" width="14" height="14"><circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.4 10.4L14 14" stroke="currentColor" stroke-width="1.3"/></svg>',
    bell: '<path d="M4 11V7a4 4 0 018 0v4l1.2 1.5H2.8zM6.5 14h3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    gear: '<circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.2"/>',
    download: '<path d="M8 2v8M4.5 6.8L8 10.3l3.5-3.5M3 13.5h10" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    help: '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6.2 6.2a1.9 1.9 0 113 1.5c-.8.5-1.2.9-1.2 1.8M8 11.6v.4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    home: '<path d="M2.5 7.5L8 3l5.5 4.5V13H9.8V9.6H6.2V13H2.5z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    create: '<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v6M5 8h6" stroke="currentColor" stroke-width="1.2"/>',
    browse: '<path d="M2 3.5h4.5l1.5 1.5H14V13H2z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    onelake: '<path d="M8 2c2.5 3 4 5 4 7a4 4 0 01-8 0c0-2 1.5-4 4-7z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    apps: '<rect x="2.5" y="2.5" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="2.5" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2.5" y="9" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="9" y="9" width="4.5" height="4.5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    workspaces: '<rect x="2" y="4" width="12" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 4V2.5h5V4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    file: '<path d="M4 2h5l3 3v9H4z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    export: '<path d="M8 10V2M4.5 5.5L8 2l3.5 3.5M3 10v3.5h10V10" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    share: '<path d="M10 3l4 3.5-4 3.5V8C6 8 4 9.5 3 12.5 3 8 5.5 5.5 10 5z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    teams: '<rect x="2" y="4" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M4.5 6.5h3M6 6.5v4M11.5 6.5h2.5v4a1.5 1.5 0 01-2.5 1" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    insights: '<path d="M8 2a4 4 0 00-2.4 7.2V11h4.8V9.2A4 4 0 008 2zM6 13.5h4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    subscribe: '<rect x="2" y="3.5" width="12" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 4l6 5 6-5" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    edit: '<path d="M3 13l.6-2.6L10.5 3.5l2 2-6.9 6.9z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    reset: '<path d="M3.5 8a4.5 4.5 0 104.5-4.5H5M5 1.5v2h2" fill="none" stroke="currentColor" stroke-width="1.2" transform="translate(0 1)"/>',
    bookmark: '<path d="M4.5 2h7v12L8 11l-3.5 3z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    view: '<rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2 6h12" stroke="currentColor" stroke-width="1.2"/>',
    refresh: '<path d="M13 8a5 5 0 11-1.5-3.5M12 2v3h-3" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    chevDown: '<path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    chevRight: '<path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    collapse: '<path d="M4 4l4 4-4 4M8 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    expandL: '<path d="M12 4L8 8l4 4M8 4L4 8l4 4" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    eraser: '<path d="M6 13h7M3 10l5.5-5.5 3 3L7 12H5z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    star: '<path d="M8 2l1.8 3.8 4.2.5-3.1 2.9.8 4.1L8 11.3l-3.7 2 .8-4.1L2 6.3l4.2-.5z" fill="none" stroke="currentColor" stroke-width="1.1"/>'
  };
  const ic = (k, s) => (I[k].startsWith('<svg') ? I[k] : '<svg viewBox="0 0 16 16" width="' + (s || 16) + '" height="' + (s || 16) + '" aria-hidden="true">' + I[k] + '</svg>');

  function buildAppBar() {
    document.getElementById('appbar').innerHTML =
      '<button class="ab-waffle" aria-label="App launcher">' + ic('waffle') + '</button><span class="ab-brand">Power BI</span>' +
      '<span class="ab-crumb"><a>Sales Analytics</a><span class="ab-sep">&#8250;</span><span>E-Commerce Performance</span>' +
      '<span class="ab-sens">General</span></span>' +
      '<div class="ab-search">' + ic('search', 14) + '<input placeholder="Search" aria-label="Search"></div>' +
      '<div class="ab-right"><span class="ab-trial">Trial: 54 days left</span>' + ['bell', 'gear', 'download', 'help'].map(k => '<button class="ab-icon" aria-label="' + k + '">' + ic(k) + '</button>').join('') +
      '<span class="ab-avatar">SA</span></div>';
  }
  function buildRail() {
    const items = [['home', 'Home'], ['create', 'Create'], ['browse', 'Browse'], ['onelake', 'OneLake'], ['apps', 'Apps'], ['workspaces', 'Workspaces']];
    document.getElementById('rail').innerHTML = items.map(([k, l]) => '<button class="rail-item"><span>' + ic(k, 20) + '</span><span class="rail-l">' + l + '</span></button>').join('') +
      '<div class="rail-sep"></div><button class="rail-item active"><span>' + ic('workspaces', 20) + '</span><span class="rail-l">Sales Analytics</span></button>';
  }

  function buildActionBar() {
    const bar = document.getElementById('actionbar');
    const btn = (k, label, id, caret) => '<button class="act" id="' + id + '">' + ic(k, 15) + '<span>' + label + '</span>' + (caret ? ic('chevDown', 10) : '') + '</button>';
    bar.innerHTML = btn('file', 'File', 'act-file', true) + btn('export', 'Export', 'act-export', true) + btn('share', 'Share', 'act-share') +
      btn('teams', 'Chat in Teams', 'act-teams') + btn('insights', 'Get insights', 'act-insights') + btn('subscribe', 'Subscribe', 'act-sub') +
      btn('edit', 'Edit', 'act-edit') + '<span class="act-div"></span>' + btn('reset', 'Reset to default', 'act-reset') +
      btn('bookmark', 'Bookmarks', 'act-bm', true) + btn('view', 'View', 'act-view', true) + btn('refresh', 'Refresh visuals', 'act-refresh') +
      '<span class="act-spacer"></span><span class="act-updated">Data updated 10/1/26</span><button class="act act-star" aria-label="Favorite">' + ic('star', 15) + '</button>';
    const on = (id, fn) => document.getElementById(id).addEventListener('click', e => { e.stopPropagation(); fn(e.currentTarget); });
    on('act-file', el => F.openMenu(el, [{ label: 'Save a copy', action: () => F.toast('Save a copy is not available in this demonstration.') },
      { label: 'Print this page', action: () => window.print() }, { label: 'Download this file', action: () => F.toast('Download this file is not available in this demonstration.') }], { alignLeft: true }));
    on('act-export', el => F.openMenu(el, ['Analyze in Excel', 'PowerPoint', 'PDF'].map(l => ({ label: l, action: () => F.toast('Export to ' + l + ' is not available in this demonstration. Use Export data in a visual menu.') })), { alignLeft: true }));
    ['act-share', 'act-teams', 'act-sub', 'act-edit'].forEach(id => on(id, el => F.toast(el.textContent.trim() + ' is not available in this demonstration.')));
    on('act-insights', showInsights);
    on('act-reset', () => { M.resetState(); F.toast('Report reset to the default view set by the author.'); });
    on('act-bm', el => F.openMenu(el, window.BOOKMARKS.menuItems(), { alignLeft: true, cls: 'bm-menu' }));
    on('act-view', el => F.openMenu(el, [['fit', 'Fit to page'], ['width', 'Fit to width'], ['actual', 'Actual size']].map(([k, l]) => ({ label: l, checked: ui.view === k,
      action: () => { ui.view = k; window.APP.fit(); } })).concat(['-', { label: 'Filters pane', checked: ui.filtersOpen, action: () => { ui.filtersOpen = !ui.filtersOpen; renderFilters(); window.APP.fit(); } }]), { alignLeft: true }));
    on('act-refresh', () => { M.setState({}, { rebuild: true }); F.toast('Visuals refreshed.'); });
  }

  function showInsights() {
    const sales = D.SALES;
    const sum = (pred, key) => sales.reduce((s, r) => (pred(r) ? s + r[key] : s), 0);
    const paidJun = sum(r => r.ch === 1 && r.m === 20, 'rev');
    const paidAround = (sum(r => r.ch === 1 && (r.m === 18 || r.m === 19 || r.m === 21), 'rev')) / 3;
    const rr = m => sum(r => r.cat === 2 && r.m === m, 'ret') / sum(r => r.cat === 2 && r.m === m, 'ord');
    const rrBase = sum(r => r.cat === 2 && r.m >= 24 && r.m <= 27, 'ret') / sum(r => r.cat === 2 && r.m >= 24 && r.m <= 27, 'ord');
    const tx = m => sum(r => D.STATES[r.st].abbr === 'TX' && r.m === m, 'rev');
    const items = [
      ['Anomaly', 'Paid search revenue in Jun 2025 was ' + M.fmt(paidJun, 'cur') + ', ' + ((1 - paidJun / paidAround) * 100).toFixed(0) + '% below the average of the surrounding three months (' + M.fmt(paidAround, 'cur') + ').'],
      ['Anomaly', 'Electronics return rate was ' + M.fmt(rr(28), 'pct') + ' in Feb 2026 and ' + M.fmt(rr(29), 'pct') + ' in Mar 2026, against ' + M.fmt(rrBase, 'pct') + ' for Oct 2025 to Jan 2026.'],
      ['Anomaly', 'Texas revenue in Aug 2026 was ' + M.fmt(tx(34), 'cur') + ', ' + (tx(34) / tx(33)).toFixed(2) + 'x the Jul 2026 value of ' + M.fmt(tx(33), 'cur') + '.'],
      ['Seasonality', 'November and December carry the highest revenue in each year of data; December is 1.6x the monthly average.']
    ];
    F.dialog('Get insights', '<p class="dlg-note">Insights computed from the Sales table across all dates, ignoring report filters.</p>' +
      items.map(i => '<div class="ins-row"><span class="ins-tag">' + i[0] + '</span><span>' + i[1] + '</span></div>').join(''));
  }

  /* ---------- Pages pane ---------- */
  function renderPages() {
    const el = document.getElementById('pagesPane');
    el.className = ui.pagesOpen ? 'open' : 'closed';
    if (!ui.pagesOpen) {
      el.innerHTML = '<button class="pp-toggle" aria-label="Expand pages pane">' + ic('collapse', 14) + '</button>';
    } else {
      el.innerHTML = '<div class="pp-head"><span>Pages</span><button class="pp-toggle" aria-label="Collapse pages pane">' + ic('expandL', 14) + '</button></div>' +
        P.PAGES.filter(p => !p.hidden).map(p => '<button class="pp-item' + (S().page === p.id ? ' active' : '') + '" data-p="' + p.id + '">' + p.name + '</button>').join('');
      el.querySelectorAll('.pp-item').forEach(b => b.addEventListener('click', () => M.setState({ page: b.dataset.p, selection: null, focus: null, spotlight: null, selectedVisual: null })));
    }
    el.querySelector('.pp-toggle').addEventListener('click', () => { ui.pagesOpen = !ui.pagesOpen; renderPages(); window.APP.fit(); });
  }

  /* ---------- Filters pane ---------- */
  function renderFilters() {
    const el = document.getElementById('filtersPane');
    el.className = ui.filtersOpen ? 'open' : 'closed';
    if (!ui.filtersOpen) {
      el.innerHTML = '<button class="fp-toggle" aria-label="Expand filters pane">' + ic('expandL', 14) + '</button><div class="fp-vert">Filters</div>';
      el.querySelector('.fp-toggle').addEventListener('click', () => { ui.filtersOpen = true; renderFilters(); window.APP.fit(); });
      return;
    }
    const s = S();
    const vdef = s.selectedVisual && F.registry[s.selectedVisual] && document.getElementById('v-' + s.selectedVisual) ? F.registry[s.selectedVisual] : null;
    let html = '<div class="fp-head"><span>Filters</span><button class="fp-toggle" aria-label="Collapse filters pane">' + ic('collapse', 14) + '</button></div>' +
      '<div class="fp-search">' + ic('search', 12) + '<input placeholder="Search" value="' + F.escapeHtml(ui.search) + '" aria-label="Search filters"></div><div class="fp-scroll">';
    if (vdef && vdef.fields && vdef.fields.length) {
      html += '<div class="fp-sec">Filters on this visual</div>';
      html += vdef.fields.map(f => card('visual', f, (s.visualFilters[vdef.id] || {})[f] || M.basic(), vdef.id)).join('');
      (vdef.dax || []).slice(0, 1).forEach(d => { html += '<div class="fcard measure"><div class="fc-head"><div><div class="fc-name">' + F.escapeHtml(d.split(' =')[0]) + '</div><div class="fc-val">is (All)</div></div></div></div>'; });
    }
    html += '<div class="fp-sec">Filters on this page</div>' + Object.keys(s.filters[s.page] || {}).map(f => card(s.page, f, s.filters[s.page][f])).join('');
    html += '<div class="fp-sec">Filters on all pages</div>' + Object.keys(s.filters.all).map(f => card('all', f, s.filters.all[f])).join('');
    html += '</div>';
    el.innerHTML = html;
    bindFilters(el);
  }

  function card(scope, field, f, vid) {
    const fd = M.FIELDS[field];
    if (ui.search && !fd.label.toLowerCase().includes(ui.search.toLowerCase())) return '';
    const key = scope + ':' + field + ':' + (vid || '');
    const open = ui.expanded.has(key);
    const txt = F.filterText(f) || 'is (All)';
    const active = txt !== 'is (All)';
    let body = '';
    if (open) {
      body = '<div class="fc-body"><label class="fc-l">Filter type</label><select class="pbi-select fc-type"><option value="basic">Basic filtering</option><option value="advanced"' +
        (f.mode === 'advanced' ? ' selected' : '') + '>Advanced filtering</option></select>';
      if (f.mode === 'advanced') {
        body += '<label class="fc-l">Show items when the value</label><select class="pbi-select fc-op">' +
          ['contains', 'does not contain', 'starts with', 'is', 'is not'].map(o => '<option' + (f.op === o ? ' selected' : '') + '>' + o + '</option>').join('') +
          '</select><input class="pbi-input fc-text" value="' + F.escapeHtml(f.text || '') + '"><button class="btn-apply">Apply filter</button>';
      } else {
        const vals = fd.values;
        const all = !f.values.length;
        body += '<div class="fc-list"><label class="fc-item"><input type="checkbox" data-all="1"' + (all ? ' checked' : '') + '><span>Select all</span></label>' +
          vals.map(v => '<label class="fc-item"><input type="checkbox" data-v="' + F.escapeHtml(v) + '"' + (f.values.includes(v) ? ' checked' : '') + '><span>' + F.escapeHtml(v) + '</span></label>').join('') + '</div>' +
          '<label class="fc-req"><input type="checkbox" disabled> Require single selection</label>';
      }
      body += '</div>';
    }
    return '<div class="fcard' + (active ? ' active' : '') + (open ? ' open' : '') + '" data-key="' + key + '" data-scope="' + scope + '" data-field="' + field + '" data-vid="' + (vid || '') + '">' +
      '<div class="fc-head"><div><div class="fc-name">' + fd.label + '</div><div class="fc-val">' + txt + '</div></div><div class="fc-icons">' +
      (active ? '<button class="fc-clear" title="Clear filter">' + ic('eraser', 13) + '</button>' : '') +
      '<button class="fc-exp" title="Expand or collapse filter card">' + ic(open ? 'chevDown' : 'chevRight', 12) + '</button></div></div>' + body + '</div>';
  }

  function updateFilter(scope, field, vid, next) {
    const s = S();
    if (scope === 'visual') {
      const vf = Object.assign({}, s.visualFilters[vid] || {}, { [field]: next });
      M.setState({ visualFilters: Object.assign({}, s.visualFilters, { [vid]: vf }) });
    } else {
      const scoped = Object.assign({}, s.filters[scope], { [field]: next });
      M.setState({ filters: Object.assign({}, s.filters, { [scope]: scoped }) });
    }
  }
  function currentFilter(scope, field, vid) {
    const s = S();
    return scope === 'visual' ? ((s.visualFilters[vid] || {})[field] || M.basic()) : s.filters[scope][field];
  }

  function bindFilters(el) {
    el.querySelector('.fp-toggle').addEventListener('click', () => { ui.filtersOpen = false; renderFilters(); window.APP.fit(); });
    const search = el.querySelector('.fp-search input');
    search.addEventListener('input', () => { ui.search = search.value; renderFilters(); const i = document.querySelector('.fp-search input'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); });
    el.querySelectorAll('.fcard[data-field]').forEach(c => {
      const { key, scope, field, vid } = c.dataset;
      const cur = () => currentFilter(scope, field, vid);
      c.querySelector('.fc-head').addEventListener('click', e => {
        if (e.target.closest('.fc-clear')) { updateFilter(scope, field, vid, M.basic()); return; }
        if (ui.expanded.has(key)) ui.expanded.delete(key); else ui.expanded.add(key);
        renderFilters();
      });
      const type = c.querySelector('.fc-type');
      if (type) type.addEventListener('change', () => updateFilter(scope, field, vid, Object.assign(M.basic(), { mode: type.value })));
      const apply = c.querySelector('.btn-apply');
      if (apply) apply.addEventListener('click', () => updateFilter(scope, field, vid, Object.assign({}, cur(), { mode: 'advanced', op: c.querySelector('.fc-op').value, text: c.querySelector('.fc-text').value.trim() })));
      c.querySelectorAll('.fc-list input').forEach(cb => cb.addEventListener('change', () => {
        if (cb.dataset.all) { updateFilter(scope, field, vid, M.basic()); return; }
        const vals = cur().values.slice();
        const v = cb.dataset.v;
        const next = cb.checked ? vals.concat([v]) : vals.filter(x => x !== v);
        updateFilter(scope, field, vid, Object.assign({}, cur(), { mode: 'basic', values: next.length === M.FIELDS[field].values.length ? [] : next }));
      }));
    });
  }

  function init() { buildAppBar(); buildRail(); buildActionBar(); renderPages(); renderFilters(); }

  window.CHROME = { init, renderPages, renderFilters, ui };
})();
