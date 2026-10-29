'use strict';
/* Drillthrough page: Batch Record. Genealogy, in-process checks, release checklist. Generated per batch ID. */

const SUPPLIERS = [
  'Contoso Ingredients',
  'Fabrikam Botanicals Supply',
  'Northwind Excipients',
  'Proseware Gelatin',
  'Woodgrove Minerals',
  'Coho Flavors'
];
const EXCIPIENTS = {
  Capsule: ['Microcrystalline cellulose', 'Rice flour', 'Magnesium stearate', 'HPMC capsule shells size 0'],
  Tablet: ['Dicalcium phosphate', 'Microcrystalline cellulose', 'Croscarmellose sodium', 'Stearic acid', 'Film coat'],
  'Chewable tablet': ['Dextrose', 'Sorbitol', 'Natural flavor', 'Stearic acid'],
  Powder: ['Natural flavor', 'Citric acid', 'Stevia leaf extract', 'Silicon dioxide'],
  Softgel: ['Bovine gelatin', 'Glycerin', 'Purified water', 'Mixed tocopherols'],
  Gummy: ['Pectin', 'Cane sugar', 'Tapioca syrup', 'Citric acid', 'Natural color']
};
const CHECKS = {
  Capsule: [
    ['Encapsulation', 'Fill weight', 'mg', 600, 570, 630, 0],
    ['Encapsulation', 'Weight variation', '% RSD', 1.8, 0, 3, 1],
    ['Encapsulation', 'Disintegration', 'min', 9, 0, 30, 0, 'Dissolution'],
    ['Blend', 'Blend moisture', '%', 4.2, 2, 6, 1, 'Moisture'],
    ['Encapsulation', 'Capsule length', 'mm', 21.7, 21.2, 22.2, 1],
    ['Encapsulation', 'Lock integrity', 'pass rate %', 100, 99.5, 100, 1]
  ],
  Tablet: [
    ['Compression', 'Tablet weight', 'mg', 1250, 1200, 1300, 0],
    ['Compression', 'Hardness', 'kp', 18, 14, 24, 1],
    ['Compression', 'Thickness', 'mm', 6.8, 6.6, 7.0, 2],
    ['Compression', 'Friability', '%', 0.3, 0, 1, 2],
    ['Coating', 'Disintegration', 'min', 14, 0, 30, 0, 'Dissolution'],
    ['Coating', 'Coating weight gain', '%', 3, 2, 4, 1]
  ],
  'Chewable tablet': [
    ['Compression', 'Tablet weight', 'mg', 2500, 2400, 2600, 0],
    ['Compression', 'Hardness', 'kp', 12, 9, 16, 1],
    ['Compression', 'Friability', '%', 0.5, 0, 1, 2],
    ['Blend', 'Blend moisture', '%', 2.5, 1, 4, 1, 'Moisture'],
    ['Compression', 'Thickness', 'mm', 7.2, 7.0, 7.4, 2],
    ['Blend', 'Blend uniformity', '% RSD', 2.8, 0, 5, 1, 'Assay potency']
  ],
  Powder: [
    ['Filling', 'Fill weight', 'g', 300, 297, 306, 1],
    ['Blend', 'Blend uniformity', '% RSD', 2.4, 0, 5, 1, 'Assay potency'],
    ['Blend', 'Bulk density', 'g/mL', 0.52, 0.45, 0.6, 2],
    ['Blend', 'Loss on drying', '%', 3.1, 0, 5, 1, 'Moisture'],
    ['Blend', 'Particle size D50', 'um', 180, 120, 240, 0],
    ['Filling', 'Seal integrity', 'pass rate %', 100, 99.5, 100, 1]
  ],
  Softgel: [
    ['Encapsulation', 'Fill weight', 'mg', 1200, 1140, 1260, 0],
    ['Encapsulation', 'Shell thickness', 'mm', 0.75, 0.6, 0.9, 2],
    ['Drying', 'Hardness', 'N', 9, 6, 12, 1],
    ['Drying', 'Seal integrity', 'pass rate %', 100, 99.5, 100, 1],
    ['Encapsulation', 'Seam thickness', 'mm', 0.3, 0.2, 0.4, 2],
    ['Drying', 'Shell moisture', '%', 8, 5, 10, 1, 'Moisture']
  ],
  Gummy: [
    ['Depositing', 'Deposit weight', 'g', 4.0, 3.8, 4.2, 2],
    ['Cooking', 'Brix', 'deg Bx', 78, 76, 80, 1],
    ['Curing', 'Water activity', 'aw', 0.6, 0.5, 0.68, 2, 'Moisture'],
    ['Cooking', 'pH', 'pH', 3.4, 3.1, 3.7, 1, 'Microbial'],
    ['Depositing', 'Piece weight variation', '% RSD', 2.1, 0, 4, 1],
    ['Curing', 'Moisture', '%', 16, 14, 18, 1, 'Moisture']
  ]
};
const CHECKLIST = [
  ['Raw material identity testing and COA review', '21 CFR 111.75(a)'],
  ['Master manufacturing record reconciled', '21 CFR 111.205'],
  ['Batch production record review', '21 CFR 111.260'],
  ['In-process specifications met', '21 CFR 111.70(c)'],
  ['Finished batch testing: identity, purity, strength, composition', '21 CFR 111.75(c)'],
  ['Label and packaging reconciliation', '21 CFR 111.415'],
  ['Deviations and OOS investigations closed', '21 CFR 111.113'],
  ['Third-party GMP certificate of conformance', 'Quality agreement'],
  ['Quality unit disposition', '21 CFR 111.123']
];

function findBatch(id) {
  const hist = D.batches.find(b => b.id === id);
  if (hist) return Object.assign({ status: 'Completed', source: 'history' }, hist);
  const s = D.schedule.find(r => r.batchId === id && r.stage === 'Manufacture');
  if (!s) return null;
  const units = Math.round(30000 + (U.hashString(id) % 30000));
  return {
    id,
    source: 'schedule',
    status: s.status,
    day: s.start,
    endDay: s.end,
    site: s.site,
    line: s.line,
    form: s.form,
    customer: s.customer,
    product: s.product,
    units,
    yieldPct: null,
    disposition: s.status === 'Planned' ? 'Not started' : 'In process',
    oosTypes: [],
    deviation: false
  };
}

function batchRecord(id) {
  const b = findBatch(id);
  if (!b) return null;
  const rnd = U.makeRandom(U.hashString(id));
  const lot = prefix => prefix + '-' + String(rnd.int(10000, 99999));
  const active = b.product.replace(/\s\d+\s(ct|srv)$/, '');
  const raws = [active]
    .concat(EXCIPIENTS[b.form])
    .map(name => ({ name, lot: lot('RM'), supplier: rnd.pick(SUPPLIERS) }));
  const blend = {
    name: b.form === 'Softgel' ? 'Fill mass' : b.form === 'Gummy' ? 'Gummy slurry' : 'Final blend',
    lot: lot('BL')
  };
  const nFin = rnd.int(2, 3);
  const finished = [];
  const planned = b.source === 'schedule' && b.status !== 'Completed';
  for (let i = 0; i < nFin; i++)
    finished.push({
      name: (planned ? 'Planned lot ' : 'Finished lot ') + (i + 1),
      lot: id.replace('B', 'FG') + '-' + String.fromCharCode(65 + i),
      qty: Math.round(b.units / nFin)
    });
  const failType = b.oosTypes[0];
  const pending = b.source === 'schedule' && b.status !== 'Completed';
  const checks = CHECKS[b.form].map(([stage, name, unit, target, lsl, usl, dp, linked]) => {
    let result = pending && rnd.chance(b.status === 'Planned' ? 1 : 0.5) ? null : rnd.normal(target, (usl - lsl) / 9);
    if (result !== null) result = Math.min(usl, Math.max(lsl, result));
    if (result !== null && failType && linked === failType) result = usl + (usl - lsl) * 0.12;
    const status = result === null ? 'Pending' : result > usl || result < lsl ? 'Fail' : 'Pass';
    return { stage, name, unit, lsl, usl, dp, result, status };
  });
  const first = checks[0];
  const nSamples = !pending ? 30 : b.status === 'In progress' ? 12 : 0;
  const samples = [];
  for (let i = 0; i < nSamples; i++) {
    const drift = failType === 'Assay potency' ? (i / 30) * (first.usl - first.lsl) * 0.3 : 0;
    samples.push(+(rnd.normal(CHECKS[b.form][0][3], (first.usl - first.lsl) / 10) + drift).toFixed(first.dp + 1));
  }
  return { b, raws, blend, finished, checks, samples, checklist: checklistFor(b, rnd) };
}

function checklistFor(b, rnd) {
  const base = b.endDay || b.day;
  const doneDay = i => U.fmtDate(Math.floor(base) + 1 + Math.floor(i * ((b.releaseDays || 6) / CHECKLIST.length)));
  return CHECKLIST.map(([step, ref], i) => {
    let status = 'Complete';
    let note = doneDay(i);
    if (b.source === 'schedule') {
      status =
        b.status === 'Completed' && i < 2
          ? 'Complete'
          : i === 0 && b.status !== 'Planned'
            ? 'In progress'
            : 'Not started';
      note = status === 'Complete' ? doneDay(i) : '';
    } else if (b.disposition === 'Rejected') {
      if (i === 4) {
        status = 'Failed';
        note = (b.oosTypes[0] || 'Specification') + ' OOS';
      }
      if (i === 8) {
        status = 'Complete';
        note = 'Rejected';
      }
      if (i > 4 && i < 8) {
        status = 'Not applicable';
        note = '';
      }
    } else if (b.disposition === 'On hold') {
      if (i >= 4) {
        status = i === 4 || (i === 6 && (b.deviation || b.oosTypes.length)) ? 'In progress' : 'Not started';
        note = '';
      }
    } else if (b.disposition === 'Released with deviation' && i === 6) note = 'DV-' + rnd.int(1000, 9999) + ' closed';
    return { step, ref, status, note };
  });
}

function currentRecord() {
  return S.drillBatch ? batchRecord(S.drillBatch) : null;
}
const NO_BATCH =
  '<div class="v-empty">Right-click a batch on the schedule or the OOS investigations table and choose Drill through, Batch Record.</div>';

defineVisual({
  id: 'brCards',
  page: 'batch',
  title: 'Batch summary',
  hideTitle: true,
  pos: [12, 64, 1256, 82],
  className: 'multicard',
  render(el) {
    const r = currentRecord();
    if (!r) {
      el.innerHTML = NO_BATCH;
      return;
    }
    const b = r.b;
    const items = [
      ['Batch ID', b.id],
      ['Product', b.product],
      ['Customer', b.customer],
      ['Line', b.line + ', ' + b.site],
      ['Manufactured', U.fmtDate(b.day)],
      ['Batch size units', FMT.int(b.units)],
      ['Yield %', b.yieldPct ? b.yieldPct.toFixed(1) + '%' : 'Pending'],
      ['Disposition', b.disposition]
    ];
    el.innerHTML = items
      .map(
        ([k, v]) =>
          '<div class="mc-item"><div class="mc-val">' +
          esc(v) +
          '</div><div class="mc-label">' +
          esc(k) +
          '</div></div>'
      )
      .join('');
  },
  data() {
    const r = currentRecord();
    return r
      ? {
          columns: ['Batch ID', 'Product', 'Customer', 'Line', 'Disposition'],
          rows: [[r.b.id, r.b.product, r.b.customer, r.b.line, r.b.disposition]]
        }
      : { columns: [], rows: [] };
  }
});

function genealogyGraph(r, W, H) {
  const cols = [
    r.raws,
    [r.blend],
    [{ name: 'Batch ' + r.b.id, lot: r.b.form + ', ' + FMT.int(r.b.units) + ' units' }],
    r.finished
  ];
  const colX = i => 110 + i * ((W - 220) / 3);
  const nodes = [];
  const kinds = ['raw', 'blend', 'batch', 'fin'];
  cols.forEach((list, ci) =>
    list.forEach((n, i) => {
      const gap = Math.min(30, (H - 30) / Math.max(1, list.length));
      nodes.push({
        id: kinds[ci] + i,
        kind: kinds[ci],
        name: n.name,
        lot: n.lot,
        supplier: n.supplier,
        qty: n.qty,
        x: colX(ci),
        y: 10 + H / 2 + (i - (list.length - 1) / 2) * gap
      });
    })
  );
  const links = [];
  r.raws.forEach((_, i) => links.push({ source: 'raw' + i, target: 'blend0' }));
  links.push({ source: 'blend0', target: 'batch0' });
  r.finished.forEach((_, i) => links.push({ source: 'batch0', target: 'fin' + i }));
  return { nodes, links };
}

const NODE_STYLE = {
  raw: ['#FFFFFF', '#8A8886', '#252423'],
  blend: ['#E6F4F0', '#37A794', '#252423'],
  batch: ['#3257A8', '#3257A8', '#FFFFFF'],
  fin: ['#EEF2FA', '#6B91C9', '#252423']
};

defineVisual({
  id: 'brGenealogy',
  page: 'batch',
  title: 'Batch genealogy: raw material lots, blend, batch, finished lots',
  pos: [12, 154, 1256, 188],
  render(el) {
    const r = currentRecord();
    const chart = chartFor('brGenealogy', el);
    if (!r) {
      chart.clear();
      return;
    }
    const { nodes, links } = genealogyGraph(r, el.clientWidth, el.clientHeight);
    chart.setOption(
      {
        animation: false,
        tooltip: Object.assign({}, TT, {
          formatter: p =>
            p.dataType === 'node'
              ? ttHtml(
                  [
                    ['Item', p.data.name],
                    ['Lot', p.data.lot]
                  ]
                    .concat(p.data.supplier ? [['Supplier', p.data.supplier]] : [])
                    .concat(p.data.qty ? [['Units', FMT.int(p.data.qty)]] : [])
                )
              : ''
        }),
        graphic: ['Raw material lots', 'Blend', 'Batch', 'Finished lots'].map((t, i) => ({
          type: 'text',
          left: 110 + i * ((el.clientWidth - 220) / 3) - 50,
          top: 0,
          style: { text: t, fontSize: 10, fill: '#605E5C', fontFamily: FONT, fontWeight: 600 }
        })),
        grid: { left: 0, right: 0, top: 0, bottom: 0 },
        xAxis: { type: 'value', min: 0, max: el.clientWidth, show: false },
        yAxis: { type: 'value', min: 0, max: el.clientHeight, show: false, inverse: true },
        series: [
          {
            type: 'graph',
            coordinateSystem: 'cartesian2d',
            roam: false,
            edgeSymbol: ['none', 'arrow'],
            edgeSymbolSize: 6,
            lineStyle: { color: '#A19F9D', width: 1, curveness: 0.15 },
            data: nodes.map(n => ({
              ...n,
              value: [n.x, n.y],
              x: undefined,
              y: undefined,
              symbol: 'roundRect',
              symbolSize: [190, 26],
              itemStyle: { color: NODE_STYLE[n.kind][0], borderColor: NODE_STYLE[n.kind][1], borderWidth: 1 },
              label: {
                show: true,
                color: NODE_STYLE[n.kind][2],
                fontSize: 9,
                fontFamily: FONT,
                formatter: n.name.length > 30 ? n.name.slice(0, 29) + '.' + ' | ' + n.lot : n.name + ' | ' + n.lot
              }
            })),
            links
          }
        ]
      },
      true
    );
  },
  data() {
    const r = currentRecord();
    if (!r) return { columns: [], rows: [] };
    return {
      columns: ['Stage', 'Item', 'Lot', 'Supplier'],
      rows: r.raws
        .map(x => ['Raw material', x.name, x.lot, x.supplier])
        .concat(
          [['Blend', r.blend.name, r.blend.lot, '']],
          r.finished.map(f => ['Finished', f.name, f.lot, ''])
        )
    };
  }
});

function specBullet(c) {
  if (c.result === null) return '<span class="bullet empty"></span>';
  const span = c.usl - c.lsl;
  const lo = c.lsl - span * 0.25;
  const hi = c.usl + span * 0.25;
  const pos = v => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  return (
    '<span class="bullet"><i class="spec" style="left:' +
    pos(c.lsl) +
    '%;width:' +
    (pos(c.usl) - pos(c.lsl)) +
    '%"></i><b class="' +
    (c.status === 'Fail' ? 'bad' : '') +
    '" style="left:' +
    pos(c.result) +
    '%"></b></span>'
  );
}

defineVisual({
  id: 'brChecks',
  page: 'batch',
  title: 'In-process checks against specification limits',
  pos: [12, 350, 760, 198],
  render(el) {
    const r = currentRecord();
    if (!r) {
      el.innerHTML = NO_BATCH;
      return;
    }
    const st = { Pass: 'checkCircle', Fail: 'failCircle', Pending: 'emptyCircle' };
    el.innerHTML =
      '<div class="tbl-wrap"><table class="pbi-table"><thead><tr><th>Stage</th><th>Check</th><th class="num">LSL</th><th class="num">USL</th><th class="num">Result</th><th>Unit</th><th>Position in spec</th><th>Status</th></tr></thead><tbody>' +
      r.checks
        .map(
          c =>
            '<tr><td>' +
            c.stage +
            '</td><td>' +
            c.name +
            '</td><td class="num">' +
            c.lsl.toFixed(c.dp) +
            '</td><td class="num">' +
            c.usl.toFixed(c.dp) +
            '</td><td class="num' +
            (c.status === 'Fail' ? ' bad-txt' : '') +
            '">' +
            (c.result === null ? '' : c.result.toFixed(c.dp)) +
            '</td><td>' +
            c.unit +
            '</td><td>' +
            specBullet(c) +
            '</td><td class="st">' +
            icon(st[c.status], 13) +
            c.status +
            '</td></tr>'
        )
        .join('') +
      '</tbody></table></div>';
  },
  data() {
    const r = currentRecord();
    return r
      ? {
          columns: ['Stage', 'Check', 'LSL', 'USL', 'Result', 'Unit', 'Status'],
          rows: r.checks.map(c => [c.stage, c.name, c.lsl, c.usl, c.result, c.unit, c.status])
        }
      : { columns: [], rows: [] };
  }
});

defineVisual({
  id: 'brControl',
  page: 'batch',
  pos: [12, 556, 760, 136],
  title: () => {
    const r = currentRecord();
    return r
      ? r.checks[0].name + ' individual samples (' + r.checks[0].unit + ') against specification limits'
      : 'In-process samples';
  },
  render(el) {
    const r = currentRecord();
    const chart = chartFor('brControl', el);
    if (!r) {
      chart.clear();
      return;
    }
    const c = r.checks[0];
    const empty = !r.samples.length;
    const lim = (v, name) => ({
      yAxis: v,
      label: { formatter: name + ' ' + v, position: 'insideEndTop', fontSize: 9, color: '#605E5C', fontFamily: FONT }
    });
    chart.setOption(
      {
        animation: false,
        textStyle: { fontFamily: FONT },
        grid: { left: 52, right: 16, top: 10, bottom: 22 },
        graphic: empty
          ? [
              {
                type: 'text',
                left: 'center',
                top: 'middle',
                style: {
                  text: 'No samples recorded. The batch has not started.',
                  fill: '#605E5C',
                  fontSize: 11,
                  fontFamily: FONT
                }
              }
            ]
          : [],
        tooltip: Object.assign({}, TT, {
          trigger: 'axis',
          formatter: ps =>
            ttHtml([
              ['Sample', ps[0].name],
              [c.name, ps[0].value + ' ' + c.unit],
              ['Specification', c.lsl + ' to ' + c.usl]
            ])
        }),
        xAxis: {
          type: 'category',
          data: r.samples.map((_, i) => String(i + 1)),
          axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 9 }),
          axisTick: { show: false },
          axisLine: { lineStyle: { color: '#C8C6C4' } }
        },
        yAxis: {
          type: 'value',
          min: +(c.lsl - (c.usl - c.lsl) * 0.2).toFixed(c.dp + 1),
          max: +(c.usl + (c.usl - c.lsl) * 0.2).toFixed(c.dp + 1),
          splitNumber: 3,
          axisLabel: Object.assign({}, AXIS_LABEL, { fontSize: 9 }),
          splitLine: GRID_LINE
        },
        series: [
          {
            type: 'line',
            data: r.samples,
            symbol: 'circle',
            symbolSize: 4,
            lineStyle: { width: 1.5, color: THEME[0] },
            itemStyle: { color: THEME[0] },
            markLine: {
              silent: true,
              symbol: 'none',
              lineStyle: { color: '#D13438', type: 'dashed', width: 1 },
              data: [lim(c.lsl, 'LSL'), lim(c.usl, 'USL')]
            }
          }
        ]
      },
      true
    );
  },
  data() {
    const r = currentRecord();
    return r
      ? { columns: ['Sample', r.checks[0].name + ' ' + r.checks[0].unit], rows: r.samples.map((v, i) => [i + 1, v]) }
      : { columns: [], rows: [] };
  }
});

defineVisual({
  id: 'brRelease',
  page: 'batch',
  title: 'Release checklist',
  pos: [780, 350, 488, 342],
  render(el) {
    const r = currentRecord();
    if (!r) {
      el.innerHTML = NO_BATCH;
      return;
    }
    const ic = {
      Complete: 'checkCircle',
      'In progress': 'clockCircle',
      'Not started': 'emptyCircle',
      Failed: 'failCircle',
      'Not applicable': 'emptyCircle'
    };
    const done = r.checklist.filter(c => c.status === 'Complete').length;
    el.innerHTML =
      '<div class="rl-sum">' +
      done +
      ' of ' +
      r.checklist.length +
      ' steps complete</div><div class="rl-list">' +
      r.checklist
        .map(
          c =>
            '<div class="rl-item"><span class="rl-ic">' +
            icon(ic[c.status], 15) +
            '</span><div class="rl-txt"><div>' +
            esc(c.step) +
            '</div><div class="rl-ref">' +
            esc(c.ref) +
            '</div></div><div class="rl-st"><div>' +
            c.status +
            '</div><div class="rl-ref">' +
            esc(c.note) +
            '</div></div></div>'
        )
        .join('') +
      '</div>';
  },
  data() {
    const r = currentRecord();
    return r
      ? {
          columns: ['Step', 'Reference', 'Status', 'Note'],
          rows: r.checklist.map(c => [c.step, c.ref, c.status, c.note])
        }
      : { columns: [], rows: [] };
  }
});
