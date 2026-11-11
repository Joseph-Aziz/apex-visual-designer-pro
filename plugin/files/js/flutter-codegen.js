/* APEX Visual Designer — Flutter page code generator.
   generate(design) turns the chosen variants and parameter values into the CSS and JS
   blocks for one page; merge(existing, block) places a block between the vd-flutter
   markers in the page's own CSS or JS without touching anything else. */
(function () {
  window.VD = window.VD || {};
  var V = window.VD.flutterVariants;
  var START = '/* vd-flutter:start */', END = '/* vd-flutter:end */';

  var BASE_CSS =
    '/* vd-flutter base */\n' +
    '@keyframes vd-fl-ripple { to { transform: scale(4); opacity: 0; } }\n' +
    '.vd-fl-ripple { position: absolute; border-radius: 50%; pointer-events: none; background: currentColor; opacity: .25; transform: scale(0); animation: vd-fl-ripple .5s ease-out; }\n' +
    '@media (prefers-reduced-motion: reduce) { .vd-fl-ripple { display: none; } }\n';

  function esc(id) { return String(id).replace(/[^A-Za-z0-9_-]/g, function (c) { return '\\' + c; }); }

  function selectorFor(c) {
    if (c.kind === 'item') return c.name ? '#' + esc(c.name) + '_CONTAINER' : null;
    return c.staticId ? '#' + esc(c.staticId) : null;
  }

  function rippleJs(targets) {
    return '(function () {\n' +
      '  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;\n' +
      '  var targets = ' + JSON.stringify(targets.join(', ')) + ';\n' +
      '  document.addEventListener("pointerdown", function (e) {\n' +
      '    var el = e.target.closest && e.target.closest(targets);\n' +
      '    if (!el || el.disabled) return;\n' +
      '    var r = el.getBoundingClientRect(), d = Math.max(r.width, r.height), s = document.createElement("span");\n' +
      '    s.className = "vd-fl-ripple";\n' +
      '    s.style.width = s.style.height = d + "px";\n' +
      '    s.style.left = (e.clientX - r.left - d / 2) + "px";\n' +
      '    s.style.top = (e.clientY - r.top - d / 2) + "px";\n' +
      '    el.appendChild(s);\n' +
      '    s.addEventListener("animationend", function () { s.remove(); });\n' +
      '  });\n' +
      '})();\n';
  }

  // Adds one Google Fonts stylesheet link for the fonts the design uses.
  function fontJs(families) {
    var href = 'https://fonts.googleapis.com/css2?' + families.map(function (f) { return 'family=' + f + ':wght@300..700'; }).join('&') + '&display=swap';
    return '(function () {\n' +
      '  if (document.getElementById("vd-fl-fonts")) return;\n' +
      '  var l = document.createElement("link");\n' +
      '  l.id = "vd-fl-fonts"; l.rel = "stylesheet"; l.href = ' + JSON.stringify(href) + ';\n' +
      '  document.head.appendChild(l);\n' +
      '})();\n';
  }

  // Marks every declaration !important. The rules are already scoped to one component's id,
  // so this only makes the chosen design win over theme rules (Theme Roller, utility classes,
  // more specific theme selectors) without reaching any other element.
  function important(css) {
    return css.replace(/\{([^{}]*)\}/g, function (m, body) {
      var decls = body.split(';').map(function (d) { return d.trim(); }).filter(Boolean).map(function (d) {
        return /!important$/.test(d) ? d : d + ' !important';
      });
      return '{ ' + decls.join('; ') + '; }';
    });
  }

  function generate(design) {
    var css = '', ripple = [], fonts = [];
    (design.components || []).forEach(function (c) {
      if (!c.variant) return;
      var type = V.typeOf(c), variant = type && V.get(type, c.variant), sel = selectorFor(c);
      if (!variant || !sel) return;
      var vals = V.values(variant, c.values);
      css += '/* ' + type + ' ' + variant.label + ': ' + (c.name || c.staticId).replace(/\*\//g, '') + ' */\n' +
        important(variant.css(sel, vals));
      var font = V.googleFont(vals.fontFamily);
      if (font && fonts.indexOf(font) < 0) fonts.push(font);
      if (variant.needsJs && vals.ripple !== 'off') ripple.push(type === 'button' ? sel : sel + ' .apex-item-option label');
    });
    if (!css) return { css: '', js: '' };
    return { css: BASE_CSS + css, js: (ripple.length ? rippleJs(ripple) : '') + (fonts.length ? fontJs(fonts) : '') };
  }

  function count(text, s) { return text.split(s).length - 1; }

  function merge(existing, block) {
    var text = existing || '';
    var starts = count(text, START), ends = count(text, END);
    if (starts > 1 || ends > 1) return { error: 'The page code has the designer markers more than once. Fix it in Page Designer first.' };
    if (starts !== ends || (starts && text.indexOf(START) > text.indexOf(END))) {
      return { error: 'The page code has a broken designer block (a start or end marker is missing). Fix it in Page Designer first.' };
    }
    var wrapped = block ? START + '\n' + block.replace(/\s+$/, '') + '\n' + END : '';
    if (!starts) {
      if (!wrapped) return { text: text };
      return { text: text ? text.replace(/\s+$/, '') + '\n' + wrapped : wrapped };
    }
    var a = text.indexOf(START), b = text.indexOf(END) + END.length;
    if (wrapped) return { text: text.slice(0, a) + wrapped + text.slice(b) };
    // Remove the block and the line break that joined it to its neighbours.
    if (a > 0 && text[a - 1] === '\n') a -= 1;
    else if (text[b] === '\n') b += 1;
    return { text: text.slice(0, a) + text.slice(b) };
  }

  window.VD.flutterCodegen = { generate: generate, selectorFor: selectorFor, merge: merge, START: START, END: END,
    important: important, rippleJs: rippleJs, fontJs: fontJs, BASE_CSS: BASE_CSS };
})();
