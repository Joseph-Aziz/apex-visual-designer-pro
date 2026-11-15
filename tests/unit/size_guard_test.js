/* Unit tests for the size guard in js/flutter-codegen.js. Run: node tests/unit/size_guard_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, get VD() { return window.VD; }, document: { getElementById: () => null, addEventListener() {} } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/component-registry.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const G = window.VD.flutterCodegen;
assert.ok(G.sizeError && G.LIMIT === 32767, 'sizeError and LIMIT');

assert.strictEqual(G.sizeError('a'.repeat(32767), 'a'.repeat(32767)), '', 'at the limit is fine');
const css = G.sizeError('a'.repeat(40000), '');
assert.ok(/CSS/.test(css) && /40,000/.test(css) && /32,767/.test(css), 'CSS too large, sizes named: ' + css);
assert.ok(/fewer|remove|theme/i.test(css), 'says what to do');
const js = G.sizeError('', 'b'.repeat(33000));
assert.ok(/JavaScript/.test(js) && /33,000/.test(js), 'JS too large: ' + js);
assert.strictEqual(G.sizeError(null, undefined), '');

// The save path checks the merged page text: the page's own code counts too.
const src = fs.readFileSync('plugin/files/js/flutter-mode.js', 'utf8');
const save = src.slice(src.indexOf('function save('), src.indexOf('function openHistory'));
assert.ok(/sizeError\(cssCheck\.text, jsCheck\.text\)/.test(save), 'save checks the merged text');
assert.ok(save.indexOf('sizeError') < save.indexOf('saveFlutter'), 'checked before the page is touched');

console.log('size_guard_test: all passed');
