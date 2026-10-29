/* Shared ECharts styling in the Power BI default look, and the cross-highlight helpers. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const PBI = window.PBI;
  const COLORS = M.THEME.colors;
  const FONT = '"Segoe UI", "Segoe UI Web", wf_segoe-ui_normal, Tahoma, Arial, sans-serif';

  function axisCat(extra) {
    return Object.assign({
      type: 'category',
      axisLine: { lineStyle: { color: '#C8C6C4' } },
      axisTick: { show: false },
      axisLabel: { color: '#605E5C', fontSize: 11, fontFamily: FONT },
      nameTextStyle: { color: '#605E5C', fontSize: 11, fontFamily: FONT },
      splitLine: { show: false }
    }, extra || {});
  }
  function axisVal(extra) {
    return Object.assign({
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: '#605E5C', fontSize: 11, fontFamily: FONT },
      nameTextStyle: { color: '#605E5C', fontSize: 11, fontFamily: FONT },
      splitLine: { lineStyle: { color: '#EDEBE9' } }
    }, extra || {});
  }
  function tooltip(extra) {
    return Object.assign({
      backgroundColor: '#252423', borderWidth: 0, padding: [7, 10],
      textStyle: { color: '#FFFFFF', fontSize: 12, fontFamily: FONT },
      extraCssText: 'border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.3);',
      confine: true, transitionDuration: 0
    }, extra || {});
  }
  function legend(title, names, extra) {
    const offset = title ? Math.round(title.length * 6.6) + 18 : 8;
    return Object.assign({
      show: true, left: offset, top: 2, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 12,
      textStyle: { color: '#605E5C', fontSize: 11, fontFamily: FONT }, data: names
    }, extra || {});
  }
  function legendTitle(title) {
    if (!title) return [];
    return [{ type: 'text', left: 8, top: 1, style: { text: title, fill: '#252423', font: '600 11px ' + FONT } }];
  }
  function base(opt) {
    return Object.assign({
      textStyle: { fontFamily: FONT },
      color: COLORS,
      animationDuration: 300,
      animationDurationUpdate: 250,
      tooltip: tooltip({ trigger: 'item' })
    }, opt);
  }
  function axisFormatter(kind) {
    if (kind === 'pct' || kind === 'pct2') return v => (v * 100).toFixed(kind === 'pct2' ? 1 : 0) + '%';
    if (kind === 'cur') return v => M.fmt(v, 'cur');
    return v => M.compact(v, 0);
  }

  /* Highlighted part in full colour, the remainder at 40% opacity, stacked, as Power BI
     renders a highlighted bar. */
  function restOf(f, h) {
    if (f === null || f === undefined) return 0;
    if (h === null || h === undefined) return f;
    if (Math.sign(f) !== Math.sign(h) && h !== 0) return 0;
    return Math.abs(h) >= Math.abs(f) ? 0 : f - h;
  }
  function hlBars(o) {
    const hl = o.hl;
    const shown = hl ? hl.map(x => (x === null ? 0 : x)) : o.full.map(x => (x === null ? 0 : x));
    const rest = hl ? o.full.map((f, i) => restOf(f, hl[i])) : o.full.map(() => 0);
    const stack = o.stack || o.name;
    const label = o.label ? {
      show: true, position: o.horizontal ? 'right' : 'top', color: '#605E5C', fontSize: 10, fontFamily: FONT,
      formatter: p => (o.full[p.dataIndex] === null ? '' : o.label(o.full[p.dataIndex]))
    } : { show: false };
    const common = { type: 'bar', name: o.name, stack, barMaxWidth: o.barMaxWidth || 36, barCategoryGap: o.gap || '30%', emphasis: { itemStyle: { borderColor: '#252423', borderWidth: 1 } } };
    return [
      Object.assign({}, common, { data: shown.map((v, i) => itemColor(v, o, i, 1)) }),
      Object.assign({}, common, { data: rest.map((v, i) => itemColor(v, o, i, 0.4)), label })
    ];
  }
  function itemColor(v, o, i, opacity) {
    const color = o.colorAt ? o.colorAt(i) : o.color;
    return { value: v, itemStyle: { color, opacity } };
  }

  /* Full and highlighted values for categories of a grouping field. */
  function hlData(api, table, groupField, keys, fn, extra) {
    const fullMap = M.groupBy(api.q(table, { sel: false, extra }), groupField);
    const full = keys.map(k => (fullMap.has(k) ? fn(fullMap.get(k)) : null));
    let hl = null;
    const fs = api.foreignSel;
    if (fs && M.TABLE_SETS[table].has(fs.field)) {
      const hm = M.groupBy(api.q(table, { extra }), groupField);
      hl = keys.map(k => (hm.has(k) ? fn(hm.get(k)) : 0));
    } else if (api.selfSel && api.selfSel.field === groupField) {
      hl = keys.map((k, i) => (api.selfSel.values.has(k) ? full[i] : 0));
    }
    return { full, hl };
  }

  function sortKeys(keys, values, sort, labelOf) {
    const idx = keys.map((_, i) => i);
    if (!sort) return idx;
    const dir = sort.dir === 'asc' ? 1 : -1;
    if (sort.by === 'value') idx.sort((a, b) => dir * ((values[a] || 0) - (values[b] || 0)));
    else idx.sort((a, b) => dir * String(labelOf(keys[a])).localeCompare(String(labelOf(keys[b]))));
    return idx;
  }

  function onPointClick(api, field, keyAt) {
    api.on('click', p => {
      const key = keyAt(p);
      if (key === undefined) return;
      const ev = p.event && p.event.event;
      api.select(field, key, !!(ev && (ev.ctrlKey || ev.metaKey)));
    });
  }

  PBI.cc = { FONT, COLORS, axisCat, axisVal, tooltip, legend, legendTitle, base, axisFormatter, hlBars, hlData, sortKeys, onPointClick, restOf };
})();
