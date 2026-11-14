/* APEX Visual Designer — Chart Designer runtime.
   VD.chart.read(regionId)         -> { type, series, groups } from the native APEX chart, or null.
   VD.chart.apply(regionId, config) validates config, hands it to the engine adapter and re-applies
   it after every APEX refresh. Never throws: problems are reported with console.warn. */
(function () {
  var VD = window.VD = window.VD || {};
  var C = VD.chart = VD.chart || {};
  C.adapters = C.adapters || {};

  var charts = {};   // regionId -> { engine, clean }
  var warnedNewer = {};

  function warn(msg) { if (typeof console !== 'undefined') console.warn('Visual Designer chart: ' + msg); }

  function chartRegion(id) {
    var r = window.apex && window.apex.region && window.apex.region(id);
    return r && r.type === 'JetChart' ? r : null;
  }
  function option(w, p) { return (w.ojChart ? w : w[0]).ojChart('option', p); }

  function read(id) {
    var r = chartRegion(id);
    if (!r) return null;
    var w = r.widget();
    return { type: option(w, 'type'), series: option(w, 'series') || [], groups: option(w, 'groups') || [] };
  }

  function run(id, fn) {
    try { fn(); } catch (e) { warn(id + ': ' + (e && e.message ? e.message : e)); }
  }

  function apply(id, config) {
    var r = chartRegion(id);
    if (!r) return;
    var v = C.schema.validate(config || {}, (config && config.engine) || 'jet');
    if (!v.clean) {
      if (!warnedNewer[id]) { warnedNewer[id] = true; warn(id + ': ' + v.errors[0].message + ' — not applied'); }
      return;
    }
    var clean = v.clean, prev = charts[id], w = r.widget();
    var adapter = C.adapters[clean.engine];
    if (!adapter) { warn(id + ': engine ' + clean.engine + ' is not loaded'); return; }
    if (prev && prev.engine !== clean.engine && C.adapters[prev.engine]) {
      run(id, function () { C.adapters[prev.engine].destroy(w); });
    }
    charts[id] = { engine: clean.engine, clean: clean };
    run(id, function () { adapter.apply(clean, read(id), w); });

    // APEX writes the new series after apexafterrefresh fires, so re-apply one tick later.
    r.element.off('apexafterrefresh.vdchart').on('apexafterrefresh.vdchart', function () {
      setTimeout(function () {
        var c = charts[id], rr = chartRegion(id);
        if (!c || !rr) return;
        run(id, function () { C.adapters[c.engine].update(c.clean, read(id), rr.widget()); });
      }, 0);
    });
  }

  C.read = read;
  C.apply = apply;
})();
