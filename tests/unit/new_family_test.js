/* A family registered from its own file gets a thumbnail, a theme selector, a theme sample and a
   list heading with no edit to the designer files. Run: node tests/unit/new_family_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js',
  'tests/unit/fixtures/test_family.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/theme-codegen.js',
  'plugin/files/js/fl-params.js', 'plugin/files/js/theme-mode.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const VD = window.VD;

const thumbs = VD.flParams.thumbnails('rating', 'v1');
assert.ok(thumbs.html.includes('<div id="fl-thumb-v1"><span class="a-StarRating">'), 'thumbnail markup: ' + thumbs.html);
assert.ok(thumbs.css.includes('#fl-thumb-v1 .a-StarRating { color: gold; }'), 'thumbnail css');

assert.strictEqual(VD.themeCodegen.selectors('rating', null),
  '.t-Form-fieldContainer:not(:has([class*="vd-rating-"])):has(.a-StarRating)');
assert.strictEqual(VD.themeCodegen.names.rating, 'Star ratings');
const theme = { global: {}, types: { rating: { styles: [{ name: 'Gold', cls: 'gold', isDefault: true, variant: 'v1', values: {} }] } } };
assert.deepStrictEqual(Array.from(VD.themeCodegen.validate(theme)), []);
assert.ok(VD.themeCodegen.themeCss(theme, { app: 1, version: 'draft', date: 'x' }).css.includes('.a-StarRating { color: gold'), 'theme css');

assert.ok(VD.themeMode.helpers.sample('rating', 'gold').includes('<span class="a-StarRating vd-rating-gold">'), 'theme sample');
assert.ok(VD.themeMode.helpers.groups().some((g) => Array.from(g[1]).includes('rating')), 'theme type list');

assert.strictEqual(VD.flutterMode.heading('rating'), 'Star ratings');
assert.strictEqual(VD.flutterMode.heading('other'), 'Not supported');

console.log('new_family_test: all passed');
