/* "Add application" in js/flutter-mode.js registers an app through the region's AJAX handler.
   Run: node tests/unit/flutter_add_app_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let calls = [];
let reply = { success: true };
const parentApex = { server: { plugin: (ajax, payload) => { calls.push({ ajax, payload }); return Promise.resolve(reply); } } };
const msg = { textContent: '' };
const host = { querySelector: (s) => (s === '.fl-msg' ? msg : null) };
const window = { confirm: () => true };
window.parent = { apex: parentApex };
const ctx = { window, JSON, Promise, document: { getElementById: (id) => (id === 'flutter-host' ? host : null) } };
['plugin/files/js/look-selectors.js', 'plugin/files/js/flutter-variants.js', 'plugin/files/js/flutter-codegen.js',
  'plugin/files/js/fl-params.js', 'plugin/files/js/repository.js', 'plugin/files/js/flutter-mode.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
window.VD.config = { ajax: 'AJAX-ID' };
ctx.VD = window.VD; // in a browser window is the global object, so the files also say plain VD
const M = window.VD.flutterMode;
assert.strictEqual(typeof M.addApp, 'function', 'addApp is exported');

(async () => {
  M.enter(); // binds the host; render needs more DOM than this stub, so ignore its failure
})().catch(() => {}).then(async () => {
  await M.addApp(100);
  assert.strictEqual(calls.length, 1, 'one AJAX call');
  assert.strictEqual(calls[0].ajax, 'AJAX-ID');
  assert.strictEqual(calls[0].payload.x10, 'register');
  assert.strictEqual(calls[0].payload.x01, '100');
  assert.ok(/100/.test(msg.textContent) && /added/i.test(msg.textContent), 'success message: ' + msg.textContent);

  calls = []; reply = { success: false, message: 'm' };
  await M.addApp(100);
  assert.strictEqual(msg.textContent, 'm', 'server message is shown');

  calls = [];
  await M.addApp(0);
  assert.strictEqual(calls.length, 0, 'no call without an app number');
  console.log('flutter_add_app_test: all passed');
}).catch((e) => { console.error(e); process.exit(1); });
