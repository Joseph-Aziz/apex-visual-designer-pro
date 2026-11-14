# Chart Designer — Contracts (Phase 2)

Companion to `2026-11-13-chart-designer-design.md`. Nothing here is implemented yet. Phase 3 starts
only after this document is approved.

## 0. Verified facts this document rests on (Phase 1, live, APEX 26.2)

- Oracle JET **20.1.4** on the runtime page.
- A native chart region renders `<div id="<staticId>_jet" class="oj-chart">` driven by the
  **jQuery widget** `ojChart`. It is not an `<oj-chart>` custom element: `setProperty` does not exist.
- `apex.region(staticId).type === 'JetChart'`; `widget()` returns the `_jet` div.
- `ojChart('option', 'series')` → `[{ id, name, categories, assignedToY2, lineStyle, displayInLegend,
  items: [{ id, value, name, labelPosition }] }]`; `ojChart('option', 'groups')` →
  `[{ name, shortDesc, drilling }]`; `data` is `null` (no DataProvider).
- On `apex.region(id).refresh()`: `apexafterrefresh` fires on the region element, the `_jet` element is
  the same node, `series`/`groups` hold the new data, and style options set earlier (tested:
  `styleDefaults.colors`) survive two refreshes.
- Still to verify before Phase 3 (needs a multi-series chart and a pie on a test page): series ids with
  several series, pie `items` shape, `x`/`y`/`z` on scatter and bubble items.

## 1. Configuration model

Stored in the existing design document, on the chart's component entry:

```json
{ "key": "...", "kind": "region", "type": "NATIVE_JET_CHART", "staticId": "sales",
  "chart": { "version": 1, "engine": "jet", "type": "bar", "global": {}, "series": {},
             "points": {}, "axes": { "x": {}, "y": {}, "y2": {} }, "labels": {}, "legend": {},
             "tooltip": {}, "refs": [], "interact": {}, "anim": {} } }
```

Rules:

- **Only explicit values are stored.** A missing key means "default". Reset of a property deletes the
  key; reset of the chart replaces `chart` with `{ version, engine, type }`.
- `series` is an object keyed by the **APEX series id** (`series-1`, ...), not an array, so a series
  added or removed in SQL does not shift settings onto another series. `points` is keyed
  `"<seriesId>|<itemId>"`.
- `type` absent = use the chart type APEX renders (`ojChart('option','type')`), so a chart that is only
  restyled keeps its APEX type.
- Unknown keys are kept on save and ignored on apply (forward compatibility). A `version` higher than
  the runtime knows: apply nothing, keep the chart as APEX draws it, log one console warning.
- Defaults live in one table (`chart-schema.js`, `PROPS`); no default is repeated elsewhere.

### Property definition (one row per property in `PROPS`)

`{ key, section, type, def, rule, charts, engines, jet, echarts, control, label, help, level }`

- `type`: `color | number | px | percent | bool | enum | text | list`.
- `rule`: min/max/step for numbers, allowed values for enums, max length for text. Invalid values are
  dropped with a designer message; never applied.
- `charts`: chart types the property applies to (`cartesian`, `pie`, `polar`, `gauge`, ... groups).
- `engines`: `['jet','echarts']` or one of them. The UI disables the control on the other engine with
  "Not supported by Oracle JET — switch to ECharts." (or the reverse).
- `jet` / `echarts`: mapping function name in the adapter (not a free path string, so mappings are
  testable code).
- `level`: `basic | advanced` (Basic / Advanced switch).

### Property catalogue (first release)

JET paths are the documented ojChart options; each is confirmed by a live round-trip
(`ojChart('option', path, v)` then read back) in Phase 3 before it is marked supported.

| Section | Keys | JET | ECharts |
|---|---|---|---|
| global | `background, plotBackground, padding, border, borderWidth, radius, fontFamily, fontSize, textColor, palette[]` | region CSS + `plotArea.backgroundColor`, `styleDefaults.colors` | `backgroundColor, grid, textStyle, color[]` |
| type | `bar, column, stackedBar, stacked100, line, smoothLine, stepLine, area, stackedArea, pie, donut, scatter, bubble, radar, polar, combo, funnel` | `type, orientation, stack, coordinateSystem, styleDefaults.lineType, styleDefaults.pieInnerRadius` | series types |
| type (ECharts only) | `gauge, waterfall, heatmap` | — | see §3 |
| series[id] | `color, lineWidth, lineStyle, lineType, areaOpacity, marker, markerShape, markerSize, markerColor, barWidth, barGap, borderColor, borderWidth, radius, gradient, y2, seriesType (combo), visible, z` | `series[i].color, lineWidth, lineStyle, lineType, markerDisplayed, markerShape, markerSize, markerColor, borderColor, borderWidth, assignedToY2, type, areaColor`; `styleDefaults.barGapRatio, maxBarWidth, seriesEffect` | `itemStyle, lineStyle, areaStyle, symbol, symbolSize, barWidth, barGap, smooth, step, yAxisIndex, z` |
| series (ECharts only) | `shadow, cap, join, gradientStroke` | — | `lineStyle.shadow*, cap, join` |
| points[s\|i] | `color, borderColor, borderWidth, markerSize, visible, label, emphasis` | `items[j].color, borderColor, borderWidth, markerSize, markerDisplayed, label` | `data[j].itemStyle, symbolSize, label, emphasis` |
| axes.x/y/y2 | `visible, title, titleColor, position, min, max, step, scale(linear/log), time, tickFormat(prefix, suffix, decimals), grid, gridColor, gridStyle, minorGrid, axisLine, axisLineColor, labelColor, labelSize, rotation, baseline` | `xAxis/yAxis/y2Axis: rendered, title, titleStyle, min, max, step, scale, tickLabel.{rendered,rotation,style,converter}, majorTick.{rendered,lineColor,lineStyle}, minorTick.rendered, axisLine.{rendered,lineColor}, baselineScaling`; `timeAxisType` | `xAxis/yAxis[]` |
| labels | `visible, position, color, size, weight, decimals, prefix, suffix, percent` | `items.labelPosition`, `styleDefaults.dataLabelStyle`, `valueFormats` | `series.label` |
| legend | `visible, position, orientation, align, color, size, gap, symbol, toggle` | `legend.{rendered,position,textStyle,symbolHeight,symbolWidth}`, `hideAndShowBehavior` | `legend` |
| tooltip | `visible, trigger, background, border, color, size, decimals, prefix, suffix, shared` | `tooltip.renderer` (text built from config, escaped), `valueFormats` | `tooltip` |
| refs[] | `{ axis, kind: line/zone, value, low, high, color, style, width, label }`; arrows and free annotations ECharts only | `xAxis/yAxis.referenceObjects` | `markLine, markArea, markPoint, graphic` |
| interact | `zoom, pan, wheelZoom, dragSelect, crosshair, highlight, seriesToggle, clickEvent, toolbar(export, fullscreen, resetZoom)` | `zoomAndScroll, dragMode, selectionMode, dataCursor, hoverBehavior, hideAndShowBehavior` (wheel zoom: ECharts only) | `dataZoom, brush, axisPointer, emphasis, legend.selectedMode` |
| anim | `enabled, duration, easing, delay, onUpdate` | `animationOnDisplay, animationOnDataChange, styleDefaults.animationDuration` (easing, delay: ECharts only) | `animation*` |

Custom tooltip HTML is built from config fields only; user text is escaped. No user JavaScript is
accepted or executed.

## 2. Adapter interface

```
VD.chart.adapters.jet / .echarts = {
  capabilities(chartType) -> { types: [...], props: Set<key> },
  validate(config, chartType) -> { ok, errors: [{ key, message }] },
  apply(config, data, regionEl) -> void,   // idempotent; may be called repeatedly
  update(config, data, regionEl) -> void,  // data-only refresh (ECharts setOption; JET no-op)
  destroy(regionEl) -> void,               // removes listeners, instances, restores JET
  export(regionEl, format) -> Promise<Blob> // 'png' | 'svg'; rejects for unsupported formats
}
VD.chart.apply(regionId, config)   // entry point used by page JS and by the designer preview
VD.chart.read(regionId) -> { type, series: [...], groups: [...] }   // from ojChart options
```

`VD.chart.apply`:

1. Find region `apex.region(regionId)`; if missing or not `JetChart`, log and stop.
2. Wait for `isReady()`/`whenReady()`.
3. Validate config; drop invalid keys (designer shows them; runtime logs once).
4. Pick adapter by `config.engine`; if the previous engine differs, call its `destroy` first.
5. Read data (`VD.chart.read`) and call `apply`.
6. Bind one `apexafterrefresh` handler per region, namespaced `.vdchart` (unbind before bind), which
   calls `update` with fresh data. JET: styles persist (verified), so only per-series and per-point
   settings, which are keyed to ids, are re-applied.
7. Errors are caught per chart; the APEX chart stays as APEX drew it.

ECharts specifics: one instance per region (`echarts.getInstanceByDom` before `init`), a
`ResizeObserver` on the host, the JET div hidden with a class (not removed) so APEX refresh keeps
working; `destroy` disposes the instance and shows the JET div again.

## 3. Data mapping (APEX → ECharts)

Input: `series[]` with `items[]` aligned to `groups[]` by index.

| Type | Mapping | Validation error when |
|---|---|---|
| cartesian (bar, line, area, combo, stacked) | category axis = `groups[].name`; series data = `items[].value` | items length ≠ groups length |
| pie / donut / funnel | first series; name = group name, value = item value | more than one series (message tells which one is used) |
| scatter / bubble | `items[].x, y, z` | items lack numeric x/y (z for bubble) |
| radar | indicators = groups; one polygon per series | fewer than 3 groups |
| gauge | first series, first item value; min/max from axis config | no numeric value |
| waterfall | first series; each item is a change, running total drawn as an invisible base bar; optional total bar | more than one series |
| heatmap | x = groups, y = series names, cell value = item value | any non-numeric value |

## 4. Loading ECharts

- `plugin/files/lib/echarts/echarts.min.js` (version pinned at Phase 4 to the latest 5.x release older
  than two weeks), plus `LICENSE` and `NOTICE` (Apache-2.0 requires both shipped).
- The designer is served from the plug-in's file prefix, so it knows the absolute plug-in file URL.
  Codegen writes that URL into the page JS once, and only when a chart uses ECharts; the runtime adds
  one `<script>` for it if `window.echarts` is missing.
- Risk: the plug-in file URL can change when the plug-in is re-imported. Mitigation: on load failure
  the JET chart stays visible and a console warning says "re-save the page in the Visual Designer".
  Alternative (if this proves fragile live): copy the file to the application's Static Application
  Files on first use. Decided in Phase 4 after the live test.

## 5. Code generation

- Shared runtime (`chart-runtime.js`, `chart-schema.js`, `chart-jet.js`, `chart-echarts.js`, minified
  concatenation) written **once** into the designer block of page JS when at least one chart has
  `chart`; guarded by `if (!window.VD || !VD.chart)`.
- Per chart: `VD.chart.apply("<staticId>", <config JSON>);`.
- Order unchanged for the rest: ripple, fonts, charts.
- Region frame styling (background, border, radius, padding) stays CSS, as today.

## 6. Designer UI

- Selecting a chart in the Flutter list shows **Open Chart Designer** in place of the look thumbnails.
- The Chart Designer replaces the right panel with a wide two-column panel; the live preview stays.
- Left tree: Chart · Series (one node per series read from the preview's chart) · Points · X axis ·
  Y axis · Y2 axis · Labels · Legend · Tooltip · Reference lines · Interactions · Animation.
  Nodes not valid for the chart type are hidden (pie: no axes).
- Tabs Global · Series · Axis · Labels · Interactions · Advanced filter the same property table.
- Header: engine switch (JET / ECharts), chart type, Basic / Advanced, Reset chart, Undo / Redo,
  preview width (Desktop / Tablet / Mobile = preview iframe width 100% / 768px / 375px).
- Controls come from `PROPS[].control`, built with the existing `fl-params.js` controls (colour,
  slider, switch, dropdown, number, text) plus a reset button per field.
- Live preview: each change calls `VD.chart.apply` inside the preview iframe (same origin). The
  runtime is injected once into the iframe; slider and text input debounced 150 ms.

## 7. Undo / redo (whole Flutter Designer)

- One stack of `state.design` JSON snapshots in `flutter-mode.js`, pushed on every change, max 100,
  cleared when another page is opened. Ctrl+Z / Ctrl+Y and buttons. Applies to every component type,
  not only charts. Saved versions and History stay as they are.

## 8. Migration of looks v1–v4

- Source: component entries with `type:'NATIVE_JET_CHART'` and `variant:'v1'..'v4'` with
  `values: { series1, series2, series3, grid, bg, text, border, radius }`.
- On page open (client side), such an entry gets `chart = { version:1, engine:'jet',
  global: { palette:[series1,series2,series3], background:bg, textColor:text, border, radius },
  axes: { x:{ gridColor:grid, gridStyle: v2 ? 'solid':'dashed' }, y:{ same } } }`, `variant`
  and `values` kept until the first successful save, then removed. Converting an entry that already
  has `chart` does nothing (idempotent).
- The old chart looks stay in `flutter-variants.js` until the migration test passes; removed in
  Phase 6.

## 9. Test plan

Unit (Node, as today, fake `ojChart` and fake `echarts` objects):

- schema: defaults, validation per type, reset one / reset all, unknown keys kept, future version.
- jet adapter: each section → expected `ojChart('option', ...)` calls; unsupported keys reported;
  repeated `apply` gives the same calls; refresh re-applies per-series settings only; `destroy`.
- echarts adapter: each type mapping incl. gauge, waterfall, heatmap and their validation errors;
  instance reuse; resize; destroy restores JET; export rejects unsupported formats.
- runtime: one handler per region after N applies; multiple charts; engine switch.
- codegen: runtime once, per-chart call, ECharts URL only when used, no external URL.
- mode: undo/redo, migration idempotent, save carries `chart`.

Live (app 102, a test page with a multi-series chart and a pie): the acceptance list of the task,
for each engine, plus refresh, iframe reload, RTL and mobile width, and a `vdchartclick` Dynamic
Action.

## 10. Phases and order

3 core runtime + JET adapter → 4 ECharts → 5 designer UI → 6 persistence, undo/redo, migration →
7 release (1.3.0). Each phase ends with green unit tests and a user-run import for the live check.
Commits only when the user asks.

## Open points for approval

1. Series keyed by APEX series id (not position).
2. ECharts loaded from the plug-in file URL written at save time (fallback decided in Phase 4).
3. Undo/redo for the whole Flutter Designer, not only charts.
4. Click event name `vdchartclick`, payload `{ regionId, series, group, value, point }`, fired with
   `apex.event.trigger(regionEl, 'vdchartclick', payload)`.
