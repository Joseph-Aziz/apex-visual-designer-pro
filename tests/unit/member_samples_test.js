/* Unit tests for member samples: each listed component is a member with its own sample, and the
   gallery draws the member's sample. Run: node tests/unit/member_samples_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, get VD() { return window.VD; }, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/fl-params.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const R = window.VD.componentRegistry, P = window.VD.flParams;

const listed = {
  'Text Field': ['text', 'input'], 'Textarea': ['text', '<textarea'], 'Number Field': ['text', 'number_field'], 'Password': ['text', 'type="password"'],
  'Select List': ['select', '<select'], 'Popup LOV': ['select', 'apex-item-popup-lov'], 'Combobox': ['select', 'a-Combobox'],
  'Checkbox': ['choice', 'apex-item-single-checkbox'], 'Checkbox Group': ['choice', 'type="checkbox"'], 'Radio Group': ['choice', 'type="radio"'],
  'Static Content': ['region', 'Static content'], 'Standard Region': ['region', 't-Region-title']
};
Object.keys(listed).forEach((label) => {
  const [fam, mark] = listed[label];
  const f = R.family(fam);
  assert.ok(f, 'family ' + fam);
  const m = f.members.filter((x) => x.label === label)[0];
  assert.ok(m, label + ' is a member of ' + fam);
  const html = P.gallery(fam, { member: m }).html;
  assert.ok(html.includes(mark), label + ' gallery draws its own sample (' + mark + ')');
  assert.ok(!html.includes('{id}'), label + ': ids replaced');
});
// Samples differ inside a family.
const t = R.family('text').members.map((m) => P.gallery('text', { member: m }).html);
assert.strictEqual(new Set(t).size, t.length, 'text members have their own samples');
// No member: the family sample, as before.
assert.ok(P.gallery('text', {}).html.includes('text_field'));
// The registry refuses a sample that is not text.
assert.throws(() => R.register({ id: 'zz', label: 'Z', plural: 'Zs', category: 'form', members: [{ kind: 'item', label: 'Z', sample: 5 }],
  variants: [{ id: 'v1', label: 'V', css: () => '' }] }), /sample/);

console.log('member_samples_test: all passed');
