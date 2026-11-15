/* APEX Visual Designer — Theme Designer view.
   One theme per app: for each component type a default style and named styles, each one of
   the Flutter designs with its settings. Save draft keeps work; Push writes vd-theme.css into
   the app and links it from page 0; Download gives the same file for any other app. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;
  var V = function () { return VD.flutterVariants; };
  var T = function () { return VD.themeCodegen; };
  var P = function () { return VD.flParams; };

  // ------------------------------------------------------------ pure helpers (tested)
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function emptyTheme() { return { global: {}, types: {} }; }

  function styles(theme, type) { return (theme.types[type] && theme.types[type].styles) || []; }

  // A free class name for a new style: its name as a slug, or style-<n> when the name has no
  // latin letters; -2, -3 ... when that class is taken.
  function suggestClass(theme, type, name) {
    var list = styles(theme, type), used = {};
    list.forEach(function (s) { used[s.cls] = true; });
    var base = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
    if (!/^[a-z]/.test(base)) base = 'style-' + (list.length + 1);
    if (!used[base]) return base;
    for (var n = 2; ; n++) if (!used[base + '-' + n]) return base + '-' + n;
  }

  // The first style of a type becomes its default.
  function addStyle(theme, type, name, cls, variant) {
    var t = clone(theme);
    t.types[type] = t.types[type] || { styles: [] };
    var list = t.types[type].styles;
    list.push({ name: name, cls: cls, variant: variant, values: {}, isDefault: list.length === 0 });
    return t;
  }

  function removeStyle(theme, type, index) {
    var t = clone(theme);
    var list = styles(t, type);
    list.splice(index, 1);
    if (!list.length) delete t.types[type];
    return t;
  }

  function setDefault(theme, type, index) {
    var t = clone(theme);
    styles(t, type).forEach(function (s, i) { s.isDefault = i === index; });
    return t;
  }

  function setValue(theme, type, index, key, value) {
    var t = clone(theme);
    var s = styles(t, type)[index];
    s.values = s.values || {};
    if (value === '' || value == null) delete s.values[key]; else s.values[key] = value;
    return t;
  }

  // field: 'name' | 'cls' | 'variant'
  function setStyleField(theme, type, index, field, value) {
    var t = clone(theme);
    var s = styles(t, type)[index];
    s[field] = value;
    s.values = s.values || {};
    return t;
  }

  // ------------------------------------------------------------ view state
  // The type list: the families a theme can style, grouped by the markup they style.
  var SURFACES = [['region', 'Regions'], ['item', 'Items'], ['button', 'Buttons']];
  function groups() {
    var R = window.VD.componentRegistry;
    return SURFACES.map(function (sf) {
      return [sf[1], R.families().filter(function (f) { return f.surface === sf[0] && f.variants.length; }).map(function (f) { return f.id; })];
    }).filter(function (g) { return g[1].length; });
  }
  var host = null, frame = null;
  var state = {
    app: null, theme: emptyTheme(), savedJson: '', pushed: null,
    type: null, index: -1, view: 'gallery', page: 1,
    versions: null, message: '', busy: false, open: {}
  };

  function esc(s) { return P().esc(s); }
  function dirty() { return JSON.stringify(state.theme) !== state.savedJson; }
  function errors() { return T().validate(state.theme); }
  function setMessage(m) { state.message = m || ''; var el = host && host.querySelector('.th-msg'); if (el) el.textContent = state.message; }
  function current() { return state.type ? styles(state.theme, state.type)[state.index] : null; }
  function today() { return new Date().toISOString().slice(0, 10); }
  function output(version) { return T().themeCss(state.theme, { app: state.app, version: version || 'draft', date: today() }); }
  function update(theme, full) { state.theme = theme; if (full) render(); else { renderTop(); renderLeft(); applyPreview(); } }

  // ------------------------------------------------------------ gallery samples
  // Real Universal Theme markup for one type, carrying the style's class where APEX puts it.
  function sample(type, cls) {
    var f = window.VD.componentRegistry.family(type);
    var inner = ((f && f.themeSample) || '').replace(/\{cls\}/g, cls ? ' vd-' + type + '-' + cls : '');
    if (f && f.surface === 'region') {
      return '<div class="t-Region' + (cls ? ' vd-' + type + '-' + cls : '') + '"><div class="t-Region-header"><h2 class="t-Region-title">Title</h2></div><div class="t-Region-body">' + inner + '</div></div>';
    }
    if (f && f.surface === 'button') return inner;
    return '<div class="t-Form-fieldContainer"><div class="t-Form-labelContainer"><label class="t-Form-label">Label</label></div>' +
      '<div class="t-Form-inputContainer">' + inner + '</div></div>';
  }

  function galleryHtml() {
    var types = state.type ? [state.type] : groups().reduce(function (a, g) { return a.concat(g[1]); }, []).filter(function (t) { return styles(state.theme, t).length; });
    if (!types.length) return '<div class="lk-empty">Add a style to a component type on the left.</div>';
    return types.map(function (type) {
      var list = styles(state.theme, type);
      var cards = list.map(function (s, i) {
        var tag = s.isDefault ? 'default · and vd-' + type + '-' + s.cls : 'vd-' + type + '-' + s.cls;
        return '<button class="th-sample' + (state.type === type && state.index === i ? ' is-selected' : '') + '" data-type="' + type + '" data-index="' + i + '">' +
          '<span class="th-sample-box">' + sample(type, s.isDefault ? null : s.cls) + '</span><b>' + esc(s.name) + '</b><code>' + esc(tag) + '</code></button>';
      }).join('');
      var plain = '<div class="th-sample is-plain"><span class="th-sample-box">' + sample(type, null) + '</span><b>No style</b><code>APEX look</code></div>';
      return '<h3>' + esc(T().names[type]) + '</h3><div class="th-grid">' + (list.some(function (s) { return s.isDefault; }) ? '' : plain) + cards + '</div>';
    }).join('');
  }

  // ------------------------------------------------------------ preview
  // The gallery lives inside the editor page, so the theme's body-level rules are re-scoped to it.
  function galleryCss() {
    var css = T().themeCss({ global: {}, types: state.theme.types }, { app: state.app, version: 'draft', date: today() }).css;
    return css.replace(/(^|\n|,\s*)body /g, '$1.th-gallery ');
  }

  function applyPreview() {
    if (!host) return;
    if (state.view === 'gallery') {
      var g = host.querySelector('.th-gallery');
      if (g) {
        g.innerHTML = galleryHtml();
        g.querySelectorAll('[data-type]').forEach(function (b) {
          b.addEventListener('click', function () { select(b.getAttribute('data-type'), Number(b.getAttribute('data-index'))); });
        });
      }
      host.querySelector('#th-gallery-css').textContent = galleryCss();
      return;
    }
    var out = output();
    if (!VD.pagePreview.setStyle(frame, 'vd-theme-draft', out.css)) return;
    var d = VD.pagePreview.doc(frame);
    if (d && out.js && !d.getElementById('vd-theme-draft-js')) {
      var s = d.createElement('script'); s.id = 'vd-theme-draft-js'; s.textContent = out.js; d.body.appendChild(s);
    }
  }

  function loadPreview() {
    var box = host.querySelector('.th-preview');
    host.querySelector('#th-gallery-css').textContent = '';
    if (state.view === 'gallery') { box.innerHTML = '<div class="th-gallery"></div>'; frame = null; applyPreview(); return; }
    frame = document.createElement('iframe');
    frame.className = 'lk-frame';
    frame.title = 'Page preview with the theme';
    frame.src = VD.pagePreview.url(state.app, state.page);
    frame.addEventListener('load', function () {
      if (!VD.pagePreview.doc(frame)) { setMessage('The page cannot be shown here. Check that the app allows framing from the same origin.'); return; }
      applyPreview();
    });
    box.innerHTML = '';
    box.appendChild(frame);
  }

  // ------------------------------------------------------------ actions
  function select(type, index) { state.type = type; state.index = index; state.versions = null; render(); }

  function load() {
    state.busy = true; setMessage('Loading the theme…');
    return VD.repository.readTheme(state.app).then(function (r) {
      state.theme = r.theme && r.theme.types ? r.theme : emptyTheme();
      state.theme.global = state.theme.global || {};
      state.savedJson = JSON.stringify(state.theme);
      state.pushed = r.pushed || null;
      state.busy = false;
      setMessage(r.versionId ? (r.note === 'DRAFT' ? 'Draft loaded.' : 'Theme loaded (' + r.note.toLowerCase() + ' version ' + r.versionId + ').') : 'No theme yet. Add a style to a component type to start.');
      render(true);
    }).catch(function (e) { state.busy = false; setMessage(e.message); render(true); });
  }

  function saveDraft() {
    var out = output();
    state.busy = true; renderTop();
    VD.repository.saveThemeDraft(state.app, state.theme, out.css, out.js).then(function (r) {
      state.busy = false; state.savedJson = JSON.stringify(state.theme);
      setMessage('Draft saved (version ' + r.versionId + '). The app is unchanged until you push.');
      renderTop();
    }).catch(function (e) { state.busy = false; setMessage(e.message); renderTop(); });
  }

  function push() {
    if (!window.confirm('Push this theme to app ' + state.app + '? Every page will use it. Page 0 is re-imported, so signed-in users must log in again.')) return;
    state.busy = true; renderTop(); setMessage('Pushing the theme…');
    // The file's header names the version the database is about to give it, so it is generated
    // after the push returns the id only for the history; the CSS itself does not depend on it.
    var out = output('pushed ' + today());
    VD.repository.pushTheme(state.app, state.theme, out.css, out.js).then(function (r) {
      state.busy = false; state.savedJson = JSON.stringify(state.theme);
      state.pushed = { theme: clone(state.theme), versionId: r.versionId };
      setMessage('Pushed as version ' + r.versionId + '. Every page of app ' + state.app + ' now loads vd-theme.css?v=' + r.versionId + '.');
      render(true);
    }).catch(function (e) { state.busy = false; setMessage(e.message); renderTop(); });
  }

  function download() {
    var out = output('download ' + today());
    var save = function (name, text, type) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: type }));
      a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    };
    save('vd-theme.css', out.css, 'text/css');
    if (out.js) save('vd-theme.js', out.js, 'text/javascript');
    setMessage(out.js ? 'Downloaded vd-theme.css and vd-theme.js (ripple and fonts).' : 'Downloaded vd-theme.css.');
  }

  function openHistory() {
    VD.repository.themeHistory(state.app).then(function (r) {
      state.versions = r.versions || []; renderRight();
    }).catch(function (e) { setMessage(e.message); });
  }

  function restore(id) {
    if (!window.confirm('Put theme version ' + id + ' back into app ' + state.app + '? Page 0 is re-imported, so signed-in users must log in again.')) return;
    state.busy = true; renderTop(); setMessage('Restoring version ' + id + '…');
    VD.repository.restoreTheme(state.app, id).then(function (r) {
      state.versions = null;
      setMessage('Version ' + id + ' is live again as version ' + r.versionId + '.');
      return load();
    }).catch(function (e) { state.busy = false; setMessage(e.message); renderTop(); });
  }

  // ------------------------------------------------------------ rendering
  function skeleton() {
    host.innerHTML =
      '<div class="lk-top th-top"></div><div class="lk-msg th-msg" role="status"></div>' +
      '<div class="lk-body"><aside class="lk-left th-left"></aside>' +
      '<section class="lk-center"><div class="lk-preview th-preview"></div></section>' +
      '<aside class="lk-right th-right"></aside></div><style id="th-gallery-css"></style><style id="th-thumbs-css"></style>';
  }

  function renderTop() {
    var top = host.querySelector('.th-top'), errs = errors(), blocked = state.busy || errs.length > 0;
    top.innerHTML =
      '<strong class="fl-title">Theme Designer</strong>' +
      '<span class="lk-state">App ' + esc(state.app) + ' · ' + (dirty() ? 'Unsaved changes' : 'Saved') +
      (state.pushed ? ' · live version ' + esc(state.pushed.versionId) : ' · not pushed yet') + '</span>' +
      '<span class="lk-spacer"></span>' +
      '<span class="th-toggle"><button class="vd-btn vd-btn--ghost' + (state.view === 'gallery' ? ' is-active' : '') + '" data-view-mode="gallery">Gallery</button>' +
      '<button class="vd-btn vd-btn--ghost' + (state.view === 'page' ? ' is-active' : '') + '" data-view-mode="page">Page</button></span>' +
      (state.view === 'page' ? '<label class="lk-inline">Page <input type="number" class="th-page" value="' + esc(state.page) + '"></label><button class="vd-btn vd-btn--secondary th-open">Show</button>' : '') +
      '<button class="vd-btn vd-btn--ghost th-history">History</button>' +
      '<button class="vd-btn vd-btn--ghost th-download"' + (errs.length ? ' disabled' : '') + '>Download CSS</button>' +
      '<button class="vd-btn vd-btn--secondary th-save"' + (blocked || !dirty() ? ' disabled' : '') + '>Save draft</button>' +
      '<button class="vd-btn vd-btn--primary th-push"' + (blocked ? ' disabled' : '') + '>Push to app</button>';
    top.querySelectorAll('[data-view-mode]').forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.getAttribute('data-view-mode'); renderTop(); loadPreview(); });
    });
    var open = top.querySelector('.th-open');
    if (open) open.addEventListener('click', function () {
      var pg = Number(top.querySelector('.th-page').value);
      if (!(pg >= 0)) { setMessage('Enter a page number.'); return; }
      state.page = pg; loadPreview();
    });
    top.querySelector('.th-history').addEventListener('click', openHistory);
    top.querySelector('.th-download').addEventListener('click', download);
    top.querySelector('.th-save').addEventListener('click', saveDraft);
    top.querySelector('.th-push').addEventListener('click', push);
    var msg = host.querySelector('.th-msg');
    msg.textContent = errs.length ? errs.join(' ') : state.message;
    msg.classList.toggle('is-error', errs.length > 0);
  }

  function renderLeft() {
    var left = host.querySelector('.th-left');
    left.innerHTML = '<button class="lk-slot' + (state.type === null ? ' is-selected' : '') + '" data-global="1"><b>Global</b><span>Page background, font, accent</span></button>' +
      groups().map(function (g) {
        return '<h3>' + g[0] + '</h3>' + g[1].map(function (type) {
          var list = styles(state.theme, type);
          return '<div class="th-type"><div class="th-type-head"><b>' + esc(T().names[type]) + '</b><button class="th-add" data-add="' + type + '" title="Add a style">+ Style</button></div>' +
            list.map(function (s, i) {
              return '<button class="lk-slot' + (state.type === type && state.index === i ? ' is-selected' : '') + '" data-type="' + type + '" data-index="' + i + '"><b>' + esc(s.name) +
                (s.isDefault ? ' <em>default</em>' : '') + '</b><span>vd-' + type + '-' + esc(s.cls) + ' · ' + esc((V().get(type, s.variant) || {}).label || '?') + '</span></button>';
            }).join('') + '</div>';
        }).join('');
      }).join('');
    left.querySelector('[data-global]').addEventListener('click', function () { state.type = null; state.index = -1; state.versions = null; render(); });
    left.querySelectorAll('[data-type]').forEach(function (b) {
      b.addEventListener('click', function () { select(b.getAttribute('data-type'), Number(b.getAttribute('data-index'))); });
    });
    left.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function () {
        var type = b.getAttribute('data-add'), n = styles(state.theme, type).length + 1, name = 'Style ' + n;
        state.theme = addStyle(state.theme, type, name, suggestClass(state.theme, type, name), 'v1');
        select(type, n - 1);
      });
    });
  }

  function historyHtml() {
    return '<h3>Theme history</h3>' + (state.versions.length ? state.versions.map(function (v) {
      var live = v.note !== 'DRAFT';
      return '<div class="lk-slot"><b>Version ' + esc(v.versionId) + ' · ' + esc(v.note.toLowerCase()) + '</b><span>' + esc(v.savedBy) + ' · ' + esc((v.savedAt || '').replace('T', ' ').slice(0, 16)) + '</span>' +
        (live ? '<button class="vd-btn vd-btn--ghost" data-restore="' + esc(v.versionId) + '">Restore</button>' : '') + '</div>';
    }).join('') : '<p class="lk-hint">No versions yet.</p>') + '<button class="vd-btn vd-btn--secondary th-close-history">Close</button>';
  }

  function globalHtml() {
    var g = state.theme.global || {}, fonts = V().forType('text')[0].params.filter(function (p) { return p.key === 'fontFamily'; })[0].options;
    return '<h3>Global</h3><p class="lk-hint">Applies to every page that uses the theme.</p>' +
      '<label class="fl-param"><span>Page background</span><span class="fl-color' + (g.pageBg ? '' : ' is-empty') + '"><input type="color" data-global="pageBg" value="' + esc(g.pageBg || '#ffffff') + '"><button type="button" class="fl-clear" data-clear-global="pageBg" title="Back to default">×</button></span></label>' +
      '<label class="fl-param"><span>Font</span><select data-global="fontFamily"><option value="">Default</option>' + fonts.map(function (f) {
        return '<option' + (g.fontFamily === f ? ' selected' : '') + '>' + f + '</option>';
      }).join('') + '</select></label>' +
      '<label class="fl-param"><span>Accent for new styles</span><input type="color" data-global="accent" value="' + esc(g.accent || '#1a73e8') + '"></label>';
  }

  function styleHtml(s) {
    var variant = V().get(state.type, s.variant), thumbs = P().thumbnails(state.type, s.variant);
    host.querySelector('#th-thumbs-css').textContent = thumbs.css;
    return '<h3>' + esc(T().names[state.type]) + ' style</h3>' +
      '<label class="lk-f">Name<input type="text" class="th-name" maxlength="40" value="' + esc(s.name) + '"></label>' +
      '<label class="lk-f">Class<span class="th-cls"><code>vd-' + state.type + '-</code><input type="text" class="th-cls-input" maxlength="31" value="' + esc(s.cls) + '">' +
      '<button type="button" class="vd-btn vd-btn--ghost th-copy" title="Copy the class">Copy</button></span></label>' +
      '<label class="lk-f lk-f--chk"><input type="checkbox" class="th-default"' + (s.isDefault ? ' checked' : '') + '> Default style (components with no style class get it)</label>' +
      '<div class="fl-variants">' + thumbs.html + '</div>' +
      (variant ? P().html(variant, s.values, state.open) : '') +
      '<button class="vd-btn vd-btn--ghost lk-remove th-remove">Remove style</button>';
  }

  function renderRight() {
    var right = host.querySelector('.th-right'), s = current();
    host.querySelector('#th-thumbs-css').textContent = '';
    if (state.versions) {
      right.innerHTML = historyHtml();
      right.querySelectorAll('[data-restore]').forEach(function (b) {
        b.addEventListener('click', function () { restore(Number(b.getAttribute('data-restore'))); });
      });
      right.querySelector('.th-close-history').addEventListener('click', function () { state.versions = null; renderRight(); });
      return;
    }
    if (!s) {
      right.innerHTML = globalHtml();
      right.querySelectorAll('[data-global]').forEach(function (inp) {
        inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', function () {
          var t = clone(state.theme); t.global[inp.getAttribute('data-global')] = inp.value;
          if (inp.parentNode.classList.contains('fl-color')) inp.parentNode.classList.remove('is-empty');
          update(t);
        });
      });
      right.querySelectorAll('[data-clear-global]').forEach(function (b) {
        b.addEventListener('click', function () { var t = clone(state.theme); delete t.global[b.getAttribute('data-clear-global')]; update(t, true); });
      });
      return;
    }
    var type = state.type, i = state.index;
    right.innerHTML = styleHtml(s);
    right.querySelector('.th-name').addEventListener('change', function (e) { update(setStyleField(state.theme, type, i, 'name', e.target.value.trim() || s.name), true); });
    right.querySelector('.th-cls-input').addEventListener('change', function (e) { update(setStyleField(state.theme, type, i, 'cls', e.target.value.trim()), true); });
    right.querySelector('.th-copy').addEventListener('click', function () {
      var text = 'vd-' + type + '-' + current().cls;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(function () { setMessage('Copied ' + text + '.'); }, function () { setMessage(text); });
      else setMessage(text);
    });
    right.querySelector('.th-default').addEventListener('change', function (e) {
      update(e.target.checked ? setDefault(state.theme, type, i) : setStyleField(state.theme, type, i, 'isDefault', false), true);
    });
    right.querySelector('.th-remove').addEventListener('click', function () {
      if (!window.confirm('Remove the style "' + s.name + '"? Components that use vd-' + type + '-' + s.cls + ' fall back to the default once you push.')) return;
      state.theme = removeStyle(state.theme, type, i); state.type = null; state.index = -1; render();
    });
    right.querySelectorAll('[data-variant]').forEach(function (b) {
      b.addEventListener('click', function () { update(setStyleField(state.theme, type, i, 'variant', b.getAttribute('data-variant')), true); });
    });
    var variant = V().get(type, s.variant);
    if (variant) {
      P().bind(right, variant, function (key, raw) { update(setValue(state.theme, type, i, key, raw)); },
        function (which, open) { state.open[which] = open; });
    }
  }

  function render(reloadPreview) {
    if (!host) return;
    if (!host.querySelector('.th-preview')) { skeleton(); reloadPreview = true; }
    renderTop(); renderLeft(); renderRight();
    if (reloadPreview) loadPreview(); else applyPreview();
  }

  VD.themeMode = {
    enter: function () {
      host = document.getElementById('theme-host');
      if (state.app == null && VD.config && VD.config.app) state.app = VD.config.app;
      if (state.app == null) { host.innerHTML = '<p class="lk-hint" style="padding:16px">Set a default target application on the Visual Designer region to use the Theme Designer.</p>'; return; }
      if (!host) return;
      if (!host.querySelector('.th-preview')) { render(true); load(); } else render();
    },
    helpers: { emptyTheme: emptyTheme, addStyle: addStyle, removeStyle: removeStyle, setDefault: setDefault,
      setValue: setValue, setStyleField: setStyleField, suggestClass: suggestClass, sample: sample, groups: groups }
  };
})();
