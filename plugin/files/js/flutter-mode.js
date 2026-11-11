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
    busy: false
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function setMessage(m) { state.message = m || ''; var el = host && host.querySelector('.fl-msg'); if (el) el.textContent = state.message; }
  function choice(key) { return state.design.components.filter(function (c) { return c.key === key; })[0] || null; }
  function component(key) { return state.components.filter(function (c) { return c.key === key; })[0] || null; }
  function dirty() { return JSON.stringify(state.design) !== state.savedJson; }
  function output() { return G().generate({ app: state.app, page: state.page, components: state.design.components }); }

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
        state.design = r[1].design && r[1].design.components ? r[1].design : { components: [] };
        state.savedJson = JSON.stringify(state.design);
        state.pushedTheme = r[2] || null;
        setMessage('');
        render(true);
      })
      .catch(function (e) { setMessage(e.message); render(true); });
  }

  // ------------------------------------------------------------ editing
  function setVariant(key, variantId) {
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
    return ok;
  }

  function onFrameClick(ev) {
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
    if (!state.page) { box.innerHTML = '<div class="lk-empty">Attach a page to see it here.</div>'; frame = null; return; }
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
      '<strong class="fl-title">Flutter Designer</strong>' +
      '<span class="lk-state">' + (state.page ? (dirty() ? 'Unsaved changes' : 'Saved') : '') + '</span>' +
      '<span class="lk-spacer"></span>' +
      '<label class="lk-inline">App <input type="number" class="fl-app" value="' + esc(state.app) + '"></label>' +
      '<label class="lk-inline">Page <input type="number" class="fl-page" value="' + esc(state.page || '') + '"></label>' +
      '<button class="vd-btn vd-btn--secondary fl-attach">Open page</button>' +
      '<button class="vd-btn vd-btn--ghost fl-history"' + (state.page ? '' : ' disabled') + '>History</button>' +
      '<button class="vd-btn vd-btn--primary fl-save"' + (state.page && dirty() && !state.busy ? '' : ' disabled') + '>Save to page</button>';
    top.querySelector('.fl-attach').addEventListener('click', function () {
      var app = Number(top.querySelector('.fl-app').value), page = Number(top.querySelector('.fl-page').value);
      if (!app || !(page >= 0)) { setMessage('Enter an app and page number.'); return; }
      if (dirty() && !window.confirm('Discard unsaved changes on this page?')) return;
      attach(app, page);
    });
    top.querySelector('.fl-history').addEventListener('click', openHistory);
    top.querySelector('.fl-save').addEventListener('click', save);
  }

  function renderLeft() {
    var groups = {};
    state.components.forEach(function (c) {
      var g = c.ftype || 'other';
      (groups[g] = groups[g] || []).push(c);
    });
    var names = { text: 'Text fields', date: 'Date pickers', select: 'Lists', choice: 'Checkboxes and radios', 'switch': 'Switches',
      button: 'Buttons', display: 'Display only', region: 'Regions', classic: 'Classic reports', ir: 'Interactive reports', ig: 'Interactive grids', cards: 'Cards', other: 'Not supported' };
    var order = V().types.concat(['other']);
    var html = state.page ? order.filter(function (g) { return groups[g]; }).map(function (g) {
      return '<h3>' + names[g] + '</h3>' + groups[g].map(function (c) {
        var blocked = !c.ftype ? 'type not supported' : '';
        var ch = choice(c.key);
        return '<button class="lk-slot' + (state.selected === c.key ? ' is-selected' : '') + '" data-key="' + esc(c.key) + '"' +
          (blocked ? ' disabled title="' + esc(blocked) + '"' : '') + '><b>' + esc(c.label) + '</b><span>' +
          esc(blocked || (c.needsStaticId ? 'set Static ID first' : ch ? V().get(c.ftype, ch.variant).label : 'plain')) + '</span></button>';
      }).join('');
    }).join('') : '<p class="lk-hint">Enter an app and page, then Open page.</p>';
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

  function renderRight() {
    var right = host.querySelector('.fl-right');
    var c = state.selected && component(state.selected);
    var thumbCss = '';
    if (!c) {
      right.innerHTML = state.page ? '<p class="lk-hint">Select a component in the list or click it on the page.</p>' : '';
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
  function save() {
    var out = output();
    var cssCheck = G().merge(state.pageCss, out.css), jsCheck = G().merge(state.pageJs, out.js);
    if (cssCheck.error || jsCheck.error) { setMessage(cssCheck.error || jsCheck.error); return; }
    state.busy = true; renderTop();
    setMessage('Saving into page ' + state.page + '…');
    VD.repository.saveFlutter(state.app, state.page, state.token, state.design, out.css, out.js)
      .then(function () {
        state.busy = false;
        return attach(state.app, state.page).then(function () { setMessage('Saved into page ' + state.page + '. Its own CSS and JS outside the designer block are unchanged.'); });
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

  window.VD.flutterMode = {
    enter: function () {
      host = document.getElementById('flutter-host');
      if (state.app == null && VD.config && VD.config.app) state.app = VD.config.app;
      if (!host) return;
      render(!frame);
    },
    attach: attach,
    stylesFor: stylesFor,
    currentStyle: currentStyle
  };
})();
