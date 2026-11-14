/* APEX Visual Designer — Flutter Designer view.
   Attach a page of the target app, select a component, pick one of six variants,
   edit its parameters with a live preview, and save the result into the page's own
   Inline CSS and Execute when Page Loads JavaScript. History restores earlier code. */
(function () {
  window.VD = window.VD || {};
  var V = function () { return VD.flutterVariants; };
  var G = function () { return VD.flutterCodegen; };

  var host = null;
  var frame = null;
  var state = {
    app: null,          // the target app: the region's default, or what the user types
    page: null,
    components: [],      // [{ key, kind, id, name, staticId, type, component, label, needsStaticId }]
    design: { components: [] },
    savedJson: '',
    token: null,
    pageCss: '',
    pageJs: '',
    selected: null,
    versions: null,
    message: '',
    busy: false,
    usePage: false,      // true: clicks in the preview reach the page (fill items, submit) instead of selecting
    undo: null,          // undo/redo snapshots of the design (spec §7), one stack per open page
    lastField: null,     // the field typed in last, so a run of keystrokes is one undo step
    chartKey: null,      // the chart whose Chart Designer panel is open
    chartView: { node: 'chart', tab: 'all', level: 'basic', width: 'desktop', point: '' },
    chartRuntime: null   // text of the chart runtime for the live preview, loaded on demand
  };
  var CHART_FILES = ['chart-schema', 'chart-jet', 'chart-echarts', 'chart-runtime'];
  var CD = function () { return VD.chartDesigner; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setMessage(m) { state.message = m || ''; var el = host && host.querySelector('.fl-msg'); if (el) el.textContent = state.message; }
  function choice(key) { return state.design.components.filter(function (c) { return c.key === key; })[0] || null; }
  function component(key) { return state.components.filter(function (c) { return c.key === key; })[0] || null; }
  // Called before every change of the design. Typing in one field is one step, not one per key.
  function remember(field) {
    if (field && field === state.lastField) return;
    state.lastField = field || null;
    state.undo.record(JSON.stringify(state.design));
  }
  function step(redo) {
    var now = JSON.stringify(state.design);
    var snap = redo ? state.undo.redo(now) : state.undo.undo(now);
    if (snap == null) return;
    var had = state.design.components.filter(function (c) { return c.chart; }).map(function (c) { return c.key; });
    state.design = JSON.parse(snap);
    state.lastField = null;
    // A chart that lost its design is drawn again by APEX only after a reload of the preview.
    var lost = had.some(function (k) { var c = choice(k); return !c || !c.chart; });
    render(lost);
  }

  function hasPage() { return state.page != null; }
  function dirty() { return hasPage() && JSON.stringify(state.design) !== state.savedJson; }
  function output() { return G().generate({ app: state.app, page: state.page, components: state.design.components },
    { echartsUrl: G().echartsUrl(document.baseURI), chartRuntimeUrls: chartRuntimeUrls() }); }
  // The saved page loads the chart runtime from these plug-in file URLs.
  function chartRuntimeUrls() {
    return CHART_FILES.map(function (n) { return new URL(window.vdAsset('js/' + n + '.js'), document.baseURI).href; });
  }

  // The chart runtime is the plug-in's own four files, read once from the designer's folder.
  var runtimeLoading = null;
  function loadChartRuntime() {
    if (state.chartRuntime) return Promise.resolve(state.chartRuntime);
    if (!runtimeLoading) {
      runtimeLoading = Promise.all(CHART_FILES.map(function (n) {
        return fetch(new URL(window.vdAsset('js/' + n + '.js'), document.baseURI).href).then(function (r) {
          if (!r.ok) throw new Error('Could not load the chart runtime (' + n + '.js: HTTP ' + r.status + ').');
          return r.text();
        });
      })).then(function (parts) { state.chartRuntime = parts.join('\n'); return state.chartRuntime; },
        function (e) { runtimeLoading = null; throw e; });
    }
    return runtimeLoading;
  }

  // ------------------------------------------------------------ loading
  function flatten(res) {
    var list = [];
    (res.items || []).forEach(function (i) {
      list.push({ key: 'item:' + i.name, kind: 'item', id: i.id, name: i.name, type: i.type, label: i.name, cssClasses: i.cssClasses });
    });
    (res.buttons || []).forEach(function (b) {
      list.push({ key: 'button:' + (b.staticId || b.name), kind: 'button', id: b.id, name: b.name, staticId: b.staticId,
        label: b.name, needsStaticId: !!b.needsStaticId, cssClasses: b.cssClasses });
    });
    (res.regions || []).forEach(function (r) {
      list.push({ key: 'region:' + (r.staticId || r.name), kind: 'region', id: r.id, name: r.name, staticId: r.staticId,
        type: r.type, component: r.component, label: r.name, needsStaticId: !!r.needsStaticId, cssClasses: r.cssClasses });
    });
    list.forEach(function (c) { c.ftype = V().typeOf(c); });
    return list;
  }

  // ------------------------------------------------------------ theme style picker
  // Named styles of the pushed theme for one component type: [{ name, cls }].
  function stylesFor(theme, type) {
    var t = theme && theme.types && theme.types[type];
    return ((t && t.styles) || []).map(function (s) { return { name: s.name, cls: s.cls }; });
  }
  // The <cls> of the component's vd-<type>-<cls> class, or ''.
  function currentStyle(classes, type) {
    var m = String(classes || '').match(new RegExp('(?:^|\\s)vd-' + type + '-([a-z0-9-]+)(?:\\s|$)'));
    return m ? m[1] : '';
  }
  function themeStyleHtml(c) {
    var list = stylesFor(state.pushedTheme, c.ftype);
    if (!list.length || c.id == null) return '';
    var cur = currentStyle(c.cssClasses, c.ftype);
    return '<label class="fl-param fl-theme-style"><span>Theme style</span><select class="fl-theme-pick"><option value="">None (default)</option>' +
      list.map(function (s) {
        return '<option value="' + esc(s.cls) + '"' + (s.cls === cur ? ' selected' : '') + '>' + esc(s.name) + ' (vd-' + esc(c.ftype) + '-' + esc(s.cls) + ')</option>';
      }).join('') + '</select></label>';
  }
  function bindThemeStyle(right, c) {
    var sel = right.querySelector('.fl-theme-pick');
    if (!sel) return;
    sel.addEventListener('change', function () {
      if (dirty() && !window.confirm('Setting the theme style reloads the page and discards unsaved design changes. Continue?')) {
        sel.value = currentStyle(c.cssClasses, c.ftype); return;
      }
      sel.disabled = true;
      setMessage('Setting the theme style…');
      VD.repository.setCssClass(state.app, state.page, c.kind, c.id, c.ftype, sel.value)
        .then(function () { var key = c.key; return attach(state.app, state.page).then(function () { state.selected = key; render(); }); })
        .then(function () { setMessage(sel.value ? 'Theme style set: vd-' + c.ftype + '-' + sel.value + '.' : 'Theme style removed.'); })
        .catch(function (e) { sel.disabled = false; setMessage(e.message); });
    });
  }

  function attach(app, page) {
    state.app = app; state.page = page; state.selected = null; state.versions = null;
    state.undo = VD.undoStack.create(100); state.lastField = null;
    setMessage('Loading page ' + app + ':' + page + '…');
    // The pushed theme feeds the Theme style picker; without one (or without access) there is no picker.
    var theme = VD.repository.readTheme(app).then(function (t) { return t.pushed && t.pushed.theme; }, function () { return null; });
    return Promise.all([VD.repository.listPageComponents(app, page), VD.repository.readFlutter(app, page), theme])
      .then(function (r) {
        state.components = flatten(r[0]);
        state.sharedSession = !!r[0].sharedSession;
        state.token = r[1].token;
        state.pageCss = r[1].css || '';
        state.pageJs = r[1].js || '';
        var saved = r[1].design && r[1].design.components ? r[1].design : { components: [] };
        state.savedJson = JSON.stringify(saved);
        // Old chart looks become Chart Designer settings; the page then shows unsaved changes.
        state.design = VD.chartMigrate.design(saved).design;
        state.undo = VD.undoStack.create(100);
        state.lastField = null;
        state.pushedTheme = r[2] || null;
        state.chartKey = null;
        setMessage('');
        render(true);
        if (G().needsChartRuntime(state.design)) {
          loadChartRuntime().then(function () { applyPreview(); }, function (e) { setMessage(e.message); });
        }
      })
      .catch(function (e) { setMessage(e.message); render(true); });
  }

  // ------------------------------------------------------------ editing
  function setVariant(key, variantId) {
    remember();
    var c = component(key);
    var list = state.design.components.filter(function (x) { return x.key !== key; });
    if (variantId) {
      var prev = choice(key);
      list.push({ key: key, kind: c.kind, name: c.name, staticId: c.staticId || null, type: c.type || null,
        component: c.component || null, variant: variantId,
        values: prev && prev.variant === variantId ? prev.values : {} });
    }
    state.design.components = list;
    render();
  }

  function setValue(key, param, value) {
    var ch = choice(key);
    if (!ch) return;
    remember(key + ' ' + param);
    ch.values = ch.values || {};
    ch.values[param] = value;
    applyPreview();
    renderTop();
  }

  // ------------------------------------------------------------ preview
  function applyPreview() {
    var out = output();
    var sel = state.selected && component(state.selected);
    var selector = sel && G().selectorFor(sel);
    var css = out.css + (selector ? '\n' + selector + '{outline:2px dashed #C9A227;outline-offset:3px}' : '');
    var ok = VD.pagePreview.setStyle(frame, 'vd-flutter', css);
    // The ripple script is added once per page load; it only reacts to its targets.
    var d = ok && VD.pagePreview.doc(frame);
    if (d && out.js && !d.getElementById('vd-flutter-js')) {
      var s = d.createElement('script'); s.id = 'vd-flutter-js'; s.textContent = out.js; d.body.appendChild(s);
    }
    if (d) scheduleCharts();
    return ok;
  }

  // Charts: the runtime goes into the preview once per page load; every configured chart is
  // re-applied 150 ms after the last change, so typing in a field does not redraw on each key.
  var chartTimer = null;
  function scheduleCharts() {
    clearTimeout(chartTimer);
    chartTimer = setTimeout(applyCharts, 150);
  }
  function frameChartApi() {
    var d = frame && VD.pagePreview.doc(frame), w = d && d.defaultView;
    if (!w || !state.chartRuntime) return null;
    if (!d.getElementById('vd-chart-rt')) {
      var s = d.createElement('script');
      s.id = 'vd-chart-rt';
      s.textContent = 'window.VD = window.VD || {}; VD.chart = VD.chart || {}; VD.chart.echartsUrl = ' +
        JSON.stringify(G().echartsUrl(document.baseURI)) + ';\n' +
        'if (!VD.chart.apply) {\n' + state.chartRuntime + '\n}\n';
      d.body.appendChild(s);
    }
    return w.VD && w.VD.chart && w.VD.chart.apply ? w.VD.chart : null;
  }
  function applyCharts() {
    var list = state.design.components.filter(function (c) { return c.chart && c.staticId; });
    var api = list.length && frameChartApi();
    if (!api) return;
    list.forEach(function (c) {
      try { api.apply(c.staticId, c.chart); } catch (e) { setMessage('Chart ' + c.staticId + ': ' + e.message); }
    });
  }
  // Series and groups of a chart as APEX drew it in the preview, for the tree and the point list.
  function chartData(staticId) {
    var api = frameChartApi(), info = null;
    try { info = api && api.read(staticId); } catch (e) { info = null; }
    return info || { type: null, series: [], groups: [] };
  }

  function onFrameClick(ev) {
    if (state.usePage) return;
    var byId = {};
    state.components.forEach(function (c) {
      if (!c.ftype) return;
      if (c.kind === 'item') byId[c.name + '_CONTAINER'] = c.key;
      else if (c.staticId) byId[c.staticId] = c.key;
    });
    for (var n = ev.target; n && n.nodeType === 1; n = n.parentNode) {
      if (n.id && byId[n.id]) {
        // Selecting must not run the component: a button would submit or redirect the preview.
        ev.preventDefault();
        ev.stopImmediatePropagation();
        state.selected = byId[n.id]; render(); return;
      }
    }
  }

  function loadPreview() {
    var box = host.querySelector('.fl-preview');
    if (!hasPage()) { box.innerHTML = '<div class="lk-empty">Attach a page to see it here.</div>'; frame = null; return; }
    if (!VD.pagePreview.runnable(state.page)) { box.innerHTML = '<div class="lk-empty">' + VD.pagePreview.noPreview + '</div>'; frame = null; return; }
    frame = document.createElement('iframe');
    frame.className = 'lk-frame';
    frame.title = 'Page preview';
    frame.src = VD.pagePreview.url(state.app, state.page, state.sharedSession);
    frame.addEventListener('load', function () {
      var d = VD.pagePreview.doc(frame);
      if (!d) { setMessage('The page cannot be shown here. Check that the app allows framing from the same origin.'); return; }
      d.addEventListener('click', onFrameClick, true);
      applyPreview();
    });
    box.innerHTML = '';
    box.appendChild(frame);
  }

  // ------------------------------------------------------------ thumbnails
  // ------------------------------------------------------------ rendering
  function skeleton() {
    host.innerHTML =
      '<div class="lk-top fl-top"></div><div class="lk-msg fl-msg" role="status"></div>' +
      '<div class="lk-body"><aside class="lk-left fl-left"></aside>' +
      '<section class="lk-center"><div class="lk-preview fl-preview"></div></section>' +
      '<aside class="lk-right fl-right"></aside></div><style id="fl-thumbs-css"></style>';
  }

  function renderTop() {
    var top = host.querySelector('.fl-top');
    top.innerHTML =
      '<strong class="fl-title">Design items</strong>' +
      '<span class="lk-state">' + (hasPage() ? (dirty() ? 'Unsaved changes' : 'Saved') : '') + '</span>' +
      '<span class="lk-spacer"></span>' +
      '<button class="vd-btn vd-btn--ghost fl-undo" title="Undo (Ctrl+Z)"' + (state.undo && state.undo.canUndo() ? '' : ' disabled') + '>Undo</button>' +
      '<button class="vd-btn vd-btn--ghost fl-redo" title="Redo (Ctrl+Y)"' + (state.undo && state.undo.canRedo() ? '' : ' disabled') + '>Redo</button>' +
      '<button class="vd-btn vd-btn--ghost fl-use-page" aria-pressed="' + state.usePage + '" title="Use the page in the preview: fill items and submit, for example to show a chart that needs dates. Turn off to select components again.">' +
        (state.usePage ? 'Using page: on' : 'Use page') + '</button>' +
      '<button class="vd-btn vd-btn--ghost fl-history"' + (hasPage() ? '' : ' disabled') + '>History</button>' +
      '<button class="vd-btn vd-btn--primary fl-save"' + (hasPage() && dirty() && !state.busy ? '' : ' disabled') + '>Save to page</button>';
    top.querySelector('.fl-history').addEventListener('click', openHistory);
    top.querySelector('.fl-undo').addEventListener('click', function () { step(false); });
    top.querySelector('.fl-redo').addEventListener('click', function () { step(true); });
    top.querySelector('.fl-use-page').addEventListener('click', function () { state.usePage = !state.usePage; render(); });
    top.querySelector('.fl-save').addEventListener('click', function () { save(); });
  }

  function renderLeft() {
    var groups = {};
    state.components.forEach(function (c) {
      var g = c.ftype || 'other';
      (groups[g] = groups[g] || []).push(c);
    });
    var names = { text: 'Text fields', date: 'Date pickers', select: 'Lists', choice: 'Checkboxes and radios', 'switch': 'Switches',
      button: 'Buttons', display: 'Display only', region: 'Regions', classic: 'Classic reports', ir: 'Interactive reports', ig: 'Interactive grids', cards: 'Cards', chart: 'Charts', other: 'Not supported' };
    var order = V().types.concat(['other']);
    var html = hasPage() ? order.filter(function (g) { return groups[g]; }).map(function (g) {
      return '<h3>' + names[g] + '</h3>' + groups[g].map(function (c) {
        var blocked = !c.ftype ? 'type not supported' : '';
        var ch = choice(c.key);
        return '<button class="lk-slot' + (state.selected === c.key ? ' is-selected' : '') + '" data-key="' + esc(c.key) + '"' +
          (blocked ? ' disabled title="' + esc(blocked) + '"' : '') + '><b>' + esc(c.label) + '</b><span>' +
          esc(blocked || (c.needsStaticId ? 'set Static ID first' : ch && ch.chart ? 'Chart Designer' : ch ? V().get(c.ftype, ch.variant).label : 'plain')) + '</span></button>';
      }).join('');
    }).join('') : '<p class="lk-hint">Open a page in the page bar above.</p>';
    var left = host.querySelector('.fl-left');
    left.innerHTML = html;
    left.querySelectorAll('[data-key]').forEach(function (b) {
      b.addEventListener('click', function () { state.selected = b.getAttribute('data-key'); render(); });
    });
  }

  // ------------------------------------------------------------ static id
  function suggestStaticId(c) {
    var base = String(c.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!/^[a-z]/.test(base)) base = c.kind + (base ? '_' + base : '');
    base = base.slice(0, 50);
    var used = {}, id = base, n = 2;
    state.components.forEach(function (x) { used[String(x.kind === 'item' ? x.name : x.staticId || '').toLowerCase()] = true; });
    while (used[id]) id = base + '_' + n++;
    return id;
  }
  function staticIdForm(c) {
    return '<p class="lk-hint">This ' + c.kind + ' has no Static ID, so a design cannot target it. Give it one: it is saved into page ' +
      esc(state.page) + ' and nothing else on the page changes.</p>' +
      '<label class="fl-param"><span>Static ID</span><input type="text" class="fl-sid" maxlength="60" value="' + esc(suggestStaticId(c)) + '"></label>' +
      '<button class="vd-btn vd-btn--primary fl-sid-save">Set Static ID</button>';
  }
  function bindStaticIdForm(right, c) {
    var inp = right.querySelector('.fl-sid'), btn = right.querySelector('.fl-sid-save');
    btn.addEventListener('click', function () {
      var id = inp.value.trim();
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(id)) { setMessage('A Static ID starts with a letter and has only letters, digits, _ and - (at most 60).'); return; }
      btn.disabled = true;
      setMessage('Setting Static ID ' + id + ' on page ' + state.page + '…');
      // Unsaved design choices survive the reload of the page components.
      var keep = state.design, wasDirty = dirty();
      VD.repository.setStaticId(state.app, state.page, c.kind, c.id, id)
        .then(function () { return attach(state.app, state.page); })
        .then(function () {
          if (wasDirty) state.design = keep;
          state.selected = c.kind + ':' + id;
          render(true);
          setMessage('Static ID ' + id + ' set. Pick a design for ' + c.label + '.');
        })
        .catch(function (e) { btn.disabled = false; setMessage(e.message); });
    });
  }

  // ------------------------------------------------------------ chart designer
  function setChart(key, cfg, field) {
    var ch = choice(key);
    if (!ch) return;
    remember(field && key + ' ' + field);
    ch.chart = cfg;
    // The frame (background, border, radius) is page CSS; applyPreview sets it and redraws the charts.
    applyPreview();
    renderTop(); renderLeft();
  }
  function openChart(c) {
    setMessage('Loading the chart runtime…');
    loadChartRuntime().then(function () {
      var ch = choice(c.key);
      if (!ch || !ch.chart) {
        // A chart design replaces an older look variant on the same chart.
        remember();
        state.design.components = state.design.components.filter(function (x) { return x.key !== c.key; });
        state.design.components.push({ key: c.key, kind: c.kind, name: c.name, staticId: c.staticId || null, type: c.type || null,
          component: c.component || null, chart: { version: 1, engine: 'jet' } });
      }
      state.chartKey = c.key;
      state.chartView.node = 'chart'; state.chartView.point = '';
      setMessage('');
      render();
    }, function (e) { setMessage(e.message); });
  }
  function closeChart() {
    state.chartKey = null;
    var f = host.querySelector('.fl-preview'); if (f) f.style.width = '';
    render();
  }
  function renderChartPanel(right, c) {
    var ch = choice(c.key), view = state.chartView, data = chartData(c.staticId);
    view.apexType = data.type;
    right.innerHTML = '<h3>' + esc(c.label) + ' — Chart Designer</h3>' + CD().html(ch.chart, view, data.series, data.groups);
    host.querySelector('.fl-preview').style.width = CD().WIDTHS[view.width] || '';
    CD().bind(right, {
      value: function (path, raw, prop, typing) {
        if (!prop) return;
        var r = CD().parse(prop, raw), inp = right.querySelector('[data-path="' + path.replace(/"/g, '\\"') + '"]');
        if (inp) inp.classList.toggle('is-invalid', !!r.error);
        if (r.error) { setMessage(r.error); return; }
        setMessage('');
        setChart(c.key, CD().set(ch.chart, path, r.value), typing ? path : null);
        if (!typing) renderChartPanel(right, c);
      },
      reset: function (path) { setChart(c.key, CD().set(ch.chart, path, undefined)); renderChartPanel(right, c); },
      view: function (k, v) { view[k] = v; renderChartPanel(right, c); },
      engine: function (e) { setChart(c.key, CD().setEngine(ch.chart, e)); renderChartPanel(right, c); },
      type: function (t) { setChart(c.key, CD().set(ch.chart, 'type', t || undefined)); renderChartPanel(right, c); },
      template: function (id) {
        var t = CD().template(id);
        if (!t || !window.confirm('Replace the settings of this chart with the template? Undo brings them back.')) { renderChartPanel(right, c); return; }
        setChart(c.key, t); renderChartPanel(right, c);
      },
      resetAll: function () {
        if (!window.confirm('Reset every setting of this chart to how APEX draws it?')) return;
        setChart(c.key, { version: 1, engine: ch.chart.engine || 'jet' }); renderChartPanel(right, c);
      },
      addRef: function () { setChart(c.key, CD().addRef(ch.chart)); renderChartPanel(right, c); },
      removeRef: function (i) { setChart(c.key, CD().removeRef(ch.chart, i)); renderChartPanel(right, c); },
      close: closeChart
    });
  }
  function chartEntryHtml(ch) {
    return '<p class="lk-hint">Style this chart with the Chart Designer: colours, series, axes, labels, legend, reference lines and more, with Oracle JET or ECharts.</p>' +
      '<button class="vd-btn vd-btn--primary fl-chart-open">' + (ch && ch.chart ? 'Edit chart design' : 'Open Chart Designer') + '</button>' +
      (ch ? '<p class="lk-hint">Current design: Chart Designer</p>' +
        '<button class="vd-btn vd-btn--ghost fl-remove">Remove design</button>' : '');
  }

  function renderRight() {
    var right = host.querySelector('.fl-right');
    var c = state.selected && component(state.selected);
    var thumbCss = '';
    var chartOpen = !!(c && state.chartKey === c.key && choice(c.key) && choice(c.key).chart);
    host.classList.toggle('fl-chart-open', chartOpen);
    if (!chartOpen) { state.chartKey = null; host.querySelector('.fl-preview').style.width = ''; }
    if (chartOpen) { renderChartPanel(right, c); host.querySelector('#fl-thumbs-css').textContent = ''; return; }
    if (c && c.ftype === 'chart' && !c.needsStaticId) {
      var cch = choice(c.key);
      right.innerHTML = '<h3>' + esc(c.label) + '</h3>' + themeStyleHtml(c) + chartEntryHtml(cch);
      bindThemeStyle(right, c);
      right.querySelector('.fl-chart-open').addEventListener('click', function () { openChart(c); });
      var rmc = right.querySelector('.fl-remove');
      // A reload gives the preview back the chart exactly as APEX draws it.
      if (rmc) rmc.addEventListener('click', function () { setVariant(c.key, null); loadPreview(); });
      host.querySelector('#fl-thumbs-css').textContent = '';
      return;
    }
    if (!c) {
      right.innerHTML = hasPage() ? '<p class="lk-hint">Select a component in the list or click it on the page.</p>' : '';
    } else {
      var ch = choice(c.key);
      var t = VD.flParams.thumbnails(c.ftype, ch && ch.variant);
      thumbCss = t.css;
      var params = '';
      if (ch) {
        var variant = V().get(c.ftype, ch.variant);
        params = VD.flParams.html(variant, ch.values, { advanced: state.advancedOpen, hide: state.hideOpen }) +
          '<button class="vd-btn vd-btn--ghost fl-remove">Remove design</button>';
      }
      if (c.needsStaticId) {
        right.innerHTML = '<h3>' + esc(c.label) + '</h3>' + staticIdForm(c);
        bindStaticIdForm(right, c);
        host.querySelector('#fl-thumbs-css').textContent = '';
        return;
      }
      right.innerHTML = '<h3>' + esc(c.label) + '</h3>' + themeStyleHtml(c) + '<div class="fl-variants">' + t.html + '</div>' + params;
      bindThemeStyle(right, c);
      right.querySelectorAll('[data-variant]').forEach(function (b) {
        b.addEventListener('click', function () { setVariant(c.key, b.getAttribute('data-variant')); });
      });
      if (ch) {
        VD.flParams.bind(right, V().get(c.ftype, ch.variant), function (key, raw) { setValue(c.key, key, raw); },
          function (which, open) { if (which === 'hide') state.hideOpen = open; else state.advancedOpen = open; });
      }
      var rm = right.querySelector('.fl-remove');
      if (rm) rm.addEventListener('click', function () { setVariant(c.key, null); });
    }
    host.querySelector('#fl-thumbs-css').textContent = thumbCss;
  }

  function render(reloadFrame) {
    if (!host) return;
    if (!host.querySelector('.fl-preview')) { skeleton(); reloadFrame = true; }
    renderTop(); renderLeft(); renderRight();
    host.querySelector('.fl-msg').textContent = state.message;
    if (reloadFrame) loadPreview(); else applyPreview();
  }

  // ------------------------------------------------------------ save and history
  // then: runs after a successful save (leaving the view).
  function save(then) {
    var out = output();
    var cssCheck = G().merge(state.pageCss, out.css), jsCheck = G().merge(state.pageJs, out.js);
    if (cssCheck.error || jsCheck.error) { setMessage(cssCheck.error || jsCheck.error); return; }
    state.busy = true; renderTop();
    setMessage('Saving into page ' + state.page + '…');
    VD.repository.saveFlutter(state.app, state.page, state.token, VD.chartMigrate.strip(state.design), out.css, out.js)
      .then(function () {
        state.busy = false;
        return attach(state.app, state.page).then(function () {
          setMessage('Saved into page ' + state.page + '. Its own CSS and JS outside the designer block are unchanged.');
          if (then) then();
        });
      })
      .catch(function (e) { state.busy = false; setMessage(e.message); renderTop(); });
  }

  function openHistory() {
    var right = host.querySelector('.fl-right');
    right.innerHTML = '<h3>History of page ' + esc(state.page) + '</h3><p class="lk-hint">Loading…</p>';
    VD.repository.flutterHistory(state.app, state.page).then(function (res) {
      var rows = (res.versions || []).map(function (v) {
        return '<li><span><b>' + esc(v.note.toLowerCase()) + '</b> ' + esc((v.savedAt || '').replace('T', ' ').slice(0, 16)) +
          ' · ' + esc(v.savedBy) + '</span><button class="vd-btn vd-btn--ghost" data-restore="' + v.versionId + '">Restore</button></li>';
      }).join('');
      right.innerHTML = '<h3>History of page ' + esc(state.page) + '</h3>' +
        (rows ? '<ul class="fl-history-list">' + rows + '</ul>' : '<p class="lk-hint">Nothing saved from the designer yet.</p>') +
        '<button class="vd-btn vd-btn--ghost fl-close">Close</button>';
      right.querySelector('.fl-close').addEventListener('click', function () { renderRight(); });
      right.querySelectorAll('[data-restore]').forEach(function (b) {
        b.addEventListener('click', function () {
          if (!window.confirm('Put this version of the CSS and JS back into page ' + state.page + '? The current code is kept in History.')) return;
          setMessage('Restoring…');
          VD.repository.restoreFlutter(state.app, state.page, b.getAttribute('data-restore'), state.token)
            .then(function () { return attach(state.app, state.page); })
            .then(function () { setMessage('Restored. Page ' + state.page + ' has that version of its CSS and JS again.'); })
            .catch(function (e) { setMessage(e.message); });
        });
      });
    }).catch(function (e) { setMessage(e.message); });
  }

  // Ctrl+Z / Ctrl+Y (and Ctrl+Shift+Z) while the designer is shown; fields keep their own undo.
  document.addEventListener('keydown', function (e) {
    if (!host || !host.offsetParent || !state.undo || !(e.ctrlKey || e.metaKey)) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (e.target && e.target.isContentEditable)) return;
    var k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); step(false); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); step(true); }
  });

  window.VD.flutterMode = {
    enter: function () {
      host = document.getElementById('flutter-host');
      if (!host) return;
      var p = VD.pageBar && VD.pageBar.current();
      if (p && (p.app !== state.app || p.page !== state.page)) { attach(p.app, p.page); return; }
      render(!frame);
    },
    // From the page bar; false keeps the open page (the user kept the unsaved changes).
    open: function (app, page) {
      if (dirty() && !window.confirm('Discard unsaved changes on this page?')) return false;
      attach(app, page);
      return true;
    },
    // false keeps the designer open: the user cancelled, or chose Save (then onLeave runs after it).
    leave: function (onLeave) {
      if (!dirty()) return true;
      if (window.confirm('This page has unsaved design changes. Save them now?\n\nOK saves them; Cancel lets you discard them or stay.')) {
        save(onLeave);
        return false;
      }
      if (window.confirm('Discard the unsaved design changes?')) { state.design = VD.chartMigrate.design(JSON.parse(state.savedJson)).design; state.undo = VD.undoStack.create(100); return true; }
      return false;
    },
    attach: attach,
    stylesFor: stylesFor,
    currentStyle: currentStyle
  };
})();
