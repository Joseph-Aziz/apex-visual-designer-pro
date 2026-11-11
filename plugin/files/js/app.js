/* APEX Visual Designer — application shell: routes the rail items to their views. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;

  // view name -> module with enter()
  var VIEWS = {
    flutter: function () { return VD.flutterMode; },
    theme: function () { return VD.themeMode; }
  };
  var DEFAULT_VIEW = 'flutter';

  function route(name) {
    if (!VIEWS[name]) name = DEFAULT_VIEW;
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
