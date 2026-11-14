/* APEX Visual Designer — undo/redo of the Flutter Designer's design, as JSON snapshots.
   record(before) is called with the state before each change; undo(current) and redo(current)
   return the state to show, or null when there is none. */
(function () {
  window.VD = window.VD || {};

  function create(limit) {
    var back = [], fwd = [];
    return {
      record: function (before) {
        if (back[back.length - 1] === before) return;
        back.push(before);
        if (back.length > limit) back.shift();
        fwd = [];
      },
      undo: function (current) {
        if (!back.length) return null;
        fwd.push(current);
        return back.pop();
      },
      redo: function (current) {
        if (!fwd.length) return null;
        back.push(current);
        return fwd.pop();
      },
      canUndo: function () { return back.length > 0; },
      canRedo: function () { return fwd.length > 0; },
      clear: function () { back = []; fwd = []; }
    };
  }

  window.VD.undoStack = { create: create };
})();
