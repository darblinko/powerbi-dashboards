/* Filters pane: Filters on this visual, on this page, on all pages, and the drillthrough section. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const icon = window.PBI_ICON;
  const esc = PBI.esc;

  function summary(c) {
    if (c.type === 'topn') return (c.topN.dir === 'Top' ? 'Top ' : 'Bottom ') + c.topN.n + ' by ' + c.topN.by;
    if (c.type === 'advanced') return c.advValue === '' ? 'is (All)' : c.op + ' ' + M.valueLabel(c.field, c.advValue);
    if (!c.values || !c.values.size) return 'is (All)';
    return 'is ' + [...c.values].map(v => M.valueLabel(c.field, v)).join(', ');
  }
  function isApplied(c) {
    return (
      c.type === 'topn' ||
      (c.type === 'advanced' && c.advValue !== '') ||
      (c.type === 'basic' && c.values && c.values.size > 0)
    );
  }
  function measureOptions(field) {
    return Object.keys(M.MEASURES).filter(n => M.TABLE_SETS[M.MEASURES[n].table].has(field));
  }

  function bodyHtml(c, allowTopN) {
    const types = ['basic', 'advanced'].concat(allowTopN ? ['topn'] : []);
    const typeLabel = { basic: 'Basic filtering', advanced: 'Advanced filtering', topn: 'Top N' };
    let h =
      '<div class="fc-label">Filter type</div><select data-r="type"' +
      (c.locked ? ' disabled' : '') +
      '>' +
      types
        .map(t => '<option value="' + t + '"' + (c.type === t ? ' selected' : '') + '>' + typeLabel[t] + '</option>')
        .join('') +
      '</select>';
    const values = M.fieldValues(c.field, ST.rolePlant());
    if (c.type === 'basic') {
      if (values.length > 8)
        h += '<div class="fc-label">Search</div><input type="text" data-r="search" placeholder="Search">';
      h +=
        '<div class="fc-list"><label class="fc-item"><input type="checkbox" data-r="all"' +
        (!c.values || !c.values.size ? ' checked' : '') +
        (c.locked ? ' disabled' : '') +
        '>Select all</label>' +
        values
          .map(
            v =>
              '<label class="fc-item" data-name="' +
              esc(String(M.valueLabel(c.field, v)).toLowerCase()) +
              '"><input type="checkbox" data-r="val" data-v="' +
              esc(v) +
              '"' +
              (c.values && c.values.has(v) ? ' checked' : '') +
              (c.locked ? ' disabled' : '') +
              '>' +
              esc(M.valueLabel(c.field, v)) +
              '</label>'
          )
          .join('') +
        '</div>';
    } else if (c.type === 'advanced') {
      h +=
        '<div class="fc-label">Show items when the value</div><select data-r="op"><option' +
        (c.op === 'is' ? ' selected' : '') +
        '>is</option><option' +
        (c.op === 'is not' ? ' selected' : '') +
        '>is not</option></select>' +
        '<div style="height:6px"></div><select data-r="adv"><option value="">(Select a value)</option>' +
        values
          .map(
            v =>
              '<option value="' +
              esc(v) +
              '"' +
              (String(c.advValue) === String(v) ? ' selected' : '') +
              '>' +
              esc(M.valueLabel(c.field, v)) +
              '</option>'
          )
          .join('') +
        '</select>' +
        '<span class="fc-apply" data-r="apply">Apply filter</span>';
    } else {
      h +=
        '<div class="fc-label">Show items</div><div class="fc-row"><select data-r="dir"><option' +
        (c.topN.dir === 'Top' ? ' selected' : '') +
        '>Top</option><option' +
        (c.topN.dir === 'Bottom' ? ' selected' : '') +
        '>Bottom</option></select>' +
        '<input type="number" min="1" max="20" data-r="n" value="' +
        c.topN.n +
        '"></div><div class="fc-label">By value</div><select data-r="by">' +
        measureOptions(c.field)
          .map(n => '<option' + (c.topN.by === n ? ' selected' : '') + '>' + esc(n) + '</option>')
          .join('') +
        '</select>' +
        '<span class="fc-apply" data-r="apply">Apply filter</span>';
    }
    return h;
  }

  function cardHtml(c, allowTopN) {
    return (
      '<div class="fcard' +
      (isApplied(c) && !c.locked ? ' applied' : '') +
      '" data-id="' +
      c.id +
      '"><div class="fc-head" data-r="toggle"><span class="fc-name">' +
      esc(M.fieldDisplay(c.field)) +
      '</span>' +
      (c.locked
        ? '<button title="Locked">' + icon('lock', 13) + '</button>'
        : '<button data-r="clear" title="Clear filter">' + icon('eraser', 13) + '</button>') +
      '<button title="Expand or collapse filter card">' +
      icon(c.expanded ? 'chevronUp' : 'chevronDown', 13) +
      '</button></div>' +
      '<div class="fc-sum" data-r="toggle">' +
      esc(summary(c)) +
      '</div>' +
      (c.expanded ? '<div class="fc-body">' + bodyHtml(c, allowTopN) + '</div>' : '') +
      '</div>'
    );
  }

  function wireCard(el, c) {
    const changed = () => {
      ST.S.selection[PBI.app.pageId()] = null;
      PBI.app.refresh();
    };
    el.querySelectorAll('[data-r="toggle"]').forEach(t =>
      t.addEventListener('click', ev => {
        if (ev.target.closest('[data-r="clear"]')) return;
        c.expanded = !c.expanded;
        render();
      })
    );
    const clr = el.querySelector('[data-r="clear"]');
    if (clr)
      clr.addEventListener('click', ev => {
        ev.stopPropagation();
        Object.assign(c, { type: 'basic', values: null, advValue: '', op: 'is' });
        changed();
      });
    const type = el.querySelector('[data-r="type"]');
    if (type)
      type.addEventListener('change', () => {
        c.type = type.value;
        c.values = null;
        c.advValue = '';
        if (c.type === 'topn') c.topN = { dir: 'Top', n: 5, by: measureOptions(c.field)[0] || 'Downtime hours' };
        changed();
      });
    const all = el.querySelector('[data-r="all"]');
    if (all)
      all.addEventListener('change', () => {
        c.values = null;
        changed();
      });
    el.querySelectorAll('[data-r="val"]').forEach(cb =>
      cb.addEventListener('change', () => {
        const values = M.fieldValues(c.field, ST.rolePlant());
        const picked = new Set();
        el.querySelectorAll('[data-r="val"]').forEach(x => {
          if (x.checked) picked.add(values.find(v => String(v) === x.dataset.v));
        });
        c.values = picked.size && picked.size < values.length ? picked : null;
        changed();
      })
    );
    const search = el.querySelector('[data-r="search"]');
    if (search)
      search.addEventListener('input', () => {
        const q = search.value.toLowerCase();
        el.querySelectorAll('.fc-item[data-name]').forEach(it => {
          it.style.display = it.dataset.name.indexOf(q) >= 0 ? '' : 'none';
        });
      });
    const apply = el.querySelector('[data-r="apply"]');
    if (apply)
      apply.addEventListener('click', () => {
        if (c.type === 'advanced') {
          c.op = el.querySelector('[data-r="op"]').value;
          c.advValue = el.querySelector('[data-r="adv"]').value;
        }
        if (c.type === 'topn') {
          c.topN = {
            dir: el.querySelector('[data-r="dir"]').value,
            n: Math.max(1, Math.min(20, parseInt(el.querySelector('[data-r="n"]').value, 10) || 5)),
            by: el.querySelector('[data-r="by"]').value
          };
        }
        changed();
      });
  }

  function ensureImplicit(v) {
    const S = ST.S;
    const list = (S.filtersVisual[v.id] || []).slice();
    (v.fields || []).forEach(f => {
      if (M.FIELDS[f] && !list.some(c => c.field === f)) list.push(ST.card(f, { implicit: true }));
    });
    S.filtersVisual[v.id] = list;
    return list;
  }

  function section(title, cards, allowTopN, extraHtml) {
    const wrap = document.createElement('div');
    wrap.className = 'fp-section';
    wrap.innerHTML = '<div class="fp-sec-title">' + esc(title) + '</div>' + (extraHtml || '');
    if (!cards.length && !extraHtml)
      wrap.insertAdjacentHTML('beforeend', '<div class="fp-empty">Add data fields here</div>');
    cards.forEach(c => {
      const holder = document.createElement('div');
      holder.innerHTML = cardHtml(c, allowTopN);
      const el = holder.firstChild;
      wireCard(el, c);
      wrap.appendChild(el);
    });
    return wrap;
  }

  let searchText = '';
  function render() {
    const S = ST.S;
    const pane = document.getElementById('filterpane');
    pane.className = S.filterPaneOpen ? '' : 'collapsed';
    if (!S.filterPaneOpen) {
      pane.innerHTML =
        '<div class="fp-head" style="padding:0;justify-content:center"><button title="Expand">' +
        icon('chevronDoubleLeft', 14) +
        '</button></div><div class="fp-vtitle">Filters</div>';
      pane.querySelectorAll('button, .fp-vtitle').forEach(b =>
        b.addEventListener('click', () => {
          S.filterPaneOpen = true;
          render();
          PBI.app.fit();
        })
      );
      return;
    }
    pane.innerHTML =
      '<div class="fp-head"><span class="fp-title">Filters</span><button title="Collapse">' +
      icon('chevronDoubleRight', 14) +
      '</button></div>' +
      '<div class="fp-search">' +
      icon('search', 13) +
      '<input type="text" placeholder="Search" value="' +
      esc(searchText) +
      '"></div><div class="fp-body"></div>';
    pane.querySelector('.fp-head button').addEventListener('click', () => {
      S.filterPaneOpen = false;
      render();
      PBI.app.fit();
    });
    const input = pane.querySelector('.fp-search input');
    input.addEventListener('input', () => {
      searchText = input.value;
      pane.querySelectorAll('.fcard').forEach(fc => {
        fc.style.display =
          fc.querySelector('.fc-name').textContent.toLowerCase().indexOf(searchText.toLowerCase()) >= 0 ? '' : 'none';
      });
    });
    const body = pane.querySelector('.fp-body');
    const page = PBI.app.page();
    if (page.drillthrough && S.drillthrough) {
      body.appendChild(
        section(
          'Drillthrough',
          [ST.card('Machine', { values: new Set([S.drillthrough.machine]), locked: true })],
          false,
          '<div class="fp-empty">Keep all filters: On. Cross-report: Off.</div>'
        )
      );
    }
    const v =
      S.selectedVisual && !S.focus
        ? page.visuals.find(x => x.id === S.selectedVisual)
        : S.focus
          ? page.visuals.find(x => x.id === S.focus.visualId)
          : null;
    if (v) body.appendChild(section('Filters on this visual', ensureImplicit(v), true));
    body.appendChild(section('Filters on this page', S.filtersPage[page.id] || [], false));
    body.appendChild(section('Filters on all pages', S.filtersAll, false));
    if (searchText) input.dispatchEvent(new Event('input'));
  }

  PBI.filterPane = {
    render,
    clearSearch() {
      searchText = '';
    }
  };
})();
