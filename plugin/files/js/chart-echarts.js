/* APEX Visual Designer — ECharts adapter for the Chart Designer.
   Draws the native APEX chart's data with Apache ECharts in a host div placed right after the JET
   chart, which stays in the page (hidden by a class) so APEX refresh keeps feeding it data.
   One ECharts instance per region. Data problems throw before anything on the page changes, so the
   runtime can log them and leave the APEX chart as APEX drew it. */
(function () {
  var VD = window.VD = window.VD || {};
  var C = VD.chart = VD.chart || {};
  C.adapters = C.adapters || {};

  var HIDDEN = 'vd-echarts-hidden', HOST = 'vd-echarts';
  var state = new WeakMap();   // JET element -> { host, inst, ro, option, map, data, cfg }
  var loader = null;           // { url, queue, script }
  var styled = false;

  function warn(m) { if (typeof console !== 'undefined') console.warn('Visual Designer chart: ' + m); }
  function doc() { return window.document; }
  function num(v) { return typeof v === 'number' && isFinite(v); }
  function has(o) { for (var k in o) return true; return false; }

  // ---- data checks and type builders -------------------------------------------------------

  var CARTESIAN = { column: 1, bar: 1, stackedBar: 1, stacked100: 1, line: 1, smoothLine: 1, stepLine: 1,
    area: 1, stackedArea: 1, combo: 1, polar: 1 };
  var JET_TYPES = { bar: 'column', line: 'line', area: 'area', lineWithArea: 'area', pie: 'pie',
    scatter: 'scatter', bubble: 'bubble', funnel: 'funnel', combo: 'combo' };
  var SYMBOL = { circle: 'circle', square: 'rect', diamond: 'diamond', triangleUp: 'triangle' };
  var LABEL_POS = { center: 'inside', aboveMarker: 'top', belowMarker: 'bottom' };

  function chartType(cfg, data) { return cfg.type || JET_TYPES[data.type] || 'column'; }

  function checkAligned(data) {
    data.series.forEach(function (s) {
      if ((s.items || []).length !== data.groups.length) {
        throw new Error('Series "' + s.name + '" has ' + (s.items || []).length + ' values but there are ' +
          data.groups.length + ' groups');
      }
    });
  }
  function value(it) { return it && typeof it === 'object' ? it.value : it; }

  function formatter(lb) {
    if (lb.decimals == null && !lb.prefix && !lb.suffix) return undefined;
    return function (p) {
      var v = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
      if (num(v) && lb.decimals != null) v = v.toFixed(lb.decimals);
      return (lb.prefix || '') + v + (lb.suffix || '');
    };
  }

  function seriesLabel(cfg, horizontal) {
    var lb = cfg.labels || {};
    if (!has(lb)) return null;
    var l = { show: !!lb.visible };
    var pos = lb.position === 'insideBarEdge' ? (horizontal ? 'insideRight' : 'insideTop')
      : lb.position === 'outsideBarEdge' ? (horizontal ? 'right' : 'top') : LABEL_POS[lb.position];
    if (pos) l.position = pos;
    if (lb.color) l.color = lb.color;
    if (lb.size) l.fontSize = lb.size;
    var f = formatter(lb);
    if (f) l.formatter = f;
    return l;
  }

  // Per-point overrides, keyed "<seriesId>|<itemId>".
  function point(cfg, s, it, v) {
    var p = (cfg.points || {})[s.id + '|' + it.id];
    if (!p) return v;
    var d = { value: v }, is = {};
    if (p.color) is.color = p.color;
    if (p.borderColor) is.borderColor = p.borderColor;
    if (p.borderWidth != null) is.borderWidth = p.borderWidth;
    if (has(is)) d.itemStyle = is;
    if (p.markerSize) d.symbolSize = p.markerSize;
    if (p.marker === false) d.symbol = 'none';
    if (p.label != null) d.label = { show: p.label };
    return d;
  }

  // Series settings, keyed by APEX series id.
  function styleSeries(o, ss, cfg, palette, i) {
    var is = {}, ls = {};
    if (ss.color) { is.color = ss.color; ls.color = ss.color; }
    if (ss.markerColor) is.color = ss.markerColor;
    if (ss.borderColor) is.borderColor = ss.borderColor;
    if (ss.borderWidth != null) is.borderWidth = ss.borderWidth;
    if (ss.lineWidth != null) ls.width = ss.lineWidth;
    if (ss.lineStyle) ls.type = ss.lineStyle;
    if (ss.shadow) { ls.shadowBlur = ss.shadow; ls.shadowColor = 'rgba(0,0,0,0.3)'; }
    if (ss.cap) ls.cap = ss.cap;
    if (ss.join) ls.join = ss.join;
    if (ss.gradientStroke) {
      var from = ss.color || palette[i % palette.length], to = palette[(i + 1) % palette.length];
      if (from && to) ls.color = { type: 'linear', x: 0, y: 0, x2: 1, y2: 0, colorStops: [{ offset: 0, color: from }, { offset: 1, color: to }] };
    }
    if (ss.lineType === 'curved') o.smooth = true;
    else if (ss.lineType === 'stepped') o.step = 'end';
    else if (ss.lineType === 'centeredStepped') o.step = 'middle';
    if (ss.marker != null) o.showSymbol = ss.marker;
    if (SYMBOL[ss.markerShape]) o.symbol = SYMBOL[ss.markerShape];
    if (ss.markerSize) o.symbolSize = ss.markerSize;
    if (ss.areaColor) o.areaStyle = { color: ss.areaColor };
    if (ss.y2) o.yAxisIndex = 1;
    if (has(is)) o.itemStyle = is;
    if (has(ls)) o.lineStyle = ls;
  }

  function axis(base, ax, valueAxis) {
    ax = ax || {};
    if (ax.visible === false) base.show = false;
    if (ax.title) { base.name = ax.title; base.nameLocation = 'middle'; base.nameGap = 30; }
    var nts = {};
    if (ax.titleColor) nts.color = ax.titleColor;
    if (ax.titleSize) nts.fontSize = ax.titleSize;
    if (has(nts)) base.nameTextStyle = nts;
    if (valueAxis) {
      if (num(ax.min)) base.min = ax.min;
      if (num(ax.max)) base.max = ax.max;
      if (num(ax.step) && ax.step > 0) base.interval = ax.step;
      if (ax.scale === 'log') base.type = 'log';
      if (ax.baseline === 'min') base.scale = true;
    }
    var al = {};
    if (ax.labelVisible === false) al.show = false;
    if (ax.labelColor) al.color = ax.labelColor;
    if (ax.labelSize) al.fontSize = ax.labelSize;
    if (ax.rotation === 'none') al.rotate = 0;
    if (has(al)) base.axisLabel = al;
    var sl = {};
    if (ax.grid != null) sl.show = ax.grid;
    if (ax.gridColor || ax.gridStyle) sl.lineStyle = { color: ax.gridColor, type: ax.gridStyle };
    if (has(sl)) base.splitLine = sl;
    if (ax.minorGrid) { base.minorTick = { show: true }; base.minorSplitLine = { show: true }; }
    var line = {};
    if (ax.axisLine != null) line.show = ax.axisLine;
    if (ax.axisLineColor) line.lineStyle = { color: ax.axisLineColor };
    if (has(line)) base.axisLine = line;
    return base;
  }

  function refs(cfg, series, horizontal) {
    (cfg.refs || []).forEach(function (r) {
      var y2 = r.axis === 'y2', valueKey = (r.axis === 'x') !== !!horizontal ? 'xAxis' : 'yAxis';
      if (r.axis === 'x') valueKey = horizontal ? 'yAxis' : 'xAxis';
      var target = series.filter(function (s) { return !!s.yAxisIndex === y2; })[0] || series[0];
      if (!target) return;
      var ls = { color: r.color, type: r.style || 'solid', width: r.width || 1 };
      if ((r.kind || 'line') === 'line') {
        var ml = target.markLine = target.markLine || { symbol: 'none', silent: true, data: [] };
        var d = { lineStyle: ls, label: { show: !!r.label, formatter: r.label || '' } };
        d[valueKey] = r.value;
        ml.data.push(d);
      } else {
        var ma = target.markArea = target.markArea || { silent: true, data: [] };
        var a = { itemStyle: { color: r.color, opacity: 0.2 }, label: { show: !!r.label, formatter: r.label || '' } }, b = {};
        a[valueKey] = r.low; b[valueKey] = r.high;
        ma.data.push([a, b]);
      }
    });
  }

  function cartesian(type, cfg, data, out, palette) {
    checkAligned(data);
    var horizontal = type === 'bar';
    var cats = data.groups.map(function (g) { return g.name; });
    var axes = cfg.axes || {}, ser = cfg.series || {};
    var totals = data.groups.map(function (g, j) {
      return data.series.reduce(function (t, s) { var v = value(s.items[j]); return t + (num(v) ? Math.abs(v) : 0); }, 0);
    });
    var label = seriesLabel(cfg, horizontal);
    out.series = data.series.map(function (s, i) {
      var ss = ser[s.id] || {}, kind = type;
      if (type === 'combo') kind = { bar: 'column', line: 'line', area: 'area', lineWithArea: 'area' }[ss.seriesType !== 'auto' && ss.seriesType || s.type] || 'column';
      var o = { id: s.id, name: s.name, type: /line|area|Line|Area/.test(kind) ? 'line' : 'bar' };
      if (/area|Area/.test(kind)) o.areaStyle = {};
      if (kind === 'smoothLine') o.smooth = true;
      if (kind === 'stepLine') o.step = 'end';
      if (/^stacked/.test(kind)) o.stack = 'total';
      if (type === 'polar') o.coordinateSystem = 'polar';
      o.data = s.items.map(function (it, j) {
        var v = value(it);
        if (type === 'stacked100') v = totals[j] ? Math.round(v / totals[j] * 10000) / 100 : 0;
        return point(cfg, s, it || {}, v);
      });
      styleSeries(o, ss, cfg, palette, i);
      if (label) o.label = label;
      out.map.push(i);
      return o;
    });
    if (type === 'polar') {
      out.polar = {};
      out.angleAxis = { type: 'category', data: cats };
      out.radiusAxis = axis({ type: 'value' }, axes.y, true);
      return;
    }
    var catAxis = axis({ type: 'category', data: cats }, axes.x, false);
    var valAxes = [axis({ type: 'value' }, axes.y, true)];
    if (type === 'stacked100') valAxes[0].max = 100;
    if (out.series.some(function (s) { return s.yAxisIndex === 1; })) valAxes.push(axis({ type: 'value' }, axes.y2, true));
    if (horizontal) { out.yAxis = [catAxis]; out.xAxis = valAxes; out.series.forEach(function (s) { if (s.yAxisIndex) { s.xAxisIndex = 1; delete s.yAxisIndex; } }); }
    else { out.xAxis = [catAxis]; out.yAxis = valAxes; }
    refs(cfg, out.series, horizontal);
  }

  function firstOnly(type, data) {
    if (!data.series.length) throw new Error('No series to draw');
    if (data.series.length > 1) warn('a ' + type + ' chart shows one series; using "' + data.series[0].name + '"');
    var s = data.series[0];
    if ((s.items || []).length !== data.groups.length) checkAligned({ series: [s], groups: data.groups });
    return s;
  }

  var BUILD = {
    pie: function (type, cfg, data, out) {
      var s = firstOnly(type, data), ss = (cfg.series || {})[s.id] || {};
      var o = { id: s.id, name: s.name, type: type === 'funnel' ? 'funnel' : 'pie' };
      if (type === 'donut') o.radius = ['40%', '70%'];
      o.data = s.items.map(function (it, j) {
        var d = point(cfg, s, it, value(it));
        if (typeof d !== 'object') d = { value: d };
        return Object.assign({ name: data.groups[j].name }, d);
      });
      styleSeries(o, ss, cfg, [], 0);
      var label = seriesLabel(cfg, false);
      if (label) o.label = label;
      out.series = [o];
      out.map = [0];
    },
    scatter: function (type, cfg, data, out, palette) {
      var bubble = type === 'bubble', axes = cfg.axes || {};
      out.series = data.series.map(function (s, i) {
        var o = { id: s.id, name: s.name, type: 'scatter' };
        o.data = (s.items || []).map(function (it) {
          if (!num(it.x) || !num(it.y) || (bubble && !num(it.z))) {
            throw new Error('Series "' + s.name + '": every point needs numeric x and y' + (bubble ? ' and z' : ''));
          }
          return point(cfg, s, it, bubble ? [it.x, it.y, it.z] : [it.x, it.y]);
        });
        if (bubble) o.symbolSize = function (v) { return Math.max(4, Math.sqrt(Math.abs(v[2])) * 4); };
        styleSeries(o, (cfg.series || {})[s.id] || {}, cfg, palette, i);
        out.map.push(i);
        return o;
      });
      out.xAxis = [axis({ type: 'value' }, axes.x, true)];
      out.yAxis = [axis({ type: 'value' }, axes.y, true)];
      refs(cfg, out.series, false);
    },
    radar: function (type, cfg, data, out) {
      if (data.groups.length < 3) throw new Error('A radar chart needs at least 3 groups');
      checkAligned(data);
      var max = 0;
      data.series.forEach(function (s) { s.items.forEach(function (it) { var v = value(it); if (num(v) && v > max) max = v; }); });
      out.radar = { indicator: data.groups.map(function (g) { return { name: g.name, max: max || 1 }; }) };
      out.series = [{ type: 'radar', data: data.series.map(function (s) {
        var d = { name: s.name, value: s.items.map(value) }, ss = (cfg.series || {})[s.id] || {};
        styleSeries(d, ss, cfg, [], 0);
        return d;
      }) }];
      out.map = [0];
    },
    gauge: function (type, cfg, data, out) {
      var s = data.series[0], v = s && s.items && value(s.items[0]);
      if (!num(v)) throw new Error('A gauge needs a numeric value in the first series');
      var ay = (cfg.axes || {}).y || {}, min = num(ay.min) ? ay.min : 0;
      var max = num(ay.max) ? ay.max : Math.max(100, Math.pow(10, Math.ceil(Math.log(Math.abs(v) || 1) / Math.LN10)));
      out.series = [{ id: s.id, type: 'gauge', min: min, max: max, data: [{ value: v, name: s.name }] }];
      out.map = [0];
    },
    waterfall: function (type, cfg, data, out, palette) {
      if (data.series.length !== 1) throw new Error('A waterfall chart takes exactly one series');
      checkAligned(data);
      var s = data.series[0], run = 0, base = [], change = [];
      s.items.forEach(function (it) {
        var v = value(it);
        if (!num(v)) v = 0;
        base.push(v < 0 ? run + v : run);
        change.push(point(cfg, s, it, Math.abs(v)));
        run += v;
      });
      change = change.map(function (d, j) {
        var o = typeof d === 'object' ? d : { value: d };
        if (!o.itemStyle && value(s.items[j]) < 0) o.itemStyle = { color: palette[1] || '#c62828' };
        return o;
      });
      var axes = cfg.axes || {};
      out.xAxis = [axis({ type: 'category', data: data.groups.map(function (g) { return g.name; }) }, axes.x, false)];
      out.yAxis = [axis({ type: 'value' }, axes.y, true)];
      out.series = [
        { type: 'bar', stack: 'wf', silent: true, data: base, itemStyle: { color: 'transparent' }, tooltip: { show: false } },
        { id: s.id, name: s.name, type: 'bar', stack: 'wf', data: change }
      ];
      styleSeries(out.series[1], (cfg.series || {})[s.id] || {}, cfg, palette, 0);
      var label = seriesLabel(cfg, false);
      if (label) out.series[1].label = label;
      out.map = [-1, 0];
      refs(cfg, [out.series[1]], false);
    },
    heatmap: function (type, cfg, data, out) {
      checkAligned(data);
      var cells = [], lo = Infinity, hi = -Infinity;
      data.series.forEach(function (s, y) {
        s.items.forEach(function (it, x) {
          var v = value(it);
          if (!num(v)) throw new Error('Heatmap values must be numbers (series "' + s.name + '")');
          if (v < lo) lo = v;
          if (v > hi) hi = v;
          cells.push([x, y, v]);
        });
      });
      var axes = cfg.axes || {};
      out.xAxis = [axis({ type: 'category', data: data.groups.map(function (g) { return g.name; }) }, axes.x, false)];
      out.yAxis = [axis({ type: 'category', data: data.series.map(function (s) { return s.name; }) }, axes.y, false)];
      out.visualMap = { min: lo, max: hi, calculable: true, orient: 'horizontal', left: 'center', bottom: 0 };
      if (cfg.global && cfg.global.palette && cfg.global.palette.length > 1) out.visualMap.inRange = { color: cfg.global.palette.slice() };
      var o = { type: 'heatmap', data: cells };
      var label = seriesLabel(cfg, false);
      if (label) o.label = label;
      out.series = [o];
      out.map = [0];
    }
  };
  BUILD.donut = BUILD.funnel = BUILD.pie;
  BUILD.bubble = BUILD.scatter;

  // The whole ECharts option for one chart, or an Error thrown for data it cannot draw.
  function build(cfg, data) {
    data = { type: data && data.type, series: (data && data.series) || [], groups: (data && data.groups) || [] };
    var type = chartType(cfg, data), g = cfg.global || {};
    var palette = g.palette && g.palette.length ? g.palette.slice() : [];
    var out = { map: [] }, opt = { backgroundColor: 'transparent' };
    if (CARTESIAN[type]) cartesian(type, cfg, data, out, palette);
    else if (BUILD[type]) BUILD[type](type, cfg, data, out, palette);
    else throw new Error('Chart type ' + type + ' is not drawn by ECharts');
    ['xAxis', 'yAxis', 'polar', 'angleAxis', 'radiusAxis', 'radar', 'visualMap', 'series'].forEach(function (k) {
      if (out[k]) opt[k] = out[k];
    });

    if (palette.length) opt.color = palette;
    var grid = { containLabel: true, left: 8, right: 8, top: 32, bottom: 8 };
    if (g.plotBackground) { grid.show = true; grid.backgroundColor = g.plotBackground; grid.borderWidth = 0; }
    if (opt.xAxis) opt.grid = grid;
    if (g.fontFamily) opt.textStyle = { fontFamily: g.fontFamily };
    if (opt.series[0] && opt.series[0].type === 'bar') {
      var bars = opt.series.filter(function (s) { return s.type === 'bar'; });
      opt.series.forEach(function (s) {
        if (s.type !== 'bar') return;
        if (num(g.barGap)) s.barCategoryGap = Math.round(g.barGap * 100) + '%';
        if (num(g.maxBarWidth)) s.barMaxWidth = g.maxBarWidth;
        // Round the outer end of each bar; in a stack only the last segment, so the stack looks like one bar.
        if (g.barRadius > 0 && (!s.stack || s === bars[bars.length - 1])) {
          var r = g.barRadius;
          s.itemStyle = Object.assign({}, s.itemStyle || {}, { borderRadius: type === 'bar' ? [0, r, r, 0] : [r, r, 0, 0] });
        }
      });
    }
    if (g.smooth) opt.series.forEach(function (s) { if (s.type === 'line') s.smooth = true; });
    if (g.seriesEffect === 'pattern') opt.aria = { enabled: true, decal: { show: true } };
    if (g.seriesEffect === 'gradient') {
      opt.series.forEach(function (s, i) {
        var c = (s.itemStyle && s.itemStyle.color) || palette[i % (palette.length || 1)];
        if (typeof c !== 'string' || !s.id) return;
        var grad = { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: c }, { offset: 1, color: 'rgba(255,255,255,0.2)' }] };
        if (s.type === 'line') s.areaStyle = Object.assign({}, s.areaStyle || {}, { color: grad });
        else s.itemStyle = Object.assign({}, s.itemStyle || {}, { color: grad });
      });
    }

    var lg = cfg.legend || {}, legend = { type: 'scroll' }, it = cfg.interact || {};
    if (lg.visible === false) legend.show = false;
    if (lg.position === 'top') legend.top = 0;
    else if (lg.position === 'bottom') legend.bottom = 0;
    else if (lg.position === 'start') { legend.left = 0; legend.top = 'middle'; legend.orient = 'vertical'; }
    else if (lg.position === 'end') { legend.right = 0; legend.top = 'middle'; legend.orient = 'vertical'; }
    var lts = {};
    if (lg.color) lts.color = lg.color;
    if (lg.size) lts.fontSize = lg.size;
    if (has(lts)) legend.textStyle = lts;
    if (lg.symbolSize) { legend.itemWidth = lg.symbolSize; legend.itemHeight = lg.symbolSize; }
    legend.selectedMode = !!it.seriesToggle;
    var hidden = {};
    data.series.forEach(function (s) { if (((cfg.series || {})[s.id] || {}).visible === false) hidden[s.name] = false; });
    if (has(hidden)) legend.selected = hidden;
    if (type !== 'gauge') opt.legend = legend;

    var tp = cfg.tooltip || {}, tooltip = { confine: true };
    if (tp.visible === false) tooltip.show = false;
    tooltip.trigger = (tp.shared || it.crosshair) && opt.xAxis && type !== 'scatter' && type !== 'bubble' && type !== 'heatmap' ? 'axis' : 'item';
    if (it.crosshair) tooltip.axisPointer = { type: 'cross' };
    if (tp.background) tooltip.backgroundColor = tp.background;
    var tts = {};
    if (tp.color) tts.color = tp.color;
    if (tp.size) tts.fontSize = tp.size;
    if (has(tts)) tooltip.textStyle = tts;
    opt.tooltip = tooltip;

    if (opt.xAxis && (it.zoom || it.wheelZoom)) {
      var axisKey = type === 'bar' ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
      opt.dataZoom = [];
      if (it.zoom) opt.dataZoom.push(Object.assign({ type: 'slider' }, axisKey));
      opt.dataZoom.push(Object.assign({ type: 'inside', zoomOnMouseWheel: !!it.wheelZoom }, axisKey));
    }
    if (it.dragSelect && opt.xAxis) {
      opt.brush = { xAxisIndex: 'all', brushLink: 'all' };
      opt.toolbox = { feature: { brush: { type: ['lineX', 'clear'] } } };
    }
    if (it.highlight) opt.series.forEach(function (s) { s.emphasis = Object.assign({}, s.emphasis || {}, { focus: 'series' }); });

    var an = cfg.anim || {};
    if (an.enabled === false) opt.animation = false;
    if (num(an.duration)) { opt.animationDuration = an.duration; opt.animationDurationUpdate = an.duration; }
    if (an.easing) opt.animationEasing = an.easing;
    if (num(an.delay)) opt.animationDelay = an.delay;

    return { option: opt, map: out.map, data: data };
  }

  // ---- loading, drawing, events -----------------------------------------------------------

  function withEcharts(fn) {
    if (window.echarts) return fn();
    var url = C.echartsUrl;
    if (!url) { warn('ECharts is not loaded; re-save the page in the Visual Designer'); return; }
    if (loader && loader.url === url) { loader.queue.push(fn); return; }
    var s = doc().createElement('script');
    loader = { url: url, queue: [fn], script: s };
    var mine = loader;
    var done = function () {
      if (loader === mine) loader = null;
      mine.queue.forEach(function (f) { try { f(); } catch (e) { warn(e && e.message ? e.message : e); } });
    };
    var failed = function () {
      if (loader === mine) loader = null;
      warn('could not load ECharts from ' + url + '; the Oracle JET chart stays; re-save the page in the Visual Designer');
    };
    // APEX pages load RequireJS for Oracle JET. ECharts then registers as an AMD module and sets no
    // window.echarts (a plain script tag would also break RequireJS), so it is loaded through require.
    if (typeof window.define === 'function' || (window.define && window.define.amd)) {
      if (typeof window.require === 'function') {
        window.require([url], function (ec) { window.echarts = window.echarts || ec; done(); }, failed);
        return;
      }
    }
    s.onload = done;
    s.onerror = failed;
    s.src = url;
    doc().head.appendChild(s);
  }

  function addHideRule() {
    if (styled) return;
    styled = true;
    var st = doc().createElement('style');
    st.textContent = '.' + HIDDEN + '{display:none!important}.' + HOST + '{width:100%}';
    doc().head.appendChild(st);
  }

  function regionOf(el) {
    var id = (el.id || '').replace(/_jet$/, '');
    return { id: id, el: (id && doc().getElementById(id)) || el };
  }

  function bindClick(s, el) {
    s.inst.off('click');
    if (!(s.cfg.interact && s.cfg.interact.clickEvent)) return;
    s.inst.on('click', function (p) {
      var si = s.map[p.seriesIndex], ser = s.data.series[si];
      if (si == null || si < 0 || !ser) return;
      var j = p.dataIndex, it = (ser.items || [])[j] || {}, g = s.data.groups[j] || {};
      var r = regionOf(el), v = Array.isArray(p.value) ? p.value[p.value.length - 1] : p.value;
      window.apex.event.trigger(r.el, 'vdchartclick', {
        regionId: r.id, series: ser.id, group: g.id != null ? g.id : g.name, value: v, point: it.id
      });
    });
  }

  function draw(el, cfg, built) {
    var s = state.get(el);
    if (!s) {
      addHideRule();
      var host = doc().createElement('div');
      host.classList.add(HOST);
      host.style.height = (el.offsetHeight || 400) + 'px';
      el.parentNode.insertBefore(host, el.nextSibling);
      el.classList.add(HIDDEN);
      var inst = window.echarts.getInstanceByDom(host) || window.echarts.init(host, null, { renderer: 'canvas' });
      s = { host: host, inst: inst, ro: null };
      if (window.ResizeObserver) {
        s.ro = new window.ResizeObserver(function () { s.inst.resize(); });
        s.ro.observe(host);
      }
      state.set(el, s);
    }
    s.cfg = cfg; s.map = built.map; s.data = built.data; s.option = built.option;
    s.inst.setOption(built.option, { notMerge: true });
    bindClick(s, el);
  }

  function apply(cfg, data, w) {
    var el = w[0];
    var built = build(cfg || {}, data);   // throws before the page changes
    withEcharts(function () { draw(el, cfg || {}, built); });
  }

  function destroy(w) {
    var el = w[0], s = state.get(el);
    if (!s) return;
    if (s.ro) s.ro.disconnect();
    s.inst.dispose();
    if (s.host.parentNode) s.host.parentNode.removeChild(s.host);
    el.classList.remove(HIDDEN);
    state.delete(el);
  }

  function toBlob(dataUrl) {
    var parts = dataUrl.split(','), mime = parts[0].replace(/^data:|;base64$/g, '');
    var bin = atob(parts[1]), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function exportImage(w, format) {
    var s = state.get(w[0]);
    if (format !== 'png' && format !== 'svg') return Promise.reject(new Error('Export format ' + format + ' is not supported (png or svg)'));
    if (!s) return Promise.reject(new Error('Chart is not drawn by ECharts'));
    try {
      if (format === 'png') return Promise.resolve(toBlob(s.inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' })));
      // The page chart uses canvas; draw a throw-away SVG copy for vector export.
      var tmp = doc().createElement('div');
      var svg = window.echarts.init(tmp, null, { renderer: 'svg', ssr: true,
        width: s.host.offsetWidth || 800, height: s.host.offsetHeight || 400 });
      svg.setOption(Object.assign({}, s.option, { animation: false }));
      var text = svg.renderToSVGString();
      svg.dispose();
      return Promise.resolve(new Blob([text], { type: 'image/svg+xml' }));
    } catch (e) { return Promise.reject(e); }
  }

  function capabilities() {
    var S = C.schema, types = [], props = new Set();
    for (var t in S.TYPES) if (S.TYPES[t].indexOf('echarts') >= 0 && (CARTESIAN[t] || BUILD[t])) types.push(t);
    S.PROPS.forEach(function (p) { if (p.engines.indexOf('echarts') >= 0) props.add(p.section + '.' + p.key); });
    return { types: types, props: props };
  }

  C.adapters.echarts = {
    capabilities: capabilities,
    validate: function (c) { return C.schema.validate(c, 'echarts'); },
    apply: apply, update: apply, destroy: destroy, export: exportImage
  };
})();
