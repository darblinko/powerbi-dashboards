/* Visual container: header icons, "..." menu, focus mode, show as table, export, spotlight,
   View DAX, filter summary, tooltips, cross-filter selection and shared ECharts styling. */
(function () {
  'use strict';
  const M = window.MODEL;

  const THEME = ['#3257A8', '#37A794', '#8B3D88', '#DD6B7F', '#6B91C9', '#F5C869', '#77C4A8', '#DEA6CF'];
  const FONT = '"Segoe UI", "Segoe UI Web", wf_segoe-ui_normal, Tahoma, Arial, sans-serif';
  const GREY = '#605E5C';

  const ICONS = {
    drillUp: '<path d="M8 3l-4 4h3v6h2V7h3z"/>',
    drillMode:
      '<circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 5v5M5.8 8.2L8 10.6l2.2-2.4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    nextLevel: '<path d="M4 3l4 4 4-4M4 8l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    expandAll:
      '<path d="M8 2v6M8 8L4 12M8 8l4 4M2.5 12.5h3M10.5 12.5h3" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    filter: '<path d="M2 3h12l-4.6 5.4V13l-2.8-1.4V8.4z" fill="none" stroke="currentColor" stroke-width="1.2"/>',
    focus: '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" fill="none" stroke="currentColor" stroke-width="1.3"/>',
    more: '<circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/>'
  };
  const svg = (name, size) =>
    '<svg viewBox="0 0 16 16" width="' +
    (size || 16) +
    '" height="' +
    (size || 16) +
    '" fill="currentColor" aria-hidden="true">' +
    ICONS[name] +
    '</svg>';

  const charts = {};
  const registry = {};

  function tipHtml(title, rowsList) {
    const head = title ? '<div class="tt-title">' + title + '</div>' : '';
    return (
      head +
      rowsList
        .map(
          r => '<div class="tt-row"><span class="tt-k">' + r[0] + '</span><span class="tt-v">' + r[1] + '</span></div>'
        )
        .join('')
    );
  }
  const tooltipBase = {
    backgroundColor: '#3B3A39',
    borderWidth: 0,
    padding: [7, 10],
    confine: true,
    textStyle: { color: '#fff', fontSize: 12, fontFamily: FONT },
    extraCssText: 'border-radius:2px;box-shadow:0 2px 6px rgba(0,0,0,.25);'
  };
  const axisLabel = { color: GREY, fontSize: 11, fontFamily: FONT };
  const axisName = { color: GREY, fontSize: 11, fontFamily: FONT };
  function compact(s) {
    return String(s).replace(/\.(\d*?)0+(?=[^\d]|$)/, (m, d) => (d ? '.' + d : ''));
  }
  function valueAxis(extra) {
    return Object.assign(
      {
        type: 'value',
        splitNumber: 4,
        axisLabel: Object.assign({}, axisLabel),
        nameTextStyle: axisName,
        splitLine: { lineStyle: { color: '#E8E8E8' } },
        axisLine: { show: false },
        axisTick: { show: false }
      },
      extra || {}
    );
  }
  function catAxis(data, extra) {
    return Object.assign(
      {
        type: 'category',
        data,
        axisLabel: Object.assign({}, axisLabel),
        nameTextStyle: axisName,
        axisLine: { lineStyle: { color: '#C8C6C4' } },
        axisTick: { show: false }
      },
      extra || {}
    );
  }
  const legendBase = {
    left: 0,
    top: 0,
    icon: 'circle',
    itemWidth: 8,
    itemHeight: 8,
    itemGap: 12,
    textStyle: { color: GREY, fontSize: 11, fontFamily: FONT }
  };

  /* Selection: the source visual shows selected points full colour and the rest at 40%. */
  function ownSelection(vid) {
    const s = M.getState().selection;
    return s && s.vid === vid ? new Set(s.values) : null;
  }
  function selectPoint(vid, field, value, multi) {
    const s = M.getState();
    const cur = s.selection && s.selection.vid === vid ? s.selection.values.slice() : [];
    let next;
    if (multi) next = cur.includes(value) ? cur.filter(v => v !== value) : cur.concat([value]);
    else next = cur.length === 1 && cur[0] === value ? [] : [value];
    M.setState({ selection: next.length ? { vid, field, values: next, page: s.page } : null });
  }
  function clearSelection(vid) {
    const s = M.getState();
    if (s.selection && (!vid || s.selection.vid === vid)) M.setState({ selection: null });
  }
  function hasForeignSelection(vid) {
    const s = M.getState().selection;
    return !!(s && s.vid !== vid && s.page === M.getState().page);
  }

  /* Bar or column series implementing Power BI highlight semantics. */
  function highlightSeries(vid, cats, fullVals, hlVals, color, extra) {
    const own = ownSelection(vid);
    const foreign = hasForeignSelection(vid);
    const base = Object.assign({ type: 'bar', barMaxWidth: 44 }, extra || {});
    if (foreign) {
      return [
        Object.assign({}, base, {
          name: 'All',
          data: fullVals,
          itemStyle: { color, opacity: 0.4 },
          label: { show: false },
          tooltip: { show: false },
          silent: false
        }),
        Object.assign({}, base, { name: 'Highlighted', data: hlVals, barGap: '-100%', z: 3, itemStyle: { color } })
      ];
    }
    const data = fullVals.map((v, i) => ({
      value: v,
      itemStyle: { color, opacity: own && !own.has(cats[i]) ? 0.4 : 1 }
    }));
    return [Object.assign({}, base, { name: 'Value', data })];
  }

  function chart(vid, el) {
    const existing = charts[vid];
    if (existing && existing.getDom() === el) return existing;
    if (existing) existing.dispose();
    const c = echarts.init(el, null, { renderer: 'canvas' });
    charts[vid] = c;
    return c;
  }
  function disposeAll() {
    Object.keys(charts).forEach(k => {
      charts[k].dispose();
      delete charts[k];
    });
  }
  function bindBlankClear(c, vid) {
    if (c.__blankBound) return;
    c.__blankBound = true;
    c.getZr().on('click', e => {
      if (!e.target) clearSelection(vid);
    });
  }

  /* Floating HTML tooltip for non-ECharts visuals. */
  let tipEl = null;
  function showTip(evt, html, cls) {
    if (!tipEl) {
      tipEl = document.createElement('div');
      document.body.appendChild(tipEl);
    }
    tipEl.className = 'pbi-tip ' + (cls || '');
    tipEl.innerHTML = html;
    tipEl.style.display = 'block';
    moveTip(evt);
  }
  function moveTip(evt) {
    if (!tipEl || tipEl.style.display !== 'block') return;
    const w = tipEl.offsetWidth,
      h = tipEl.offsetHeight;
    let x = evt.clientX + 14,
      y = evt.clientY + 14;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - 14;
    tipEl.style.left = Math.max(4, x) + 'px';
    tipEl.style.top = Math.max(4, y) + 'px';
  }
  function hideTip() {
    if (tipEl) tipEl.style.display = 'none';
  }
  /* Menus and dialogs, positioned in screen space outside the scaled page. */
  let menuEl = null;
  function closeMenu() {
    if (menuEl) {
      menuEl.remove();
      menuEl = null;
    }
  }
  function openMenu(anchor, items, opts) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'pbi-menu' + (opts && opts.cls ? ' ' + opts.cls : '');
    items.forEach(it => {
      if (it === '-') {
        const hr = document.createElement('div');
        hr.className = 'menu-sep';
        menuEl.appendChild(hr);
        return;
      }
      if (it.header) {
        const hd = document.createElement('div');
        hd.className = 'menu-head';
        hd.textContent = it.header;
        menuEl.appendChild(hd);
        return;
      }
      const b = document.createElement('button');
      b.className = 'menu-item' + (it.checked ? ' checked' : '') + (it.disabled ? ' disabled' : '');
      b.innerHTML =
        '<span class="mi-check">' +
        (it.checked ? '&#10003;' : '') +
        '</span><span>' +
        it.label +
        '</span>' +
        (it.sub ? '<span class="mi-sub">&#8250;</span>' : '');
      b.addEventListener('click', e => {
        e.stopPropagation();
        if (it.disabled) return;
        if (it.sub) {
          openMenu(b, it.sub, opts);
          return;
        }
        closeMenu();
        it.action();
      });
      menuEl.appendChild(b);
    });
    document.body.appendChild(menuEl);
    const r = anchor.getBoundingClientRect();
    const w = menuEl.offsetWidth,
      h = menuEl.offsetHeight;
    let x = opts && opts.alignLeft ? r.left : r.right - w;
    let y = r.bottom + 2;
    if (x + w > window.innerWidth - 4) x = window.innerWidth - w - 4;
    if (y + h > window.innerHeight - 4) y = r.top - h - 2;
    menuEl.style.left = Math.max(4, x) + 'px';
    menuEl.style.top = Math.max(4, y) + 'px';
  }
  document.addEventListener('click', closeMenu);

  function dialog(title, bodyHtml) {
    const back = document.createElement('div');
    back.className = 'pbi-dialog-back';
    back.innerHTML =
      '<div class="pbi-dialog" role="dialog"><div class="dlg-head"><span>' +
      title +
      '</span><button class="dlg-x" aria-label="Close">&#215;</button></div><div class="dlg-body">' +
      bodyHtml +
      '</div><div class="dlg-foot"><button class="btn-primary">Close</button></div></div>';
    const close = () => back.remove();
    back.querySelector('.dlg-x').onclick = close;
    back.querySelector('.btn-primary').onclick = close;
    back.addEventListener('click', e => {
      if (e.target === back) close();
    });
    document.body.appendChild(back);
  }
  function toast(text) {
    const t = document.createElement('div');
    t.className = 'pbi-toast';
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  }
  function daxHighlight(code) {
    return escapeHtml(code)
      .replace(
        /\b(CALCULATE|DIVIDE|SUM|SAMEPERIODLASTYEAR|SELECTEDVALUE|GENERATESERIES|DATEADD|DISTINCTCOUNT|COUNTROWS|FILTER|ALL|VAR|RETURN|EDATE|MIN|MAX|AVERAGEX|SUMX|IF)\b/g,
        '<span class="dx-fn">$1</span>'
      )
      .replace(/(\[[^\]]+\])/g, '<span class="dx-col">$1</span>')
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="dx-str">$1</span>');
  }
  function showDax(def) {
    const blocks = (def.dax || []).map(d => '<pre class="dax">' + daxHighlight(d) + '</pre>').join('');
    dialog(
      'View DAX: ' + escapeHtml(def.title),
      '<p class="dlg-note">Measures used by this visual, as defined in the semantic model.</p>' + blocks
    );
  }

  function describeFilters(def) {
    const s = M.getState();
    const lines = [
      'Date is in the last ' +
        s.dateRel.n +
        ' ' +
        (s.dateRel.unit === 'Y' ? 'years' : 'months') +
        ' (calendar) <span class="fx-src">Slicer</span>'
    ];
    if (s.slicerCat.length) lines.push('Category is ' + s.slicerCat.join(', ') + ' <span class="fx-src">Slicer</span>');
    if (s.slicerDevice !== 'All')
      lines.push('Device type is ' + s.slicerDevice + ' <span class="fx-src">Slicer</span>');
    const scopes = [
      ['all', 'All pages'],
      [s.page, 'This page']
    ];
    scopes.forEach(([key, label]) => {
      const g = s.filters[key] || {};
      Object.keys(g).forEach(f => {
        const v = filterText(g[f]);
        if (v) lines.push(M.FIELDS[f].label + ' ' + v + ' <span class="fx-src">' + label + '</span>');
      });
    });
    const vf = s.visualFilters[def.id] || {};
    Object.keys(vf).forEach(f => {
      const v = filterText(vf[f]);
      if (v) lines.push(M.FIELDS[f].label + ' ' + v + ' <span class="fx-src">This visual</span>');
    });
    const sel = s.selection;
    if (sel && sel.vid !== def.id && sel.page === s.page && !def.ignoresSelection) {
      const src = registry[sel.vid] ? registry[sel.vid].title : 'another visual';
      lines.push(
        M.FIELDS[sel.field].label +
          ' is ' +
          sel.values.join(', ') +
          ' <span class="fx-src">Cross-filter from ' +
          escapeHtml(src) +
          '</span>'
      );
    }
    return lines;
  }
  function filterText(f) {
    if (f.mode === 'advanced') return f.text ? f.op + ' "' + escapeHtml(f.text) + '"' : '';
    return f.values && f.values.length ? 'is ' + f.values.join(', ') : '';
  }

  function exportCsv(def) {
    const d = def.data();
    const esc = v => {
      const s = String(v === null || v === undefined ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [d.columns.map(esc).join(',')].concat(d.rows.map(r => r.map(esc).join(','))).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = def.title.replace(/[^A-Za-z0-9]+/g, '_') + '_data.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    toast('Export data: ' + d.rows.length + ' rows written to ' + a.download);
  }

  function tableHtml(d, opts) {
    const o = opts || {};
    const head =
      '<tr>' +
      d.columns
        .map((c, i) => '<th class="' + (d.numeric && d.numeric[i] ? 'num' : '') + '">' + escapeHtml(c) + '</th>')
        .join('') +
      '</tr>';
    const body = d.rows
      .map(
        r =>
          '<tr' +
          (o.rowAttr ? o.rowAttr(r) : '') +
          '>' +
          r
            .map(
              (v, i) =>
                '<td class="' +
                (d.numeric && d.numeric[i] ? 'num' : '') +
                '">' +
                escapeHtml(d.display ? d.display(v, i) : v) +
                '</td>'
            )
            .join('') +
          '</tr>'
      )
      .join('');
    const total = d.total
      ? '<tr class="total">' +
        d.total
          .map((v, i) => '<td class="' + (d.numeric && d.numeric[i] ? 'num' : '') + '">' + escapeHtml(v) + '</td>')
          .join('') +
        '</tr>'
      : '';
    return '<table class="pbi-table">' + '<thead>' + head + '</thead><tbody>' + body + total + '</tbody></table>';
  }

  function menuItems(def) {
    const s = M.getState();
    const items = [];
    if (def.data) {
      items.push({ label: 'Export data', action: () => exportCsv(def) });
      items.push({ label: 'Show as a table', action: () => M.setState({ focus: def.id, focusTable: true }) });
    }
    if (def.dax && def.dax.length) items.push({ label: 'View DAX', action: () => showDax(def) });
    items.push({
      label: 'Spotlight',
      checked: s.spotlight === def.id,
      action: () => M.setState({ spotlight: s.spotlight === def.id ? null : def.id }, { uiOnly: true })
    });
    if (def.sortable) {
      const cur = s.sort[def.id] || def.defaultSort || { by: 'value', dir: 'desc' };
      const setSort = patch =>
        M.setState({ sort: Object.assign({}, s.sort, { [def.id]: Object.assign({}, cur, patch) }) });
      items.push('-');
      items.push({ label: 'Sort descending', checked: cur.dir === 'desc', action: () => setSort({ dir: 'desc' }) });
      items.push({ label: 'Sort ascending', checked: cur.dir === 'asc', action: () => setSort({ dir: 'asc' }) });
      items.push({
        label: 'Sort by',
        sub: def.sortable.map(opt => ({
          label: opt.label,
          checked: cur.by === opt.key,
          action: () => setSort({ by: opt.key })
        }))
      });
    }
    return items;
  }

  function headerButtons(def) {
    const s = M.getState();
    const btns = [];
    if (def.hierarchy) {
      const d = s.drill;
      btns.push({
        icon: 'drillUp',
        title: 'Drill up',
        disabled: d.level === 0,
        action: () => window.VISUALS.drillUp()
      });
      btns.push({
        icon: 'drillMode',
        title: d.drillMode ? 'Drill down is on. Click a column to drill into it.' : 'Click to turn on drill down',
        active: d.drillMode,
        action: () => M.setState({ drill: Object.assign({}, d, { drillMode: !d.drillMode }) })
      });
      btns.push({
        icon: 'nextLevel',
        title: 'Go to the next level in the hierarchy',
        disabled: d.level === 2,
        action: () => window.VISUALS.drillNext('next')
      });
      btns.push({
        icon: 'expandAll',
        title: 'Expand all down one level in the hierarchy',
        disabled: d.level === 2,
        action: () => window.VISUALS.drillNext('expand')
      });
    }
    if (!def.noFilterIcon)
      btns.push({ icon: 'filter', title: 'Filters and slicers affecting this visual', hoverList: true });
    btns.push({
      icon: 'focus',
      title: 'Focus mode',
      action: () => M.setState({ focus: s.focus === def.id ? null : def.id, focusTable: false })
    });
    btns.push({ icon: 'more', title: 'More options', menu: true });
    return btns;
  }

  function buildHeader(def, container) {
    const bar = document.createElement('div');
    bar.className = 'vheader';
    headerButtons(def).forEach(b => {
      const el = document.createElement('button');
      el.className = 'vh-btn' + (b.active ? ' active' : '') + (b.disabled ? ' disabled' : '');
      el.title = b.hoverList ? '' : b.title;
      el.setAttribute('aria-label', b.title);
      el.innerHTML = svg(b.icon, 14);
      if (b.hoverList) {
        el.addEventListener('mouseenter', e => {
          const lines = describeFilters(def);
          showTip(
            e,
            '<div class="ft-title">Filters and slicers affecting this visual</div>' +
              lines.map(l => '<div class="ft-row">' + l + '</div>').join(''),
            'light'
          );
        });
        el.addEventListener('mouseleave', hideTip);
      }
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (b.disabled) return;
        if (b.menu) openMenu(el, menuItems(def));
        else if (b.action) b.action();
      });
      bar.appendChild(el);
    });
    container.appendChild(bar);
  }

  function mount(def, pageEl, box) {
    registry[def.id] = def;
    const el = document.createElement('div');
    el.className = 'visual vt-' + (def.type || 'chart') + (def.noChrome ? ' no-chrome' : '');
    el.id = 'v-' + def.id;
    el.dataset.vid = def.id;
    Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
    if (def.title && !def.hideTitle) {
      const t = document.createElement('div');
      t.className = 'vtitle';
      t.textContent = typeof def.title === 'function' ? def.title() : def.title;
      el.appendChild(t);
    }
    const body = document.createElement('div');
    body.className = 'vbody';
    el.appendChild(body);
    if (!def.noHeader) buildHeader(def, el);
    el.addEventListener('mousedown', () => {
      if (M.getState().selectedVisual !== def.id) M.setState({ selectedVisual: def.id }, { uiOnly: true });
    });
    pageEl.appendChild(el);
    return { el, body };
  }

  function refreshHeader(def) {
    const el = document.getElementById('v-' + def.id);
    if (!el || def.noHeader) return;
    const old = el.querySelector('.vheader');
    if (old) old.remove();
    buildHeader(def, el);
    const t = el.querySelector('.vtitle');
    if (t && typeof def.title === 'function') t.textContent = def.title();
  }

  window.FRAME = {
    THEME,
    FONT,
    GREY,
    compact,
    svg,
    tipHtml,
    tooltipBase,
    axisLabel,
    axisName,
    valueAxis,
    catAxis,
    legendBase,
    ownSelection,
    selectPoint,
    clearSelection,
    hasForeignSelection,
    highlightSeries,
    chart,
    disposeAll,
    bindBlankClear,
    showTip,
    moveTip,
    hideTip,
    openMenu,
    closeMenu,
    dialog,
    toast,
    escapeHtml,
    showDax,
    describeFilters,
    filterText,
    exportCsv,
    tableHtml,
    mount,
    refreshHeader,
    registry
  };
})();
