# Chart Designer — Design

## Intent

Developers want to style every part of a chart region on its own (each series, point, axis,
legend, tooltip, label, reference line, interaction, animation) with immediate feedback, like a
professional chart-design application. One-click whole-chart looks ("Dashboard") are not wanted.
The designer must not be limited to what Oracle APEX native chart properties expose.

## Goals

- Select a native chart region in the Flutter Designer, open the Chart Designer, edit each part
  separately, see the real page update live, save, and get the same chart at runtime.
- Two rendering engines: Oracle JET (the engine APEX already uses) and Apache ECharts (for what
  JET cannot draw). The developer picks the engine per chart.
- Every control changes the rendered chart; controls the selected engine cannot honour are shown
  disabled with a note ("Not supported by JET — switch to ECharts").
- The complete configuration is saved with the page design and restored with history.

## Non-goals

- Writing chart SQL or creating chart regions. Data still comes from the APEX region.
- A separate data designer (series mapping beyond what the region returns).

## Anti-goals

- Breaking existing chart regions or their refresh / dynamic-action behaviour.
- Decorative settings that do nothing.
- Loading code from outside the application at runtime (no CDN).

## Approaches

- **A. JET only.** Smallest; gaps (heatmap, waterfall, gauge, wheel zoom, annotations, PNG/PDF).
- **B. JET + ECharts, data read from the APEX chart (chosen).** The region keeps its SQL and
  refresh. The runtime reads `series` and `groups` from the region's `oj-chart` after each
  render/refresh; with engine ECharts it hides the JET chart and draws ECharts in its place from
  that data. No package change for data.
- C. JET + ECharts with a new server call that runs the region SQL. Rejected: duplicates APEX
  data handling, bind variables and security for no gain over B.

## Decided parts of the how

1. **Config model** (separate from rendering): one JSON per chart in the design,
   `{ engine, type, global, series[], points{}, axes{x,y,y2}, labels, legend, tooltip, refs[],
   interact, anim }`. Engine-neutral names; each engine has an adapter that maps it.
2. **Runtime** `VD.chart.apply(regionId, config)`: one shared script emitted once in page JS,
   one call per chart; reapplied on `apexafterrefresh`. Adapters: `toJet(config)` (setProperty
   on `oj-chart`) and `toECharts(config, data)`.
3. **ECharts** is shipped as a plug-in static file and loaded on the page only when a chart uses
   it. Version pinned.
4. **Designer UI**: wide panel beside the live preview. Part tree on the left (Chart, Series n,
   Points, X / Y / Y2 axis, Labels, Legend, Tooltip, Reference lines); tabs Global, Series, Axis,
   Labels, Interactions, Advanced; Basic / Advanced switch; context-sensitive fields per type;
   colour pickers, sliders, switches, dropdowns, numbers; reset per property and per chart; style
   presets that only fill values; desktop / tablet / mobile preview widths.
5. **Live preview** uses the same runtime on the chart inside the preview iframe.
6. **Old looks** v1..v4 of the chart type are removed; saved designs using them convert to the
   equivalent config on load.
7. **Interactions**: zoom/pan, wheel zoom, drag select, crosshair, highlight, series toggle, click
   event (raises an APEX event `vdchartclick` with series/group/value for Dynamic Actions),
   export PNG / SVG (ECharts native; JET SVG from DOM, PNG via canvas), PDF via print of the chart,
   fullscreen, reset zoom.

## Engine support (shown in the UI)

| Feature | JET | ECharts |
|---|---|---|
| bar, column, stacked, 100%, line, smooth, step, area, stacked area, pie, donut, scatter, bubble, radar/polar, combo, funnel | yes | yes |
| gauge, waterfall, heatmap | no | yes |
| wheel zoom, annotations/arrows, gradient stroke, line shadow, caps/joins | no | yes |
| per-point styling, reference lines/zones, secondary Y, log/time axis, animations | yes | yes |

## Left to the builder

- Exact JET property paths and ECharts option mapping per field.
- How heatmap/waterfall/gauge read APEX series data (documented mapping of series/groups).
- RTL: legend, axis and tooltip placement follow page direction.

## Testing

- Unit: config → JET properties and config → ECharts option for each part; unsupported fields
  flagged per engine; old look conversion; codegen emits runtime once and loads ECharts only
  when needed.
- Live (app 102, page 39): style each part on JET and on ECharts, refresh the region, save, run.
