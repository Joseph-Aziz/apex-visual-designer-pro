/* APEX Visual Designer — Chart Designer panel: the property tree, the fields of one node and
   the edits on a chart configuration. Pure functions plus markup; flutter-mode.js owns the
   state, the preview and saving. Every property comes from VD.chart.schema.PROPS. */
(function () {
  window.VD = window.VD || {};
  var S = function () { return window.VD.chart.schema; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  var NO_AXES = { pie: 1, donut: 1, funnel: 1, gauge: 1 };
  var TABS = [['all', 'All'], ['global', 'Global'], ['series', 'Series'], ['axis', 'Axis'], ['labels', 'Labels'],
    ['interactions', 'Interactions'], ['advanced', 'Advanced']];
  var TAB_OF = { chart: 'global', legend: 'global', tooltip: 'global', series: 'series', points: 'series',
    axis: 'axis', refs: 'axis', labels: 'labels', interact: 'interactions', anim: 'interactions' };
  var TITLES = { chart: 'Chart', points: 'Points', labels: 'Labels', legend: 'Legend', tooltip: 'Tooltip',
    refs: 'Reference lines', interact: 'Interactions', anim: 'Animation' };
  var SECTION = { chart: 'global', series: 'series', points: 'points', axis: 'axis', labels: 'labels', legend: 'legend',
    tooltip: 'tooltip', refs: 'refs', interact: 'interact', anim: 'anim' };
  var WIDTHS = { desktop: '100%', tablet: '768px', mobile: '375px' };

  // Ready-made looks after the TailAdmin dashboard's charts. Picking one replaces the chart's settings.
  var AXIS_X = { grid: false, axisLine: false, labelColor: '#6B7280', labelSize: 12 };
  var TEMPLATES = [
    { id: 'monthlySales', label: 'Monthly sales', chart: { version: 1, engine: 'echarts', type: 'column',
      global: { palette: ['#465FFF'], barRadius: 5, maxBarWidth: 40, barGap: 0.5, fontFamily: 'Outfit, sans-serif' },
      axes: { x: { grid: false, axisLine: false, labelColor: '#364153', labelSize: 12 }, y: { labelVisible: false, gridColor: '#F3F4F6', axisLine: false } },
      legend: { visible: false }, tooltip: { background: '#ffffff', color: '#1D2939' } } },
    { id: 'statistics', label: 'Statistics', chart: { version: 1, engine: 'echarts', type: 'area',
      global: { palette: ['#465FFF', '#9CB9FF'], seriesEffect: 'gradient', smooth: true, fontFamily: 'Outfit, sans-serif' },
      axes: { x: AXIS_X, y: { gridColor: '#F3F4F6', axisLine: false, labelColor: '#6B7280', labelSize: 12 } },
      legend: { position: 'top' }, tooltip: { shared: true, background: '#ffffff', color: '#1D2939' } } },
    // After the Tabler dashboard (MIT): blue #066fd1, dashed #e5e5e5 grid, grey #737373 labels.
    { id: 'tablerTraffic', label: 'Tabler: traffic summary', chart: tabler('stackedBar', ['#066fd1', '#5a9fdf', '#27a560'],
      { barRadius: 4, barGap: 0.4, maxBarWidth: 32 }, true, { position: 'bottom', color: '#737373' }) },
    { id: 'tablerActivity', label: 'Tabler: development activity', chart: tabler('area', ['#066fd1'],
      { seriesEffect: 'gradient', smooth: true }, false, { visible: false }) },
    { id: 'tablerVisitors', label: 'Tabler: visitors', chart: tabler('line', ['#066fd1', '#a3a3a3'],
      { smooth: true }, true, { position: 'bottom', color: '#737373' }) }
  ];
  function tabler(type, palette, global, labels, legend) {
    var axis = function (grid) {
      return { grid: grid, gridColor: '#e5e5e5', gridStyle: 'dashed', axisLine: false, labelVisible: labels, labelColor: '#737373', labelSize: 12 };
    };
    global.palette = palette;
    return { version: 1, engine: 'echarts', type: type, global: global, axes: { x: axis(false), y: axis(true) },
      legend: legend, tooltip: { shared: true, background: '#ffffff', color: '#1d273b' } };
  }
  // A fresh copy of one template's configuration, or null.
  function template(id) {
    var t = TEMPLATES.filter(function (x) { return x.id === id; })[0];
    return t ? copy(t.chart) : null;
  }

  function kindOf(id) { return id.split(':')[0]; }

  // Tree nodes for a chart type and its series; a tab other than all/advanced keeps its own nodes.
  function nodes(type, series, tab) {
    var list = [{ id: 'chart', label: 'Chart' }];
    (series || []).forEach(function (s, i) {
      var sid = s.id !== undefined ? String(s.id) : String(i);
      list.push({ id: 'series:' + sid, label: s.name || sid });
    });
    list.push({ id: 'points', label: 'Points' });
    if (!NO_AXES[type]) list.push({ id: 'axis:x', label: 'X axis' }, { id: 'axis:y', label: 'Y axis' }, { id: 'axis:y2', label: 'Y2 axis' });
    ['labels', 'legend', 'tooltip', 'refs', 'interact', 'anim'].forEach(function (k) { list.push({ id: k, label: TITLES[k] }); });
    if (!tab || tab === 'all' || tab === 'advanced') return list;
    return list.filter(function (n) { return TAB_OF[kindOf(n.id)] === tab; });
  }

  // Where a node's values live in the configuration.
  function pathOf(id) {
    var k = kindOf(id), rest = id.slice(k.length + 1);
    if (k === 'chart') return 'global';
    if (k === 'series') return 'series.' + rest;
    if (k === 'axis') return 'axes.' + rest;
    return k;
  }

  // Fields of one schema section: [{ prop, disabled }]; Basic shows basic rows only.
  function fields(section, engine, level) {
    return S().PROPS.filter(function (p) {
      return p.section === section && (level === 'advanced' || p.level === 'basic');
    }).map(function (p) {
      return { prop: p, disabled: p.engines.indexOf(engine) < 0
        ? (engine === 'jet' ? 'Not supported by Oracle JET — switch to ECharts.' : 'Not supported by ECharts — switch to Oracle JET.') : '' };
    });
  }

  var COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*[\d.]+%?\s*,\s*[\d.]+%?\s*,\s*[\d.]+%?\s*(,\s*[\d.]+\s*)?\)|transparent)$/i;
  // Raw control text to a stored value: { value } (undefined = default) or { error }.
  function parse(p, raw) {
    raw = String(raw == null ? '' : raw).trim();
    if (raw === '') return { value: undefined };
    var v = raw;
    if (p.type === 'bool') v = raw === 'true';
    else if (p.type === 'number' || p.type === 'px' || p.type === 'percent') v = Number(raw);
    else if (p.type === 'list') v = raw.split(/[\s,]+/).filter(Boolean);
    if (p.type === 'number' || p.type === 'px' || p.type === 'percent') {
      if (!isFinite(v) || (p.rule.min !== undefined && v < p.rule.min) || (p.rule.max !== undefined && v > p.rule.max)) {
        return { error: p.label + ': enter a number' + (p.rule.min !== undefined ? ' from ' + p.rule.min + ' to ' + p.rule.max : '') + '.' };
      }
    }
    if (p.type === 'enum' && p.rule.values.indexOf(v) < 0) return { error: p.label + ': not one of the allowed values.' };
    if (p.type === 'color' && !COLOR.test(v)) return { error: p.label + ': not a colour.' };
    if (p.type === 'list' && (v.length > p.rule.max || !v.every(function (x) { return COLOR.test(x); }))) {
      return { error: p.label + ': enter up to ' + p.rule.max + ' colours separated by commas.' };
    }
    if (p.type === 'text' && v.length > p.rule.max) return { error: p.label + ': at most ' + p.rule.max + ' characters.' };
    return { value: v };
  }

  function get(cfg, path) {
    var node = cfg;
    path.split('.').forEach(function (k) { node = node == null ? undefined : node[k]; });
    return node;
  }

  // A copy of cfg with path set; undefined removes the key and any parent left empty.
  function set(cfg, path, value) {
    if (value === undefined) return S().reset(cfg, path);
    var out = copy(cfg), parts = path.split('.'), node = out;
    for (var i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
      node = node[parts[i]];
    }
    node[parts[parts.length - 1]] = value;
    return out;
  }

  function addRef(cfg) {
    var out = copy(cfg);
    out.refs = (out.refs || []).concat([{ axis: 'y', kind: 'line', value: 0 }]);
    return out;
  }
  function removeRef(cfg, i) {
    var out = copy(cfg);
    (out.refs || []).splice(i, 1);
    if (out.refs && !out.refs.length) delete out.refs;
    return out;
  }

  function types(engine) {
    var T = S().TYPES;
    return Object.keys(T).filter(function (t) { return T[t].indexOf(engine) >= 0; });
  }
  function setEngine(cfg, engine) {
    var out = copy(cfg);
    out.engine = engine;
    if (out.type && types(engine).indexOf(out.type) < 0) delete out.type;
    return out;
  }

  // ------------------------------------------------------------ markup
  function control(p, path, v, disabled) {
    var a = ' data-path="' + esc(path) + '"' + (disabled ? ' disabled' : '');
    if (p.type === 'bool' || p.type === 'enum') {
      var opts = p.type === 'bool' ? [['true', 'On'], ['false', 'Off']] : p.rule.values.map(function (x) { return [x, x]; });
      return '<select' + a + '><option value="">Default' + (p.def != null ? ' (' + esc(p.type === 'bool' ? (p.def ? 'On' : 'Off') : p.def) + ')' : '') + '</option>' +
        opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (v !== undefined && String(v) === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    }
    if (p.type === 'color') {
      var empty = !/^#[0-9a-f]{6}$/i.test(v || '');
      return '<span class="fl-color' + (empty ? ' is-empty' : '') + '"><input type="color"' + a + ' value="' + esc(empty ? '#ffffff' : v) + '"></span>';
    }
    if (p.type === 'number' || p.type === 'px' || p.type === 'percent') {
      var r = p.rule;
      var range = r.max !== undefined && r.max - r.min <= 200 && p.type !== 'number';
      return '<input type="' + (range ? 'range' : 'number') + '"' + a + (r.min !== undefined && r.min > -1e15 ? ' min="' + r.min + '"' : '') +
        (r.max !== undefined && r.max < 1e15 ? ' max="' + r.max + '"' : '') + ' step="' + (r.step || 1) + '"' +
        ' value="' + esc(v !== undefined ? v : (p.def != null ? p.def : '')) + '"' + (range ? ' title="' + esc(v !== undefined ? v : p.def) + '"' : ' placeholder="auto"') + '>';
    }
    if (p.type === 'list') {
      // Series colours: a colour picker per colour, each with a remove button, then an add button.
      var d = disabled ? ' disabled' : '', l = ' data-list="' + esc(path) + '"';
      return '<span class="cd-palette">' + (v || []).map(function (c, i) {
        return '<span class="fl-color"><input type="color"' + l + ' data-index="' + i + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(c) ? c : '#000000') + '"' + d + '>' +
          '<button type="button" class="cd-reset" data-list-remove="' + esc(path) + '" data-index="' + i + '" title="Remove colour" aria-label="Remove colour"' + d + '>×</button></span>';
      }).join('') + '<button type="button" class="vd-btn vd-btn--ghost" data-list-add="' + esc(path) + '"' + d + '>Add colour</button></span>';
    }
    return '<input type="text"' + a + ' maxlength="' + p.rule.max + '" value="' + esc(v !== undefined ? v : '') + '">';
  }

  function field(f, base, cfg) {
    var path = base + '.' + f.prop.key, v = get(cfg, path);
    return '<label class="fl-param cd-field' + (f.disabled ? ' is-disabled' : '') + '"' + (f.disabled ? ' title="' + esc(f.disabled) + '"' : '') + '>' +
      '<span>' + esc(f.prop.label) + '</span><span class="cd-ctl">' + control(f.prop, path, v, f.disabled) +
      (v !== undefined ? '<button type="button" class="cd-reset" data-reset="' + esc(path) + '" title="Back to default" aria-label="Back to default">×</button>' : '') +
      '</span></label>';
  }

  function nodeBody(cfg, view, series, items) {
    var kind = kindOf(view.node), sec = SECTION[kind], engine = cfg.engine || 'jet';
    var list = fields(sec, engine, view.level === 'advanced' || view.tab === 'advanced' ? 'advanced' : 'basic');
    if (kind === 'refs') {
      var all = fields('refs', engine, 'advanced');
      return (cfg.refs || []).map(function (r, i) {
        return '<fieldset class="cd-ref"><legend>Line ' + (i + 1) + ' <button type="button" class="vd-btn vd-btn--ghost" data-ref-remove="' + i + '">Remove</button></legend>' +
          all.map(function (f) { return field(f, 'refs.' + i, cfg); }).join('') + '</fieldset>';
      }).join('') + '<button type="button" class="vd-btn vd-btn--secondary" data-ref-add>Add reference line</button>';
    }
    if (kind === 'points') {
      var pick = '<label class="fl-param"><span>Point</span><select data-point><option value="">Choose a point…</option>' +
        (series || []).map(function (s, si) {
          var sid = s.id !== undefined ? String(s.id) : String(si);
          return (items || []).map(function (it, ii) {
            var key = sid + '|' + (it.id !== undefined ? it.id : ii);
            return '<option value="' + esc(key) + '"' + (view.point === key ? ' selected' : '') + '>' + esc((s.name || sid) + ' · ' + (it.name || it.id || ii)) + '</option>';
          }).join('');
        }).join('') + '</select></label>';
      return pick + (view.point ? list.map(function (f) { return field(f, 'points.' + view.point, cfg); }).join('') : '');
    }
    return list.map(function (f) { return field(f, pathOf(view.node), cfg); }).join('');
  }

  // The whole panel: header, tabs, tree and the chosen node's fields.
  // view: { node, tab, level, width, point }; series and items come from the preview's chart.
  function html(cfg, view, series, items) {
    var engine = cfg.engine || 'jet', tree = nodes(cfg.type || view.apexType, series, view.tab);
    if (!tree.some(function (n) { return n.id === view.node; }) && tree.length) view.node = tree[0].id;
    var node = tree.filter(function (n) { return n.id === view.node; })[0];
    return '<div class="cd-head">' +
      '<label class="lk-inline">Engine <select data-engine><option value="jet"' + (engine === 'jet' ? ' selected' : '') + '>Oracle JET</option>' +
        '<option value="echarts"' + (engine === 'echarts' ? ' selected' : '') + '>ECharts</option></select></label>' +
      '<label class="lk-inline">Type <select data-type><option value="">As APEX draws it' + (view.apexType ? ' (' + esc(view.apexType) + ')' : '') + '</option>' +
        types(engine).map(function (t) { return '<option' + (cfg.type === t ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></label>' +
      '<label class="lk-inline">Settings <select data-level><option value="basic">Basic</option><option value="advanced"' + (view.level === 'advanced' ? ' selected' : '') + '>Advanced</option></select></label>' +
      '<label class="lk-inline">Preview <select data-width>' + Object.keys(WIDTHS).map(function (w) {
        return '<option value="' + w + '"' + (view.width === w ? ' selected' : '') + '>' + w.charAt(0).toUpperCase() + w.slice(1) + '</option>';
      }).join('') + '</select></label>' +
      '<label class="lk-inline">Template <select data-template><option value="">Choose…</option>' + TEMPLATES.map(function (t) {
        return '<option value="' + t.id + '">' + esc(t.label) + '</option>';
      }).join('') + '</select></label>' +
      '<button type="button" class="vd-btn vd-btn--ghost" data-reset-all>Reset chart</button>' +
      '<button type="button" class="vd-btn vd-btn--secondary" data-close>Done</button></div>' +
      '<div class="cd-tabs" role="tablist">' + TABS.map(function (t) {
        return '<button type="button" role="tab" data-tab="' + t[0] + '" aria-selected="' + (view.tab === t[0]) + '">' + t[1] + '</button>';
      }).join('') + '</div>' +
      '<div class="cd-cols"><nav class="cd-tree">' + tree.map(function (n) {
        return '<button type="button" data-node="' + esc(n.id) + '"' + (n.id === view.node ? ' class="is-selected"' : '') + '>' + esc(n.label) + '</button>';
      }).join('') + '</nav><div class="cd-fields"><h3>' + esc(node ? node.label : '') + '</h3>' + (node ? nodeBody(cfg, view, series, items) : '') + '</div></div>';
  }

  // Wires html(): on.value(path, raw, prop, typing), on.reset(path), on.view(key, value),
  // on.engine(e), on.type(t), on.template(id), on.resetAll(), on.addRef(), on.removeRef(i), on.close().
  function bind(root, on) {
    var q = function (s, fn) { root.querySelectorAll(s).forEach(fn); };
    q('[data-path]', function (inp) {
      var path = inp.getAttribute('data-path'), parts = path.split('.');
      var sec = parts[0] === 'axes' ? 'axis' : parts[0] === 'global' ? 'global' : parts[0];
      var prop = S().find(sec, parts[parts.length - 1]);
      var typing = inp.tagName === 'INPUT' && inp.type !== 'color';
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', function () {
        if (inp.type === 'range') inp.title = inp.value;
        on.value(path, inp.value, prop, typing);
      });
    });
    // Series colours: every change sends the whole list as comma-separated text.
    var listProp = function (path) { var k = path.split('.'); return S().find(k[0] === 'axes' ? 'axis' : k[0], k[k.length - 1]); };
    var listOf = function (path) {
      var out = [];
      q('[data-list="' + path + '"]', function (i) { out.push(i.value); });
      return out;
    };
    q('[data-list]', function (inp) {
      var path = inp.getAttribute('data-list');
      inp.addEventListener('input', function () { on.value(path, listOf(path).join(','), listProp(path), true); });
    });
    q('[data-list-add]', function (b) {
      var path = b.getAttribute('data-list-add');
      b.addEventListener('click', function () { on.value(path, listOf(path).concat(['#5470c6']).join(','), listProp(path), false); });
    });
    q('[data-list-remove]', function (b) {
      var path = b.getAttribute('data-list-remove'), at = Number(b.getAttribute('data-index'));
      b.addEventListener('click', function () {
        on.value(path, listOf(path).filter(function (c, i) { return i !== at; }).join(','), listProp(path), false);
      });
    });
    q('[data-reset]', function (b) { b.addEventListener('click', function () { on.reset(b.getAttribute('data-reset')); }); });
    q('[data-node]', function (b) { b.addEventListener('click', function () { on.view('node', b.getAttribute('data-node')); }); });
    q('[data-tab]', function (b) { b.addEventListener('click', function () { on.view('tab', b.getAttribute('data-tab')); }); });
    var one = function (s, ev, fn) { var el = root.querySelector(s); if (el) el.addEventListener(ev, function () { fn(el); }); };
    one('[data-level]', 'change', function (el) { on.view('level', el.value); });
    one('[data-width]', 'change', function (el) { on.view('width', el.value); });
    one('[data-point]', 'change', function (el) { on.view('point', el.value); });
    one('[data-engine]', 'change', function (el) { on.engine(el.value); });
    one('[data-type]', 'change', function (el) { on.type(el.value); });
    one('[data-template]', 'change', function (el) { if (el.value) on.template(el.value); });
    one('[data-reset-all]', 'click', function () { on.resetAll(); });
    one('[data-ref-add]', 'click', function () { on.addRef(); });
    one('[data-close]', 'click', function () { on.close(); });
    q('[data-ref-remove]', function (b) { b.addEventListener('click', function () { on.removeRef(Number(b.getAttribute('data-ref-remove'))); }); });
  }

  window.VD.chartDesigner = { templates: TEMPLATES, template: template, nodes: nodes, pathOf: pathOf, fields: fields, parse: parse, get: get, set: set,
    addRef: addRef, removeRef: removeRef, types: types, setEngine: setEngine, html: html, bind: bind, WIDTHS: WIDTHS };
})();
