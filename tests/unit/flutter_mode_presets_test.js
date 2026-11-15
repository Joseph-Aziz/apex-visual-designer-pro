/* Unit tests for presets in js/flutter-mode.js and the Saved designs list in js/theme-mode.js. Run: node tests/unit/flutter_mode_presets_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, get VD() { return window.VD; }, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/flutter-mode.js', 'plugin/files/js/theme-codegen.js', 'plugin/files/js/theme-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.flutterMode;
const same = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
assert.ok(M.addPreset && M.presetsFor && M.copyPreset, 'preset helpers are undefined');

const textVariant = window.VD.flutterVariants.forType('text')[0].id;

// Save as preset: one new style in the theme, the old theme untouched, a free class name.
const theme = { global: {}, types: { text: { styles: [{ name: 'Soft', cls: 'soft', variant: textVariant, values: {}, isDefault: true }] } } };
const before = JSON.stringify(theme);
const values = { radius: '8' };
const t2 = M.addPreset(theme, 'text', 'Soft', textVariant, values);
assert.strictEqual(JSON.stringify(theme), before, 'theme not changed');
assert.strictEqual(t2.types.text.styles.length, 2);
const added = t2.types.text.styles[1];
same({ name: added.name, cls: added.cls, variant: added.variant, values: added.values, isDefault: added.isDefault },
  { name: 'Soft', cls: 'soft-2', variant: textVariant, values: { radius: '8' }, isDefault: false });
values.radius = '9';
assert.strictEqual(added.values.radius, '8', 'values are copied');
assert.strictEqual(M.addPreset({ global: {}, types: {} }, 'button', 'Main', window.VD.flutterVariants.forType('button')[0].id, {}).types.button.styles[0].isDefault, true, 'first style is the default');

// Presets in the gallery: the theme's styles of the family with a known design.
const t3 = JSON.parse(JSON.stringify(t2));
t3.types.text.styles.push({ name: 'Gone', cls: 'gone', variant: 'no-such-design', values: {} });
same(M.presetsFor(t3, 'text').map((p) => p.cls), ['soft', 'soft-2']);
same(M.presetsFor(null, 'text'), []);
same(M.presetsFor(t3, 'button'), []);
assert.strictEqual(M.presetsFor(t3, 'text')[0].label, 'Soft');

// Copy: the preset's design and values into the component, with presetOf; design untouched.
const comp = { key: 'item:P1_A', kind: 'item', name: 'P1_A', type: 'NATIVE_TEXT_FIELD' };
const design = [{ key: 'item:P1_A', kind: 'item', name: 'P1_A', variant: textVariant, values: { radius: '2' } }];
const copied = M.copyPreset(design, comp, M.presetsFor(t2, 'text')[1]);
assert.strictEqual(design[0].values.radius, '2', 'design not changed');
const a = copied.filter((x) => x.key === comp.key)[0];
same([a.variant, a.values, a.presetOf], [textVariant, { radius: '8' }, 'soft-2']);
assert.ok(!('presetOf' in M.withChoice(copied, comp, textVariant).filter((x) => x.key === comp.key)[0]), 'another choice drops presetOf');

// A copied preset generates like any design; 1.3.0 ignores the extra field.
const G = window.VD.flutterCodegen;
assert.ok(!G.generate({ app: 1, page: 1, components: copied }, {}).error, 'generates');

// Saved designs: the presets grouped by family, in registry order.
const S = window.VD.savedDesigns;
assert.ok(S && S.groups, 'savedDesigns.groups is undefined');
const g = S.groups(t3);
same(g.map((x) => x.family.id), ['text']);
same(g[0].styles.map((s) => s.name), ['Soft', 'Soft', 'Gone']);
same(S.groups(null), []);

console.log('flutter_mode_presets_test: all passed');
