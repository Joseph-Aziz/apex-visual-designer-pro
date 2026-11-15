/* APEX Visual Designer — the design settings panel shared by the Flutter Designer and the
   Theme Designer: design thumbnails, then Basic, Icon, Show / hide and Advanced settings. */
(function () {
  window.VD = window.VD || {};
  var V = function () { return window.VD.flutterVariants; };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // The family's thumbnail markup, with {id} left in for the thumbnail's own id.
  function sample(type) {
    var f = window.VD.componentRegistry.family(type);
    return (f && f.sample) || '';
  }
  // Six design thumbnails for a type; css styles them, each scoped to its own id.
  function thumbnails(type, current) {
    var css = '';
    var html = V().forType(type).map(function (v) {
      var id = 'fl-thumb-' + v.id;
      // Markup that carries id="{id}" is the element the design styles; anything else is wrapped.
      var inner = sample(type).replace(/\{id\}/g, id);
      var wrapped = sample(type).indexOf('id="{id}"') >= 0 ? inner : '<div id="' + id + '">' + inner + '</div>';
      css += v.css('#' + id, V().values(v, {}));
      return '<button class="fl-variant' + (current === v.id ? ' is-selected' : '') + '" data-variant="' + v.id + '">' +
        '<span class="fl-thumb">' + wrapped + '</span><b>' + esc(v.label) + '</b></button>';
    }).join('');
    return { html: html, css: css };
  }

  function paramInput(p, value) {
    var v = value == null ? p.default : value;
    if (p.kind === 'select') {
      return '<select data-param="' + p.key + '"><option value="">Default</option>' + p.options.map(function (o) {
        return '<option' + (String(v) === o ? ' selected' : '') + '>' + esc(o) + '</option>';
      }).join('') + '</select>';
    }
    if (p.kind === 'css') return '<textarea rows="3" data-param="' + p.key + '" placeholder="opacity:.9; cursor:pointer" spellcheck="false">' + esc(v) + '</textarea>';
    if (p.section && p.kind === 'color') {
      // A colour picker that can also be empty ("as the design has it"): × clears it.
      var empty = !/^#[0-9a-f]{6}$/i.test(v);
      return '<span class="fl-color' + (empty ? ' is-empty' : '') + '"><input type="color" data-param="' + p.key + '" value="' + esc(empty ? '#ffffff' : v) + '"' +
        ' title="' + (empty ? 'Default (not set)' : esc(v)) + '"><button type="button" class="fl-clear" data-clear="' + p.key + '" title="Back to default" aria-label="Back to default">×</button></span>';
    }
    if (p.kind === 'number') return '<input type="number" step="any" min="0" max="99" data-param="' + p.key + '" value="' + esc(v) + '">';
    if (p.kind === 'color') return '<input type="color" data-param="' + p.key + '" value="' + esc(/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000') + '">';
    if (p.kind === 'weight') {
      return '<select data-param="' + p.key + '">' + [300, 400, 500, 600, 700].map(function (w) {
        return '<option' + (Number(v) === w ? ' selected' : '') + '>' + w + '</option>';
      }).join('') + '</select>';
    }
    return '<input type="number" min="0" max="999" data-param="' + p.key + '" value="' + esc(v) + '">';
  }


  function section(cls, title, params, open, field) {
    return params.length ? '<details class="fl-advanced ' + cls + '"' + (open ? ' open' : '') + '><summary>' + title + '</summary>' +
      params.map(field).join('') + '</details>' : '';
  }

  // The panel sections after Basic, in order. A setting with no section is Basic, drawn first.
  var SECTIONS = [
    { id: 'icon', cls: 'fl-icon-section', label: 'Icon', open: true },
    { id: 'hide', cls: 'fl-hide-section', label: 'Show / hide' },
    { id: 'advanced', cls: 'fl-adv-section', label: 'Advanced' }
  ];

  // openState: { advanced, hide } — the Icon section is always open. A setting whose dependency
  // is false is drawn hidden; bind shows it when the setting it depends on changes.
  function html(variant, values, openState) {
    values = values || {}; openState = openState || {};
    var vals = V().values(variant, values);
    var field = function (p) {
      return '<label class="fl-param" data-for="' + esc(p.key) + '"' + (V().active(variant, p, vals) ? '' : ' hidden') + '><span>' +
        esc(p.label) + '</span>' + paramInput(p, values[p.key]) + '</label>';
    };
    var of = function (id) { return variant.params.filter(function (p) { return (p.section || 'basic') === id; }); };
    return '<h3>' + esc(variant.label) + ' settings</h3>' + of('basic').map(field).join('') +
      SECTIONS.map(function (sc) { return section(sc.cls, sc.label, of(sc.id), sc.open || openState[sc.id], field); }).join('');
  }

  // Wires the inputs html() made: onValue(key, raw) on every change ('' = back to default),
  // onToggle('hide' | 'advanced', open) when a section opens or closes.
  function bind(root, variant, onValue, onToggle) {
    SECTIONS.forEach(function (sc) {
      var d = root.querySelector('.' + sc.cls);
      if (d && onToggle && !sc.open) d.addEventListener('toggle', function () { onToggle(sc.id, d.open); });
    });
    // Shows or hides the settings that depend on others, from the values now in the inputs.
    function refresh() {
      var raw = {};
      root.querySelectorAll('[data-param]').forEach(function (inp) {
        var v = inp.value.trim();
        if (v !== '' && !(inp.parentNode.classList.contains('is-empty'))) raw[inp.getAttribute('data-param')] = v;
      });
      var vals = V().values(variant, raw);
      variant.params.forEach(function (p) {
        var row = p.dependsOn && root.querySelector('[data-for="' + p.key + '"]');
        if (row) row.hidden = !V().active(variant, p, vals);
      });
    }
    root.querySelectorAll('[data-param]').forEach(function (inp) {
      inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', function () {
        var key = inp.getAttribute('data-param');
        var prm = variant.params.filter(function (x) { return x.key === key; })[0];
        var raw = inp.value.trim();
        var bad = raw !== '' && V().cleanParam(prm, raw) == null;
        inp.classList.toggle('is-invalid', bad);
        inp.title = bad ? 'Not allowed here; the default is used.' : '';
        if (inp.parentNode.classList.contains('fl-color')) { inp.parentNode.classList.remove('is-empty'); inp.title = raw; }
        onValue(key, raw);
        refresh();
      });
    });
    root.querySelectorAll('[data-clear]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.parentNode.classList.add('is-empty');
        b.previousSibling.title = 'Default (not set)';
        onValue(b.getAttribute('data-clear'), '');
        refresh();
      });
    });
  }

  window.VD.flParams = { esc: esc, sample: sample, thumbnails: thumbnails, html: html, bind: bind };
})();
