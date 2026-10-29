/* Q&A visual: parses a short natural-language question into measure, dimension, Top N and filters. */
(function () {
  'use strict';
  const M = window.MODEL,
    F = window.FRAME,
    D = window.DATA;
  const S = () => M.getState();

  const MEASURE_TERMS = [
    ['average order value', 'aov'],
    ['aov', 'aov'],
    ['basket size', 'aov'],
    ['conversion rate', 'conversion'],
    ['conversion', 'conversion'],
    ['gross margin', 'margin'],
    ['margin', 'margin'],
    ['return rate', 'returnRate'],
    ['returns', 'returnRate'],
    ['cart abandonment', 'cartAbandon'],
    ['gross profit', 'grossProfit'],
    ['revenue', 'revenue'],
    ['sales', 'revenue'],
    ['orders', 'orders'],
    ['order count', 'orders'],
    ['sessions', 'sessions'],
    ['traffic', 'sessions'],
    ['visits', 'sessions']
  ];
  const DIM_TERMS = [
    ['categories', 'category'],
    ['category', 'category'],
    ['channels', 'channel'],
    ['channel', 'channel'],
    ['devices', 'device'],
    ['device type', 'device'],
    ['device', 'device'],
    ['states', 'state'],
    ['state', 'state'],
    ['regions', 'region'],
    ['region', 'region'],
    ['monthly', 'month'],
    ['month', 'month'],
    ['over time', 'month'],
    ['trend', 'month'],
    ['quarter', 'quarter'],
    ['year', 'year']
  ];
  const SUGGESTIONS = [
    'revenue by category',
    'top 5 states by orders',
    'return rate by month',
    'conversion rate by device',
    'aov by channel for electronics',
    'gross margin by region'
  ];

  function valueTerms() {
    const out = [];
    D.CATEGORIES.forEach(v => out.push([v.toLowerCase(), 'category', v]));
    D.CHANNELS.forEach(v => out.push([v.toLowerCase(), 'channel', v]));
    D.DEVICES.forEach(v => out.push([v.toLowerCase(), 'device', v]));
    ['Midwest', 'Northeast', 'South', 'West'].forEach(v => out.push([v.toLowerCase(), 'region', v]));
    D.STATES.forEach(s => out.push([s.name.toLowerCase(), 'state', s.name]));
    return out.sort((a, b) => b[0].length - a[0].length);
  }

  function parse(question) {
    let q =
      ' ' +
      question
        .toLowerCase()
        .replace(/[?.,!]/g, ' ')
        .replace(/\s+/g, ' ') +
      ' ';
    const spans = [];
    const take = (term, kind) => {
      const idx = q.indexOf(' ' + term + ' ');
      if (idx < 0) return false;
      spans.push({ text: term, kind });
      q = q.slice(0, idx + 1) + ' '.repeat(term.length) + q.slice(idx + 1 + term.length);
      return true;
    };
    let measure = null,
      dim = null,
      top = null;
    const filters = [];
    const topMatch = q.match(/ (top|bottom) (\d+) /);
    if (topMatch) {
      top = { dir: topMatch[1], n: Math.min(50, +topMatch[2]) };
      take(topMatch[1] + ' ' + topMatch[2], 'top');
    }
    for (const [t, k] of MEASURE_TERMS) if (!measure && take(t, 'measure')) measure = k;
    valueTerms().forEach(([t, field, v]) => {
      if (take(t, 'value')) filters.push({ field, value: v });
    });
    for (const [t, k] of DIM_TERMS) if (!dim && take(t, 'dim')) dim = k;
    const stop = new Set([
      'by',
      'for',
      'of',
      'the',
      'in',
      'show',
      'me',
      'what',
      'is',
      'are',
      'and',
      'per',
      'each',
      'a',
      'with',
      'from',
      'to',
      'how',
      'many',
      'much',
      'which',
      'were',
      'was',
      'only',
      'last',
      'months',
      'list'
    ]);
    const unknown = q
      .trim()
      .split(' ')
      .filter(w => w && !stop.has(w));
    return { measure: measure || 'revenue', measureFound: !!measure, dim, top, filters, unknown, spans };
  }

  function dimSpec(dim) {
    if (dim === 'month') return { label: 'Month', key: r => r.m, name: m => D.MONTHS[m].short, time: true };
    if (dim === 'quarter')
      return {
        label: 'Quarter',
        key: r => D.MONTHS[r.m].year * 10 + D.MONTHS[r.m].quarter,
        name: k => Math.floor(k / 10) + ' Qtr ' + (k % 10),
        time: true
      };
    if (dim === 'year') return { label: 'Year', key: r => D.MONTHS[r.m].year, name: k => String(k), time: true };
    const f = M.FIELDS[dim];
    return { label: f.label, key: f.get, name: k => k, time: false };
  }

  function restatement(p) {
    const meas = M.MEASURES[p.measure].label;
    let txt = (p.top ? (p.top.dir === 'top' ? 'Top ' : 'Bottom ') + p.top.n + ' ' : '') + '<b>' + meas + '</b>';
    if (p.dim) txt += ' by <b>' + dimSpec(p.dim).label + '</b>';
    if (p.filters.length)
      txt += ' for ' + p.filters.map(f => '<b>' + M.FIELDS[f.field].label + ' ' + f.value + '</b>').join(' and ');
    return txt;
  }

  function highlightQuestion(question, p) {
    let html = F.escapeHtml(question);
    p.spans
      .slice()
      .sort((a, b) => b.text.length - a.text.length)
      .forEach(sp => {
        const re = new RegExp(
          '(^|[^A-Za-z>])(' + sp.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z<])',
          'i'
        );
        html = html.replace(re, '$1<span class="qa-term">$2</span>');
      });
    p.unknown.forEach(w => {
      const re = new RegExp('(^|[\\s])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?=[\\s?.,!]|$)', 'i');
      html = html.replace(re, '$1<span class="qa-unknown" title="Q&amp;A did not recognize this word">$2</span>');
    });
    return html;
  }

  function qnaVisual(vid) {
    const def = {
      id: vid,
      type: 'qna',
      title: 'Q&A',
      hideTitle: true,
      last: null,
      fields: [],
      data() {
        return def.last || { columns: [], rows: [] };
      },
      render(body) {
        const question = S().qna;
        const p = parse(question);
        body.innerHTML =
          '<div class="qa-grid"><div class="qa-left">' +
          '<div class="qa-box"><svg viewBox="0 0 16 16" width="14" height="14"><circle cx="7" cy="7" r="4.6" fill="none" stroke="#605E5C" stroke-width="1.3"/><path d="M10.4 10.4L14 14" stroke="#605E5C" stroke-width="1.3"/></svg>' +
          '<input class="qa-input" type="text" value="' +
          F.escapeHtml(question) +
          '" placeholder="Ask a question about your data" aria-label="Ask a question about your data"></div>' +
          '<div class="qa-echo">' +
          (question ? highlightQuestion(question, p) : '') +
          '</div>' +
          '<div class="qa-try">Try one of these to get started</div><div class="qa-chips">' +
          SUGGESTIONS.map(s => '<button class="qa-chip">' + s + '</button>').join('') +
          '</div></div>' +
          '<div class="qa-right"><div class="qa-restate">Showing results for ' +
          restatement(p) +
          (p.unknown.length
            ? '<span class="qa-warn">Not recognized: ' + p.unknown.map(F.escapeHtml).join(', ') + '</span>'
            : '') +
          '</div><div class="qa-chart"></div></div></div>';
        const input = body.querySelector('.qa-input');
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') M.setState({ qna: input.value.trim() });
        });
        body
          .querySelectorAll('.qa-chip')
          .forEach(ch => ch.addEventListener('click', () => M.setState({ qna: ch.textContent })));
        drawAnswer(vid, def, body.querySelector('.qa-chart'), p);
      }
    };
    return def;
  }

  function drawAnswer(vid, def, el, p) {
    const meas = M.MEASURES[p.measure];
    const extra = p.filters.map(f => {
      const g = M.FIELDS[f.field].get;
      return r => g(r) === f.value;
    });
    const list = M.rows({ vid, extra });
    const c = F.chart(vid, el);
    if (!p.dim) {
      const v = meas.f(M.totals(list));
      def.last = { columns: [meas.label], rows: [[v]] };
      c.setOption(
        {
          graphic: [
            {
              type: 'text',
              left: 'center',
              top: '30%',
              style: { text: M.fmtMeasure(p.measure, v), fill: '#252423', font: '600 40px ' + F.FONT }
            },
            {
              type: 'text',
              left: 'center',
              top: '58%',
              style: { text: meas.label, fill: F.GREY, font: '14px ' + F.FONT }
            }
          ]
        },
        true
      );
      return;
    }
    const spec = dimSpec(p.dim);
    const g = M.groupBy(list, spec.key);
    let keys = Array.from(g.keys());
    if (spec.time) keys.sort((a, b) => a - b);
    else keys.sort((a, b) => meas.f(g.get(b)) - meas.f(g.get(a)));
    if (p.top) {
      if (p.top.dir === 'bottom') keys.reverse();
      keys = keys.slice(0, p.top.n);
    }
    const names = keys.map(spec.name),
      vals = keys.map(k => meas.f(g.get(k)));
    def.last = { columns: [spec.label, meas.label], numeric: [false, true], rows: names.map((n, i) => [n, vals[i]]) };
    const lbl = {
      show: !spec.time || names.length <= 12,
      position: 'top',
      color: F.GREY,
      fontSize: 10,
      formatter: q => M.fmtMeasure(p.measure, q.value)
    };
    const horizontal = !spec.time && names.length > 6;
    const series = spec.time
      ? [
          {
            type: 'line',
            data: vals,
            symbol: 'circle',
            symbolSize: 5,
            lineStyle: { width: 2, color: F.THEME[0] },
            itemStyle: { color: F.THEME[0] },
            label: lbl
          }
        ]
      : [
          {
            type: 'bar',
            data: horizontal ? vals.slice().reverse() : vals,
            barMaxWidth: 38,
            itemStyle: { color: F.THEME[0] },
            label: Object.assign({}, lbl, { position: horizontal ? 'right' : 'top' })
          }
        ];
    const cat = F.catAxis(horizontal ? names.slice().reverse() : names, {
      name: horizontal ? '' : spec.label,
      nameLocation: 'middle',
      nameGap: 22,
      axisLabel: Object.assign({}, F.axisLabel, {
        interval: horizontal ? 0 : 'auto',
        formatter: v => String(v).replace(' 20', " '")
      })
    });
    const val = F.valueAxis({
      name: meas.label,
      nameLocation: 'middle',
      nameGap: horizontal ? 22 : 44,
      axisLabel: Object.assign({}, F.axisLabel, { formatter: v => F.compact(M.fmtMeasure(p.measure, v)) })
    });
    c.setOption(
      {
        animationDuration: 300,
        textStyle: { fontFamily: F.FONT },
        grid: horizontal ? { left: 104, right: 60, top: 6, bottom: 30 } : { left: 60, right: 16, top: 18, bottom: 36 },
        tooltip: Object.assign({}, F.tooltipBase, {
          trigger: 'item',
          formatter: q =>
            F.tipHtml('', [
              [spec.label, q.name],
              [meas.label, M.fmtMeasure(p.measure, q.value)]
            ])
        }),
        xAxis: horizontal ? val : cat,
        yAxis: horizontal ? cat : val,
        series
      },
      true
    );
  }

  window.QNA = { qnaVisual, parse };
})();
