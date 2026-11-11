/* Unit tests for the theme style picker helpers in js/flutter-mode.js. Run: node TESTS/flutter_mode_picker_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.flutterMode;
assert.ok(M.stylesFor, 'stylesFor is undefined');

assert.strictEqual(M.stylesFor(null, 'region').length, 0, 'no pushed theme, no styles');
const theme = { types: { region: { styles: [{ name: 'Card', cls: 'card', isDefault: true }, { name: 'مخطط', cls: 'outlined' }] } } };
assert.strictEqual(JSON.stringify(M.stylesFor(theme, 'region')), JSON.stringify([{ name: 'Card', cls: 'card' }, { name: 'مخطط', cls: 'outlined' }]));
assert.strictEqual(M.stylesFor(theme, 'button').length, 0, 'type with no styles');

assert.strictEqual(M.currentStyle('t-Region--x vd-region-outlined', 'region'), 'outlined');
assert.strictEqual(M.currentStyle('vd-button-tonal', 'region'), '', 'another type does not count');
assert.strictEqual(M.currentStyle(null, 'region'), '');

console.log('flutter_mode_picker_test: all passed');
