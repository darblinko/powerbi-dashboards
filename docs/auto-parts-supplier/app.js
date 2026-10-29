/* Report engine: page rendering, fit to page, header band slicers, action bar, View as. Bookmarks are in bookmarks.js. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const D = window.PBI_DATA;
  const ST = window.PBI_STATE;
  const PBI = window.PBI;
  const icon = window.PBI_ICON;
  const esc = PBI.esc;
  const $ = id => document.getElementById(id);
  let shells = {};
  let playTimer = null;

  const page = () => PBI.pages.find(p => p.id === ST.S.page);
  const pageId = () => ST.S.page;

  function disposeCharts() {
    Object.keys(PBI.charts).forEach(k => {
      const c = PBI.charts[k];
      if (c && !c.isDisposed()) c.dispose();
    });
    PBI.charts = {};
    PBI.tables = {};
  }

  /* ---------- fit to page ---------- */
  function fit() {
    const host = $('pagehost');
    const availW = host.clientWidth - 32,
      availH = host.clientHeight - 24;
    const mode = ST.S.fitMode;
    let scale = mode === 'width' ? availW / 1280 : mode === 'actual' ? 1 : Math.min(availW / 1280, availH / 720);
    scale = Math.max(0.3, scale);
    const scaler = $('pagescaler');
    scaler.style.width = Math.round(1280 * scale) + 'px';
    scaler.style.height = Math.round(720 * scale) + 'px';
    scaler.style.marginTop = mode === 'page' ? Math.max(12, (host.clientHeight - 720 * scale) / 2) + 'px' : '12px';
    $('page').style.transform = 'scale(' + scale + ')';
    $('zoomPct').textContent = Math.round(scale * 100) + '%';
    document.querySelector('.sb-thumb').style.left = Math.min(80, Math.max(0, scale * 45)) + 'px';
    Object.values(PBI.charts).forEach(c => {
      if (c && !c.isDisposed()) c.resize();
    });
  }

  /* ---------- header band and its dropdown slicers ---------- */
  function slicerText(field) {
    const sel = (ST.S.slicers[pageId()] || {})[field];
    if (!sel || !sel.size) return 'All';
    if (sel.size === 1) return M.valueLabel(field, [...sel][0]);
    return 'Multiple selections';
  }
  function openSlicer(field, anchor) {
    PBI.closePopups();
    const S = ST.S;
    const values = M.fieldValues(field, ST.rolePlant());
    const cur = (S.slicers[pageId()] || {})[field];
    const pop = document.createElement('div');
    pop.className = 'dslicer-pop';
    pop.innerHTML =
      '<label><input type="checkbox" data-all="1"' +
      (!cur || !cur.size ? ' checked' : '') +
      '>Select all</label>' +
      values
        .map(
          (v, i) =>
            '<label><input type="checkbox" data-i="' +
            i +
            '"' +
            (cur && cur.has(v) ? ' checked' : '') +
            '>' +
            esc(M.valueLabel(field, v)) +
            '</label>'
        )
        .join('');
    pop.addEventListener('click', ev => ev.stopPropagation());
    pop.addEventListener('change', ev => {
      const all = ev.target.dataset.all;
      const picked = new Set();
      if (!all)
        pop.querySelectorAll('input[data-i]').forEach(x => {
          if (x.checked) picked.add(values[+x.dataset.i]);
        });
      S.slicers[pageId()] = Object.assign({}, S.slicers[pageId()], {
        [field]: picked.size && picked.size < values.length ? picked : null
      });
      pop.querySelector('[data-all]').checked = !S.slicers[pageId()][field];
      if (all)
        pop.querySelectorAll('input[data-i]').forEach(x => {
          x.checked = false;
        });
      S.selection[pageId()] = null;
      refresh();
    });
    const r = anchor.getBoundingClientRect();
    pop.style.left = r.left + 'px';
    pop.style.top = r.bottom + 2 + 'px';
    document.getElementById('popup-root').appendChild(pop);
  }
  function renderBand(p) {
    const band = document.createElement('div');
    band.className = 'band';
    let sub = p.band.sub;
    if (p.id === 'machine' && ST.S.drillthrough) {
      const m = D.machines.find(x => x.id === ST.S.drillthrough.machine);
      sub = m.id + '  |  ' + m.desc + '  |  Line ' + m.line + ' ' + m.process + '  |  ' + m.plant + ' plant';
    }
    band.innerHTML =
      (p.band.back
        ? '<button class="band-back" id="bandBack" title="Back">' + icon('back', 14) + 'Back</button>'
        : '') +
      '<span class="band-mark"></span><span class="band-title">' +
      esc(p.band.title) +
      '</span><span class="band-sub">' +
      esc(sub) +
      '</span><span class="band-spacer"></span>' +
      p.band.slicers
        .map(
          f =>
            '<div class="dslicer" data-f="' +
            f +
            '"><div class="dslicer-label">' +
            esc(M.fieldDisplay(f)) +
            '</div><div class="dslicer-box"><span>' +
            esc(slicerText(f)) +
            '</span>' +
            icon('chevronDown', 12) +
            '</div></div>'
        )
        .join('');
    band.querySelectorAll('.dslicer').forEach(d =>
      d.addEventListener('click', ev => {
        ev.stopPropagation();
        openSlicer(d.dataset.f, d.querySelector('.dslicer-box'));
      })
    );
    const back = band.querySelector('#bandBack');
    if (back)
      back.addEventListener('click', ev => {
        ev.stopPropagation();
        goPage(ST.S.drillthrough ? ST.S.drillthrough.from : 'plant');
      });
    return band;
  }

  /* ---------- page ---------- */
  function renderPage() {
    const S = ST.S;
    disposeCharts();
    PBI.closePopups();
    PBI.tipHide();
    const p = page();
    const el = $('page');
    el.innerHTML = '';
    shells = {};
    $('focusbar').hidden = !S.focus;
    if (S.focus) {
      const v = p.visuals.find(x => x.id === S.focus.visualId);
      const shell = PBI.buildShell(v, { x: 8, y: 8, w: 1264, h: 704 });
      if (S.focus.table) {
        shell.querySelector('.vchart').style.bottom = '50%';
        shell
          .querySelector('.vbody')
          .insertAdjacentHTML('beforeend', '<div class="vtable-wrap" style="top:50%"></div>');
      }
      el.appendChild(shell);
      shells[v.id] = { v, shell };
    } else {
      el.appendChild(renderBand(p));
      p.visuals.forEach(v => {
        const shell = PBI.buildShell(v, v);
        el.appendChild(shell);
        shells[v.id] = { v, shell };
      });
      el.insertAdjacentHTML(
        'beforeend',
        '<div class="page-footer"><span>Sample data generated for demonstration. Not drawn from any real system.</span><span>Theme: ' +
          M.THEME.name +
          '. Data updated 10/1/26.</span></div>'
      );
    }
    renderPageList();
    const visible = PBI.pages.filter(x => !x.hidden);
    const idx = visible.indexOf(p);
    $('statusPage').textContent =
      idx >= 0 ? 'Page ' + (idx + 1) + ' of ' + visible.length + ': ' + p.name : 'Drillthrough page: ' + p.name;
    fit();
    refresh();
  }
  function refresh() {
    const S = ST.S;
    const p = page();
    Object.values(shells).forEach(({ v, shell }) => {
      shell.classList.toggle('dim', !!S.spotlight && S.spotlight !== v.id && !S.focus);
      try {
        PBI.renderVisual(v, p, shell);
      } catch (err) {
        console.error('Visual ' + v.id + ' failed', err);
      }
    });
    document.querySelectorAll('.band .dslicer').forEach(d => {
      d.querySelector('.dslicer-box span').textContent = slicerText(d.dataset.f);
    });
    markSelected();
    renderFilters();
  }
  function refreshVisual(id) {
    const s = shells[id];
    if (s) PBI.renderVisual(s.v, page(), s.shell);
  }
  function markSelected() {
    Object.values(shells).forEach(({ v, shell }) => shell.classList.toggle('vsel', ST.S.selectedVisual === v.id));
  }
  function renderFilters() {
    PBI.filterPane.render();
  }
  function renderPageList() {
    const ul = $('pagelist');
    ul.innerHTML = PBI.pages
      .filter(p => !p.hidden)
      .map(
        p => '<li data-p="' + p.id + '" class="' + (p.id === pageId() ? 'active' : '') + '">' + esc(p.name) + '</li>'
      )
      .join('');
    ul.querySelectorAll('li').forEach(li => li.addEventListener('click', () => goPage(li.dataset.p)));
  }
  function goPage(id) {
    const S = ST.S;
    stopPlay();
    S.page = id;
    S.focus = null;
    S.spotlight = null;
    S.selectedVisual = null;
    $('pagehost').scrollTop = 0;
    renderPage();
  }
  function drillthrough(machine) {
    const S = ST.S;
    S.drillthrough = { machine, from: S.page };
    S.selection.machine = null;
    goPage('machine');
  }

  /* ---------- play axis ---------- */
  function stopPlay() {
    if (playTimer) clearInterval(playTimer);
    playTimer = null;
    ST.S.play.playing = false;
  }
  function togglePlay(visualId) {
    const play = ST.S.play;
    if (play.playing) {
      stopPlay();
      refreshVisual(visualId);
      return;
    }
    if (play.month >= 11) play.month = 0;
    play.playing = true;
    refreshVisual(visualId);
    playTimer = setInterval(() => {
      if (play.month >= 11) {
        stopPlay();
        refreshVisual(visualId);
        return;
      }
      play.month += 1;
      refreshVisual(visualId);
    }, 900);
  }

  /* ---------- View as (row-level security) ---------- */
  function applyRole(name, viewing) {
    const S = ST.S;
    S.role = name;
    S.viewAs = viewing;
    const plant = ST.rolePlant();
    Object.keys(S.slicers).forEach(pid => {
      const sl = S.slicers[pid];
      if (sl && sl.Plant && plant && !sl.Plant.has(plant)) S.slicers[pid] = Object.assign({}, sl, { Plant: null });
    });
    S.selection = {};
    S.drill = {};
    if (
      S.page === 'machine' &&
      plant &&
      S.drillthrough &&
      !D.machines.some(m => m.id === S.drillthrough.machine && m.plant === plant)
    )
      S.page = S.drillthrough.from;
    syncRoleUi();
    renderPage();
  }
  function syncRoleUi() {
    const S = ST.S;
    $('rlsbanner').hidden = !S.viewAs;
    document.body.classList.toggle('rls', S.viewAs);
    $('rlsRole').textContent = S.role;
    $('viewasBtn').classList.toggle('on', S.viewAs);
  }
  function openViewAs(preselect) {
    const S = ST.S;
    const chosen = preselect || (S.viewAs ? S.role : null);
    const rows = M.ROLES.map(
      (r, i) =>
        '<label class="va-row"><input type="checkbox" data-i="' +
        i +
        '"' +
        (chosen === r.name ? ' checked' : '') +
        '><span>' +
        esc(r.name) +
        '</span><span class="va-dax">' +
        esc(r.dax) +
        '</span></label>'
    ).join('');
    const mask = PBI.modal(
      '<h2>View as roles</h2><p>Evaluate this report as a member of a role. Row-level security filters every table related to Plant on every page.</p>' +
        '<div class="va-section"><div class="va-other"><input type="checkbox" disabled><span>Other user</span></div></div><div class="va-section">' +
        rows +
        '</div>',
      [
        {
          label: 'OK',
          primary: true,
          action: m => {
            const c = m.querySelector('input[data-i]:checked');
            if (c) applyRole(M.ROLES[+c.dataset.i].name, true);
          }
        },
        { label: 'Cancel' }
      ]
    );
    mask.querySelectorAll('input[data-i]').forEach(cb =>
      cb.addEventListener('change', () => {
        if (cb.checked)
          mask.querySelectorAll('input[data-i]').forEach(o => {
            if (o !== cb) o.checked = false;
          });
      })
    );
  }

  /* ---------- insights ---------- */
  function insights() {
    const P = D.tables.Downtime;
    const byMm = M.groupBy(ST.rolePlant() ? P.filter(r => r.plant === ST.rolePlant()) : P, 'machine');
    let worst = null;
    byMm.forEach((rows, mach) =>
      M.groupBy(rows, 'Month').forEach((r, mi) => {
        const h = M.MS.downtimeHours(r);
        if (!worst || h > worst.h) worst = { mach, mi, h };
      })
    );
    const rec = M.groupBy(D.tables.Receipts, 'supplier');
    let ppm = null;
    rec.forEach((rows, sup) =>
      M.groupBy(rows, 'Month').forEach((r, mi) => {
        const v = M.MS.supplierPpm(r);
        if (!ppm || v > ppm.v) ppm = { sup, mi, v };
      })
    );
    let cost = null;
    D.tables.Cost.forEach(r => {
      const pct = (r.actual - r.budget) / r.budget;
      if (r.budget > 50000 && (!cost || pct > cost.pct)) cost = { r, pct };
    });
    PBI.modal(
      '<h2>Insights</h2><p>Largest deviations found in the current model. Computed from the sample data on open.</p><pre>' +
        esc(
          '1. Downtime: ' +
            worst.mach +
            ' recorded ' +
            worst.h.toFixed(1) +
            ' downtime hours in ' +
            D.months[worst.mi].label +
            ', the highest machine-month in scope.\n' +
            '2. Supplier PPM: ' +
            ppm.sup +
            ' reached ' +
            Math.round(ppm.v).toLocaleString('en-US') +
            ' PPM in ' +
            D.months[ppm.mi].label +
            '.\n' +
            '3. Cost: ' +
            cost.r.plant +
            ' ' +
            cost.r.category +
            ' ran ' +
            (cost.pct * 100).toFixed(0) +
            '% over budget in ' +
            D.months[cost.r.month].label +
            '.'
        ) +
        '</pre>'
    );
  }

  /* ---------- action bar ---------- */
  const NA = 'Not available in this demonstration. The page runs without a Power BI tenant.';
  function actionMenu(kind, anchor) {
    const r = anchor.getBoundingClientRect();
    const S = ST.S;
    const items = {
      file: [
        { label: 'Save a copy', icon: 'file', disabled: true },
        { label: 'Download this file', icon: 'download', disabled: true },
        { label: 'Print this page', icon: 'file', action: () => PBI.toast(NA) },
        { label: 'Embed report', icon: 'share', disabled: true },
        '-',
        { label: 'Settings', icon: 'settings', disabled: true }
      ],
      export: [
        { label: 'Analyze in Excel', icon: 'table', disabled: true },
        { label: 'PowerPoint', icon: 'exportIcon', disabled: true },
        { label: 'PDF', icon: 'file', disabled: true },
        '-',
        { label: 'Export data from a visual: use the visual "..." menu', disabled: true }
      ],
      bookmarks: PBI.bookmarks.menuItems().concat([{ label: 'Reset to default', icon: 'reset', action: resetAll }]),
      view: [
        {
          label: 'Fit to page',
          checked: S.fitMode === 'page',
          action: () => {
            S.fitMode = 'page';
            fit();
          }
        },
        {
          label: 'Fit to width',
          checked: S.fitMode === 'width',
          action: () => {
            S.fitMode = 'width';
            fit();
          }
        },
        {
          label: 'Actual size',
          checked: S.fitMode === 'actual',
          action: () => {
            S.fitMode = 'actual';
            fit();
          }
        },
        '-',
        { label: 'High-contrast colors', disabled: true }
      ]
    }[kind];
    PBI.menu(r.left, r.bottom + 2, items);
  }
  function resetAll() {
    stopPlay();
    ST.reset();
    PBI.bookmarks.clearCurrent();
    renderPage();
    PBI.toast('Report reset to default.');
  }
  function wireChrome() {
    document.querySelectorAll('[data-icon]').forEach(el => {
      const svg = icon(el.dataset.icon, el.classList.contains('chev') || el.classList.contains('crumb-chev') ? 12 : 16);
      el.insertAdjacentHTML('afterbegin', svg);
    });
    document.querySelectorAll('#actionbar [data-menu], #statusbar [data-menu]').forEach(b =>
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        actionMenu(b.dataset.menu, b);
      })
    );
    document.querySelectorAll('#actionbar [data-act]').forEach(b =>
      b.addEventListener('click', ev => {
        ev.stopPropagation();
        const a = b.dataset.act;
        if (a === 'reset') resetAll();
        else if (a === 'refresh') {
          renderPage();
          PBI.toast('Visuals refreshed.');
        } else if (a === 'viewas') openViewAs();
        else if (a === 'insights') insights();
        else PBI.toast(NA);
      })
    );
    document.querySelectorAll('[data-zoom]').forEach(b =>
      b.addEventListener('click', () => {
        ST.S.fitMode = b.dataset.zoom === '+' ? 'width' : 'page';
        fit();
      })
    );
    $('rlsStop').addEventListener('click', () => applyRole('All plants', false));
    $('focusBack').addEventListener('click', () => {
      ST.S.focus = null;
      renderPage();
    });
    document.querySelector('.pp-collapse').addEventListener('click', () => {
      $('pagespane').classList.toggle('collapsed');
      fit();
    });
    $('page').addEventListener('click', () => {
      const S = ST.S;
      PBI.closePopups();
      if (S.selection[pageId()] || S.spotlight || S.selectedVisual) {
        S.selection[pageId()] = null;
        S.spotlight = null;
        S.selectedVisual = null;
        refresh();
      }
    });
    document.addEventListener('click', () => PBI.closePopups());
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape') return;
      PBI.closePopups();
      const S = ST.S;
      if (S.focus) {
        S.focus = null;
        renderPage();
      } else if (S.spotlight) {
        S.spotlight = null;
        refresh();
      }
    });
    window.addEventListener('resize', fit);
  }

  PBI.app = {
    page,
    pageId,
    refresh,
    renderPage,
    refreshVisual,
    markSelected,
    renderFilters,
    fit,
    goPage,
    drillthrough,
    togglePlay,
    stopPlay,
    openViewAs,
    applyRole,
    syncRoleUi
  };

  wireChrome();
  if (typeof echarts === 'undefined') {
    document.getElementById('page').innerHTML =
      '<div class="blank-msg">ECharts could not be loaded from cdnjs.cloudflare.com. Visuals need network access to that CDN.</div>';
  } else {
    renderPage();
  }
})();
