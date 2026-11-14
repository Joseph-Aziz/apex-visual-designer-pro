/* Unit tests for js/chart-designer.js. Run: node tests/unit/chart_designer_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
['plugin/files/js/chart-schema.js', 'plugin/files/js/chart-designer.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f }));
const D = window.VD.chartDesigner;
assert.ok(D, 'VD.chartDesigner is undefined');
const plain = (o) => JSON.parse(JSON.stringify(o));
const ids = (list) => Array.from(list, (n) => n.id); // host-realm array for deepStrictEqual

// tree: one node per series, axes hidden for charts without axes
const series = [{ id: 's1', name: 'Sales' }, { id: 's2', name: 'Cost' }];
let tree = D.nodes('bar', series);
assert.deepStrictEqual(ids(tree), ['chart', 'series:s1', 'series:s2', 'points', 'axis:x', 'axis:y', 'axis:y2',
  'labels', 'legend', 'tooltip', 'refs', 'interact', 'anim']);
assert.strictEqual(tree[1].label, 'Sales');
assert.ok(!ids(D.nodes('pie', series)).some((i) => /^axis/.test(i)), 'pie has no axes');
assert.ok(!ids(D.nodes('gauge', [])).some((i) => /^axis/.test(i)), 'gauge has no axes');

// tabs filter the tree
assert.deepStrictEqual(ids(D.nodes('bar', series, 'axis')), ['axis:x', 'axis:y', 'axis:y2', 'refs']);
assert.deepStrictEqual(ids(D.nodes('bar', series, 'series')), ['series:s1', 'series:s2', 'points']);
assert.strictEqual(D.nodes('bar', series, 'advanced').length, tree.length, 'advanced tab shows every node');

// node → stored path
assert.strictEqual(D.pathOf('chart'), 'global');
assert.strictEqual(D.pathOf('series:s1'), 'series.s1');
assert.strictEqual(D.pathOf('axis:y2'), 'axes.y2');
assert.strictEqual(D.pathOf('legend'), 'legend');

// fields: basic hides advanced rows, engine-only rows are disabled on the other engine
let f = D.fields('global', 'jet', 'basic');
assert.ok(f.every((x) => x.prop.level === 'basic'));
assert.ok(f.some((x) => x.prop.key === 'palette'));
assert.ok(D.fields('global', 'jet', 'advanced').some((x) => x.prop.key === 'barGap'));
f = D.fields('tooltip', 'jet', 'basic');
assert.ok(f.length && f.every((x) => x.disabled === 'Not supported by Oracle JET — switch to ECharts.'));
assert.ok(D.fields('tooltip', 'echarts', 'basic').every((x) => !x.disabled));

// parse raw control text to stored values ('' = back to default)
const P = (s, k) => window.VD.chart.schema.find(s, k);
assert.deepStrictEqual(plain(D.parse(P('legend', 'size'), '14')), { value: 14 });
let r = D.parse(P('legend', 'size'), '');
assert.ok('value' in r && r.value === undefined && !r.error, 'empty = back to default');
assert.ok(D.parse(P('legend', 'size'), '400').error, 'out of range');
assert.ok(D.parse(P('legend', 'size'), 'abc').error, 'not a number');
assert.deepStrictEqual(plain(D.parse(P('legend', 'visible'), 'false')), { value: false });
assert.deepStrictEqual(plain(D.parse(P('legend', 'position'), 'top')), { value: 'top' });
assert.ok(D.parse(P('legend', 'position'), 'middle').error);
assert.deepStrictEqual(plain(D.parse(P('global', 'palette'), '#ff0000, #00ff00')), { value: ['#ff0000', '#00ff00'] });
assert.ok(D.parse(P('global', 'palette'), '#ff0000, red;x').error);
assert.deepStrictEqual(plain(D.parse(P('axis', 'title'), 'Revenue')), { value: 'Revenue' });

// set / get: only explicit values stored, reset removes empty parents, input never changed
const base = { version: 1, engine: 'jet' };
let cfg = D.set(base, 'series.s1.color', '#ff0000');
assert.deepStrictEqual(plain(base), { version: 1, engine: 'jet' }, 'input unchanged');
assert.deepStrictEqual(plain(cfg), { version: 1, engine: 'jet', series: { s1: { color: '#ff0000' } } });
assert.strictEqual(D.get(cfg, 'series.s1.color'), '#ff0000');
assert.strictEqual(D.get(cfg, 'axes.x.title'), undefined);
cfg = D.set(cfg, 'series.s1.color', undefined);
assert.deepStrictEqual(plain(cfg), base, 'reset removes the empty series');
cfg = D.set(base, 'points.s1|7.color', '#00ff00');
assert.deepStrictEqual(plain(cfg.points), { 's1|7': { color: '#00ff00' } });

// reference lines: add, edit, remove
cfg = D.addRef(base);
assert.deepStrictEqual(plain(cfg.refs), [{ axis: 'y', kind: 'line', value: 0 }]);
cfg = D.set(cfg, 'refs.0.color', '#123456');
assert.strictEqual(cfg.refs[0].color, '#123456');
cfg = D.removeRef(cfg, 0);
assert.strictEqual(cfg.refs, undefined, 'last ref removed drops the list');

// engine switch drops a chart type the new engine cannot draw
cfg = D.setEngine({ version: 1, engine: 'echarts', type: 'gauge' }, 'jet');
assert.deepStrictEqual(plain(cfg), { version: 1, engine: 'jet' });
assert.strictEqual(D.setEngine({ version: 1, engine: 'jet', type: 'bar' }, 'echarts').type, 'bar');
assert.ok(D.types('jet').indexOf('gauge') < 0 && D.types('echarts').indexOf('gauge') >= 0);

// markup: escaped, disabled rows carry the reason, a reset button per set field
const view = { node: 'axis:x', tab: 'all', level: 'basic', width: 'desktop' };
let html = D.html({ version: 1, engine: 'jet', axes: { x: { title: '"><script>x</script>' } } }, view, series, []);
assert.ok(!html.includes('<script>'), 'escaped');
assert.ok(html.includes('data-path="axes.x.title"'));
assert.ok(html.includes('data-reset="axes.x.title"'), 'reset for a set field');
assert.ok(!html.includes('data-reset="axes.x.min"'), 'no reset for a default field');
html = D.html({ version: 1, engine: 'jet' }, { node: 'tooltip', tab: 'all', level: 'basic', width: 'desktop' }, series, []);
assert.ok(html.includes('disabled') && html.includes('switch to ECharts'));
html = D.html({ version: 1, engine: 'jet' }, { node: 'points', tab: 'all', level: 'basic', width: 'desktop', point: 's1|7' }, series,
  [{ id: 'g1', name: 'Jan' }]);
assert.ok(html.includes('data-path="points.s1|7.color"'), 'point fields for the chosen point');

// series colours: one colour picker per colour, with add and remove
html = D.html({ version: 1, engine: 'jet', global: { palette: ['#ff0000', '#00ff00'] } }, { node: 'chart', tab: 'all', level: 'basic', width: 'desktop' }, series, []);
assert.strictEqual((html.match(/type="color" data-list="global.palette" data-index="\d"/g) || []).length, 2, 'a picker per colour');
assert.ok(html.includes('value="#00ff00"'));
assert.ok(html.includes('data-list-add="global.palette"'), 'add colour button');
assert.ok(html.includes('data-list-remove="global.palette" data-index="1"'), 'remove colour button');
assert.ok(!/data-path="global.palette"/.test(html), 'no text box for the palette');


// templates: each one is a valid configuration, offered in the header
assert.deepStrictEqual(Array.from(D.templates, (t) => t.id), ['monthlySales', 'statistics', 'tablerTraffic', 'tablerActivity', 'tablerVisitors']);
D.templates.forEach((t) => {
  const r = window.VD.chart.schema.validate(t.chart);
  assert.ok(r.ok, t.id + ': ' + JSON.stringify(r.errors));
});
html = D.html({ version: 1, engine: 'jet' }, { node: 'chart', tab: 'all', level: 'basic', width: 'desktop' }, series, []);
assert.ok(html.includes('data-template') && html.includes('>Monthly sales<') && html.includes('>Statistics<') && html.includes('>Tabler: traffic summary<'), 'template picker');
assert.strictEqual(D.template('statistics').engine, 'echarts');
assert.notStrictEqual(D.template('statistics'), D.template('statistics'), 'a fresh copy each time');
assert.strictEqual(D.template('nope'), null);

console.log('chart_designer_test: all passed');
