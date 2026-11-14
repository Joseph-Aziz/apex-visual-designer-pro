/* APEX Visual Designer — Chart Designer property table and validation.
   One row per property: { key, section, type, rule, def, engines, label, level, css }.
   A chart configuration stores only values the developer changed; defaults live here only.
   validate(config, engine) returns the values an engine may apply; it never changes config. */
(function () {
  var VD = window.VD = window.VD || {};
  VD.chart = VD.chart || {};
  VD.chart.adapters = VD.chart.adapters || {};

  var VERSION = 1;
  var BOTH = ['jet', 'echarts'], EC = ['echarts'];
  var STYLES = ['solid', 'dashed', 'dotted'];
  var SHAPES = ['auto', 'circle', 'square', 'diamond', 'triangleUp', 'triangleDown', 'plus', 'human', 'star'];

  var TYPES = { column: BOTH, bar: BOTH, stackedBar: BOTH, stacked100: EC, line: BOTH, smoothLine: BOTH,
    stepLine: BOTH, area: BOTH, stackedArea: BOTH, pie: BOTH, donut: BOTH, scatter: BOTH, bubble: BOTH,
    radar: BOTH, polar: BOTH, combo: BOTH, funnel: BOTH, gauge: EC, waterfall: EC, heatmap: EC };

  var PROPS = [];
  function P(section, key, type, rule, def, engines, label, level, extra) {
    var p = { key: key, section: section, type: type, rule: rule || {}, def: def, engines: engines,
      label: label, level: level || 'basic' };
    for (var k in extra || {}) p[k] = extra[k];
    PROPS.push(p);
  }
  function E(values) { return { values: values }; }
  function N(min, max, step) { return { min: min, max: max, step: step || 1 }; }

  // Chart as a whole. css:true = drawn by region CSS (codegen), the same for both engines.
  P('global', 'background', 'color', null, null, BOTH, 'Background', 'basic', { css: true });
  P('global', 'border', 'color', null, null, BOTH, 'Border colour', 'basic', { css: true });
  P('global', 'borderWidth', 'px', N(0, 10), 0, BOTH, 'Border width', 'advanced', { css: true });
  P('global', 'radius', 'px', N(0, 40), 0, BOTH, 'Corner radius', 'basic', { css: true });
  P('global', 'padding', 'px', N(0, 60), 0, BOTH, 'Padding', 'advanced', { css: true });
  P('global', 'fontFamily', 'text', { max: 120 }, null, BOTH, 'Font family', 'advanced', { css: true });
  P('global', 'palette', 'list', { item: 'color', max: 24 }, null, BOTH, 'Series colours', 'basic');
  P('global', 'plotBackground', 'color', null, null, BOTH, 'Plot area background', 'basic');
  P('global', 'barGap', 'number', N(0, 1, 0.05), null, BOTH, 'Gap between bar groups', 'advanced');
  P('global', 'maxBarWidth', 'px', N(1, 200), null, BOTH, 'Maximum bar width', 'advanced');
  P('global', 'seriesEffect', 'enum', E(['color', 'gradient', 'pattern']), 'color', BOTH, 'Fill effect', 'advanced');
  P('global', 'barRadius', 'px', N(0, 40), 0, EC, 'Rounded bar corners', 'advanced');
  P('global', 'smooth', 'bool', null, false, EC, 'Smooth lines', 'advanced');

  // One series, keyed by APEX series id.
  P('series', 'color', 'color', null, null, BOTH, 'Colour');
  P('series', 'lineWidth', 'px', N(0, 20), 2, BOTH, 'Line width');
  P('series', 'lineStyle', 'enum', E(STYLES), 'solid', BOTH, 'Line style');
  P('series', 'lineType', 'enum', E(['straight', 'curved', 'stepped', 'segmented', 'centeredStepped', 'centeredSegmented']), 'straight', BOTH, 'Line shape', 'advanced');
  P('series', 'marker', 'bool', null, null, BOTH, 'Show markers');
  P('series', 'markerShape', 'enum', E(SHAPES), 'auto', BOTH, 'Marker shape', 'advanced');
  P('series', 'markerSize', 'px', N(2, 40), 8, BOTH, 'Marker size', 'advanced');
  P('series', 'markerColor', 'color', null, null, BOTH, 'Marker colour', 'advanced');
  P('series', 'borderColor', 'color', null, null, BOTH, 'Border colour', 'advanced');
  P('series', 'borderWidth', 'px', N(0, 10), 0, BOTH, 'Border width', 'advanced');
  P('series', 'areaColor', 'color', null, null, BOTH, 'Area colour', 'advanced');
  P('series', 'y2', 'bool', null, false, BOTH, 'Use secondary Y axis', 'advanced');
  P('series', 'seriesType', 'enum', E(['bar', 'line', 'area', 'lineWithArea', 'auto']), 'auto', BOTH, 'Drawn as (combo)', 'advanced');
  P('series', 'visible', 'bool', null, true, BOTH, 'Visible');
  P('series', 'shadow', 'px', N(0, 40), 0, EC, 'Line shadow', 'advanced');
  P('series', 'cap', 'enum', E(['butt', 'round', 'square']), 'butt', EC, 'Line caps', 'advanced');
  P('series', 'join', 'enum', E(['bevel', 'round', 'miter']), 'bevel', EC, 'Line joins', 'advanced');
  P('series', 'gradientStroke', 'bool', null, false, EC, 'Gradient line', 'advanced');

  // One data point, keyed "<seriesId>|<itemId>".
  P('points', 'color', 'color', null, null, BOTH, 'Colour');
  P('points', 'borderColor', 'color', null, null, BOTH, 'Border colour', 'advanced');
  P('points', 'borderWidth', 'px', N(0, 10), 0, BOTH, 'Border width', 'advanced');
  P('points', 'markerSize', 'px', N(2, 40), 8, BOTH, 'Marker size', 'advanced');
  P('points', 'marker', 'bool', null, null, BOTH, 'Show marker', 'advanced');
  P('points', 'label', 'bool', null, null, BOTH, 'Show value label');

  // Axes x, y, y2 share one set of properties.
  P('axis', 'visible', 'bool', null, true, BOTH, 'Visible');
  P('axis', 'title', 'text', { max: 200 }, '', BOTH, 'Title');
  P('axis', 'titleColor', 'color', null, null, BOTH, 'Title colour', 'advanced');
  P('axis', 'titleSize', 'px', N(8, 40), 12, BOTH, 'Title size', 'advanced');
  P('axis', 'min', 'number', N(-1e15, 1e15, 'any'), null, BOTH, 'Minimum');
  P('axis', 'max', 'number', N(-1e15, 1e15, 'any'), null, BOTH, 'Maximum');
  P('axis', 'step', 'number', N(0, 1e15, 'any'), null, BOTH, 'Step', 'advanced');
  P('axis', 'scale', 'enum', E(['linear', 'log']), 'linear', BOTH, 'Scale', 'advanced');
  P('axis', 'baseline', 'enum', E(['zero', 'min']), 'zero', BOTH, 'Start at', 'advanced');
  P('axis', 'labelVisible', 'bool', null, true, BOTH, 'Show labels');
  P('axis', 'labelColor', 'color', null, null, BOTH, 'Label colour');
  P('axis', 'labelSize', 'px', N(8, 40), 12, BOTH, 'Label size');
  P('axis', 'rotation', 'enum', E(['auto', 'none']), 'auto', BOTH, 'Rotate labels when crowded', 'advanced');
  P('axis', 'grid', 'bool', null, true, BOTH, 'Grid lines');
  P('axis', 'gridColor', 'color', null, null, BOTH, 'Grid colour');
  P('axis', 'gridStyle', 'enum', E(STYLES), 'solid', BOTH, 'Grid style');
  P('axis', 'minorGrid', 'bool', null, false, BOTH, 'Minor grid lines', 'advanced');
  P('axis', 'axisLine', 'bool', null, true, BOTH, 'Axis line', 'advanced');
  P('axis', 'axisLineColor', 'color', null, null, BOTH, 'Axis line colour', 'advanced');

  P('labels', 'visible', 'bool', null, false, BOTH, 'Show values');
  P('labels', 'position', 'enum', E(['auto', 'center', 'insideBarEdge', 'outsideBarEdge', 'aboveMarker', 'belowMarker']), 'auto', BOTH, 'Position');
  P('labels', 'color', 'color', null, null, BOTH, 'Colour');
  P('labels', 'size', 'px', N(8, 40), 11, BOTH, 'Size');
  P('labels', 'decimals', 'number', N(0, 10), null, EC, 'Decimals', 'advanced');
  P('labels', 'prefix', 'text', { max: 20 }, '', EC, 'Prefix', 'advanced');
  P('labels', 'suffix', 'text', { max: 20 }, '', EC, 'Suffix', 'advanced');

  P('legend', 'visible', 'bool', null, true, BOTH, 'Visible');
  P('legend', 'position', 'enum', E(['auto', 'top', 'bottom', 'start', 'end']), 'auto', BOTH, 'Position');
  P('legend', 'color', 'color', null, null, BOTH, 'Text colour');
  P('legend', 'size', 'px', N(8, 40), 12, BOTH, 'Text size');
  P('legend', 'symbolSize', 'px', N(4, 40), null, BOTH, 'Symbol size', 'advanced');

  // JET tooltip styling is not verified on APEX 26.2 yet: ECharts only until a live test passes.
  P('tooltip', 'visible', 'bool', null, true, EC, 'Visible');
  P('tooltip', 'shared', 'bool', null, false, EC, 'One box for all series');
  P('tooltip', 'background', 'color', null, null, EC, 'Background');
  P('tooltip', 'color', 'color', null, null, EC, 'Text colour');
  P('tooltip', 'size', 'px', N(8, 40), 12, EC, 'Text size');

  P('interact', 'zoom', 'bool', null, false, BOTH, 'Zoom and scroll');
  P('interact', 'wheelZoom', 'bool', null, false, EC, 'Mouse wheel zoom');
  P('interact', 'dragSelect', 'bool', null, false, BOTH, 'Drag to select', 'advanced');
  P('interact', 'crosshair', 'bool', null, false, BOTH, 'Crosshair');
  P('interact', 'highlight', 'bool', null, false, BOTH, 'Dim other series on hover');
  P('interact', 'seriesToggle', 'bool', null, false, BOTH, 'Legend click hides series');
  P('interact', 'clickEvent', 'bool', null, false, BOTH, 'Raise vdchartclick event', 'advanced');

  P('anim', 'enabled', 'bool', null, true, BOTH, 'Animate');
  P('anim', 'duration', 'number', N(0, 10000, 50), null, BOTH, 'Duration (ms)');
  P('anim', 'easing', 'enum', E(['linear', 'cubicOut', 'elasticOut', 'bounceOut']), 'cubicOut', EC, 'Easing', 'advanced');
  P('anim', 'delay', 'number', N(0, 10000, 50), 0, EC, 'Delay (ms)', 'advanced');

  // Reference lines and zones: one entry per item in config.refs.
  P('refs', 'axis', 'enum', E(['x', 'y', 'y2']), 'y', BOTH, 'Axis');
  P('refs', 'kind', 'enum', E(['line', 'zone']), 'line', BOTH, 'Kind');
  P('refs', 'value', 'number', N(-1e15, 1e15, 'any'), null, BOTH, 'Value');
  P('refs', 'low', 'number', N(-1e15, 1e15, 'any'), null, BOTH, 'From');
  P('refs', 'high', 'number', N(-1e15, 1e15, 'any'), null, BOTH, 'To');
  P('refs', 'color', 'color', null, null, BOTH, 'Colour');
  P('refs', 'style', 'enum', E(STYLES), 'solid', BOTH, 'Line style');
  P('refs', 'width', 'px', N(1, 10), 1, BOTH, 'Line width');
  P('refs', 'label', 'text', { max: 60 }, '', BOTH, 'Label');

  var INDEX = {};
  PROPS.forEach(function (p) { INDEX[p.section + '.' + p.key] = p; });
  function find(section, key) { return INDEX[section + '.' + key] || null; }

  function defaults(section) {
    var o = {};
    PROPS.forEach(function (p) { if (p.section === section && p.def !== null && p.def !== undefined) o[p.key] = p.def; });
    return o;
  }

  var COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)|transparent)$/i;
  function checkValue(p, v) {
    switch (p.type) {
      case 'color': return typeof v === 'string' && COLOR.test(v);
      case 'bool': return typeof v === 'boolean';
      case 'enum': return p.rule.values.indexOf(v) >= 0;
      case 'text': return typeof v === 'string' && v.length <= p.rule.max;
      case 'list': return Array.isArray(v) && v.length <= p.rule.max &&
        v.every(function (x) { return typeof x === 'string' && COLOR.test(x); });
      default: // number, px, percent
        return typeof v === 'number' && isFinite(v) &&
          (p.rule.min === undefined || v >= p.rule.min) && (p.rule.max === undefined || v <= p.rule.max);
    }
  }

  function cleanBag(section, bag, path, engine, errors) {
    var out = {}, any = false;
    if (!bag || typeof bag !== 'object') return null;
    Object.keys(bag).forEach(function (k) {
      var p = find(section, k);
      if (!p) return; // unknown: kept in the stored config, ignored here
      if (!checkValue(p, bag[k])) { errors.push({ path: path + '.' + k, code: 'value', message: p.label + ': invalid value' }); return; }
      if (engine && p.engines.indexOf(engine) < 0) { errors.push({ path: path + '.' + k, code: 'engine', message: p.label + ': not supported by ' + engineName(engine) }); return; }
      out[k] = bag[k]; any = true;
    });
    return any ? out : null;
  }
  function engineName(e) { return e === 'jet' ? 'Oracle JET — switch to ECharts' : 'ECharts — switch to Oracle JET'; }

  function cleanMap(section, map, path, engine, errors) {
    var out = {}, any = false;
    if (!map || typeof map !== 'object') return null;
    Object.keys(map).forEach(function (id) {
      if (id.length > 200) return;
      var b = cleanBag(section, map[id], path + '.' + id, engine, errors);
      out[id] = b || {}; any = true; // keep the id even when every value was dropped
    });
    return any ? out : null;
  }

  function validate(config, engine) {
    var errors = [], clean = {};
    config = config || {};
    if (config.version > VERSION) {
      return { ok: false, clean: null, errors: [{ path: 'version', code: 'version',
        message: 'Saved with a newer Visual Designer (version ' + config.version + ')' }] };
    }
    engine = engine || config.engine || 'jet';
    clean.version = VERSION;
    clean.engine = engine;
    if (config.type !== undefined) {
      if (!TYPES[config.type]) errors.push({ path: 'type', code: 'value', message: 'Unknown chart type' });
      else if (TYPES[config.type].indexOf(engine) < 0) errors.push({ path: 'type', code: 'engine', message: 'Chart type not supported by ' + engineName(engine) });
      else clean.type = config.type;
    }
    ['global', 'labels', 'legend', 'tooltip', 'interact', 'anim'].forEach(function (s) {
      var b = cleanBag(s, config[s], s, engine, errors);
      if (b) clean[s] = b;
    });
    var ser = cleanMap('series', config.series, 'series', engine, errors);
    if (ser) clean.series = ser;
    var pts = cleanMap('points', config.points, 'points', engine, errors);
    if (pts) clean.points = pts;
    if (config.axes && typeof config.axes === 'object') {
      var ax = {}, anyAx = false;
      ['x', 'y', 'y2'].forEach(function (a) {
        var b = cleanBag('axis', config.axes[a], 'axes.' + a, engine, errors);
        if (b) { ax[a] = b; anyAx = true; }
      });
      if (anyAx) clean.axes = ax;
    }
    if (Array.isArray(config.refs)) {
      var refs = [];
      config.refs.forEach(function (r, i) {
        var n = errors.length, b = cleanBag('refs', r, 'refs.' + i, engine, errors);
        if (!b || errors.length > n) return;
        var kind = b.kind || 'line';
        if (kind === 'line' && typeof b.value !== 'number') { errors.push({ path: 'refs.' + i + '.value', code: 'value', message: 'Reference line needs a value' }); return; }
        if (kind === 'zone' && (typeof b.low !== 'number' || typeof b.high !== 'number')) { errors.push({ path: 'refs.' + i, code: 'value', message: 'Zone needs from and to' }); return; }
        refs.push(b);
      });
      if (refs.length) clean.refs = refs;
    }
    return { ok: errors.length === 0, errors: errors, clean: clean };
  }

  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  // reset(config, 'series.series-1.color') removes the key and any parent left empty.
  function reset(config, path) {
    var out = copy(config), parts = path.split('.'), chain = [out], node = out, i;
    // series and point ids may contain dots? APEX ids do not; keys are split on dots.
    for (i = 0; i < parts.length - 1; i++) {
      node = node && node[parts[i]];
      if (!node || typeof node !== 'object') return out;
      chain.push(node);
    }
    delete node[parts[parts.length - 1]];
    for (i = chain.length - 1; i > 0; i--) {
      var c = chain[i];
      if ((Array.isArray(c) ? c.length : Object.keys(c).length) === 0) delete chain[i - 1][parts[i - 1]];
      else break;
    }
    return out;
  }

  function resetAll(config) {
    var out = { version: VERSION, engine: (config && config.engine) || 'jet' };
    if (config && config.type) out.type = config.type;
    return copy(out);
  }

  VD.chart.schema = { VERSION: VERSION, PROPS: PROPS, TYPES: TYPES, find: find, defaults: defaults,
    validate: validate, reset: reset, resetAll: resetAll };
})();
