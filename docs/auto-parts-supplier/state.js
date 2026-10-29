/* Report state and the single filter context function every visual reads through. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;

  let cardSeq = 0;
  function card(field, opts) {
    return Object.assign(
      {
        id: 'fc' + ++cardSeq,
        field,
        type: 'basic',
        values: null,
        op: 'is',
        advValue: '',
        topN: { dir: 'Top', n: 5, by: 'Downtime hours' },
        locked: false,
        expanded: false,
        implicit: false
      },
      opts || {}
    );
  }

  function initialState() {
    return {
      page: 'plant',
      prevPage: null,
      role: 'All plants',
      viewAs: false,
      fieldParam: 'OEE',
      slicers: {},
      selection: {},
      drill: {},
      sort: {},
      selectedVisual: null,
      spotlight: null,
      focus: null,
      drillthrough: null,
      fitMode: 'page',
      filterPaneOpen: true,
      play: { month: 11, playing: false, trace: new Set() },
      matrixExpanded: new Set(['Michigan']),
      filtersAll: [card('Fiscal year', { values: new Set(['FY26']), locked: true }), card('Plant'), card('Quarter')],
      filtersPage: {
        plant: [card('Process'), card('Line')],
        cost: [card('Category')],
        supplier: [card('Supplier'), card('PPAP')],
        rls: [card('Plant')],
        machine: []
      },
      filtersVisual: {
        'p1-pareto': [card('Reason', { type: 'topn', topN: { dir: 'Top', n: 5, by: 'Downtime hours' } })],
        'p1-g-mi': [card('Plant', { values: new Set(['Michigan']), locked: true })],
        'p1-g-oh': [card('Plant', { values: new Set(['Ohio']), locked: true })],
        'p1-g-mx': [card('Plant', { values: new Set(['Monterrey']), locked: true })],
        'p1-g-pl': [card('Plant', { values: new Set(['Wroclaw']), locked: true })]
      }
    };
  }

  let S = initialState();

  function rolePlant() {
    const role = M.ROLES.find(r => r.name === S.role);
    return role ? role.plant : null;
  }

  function cardToFilter(c) {
    if (c.type === 'topn') return null;
    if (c.type === 'advanced') {
      if (c.advValue === '' || c.advValue === null) return null;
      const all = M.FIELDS[c.field].values();
      const match = all.filter(v => String(v) === String(c.advValue));
      const keep = c.op === 'is' ? match : all.filter(v => String(v) !== String(c.advValue));
      return { field: c.field, values: new Set(keep), source: 'card', card: c };
    }
    if (!c.values || !c.values.size) return null;
    return { field: c.field, values: new Set(c.values), source: 'card', card: c };
  }

  function topNFilter(c, baseFilters) {
    const measure = M.MEASURES[c.topN.by];
    if (!measure) return null;
    const values = M.fieldValues(c.field, rolePlant());
    const scored = values
      .map(v => {
        const rows = M.filterRows(measure.table, baseFilters.concat([{ field: c.field, values: new Set([v]) }]));
        return { v, score: measure.fn(rows) };
      })
      .filter(x => x.score !== null);
    scored.sort((a, b) => (c.topN.dir === 'Top' ? b.score - a.score : a.score - b.score));
    const n = Math.max(1, parseInt(c.topN.n, 10) || 1);
    return { field: c.field, values: new Set(scored.slice(0, n).map(x => x.v)), source: 'topn', card: c };
  }

  /* Returns the filters that apply to a visual, with a label for each so the visual header
     filter icon can explain them. */
  function filterContext(pageId, visualId, opts) {
    const o = Object.assign({ selection: true, exclude: [] }, opts || {});
    const out = [];
    const plant = rolePlant();
    if (plant)
      out.push({ field: 'Plant', values: new Set([plant]), source: 'rls', label: 'Row-level security: ' + S.role });
    S.filtersAll.forEach(c => {
      const f = cardToFilter(c);
      if (f) out.push(Object.assign(f, { label: 'Filters on all pages' }));
    });
    (S.filtersPage[pageId] || []).forEach(c => {
      const f = cardToFilter(c);
      if (f) out.push(Object.assign(f, { label: 'Filters on this page' }));
    });
    const sl = S.slicers[pageId] || {};
    Object.keys(sl).forEach(field => {
      if (sl[field] && sl[field].size)
        out.push({ field, values: new Set(sl[field]), source: 'slicer', label: 'Slicer' });
    });
    if (pageId === 'machine' && S.drillthrough) {
      out.push({
        field: 'Machine',
        values: new Set([S.drillthrough.machine]),
        source: 'drillthrough',
        label: 'Drillthrough'
      });
    }
    const vcards = S.filtersVisual[visualId] || [];
    vcards.forEach(c => {
      const f = cardToFilter(c);
      if (f) out.push(Object.assign(f, { label: 'Filters on this visual' }));
    });
    const sel = S.selection[pageId];
    if (o.selection && sel && sel.visualId !== visualId) {
      out.push({
        field: sel.field,
        values: new Set(sel.values),
        source: 'selection',
        label: 'Cross-filter from ' + (sel.title || 'visual')
      });
    }
    const filtered = out.filter(f => o.exclude.indexOf(f.field) === -1);
    vcards
      .filter(c => c.type === 'topn' && o.exclude.indexOf(c.field) === -1)
      .forEach(c => {
        const f = topNFilter(
          c,
          filtered.filter(x => x.field !== c.field)
        );
        if (f) filtered.push(Object.assign(f, { label: 'Filters on this visual' }));
      });
    return filtered;
  }

  function select(pageId, visualId, title, field, value, multi) {
    const cur = S.selection[pageId];
    if (cur && cur.visualId === visualId && cur.field === field) {
      const vals = new Set(cur.values);
      if (multi) {
        if (vals.has(value)) vals.delete(value);
        else vals.add(value);
      } else if (vals.size === 1 && vals.has(value)) {
        vals.clear();
      } else {
        vals.clear();
        vals.add(value);
      }
      S.selection[pageId] = vals.size ? { visualId, title, field, values: vals } : null;
    } else {
      S.selection[pageId] = { visualId, title, field, values: new Set([value]) };
    }
  }

  window.PBI_STATE = {
    get S() {
      return S;
    },
    reset() {
      const keepPage = S.page,
        role = S.role,
        viewAs = S.viewAs;
      S = initialState();
      S.role = role;
      S.viewAs = viewAs;
      S.page = keepPage === 'machine' ? 'plant' : keepPage;
    },
    /* Bookmark reset: every piece of report state returns to default, including View as.
       The zoom mode is a viewer setting and is kept. */
    resetFull() {
      const fitMode = S.fitMode;
      S = initialState();
      S.fitMode = fitMode;
    },
    card,
    rolePlant,
    filterContext,
    select
  };
})();
