/* Report pages and visual layout on a 1280 x 720 canvas with 8 px gutters. */
(function () {
  'use strict';
  const M = window.PBI_MODEL;
  const PBI = window.PBI;
  const C = M.THEME.colors;

  const kpi = (id, x, y, w, h, label, measure, extra) =>
    Object.assign(
      { id, kind: 'kpi', title: null, x, y, w, h, label, measure, dax: [measure], spark: true, exportName: label },
      extra || {}
    );
  const gauge = (id, x, plant) => ({
    id,
    kind: 'gauge',
    title: 'OEE - ' + plant,
    plant,
    x,
    y: 60,
    w: 184,
    h: 160,
    dax: ['OEE', 'Availability', 'Performance', 'Quality'],
    fields: ['Plant', 'OEE']
  });

  const rowsCompute = () => {
    const counts = PBI.visibleCounts();
    return counts.reduce((s, c) => s + c.visible, 0);
  };

  PBI.pages = [
    {
      id: 'plant',
      name: 'Plant Performance',
      band: {
        title: 'Plant Performance',
        sub: 'OEE, scrap, downtime and throughput by plant, line, machine and shift. FY26, October 2025 to September 2026.',
        slicers: ['Plant', 'Quarter', 'Shift']
      },
      visuals: [
        gauge('p1-g-mi', 8, 'Michigan'),
        gauge('p1-g-oh', 200, 'Ohio'),
        gauge('p1-g-mx', 392, 'Monterrey'),
        gauge('p1-g-pl', 584, 'Wroclaw'),
        kpi('p1-k-a', 776, 60, 244, 76, 'Availability', 'Availability', {
          target: 0.9,
          higherBetter: true,
          accent: C[0]
        }),
        kpi('p1-k-p', 1028, 60, 244, 76, 'Performance', 'Performance', {
          target: 0.9,
          higherBetter: true,
          accent: C[1]
        }),
        kpi('p1-k-q', 776, 144, 244, 76, 'Quality', 'Quality', { target: 0.99, higherBetter: true, accent: C[2] }),
        kpi('p1-k-o', 1028, 144, 244, 76, 'OEE = Availability x Performance x Quality', 'OEE', {
          target: 0.85,
          higherBetter: true,
          accent: '#14213D',
          dax: ['OEE', 'Availability', 'Performance', 'Quality']
        }),
        {
          id: 'p1-param',
          kind: 'paramSlicer',
          title: null,
          x: 8,
          y: 228,
          w: 840,
          h: 40,
          dax: ['Plant KPI'],
          fields: ['Plant KPI'],
          exportName: 'Plant KPI'
        },
        {
          id: 'p1-line',
          kind: 'paramLine',
          title: 'OEE by Month and Plant',
          x: 8,
          y: 276,
          w: 416,
          h: 420,
          fields: ['Month', 'Plant'],
          exportName: 'Plant KPI by Month and Plant'
        },
        {
          id: 'p1-drill',
          kind: 'drillBar',
          title: 'OEE by Plant and Shift',
          x: 432,
          y: 276,
          w: 416,
          h: 420,
          hierarchy: ['Plant', 'Line', 'Machine'],
          sortFields: ['value', 'label'],
          sortLabels: { value: 'Plant KPI', label: 'Plant, Line, Machine' },
          fields: ['Plant', 'Line', 'Machine', 'Shift'],
          exportName: 'Plant KPI by hierarchy and Shift'
        },
        {
          id: 'p1-pareto',
          kind: 'pareto',
          title: 'Downtime hours by Downtime reason, Pareto',
          x: 856,
          y: 228,
          w: 416,
          h: 468,
          dax: ['Downtime hours', 'Cumulative %'],
          sortFields: ['value', 'label'],
          sortLabels: { value: 'Downtime hours', label: 'Downtime reason' },
          fields: ['Downtime hours'],
          exportName: 'Downtime Pareto'
        }
      ]
    },
    {
      id: 'cost',
      name: 'Cost and Variance',
      band: {
        title: 'Cost and Variance',
        sub: 'Budgeted against actual conversion cost, supplier spend rank and monthly variance by plant. Positive variance is overspend.',
        slicers: ['Plant', 'Quarter']
      },
      visuals: [
        kpi('p2-k-b', 8, 60, 248, 76, 'Budgeted cost', 'Budgeted cost', { accent: C[1] }),
        kpi('p2-k-a', 262, 60, 248, 76, 'Actual cost', 'Actual cost', { accent: C[0] }),
        kpi('p2-k-v', 516, 60, 248, 76, 'Cost variance', 'Cost variance', {
          target: 0,
          targetLabel: 'Target $0',
          higherBetter: false,
          accent: '#D64554'
        }),
        kpi('p2-k-p', 770, 60, 248, 76, 'Variance %', 'Variance %', {
          target: 0,
          targetLabel: 'Target 0.0%',
          higherBetter: false,
          accent: C[2]
        }),
        kpi('p2-k-f', 1024, 60, 248, 76, 'Freight premium', 'Premium freight $', {
          target: 0,
          targetLabel: 'Target $0',
          higherBetter: false,
          accent: C[6]
        }),
        {
          id: 'p2-wf',
          kind: 'waterfall',
          title: 'Budgeted cost to Actual cost by Category',
          x: 8,
          y: 144,
          w: 628,
          h: 276,
          dax: ['Budgeted cost', 'Actual cost', 'Cost variance'],
          fields: ['Category', 'Cost variance'],
          exportName: 'Cost waterfall'
        },
        {
          id: 'p2-ribbon',
          kind: 'ribbon',
          title: 'Spend by Supplier and Quarter, ranked',
          x: 644,
          y: 144,
          w: 628,
          h: 276,
          dax: ['Spend'],
          fields: ['Quarter', 'Supplier', 'Spend'],
          exportName: 'Supplier spend ribbon'
        },
        {
          id: 'p2-matrix',
          kind: 'matrix',
          title: 'Cost variance by Plant and Month',
          x: 8,
          y: 428,
          w: 928,
          h: 268,
          hierarchy: ['Plant', 'Category'],
          dax: ['Cost variance'],
          fields: ['Plant', 'Category', 'Month'],
          exportName: 'Cost variance matrix'
        },
        {
          id: 'p2-cat',
          kind: 'categoryBar',
          title: 'Variance % by Category',
          x: 944,
          y: 428,
          w: 328,
          h: 268,
          dax: ['Variance %'],
          sortFields: ['value', 'label'],
          sortLabels: { value: 'Variance %', label: 'Category' },
          fields: ['Category', 'Variance %'],
          exportName: 'Variance by category'
        }
      ]
    },
    {
      id: 'supplier',
      name: 'Supplier Quality',
      band: {
        title: 'Supplier Quality',
        sub: 'Incoming quality, delivery and PPAP status by supplier. Targets are 0 PPM, $0 premium freight and no open 8D reports.',
        slicers: ['Tier', 'Commodity', 'Plant']
      },
      visuals: [
        kpi('p3-k-c', 8, 60, 310, 88, 'Customer PPM', 'Customer PPM', {
          target: 0,
          targetLabel: 'Target 0 PPM',
          higherBetter: false,
          accent: '#14213D'
        }),
        kpi('p3-k-s', 326, 60, 310, 88, 'Supplier PPM', 'Supplier PPM', {
          target: 0,
          targetLabel: 'Target 0 PPM',
          higherBetter: false,
          accent: C[1]
        }),
        kpi('p3-k-f', 644, 60, 310, 88, 'Premium freight $', 'Premium freight $', {
          target: 0,
          targetLabel: 'Target $0',
          higherBetter: false,
          accent: C[6]
        }),
        kpi('p3-k-8', 962, 60, 310, 88, 'Open 8Ds', 'Open 8Ds', {
          target: 0,
          targetLabel: 'Target 0 open',
          higherBetter: false,
          accent: C[2]
        }),
        {
          id: 'p3-scatter',
          kind: 'playScatter',
          title: 'Supplier PPM and On-time delivery % by Supplier, Play axis Month',
          x: 8,
          y: 156,
          w: 752,
          h: 540,
          dax: ['On-time delivery %', 'Supplier PPM', 'Spend'],
          fields: ['Supplier', 'Supplier tier', 'Month'],
          exportName: 'Supplier scatter'
        },
        {
          id: 'p3-score',
          kind: 'scorecard',
          title: 'PPAP status and supplier scorecard',
          x: 768,
          y: 156,
          w: 504,
          h: 540,
          dax: ['Supplier score', 'On-time delivery %', 'Supplier PPM', 'Spend', 'Open 8Ds'],
          sortFields: ['Spend', 'PPM', 'OTD %', 'Score', 'Supplier'],
          fields: ['Supplier', 'Tier', 'PPAP'],
          exportName: 'Supplier scorecard'
        }
      ]
    },
    {
      id: 'rls',
      name: 'Plant Access (RLS)',
      band: {
        title: 'Plant Access',
        sub: 'Row-level security roles and the rows each role can read. Use View as in the action bar to test a role on every page.',
        slicers: ['Plant']
      },
      visuals: [
        kpi('p4-k-r', 8, 60, 310, 76, 'Effective role', null, {
          spark: false,
          small: true,
          dax: ['Effective role'],
          compute: api => ({
            value: api.S.viewAs ? api.S.role : 'Owner (no role applied)',
            fmt: 'text',
            sub: '<span>Evaluated in the browser filter context</span>'
          })
        }),
        kpi('p4-k-p', 326, 60, 310, 76, 'Plants visible', null, {
          spark: false,
          dax: ['Plants visible'],
          compute: () => ({
            value: M.fieldValues('Plant', window.PBI_STATE.rolePlant()).length,
            fmt: 'int',
            sub: '<span>of 4 plants in the model</span>'
          })
        }),
        kpi('p4-k-n', 644, 60, 310, 76, 'Fact rows visible', null, {
          spark: false,
          dax: ['Visible rows'],
          compute: api => ({ value: rowsCompute(api), fmt: 'int', sub: '<span>Seven fact tables</span>' })
        }),
        kpi('p4-k-s', 962, 60, 310, 76, 'Share of model rows', null, {
          spark: false,
          dax: ['Visible rows'],
          compute: () => {
            const c = PBI.visibleCounts();
            return {
              value: c.reduce((s, x) => s + x.visible, 0) / c.reduce((s, x) => s + x.total, 0),
              fmt: 'pct',
              sub: '<span>Visible rows divided by rows in model</span>'
            };
          }
        }),
        {
          id: 'p4-roles',
          kind: 'roleTable',
          title: 'Security roles defined in the model',
          x: 8,
          y: 144,
          w: 628,
          h: 276,
          fields: ['Role'],
          exportName: 'Security roles'
        },
        {
          id: 'p4-rows',
          kind: 'rowsByTable',
          title: 'Rows visible by table',
          x: 644,
          y: 144,
          w: 628,
          h: 276,
          dax: ['Visible rows'],
          fields: ['Table'],
          exportName: 'Rows by table'
        },
        {
          id: 'p4-score',
          kind: 'plantScorecard',
          title: 'Plant scorecard',
          x: 8,
          y: 428,
          w: 628,
          h: 268,
          dax: ['OEE', 'Scrap %', 'Downtime hours', 'Cost variance', 'Customer PPM', 'Open 8Ds'],
          fields: ['Plant'],
          exportName: 'Plant scorecard'
        },
        {
          id: 'p4-oee',
          kind: 'oeeColumns',
          title: 'OEE by Quarter and Plant',
          x: 644,
          y: 428,
          w: 628,
          h: 268,
          dax: ['OEE'],
          fields: ['Quarter', 'Plant', 'OEE'],
          exportName: 'OEE by quarter'
        }
      ]
    },
    {
      id: 'machine',
      name: 'Machine Detail',
      hidden: true,
      drillthrough: 'Machine',
      band: { title: 'Machine Detail', sub: '', back: true, slicers: [] },
      visuals: [
        kpi('m-k-mtbf', 8, 60, 204, 76, 'MTBF (h)', null, {
          spark: false,
          dax: ['MTBF (h)'],
          compute: api => ({
            value: M.MS.mtbf(api.q('Production'), api.q('Downtime')),
            fmt: 'hrs',
            sub: '<span>Run hours per failure</span>'
          })
        }),
        kpi('m-k-mttr', 220, 60, 204, 76, 'MTTR (h)', null, {
          spark: false,
          dax: ['MTTR (h)'],
          compute: api => ({
            value: M.MS.mttr(api.q('Downtime')),
            fmt: 'hrs',
            sub: '<span>Mean failure duration</span>'
          })
        }),
        kpi('m-k-dt', 432, 60, 204, 76, 'Downtime hours', 'Downtime hours', {
          spark: false,
          accent: C[1],
          compute: api => ({
            value: M.MS.downtimeHours(api.q('Downtime')),
            fmt: 'hrs',
            sub: '<span>All downtime reasons</span>'
          })
        }),
        kpi('m-k-f', 644, 60, 204, 76, 'Failure events', null, {
          spark: false,
          accent: '#D64554',
          dax: ['Failure events'],
          compute: api => ({
            value: M.MS.failures(api.q('Downtime')),
            fmt: 'int',
            sub: '<span>Hydraulic, spindle, tool, sensor, coolant</span>'
          })
        }),
        kpi('m-k-oee', 856, 60, 204, 76, 'OEE', 'OEE', {
          spark: false,
          target: 0.85,
          higherBetter: true,
          accent: '#14213D'
        }),
        kpi('m-k-wo', 1068, 60, 204, 76, 'Maintenance orders', null, {
          spark: false,
          accent: C[2],
          dax: ['Maintenance orders'],
          compute: api => {
            const r = api.q('Maintenance');
            return {
              value: r.length,
              fmt: 'int',
              sub: '<span>' + r.filter(x => x.status !== 'Completed').length + ' not completed</span>'
            };
          }
        }),
        {
          id: 'm-timeline',
          kind: 'dtTimeline',
          title: 'Downtime events timeline',
          x: 8,
          y: 144,
          w: 840,
          h: 276,
          fields: ['Date', 'Reason'],
          exportName: 'Downtime events'
        },
        {
          id: 'm-reason',
          kind: 'bar',
          title: 'Downtime hours by Downtime reason',
          x: 856,
          y: 144,
          w: 416,
          h: 276,
          field: 'Reason',
          measure: 'Downtime hours',
          horizontal: true,
          color: C[1],
          dax: ['Downtime hours'],
          defaultSort: { by: 'value', dir: 'desc' },
          sortFields: ['value', 'label'],
          sortLabels: { value: 'Downtime hours', label: 'Downtime reason' },
          fields: ['Reason'],
          exportName: 'Downtime by reason'
        },
        {
          id: 'm-maint',
          kind: 'maintTable',
          title: 'Recent maintenance orders',
          x: 8,
          y: 428,
          w: 840,
          h: 268,
          fields: ['Work order'],
          exportName: 'Maintenance orders'
        },
        {
          id: 'm-month',
          kind: 'bar',
          title: 'Downtime hours by Month',
          x: 856,
          y: 428,
          w: 416,
          h: 268,
          field: 'Month',
          measure: 'Downtime hours',
          color: C[0],
          dax: ['Downtime hours'],
          keys: () => M.FIELDS.Month.values(),
          labelShort: true,
          fields: ['Month'],
          exportName: 'Downtime by month'
        }
      ]
    }
  ];
})();
