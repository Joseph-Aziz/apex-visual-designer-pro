/* APEX Visual Designer — Layout board view.
   Shows one page's slots, regions and items as boxes on the 12-column grid. Boxes move by drag
   and drop or the arrow keys and change span by the right-edge handle or Shift+arrows; nothing
   reaches the page until Apply, which writes every change in one page re-import. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;
  var M = function () { return VD.layoutModel; };

  var host = null, frame = null;
  var state = { app: null, page: null, json: null, board: null, selected: null, message: '', busy: false, sharedSession: false };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dirty() { return !!state.board && M().dirty(state.board); }
  function setMessage(m, refused) {
    state.message = m || '';
    var el = host && host.querySelector('.lb-msg');
    if (el) { el.textContent = state.message; el.classList.toggle('is-refused', !!refused); }
  }
  function clone(b) { return JSON.parse(JSON.stringify(b)); }
  function splitKey(k) { var i = k.indexOf(':'); return { kind: k.slice(0, i), id: k.slice(i + 1) }; }

  // ------------------------------------------------------------ loading
  function attach(app, page) {
    state.app = app; state.page = page; state.selected = null;
    setMessage('Loading page ' + app + ':' + page + '…');
    var shared = VD.repository.listPageComponents(app, page).then(function (r) { return !!r.sharedSession; }, function () { return false; });
    return Promise.all([VD.repository.layout(app, page), shared]).then(function (r) {
      state.json = r[0];
      state.board = M().load(r[0]);
      state.sharedSession = r[1];
      setMessage('');
      render(true);
    }).catch(function (e) { state.json = null; state.board = null; setMessage(e.message, true); render(true); });
  }

  // ------------------------------------------------------------ board markup
  function changedKeys() {
    var out = {};
    if (state.board) M().changes(state.board).forEach(function (c) { out[c.kind + ':' + c.id] = true; });
    return out;
  }

  function boxHtml(c, grid, changed, autoSpan) {
    var k = c.kind + ':' + c.id;
    var cls = 'lb-box lb-' + c.kind + (changed[k] ? ' is-changed' : '') + (c.hidden ? ' is-hidden' : '') +
      (state.selected === k ? ' is-selected' : '');
    var span = c.span || autoSpan;
    var style = grid ? ' style="grid-column:span ' + span + '"' : '';
    var name = c.kind === 'region' ? (c.title || 'Region ' + c.id) : (c.label || c.name);
    var meta = (c.kind === 'item' ? c.name + ' · ' : '') + (grid ? (c.span ? c.span + ' col' : 'auto') : '');
    var inner = c.kind === 'region' ? containerHtml('region:' + c.id, changed) : '';
    return '<div class="' + cls + '"' + style + ' draggable="true" tabindex="0" data-key="' + esc(k) + '">' +
      '<div class="lb-head"><span class="lb-name">' + esc(name) + '</span><span class="lb-meta">' + esc(meta) + '</span></div>' +
      inner + (grid ? '<span class="lb-handle" title="Drag to change the span" aria-hidden="true"></span>' : '') + '</div>';
  }

  function containerHtml(container, changed) {
    var b = state.board, grid = M().hasGrid(b, container);
    var rows = M().rows(b, container);
    var html = rows.map(function (row) {
      var fixed = row.reduce(function (s, c) { return s + (c.span || 0); }, 0);
      var autos = row.filter(function (c) { return !c.span; }).length;
      var autoSpan = autos ? Math.max(1, Math.floor((12 - Math.min(fixed, 11)) / autos)) : 12;
      return '<div class="' + (grid ? 'lb-row' : 'lb-list') + '">' +
        row.map(function (c) { return boxHtml(c, grid, changed, autoSpan); }).join('') + '</div>';
    }).join('');
    return '<div class="lb-container' + (grid ? ' is-grid' : '') + '" data-container="' + esc(container) + '">' +
      (html || '<div class="lb-empty">Drop here</div>') + '</div>';
  }

  function boardHtml() {
    var b = state.board, changed = changedKeys();
    var html = b.slots.map(function (s) {
      return '<section class="lb-slot"><h4>' + esc(s.label || s.name) + (s.grid ? '' : ' <small>no grid</small>') + '</h4>' +
        containerHtml('slot:' + s.name, changed) + '</section>';
    }).join('');
    if ((b.order.noregion || []).length) {
      html += '<section class="lb-slot lb-noregion"><h4>No region</h4>' + containerHtml('noregion', changed) + '</section>';
    }
    return html + '<div class="vd-dropline" hidden></div>';
  }

  // ------------------------------------------------------------ rendering
  function skeleton() {
    host.innerHTML =
      '<div class="lk-top lb-top"></div><div class="lk-msg lb-msg" role="status"></div>' +
      '<div class="lb-body"><section class="lb-board" tabindex="-1"></section>' +
      '<section class="lb-preview"></section></div>';
  }

  function renderTop() {
    var top = host.querySelector('.lb-top');
    top.innerHTML =
      '<strong>Layout board</strong>' +
      '<span class="lk-state">' + (state.board ? (dirty() ? 'Changes not applied' : 'Applied') : '') + '</span>' +
      '<span class="lk-spacer"></span>' +
      '<label class="lk-inline">App <input type="number" class="lb-app" value="' + esc(state.app) + '"></label>' +
      '<label class="lk-inline">Page <input type="number" class="lb-page" value="' + esc(state.page == null ? '' : state.page) + '"></label>' +
      '<button class="vd-btn vd-btn--secondary lb-open">Open page</button>' +
      '<button class="vd-btn vd-btn--ghost lb-revert"' + (dirty() && !state.busy ? '' : ' disabled') + '>Revert</button>' +
      '<button class="vd-btn vd-btn--ghost lb-undo"' + (state.board && !dirty() && !state.busy ? '' : ' disabled') + '>Undo apply</button>' +
      '<button class="vd-btn vd-btn--primary lb-apply"' + (dirty() && !state.busy ? '' : ' disabled') + '>Apply</button>';
    top.querySelector('.lb-open').addEventListener('click', function () {
      var app = Number(top.querySelector('.lb-app').value), page = Number(top.querySelector('.lb-page').value);
      if (!app || !(page >= 0) || top.querySelector('.lb-page').value === '') { setMessage('Enter an app and page number.'); return; }
      if (dirty() && !window.confirm('Discard the layout changes that are not applied?')) return;
      attach(app, page);
    });
    top.querySelector('.lb-revert').addEventListener('click', revert);
    top.querySelector('.lb-undo').addEventListener('click', undo);
    top.querySelector('.lb-apply').addEventListener('click', function () { apply(); });
  }

  function renderBoard() {
    var el = host.querySelector('.lb-board');
    if (!state.board) { el.innerHTML = '<div class="lk-empty">Open a page to see its layout.</div>'; return; }
    var scroll = el.scrollTop;
    el.innerHTML = boardHtml();
    el.scrollTop = scroll;
    bindBoard(el);
    if (state.selected) {
      var sel = el.querySelector('[data-key="' + cssEscape(state.selected) + '"]');
      if (sel) sel.focus({ preventScroll: true });
    }
  }

  function cssEscape(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  function loadPreview() {
    var box = host.querySelector('.lb-preview');
    if (state.page == null || !state.board) { box.innerHTML = ''; frame = null; return; }
    frame = document.createElement('iframe');
    frame.className = 'lk-frame';
    frame.title = 'Page preview';
    frame.src = VD.pagePreview.url(state.app, state.page, state.sharedSession);
    box.innerHTML = '';
    box.appendChild(frame);
  }

  function render(reloadFrame) {
    if (!host) return;
    if (!host.querySelector('.lb-board')) { skeleton(); reloadFrame = true; }
    renderTop(); renderBoard();
    setMessage(state.message, host.querySelector('.lb-msg').classList.contains('is-refused'));
    if (reloadFrame) loadPreview();
  }

  // Runs a model change; shows the reason when the model refuses it.
  function change(result) {
    if (!result.ok) { setMessage(result.reason, true); return false; }
    setMessage('');
    renderTop(); renderBoard();
    return true;
  }

  // ------------------------------------------------------------ drag and drop
  var drag = null; // { key, target }

  // The drop target for a pointer over a container: before which box, and on the same row.
  function targetAt(containerEl, x, y) {
    var container = containerEl.getAttribute('data-container');
    var grid = containerEl.classList.contains('is-grid');
    var boxes = Array.prototype.filter.call(containerEl.querySelectorAll('.lb-box'), function (b) {
      return b.parentNode.parentNode === containerEl;
    });
    for (var i = 0; i < boxes.length; i++) {
      var r = boxes[i].getBoundingClientRect();
      if (y < r.top || y > r.bottom || (grid && (x < r.left || x > r.right))) continue;
      var key = boxes[i].getAttribute('data-key');
      if (grid) {
        if (x < r.left + r.width / 2) return { container: container, before: splitKey(key).id, sameRow: true, el: boxes[i], edge: 'left' };
        // Right half: before the next box of this row, or at the end of the row when it is the last row.
        var next = boxes[i].nextElementSibling;
        if (next) return { container: container, before: splitKey(next.getAttribute('data-key')).id, sameRow: true, el: boxes[i], edge: 'right' };
        var nextRow = boxes[i].parentNode.nextElementSibling;
        var first = nextRow && nextRow.querySelector('.lb-box');
        return { container: container, before: first ? splitKey(first.getAttribute('data-key')).id : null, sameRow: !first, el: boxes[i], edge: 'right' };
      }
      if (y < r.top + r.height / 2) return { container: container, before: splitKey(key).id, sameRow: false, el: boxes[i], edge: 'top' };
      var after = boxes[i + 1];
      return { container: container, before: after ? splitKey(after.getAttribute('data-key')).id : null, sameRow: false, el: boxes[i], edge: 'bottom' };
    }
    return { container: container, before: null, sameRow: false, el: containerEl, edge: 'end' };
  }

  function tryMove(key, target) {
    var k = splitKey(key);
    if (target.before === k.id && target.container !== 'region:' + k.id) return { ok: true, same: true };
    return M().move(clone(state.board), k.kind, k.id, target);
  }

  function showLine(boardEl, target, refused) {
    var line = boardEl.querySelector('.vd-dropline');
    var b = boardEl.getBoundingClientRect(), r = target.el.getBoundingClientRect();
    var top = r.top - b.top + boardEl.scrollTop, left = r.left - b.left + boardEl.scrollLeft;
    var vertical = target.edge === 'left' || target.edge === 'right';
    line.style.top = (target.edge === 'bottom' || target.edge === 'end' ? top + r.height - 2 : top) + 'px';
    line.style.left = (target.edge === 'right' ? left + r.width - 2 : left) + 'px';
    line.style.width = vertical ? '3px' : r.width + 'px';
    line.style.height = vertical ? r.height + 'px' : '3px';
    line.classList.toggle('is-refused', !!refused);
    line.hidden = false;
  }

  function bindBoard(el) {
    el.querySelectorAll('.lb-box').forEach(function (box) {
      box.addEventListener('dragstart', function (ev) {
        ev.stopPropagation();
        drag = { key: box.getAttribute('data-key') };
        try { ev.dataTransfer.setData('text/plain', drag.key); ev.dataTransfer.effectAllowed = 'move'; } catch (e) { /* older browsers */ }
      });
      box.addEventListener('dragend', function () { drag = null; el.querySelector('.vd-dropline').hidden = true; });
      box.addEventListener('focus', function (ev) {
        if (ev.target !== box) return;
        state.selected = box.getAttribute('data-key');
        el.querySelectorAll('.lb-box.is-selected').forEach(function (b) { b.classList.remove('is-selected'); });
        box.classList.add('is-selected');
      });
      box.addEventListener('keydown', onKey);
      var handle = box.querySelector(':scope > .lb-handle');
      if (handle) handle.addEventListener('mousedown', function (ev) { startResize(ev, box); });
    });
    el.querySelectorAll('.lb-container').forEach(function (c) {
      c.addEventListener('dragover', function (ev) {
        if (!drag) return;
        ev.preventDefault(); ev.stopPropagation();
        var t = targetAt(c, ev.clientX, ev.clientY), r = tryMove(drag.key, t);
        drag.target = t;
        showLine(el, t, !r.ok);
        if (!r.ok) setMessage(r.reason, true); else if (state.message) setMessage('');
      });
      c.addEventListener('drop', function (ev) {
        if (!drag) return;
        ev.preventDefault(); ev.stopPropagation();
        var t = targetAt(c, ev.clientX, ev.clientY), k = splitKey(drag.key);
        drag = null;
        el.querySelector('.vd-dropline').hidden = true;
        if (t.before === k.id) return;
        state.selected = k.kind + ':' + k.id;
        change(M().move(state.board, k.kind, k.id, { container: t.container, before: t.before, sameRow: t.sameRow }));
      });
    });
  }

  // Right-edge handle: whole columns of the row the box sits in.
  function startResize(ev, box) {
    ev.preventDefault(); ev.stopPropagation();
    var k = splitKey(box.getAttribute('data-key'));
    var row = box.parentNode.getBoundingClientRect(), left = box.getBoundingClientRect().left;
    var col = row.width / 12, span = null;
    function onMove(e) {
      span = Math.max(1, Math.min(12, Math.round((e.clientX - left) / col)));
      box.style.gridColumn = 'span ' + span;
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      state.selected = k.kind + ':' + k.id;
      if (span == null) return;
      if (!change(M().setSpan(state.board, k.kind, k.id, span))) renderBoard();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // Arrows move the selected box inside its container; Shift+Left/Right change its span.
  function onKey(ev) {
    var box = ev.currentTarget;
    if (ev.target !== box || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(ev.key) < 0) return;
    ev.preventDefault(); ev.stopPropagation();
    var key = box.getAttribute('data-key'), k = splitKey(key), c = state.board.comps[key];
    var container = box.parentNode.parentNode.getAttribute('data-container');
    var grid = M().hasGrid(state.board, container);
    state.selected = key;
    if (ev.shiftKey) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      var span = (c.span || 12) + (ev.key === 'ArrowRight' ? 1 : -1);
      if (span < 1 || span > 12) return;
      change(M().setSpan(state.board, k.kind, k.id, span));
      return;
    }
    var list = (state.board.order[container] || []).filter(function (x) { return x.indexOf(k.kind + ':') === 0; });
    var at = list.indexOf(key), back = ev.key === 'ArrowUp' || ev.key === 'ArrowLeft';
    var sameRow = grid && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight');
    if (back ? at <= 0 : at >= list.length - 1) return;
    var before = back ? list[at - 1] : list[at + 2];
    change(M().move(state.board, k.kind, k.id, { container: container, before: before ? splitKey(before).id : null, sameRow: sameRow }));
  }

  // ------------------------------------------------------------ apply, revert, undo
  function reimportWarning(what) {
    return what + ' re-imports page ' + state.page + ' of application ' + state.app +
      '. That signs out everyone using the application, and they must log in again. Continue?';
  }

  function apply(then) {
    if (!dirty() || state.busy) return Promise.resolve(false);
    if (!window.confirm(reimportWarning('Applying the layout'))) return Promise.resolve(false);
    state.busy = true; renderTop();
    setMessage('Applying the layout to page ' + state.page + '…');
    return VD.repository.applyLayout(state.app, state.page, state.json.token, M().changes(state.board))
      .then(function () {
        state.busy = false;
        return attach(state.app, state.page).then(function () {
          setMessage('Applied. Undo apply puts the previous layout back.');
          if (then) then();
          return true;
        });
      })
      .catch(function (e) { state.busy = false; setMessage(e.message, true); renderTop(); return false; });
  }

  function revert() {
    if (!state.json) return;
    state.board = M().load(state.json);
    setMessage('Changes discarded.');
    renderTop(); renderBoard();
  }

  function undo() {
    if (!state.board || dirty() || state.busy) return;
    if (!window.confirm(reimportWarning('Undo apply'))) return;
    state.busy = true; renderTop();
    setMessage('Putting the previous layout back…');
    VD.repository.undoLayout(state.app, state.page, state.json.token)
      .then(function () {
        state.busy = false;
        return attach(state.app, state.page).then(function () { setMessage('The previous layout is back.'); });
      })
      .catch(function (e) { state.busy = false; setMessage(e.message, true); renderTop(); });
  }

  window.VD.layoutMode = {
    enter: function () {
      host = document.getElementById('layout-host');
      if (state.app == null && VD.config && VD.config.app) state.app = VD.config.app;
      if (!host) return;
      render(!frame);
    },
    // false keeps the board open: the user cancelled, or chose Apply (then onLeave runs after it).
    leave: function (onLeave) {
      if (!dirty()) return true;
      if (window.confirm('The layout has changes that are not applied. Apply them now?\n\nOK applies them; Cancel lets you discard them or stay.')) {
        apply(onLeave);
        return false;
      }
      if (window.confirm('Discard the layout changes that are not applied?')) { revert(); return true; }
      return false;
    },
    attach: attach
  };
})();
