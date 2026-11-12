/* The editor calls the Visual Designer region's AJAX handler. Run: node tests/unit/repository_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const code = fs.readFileSync('plugin/files/js/repository.js', 'utf8');

// A repository loaded with its own region config and a fake apex.server.plugin.
function load(ajax) {
  const calls = [];
  const apex = { server: { plugin: (id, data, opt) => {
    calls.push({ id, data: JSON.parse(JSON.stringify(data)), opt });
    const p = { done(fn) { fn({ success: true }); return p; }, fail() { return p; } };
    return p;
  } } };
  const window = { VD: { config: ajax ? { ajax } : {} } };
  window.parent = { apex };
  vm.runInNewContext(code, { window, JSON, Promise, Object, Error, String });
  return { R: window.VD.repository, calls };
}

(async () => {
  const a = load('AJ1');
  await a.R.readFlutter(5, 7);
  assert.strictEqual(a.calls[0].id, 'AJ1');
  assert.deepStrictEqual(a.calls[0].data, { x01: '5', x02: '7', x03: 'read', x10: 'flutter' });
  await a.R.readTheme(5);
  assert.strictEqual(a.calls[1].data.x10, 'theme');
  assert.strictEqual(a.calls[1].data.x02, 'read');
  await a.R.listPageComponents(5, 7);
  assert.deepStrictEqual(a.calls[2].data, { x01: '5', x02: '7', x10: 'components' });
  assert.strictEqual(a.calls[2].opt.dataType, 'json');
  await a.R.layout(5, 7);
  assert.deepStrictEqual(a.calls[3].data, { x01: '5', x02: '7', x03: 'layout', x10: 'flutter' }, 'layout read');

  // two regions on one page: each editor uses its own region's identifier
  const b = load('AJ2');
  await b.R.readFlutter(5, 7);
  assert.strictEqual(b.calls[0].id, 'AJ2');
  assert.strictEqual(a.calls.length, 4, 'region 1 untouched by region 2');

  // no region identifier: the call is refused
  const c = load(null);
  await assert.rejects(c.R.readFlutter(5, 7), (e) => e.code === 'VD_OFFLINE');
  assert.strictEqual(c.calls.length, 0);
  console.log('repository_test: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
