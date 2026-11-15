/* Golden test for the design library: the CSS of every type and design, and one theme, must not
   change by a single character unless the fixture is updated on purpose.
   Run: node tests/unit/library_golden_test.js   Update: node tests/unit/library_golden_test.js --update */
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, URL };
['look-selectors', 'component-registry', 'flutter-variants', 'flutter-codegen', 'theme-codegen'].forEach((n) => {
  const f = 'plugin/files/js/' + n + '.js';
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
});
const V = window.VD.flutterVariants, G = window.VD.flutterCodegen, T = window.VD.themeCodegen;
const FIXTURE = path.join(__dirname, 'fixtures', 'library_golden.json');

// A fixed, valid, non-default value for each kind of setting.
function other(p) {
  switch (p.kind) {
    case 'color': return '#123456';
    case 'px': return 7;
    case 'number': return 2;
    case 'weight': return 600;
    case 'select': return p.options[p.options.length - 1];
    case 'css': return 'opacity:.9; cursor:pointer';
    case 'icon': return 'fa-check';
    default: throw new Error('no sample value for kind ' + p.kind);
  }
}
function allSet(variant) {
  const o = {};
  // The disabled, read-only and error settings came after the fixture; they add CSS only when set.
  variant.params.forEach((p) => { if (!['disabled', 'readonly', 'error'].includes(p.state)) o[p.key] = other(p); });
  return o;
}
function sum(text) { return { chars: text.length, sha256: crypto.createHash('sha256').update(text, 'utf8').digest('hex') }; }

const now = {};
const theme = { global: { pageBg: '#fafafa', fontFamily: 'inter' }, types: {} };
V.types.forEach((type) => {
  V.forType(type).forEach((variant, i) => {
    const key = type + '/' + variant.id;
    now[key + ' defaults'] = sum(G.important(variant.css('#X', V.values(variant, {}))));
    now[key + ' all set'] = sum(G.important(variant.css('#X', V.values(variant, allSet(variant)))));
    if (!T.names[type]) return;
    theme.types[type] = theme.types[type] || { styles: [] };
    theme.types[type].styles.push({ name: variant.label, cls: 's' + i, variant: variant.id, values: i ? allSet(variant) : {}, isDefault: i === 0 });
  });
});
assert.strictEqual(T.validate(theme).join(' '), '', 'the fixed theme is valid');
const themeOut = T.themeCss(theme, { app: 1, version: 1, date: '2026-01-01' });
now['theme css'] = sum(themeOut.css);
now['theme js'] = sum(themeOut.js);

if (process.argv.includes('--update')) {
  fs.writeFileSync(FIXTURE, JSON.stringify(now, null, 1) + '\n');
  console.log('library_golden_test: fixture written (' + Object.keys(now).length + ' entries)');
} else {
  const want = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  assert.deepStrictEqual(Object.keys(now).sort(), Object.keys(want).sort(), 'the same types and designs as the fixture');
  Object.keys(want).forEach((k) => assert.deepStrictEqual(now[k], want[k], 'generated output changed: ' + k));
  console.log('library_golden_test: OK (' + Object.keys(want).length + ' entries)');
}
