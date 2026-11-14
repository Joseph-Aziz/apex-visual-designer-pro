/* APEX Visual Designer — layout board model: regions, items and region buttons of one page as
   plain data. Moves and span changes are checked here (12-column rows, no region inside itself,
   items and buttons need a region) and the board lists only the components whose layout values
   changed. Items and buttons share rows and sequence numbers inside a region body, as the page
   renders them; a button at another position (BELOW_BOX, NEXT, ...) sits in a strip of its own. */
(function () {
  window.VD = window.VD || {};

  var FIELDS = { region: ['slot', 'parent', 'seq', 'newRow', 'newCol', 'colStart', 'span'],
    item: ['region', 'seq', 'newRow', 'newCol', 'colStart', 'span'],
    button: ['region', 'position', 'seq', 'newRow', 'newCol', 'colStart', 'span'] };
  var SUB = 'SUB_REGIONS';

  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function key(kind, id) { return kind + ':' + id; }
  // Regions make rows of their own; items and buttons share theirs.
  function group(kind) { return kind === 'region' ? 'region' : 'field'; }

  // Container key of a component: top regions sit in their slot, sub-regions, items and body
  // buttons in a region, other buttons in the strip of their region and position.
  function containerOf(c) {
    if (c.kind === 'region') return c.parent != null ? 'region:' + c.parent : 'slot:' + c.slot;
    if (c.kind === 'button' && c.position !== 'BODY') return 'btn:' + c.region + ':' + c.position;
    return c.region != null ? 'region:' + c.region : 'noregion';
  }

  function load(json) {
    var comps = {};
    (json.regions || []).forEach(function (r) { var c = copy(r); c.kind = 'region'; comps[key('region', r.id)] = c; });
    (json.items || []).forEach(function (i) { var c = copy(i); c.kind = 'item'; comps[key('item', i.id)] = c; });
    (json.buttons || []).forEach(function (b) { var c = copy(b); c.kind = 'button'; comps[key('button', b.id)] = c; });
    var board = { token: json.token, slots: copy(json.slots || []), comps: comps, original: copy(comps), order: {} };
    // Order inside each container: regions first by sequence, then items and buttons by sequence.
    Object.keys(comps).map(function (k) { return comps[k]; })
      .sort(function (a, b) { return (group(a.kind) === group(b.kind) ? 0 : a.kind === 'region' ? -1 : 1) || a.seq - b.seq; })
      .forEach(function (c) { var k = containerOf(c); (board.order[k] = board.order[k] || []).push(key(c.kind, c.id)); });
    return board;
  }

  // Whether a container lays its children on the 12-column grid (from the slot of its top region).
  function hasGrid(board, container) {
    if (container === 'noregion') return false;
    var guard = 0;
    while (container.indexOf('region:') === 0 && guard++ < 1000) {
      var r = board.comps[key('region', container.slice(7))];
      if (!r) return false;
      container = containerOf(r);
    }
    var slot = board.slots.filter(function (s) { return 'slot:' + s.name === container; })[0];
    return !!(slot && slot.grid);
  }

  // Regions and fields make separate rows, as the page's grid does (sub-regions first, then items
  // and buttons).
  function rows(board, container) {
    var out = [];
    ['region', 'field'].forEach(function (g) {
      var first = true;
      (board.order[container] || []).forEach(function (k) {
        var c = board.comps[k];
        if (group(c.kind) !== g) return;
        if (first || c.newRow || !hasGrid(board, container)) out.push([c]); else out[out.length - 1].push(c);
        first = false;
      });
    });
    return out;
  }

  // Automatic spans count as zero: the template decides them.
  function checkRows(board, container) {
    if (!hasGrid(board, container)) return null;
    var bad = rows(board, container).filter(function (row) {
      return row.reduce(function (s, c) { return s + (c.span || 0); }, 0) > 12;
    })[0];
    return bad ? 'A row cannot be wider than 12 columns.' : null;
  }

  function renumber(board, container) {
    var n = { region: 0, field: 0 };
    (board.order[container] || []).forEach(function (k) { var c = board.comps[k]; c.seq = (n[group(c.kind)] += 10); });
  }

  // Runs fn on the board; puts everything back when fn returns a reason.
  function attempt(board, fn) {
    var saved = { comps: copy(board.comps), order: copy(board.order) };
    var reason = fn();
    if (reason) { board.comps = saved.comps; board.order = saved.order; return { ok: false, reason: reason }; }
    return { ok: true };
  }

  function isInside(board, regionId, ancestorId) {
    var guard = 0, r = board.comps[key('region', regionId)];
    while (r && guard++ < 1000) {
      if (String(r.id) === String(ancestorId)) return true;
      r = r.parent != null ? board.comps[key('region', r.parent)] : null;
    }
    return false;
  }

  function move(board, kind, id, target) {
    var k = key(kind, id), c = board.comps[k];
    if (!c) return { ok: false, reason: 'Unknown component.' };
    var to = target.container;
    if (kind === 'item' && to.indexOf('region:') !== 0) return { ok: false, reason: 'An item must be inside a region.' };
    if (kind === 'button' && to.indexOf('region:') !== 0 && to.indexOf('btn:') !== 0) return { ok: false, reason: 'A button must be inside a region.' };
    if (to.indexOf('btn:') === 0 && !board.comps[key('region', to.split(':')[1])]) return { ok: false, reason: 'Unknown region.' };
    if (kind === 'region' && to.indexOf('slot:') !== 0 && to.indexOf('region:') !== 0) return { ok: false, reason: 'A region must be in a slot or a region.' };
    if (to.indexOf('region:') === 0 && !board.comps[key('region', to.slice(7))]) return { ok: false, reason: 'Unknown region.' };
    if (to.indexOf('slot:') === 0 && !board.slots.some(function (s) { return 'slot:' + s.name === to; })) return { ok: false, reason: 'The page template has no such slot.' };
    if (kind === 'region' && to.indexOf('region:') === 0 && isInside(board, to.slice(7), id)) return { ok: false, reason: 'A region cannot go inside itself.' };

    return attempt(board, function () {
      var from = containerOf(c);
      // The box after this one, in the same rows, keeps its row when this one led it.
      var same = board.order[from].filter(function (x) { return group(board.comps[x].kind) === group(kind); });
      var after = board.comps[same[same.indexOf(k) + 1]];
      if (after && (c.newRow || same.indexOf(k) === 0)) after.newRow = true;
      board.order[from] = board.order[from].filter(function (x) { return x !== k; });
      if (kind === 'region') {
        if (to.indexOf('slot:') === 0) { c.parent = null; c.slot = to.slice(5); } else { c.parent = to.slice(7); c.slot = SUB; }
      } else if (to.indexOf('btn:') === 0) {
        var parts = to.split(':'); c.region = parts[1]; c.position = parts.slice(2).join(':');
      } else {
        c.region = to.slice(7);
        if (kind === 'button') c.position = 'BODY';
      }
      var list = board.order[to] = board.order[to] || [];
      // beforeKey names the next box whatever its kind; before is an id of the moved kind.
      var bk = target.beforeKey != null ? target.beforeKey : target.before != null ? key(kind, target.before) : null;
      var at = bk != null ? list.indexOf(bk) : -1;
      if (bk != null && at < 0) return 'The drop position is not in that container.';
      if (hasGrid(board, to)) {
        if (at >= 0) {
          var next = board.comps[list[at]];
          // endOfRow: last on the row before `next`, which keeps starting its own row.
          if (target.endOfRow) c.newRow = false;
          else {
            c.newRow = target.sameRow ? !!next.newRow : true;
            next.newRow = !target.sameRow;
          }
        } else c.newRow = !target.sameRow;
      }
      if (at >= 0) list.splice(at, 0, k); else list.push(k);
      c.colStart = null;
      renumber(board, from);
      renumber(board, to);
      return checkRows(board, from) || checkRows(board, to);
    });
  }

  function setSpan(board, kind, id, span) {
    var c = board.comps[key(kind, id)];
    if (!c) return { ok: false, reason: 'Unknown component.' };
    var container = containerOf(c);
    if (!hasGrid(board, container)) return { ok: false, reason: 'This slot does not use the 12-column grid.' };
    if (span != null && !(span === Math.floor(span) && span >= 1 && span <= 12)) return { ok: false, reason: 'A span runs from 1 to 12 columns.' };
    return attempt(board, function () {
      c.span = span;
      var reason = checkRows(board, container);
      // A box that outgrows a row it does not lead starts a row of its own, as dragging it wider means.
      if (reason && !c.newRow && rows(board, container).some(function (row) { return row[0] !== c && row.indexOf(c) > 0; })) {
        c.newRow = true;
        reason = checkRows(board, container);
      }
      return reason;
    });
  }

  function changes(board) {
    var out = [];
    Object.keys(board.comps).forEach(function (k) {
      var c = board.comps[k], o = board.original[k], f = FIELDS[c.kind];
      if (!f.some(function (n) { return c[n] !== o[n]; })) return;
      var ch = { kind: c.kind, id: c.id };
      f.forEach(function (n) { ch[n] = c[n]; });
      out.push(ch);
    });
    return out;
  }

  function dirty(board) { return changes(board).length > 0; }

  window.VD.layoutModel = { load: load, move: move, setSpan: setSpan, changes: changes, rows: rows, dirty: dirty, hasGrid: hasGrid };
})();
