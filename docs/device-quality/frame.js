/* frame.js: visual container, visual header, options menu, focus mode, show as table, export, popups. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const icon = PBI.icon;
  const esc = PBI.charts.esc;
  let charts = [];

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---------- popup menus ----------
  let openMenus = [];
  function closeMenus() {
    openMenus.forEach(m => m.remove());
    openMenus = [];
  }
  document.addEventListener('mousedown', e => {
    if (!e.target.closest('.pmenu')) closeMenus();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeMenus();
      closeModal();
    }
  });

  function popup(items, x, y, level) {
    if (!level) closeMenus();
    const m = el('div', 'pmenu');
    items.forEach(it => {
      if (it.sep) {
        m.appendChild(el('div', 'pm-sep'));
        return;
      }
      if (it.head) {
        m.appendChild(el('div', 'pm-head', esc(it.head)));
        return;
      }
      const row = el(
        'div',
        'pm-item' + (it.disabled ? ' disabled' : ''),
        '<span class="pm-ic">' +
          (it.checked ? icon('check', 14) : it.icon ? icon(it.icon, 14) : '') +
          '</span>' +
          '<span class="pm-label">' +
          esc(it.label) +
          '</span>' +
          (it.sub ? '<span class="pm-arrow">' + icon('chevRight', 12) + '</span>' : '')
      );
      if (it.title) row.title = it.title;
      row.addEventListener('mouseenter', () => {
        openMenus.slice(level + 1 || 1).forEach(s => s.remove());
        openMenus = openMenus.slice(0, (level || 0) + 1);
        if (it.sub && !it.disabled) {
          const r = row.getBoundingClientRect();
          popup(it.sub, r.right - 2, r.top - 4, (level || 0) + 1);
        }
      });
      row.addEventListener('click', e => {
        if (it.disabled || it.sub) return;
        e.stopPropagation();
        closeMenus();
        it.action && it.action();
      });
      m.appendChild(row);
    });
    document.body.appendChild(m);
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - r.width - 4)) + 'px';
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - r.height - 4)) + 'px';
    openMenus.push(m);
    return m;
  }

  function panel(html, anchor, cls) {
    closeMenus();
    const m = el('div', 'pmenu ppanel ' + (cls || ''), html);
    document.body.appendChild(m);
    const a = anchor.getBoundingClientRect();
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(4, Math.min(a.right - r.width, window.innerWidth - r.width - 4)) + 'px';
    m.style.top = Math.min(a.bottom + 4, window.innerHeight - r.height - 4) + 'px';
    openMenus.push(m);
    return m;
  }

  // ---------- modal (View DAX) ----------
  function closeModal() {
    document.querySelectorAll('.modal-back').forEach(m => m.remove());
  }
  function highlightDax(code) {
    const kw =
      /\b(VAR|RETURN|CALCULATE|DIVIDE|COUNTROWS|SUM|AVERAGEX|FILTER|ISBLANK|OR|NOT|MAX|TRUE|DATEDIFF|DAY|ADDCOLUMNS|VALUES)\b/g;
    return esc(code)
      .replace(/(&quot;[^&]*&quot;)/g, '<span class="dx-s">$1</span>')
      .replace(kw, '<span class="dx-k">$1</span>')
      .replace(/(\[[^\]]+\])/g, '<span class="dx-c">$1</span>');
  }
  function showDax(v) {
    closeModal();
    const back = el('div', 'modal-back');
    const body = (v.dax || [])
      .map(d => '<div class="dax-name">' + esc(d.name) + '</div><pre class="dax">' + highlightDax(d.expr) + '</pre>')
      .join('');
    back.innerHTML =
      '<div class="modal"><div class="modal-h"><span>View DAX: ' +
      esc(v.title) +
      '</span><button class="iconbtn mclose" title="Close">' +
      icon('close') +
      '</button></div>' +
      '<div class="modal-b">' +
      body +
      '<div class="modal-note">Measure definitions as authored in the semantic model. Evaluated in the current filter context.</div></div></div>';
    back.addEventListener('mousedown', e => {
      if (e.target === back) closeModal();
    });
    back.querySelector('.mclose').addEventListener('click', closeModal);
    document.body.appendChild(back);
  }

  // ---------- tables ----------
  function htmlTable(spec, opts) {
    const o = opts || {};
    const wrap = el('div', 'ptable-wrap');
    const head = spec.columns
      .map((c, i) => {
        const sorted = o.sort && o.sort.by === i;
        return (
          '<th class="' +
          (c.align === 'right' ? 'r' : '') +
          (o.sortable ? ' sortable' : '') +
          '" data-col="' +
          i +
          '">' +
          esc(c.label) +
          (sorted
            ? '<span class="sort-ar">' + icon(o.sort.dir === 'asc' ? 'chevUp' : 'chevDown', 10) + '</span>'
            : '') +
          '</th>'
        );
      })
      .join('');
    const body = spec.rows
      .map(
        (r, ri) =>
          '<tr data-row="' +
          ri +
          '" class="' +
          ((o.rowClass && o.rowClass(ri)) || '') +
          '">' +
          r
            .map((cell, ci) => {
              const c = spec.columns[ci];
              const content = c.html ? c.html(cell, ri) : esc(c.fmt ? c.fmt(cell) : cell);
              return '<td class="' + (c.align === 'right' ? 'r' : '') + '">' + content + '</td>';
            })
            .join('') +
          '</tr>'
      )
      .join('');
    const total = spec.total
      ? '<tfoot><tr>' +
        spec.total
          .map(
            (cell, ci) => '<td class="' + (spec.columns[ci].align === 'right' ? 'r' : '') + '">' + esc(cell) + '</td>'
          )
          .join('') +
        '</tr></tfoot>'
      : '';
    wrap.innerHTML =
      '<table class="ptable"><thead><tr>' +
      head +
      '</tr></thead><tbody>' +
      body +
      '</tbody>' +
      total +
      '</table>' +
      (spec.note ? '<div class="ptable-note">' + esc(spec.note) + '</div>' : '');
    if (o.sortable)
      wrap.querySelectorAll('th').forEach(th => th.addEventListener('click', () => o.onSort(+th.dataset.col)));
    if (o.onRow)
      wrap.querySelectorAll('tbody tr').forEach(tr =>
        tr.addEventListener('click', e => {
          e.stopPropagation();
          o.onRow(+tr.dataset.row, e);
        })
      );
    if (o.onContext)
      wrap.querySelectorAll('tbody tr').forEach(tr =>
        tr.addEventListener('contextmenu', e => {
          e.preventDefault();
          o.onContext(+tr.dataset.row, e);
        })
      );
    return wrap;
  }

  function exportCsv(v, api) {
    const spec = v.table(api);
    const q = s => {
      const t = String(s == null ? '' : s);
      return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    };
    const lines = [spec.columns.map(c => q(c.label)).join(',')].concat(spec.rows.map(r => r.map(q).join(',')));
    const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = v.title.replace(/[^A-Za-z0-9]+/g, '_') + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    PBI.shell.toast('Exported ' + spec.rows.length + ' rows (summarized data) to ' + a.download);
  }

  // ---------- visual header ----------
  function headerHtml(v) {
    const d = PBI.S.drill[v.id];
    let h = '';
    if (v.hierarchy) {
      const max = v.hierarchy.length - 1;
      h +=
        btn('drillUp', 'Drill up', d.level === 0) +
        btn('drillMode', d.mode ? 'Drill down is on' : 'Click to turn on Drill down', false, d.mode ? 'on' : '') +
        btn('nextLevel', 'Go to the next level in the hierarchy', d.level >= max) +
        btn('expandAll', 'Expand all down one level in the hierarchy', d.level >= max);
    }
    if (v.kind !== 'text')
      h += btn(
        'filter',
        'Filters and slicers affecting this visual',
        false,
        PBI.app.filtersAffecting(v.id).length ? 'has' : ''
      );
    h += btn('focus', 'Focus mode') + btn('more', 'More options');
    return h;
  }
  function btn(name, title, disabled, extra) {
    return (
      '<button class="vh-btn ' +
      (extra || '') +
      '" data-act="' +
      name +
      '" title="' +
      esc(title) +
      '"' +
      (disabled ? ' disabled' : '') +
      '>' +
      icon(name, 14) +
      '</button>'
    );
  }
  function onHeader(v, act, target) {
    const S = PBI.S;
    if (['drillUp', 'drillMode', 'nextLevel', 'expandAll'].includes(act)) return drillAction(v, act);
    if (act === 'focus') {
      S.focus = S.focus && S.focus.vid === v.id ? null : { vid: v.id, table: false };
      return PBI.app.rebuild();
    }
    if (act === 'filter') {
      const list = PBI.app.filtersAffecting(v.id);
      panel(
        '<div class="fp-title">Filters and slicers affecting this visual</div>' +
          (list.length
            ? list
                .map(
                  f =>
                    '<div class="fp-row"><div class="fp-f">' +
                    esc(f.field) +
                    '</div><div class="fp-v">' +
                    esc(f.text) +
                    '</div><div class="fp-s">' +
                    esc(f.src) +
                    '</div></div>'
                )
                .join('')
            : '<div class="fp-row fp-none">No filters or slicers apply to this visual.</div>'),
        target,
        'filters-pop'
      );
      return;
    }
    if (act === 'more') {
      const r = target.getBoundingClientRect();
      popup(moreItems(v), r.left - 160, r.bottom + 2);
    }
  }
  function moreItems(v) {
    const S = PBI.S;
    const items = [
      { label: 'Add a comment', icon: 'comment', disabled: true },
      { label: 'Export data', icon: 'exportI', disabled: !v.table, action: () => exportCsv(v, makeApi(v, null)) },
      {
        label: 'Show as a table',
        icon: 'table',
        disabled: !v.table,
        action: () => {
          S.focus = { vid: v.id, table: true };
          PBI.app.rebuild();
        }
      },
      {
        label: 'Spotlight',
        icon: 'focus',
        action: () => {
          S.spotlight = v.id;
          PBI.app.update();
        }
      },
      { label: 'Get insights', icon: 'insights', disabled: true }
    ];
    if (v.sortFields) {
      const s = S.sort[v.id] || v.defaultSort || { by: v.sortFields[0].key, dir: 'desc' };
      const set = patch => {
        S.sort[v.id] = Object.assign({}, s, patch);
        PBI.app.update();
      };
      items.push(
        { sep: true },
        { label: 'Sort descending', checked: s.dir === 'desc', action: () => set({ dir: 'desc' }) },
        { label: 'Sort ascending', checked: s.dir === 'asc', action: () => set({ dir: 'asc' }) },
        {
          label: 'Sort by',
          sub: v.sortFields.map(f => ({ label: f.label, checked: s.by === f.key, action: () => set({ by: f.key }) }))
        }
      );
    }
    if (v.dax) items.push({ sep: true }, { label: 'View DAX', icon: 'dax', action: () => showDax(v) });
    return items;
  }
  function drillAction(v, act) {
    const S = PBI.S;
    const d = S.drill[v.id];
    const max = v.hierarchy.length - 1;
    if (act === 'drillMode') d.mode = !d.mode;
    if (act === 'drillUp' && d.level > 0) {
      if (d.path.length === d.level) d.path.pop();
      d.level--;
      if (d.level === 0) d.expanded = false;
    }
    if (act === 'nextLevel' && d.level < max) {
      d.level++;
      d.expanded = false;
    }
    if (act === 'expandAll' && d.level < max) {
      d.level++;
      d.expanded = true;
    }
    if (v.onDrill) v.onDrill(act);
    if (S.selection && S.selection.visualId === v.id) S.selection = null;
    PBI.app.update();
  }

  // ---------- api handed to each visual render ----------
  function makeApi(v, body) {
    const S = PBI.S;
    const sel = S.selection && S.selection.page === S.page ? S.selection : null;
    const self = sel && sel.visualId === v.id ? sel : null;
    const api = {
      v,
      body,
      w: body ? body.clientWidth : 0,
      h: body ? body.clientHeight : 0,
      ctx: PBI.app.ctxFor(v.id),
      baseCtx: PBI.app.ctxFor(v.id, { withSelection: false }),
      external: !!(sel && !self),
      self,
      drill: S.drill[v.id],
      sort: S.sort[v.id] || v.defaultSort || (v.sortFields ? { by: v.sortFields[0].key, dir: 'desc' } : null),
      selfHas(field, value) {
        return !!(self && self.filters.some(f => f.field === field && f.values.has(value)));
      },
      selfMatch(obj) {
        return !!(self && self.filters.every(f => f.values.has(obj[f.field])));
      },
      chart() {
        if (!body.__chart) {
          body.__chart = echarts.init(body, null, { renderer: 'canvas' });
          body.__chart.getZr().on('click', e => {
            if (!e.target) PBI.app.clearSelection();
          });
          charts.push(body.__chart);
        }
        return body.__chart;
      },
      click(filters, evt) {
        const d = S.drill[v.id];
        if (v.hierarchy && d && d.mode && d.level < v.hierarchy.length - 1 && filters.length === 1) {
          d.path.push({ field: filters[0].field, value: filters[0].value });
          d.level++;
          return PBI.app.update();
        }
        PBI.app.select(v.id, filters, !!(evt && (evt.ctrlKey || evt.metaKey)));
      },
      contextMenu(evt, field, value) {
        dataPointMenu(evt, v, field, value);
      }
    };
    return api;
  }

  function dataPointMenu(evt, v, field, value) {
    const S = PBI.S;
    const canDrill = field === 'product' || field === 'complaintId';
    const label = PBI.model.FIELDS[field] ? PBI.model.FIELDS[field].label : field;
    const vf = (S.visualFilters[v.id] = S.visualFilters[v.id] || {});
    popup(
      [
        {
          label: 'Show as a table',
          icon: 'table',
          disabled: !v.table,
          action: () => {
            S.focus = { vid: v.id, table: true };
            PBI.app.rebuild();
          }
        },
        {
          label: 'Include',
          action: () => {
            vf[field] = { field, type: 'basic', values: new Set([value]) };
            PBI.app.update();
          }
        },
        {
          label: 'Exclude',
          action: () => {
            vf[field] = { field, type: 'exclude', values: new Set([value]) };
            PBI.app.update();
          }
        },
        { sep: true },
        {
          label: 'Drill through',
          sub: [
            {
              label: 'Complaint Detail',
              disabled: !canDrill,
              action: () => PBI.app.drillthrough(field, value),
              title: canDrill ? label + ': ' + value : 'Drillthrough requires Product or Complaint ID'
            }
          ]
        },
        { sep: true },
        {
          label: 'Copy',
          sub: [
            {
              label: 'Copy value',
              action: () => {
                navigator.clipboard && navigator.clipboard.writeText(String(value)).catch(() => {});
                PBI.shell.toast('Copied ' + value);
              }
            }
          ]
        }
      ],
      evt.clientX,
      evt.clientY
    );
  }

  // ---------- cards ----------
  function makeCard(v, rect, opts) {
    const o = opts || {};
    const card = el('div', 'visual kind-' + (v.kind || 'chart') + (v.cls ? ' ' + v.cls : ''));
    card.dataset.vid = v.id;
    Object.assign(card.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: rect.h + 'px' });
    if (v.kind !== 'text' && v.kind !== 'button') {
      const hdr = el('div', 'vheader', headerHtml(v));
      hdr.addEventListener('mousedown', e => e.stopPropagation());
      hdr.addEventListener('click', e => {
        const b = e.target.closest('.vh-btn');
        if (b && !b.disabled) {
          e.stopPropagation();
          onHeader(v, b.dataset.act, b);
        }
      });
      card.appendChild(hdr);
    }
    const titleH = v.title && !v.noTitle ? 28 : 0;
    if (titleH) {
      const t = el(
        'div',
        'vtitle',
        esc(v.title) + (v.subtitle ? '<span class="vsub">' + esc(v.subtitle) + '</span>' : '')
      );
      if (v.dax) t.title = v.dax.map(d => d.expr).join('\n\n');
      card.appendChild(t);
    }
    const pad = v.pad != null ? v.pad : 8;
    const innerH = rect.h - titleH - pad * 2 + (titleH ? 4 : 0);
    const body = el('div', 'vbody');
    Object.assign(body.style, {
      left: pad + 'px',
      top: (titleH ? titleH - 2 : pad) + 'px',
      width: rect.w - pad * 2 + 'px'
    });
    if (o.table && v.table) {
      const chartH = Math.round(innerH * 0.5);
      body.style.height = chartH + 'px';
      const tbl = el('div', 'vtable');
      Object.assign(tbl.style, {
        left: pad + 'px',
        top: (titleH ? titleH - 2 : pad) + chartH + 8 + 'px',
        width: rect.w - pad * 2 + 'px',
        height: innerH - chartH - 8 + 'px'
      });
      card.appendChild(tbl);
    } else {
      body.style.height = innerH + 'px';
    }
    card.appendChild(body);
    card.addEventListener('mousedown', () => {
      if (PBI.S.selectedVisual !== v.id) {
        PBI.S.selectedVisual = v.id;
        PBI.app.markSelected();
        PBI.filters.render();
      }
    });
    return card;
  }

  function renderCard(v, card) {
    const body = card.querySelector('.vbody');
    const api = makeApi(v, body);
    try {
      v.render(body, api);
    } catch (err) {
      console.error('Visual ' + v.id + ' failed', err);
      body.innerHTML = '<div class="vis-error">Cannot display the visual.</div>';
    }
    const tbl = card.querySelector('.vtable');
    if (tbl && v.table) {
      tbl.innerHTML = '';
      tbl.appendChild(htmlTable(v.table(api)));
    }
    const hdr = card.querySelector('.vheader');
    if (hdr) hdr.innerHTML = headerHtml(v);
  }

  function disposeCharts() {
    charts.forEach(c => {
      try {
        c.dispose();
      } catch {
        /* already disposed */
      }
    });
    charts = [];
  }

  function buildPage(pageEl, page) {
    disposeCharts();
    pageEl.innerHTML = '';
    const S = PBI.S;
    page.visuals.forEach(v => pageEl.appendChild(makeCard(v, v)));
    pageEl.appendChild(
      el('div', 'page-footer', 'Sample data generated for demonstration. Not drawn from any real system.')
    );
    if (S.focus) {
      const v = page.visuals.find(x => x.id === S.focus.vid);
      if (!v) {
        S.focus = null;
        return;
      }
      const ov = el('div', 'focus-overlay');
      const backBtn = el('button', 'focus-back', icon('chevLeft', 14) + '<span>Back to report</span>');
      backBtn.addEventListener('click', () => {
        S.focus = null;
        PBI.app.rebuild();
      });
      ov.appendChild(backBtn);
      ov.appendChild(makeCard(v, { x: 8, y: 40, w: 1264, h: 656 }, { table: S.focus.table }));
      pageEl.appendChild(ov);
    }
  }

  function renderAll(pageEl, page) {
    const S = PBI.S;
    const focusCard = S.focus ? pageEl.querySelector('.focus-overlay .visual') : null;
    page.visuals.forEach(v => {
      const card = pageEl.querySelector(':scope > .visual[data-vid="' + v.id + '"]');
      if (card && !S.focus) renderCard(v, card);
    });
    if (focusCard)
      renderCard(
        page.visuals.find(x => x.id === S.focus.vid),
        focusCard
      );
  }

  PBI.frame = {
    el,
    popup,
    panel,
    htmlTable,
    exportCsv,
    showDax,
    buildPage,
    renderAll,
    makeApi,
    dataPointMenu,
    closeMenus,
    closeModal,
    disposeCharts
  };
})();
