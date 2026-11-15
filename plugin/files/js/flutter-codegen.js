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

  // Where the plug-in's ECharts file lives, from the designer page's own URL (same folder).
  function echartsUrl(base) { return new URL('lib/echarts/echarts.min.js', base).href; }

  // Tells the chart runtime where to load ECharts from. Only the plug-in's own file, never a CDN.
  function echartsJs(url) {
    return 'window.VD = window.VD || {}; VD.chart = VD.chart || {}; VD.chart.echartsUrl = ' + JSON.stringify(url) + ';\n';
  }

  // A chart the Chart Designer configured: has a config and a Static ID to apply it to.
  function chartOf(c) { return c.chart && typeof c.chart === 'object' && c.staticId ? c.chart : null; }
  function needsChartRuntime(design) { return (design.components || []).some(chartOf); }

  // JSON that is safe inside a page script: no "</script>" can close it early.
  function scriptJson(v) { return JSON.stringify(v).replace(/</g, '\\u003c'); }

  var CSS_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|transparent)$/i;
  function px(v, max) { return typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v + 'px' : null; }
  // The region frame (Chart Designer global properties marked css): the same for both engines.
  function chartFrameCss(sel, g) {
    if (!g) return '';
    var d = [];
    if (CSS_COLOR.test(g.background || '')) d.push('background: ' + g.background);
    if (CSS_COLOR.test(g.border || '') || px(g.borderWidth, 10)) {
      d.push('border: ' + (px(g.borderWidth, 10) || '1px') + ' solid ' + (CSS_COLOR.test(g.border || '') ? g.border : 'currentColor'));
    }
    if (px(g.radius, 40)) d.push('border-radius: ' + px(g.radius, 40), 'overflow: hidden');
    if (px(g.padding, 60)) d.push('padding: ' + px(g.padding, 60));
    if (typeof g.fontFamily === 'string' && g.fontFamily.trim() && g.fontFamily.length <= 120) {
      d.push('font-family: ' + g.fontFamily.replace(/[;{}<>\\]/g, ''));
    }
    return d.length ? sel + ' { ' + d.join('; ') + '; }\n' : '';
  }

  function generate(design, opts) {
    opts = opts || {};
    var css = '', ripple = [], fonts = [], charts = '', echarts = false, applies = '', frames = '';
    (design.components || []).forEach(function (c) {
      var cfg = chartOf(c);
      if (cfg && opts.chartRuntimeUrls && opts.chartRuntimeUrls.length) {
        if (cfg.engine === 'echarts') echarts = true;
        frames += important(chartFrameCss(selectorFor(c), cfg.global));
        applies += 'VD.chart.apply(' + JSON.stringify(c.staticId) + ', ' + scriptJson(cfg) + ');\n';
        return;
      }
      if (c.chart && c.chart.engine === 'echarts') echarts = true;
      if (!c.variant) return;
      var type = V.typeOf(c), variant = type && V.get(type, c.variant), sel = selectorFor(c);
      if (!variant || !sel) return;
      var vals = V.values(variant, c.values);
      css += '/* ' + type + ' ' + variant.label + ': ' + (c.name || c.staticId).replace(/\*\//g, '') + ' */\n' +
        important(variant.css(sel, vals));
      var font = V.googleFont(vals.fontFamily || variant.font);
      if (font && fonts.indexOf(font) < 0) fonts.push(font);
      if (variant.js) charts += variant.js(sel, vals, c);
      if (variant.needsJs && vals.ripple !== 'off') ripple.push(type === 'button' ? sel : sel + ' .apex-item-option label');
    });
    // The chart runtime is loaded from the plug-in files, never pasted into the page: the page
    // import takes at most 32,767 characters of page JavaScript.
    var runtime = applies ? [
      '(function () {',
      '  function run() {',
      applies.replace(/\n$/, '').replace(/^/gm, '    '),
      '  }',
      '  if (window.VD && VD.chart && VD.chart.apply) { run(); return; }',
      '  var urls = ' + scriptJson(opts.chartRuntimeUrls) + ', i = 0;',
      '  (function next() {',
      '    if (i >= urls.length) { run(); return; }',
      "    var s = document.createElement('script');",
      '    s.src = urls[i++];',
      '    s.onload = next;',
      "    s.onerror = function () { console.error('Chart Designer: cannot load ' + s.src); };",
      '    document.head.appendChild(s);',
      '  })();',
      '})();', ''].join('\n') : '';
    var url = echarts && opts.echartsUrl ? echartsJs(opts.echartsUrl) : '';
    var js = (ripple.length ? rippleJs(ripple) : '') + (fonts.length ? fontJs(fonts) : '') + url + charts + runtime;
    return { css: (css ? BASE_CSS + css : '') + frames, js: css || applies ? js : url };
  }

  // The page import takes at most 32,767 characters of page JavaScript (found in 1.3.0). Inline CSS
  // is held to the same limit until a live instance shows otherwise (component studio spike 1).
  var LIMIT = 32767;
  function n(x) { return String(x).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // '' when the merged page CSS and JavaScript fit the import, else a message with the sizes.
  function sizeError(css, js) {
    var over = [['CSS', (css || '').length], ['JavaScript', (js || '').length]].filter(function (x) { return x[1] > LIMIT; });
    if (!over.length) return '';
    return 'Not saved: the page ' + over.map(function (x) { return x[0] + ' would be ' + n(x[1]) + ' characters'; }).join(' and the ') +
      ', and a page takes at most ' + n(LIMIT) + '. Design fewer components on this page, or move repeated designs into the theme as presets.';
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

  window.VD.flutterCodegen = { generate: generate, echartsUrl: echartsUrl, needsChartRuntime: needsChartRuntime, selectorFor: selectorFor, merge: merge, sizeError: sizeError, LIMIT: LIMIT, START: START, END: END,
    important: important, rippleJs: rippleJs, fontJs: fontJs, BASE_CSS: BASE_CSS };
})();
