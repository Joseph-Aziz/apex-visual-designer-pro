/* Unit tests for the try-on preview in js/flutter-mode.js and js/fl-params.js. Run: node tests/unit/flutter_mode_tryon_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.flutterMode;
const P = window.VD.flParams;
assert.ok(M.withChoice, 'withChoice is undefined');

const comp = { key: 'item:P1_A', kind: 'item', name: 'P1_A', type: 'NATIVE_TEXT_FIELD' };
const design = [{ key: 'item:P1_A', kind: 'item', name: 'P1_A', variant: 'outlined', values: { radius: '4' } },
  { key: 'item:P1_B', kind: 'item', name: 'P1_B', variant: 'filled', values: {} }];
const before = JSON.stringify(design);

const tried = M.withChoice(design, comp, 'filled');
assert.strictEqual(JSON.stringify(design), before, 'the design is not changed');
assert.strictEqual(tried.length, 2);
const a = tried.filter((x) => x.key === comp.key)[0];
assert.strictEqual(a.variant, 'filled');
assert.strictEqual(JSON.stringify(a.values), '{}', 'another design starts with no settings');
assert.strictEqual(JSON.stringify(M.withChoice(design, comp, 'outlined').filter((x) => x.key === comp.key)[0].values), '{"radius":"4"}', 'same design keeps its settings');
assert.strictEqual(JSON.stringify(M.withChoice(design, comp, 'filled', { radius: '9' }).filter((x) => x.key === comp.key)[0].values), '{"radius":"9"}', 'preset values');
assert.strictEqual(M.withChoice(design, comp, null).length, 1, 'no design removes it');

// Gallery cards report pointer and keyboard try-on; leaving reports null.
function el(attrs) {
  const h = {};
  return { attrs, getAttribute: (k) => attrs[k], addEventListener: (t, f) => { h[t] = f; }, fire: (t) => h[t] && h[t]() };
}
const card = el({ 'data-variant': 'filled' }), pre = el({ 'data-preset': '0' });
const root = { querySelectorAll: (q) => (q === '[data-variant]' ? [card] : q === '[data-preset]' ? [pre] : []) };
const seen = [];
P.bindGallery(root, { tryOn: (t) => seen.push(t) });
card.fire('mousemove'); card.fire('mousemove'); card.fire('mouseleave'); card.fire('focus'); card.fire('blur');
pre.fire('mousemove'); pre.fire('mouseleave');
assert.strictEqual(JSON.stringify(seen), JSON.stringify([{ variant: 'filled' }, null, { variant: 'filled' }, null, { preset: 0 }, null]));

// A card re-rendered under a resting pointer gets mouseenter/mouseleave without movement: no try-on.
seen.length = 0;
card.fire('mouseenter'); card.fire('mouseleave');
assert.strictEqual(seen.length, 0);

console.log('flutter_mode_tryon_test: all passed');
