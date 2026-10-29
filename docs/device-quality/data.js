/* data.js: deterministic sample data model (fictional). Seeded PRNG, dimension and fact tables. */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(20261001);
  const randInt = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  function normal() {
    let u = 0;
    while (!u) u = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  }
  function poisson(lambda) {
    if (lambda > 30) return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal()));
    const limit = Math.exp(-lambda);
    let k = 0,
      p = 1;
    do {
      k++;
      p *= rnd();
    } while (p > limit);
    return k - 1;
  }
  function weighted(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = rnd() * total;
    for (const [key, w] of entries) {
      r -= w;
      if (r <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }

  // Calendar: Jan 2024 to Sep 2026
  const DAY_MS = 86400000;
  const DAY0 = Date.UTC(2024, 0, 1);
  const MONTH_NAMES = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];
  const MONTH_SHORT = MONTH_NAMES.map(n => n.slice(0, 3));
  const SEASON = [0.93, 0.95, 1.03, 1.0, 1.01, 0.98, 0.94, 0.86, 1.0, 1.05, 1.07, 1.1];
  const MONTHS = [];
  for (let m = 0; m < 33; m++) {
    const year = 2024 + Math.floor(m / 12),
      mo = m % 12,
      q = Math.floor(mo / 3) + 1;
    const first = (Date.UTC(year, mo, 1) - DAY0) / DAY_MS;
    const last = (Date.UTC(year, mo + 1, 1) - DAY0) / DAY_MS - 1;
    MONTHS.push({
      idx: m,
      year,
      mo,
      q,
      yq: year + ' Qtr ' + q,
      label: MONTH_SHORT[mo] + ' ' + year,
      name: MONTH_NAMES[mo],
      short: MONTH_SHORT[mo],
      first,
      last
    });
  }
  const END_DAY = MONTHS[MONTHS.length - 1].last;
  function dayToDate(d) {
    return new Date(DAY0 + d * DAY_MS);
  }
  function fmtDay(d) {
    if (d == null) return '';
    const dt = dayToDate(d);
    return dt.getUTCMonth() + 1 + '/' + dt.getUTCDate() + '/' + dt.getUTCFullYear();
  }
  function monthOfDay(d) {
    for (let i = MONTHS.length - 1; i >= 0; i--) if (d >= MONTHS[i].first) return i;
    return 0;
  }

  const PRODUCTS = [
    {
      name: 'Infusion Pump Model A',
      short: 'Model A',
      code: 'PMA',
      family: 'Infusion device',
      base: 880,
      rate: 20,
      launch: 0,
      trend: -0.004
    },
    {
      name: 'Infusion Pump Model B',
      short: 'Model B',
      code: 'PMB',
      family: 'Infusion device',
      base: 640,
      rate: 21,
      launch: 0,
      trend: 0.006
    },
    {
      name: 'Infusion Pump Model C',
      short: 'Model C',
      code: 'PMC',
      family: 'Infusion device',
      base: 560,
      rate: 17,
      launch: 17,
      trend: 0.01
    },
    {
      name: 'Administration Set',
      short: 'Admin Set',
      code: 'ADS',
      family: 'Infusion device',
      base: 360,
      rate: 13,
      launch: 0,
      trend: 0.004
    },
    {
      name: 'Remote Controller',
      short: 'Remote',
      code: 'RMC',
      family: 'Accessory',
      base: 140,
      rate: 34,
      launch: 0,
      trend: 0.002
    },
    {
      name: 'Charger',
      short: 'Charger',
      code: 'CHG',
      family: 'Accessory',
      base: 520,
      rate: 31,
      launch: 0,
      trend: 0.008
    }
  ];
  const PRODUCT_BY_CODE = {};
  PRODUCTS.forEach(p => {
    PRODUCT_BY_CODE[p.code] = p;
  });
  const REGIONS = ['North America', 'Europe', 'Asia Pacific', 'Middle East', 'Latin America'];
  const REGION_W = {
    'North America': 0.42,
    Europe: 0.33,
    'Asia Pacific': 0.13,
    'Middle East': 0.06,
    'Latin America': 0.06
  };

  const FM_TREE = {
    Battery: ['Premature depletion', 'Charging failure', 'Unexpected shutdown'],
    Telemetry: ['Communication loss', 'Interference', 'Pairing failure'],
    'Fluid path': ['Occlusion', 'Connector leak', 'Air in line'],
    'Therapy delivery': ['Delivery rate error', 'Therapy interruption'],
    Software: ['Parameter reset', 'Log data corruption', 'Display error'],
    Mechanical: ['Case damage', 'Connector damage', 'Cable wear'],
    Labeling: ['IFU discrepancy', 'Label mismatch'],
    'Use error': ['Incorrect programming', 'Missed charging'],
    'No failure found': ['Customer inquiry', 'Returned, no fault found']
  };
  const FM_WEIGHTS = {
    PMA: {
      Battery: 13,
      Telemetry: 15,
      'Fluid path': 18,
      'Therapy delivery': 11,
      Software: 9,
      Mechanical: 6,
      Labeling: 5,
      'Use error': 9,
      'No failure found': 14
    },
    PMB: {
      Battery: 17,
      Telemetry: 14,
      'Fluid path': 16,
      'Therapy delivery': 10,
      Software: 9,
      Mechanical: 6,
      Labeling: 5,
      'Use error': 9,
      'No failure found': 14
    },
    PMC: {
      Battery: 9,
      Telemetry: 19,
      'Fluid path': 13,
      'Therapy delivery': 9,
      Software: 21,
      Mechanical: 5,
      Labeling: 7,
      'Use error': 7,
      'No failure found': 10
    },
    ADS: { 'Fluid path': 46, Mechanical: 24, Labeling: 9, 'Use error': 8, 'No failure found': 13 },
    RMC: { Telemetry: 36, Software: 24, Mechanical: 19, Labeling: 5, 'Use error': 6, 'No failure found': 10 },
    CHG: { Battery: 30, Mechanical: 21, Software: 9, Labeling: 6, 'Use error': 21, 'No failure found': 13 }
  };
  const CATEGORY_OF = {
    Battery: 'Device malfunction',
    Telemetry: 'Device malfunction',
    'Fluid path': 'Device malfunction',
    'Therapy delivery': 'Device malfunction',
    Mechanical: 'Device malfunction',
    Software: 'Software',
    Labeling: 'Labeling and packaging',
    'Use error': 'Use error',
    'No failure found': 'Customer feedback'
  };
  const CATEGORIES = [
    'Device malfunction',
    'Adverse event',
    'Software',
    'Use error',
    'Labeling and packaging',
    'Customer feedback'
  ];
  const REPORT_P = {
    Battery: 0.34,
    Telemetry: 0.1,
    'Fluid path': 0.3,
    'Therapy delivery': 0.42,
    Software: 0.1,
    Mechanical: 0.06,
    Labeling: 0.02,
    'Use error': 0.07,
    'No failure found': 0.01
  };
  const HAZARDS = {
    Battery: {
      id: 'HAZ-001',
      hazard: 'Premature battery depletion',
      situation: 'Pump stops infusing before the scheduled recharge',
      harm: 'Interrupted medication delivery',
      severity: 'S4 Serious',
      estP: 'P2 Remote'
    },
    Telemetry: {
      id: 'HAZ-002',
      hazard: 'Loss of remote controller link',
      situation: 'User cannot review or reprogram the pump remotely',
      harm: 'Delayed dose adjustment',
      severity: 'S2 Minor',
      estP: 'P3 Occasional'
    },
    'Fluid path': {
      id: 'HAZ-003',
      hazard: 'Occlusion or leak in the fluid path',
      situation: 'Medication not delivered or delivered at reduced volume',
      harm: 'Under-dosing, delayed therapy',
      severity: 'S4 Serious',
      estP: 'P2 Remote'
    },
    'Therapy delivery': {
      id: 'HAZ-004',
      hazard: 'Delivery outside programmed rate',
      situation: 'Medication delivered faster or slower than programmed',
      harm: 'Over-dosing or under-dosing',
      severity: 'S4 Serious',
      estP: 'P1 Improbable'
    },
    Software: {
      id: 'HAZ-005',
      hazard: 'Incorrect parameter state',
      situation: 'Pump operates with default parameters',
      harm: 'Incorrect dose',
      severity: 'S3 Moderate',
      estP: 'P2 Remote'
    },
    Mechanical: {
      id: 'HAZ-006',
      hazard: 'Enclosure or connector damage',
      situation: 'Fluid ingress or broken connector',
      harm: 'Interrupted therapy, device replacement',
      severity: 'S4 Serious',
      estP: 'P1 Improbable'
    },
    Labeling: {
      id: 'HAZ-007',
      hazard: 'Incorrect or unclear instructions',
      situation: 'User follows incorrect instruction',
      harm: 'Use error with delayed therapy',
      severity: 'S2 Minor',
      estP: 'P2 Remote'
    },
    'Use error': {
      id: 'HAZ-008',
      hazard: 'Missed charging or incorrect programming',
      situation: 'Therapy interrupted by user action',
      harm: 'Interrupted therapy',
      severity: 'S3 Moderate',
      estP: 'P3 Occasional'
    }
  };

  function pickSub(code, fm) {
    const subs = FM_TREE[fm];
    if (fm === 'Battery' && code === 'CHG') return rnd() < 0.85 ? 'Charging failure' : 'Unexpected shutdown';
    if (fm === 'Battery')
      return weighted({ 'Premature depletion': 5, 'Charging failure': 3, 'Unexpected shutdown': 2 });
    return subs[Math.floor(rnd() * subs.length)];
  }

  // Units shipped by month, product, region
  const shipments = [];
  const unitsPM = {}; // code|month -> units
  MONTHS.forEach(M => {
    PRODUCTS.forEach(p => {
      if (M.idx < p.launch) return;
      const ramp = p.launch ? Math.min(1, (M.idx - p.launch + 1) / 6) : 1;
      const trend = 1 + p.trend * M.idx;
      REGIONS.forEach(r => {
        const mean = p.base * ramp * trend * SEASON[M.mo] * REGION_W[r];
        const units = Math.max(1, Math.round(mean * (1 + 0.07 * normal())));
        shipments.push({ month: M.idx, product: p.name, region: r, units });
        unitsPM[p.code + '|' + M.idx] = (unitsPM[p.code + '|' + M.idx] || 0) + units;
      });
    });
  });

  // Complaints
  const complaints = [];
  function makeComplaint(m, p, opts) {
    const M = MONTHS[m];
    const day = M.first + randInt(0, M.last - M.first);
    const fm = opts.fm || weighted(FM_WEIGHTS[p.code]);
    const sub = opts.sub || pickSub(p.code, fm);
    let category = CATEGORY_OF[fm];
    if (p.family === 'Infusion device' && ['Therapy delivery', 'Fluid path', 'Battery'].includes(fm) && rnd() < 0.12)
      category = 'Adverse event';
    let pReport = REPORT_P[fm] * (p.family === 'Accessory' ? 0.35 : 1);
    if (category === 'Adverse event') pReport = 0.92;
    if (opts.reportP != null) pReport = opts.reportP;
    const isReportable = rnd() < pReport;
    const elapsed = END_DAY - day;
    const daysToDecision = clamp(Math.round(8 + 5 * normal()), 1, 42);
    const decided = daysToDecision <= elapsed;
    const lateRisk = m >= 24 && m <= 26 ? 0.17 : 0.035;
    let daysToMdr = null;
    if (isReportable) daysToMdr = rnd() < lateRisk ? randInt(31, 49) : clamp(Math.round(17 + 6 * normal()), 4, 30);
    const mdrFiled = isReportable && decided && daysToMdr <= elapsed;
    const closeDays = randInt(35, 160);
    let status = 'Closed';
    if (elapsed < closeDays) status = decided ? 'Open, investigation' : 'Open, MDR decision pending';
    const region = opts.region || weighted(REGION_W);
    const returned = rnd() < (p.family === 'Accessory' ? 0.7 : 0.4);
    complaints.push({
      id: '',
      day,
      month: m,
      product: p.name,
      region,
      category,
      failureMode: fm,
      subMode: sub,
      serial: p.code + '-' + (100000 + Math.floor(rnd() * 899999)),
      reportable: decided ? (isReportable ? 'Yes' : 'No') : 'Pending',
      assessed: elapsed >= 3 || decided ? 'Yes' : 'No',
      daysToDecision: decided ? daysToDecision : null,
      mdrFiled,
      daysToMdr: isReportable ? daysToMdr : null,
      elapsed,
      status,
      closedDay: status === 'Closed' ? day + closeDays : null,
      returned: returned ? 'Yes' : 'No',
      capaId: null
    });
  }
  MONTHS.forEach(M => {
    PRODUCTS.forEach(p => {
      const units = unitsPM[p.code + '|' + M.idx];
      if (!units) return;
      let rate = p.rate * 1.12;
      if (p.launch) rate *= 1 + 1.3 * Math.exp(-(M.idx - p.launch) / 3);
      const n = poisson((units * rate) / 1000);
      for (let i = 0; i < n; i++) makeComplaint(M.idx, p, {});
    });
  });
  // Planted anomaly 1: Model B premature depletion, Jul to Sep 2025
  [
    [18, 34],
    [19, 72],
    [20, 41]
  ].forEach(([m, n]) => {
    for (let i = 0; i < n; i++)
      makeComplaint(m, PRODUCT_BY_CODE.PMB, {
        fm: 'Battery',
        sub: 'Premature depletion',
        reportP: 0.55,
        region: rnd() < 0.55 ? 'Europe' : 'North America'
      });
  });
  // Planted anomaly 2: Charger charging failure in Europe, Feb to Mar 2026
  [
    [25, 31],
    [26, 24]
  ].forEach(([m, n]) => {
    for (let i = 0; i < n; i++)
      makeComplaint(m, PRODUCT_BY_CODE.CHG, { fm: 'Battery', sub: 'Charging failure', region: 'Europe' });
  });
  complaints.sort((a, b) => a.day - b.day);
  const seqByYear = {};
  complaints.forEach(c => {
    const y = MONTHS[c.month].year;
    seqByYear[y] = (seqByYear[y] || 0) + 1;
    c.id = 'CMP-' + String(y).slice(2) + '-' + String(seqByYear[y]).padStart(5, '0');
  });

  // CAPA
  const SOURCES = {
    Complaint: 32,
    Nonconformance: 22,
    'Internal audit': 15,
    Supplier: 12,
    'Trend analysis': 8,
    'External audit': 6,
    'Management review': 5
  };
  const ROOT_BY_SOURCE = {
    Complaint: {
      Design: 30,
      'Manufacturing process': 22,
      'Supplier material': 16,
      Software: 14,
      'Labeling content': 10,
      'Human error': 8
    },
    Nonconformance: {
      'Manufacturing process': 40,
      Equipment: 18,
      'Human error': 18,
      'Supplier material': 16,
      'Procedure inadequate': 8
    },
    'Internal audit': { 'Procedure inadequate': 50, 'Human error': 25, 'Training gap': 25 },
    Supplier: { 'Supplier material': 70, 'Manufacturing process': 15, 'Procedure inadequate': 15 },
    'Trend analysis': { Design: 35, 'Manufacturing process': 35, Software: 30 },
    'External audit': { 'Procedure inadequate': 60, 'Training gap': 40 },
    'Management review': { 'Procedure inadequate': 50, 'Training gap': 50 }
  };
  const PROCESS_BY_ROOT = {
    Design: ['Design control'],
    'Manufacturing process': ['Manufacturing', 'Production test'],
    'Supplier material': ['Purchasing', 'Incoming inspection'],
    Software: ['Software lifecycle'],
    'Labeling content': ['Labeling'],
    'Human error': ['Manufacturing', 'Complaint handling'],
    Equipment: ['Production test', 'Manufacturing'],
    'Procedure inadequate': ['Document control', 'Complaint handling', 'Purchasing'],
    'Training gap': ['Training', 'Complaint handling']
  };
  const OWNER_BY_PROCESS = {
    'Design control': 'R&D',
    Manufacturing: 'Operations',
    'Production test': 'Operations',
    Purchasing: 'Supply Chain',
    'Incoming inspection': 'Quality Assurance',
    'Software lifecycle': 'R&D',
    Labeling: 'Regulatory Affairs',
    'Complaint handling': 'Quality Assurance',
    'Document control': 'Quality Assurance',
    Training: 'Human Resources'
  };
  const PRODUCT_W = {};
  PRODUCTS.forEach(p => {
    PRODUCT_W[p.code] = p.base;
  });
  const capa = [];
  function makeCapa(m, opts) {
    const M = MONTHS[m];
    const day = opts.day != null ? opts.day : M.first + randInt(0, M.last - M.first);
    const source = opts.source || weighted(SOURCES);
    const rootCause = opts.rootCause || weighted(ROOT_BY_SOURCE[source]);
    const procs = PROCESS_BY_ROOT[rootCause];
    const process = opts.process || procs[Math.floor(rnd() * procs.length)];
    const owner =
      rnd() < 0.85 ? OWNER_BY_PROCESS[process] : weighted({ 'Quality Assurance': 2, Operations: 1, 'R&D': 1 });
    const p = opts.product ? PRODUCT_BY_CODE[opts.product] : PRODUCT_BY_CODE[weighted(PRODUCT_W)];
    const severity =
      opts.severity || clamp(Math.round((4.6 + 1.9 * normal() + (source === 'Complaint' ? 1 : 0)) * 10) / 10, 1, 10);
    const dueDay = day + (severity >= 7 ? 60 : 90);
    let duration = Math.round(Math.exp(Math.log(68) + 0.5 * normal()));
    if (source === 'Supplier') duration = Math.round(duration * 1.8);
    if (opts.duration) duration = opts.duration;
    const closedDay = day + duration <= END_DAY ? day + duration : null;
    let effectiveness = 'Not started';
    if (closedDay != null)
      effectiveness = rnd() < 0.83 ? 'Effective' : rnd() < 0.5 ? 'Not effective' : 'Verification pending';
    const fm = opts.fm || (source === 'Complaint' ? weighted(FM_WEIGHTS[p.code]) : null);
    capa.push({
      id: '',
      day,
      month: m,
      product: p.name,
      region: opts.region || weighted(REGION_W),
      source,
      rootCause,
      process,
      owner,
      severity,
      dueDay,
      closedDay,
      effectiveness,
      failureMode: fm,
      title: opts.title || (fm ? fm + ' complaints, ' + p.short : process + ', ' + rootCause.toLowerCase())
    });
  }
  MONTHS.forEach(M => {
    const n = poisson(5.6 + 0.04 * M.idx);
    for (let i = 0; i < n; i++) makeCapa(M.idx, {});
  });
  makeCapa(19, {
    source: 'Complaint',
    rootCause: 'Supplier material',
    process: 'Purchasing',
    product: 'PMB',
    fm: 'Battery',
    severity: 8.8,
    duration: 900,
    region: 'Europe',
    title: 'Premature depletion trend, Model B cell lot'
  });
  makeCapa(19, {
    source: 'Trend analysis',
    rootCause: 'Design',
    process: 'Design control',
    product: 'PMB',
    fm: 'Battery',
    severity: 8.1,
    duration: 900,
    region: 'North America',
    title: 'Battery current drain margin, Model B'
  });
  makeCapa(17, {
    source: 'Nonconformance',
    rootCause: 'Manufacturing process',
    process: 'Manufacturing',
    product: 'PMB',
    severity: 7.4,
    duration: 240,
    region: 'Europe',
    title: 'Housing bond void cluster, Line 2'
  });
  makeCapa(26, {
    source: 'Complaint',
    rootCause: 'Design',
    process: 'Design control',
    product: 'CHG',
    fm: 'Battery',
    severity: 7.2,
    duration: 900,
    region: 'Europe',
    title: 'Charger contact wear, EU plug variant'
  });
  capa.sort((a, b) => a.day - b.day);
  const capaSeq = {};
  capa.forEach(c => {
    const y = MONTHS[c.month].year;
    capaSeq[y] = (capaSeq[y] || 0) + 1;
    c.id = 'CAPA-' + String(y).slice(2) + '-' + String(capaSeq[y]).padStart(3, '0');
  });
  // Link complaints to complaint-sourced CAPAs of the same product and failure mode
  const capaByKey = {};
  capa
    .filter(c => c.failureMode)
    .forEach(c => {
      const k = c.product + '|' + c.failureMode;
      (capaByKey[k] = capaByKey[k] || []).push(c);
    });
  complaints.forEach(c => {
    const list = capaByKey[c.product + '|' + c.failureMode];
    if (!list) return;
    const match = list.find(a => a.day >= c.day - 30 && a.day <= c.day + 150);
    const strong =
      c.product === PRODUCT_BY_CODE.PMB.name && c.subMode === 'Premature depletion' && c.month >= 18 && c.month <= 21;
    if (match && (strong || rnd() < 0.5)) c.capaId = match.id;
  });

  // NCR
  const DEFECTS = {
    'Housing bond void': 16,
    'Weld porosity': 14,
    'Component out of tolerance': 20,
    'Leak test failure': 8,
    'Label misprint': 10,
    'Documentation error': 18,
    'Particulate contamination': 14
  };
  const ncr = [];
  function makeNcr(m, opts) {
    const M = MONTHS[m];
    const p = PRODUCT_BY_CODE[opts.product || weighted(PRODUCT_W)];
    ncr.push({
      id: '',
      day: M.first + randInt(0, M.last - M.first),
      month: m,
      product: p.name,
      defect: opts.defect || weighted(DEFECTS),
      line: opts.line || weighted({ 'Line 1': 4, 'Line 2': 3, 'Line 3': 2, 'Cleanroom B': 2 }),
      qty: randInt(1, 40),
      disposition: weighted({ Rework: 4, Scrap: 3, 'Use as is': 1, 'Return to supplier': 2 })
    });
  }
  MONTHS.forEach(M => {
    const n = poisson(18 + 2 * Math.sin(M.idx / 2));
    for (let i = 0; i < n; i++) makeNcr(M.idx, {});
  });
  [16, 17, 18].forEach(m => {
    for (let i = 0; i < 11; i++) makeNcr(m, { product: 'PMB', defect: 'Housing bond void', line: 'Line 2' });
  });
  ncr.sort((a, b) => a.day - b.day);
  ncr.forEach((r, i) => {
    r.id = 'NCR-' + String(MONTHS[r.month].year).slice(2) + '-' + String(i + 1).padStart(4, '0');
  });

  // Production first pass yield
  const prod = [];
  MONTHS.forEach(M => {
    PRODUCTS.forEach(p => {
      const units = unitsPM[p.code + '|' + M.idx];
      if (!units) return;
      let fpy = 0.968 + 0.006 * normal();
      if (p.code === 'PMB' && (M.idx === 17 || M.idx === 18)) fpy = M.idx === 17 ? 0.911 : 0.924;
      if (p.launch && M.idx - p.launch < 3) fpy = 0.93 + 0.01 * (M.idx - p.launch);
      const tested = Math.round(units * 1.08);
      prod.push({ month: M.idx, product: p.name, tested, passed: Math.round(tested * clamp(fpy, 0.85, 0.995)) });
    });
  });

  window.PBIDATA = {
    MONTHS,
    PRODUCTS,
    PRODUCT_BY_CODE,
    REGIONS,
    FM_TREE,
    CATEGORIES,
    HAZARDS,
    END_DAY,
    fmtDay,
    monthOfDay,
    complaints,
    shipments,
    capa,
    ncr,
    prod,
    SOURCES: Object.keys(SOURCES),
    DEFECTS: Object.keys(DEFECTS)
  };
})();
