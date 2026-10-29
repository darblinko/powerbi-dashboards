'use strict';
/* Visual menus, popovers, context menu, export, show as table, DAX viewer, side panes. */

function closeMenus() {
  $$('.menu, .popover, .ctx-menu, .sl-drop').forEach(m => m.remove());
}

function placeFloating(el, x, y) {
  document.body.appendChild(el);
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  el.style.left = Math.max(4, Math.min(x, window.innerWidth - w - 6)) + 'px';
  el.style.top = Math.max(4, Math.min(y, window.innerHeight - h - 6)) + 'px';
}

function menuItemsHtml(items) {
  return items
    .map((it, i) => {
      if (it.sep) return '<div class="menu-sep"></div>';
      return (
        '<div class="menu-item' +
        (it.sub ? ' has-sub' : '') +
        (it.disabled ? ' disabled' : '') +
        '" data-i="' +
        i +
        '">' +
        '<span class="mi-ico">' +
        (it.icon ? icon(it.icon, 14) : it.checked ? icon('check', 14) : '') +
        '</span><span class="mi-label">' +
        esc(it.label) +
        '</span>' +
        (it.sub ? icon('chevronRight', 12) : '') +
        '</div>'
      );
    })
    .join('');
}

function openMenu(items, x, y, cls) {
  const m = document.createElement('div');
  m.className = 'menu ' + (cls || '');
  m.innerHTML = menuItemsHtml(items);
  placeFloating(m, x, y);
  m.addEventListener('mousedown', e => e.stopPropagation());
  $$('.menu-item', m).forEach(el => {
    const it = items[+el.dataset.i];
    if (it.sub) {
      el.addEventListener('mouseenter', () => {
        $$('.menu.sub').forEach(s => s.remove());
        const r = el.getBoundingClientRect();
        const sub = openMenu(it.sub, r.right - 2, r.top - 4, 'sub');
        sub.dataset.parent = '1';
      });
    } else {
      el.addEventListener('mouseenter', () => {
        if (!m.classList.contains('sub')) $$('.menu.sub').forEach(s => s.remove());
      });
      el.addEventListener('click', () => {
        if (it.disabled) return;
        closeMenus();
        it.action();
      });
    }
  });
  return m;
}

function showVisualMenu(vid, rect) {
  closeMenus();
  const v = VIS[vid];
  const items = [
    {
      label: 'Show as a table',
      icon: 'table',
      action: () => {
        S.tableView = vid;
        S.focus = null;
        renderAll();
      }
    },
    { label: 'Export data', icon: 'download', action: () => exportCsv(v) },
    {
      label: 'Spotlight',
      icon: 'spotlight',
      action: () => {
        S.spotlight = vid;
        renderAll();
      }
    }
  ];
  if (v.measures && v.measures.length) items.push({ label: 'View DAX', icon: 'code', action: () => showDaxModal(v) });
  if (v.sortFields && v.sortFields.length) {
    const cur = sortState(vid) || { field: v.sortFields[0].key, dir: 'desc' };
    items.push({ sep: true });
    items.push({
      label: 'Sort descending',
      icon: 'sortDesc',
      action: () => {
        S.sort[vid] = { field: cur.field, dir: 'desc' };
        renderAll();
      }
    });
    items.push({
      label: 'Sort ascending',
      icon: 'sortAsc',
      action: () => {
        S.sort[vid] = { field: cur.field, dir: 'asc' };
        renderAll();
      }
    });
    items.push({
      label: 'Sort axis',
      sub: v.sortFields.map(sf => ({
        label: sf.label,
        checked: cur.field === sf.key,
        action: () => {
          S.sort[vid] = { field: sf.key, dir: cur.dir };
          renderAll();
        }
      }))
    });
  }
  openMenu(items, rect.right - 180, rect.bottom + 2);
}

function showContextMenu(clientX, clientY, items) {
  closeMenus();
  openMenu(items, clientX, clientY, 'ctx');
}

function batchContextItems(batchId) {
  return [
    { label: 'Drill through', sub: [{ label: 'Batch Record', action: () => openDrillthrough(batchId) }] },
    { sep: true },
    {
      label: 'Copy value',
      icon: 'file',
      action: () => {
        if (navigator.clipboard)
          navigator.clipboard.writeText(batchId).catch(() => toast('Clipboard is not available.'));
      }
    }
  ];
}

function showFilterPopover(vid, rect) {
  closeMenus();
  const v = VIS[vid];
  const active = filtersFor(vid).filter(filterIsActive);
  const slicers = active.filter(f => f.scope === 'all' && SLICER_FIELDS.includes(f.field));
  const others = active.filter(f => !slicers.includes(f));
  const row = f =>
    '<div class="pop-row"><b>' + esc(filterLabel(f)) + '</b><span>' + esc(filterSummary(f)) + '</span></div>';
  let h = '<div class="pop-title">Filters and slicers affecting this visual</div>';
  if (!active.length && !hasForeignSelection(vid))
    h +=
      '<div class="pop-empty">No filters or slicers are applied to ' +
      esc(typeof v.title === 'function' ? v.title() : v.title) +
      '.</div>';
  if (slicers.length) h += '<div class="pop-sec">Slicers</div>' + slicers.map(row).join('');
  if (others.length) h += '<div class="pop-sec">Filters</div>' + others.map(row).join('');
  if (hasForeignSelection(vid)) {
    const src = VIS[S.selection.source];
    h +=
      '<div class="pop-sec">Cross-filter</div><div class="pop-row"><b>' +
      esc(typeof src.title === 'function' ? src.title() : src.title) +
      '</b><span>' +
      S.selection.keys.length +
      ' selected data point' +
      (S.selection.keys.length > 1 ? 's' : '') +
      '</span></div>';
  }
  const p = document.createElement('div');
  p.className = 'popover';
  p.innerHTML = h;
  placeFloating(p, rect.left - 220, rect.bottom + 4);
}

/* ---------- data export and table view ---------- */
function formatCell(v, f) {
  if (v === null || v === undefined || v === '') return '';
  if (f && FMT[f]) return FMT[f](v);
  return typeof v === 'number' ? v.toLocaleString('en-US') : String(v);
}

function dataTableHtml(v) {
  if (!v.data) return '<div class="fp-empty">This visual has no tabular data.</div>';
  const d = v.data();
  const fm = d.formats || [];
  return (
    '<table class="data-table"><thead><tr>' +
    d.columns.map(c => '<th>' + esc(c) + '</th>').join('') +
    '</tr></thead><tbody>' +
    d.rows
      .map(
        r =>
          '<tr>' +
          r
            .map(
              (c, i) =>
                '<td class="' + (typeof c === 'number' ? 'num' : '') + '">' + esc(formatCell(c, fm[i])) + '</td>'
            )
            .join('') +
          '</tr>'
      )
      .join('') +
    '</tbody></table>'
  );
}

function csvCell(v) {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(Math.round(v * 10000) / 10000) : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function exportCsv(v) {
  if (!v.data) return toast('This visual has no data to export.');
  const d = v.data();
  const csv = [d.columns, ...d.rows].map(r => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  const name =
    (typeof v.title === 'function' ? v.title() : v.title).replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.csv';
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
  toast('Export data: ' + name + ' (' + d.rows.length + ' rows) downloaded.');
}

function showDaxModal(v) {
  const m = document.createElement('div');
  m.className = 'modal-back';
  m.innerHTML =
    '<div class="modal"><div class="modal-head"><span>DAX measures used by this visual</span><button class="modal-x">' +
    icon('close', 14) +
    '</button></div><div class="modal-body">' +
    v.measures
      .map(
        k =>
          '<div class="dax-name">' + esc(MEASURES[k].name) + '</div><pre class="dax">' + esc(MEASURES[k].dax) + '</pre>'
      )
      .join('') +
    '</div></div>';
  document.body.appendChild(m);
  const close = () => m.remove();
  m.querySelector('.modal-x').addEventListener('click', close);
  m.addEventListener('mousedown', e => {
    if (e.target === m) close();
  });
}

function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = text;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- HTML tooltip for non-ECharts visuals ---------- */
function showTip(evt, html) {
  let t = $('#html-tip');
  if (!t) {
    t = document.createElement('div');
    t.id = 'html-tip';
    document.body.appendChild(t);
  }
  t.innerHTML = html;
  t.style.display = 'block';
  moveTip(evt);
}
function moveTip(evt) {
  const t = $('#html-tip');
  if (!t) return;
  const x = evt.clientX + 14;
  const y = evt.clientY + 12;
  t.style.left = Math.min(x, window.innerWidth - t.offsetWidth - 8) + 'px';
  t.style.top = Math.min(y, window.innerHeight - t.offsetHeight - 8) + 'px';
}
function hideTip() {
  const t = $('#html-tip');
  if (t) t.style.display = 'none';
}

/* ---------- side panes: Insights and Anomaly explanations ---------- */
const paneCharts = [];

function miniChart(el, spec) {
  const c = echarts.init(el);
  paneCharts.push(c);
  const color = THEME[0];
  const series = [
    {
      type: spec.kind === 'bar' ? 'bar' : 'line',
      data: spec.values,
      symbol: 'none',
      smooth: false,
      barWidth: '55%',
      lineStyle: { width: 1.6, color },
      itemStyle: { color }
    }
  ];
  if (spec.mark !== undefined) {
    series.push({
      type: 'scatter',
      data: spec.values.map((v, i) => (i === spec.mark ? v : null)),
      symbolSize: 11,
      itemStyle: { color: 'rgba(0,0,0,0)', borderColor: '#D13438', borderWidth: 1.8 }
    });
  }
  if (spec.ref !== undefined)
    series[0].markLine = {
      silent: true,
      symbol: 'none',
      data: [{ yAxis: spec.ref }],
      lineStyle: { color: '#605E5C', type: 'dashed' },
      label: { show: false }
    };
  if (spec.compare) series.push({ type: 'bar', data: spec.compare, barWidth: '55%', itemStyle: { color: '#C8C6C4' } });
  c.setOption({
    animation: false,
    grid: { left: 34, right: 6, top: 6, bottom: 18 },
    tooltip: Object.assign({}, TT, {
      trigger: 'axis',
      formatter: ps =>
        ttHtml(
          ps.filter(p => p.value !== null && p.seriesType !== 'scatter').map(p => [p.name, FMT[spec.fmt](p.value)])
        )
    }),
    xAxis: {
      type: 'category',
      data: spec.labels,
      axisLabel: Object.assign({}, AXIS_LABEL, {
        fontSize: 8,
        interval: spec.kind === 'bar' ? 0 : 'auto',
        formatter: s => (s.length > 10 ? s.slice(0, 9) + '.' : s)
      }),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#C8C6C4' } }
    },
    yAxis: {
      type: 'value',
      splitNumber: 2,
      axisLabel: Object.assign({}, AXIS_LABEL, {
        fontSize: 8,
        formatter: v => (spec.fmt === 'pct' ? Math.round(v * 100) + '%' : v)
      }),
      splitLine: GRID_LINE,
      scale: spec.kind !== 'bar',
      min: spec.min
    },
    series
  });
}

function insightsHtml(list, tab) {
  const tabs = ['Top', 'Anomalies', 'Trends', 'KPI analysis'];
  const typeOf = { Anomalies: 'Anomaly', Trends: 'Trend', 'KPI analysis': 'KPI analysis' };
  const shown = tab === 'Top' ? list : list.filter(i => i.type === typeOf[tab]);
  return (
    '<div class="sp-head"><span>' +
    icon('insights', 16) +
    ' Insights</span><button class="sp-x" data-act="close">' +
    icon('close', 14) +
    '</button></div>' +
    '<div class="sp-note">Insights are generated by analyzing the data in this report with the current filters applied.</div>' +
    '<div class="sp-tabs">' +
    tabs
      .map(t => '<button class="sp-tab' + (t === tab ? ' on' : '') + '" data-tab="' + t + '">' + t + '</button>')
      .join('') +
    '</div>' +
    '<div class="sp-body">' +
    (shown.length
      ? shown
          .map(
            (ins, i) =>
              '<div class="ins-card"><div class="ins-type ins-' +
              ins.type.replace(/\s/g, '') +
              '">' +
              icon('sparkle', 12) +
              esc(ins.type) +
              '</div><div class="ins-title">' +
              esc(ins.title) +
              '</div><div class="ins-chart" data-i="' +
              list.indexOf(ins) +
              '"></div><div class="ins-text">' +
              esc(ins.text) +
              '</div><div class="ins-foot">Analyzed for: ' +
              esc(PAGES.find(p => p.id === S.page).name) +
              ' and filters on all pages</div></div>'
          )
          .join('')
      : '<div class="fp-empty">No insights of this type were found for the current filters.</div>') +
    '</div>'
  );
}

function anomalyHtml(a) {
  return (
    '<div class="sp-head"><span>' +
    icon('sparkle', 16) +
    ' Anomaly</span><button class="sp-x" data-act="close">' +
    icon('close', 14) +
    '</button></div>' +
    '<div class="an-sum"><div class="an-label">OOS rate % in the week of ' +
    esc(U.fmtDate(D.DAY0 + a.week * 7)) +
    '</div><div class="an-value">' +
    FMT.pct(a.value) +
    '</div><div class="an-range">Expected range ' +
    FMT.pct(a.lo) +
    ' to ' +
    FMT.pct(a.hi) +
    ', expected value ' +
    FMT.pct(a.expected) +
    '</div>' +
    '<div class="an-range">' +
    a.oosBatches +
    ' of ' +
    a.batches +
    ' batches had an OOS result</div></div>' +
    '<div class="an-sec">Possible explanations</div><div class="sp-body">' +
    (a.explanations.length
      ? a.explanations
          .map(
            (ex, i) =>
              '<div class="ins-card"><div class="ex-head"><span>' +
              esc(FIELD_LABELS[ex.dim]) +
              ' is <b>' +
              esc(ex.value) +
              '</b></span><span class="ex-str">Strength ' +
              Math.round(ex.strength * 100) +
              '%</span></div><div class="ex-bar"><i style="width:' +
              Math.round(ex.strength * 100) +
              '%"></i></div><div class="ins-chart small" data-ex="' +
              i +
              '"></div><div class="ins-text">' +
              ex.actual +
              ' OOS batches against ' +
              ex.expected.toFixed(1) +
              ' expected from the surrounding weeks.</div></div>'
          )
          .join('')
      : '<div class="fp-empty">No single field value explains this anomaly.</div>') +
    '<div class="sp-note">Explanations are ranked by the share of the excess OOS batches each field value accounts for. Fields analyzed: Site, Line, Dosage form, Test type, Customer.</div></div>'
  );
}

function renderSidePane() {
  const pane = $('#side-pane');
  paneCharts.splice(0).forEach(c => c.dispose());
  const sp = S.sidePane;
  pane.classList.toggle('open', !!sp);
  $('#filters-pane').classList.toggle('hidden', !!sp);
  $('#btn-insights').classList.toggle('on', !!sp && sp.type === 'insights');
  if (!sp) {
    pane.innerHTML = '';
    return;
  }
  if (sp.type === 'insights') {
    const list = computeInsights();
    pane.innerHTML = insightsHtml(list, sp.tab);
    $$('.ins-chart', pane).forEach(el => miniChart(el, list[+el.dataset.i].chart));
    $$('.sp-tab', pane).forEach(b =>
      b.addEventListener('click', () => {
        S.sidePane = { type: 'insights', tab: b.dataset.tab };
        renderSidePane();
      })
    );
  } else {
    pane.innerHTML = anomalyHtml(sp);
    $$('.ins-chart', pane).forEach(el => {
      const ex = sp.explanations[+el.dataset.ex];
      miniChart(el, {
        kind: 'bar',
        labels: ['Actual', 'Expected'],
        values: [ex.actual, null],
        compare: [null, +ex.expected.toFixed(1)],
        fmt: 'dec1'
      });
    });
  }
  pane.querySelector('[data-act="close"]').addEventListener('click', () => {
    S.sidePane = null;
    renderSidePane();
  });
}
