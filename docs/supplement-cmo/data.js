'use strict';
/* Deterministic sample data for the CMO report. Seeded PRNG, no real records. */
(function () {
  const MS_DAY = 864e5;

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRandom(seed) {
    const next = mulberry32(seed);
    return {
      next,
      between: (a, b) => a + (b - a) * next(),
      int: (a, b) => Math.floor(a + (b - a + 1) * next()),
      pick: arr => arr[Math.floor(next() * arr.length)],
      chance: p => next() < p,
      normal: (mu, sd) => {
        const u = 1 - next();
        const v = next();
        return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      },
      weighted: (items, weightOf) => {
        let total = 0;
        for (const it of items) total += weightOf(it);
        let r = next() * total;
        for (const it of items) {
          r -= weightOf(it);
          if (r <= 0) return it;
        }
        return items[items.length - 1];
      },
      poisson: lambda => {
        const limit = Math.exp(-lambda);
        let k = 0;
        let p = 1;
        do {
          k++;
          p *= next();
        } while (p > limit);
        return k - 1;
      }
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = [
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
  const dayOf = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / MS_DAY);
  const partsOf = day => {
    const dt = new Date(Math.floor(day) * MS_DAY);
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay() };
  };
  const fmtDate = day => {
    const p = partsOf(day);
    return p.m + '/' + p.d + '/' + String(p.y).slice(2);
  };

  const DAY0 = dayOf(2025, 1, 6);
  const WEEKS = 90;
  const DATA_END = DAY0 + WEEKS * 7 - 1;
  const TODAY = dayOf(2026, 10, 1);
  const LAST_WEEK = WEEKS - 1;
  const LAST_MONTH = 20;

  const FORMS = ['Capsule', 'Tablet', 'Chewable tablet', 'Powder', 'Softgel', 'Gummy'];
  const FORM_MIX = { Capsule: 0.28, Tablet: 0.2, 'Chewable tablet': 0.07, Powder: 0.15, Softgel: 0.12, Gummy: 0.18 };
  const SITES = ['West Plant', 'Central Plant', 'East Plant'];
  const LINES = [
    { name: 'Encapsulation 1', site: 'West Plant', forms: ['Capsule'] },
    { name: 'Encapsulation 2', site: 'West Plant', forms: ['Capsule'] },
    { name: 'Encapsulation 3', site: 'Central Plant', forms: ['Softgel'] },
    { name: 'Tablet press 1', site: 'West Plant', forms: ['Tablet'] },
    { name: 'Tablet press 2', site: 'East Plant', forms: ['Tablet', 'Chewable tablet'] },
    { name: 'Blending', site: 'Central Plant', forms: ['Powder'] },
    { name: 'Gummy depositor', site: 'East Plant', forms: ['Gummy'] },
    { name: 'Packaging 1', site: 'West Plant', pack: true },
    { name: 'Packaging 2', site: 'West Plant', pack: true },
    { name: 'Packaging 3', site: 'Central Plant', pack: true },
    { name: 'Packaging 4', site: 'East Plant', pack: true }
  ];
  const SITE_OF_LINE = Object.fromEntries(LINES.map(l => [l.name, l.site]));

  const CUSTOMER_NAMES = [
    'Contoso Nutrition',
    'Proseware Botanicals',
    'Woodgrove Wellness',
    'Northwind Vitamins',
    'Coho Naturals',
    'Lamna Health',
    'Wide World Supplements',
    'Fabrikam Wellness',
    'Adventure Works Performance',
    'Litware Roots',
    'Alpine Vital',
    'Relecloud Daily',
    'Trey Nutraceuticals',
    'Blue Yonder Nutrition',
    'VanArsdel Wellness',
    'Southridge Naturals',
    'Lucerne Health',
    'Wingtip Sports Nutrition',
    'Best For You Organics',
    'A. Datum Vitamins',
    'Bellows Herbal',
    'Tailwind Nutrition',
    'Nod Wellness',
    'First Up Herbal',
    'Tailwind Active',
    'Consolidated Health',
    'Humongous Nutrition',
    'Nod Naturals',
    'Humongous Botanicals',
    'Contoso Naturals',
    'Fabrikam Nutrition',
    'Northwind Labs',
    'Litware Vitamins',
    'Proseware Wellness',
    'Woodgrove Health',
    'Coho Nutrition',
    'Tailspin Kids',
    'Adventure Works Naturals',
    'Wide World Botanicals',
    'Alpine Nutrition'
  ];
  const REGIONS = [
    ['West', 0.3],
    ['Central', 0.25],
    ['East', 0.35],
    ['International', 0.1]
  ];

  const INGREDIENTS = {
    Capsule: [
      'Ashwagandha Root 600 mg',
      'Turmeric Curcumin 500 mg',
      'Probiotic 50B CFU',
      'Magnesium Glycinate 400 mg',
      'Elderberry Zinc',
      'Berberine 500 mg',
      'Lions Mane 1000 mg',
      'Quercetin Bromelain'
    ],
    Tablet: [
      'Vitamin D3 5000 IU',
      'B-Complex',
      'Womens Multivitamin',
      'Mens Multivitamin',
      'Calcium Citrate D3',
      'Iron Bisglycinate 25 mg',
      'Prenatal Multi'
    ],
    'Chewable tablet': [
      'Kids Multivitamin Chewable',
      'Vitamin C 500 mg Chewable',
      'Calcium Chewable',
      'Digestive Enzyme Chewable'
    ],
    Powder: [
      'Hydrolyzed Collagen Powder',
      'Daily Greens Powder',
      'Electrolyte Hydration Mix',
      'Creatine Monohydrate',
      'Whey Protein Vanilla',
      'Pre-Workout Citrus'
    ],
    Softgel: [
      'Omega-3 Fish Oil 1200 mg',
      'Vitamin D3 K2 Softgel',
      'CoQ10 200 mg',
      'Krill Oil 500 mg',
      'Vitamin E 400 IU'
    ],
    Gummy: [
      'Apple Cider Vinegar Gummy',
      'Melatonin 5 mg Gummy',
      'Biotin 10000 mcg Gummy',
      'Kids Multi Gummy',
      'Elderberry Gummy',
      'Vitamin C Gummy'
    ]
  };
  const PACK_SIZE = {
    Capsule: ['60 ct', '90 ct', '120 ct'],
    Tablet: ['60 ct', '90 ct', '180 ct'],
    'Chewable tablet': ['60 ct', '90 ct'],
    Powder: ['30 srv', '60 srv'],
    Softgel: ['60 ct', '120 ct'],
    Gummy: ['60 ct', '90 ct']
  };
  const UNIT_PRICE = { Capsule: 2.1, Tablet: 1.6, 'Chewable tablet': 1.4, Powder: 6.5, Softgel: 2.4, Gummy: 1.9 };
  const UNIT_MEAN = {
    Capsule: 42000,
    Tablet: 50000,
    'Chewable tablet': 30000,
    Powder: 12000,
    Softgel: 38000,
    Gummy: 34000
  };
  const YIELD_MEAN = { Capsule: 98.1, Tablet: 97.6, 'Chewable tablet': 97.0, Powder: 98.8, Softgel: 96.2, Gummy: 95.1 };
  const MFG_DAYS = { Capsule: 1.1, Tablet: 0.9, 'Chewable tablet': 0.9, Powder: 0.6, Softgel: 1.6, Gummy: 1.0 };
  const TEST_TYPES = ['Assay potency', 'Microbial', 'Heavy metals', 'Dissolution', 'Identity', 'Moisture'];
  const TEST_WEIGHT = {
    'Assay potency': 30,
    Microbial: 18,
    'Heavy metals': 10,
    Dissolution: 15,
    Identity: 8,
    Moisture: 19
  };
  const DISSOLUTION_FORMS = new Set(['Capsule', 'Tablet', 'Chewable tablet', 'Softgel']);

  function placeAtRank(order, nameIdx, rank) {
    const cur = order.indexOf(nameIdx);
    [order[cur], order[rank]] = [order[rank], order[cur]];
  }

  function chooseForms(rnd, count) {
    const chosen = [];
    while (chosen.length < count) {
      const f = rnd.weighted(
        FORMS.filter(x => !chosen.includes(x)),
        x => FORM_MIX[x]
      );
      chosen.push(f);
    }
    return chosen;
  }

  function buildCustomers(rnd) {
    const order = CUSTOMER_NAMES.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rnd.next() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    placeAtRank(order, CUSTOMER_NAMES.indexOf('Fabrikam Wellness'), 2);
    placeAtRank(order, CUSTOMER_NAMES.indexOf('Tailspin Kids'), 11);
    return order.map((nameIdx, rank) => {
      const name = CUSTOMER_NAMES[nameIdx];
      const tier = rank < 8 ? 'Strategic' : rank < 24 ? 'Core' : 'Emerging';
      const formCount = tier === 'Strategic' ? 3 : tier === 'Core' ? 2 : rnd.int(1, 2);
      let forms = chooseForms(rnd, formCount);
      if (name === 'Fabrikam Wellness') forms = ['Capsule', 'Softgel', 'Tablet'];
      if (name === 'Tailspin Kids') forms = ['Gummy', 'Chewable tablet'];
      return {
        name,
        rank,
        tier,
        forms,
        region: rnd.weighted(REGIONS, r => r[1])[0],
        weight: Math.pow(rank + 2, -0.85),
        priceFactor: rnd.between(0.9, 1.15)
      };
    });
  }

  function lineForForm(form, rnd) {
    if (form === 'Capsule') return 'ENC';
    if (form === 'Softgel') return 'Encapsulation 3';
    if (form === 'Tablet') return rnd.chance(0.6) ? 'Tablet press 1' : 'Tablet press 2';
    if (form === 'Chewable tablet') return 'Tablet press 2';
    if (form === 'Powder') return 'Blending';
    return 'Gummy depositor';
  }

  function buildProducts(rnd, customers) {
    const products = [];
    for (const c of customers) {
      const count = c.tier === 'Strategic' ? rnd.int(4, 6) : c.tier === 'Core' ? rnd.int(3, 4) : rnd.int(2, 3);
      const used = new Set();
      for (let k = 0; k < count; k++) {
        const form = c.forms[k % c.forms.length];
        const options = INGREDIENTS[form].filter(x => !used.has(x));
        if (!options.length) continue;
        const ingredient = rnd.pick(options);
        used.add(ingredient);
        products.push({
          id: 'P' + String(products.length + 101),
          customer: c.name,
          form,
          ingredient,
          name: ingredient + ' ' + rnd.pick(PACK_SIZE[form]),
          line: lineForForm(form, rnd),
          weight: rnd.between(0.5, 1.5)
        });
      }
    }
    return products;
  }

  function holidayFactor(start) {
    let f = 1;
    for (let d = start; d < start + 7; d++) {
      const p = partsOf(d);
      if ((p.m === 12 && p.d === 25) || (p.m === 1 && p.d === 1)) f = Math.min(f, 0.55);
      if (p.m === 7 && p.d === 4) f = Math.min(f, 0.8);
      if (p.m === 11 && p.dow === 4 && p.d >= 22 && p.d <= 28) f = Math.min(f, 0.8);
    }
    return f;
  }

  function weeklyVolume(rnd, w) {
    const start = DAY0 + 7 * w;
    const p = partsOf(start);
    const doy = (start - dayOf(p.y, 1, 1)) / 365;
    const season = 1 + 0.1 * Math.cos(2 * Math.PI * doy) + 0.09 * Math.exp(-Math.pow((doy - 0.8) / 0.07, 2));
    const trend = 1 + 0.0025 * w;
    return Math.max(8, Math.round(rnd.normal(33 * season * trend * holidayFactor(start), 2.5)));
  }

  function oosProbability(b, w) {
    if (b.line === 'Tablet press 1' && w === 44) return 0.85;
    if (b.site === 'Central Plant' && w === 61) return 0.6;
    if (b.form === 'Gummy' && w >= 79) return 0.03 + Math.min(1, (w - 79) / 8) * 0.17;
    return b.form === 'Gummy' ? 0.028 : 0.02;
  }

  function pickTestType(rnd, b, w) {
    if (b.line === 'Tablet press 1' && w === 44) return 'Dissolution';
    if (b.site === 'Central Plant' && w === 61) return 'Heavy metals';
    if (b.form === 'Gummy' && w >= 81)
      return rnd.pick(['Moisture', 'Microbial', 'Moisture', 'Assay potency', 'Microbial']);
    const allowed = TEST_TYPES.filter(t => t !== 'Dissolution' || DISSOLUTION_FORMS.has(b.form));
    return rnd.weighted(allowed, t => TEST_WEIGHT[t]);
  }

  function periodFields(day) {
    const p = partsOf(day);
    const q = Math.floor((p.m - 1) / 3) + 1;
    return {
      year: String(p.y),
      quarter: p.y + ' Q' + q,
      month: p.y + '-' + String(p.m).padStart(2, '0'),
      monthIdx: (p.y - 2025) * 12 + (p.m - 1)
    };
  }

  function makeBatch(rnd, ctx, w, seq) {
    const { customers, productsByCustomer } = ctx;
    const customer = rnd.weighted(customers, c => c.weight);
    const product = rnd.weighted(productsByCustomer[customer.name], p => p.weight);
    const line = product.line === 'ENC' ? (rnd.chance(0.5) ? 'Encapsulation 1' : 'Encapsulation 2') : product.line;
    const form = product.form;
    const day = DAY0 + 7 * w + rnd.between(0, 6.2);
    const endDay = day + MFG_DAYS[form] * rnd.between(0.85, 1.2);
    const b = {
      id: 'B' + periodFields(day).year.slice(2) + '-' + String(seq).padStart(5, '0'),
      week: w,
      day,
      endDay,
      ...periodFields(day),
      site: SITE_OF_LINE[line],
      line,
      form,
      customer: customer.name,
      tier: customer.tier,
      region: customer.region,
      product: product.name
    };
    const gummyRamp = form === 'Gummy' && w >= 79 ? Math.min(1, (w - 79) / 8) : 0;
    const oos = rnd.chance(oosProbability(b, w));
    const deviation = rnd.chance(0.015 + gummyRamp * 0.12 + (b.site === 'East Plant' ? 0.01 : 0));
    b.units = Math.max(5000, Math.round(rnd.normal(UNIT_MEAN[form], UNIT_MEAN[form] * 0.2) / 100) * 100);
    b.yieldPct = Math.min(99.9, Math.max(82, rnd.normal(YIELD_MEAN[form] - gummyRamp * 3.5 - (oos ? 1.5 : 0), 1.0)));
    b.deviation = deviation;
    b.oosTypes = [];
    if (oos) {
      b.oosTypes.push(pickTestType(rnd, b, w));
      if (rnd.chance(0.15)) b.oosTypes.push(pickTestType(rnd, b, w));
    }
    b.oosCount = b.oosTypes.length;
    b.rft = !oos && !deviation;
    const lateEastPlant = b.site === 'East Plant' && w >= 70 ? 1.6 : 0;
    b.releaseDays = Math.max(
      2,
      Math.round(rnd.normal(5.8, 1.2) + (oos || deviation ? rnd.normal(6, 2) : 0) + lateEastPlant)
    );
    b.releaseDay = Math.floor(endDay) + b.releaseDays;
    let disposition = oos
      ? rnd.chance(0.38)
        ? 'Rejected'
        : 'Released with deviation'
      : deviation
        ? 'Released with deviation'
        : 'Released';
    if (b.releaseDay > DATA_END) disposition = 'On hold';
    b.disposition = disposition;
    const released = disposition === 'Released' || disposition === 'Released with deviation';
    if (released) {
      const harbor = customer.name === 'Fabrikam Wellness' && w >= 56 ? 0.2 : 0;
      b.otif = rnd.chance(0.968 - harbor - (deviation || oos ? 0.08 : 0) - (b.releaseDays > 10 ? 0.06 : 0));
      b.revenue = Math.round(b.units * UNIT_PRICE[form] * customer.priceFactor);
      const rate =
        (form === 'Gummy' ? 28 : form === 'Softgel' ? 18 : 13) * (customer.name === 'Tailspin Kids' ? 2.4 : 1);
      b.complaints = rnd.poisson((b.units / 1e6) * rate);
    } else {
      b.otif = disposition === 'Rejected' ? false : null;
      b.revenue = 0;
      b.complaints = 0;
    }
    return b;
  }

  function makeOosRows(rnd, batches) {
    const rows = [];
    const seqByYear = {};
    for (const b of batches) {
      for (const testType of b.oosTypes) {
        const openedDay = Math.floor(b.endDay + rnd.between(1, 4));
        if (openedDay > DATA_END) continue;
        const year = String(partsOf(openedDay).y);
        seqByYear[year] = (seqByYear[year] || 0) + 1;
        const duration = Math.max(5, Math.round(rnd.normal(18, 7)));
        const stuck = rnd.chance(0.03);
        const closedDay = !stuck && openedDay + duration <= DATA_END ? openedDay + duration : null;
        rows.push({
          id: 'OOS-' + year.slice(2) + '-' + String(seqByYear[year]).padStart(4, '0'),
          batchId: b.id,
          testType,
          openedDay,
          closedDay,
          status: closedDay ? 'Closed' : 'Open',
          ageDays: (closedDay || DATA_END) - openedDay,
          site: b.site,
          line: b.line,
          form: b.form,
          customer: b.customer,
          tier: b.tier,
          region: b.region,
          product: b.product,
          week: b.week,
          year: b.year,
          quarter: b.quarter,
          month: b.month,
          monthIdx: b.monthIdx
        });
      }
    }
    return rows;
  }

  function buildSchedule(rnd, ctx, startSeq) {
    const rows = [];
    const packFree = {};
    let seq = startSeq;
    for (const line of LINES.filter(l => !l.pack)) {
      const candidates = ctx.products.filter(
        p =>
          p.line === line.name ||
          (p.line === 'ENC' && line.name.startsWith('Encapsulation') && line.name !== 'Encapsulation 3')
      );
      const packLines = LINES.filter(l => l.pack && l.site === line.site).map(l => l.name);
      let t = TODAY - 5 + rnd.between(0, 0.6);
      while (t < TODAY + 22) {
        const p = rnd.weighted(candidates, x => x.weight * ctx.customerWeight[x.customer]);
        const end = t + MFG_DAYS[p.form] * rnd.between(0.85, 1.25);
        const id = 'B26-' + String(seq++).padStart(5, '0');
        const base = { batchId: id, site: line.site, form: p.form, customer: p.customer, product: p.name };
        rows.push({ ...base, line: line.name, start: t, end, stage: 'Manufacture' });
        const packLine = packLines.reduce((a, c) => ((packFree[c] || 0) < (packFree[a] || 0) ? c : a));
        const ps = Math.max(end + 0.3, packFree[packLine] || 0);
        const pe = ps + rnd.between(0.45, 0.85);
        packFree[packLine] = pe + 0.1;
        rows.push({ ...base, line: packLine, start: ps, end: pe, stage: 'Packaging' });
        t = end + rnd.between(0.15, 0.45);
      }
    }
    for (const r of rows) {
      r.status = r.end <= TODAY ? 'Completed' : r.start <= TODAY ? 'In progress' : 'Planned';
    }
    return rows;
  }

  function generate() {
    const rnd = makeRandom(20261001);
    const customers = buildCustomers(rnd);
    const products = buildProducts(rnd, customers);
    const productsByCustomer = {};
    for (const p of products) (productsByCustomer[p.customer] = productsByCustomer[p.customer] || []).push(p);
    const customerWeight = Object.fromEntries(customers.map(c => [c.name, c.weight]));
    const ctx = { customers, products, productsByCustomer, customerWeight };
    const batches = [];
    let seq = 10001;
    for (let w = 0; w < WEEKS; w++) {
      const n = weeklyVolume(rnd, w);
      for (let i = 0; i < n; i++) batches.push(makeBatch(rnd, ctx, w, seq++));
    }
    batches.sort((a, b) => a.day - b.day);
    const oos = makeOosRows(rnd, batches);
    const schedule = buildSchedule(rnd, ctx, seq + 200);
    return { customers, products, batches, oos, schedule };
  }

  const generated = generate();

  window.DATA = {
    ...generated,
    LINES,
    SITES,
    FORMS,
    TEST_TYPES,
    MONTHS,
    MONTHS_LONG,
    DAY0,
    WEEKS,
    DATA_END,
    TODAY,
    LAST_WEEK,
    LAST_MONTH,
    util: { makeRandom, hashString, dayOf, partsOf, fmtDate, MS_DAY },
    constants: { MFG_DAYS, DISSOLUTION_FORMS }
  };
})();
