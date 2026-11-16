/* APEX Visual Designer — application shell: routes the rail items to their views. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;

  // Set by the region's render: index.html?v=<version>&ajax=<AJAX identifier>&app=<default target app>.
  var params = new URLSearchParams(location.search);
  VD.config = { ajax: params.get('ajax'), app: Number(params.get('app')) || null, build: params.get('v') };

  // view name -> module with enter() and, optionally, leave(onLeave) -> false to stay on the view
  var VIEWS = {
    flutter: function () { return VD.flutterMode; },
    theme: function () { return VD.themeMode; },
    layout: function () { return VD.layoutMode; },
    saved: function () { return VD.savedDesigns; }
  };
  var DEFAULT_VIEW = 'flutter';
  // Views that work on one page; the shared page bar shows only on these.
  var PAGE_VIEWS = { flutter: true, layout: true };

  var current = null;

  // A one-line hint under a view's toolbar. Closing it keeps it closed for that view.
  function hintHtml(mode, text) {
    var closed = false;
    try { closed = window.localStorage.getItem('vd-hint-' + mode) === '1'; } catch (e) { /* storage blocked */ }
    if (closed) return '';
    return '<div class="vd-hint" data-hint="' + mode + '"><span>' + text + '</span>' +
      '<button type="button" class="vd-hint-close" title="Hide this hint" aria-label="Hide this hint">×</button></div>';
  }
  function bindHints(root) {
    root.querySelectorAll('.vd-hint').forEach(function (el) {
      var key = 'vd-hint-' + el.getAttribute('data-hint');
      el.querySelector('.vd-hint-close').addEventListener('click', function () {
        try { window.localStorage.setItem(key, '1'); } catch (e) { /* not kept */ }
        el.remove();
      });
    });
  }
  VD.hints = { html: hintHtml, bind: bindHints };

  // Native dialogs are blocked in the iframes the editor runs in, so their calls return false
  // at once. ask() shows the same question inside the editor document: resolves true for the OK
  // button, false for Cancel, Escape or a second question that replaces this one. Line breaks in
  // the message are kept (the CSS uses white-space: pre-line). With opts.input (a string, the
  // starting value) the question also has a text field and resolves its text, or null.
  var askOpen = null, askId = 0;
  function ask(message, opts) {
    opts = opts || {};
    var withInput = typeof opts.input === 'string';
    if (askOpen) askOpen(false);
    var previous = document.activeElement;
    return new Promise(function (resolve) {
      askId += 1;
      var id = 'vd-ask-msg-' + askId;
      var backdrop = document.createElement('div');
      backdrop.className = 'vd-ask-backdrop';
      var box = document.createElement('div');
      box.className = 'vd-ask';
      box.setAttribute('role', 'alertdialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-labelledby', id);
      var text = document.createElement('p');
      text.className = 'vd-ask-message';
      text.id = id;
      text.textContent = message;
      var actions = document.createElement('div');
      actions.className = 'vd-ask-actions';
      var cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'vd-btn vd-btn--secondary vd-ask-cancel';
      cancel.textContent = opts.cancel || 'Cancel';
      var ok = document.createElement('button');
      ok.type = 'button';
      ok.className = 'vd-btn vd-btn--primary vd-ask-ok';
      ok.textContent = opts.ok || 'OK';
      actions.appendChild(cancel);
      actions.appendChild(ok);
      box.appendChild(text);
      var field = null;
      if (withInput) {
        field = document.createElement('input');
        field.type = 'text';
        field.className = 'vd-ask-input';
        field.value = opts.input;
        field.maxLength = opts.maxLength || 200;
        field.setAttribute('aria-labelledby', id);
        field.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); close(true); } });
        box.appendChild(field);
      }
      box.appendChild(actions);
      backdrop.appendChild(box);
      document.body.appendChild(backdrop);

      var closed = false;
      function close(result) {
        if (closed) return;
        closed = true;
        if (askOpen === close) askOpen = null;
        document.removeEventListener('keydown', onKey, true);
        backdrop.remove();
        if (previous && previous.focus && document.contains(previous)) previous.focus();
        resolve(withInput ? (result ? field.value : null) : result);
      }
      function onKey(ev) {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); close(false); return; }
        if (ev.key !== 'Tab') return;
        // aria-modal: keep Tab inside the two buttons of this question.
        var first = field || cancel, last = ok, active = document.activeElement;
        if (field && active === cancel) return;
        if (active !== first && active !== last) { ev.preventDefault(); (ev.shiftKey ? last : first).focus(); return; }
        if (ev.shiftKey && active === first) { ev.preventDefault(); last.focus(); }
        else if (!ev.shiftKey && active === last) { ev.preventDefault(); first.focus(); }
      }
      ok.addEventListener('click', function () { close(true); });
      cancel.addEventListener('click', function () { close(false); });
      document.addEventListener('keydown', onKey, true);
      askOpen = close;
      if (field) { field.focus(); field.select(); } else ok.focus();
    });
  }
  VD.ask = ask;

  // route(name [, allowed]): allowed skips the leaving view's question, for the continuation a
  // view calls back with once its question is answered (saved, applied or changes discarded).
  function route(name, allowed) {
    if (!VIEWS[name]) name = DEFAULT_VIEW;
    if (current && current !== name && !allowed) {
      var from = VIEWS[current]();
      if (from && from.leave && from.leave(function () { route(name, true); }) === false) {
        try { history.replaceState(null, '', '#/' + current); } catch (e) { /* hash stays */ }
        return;
      }
    }
    current = name;
    document.querySelectorAll('[data-view]').forEach(function (b) {
      var on = b.getAttribute('data-view') === name;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    ['flutter', 'theme', 'layout', 'saved'].forEach(function (v) {
      document.body.classList.toggle('vd-screen-' + (v === 'flutter' ? 'items' : v), v === name);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + name);
    });
    if (location.hash !== '#/' + name) {
      try { history.replaceState(null, '', '#/' + name); } catch (e) { location.hash = '#/' + name; }
    }
    var bar = document.getElementById('page-bar');
    if (bar) bar.hidden = !PAGE_VIEWS[name];
    // Views without the page bar still show which application they work on.
    var appTag = document.querySelector('.studio-app');
    if (appTag) {
      appTag.hidden = !!PAGE_VIEWS[name];
      appTag.textContent = 'Application ' + ((VD.config && VD.config.app) || '');
    }
    var mode = VIEWS[name]();
    if (mode) mode.enter();
  }

  // Opens a page from the page bar in the current view. The view may say no (unsaved changes kept);
  // then the bar keeps the page that is open now. confirmed: the view's discard question was answered.
  function openPage(app, page, confirmed) {
    var mode = VIEWS[current] && VIEWS[current]();
    if (!mode || !mode.open || mode.open(app, page, confirmed) === false) return;
    VD.pageBar.remember(app, page);
  }

  // Short guides for the Help button of the rail, one per workspace.
  var GUIDES = {
    flutter: 'Design Studio: pick a component on the left, point at a look in the gallery to try it on the page, click to keep it.\nSave to page writes the design into the live page.',
    theme: 'Theme Lab: choose a style category, then a look for the whole application.\nSave draft keeps it for you only. Publish theme writes it to the live application.',
    layout: 'Layout Studio: drag the boxes of the page to move them, and their edges to resize them.\nApply to page writes the new layout into the live page.',
    saved: 'Design Library: looks you saved as theme styles. Use one on any page from the Design gallery.'
  };

  var STATUS_TEXT = { offline: 'Not in APEX', ready: 'Ready', connected: 'Connected to APEX', error: 'Connection problem' };

  // The top bar's appearance switch, connection state and More menus, and the rail's Help button.
  function bindStudio() {
    var stat = document.querySelector('.studio-status');
    if (stat && VD.repository && VD.repository.onStatus) VD.repository.onStatus(function (s) {
      stat.setAttribute('data-state', s);
      stat.querySelector('.studio-status-text').textContent = STATUS_TEXT[s] || s;
    });
    // An open More menu closes with Escape or a click outside it.
    function closeMenus(except) {
      document.querySelectorAll('details.vd-more[open]').forEach(function (d) { if (d !== except) d.open = false; });
    }
    document.addEventListener('click', function (e) { closeMenus(e.target.closest && e.target.closest('details.vd-more')); });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelector('details.vd-more[open]');
      if (!open) return;
      open.open = false;
      var s = open.querySelector('summary');
      if (s) s.focus();
    });
    var root = document.documentElement;
    var look = document.querySelector('.studio-appearance');
    function showLook() {
      var light = root.getAttribute('data-appearance') === 'light';
      look.setAttribute('aria-pressed', String(light));
    }
    if (look) {
      showLook();
      look.addEventListener('click', function () {
        var light = root.getAttribute('data-appearance') !== 'light';
        if (light) root.setAttribute('data-appearance', 'light'); else root.removeAttribute('data-appearance');
        try { window.localStorage.setItem('vd-appearance', light ? 'light' : 'dark'); } catch (e) { /* not kept */ }
        showLook();
      });
    }
    var help = document.querySelector('.studio-help');
    if (help) help.addEventListener('click', function () {
      ask((GUIDES[current] || '') + '\n\nClosed hints come back the next time the designer opens.', { ok: 'Show hints again', cancel: 'Close' }).then(function (ok) {
        if (!ok) return;
        try {
          Object.keys(window.localStorage).forEach(function (k) { if (k.indexOf('vd-hint-') === 0) window.localStorage.removeItem(k); });
        } catch (e) { /* storage blocked */ }
      });
    });
  }

  // Heading block of a side panel: a small eyebrow, the title and one line of help.
  VD.studio = {
    paneHead: function (eyebrow, title, text) {
      return '<div class="vd-pane-heading"><span class="vd-pane-eyebrow">' + eyebrow + '</span><strong class="vd-pane-title">' + title +
        '</strong>' + (text ? '<span class="vd-pane-description">' + text + '</span>' : '') + '</div>';
    }
  };

  function init() {
    VD.app = { route: route, openPage: openPage };
    var bar = document.getElementById('page-bar');
    if (bar) VD.pageBar.render(bar, { app: VD.config.app, onOpen: openPage });
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { route(b.getAttribute('data-view')); });
    });
    bindStudio();
    window.addEventListener('hashchange', function () { route((location.hash || '').replace(/^#\//, '')); });
    route((location.hash || '').replace(/^#\//, ''));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
