/* shell.js: Power BI Service chrome, Pages pane, canvas scaling, toasts. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const icon = PBI.icon;
  const esc = PBI.charts.esc;
  const PAGE_W = 1280,
    PAGE_H = 720;
  const WORKSPACE = 'Device Quality';
  const REPORT = 'Quality and Post-Market Surveillance';

  function topBar() {
    return (
      '<div class="tb-left"><button class="tb-waffle" title="App launcher">' +
      icon('waffle', 16) +
      '</button>' +
      '<span class="tb-brand">Dashboard Demo</span><span class="tb-sep"></span>' +
      '<span class="tb-crumb"><a>' +
      WORKSPACE +
      '</a>' +
      icon('chevRight', 10) +
      '<a class="cur">' +
      REPORT +
      '</a>' +
      icon('chevDown', 10) +
      '</span></div>' +
      '<div class="tb-search">' +
      icon('search', 14) +
      '<input placeholder="Search"></div>' +
      '<div class="tb-right">' +
      ['bell', 'gear', 'download', 'help', 'feedback']
        .map(n => '<button class="tb-ic" title="' + n + '">' + icon(n, 16) + '</button>')
        .join('') +
      '<span class="tb-avatar" title="Demo user">QA</span></div>'
    );
  }

  function actionBar() {
    const L = [
      ['file', 'File', true],
      ['exportI', 'Export', true],
      ['share', 'Share'],
      ['teams', 'Chat'],
      ['insights', 'Get insights'],
      ['subscribe', 'Subscribe to report'],
      ['edit', 'Edit']
    ];
    const R = [
      ['reset', 'Reset to default'],
      ['bookmark', 'Bookmarks', true],
      ['view', 'View', true],
      ['refresh', 'Refresh visuals'],
      ['comment', 'Comments'],
      ['star', '']
    ];
    const b = it =>
      '<button class="ab-btn" data-ab="' +
      it[1] +
      '">' +
      icon(it[0], 15) +
      (it[1] ? '<span>' + it[1] + '</span>' : '') +
      (it[2] ? icon('chevDown', 10) : '') +
      '</button>';
    return (
      '<div class="ab-left">' +
      L.map(b).join('') +
      '<span class="ab-sep"></span><span class="ab-upd">Data updated 10/1/26</span></div>' +
      '<div class="ab-right">' +
      R.map(b).join('') +
      '</div>'
    );
  }

  function rail() {
    const items = [
      ['home', 'Home'],
      ['create', 'Create'],
      ['browse', 'Browse'],
      ['onelake', 'Data hub'],
      ['apps', 'Apps'],
      ['workspaces', 'Workspaces'],
      ['report', 'Device Quality']
    ];
    return items
      .map(
        (it, i) =>
          '<button class="rail-btn' +
          (i === 6 ? ' on' : '') +
          '" title="' +
          it[1] +
          '">' +
          icon(it[0], 18) +
          '<span>' +
          it[1] +
          '</span></button>'
      )
      .join('');
  }

  function renderPagesPane() {
    const S = PBI.S;
    const pane = document.getElementById('pagespane');
    pane.classList.toggle('collapsed', !S.pagesOpen);
    if (!S.pagesOpen) {
      pane.innerHTML = '<button class="pp-open" title="Expand Pages pane">' + icon('dblRight', 14) + '</button>';
      pane.querySelector('.pp-open').addEventListener('click', () => {
        S.pagesOpen = true;
        renderPagesPane();
        fit();
      });
      return;
    }
    const visible = PBI.pageOrder.filter(id => !PBI.pages[id].hidden);
    pane.innerHTML =
      '<div class="pp-h"><span>Pages</span><button class="pp-close" title="Collapse Pages pane">' +
      icon('dblLeft', 14) +
      '</button></div>' +
      visible
        .map(
          id =>
            '<div class="pp-item' +
            (id === S.page ? ' on' : '') +
            '" data-page="' +
            id +
            '">' +
            esc(PBI.pages[id].name) +
            '</div>'
        )
        .join('');
    pane.querySelector('.pp-close').addEventListener('click', () => {
      S.pagesOpen = false;
      renderPagesPane();
      fit();
    });
    pane
      .querySelectorAll('.pp-item')
      .forEach(it => it.addEventListener('click', () => PBI.app.goPage(it.dataset.page)));
  }

  function fit() {
    const S = PBI.S;
    const wrap = document.getElementById('canvaswrap');
    const holder = document.getElementById('pageholder');
    const page = document.getElementById('page');
    const availW = wrap.clientWidth - 32,
      availH = wrap.clientHeight - 32;
    let s = Math.min(availW / PAGE_W, availH / PAGE_H);
    if (S.view === 'width') s = availW / PAGE_W;
    if (S.view === 'actual') s = 1;
    s = Math.max(0.3, s);
    page.style.transform = 'scale(' + s + ')';
    holder.style.width = Math.round(PAGE_W * s) + 'px';
    holder.style.height = Math.round(PAGE_H * s) + 'px';
    wrap.classList.toggle('scrolls', S.view !== 'fit');
    PBI.scale = s;
    const zoom = document.getElementById('zoomlbl');
    if (zoom) zoom.textContent = Math.round(s * 100) + '%';
  }

  let toastTimer = null;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2600);
  }

  function onAction(name, btnEl) {
    const S = PBI.S;
    const r = btnEl.getBoundingClientRect();
    const at = items => PBI.frame.popup(items, r.left, r.bottom + 2);
    switch (name) {
      case 'Reset to default':
        PBI.app.reset();
        toast('Report reset to the default view');
        break;
      case 'Refresh visuals':
        PBI.app.rebuild();
        toast('Visuals refreshed');
        break;
      case 'View':
        at([
          {
            label: 'Fit to page',
            checked: S.view === 'fit',
            action: () => {
              S.view = 'fit';
              fit();
            }
          },
          {
            label: 'Fit to width',
            checked: S.view === 'width',
            action: () => {
              S.view = 'width';
              fit();
            }
          },
          {
            label: 'Actual size',
            checked: S.view === 'actual',
            action: () => {
              S.view = 'actual';
              fit();
            }
          },
          { sep: true },
          { label: 'Selection pane', disabled: true },
          {
            label: 'Filters pane',
            checked: S.filtersOpen,
            action: () => {
              S.filtersOpen = !S.filtersOpen;
              PBI.filters.render();
              fit();
            }
          }
        ]);
        break;
      case 'Bookmarks':
        at(PBI.bookmarks.menuItems());
        break;
      case 'Export':
        at([
          { label: 'Analyze in spreadsheet', disabled: true },
          { label: 'Slides', disabled: true },
          { label: 'PDF', action: () => window.print() }
        ]);
        break;
      case 'File':
        at([
          { label: 'Save a copy', disabled: true },
          { label: 'Print this page', action: () => window.print() },
          { label: 'Embed report', disabled: true },
          { label: 'Settings', disabled: true }
        ]);
        break;
      default:
        toast(name + ' is not available in this demonstration');
    }
  }

  function init() {
    document.getElementById('topbar').innerHTML = topBar();
    document.getElementById('actionbar').innerHTML = actionBar();
    document.getElementById('rail').innerHTML = rail();
    document.querySelectorAll('.ab-btn').forEach(b =>
      b.addEventListener('click', e => {
        e.stopPropagation();
        onAction(b.dataset.ab, b);
      })
    );
    window.addEventListener('resize', fit);
  }

  PBI.shell = { init, renderPagesPane, fit, toast, PAGE_W, PAGE_H };
})();
