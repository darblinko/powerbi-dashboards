/* Visual container: header icons, "..." menu, context menu, tooltips, table view, export, focus. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const ST = window.PBI_STATE;
  const icon = window.PBI_ICON;
  const PBI = window.PBI = { kinds: {}, charts: {}, tables: {}, app: null };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- popups ---------- */
  const root = () => document.getElementById('popup-root');
  function closePopups() { root().innerHTML = ''; document.querySelectorAll('.vheader.pinned').forEach(h => h.classList.remove('pinned')); }
  function placeMenu(el, x, y) {
    root().appendChild(el);
    const r = el.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
    el.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
  }
  function buildMenu(items, cls) {
    const el = document.createElement('div');
    el.className = 'menu' + (cls ? ' ' + cls : '');
    items.forEach(it => {
      if (it === '-') { el.insertAdjacentHTML('beforeend', '<div class="menu-sep"></div>'); return; }
      if (it.header) { el.insertAdjacentHTML('beforeend', '<div class="menu-head">' + esc(it.header) + '</div>'); return; }
      const row = document.createElement('div');
      row.className = 'menu-item' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : '');
      row.innerHTML = (it.icon ? icon(it.icon, 14) : '<span style="width:14px"></span>') + '<span>' + esc(it.label) + '</span>' +
        (it.children ? '<span class="sub">' + icon('chevronRight', 12) + '</span>' : '');
      if (it.children && !it.disabled) {
        row.addEventListener('mouseenter', () => {
          el.querySelectorAll('.submenu').forEach(s => s.remove());
          const sub = buildMenu(it.children, 'submenu');
          const r = row.getBoundingClientRect();
          placeMenu(sub, r.right - 2, r.top - 4);
        });
      } else if (!it.disabled) {
        row.addEventListener('mouseenter', () => el.querySelectorAll('.submenu').forEach(s => s.remove()));
        row.addEventListener('click', ev => { ev.stopPropagation(); closePopups(); it.action(); });
      }
      el.appendChild(row);
    });
    el.addEventListener('click', ev => ev.stopPropagation());
    return el;
  }
  function menu(x, y, items, cls) { closePopups(); placeMenu(buildMenu(items, cls), x, y); }

  function tipShow(html, ev) {
    const t = document.getElementById('tip');
    t.innerHTML = html;
    t.hidden = false;
    const r = t.getBoundingClientRect();
    let x = ev.clientX + 14, y = ev.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = ev.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = ev.clientY - r.height - 14;
    t.style.left = x + 'px';
    t.style.top = y + 'px';
  }
  function tipHide() { document.getElementById('tip').hidden = true; }
  function ttHtml(rows, dax) {
    let h = rows.map(([k, v]) => '<div class="tt-row"><span class="tt-k">' + esc(k) + '</span><span class="tt-v">' + esc(v) + '</span></div>').join('');
    if (dax) h += '<div class="tt-dax">' + esc(dax) + '</div>';
    return h;
  }
  function highlightDax(code) {
    return esc(code)
      .replace(/(&quot;[^&]*?&quot;)/g, '<span class="dax-str">$1</span>')
      .replace(/\b(VAR|RETURN|CALCULATE|DIVIDE|SUM|SUMX|FILTER|ALL|ALLSELECTED|COUNTROWS|TRUE|NAMEOF|MAX|ROUND|IF|ISFILTERED|SELECTEDVALUE|DISTINCTCOUNT)\b/g, '<span class="dax-kw">$1</span>');
  }
  function modal(html, buttons) {
    closePopups();
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = '<div class="modal">' + html + '<div class="modal-actions"></div></div>';
    const actions = mask.querySelector('.modal-actions');
    (buttons || [{ label: 'Close', primary: true }]).forEach(b => {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', () => { const keep = b.action && b.action(mask) === false; if (!keep) mask.remove(); });
      actions.appendChild(btn);
    });
    mask.addEventListener('click', e => { if (e.target === mask) mask.remove(); });
    document.body.appendChild(mask);
    return mask;
  }
  function showDax(names) {
    const blocks = names.filter(n => M.DAX[n]).map(n => '<pre>' + highlightDax(M.DAX[n]) + '</pre>').join('<div style="height:8px"></div>');
    modal('<h2>View DAX</h2><p>Measure definitions used by this visual, as written in the semantic model.</p>' + blocks);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  /* ---------- table view and export ---------- */
  function tableHtml(tbl) {
    if (!tbl) return '<div class="blank-msg">No data</div>';
    const head = tbl.columns.map(c => '<th class="' + (c.fmt ? 'num' : '') + '">' + esc(c.name) + '</th>').join('');
    const body = tbl.rows.map(r => '<tr>' + r.map((v, i) => {
      const c = tbl.columns[i];
      return '<td class="' + (c.fmt ? 'num' : '') + '">' + esc(c.fmt ? M.fmt(v, c.fmt) : (v === null ? '(Blank)' : v)) + '</td>';
    }).join('') + '</tr>').join('');
    return '<table class="tbl"><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
  }
  function exportCsv(v) {
    const tbl = PBI.tables[v.id];
    if (!tbl) { toast('This visual has no data to export.'); return; }
    const q = x => { const s = x === null || x === undefined ? '' : String(x); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const lines = [tbl.columns.map(c => q(c.name)).join(',')].concat(tbl.rows.map(r => r.map(q).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (v.exportName || v.id) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    toast('Exported ' + tbl.rows.length + ' rows to ' + a.download + '.');
  }

  /* ---------- drill state ---------- */
  function drillState(v) {
    const S = ST.S;
    if (!S.drill[v.id]) S.drill[v.id] = { level: 0, path: [], expanded: false, mode: false };
    return S.drill[v.id];
  }
  function drillAction(v, kind) {
    const d = drillState(v);
    const max = v.hierarchy.length - 1;
    if (kind === 'up' && d.level > 0) {
      d.level -= 1;
      d.path = d.path.slice(0, d.level);
      if (d.level === 0) d.expanded = false;
    } else if (kind === 'mode') {
      d.mode = !d.mode;
    } else if (kind === 'next' && d.level < max) {
      d.level += 1;
      d.path = [];
      d.expanded = false;
    } else if (kind === 'expand' && d.level < max) {
      d.level += 1;
      d.expanded = true;
    }
    ST.S.selection[PBI.app.pageId()] = null;
    PBI.app.refresh();
  }
  function drillInto(v, value) {
    const d = drillState(v);
    if (d.level >= v.hierarchy.length - 1) return false;
    d.path = d.path.slice(0, d.level).concat([value]);
    d.level += 1;
    d.expanded = false;
    ST.S.selection[PBI.app.pageId()] = null;
    PBI.app.refresh();
    return true;
  }

  /* ---------- menus ---------- */
  function moreMenu(v, x, y) {
    const S = ST.S;
    const sort = S.sort[v.id] || v.defaultSort || null;
    const items = [
      { label: 'Show as a table', icon: 'table', action: () => { S.focus = { visualId: v.id, table: true }; PBI.app.renderPage(); } },
      { label: 'Export data', icon: 'download', action: () => exportCsv(v) },
      { label: 'Spotlight', icon: 'spotlight', action: () => { S.spotlight = v.id; PBI.app.refresh(); } }
    ];
    if (v.sortFields) {
      items.push('-');
      items.push({ label: 'Sort descending', icon: 'sortDesc', checked: sort && sort.dir === 'desc', action: () => { S.sort[v.id] = { by: (sort && sort.by) || v.sortFields[0], dir: 'desc' }; PBI.app.refresh(); } });
      items.push({ label: 'Sort ascending', icon: 'sortAsc', checked: sort && sort.dir === 'asc', action: () => { S.sort[v.id] = { by: (sort && sort.by) || v.sortFields[0], dir: 'asc' }; PBI.app.refresh(); } });
      items.push({
        label: 'Sort axis', icon: 'sortDesc', children: v.sortFields.map(f => ({
          label: 'Sort by ' + ((v.sortLabels && v.sortLabels[f]) || f), checked: sort && sort.by === f,
          action: () => { S.sort[v.id] = { by: f, dir: (sort && sort.dir) || 'desc' }; PBI.app.refresh(); }
        }))
      });
    }
    if (v.dax && v.dax.length) { items.push('-'); items.push({ label: 'View DAX', icon: 'dax', action: () => showDax(v.dax) }); }
    menu(x, y, items);
  }
  function contextMenu(v, ev, point) {
    const S = ST.S;
    const isMachine = point && point.field === 'Machine';
    const items = [
      { label: 'Show as a table', icon: 'table', action: () => { S.focus = { visualId: v.id, table: true }; PBI.app.renderPage(); } },
      { label: 'Include', icon: 'include', disabled: !point, action: () => addVisualCard(v, point, 'include') },
      { label: 'Exclude', icon: 'exclude', disabled: !point, action: () => addVisualCard(v, point, 'exclude') },
      '-',
      {
        label: 'Drill through', icon: 'drillthrough', disabled: !isMachine || PBI.app.pageId() === 'machine',
        children: [{ label: 'Machine Detail', action: () => PBI.app.drillthrough(point.value) }]
      },
      { label: 'Spotlight', icon: 'spotlight', action: () => { S.spotlight = v.id; PBI.app.refresh(); } },
      { label: 'Export data', icon: 'download', action: () => exportCsv(v) }
    ];
    menu(ev.clientX, ev.clientY, items, 'ctx-menu');
  }
  function addVisualCard(v, point, mode) {
    const S = ST.S;
    const list = (S.filtersVisual[v.id] || []).slice();
    if (mode === 'include') list.push(ST.card(point.field, { values: new Set([point.value]) }));
    else list.push(ST.card(point.field, { type: 'advanced', op: 'is not', advValue: point.value }));
    S.filtersVisual[v.id] = list;
    S.selection[PBI.app.pageId()] = null;
    PBI.app.refresh();
  }
  function filterPopover(v, x, y) {
    const filters = ST.filterContext(PBI.app.pageId(), v.id);
    const items = [{ header: 'Filters and slicers affecting this visual' }];
    if (!filters.length) items.push({ label: 'No filters applied', disabled: true });
    filters.forEach(f => {
      const vals = [...f.values].slice(0, 3).map(x2 => M.valueLabel(f.field, x2)).join(', ') + (f.values.size > 3 ? ', +' + (f.values.size - 3) : '');
      items.push({ label: M.fieldDisplay(f.field) + ' is ' + vals + '  (' + f.label + ')', icon: 'filter', disabled: true });
    });
    menu(x, y, items);
  }

  /* ---------- shell ---------- */
  function headerHtml(v) {
    let h = '';
    if (v.hierarchy) {
      const d = drillState(v);
      const max = v.hierarchy.length - 1;
      h += '<button class="vh-btn' + (d.level === 0 ? ' off' : '') + '" data-h="up" title="Drill up">' + icon('drillUp', 14) + '</button>';
      h += '<button class="vh-btn' + (d.mode ? ' on' : '') + '" data-h="mode" title="' + (d.mode ? 'Drill down is on' : 'Click to turn on Drill down') + '">' + icon('drillDown', 14) + '</button>';
      h += '<button class="vh-btn' + (d.level >= max ? ' off' : '') + '" data-h="next" title="Go to the next level in the hierarchy">' + icon('nextLevel', 14) + '</button>';
      h += '<button class="vh-btn' + (d.level >= max ? ' off' : '') + '" data-h="expand" title="Expand all down one level in the hierarchy">' + icon('expandAll', 14) + '</button>';
      h += '<span class="vh-sep"></span>';
    }
    h += '<button class="vh-btn" data-h="filter" title="Filters and slicers affecting this visual">' + icon('filter', 14) + '</button>';
    h += '<button class="vh-btn" data-h="focus" title="Focus mode">' + icon('focus', 14) + '</button>';
    h += '<button class="vh-btn" data-h="more" title="More options">' + icon('more', 14) + '</button>';
    return h;
  }
  function buildShell(v, geom) {
    const el = document.createElement('div');
    el.className = 'visual';
    el.dataset.id = v.id;
    el.style.left = geom.x + 'px';
    el.style.top = geom.y + 'px';
    el.style.width = geom.w + 'px';
    el.style.height = geom.h + 'px';
    el.innerHTML = '<div class="vheader"></div><div class="vtitle' + (v.title === null ? ' notitle' : '') + '"></div><div class="vbody"><div class="vchart"></div></div>';
    if (v.noBorder) el.style.boxShadow = 'none';
    el.addEventListener('click', ev => {
      ev.stopPropagation();
      closePopups();
      if (ST.S.selectedVisual !== v.id) { ST.S.selectedVisual = v.id; PBI.app.markSelected(); PBI.app.renderFilters(); }
    });
    el.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      if (ev.__pbiHandled) return;
      contextMenu(v, ev, null);
    });
    el.querySelector('.vheader').addEventListener('click', ev => {
      const b = ev.target.closest('.vh-btn');
      if (!b) return;
      ev.stopPropagation();
      const r = b.getBoundingClientRect();
      const kind = b.dataset.h;
      if (b.classList.contains('off')) return;
      if (kind === 'more') { moreMenu(v, r.left - 160, r.bottom + 4); b.parentNode.classList.add('pinned'); } else if (kind === 'filter') { filterPopover(v, r.left - 220, r.bottom + 4); b.parentNode.classList.add('pinned'); } else if (kind === 'focus') { ST.S.focus = { visualId: v.id, table: false }; PBI.app.renderPage(); } else drillAction(v, kind);
    });
    return el;
  }

  function makeApi(v, page, shell) {
    const S = ST.S;
    const sel = S.selection[page.id];
    const host = shell.querySelector('.vchart');
    return {
      v, page, el: host, shell, S, M,
      foreignSel: sel && sel.visualId !== v.id ? sel : null,
      selfSel: sel && sel.visualId === v.id ? sel : null,
      filters: opts => ST.filterContext(page.id, v.id, opts),
      q(table, opts) {
        const o = opts || {};
        const f = ST.filterContext(page.id, v.id, { selection: o.sel !== false, exclude: o.exclude || [] });
        return M.filterRows(table, f.concat(o.extra || []));
      },
      chart() {
        let c = PBI.charts[v.id];
        if (!c || c.isDisposed()) {
          host.innerHTML = '';
          c = echarts.init(host, null, { renderer: 'svg' });
          PBI.charts[v.id] = c;
          c.getZr().on('click', e => {
            if (!e.target && ST.S.selection[page.id]) { ST.S.selection[page.id] = null; PBI.app.refresh(); }
          });
        }
        return c;
      },
      on(evt, fn) { const c = this.chart(); c.off(evt); c.on(evt, fn); },
      select(field, value, multi) { ST.select(page.id, v.id, v.title || v.id, field, value, multi); PBI.app.refresh(); },
      isSelected(field, value) { return !!(sel && sel.visualId === v.id && sel.field === field && sel.values.has(value)); },
      setTable(columns, rows) { PBI.tables[v.id] = { columns, rows }; },
      setTitle(t) { shell.querySelector('.vtitle').textContent = t; },
      sort() { return S.sort[v.id] || v.defaultSort || null; },
      drill: () => drillState(v),
      drillInto: value => drillInto(v, value),
      context: (ev, point) => { if (ev) ev.__pbiHandled = true; contextMenu(v, ev, point); },
      blank(msg) {
        const c = PBI.charts[v.id];
        if (c) { c.dispose(); delete PBI.charts[v.id]; }
        host.innerHTML = '<div class="blank-msg">' + esc(msg || '(Blank)') + '</div>';
      }
    };
  }

  function renderVisual(v, page, shell) {
    shell.querySelector('.vheader').innerHTML = headerHtml(v);
    shell.querySelector('.vtitle').textContent = v.title || '';
    const kind = PBI.kinds[v.kind];
    if (!kind) throw new Error('Unknown visual kind ' + v.kind);
    const api = makeApi(v, page, shell);
    kind(api, v);
    const tw = shell.querySelector('.vtable-wrap');
    if (tw) tw.innerHTML = tableHtml(PBI.tables[v.id]);
  }

  Object.assign(PBI, {
    esc, menu, closePopups, tipShow, tipHide, ttHtml, modal, showDax, toast, highlightDax,
    tableHtml, exportCsv, buildShell, renderVisual, drillState, contextMenu
  });
})();
