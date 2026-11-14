/* Unit tests for js/chart-runtime.js. Run: node tests/unit/chart_runtime_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Fake jQuery event binding on region elements, fake apex.region, recording adapters.
function el(id) { return { id, handlers: {} }; }
function $(x) {
  return {
    0: x,
    on(ev, fn) { (x.handlers[ev] = x.handlers[ev] || []).push(fn); return this; },
    off(ev) { delete x.handlers[ev]; return this; }
  };
}
const regions = {};
function region(id, type) {
  const node = el(id), jet = el(id + '_jet');
  jet.ojChart = (op, p) => ({ type: 'bar', series: [{ id: 's1' }], groups: [{ name: 'g' }] })[p];
  regions[id] = { type: type || 'JetChart', element: $(node), widget: () => $(jet), node, jet };
  return regions[id];
}
const warnings = [];
const window = { apex: { region: (id) => regions[id] || null }, jQuery: $ };
const timers = [];
const ctx = { window, JSON, WeakMap, setTimeout: (fn) => timers.push(fn), console: { warn: (m) => warnings.push(m), log() {} } };
vm.runInNewContext(fs.readFileSync('plugin/files/js/chart-schema.js', 'utf8'), ctx);
vm.runInNewContext(fs.readFileSync('plugin/files/js/chart-runtime.js', 'utf8'), ctx);
const C = window.VD.chart;
assert.ok(C.apply && C.read, 'VD.chart.apply/read missing');

const log = [];
function adapter(name) {
  return {
    capabilities: () => ({ types: [], props: new Set() }),
    apply: (cfg, data, w) => log.push([name, 'apply', w[0].id, data.series.length, cfg]),
    update: (cfg, data, w) => log.push([name, 'update', w[0].id]),
    destroy: (w) => log.push([name, 'destroy', w[0].id]),
    export: () => Promise.reject(new Error('no'))
  };
}
C.adapters.jet = adapter('jet');
C.adapters.echarts = adapter('echarts');

// read
const a = region('a'), b = region('b');
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.read('a'))), { type: 'bar', series: [{ id: 's1' }], groups: [{ name: 'g' }] });

// apply calls the adapter with clean config and data, binds one refresh handler per region
C.apply('a', { version: 1, legend: { position: 'top' }, junk: 1 });
C.apply('a', { version: 1, legend: { position: 'top' } });
C.apply('a', { version: 1, legend: { position: 'top' } });
assert.strictEqual(a.node.handlers['apexafterrefresh.vdchart'].length, 1, 'one handler after three applies');
assert.strictEqual(log[0][0], 'jet');
assert.strictEqual(log[0][2], 'a_jet');
assert.strictEqual(log[0][4].junk, undefined);

// refresh calls update on the right adapter only for that region
C.apply('b', { version: 1 });
log.length = 0;
a.node.handlers['apexafterrefresh.vdchart'][0]();
assert.deepStrictEqual(log, [], 'update waits one tick: APEX writes the new series after the event');
timers.splice(0).forEach((fn) => fn());
assert.deepStrictEqual(log, [['jet', 'update', 'a_jet']]);

// engine switch destroys the previous adapter first
log.length = 0;
C.apply('a', { version: 1, engine: 'echarts' });
assert.deepStrictEqual(log.map((l) => l.slice(0, 3)), [['jet', 'destroy', 'a_jet'], ['echarts', 'apply', 'a_jet']]);

// missing region, non-chart region, future version and adapter errors never throw
region('grid', 'InteractiveGrid');
C.apply('nope', { version: 1 });
C.apply('grid', { version: 1 });
log.length = 0;
C.apply('b', { version: 9 });
C.apply('b', { version: 9 });
assert.strictEqual(log.length, 0, 'newer version applies nothing');
assert.strictEqual(warnings.filter((w) => /newer/.test(w)).length, 1, 'one warning for a newer version');
C.adapters.jet.apply = () => { throw new Error('boom'); };
C.apply('b', { version: 1 });
assert.ok(warnings.some((w) => /boom/.test(w)));

console.log('chart_runtime_test: OK');
