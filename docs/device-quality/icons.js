/* icons.js: inline SVG icon set (16 px grid, stroke based). */
(function () {
  'use strict';
  const P = {
    waffle:
      '<g fill="currentColor" stroke="none"><rect x="2" y="2" width="3" height="3"/><rect x="6.5" y="2" width="3" height="3"/><rect x="11" y="2" width="3" height="3"/><rect x="2" y="6.5" width="3" height="3"/><rect x="6.5" y="6.5" width="3" height="3"/><rect x="11" y="6.5" width="3" height="3"/><rect x="2" y="11" width="3" height="3"/><rect x="6.5" y="11" width="3" height="3"/><rect x="11" y="11" width="3" height="3"/></g>',
    search: '<circle cx="6.5" cy="6.5" r="4.5"/><path d="M10 10l4.5 4.5"/>',
    bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11z"/><path d="M6.5 14a1.5 1.5 0 0 0 3 0"/>',
    gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    download: '<path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11"/>',
    help: '<circle cx="8" cy="8" r="6.5"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.7-.8 1.3v.4"/><circle cx="8" cy="11.6" r=".4" fill="currentColor"/>',
    feedback: '<path d="M2.5 3h11v8h-6l-3 2.5V11h-2z"/>',
    home: '<path d="M2 7.5L8 2.5l6 5M3.5 6.5V14h3.5v-4h2v4h3.5V6.5"/>',
    create: '<circle cx="8" cy="8" r="6.5"/><path d="M8 5v6M5 8h6"/>',
    browse: '<path d="M1.5 4h4.5l1.5 1.5h7v8h-13z"/>',
    onelake:
      '<ellipse cx="8" cy="4" rx="5.5" ry="2"/><path d="M2.5 4v8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2"/>',
    apps: '<rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>',
    workspaces: '<rect x="2" y="5" width="12" height="9"/><path d="M4 5V3h8v2"/>',
    report: '<rect x="2.5" y="2" width="11" height="12"/><path d="M5 11V8M8 11V5M11 11V9"/>',
    file: '<path d="M3.5 1.5h6l3 3v10h-9z"/><path d="M9.5 1.5v3h3"/>',
    exportI: '<path d="M8 10V2M4.5 5.5L8 2l3.5 3.5M2.5 9v4.5h11V9"/>',
    share: '<path d="M10 2.5l3.5 3.5L10 9.5M13.5 6H8a5 5 0 0 0-5 5v2"/>',
    teams:
      '<rect x="1.5" y="3.5" width="8" height="9" rx="1"/><path d="M3.5 6h4M5.5 6v4.5M11 5.5h3v5a1.5 1.5 0 0 1-3 0"/><circle cx="12.5" cy="3.5" r="1.2"/>',
    insights: '<path d="M5.5 11.5h5M6 14h4M8 1.5a4.5 4.5 0 0 0-2.5 8.2V11h5V9.7A4.5 4.5 0 0 0 8 1.5z"/>',
    subscribe: '<rect x="1.5" y="3.5" width="13" height="9"/><path d="M1.5 3.5L8 9l6.5-5.5"/>',
    edit: '<path d="M10.5 2.5l3 3L5 14H2v-3z"/>',
    reset: '<path d="M3 8a5 5 0 1 0 1.5-3.5"/><path d="M2.5 2v3.5H6"/>',
    bookmark: '<path d="M4 1.5h8v13l-4-3-4 3z"/>',
    view: '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.5"/><path d="M13.5 2v3.5H10"/>',
    star: '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
    comment: '<path d="M2 2.5h12v8.5H8l-3.5 3v-3H2z"/>',
    more: '<g fill="currentColor" stroke="none"><circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/></g>',
    chevDown: '<path d="M4 6l4 4 4-4"/>',
    chevUp: '<path d="M4 10l4-4 4 4"/>',
    chevRight: '<path d="M6 4l4 4-4 4"/>',
    chevLeft: '<path d="M10 4L6 8l4 4"/>',
    dblLeft: '<path d="M8 4L4 8l4 4M12.5 4l-4 4 4 4"/>',
    dblRight: '<path d="M8 4l4 4-4 4M3.5 4l4 4-4 4"/>',
    drillUp: '<path d="M8 13.5V3M3.5 7.5L8 3l4.5 4.5"/>',
    drillMode: '<circle cx="8" cy="8" r="6.5"/><path d="M8 4.5v7M5 8.5l3 3 3-3"/>',
    nextLevel: '<path d="M4 3l4 4 4-4M4 8.5l4 4 4-4"/>',
    expandAll: '<path d="M8 2v5M8 7l-4.5 4v3M8 7l4.5 4v3M8 7v7"/>',
    filter: '<path d="M1.5 2.5h13l-5 6v5l-3 1.5V8.5z"/>',
    focus: '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>',
    back: '<path d="M14 8H2.5M7 3.5L2.5 8 7 12.5"/>',
    eraser: '<path d="M9.5 2.5l4 4-6.5 6.5H4l-2-2 7.5-8.5zM6 13.5h8"/>',
    close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
    lock: '<rect x="3" y="7" width="10" height="7.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/>',
    info: '<circle cx="8" cy="8" r="6.5"/><path d="M8 7v4.5"/><circle cx="8" cy="4.8" r=".5" fill="currentColor"/>',
    check: '<path d="M3 8.5l3 3 7-7"/>',
    plus: '<path d="M8 3v10M3 8h10"/>',
    minus: '<path d="M3 8h10"/>',
    bulb: '<path d="M6 12.5h4M6.5 14.5h3M8 1.5a4.5 4.5 0 0 0-2.5 8.2V11h5V9.7A4.5 4.5 0 0 0 8 1.5z"/>',
    table: '<rect x="1.5" y="2.5" width="13" height="11"/><path d="M1.5 6h13M1.5 9.5h13M6 2.5v11"/>',
    dax: '<path d="M5 4L1.5 8 5 12M11 4l3.5 4L11 12M9.5 3l-3 10"/>',
    pages: '<path d="M4 1.5h6l3 3v10H4z"/><path d="M2 4v11h8"/>',
    fit: '<rect x="2" y="3" width="12" height="10"/><path d="M5 6.5V5h1.5M11 6.5V5H9.5M5 9.5V11h1.5M11 9.5V11H9.5"/>'
  };
  function icon(name, size, extraClass) {
    const s = size || 16;
    return (
      '<svg class="ic ' +
      (extraClass || '') +
      '" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (P[name] || '') +
      '</svg>'
    );
  }
  window.PBI = window.PBI || {};
  window.PBI.icon = icon;
})();
