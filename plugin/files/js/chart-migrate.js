/* APEX Visual Designer — moves the four old chart looks (v1–v4) to Chart Designer configurations.
   Runs on page open in the browser. The old variant and values stay on the entry until the first
   successful save (strip), so an unsaved page can still be closed without changes. */
(function () {
  window.VD = window.VD || {};

  // The old looks' defaults: series1, series2, series3, grid, bg, text, border, radius, and whether
  // the look drew a border (Minimal and Soft had none) and dashed grid lines (all but Minimal).
  var LOOKS = {
    v1: { d: ['#0f766e', '#2563eb', '#f59e0b', '#e2e8f0', '#ffffff', '#0f172a', '#e2e8f0', 16], border: true, dashed: true },
    v2: { d: ['#334155', '#94a3b8', '#cbd5e1', '#f1f5f9', '#ffffff', '#334155', '#e2e8f0', 8], border: false, dashed: false },
    v3: { d: ['#6366f1', '#ec4899', '#14b8a6', '#eef2ff', '#ffffff', '#1e1b4b', '#e0e7ff', 20], border: false, dashed: true },
    v4: { d: ['#2dd4bf', '#60a5fa', '#fbbf24', '#334155', '#0f172a', '#e2e8f0', '#1e293b', 16], border: true, dashed: true }
  };
  var KEYS = ['series1', 'series2', 'series3', 'grid', 'bg', 'text', 'border', 'radius'];
  var HEX = /^#[0-9a-f]{3,8}$/i;

  function value(given, i, def) {
    var v = given ? given[KEYS[i]] : undefined;
    if (i === 7) { v = Number(v); return v >= 0 && v <= 40 && v === Math.round(v) ? v : def; }
    return typeof v === 'string' && HEX.test(v) ? v : def;
  }

  // One design entry: a copy with `chart` added when it is an old chart look, else the entry itself.
  function entry(e) {
    var look = e && e.type === 'NATIVE_JET_CHART' && !e.chart && LOOKS[e.variant];
    if (!look) return e;
    var v = look.d.map(function (def, i) { return value(e.values, i, def); });
    var axis = function () { return { gridColor: v[3], gridStyle: look.dashed ? 'dashed' : 'solid', labelColor: v[5], axisLineColor: v[3] }; };
    var global = { palette: [v[0], v[1], v[2]], background: v[4], radius: v[7] };
    if (look.border) global.border = v[6];
    var out = JSON.parse(JSON.stringify(e));
    out.chart = { version: 1, engine: 'jet', global: global, axes: { x: axis(), y: axis() }, legend: { color: v[5] } };
    return out;
  }

  function design(d) {
    var changed = false;
    var list = ((d && d.components) || []).map(function (c) { var n = entry(c); if (n !== c) changed = true; return n; });
    var out = JSON.parse(JSON.stringify(d || {}));
    out.components = list;
    return { design: out, changed: changed };
  }

  // The design as it is saved: entries with a chart drop the old look's variant and values.
  function strip(d) {
    var out = JSON.parse(JSON.stringify(d));
    (out.components || []).forEach(function (c) { if (c.chart) { delete c.variant; delete c.values; } });
    return out;
  }

  window.VD.chartMigrate = { entry: entry, design: design, strip: strip };
})();
