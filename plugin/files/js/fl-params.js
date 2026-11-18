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

  // The thumbnail markup of a member, else of its family, with {id} left in for the thumbnail's own id.
  function sample(type, member) {
    if (member && member.sample) return member.sample;
    var f = window.VD.componentRegistry.family(type);
    return (f && f.sample) || '';
  }
  // The sample markup with a design applied, scoped to its own id.
  function card(type, id, variant, values, member) {
    // Markup that carries id="{id}" is the element the design styles; anything else is wrapped.
    var raw = sample(type, member), inner = raw.replace(/\{id\}/g, id);
    return { html: raw.indexOf('id="{id}"') >= 0 ? inner : '<div id="' + id + '">' + inner + '</div>',
      css: variant.css('#' + id, V().values(variant, values || {})) };
  }
  // The member of family type that a page component is, or null: its own type, else the catch-all.
  function memberOf(type, c) {
    var f = c && window.VD.componentRegistry.family(type);
    if (!f) return null;
    return f.members.filter(function (m) { return m.kind === c.kind && m.apexType && m.apexType === c.type; })[0] ||
      f.members.filter(function (m) { return m.kind === c.kind && !m.apexType; })[0] || null;
  }
  // The design thumbnails for a type, each with its Built-in badge.
  function thumbnails(type, current, member) {
    var css = '';
    var html = V().forType(type).map(function (v) {
      var c = card(type, 'fl-thumb-' + v.id, v, null, member);
      css += c.css;
      return '<div class="fl-variant' + (current === v.id ? ' is-selected' : '') + '" role="button" tabindex="0" data-variant="' + v.id + '">' +
        '<span class="fl-thumb" inert>' + c.html + '</span><b>' + esc(v.label) + '</b><span class="fl-badge">Built-in</span></div>';
    }).join('');
    return { html: html, css: css };
  }

  // The gallery both designers draw: the built-in designs, the application's presets for the
  // family, and the actions on the selected design.
  // opts: { current: design id, presets: [{ label, variant, values }], preset: index of the
  //         selected preset, canReset: the design has values, canSave: offer Save as preset,
  //         member: the registry member whose sample the cards draw }
  function gallery(type, opts) {
    opts = opts || {};
    var chosen = opts.preset != null;
    var t = thumbnails(type, chosen ? null : opts.current, opts.member), css = t.css;
    var presets = (opts.presets || []).map(function (pr, i) {
      var v = V().get(type, pr.variant);
      if (!v) return '';
      var c = card(type, 'fl-preset-' + i, v, pr.values, opts.member);
      css += c.css;
      return '<div class="fl-variant' + (chosen && opts.preset === i ? ' is-selected' : '') + '" role="button" tabindex="0" data-preset="' + i + '">' +
        '<span class="fl-thumb" inert>' + c.html + '</span><b>' + esc(pr.label) + '</b><span class="fl-badge fl-badge--custom">Custom</span></div>';
    }).join('');
    // Reset is always drawn, hidden while the design has no values, so a setting change can show it in place.
    var actions = '<button type="button" class="vd-btn vd-btn--ghost" data-gallery="reset" title="Keep the design and clear its settings"' + (opts.canReset ? '' : ' hidden') + '>Reset settings</button>' +
      (opts.canSave ? '<button type="button" class="vd-btn vd-btn--ghost" data-gallery="save" title="Keeps this look as a named style in the theme draft, for every page">Save as theme style</button>' : '');
    return { html: '<div class="fl-gallery"><div class="fl-variants">' + t.html + presets + '</div>' +
      '<div class="fl-gallery-actions">' + actions + '</div></div>', css: css };
  }
  // on: { pick(designId), preset(index), reset(), save(), tryOn(card) }; a missing handler leaves its
  // control inert. tryOn gets { variant } or { preset } while a card is pointed at or focused, null after.
  function bindGallery(root, on) {
    var tryOn = function (b, card) {
      if (!on.tryOn) return;
      // The pointer must move over the card: a gallery re-rendered under a resting pointer fires
      // mouseenter on whichever card lands there, which would preview a card nobody pointed at.
      var over = false;
      b.addEventListener('mousemove', function () { if (!over) { over = true; on.tryOn(card); } });
      b.addEventListener('focus', function () { on.tryOn(card); });
      b.addEventListener('mouseleave', function () { if (over) { over = false; on.tryOn(null); } });
      b.addEventListener('blur', function () { on.tryOn(null); });
    };
    // A card is a div with role=button: Enter and Space act like a click.
    var keys = function (b) {
      b.addEventListener('keydown', function (e) {
        if (e.target !== b || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        b.click();
      });
    };
    root.querySelectorAll('[data-variant]').forEach(function (b) {
      keys(b);
      b.addEventListener('click', function () { if (on.pick) on.pick(b.getAttribute('data-variant')); });
      tryOn(b, { variant: b.getAttribute('data-variant') });
    });
    root.querySelectorAll('[data-preset]').forEach(function (b) {
      keys(b);
      b.addEventListener('click', function () { if (on.preset) on.preset(Number(b.getAttribute('data-preset'))); });
      tryOn(b, { preset: Number(b.getAttribute('data-preset')) });
    });
    root.querySelectorAll('[data-gallery]').forEach(function (b) {
      b.addEventListener('click', function () { var f = on[b.getAttribute('data-gallery')]; if (f) f(); });
    });
  }

  // Quick palette colours: the theme's accent, then every colour its styles use, once each.
  function themeColors(theme) {
    var out = [];
    var add = function (c) { c = String(c || '').toLowerCase(); if (/^#[0-9a-f]{6}$/.test(c) && out.indexOf(c) < 0) out.push(c); };
    if (!theme) return out;
    add(theme.global && theme.global.accent);
    Object.keys(theme.types || {}).forEach(function (type) {
      (theme.types[type].styles || []).forEach(function (st) {
        Object.keys(st.values || {}).forEach(function (k) { add(st.values[k]); });
      });
    });
    return out;
  }
  // Swatches; bind() puts a clicked one into the colour setting used last.
  function palette(colors) {
    return colors.length ? '<div class="fl-palette" role="group" aria-label="Theme colours"><span>Theme colours</span>' + colors.map(function (c) {
      return '<button type="button" class="fl-swatch" data-swatch="' + c + '" style="background:' + c + '" title="' + c + '" aria-label="Use ' + c + '"></button>';
    }).join('') + '</div>' : '';
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
    { id: 'arrows', cls: 'fl-arrows-section', label: 'Arrows' },
    { id: 'hide', cls: 'fl-hide-section', label: 'Show / hide' },
    { id: 'state', cls: 'fl-state-section', label: 'States' },
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
    // The quick palette fills the colour setting focused last, or the first one.
    var lastColor = null;
    root.querySelectorAll('input[type="color"][data-param]').forEach(function (inp) {
      inp.addEventListener('focus', function () { lastColor = inp; });
    });
    root.querySelectorAll('[data-swatch]').forEach(function (b) {
      b.addEventListener('click', function () {
        var inp = lastColor || root.querySelector('input[type="color"][data-param]');
        if (!inp) return;
        inp.value = b.getAttribute('data-swatch');
        inp.dispatchEvent(new Event('input'));
        lastColor = inp;
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

  window.VD.flParams = { esc: esc, sample: sample, card: card, thumbnails: thumbnails, gallery: gallery, memberOf: memberOf, bindGallery: bindGallery,
    themeColors: themeColors, palette: palette, html: html, bind: bind };
})();
