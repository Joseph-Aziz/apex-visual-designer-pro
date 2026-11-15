/* Unit tests for js/preset-file.js: preset export and import. Run: node tests/unit/preset_file_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, get VD() { return window.VD; }, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/theme-codegen.js', 'plugin/files/js/preset-file.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const F = window.VD.presetFile;
const V = window.VD.flutterVariants;
const same = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
assert.ok(F && F.toFile && F.fromFile, 'presetFile is undefined');

const tv = V.forType('text')[0], bv = V.forType('button')[0];
const colorKey = tv.params.filter((p) => p.kind === 'color')[0].key;
const theme = { global: { pageBg: '#ffffff' }, types: {
  text: { styles: [{ name: 'Soft', cls: 'soft', variant: tv.id, values: { [colorKey]: '#112233' }, isDefault: true },
    { name: 'Plain', cls: 'plain', variant: tv.id, values: {}, isDefault: false }] },
  button: { styles: [{ name: 'Main', cls: 'main', variant: bv.id, values: {}, isDefault: true }] } } };

// Export: the styles only, by family.
const file = F.toFile(theme);
assert.strictEqual(file.format, 'vd-presets');
assert.strictEqual(file.version, 1);
same(Object.keys(file.families).sort(), ['button', 'text']);
assert.ok(!('global' in file), 'no global settings');

// Round trip into an empty theme gives the same styles.
const text = JSON.stringify(file);
const r = F.fromFile({ global: {}, types: {} }, JSON.parse(text));
assert.ok(!r.error, r.error);
same(r.theme.types, theme.types, 'same styles');
assert.strictEqual(r.added, 3);
same(r.renamed, []);

// A class clash is renamed, never overwritten; the target's default stays the only default.
const target = { global: {}, types: { text: { styles: [{ name: 'Mine', cls: 'soft', variant: tv.id, values: {}, isDefault: true }] } } };
const before = JSON.stringify(target);
const r2 = F.fromFile(target, JSON.parse(text));
assert.strictEqual(JSON.stringify(target), before, 'target not changed');
const st = r2.theme.types.text.styles;
same(st.map((s) => s.cls), ['soft', 'soft-2', 'plain']);
same(st[0].name, 'Mine', 'existing style kept');
same(st.filter((s) => s.isDefault).length, 1);
same(r2.renamed, [{ family: 'text', from: 'soft', to: 'soft-2' }]);

// Refused by name.
const bad = (mut) => { const f = JSON.parse(text); mut(f); return F.fromFile({ global: {}, types: {} }, f).error || ''; };
assert.ok(/format/i.test(bad((f) => { f.format = 'other'; })), 'wrong format');
assert.ok(/version/i.test(bad((f) => { f.version = 2; })), 'wrong version');
assert.ok(/nosuch/.test(bad((f) => { f.families.nosuch = []; })), 'unknown family named');
assert.ok(/Soft/.test(bad((f) => { f.families.text[0].variant = 'gone'; })) && /gone/.test(bad((f) => { f.families.text[0].variant = 'gone'; })), 'unknown design named');
const e = bad((f) => { f.families.text[0].values[colorKey] = 'url(x)'; });
assert.ok(e.includes('Soft') && e.includes(colorKey), 'bad value named: ' + e);
assert.ok(/zzz/.test(bad((f) => { f.families.text[0].values.zzz = '1'; })), 'unknown setting named');
assert.ok(/class/i.test(bad((f) => { f.families.text[0].cls = 'Bad Class'; })), 'bad class');
assert.ok(bad((f) => { f.families.text[0].name = ''; }), 'no name');
assert.ok(F.fromFile({ global: {}, types: {} }, null).error, 'not an object');

console.log('preset_file_test: all passed');
