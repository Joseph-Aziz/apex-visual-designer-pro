/* APEX Visual Designer — Flutter (Material 3) variant library.
   Each component type has six variants. A variant turns a scoped selector
   and its parameter values into CSS rules on the native APEX markup; nothing in the
   DOM is replaced, so APEX behaviour is untouched. To add a variant or a type, add an
   entry to LIBRARY. */
(function () {
  window.VD = window.VD || {};
  var S = window.VD.lookSelectors['26.2'];

  // ---- helpers -------------------------------------------------------------
  // rule('#X', ' .a, .b', 'color:red') -> 'body #X .a, body #X .b { color:red }'
  // A part starting with '&' is joined to the selector itself: '&.c .a' -> 'body #X.c .a'.
  function rule(sel, sub, decls) {
    var list = (sub || '').split(',').map(function (s) {
      s = s.trim();
      return 'body ' + sel + (s ? (s.charAt(0) === '&' ? s.slice(1) : /^[:\[]/.test(s) ? s : ' ' + s) : '');
    });
    return list.join(', ') + ' { ' + decls + ' }\n';
  }
  function within(sub) { // prefix each part of a comma list with a parent selector
    return function (parent) {
      return sub.split(',').map(function (s) { return parent + ' ' + s.trim(); }).join(', ');
    };
  }
  function p(key, label, kind, def) { return { key: key, label: label, kind: kind, default: def }; }
  var COLOR = function (key, label, def) { return p(key, label, 'color', def); };
  var PX = function (key, label, def) { return p(key, label, 'px', def); };

  var fieldParams = [
    COLOR('accent', 'Focus / accent colour', '#1a73e8'),
    COLOR('bg', 'Background', '#eef1f6'),
    COLOR('text', 'Text colour', '#1c1b1f'),
    COLOR('border', 'Border colour', '#79747e'),
    COLOR('icon', 'Icon colour', '#49454f'),
    PX('radius', 'Corner radius', 12),
    PX('borderWidth', 'Border width', 1),
    PX('padding', 'Padding', 14),
    PX('fontSize', 'Font size', 16),
    p('fontWeight', 'Font weight', 'weight', 400)
  ];

  // ---- fields: text, date, select share the same three shapes ----------------
  function fieldCss(shape, extra) {
    return function (sel, v) {
      var f = S.field, input = f.input;
      var base =
        rule(sel, input, 'box-sizing:border-box; width:100%; color:' + v.text + '; font-size:' + v.fontSize + 'px; font-weight:' + v.fontWeight +
          '; padding-block:' + v.padding + 'px; padding-inline:' + v.padding + 'px; transition:border-color .2s, box-shadow .2s, background-color .2s; outline:none;') +
        rule(sel, f.label, 'color:' + v.icon + '; font-size:' + Math.round(v.fontSize * 0.8) + 'px; transition:color .2s;') +
        rule(sel, ':focus-within ' + f.label.trim(), 'color:' + v.accent + ';') +
        rule(sel, f.icon, 'color:' + v.icon + '; background:transparent; border:0;') +
        rule(sel, f.help, 'padding-inline-start:' + v.padding + 'px; font-size:12px;') +
        rule(sel, f.error, 'padding-inline-start:' + v.padding + 'px; font-size:12px; color:#b3261e;') +
        rule(sel, within(input)('.apex_disabled'), 'opacity:.38; cursor:not-allowed;') +
        rule(sel, within(input)('.apex-page-item-error'), 'border-color:#b3261e; box-shadow:none;') +
        // The item container itself carries the floating-label class. The theme floats the
        // label over the input, which the new padding would make collide with the value, so
        // the label is placed above the field instead.
        // (Universal Theme 26.2 stacks both in the grid area "field"; give each its own row.)
        rule(sel, '&.t-Form-fieldContainer--floatingLabel .t-Form-labelContainer', 'position:static; padding:0; inline-size:auto; grid-area:auto; grid-row:1; grid-column:field;') +
        rule(sel, '&.t-Form-fieldContainer--floatingLabel .t-Form-inputContainer', 'grid-area:auto; grid-row:2; grid-column:field;') +
        rule(sel, '&.t-Form-fieldContainer--floatingLabel .t-Form-label', 'position:static; transform:none; display:block; margin:0; margin-block-end:6px; padding:0; font-size:13px; line-height:1.4; background:transparent;');
      var shapeCss;
      if (shape === 'filled') {
        shapeCss = rule(sel, input, 'background:' + v.bg + '; border:0; border-block-end:' + v.borderWidth + 'px solid ' + v.border +
            '; border-start-start-radius:' + v.radius + 'px; border-start-end-radius:' + v.radius + 'px; border-end-start-radius:0; border-end-end-radius:0;') +
          rule(sel, within(input)(':focus-within'), 'border-block-end:2px solid ' + v.accent + ';');
      } else if (shape === 'outlined') {
        shapeCss = rule(sel, input, 'background:transparent; border:' + v.borderWidth + 'px solid ' + v.border + '; border-radius:' + v.radius + 'px;') +
          rule(sel, within(input)(':focus-within'), 'border-color:' + v.accent + '; box-shadow:0 0 0 1px ' + v.accent + ';');
      } else if (shape === 'underline') {
        shapeCss = rule(sel, input, 'background:transparent; border:0; border-block-end:' + v.borderWidth + 'px solid ' + v.border + '; border-radius:0; padding-inline:0;') +
          rule(sel, within(input)(':focus-within'), 'border-block-end:2px solid ' + v.accent + ';');
      } else if (shape === 'glass') {
        shapeCss = rule(sel, input, 'background:color-mix(in srgb, ' + v.bg + ' 55%, transparent); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); border:' + v.borderWidth +
            'px solid color-mix(in srgb, #fff 45%, transparent); border-radius:' + v.radius + 'px; box-shadow:0 4px 18px rgba(0,0,0,.08);') +
          rule(sel, within(input)(':focus-within'), 'border-color:' + v.accent + ';');
      } else if (shape === 'pill') {
        shapeCss = rule(sel, input, 'background:transparent; border:' + v.borderWidth + 'px solid ' + v.border + '; border-radius:999px; padding-inline:' + (v.padding + 6) + 'px;') +
          rule(sel, within(input)(':focus-within'), 'border-color:' + v.accent + '; box-shadow:0 0 0 3px color-mix(in srgb, ' + v.accent + ' 22%, transparent);');
      } else {
        shapeCss = rule(sel, input, 'background:' + v.bg + '; border:0; border-radius:999px; box-shadow:0 1px 3px rgba(0,0,0,.12), 0 1px 2px rgba(0,0,0,.08);') +
          rule(sel, within(input)(':focus-within'), 'box-shadow:0 0 0 2px ' + v.accent + ', 0 2px 6px rgba(0,0,0,.12);');
      }
      return base + shapeCss + (extra ? extra(sel, v) : '');
    };
  }
  // Smooth line icons (24px grid, round caps) drawn as masks, so they take the icon colour.
  var ICONS = {
    chevron: '<path d="M6 9l6 6 6-6"/>',
    caret: '<path d="M7 10h10l-5 6z" fill="#000"/>',
    arrow: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    event: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>'
  };
  // The Icon section of dates and lists; empty values keep the look of the chosen design.
  function iconParams(styles) {
    return [
      { key: 'iconStyle', label: 'Icon', kind: 'select', options: styles.concat('none'), default: '', group: 'icon' },
      { key: 'iconSize', label: 'Icon size', kind: 'px', default: '', group: 'icon' },
      { key: 'iconColor', label: 'Icon colour', kind: 'color', default: '', group: 'icon' },
      { key: 'iconHoverBg', label: 'Icon hover background', kind: 'color', default: '', group: 'icon' },
      { key: 'iconPosition', label: 'Icon position', kind: 'select', options: ['end', 'start'], default: '', group: 'icon' }
    ];
  }
  function svg(name, color) {
    return 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="' +
      color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>') + '")';
  }
  // Puts the item's own icon button inside the field at the end and swaps its glyph for a smooth icon.
  // Resolved Icon section values: style, size, colour, hover background and side.
  function iconOf(v, fallback) {
    return {
      name: v.iconStyle || fallback,
      size: v.iconSize !== '' && v.iconSize != null ? v.iconSize : Math.max(16, Math.round(v.fontSize * 1.15)),
      color: v.iconColor || v.icon,
      hover: v.iconHoverBg || 'color-mix(in srgb, ' + (v.iconColor || v.icon) + ' 12%, transparent)',
      side: v.iconPosition === 'start' ? 'start' : 'end'
    };
  }
  // Puts the item's own icon button inside the field and swaps its glyph for a smooth icon.
  function iconInside(sel, v, button, fallback) {
    var ic = iconOf(v, fallback);
    var css = rule(sel, '.apex-item-group, .t-Form-itemWrapper', 'position:relative;') +
      rule(sel, S.field.input, 'padding-inline-' + ic.side + ':' + (v.padding + ic.size + 12) + 'px;') +
      rule(sel, button, 'position:absolute; inset-inline-' + ic.side + ':' + Math.max(4, v.padding - 6) + 'px; inset-block-start:50%; transform:translateY(-50%); z-index:1; inline-size:' + (ic.size + 14) +
        'px; block-size:' + (ic.size + 14) + 'px; padding:0; display:inline-flex; align-items:center; justify-content:center; border-radius:999px; background:transparent; border:0; box-shadow:none; transition:background-color .2s;') +
      rule(sel, button + ':hover', 'background:' + ic.hover + ';') +
      rule(sel, button + ' .a-Icon, ' + button + ' .fa', 'display:none;');
    if (ic.name === 'none') return css + rule(sel, button + '::after', 'display:none;');
    return css +
      rule(sel, button + '::after', 'content:""; display:block; inline-size:' + ic.size + 'px; block-size:' + ic.size + 'px; background:' + ic.color + '; -webkit-mask:' + svg(ic.name, '#000') +
        ' center/contain no-repeat; mask:' + svg(ic.name, '#000') + ' center/contain no-repeat; transition:transform .2s, background-color .2s;') +
      rule(sel, ':focus-within ' + button + '::after', 'background:' + (v.iconColor || v.accent) + ';');
  }
  function datePopup(sel, v) {
    return rule(sel, '.a-DatePicker-calendar .is-selected, .a-DatePicker-calendar .is-selected a', 'background:' + v.accent + '; color:#fff; border-radius:999px;') +
      rule(sel, '.a-DatePicker-calendar', 'border-radius:' + (v.radius + 4) + 'px; box-shadow:0 4px 16px rgba(0,0,0,.18);') +
      iconInside(sel, v, '.a-Button--calendar', 'calendar');
  }
  function chevron(sel, v) {
    var ic = iconOf(v, 'chevron');
    // native <select>: the arrow is a background image, placed on the chosen side in LTR and RTL
    var atEnd = 'calc(100% - ' + v.padding + 'px) center', atStart = v.padding + 'px center';
    var ltr = ic.side === 'end' ? atEnd : atStart, rtl = ic.side === 'end' ? atStart : atEnd;
    var arrow = ic.name === 'none' ? 'background-image:none;' : 'background-image:' + svg(ic.name, ic.color) + '; background-repeat:no-repeat; background-size:' + ic.size +
      'px; background-position:' + ltr + ';';
    return rule(sel, 'select', 'appearance:none; padding-inline-' + ic.side + ':' + (v.padding + ic.size + 10) + 'px; ' + arrow) +
      rule(sel, 'select:dir(rtl)', 'background-position:' + rtl + ';') +
      iconInside(sel, v, '.a-Button--popupLOV', 'chevron') +
      rule(sel, '.apex-item-group:has([aria-expanded="true"]) .a-Button--popupLOV::after', 'transform:rotate(180deg);');
  }
  function fieldType(type, extra, icons) {
    return [['v1', 'Filled', 'filled'], ['v2', 'Outlined', 'outlined'], ['v3', 'Soft', 'soft'],
      ['v4', 'Underline', 'underline'], ['v5', 'Glass', 'glass'], ['v6', 'Pill', 'pill']].map(function (d) {
      return { type: type, id: d[0], label: d[1], params: icons ? fieldParams.concat(icons) : fieldParams, css: fieldCss(d[2], extra), needsJs: false };
    });
  }

  // ---- choice: checkbox and radio group -----------------------------------
  var choiceParams = [COLOR('accent', 'Accent colour', '#1a73e8'), COLOR('bg', 'Option background', '#eef1f6'),
    COLOR('text', 'Text colour', '#1c1b1f'), COLOR('border', 'Border colour', '#79747e'), PX('radius', 'Corner radius', 12),
    PX('gap', 'Gap between options', 8), PX('fontSize', 'Font size', 15)];
  var f = S.field;
  var choice = [
    { id: 'v1', label: 'Material', needsJs: false, css: function (sel, v) {
      return rule(sel, f.optionInput, 'accent-color:' + v.accent + '; inline-size:18px; block-size:18px;') +
        rule(sel, f.optionLabel, 'color:' + v.text + '; font-size:' + v.fontSize + 'px;') +
        rule(sel, f.option, 'margin-block-end:' + v.gap + 'px;');
    } },
    { id: 'v2', label: 'Chip', needsJs: true, css: function (sel, v) {
      return rule(sel, '.apex-item-group', 'display:flex; flex-wrap:wrap; gap:' + v.gap + 'px;') +
        rule(sel, f.optionInput, 'position:absolute; opacity:0;') +
        rule(sel, f.optionLabel, 'display:inline-block; padding-block:6px; padding-inline:14px; border:1px solid ' + v.border +
          '; border-radius:8px; color:' + v.text + '; font-size:' + v.fontSize + 'px; cursor:pointer; transition:background-color .2s; position:relative; overflow:hidden;') +
        rule(sel, '.apex-item-option input:checked + label', 'background:' + v.bg + '; border-color:' + v.accent + '; color:' + v.accent + ';') +
        rule(sel, '.apex-item-option input:focus-visible + label', 'box-shadow:0 0 0 2px ' + v.accent + ';');
    } },
    { id: 'v3', label: 'Card', needsJs: false, css: function (sel, v) {
      return rule(sel, f.option, 'display:flex; align-items:center; gap:10px; padding:12px; margin-block-end:' + v.gap +
          'px; border:1px solid ' + v.border + '; border-radius:' + v.radius + 'px; transition:border-color .2s, background-color .2s;') +
        rule(sel, '.apex-item-option:has(input:checked)', 'border-color:' + v.accent + '; background:' + v.bg + ';') +
        rule(sel, f.optionInput, 'accent-color:' + v.accent + ';') +
        rule(sel, f.optionLabel, 'color:' + v.text + '; font-size:' + v.fontSize + 'px; flex:1;');
    } },
    { id: 'v4', label: 'Segmented', needsJs: false, css: function (sel, v) {
      return rule(sel, '.apex-item-group', 'display:inline-flex; border:1px solid ' + v.border + '; border-radius:' + v.radius + 'px; overflow:hidden;') +
        rule(sel, f.option, 'margin:0;') +
        rule(sel, f.optionInput, 'position:absolute; opacity:0;') +
        rule(sel, f.optionLabel, 'display:block; padding-block:8px; padding-inline:16px; color:' + v.text + '; font-size:' + v.fontSize + 'px; cursor:pointer; border-inline-end:1px solid ' + v.border + '; transition:background-color .2s;') +
        rule(sel, '.apex-item-option input:checked + label', 'background:' + v.accent + '; color:#fff;') +
        rule(sel, '.apex-item-option input:focus-visible + label', 'box-shadow:inset 0 0 0 2px ' + v.accent + ';');
    } },
    { id: 'v5', label: 'Pill', needsJs: true, css: function (sel, v) {
      return rule(sel, '.apex-item-group', 'display:flex; flex-wrap:wrap; gap:' + v.gap + 'px;') +
        rule(sel, f.optionInput, 'position:absolute; opacity:0;') +
        rule(sel, f.optionLabel, 'display:inline-block; padding-block:8px; padding-inline:18px; border-radius:999px; background:' + v.bg +
          '; color:' + v.text + '; font-size:' + v.fontSize + 'px; cursor:pointer; position:relative; overflow:hidden; transition:background-color .2s, color .2s;') +
        rule(sel, '.apex-item-option input:checked + label', 'background:' + v.accent + '; color:#fff;') +
        rule(sel, '.apex-item-option input:focus-visible + label', 'box-shadow:0 0 0 2px ' + v.accent + ';');
    } },
    { id: 'v6', label: 'List tile', needsJs: false, css: function (sel, v) {
      return rule(sel, f.option, 'display:flex; align-items:center; gap:12px; padding-block:12px; padding-inline:8px; margin:0; border-block-end:1px solid ' + v.border + '; transition:background-color .2s;') +
        rule(sel, '.apex-item-option:hover', 'background:' + v.bg + ';') +
        rule(sel, f.optionInput, 'accent-color:' + v.accent + '; order:2; margin-inline-start:auto;') +
        rule(sel, f.optionLabel, 'color:' + v.text + '; font-size:' + v.fontSize + 'px;');
    } }
  ];

  // ---- switch ---------------------------------------------------------------
  var switchParams = [COLOR('accent', 'On colour', '#1a73e8'), COLOR('off', 'Off colour', '#e7e0ec'), COLOR('thumb', 'Thumb colour', '#ffffff'), PX('size', 'Height', 28)];
  function switchCss(kind) {
    return function (sel, v) {
      var w = Math.round(v.size * (kind === 'ios' ? 1.7 : 1.8)), t = v.size - 8;
      var h = kind === 'thin' ? Math.round(v.size * 0.55) : v.size;
      var trackRadius = kind === 'square' ? '6px' : '999px', thumbRadius = kind === 'square' ? '4px' : '50%';
      var border = kind === 'material' ? '2px solid #79747e' : kind === 'outline' ? '2px solid ' + v.accent : '0';
      var css = rule(sel, f.switchTrack, 'inline-size:' + w + 'px; block-size:' + h + 'px; border-radius:' + trackRadius + '; background:' + (kind === 'outline' ? 'transparent' : v.off) + '; transition:background-color .2s; border:' + border + ';') +
        rule(sel, f.switchTrack + '::before', 'inline-size:' + t + 'px; block-size:' + t + 'px; border-radius:' + thumbRadius + '; background:' + (kind === 'outline' ? v.accent : v.thumb) + '; transition:transform .2s;' +
          (kind === 'thin' ? ' box-shadow:0 1px 4px rgba(0,0,0,.3);' : '')) +
        rule(sel, '.a-Switch input:checked + .a-Switch-toggle', 'background:' + v.accent + '; border-color:' + v.accent + ';') +
        rule(sel, '.a-Switch input:focus-visible + .a-Switch-toggle', 'box-shadow:0 0 0 2px ' + v.accent + ';');
      if (kind === 'pill') {
        css += rule(sel, f.switchTrack + '::after', 'content:"Off"; font-size:11px; color:#49454f; position:absolute; inset-inline-end:8px; inset-block-start:50%; transform:translateY(-50%);') +
          rule(sel, '.a-Switch input:checked + .a-Switch-toggle::after', 'content:"On"; color:#fff; inset-inline-end:auto; inset-inline-start:8px;');
      }
      return css;
    };
  }
  var sw = [['v1', 'Material', 'material'], ['v2', 'iOS', 'ios'], ['v3', 'Labelled pill', 'pill'],
    ['v4', 'Square', 'square'], ['v5', 'Thin track', 'thin'], ['v6', 'Outline', 'outline']].map(function (d) {
    return { id: d[0], label: d[1], needsJs: false, css: switchCss(d[2]), params: switchParams };
  });

  // ---- button ---------------------------------------------------------------
  var buttonParams = [COLOR('accent', 'Main colour', '#1a73e8'), COLOR('text', 'Text colour (filled)', '#ffffff'),
    PX('radius', 'Corner radius', 999), PX('padding', 'Side padding', 24), PX('height', 'Height', 40),
    PX('fontSize', 'Font size', 14), p('fontWeight', 'Font weight', 'weight', 500)];
  function buttonCss(kind) {
    return function (sel, v) {
      var look = kind === 'filled' ? 'background:' + v.accent + '; color:' + v.text + '; border:0;'
        : kind === 'tonal' ? 'background:color-mix(in srgb, ' + v.accent + ' 14%, #fff); color:' + v.accent + '; border:0;'
        : kind === 'elevated' ? 'background:color-mix(in srgb, ' + v.accent + ' 6%, #fff); color:' + v.accent + '; border:0; box-shadow:0 1px 3px rgba(0,0,0,.2), 0 1px 2px rgba(0,0,0,.12);'
        : kind === 'text' ? 'background:transparent; color:' + v.accent + '; border:0;'
        : kind === 'gradient' ? 'background:linear-gradient(135deg, ' + v.accent + ', color-mix(in srgb, ' + v.accent + ' 55%, #b388ff)); color:' + v.text + '; border:0;'
        : 'background:transparent; color:' + v.accent + '; border:1px solid ' + v.accent + ';';
      var solid = kind === 'filled' || kind === 'gradient' || kind === 'elevated';
      return rule(sel, '', look + ' border-radius:' + v.radius + 'px; block-size:' + v.height + 'px; padding-inline:' + (kind === 'text' ? Math.round(v.padding / 2) : v.padding) +
          'px; font-size:' + v.fontSize + 'px; font-weight:' + v.fontWeight + '; box-shadow:none; position:relative; overflow:hidden; transition:box-shadow .2s, filter .2s; text-transform:none;') +
        rule(sel, ':hover', solid ? 'box-shadow:0 2px 6px rgba(0,0,0,.25); filter:brightness(1.05);' : 'background:color-mix(in srgb, ' + v.accent + ' 10%, transparent);') +
        rule(sel, ':focus-visible', 'outline:2px solid ' + v.accent + '; outline-offset:2px;') +
        rule(sel, '[disabled]', 'opacity:.38; box-shadow:none; cursor:not-allowed;');
    };
  }
  var button = [['v1', 'Filled', 'filled'], ['v2', 'Tonal', 'tonal'], ['v3', 'Outlined', 'outlined'],
    ['v4', 'Elevated', 'elevated'], ['v5', 'Text', 'text'], ['v6', 'Gradient', 'gradient']].map(function (d) {
    return { id: d[0], label: d[1], needsJs: true, css: buttonCss(d[2]), params: buttonParams };
  });

  // ---- display only ----------------------------------------------------------
  var displayParams = [COLOR('accent', 'Accent colour', '#1a73e8'), COLOR('bg', 'Background', '#eef1f6'), COLOR('text', 'Text colour', '#1c1b1f'), PX('radius', 'Corner radius', 12), PX('fontSize', 'Font size', 16)];
  var display = [
    { id: 'v1', label: 'Plain', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'color:' + v.text + '; font-size:' + v.fontSize + 'px; border:0; background:transparent;'); } },
    { id: 'v2', label: 'Chip', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'display:inline-block; padding-block:4px; padding-inline:12px; border-radius:8px; background:color-mix(in srgb, ' + v.accent + ' 14%, #fff); color:' + v.accent + '; font-size:' + v.fontSize + 'px; border:0;'); } },
    { id: 'v3', label: 'Tile', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'display:block; padding:12px; border-radius:' + v.radius + 'px; background:' + v.bg + '; color:' + v.text + '; font-size:' + v.fontSize + 'px; border:0;'); } },
    { id: 'v4', label: 'Badge', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'display:inline-block; padding-block:2px; padding-inline:10px; border-radius:999px; background:' + v.accent + '; color:#fff; font-size:' + Math.round(v.fontSize * 0.85) + 'px; font-weight:500; border:0;'); } },
    { id: 'v5', label: 'Outlined', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'display:block; padding:10px; border-radius:' + v.radius + 'px; border:1px solid color-mix(in srgb, ' + v.text + ' 25%, transparent); background:transparent; color:' + v.text + '; font-size:' + v.fontSize + 'px;'); } },
    { id: 'v6', label: 'Large value', needsJs: false, css: function (sel, v) { return rule(sel, f.display, 'display:block; color:' + v.accent + '; font-size:' + (v.fontSize * 2) + 'px; font-weight:600; line-height:1.2; border:0; background:transparent;'); } }
  ];

  // ---- region ----------------------------------------------------------------
  var regionParams = [COLOR('accent', 'Accent colour', '#1a73e8'), COLOR('bg', 'Background', '#ffffff'), COLOR('title', 'Title colour', '#1c1b1f'), COLOR('border', 'Border colour', '#cac4d0'),
    PX('radius', 'Corner radius', 16), PX('padding', 'Padding', 16), PX('elevation', 'Shadow depth', 2), PX('titleSize', 'Title size', 18)];
  var R = S.region;
  function regionCss(kind) {
    return function (sel, v) {
      var frame = kind === 'elevated' ? 'background:' + v.bg + '; border:0; box-shadow:0 ' + v.elevation + 'px ' + (v.elevation * 3) + 'px rgba(0,0,0,.14);'
        : kind === 'outlined' ? 'background:' + v.bg + '; border:1px solid ' + v.border + '; box-shadow:none;'
        : kind === 'tonal' ? 'background:color-mix(in srgb, ' + v.accent + ' 8%, ' + v.bg + '); border:0; box-shadow:none;'
        : kind === 'glass' ? 'background:color-mix(in srgb, ' + v.bg + ' 60%, transparent); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); border:1px solid color-mix(in srgb, #fff 50%, transparent); box-shadow:0 8px 32px rgba(0,0,0,.1);'
        : kind === 'accent' ? 'background:' + v.bg + '; border:1px solid ' + v.border + '; border-inline-start:4px solid ' + v.accent + '; box-shadow:none;'
        : 'background:transparent; border:0; box-shadow:none;';
      return rule(sel, '', frame + ' border-radius:' + v.radius + 'px; overflow:hidden;') +
        rule(sel, R.header, 'background:transparent; border:0; padding-inline:' + v.padding + 'px; padding-block-start:' + v.padding + 'px;') +
        rule(sel, R.title, 'color:' + v.title + '; font-size:' + v.titleSize + 'px; font-weight:500;') +
        rule(sel, R.body, 'padding:' + (kind === 'flat' ? 0 : v.padding) + 'px;');
    };
  }
  var region = [['v1', 'Elevated card', 'elevated'], ['v2', 'Outlined card', 'outlined'], ['v3', 'Flat', 'flat'],
    ['v4', 'Tonal', 'tonal'], ['v5', 'Glass', 'glass'], ['v6', 'Accent bar', 'accent']].map(function (d) {
    return { id: d[0], label: d[1], needsJs: false, css: regionCss(d[2]), params: regionParams };
  });

  // ---- report (classic, IR, IG) ----------------------------------------------
  var reportParams = [COLOR('header', 'Header text', '#49454f'), COLOR('headerBg', 'Header background', '#ffffff'), COLOR('hover', 'Hover tint', '#f3edf7'),
    COLOR('stripe', 'Stripe colour', '#eef1f7'), COLOR('divider', 'Row divider', '#e7e0ec'), PX('rowPadding', 'Row padding', 12), PX('fontSize', 'Font size', 14)];
  function reportCss(kind, family) {
    return function (sel, v) {
      var pad = kind === 'dense' ? Math.max(4, Math.round(v.rowPadding / 2)) : v.rowPadding;
      var line = kind === 'borderless' ? '0' : '1px solid ' + v.divider;
      return [family].map(function (c) {
        var m = S[c];
        return rule(sel, m.header, 'background:' + (kind === 'accent' ? 'color-mix(in srgb, ' + v.header + ' 10%, ' + v.headerBg + ')' : v.headerBg) +
            '; color:' + v.header + '; font-weight:' + (kind === 'accent' ? 600 : 500) + '; font-size:' + v.fontSize + 'px; border:0; border-block-end:' +
            (kind === 'accent' ? '2px solid ' + v.header : line) + ';') +
          rule(sel, m.row + ' td', 'padding-block:' + pad + 'px; font-size:' + v.fontSize + 'px; border:0; border-block-end:' + (kind === 'cardrows' ? '0' : line) + ';' +
            (kind === 'cardrows' ? ' background:' + v.headerBg + '; box-shadow:0 1px 0 ' + v.divider + ', 0 -1px 0 ' + v.divider + ';' : '')) +
          // the report's own table (first part of its row selector), tinted so each white row reads as a card
          (kind === 'cardrows' ? rule(sel, m.row.split(' ')[0], 'border-collapse:separate; border-spacing:0 ' + Math.max(4, Math.round(pad / 2)) +
            'px; background:' + v.stripe + '; padding-inline:8px;') +
            rule(sel, m.row + ' td:first-child', 'border-start-start-radius:10px; border-end-start-radius:10px;') +
            rule(sel, m.row + ' td:last-child', 'border-start-end-radius:10px; border-end-end-radius:10px;') : '') +
          rule(sel, m.rowHover + ' td', 'background:' + v.hover + ';') +
          (kind === 'striped' ? rule(sel, m.rowAlt + ' td', 'background:' + v.stripe + ';') : '');
      }).join('');
    };
  }
  // classic, ir and ig are separate types: each design styles only its own report's markup
  function report(family) {
    return [['v1', 'Material table', 'material'], ['v2', 'Striped', 'striped'], ['v3', 'Dense', 'dense'],
      ['v4', 'Card rows', 'cardrows'], ['v5', 'Borderless', 'borderless'], ['v6', 'Accent header', 'accent']].map(function (d) {
      return { id: d[0], label: d[1], needsJs: false, css: reportCss(d[2], family), params: reportParams };
    });
  }

  // ---- cards region ----------------------------------------------------------
  var cardsParams = [COLOR('bg', 'Card background', '#ffffff'), COLOR('title', 'Title colour', '#1c1b1f'), COLOR('border', 'Border colour', '#cac4d0'),
    PX('radius', 'Corner radius', 16), PX('elevation', 'Shadow depth', 2), PX('padding', 'Padding', 16)];
  var C = S.cards;
  function cardsCss(kind) {
    return function (sel, v) {
      var bg = kind === 'tonal' ? 'color-mix(in srgb, ' + v.border + ' 30%, ' + v.bg + ')' : kind === 'glass' ? 'color-mix(in srgb, ' + v.bg + ' 60%, transparent)' : v.bg;
      var frame = kind === 'outlined' ? 'border:1px solid ' + v.border + '; box-shadow:none;'
        : kind === 'tonal' ? 'border:0; box-shadow:none;'
        : kind === 'glass' ? 'border:1px solid color-mix(in srgb, #fff 50%, transparent); -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); box-shadow:0 8px 32px rgba(0,0,0,.1);'
        : kind === 'accent' ? 'border:1px solid ' + v.border + '; border-block-start:4px solid ' + v.title + '; box-shadow:none;'
        : 'border:0; box-shadow:0 ' + v.elevation + 'px ' + (v.elevation * 3) + 'px rgba(0,0,0,.14);';
      return rule(sel, C.card, frame + ' background:' + bg + '; border-radius:' + v.radius + 'px; overflow:hidden; transition:box-shadow .2s, transform .2s;') +
        rule(sel, C.card + ':hover', 'transform:translateY(-2px);') +
        rule(sel, C.title, 'color:' + v.title + '; font-weight:500;') +
        rule(sel, C.body, 'padding:' + v.padding + 'px;') +
        (kind === 'media' ? rule(sel, C.media, 'aspect-ratio:16/9; margin:0; inline-size:100%;') : '');
    };
  }
  var cards = [['v1', 'Elevated', 'elevated'], ['v2', 'Outlined', 'outlined'], ['v3', 'Media', 'media'],
    ['v4', 'Tonal', 'tonal'], ['v5', 'Glass', 'glass'], ['v6', 'Accent top', 'accent']].map(function (d) {
    return { id: d[0], label: d[1], needsJs: false, css: cardsCss(d[2]), params: cardsParams };
  });

  function tag(type, list, params) {
    return list.map(function (v) { v.type = type; if (params) v.params = params; return v; });
  }

  var LIBRARY = {
    text: fieldType('text'),
    date: fieldType('date', datePopup, iconParams(['calendar', 'event', 'clock'])),
    select: fieldType('select', chevron, iconParams(['chevron', 'caret', 'arrow'])),
    choice: tag('choice', choice, choiceParams),
    'switch': tag('switch', sw),
    button: tag('button', button),
    display: tag('display', display, displayParams),
    region: tag('region', region),
    classic: tag('classic', report('classic')),
    ir: tag('ir', report('ir')),
    ig: tag('ig', report('ig')),
    cards: tag('cards', cards)
  };

  // ---- advanced settings: shared by every variant; empty means "as the variant has it"
  var FONTS = {
    system: { stack: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    roboto: { stack: 'Roboto, system-ui, sans-serif', google: 'Roboto' },
    inter: { stack: 'Inter, system-ui, sans-serif', google: 'Inter' },
    cairo: { stack: 'Cairo, system-ui, sans-serif', google: 'Cairo' },
    tajawal: { stack: 'Tajawal, system-ui, sans-serif', google: 'Tajawal' },
    serif: { stack: 'Georgia, "Times New Roman", serif' }
  };
  function ADV(key, label, kind, options) { var o = p(key, label, kind, ''); o.group = 'advanced'; if (options) o.options = options; return o; }
  var advancedParams = [
    ADV('shadow', 'Shadow', 'select', ['none', 'sm', 'md', 'lg']),
    ADV('hoverBg', 'Hover background', 'color'),
    ADV('focusColor', 'Focus ring colour', 'color'),
    ADV('focusWidth', 'Focus ring width', 'px'),
    ADV('fontFamily', 'Font', 'select', Object.keys(FONTS)),
    ADV('letterSpacing', 'Letter spacing (px)', 'number'),
    ADV('textTransform', 'Text case', 'select', ['none', 'uppercase', 'capitalize', 'lowercase']),
    ADV('lineHeight', 'Line height', 'number'),
    ADV('width', 'Width', 'select', ['auto', 'full']),
    ADV('maxWidth', 'Max width', 'px'),
    ADV('marginBlock', 'Space above and below', 'px'),
    ADV('align', 'Text alignment', 'select', ['start', 'center', 'end']),
    ADV('motion', 'Animation', 'select', ['fast', 'slow', 'off']),
    ADV('ripple', 'Ripple on press', 'select', ['on', 'off']),
    ADV('customCss', 'Extra CSS (declarations)', 'css')
  ];
  var SHADOWS = { none: 'none', sm: '0 1px 2px rgba(0,0,0,.2)', md: '0 3px 8px rgba(0,0,0,.18)', lg: '0 8px 24px rgba(0,0,0,.2)' };
  // The element that carries the look of each type ('' = the selected element itself).
  var SURFACE = { text: S.field.input, date: S.field.input, select: S.field.input, choice: S.field.optionLabel,
    'switch': S.field.switchTrack, button: '', display: S.field.display, region: '', classic: '', ir: '', ig: '', cards: S.cards.card };
  function pseudo(sub, ps) { return sub ? sub.split(',').map(function (s) { return s.trim() + ps; }).join(', ') : ps; }
  function isSet(v) { return v !== '' && v != null; }
  function advancedCss(type) {
    var surf = SURFACE[type];
    return function (sel, v) {
      var css = '', root = '', all = '', box = '';
      if (isSet(v.shadow)) box += 'box-shadow:' + SHADOWS[v.shadow] + ';';
      if (isSet(v.width)) box += ' inline-size:' + (v.width === 'full' ? '100%' : 'auto') + ';';
      if (isSet(v.maxWidth)) box += ' max-inline-size:' + v.maxWidth + 'px;';
      if (isSet(v.customCss)) box += ' ' + v.customCss + ';';
      if (isSet(v.fontFamily)) all += 'font-family:' + FONTS[v.fontFamily].stack + ';';
      if (isSet(v.letterSpacing)) all += ' letter-spacing:' + v.letterSpacing + 'px;';
      if (isSet(v.textTransform)) all += ' text-transform:' + v.textTransform + ';';
      if (isSet(v.lineHeight)) all += ' line-height:' + v.lineHeight + ';';
      if (v.motion === 'off') all += ' transition:none !important; animation:none !important;';
      else if (isSet(v.motion)) all += ' transition-duration:' + (v.motion === 'fast' ? '.1s' : '.45s') + ' !important;';
      if (isSet(v.marginBlock)) root += 'margin-block:' + v.marginBlock + 'px;';
      if (isSet(v.align)) {
        root += ' text-align:' + v.align + ';';
        // the text sits in the surface (input, label, button), and buttons centre it with flex
        box += ' text-align:' + v.align + '; justify-content:' + (v.align === 'center' ? 'center' : 'flex-' + v.align) + ';';
      }
      if (root) css += rule(sel, '', root);
      if (all) css += rule(sel, ', *', all);
      if (box) css += rule(sel, surf, box);
      if (isSet(v.hoverBg)) css += rule(sel, pseudo(surf, ':hover'), 'background:' + v.hoverBg + ';');
      if (isSet(v.focusColor) || isSet(v.focusWidth)) {
        css += rule(sel, pseudo(surf, ':focus-visible'), 'outline:' + (isSet(v.focusWidth) ? v.focusWidth : 2) + 'px solid ' +
          (isSet(v.focusColor) ? v.focusColor : 'currentColor') + '; outline-offset:2px;');
      }
      return css;
    };
  }
  // ---- show / hide switches: 'hide' emits display:none, 'show' or empty emits nothing
  var H = S.hide;
  var HIDE_LABELS = { hideSearch: 'Search bar', hideActions: 'Actions button', hideRowsPerPage: 'Rows per page', hideReset: 'Reset button',
    hideColumnMenu: 'Column header menu', hidePagination: 'Pagination', hideSettingsBar: 'Report settings bar', hideToolbar: 'Toolbar',
    hideEditSave: 'Edit and Save buttons', hideFooter: 'Footer', hideNoData: 'No data message', hideHeadings: 'Column headings',
    hideTitle: 'Title bar', hideRegionButtons: 'Region buttons', hideLabel: 'Label', hideHelp: 'Help icon', hideRequired: 'Required marker',
    hideIcon: 'Icon' };
  function merge() { var o = {}; Array.prototype.forEach.call(arguments, function (m) { Object.keys(m).forEach(function (k) { o[k] = m[k]; }); }); return o; }
  var HIDES = { ir: merge(H.ir, H.region), ig: merge(H.ig, H.region), classic: merge(H.classic, H.region), cards: merge(H.cards, H.region),
    region: H.region, text: H.item, date: H.item, select: H.item, choice: H.item, 'switch': H.item, display: H.item, button: H.button };
  // The column menu stays visible as plain text: only its click is switched off.
  var HIDE_DECL = { hideColumnMenu: 'pointer-events:none; cursor:default;' };
  function hideParams(type) {
    return Object.keys(HIDES[type] || {}).map(function (key) {
      var o = p(key, key === 'hideLabel' && type === 'button' ? 'Label (icon only)' : HIDE_LABELS[key], 'select', '');
      o.group = 'hide'; o.options = ['show', 'hide'];
      return o;
    });
  }
  function hideCss(type) {
    var map = HIDES[type] || {};
    return function (sel, v) {
      return Object.keys(map).filter(function (k) { return v[k] === 'hide'; }).map(function (k) {
        return rule(sel, map[k], HIDE_DECL[k] || 'display:none;');
      }).join('');
    };
  }

  Object.keys(LIBRARY).forEach(function (type) {
    var extra = advancedCss(type), hide = hideCss(type), hp = hideParams(type);
    LIBRARY[type] = LIBRARY[type].map(function (v) {
      var base = v.css;
      return { type: v.type, id: v.id, label: v.label, needsJs: v.needsJs, params: v.params.concat(hp, advancedParams),
        css: function (sel, vals) { return base(sel, vals) + hide(sel, vals) + extra(sel, vals); } };
    });
  });

  var ITEM_TYPES = {
    NATIVE_TEXT_FIELD: 'text', NATIVE_TEXTAREA: 'text', NATIVE_NUMBER_FIELD: 'text', NATIVE_PASSWORD: 'text',
    NATIVE_DATE_PICKER_APEX: 'date', NATIVE_DATEPICKER_APEX: 'date', NATIVE_DATE_PICKER: 'date',
    NATIVE_SELECT_LIST: 'select', NATIVE_POPUP_LOV: 'select', NATIVE_COMBOBOX: 'select',
    NATIVE_CHECKBOX: 'choice', NATIVE_RADIOGROUP: 'choice', NATIVE_SINGLE_CHECKBOX: 'choice',
    NATIVE_YES_NO: 'switch', NATIVE_DISPLAY_ONLY: 'display'
  };

  var PATTERNS = {
    color: /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20}|rgba?\(\s*[\d.\s,%]+\))$/,
    icon: /^(fa|icon)-[a-z0-9-]{1,40}( [a-z0-9-]{1,40})*$|^$/
  };

  window.VD.flutterVariants = {
    types: Object.keys(LIBRARY),
    forType: function (type) { return LIBRARY[type] || []; },
    get: function (type, id) {
      return (LIBRARY[type] || []).filter(function (v) { return v.id === id; })[0] || null;
    },
    typeOf: function (c) {
      if (!c) return null;
      if (c.kind === 'button') return 'button';
      if (c.kind === 'region') {
        if (c.component === 'classic' || c.component === 'ir' || c.component === 'ig') return c.component;
        return c.type === 'NATIVE_CARDS' ? 'cards' : 'region';
      }
      return ITEM_TYPES[c.type] || null;
    },
    // Returns a safe value for the parameter kind, or null when the value is not allowed.
    cleanParam: function (param, value) {
      var s = String(value == null ? '' : value).trim();
      switch (param.kind) {
        case 'color': return PATTERNS.color.test(s) ? s : null;
        case 'icon': return PATTERNS.icon.test(s) ? s : null;
        case 'px': case 'number': return /^\d{1,4}(\.\d{1,2})?$/.test(s) ? Number(s) : null;
        case 'weight': return /^[1-9]00$/.test(s) ? Number(s) : null;
        case 'select': return (param.options || []).indexOf(s) >= 0 ? s : null;
        case 'css': // declarations only, applied inside one scoped rule
          return s.length <= 600 && /^[^{}<>@\\]*$/.test(s) && !/\/\*|\*\/|url\s*\(|expression\s*\(|javascript:|import/i.test(s)
            ? s.replace(/;\s*$/, '') : null;
        default: return null;
      }
    },
    // Google Fonts family name for a font key, or null for local fonts.
    googleFont: function (key) { return (FONTS[key] && FONTS[key].google) || null; },
    // Parameter values for a variant: defaults overlaid with cleaned owner values.
    values: function (variant, given) {
      var out = {};
      variant.params.forEach(function (prm) {
        var v = given && given[prm.key] != null ? window.VD.flutterVariants.cleanParam(prm, given[prm.key]) : null;
        out[prm.key] = v == null ? prm.default : v;
      });
      return out;
    }
  };
})();
