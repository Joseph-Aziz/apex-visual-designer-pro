/* Unit tests for js/chart-jet.js. Run: node tests/unit/chart_jet_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON, WeakMap, console };
['chart-schema.js', 'chart-jet.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync('plugin/files/js/' + f, 'utf8'), ctx, { filename: f }));
const J = window.VD.chart.adapters.jet;
const S = window.VD.chart.schema;
assert.ok(J, 'VD.chart.adapters.jet is undefined');

// Fake ojChart widget: options kept as nested objects and read/written by dotted path like JET,
// set calls recorded, null crashes like JET. w.store reads and writes by dotted path too.
function fakeChart(init) {
  const root = {};
  const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const getPath = (p) => p.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), root);
  const setPath = (p, v) => {
    const ks = p.split('.'), last = ks.pop();
    let o = root;
    ks.forEach((k) => { if (!o[k] || typeof o[k] !== 'object') o[k] = {}; o = o[k]; });
    o[last] = copy(v);
  };
  Object.keys(init || {}).forEach((k) => setPath(k, init[k]));
  const store = new Proxy({}, { get: (t, p) => getPath(p), set: (t, p, v) => { setPath(p, v); return true; } });
  const w = { calls: [], store };
  w[0] = w;
  w.ojChart = function (op, path, value) {
    assert.strictEqual(op, 'option');
    if (arguments.length === 2) return copy(getPath(path));
    if (value === null || value === undefined) throw new Error('getColorFromName: null set on ' + path);
    w.calls.push([path, copy(value)]);
    setPath(path, value);
  };
  return w;
}
const SERIES = () => [
  { id: 'series-1', name: 'Sales', items: [{ id: 'a', value: 1 }, { id: 'b', value: 2 }] },
  { id: 'series-2', name: 'Cost', color: '#123456', items: [{ id: 'a', value: 3 }, { id: 'b', value: 4 }] }];
const apply = (cfg, w) => J.apply(S.validate(cfg, 'jet').clean, null, w);
const callFor = (w, p) => w.calls.filter((c) => c[0] === p).pop();

// capabilities
const cap = J.capabilities('line');
assert.ok(cap.types.indexOf('column') >= 0 && cap.types.indexOf('heatmap') < 0);
assert.ok(cap.props.has('series.color') && !cap.props.has('tooltip.background'));

// type mapping
let w = fakeChart({ type: 'line', series: SERIES() });
apply({ version: 1, type: 'bar' }, w);
assert.deepStrictEqual(callFor(w, 'type')[1], 'bar');
assert.deepStrictEqual(callFor(w, 'orientation')[1], 'horizontal');
w = fakeChart({ type: 'bar', series: SERIES() });
apply({ version: 1, type: 'smoothLine' }, w);
assert.strictEqual(callFor(w, 'styleDefaults.lineType')[1], 'curved');
w = fakeChart({ type: 'bar', series: SERIES() });
apply({ version: 1, type: 'donut' }, w);
assert.strictEqual(callFor(w, 'type')[1], 'pie');
assert.strictEqual(callFor(w, 'styleDefaults.pieInnerRadius')[1], 0.5);

// global, axes, legend, interactions, animation
w = fakeChart({ series: SERIES() });
apply({ version: 1,
  global: { palette: ['#111111', '#222222'], plotBackground: '#fafafa', background: '#ffffff' },
  axes: { x: { title: 'Month', titleColor: '#333333', rotation: 'none', labelColor: '#444444', labelSize: 12 },
          y: { min: 0, max: 50, gridColor: '#eeeeee', gridStyle: 'dashed', visible: false } },
  legend: { visible: true, position: 'bottom', color: '#555555' },
  interact: { zoom: true, crosshair: true, highlight: true, seriesToggle: false },
  anim: { enabled: false, duration: 300 },
  labels: { color: '#666666', size: 10 } }, w);
const expect = {
  'styleDefaults.colors': ['#111111', '#222222'], 'plotArea.backgroundColor': '#fafafa',
  'xAxis.title': 'Month', 'xAxis.titleStyle': { color: '#333333' }, 'xAxis.tickLabel.rotation': 'none',
  'xAxis.tickLabel.style': { color: '#444444', fontSize: '12px' },
  'yAxis.min': 0, 'yAxis.max': 50, 'yAxis.majorTick.lineColor': '#eeeeee', 'yAxis.majorTick.lineStyle': 'dashed',
  'yAxis.rendered': 'off', 'legend.rendered': 'on', 'legend.position': 'bottom', 'legend.textStyle': { color: '#555555' },
  zoomAndScroll: 'live', dataCursor: 'on', hoverBehavior: 'dim', hideAndShowBehavior: 'none',
  animationOnDisplay: 'none', animationOnDataChange: 'none', 'styleDefaults.animationDuration': 300,
  'styleDefaults.dataLabelStyle': { color: '#666666', fontSize: '10px' } };
Object.keys(expect).forEach((p) => assert.deepStrictEqual((callFor(w, p) || [])[1], expect[p], p));
assert.ok(!w.calls.some((c) => /background$/i.test(c[0]) && c[1] === '#ffffff'), 'region CSS props are not JET options');

// reference lines and zones go to the axis referenceObjects
w = fakeChart({ series: SERIES() });
apply({ version: 1, refs: [{ axis: 'y', kind: 'line', value: 40, color: '#dc2626', style: 'dashed', width: 2, label: 'Target' },
  { axis: 'y', kind: 'zone', low: 0, high: 10, color: '#fee2e2' }] }, w);
assert.deepStrictEqual(callFor(w, 'yAxis.referenceObjects')[1], [
  { type: 'line', value: 40, color: '#dc2626', lineStyle: 'dashed', lineWidth: 2, text: 'Target', displayInLegend: 'off' },
  { type: 'area', low: 0, high: 10, color: '#fee2e2', displayInLegend: 'off' }]);

// per-series and per-point settings, by id
w = fakeChart({ series: SERIES() });
apply({ version: 1, series: { 'series-2': { color: '#ff0000', marker: true, y2: true, visible: false } },
  points: { 'series-1|b': { color: '#00ff00', label: false } }, labels: { visible: true, position: 'outsideBarEdge' } }, w);
let s = w.store.series;
assert.strictEqual(s[1].color, '#ff0000');
assert.strictEqual(s[1].markerDisplayed, 'on');
assert.strictEqual(s[1].assignedToY2, 'on');
assert.strictEqual(s[1].visibility, 'hidden');
assert.strictEqual(s[0].items[1].color, '#00ff00');
assert.strictEqual(s[0].items[1].labelPosition, 'none');
assert.strictEqual(s[0].items[0].labelPosition, 'outsideBarEdge');
assert.strictEqual(s[0].color, undefined, 'untouched series keeps APEX values');

// repeated apply makes no further calls
const n = w.calls.length;
apply({ version: 1, series: { 'series-2': { color: '#ff0000', marker: true, y2: true, visible: false } },
  points: { 'series-1|b': { color: '#00ff00', label: false } }, labels: { visible: true, position: 'outsideBarEdge' } }, w);
assert.strictEqual(w.calls.length, n, 'second identical apply must not set anything');

// refresh: APEX replaces series; update re-applies only series/point settings
w.calls.length = 0;
w.store.series = SERIES();
J.update(S.validate({ version: 1, legend: { position: 'top' }, series: { 'series-2': { color: '#ff0000' } } }, 'jet').clean, null, w);
assert.ok(w.calls.every((c) => c[0] === 'series' || c[0] === 'legend.position'));
assert.strictEqual(w.store.series[1].color, '#ff0000');

// removing a setting restores the original value captured before the first change
w = fakeChart({ series: SERIES(), 'legend.position': 'auto' });
apply({ version: 1, legend: { position: 'bottom' }, series: { 'series-2': { color: '#ff0000' } } }, w);
const res = J.apply(S.validate({ version: 1 }, 'jet').clean, null, w);
assert.strictEqual(w.store['legend.position'], 'auto');
assert.strictEqual(w.store.series[1].color, '#123456');
assert.deepStrictEqual(res.stale, []);

// an option that started empty is cleared by setting its parent object back, never by setting null
w = fakeChart({ series: SERIES(), 'yAxis.majorTick.rendered': 'on', 'legend.rendered': 'on' });
apply({ version: 1, axes: { y: { gridColor: '#eeeeee', gridStyle: 'dashed' } }, legend: { position: 'bottom' } }, w);
apply({ version: 1, axes: { y: { gridStyle: 'dashed' } } }, w);
assert.strictEqual(w.store['yAxis.majorTick.lineColor'], undefined, 'grid colour cleared');
assert.strictEqual(w.store['yAxis.majorTick.lineStyle'], 'dashed', 'sibling still wanted is kept');
assert.strictEqual(w.store['yAxis.majorTick.rendered'], 'on');
assert.strictEqual(w.store['legend.position'], undefined, 'legend position cleared');
const r2 = J.apply(S.validate({ version: 1 }, 'jet').clean, null, w);
assert.deepStrictEqual(r2.stale, []);
assert.strictEqual(w.store['yAxis.majorTick.lineStyle'], undefined);

// a parent object that did not exist yet is set back to {}
w = fakeChart({ series: SERIES() });
apply({ version: 1, global: { plotBackground: '#f8fafc' } }, w);
assert.deepStrictEqual(J.apply(S.validate({ version: 1 }, 'jet').clean, null, w).stale, []);
assert.deepStrictEqual(w.store.plotArea, {});

// a top-level option that started empty gets its JET default; one with no known default is stale
w = fakeChart({ series: SERIES() });
apply({ version: 1, interact: { crosshair: true } }, w);
assert.deepStrictEqual(J.apply(S.validate({ version: 1 }, 'jet').clean, null, w).stale, []);
assert.strictEqual(w.store.dataCursor, 'auto');
w = fakeChart({ series: SERIES() });
apply({ version: 1, type: 'column' }, w);
assert.deepStrictEqual(J.apply(S.validate({ version: 1 }, 'jet').clean, null, w).stale, ['type']);

// destroy restores everything it can and forgets the chart
w = fakeChart({ series: SERIES(), 'legend.position': 'auto' });
apply({ version: 1, legend: { position: 'bottom' }, series: { 'series-1': { color: '#ff0000' } } }, w);
J.destroy(w);
assert.strictEqual(w.store['legend.position'], 'auto');
assert.strictEqual(w.store.series[0].color, undefined);

// export is not offered for JET yet
J.export(w, 'png').then(() => assert.fail('export should reject'), () => console.log('chart_jet_test: OK'));
