// Shared page bar: input parsing and the remembered open page.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const path = require('path');

function load(storage) {
  const window = { VD: {}, localStorage: storage };
  const ctx = { window, JSON, document: { getElementById: () => null } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../plugin/files/js/page-bar.js'), 'utf8'), ctx);
  return window.VD.pageBar;
}

function memory() {
  const m = {};
  return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } };
}

const B = load(memory());
assert.deepStrictEqual(JSON.parse(JSON.stringify(B.parse('102', '0'))), { app: 102, page: 0 }, 'page 0 is a page');
assert.deepStrictEqual(JSON.parse(JSON.stringify(B.parse(' 102 ', '39'))), { app: 102, page: 39 });
['', 'x', '0', '-1', '1.5'].forEach((a) => assert.ok(B.parse(a, '1').error, 'bad app ' + JSON.stringify(a)));
['', 'x', '-1', '1.5'].forEach((p) => assert.ok(B.parse('102', p).error, 'bad page ' + JSON.stringify(p)));
assert.strictEqual(B.parse('', '').error, 'Enter an app and page number.');

assert.strictEqual(B.current(), null, 'no page before one is opened');
B.remember(102, 39);
assert.deepStrictEqual(JSON.parse(JSON.stringify(B.current())), { app: 102, page: 39 });

const bad = memory(); bad.setItem('vd.page', '{oops');
assert.strictEqual(load(bad).current(), null, 'bad JSON gives no page');
const wrong = memory(); wrong.setItem('vd.page', '{"app":"a","page":1}');
assert.strictEqual(load(wrong).current(), null, 'wrong shape gives no page');
const broken = load({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
assert.strictEqual(broken.current(), null, 'blocked storage gives no page');
broken.remember(1, 1);
assert.deepStrictEqual(JSON.parse(JSON.stringify(broken.current())), { app: 1, page: 1 }, 'kept in memory when storage is blocked');

console.log('page_bar_test: ok');
