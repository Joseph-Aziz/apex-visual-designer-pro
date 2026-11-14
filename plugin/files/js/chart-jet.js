/* APEX Visual Designer — Oracle JET adapter for the Chart Designer.
   Drives the ojChart jQuery widget of a native APEX chart through ojChart('option', path, value).
   Rules: never set null or undefined (JET crashes); remember each option's value before the first
   change so removing a setting can put it back; set nothing when the value is already right. */
(function () {
  var VD = window.VD = window.VD || {};
  VD.chart = VD.chart || {};
  VD.chart.adapters = VD.chart.adapters || {};

  var TYPE_MAP = {
    column: { type: 'bar', orientation: 'vertical' },
    bar: { type: 'bar', orientation: 'horizontal' },
    stackedBar: { type: 'bar', stack: 'on' },
    line: { type: 'line' },
    smoothLine: { type: 'line', 'styleDefaults.lineType': 'curved' },
    stepLine: { type: 'line', 'styleDefaults.lineType': 'stepped' },
    area: { type: 'area' },
    stackedArea: { type: 'area', stack: 'on' },
    pie: { type: 'pie' },
    donut: { type: 'pie', 'styleDefaults.pieInnerRadius': 0.5 },
    scatter: { type: 'scatter' },
    bubble: { type: 'bubble' },
    radar: { type: 'line', coordinateSystem: 'polar', polarGridShape: 'polygon' },
    polar: { type: 'bar', coordinateSystem: 'polar', polarGridShape: 'circle' },
    combo: { type: 'combo' },
    funnel: { type: 'funnel' }
  };
  var AXIS = { x: 'xAxis', y: 'yAxis', y2: 'y2Axis' };
  // JET defaults for top-level options this adapter sets, used when the chart started with none.
  var TOP_DEFAULTS = {
    orientation: 'vertical', stack: 'off', coordinateSystem: 'cartesian', polarGridShape: 'circle',
    zoomAndScroll: 'off', dragMode: 'user', selectionMode: 'none', dataCursor: 'auto',
    hoverBehavior: 'none', hideAndShowBehavior: 'none', animationOnDisplay: 'none', animationOnDataChange: 'none'
  };
  var onOff = function (b) { return b ? 'on' : 'off'; };
  var px = function (n) { return n + 'px'; };

  var state = new WeakMap(); // keyed by the widget element: { orig: {path: value}, items: {key: {field: value}} }
  function st(w) {
    var s = state.get(w[0]);
    if (!s) { s = { orig: {}, par: {}, items: {} }; state.set(w[0], s); }
    return s;
  }
  function get(w, p) { return w.ojChart('option', p); }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  // Every chart-level JET option the config asks for, as { path: value }.
  function globalOptions(cfg) {
    var o = {};
    function put(p, v) { if (v !== undefined && v !== null) o[p] = v; }
    function style(p, k, v) { if (v !== undefined) { o[p] = o[p] || {}; o[p][k] = v; } }

    var t = cfg.type && TYPE_MAP[cfg.type];
    for (var k in t || {}) put(k, t[k]);

    var g = cfg.global || {};
    put('styleDefaults.colors', g.palette);
    put('plotArea.backgroundColor', g.plotBackground);
    put('styleDefaults.barGapRatio', g.barGap);
    put('styleDefaults.maxBarWidth', g.maxBarWidth);
    put('styleDefaults.seriesEffect', g.seriesEffect);

    var axes = cfg.axes || {};
    Object.keys(AXIS).forEach(function (a) {
      var x = axes[a], n = AXIS[a];
      if (!x) return;
      if (x.visible !== undefined) put(n + '.rendered', onOff(x.visible));
      put(n + '.title', x.title);
      style(n + '.titleStyle', 'color', x.titleColor);
      if (x.titleSize !== undefined) style(n + '.titleStyle', 'fontSize', px(x.titleSize));
      put(n + '.min', x.min);
      put(n + '.max', x.max);
      put(n + '.step', x.step);
      put(n + '.scale', x.scale);
      put(n + '.baselineScaling', x.baseline);
      if (x.labelVisible !== undefined) put(n + '.tickLabel.rendered', onOff(x.labelVisible));
      style(n + '.tickLabel.style', 'color', x.labelColor);
      if (x.labelSize !== undefined) style(n + '.tickLabel.style', 'fontSize', px(x.labelSize));
      put(n + '.tickLabel.rotation', x.rotation);
      if (x.grid !== undefined) put(n + '.majorTick.rendered', onOff(x.grid));
      put(n + '.majorTick.lineColor', x.gridColor);
      put(n + '.majorTick.lineStyle', x.gridStyle);
      if (x.minorGrid !== undefined) put(n + '.minorTick.rendered', onOff(x.minorGrid));
      if (x.axisLine !== undefined) put(n + '.axisLine.rendered', onOff(x.axisLine));
      put(n + '.axisLine.lineColor', x.axisLineColor);
    });

    var refs = {};
    (cfg.refs || []).forEach(function (r) {
      var n = AXIS[r.axis || 'y'], ro = r.kind === 'zone'
        ? { type: 'area', low: r.low, high: r.high }
        : { type: 'line', value: r.value };
      if (r.color) ro.color = r.color;
      if (r.kind !== 'zone') {
        if (r.style) ro.lineStyle = r.style;
        if (r.width) ro.lineWidth = r.width;
      }
      if (r.label) ro.text = r.label;
      ro.displayInLegend = 'off';
      (refs[n] = refs[n] || []).push(ro);
    });
    for (var ax in refs) put(ax + '.referenceObjects', refs[ax]);

    var l = cfg.labels || {};
    style('styleDefaults.dataLabelStyle', 'color', l.color);
    if (l.size !== undefined) style('styleDefaults.dataLabelStyle', 'fontSize', px(l.size));

    var lg = cfg.legend || {};
    if (lg.visible !== undefined) put('legend.rendered', onOff(lg.visible));
    put('legend.position', lg.position);
    style('legend.textStyle', 'color', lg.color);
    if (lg.size !== undefined) style('legend.textStyle', 'fontSize', px(lg.size));
    if (lg.symbolSize !== undefined) { put('legend.symbolWidth', lg.symbolSize); put('legend.symbolHeight', lg.symbolSize); }

    var i = cfg.interact || {};
    if (i.zoom !== undefined) put('zoomAndScroll', i.zoom ? 'live' : 'off');
    if (i.dragSelect !== undefined) { put('dragMode', i.dragSelect ? 'select' : 'user'); put('selectionMode', i.dragSelect ? 'multiple' : 'none'); }
    if (i.crosshair !== undefined) put('dataCursor', onOff(i.crosshair));
    if (i.highlight !== undefined) put('hoverBehavior', i.highlight ? 'dim' : 'none');
    if (i.seriesToggle !== undefined) put('hideAndShowBehavior', i.seriesToggle ? 'withRescale' : 'none');

    var an = cfg.anim || {};
    if (an.enabled !== undefined) {
      put('animationOnDisplay', an.enabled ? 'auto' : 'none');
      put('animationOnDataChange', an.enabled ? 'auto' : 'none');
    }
    put('styleDefaults.animationDuration', an.duration);
    return o;
  }

  // Field changes for one series / one item, as { jetField: value }.
  function seriesFields(c) {
    var f = {};
    if (!c) return f;
    ['color', 'lineWidth', 'lineStyle', 'lineType', 'markerShape', 'markerSize', 'markerColor',
      'borderColor', 'borderWidth', 'areaColor'].forEach(function (k) { if (c[k] !== undefined) f[k] = c[k]; });
    if (c.marker !== undefined) f.markerDisplayed = onOff(c.marker);
    if (c.y2 !== undefined) f.assignedToY2 = onOff(c.y2);
    if (c.seriesType !== undefined) f.type = c.seriesType;
    if (c.visible !== undefined) f.visibility = c.visible ? 'visible' : 'hidden';
    return f;
  }
  function itemFields(c, labels) {
    var f = {};
    if (labels && labels.visible !== undefined) f.labelPosition = labels.visible ? (labels.position || 'auto') : 'none';
    if (!c) return f;
    ['color', 'borderColor', 'borderWidth', 'markerSize'].forEach(function (k) { if (c[k] !== undefined) f[k] = c[k]; });
    if (c.marker !== undefined) f.markerDisplayed = onOff(c.marker);
    if (c.label !== undefined) f.labelPosition = c.label ? ((labels && labels.position) || 'auto') : 'none';
    return f;
  }

  // Put back fields changed earlier, then apply the new ones, remembering originals.
  function patch(obj, key, fields, s) {
    var saved = s.items[key];
    if (saved) {
      for (var k in saved) { if (saved[k] === undefined) delete obj[k]; else obj[k] = saved[k]; }
      delete s.items[key];
    }
    var any = false, keep = {};
    for (var f in fields) { keep[f] = obj[f]; obj[f] = fields[f]; any = true; }
    if (any) s.items[key] = keep;
  }

  function applySeries(cfg, w, s) {
    var cur = get(w, 'series');
    if (!Array.isArray(cur)) return;
    var next = JSON.parse(JSON.stringify(cur)), ser = (cfg && cfg.series) || {}, pts = (cfg && cfg.points) || {};
    var labels = cfg && cfg.labels;
    next.forEach(function (sr, si) {
      var sid = sr.id !== undefined ? String(sr.id) : String(si);
      patch(sr, sid, cfg ? seriesFields(ser[sid]) : {}, s);
      (sr.items || []).forEach(function (it, ii) {
        if (!it || typeof it !== 'object') return;
        var key = sid + '|' + (it.id !== undefined ? it.id : ii);
        patch(it, key, cfg ? itemFields(pts[key], labels) : {}, s);
      });
    });
    if (!same(next, cur)) w.ojChart('option', 'series', next);
  }

  function parentOf(p) { var i = p.lastIndexOf('.'); return i < 0 ? null : p.slice(0, i); }
  function depth(p) { return p.split('.').length; }
  function empty(v) { return v === undefined || v === null; }

  // Restore removed settings, then set the wanted ones.
  // An option that started empty cannot be set back to null (JET crashes), so its parent object,
  // copied before the first change, is set again instead; JET then drops the key. A top-level
  // option that started empty gets its JET default, or goes into stale when it has none.
  function applyGlobals(want, w, s) {
    var stale = [], parents = {};
    Object.keys(s.orig).forEach(function (p) {
      if (p in want) return;
      var o = s.orig[p];
      delete s.orig[p];
      if (!empty(o)) { if (!same(get(w, p), o)) w.ojChart('option', p, o); return; }
      var pp = parentOf(p);
      if (pp && s.par[pp]) parents[pp] = true;
      else if (p in TOP_DEFAULTS) w.ojChart('option', p, TOP_DEFAULTS[p]);
      else stale.push(p);
    });
    Object.keys(parents).sort(function (a, b) { return depth(a) - depth(b); }).forEach(function (pp) {
      w.ojChart('option', pp, JSON.parse(JSON.stringify(s.par[pp])));
    });
    Object.keys(s.par).forEach(function (pp) {
      var used = Object.keys(s.orig).some(function (p) { return parentOf(p) === pp && empty(s.orig[p]); });
      if (!used) delete s.par[pp];
    });
    Object.keys(want).forEach(function (p) {
      var now = get(w, p);
      if (!(p in s.orig)) {
        s.orig[p] = now;
        var pp = parentOf(p);
        if (empty(now) && pp && !s.par[pp]) {
          var pv = get(w, pp);
          if (pv && typeof pv === 'object') s.par[pp] = JSON.parse(JSON.stringify(pv));
          else if (empty(pv)) s.par[pp] = {};   // parent did not exist yet: setting {} clears it
        }
      }
      if (!same(now, want[p])) w.ojChart('option', p, want[p]);
    });
    return stale;
  }

  function apply(cfg, data, w) {
    var s = st(w);
    var stale = applyGlobals(globalOptions(cfg || {}), w, s);
    applySeries(cfg || {}, w, s);
    return JSON.parse(JSON.stringify({ stale: stale }));
  }

  // After an APEX refresh the series are new: forget item originals, then re-apply.
  function update(cfg, data, w) {
    st(w).items = {};
    return apply(cfg, data, w);
  }

  function destroy(w) {
    var s = state.get(w[0]);
    if (!s) return { stale: [] };
    var stale = applyGlobals({}, w, s);
    applySeries(null, w, s);
    state.delete(w[0]);
    return { stale: stale };
  }

  function capabilities() {
    var S = VD.chart.schema, types = [], props = new Set();
    for (var t in S.TYPES) if (S.TYPES[t].indexOf('jet') >= 0 && TYPE_MAP[t]) types.push(t);
    S.PROPS.forEach(function (p) { if (p.engines.indexOf('jet') >= 0) props.add(p.section + '.' + p.key); });
    return { types: types, props: props };
  }

  function exportImage() { return Promise.reject(new Error('Export is not available for Oracle JET charts yet')); }

  VD.chart.adapters.jet = { capabilities: capabilities, validate: function (c) { return VD.chart.schema.validate(c, 'jet'); },
    apply: apply, update: update, destroy: destroy, export: exportImage };
})();
