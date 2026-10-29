/* Inline SVG icon set, 16 x 16 grid, stroke drawn in currentColor. */
(function () {
  'use strict';
  const P = {
    waffle:
      '<g fill="currentColor" stroke="none"><circle cx="3" cy="3" r="1.3"/><circle cx="8" cy="3" r="1.3"/><circle cx="13" cy="3" r="1.3"/><circle cx="3" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="13" cy="8" r="1.3"/><circle cx="3" cy="13" r="1.3"/><circle cx="8" cy="13" r="1.3"/><circle cx="13" cy="13" r="1.3"/></g>',
    search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.4 10.4L14 14"/>',
    bell: '<path d="M4 11V7a4 4 0 0 1 8 0v4l1.5 1.5h-11L4 11z"/><path d="M6.5 14a1.5 1.5 0 0 0 3 0"/>',
    settings:
      '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
    download: '<path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 13.5h11"/>',
    help: '<circle cx="8" cy="8" r="6.2"/><path d="M6.2 6.2a1.9 1.9 0 1 1 2.6 1.8c-.6.3-.8.7-.8 1.3v.4"/><circle cx="8" cy="11.6" r=".5" fill="currentColor"/>',
    feedback:
      '<circle cx="8" cy="8" r="6.2"/><circle cx="6" cy="6.8" r=".5" fill="currentColor"/><circle cx="10" cy="6.8" r=".5" fill="currentColor"/><path d="M5.5 9.8a3 3 0 0 0 5 0"/>',
    home: '<path d="M2.5 7.5L8 2.5l5.5 5V14h-4v-4h-3v4h-4z"/>',
    create: '<circle cx="8" cy="8" r="6.2"/><path d="M8 5v6M5 8h6"/>',
    browse: '<path d="M1.5 4.5h5l1.5 1.5h6.5v7.5h-13z"/>',
    onelake: '<path d="M8 1.8l5.5 3.1v6.2L8 14.2l-5.5-3.1V4.9z"/><path d="M2.5 4.9L8 8l5.5-3.1M8 8v6.2"/>',
    apps: '<rect x="2" y="2" width="5" height="5"/><rect x="9" y="2" width="5" height="5"/><rect x="2" y="9" width="5" height="5"/><rect x="9" y="9" width="5" height="5"/>',
    workspaces: '<rect x="2" y="3" width="9" height="7"/><path d="M5 13h9V6"/>',
    file: '<path d="M4 1.5h5.5l3 3V14.5H4z"/><path d="M9.5 1.5v3h3"/>',
    exportIcon: '<path d="M8 10V2M4.5 5.5L8 2l3.5 3.5M2.5 9v4.5h11V9"/>',
    share: '<path d="M10 2.5l3.5 3.5L10 9.5"/><path d="M13.5 6H8a5 5 0 0 0-5 5v2"/>',
    teams:
      '<rect x="1.5" y="4" width="8" height="8" rx="1"/><path d="M3.8 6.5h3.4M5.5 6.5v3.5"/><path d="M11 6.5h2.5a1 1 0 0 1 1 1V11a2 2 0 0 1-3.5 1.3"/><circle cx="12.3" cy="3.6" r="1.3"/>',
    insights:
      '<path d="M8 1.8a4.2 4.2 0 0 0-2.4 7.6V11h4.8V9.4A4.2 4.2 0 0 0 8 1.8z"/><path d="M6 13h4M6.7 14.6h2.6"/>',
    subscribe: '<rect x="1.5" y="3.5" width="13" height="9"/><path d="M1.5 4l6.5 5 6.5-5"/>',
    edit: '<path d="M10.8 2.5l2.7 2.7-8 8H2.8v-2.7z"/><path d="M9.3 4l2.7 2.7"/>',
    reset: '<path d="M3 8a5 5 0 1 0 1.5-3.6"/><path d="M3 2.5v3h3"/>',
    bookmark: '<path d="M4 1.8h8v12.4l-4-3-4 3z"/>',
    view: '<path d="M1.2 8s2.5-4.5 6.8-4.5S14.8 8 14.8 8s-2.5 4.5-6.8 4.5S1.2 8 1.2 8z"/><circle cx="8" cy="8" r="2"/>',
    refresh: '<path d="M13 8a5 5 0 1 1-1.5-3.6"/><path d="M13 2.5v3h-3"/>',
    viewas:
      '<circle cx="6.5" cy="5" r="2.6"/><path d="M1.8 14a4.7 4.7 0 0 1 8.2-3.1"/><path d="M12 8.5l2.5 1v2c0 1.5-1.1 2.5-2.5 3-1.4-.5-2.5-1.5-2.5-3v-2z"/>',
    chevronDown: '<path d="M4 6l4 4 4-4"/>',
    chevronUp: '<path d="M4 10l4-4 4 4"/>',
    chevronRight: '<path d="M6 4l4 4-4 4"/>',
    chevronLeft: '<path d="M10 4L6 8l4 4"/>',
    chevronDoubleRight: '<path d="M3.5 4l4 4-4 4M8.5 4l4 4-4 4"/>',
    chevronDoubleLeft: '<path d="M12.5 4l-4 4 4 4M7.5 4l-4 4 4 4"/>',
    drillUp: '<path d="M8 13.5V3M4 7l4-4 4 4"/>',
    drillDown: '<circle cx="8" cy="8" r="6.2"/><path d="M8 4.5v7M5 8.5l3 3 3-3"/>',
    nextLevel: '<path d="M4.5 2.5L8 6l3.5-3.5M4.5 8L8 11.5 11.5 8"/><path d="M3 14h10"/>',
    expandAll: '<path d="M8 2v5M8 7l-4 4M8 7l4 4M4 11v3M12 11v3"/>',
    filter: '<path d="M1.8 2.5h12.4L9.5 8.2v4.8l-3 1.5V8.2z"/>',
    focus: '<path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/>',
    more: '<g fill="currentColor" stroke="none"><circle cx="3" cy="8" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="13" cy="8" r="1.2"/></g>',
    close: '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>',
    lock: '<rect x="3.5" y="7" width="9" height="7" rx="1"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>',
    eraser: '<path d="M9.5 2.5l4 4-6.5 6.5H3.5l-1.5-1.5a1.4 1.4 0 0 1 0-2z"/><path d="M6 6l4 4M7 13h7"/>',
    back: '<path d="M13.5 8h-11M6.5 4L2.5 8l4 4"/>',
    play: '<path d="M4.5 2.5v11l9-5.5z" fill="currentColor"/>',
    pause: '<path d="M4.5 2.5h2.5v11H4.5zM9 2.5h2.5v11H9z" fill="currentColor" stroke="none"/>',
    check: '<path d="M3 8.5l3.2 3L13 4.5"/>',
    comment: '<path d="M2 3h12v8H7l-3 2.5V11H2z"/>',
    star: '<path d="M8 1.8l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.6l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/>',
    table: '<rect x="1.8" y="2.5" width="12.4" height="11"/><path d="M1.8 6h12.4M1.8 9.7h12.4M6 6v7.5"/>',
    spotlight: '<circle cx="8" cy="8" r="2.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2"/>',
    sortDesc: '<path d="M4 2.5v11M1.8 11.2L4 13.5l2.2-2.3M8.5 3.5h6M8.5 7h4.5M8.5 10.5h3"/>',
    sortAsc: '<path d="M4 2.5v11M1.8 4.8L4 2.5l2.2 2.3M8.5 3.5h3M8.5 7h4.5M8.5 10.5h6"/>',
    dax: '<path d="M5.5 3.5L2 8l3.5 4.5M10.5 3.5L14 8l-3.5 4.5"/>',
    drillthrough: '<path d="M2 8h9M7.5 4.5L11 8l-3.5 3.5M13.5 3v10"/>',
    include: '<circle cx="8" cy="8" r="6.2"/><path d="M5 8l2.2 2.2L11 6"/>',
    exclude: '<circle cx="8" cy="8" r="6.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5"/>',
    pages: '<rect x="3" y="1.8" width="10" height="12.4"/><path d="M5.5 5h5M5.5 8h5M5.5 11h3"/>',
    copy: '<rect x="5" y="5" width="8.5" height="9"/><path d="M3 11V2.5h8"/>'
  };
  function icon(name, size) {
    const s = size || 16;
    const body = P[name] || '';
    return (
      '<svg class="ic" width="' +
      s +
      '" height="' +
      s +
      '" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      body +
      '</svg>'
    );
  }
  window.PBI_ICON = icon;
})();
