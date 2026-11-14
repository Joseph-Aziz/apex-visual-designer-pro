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
    layout: function () { return VD.layoutMode; }
  };
  var DEFAULT_VIEW = 'flutter';
  // Views that work on one page; the shared page bar shows only on these.
  var PAGE_VIEWS = { flutter: true, layout: true };

  var current = null;

  function route(name) {
    if (!VIEWS[name]) name = DEFAULT_VIEW;
    if (current && current !== name) {
      var from = VIEWS[current]();
      if (from && from.leave && from.leave(function () { route(name); }) === false) {
        try { history.replaceState(null, '', '#/' + current); } catch (e) { /* hash stays */ }
        return;
      }
    }
    current = name;
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-view') === name);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('is-active', v.id === 'view-' + name);
    });
    if (location.hash !== '#/' + name) {
      try { history.replaceState(null, '', '#/' + name); } catch (e) { location.hash = '#/' + name; }
    }
    var bar = document.getElementById('page-bar');
    if (bar) bar.hidden = !PAGE_VIEWS[name];
    var mode = VIEWS[name]();
    if (mode) mode.enter();
  }

  // Opens a page from the page bar in the current view. The view may say no (unsaved changes kept);
  // then the bar keeps the page that is open now.
  function openPage(app, page) {
    var mode = VIEWS[current] && VIEWS[current]();
    if (!mode || !mode.open || mode.open(app, page) === false) return;
    VD.pageBar.remember(app, page);
  }

  function init() {
    VD.app = { route: route };
    var bar = document.getElementById('page-bar');
    if (bar) VD.pageBar.render(bar, { app: VD.config.app, onOpen: openPage });
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { route(b.getAttribute('data-view')); });
    });
    window.addEventListener('hashchange', function () { route((location.hash || '').replace(/^#\//, '')); });
    route((location.hash || '').replace(/^#\//, ''));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
