/* Unit tests for js/layout-mode.js and its wiring. Run: node tests/unit/layout_mode_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, document: { getElementById: () => null } };
['plugin/files/js/layout-model.js', 'plugin/files/js/layout-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.layoutMode;
assert.ok(M, 'VD.layoutMode is undefined');
assert.strictEqual(typeof M.enter, 'function', 'enter');
assert.strictEqual(typeof M.leave, 'function', 'leave');
assert.strictEqual(M.leave(), true, 'leaving with nothing loaded is allowed');

const app = fs.readFileSync('plugin/files/js/app.js', 'utf8');
assert.ok(/layout:\s*function/.test(app), 'app.js VIEWS has layout');

const html = fs.readFileSync('plugin/files/index.html', 'utf8');
const list = html.match(/\[('look-selectors'[^\]]*)\]/)[1];
const at = (n) => list.indexOf("'" + n + "'");
assert.ok(at('repository') >= 0 && at('repository') < at('layout-model'), 'layout-model after repository');
assert.ok(at('layout-model') < at('layout-mode'), 'layout-model before layout-mode');
assert.ok(at('layout-mode') < at('app'), 'layout-mode before app');
assert.ok(/data-view="layout"/.test(html) && /id="view-layout"/.test(html), 'layout tab and view');

console.log('layout_mode_test: all passed');
