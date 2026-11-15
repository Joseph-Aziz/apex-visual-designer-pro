/* Unit tests for the component browser helpers in js/flutter-mode.js. Run: node tests/unit/flutter_mode_browser_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js', 'plugin/files/js/fl-params.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.flutterMode;
const REG = window.VD.componentRegistry;
assert.ok(M.browserTiles, 'browserTiles is undefined');

const cats = REG.categories();
const page = [
  { kind: 'item', type: 'NATIVE_TEXT_FIELD' },
  { kind: 'item', type: 'NATIVE_TEXT_FIELD' },
  { kind: 'item', type: 'NATIVE_TEXTAREA' },
  { kind: 'button' },
  { kind: 'region' },
  { kind: 'region', type: 'NATIVE_STATIC' }
];
page.forEach((c) => { c.ftype = window.VD.flutterVariants.typeOf(c); });

const groups = M.browserTiles(cats, page, '');
const all = [].concat(...groups.map((g) => g.tiles));
// Every registered family and member is a tile, under its category.
const members = [].concat(...REG.families().map((f) => f.members.map((m) => f.id + '/' + m.label)));
assert.strictEqual(all.length, members.length, 'one tile per member');
assert.deepStrictEqual(groups.map((g) => g.id), cats.map((c) => c.id), 'categories in registry order');
groups.forEach((g) => g.tiles.forEach((t) => assert.strictEqual(t.family.category, g.id, 'tile under its category')));

const count = (fam, label) => all.filter((t) => t.family.id === fam && t.member.label === label)[0].count;
assert.strictEqual(count('text', 'Text Field'), 2);
assert.strictEqual(count('text', 'Textarea'), 1);
assert.strictEqual(count('text', 'Password'), 0);
assert.strictEqual(count('button', 'Button'), 1, 'catch-all member');
assert.strictEqual(count('region', 'Standard Region'), 1, 'catch-all takes what no other member names');
assert.strictEqual(count('region', 'Static Content'), 1);
assert.strictEqual(count('chart', 'Chart'), 0);

// Search filters on member, family and category labels; empty categories drop out.
const found = M.browserTiles(cats, page, 'textarea');
assert.strictEqual(found.length, 1);
assert.strictEqual(found[0].tiles.length, 1);
assert.strictEqual(found[0].tiles[0].member.label, 'Textarea');
assert.ok(M.browserTiles(cats, page, '  CHART ').some((g) => g.tiles.some((t) => t.family.id === 'chart')), 'case and spaces ignored');
assert.strictEqual(M.browserTiles(cats, page, 'zzzz').length, 0);

// The page components of one member, for the browse panel.
assert.strictEqual(M.memberComponents(REG.family('text'), REG.family('text').members[0], page).length, 2);

// Preview widths.
assert.strictEqual(M.WIDTHS.desktop, '');
assert.strictEqual(M.WIDTHS.tablet, '768px');
assert.strictEqual(M.WIDTHS.mobile, '375px');

console.log('flutter_mode_browser_test: all passed');
