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

  // Date pickers with "Previous and next day arrows": a button on each side of the picker moves
  // the date one day. Running it again (the editor preview does) removes the arrows of items no
  // longer listed and adds the missing ones, so it never doubles them.
  var STEP_CSS =
    '/* vd-flutter date arrows */\n' +
    '.vd-fl-stepper { display: grid !important; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 4px; }\n' +
    '.vd-fl-stepper > * { grid-row: 1; }\n' +
    '.vd-fl-stepper > .vd-fl-step-prev { grid-column: 1; }\n' +
    '.vd-fl-stepper > a-date-picker, .vd-fl-stepper > .apex-item-datepicker { grid-column: 2; position: relative; min-width: 0; width: 100%; }\n' +
    '.vd-fl-stepper > .vd-fl-step-next { grid-column: 3; }\n' +
    '.vd-fl-step { flex: none; inline-size: 32px; block-size: 32px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; font-size: 20px; line-height: 1; }\n' +
    '.vd-fl-step:hover { background: color-mix(in srgb, currentColor 12%, transparent); }\n' +
    '.vd-fl-step:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }\n' +
    '[dir="rtl"] .vd-fl-step { transform: scaleX(-1); }\n';
  function stepJs(names) {
    return '(function () {\n' +
      '  var names = ' + JSON.stringify(names) + ', A = window.apex;\n' +
      '  function pad(n) { return (n < 10 ? "0" : "") + n; }\n' +
      '  function fmt(host) { return host.getAttribute("format") || (A && A.locale && A.locale.getDateFormat && A.locale.getDateFormat()) || "YYYY-MM-DD"; }\n' +
      '  function shift(name, host, input, days) {\n' +
      '    var f = fmt(host), d = null, v;\n' +
      '    if (A && A.date && A.date.parse && input.value) { try { d = A.date.parse(input.value, f); } catch (e) { d = null; } }\n' +
      '    if (!d && /^\d{4}-\d{2}-\d{2}/.test(input.value)) { var p = input.value.split("-"); d = new Date(+p[0], p[1] - 1, +p[2].slice(0, 2)); }\n' +
      '    if (!d || isNaN(d)) d = new Date();\n' +
      '    d.setDate(d.getDate() + days);\n' +
      '    v = A && A.date && A.date.format ? A.date.format(d, f) : d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());\n' +
      '    if (A && A.item && A.item(name).node) A.item(name).setValue(v);\n' +
      '    else { input.value = v; input.dispatchEvent(new Event("change", { bubbles: true })); }\n' +
      '  }\n' +
      '  function button(label, glyph, days, name, host, input) {\n' +
      '    var b = document.createElement("button");\n' +
      '    b.type = "button"; b.className = "vd-fl-step vd-fl-step-" + (days < 0 ? "prev" : "next"); b.textContent = glyph;\n' +
      '    b.setAttribute("aria-label", label); b.title = label;\n' +
      '    b.addEventListener("click", function () { if (!input.disabled && !input.readOnly) shift(name, host, input, days); });\n' +
      '    return b;\n' +
      '  }\n' +
      '  document.querySelectorAll(".vd-fl-stepper").forEach(function (w) {\n' +
      '    if (names.indexOf(w.getAttribute("data-vd-item")) >= 0) return;\n' +
      '    w.querySelectorAll(".vd-fl-step").forEach(function (b) { b.remove(); });\n' +
      '    w.classList.remove("vd-fl-stepper"); w.removeAttribute("data-vd-item");\n' +
      '  });\n' +
      '  names.forEach(function (name) {\n' +
      '    var c = document.getElementById(name + "_CONTAINER");\n' +
      '    var host = c && c.querySelector("a-date-picker, .apex-item-datepicker");\n' +
      '    var input = host && (host.tagName === "INPUT" ? host : host.querySelector("input"));\n' +
      '    if (!input || !host.parentNode || host.parentNode.classList.contains("vd-fl-stepper")) return;\n' +
      '    var w = host.parentNode;\n' +
      '    w.classList.add("vd-fl-stepper"); w.setAttribute("data-vd-item", name);\n' +
      '    w.insertBefore(button("Previous day", "\u2039", -1, name, host, input), host);\n' +
      '    w.insertBefore(button("Next day", "\u203A", 1, name, host, input), host.nextSibling);\n' +
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

  // A design's rules are generated once for TOKEN, then TOKEN becomes the component's selector or,
  // for several components, one ":is(#A, #B)" list: same specificity as an id, and each rule names
  // the group once instead of repeating every selector in the rule head per component.
  var TOKEN = '#vd-shared-sel';
  function shared(css, sels) {
    if (sels.length === 1) return css.split(TOKEN).join(sels[0]);
    var group = ':is(' + sels.join(', ') + ')';
    // "body T a, body T b" becomes "body G :is(a, b)": the group list once per rule.
    return css.replace(/([^{};/]+)\{/g, function (m, head) {
      var parts = head.trim().split(/\s*,\s*/), lead = 'body ' + TOKEN + ' ';
      if (parts.length < 2 || !parts.every(function (p) { return p.indexOf(lead) === 0 && p.indexOf(TOKEN, lead.length) < 0 && p.indexOf('::') < 0; })) return m;
      return head.match(/^\s*/)[0] + 'body ' + group + ' :is(' + parts.map(function (p) { return p.slice(lead.length); }).join(', ') + ') {';
    }).split(TOKEN).join(group);
  }

  // A design's rules with every setting read from a CSS variable, or null when that cannot be done.
  // The rules are only used for a set of values when putting those values back into the variables
  // gives exactly the CSS the design writes for them, so a design that computes with a setting
  // (a size times two) or branches on one simply keeps its own copy per component.
  var UNIT = /var\((--vd-[A-Za-z0-9_-]+)\)(px|%|ms|s|deg|rem|em)(?![A-Za-z0-9%])/g;
  function varDesign(type, variant, sample) {
    var prefix = '--vd-' + String(type).replace(/[^A-Za-z0-9_-]/g, '') + '-' + String(variant.id).replace(/[^A-Za-z0-9_-]/g, '') + '-';
    var keys = Object.keys(sample).filter(function (k) { return /^[A-Za-z0-9_-]+$/.test(k) && sample[k] !== '' && sample[k] != null; });
    // A setting used as a lookup key or in arithmetic cannot be a variable: it keeps its value.
    function attempt(vars) {
      var ph = {};
      Object.keys(sample).forEach(function (k) { ph[k] = vars.indexOf(k) < 0 ? sample[k] : 'var(' + prefix + k + ')'; });
      try { var r = variant.css(TOKEN, ph); } catch (e) { return null; }
      return typeof r === 'string' && !/NaN|undefined|\[object/.test(r) ? r : null;
    }
    keys = keys.filter(function (k) { var r = attempt([k]); return r && r.indexOf('var(' + prefix + k + ')') >= 0; });
    var raw = attempt(keys);
    if (!raw) return null;
    var css = raw.replace(UNIT, 'calc(var($1) * 1$2)');
    var used = keys.filter(function (k) { return css.indexOf('var(' + prefix + k + ')') >= 0; });
    if (!used.length) return null;
    function ok(x) { return (typeof x === 'number' && isFinite(x)) || (typeof x === 'string' && !/[;{}<>\\]/.test(x)); }
    // Puts values back into the variables, except the settings named in keep.
    function expand(vals, keep) {
      return css.replace(/calc\(var\((--vd-[A-Za-z0-9_-]+)\) \* 1(px|%|ms|s|deg|rem|em)\)|var\((--vd-[A-Za-z0-9_-]+)\)/g, function (m, n1, u, n2) {
        var k = (n1 || n2).slice(prefix.length);
        if (keep && keep.indexOf(k) >= 0) return m;
        return n1 ? String(vals[k]) + u : String(vals[k]);
      });
    }
    return {
      matches: function (vals) {
        if (!used.every(function (k) { return ok(vals[k]); })) return false;
        var direct;
        try { direct = variant.css(TOKEN, vals); } catch (e) { return false; }
        return expand(vals) === direct;
      },
      // Rules for these value sets: a setting that is the same in all of them is written as is,
      // only the ones that differ stay variables, set per component by decls.
      build: function (list) {
        var vary = used.filter(function (k) { return list.some(function (x) { return String(x[k]) !== String(list[0][k]); }); });
        return {
          css: expand(list[0], vary),
          decls: function (vals) { return vary.map(function (k) { return prefix + k + ': ' + vals[k]; }).join('; '); }
        };
      }
    };
  }

  function generate(design, opts) {
    opts = opts || {};
    var css = '', ripple = [], steps = [], fonts = [], charts = '', echarts = false, applies = '', frames = '', groups = {}, order = [];
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
      var gk = type + '|' + c.variant + '|' + JSON.stringify(vals);
      if (!groups[gk]) { groups[gk] = { type: type, variant: variant, vals: vals, sels: [], names: [] }; order.push(gk); }
      groups[gk].sels.push(sel);
      groups[gk].names.push((c.name || c.staticId).replace(/\*\//g, ''));
      var font = V.googleFont(vals.fontFamily || variant.font);
      if (font && fonts.indexOf(font) < 0) fonts.push(font);
      if (variant.js) charts += variant.js(sel, vals, c);
      if (variant.needsJs && vals.ripple !== 'off') ripple.push(type === 'button' ? sel : sel + ' .apex-item-option label');
      if (type === 'date' && vals.stepArrows === 'on' && c.name) steps.push(c.name);
    });
    // Components with the same design and settings share one block of rules: the page import takes
    // at most 32,767 characters of CSS, and one copy per component runs out on a busy form.
    // Components with the same design but different settings share one block too: the rules are
    // written once with CSS variables, and each component only sets its own variable values.
    var byDesign = {}, designOrder = [];
    order.forEach(function (gk) {
      var g = groups[gk], dk = g.type + '|' + g.variant.id;
      if (!byDesign[dk]) { byDesign[dk] = []; designOrder.push(dk); }
      byDesign[dk].push(gk);
    });
    var done = {};
    designOrder.forEach(function (dk) {
      var rest = byDesign[dk];
      while (rest.length > 1) {
        var first = groups[rest[0]], v = varDesign(first.type, first.variant, first.vals);
        var fits = v ? rest.filter(function (gk) { return v.matches(groups[gk].vals); }) : [];
        rest = rest.slice(1).filter(function (gk) { return fits.indexOf(gk) < 0; });
        if (fits.length > 1) emit(first, v, fits);
      }
    });
    function emit(first, v, fits) {
      var sels = [], names = [], sets = '';
      var b = v.build(fits.map(function (gk) { return groups[gk].vals; }));
      fits.forEach(function (gk) {
        var g = groups[gk];
        sels = sels.concat(g.sels); names = names.concat(g.names);
        sets += g.sels.join(', ') + ' { ' + b.decls(g.vals) + '; }\n';
        done[gk] = true;
      });
      css += '/* ' + first.type + ' ' + first.variant.label + ': ' + names.join(', ') + ' */\n' +
        important(sets + shared(b.css, sels));
    }
    order.forEach(function (gk) {
      if (done[gk]) return;
      var g = groups[gk];
      css += '/* ' + g.type + ' ' + g.variant.label + ': ' + g.names.join(', ') + ' */\n' +
        important(shared(g.variant.css(TOKEN, g.vals), g.sels));
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
    var step = steps.length ? stepJs(steps) : '';
    var js = (ripple.length ? rippleJs(ripple) : '') + (fonts.length ? fontJs(fonts) : '') + step + url + charts + runtime;
    return { css: (css ? BASE_CSS + (steps.length ? STEP_CSS : '') + css : '') + frames, js: css || applies ? js : url, stepJs: step };
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

  // The fuller of the page CSS and JavaScript against the limit: { name, used, limit, level }.
  // level: 'ok', 'warn' from 80% of the limit, 'over' above it.
  function sizeInfo(css, js) {
    var a = { name: 'CSS', used: (css || '').length }, b = { name: 'JS', used: (js || '').length };
    var w = b.used > a.used ? b : a;
    return { name: w.name, used: w.used, limit: LIMIT, level: w.used > LIMIT ? 'over' : w.used >= LIMIT * 0.8 ? 'warn' : 'ok' };
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

  window.VD.flutterCodegen = { generate: generate, echartsUrl: echartsUrl, needsChartRuntime: needsChartRuntime, selectorFor: selectorFor, merge: merge, sizeError: sizeError, sizeInfo: sizeInfo, LIMIT: LIMIT, START: START, END: END,
    important: important, rippleJs: rippleJs, stepJs: stepJs, fontJs: fontJs, BASE_CSS: BASE_CSS };
})();
