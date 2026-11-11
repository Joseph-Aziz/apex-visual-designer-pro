/* Unit tests for the pure theme helpers in js/theme-mode.js. Run: node TESTS/theme_mode_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/theme-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/theme-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.themeMode;
assert.ok(M && M.helpers, 'VD.themeMode.helpers is undefined');
const H = M.helpers;

const empty = H.emptyTheme();
assert.strictEqual(Object.keys(empty.types).length, 0);
let t = H.addStyle(empty, 'region', 'Card', 'card', 'v1');
t = H.addStyle(t, 'region', 'Outlined', 'outlined', 'v2');
assert.strictEqual(t.types.region.styles.length, 2, 'two styles');
assert.strictEqual(Object.keys(empty.types).length, 0, 'input theme unchanged');
assert.strictEqual(t.types.region.styles[0].isDefault, true, 'first style of a type is the default');
assert.strictEqual(!!t.types.region.styles[1].isDefault, false);

const d = H.setDefault(t, 'region', 1);
assert.deepStrictEqual(d.types.region.styles.map((s) => !!s.isDefault).join(), 'false,true', 'one default');
assert.strictEqual(t.types.region.styles[0].isDefault, true, 'setDefault does not change its input');

const r = H.removeStyle(d, 'region', 1);
assert.strictEqual(r.types.region.styles.length, 1);
assert.ok(!r.types.region.styles.some((s) => s.isDefault), 'removing the default leaves no default');
assert.strictEqual(H.removeStyle(r, 'region', 0).types.region, undefined, 'type removed with its last style');

const v = H.setValue(t, 'region', 1, 'bg', '#ff0000');
assert.strictEqual(v.types.region.styles[1].values.bg, '#ff0000');
assert.strictEqual(t.types.region.styles[1].values.bg, undefined);

const s = H.setStyleField(t, 'region', 1, 'cls', 'flat');
assert.strictEqual(s.types.region.styles[1].cls, 'flat');
assert.strictEqual(H.setStyleField(t, 'region', 1, 'variant', 'v3').types.region.styles[1].values && 1, 1, 'values kept as object');

assert.strictEqual(H.suggestClass(t, 'region', 'Outlined'), 'outlined-2', 'free suggestion');
assert.strictEqual(H.suggestClass(t, 'region', 'مخطط'), 'style-3', 'non latin names get a numbered class');

console.log('theme_mode_test: all passed');
