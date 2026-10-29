/* Deterministic sample data for the Plant Operations and Supplier Quality report.
   Every value is generated from a seeded PRNG. Nothing is drawn from a real system. */
(function () {
  'use strict';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(16949);
  function gauss() {
    let u = 0, v = 0;
    while (u === 0) u = rand();
    while (v === 0) v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function poisson(lambda) {
    const limit = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > limit);
    return k - 1;
  }
  function weightedPick(items, weightOf) {
    const total = items.reduce((s, it) => s + weightOf(it), 0);
    let r = rand() * total;
    for (const it of items) { r -= weightOf(it); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const pad = (n, w) => String(n).padStart(w, '0');
  const DAY = 86400000;
  const isoDate = ms => new Date(ms).toISOString().slice(0, 10);

  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const months = Array.from({ length: 12 }, (_, i) => {
    const year = i < 3 ? 2025 : 2026;
    const m0 = (9 + i) % 12;
    return {
      idx: i, year, m0,
      label: MONTH_NAMES[m0] + ' ' + year,
      short: MONTH_NAMES[m0],
      quarter: 'Q' + (Math.floor(m0 / 3) + 1) + ' ' + year,
      startMs: Date.UTC(year, m0, 1)
    };
  });
  const quarters = [...new Set(months.map(m => m.quarter))];
  function monthIndexOf(ms) {
    const d = new Date(ms);
    return (d.getUTCFullYear() - 2025) * 12 + d.getUTCMonth() - 9;
  }

  const plants = [
    { code: 'MI', name: 'Michigan', country: 'United States', budget: 4.8e6 },
    { code: 'OH', name: 'Ohio', country: 'United States', budget: 3.4e6 },
    { code: 'MX', name: 'Monterrey', country: 'Mexico', budget: 3.9e6 },
    { code: 'PL', name: 'Wroclaw', country: 'Poland', budget: 2.9e6 }
  ];
  const plantByCode = Object.fromEntries(plants.map(p => [p.code, p]));
  const LINE_PLAN = {
    MI: [['M1', 'Machining'], ['M2', 'Machining'], ['S1', 'Stamping']],
    OH: [['S1', 'Stamping'], ['S2', 'Stamping'], ['M1', 'Machining']],
    MX: [['M1', 'Machining'], ['S1', 'Stamping'], ['S2', 'Stamping']],
    PL: [['M1', 'Machining'], ['M2', 'Machining'], ['S1', 'Stamping']]
  };
  const MACHINE_PLAN = {
    Machining: [['C01', 'CNC machining center', 48], ['C02', 'CNC machining center', 52], ['H03', 'Honing cell', 30]],
    Stamping: [['P01', 'Press 800 t', 5], ['P02', 'Press 400 t', 4], ['T03', 'Transfer press', 7]]
  };
  const lines = [];
  const machines = [];
  plants.forEach(p => {
    LINE_PLAN[p.code].forEach(([lc, process]) => {
      const lineId = p.code + '-' + lc;
      lines.push({ id: lineId, plant: p.name, process, name: lineId + ' ' + process });
      MACHINE_PLAN[process].forEach(([mc, desc, ideal]) => {
        machines.push({
          id: lineId + '-' + mc, plant: p.name, plantCode: p.code, line: lineId, process, desc, ideal,
          lambdaBase: 1.0 + rand() * 1.2, perfOffset: gauss() * 0.018
        });
      });
    });
  });

  const REASONS = [
    { name: 'Die change overrun', failure: false, stamp: 3.0, mach: 0.1, mean: 70 },
    { name: 'Tool breakage', failure: true, stamp: 0.4, mach: 2.6, mean: 35 },
    { name: 'Material shortage', failure: false, stamp: 1.2, mach: 1.0, mean: 55 },
    { name: 'Hydraulic failure', failure: true, stamp: 1.5, mach: 0.4, mean: 95 },
    { name: 'Spindle fault', failure: true, stamp: 0.05, mach: 1.3, mean: 110 },
    { name: 'Quality hold', failure: false, stamp: 0.8, mach: 0.9, mean: 60 },
    { name: 'Operator unavailable', failure: false, stamp: 0.7, mach: 0.7, mean: 30 },
    { name: 'Sensor fault', failure: true, stamp: 0.9, mach: 0.8, mean: 25 },
    { name: 'Coolant system', failure: true, stamp: 0.05, mach: 0.9, mean: 40 },
    { name: 'Changeover', failure: false, stamp: 1.3, mach: 0.9, mean: 45 }
  ];
  const reasonByName = Object.fromEntries(REASONS.map(r => [r.name, r]));
  const SHIFTS = ['A', 'B', 'C'];

  function plantTrend(code, mi) {
    if (code === 'OH') return 1.3 - 0.045 * mi;
    if (code === 'MX') return 0.85 + 0.04 * mi;
    if (code === 'PL') return 0.95;
    return 1.0;
  }
  function seasonFactor(startMs, code) {
    if (startMs >= Date.UTC(2025, 11, 22) && startMs < Date.UTC(2026, 0, 3)) return 0.35;
    if (startMs >= Date.UTC(2026, 5, 29) && startMs < Date.UTC(2026, 6, 13)) return 0.5;
    if (startMs === Date.UTC(2025, 10, 24) && (code === 'MI' || code === 'OH')) return 0.8;
    return 1;
  }
  function anomalyFor(machineId, mi) {
    if (machineId === 'MX-S2-P01' && mi === 8) return { lambda: 4.5, reason: 'Hydraulic failure', share: 0.7, dur: 1.8 };
    if (machineId === 'PL-M2-C01' && mi === 4) return { lambda: 3.0, reason: 'Spindle fault', share: 0.6, dur: 1.4 };
    if (machineId === 'MI-M1-C02' && mi === 10) return { lambda: 2.2, reason: 'Tool breakage', share: 0.6, dur: 1.2 };
    return null;
  }
  function scrapRate(m, mi) {
    let rate = m.process === 'Machining' ? 0.012 : 0.018;
    if (m.plantCode === 'MX') rate *= 1.15;
    if (m.plantCode === 'PL') rate *= 0.95;
    if (m.line === 'MX-S2' && (mi === 7 || mi === 8)) rate *= 2.6;
    if (m.plantCode === 'PL' && m.process === 'Stamping' && (mi === 5 || mi === 6)) rate *= 1.8;
    return clamp(rate * (1 + gauss() * 0.18), 0.002, 0.2);
  }

  const Production = [];
  const Downtime = [];
  const plantMonthGood = {};
  let eventSeq = 1;
  const week0 = Date.UTC(2025, 8, 29);
  for (let w = 0; w < 52; w++) {
    const startMs = week0 + w * 7 * DAY;
    const mi = monthIndexOf(startMs + 3 * DAY);
    const quarter = months[mi].quarter;
    machines.forEach(m => {
      const season = seasonFactor(startMs, m.plantCode);
      const anomaly = anomalyFor(m.id, mi);
      SHIFTS.forEach((shift, si) => {
        const planned = Math.round(2250 * season * (shift === 'C' ? 0.93 : 1));
        let lambda = m.lambdaBase * plantTrend(m.plantCode, mi) * (shift === 'C' ? 1.2 : 1) * season;
        if (anomaly) lambda *= anomaly.lambda;
        const count = poisson(lambda);
        const cap = planned * 0.7;
        let dtSum = 0;
        for (let e = 0; e < count; e++) {
          let reason = weightedPick(REASONS, r => (m.process === 'Stamping' ? r.stamp : r.mach));
          let durFactor = 1;
          if (anomaly && rand() < anomaly.share) { reason = reasonByName[anomaly.reason]; durFactor = anomaly.dur; }
          let minutes = Math.max(5, Math.round(reason.mean * 2.2 * durFactor * Math.exp(gauss() * 0.55 - 0.15)));
          if (dtSum + minutes > cap) minutes = Math.round(cap - dtSum);
          if (minutes <= 0) break;
          dtSum += minutes;
          const dayMs = startMs + Math.floor(rand() * 5) * DAY;
          Downtime.push({
            id: 'DT-' + pad(eventSeq++, 5), plant: m.plant, line: m.line, machine: m.id, process: m.process,
            shift, month: mi, quarter, date: isoDate(dayMs),
            dateMs: dayMs + (6 + si * 8 + rand() * 7) * 3600000,
            reason: reason.name, failure: reason.failure, minutes
          });
        }
        const run = planned - dtSum;
        const perf = clamp(0.865 + m.perfOffset - (shift === 'C' ? 0.03 : 0) + gauss() * 0.015, 0.7, 0.99);
        const total = Math.round(run * 60 / m.ideal * perf);
        const scrap = Math.round(total * scrapRate(m, mi));
        Production.push({
          plant: m.plant, line: m.line, machine: m.id, process: m.process, shift, month: mi, quarter, week: w,
          planned, run, ideal: m.ideal, total, good: total - scrap, scrap
        });
        const key = m.plant + '|' + mi;
        plantMonthGood[key] = (plantMonthGood[key] || 0) + total - scrap;
      });
    });
  }

  const categories = ['Material', 'Labor', 'Freight premium', 'Scrap', 'Overtime', 'Energy'];
  const CAT_PLAN = {
    Material: { share: 0.62, bias: -0.018, sd: 0.012 },
    Labor: { share: 0.22, bias: 0.008, sd: 0.01 },
    'Freight premium': { share: 0.012, bias: 0.3, sd: 0.25 },
    Scrap: { share: 0.025, bias: 0.1, sd: 0.12 },
    Overtime: { share: 0.035, bias: 0.15, sd: 0.12 },
    Energy: { share: 0.06, bias: 0.03, sd: 0.05 }
  };
  function costAnomaly(code, cat, mi) {
    if (code === 'OH' && cat === 'Overtime' && mi <= 2) return 0.35;
    if (code === 'MX' && cat === 'Scrap' && (mi === 7 || mi === 8)) return 0.9;
    if (code === 'MX' && cat === 'Overtime' && mi === 8) return 0.6;
    if (code === 'PL' && cat === 'Energy' && (mi === 3 || mi === 4)) return 0.5;
    if (code === 'MI' && cat === 'Freight premium' && mi === 10) return 2.4;
    return 0;
  }
  const Cost = [];
  plants.forEach(p => {
    months.forEach(mo => {
      const season = mo.idx === 2 ? 0.85 : mo.idx === 9 ? 0.82 : 1 + gauss() * 0.02;
      categories.forEach(cat => {
        const plan = CAT_PLAN[cat];
        const budget = Math.round(p.budget * plan.share * season);
        const factor = 1 + plan.bias + gauss() * plan.sd + costAnomaly(p.code, cat, mo.idx);
        Cost.push({ plant: p.name, month: mo.idx, quarter: mo.quarter, category: cat, budget, actual: Math.round(budget * Math.max(0.2, factor)) });
      });
    });
  });

  const suppliers = [
    { name: 'Contoso Steel Coil', tier: 'Tier 2', commodity: 'Steel coil', ppap: 'Approved', plants: ['MI', 'OH', 'MX'], spend: 1.45e6, otd: 0.96, ppm: 180, price: 1.6 },
    { name: 'Fabrikam Metals', tier: 'Tier 2', commodity: 'Steel coil', ppap: 'Approved', plants: ['PL', 'MI'], spend: 0.9e6, otd: 0.89, ppm: 260, price: 1.5, spendGrowth: 0.06, otdGrowth: 0.006 },
    { name: 'Northwind Castings', tier: 'Tier 2', commodity: 'Aluminium castings', ppap: 'Interim', plants: ['MI', 'MX'], spend: 1.1e6, otd: 0.93, ppm: 420, price: 14, ppmSpike: [5, 7, 6], otdDip: [5, 7, -0.12], spendDrop: [9, 0.55] },
    { name: 'Adventure Works Forge', tier: 'Tier 2', commodity: 'Forgings', ppap: 'Approved', plants: ['PL', 'OH'], spend: 0.7e6, otd: 0.95, ppm: 150, price: 9, spendGrowth: 0.04 },
    { name: 'Litware Precision', tier: 'Tier 2', commodity: 'Machined components', ppap: 'Approved', plants: ['MI', 'OH'], spend: 0.62e6, otd: 0.97, ppm: 90, price: 11 },
    { name: 'Proseware Stampings', tier: 'Tier 2', commodity: 'Stampings', ppap: 'Pending', plants: ['OH', 'MX'], spend: 0.66e6, otd: 0.88, ppm: 610, price: 3, spendGrowth: -0.03 },
    { name: 'Woodgrove Bearings', tier: 'Tier 2', commodity: 'Bearings', ppap: 'Approved', plants: ['PL'], spend: 0.48e6, otd: 0.94, ppm: 120, price: 6 },
    { name: 'Tailspin Plastics', tier: 'Tier 3', commodity: 'Resin', ppap: 'Interim', plants: ['MX'], spend: 0.26e6, otd: 0.91, ppm: 330, price: 2.2, ppmGrowth: 45 },
    { name: 'Wingtip Fasteners', tier: 'Tier 3', commodity: 'Fasteners', ppap: 'Approved', plants: ['MX', 'MI', 'OH'], spend: 0.21e6, otd: 0.98, ppm: 40, price: 0.15 },
    { name: 'Coho Coatings', tier: 'Tier 3', commodity: 'Coatings', ppap: 'Approved', plants: ['MI', 'OH'], spend: 0.18e6, otd: 0.95, ppm: 210, price: 4 },
    { name: 'Trey Tooling', tier: 'Tier 3', commodity: 'Tooling', ppap: 'Approved', plants: ['MI'], spend: 0.15e6, otd: 0.92, ppm: 60, price: 85 },
    { name: 'Lucerne Seals', tier: 'Tier 3', commodity: 'Seals', ppap: 'Rejected', plants: ['MX', 'PL'], spend: 0.12e6, otd: 0.85, ppm: 890, price: 0.4 },
    { name: 'Alpine Wire', tier: 'Tier 3', commodity: 'Wire', ppap: 'Approved', plants: ['OH'], spend: 0.09e6, otd: 0.97, ppm: 75, price: 0.9 },
    { name: 'Wide World Parts Distribution', tier: 'Distributor', commodity: 'Fasteners', ppap: 'Approved', plants: ['MI', 'MX', 'PL', 'OH'], spend: 0.16e6, otd: 0.93, ppm: 140, price: 0.2 }
  ];
  function supplierMonth(s, mi) {
    let spend = s.spend * Math.pow(1 + (s.spendGrowth || 0), mi);
    if (s.spendDrop && mi >= s.spendDrop[0]) spend *= s.spendDrop[1];
    if (mi === 2 || mi === 9) spend *= 0.84;
    let ppm = s.ppm + (s.ppmGrowth || 0) * mi;
    if (s.ppmSpike && mi >= s.ppmSpike[0] && mi <= s.ppmSpike[1]) ppm *= s.ppmSpike[2];
    let otd = s.otd + (s.otdGrowth || 0) * mi;
    if (s.otdDip && mi >= s.otdDip[0] && mi <= s.otdDip[1]) otd += s.otdDip[2];
    return { spend: spend * (1 + gauss() * 0.05), ppm, otd };
  }
  const Receipts = [];
  suppliers.forEach(s => {
    const weights = s.plants.map((_, i) => 1 / (i + 1));
    const wsum = weights.reduce((a, b) => a + b, 0);
    months.forEach(mo => {
      const base = supplierMonth(s, mo.idx);
      s.plants.forEach((code, i) => {
        const spend = Math.round(base.spend * weights[i] / wsum);
        const deliveries = Math.max(4, Math.round(spend / 22000) + 4);
        const onTime = Math.round(deliveries * clamp(base.otd + gauss() * 0.02, 0.5, 1));
        const received = Math.round(spend / s.price);
        const defects = Math.max(0, Math.round(received * base.ppm / 1e6 * (1 + gauss() * 0.25)));
        Receipts.push({
          plant: plantByCode[code].name, month: mo.idx, quarter: mo.quarter, supplier: s.name, tier: s.tier,
          commodity: s.commodity, ppap: s.ppap, spend, deliveries, onTime, received, defects
        });
      });
    });
  });

  const oems = ['OEM A', 'OEM B', 'OEM C', 'OEM D'];
  const OEM_MIX = {
    MI: [['OEM A', 0.5], ['OEM B', 0.3], ['OEM C', 0.2]],
    OH: [['OEM A', 0.4], ['OEM D', 0.6]],
    MX: [['OEM B', 0.5], ['OEM C', 0.3], ['OEM A', 0.2]],
    PL: [['OEM C', 0.6], ['OEM D', 0.4]]
  };
  function customerPpm(code, oem, mi) {
    let ppm = 18 * (code === 'MX' ? 1.3 : code === 'PL' ? 0.9 : 1);
    if (code === 'MX' && oem === 'OEM B' && mi === 8) ppm = 140;
    if (code === 'PL' && oem === 'OEM C' && mi === 5) ppm = 90;
    if (code === 'OH') ppm *= 1.4 - 0.05 * mi;
    return Math.max(4, ppm);
  }
  const Shipments = [];
  plants.forEach(p => {
    months.forEach(mo => {
      const good = plantMonthGood[p.name + '|' + mo.idx] || 0;
      OEM_MIX[p.code].forEach(([oem, share]) => {
        const shipped = Math.round(good * share * 0.97);
        const rejects = Math.max(0, Math.round(shipped * customerPpm(p.code, oem, mo.idx) / 1e6 * (1 + gauss() * 0.3)));
        Shipments.push({ plant: p.name, month: mo.idx, quarter: mo.quarter, oem, shipped, rejects });
      });
    });
  });

  const EightD = [];
  const asOf = Date.UTC(2026, 9, 1);
  function add8D(row, source) {
    const mo = months[row.month];
    const openedMs = mo.startMs + Math.floor(rand() * 27) * DAY;
    const openProb = row.month <= 7 ? 0.06 : 0.55;
    const open = rand() < openProb;
    const daysOpen = open ? Math.round((asOf - openedMs) / DAY) : 12 + Math.round(rand() * 45);
    EightD.push({
      id: '8D-' + String(mo.year).slice(2) + '-' + pad(EightD.length + 101, 3), plant: row.plant, month: row.month,
      quarter: row.quarter, source, supplier: row.supplier || null, tier: row.tier || null, oem: row.oem || null,
      opened: isoDate(openedMs), status: open ? 'Open' : 'Closed', daysOpen
    });
  }
  Receipts.forEach(r => {
    const ppm = r.received ? r.defects / r.received * 1e6 : 0;
    if (r.defects > 0 && rand() < Math.min(0.65, ppm / 1400)) add8D(r, 'Supplier');
  });
  Shipments.forEach(r => { if (r.rejects > 6 && rand() < 0.5) add8D(r, 'Customer'); });

  const Maintenance = [];
  let woSeq = 1;
  function addOrder(m, dayMs, type, description, hours) {
    const recent = dayMs > Date.UTC(2026, 8, 18);
    const status = dayMs > Date.UTC(2026, 8, 26) ? 'Scheduled' : recent && rand() < 0.5 ? 'In progress' : 'Completed';
    const mi = clamp(monthIndexOf(dayMs), 0, 11);
    Maintenance.push({
      id: 'WO-26' + pad(woSeq++, 4), plant: m.plant, line: m.line, machine: m.id, process: m.process,
      month: mi, quarter: months[mi].quarter, date: isoDate(dayMs), dateMs: dayMs, type, description,
      hours: Math.round(hours * 10) / 10, status
    });
  }
  machines.forEach(m => {
    months.forEach(mo => {
      addOrder(m, mo.startMs + (8 + Math.floor(rand() * 10)) * DAY, 'Preventive', m.process === 'Stamping' ? 'Monthly press PM and die inspection' : 'Monthly PM, way lube and spindle check', 3 + rand() * 3);
      if (mo.idx % 3 === 1) addOrder(m, mo.startMs + (2 + Math.floor(rand() * 5)) * DAY, 'Predictive', 'Vibration and thermography route', 1 + rand());
    });
  });
  Downtime.forEach(e => {
    if (e.failure && e.minutes >= 150) {
      const m = machines.find(x => x.id === e.machine);
      addOrder(m, Date.parse(e.date) + DAY, 'Corrective', 'Repair after ' + e.reason.toLowerCase(), e.minutes / 60 * 1.3);
    }
  });
  Maintenance.sort((a, b) => a.dateMs - b.dateMs);

  window.PBI_DATA = Object.freeze({
    months, quarters, plants, lines, machines, oems, categories, suppliers,
    reasons: REASONS.map(r => r.name),
    failureReasons: REASONS.filter(r => r.failure).map(r => r.name),
    tables: { Production, Downtime, Cost, Receipts, Shipments, EightD, Maintenance }
  });
})();
