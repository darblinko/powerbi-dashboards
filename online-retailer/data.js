/* Deterministic sample data for the E-Commerce Performance report.
   Fact grain: one row per state, month and product/channel/device slice.
   Months run from Oct 2023 (index 0) to Sep 2026 (index 35). */
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
  const rand = mulberry32(20261001);
  const between = (lo, hi) => lo + (hi - lo) * rand();
  function pickWeighted(weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = rand() * total;
    for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; }
    return weights.length - 1;
  }

  const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const MONTHS = [];
  for (let i = 0; i < 36; i++) {
    const year = 2023 + Math.floor((9 + i) / 12);
    const month = ((9 + i) % 12) + 1;
    MONTHS.push({
      idx: i, year, month, quarter: Math.ceil(month / 3),
      name: MONTH_NAMES[month - 1],
      short: MONTH_NAMES[month - 1].slice(0, 3) + ' ' + year
    });
  }

  const CATEGORIES = ['Apparel', 'Home', 'Electronics', 'Beauty', 'Outdoor'];
  const CAT_SHARE = [0.30, 0.22, 0.24, 0.12, 0.12];
  const CAT_AOV = [78, 121, 214, 46, 138];
  const CAT_MARGIN = [0.56, 0.46, 0.23, 0.63, 0.41];
  const CAT_RETURN = [0.172, 0.081, 0.098, 0.041, 0.069];
  const CHANNELS = ['Organic', 'Paid search', 'Social', 'Email', 'Affiliate'];
  const CH_SHARE = [0.32, 0.26, 0.14, 0.16, 0.12];
  const CH_CR = [1.0, 0.88, 0.62, 1.75, 1.18];
  const DEVICES = ['Mobile', 'Desktop', 'Tablet'];
  const DEV_CR = [0.0205, 0.0362, 0.0268];
  const DEV_AOV = [0.91, 1.13, 1.0];
  const DEV_CHECKOUT = [0.55, 0.70, 0.63];
  const AGE_BANDS = ['18-24', '25-34', '35-44', '45-54', '55+'];
  const AGE_SHARE = [0.16, 0.31, 0.25, 0.16, 0.12];

  // abbr, name, region, population (millions), spend index, tile column, tile row
  const STATES = [
    ['AL', 'Alabama', 'South', 5.1, 0.88, 7, 6], ['AK', 'Alaska', 'West', 0.7, 1.02, 0, 0],
    ['AZ', 'Arizona', 'West', 7.4, 0.98, 2, 5], ['AR', 'Arkansas', 'South', 3.1, 0.86, 5, 5],
    ['CA', 'California', 'West', 39.0, 1.14, 1, 4], ['CO', 'Colorado', 'West', 5.9, 1.10, 3, 4],
    ['CT', 'Connecticut', 'Northeast', 3.6, 1.12, 10, 3], ['DE', 'Delaware', 'South', 1.0, 1.0, 10, 4],
    ['FL', 'Florida', 'South', 22.6, 0.99, 9, 7], ['GA', 'Georgia', 'South', 11.0, 0.96, 8, 6],
    ['HI', 'Hawaii', 'West', 1.4, 1.04, 0, 7], ['ID', 'Idaho', 'West', 2.0, 0.93, 2, 2],
    ['IL', 'Illinois', 'Midwest', 12.5, 1.03, 6, 2], ['IN', 'Indiana', 'Midwest', 6.9, 0.92, 6, 3],
    ['IA', 'Iowa', 'Midwest', 3.2, 0.91, 5, 3], ['KS', 'Kansas', 'Midwest', 2.9, 0.92, 4, 5],
    ['KY', 'Kentucky', 'South', 4.5, 0.88, 6, 4], ['LA', 'Louisiana', 'South', 4.6, 0.87, 5, 6],
    ['ME', 'Maine', 'Northeast', 1.4, 0.95, 11, 0], ['MD', 'Maryland', 'South', 6.2, 1.08, 9, 4],
    ['MA', 'Massachusetts', 'Northeast', 7.0, 1.15, 11, 2], ['MI', 'Michigan', 'Midwest', 10.0, 0.95, 8, 2],
    ['MN', 'Minnesota', 'Midwest', 5.7, 1.04, 5, 2], ['MS', 'Mississippi', 'South', 2.9, 0.82, 6, 6],
    ['MO', 'Missouri', 'Midwest', 6.2, 0.92, 5, 4], ['MT', 'Montana', 'West', 1.1, 0.94, 3, 2],
    ['NE', 'Nebraska', 'Midwest', 2.0, 0.94, 4, 4], ['NV', 'Nevada', 'West', 3.2, 0.99, 2, 3],
    ['NH', 'New Hampshire', 'Northeast', 1.4, 1.06, 11, 1], ['NJ', 'New Jersey', 'Northeast', 9.3, 1.12, 9, 3],
    ['NM', 'New Mexico', 'West', 2.1, 0.86, 3, 5], ['NY', 'New York', 'Northeast', 19.6, 1.13, 9, 2],
    ['NC', 'North Carolina', 'South', 10.8, 0.97, 7, 5], ['ND', 'North Dakota', 'Midwest', 0.8, 0.95, 4, 2],
    ['OH', 'Ohio', 'Midwest', 11.8, 0.94, 7, 3], ['OK', 'Oklahoma', 'South', 4.0, 0.87, 4, 6],
    ['OR', 'Oregon', 'West', 4.2, 1.03, 1, 3], ['PA', 'Pennsylvania', 'Northeast', 13.0, 1.0, 8, 3],
    ['RI', 'Rhode Island', 'Northeast', 1.1, 1.02, 10, 2], ['SC', 'South Carolina', 'South', 5.4, 0.91, 8, 5],
    ['SD', 'South Dakota', 'Midwest', 0.9, 0.92, 4, 3], ['TN', 'Tennessee', 'South', 7.1, 0.93, 6, 5],
    ['TX', 'Texas', 'South', 30.5, 1.0, 4, 7], ['UT', 'Utah', 'West', 3.4, 1.01, 2, 4],
    ['VT', 'Vermont', 'Northeast', 0.6, 1.0, 10, 1], ['VA', 'Virginia', 'South', 8.7, 1.06, 8, 4],
    ['WA', 'Washington', 'West', 7.8, 1.12, 1, 2], ['WV', 'West Virginia', 'South', 1.8, 0.83, 7, 4],
    ['WI', 'Wisconsin', 'Midwest', 5.9, 0.96, 7, 2], ['WY', 'Wyoming', 'West', 0.6, 0.93, 3, 3]
  ].map(s => ({ abbr: s[0], name: s[1], region: s[2], pop: s[3], spend: s[4], col: s[5], row: s[6] }));

  const SEASON = [0.82, 0.74, 0.86, 0.88, 0.94, 0.90, 0.92, 0.96, 0.95, 1.02, 1.38, 1.63];

  function categorySeason(cat, month) {
    if (cat === 4) {
      if (month >= 5 && month <= 8) return 1.5;
      if (month >= 11 || month <= 2) return 0.62;
    }
    if (cat === 2 && month >= 11) return 1.35;
    if (cat === 3 && month === 2) return 1.25;
    return 1;
  }

  const totalWeight = STATES.reduce((s, st) => s + st.pop * st.spend, 0);
  const SALES = [];

  function makeRow(m, stIdx, slice) {
    const mo = MONTHS[m];
    const cat = pickWeighted(CAT_SHARE);
    const ch = pickWeighted(CH_SHARE);
    const mobileShare = 0.54 + 0.07 * (m / 35);
    const dev = pickWeighted([mobileShare, 0.92 - mobileShare, 0.08]);
    const holiday = mo.month >= 11;
    let rev = slice * categorySeason(cat, mo.month) * between(0.78, 1.22);
    if (ch === 1 && m === 20) rev *= 0.48;            // Jun 2025: paid search budget paused
    if (STATES[stIdx].abbr === 'TX' && m === 34) rev *= 1.85; // Aug 2026: Texas tax-free promotion
    const aov = CAT_AOV[cat] * DEV_AOV[dev] * between(0.93, 1.07) * (holiday ? 1.06 : 1);
    const ord = Math.max(1, Math.round(rev / aov));
    let rr = CAT_RETURN[cat] * between(0.85, 1.15);
    if (cat === 2 && (m === 28 || m === 29)) rr *= 2.15; // Feb-Mar 2026: headphone defect returns
    if (cat === 0 && mo.month === 1) rr *= 1.3;
    const margin = CAT_MARGIN[cat] - (holiday ? 0.035 : 0) + between(-0.02, 0.02);
    const cr = DEV_CR[dev] * CH_CR[ch] * (holiday ? 1.14 : 1) * between(0.9, 1.1);
    const ses = Math.round(ord / cr);
    const chk = Math.round(ord / (DEV_CHECKOUT[dev] * between(0.95, 1.05)));
    const atc = Math.round(chk / (0.47 * between(0.94, 1.06)));
    const pv = Math.round(ses * between(0.6, 0.68));
    let newShare = 0.42 - 0.003 * m + (holiday ? 0.08 : 0) + (ch === 2 || ch === 1 ? 0.12 : 0) - (ch === 3 ? 0.22 : 0);
    newShare = Math.min(0.85, Math.max(0.08, newShare + between(-0.03, 0.03)));
    return {
      m, st: stIdx, cat, ch, dev,
      rev: Math.round(rev), cogs: Math.round(rev * (1 - margin)), ord,
      ret: Math.round(ord * rr), ses, pv, atc, chk, newOrd: Math.round(ord * newShare)
    };
  }

  for (let m = 0; m < 36; m++) {
    const mo = MONTHS[m];
    const monthTotal = 15.0e6 * Math.pow(1.14, (m - 29.5) / 12) * SEASON[mo.month - 1];
    STATES.forEach((st, stIdx) => {
      const stateTotal = monthTotal * st.pop * st.spend / totalWeight;
      const n = Math.max(1, Math.round(st.pop / 333 * 220));
      for (let k = 0; k < n; k++) SALES.push(makeRow(m, stIdx, stateTotal / n));
    });
  }

  const DD_WEIGHTS = [0.10, 0.22, 0.25, 0.18, 0.12, 0.08, 0.03, 0.02]; // 2..9 days
  const CUSTOMERS = [];
  const custMonthWeights = MONTHS.map(mo => SEASON[mo.month - 1] * Math.pow(1.1, mo.idx / 12));
  const stateWeights = STATES.map(s => s.pop * s.spend);

  function churnProbability(c) {
    let p = 0.30;
    if (c.dd > 5) p += 0.27;
    if (c.cat === 2) p += 0.15;
    if (c.cat === 3) p -= 0.12;
    if (c.ch === 2) p += 0.11;
    if (c.ch === 3) p -= 0.14;
    if (c.disc) p += 0.08;
    if (c.age === 0) p += 0.07;
    if (c.dev === 0) p += 0.03;
    return Math.min(0.92, Math.max(0.05, p));
  }

  for (let i = 0; i < 9000; i++) {
    const m = pickWeighted(custMonthWeights);
    const st = pickWeighted(stateWeights);
    const remote = STATES[st].abbr === 'AK' || STATES[st].abbr === 'HI';
    const c = {
      id: 100000 + i, m, st,
      cat: pickWeighted(CAT_SHARE), ch: pickWeighted(CH_SHARE),
      dev: pickWeighted([0.58, 0.35, 0.07]),
      dd: Math.min(9, 2 + pickWeighted(DD_WEIGHTS) + (remote ? 3 : 0)),
      disc: rand() < 0.35, age: pickWeighted(AGE_SHARE)
    };
    const latentChurn = rand() < churnProbability(c);
    const act = [0];
    for (let k = 1; k <= 35 - m; k++) {
      const p = latentChurn ? (k > 6 ? 0.03 : 0) : 0.34 * Math.pow(k, -0.32);
      if (rand() < p) act.push(k);
    }
    if (!latentChurn && 35 - m >= 1 && !act.some(k => k >= 1 && k <= 6)) {
      act.push(1 + Math.floor(rand() * Math.min(6, 35 - m)));
      act.sort((a, b) => a - b);
    }
    c.act = act;
    c.churn = m <= 29 ? (latentChurn ? 'Yes' : 'No') : null;
    CUSTOMERS.push(c);
  }

  window.DATA = {
    MONTHS, CATEGORIES, CHANNELS, DEVICES, AGE_BANDS, STATES, SALES, CUSTOMERS,
    CAT_MARGIN, LAST_MONTH: 35, mulberry32
  };
})();
