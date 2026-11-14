/* The live preview must not hand the host app's session to another app. Run: node tests/unit/page_preview_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const code = fs.readFileSync('plugin/files/js/page-preview.js', 'utf8');

const window = { parent: { apex: { env: { APP_ID: '147', APP_SESSION: '111' } }, location: { pathname: '/ords/r/ws/host/home' } } };
vm.runInNewContext(code, { window });
const url = window.VD.pagePreview.url;

assert.strictEqual(url(147, 1), '/ords/f?p=147:1:111', 'same app keeps the session');
assert.strictEqual(url('147', 2), '/ords/f?p=147:2:111', 'same app as a string keeps the session');
assert.strictEqual(url(100, 4), '/ords/f?p=100:4', 'another app gets no session id');
assert.strictEqual(url(100, 4, true), '/ords/f?p=100:4:111', 'another app that shares the session gets it');
assert.strictEqual(url(100, 4, false), '/ords/f?p=100:4', 'not shared: no session id');
// APEX refuses to run page 0 by URL (WWV_FLOW.PAGE_PROTECTION.SHOW_NO_URL_ALLOWED), so it has no preview.
const runnable = window.VD.pagePreview.runnable;
assert.strictEqual(runnable(0), false, 'page 0 cannot be previewed');
assert.strictEqual(runnable('0'), false, 'page 0 as a string cannot be previewed');
assert.strictEqual(runnable(1), true, 'page 1 can be previewed');
console.log('page_preview_test: 8 passed');
