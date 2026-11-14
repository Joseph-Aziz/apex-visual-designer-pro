/* Unit tests for js/chart-schema.js. Run: node tests/unit/chart_schema_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
vm.runInNewContext(fs.readFileSync('plugin/files/js/chart-schema.js', 'utf8'), { window, JSON }, { filename: 'chart-schema.js' });
const S = window.VD && window.VD.chart && window.VD.chart.schema;
assert.ok(S, 'VD.chart.schema is undefined');

// table shape
assert.strictEqual(S.VERSION, 1);
assert.ok(S.PROPS.length > 40, 'property table too small');
S.PROPS.forEach((p) => {
  ['key', 'section', 'type', 'engines', 'label', 'level'].forEach((f) => assert.ok(p[f] !== undefined, p.section + '.' + p.key + ' lacks ' + f));
  assert.ok(['color', 'number', 'px', 'percent', 'bool', 'enum', 'text', 'list'].indexOf(p.type) >= 0, 'bad type ' + p.key);
  assert.ok(['basic', 'advanced'].indexOf(p.level) >= 0);
  if (p.type === 'enum') assert.ok(Array.isArray(p.rule.values) && p.rule.values.length, 'enum without values ' + p.key);
});
const ids = S.PROPS.map((p) => p.section + '.' + p.key);
assert.strictEqual(new Set(ids).size, ids.length, 'duplicate property');
assert.ok(S.find('series', 'color'));
assert.strictEqual(S.find('series', 'nope'), null);

// defaults come from the table
assert.strictEqual(S.defaults('legend').visible, true);

// valid config passes; clean keeps only known valid values
const good = {
  version: 1, engine: 'jet', type: 'column',
  global: { palette: ['#0f766e', '#2563eb'], plotBackground: '#ffffff' },
  series: { 'series-1': { color: '#ff0000', lineWidth: 3 } },
  points: { 'series-1|7': { color: 'rgb(1,2,3)' } },
  axes: { y: { min: 0, max: 100, gridStyle: 'dashed' } },
  legend: { position: 'bottom' },
  refs: [{ axis: 'y', kind: 'line', value: 50, color: '#dc2626' }],
  future: { x: 1 }
};
let r = S.validate(good, 'jet');
assert.ok(r.ok, JSON.stringify(r.errors));
assert.strictEqual(r.clean.series['series-1'].color, '#ff0000');
assert.strictEqual(r.clean.axes.y.min, 0);
assert.strictEqual(r.clean.future, undefined, 'unknown keys are ignored on apply');
assert.deepStrictEqual(good.future, { x: 1 }, 'validate must not change the stored config');

// invalid values dropped with an error naming the path
r = S.validate({ version: 1, series: { s1: { color: 'red;}', lineWidth: 99 } }, axes: { y: { gridStyle: 'wavy' } },
  legend: { visible: 'yes' }, global: { palette: ['#fff', 'x'] }, type: 'pyramid' }, 'jet');
assert.ok(!r.ok);
['series.s1.color', 'series.s1.lineWidth', 'axes.y.gridStyle', 'legend.visible', 'global.palette', 'type']
  .forEach((p) => assert.ok(r.errors.some((e) => e.path === p), 'no error for ' + p));
assert.strictEqual(r.clean.series.s1.color, undefined);
assert.strictEqual(r.clean.type, undefined);

// text is limited in length
r = S.validate({ version: 1, axes: { x: { title: new Array(300).join('a') } } }, 'jet');
assert.ok(r.errors.some((e) => e.path === 'axes.x.title'));

// a property the engine cannot draw is reported and dropped
r = S.validate({ version: 1, tooltip: { background: '#000000' }, type: 'heatmap' }, 'jet');
assert.ok(r.errors.some((e) => e.path === 'tooltip.background' && e.code === 'engine'));
assert.ok(r.errors.some((e) => e.path === 'type' && e.code === 'engine'));
assert.strictEqual(r.clean.tooltip, undefined);
assert.ok(S.validate({ version: 1, tooltip: { background: '#000000' }, type: 'heatmap' }, 'echarts').ok);

// bad refs dropped one by one
r = S.validate({ version: 1, refs: [{ axis: 'y', kind: 'line', value: 'x' }, { axis: 'y', kind: 'zone', low: 1, high: 2 }] }, 'jet');
assert.strictEqual(r.clean.refs.length, 1);
assert.strictEqual(r.clean.refs[0].kind, 'zone');

// newer version: nothing applies
r = S.validate({ version: 2, legend: { visible: false } }, 'jet');
assert.ok(!r.ok);
assert.strictEqual(r.clean, null);
assert.strictEqual(r.errors[0].code, 'version');

// reset one property removes the key and empty parents; reset all keeps version, engine, type
const c = { version: 1, engine: 'jet', type: 'line', series: { s1: { color: '#000000' } }, legend: { visible: false, position: 'top' } };
let n = S.reset(c, 'series.s1.color');
assert.deepStrictEqual(n.series, undefined);
assert.strictEqual(c.series.s1.color, '#000000', 'reset must not change its input');
n = S.reset(c, 'legend.visible');
assert.deepStrictEqual(n.legend, { position: 'top' });
assert.deepStrictEqual(S.resetAll(c), { version: 1, engine: 'jet', type: 'line' });

console.log('chart_schema_test: OK');
