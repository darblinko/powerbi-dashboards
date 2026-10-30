/* slicers.js: between date slicer, dropdown slicer, tile slicer, text box. Slicer state is synced across pages. */
(function () {
  'use strict';
  const PBI = window.PBI;
  const D = window.PBIDATA;
  const icon = PBI.icon;
  const esc = PBI.charts.esc;

  function eraser(onClear, active) {
    const b = document.createElement('button');
    b.className = 'slicer-clear' + (active ? ' on' : '');
    b.title = 'Clear selections';
    b.innerHTML = icon('eraser', 13);
    b.addEventListener('mousedown', e => e.stopPropagation());
    b.addEventListener('click', e => {
      e.stopPropagation();
      onClear();
    });
    return b;
  }
  function slicerHead(body, label, onClear, active) {
    const h = document.createElement('div');
    h.className = 'slicer-head';
    h.innerHTML = '<span>' + esc(label) + '</span>';
    h.appendChild(eraser(onClear, active));
    body.appendChild(h);
  }

  // Keyboard step for a date slicer handle (0 start, 1 end), in months. Returns null for other keys.
  const KEY_STEPS = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -12, PageUp: 12 };
  function stepRange(from, to, which, key, max) {
    const lo = which === 0 ? 0 : from;
    const hi = which === 0 ? to : max;
    const cur = which === 0 ? from : to;
    let v;
    if (key in KEY_STEPS) v = cur + KEY_STEPS[key];
    else if (key === 'Home') v = lo;
    else if (key === 'End') v = hi;
    else return null;
    v = Math.max(lo, Math.min(hi, v));
    return which === 0 ? { from: v, to } : { from, to: v };
  }

  function dateSlicer(id, rect) {
    return Object.assign(
      {
        id,
        kind: 'slicer',
        title: '',
        noTitle: true,
        cls: 'slicer-date',
        pad: 6,
        render(body) {
          const S = PBI.S.slicers;
          const max = D.MONTHS.length - 1;
          body.innerHTML = '';
          slicerHead(
            body,
            'Received Date',
            () => {
              S.from = 0;
              S.to = max;
              PBI.app.update();
            },
            S.from > 0 || S.to < max
          );
          const wrap = document.createElement('div');
          wrap.className = 'ds-wrap';
          wrap.innerHTML =
            '<div class="ds-boxes"><div class="ds-box ds-from">' +
            D.fmtDay(D.MONTHS[S.from].first) +
            icon('chevDown', 10) +
            '</div>' +
            '<div class="ds-box ds-to">' +
            D.fmtDay(D.MONTHS[S.to].last) +
            icon('chevDown', 10) +
            '</div></div>' +
            '<div class="ds-track"><div class="ds-fill"></div>' +
            '<div class="ds-h ds-h0" title="Start" role="slider" tabindex="0" aria-label="Start date"></div>' +
            '<div class="ds-h ds-h1" title="End" role="slider" tabindex="0" aria-label="End date"></div></div>';
          body.appendChild(wrap);
          const track = wrap.querySelector('.ds-track');
          const fill = wrap.querySelector('.ds-fill');
          const h0 = wrap.querySelector('.ds-h0'),
            h1 = wrap.querySelector('.ds-h1');
          let from = S.from,
            to = S.to;
          const place = () => {
            const p0 = (from / max) * 100,
              p1 = (to / max) * 100;
            h0.style.left = p0 + '%';
            h1.style.left = p1 + '%';
            fill.style.left = p0 + '%';
            fill.style.width = p1 - p0 + '%';
            wrap.querySelector('.ds-from').firstChild.textContent = D.fmtDay(D.MONTHS[from].first);
            wrap.querySelector('.ds-to').firstChild.textContent = D.fmtDay(D.MONTHS[to].last);
            const aria = (h, min, now, hi, day) => {
              h.setAttribute('aria-valuemin', min);
              h.setAttribute('aria-valuemax', hi);
              h.setAttribute('aria-valuenow', now);
              h.setAttribute('aria-valuetext', D.fmtDay(day));
            };
            aria(h0, 0, from, to, D.MONTHS[from].first);
            aria(h1, from, to, max, D.MONTHS[to].last);
          };
          place();
          const drag = (handle, which) =>
            handle.addEventListener('pointerdown', e => {
              e.preventDefault();
              e.stopPropagation();
              handle.setPointerCapture(e.pointerId);
              const move = ev => {
                const r = track.getBoundingClientRect();
                const v = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * max);
                if (which === 0) from = Math.min(v, to);
                else to = Math.max(v, from);
                place();
              };
              const up = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                if (from !== S.from || to !== S.to) {
                  S.from = from;
                  S.to = to;
                  PBI.app.update();
                }
              };
              handle.addEventListener('pointermove', move);
              handle.addEventListener('pointerup', up);
            });
          drag(h0, 0);
          drag(h1, 1);
          const keys = (handle, which) =>
            handle.addEventListener('keydown', e => {
              const next = stepRange(S.from, S.to, which, e.key, max);
              if (!next) return;
              e.preventDefault();
              e.stopPropagation();
              if (next.from === S.from && next.to === S.to) return;
              S.from = next.from;
              S.to = next.to;
              PBI.app.update();
              const again = body.querySelector(which === 0 ? '.ds-h0' : '.ds-h1');
              if (again) again.focus();
            });
          keys(h0, 0);
          keys(h1, 1);
        },
        setRange(from, to) {
          PBI.S.slicers.from = from;
          PBI.S.slicers.to = to;
          PBI.app.update();
        }
      },
      rect
    );
  }

  function dropdownSlicer(id, rect) {
    return Object.assign(
      {
        id,
        kind: 'slicer',
        title: '',
        noTitle: true,
        cls: 'slicer-dd',
        pad: 6,
        render(body) {
          const sel = PBI.S.slicers.products;
          const names = D.PRODUCTS.map(p => p.name);
          body.innerHTML = '';
          slicerHead(
            body,
            'Product',
            () => {
              sel.clear();
              PBI.app.update();
            },
            sel.size > 0
          );
          const text = sel.size === 0 ? 'All' : sel.size === 1 ? [...sel][0] : 'Multiple selections';
          const box = document.createElement('div');
          box.className = 'dd-box';
          box.innerHTML = '<span>' + esc(text) + '</span>' + icon('chevDown', 12);
          body.appendChild(box);
          box.addEventListener('mousedown', e => e.stopPropagation());
          box.addEventListener('click', e => {
            e.stopPropagation();
            const items = ['Select all'].concat(names);
            const html = items
              .map((n, i) => {
                const on = i === 0 ? sel.size === names.length : sel.has(n);
                return (
                  '<label class="dd-item"><span class="cb' +
                  (on ? ' on' : '') +
                  '">' +
                  (on ? icon('check', 10) : '') +
                  '</span><span>' +
                  esc(n) +
                  '</span></label>'
                );
              })
              .join('');
            const m = PBI.frame.panel('<div class="dd-list">' + html + '</div>', box, 'dd-pop');
            const r = box.getBoundingClientRect();
            m.style.left = r.left + 'px';
            m.style.top = r.bottom + 'px';
            m.style.width = r.width + 'px';
            m.querySelectorAll('.dd-item').forEach((it, i) =>
              it.addEventListener('click', ev => {
                ev.preventDefault();
                if (i === 0) {
                  if (sel.size === names.length) sel.clear();
                  else names.forEach(n => sel.add(n));
                } else {
                  const n = names[i - 1];
                  sel.has(n) ? sel.delete(n) : sel.add(n);
                }
                if (sel.size === names.length) sel.clear();
                PBI.frame.closeMenus();
                PBI.app.update();
              })
            );
          });
        }
      },
      rect
    );
  }

  function tileSlicer(id, rect) {
    return Object.assign(
      {
        id,
        kind: 'slicer',
        title: '',
        noTitle: true,
        cls: 'slicer-tile',
        pad: 6,
        render(body) {
          const sel = PBI.S.slicers.regions;
          body.innerHTML = '';
          slicerHead(
            body,
            'Region',
            () => {
              sel.clear();
              PBI.app.update();
            },
            sel.size > 0
          );
          const row = document.createElement('div');
          row.className = 'tiles';
          D.REGIONS.forEach(r => {
            const t = document.createElement('button');
            t.className = 'tile' + (sel.has(r) ? ' on' : '');
            t.textContent = r;
            t.addEventListener('mousedown', e => e.stopPropagation());
            t.addEventListener('click', e => {
              const multi = e.ctrlKey || e.metaKey;
              if (multi) {
                sel.has(r) ? sel.delete(r) : sel.add(r);
              } else if (sel.has(r) && sel.size === 1) sel.clear();
              else {
                sel.clear();
                sel.add(r);
              }
              PBI.app.update();
            });
            row.appendChild(t);
          });
          body.appendChild(row);
        }
      },
      rect
    );
  }

  function textBox(id, rect, titleFn, subFn) {
    return Object.assign(
      {
        id,
        kind: 'text',
        title: '',
        noTitle: true,
        pad: 8,
        render(body) {
          body.innerHTML =
            '<div class="tb-title">' +
            esc(titleFn()) +
            '</div><div class="tb-sub">' +
            esc(subFn ? subFn() : '') +
            '</div>';
        }
      },
      rect
    );
  }

  function rangeLabel() {
    const S = PBI.S.slicers;
    return D.MONTHS[S.from].label + ' to ' + D.MONTHS[S.to].label;
  }

  // The standard header band shared by pages 1 to 3.
  function band(prefix, title) {
    return [
      textBox(
        prefix + 'Title',
        { x: 8, y: 8, w: 316, h: 52 },
        () => title,
        () => 'Period: ' + rangeLabel()
      ),
      dateSlicer(prefix + 'Date', { x: 332, y: 8, w: 300, h: 52 }),
      dropdownSlicer(prefix + 'Product', { x: 640, y: 8, w: 210, h: 52 }),
      tileSlicer(prefix + 'Region', { x: 858, y: 8, w: 414, h: 52 })
    ];
  }

  PBI.slicers = { dateSlicer, dropdownSlicer, tileSlicer, textBox, band, rangeLabel, stepRange };
})();
