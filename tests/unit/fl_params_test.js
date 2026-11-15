/* Unit tests for js/fl-params.js. Run: node TESTS/fl_params_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/fl-params.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const V = window.VD.flutterVariants, P = window.VD.flParams;
assert.ok(P, 'VD.flParams is undefined');

const date = P.html(V.get('date', 'v1'), {}, {});
assert.ok(date.includes('fl-icon-section'), 'date has the icon section');
assert.ok(date.includes('fl-hide-section'), 'date has the show/hide section');
assert.ok(date.includes('data-param="hideLabel"'), 'date has the label switch');
assert.ok(!P.html(V.get('button', 'v1'), {}, {}).includes('fl-icon-section'), 'button has no icon section');
assert.ok(P.html(V.get('ir', 'v1'), {}, { hide: true }).includes('fl-hide-section" open'), 'hide section open state');
assert.ok(P.html(V.get('ir', 'v1'), {}, { advanced: true }).includes('fl-adv-section" open'), 'advanced open state');
assert.ok(!P.html(V.get('text', 'v1'), { accent: '"><script>x</script>' }, {}).includes('<script>'), 'values are escaped');
assert.ok(P.sample('ir').includes('a-IRR-table'), 'ir sample');
assert.ok(P.sample('text').includes('t-Form-fieldContainer'), 'field sample');

// sections come from each setting's section; a setting whose dependency is false is not drawn
const depV = { id: 'dep', label: 'Dep', params: [
  { key: 'mode', label: 'Mode', kind: 'select', options: ['a', 'b'], default: 'a' },
  { key: 'gapB', label: 'Gap B', kind: 'px', default: '', section: 'advanced', dependsOn: { key: 'mode', equals: 'b' } }] };
assert.ok(/<label class="fl-param" data-for="gapB" hidden>/.test(P.html(depV, { mode: 'a' }, {})), 'dependency false: hidden');
assert.ok(P.html(depV, { mode: 'b' }, {}).includes('fl-adv-section'), 'dependency true: advanced section drawn');
assert.ok(/<label class="fl-param" data-for="gapB">/.test(P.html(depV, { mode: 'b' }, {})), 'dependency true: shown');
// ripple is drawn only for designs that have one
assert.ok(P.html(V.get('button', 'v1'), {}, {}).includes('data-param="ripple"'), 'button has ripple');
assert.ok(!P.html(V.get('text', 'v1'), {}, {}).includes('data-param="ripple"'), 'text has no ripple');

assert.ok(/<summary>States<\/summary>[\s\S]*data-param="disabledOpacity"/.test(P.html(V.get('text', 'v1'), {}, {})), 'States section');

console.log('fl_params_test: all passed');
