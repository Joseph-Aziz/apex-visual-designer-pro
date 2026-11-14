/* "Add application" in js/page-bar.js registers an app through the region's AJAX handler.
   Run: node tests/unit/page_bar_add_app_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

let calls = [];
let reply = { success: true };
const parentApex = { server: { plugin: (ajax, payload) => { calls.push({ ajax, payload }); return Promise.resolve(reply); } } };
const window = {};
window.parent = { apex: parentApex };
const ctx = { window, JSON, Promise, document: { getElementById: () => null } };
['plugin/files/js/repository.js', 'plugin/files/js/page-bar.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
window.VD.config = { ajax: 'AJAX-ID' };
ctx.VD = window.VD; // in a browser window is the global object, so the files also say plain VD
const B = window.VD.pageBar;

(async () => {
  let text = await B.addApp(100);
  assert.strictEqual(calls.length, 1, 'one AJAX call');
  assert.strictEqual(calls[0].ajax, 'AJAX-ID');
  assert.strictEqual(calls[0].payload.x10, 'register');
  assert.strictEqual(calls[0].payload.x01, '100');
  assert.ok(/100/.test(text) && /added/i.test(text), 'success message: ' + text);

  calls = []; reply = { success: false, message: 'm' };
  text = await B.addApp(100);
  assert.strictEqual(text, 'm', 'server message is shown');

  calls = [];
  text = await B.addApp(null);
  assert.strictEqual(calls.length, 0, 'no call without an app number');
  assert.strictEqual(text, 'Enter an application number.');
  console.log('page_bar_add_app_test: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
