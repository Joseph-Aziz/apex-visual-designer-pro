/* Unit tests for js/theme-codegen.js. Run: node TESTS/theme_codegen_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/theme-codegen.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const T = window.VD.themeCodegen;
assert.ok(T, 'VD.themeCodegen is undefined');

const theme = { global: { pageBg: '#f7f7fb', fontFamily: 'cairo', accent: '#6750a4' }, types: {
  region: { styles: [{ name: 'Card', cls: 'card', variant: 'v1', values: {}, isDefault: true },
    { name: 'مخطط', cls: 'outlined', variant: 'v2', values: {} }] },
  button: { styles: [{ name: 'Tonal', cls: 'tonal', variant: 'v2', values: {} }] } } };
assert.strictEqual(T.validate(theme).length, 0, 'valid theme');

const out = T.themeCss(theme, { app: 100, version: 3, date: '2026-11-11' });
assert.ok(out.css.startsWith('/* vd-theme app 100 version 3 2026-11-11 */'), 'header comment');
assert.ok(out.css.includes('.t-Region.vd-region-outlined'), 'named region style');
assert.ok(out.css.includes('.t-Region:not([class*="vd-region-"])'), 'default region style');
assert.ok(!out.css.includes('.t-Button:not('), 'no default button style was set');
assert.ok(out.css.includes('.t-Button.vd-button-tonal'), 'named button style');
assert.ok(/body \{[^}]*background:#f7f7fb/.test(out.css), 'global page background');
assert.ok(out.js.includes('Cairo'), 'font loader for the global font');

// a named style's rules only reach components with that class
const named = out.css.split('\n').filter((l) => l.includes('vd-region-outlined'));
assert.ok(named.length > 0 && named.every((l) => !l.includes(':not(')), 'named rules carry the class');

// every theme declaration is important, the base keyframes stay as they are
out.css.split('}').filter((r) => r.includes('{') && !r.includes('@keyframes') && !r.includes('vd-fl-ripple') && !r.includes('@media'))
  .forEach((r) => r.split('{').pop().split(';').map((d) => d.trim()).filter(Boolean)
    .forEach((d) => assert.ok(/!important$/.test(d), 'not important: ' + d)));

// selectors
// the default button style leaves the app's own header and navigation buttons alone
assert.strictEqual(T.selectors('button', null), '.t-Button:not([class*="vd-button-"]):not(.t-Header .t-Button, .t-Body-nav .t-Button)');
// interactive reports and grids sit in a t-IRR-region wrapper, not t-Region (checked on a live 26.2 page)
assert.strictEqual(T.selectors('ir', 'clean'), ':is(.t-Region, .t-IRR-region).vd-ir-clean');
assert.ok(T.selectors('ig', null).startsWith(':is(.t-Region, .t-IRR-region):not('), 'ig default reaches t-IRR-region');
assert.strictEqual(T.selectors('region', 'flat'), '.t-Region.vd-region-flat');
assert.ok(T.selectors('ir', null).includes(':has(.a-IRR)'));
assert.ok(T.selectors('text', 'pill').includes(':has(.vd-text-pill)'));
assert.ok(T.selectors('text', null).includes(':not(:has([class*="vd-text-"]))'));

// bad class names, duplicates, two defaults, unknown design
assert.ok(T.validate({ types: { region: { styles: [{ name: 'X', cls: 'Out Lined', variant: 'v1', values: {} }] } } })[0].includes('start with a letter'));
assert.ok(T.validate({ types: { region: { styles: [{ name: 'X', cls: 'خط', variant: 'v1', values: {} }] } } }).length === 1, 'arabic class refused');
assert.ok(T.validate({ types: { region: { styles: [{ name: 'A', cls: 'a', variant: 'v1', isDefault: true },
  { name: 'B', cls: 'a', variant: 'v1', isDefault: true }] } } }).length >= 2, 'duplicate class and two defaults');
assert.strictEqual(T.validate({ types: { region: { styles: [{ name: 'A', cls: 'a', variant: 'v9' }] } } }).length, 1, 'unknown design');
assert.strictEqual(T.validate({ types: { nothing: { styles: [] } } }).length, 1, 'unknown type');

// crafted values never reach the file
const bad = T.themeCss({ types: { region: { styles: [{ name: 'A', cls: 'a', variant: 'v1',
  values: { bg: 'red;}</style>', customCss: 'color:red} body{x:1' } }] } }, global: { pageBg: 'x;}</style>' } }, { app: 1, version: 1, date: 'd' });
assert.ok(!bad.css.includes('</style>') && !bad.css.includes('body{x:1'), 'injection dropped');

console.log('theme_codegen_test: all passed');
