/* Report pages: visual placement on a 1280 x 720 canvas with an 8 px gutter. */
(function () {
  'use strict';
  const V = window.VISUALS, R = window.RETENTION, W = window.WHATIF, T = window.TILEMAP, Q = window.QNA;
  const S = () => window.MODEL.getState();

  function header(pageKey, title, subtitle) {
    return [
      [V.titleBox(title, subtitle), 8, 8, 300, 56],
      [V.dateSlicer('date-' + pageKey), 316, 8, 300, 56],
      [V.categorySlicer('cat-' + pageKey), 624, 8, 448, 56],
      [V.deviceSlicer('dev-' + pageKey), 1080, 8, 192, 56]
    ];
  }

  const KPI_KEYS = ['revenue', 'orders', 'aov', 'conversion', 'margin', 'returnRate'];

  function page1() {
    const cards = KPI_KEYS.map((k, i) => [V.kpiCard('kpi-' + k, k), 8 + i * 212, 72, 204, 100]);
    const catChart = V.dimBar('cat-chart', { field: 'category', measure: 'revenue', title: 'Revenue by category', color: '#37A794' });
    catChart.hiddenWhen = () => S().tableMode;
    const catTable = V.categoryTable('cat-table');
    catTable.hiddenWhen = () => !S().tableMode;
    return header('p1', 'E-Commerce Performance', 'Direct-to-consumer, United States').concat(cards, [
      [V.comboChart('combo'), 8, 180, 756, 300],
      [T.stateMap('map'), 772, 180, 500, 300],
      [V.dimBar('channel', { field: 'channel', measure: 'revenue', title: 'Revenue by channel', orient: 'h' }), 8, 488, 416, 208],
      [catChart, 432, 488, 416, 208],
      [catTable, 432, 488, 416, 208],
      [V.swapButtons('swap'), 596, 491, 176, 22],
      [V.deviceDonut('donut'), 856, 488, 416, 208]
    ]);
  }

  function page2() {
    const keys = ['newCustomers', 'repeatRate', 'churnRate', 'deliveryDays'];
    const cards = keys.map((k, i) => [R.custCard('cc-' + k, k), 8 + i * 318, 72, 310, 92]);
    return header('p2', 'Customer and Retention', 'Acquisition cohorts and churn drivers').concat(cards, [
      [R.cohortMatrix('cohort'), 8, 172, 628, 300],
      [R.newVsReturning('nvr'), 8, 480, 628, 216],
      [R.keyInfluencers('ki'), 644, 172, 628, 524]
    ]);
  }

  function page3() {
    return header('p3', 'Funnel and What-if', 'Conversion stages and discount scenario').concat([
      [W.funnel('funnel'), 8, 72, 420, 360],
      [W.whatIfSlicer('whatif'), 436, 72, 410, 80],
      [W.projectedCard('proj-rev', 'rev'), 436, 160, 201, 84],
      [W.projectedCard('proj-margin', 'margin'), 645, 160, 201, 84],
      [W.scenarioLine('scenario'), 436, 252, 410, 180],
      [W.conversionByDevice('conv-dev'), 854, 72, 418, 180],
      [V.dimBar('abandon', { field: 'device', measure: 'cartAbandon', title: 'Cart abandonment rate by device type', orient: 'h', color: '#8B3D88' }), 854, 260, 418, 172],
      [Q.qnaVisual('qna'), 8, 440, 1264, 256]
    ]);
  }

  const PAGES = [
    { id: 'p1', name: 'Executive Summary', build: page1 },
    { id: 'p2', name: 'Customer and Retention', build: page2 },
    { id: 'p3', name: 'Funnel and What-if', build: page3 },
    { id: 'tt', name: 'Tooltip: State detail', hidden: true, tooltip: true, build: () => [] }
  ];

  function withFilter(filters, scope, field, values) {
    const scoped = Object.assign({}, filters[scope], { [field]: Object.assign({}, filters[scope][field], { mode: 'basic', values }) });
    return Object.assign({}, filters, { [scope]: scoped });
  }

  window.PAGES = { PAGES, withFilter };
})();
