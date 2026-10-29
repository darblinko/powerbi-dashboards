/* page4.js: Complaint Detail drillthrough page (hidden) and the product report page tooltip. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const M = PBI.model;
  const C = PBI.charts;
  const MI = D.MONTHS;
  const esc = C.esc;

  const dt = () => PBI.S.drillthrough || { field: 'product', value: D.PRODUCTS[0].name };
  const isComplaint = () => dt().field === 'complaintId';
  function complaint() {
    return D.complaints.find(c => c.id === dt().value);
  }
  function capaById(id) {
    return D.capa.find(c => c.id === id);
  }
  function detailComplaints(api) {
    return M.rows('complaints', api.ctx);
  }
  function linkedCapas(api) {
    if (isComplaint()) {
      const c = complaint();
      const a = c && c.capaId ? capaById(c.capaId) : null;
      return a ? [a] : [];
    }
    return M.rows('capa', api.ctx);
  }

  const backBtn = {
    id: 'dBack',
    kind: 'button',
    x: 8,
    y: 10,
    w: 40,
    h: 40,
    pad: 0,
    render(body) {
      body.innerHTML =
        '<button class="back-btn" title="Back to ' +
        esc(PBI.pages[PBI.S.prevPage || 'overview'].name) +
        ' (Ctrl+click in Desktop)">' +
        PBI.icon('back', 20) +
        '</button>';
      body.querySelector('button').onclick = () => PBI.app.back();
    }
  };
  const title = {
    id: 'dTitle',
    kind: 'text',
    x: 56,
    y: 8,
    w: 1216,
    h: 48,
    pad: 6,
    render(body) {
      const d = dt();
      body.innerHTML =
        '<div class="tb-title">Complaint Detail: ' +
        esc(d.value) +
        '</div><div class="tb-sub">Drillthrough from ' +
        esc(PBI.pages[PBI.S.prevPage || 'overview'].name) +
        '. ' +
        esc(M.FIELDS[d.field].label) +
        ' is ' +
        esc(d.value) +
        '. Slicer and page filters from the source page are kept.</div>';
    }
  };

  function kv(rows) {
    return (
      '<div class="kv">' +
      rows
        .map(
          r =>
            '<div class="kv-r"><span class="kv-k">' +
            esc(r[0]) +
            '</span><span class="kv-v">' +
            (r[2] ? r[1] : esc(r[1])) +
            '</span></div>'
        )
        .join('') +
      '</div>'
    );
  }
  function cardsData(api) {
    if (isComplaint()) {
      const c = complaint();
      if (!c)
        return [
          ['Complaint', 'Not found'],
          ['', ''],
          ['', ''],
          ['', '']
        ];
      const clock = M.mdrClockDays(c);
      return [
        ['Days to MDR Decision', c.daysToDecision == null ? 'Pending' : String(c.daysToDecision)],
        ['MDR Clock (days)', clock == null ? '' : String(clock)],
        ['Reportable', c.reportable],
        ['Linked CAPA', c.capaId || 'None']
      ];
    }
    const rows = detailComplaints(api);
    return [
      ['Complaint Count', M.fmt.int(rows.length)],
      ['Complaint Rate per 1K', M.fmt.dec1(M.MEASURES.complaintRate.calc(api.ctx))],
      ['MDR Reports Filed On Time', M.fmt.pct(M.MEASURES.mdrOnTime.calc(api.ctx))],
      ['Linked CAPAs', M.fmt.int(linkedCapas(api).length)]
    ];
  }
  const cards = [0, 1, 2, 3].map(i => ({
    id: 'dCard' + i,
    kind: 'card',
    cls: 'plain-card',
    title: '',
    noTitle: true,
    x: 8 + i * 316,
    y: 64,
    w: 308,
    h: 88,
    table(api) {
      const c = cardsData(api)[i];
      return { columns: [{ label: c[0] }], rows: [[c[1]]] };
    },
    render(body, api) {
      const c = cardsData(api)[i];
      body.innerHTML =
        '<div class="pcard"><div class="pcard-val">' +
        esc(c[1]) +
        '</div><div class="pcard-lbl">' +
        esc(c[0]) +
        '</div></div>';
    }
  }));

  const record = {
    id: 'dRecord',
    title: 'Record Detail',
    x: 8,
    y: 160,
    w: 330,
    h: 536,
    table(api) {
      return {
        columns: [{ label: 'Field' }, { label: 'Value' }],
        rows: recordRows(api).map(r => [r[0], String(r[1]).replace(/<[^>]+>/g, '')])
      };
    },
    render(body, api) {
      body.innerHTML = kv(recordRows(api));
    }
  };
  function recordRows(api) {
    if (isComplaint()) {
      const c = complaint();
      if (!c)
        return [
          ['Complaint ID', dt().value],
          ['Status', 'Record not found in the current model']
        ];
      return [
        ['Complaint ID', c.id],
        ['Product', c.product],
        ['Serial Number', c.serial],
        ['Region', c.region],
        ['Received', D.fmtDay(c.day)],
        ['Complaint Category', c.category],
        ['Failure Mode', c.failureMode],
        ['Failure Sub Mode', c.subMode],
        ['Assessed', c.assessed],
        ['Reportable (21 CFR 803)', c.reportable],
        [
          'MDR Filed',
          c.mdrFiled ? 'Yes, day ' + c.daysToMdr : c.reportable === 'Yes' ? 'Not yet filed' : 'Not applicable'
        ],
        ['MDR Clock', PBI.clockIcon(M.mdrClockDays(c)) + ' ' + M.mdrClockDays(c) + ' days', true],
        ['Device Returned', c.returned],
        ['Status', c.status],
        ['Linked CAPA', c.capaId || 'None recorded'],
        ['Risk File', 'RMF-' + M.productByName[c.product].code + '-01']
      ];
    }
    const p = M.productByName[dt().value];
    const rows = detailComplaints(api);
    const fm = [...M.groupCount(rows, r => r.failureMode).entries()].sort((a, b) => b[1] - a[1]);
    const last = rows.length ? rows[rows.length - 1] : null;
    return [
      ['Product', p.name],
      ['Product Code', p.code],
      ['Product Family', p.family],
      ['Risk Management File', 'RMF-' + p.code + '-01'],
      ['Units Shipped in Period', M.fmt.int(M.MEASURES.unitsShipped.calc(api.ctx))],
      ['Complaint Count', M.fmt.int(rows.length)],
      ['Reportable Complaints', M.fmt.int(rows.filter(r => r.reportable === 'Yes').length)],
      ['Late MDRs', M.fmt.int(M.MEASURES.lateMdr.calc(api.ctx))],
      ['Top Failure Mode', fm.length ? fm[0][0] + ' (' + fm[0][1] + ')' : 'None'],
      ['Second Failure Mode', fm.length > 1 ? fm[1][0] + ' (' + fm[1][1] + ')' : 'None'],
      ['Distinct Serial Numbers', M.fmt.int(new Set(rows.map(r => r.serial)).size)],
      ['Devices Returned', M.fmt.int(rows.filter(r => r.returned === 'Yes').length)],
      ['Last Complaint Received', last ? D.fmtDay(last.day) + ', ' + last.id : 'None'],
      ['Open CAPAs', M.fmt.int(M.MEASURES.openCapas.calc(api.ctx))]
    ];
  }

  function complaintEvents(c) {
    const ev = [['Received', c.day]];
    if (c.assessed === 'Yes') ev.push(['Assessed', c.day + Math.min(3, c.daysToDecision || 3)]);
    if (c.daysToDecision != null) ev.push(['MDR decision: ' + c.reportable, c.day + c.daysToDecision]);
    if (c.mdrFiled) ev.push(['MDR filed', c.day + c.daysToMdr]);
    if (c.returned === 'Yes') ev.push(['Device returned', c.day + Math.min(28, (c.daysToDecision || 10) + 9)]);
    if (c.capaId) {
      const a = capaById(c.capaId);
      if (a) ev.push(['Linked to ' + a.id, Math.max(a.day, c.day + 1)]);
    }
    if (c.closedDay != null) ev.push(['Investigation closed', c.closedDay]);
    return ev.filter(e => e[1] <= D.END_DAY).sort((a, b) => a[1] - b[1]);
  }
  const timeline = {
    id: 'dTimeline',
    title: 'Timeline of Events',
    x: 346,
    y: 160,
    w: 926,
    h: 268,
    table(api) {
      if (isComplaint()) {
        const c = complaint();
        return {
          columns: [{ label: 'Event' }, { label: 'Date' }],
          rows: c ? complaintEvents(c).map(e => [e[0], D.fmtDay(e[1])]) : []
        };
      }
      return {
        columns: [{ label: 'Complaint ID' }, { label: 'Received' }, { label: 'Failure Mode' }, { label: 'Reportable' }],
        rows: detailComplaints(api).map(r => [r.id, D.fmtDay(r.day), r.failureMode, r.reportable])
      };
    },
    render(body, api) {
      const chart = api.chart();
      const ms = d => Date.UTC(2024, 0, 1) + d * 86400000;
      if (isComplaint()) {
        const c = complaint();
        const ev = c ? complaintEvents(c) : [];
        chart.setOption(
          C.base({
            grid: { left: 70, right: 90, top: 30, bottom: 40 },
            tooltip: C.tooltip({
              trigger: 'item',
              formatter: p =>
                C.tipHtml([
                  ['Event', p.data.name],
                  ['Date', D.fmtDay(p.data.day)],
                  ['Day', 'Day ' + (p.data.day - c.day) + ' after receipt']
                ])
            }),
            xAxis: {
              type: 'time',
              axisLabel: {
                color: C.GREY,
                fontSize: 11,
                formatter: v => {
                  const d = new Date(v);
                  return d.getUTCMonth() + 1 + '/' + d.getUTCDate();
                }
              },
              splitLine: { show: true, lineStyle: { color: '#E1DFDD', type: 'dashed' } },
              axisLine: { lineStyle: { color: '#C8C6C4' } }
            },
            yAxis: { type: 'value', show: false, min: -2, max: 2 },
            series: [
              {
                type: 'line',
                symbol: 'circle',
                symbolSize: 12,
                lineStyle: { color: '#C8C6C4', width: 2 },
                data: ev.map((e, i) => ({
                  value: [ms(e[1]), 0],
                  name: e[0],
                  day: e[1],
                  itemStyle: {
                    color: /MDR filed/.test(e[0])
                      ? c.daysToMdr > 30
                        ? '#D64550'
                        : '#1AAB40'
                      : C.THEME[i % C.THEME.length]
                  },
                  label: {
                    show: true,
                    position: i % 2 ? 'bottom' : 'top',
                    distance: 10,
                    formatter: e[0] + '\n' + D.fmtDay(e[1]),
                    color: '#252423',
                    fontSize: 11,
                    lineHeight: 15
                  }
                }))
              }
            ]
          }),
          true
        );
        return;
      }
      const rows = detailComplaints(api);
      const fms = Object.keys(D.FM_TREE).filter(f => rows.some(r => r.failureMode === f));
      const ser = ['Yes', 'No', 'Pending'].map((rep, i) => ({
        name: 'Reportable: ' + rep,
        type: 'scatter',
        symbolSize: 7,
        itemStyle: { color: ['#D64550', '#118DFF', '#C8C6C4'][i], opacity: 0.8 },
        data: rows
          .filter(r => r.reportable === rep)
          .map(r => ({ value: [ms(r.day), fms.indexOf(r.failureMode)], id: r.id, day: r.day, fm: r.failureMode }))
      }));
      chart.setOption(
        C.base({
          legend: C.legend(),
          grid: { left: 120, right: 16, top: 30, bottom: 30 },
          tooltip: C.tooltip({
            trigger: 'item',
            formatter: p =>
              C.tipHtml([
                ['Complaint ID', p.data.id],
                ['Received', D.fmtDay(p.data.day)],
                ['Failure Mode', p.data.fm],
                ['Series', p.seriesName]
              ])
          }),
          xAxis: {
            type: 'time',
            axisLabel: { color: C.GREY, fontSize: 11 },
            splitLine: { show: false },
            axisLine: { lineStyle: { color: '#C8C6C4' } }
          },
          yAxis: C.catAxis(fms, { extra: { splitLine: { show: true, lineStyle: { color: '#EDEBE9' } } } }),
          series: ser
        }),
        true
      );
      chart.off('click');
      chart.on('click', p => p.data && p.data.id && PBI.app.drillthrough('complaintId', p.data.id));
    }
  };

  function tableVisual(id, ttl, rect, specFn) {
    return Object.assign(
      {
        id,
        title: ttl,
        table: specFn,
        render(body, api) {
          body.innerHTML = '';
          body.appendChild(PBI.frame.htmlTable(specFn(api)));
        }
      },
      rect
    );
  }
  const capaTable = tableVisual('dCapa', 'Linked CAPA', { x: 346, y: 436, w: 500, h: 260 }, api => {
    const list = linkedCapas(api);
    return {
      columns: [
        { label: 'CAPA ID' },
        { label: 'Opened' },
        { label: 'Source' },
        { label: 'Root Cause' },
        { label: 'Status' },
        { label: 'Days Open', align: 'right' }
      ],
      rows: list
        .slice()
        .reverse()
        .map(a => [a.id, D.fmtDay(a.day), a.source, a.rootCause, M.capaStatus(a), M.daysOpen(a)]),
      note: list.length ? null : 'Gap: no CAPA is linked to this complaint in the CAPA table.'
    };
  });
  const hazardTable = tableVisual('dHazard', 'Linked Risk File Hazard', { x: 854, y: 436, w: 418, h: 128 }, api => {
    const rows = detailComplaints(api);
    const fms = [...M.groupCount(rows, r => r.failureMode).entries()]
      .sort((a, b) => b[1] - a[1])
      .filter(e => D.HAZARDS[e[0]]);
    return {
      columns: [
        { label: 'Hazard ID' },
        { label: 'Hazard' },
        { label: 'Severity' },
        { label: 'Est. P' },
        { label: 'Complaints', align: 'right' }
      ],
      rows: fms.map(e => {
        const h = D.HAZARDS[e[0]];
        return [h.id, h.hazard, h.severity, h.estP, e[1]];
      }),
      note: fms.length ? null : 'Gap: failure mode has no hazard assigned in the risk file.'
    };
  });
  const serialTable = tableVisual('dSerial', 'Serial Numbers', { x: 854, y: 572, w: 418, h: 124 }, api => {
    const rows = detailComplaints(api).slice().reverse();
    return {
      columns: [{ label: 'Serial Number' }, { label: 'Complaint ID' }, { label: 'Received' }, { label: 'Returned' }],
      rows: rows.map(r => [r.serial, r.id, D.fmtDay(r.day), r.returned])
    };
  });

  PBI.pages.detail = {
    name: 'Complaint Detail',
    hidden: true,
    drillthrough: true,
    filterFields: [],
    visuals: [backBtn, title].concat(cards, [record, timeline, capaTable, hazardTable, serialTable])
  };

  // ---------- Report page tooltip (product or category) ----------
  let tipEl = null,
    tipCharts = null,
    tipKey = null;
  function ensureTip() {
    if (tipEl) return;
    tipEl = document.createElement('div');
    tipEl.id = 'pagetip';
    tipEl.innerHTML =
      '<div class="pt-h"></div><div class="pt-cards"></div><div class="pt-line"></div><div class="pt-bar"></div>';
    document.body.appendChild(tipEl);
    tipCharts = {
      line: echarts.init(tipEl.querySelector('.pt-line'), null, { width: 300, height: 92 }),
      bar: echarts.init(tipEl.querySelector('.pt-bar'), null, { width: 300, height: 92 })
    };
  }
  function show(evt, field, value) {
    ensureTip();
    const key = field + '|' + value;
    if (key !== tipKey) {
      tipKey = key;
      const ctx = PBI.app.ctxFor('__tooltip').concat([{ field, test: v => v === value }]);
      ctx.asOf = M.asOf;
      const rows = M.rows('complaints', ctx);
      const S = PBI.S.slicers;
      tipEl.querySelector('.pt-h').innerHTML = esc(M.FIELDS[field].label) + ': <b>' + esc(value) + '</b>';
      tipEl.querySelector('.pt-cards').innerHTML =
        '<div><span>' +
        M.fmt.int(rows.length) +
        '</span>Complaints</div>' +
        '<div><span>' +
        M.fmt.dec1(M.MEASURES.complaintRate.calc(ctx)) +
        '</span>Rate per 1K</div>' +
        '<div><span>' +
        M.fmt.pct(rows.length ? rows.filter(r => r.reportable === 'Yes').length / rows.length : null) +
        '</span>Reportable</div>';
      const cm = M.groupCount(rows, r => r.month);
      const months = [];
      for (let m = S.from; m <= S.to; m++) months.push(m);
      tipCharts.line.setOption(
        C.base({
          animation: false,
          title: {
            text: 'Complaint Count by Month',
            textStyle: { fontSize: 11, fontWeight: 600, color: '#252423' },
            left: 0,
            top: 0
          },
          grid: { left: 28, right: 6, top: 22, bottom: 16 },
          xAxis: C.catAxis(
            months.map(m => MI[m].short + ' ' + String(MI[m].year).slice(2)),
            { extra: { axisLabel: { fontSize: 9, color: C.GREY } } }
          ),
          yAxis: C.valAxis({ extra: { axisLabel: { fontSize: 9, color: C.GREY }, splitNumber: 2 } }),
          series: [
            {
              type: 'line',
              data: months.map(m => cm.get(m) || 0),
              symbol: 'none',
              lineStyle: { color: '#118DFF', width: 1.5 },
              areaStyle: { color: 'rgba(17,141,255,.12)' }
            }
          ]
        }),
        true
      );
      const fm = [...M.groupCount(rows, r => r.failureMode).entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .reverse();
      tipCharts.bar.setOption(
        C.base({
          animation: false,
          title: {
            text: 'Top Failure Modes',
            textStyle: { fontSize: 11, fontWeight: 600, color: '#252423' },
            left: 0,
            top: 0
          },
          grid: { left: 110, right: 26, top: 20, bottom: 2 },
          xAxis: { type: 'value', show: false },
          yAxis: C.catAxis(
            fm.map(e => e[0]),
            { extra: { axisLabel: { fontSize: 10, color: C.GREY } } }
          ),
          series: [
            {
              type: 'bar',
              data: fm.map(e => e[1]),
              itemStyle: { color: '#12239E' },
              barWidth: 10,
              label: { show: true, position: 'right', fontSize: 10, color: C.GREY }
            }
          ]
        }),
        true
      );
    }
    tipEl.classList.add('on');
    move(evt);
  }
  function move(evt) {
    if (!tipEl || !tipEl.classList.contains('on') || !evt) return;
    const w = 320,
      h = tipEl.offsetHeight || 260;
    let x = evt.clientX + 14,
      y = evt.clientY + 14;
    if (x + w > window.innerWidth - 4) x = evt.clientX - w - 14;
    if (y + h > window.innerHeight - 4) y = evt.clientY - h - 14;
    tipEl.style.left = x + 'px';
    tipEl.style.top = Math.max(4, y) + 'px';
  }
  function hide() {
    if (tipEl) tipEl.classList.remove('on');
  }
  PBI.tooltipPage = {
    show,
    move,
    hide,
    reset: () => {
      tipKey = null;
    }
  };
})();
