'use strict';
/* Static Service chrome decoration: navigation rail, app bar icons, action bar icons. */
(function () {
  const rail = [['home', 'Home'], ['create', 'Create'], ['browse', 'Browse'], ['onelake', 'OneLake'], ['apps', 'Apps'], ['workspaces', 'Workspaces']];
  const railEl = document.getElementById('rail');
  railEl.innerHTML = rail.map(([ic, label]) => '<button class="rail-item" title="' + label + '">' + icon(ic, 20) + '<span>' + label + '</span></button>').join('') +
    '<div class="rail-sep"></div><button class="rail-item active" title="CMO Operations"><span class="ws-tile">CO</span><span>CMO Operations</span></button>';
  const right = [['bell', 'Notifications'], ['gear', 'Settings'], ['download', 'Download'], ['help', 'Help and support'], ['smile', 'Feedback']];
  document.getElementById('ab-right').innerHTML = right.map(([ic, t]) => '<button class="ab-ico" title="' + t + '">' + icon(ic, 16) + '</button>').join('') +
    '<span class="ab-avatar" title="Account">CM</span>';
  document.querySelectorAll('.ac-btn').forEach(b => {
    b.insertAdjacentHTML('afterbegin', icon(b.dataset.ic, 15));
    const caret = b.querySelector('.caret');
    if (caret) caret.outerHTML = icon('chevronDown', 11, 'caret-ico');
  });
  document.getElementById('btn-pages-collapse').innerHTML = icon('chevronDoubleLeft', 13);
})();
