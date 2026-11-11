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

  var SAMPLES = {
    field: '<div class="t-Form-fieldContainer"><div class="t-Form-labelContainer"><label class="t-Form-label">Label</label></div>' +
      '<div class="t-Form-inputContainer"><input class="text_field apex-item-text" value="Text"></div></div>',
    choice: '<div class="apex-item-group"><div class="apex-item-option"><input type="radio" checked id="§a"><label for="§a">One</label></div>' +
      '<div class="apex-item-option"><input type="radio" id="§b"><label for="§b">Two</label></div></div>',
    'switch': '<span class="a-Switch"><input type="checkbox" checked><span class="a-Switch-toggle"></span></span>',
    button: '<button type="button" class="t-Button">Button</button>',
    display: '<span class="display_only">Value</span>',
    region: '<div class="t-Region"><div class="t-Region-header"><h2 class="t-Region-title">Title</h2></div><div class="t-Region-body">Body</div></div>',
    classic: '<table class="t-Report-report"><thead><tr><th>Name</th><th>Date</th></tr></thead><tr><td>One</td><td>1</td></tr><tr><td>Two</td><td>2</td></tr></table>',
    ir: '<table class="a-IRR-table"><tr><th class="a-IRR-header">Name</th><th class="a-IRR-header">Date</th></tr><tr><td>One</td><td>1</td></tr><tr><td>Two</td><td>2</td></tr></table>',
    ig: '<div class="a-GV"><table><tr class="a-GV-header"><th>Name</th><th>Date</th></tr><tr class="a-GV-row"><td>One</td><td>1</td></tr><tr class="a-GV-row"><td>Two</td><td>2</td></tr></table></div>',
    cards: '<div class="a-CardView"><div class="a-CardView-media"></div><div class="a-CardView-body"><div class="a-CardView-title">Card</div></div></div>'
  };
  function sample(type) {
    return SAMPLES[type] || (type === 'text' || type === 'date' || type === 'select' ? SAMPLES.field : '');
  }
  // Six design thumbnails for a type; css styles them, each scoped to its own id.
  function thumbnails(type, current) {
    var css = '';
    var html = V().forType(type).map(function (v) {
      var id = 'fl-thumb-' + v.id;
      // Region, button and cards variants style the element that carries the id.
      var inner = sample(type).replace(/§/g, id + '-');
      var wrapped = type === 'button' ? inner.replace('<button ', '<button id="' + id + '" ')
        : type === 'region' ? inner.replace('<div class="t-Region"', '<div class="t-Region" id="' + id + '"')
        : '<div id="' + id + '">' + inner + '</div>';
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
    if (p.group && p.kind === 'color') {
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

  // openState: { advanced, hide } — the Icon section is always open.
  function html(variant, values, openState) {
    values = values || {}; openState = openState || {};
    var field = function (p) {
      return '<label class="fl-param"><span>' + esc(p.label) + '</span>' + paramInput(p, values[p.key]) + '</label>';
    };
    var of = function (g) { return variant.params.filter(function (p) { return p.group === g; }); };
    return '<h3>' + esc(variant.label) + ' settings</h3>' +
      variant.params.filter(function (p) { return !p.group; }).map(field).join('') +
      section('fl-icon-section', 'Icon', of('icon'), true, field) +
      section('fl-hide-section', 'Show / hide', of('hide'), openState.hide, field) +
      section('fl-adv-section', 'Advanced', of('advanced').filter(function (p) { return p.key !== 'ripple' || variant.needsJs; }), openState.advanced, field);
  }

  // Wires the inputs html() made: onValue(key, raw) on every change ('' = back to default),
  // onToggle('hide' | 'advanced', open) when a section opens or closes.
  function bind(root, variant, onValue, onToggle) {
    [['.fl-hide-section', 'hide'], ['.fl-adv-section', 'advanced']].forEach(function (s) {
      var d = root.querySelector(s[0]);
      if (d && onToggle) d.addEventListener('toggle', function () { onToggle(s[1], d.open); });
    });
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
      });
    });
    root.querySelectorAll('[data-clear]').forEach(function (b) {
      b.addEventListener('click', function () {
        b.parentNode.classList.add('is-empty');
        b.previousSibling.title = 'Default (not set)';
        onValue(b.getAttribute('data-clear'), '');
      });
    });
  }

  window.VD.flParams = { esc: esc, sample: sample, thumbnails: thumbnails, html: html, bind: bind };
})();
