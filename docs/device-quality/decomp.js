/* decomp.js: Decomposition tree visual (CAPA Count split by fields, with AI splits). */
(function () {
  'use strict';
  const PBI = window.PBI;
  const M = PBI.model;
  const esc = PBI.charts.esc;
  const icon = PBI.icon;
  const SPLIT_FIELDS = ['source', 'rootCause', 'process', 'owner', 'product', 'region', 'capaStatus'];
  const NODE_H = 40;
  const COL_HEAD = 34;

  function state() {
    return PBI.S.decomp;
  }

  function groupFor(rows, field) {
    const F = M.FIELDS[field];
    const m = M.groupCount(rows, F.get);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }
  // Rows reaching column k (k = 0 is the root).
  function rowsAt(all, k) {
    const st = state();
    let rows = all;
    for (let i = 0; i < k - 1; i++) {
      const F = M.FIELDS[st.levels[i]];
      rows = rows.filter(r => F.get(r) === st.picks[i]);
    }
    return rows;
  }
  function ensurePicks(all) {
    const st = state();
    for (let i = 0; i < st.levels.length - 1; i++) {
      const groups = groupFor(rowsAt(all, i + 1), st.levels[i]);
      if (!groups.some(g => g[0] === st.picks[i])) st.picks[i] = groups.length ? groups[0][0] : null;
    }
    st.picks.length = Math.max(0, st.levels.length - 1);
  }
  function aiSplit(rows, used, mode) {
    let best = null;
    SPLIT_FIELDS.filter(f => !used.includes(f)).forEach(f => {
      const g = groupFor(rows, f);
      if (g.length < 2) return;
      const score = mode === 'high' ? g[0][1] / rows.length : g[g.length - 1][1] / rows.length;
      if (!best || (mode === 'high' ? score > best.score : score < best.score))
        best = { field: f, score, value: mode === 'high' ? g[0] : g[g.length - 1] };
    });
    return best;
  }

  function expandAt(col, value, field, ai) {
    const st = state();
    st.levels = st.levels.slice(0, col).concat([field]);
    st.picks = st.picks.slice(0, Math.max(0, col - 1));
    if (col >= 1) st.picks[col - 1] = value;
    st.ai = Array.from({ length: col }, (_, i) => (st.ai || [])[i] || null).concat([ai || null]);
    syncSelection();
    PBI.app.update();
  }
  function syncSelection() {
    const st = state();
    const filters = [];
    for (let i = 0; i < st.picks.length; i++) filters.push({ field: st.levels[i], value: st.picks[i] });
    if (!filters.length) {
      if (PBI.S.selection && PBI.S.selection.visualId === 'decomp') PBI.S.selection = null;
      return;
    }
    PBI.S.selection = {
      page: PBI.S.page,
      visualId: 'decomp',
      filters: filters.map(f => ({ field: f.field, values: new Set([f.value]) }))
    };
  }

  function plusMenu(evt, col, value, rows) {
    const st = state();
    const used = st.levels.slice(0, col);
    const avail = SPLIT_FIELDS.filter(f => !used.includes(f));
    const hi = aiSplit(rows, used, 'high'),
      lo = aiSplit(rows, used, 'low');
    PBI.frame.popup(
      [
        {
          label: 'High value',
          icon: 'bulb',
          disabled: !hi,
          title: hi ? 'AI split: ' + M.FIELDS[hi.field].label : '',
          action: () => expandAt(col, value, hi.field, 'High value')
        },
        {
          label: 'Low value',
          icon: 'bulb',
          disabled: !lo,
          title: lo ? 'AI split: ' + M.FIELDS[lo.field].label : '',
          action: () => expandAt(col, value, lo.field, 'Low value')
        },
        { sep: true }
      ].concat(avail.map(f => ({ label: M.FIELDS[f].label, action: () => expandAt(col, value, f) }))),
      evt.clientX + 6,
      evt.clientY + 6
    );
  }

  function render(body, api) {
    const st = state();
    const all = M.rows('capa', api.ctx);
    ensurePicks(all);
    const W = api.w,
      H = api.h;
    const ncols = st.levels.length + 1;
    const colW = Math.max(150, Math.min(220, Math.floor((W - 20) / Math.max(4, ncols))));
    const gap = Math.max(40, Math.floor((W - colW * ncols) / Math.max(1, ncols - 1)));
    const maxNodes = Math.floor((H - COL_HEAD - 8) / NODE_H);
    const cols = [];
    cols.push({
      title: 'CAPA Count',
      sub: '',
      nodes: [{ name: 'CAPA Count', value: all.length, selected: true }],
      rows: all
    });
    st.levels.forEach((f, i) => {
      const rows = rowsAt(all, i + 1);
      const groups = groupFor(rows, f);
      const max = groups.length ? groups[0][1] : 1;
      const shown = groups.slice(0, maxNodes);
      cols.push({
        field: f,
        title: M.FIELDS[f].label,
        ai: st.ai && st.ai[i],
        more: groups.length - shown.length,
        rows,
        nodes: shown.map(g => ({ name: g[0], value: g[1], ratio: g[1] / max, selected: st.picks[i] === g[0] }))
      });
    });
    let html = '<svg class="dt-links" width="' + W + '" height="' + H + '">';
    const nodeY = (col, j) => {
      const n = cols[col].nodes.length;
      const top = COL_HEAD + Math.max(0, (H - COL_HEAD - n * NODE_H) / 2);
      return top + j * NODE_H;
    };
    for (let c = 1; c < cols.length; c++) {
      const pj = Math.max(
        0,
        cols[c - 1].nodes.findIndex(n => n.selected)
      );
      const x0 = (c - 1) * (colW + gap) + colW,
        y0 = nodeY(c - 1, pj) + 26;
      cols[c].nodes.forEach((n, j) => {
        const x1 = c * (colW + gap),
          y1 = nodeY(c, j) + 26;
        const mx = (x0 + x1) / 2;
        html +=
          '<path d="M' +
          x0 +
          ',' +
          y0 +
          ' C' +
          mx +
          ',' +
          y0 +
          ' ' +
          mx +
          ',' +
          y1 +
          ' ' +
          x1 +
          ',' +
          y1 +
          '" class="' +
          (n.selected ? 'on' : '') +
          '"/>';
      });
    }
    html += '</svg>';
    cols.forEach((col, c) => {
      const x = c * (colW + gap);
      html +=
        '<div class="dt-colh" style="left:' +
        x +
        'px;width:' +
        colW +
        'px">' +
        (col.ai ? '<span class="dt-ai" title="AI split: ' + esc(col.ai) + '">' + icon('bulb', 12) + '</span>' : '') +
        '<span class="dt-ct">' +
        esc(col.title) +
        '</span>' +
        (c > 0
          ? '<button class="dt-x" data-col="' + c + '" title="Remove level">' + icon('close', 10) + '</button>'
          : '') +
        (col.ai ? '<div class="dt-ai-sub">' + esc(col.ai) + '</div>' : '') +
        '</div>';
      col.nodes.forEach((n, j) => {
        const y = nodeY(c, j);
        const fill = c === 0 ? 100 : Math.max(3, n.ratio * 100);
        const hasNext = c < cols.length - 1;
        html +=
          '<div class="dt-node' +
          (n.selected && (hasNext || c === 0) ? ' sel' : '') +
          '" data-col="' +
          c +
          '" data-j="' +
          j +
          '" style="left:' +
          x +
          'px;top:' +
          y +
          'px;width:' +
          colW +
          'px">' +
          '<div class="dt-lbl"><span class="dt-n">' +
          esc(n.name) +
          '</span><span class="dt-v">' +
          M.fmt.int(n.value) +
          '</span></div>' +
          '<div class="dt-bar"><div style="width:' +
          fill +
          '%"></div></div>' +
          '<button class="dt-plus" title="Expand">' +
          icon('plus', 10) +
          '</button></div>';
      });
      if (col.more > 0)
        html +=
          '<div class="dt-more" style="left:' +
          x +
          'px;top:' +
          (nodeY(c, col.nodes.length - 1) + NODE_H) +
          'px;width:' +
          colW +
          'px">+' +
          col.more +
          ' more</div>';
    });
    body.innerHTML = '<div class="dtree">' + html + '</div>';
    body.onclick = e => {
      const x = e.target.closest('.dt-x');
      if (x) {
        const c = +x.dataset.col;
        st.levels = st.levels.slice(0, c - 1);
        st.picks = st.picks.slice(0, Math.max(0, c - 2));
        st.ai = (st.ai || []).slice(0, c - 1);
        syncSelection();
        return PBI.app.update();
      }
      const node = e.target.closest('.dt-node');
      if (!node) return;
      const c = +node.dataset.col,
        n = cols[c].nodes[+node.dataset.j];
      if (e.target.closest('.dt-plus'))
        return plusMenu(
          e,
          c,
          c === 0 ? null : n.name,
          c === 0 ? all : cols[c].rows.filter(r => M.FIELDS[cols[c].field].get(r) === n.name)
        );
      if (c === 0) {
        st.picks = [];
        st.levels = st.levels.slice(0, 1);
        syncSelection();
        return PBI.app.update();
      }
      if (c === cols.length - 1) {
        const hi = aiSplit(
          cols[c].rows.filter(r => M.FIELDS[cols[c].field].get(r) === n.name),
          st.levels,
          'high'
        );
        if (hi) return expandAt(c, n.name, hi.field, null);
        return;
      }
      st.picks[c - 1] = n.name;
      st.picks.length = c;
      syncSelection();
      PBI.app.update();
    };
  }

  PBI.decomp = {
    id: 'decomp',
    title: 'CAPA Count Decomposition: Source, Root Cause, Process, Owner',
    x: 8,
    y: 184,
    w: 832,
    h: 512,
    fields: ['source', 'rootCause'],
    dax: [{ name: 'CAPA Count', expr: M.MEASURES.capaCount.dax }],
    table(api) {
      const st = state();
      const all = M.rows('capa', api.ctx);
      const rows = [];
      st.levels.forEach((f, i) =>
        groupFor(rowsAt(all, i + 1), f).forEach(g => rows.push([i + 1, M.FIELDS[f].label, g[0], g[1]]))
      );
      return {
        columns: [
          { label: 'Level', align: 'right' },
          { label: 'Field' },
          { label: 'Value' },
          { label: 'CAPA Count', align: 'right' }
        ],
        rows
      };
    },
    render
  };
})();
