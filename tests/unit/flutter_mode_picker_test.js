/* Unit tests for the theme style picker helpers in js/flutter-mode.js. Run: node TESTS/flutter_mode_picker_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null, addEventListener() {} } };
Object.defineProperty(ctx, 'VD', { get: () => window.VD }); // the page script reads the global VD
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/undo-stack.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
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

// Apply to all similar: copies design and settings to the other components of the same type, one undo step.
{
  const st = M.state;
  const mk = (n, ftype, extra) => Object.assign({ key: 'item:' + n, kind: 'item', name: n, ftype, label: n }, extra);
  st.components = [mk('P1_A', 'text'), mk('P1_B', 'text'), mk('P1_C', 'text'), mk('P1_D', 'text', { needsStaticId: true }), mk('P1_DT', 'date'), mk('R_CH', 'chart')];
  st.design = { components: [{ key: 'item:P1_A', kind: 'item', name: 'P1_A', variant: 'v3', values: { radius: '8' } }] };
  st.undo = window.VD.undoStack.create(100);
  st.selected = 'item:P1_A'; st.also = [];
  const before = JSON.stringify(st.design);
  assert.strictEqual(M.similarTo('item:P1_A').length, 2, 'count skips itself, other types, charts and Static ID items');
  assert.strictEqual(M.similarTo('item:R_CH').length, 0, 'charts have no similar ones');
  M.applyToSimilar('item:P1_A');
  const get = (k) => st.design.components.filter((c) => c.key === k)[0];
  ['item:P1_B', 'item:P1_C'].forEach((k) => {
    assert.strictEqual(get(k).variant, 'v3');
    assert.deepStrictEqual(get(k).values, { radius: '8' });
    assert.notStrictEqual(get(k).values, get('item:P1_A').values, 'values are copies');
  });
  assert.ok(!get('item:P1_DT') && !get('item:R_CH') && !get('item:P1_D'), 'other types and chart untouched');
  assert.deepStrictEqual(st.also, ['item:P1_B', 'item:P1_C']);
  assert.strictEqual(st.selected, 'item:P1_A');
  M.step(false);
  assert.strictEqual(JSON.stringify(st.design), before, 'one undo restores the design');
}

// Changing a setting with several selected: others with another or no design take the first one's design.
{
  const st = M.state;
  const mk = (n) => ({ key: 'item:' + n, kind: 'item', name: n, ftype: 'text', label: n });
  const get = (k) => st.design.components.filter((c) => c.key === k)[0];
  st.components = [mk('P2_A'), mk('P2_B'), mk('P2_C'), mk('P2_D')];
  st.design = { components: [
    { key: 'item:P2_A', kind: 'item', name: 'P2_A', variant: 'v3', values: { radius: '8' } },
    { key: 'item:P2_C', kind: 'item', name: 'P2_C', variant: 'v4', values: { radius: '2' } },
    { key: 'item:P2_D', kind: 'item', name: 'P2_D', variant: 'v3', values: { radius: '1', accent: '#00f' } }] };
  st.undo = window.VD.undoStack.create(100);
  st.selected = 'item:P2_A'; st.also = ['item:P2_B', 'item:P2_C', 'item:P2_D'];
  const before = JSON.stringify(st.design);
  M.setValue('item:P2_A', 'radius', '12');
  assert.strictEqual(get('item:P2_B').variant, 'v3', 'no design takes the first design');
  assert.deepStrictEqual(get('item:P2_B').values, { radius: '12' });
  assert.strictEqual(get('item:P2_C').variant, 'v3', 'another design is replaced');
  assert.deepStrictEqual(get('item:P2_C').values, { radius: '12' });
  assert.notStrictEqual(get('item:P2_B').values, get('item:P2_A').values, 'values are copies');
  assert.deepStrictEqual(get('item:P2_D').values, { radius: '12', accent: '#00f' }, 'same design keeps its other settings');
  M.step(false);
  assert.strictEqual(JSON.stringify(st.design), before, 'one undo restores all');
}

console.log('flutter_mode_picker_test: all passed');
