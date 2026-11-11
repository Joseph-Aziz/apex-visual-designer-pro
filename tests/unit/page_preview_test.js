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
console.log('page_preview_test: 3 passed');
