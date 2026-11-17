/* Unit tests for the theme style picker helpers in js/flutter-mode.js. Run: node TESTS/flutter_mode_picker_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null, addEventListener() {} } };
Object.defineProperty(ctx, 'VD', { get: () => window.VD }); // the page script reads the global VD
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
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

// Label position stays when another design is picked; other settings start empty.
{
  const c = { key: 'item:P1_X', kind: 'item', name: 'P1_X', ftype: 'text' };
  const before = [{ key: c.key, kind: 'item', name: 'P1_X', variant: 'v1', values: { labelPosition: 'inside', accent: '#ff0000' } }];
  const after = M.withChoice(before, c, 'v2')[0];
  assert.strictEqual(after.variant, 'v2');
  assert.strictEqual(JSON.stringify(after.values), JSON.stringify({ labelPosition: 'inside' }), 'only label position carries over');
  const same = M.withChoice(before, c, 'v1')[0];
  assert.strictEqual(same.values.accent, '#ff0000', 'same design keeps all settings');
  const none = M.withChoice([{ key: c.key, kind: 'item', name: 'P1_X', variant: 'v1', values: { accent: '#ff0000' } }], c, 'v2')[0];
  assert.strictEqual(JSON.stringify(none.values), '{}', 'nothing to carry');
  const btn = { key: 'button:B', kind: 'button', name: 'B', ftype: 'button' };
  const b = M.withChoice([{ key: btn.key, kind: 'button', name: 'B', variant: 'filled', values: { labelPosition: 'inside' } }], btn, 'tonal')[0];
  assert.strictEqual(JSON.stringify(b.values), '{}', 'a type without the setting carries nothing');
}

console.log('flutter_mode_picker_test: all passed');
