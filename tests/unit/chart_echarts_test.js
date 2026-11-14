/* Unit tests for js/chart-echarts.js. Run: node tests/unit/chart_echarts_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Minimal DOM: elements with classList, parent links and insert/remove.
function node(tag) {
  const n = {
    tagName: tag, style: {}, children: [], parentNode: null, offsetHeight: 0, attrs: {},
    classList: {
      set: new Set(),
      add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); }
    },
    appendChild(c) { c.parentNode = n; n.children.push(c); return c; },
    insertBefore(c, ref) {
      c.parentNode = n;
      const i = ref ? n.children.indexOf(ref) : -1;
      if (i < 0) n.children.push(c); else n.children.splice(i, 0, c);
      return c;
    },
    removeChild(c) { n.children.splice(n.children.indexOf(c), 1); c.parentNode = null; return c; },
    setAttribute(k, v) { n.attrs[k] = v; }
  };
  Object.defineProperty(n, 'nextSibling', { get() {
    const p = n.parentNode; if (!p) return null;
    return p.children[p.children.indexOf(n) + 1] || null;
  } });
  return n;
}
const head = node('head'), body = node('body');
const byId = {};
const document = { head, body, createElement: (t) => node(t), getElementById: (id) => byId[id] || null };

// Fake echarts: one instance per dom, records setOption calls.
const inits = [];
function instance(dom, opts) {
  return {
    dom, opts, options: [], handlers: {}, resized: 0, disposed: false,
    setOption(o, m) { this.options.push([o, m]); },
    getOption() { return this.options[this.options.length - 1][0]; },
    resize() { this.resized++; },
    dispose() { this.disposed = true; dom.__ec = null; },
    on(ev, fn) { this.handlers[ev] = fn; },
    off(ev) { delete this.handlers[ev]; },
    getDataURL(o) { this.dataUrlArgs = o; return 'data:image/png;base64,iVBORw0KGgo='; },
    renderToSVGString() { return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; }
  };
}
const echarts = {
  init(dom, theme, opts) { const i = instance(dom, opts); dom.__ec = i; inits.push(i); return i; },
  getInstanceByDom(dom) { return dom.__ec || null; }
};

const observers = [];
function ResizeObserver(fn) { this.fn = fn; this.targets = []; this.off = false; observers.push(this); }
ResizeObserver.prototype.observe = function (t) { this.targets.push(t); };
ResizeObserver.prototype.disconnect = function () { this.off = true; };

const warnings = [], triggered = [];
const window = { document, ResizeObserver, apex: { event: { trigger: (el, ev, data) => triggered.push([el, ev, data]) } } };
const ctx = { window, document, JSON, WeakMap, Set, Promise, Blob, atob, Math, Error,
  console: { warn: (m) => warnings.push(m), log() {} } };
['chart-schema.js', 'chart-echarts.js'].forEach((f) =>
  vm.runInNewContext(fs.readFileSync('plugin/files/js/' + f, 'utf8'), ctx, { filename: f }));
const A = window.VD.chart.adapters.echarts;
assert.ok(A, 'VD.chart.adapters.echarts missing');

// A JET chart widget inside its region, as APEX renders it.
function chartEl(id) {
  const region = node('div'); region.id = id; byId[id] = region; body.appendChild(region);
  const jet = node('div'); jet.id = id + '_jet'; jet.offsetHeight = 360; region.appendChild(jet);
  return { 0: jet, length: 1, region, jet };
}
const plain = (o) => JSON.parse(JSON.stringify(o));
const groups = [{ id: 'g1', name: 'Jan' }, { id: 'g2', name: 'Feb' }, { id: 'g3', name: 'Mar' }];
const two = {
  type: 'bar', groups,
  series: [
    { id: 's1', name: 'Sales', items: [{ id: 'a', value: 10 }, { id: 'b', value: 20 }, { id: 'c', value: 30 }] },
    { id: 's2', name: 'Cost', items: [{ id: 'd', value: 30 }, { id: 'e', value: 20 }, { id: 'f', value: 10 }] }
  ]
};
const one = { type: 'bar', groups, series: [two.series[0]] };
const cfg = (o) => Object.assign({ version: 1, engine: 'echarts' }, o);
const last = (w) => echarts.getInstanceByDom(w.jet.nextSibling).getOption();

window.echarts = echarts;

// capabilities: ECharts-only types and props are listed
const cap = A.capabilities();
['gauge', 'waterfall', 'heatmap', 'column', 'pie', 'radar'].forEach((t) => assert.ok(cap.types.indexOf(t) >= 0, t));
assert.ok(cap.props.has('tooltip.visible') && cap.props.has('series.shadow'));
assert.strictEqual(A.validate(cfg({ type: 'gauge' })).ok, true);

// apply: host inserted after the JET div, JET hidden with a class, category axis from groups
let w = chartEl('r1');
A.apply(cfg({ type: 'column' }), two, w);
const host = w.jet.nextSibling;
assert.ok(host && host.classList.contains('vd-echarts'), 'host after JET div');
assert.strictEqual(host.style.height, '360px', 'host takes the JET height');
assert.ok(w.jet.classList.contains('vd-echarts-hidden'), 'JET hidden by class');
assert.ok(head.children.some((c) => c.tagName === 'style'), 'hide rule added once');
let o = last(w);
assert.deepStrictEqual(plain(o.xAxis[0].data), ['Jan', 'Feb', 'Mar']);
assert.strictEqual(o.xAxis[0].type, 'category');
assert.deepStrictEqual(o.series.map((s) => s.type), ['bar', 'bar']);
assert.deepStrictEqual(plain(o.series[0].data), [10, 20, 30]);

// instance reuse: apply again keeps one instance and one host
A.apply(cfg({ type: 'line' }), two, w);
assert.strictEqual(inits.length, 1, 'one instance per region');
assert.strictEqual(w.region.children.length, 2, 'one host');
assert.strictEqual(last(w).series[0].type, 'line');
assert.strictEqual(echarts.getInstanceByDom(host).options.slice(-1)[0][1].notMerge, true);

// resize follows the host
assert.strictEqual(observers.length, 1);
observers[0].fn();
assert.strictEqual(echarts.getInstanceByDom(host).resized, 1);

// horizontal bar puts categories on the y axis; stacking
A.apply(cfg({ type: 'bar' }), two, w);
assert.strictEqual(last(w).yAxis[0].type, 'category');
A.apply(cfg({ type: 'stackedBar' }), two, w);
o = last(w);
assert.strictEqual(o.xAxis[0].type, 'category');
assert.ok(o.series.every((s) => s.stack === 'total'));

// stacked100: values become shares of each group
A.apply(cfg({ type: 'stacked100' }), two, w);
o = last(w);
assert.deepStrictEqual(plain(o.series[0].data), [25, 50, 75]);
assert.strictEqual(o.yAxis[0].max, 100);

// line shapes, area, series and point settings
A.apply(cfg({ type: 'area', series: { s1: { color: '#ff0000', lineType: 'curved', y2: true, lineWidth: 4, shadow: 6 } },
  points: { 's2|e': { color: '#00ff00', label: true } } }), two, w);
o = last(w);
assert.ok(o.series[0].areaStyle, 'area fill');
assert.strictEqual(o.series[0].smooth, true);
assert.strictEqual(o.series[0].yAxisIndex, 1);
assert.strictEqual(o.yAxis.length, 2, 'secondary axis added');
assert.strictEqual(o.series[0].itemStyle.color, '#ff0000');
assert.strictEqual(o.series[0].lineStyle.width, 4);
assert.strictEqual(o.series[0].lineStyle.shadowBlur, 6);
assert.deepStrictEqual(plain(o.series[1].data[1]), { value: 20, itemStyle: { color: '#00ff00' }, label: { show: true } });

// globals, axes, legend, tooltip, interact, anim, refs
A.apply(cfg({ type: 'column', global: { palette: ['#111111', '#222222'], plotBackground: '#fafafa', fontFamily: 'Arial' },
  axes: { y: { title: 'Amount', min: 0, max: 50, grid: false } },
  legend: { position: 'end', seriesToggle: true }, tooltip: { shared: true },
  interact: { zoom: true, wheelZoom: true, highlight: true, seriesToggle: true },
  anim: { enabled: false, duration: 500 },
  refs: [{ axis: 'y', kind: 'line', value: 25, label: 'Target' }, { axis: 'y', kind: 'zone', low: 5, high: 10 }] }), two, w);
o = last(w);
assert.deepStrictEqual(plain(o.color), ['#111111', '#222222']);
assert.strictEqual(o.grid.backgroundColor, '#fafafa');
assert.strictEqual(o.textStyle.fontFamily, 'Arial');
assert.strictEqual(o.yAxis[0].name, 'Amount');
assert.strictEqual(o.yAxis[0].max, 50);
assert.strictEqual(o.yAxis[0].splitLine.show, false);
assert.strictEqual(o.legend.right, 0);
assert.strictEqual(o.legend.orient, 'vertical');
assert.strictEqual(o.legend.selectedMode, true);
assert.strictEqual(o.tooltip.trigger, 'axis');
assert.deepStrictEqual(plain(o.dataZoom.map((d) => d.type).sort()), ['inside', 'slider']);
assert.strictEqual(o.series[0].emphasis.focus, 'series');
assert.strictEqual(o.animation, false);
assert.strictEqual(o.series[0].markLine.data[0].yAxis, 25);
assert.strictEqual(o.series[0].markArea.data[0][0].yAxis, 5);

// pie: first series only, with a warning that names it
warnings.length = 0;
A.apply(cfg({ type: 'donut' }), two, w);
o = last(w);
assert.strictEqual(o.series.length, 1);
assert.deepStrictEqual(plain(o.series[0].data[0]), { name: 'Jan', value: 10 });
assert.ok(Array.isArray(o.series[0].radius), 'donut has inner radius');
assert.ok(warnings.some((m) => /Sales/.test(m)), 'warning names the series used');

// funnel, radar, polar
A.apply(cfg({ type: 'funnel' }), one, w);
assert.strictEqual(last(w).series[0].type, 'funnel');
A.apply(cfg({ type: 'radar' }), two, w);
o = last(w);
assert.deepStrictEqual(plain(o.radar.indicator.map((i) => i.name)), ['Jan', 'Feb', 'Mar']);
assert.deepStrictEqual(plain(o.series[0].data[1].value), [30, 20, 10]);
A.apply(cfg({ type: 'polar' }), two, w);
assert.strictEqual(last(w).series[0].coordinateSystem, 'polar');

// scatter and bubble read x, y, z
const xy = { type: 'scatter', groups: [], series: [{ id: 'p', name: 'P', items: [{ id: 'i', x: 1, y: 2, z: 9 }, { id: 'j', x: 3, y: 4, z: 16 }] }] };
A.apply(cfg({ type: 'bubble' }), xy, w);
o = last(w);
assert.deepStrictEqual(plain(o.series[0].data), [[1, 2, 9], [3, 4, 16]]);
assert.strictEqual(o.xAxis[0].type, 'value');
assert.strictEqual(typeof o.series[0].symbolSize, 'function');

// gauge: first value; min/max from the y axis
A.apply(cfg({ type: 'gauge', axes: { y: { min: 0, max: 40 } } }), one, w);
o = last(w);
assert.strictEqual(o.series[0].type, 'gauge');
assert.strictEqual(o.series[0].data[0].value, 10);
assert.strictEqual(o.series[0].max, 40);

// waterfall: invisible running-total base under each change
const wf = { type: 'bar', groups, series: [{ id: 'w', name: 'W', items: [{ id: 'a', value: 10 }, { id: 'b', value: -4 }, { id: 'c', value: 6 }] }] };
A.apply(cfg({ type: 'waterfall' }), wf, w);
o = last(w);
assert.deepStrictEqual(plain(o.series[0].data), [0, 6, 6], 'base');
assert.deepStrictEqual(plain(o.series[1].data.map((d) => d.value)), [10, 4, 6], 'change');
assert.strictEqual(o.series[0].itemStyle.color, 'transparent');

// heatmap: x = groups, y = series names, cells [x, y, value]
A.apply(cfg({ type: 'heatmap' }), two, w);
o = last(w);
assert.deepStrictEqual(plain(o.yAxis[0].data), ['Sales', 'Cost']);
assert.deepStrictEqual(plain(o.series[0].data[3]), [0, 1, 30]);
assert.strictEqual(o.visualMap.min, 10);
assert.strictEqual(o.visualMap.max, 30);

// data errors throw before anything changes; a fresh region keeps JET visible
const bad = [
  [{ type: 'column' }, { type: 'bar', groups, series: [{ id: 's', name: 'S', items: [{ value: 1 }] }] }, /groups/],
  [{ type: 'radar' }, { type: 'bar', groups: groups.slice(0, 2), series: [two.series[0]] }, /3 groups/],
  [{ type: 'waterfall' }, two, /one series/],
  [{ type: 'heatmap' }, { type: 'bar', groups, series: [{ id: 's', name: 'S', items: [{ value: 1 }, { value: 'x' }, { value: 2 }] }] }, /number/],
  [{ type: 'gauge' }, { type: 'bar', groups: [], series: [{ id: 's', name: 'S', items: [] }] }, /value/],
  [{ type: 'scatter' }, { type: 'scatter', groups: [], series: [{ id: 's', name: 'S', items: [{ x: 1 }] }] }, /x and y/]
];
bad.forEach(([c, d, re], i) => {
  const f = chartEl('bad' + i);
  assert.throws(() => A.apply(cfg(c), d, f), re, c.type);
  assert.strictEqual(f.jet.nextSibling, null, 'no host for ' + c.type);
  assert.ok(!f.jet.classList.contains('vd-echarts-hidden'), 'JET stays for ' + c.type);
});

// update: fresh data redrawn on the same instance
const before = inits.length;
A.update(cfg({ type: 'column' }), one, w);
assert.strictEqual(inits.length, before);
assert.strictEqual(last(w).series.length, 1);

// click raises vdchartclick on the region with ids from APEX data
A.apply(cfg({ type: 'column', interact: { clickEvent: true } }), two, w);
const inst = echarts.getInstanceByDom(host);
inst.handlers.click({ seriesIndex: 1, dataIndex: 2, value: 10 });
assert.strictEqual(triggered.length, 1);
assert.strictEqual(triggered[0][0], w.region);
assert.strictEqual(triggered[0][1], 'vdchartclick');
assert.deepStrictEqual(plain(triggered[0][2]), { regionId: 'r1', series: 's2', group: 'g3', value: 10, point: 'f' });
A.apply(cfg({ type: 'column' }), two, w);
assert.strictEqual(inst.handlers.click, undefined, 'click handler removed when turned off');

// export: png and svg give blobs; other formats reject
(async () => {
  const png = await A.export(w, 'png');
  assert.strictEqual(png.type, 'image/png');
  const svg = await A.export(w, 'svg');
  assert.strictEqual(svg.type, 'image/svg+xml');
  assert.ok(inits[inits.length - 1].disposed, 'temporary SVG instance disposed');
  await assert.rejects(A.export(w, 'pdf'), /pdf/);
  await assert.rejects(A.export(chartEl('none'), 'png'), /not drawn/);

  // destroy: dispose, remove host, show JET, stop observing
  A.destroy(w);
  assert.ok(inst.disposed);
  assert.strictEqual(w.jet.nextSibling, null, 'host removed');
  assert.ok(!w.jet.classList.contains('vd-echarts-hidden'), 'JET shown again');
  assert.ok(observers[0].off, 'resize observer disconnected');
  A.destroy(w); // twice is harmless

  // loading: script added once when echarts is missing; failure keeps JET and warns
  delete window.echarts;
  window.VD.chart.echartsUrl = 'r/app/files/echarts.min.js';
  const l1 = chartEl('load1'), l2 = chartEl('load2');
  A.apply(cfg({ type: 'column' }), two, l1);
  A.apply(cfg({ type: 'column' }), two, l2);
  const scripts = head.children.filter((c) => c.tagName === 'script');
  assert.strictEqual(scripts.length, 1, 'one script tag');
  assert.strictEqual(scripts[0].src, 'r/app/files/echarts.min.js');
  window.echarts = echarts;
  scripts[0].onload();
  assert.ok(l1.jet.nextSibling && l2.jet.nextSibling, 'both drawn after load');

  delete window.echarts;
  window.VD.chart.echartsUrl = 'r/app/files/missing.js';
  warnings.length = 0;
  const l3 = chartEl('load3');
  A.apply(cfg({ type: 'column' }), two, l3);
  head.children.filter((c) => c.tagName === 'script').pop().onerror();
  assert.strictEqual(l3.jet.nextSibling, null);
  assert.ok(warnings.some((m) => /re-save the page in the Visual Designer/.test(m)));

  // pages with RequireJS (APEX loads it for JET): ECharts registers as an AMD module and makes
  // no window.echarts, so it is loaded through require instead of a script tag
  delete window.echarts;
  window.VD.chart.echartsUrl = 'r/app/files/echarts.min.js';
  const tags = head.children.filter((c) => c.tagName === 'script').length;
  let asked = null;
  window.define = { amd: {} };
  window.require = (deps, ok) => { asked = deps; ok(echarts); };
  const l4 = chartEl('load4');
  A.apply(cfg({ type: 'column' }), two, l4);
  assert.deepStrictEqual(Array.from(asked), ['r/app/files/echarts.min.js']);
  assert.strictEqual(head.children.filter((c) => c.tagName === 'script').length, tags, 'no script tag with RequireJS');
  assert.strictEqual(window.echarts, echarts);
  assert.ok(l4.jet.nextSibling, 'drawn after require');
  delete window.define; delete window.require;

  
// rounded bar tops and smooth lines (TailAdmin templates)
A.apply(cfg({ type: 'column', global: { barRadius: 6 } }), two, w);
o = last(w);
assert.deepStrictEqual(plain(o.series[0].itemStyle.borderRadius), [6, 6, 0, 0], 'rounded bar tops');
A.apply(cfg({ type: 'stackedBar', global: { barRadius: 4 } }), two, w);
o = last(w);
assert.ok(!(o.series[0].itemStyle || {}).borderRadius, 'stacked: lower segment stays square');
assert.deepStrictEqual(plain(o.series[1].itemStyle.borderRadius), [4, 4, 0, 0], 'stacked: top segment rounded');
A.apply(cfg({ type: 'bar', global: { barRadius: 4 } }), two, w);
assert.deepStrictEqual(plain(last(w).series[0].itemStyle.borderRadius), [0, 4, 4, 0], 'horizontal bars round the end');
A.apply(cfg({ type: 'area', global: { smooth: true } }), two, w);
o = last(w);
assert.ok(o.series.every((x) => x.smooth === true), 'smooth lines');

console.log('chart_echarts_test: OK');
})().catch((e) => { console.error(e); process.exit(1); });
