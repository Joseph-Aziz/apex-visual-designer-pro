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
    var mode = VIEWS[name]();
    if (mode) mode.enter();
  }

  function init() {
    VD.app = { route: route };
    document.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { route(b.getAttribute('data-view')); });
    });
    window.addEventListener('hashchange', function () { route((location.hash || '').replace(/^#\//, '')); });
    route((location.hash || '').replace(/^#\//, ''));
  }

  document.addEventListener('DOMContentLoaded', init);
})();
