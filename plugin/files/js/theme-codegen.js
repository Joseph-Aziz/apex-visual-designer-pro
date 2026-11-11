/* APEX Visual Designer — app theme generator.
   A theme holds, per component type, a default style and named styles. Each style is one of
   the Flutter designs with its settings. themeCss(theme) turns it into one CSS file that styles
   components by type and by class (vd-<type>-<name>) instead of by id, so page designs, which
   use ids, still win over the theme. */
(function () {
  window.VD = window.VD || {};
  var V = window.VD.flutterVariants, G = window.VD.flutterCodegen;

  var CLASS_NAME = /^[a-z][a-z0-9-]{0,30}$/;
  var REGION_TYPES = { region: 1, cards: 1, classic: 1, ir: 1, ig: 1 };
  // What tells one region type from another in the page markup.
  var REGION_MARK = {
    cards: ':has(.a-CardView)', ir: ':has(.a-IRR)', ig: ':has(.a-IG)', classic: ':has(.t-Report)',
    region: ':not(:has(.a-CardView, .a-IRR, .a-IG, .t-Report))'
  };
  // What tells one item type from another inside its field container.
  var ITEM_MARK = {
    text: ':has(input.text_field, textarea)',
    date: ':has(.apex-item-datepicker, .a-DatePicker)',
    select: ':has(select, .apex-item-popup-lov, .a-Combobox)',
    choice: ':has(.apex-item-checkbox, .apex-item-radio)',
    'switch': ':has(.a-Switch)',
    display: ':has(.display_only)'
  };
  var NAMES = { region: 'Regions', cards: 'Cards', classic: 'Classic reports', ir: 'Interactive reports', ig: 'Interactive grids',
    text: 'Text fields', date: 'Date pickers', select: 'Lists', choice: 'Checkboxes and radios', 'switch': 'Switches',
    display: 'Display only', button: 'Buttons' };

  // The element a style applies to: with a class name, the components that carry vd-<type>-<cls>;
  // without one (cls null), the components of that type that carry no vd-<type>-* class.
  function selectors(type, cls) {
    var prefix = 'vd-' + type + '-';
    // The default button style leaves the app's own header and navigation buttons alone.
    if (type === 'button') {
      return cls ? '.t-Button.' + prefix + cls : '.t-Button:not([class*="' + prefix + '"]):not(.t-Header .t-Button, .t-Body-nav .t-Button)';
    }
    if (REGION_TYPES[type]) {
      // Interactive reports and grids use the t-IRR-region wrapper in Universal Theme.
      var wrap = type === 'ir' || type === 'ig' ? ':is(.t-Region, .t-IRR-region)' : '.t-Region';
      return cls ? wrap + '.' + prefix + cls : wrap + ':not([class*="' + prefix + '"])' + REGION_MARK[type];
    }
    // APEX puts an item's CSS classes on the input, so the style targets the container holding it.
    return cls ? '.t-Form-fieldContainer:has(.' + prefix + cls + ')'
      : '.t-Form-fieldContainer:not(:has([class*="' + prefix + '"]))' + ITEM_MARK[type];
  }

  function stylesOf(theme) {
    var out = [];
    Object.keys((theme && theme.types) || {}).forEach(function (type) {
      ((theme.types[type] || {}).styles || []).forEach(function (s, i) { out.push({ type: type, style: s, index: i }); });
    });
    return out;
  }

  function validate(theme) {
    var msgs = [];
    Object.keys((theme && theme.types) || {}).forEach(function (type) {
      if (!NAMES[type]) { msgs.push('Unknown component type ' + type + '.'); return; }
      var seen = {}, defaults = 0;
      ((theme.types[type] || {}).styles || []).forEach(function (s) {
        var name = s.name || s.cls || '(no name)';
        if (!CLASS_NAME.test(s.cls || '')) msgs.push('Class name for ' + name + ' must start with a letter and use only a-z, 0-9 and - (at most 31).');
        else if (seen[s.cls]) msgs.push(NAMES[type] + ' already have a style with class vd-' + type + '-' + s.cls + '.');
        seen[s.cls] = true;
        if (!V.get(type, s.variant)) msgs.push('Pick a design for ' + name + '.');
        if (s.isDefault) defaults += 1;
      });
      if (defaults > 1) msgs.push(NAMES[type] + ' can have only one default style.');
    });
    return msgs;
  }

  function cleanGlobal(g) {
    g = g || {};
    var font = V.forType('text')[0].params.filter(function (p) { return p.key === 'fontFamily'; })[0];
    return {
      pageBg: V.cleanParam({ kind: 'color' }, g.pageBg),
      fontFamily: V.cleanParam(font, g.fontFamily)
    };
  }

  var FONT_STACK = {
    system: 'system-ui, -apple-system, "Segoe UI", sans-serif', roboto: 'Roboto, system-ui, sans-serif',
    inter: 'Inter, system-ui, sans-serif', cairo: 'Cairo, system-ui, sans-serif', tajawal: 'Tajawal, system-ui, sans-serif',
    serif: 'Georgia, "Times New Roman", serif'
  };

  // meta: { app, version, date } for the header comment. Styles that do not validate are left out.
  function themeCss(theme, meta) {
    var g = cleanGlobal(theme && theme.global), fonts = [], ripple = [], body = '';
    if (g.pageBg) body += 'background:' + g.pageBg + ';';
    if (g.fontFamily) {
      body += ' font-family:' + FONT_STACK[g.fontFamily] + ';';
      if (V.googleFont(g.fontFamily)) fonts.push(V.googleFont(g.fontFamily));
    }
    var css = body ? '/* global */\n' + G.important('body { ' + body + ' }\n') : '';
    var list = stylesOf(theme).filter(function (x) {
      return CLASS_NAME.test(x.style.cls || '') && V.get(x.type, x.style.variant);
    });
    // per type: the default style first, then the named styles
    list.sort(function (a, b) {
      return a.type === b.type ? (b.style.isDefault ? 1 : 0) - (a.style.isDefault ? 1 : 0) || a.index - b.index : 0;
    });
    list.forEach(function (x) {
      var variant = V.get(x.type, x.style.variant), vals = V.values(variant, x.style.values);
      var sels = [selectors(x.type, x.style.cls)];
      if (x.style.isDefault) sels.unshift(selectors(x.type, null));
      sels.forEach(function (sel, i) {
        var label = (i === 0 && x.style.isDefault ? 'default ' : '') + x.type + ' ' + variant.label + ': vd-' + x.type + '-' + x.style.cls;
        css += '/* ' + label + ' */\n' + G.important(variant.css(sel, vals));
        if (variant.needsJs && vals.ripple !== 'off') ripple.push(x.type === 'button' ? sel : sel + ' .apex-item-option label');
      });
      var f = V.googleFont(vals.fontFamily);
      if (f && fonts.indexOf(f) < 0) fonts.push(f);
    });
    var head = '/* vd-theme app ' + meta.app + ' version ' + meta.version + ' ' + meta.date + ' */\n';
    return {
      css: head + (css ? G.BASE_CSS + css : ''),
      js: (ripple.length ? G.rippleJs(ripple) : '') + (fonts.length ? G.fontJs(fonts) : '')
    };
  }

  window.VD.themeCodegen = { validate: validate, selectors: selectors, themeCss: themeCss, names: NAMES, CLASS_NAME: CLASS_NAME };
})();
