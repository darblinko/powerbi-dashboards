/* Report bookmarks: the definitions, the Bookmarks menu items and the bottom bookmark bar.
   Applying a bookmark resets every piece of report state first, including View as, so the
   result does not depend on what was shown before. */
(function () {
  'use strict';
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const icon = window.PBI_ICON;
  const esc = PBI.esc;

  const set = (...values) => new Set(values);
  /* Replaces the filter card for a field with a copy carrying the bookmark's values. */
  function withCard(cards, field, changes) {
    return cards.map(c => (c.field === field ? Object.assign({}, c, changes, { expanded: true }) : c));
  }
  const drill = (level, path) => ({ level, path, expanded: false, mode: false });

  const BOOKMARKS = [
    {
      name: 'MX-S2 downtime hours by machine, Jun 2026',
      apply: S => {
        S.page = 'plant';
        S.fieldParam = 'Downtime hours';
        S.drill['p1-drill'] = drill(2, ['Monterrey', 'MX-S2']);
        S.selection.plant = { visualId: 'p1-line', title: 'Downtime hours by Month and Plant', field: 'Month', values: set(8) };
      }
    },
    {
      name: 'Stamping scrap % by plant, Wroclaw and Monterrey spikes',
      apply: S => {
        S.page = 'plant';
        S.fieldParam = 'Scrap %';
        S.filtersPage.plant = withCard(S.filtersPage.plant, 'Process', { values: set('Stamping') });
        S.drill['p1-drill'] = drill(1, []);
      }
    },
    {
      name: 'Wroclaw Q1 2026, top 3 downtime reasons',
      apply: S => {
        S.page = 'plant';
        S.fieldParam = 'Downtime hours';
        S.slicers.plant = { Plant: set('Wroclaw'), Quarter: set('Q1 2026') };
        S.drill['p1-drill'] = drill(2, []);
        S.filtersVisual['p1-pareto'] = withCard(S.filtersVisual['p1-pareto'], 'Reason', { topN: { dir: 'Top', n: 3, by: 'Downtime hours' } });
        S.selectedVisual = 'p1-pareto';
      }
    },
    {
      name: 'MX-S2-P01 machine detail, hydraulic failures',
      apply: S => {
        S.page = 'machine';
        S.drillthrough = { machine: 'MX-S2-P01', from: 'plant' };
      }
    },
    {
      name: 'Wroclaw energy overrun, Jan to Feb 2026',
      apply: S => {
        S.page = 'cost';
        S.matrixExpanded = set('Wroclaw');
        S.selection.cost = { visualId: 'p2-cat', title: 'Variance % by Category', field: 'Category', values: set('Energy') };
      }
    },
    {
      name: 'Michigan premium freight, Q3 2026',
      apply: S => {
        S.page = 'cost';
        S.slicers.cost = { Plant: set('Michigan'), Quarter: set('Q3 2026') };
        S.spotlight = 'p2-wf';
      }
    },
    {
      name: 'Ohio cost variance by category, overtime Q4 2025',
      apply: S => {
        S.page = 'cost';
        S.drill['p2-matrix'] = drill(1, ['Ohio']);
        S.focus = { visualId: 'p2-matrix', table: false };
      }
    },
    {
      name: 'Northwind Castings PPM spike, Mar to May 2026',
      apply: S => {
        S.page = 'supplier';
        S.play.month = 7;
        S.selection.supplier = { visualId: 'p3-scatter', title: 'Supplier PPM and On-time delivery % by Supplier', field: 'Supplier', values: set('Northwind Castings') };
      }
    },
    {
      name: 'Suppliers with Interim or Rejected PPAP, by PPM',
      apply: S => {
        S.page = 'supplier';
        S.filtersPage.supplier = withCard(S.filtersPage.supplier, 'PPAP', { values: set('Interim', 'Rejected') });
        S.sort['p3-score'] = { by: 'PPM', dir: 'desc' };
      }
    },
    {
      name: 'View as Monterrey plant manager role',
      apply: S => {
        S.page = 'rls';
        S.role = 'Plant Manager - Monterrey';
        S.viewAs = true;
      }
    }
  ];

  let current = -1;
  let barOpen = false;

  function apply(index) {
    const b = BOOKMARKS[index];
    if (!b) return;
    PBI.app.stopPlay();
    PBI.closePopups();
    ST.resetFull();
    PBI.filterPane.clearSearch();
    b.apply(ST.S);
    current = index;
    PBI.app.syncRoleUi();
    document.getElementById('pagehost').scrollTop = 0;
    renderBar();
    PBI.app.renderPage();
  }
  function step(delta) {
    const n = BOOKMARKS.length;
    apply(current < 0 ? (delta > 0 ? 0 : n - 1) : (current + delta + n) % n);
  }

  function barEl() {
    let bar = document.getElementById('bmbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bmbar';
      bar.hidden = true;
      document.getElementById('statusbar').insertAdjacentElement('beforebegin', bar);
    }
    return bar;
  }
  function renderBar() {
    const bar = barEl();
    const wasHidden = bar.hidden;
    bar.hidden = !barOpen;
    if (barOpen) {
      const name = current >= 0 ? BOOKMARKS[current].name : 'Select a bookmark';
      const pos = current >= 0 ? (current + 1) + ' of ' + BOOKMARKS.length : BOOKMARKS.length + ' bookmarks';
      bar.innerHTML = '<span class="bm-spacer"></span><button class="bm-btn" data-b="prev" title="Previous bookmark">' + icon('chevronLeft', 14) + '</button>' +
        '<span class="bm-name">' + esc(name) + '</span><span class="bm-pos">' + esc(pos) + '</span>' +
        '<button class="bm-btn" data-b="next" title="Next bookmark">' + icon('chevronRight', 14) + '</button><span class="bm-spacer"></span>' +
        '<button class="bm-btn bm-close" data-b="close" title="Close bookmark bar">' + icon('close', 14) + '</button>';
      bar.querySelectorAll('[data-b]').forEach(btn => btn.addEventListener('click', ev => {
        ev.stopPropagation();
        const kind = btn.dataset.b;
        if (kind === 'close') { barOpen = false; renderBar(); } else step(kind === 'next' ? 1 : -1);
      }));
    }
    if (wasHidden !== bar.hidden) PBI.app.fit();
  }
  function openBar() {
    barOpen = true;
    if (current < 0) apply(0); else renderBar();
  }

  function menuItems() {
    return [{ header: 'Report bookmarks' }]
      .concat(BOOKMARKS.map((b, i) => ({ label: b.name, icon: 'bookmark', checked: i === current, action: () => apply(i) })))
      .concat(['-', { label: 'View', icon: 'view', action: openBar }, '-']);
  }

  PBI.bookmarks = {
    list: BOOKMARKS.map(b => b.name),
    apply, step, openBar, menuItems,
    current: () => current,
    clearCurrent() { current = -1; renderBar(); }
  };
})();
