/* Unit tests for js/chart-migrate.js (spec §8). Run: node tests/unit/chart_migrate_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/chart-schema.js', 'plugin/files/js/chart-migrate.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const M = window.VD.chartMigrate;
assert.ok(M, 'VD.chartMigrate is undefined');
const plain = (o) => JSON.parse(JSON.stringify(o));

const old = (variant, values) => ({ key: 'region:sales', kind: 'region', staticId: 'sales', type: 'NATIVE_JET_CHART', variant, values });

// v1 with owner values: palette, frame, axes; v1 keeps a border and dashed grid lines
let e = M.entry(old('v1', { series1: '#111111', series2: '#222222', series3: '#333333', grid: '#444444', bg: '#555555',
  text: '#666666', border: '#777777', radius: 9 }));
assert.deepStrictEqual(plain(e.chart), {
  version: 1, engine: 'jet',
  global: { palette: ['#111111', '#222222', '#333333'], background: '#555555', border: '#777777', radius: 9 },
  axes: {
    x: { gridColor: '#444444', gridStyle: 'dashed', labelColor: '#666666', axisLineColor: '#444444' },
    y: { gridColor: '#444444', gridStyle: 'dashed', labelColor: '#666666', axisLineColor: '#444444' }
  },
  legend: { color: '#666666' }
});
assert.strictEqual(e.variant, 'v1', 'variant kept until the first save');
assert.ok(e.values, 'values kept until the first save');

// v2 (Minimal): solid grid, no border; missing values take the old look's defaults
e = M.entry(old('v2', {}));
assert.strictEqual(e.chart.axes.x.gridStyle, 'solid');
assert.strictEqual(e.chart.global.border, undefined, 'Minimal had no border');
assert.deepStrictEqual(plain(e.chart.global.palette), ['#334155', '#94a3b8', '#cbd5e1']);
assert.strictEqual(e.chart.global.radius, 8);
// v3 (Soft) had no border either; v4 (Dark) had one
assert.strictEqual(M.entry(old('v3', {})).chart.global.border, undefined);
assert.strictEqual(M.entry(old('v4', {})).chart.global.border, '#1e293b');
// bad owner values fall back to the defaults
e = M.entry(old('v3', { series1: 'red;}', radius: 999 }));
assert.strictEqual(e.chart.global.palette[0], '#6366f1');
assert.strictEqual(e.chart.global.radius, 20);

// every migrated config is valid for both engines
['v1', 'v2', 'v3', 'v4'].forEach((v) => {
  const r = window.VD.chart.schema.validate(M.entry(old(v, {})).chart, 'jet');
  assert.ok(r.clean && !r.errors.length, v + ' validates: ' + JSON.stringify(r.errors));
});

// idempotent; other entries untouched
const done = { key: 'region:sales', type: 'NATIVE_JET_CHART', staticId: 'sales', chart: { version: 1, engine: 'echarts' }, variant: 'v1', values: {} };
assert.strictEqual(M.entry(done), done);
const btn = { key: 'button:go', kind: 'button', variant: 'v1', values: {} };
assert.strictEqual(M.entry(btn), btn);
assert.strictEqual(M.entry(old('v9', {})).chart, undefined, 'unknown look left alone');

// design: reports whether anything changed and never changes its input
const design = { components: [old('v1', {}), btn] };
const before = JSON.stringify(design);
let r = M.design(design);
assert.strictEqual(r.changed, true);
assert.ok(r.design.components[0].chart);
assert.strictEqual(JSON.stringify(design), before, 'input unchanged');
assert.strictEqual(M.design(r.design).changed, false, 'second run changes nothing');

// strip: entries with a chart lose the old variant and values (done at save)
const s = M.strip(r.design);
assert.strictEqual(s.components[0].variant, undefined);
assert.strictEqual(s.components[0].values, undefined);
assert.strictEqual(s.components[1].variant, 'v1', 'other components keep their variant');

console.log('chart_migrate_test: all passed');
