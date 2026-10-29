/* filterspane.js: the Filters pane (visual, page, all pages and drillthrough scopes). */
(function () {
  'use strict';
  const PBI = window.PBI;
  const icon = PBI.icon;
  const esc = PBI.charts.esc;
  const M = PBI.model;
  const ALL_PAGE_FIELDS = ['year', 'family'];
  const OPS = ['contains', 'does not contain', 'starts with', 'is', 'is not'];
  let searchText = '';

  function storeFor(scope) {
    const S = PBI.S;
    if (scope === 'all') return S.allFilters;
    if (scope === 'page') return (S.pageFilters[S.page] = S.pageFilters[S.page] || {});
    return (S.visualFilters[S.selectedVisual] = S.visualFilters[S.selectedVisual] || {});
  }

  function cardHtml(scope, field) {
    const S = PBI.S;
    const F = M.FIELDS[field];
    const f = storeFor(scope)[field];
    const key = scope + ':' + field;
    const open = S.fexpanded.has(key);
    const active = M.isActive(f);
    const values = F.values ? F.values() : null;
    const type = f && f.type === 'advanced' ? 'advanced' : (values ? 'basic' : 'advanced');
    let body = '';
    if (open) {
      body = '<div class="fc-body"><div class="fc-label">Filter type</div><select class="fc-type">' +
        (values ? '<option value="basic"' + (type === 'basic' ? ' selected' : '') + '>Basic filtering</option>' : '') +
        '<option value="advanced"' + (type === 'advanced' ? ' selected' : '') + '>Advanced filtering</option></select>';
      if (type === 'basic') {
        const set = f && f.type !== 'advanced' ? f.values : new Set();
        const excl = f && f.type === 'exclude';
        body += '<div class="fc-search">' + icon('search', 12) + '<input placeholder="Search" class="fc-q"></div>' +
          '<label class="fc-item fc-all"><span class="cb' + (set.size === values.length && !excl ? ' on' : '') + '">' + (set.size === values.length && !excl ? icon('check', 10) : '') + '</span><span>Select all</span></label>' +
          values.map(v => {
            const on = excl ? !set.has(v) && set.size > 0 : set.has(v);
            return '<label class="fc-item" data-v="' + esc(v) + '"><span class="cb' + (on ? ' on' : '') + '">' + (on ? icon('check', 10) : '') + '</span><span>' + esc(v) + '</span></label>';
          }).join('') +
          '<div class="fc-req"><span class="cb"></span><span>Require single selection</span></div>';
      } else {
        const op = f && f.type === 'advanced' ? f.op : 'contains';
        body += '<div class="fc-label">Show items when the value</div><select class="fc-op">' +
          OPS.map(o => '<option' + (o === op ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
          '<input class="fc-text" value="' + esc(f && f.type === 'advanced' ? f.text || '' : '') + '">' +
          '<div class="fc-radio"><span class="rd on"></span>And<span class="rd"></span>Or</div>' +
          '<select class="fc-op2" disabled><option></option></select><input class="fc-text2" disabled>' +
          '<div class="fc-apply-row"><a class="fc-apply">Apply filter</a></div>';
      }
      body += '</div>';
    }
    return '<div class="fcard' + (active ? ' active' : '') + (open ? ' open' : '') + '" data-scope="' + scope + '" data-field="' + field + '">' +
      '<div class="fc-head"><div class="fc-t"><div class="fc-name">' + esc(F.label) + '</div><div class="fc-sum">' + esc(M.describe(f)) + '</div></div>' +
      '<div class="fc-icons"><button class="fc-clear" title="Clear filter">' + icon('eraser', 12) + '</button>' +
      '<button class="fc-tog" title="' + (open ? 'Collapse' : 'Expand') + ' filter card">' + icon(open ? 'chevUp' : 'chevDown', 12) + '</button></div></div>' +
      body + '</div>';
  }

  function section(title, inner) {
    return '<div class="fsec"><div class="fsec-h">' + esc(title) + '</div>' + inner + '</div>';
  }

  function render() {
    const S = PBI.S;
    const pane = document.getElementById('filterspane');
    pane.classList.toggle('collapsed', !S.filtersOpen);
    if (!S.filtersOpen) {
      pane.innerHTML = '<button class="fpane-open" title="Expand Filters pane">' + icon('dblLeft', 14) + '<span class="vert">Filters</span></button>';
      pane.querySelector('.fpane-open').addEventListener('click', () => { S.filtersOpen = true; render(); PBI.shell.fit(); });
      return;
    }
    const page = PBI.pages[S.page];
    const match = f => !searchText || M.FIELDS[f].label.toLowerCase().includes(searchText.toLowerCase());
    let html = '<div class="fpane-h"><span>Filters</span><button class="fpane-close" title="Collapse Filters pane">' + icon('dblRight', 14) + '</button></div>' +
      '<div class="fpane-search">' + icon('search', 12) + '<input placeholder="Search" class="fpane-q" value="' + esc(searchText) + '"></div><div class="fpane-scroll">';
    if (page.drillthrough && S.drillthrough) {
      const dt = S.drillthrough;
      const locked = (label, sum) => '<div class="fcard active locked"><div class="fc-head"><div class="fc-t"><div class="fc-name">' + esc(label) + '</div>' +
        '<div class="fc-sum">' + esc(sum) + '</div></div><div class="fc-icons">' + icon('lock', 12) + '</div></div></div>';
      const kept = S.pageFilters[S.prevPage] || {};
      const keptCards = Object.keys(kept).filter(k => M.isActive(kept[k])).map(k => locked(M.FIELDS[k].label, M.describe(kept[k]) + ', kept from source page'));
      html += section('Drillthrough', locked(M.FIELDS[dt.field].label, 'is ' + dt.value) + keptCards.join('') +
        '<div class="fc-keep"><span class="sw on"><span></span></span>Keep all filters</div>' +
        '<div class="fc-keep"><span class="sw"><span></span></span>Cross-report</div>');
    }
    const v = S.selectedVisual && page.visuals.find(x => x.id === S.selectedVisual);
    if (v && v.fields && v.fields.length) html += section('Filters on this visual', v.fields.filter(match).map(f => cardHtml('visual', f)).join(''));
    if (page.filterFields && page.filterFields.length) html += section('Filters on this page', page.filterFields.filter(match).map(f => cardHtml('page', f)).join(''));
    html += section('Filters on all pages', ALL_PAGE_FIELDS.filter(match).map(f => cardHtml('all', f)).join(''));
    html += '</div>';
    pane.innerHTML = html;
    bind(pane);
  }

  function bind(pane) {
    const S = PBI.S;
    pane.querySelector('.fpane-close').addEventListener('click', () => { S.filtersOpen = false; render(); PBI.shell.fit(); });
    const q = pane.querySelector('.fpane-q');
    q.addEventListener('input', () => { searchText = q.value; render(); const n = document.querySelector('.fpane-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    pane.querySelectorAll('.fcard[data-field]').forEach(card => {
      const scope = card.dataset.scope, field = card.dataset.field, key = scope + ':' + field;
      const store = storeFor(scope);
      const F = M.FIELDS[field];
      card.querySelector('.fc-head').addEventListener('click', e => {
        if (e.target.closest('.fc-clear')) { delete store[field]; return PBI.app.update(); }
        S.fexpanded.has(key) ? S.fexpanded.delete(key) : S.fexpanded.add(key);
        render();
      });
      const typeSel = card.querySelector('.fc-type');
      if (typeSel) typeSel.addEventListener('change', () => {
        store[field] = typeSel.value === 'advanced' ? { field, type: 'advanced', op: 'contains', text: '' } : { field, type: 'basic', values: new Set() };
        PBI.app.update();
      });
      const fq = card.querySelector('.fc-q');
      if (fq) fq.addEventListener('input', () => {
        card.querySelectorAll('.fc-item[data-v]').forEach(it => { it.style.display = it.dataset.v.toLowerCase().includes(fq.value.toLowerCase()) ? '' : 'none'; });
      });
      card.querySelectorAll('.fc-item').forEach(it => it.addEventListener('click', e => {
        e.preventDefault();
        const values = F.values();
        const cur = store[field] && store[field].type === 'basic' ? store[field].values : new Set();
        let next;
        if (!it.dataset.v) next = cur.size === values.length ? new Set() : new Set(values);
        else {
          const raw = values.find(x => String(x) === it.dataset.v);
          next = new Set(cur);
          next.has(raw) ? next.delete(raw) : next.add(raw);
        }
        store[field] = { field, type: 'basic', values: next };
        PBI.app.update();
      }));
      const apply = card.querySelector('.fc-apply');
      if (apply) apply.addEventListener('click', () => {
        store[field] = { field, type: 'advanced', op: card.querySelector('.fc-op').value, text: card.querySelector('.fc-text').value.trim() };
        PBI.app.update();
      });
    });
  }

  PBI.filters = { render, ALL_PAGE_FIELDS, clearSearch: () => { searchText = ''; } };
})();
