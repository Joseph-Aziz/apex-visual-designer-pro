/* Unit tests for js/component-registry.js. Run: node tests/unit/component_registry_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

function load() {
  const window = {};
  vm.runInNewContext(fs.readFileSync('plugin/files/js/component-registry.js', 'utf8'), { window, JSON }, { filename: 'component-registry.js' });
  return window.VD.componentRegistry;
}
const css = (sel) => sel + ' { color:red }\n';
const variant = (id, extra) => Object.assign({ id, label: 'Design ' + id, css }, extra || {});
const family = (id, extra) => Object.assign({ id, label: 'Thing', plural: 'Things', category: 'form',
  members: [{ kind: 'item', apexType: 'NATIVE_' + id.toUpperCase(), label: 'Thing' }],
  variants: [variant('v1'), variant('v2')] }, extra || {});
const refused = (R, def, word) => assert.throws(() => R.register(def), (e) => e.message.indexOf(word) >= 0, 'refused, naming: ' + word);

let R = load();
assert.ok(R, 'VD.componentRegistry is undefined');
assert.strictEqual(R.families().length, 0, 'starts empty');

// register and read back
R.register(family('alpha', { settings: [{ key: 'accent', label: 'Accent', kind: 'color', default: '#112233' }] }));
assert.deepStrictEqual(Array.from(R.families().map((f) => f.id)), ['alpha']);
assert.strictEqual(R.family('alpha').label, 'Thing');
assert.strictEqual(R.family('nope'), null);
assert.strictEqual(R.variant('alpha', 'v2').label, 'Design v2');
assert.strictEqual(R.variant('alpha', 'v9'), null);
assert.strictEqual(R.variant('nope', 'v1'), null);
assert.strictEqual(R.family('alpha').defaultVariant, 'v1', 'the first design is the default');
assert.strictEqual(R.variant('alpha', 'v1').builtIn, true, 'designs of a registered family are built in');

// a design added later, in a file of its own
R.registerVariant('alpha', variant('v3'));
assert.deepStrictEqual(Array.from(R.family('alpha').variants.map((v) => v.id)), ['v1', 'v2', 'v3']);
assert.throws(() => R.registerVariant('alpha', variant('v3')), /v3/, 'the same design id twice');
assert.throws(() => R.registerVariant('nope', variant('v1')), /nope/, 'unknown family');
assert.throws(() => R.registerVariant('alpha', { id: 'v4', label: 'No css' }), /css/);

// bad definitions are refused, naming the fault
R = load();
refused(R, family('Bad Id'), 'id');
refused(R, family('alpha', { category: 'toys' }), 'category');
refused(R, family('alpha', { label: '' }), 'label');
refused(R, family('alpha', { variants: [] }), 'design');
refused(R, family('alpha', { variants: [variant('v1'), variant('v1')] }), 'v1');
refused(R, family('alpha', { variants: [{ id: 'v1', label: 'x' }] }), 'css');
refused(R, family('alpha', { members: [] }), 'member');
refused(R, family('alpha', { members: [{ kind: 'page', label: 'x' }] }), 'kind');
refused(R, family('alpha', { settings: [{ key: 'a', label: 'A', kind: 'rainbow', default: '' }] }), 'rainbow');
refused(R, family('alpha', { settings: [{ key: 'a', label: 'A', kind: 'color' }] }), 'default');
refused(R, family('alpha', { settings: [{ key: 'a', label: 'A', kind: 'select', default: '' }] }), 'options');
refused(R, family('alpha', { defaultVariant: 'v9' }), 'v9');
assert.strictEqual(R.families().length, 0, 'a refused family is not registered');
R.register(family('alpha'));
refused(R, family('alpha'), 'alpha');

// which family a page component belongs to
R = load();
R.register(family('region', { category: 'region', members: [{ kind: 'region', label: 'Region' }] }));
R.register(family('cards', { category: 'region', members: [{ kind: 'region', apexType: 'NATIVE_CARDS', label: 'Cards' }] }));
R.register(family('ir', { category: 'report', members: [{ kind: 'region', label: 'Interactive report' }],
  match: (c) => c.kind === 'region' && c.component === 'ir' }));
R.register(family('text', { members: [{ kind: 'item', apexType: 'NATIVE_TEXT_FIELD', label: 'Text field' },
  { kind: 'item', apexType: 'NATIVE_TEXTAREA', label: 'Textarea' }] }));
R.register(family('button', { category: 'action', members: [{ kind: 'button', label: 'Button' }] }));
const of = (c) => { const f = R.familyOf(c); return f && f.id; };
assert.strictEqual(of({ kind: 'item', type: 'NATIVE_TEXTAREA' }), 'text');
assert.strictEqual(of({ kind: 'item', type: 'PLUGIN_X' }), null, 'unknown item type');
assert.strictEqual(of({ kind: 'button' }), 'button');
assert.strictEqual(of({ kind: 'region', type: 'NATIVE_CARDS' }), 'cards', 'a named type wins over the catch-all registered before it');
assert.strictEqual(of({ kind: 'region', type: 'NATIVE_IR', component: 'ir' }), 'ir', 'match wins over the catch-all');
assert.strictEqual(of({ kind: 'region', type: 'NATIVE_STATIC' }), 'region', 'catch-all');
assert.strictEqual(of(null), null);

// categories, in a fixed order, only those in use
assert.deepStrictEqual(Array.from(R.categories().map((c) => c.id)), ['form', 'action', 'region', 'report']);
assert.deepStrictEqual(Array.from(R.categories()[2].families.map((f) => f.id)), ['region', 'cards']);
assert.ok(R.categories().every((c) => c.label), 'each category has a label');

// what comes back cannot change the registry
R.families().pop();
assert.strictEqual(R.families().length, 5);

console.log('component_registry_test: OK');
