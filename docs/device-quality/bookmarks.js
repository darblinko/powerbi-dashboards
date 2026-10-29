/* bookmarks.js: report bookmarks, the Bookmarks menu and the bookmark bar (View mode). */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const icon = PBI.icon;
  const esc = PBI.charts.esc;
  const name = code => D.PRODUCT_BY_CODE[code].name;
  const MODEL_B = name('PMB');
  const CHARGER = name('CHG');

  const basic = (field, values) => ({ field, type: 'basic', values: new Set(values) });
  const selection = (page, visualId, filters) => ({
    page,
    visualId,
    filters: filters.map(([field, values]) => ({ field, values: new Set(values) }))
  });
  function range(S, from, to) {
    S.slicers.from = from;
    S.slicers.to = to;
  }

  // A reportable Model B premature depletion complaint from Aug 2025 with a filed MDR and a CAPA link.
  function depletionComplaint() {
    return (
      D.complaints.find(
        c =>
          c.product === MODEL_B &&
          c.subMode === 'Premature depletion' &&
          c.month === 19 &&
          c.capaId &&
          c.reportable === 'Yes' &&
          c.mdrFiled &&
          c.daysToDecision >= 8
      ) ||
      D.complaints.find(
        c => c.product === MODEL_B && c.subMode === 'Premature depletion' && c.month === 19 && c.capaId
      ) ||
      D.complaints.find(c => c.product === MODEL_B && c.subMode === 'Premature depletion')
    );
  }

  function definitions() {
    const cmp = depletionComplaint();
    return [
      {
        name: 'Model B complaints by month, 2025 Qtr 3',
        page: 'overview',
        state: S => {
          S.slicers.products.add(MODEL_B);
          S.drill.colDate = {
            level: 2,
            path: [
              { field: 'year', value: 2025 },
              { field: 'yq', value: '2025 Qtr 3' }
            ],
            mode: true,
            expanded: false
          };
          S.expand.mxFail = new Set(['Battery']);
        }
      },
      {
        name: 'Model B battery complaint rate, 2025',
        page: 'trending',
        state: S => {
          S.slicers.products.add(MODEL_B);
          range(S, 12, 23);
          S.pageFilters.trending.failureMode = basic('failureMode', ['Battery']);
          S.fexpanded.add('page:failureMode');
        }
      },
      {
        name: 'Late MDRs, Q1 2026',
        page: 'trending',
        state: S => {
          range(S, 24, 26);
          S.visualFilters.mdrTable = { reportable: basic('reportable', ['Yes']) };
          S.selectedVisual = 'mdrTable';
          S.sort.mdrTable = { by: 6, dir: 'desc' };
        }
      },
      {
        name: 'Charger battery complaints, Europe, Q1 2026',
        page: 'overview',
        state: S => {
          S.slicers.products.add(CHARGER);
          S.slicers.regions.add('Europe');
          range(S, 24, 26);
          S.selection = selection('overview', 'mxFail', [['failureMode', ['Battery']]]);
        }
      },
      {
        name: 'Charger complaint detail, Europe, Feb to Mar 2026',
        page: 'detail',
        state: S => {
          S.prevPage = 'trending';
          S.drillthrough = { field: 'product', value: CHARGER };
          S.slicers.regions.add('Europe');
          range(S, 25, 26);
          S.pageFilters.trending.failureMode = basic('failureMode', ['Battery']);
        }
      },
      {
        name: 'Complaint ' + cmp.id + ', Model B depletion',
        page: 'detail',
        state: S => {
          S.prevPage = 'trending';
          S.drillthrough = { field: 'complaintId', value: cmp.id };
        }
      },
      {
        name: 'Infusion device CAPAs open over 90 days',
        page: 'capa',
        state: S => {
          S.allFilters.family = basic('family', ['Infusion device']);
          S.fexpanded.add('all:family');
          S.selection = selection('capa', 'aging', [['agingBucket', ['90+']]]);
        }
      },
      {
        name: 'Model B complaint CAPAs by root cause and process',
        page: 'capa',
        state: S => {
          S.slicers.products.add(MODEL_B);
          S.decomp = { levels: ['source', 'rootCause', 'process'], picks: ['Complaint', 'Supplier material'], ai: [] };
          S.selection = selection('capa', 'decomp', [
            ['source', ['Complaint']],
            ['rootCause', ['Supplier material']]
          ]);
        }
      },
      {
        name: 'CAPA days open and severity, Model B and Charger',
        page: 'capa',
        state: S => {
          S.slicers.products.add(MODEL_B);
          S.slicers.products.add(CHARGER);
          S.focus = { vid: 'scatter', table: false };
        }
      },
      {
        name: 'Model B first pass yield, May to Jul 2025',
        page: 'overview',
        state: S => {
          S.slicers.products.add(MODEL_B);
          range(S, 16, 18);
          S.spotlight = 'kFpy';
          S.selectedVisual = 'kFpy';
        }
      }
    ];
  }

  let list = null;
  let current = -1;
  let barOpen = false;
  function all() {
    if (!list) list = definitions();
    return list;
  }

  // Every piece of report state is rebuilt from the default before the bookmark state is applied.
  function apply(index) {
    const b = all()[index];
    const S = PBI.app.initialState(null);
    S.page = b.page;
    b.state(S);
    PBI.frame.closeMenus();
    PBI.frame.closeModal();
    PBI.tooltipPage.hide();
    PBI.filters.clearSearch();
    PBI.S = S;
    current = index;
    PBI.shell.renderPagesPane();
    renderBar();
    PBI.app.rebuild();
  }

  function renderBar() {
    const content = document.getElementById('content');
    let bar = document.getElementById('bmbar');
    if (!barOpen) {
      if (bar) {
        bar.remove();
        PBI.shell.fit();
      }
      return;
    }
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'bmbar';
      content.appendChild(bar);
    }
    const n = all().length;
    const b = all()[current];
    bar.innerHTML =
      '<div class="bm-nav">' +
      '<button class="bm-prev" title="Previous bookmark">' +
      icon('chevLeft', 14) +
      '</button>' +
      '<span class="bm-name" title="' +
      esc(b.name) +
      '">' +
      esc(b.name) +
      '</span>' +
      '<button class="bm-next" title="Next bookmark">' +
      icon('chevRight', 14) +
      '</button></div>' +
      '<span class="bm-count">' +
      (current + 1) +
      ' of ' +
      n +
      '</span>' +
      '<button class="bm-close" title="Exit">' +
      icon('close', 12) +
      '</button>';
    bar.querySelector('.bm-prev').addEventListener('click', () => apply((current - 1 + n) % n));
    bar.querySelector('.bm-next').addEventListener('click', () => apply((current + 1) % n));
    bar.querySelector('.bm-close').addEventListener('click', closeBar);
    PBI.shell.fit();
  }
  function openBar() {
    barOpen = true;
    apply(current < 0 ? 0 : current);
  }
  function closeBar() {
    barOpen = false;
    renderBar();
  }

  function menuItems() {
    return [{ head: 'Report bookmarks' }]
      .concat(
        all().map((b, i) => ({
          label: b.name,
          icon: 'bookmark',
          checked: i === current,
          action: () => {
            apply(i);
            PBI.shell.toast('Bookmark applied: ' + b.name);
          }
        }))
      )
      .concat([
        { sep: true },
        { label: 'View', icon: 'view', checked: barOpen, action: () => (barOpen ? closeBar() : openBar()) },
        { sep: true },
        { label: 'Add a personal bookmark', disabled: true },
        { label: 'Show more bookmarks', disabled: true }
      ]);
  }

  PBI.bookmarks = { list: all, apply, menuItems, openBar, closeBar, current: () => current };
})();
