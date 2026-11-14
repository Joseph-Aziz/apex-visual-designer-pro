# Dashboard Looks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Dashboard" look (v7) to six Flutter Designer types and a new Chart type with four template looks.

**Architecture:** All looks live in `plugin/files/js/flutter-variants.js` (`LIBRARY`), as today. Chart regions are recognised on the client from `c.type === 'NATIVE_JET_CHART'` (the server already sends `type`), so no package change is needed. Chart series colours need JS: a variant may carry `js(sel, vals, comp)`, and `flutter-codegen.js` appends what it returns to the page JS.

**Tech Stack:** Plain ES5 JS (IIFE modules on `window.VD`), Node unit tests run with `node tests/unit/<name>_test.js`, plug-in build `node tools/build_plugin.js`.

**Spec:** `docs/superpowers/specs/2026-11-13-dashboard-looks-design.md`

## Global Constraints

- Looks v1..v6 of every existing type stay byte-for-byte the same in their CSS output.
- No physical left/right properties in generated CSS (the existing variants test enforces this; RTL pages).
- Dashboard reference values: font Cairo; card white, 1px #e2e8f0, 16px corners, shadow `0 4px 20px -2px rgba(15,23,42,.05), 0 2px 6px -1px rgba(15,23,42,.03)`; text #0f172a, muted #64748b; KPI values 26px bold, first #0f766e, second #2563eb; button teal #0f766e, 8px corners, 12px bold, padding 6px 14px; chips 20px corners, 13px semi-bold, padding 4px 14px.
- No environment names in repo files; commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; commit only when the user asks.

## Review Focus

- A page that already uses v1..v6 must render exactly as before after the upgrade (Task 1 snapshot test).
- A chart refreshed by a Dynamic Action must keep its Dashboard colours (Task 3 JS listens to `apexafterrefresh`).
- A chart region without a Static ID: the designer must ask for one as it does for other regions (`needsStaticId` flow, Task 3 test).
- RTL page: KPI value order and chip accent follow the reading direction (logical properties only, Task 1/2 test).
- A Cards region with no second value: the Dashboard look must not leave an empty blue gap (Task 2 test on CSS `:empty` rule).

---

### Task 1: Allow seven looks; Region and Button Dashboard looks

**Files:**
- Modify: `plugin/files/js/flutter-variants.js` (region list ~290, button list ~256, `regionCss`, `buttonCss`)
- Test: `tests/unit/flutter_variants_test.js`

**Interfaces:**
- Produces: `F.forType('region')` and `F.forType('button')` end with `{ id: 'v7', label: 'Dashboard' }`; shared constant `DASH` in `flutter-variants.js` holding the reference values (`font, border, radius, shadow, text, muted, teal, blue`) used by later tasks.

- [ ] **Step 1: Change the tests.** Replace the "exactly v1..v6" assertion with: ids start `v1..v6`, are unique, and types `region, button, cards, choice, date` (and later `chart`) end with `v7`. Add label checks `'...|Dashboard'` for region and button. Add a snapshot test: for every type, `css('#X1', defaults)` of v1..v6 equals a stored snapshot file `tests/unit/fixtures/variants_v1_v6.json` (generate it from the current code BEFORE editing the library, commit it with the test).
- [ ] **Step 2: Run** `node tests/unit/flutter_variants_test.js` → FAIL (no v7).
- [ ] **Step 3: Implement** `DASH` and v7 for region (white card, border, 16px radius, shadow, bold #0f172a header, Cairo) and button (teal filled, white text, 8px, 12px bold, padding 6px 14px; params: colour, text colour, radius). Reuse `regionParams` / `buttonParams` with Dashboard defaults.
- [ ] **Step 4: Run** all unit tests (`for t in tests/unit/*_test.js; do node $t; done`) → all PASS.
- [ ] **Step 5: Commit** `feat: dashboard look for regions and buttons`.

### Task 2: Cards, Radio, Checkbox and Date Dashboard looks

**Files:**
- Modify: `plugin/files/js/flutter-variants.js` (cards ~346, choice ~166, `fieldType` for date ~154)
- Test: `tests/unit/flutter_variants_test.js`

**Interfaces:**
- Consumes: `DASH` from Task 1.
- Produces: v7 "Dashboard" on `cards`, `choice`, `date`.

- [ ] **Step 1: Tests.** Labels end with `Dashboard` for cards, choice, date. Cards v7 CSS contains `#0f766e` (title value), `#2563eb` (second value: card sub-title `.a-CardView-subTitle`), `26px`, and a rule hiding an empty sub-title (`:empty`). Choice v7 renders radio groups as a segmented toggle (checked = teal fill) and checkbox groups as pills with `border-radius:20px`; assert both selectors appear. Date v7 contains `border-radius` and `#e2e8f0`.
- [ ] **Step 2: Run** variants test → FAIL.
- [ ] **Step 3: Implement** the three v7 entries. Choice v7 tells radio from checkbox by the APEX group class (`.apex-item-radio` vs `.apex-item-checkbox`, see `look-selectors.js`).
- [ ] **Step 4: Run** all unit tests → PASS.
- [ ] **Step 5: Commit** `feat: dashboard look for cards, radio, checkbox and date`.

### Task 3: Chart type with four template looks

**Files:**
- Modify: `plugin/files/js/flutter-variants.js` (`LIBRARY`, `typeOf`, `types`)
- Modify: `plugin/files/js/flutter-codegen.js` (`generate`)
- Modify: `plugin/files/js/flutter-mode.js:227` (group label `chart: 'Charts'`)
- Test: `tests/unit/flutter_variants_test.js`, `tests/unit/flutter_codegen_test.js`

**Interfaces:**
- Consumes: `DASH`.
- Produces: type `'chart'`; `typeOf({kind:'region', type:'NATIVE_JET_CHART'}) === 'chart'`; chart variants `v1 Dashboard, v2 Minimal, v3 Soft, v4 Dark`, each with `css(sel, vals)` and `js(sel, vals, comp)` returning a JS string; params `series1, series2, series3, grid, bg, radius, fontFamily`.

- [ ] **Step 1: Tests.** `F.types` ends with `'chart'`; `typeOf` maps `NATIVE_JET_CHART` to `chart`; chart labels `Dashboard|Minimal|Soft|Dark`; each chart variant's `js('#C1', defaults, {staticId:'C1'})` contains the series colours and `apexafterrefresh`. Codegen: `generate({components:[{kind:'region', type:'NATIVE_JET_CHART', staticId:'C1', variant:'v1'}]}).js` contains `#0f766e` and `#2563eb`; a design without charts produces the same JS as before (compare with current output).
- [ ] **Step 2: Run** both tests → FAIL.
- [ ] **Step 3: Implement.**
  - CSS: frame like region Dashboard, title, axis/grid colour on the JET SVG (`.oj-dvt-*` / `.oj-chart` classes).
  - JS: set `styleDefaults.colors` on the region's chart. Support both the `oj-chart` element (`#<staticId>_jet`) and the older widget (`apex.region(id).widget().ojChart('option', ...)`). Run on load and on `apexafterrefresh` of that region.
  - Codegen: collect `variant.js` output per component and append it to `js`. Keep the order ripple, fonts, charts.
  - The chart type uses the existing Static ID flow (regions without one get `needsStaticId`).
- [ ] **Step 4: Run** all unit tests → PASS.
- [ ] **Step 5: Commit** `feat: chart type with dashboard, minimal, soft and dark looks`.

### Task 4: Build, docs and live check

**Files:**
- Modify: `tools/build_plugin.js` (version `1.2.11`), `plugin/region_type_plugin_apex_visual_designer.sql` (rebuilt), `docs/` user guide section for the Flutter Designer (list the new looks and the Chart type).

- [ ] **Step 1: Build** `node tools/build_plugin.js` → writes plug-in SQL; run all unit tests → PASS.
- [ ] **Step 2: User imports** 1.2.11 into app 102 (the user runs imports).
- [ ] **Step 3: Live check** on a test page with a native Cards region, a bar and a line chart, a button, a radio group, a checkbox group and a date field: apply Dashboard to each, save, run the page, compare with the hand-built dashboard page; refresh a chart and check colours stay.
- [ ] **Step 4: Commit** `chore: build 1.2.11` (only when the user asks).

## Ruling

- The spec says the server reports charts; the client already gets `type` (`source_type_code`) and recognises `NATIVE_CARDS` the same way, so the plan maps `NATIVE_JET_CHART` on the client. No package change — less to install, same result.
