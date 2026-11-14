/* APEX Visual Designer — shared page bar: the one place a page is opened for the page views. */
(function () {
  window.VD = window.VD || {};
  var KEY = 'vd.page';
  var kept = null; // the open page; also the fallback when browser storage is blocked

  function whole(text, min) {
    var s = String(text == null ? '' : text).trim();
    if (!/^\d+$/.test(s)) return null;
    var n = Number(s);
    return n >= min ? n : null;
  }

  // Reads the App and Page fields. Page 0 is a page; an application number starts at 1.
  function parse(appText, pageText) {
    var app = whole(appText, 1), page = whole(pageText, 0);
    if (app == null || page == null) return { error: 'Enter an app and page number.' };
    return { app: app, page: page };
  }

  function valid(p) { return !!p && typeof p.app === 'number' && typeof p.page === 'number'; }

  function current() {
    if (kept) return { app: kept.app, page: kept.page };
    try {
      var p = JSON.parse(window.localStorage.getItem(KEY));
      if (valid(p)) { kept = { app: p.app, page: p.page }; return { app: p.app, page: p.page }; }
    } catch (e) { /* no page */ }
    return null;
  }

  function remember(app, page) {
    kept = { app: app, page: page };
    try { window.localStorage.setItem(KEY, JSON.stringify(kept)); } catch (e) { /* kept in memory only */ }
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Registers an application of this workspace as a designer target; resolves to the message to show.
  function addApp(app) {
    if (!app) return Promise.resolve('Enter an application number.');
    return window.VD.repository.registerApp(app).then(
      function () { return 'Application ' + app + ' added. Enter a page number and open it.'; },
      function (e) { return e.message; });
  }

  // Draws the bar into el. opts: app (default application), onOpen(app, page).
  function render(el, opts) {
    var p = current() || { app: opts.app || '', page: '' };
    el.innerHTML =
      '<strong>Page</strong>' +
      '<label class="lk-inline">App <input type="number" class="pb-app" min="1" value="' + esc(p.app) + '"></label>' +
      '<label class="lk-inline">Page <input type="number" class="pb-page" min="0" value="' + esc(p.page) + '"></label>' +
      '<button class="vd-btn vd-btn--ghost pb-add-app" title="Let the designer work on this application">Add application</button>' +
      '<button class="vd-btn vd-btn--secondary pb-open">Open page</button>' +
      '<span class="lk-msg pb-msg" role="status"></span>';
    var msg = el.querySelector('.pb-msg');
    el.querySelector('.pb-open').addEventListener('click', function () {
      var r = parse(el.querySelector('.pb-app').value, el.querySelector('.pb-page').value);
      msg.textContent = r.error || '';
      if (!r.error) opts.onOpen(r.app, r.page);
    });
    el.querySelector('.pb-add-app').addEventListener('click', function () {
      var app = whole(el.querySelector('.pb-app').value, 1);
      msg.textContent = app == null ? '' : 'Adding application ' + app + '…';
      addApp(app).then(function (text) { msg.textContent = text; });
    });
  }

  window.VD.pageBar = { parse: parse, current: current, remember: remember, addApp: addApp, render: render };
})();
