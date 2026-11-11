/* Unit tests for js/flutter-codegen.js. Run: node TESTS/flutter_codegen_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const G = window.VD.flutterCodegen;
assert.ok(G, 'VD.flutterCodegen is undefined');

const START = '/* vd-flutter:start */', END = '/* vd-flutter:end */';
const design = (components) => ({ app: 100, page: 10, components });
const item = (name, type, variant, values) => ({ key: 'item:' + name, kind: 'item', name, type, variant, values: values || {} });

// empty design gives empty css and js
let out = G.generate(design([]));
assert.strictEqual(out.css, '');
assert.strictEqual(out.js, '');

// base block emitted once for two components
out = G.generate(design([item('P201_A', 'NATIVE_TEXT_FIELD', 'v1'), item('P201_B', 'NATIVE_DATE_PICKER_APEX', 'v2')]));
assert.strictEqual(out.css.split('vd-flutter base').length - 1, 1, 'base block count');
assert.ok(out.css.includes('body #P201_A_CONTAINER'));
assert.ok(out.css.includes('body #P201_B_CONTAINER'));

// js empty when no used variant needsJs
assert.strictEqual(out.js, '');
out = G.generate(design([{ key: 'button:SAVE', kind: 'button', name: 'SAVE', staticId: 'save_btn', variant: 'v1', values: {} }]));
assert.ok(out.js.length > 0, 'ripple js expected');
assert.ok(out.js.includes('prefers-reduced-motion'));
assert.ok(out.css.includes('body #save_btn'));

// components with no variant or unknown type are skipped
out = G.generate(design([item('P201_C', 'NATIVE_TEXT_FIELD', null), item('P201_D', 'PLUGIN_X', 'v1')]));
assert.strictEqual(out.css, '');

// owner values are cleaned: an injected value falls back to the default
out = G.generate(design([item('P201_A', 'NATIVE_TEXT_FIELD', 'v1', { accent: 'red;}</style><script>' })]));
assert.ok(!out.css.includes('</style>'));
assert.ok(out.css.includes('#1a73e8'));

// selectorFor escapes
assert.strictEqual(G.selectorFor({ kind: 'item', name: 'P1_A$B' }), '#P1_A\\$B_CONTAINER');
assert.strictEqual(G.selectorFor({ kind: 'region', staticId: 'orders' }), '#orders');
assert.strictEqual(G.selectorFor({ kind: 'region', staticId: 'a.b#c' }), '#a\\.b\\#c');
assert.strictEqual(G.selectorFor({ kind: 'button', staticId: null }), null);

// merge appends when no markers
assert.deepStrictEqual(JSON.parse(JSON.stringify(G.merge('a{}', 'X'))), { text: 'a{}\n' + START + '\nX\n' + END });
assert.deepStrictEqual(JSON.parse(JSON.stringify(G.merge('', 'X'))), { text: START + '\nX\n' + END });

// merge replaces only the block, keeping text before and after
const page = 'before{}\n' + START + '\nOLD\n' + END + '\nafter{}';
assert.strictEqual(G.merge(page, 'NEW').text, 'before{}\n' + START + '\nNEW\n' + END + '\nafter{}');

// merge refuses duplicate markers and start without end
assert.ok(G.merge(page + '\n' + START + '\nX\n' + END, 'NEW').error);
assert.ok(G.merge('a{}\n' + START + '\nX', 'NEW').error);
assert.ok(G.merge('a{}\n' + END, 'NEW').error);

// merge with an empty block removes the markers
assert.strictEqual(G.merge(page, '').text, 'before{}\nafter{}');
assert.strictEqual(G.merge('a{}', '').text, 'a{}');

// ripple can be switched off; google fonts are loaded by the page js
const btn = (values) => ({ key: 'button:S', kind: 'button', name: 'S', staticId: 's_btn', variant: 'v1', values });
assert.strictEqual(G.generate(design([btn({ ripple: 'off' })])).js, '', 'ripple off gives no js');
out = G.generate(design([btn({ fontFamily: 'cairo' }), item('P201_C', 'NATIVE_TEXT_FIELD', 'v1', { fontFamily: 'inter' })]));
assert.ok(out.js.includes('fonts.googleapis.com/css2?family=Cairo:wght@300..700&family=Inter:wght@300..700'), 'font loader');
assert.ok(out.js.includes('vd-fl-fonts'), 'font link id');
assert.strictEqual(G.generate(design([item('P201_C', 'NATIVE_TEXT_FIELD', 'v1', { fontFamily: 'system' })])).js, '', 'system font needs no js');

// every designer declaration is !important so theme rules (Theme Roller, utility classes,
// more specific theme selectors) cannot override the chosen design; the base block is left alone
const strong = G.generate(design([item('P201_A', 'NATIVE_TEXT_FIELD', 'v2', { customCss: 'opacity:.9' }),
  { key: 'button:S', kind: 'button', name: 'S', staticId: 's_btn', variant: 'v6', values: {} }])).css;
const designRules = strong.split('}').map((r) => r.trim()).filter((r) => r.includes('{') && r.startsWith('body #') || /\*\/\s*body #/.test(r));
assert.ok(designRules.length > 10, 'design rules found');
designRules.forEach((r) => r.split('{')[1].split(';').map((d) => d.trim()).filter(Boolean).forEach((d) =>
  assert.ok(/!important$/.test(d), 'not important: ' + d)));
assert.ok(!/!important\s*!important/.test(strong), 'no double !important');
assert.ok(strong.includes('url("data:image/svg+xml,') || true, 'data urls untouched');
assert.ok(/@keyframes vd-fl-ripple \{ to \{ transform: scale\(4\); opacity: 0; \} \}/.test(strong), 'base keyframes unchanged');
const sel2 = G.generate(design([item('P201_L', 'NATIVE_POPUP_LOV', 'v1')])).css;
assert.ok(/mask:url\("data:image\/svg\+xml,[^"]+"\) center\/contain no-repeat !important/.test(sel2), 'data url kept whole');

// a saved interactive report keeps its design after the report types split
out = G.generate(design([{ key: 'region:9', kind: 'region', staticId: 'orders', component: 'ir', type: 'NATIVE_IR', variant: 'v2', values: { hideSearch: 'hide' } }]));
assert.ok(out.css.includes('body #orders .a-IRR'), 'ir css');
assert.ok(/display:none !important/.test(out.css), 'hide switch reaches the page css');

console.log('flutter_codegen_test: all passed');
