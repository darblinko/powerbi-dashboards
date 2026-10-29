/* Report bookmarks: definitions, apply (reset then patch), the Bookmarks menu and the bottom bookmark bar. */
(function () {
  'use strict';
  const M = window.MODEL,
    F = window.FRAME,
    P = window.PAGES;
  const withFilter = P.withFilter;

  /* Each patch is applied on top of the author's default state, so no earlier state leaks through. */
  const LIST = [
    {
      name: 'Texas spike, Aug 2026',
      patch: () => ({ page: 'p1', selection: { vid: 'map', field: 'state', values: ['Texas'], page: 'p1' } })
    },
    {
      name: 'Paid search pause, Jun 2025',
      patch: s => ({
        page: 'p1',
        dateRel: { n: 24, unit: 'M' },
        filters: withFilter(s.filters, 'all', 'channel', ['Paid search'])
      })
    },
    {
      name: 'Revenue by quarter, 3 years',
      patch: () => ({
        page: 'p1',
        dateRel: { n: 3, unit: 'Y' },
        drill: { level: 1, mode: 'expand', parent: [], drillMode: false }
      })
    },
    { name: 'Category returns table', patch: () => ({ page: 'p1', tableMode: true }) },
    { name: 'Electronics customer retention', patch: () => ({ page: 'p2', slicerCat: ['Electronics'] }) },
    { name: 'Churn key influencers', patch: () => ({ page: 'p2', kiTab: 'influencers', kiSelected: 0, focus: 'ki' }) },
    { name: 'Top churn segments', patch: () => ({ page: 'p2', kiTab: 'segments', segSelected: 0 }) },
    {
      name: 'Electronics returns, Feb-Mar 2026',
      patch: () => ({ page: 'p3', qna: 'return rate by month for electronics' })
    },
    { name: 'Mobile checkout funnel', patch: () => ({ page: 'p3', slicerDevice: 'Mobile', spotlight: 'funnel' }) },
    {
      name: '20% discount, Electronics margin',
      patch: s => ({ page: 'p3', whatIf: 20, filters: withFilter(s.filters, 'p3', 'category', ['Electronics']) })
    }
  ];

  let barOpen = false;

  function activeFilterKeys(filters) {
    const keys = [];
    Object.keys(filters).forEach(scope =>
      Object.keys(filters[scope]).forEach(field => {
        if (F.filterText(filters[scope][field])) keys.push(scope + ':' + field + ':');
      })
    );
    return keys;
  }

  function apply(b) {
    const C = window.CHROME;
    F.closeMenu();
    F.hideTip();
    const base = M.defaultState();
    const next = Object.assign({}, base, b.patch(base), { bookmark: b.name });
    C.ui.search = '';
    C.ui.filtersOpen = true;
    C.ui.expanded = new Set(activeFilterKeys(next.filters));
    M.setState(next, { rebuild: true });
    window.APP.fit();
    if (!barOpen) F.toast('Bookmark applied: ' + b.name);
  }

  function currentIndex() {
    const name = M.getState().bookmark;
    return LIST.findIndex(b => b.name === name);
  }

  function step(delta) {
    const i = currentIndex();
    const next = i < 0 ? 0 : (i + delta + LIST.length) % LIST.length;
    apply(LIST[next]);
  }

  function openBar() {
    barOpen = true;
    if (currentIndex() < 0) apply(LIST[0]);
    else {
      renderBar();
      window.APP.fit();
    }
  }

  function closeBar() {
    barOpen = false;
    renderBar();
    window.APP.fit();
  }

  function menuItems() {
    const cur = M.getState().bookmark;
    return [{ header: 'Report bookmarks' }]
      .concat(LIST.map(b => ({ label: b.name, checked: cur === b.name, action: () => apply(b) })))
      .concat(['-', { label: 'View', action: openBar }]);
  }

  const arrow = d =>
    '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="' +
    d +
    '" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  function renderBar() {
    const el = document.getElementById('bookmarkBar');
    if (!el) return;
    el.hidden = !barOpen;
    if (!barOpen) {
      el.innerHTML = '';
      return;
    }
    const i = currentIndex();
    const name = i < 0 ? 'No bookmark applied' : LIST[i].name;
    el.innerHTML =
      '<span class="bb-label">Bookmarks</span><div class="bb-center">' +
      '<button class="bb-btn bb-prev" aria-label="Previous bookmark" title="Previous bookmark">' +
      arrow('M10 3L5 8l5 5') +
      '</button>' +
      '<span class="bb-name">' +
      F.escapeHtml(name) +
      '</span>' +
      '<button class="bb-btn bb-next" aria-label="Next bookmark" title="Next bookmark">' +
      arrow('M6 3l5 5-5 5') +
      '</button>' +
      '<span class="bb-count">' +
      (i < 0 ? '-' : i + 1) +
      ' of ' +
      LIST.length +
      '</span></div>' +
      '<button class="bb-btn bb-close" aria-label="Close bookmark bar" title="Close">' +
      arrow('M4 4l8 8M12 4l-8 8') +
      '</button>';
    el.querySelector('.bb-prev').addEventListener('click', () => step(-1));
    el.querySelector('.bb-next').addEventListener('click', () => step(1));
    el.querySelector('.bb-close').addEventListener('click', closeBar);
  }

  window.BOOKMARKS = { LIST, apply, menuItems, renderBar, openBar, closeBar, step };
})();
