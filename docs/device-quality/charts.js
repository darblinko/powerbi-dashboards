/* charts.js: Power BI default theme settings and ECharts option builders. */
(function () {
  'use strict';
  const THEME = ['#118DFF', '#12239E', '#E66C37', '#6B007B', '#E044A7', '#744EC2', '#D9B300', '#D64550'];
  const FONT = '"Segoe UI", "Segoe UI Web", wf_segoe-ui_normal, Tahoma, Arial, sans-serif';
  const GREY = '#605E5C';
  const FADE = 0.4;
  const STATUS = { good: '#1AAB40', warn: '#D9B300', bad: '#D64550' };

  function esc(s) {
    return String(s == null ? '' : s).replace(
      /[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]
    );
  }
  function tipHtml(rows) {
    return rows
      .map(
        r =>
          '<div class="tt-row"><span class="tt-k">' +
          esc(r[0]) +
          '</span><span class="tt-v">' +
          esc(r[1]) +
          '</span></div>'
      )
      .join('');
  }
  function tooltip(extra) {
    return Object.assign(
      {
        backgroundColor: '#3B3A39',
        borderWidth: 0,
        padding: [6, 10],
        textStyle: { color: '#FFFFFF', fontFamily: FONT, fontSize: 12 },
        extraCssText: 'border-radius:2px;box-shadow:0 2px 8px rgba(0,0,0,.28);',
        confine: true,
        transitionDuration: 0.1
      },
      extra || {}
    );
  }
  function base(extra) {
    return Object.assign(
      {
        animationDuration: 350,
        animationDurationUpdate: 300,
        textStyle: { fontFamily: FONT, color: GREY },
        color: THEME
      },
      extra || {}
    );
  }
  function catAxis(data, opts) {
    const o = opts || {};
    return Object.assign(
      {
        type: 'category',
        data,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: GREY,
          fontSize: 11,
          fontFamily: FONT,
          interval: o.interval != null ? o.interval : 'auto',
          hideOverlap: true
        },
        name: o.title || '',
        nameLocation: 'middle',
        nameGap: o.nameGap || 26,
        nameTextStyle: { color: GREY, fontSize: 11, fontFamily: FONT },
        triggerEvent: !!o.triggerEvent
      },
      o.extra || {}
    );
  }
  function valAxis(opts) {
    const o = opts || {};
    return Object.assign(
      {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: GREY,
          fontSize: 11,
          fontFamily: FONT,
          formatter: o.formatter || (v => window.PBI.model.fmt.k(v))
        },
        splitLine: { show: o.grid !== false, lineStyle: { color: '#E1DFDD', type: 'dashed', width: 1 } },
        name: o.title || '',
        nameLocation: 'middle',
        nameGap: o.nameGap || 36,
        nameTextStyle: { color: GREY, fontSize: 11, fontFamily: FONT }
      },
      o.extra || {}
    );
  }
  function legend(extra) {
    return Object.assign(
      {
        left: 0,
        top: 0,
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        itemGap: 12,
        textStyle: { color: GREY, fontSize: 11, fontFamily: FONT }
      },
      extra || {}
    );
  }

  // Bars with Power BI cross-highlight: faded full values plus the highlighted portion overlaid.
  // selfSel: function(index) -> boolean when the selection originated in this visual.
  function highlightBars(o) {
    const color = o.color || THEME[0];
    const label = o.labels
      ? {
          show: true,
          position: o.horizontal ? 'right' : 'top',
          color: GREY,
          fontSize: 11,
          fontFamily: FONT,
          formatter: p => (o.labelFmt || window.PBI.model.fmt.k)(p.value)
        }
      : { show: false };
    const common = {
      type: 'bar',
      barMaxWidth: o.barMaxWidth || 48,
      barCategoryGap: o.gap || '28%',
      emphasis: { focus: 'none', itemStyle: { color } }
    };
    if (o.hl) {
      return [
        Object.assign({}, common, {
          name: o.name,
          data: o.base,
          itemStyle: { color, opacity: FADE },
          label: { show: false },
          barGap: '-100%',
          z: 1,
          stack: o.stack ? 'b' : undefined
        }),
        Object.assign({}, common, {
          name: o.name,
          data: o.hl,
          itemStyle: { color },
          label,
          barGap: '-100%',
          z: 2,
          stack: o.stack ? 'h' : undefined
        })
      ];
    }
    const data = o.base.map((v, i) => (o.selfSel && !o.selfSel(i) ? { value: v, itemStyle: { opacity: FADE } } : v));
    return [
      Object.assign({}, common, { name: o.name, data, itemStyle: { color }, label, stack: o.stack ? 'b' : undefined })
    ];
  }

  function sparkSvg(values, w, h, color) {
    const vals = values.map(v => (v == null ? 0 : v));
    if (!vals.length) return '';
    const min = Math.min(...vals),
      max = Math.max(...vals);
    const span = max - min || 1;
    const step = vals.length > 1 ? w / (vals.length - 1) : w;
    const pts = vals.map((v, i) => [i * step, h - 3 - ((v - min) / span) * (h - 6)]);
    const line = pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
    const area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    const last = pts[pts.length - 1];
    return (
      '<svg width="' +
      w +
      '" height="' +
      h +
      '" viewBox="0 0 ' +
      w +
      ' ' +
      h +
      '" preserveAspectRatio="none">' +
      '<polygon points="' +
      area +
      '" fill="' +
      color +
      '" opacity=".12"/>' +
      '<polyline points="' +
      line +
      '" fill="none" stroke="' +
      color +
      '" stroke-width="1.5"/>' +
      '<circle cx="' +
      last[0] +
      '" cy="' +
      last[1] +
      '" r="2.5" fill="' +
      color +
      '"/></svg>'
    );
  }

  function statusFor(value, target, better) {
    if (value == null) return 'warn';
    const good = better === 'low' ? value <= target : value >= target;
    if (good) return 'good';
    const rel = Math.abs(value - target) / (Math.abs(target) || 1);
    return rel <= 0.1 ? 'warn' : 'bad';
  }

  window.PBI.charts = {
    THEME,
    FONT,
    GREY,
    FADE,
    STATUS,
    esc,
    tipHtml,
    tooltip,
    base,
    catAxis,
    valAxis,
    legend,
    highlightBars,
    sparkSvg,
    statusFor
  };
})();
