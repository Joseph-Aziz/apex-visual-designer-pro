# Component Studio (1.4.0, Phase 1): architecture audit and plan

Date: 2026-11-14. Status: **approved on 2026-11-14 with the recommended option for all eight decisions in section 12**. The audit itself changed no source, database or build file.

Every claim about the current code names the file and line it was read from (release 1.3.0, commit `bb05a85`). Where something was not verified, it says so.

## Summary

- Design items is already a small component studio. It has 12 styling types with 6 or 7 designs each, a settings panel, a live preview of the real page, undo and redo, and versioned saves.
- The main gap is that the library is closed. Adding a component type means editing five core files. Adding a design means editing the one library file.
- Application-level presets already exist under another name: the Theme Designer's named styles. Phase 1 can reuse them, so no new table is needed.
- Recommended scope: open the library into a registry, add a component browser and a gallery with presets, extend the settings schema with states, and add a "try on" preview on the real component. No database change.
- Three things need a decision before work starts: the APEX version floor (this plan's brief says 24.1, the repository says 26.1), how presets are stored, and how many separate families the listed components become. The full list is in section 12.

---

## A. Current architecture

### A.1 Modules and what each one owns

| Capability | Where it lives | Notes |
| --- | --- | --- |
| Component discovery | `database/packages/pkg_vd_plugin.sql:100-184` (`do_components`) | Reads `apex_application_page_regions`, `_items` and `_buttons`. Hidden items are left out. Returns id, name, static id, type and CSS classes. |
| Client call for discovery | `plugin/files/js/repository.js:67` (`listPageComponents`) | One AJAX part per feature: `components`, `flutter`, `theme`, `register` (`pkg_vd_plugin.sql:381-384`). |
| Flattening and typing | `plugin/files/js/flutter-mode.js:87-103` (`flatten`) | Builds `{ key, kind, id, name, staticId, type, component }` and sets `ftype` with `typeOf`. |
| Type mapping | `plugin/files/js/flutter-variants.js:538-544` (`ITEM_TYPES`) and `557-565` (`typeOf`) | Hard-coded map from APEX type codes to 12 styling types. |
| Design library | `plugin/files/js/flutter-variants.js:417-431` (`LIBRARY`) | A private object. Types: text, date, select, choice, switch, button, display, region, classic, ir, ig, cards, and an empty chart. |
| Settings schema | `flutter-variants.js:25-27` (`p`, `COLOR`, `PX`), `444-460` (advanced), `510-516` (show / hide) | A setting is `{ key, label, kind, default, group, options }`. Kinds: color, px, number, weight, select, css, icon. |
| Settings validation | `flutter-variants.js:567-581` (`cleanParam`), `584-591` (`values`) | Whitelist per kind. A bad value falls back to the default. |
| Selectors of the theme markup | `plugin/files/js/look-selectors.js` | One map, keyed `'26.2'`. `flutter-variants.js:8` reads that key directly. |
| Settings panel and thumbnails | `plugin/files/js/fl-params.js` | `thumbnails` (line 32) draws each design on hand-written sample markup (`SAMPLES`, lines 13-27). `html` and `bind` build the Basic, Icon, Show / hide and Advanced sections. Shared by Design items and the Theme Designer. |
| CSS and JS generation | `plugin/files/js/flutter-codegen.js:97-140` (`generate`) | One rule set per designed component, scoped to its id, every declaration `!important` (line 56). JS is only the ripple, the font link and the chart loader. |
| Live preview | `plugin/files/js/page-preview.js`, `flutter-mode.js:196-210` (`applyPreview`), `264-282` (`loadPreview`) | An iframe runs the real page in the host session. The generated CSS goes into a `<style id="vd-flutter">` in that page. |
| Undo and redo | `plugin/files/js/undo-stack.js`, `flutter-mode.js:44-59` | JSON snapshots of the whole page design, 100 steps. Typing in one field is one step. |
| Saving | `repository.js:92` (`saveFlutter`), `pkg_vd_plugin.sql:219-222`, `database/packages/pkg_vd_page_writer.sql:205-222` (`save_design`) | The client sends the design JSON and the generated CSS and JS. The server merges them between the `vd-flutter` markers, re-imports the page, and adds a version row. A token refuses a save over a page that changed. |
| History and restore | `pkg_vd_page_code.sql:127-193`, `pkg_vd_page_writer.sql:224` | Table `VD_PAGE_CODE_VERSIONS`. |
| Theme Designer | `plugin/files/js/theme-mode.js`, `theme-codegen.js` | Per application: a default style and named styles per type. A named style is a design plus its values, applied by the class `vd-<type>-<name>`. |
| Theme style on a component | `flutter-mode.js:106-138`, `pkg_vd_page_writer.sql:298` (`set_css_class`) | Design items can put a pushed theme style on the selected component. |
| Chart Designer | `chart-*.js`, `flutter-mode.js:374-443` | Separate settings model. Not part of this plan. |
| Layout Board | `layout-mode.js`, `layout-model.js` | Separate view. Not part of this plan. |
| Shell | `plugin/files/js/app.js`, `plugin/files/index.html:62-66` | Routes three views. `index.html` lists the script files in load order. |
| Install and upgrade | `pkg_vd_plugin.sql` (first-use install), `tools/build_plugin.js:28-52` | The build packs the database scripts into the export. The plug-in runs them when `VD_INSTALL.VERSION` is older than its own version. |

### A.2 Database objects

| Object | Purpose |
| --- | --- |
| `VD_INSTALL` | One row with the installed version. |
| `VD_TARGET_APPLICATIONS` | Applications the designer may change. |
| `VD_PAGE_CODE_VERSIONS` | Per page: inline CSS, onload JS and the design JSON of every save. |
| `VD_THEME_VERSIONS` | Per application: theme JSON, CSS and JS; note `DRAFT`, `PUSHED` or `RESTORED`. |
| `VD_LAYOUT_VERSIONS` | Layout Board undo. |
| Packages | `PKG_VD_PLUGIN`, `PKG_VD_DESIGN_API`, `PKG_VD_PAGE_CODE`, `PKG_VD_PAGE_WRITER`, `PKG_VD_THEME`. |

### A.3 Stored shapes

Page design (`DESIGN_JSON`), built in `flutter-mode.js:171-183`:

```
{ components: [ { key, kind, name, staticId, type, component, variant, values, chart? } ] }
```

Theme (`THEME_JSON`), built in `theme-mode.js:30-66`:

```
{ global: { pageBg, fontFamily, accent }, types: { <type>: { styles: [ { name, cls, variant, values, isDefault } ] } } }
```

Both store the design id (`v1` to `v7`) and the type key (`text`, `date` and so on). **These ids and keys must not change**, or saved designs stop resolving.

### A.4 Flow of one edit

1. The user picks a component in the list or clicks it in the preview (`flutter-mode.js:246`, `311-336`).
2. `renderRight` (line 445) draws the thumbnails and the settings for the component's type.
3. A click on a thumbnail calls `setVariant` (171). A changed setting calls `setValue` (185). Both record an undo step first.
4. `applyPreview` regenerates the CSS for the whole page and replaces the style element in the preview.
5. Save sends the design and the generated code to the server, which re-imports the page.

### A.5 Tests and tools

- 24 Node unit tests in `tests/unit`, about 690 assertions. The largest are `flutter_variants_test.js` (106) and `chart_echarts_test.js` (101).
- 5 database suites in `tests/db`, run by hand as SQL Commands blocks made by `tools/db_test_block.js`.
- `tests/INSTALL_CHECKLIST.md` holds the manual checks.
- `tools/build_plugin.js` is the only way the export is made.

---

## B. Gap analysis

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Open a page in the designer | Already implemented | Shared page bar, `page-bar.js`, `app.js:48-52`. |
| 2 | Browse available component types | Partially implemented | The left list groups the page's own components by type (`flutter-mode.js:311-326`). There is no browser of types that are not on the page. |
| 3 | Gallery of designs for a component | Already implemented | `fl-params.js:32-46`, drawn at `flutter-mode.js:468-485`. |
| 4 | Select a design | Already implemented | `setVariant`, `flutter-mode.js:171`. |
| 5 | Preview on the actual native component | Partially implemented | The page preview is the real page. The thumbnails are hand-written sample markup (`fl-params.js:13-27`), not real components. |
| 6 | Customise through settings | Already implemented | `fl-params.js:76-116`. |
| 7 | Apply to the selected page component | Already implemented | Save, `pkg_vd_page_writer.sql:205`. |
| 8 | Save and reuse as a preset | Partially implemented | Named theme styles are reusable presets, but they can only be made in the Theme Designer and only apply after a theme push. There is no "save this component's design as a preset". |
| 9 | Registry: add a type without editing core files | Requires refactoring | A new type touches `flutter-variants.js` (`LIBRARY`, `ITEM_TYPES`, `SURFACE` 463, `HIDES` 506, `typeOf`), `fl-params.js` (`SAMPLES`), `theme-codegen.js` (`REGION_MARK`, `ITEM_MARK`, `NAMES`, lines 11-28), `theme-mode.js` (`sample`, 93-115) and `flutter-mode.js` (`names`, 317). |
| 10 | Registry: add a design without editing core files | Requires refactoring | `LIBRARY` is private; there is no register call. |
| 11 | Text Field, Textarea, Number Field, Password | Already implemented as one type | All four map to `text` (`flutter-variants.js:539`). |
| 12 | Date Picker | Already implemented | Type `date`, 7 designs. |
| 13 | Select List, Popup LOV, Combobox | Partially implemented | All map to `select` (line 541). The input selector (`look-selectors.js`, `field.input`) names `select` and plain inputs. Whether it reaches the Combobox and Popup LOV inputs in 26.2 is **not verified**. |
| 14 | Checkbox, Checkbox Group, Radio Group | Already implemented as one type | `choice` (line 542). |
| 15 | Switch | Already implemented | `switch`. |
| 16 | Buttons | Already implemented | `button`. |
| 17 | Button Groups | Requires investigation | APEX has no native "button group" component. It may mean the pill-button template option of a radio group, or a region of buttons. |
| 18 | Display Only | Already implemented | `display`. |
| 19 | Static Content, Standard Region | Already implemented as one type | Any region that is not a report, cards or chart is `region` (`typeOf`, 562). |
| 20 | Cards, Classic Report, Interactive Report, Interactive Grid | Already implemented | `cards`, `classic`, `ir`, `ig`. |
| 21 | Colours, type, padding, radius, border | Already implemented | Basic settings per type. |
| 22 | Shadow, width, margins, animation | Already implemented | Advanced settings, `flutter-variants.js:444-460`. |
| 23 | Hover and focus states | Partially implemented | Advanced has hover background, focus ring colour and width. Other state values are fixed in the design's CSS. |
| 24 | Disabled, read-only and error states | Partially implemented | Fixed in code (`flutter-variants.js:61-63`: opacity .38, error colour `#b3261e`). Not settings. Read-only has no rule. |
| 25 | Responsive settings | Missing | Only "Max width". |
| 26 | Setting dependencies | Missing | One special case in code: ripple shows only when the design needs JS (`fl-params.js:88`). |
| 27 | Setting validation | Already implemented | `cleanParam`. No min and max per setting; px accepts 0 to 9999. |
| 28 | Reset to default | Partially implemented | Advanced colours have a clear button. "Remove design" removes everything. No "reset this design's settings". |
| 29 | Built-in designs told apart from custom presets | Missing | The page gallery shows built-in designs only. |
| 30 | Page-level and application-level storage | Already implemented | Page design JSON and theme JSON, both versioned. |
| 31 | Preset import and export | Missing | The theme download saves CSS and JS only (`theme-mode.js:216-228`), not the theme JSON. |
| 32 | Presets shared across applications | Missing | Themes are per application. |
| 33 | Undo and redo | Already implemented | Covers any change to the page design, so it will cover preset use too. |
| 34 | APEX 24.1 and later | Requires investigation | See section F, risk 1. |

---

## C. Proposed architecture

### C.1 Principles

- Keep the three working engines as they are: `flutter-codegen.js`, `fl-params.js` and the save path. They already take a design and its settings as data.
- Open the library. Everything that is known about a component family moves into one family definition. The scattered maps listed in gap 9 are then read from the registry.
- Keep the public face `VD.flutterVariants` (`types`, `forType`, `get`, `typeOf`, `cleanParam`, `values`, `googleFont`). The code generators, the Theme Designer and 24 test files use it. It becomes a thin layer over the registry.
- A family is a **styling family**: components that share the same markup and so the same CSS. Text Field, Textarea, Number Field and Password stay one family, `text`, because saved designs and themes store that key. Each APEX component type is a **member** of a family, with its own name and sample, so the browser can list "Textarea" by itself.

### C.2 Registry

New module `VD.componentRegistry` (file `component-registry.js`). Interface, described as data and calls, with no code yet:

Family definition:

| Field | Meaning |
| --- | --- |
| `id` | Stable key stored in themes (`text`, `date`, ...). |
| `label`, `plural` | Display names. Replaces `names` in `flutter-mode.js:317` and `NAMES` in `theme-codegen.js`. |
| `category` | `form`, `selection`, `action`, `display`, `region` or `report`. |
| `members` | List of `{ apexType, kind, label, sample }`. Replaces `ITEM_TYPES` and the region branch of `typeOf`. |
| `match(component)` | Optional, for families the type code alone cannot tell (for example a region by its `component` value). |
| `surface` | Selector of the element that carries the look. Replaces `SURFACE`. |
| `hides` | Show / hide switches. Replaces `HIDES`. |
| `themeMark` | How the theme CSS recognises the family in page markup. Replaces `REGION_MARK` and `ITEM_MARK`. |
| `sample(cls)` | Sample markup for thumbnails and the theme gallery. Replaces `SAMPLES` and `theme-mode.js` `sample`. |
| `settings` | Settings shared by all designs of the family. |
| `variants` | List of design definitions. |
| `defaultVariant` | Id of the design offered first. |
| `requires` | `{ selectors: '26.2', minApex }`, checked when the family is registered. |

Design (variant) definition: `{ id, label, css(selector, values), settings?, needsJs?, js?, font?, builtIn }`. This is the shape `LIBRARY` entries already have after line 526.

Calls:

- `register(family)`: validates the definition (unique id, unique variant ids, every setting has a known kind and a default that passes its own validation) and refuses a bad one with a clear error.
- `registerVariant(familyId, variant)`: adds a design to an existing family.
- `families()`, `family(id)`, `familyOf(component)`, `variant(familyId, variantId)`, `categories()`.

Adding a family or a design then means one new file that calls `register`, plus its name in the script list in `index.html:64`. That list is a manifest, not engine code. If even that edit is unwanted, the list can move to a small `families.json` read by the build; that is decision 5.

### C.3 Settings schema

The current setting shape stays valid. New optional fields:

| Field | Meaning |
| --- | --- |
| `min`, `max` | Bounds for px and number. Checked in `cleanParam`. |
| `state` | `normal`, `hover`, `focus`, `disabled`, `readonly` or `error`. The panel groups settings by state. |
| `section` | Display section, replacing the fixed list of four groups. Existing groups map one to one. |
| `dependsOn` | `{ key, equals }` or `{ key, oneOf }`. The panel hides the setting when the condition is false; the generator ignores its value. |

State settings follow the rule Advanced settings already use: the default is empty, and empty means "as the design has it". So a saved design with no state values generates the same CSS as today.

Native APEX properties (label text, LOV, required, format mask) are out of scope. The one existing exception stays as it is: the theme style class and the Static ID, which Design items already writes.

### C.4 Gallery

One gallery component, built from `fl-params.js` `thumbnails`, used by Design items and the Theme Designer:

- Design cards, each drawn on the family's sample.
- Preset cards for the family (custom presets of the application), with a "Custom" badge. Built-in designs carry a "Built-in" badge.
- Actions on the selected design: "Reset settings" and "Save as preset".

Preview accuracy:

- **Try on:** pointing at a card applies that design to the selected real component in the page preview, without touching the design or the undo history. Leaving the card restores the preview. Selecting the card commits it as today.
- Thumbnails stay sample markup. The designer's own document does not load Universal Theme, so real components cannot render there. The alternative, rendering every card inside the preview iframe, is more work and slower; it is decision 6.
- With no component of that family on the page, the gallery is browse-only: thumbnails and settings work, and the apply action explains that the page has no such component.

### C.5 Component browser

The left panel of Design items gains a switch between two lists:

- **On this page** (today's list).
- **All components:** families by category, each member listed, with the count of matching components on the open page. Choosing a member opens its gallery. Choosing one of its page components applies as today.

### C.6 Presets

Recommended: **a preset is a named theme style.** The data shape already exists (`{ name, cls, variant, values }`), is versioned, and is per application and per family.

- **Save as preset** in Design items appends a style to the application's theme and saves it as a theme draft (`repository.js:122`, existing server action). A draft save writes one table row. It does not re-import anything and does not sign anyone out.
- **Use a preset on a component**, two ways:
  - *Copy:* the preset's design and values are copied into the page design. Works at once, from the draft. The component stores `presetOf: <cls>` so the panel can show where the values came from.
  - *Link:* the existing theme style picker, which sets the class. Works after the theme is pushed; later changes to the preset then reach every linked component.
- **Export and import:** a JSON file `{ format: 'vd-presets', version: 1, families: { <id>: [ styles ] } }`. Import validates every style with the existing `themeCodegen.validate` and `cleanParam`, renames clashing class names, and saves a draft. This is how presets move between applications in Phase 1.

Two existing behaviours need care:

- Design items reads only the **pushed** theme (`flutter-mode.js:145`). The gallery must read the latest theme (draft or pushed) for copy, and keep using the pushed one for link.
- The Theme Designer loads its theme once and keeps it (`theme-mode.js:403-409`). After a preset is saved from Design items, it must reload on entry, or it will overwrite the new preset with its stale copy.

The alternative, a new workspace-level table, is in section E.

### C.8 Visual shell

The owner's product concept (an HTML mockup reviewed on 2026-11-14) sets the look for tasks 7, 8 and 10. Adopted from it:

- **Three panels:** component gallery on the left, the live page in the middle, the design inspector on the right. This is the layout Design items already has.
- **Gallery tiles:** a two-column grid of members under category headings, with a search box. Each tile shows the member's name and the count of matching components on the open page.
- **Preview toolbar:** a Desktop, Tablet and Mobile switch that changes only the width of the preview frame. It adds no setting and stores nothing.
- **Status strip** under the preview: the selected component and its design.
- **Quick palette** in the inspector: swatches taken from the application theme's accent colour and the colours of its styles.
- **Rail entry "Saved designs":** lists the application's presets (task 10). The rail keeps Design items (shown as "Component Studio"), Theme Designer and Layout.
- **Text size:** nothing in the designer is smaller than 12px.

Changed from the concept, and why:

| Concept | In 1.4.0 | Reason |
| --- | --- | --- |
| Designs as text buttons | Visual thumbnails, as today | The gallery must show what a design looks like. |
| The gallery restyles one sample field | Two lists: "On this page" and "All components" | A real page can hold several components of one type; the user must pick which. |
| "Properties" tab, "Label position" | Left out | Native APEX property editing is outside Phase 1. |
| Static ID field on an item | Shown for regions and buttons only | Items are addressed by their name. |
| Chart Designer in the rail | Opens from a chart on the page, as today | A top-level view needs its own page and chart picker. Later. |
| "Settings" in the rail | Left out | Nothing to configure yet. Later. |
| Page dropdown with page names | Page number input, as today | Needs a new server query. Later. |

The inspector also keeps what the concept does not show: save as preset, built-in and custom badges, reset settings, the state and show / hide sections, and history.

### C.7 What does not change

`flutter-codegen.js` `generate` and `merge`, the marker format, `pkg_vd_page_writer`, `pkg_vd_page_code`, the chart modules, the Layout Board, `undo-stack.js`, and the stored JSON shapes (only optional fields are added).

---

## D. Implementation roadmap

Each task is test-first and leaves all unit tests green. Tasks 2 to 4 change no behaviour; task 1 proves it.

### Task 0: Spikes (no product code)

- **Objective:** answer the open technical questions before design decisions harden.
- **Questions:**
  1. How large is the generated CSS per designed component, and does the page import limit inline CSS the way it limits page JavaScript (32,767 characters, found in release 1.3.0)?
  2. Do the field selectors reach the real inputs of Combobox, Popup LOV (inline and dialog), Textarea, Number Field and single Checkbox in APEX 26.2?
  3. What should "Button Group" mean?
  4. Does anything run on APEX 24.1? The `look-selectors.js` map exists only for 26.2, and the page writer was written against the 26.2 export format.
- **Files:** none in the product. A note in `docs/superpowers/notes`.
- **Acceptance:** each question has a measured answer or a named blocker.
- **Risk:** question 4 needs a 24.1 instance, which may not be available.

### Task 1: Golden output tests

- **Objective:** freeze today's output so the refactor can prove it changed nothing.
- **New files:** `tests/unit/library_golden_test.js`, `tests/unit/fixtures/library_golden.json`.
- **Approach:** for every type and design, record the CSS for default values and for one fixed set of non-default values; record the theme CSS for one fixed theme.
- **Acceptance:** the test passes on 1.3.0 code and fails if any generated character changes.

### Task 2: Component registry

- **Objective:** `VD.componentRegistry` with `register`, `registerVariant` and the read calls.
- **New files:** `plugin/files/js/component-registry.js`, `tests/unit/component_registry_test.js`.
- **Existing files:** `plugin/files/index.html` (script list).
- **Acceptance:** a bad definition is refused with a message naming the fault; a test registers a made-up family and reads it back.
- **Risk:** none for users; nothing uses the registry yet.

### Task 3: Move the built-in library onto the registry

- **Objective:** `flutter-variants.js` registers the 12 families; `VD.flutterVariants` reads from the registry.
- **Existing files:** `plugin/files/js/flutter-variants.js`.
- **Depends on:** tasks 1 and 2.
- **Acceptance:** golden test and all existing tests pass unchanged; a test adds a design with `registerVariant` and sees it in `forType`.
- **Risk:** medium. This is the file every generator depends on.

### Task 4: Read the scattered maps from the registry

- **Objective:** samples, names, theme marks, surfaces and hides come from the family definitions.
- **Existing files:** `fl-params.js`, `theme-codegen.js`, `theme-mode.js`, `flutter-mode.js`.
- **Depends on:** task 3.
- **Acceptance:** golden test passes; a test registers a new family in a test-only file and gets a thumbnail, a theme selector and a list heading for it with no edit to those four files.

### Task 5: Settings schema: bounds, sections and dependencies

- **Existing files:** `flutter-variants.js` (`cleanParam`), `fl-params.js` (`html`, `bind`).
- **Tests:** extend `flutter_variants_test.js` and `fl_params_test.js`.
- **Acceptance:** a value outside `min` and `max` falls back to the default; a setting whose dependency is false is not drawn and not generated; the ripple special case is expressed as a dependency.

### Task 6: State settings

- **Objective:** hover, focus, disabled, read-only and error settings per family, empty by default.
- **Existing files:** `flutter-variants.js` (the advanced block, lines 444-497).
- **Depends on:** task 5.
- **Acceptance:** golden test still passes (empty values add no CSS); each state setting, when set, adds exactly one scoped rule; manual check on a page with a disabled item, a read-only item and a failed validation.
- **Risk:** the read-only markup differs per item type. Task 0, question 2 feeds this.

### Task 7: Gallery component

- **Objective:** one gallery with badges, "Reset settings" and a slot for presets.
- **Existing files:** `fl-params.js`, `flutter-mode.js` (`renderRight`), `theme-mode.js`, `plugin/files/css/editor.css`.
- **Acceptance:** "Reset settings" keeps the design and clears its values in one undo step; both designers draw the same gallery; the inspector has the status strip and the quick palette of section C.8; no designer text is smaller than 12px.

### Task 8: Component browser

- **Existing files:** `flutter-mode.js` (`renderLeft`), `editor.css`.
- **Depends on:** task 4.
- **Acceptance:** every registered family and member is a tile under its category with the right count for the open page; the search box filters the tiles; a family with no component on the page opens browse-only; the Desktop, Tablet and Mobile switch changes the preview width and nothing else.

### Task 9: Try-on preview

- **Existing files:** `flutter-mode.js` (`applyPreview`).
- **Acceptance:** pointing at a card changes the real component in the preview; leaving restores it; neither adds an undo step nor marks the page as changed. Keyboard focus on a card does the same.

### Task 10: Presets: save, copy and link

- **Existing files:** `flutter-mode.js`, `theme-mode.js` (reload on entry), `app.js` and `index.html` (the "Saved designs" rail entry), `repository.js` (only if a helper is needed).
- **Depends on:** task 7 and decision 2.
- **Acceptance:** "Save as preset" adds one theme draft version and shows the preset in the gallery of every page of that application; copy is one undo step; the Theme Designer shows the new preset without a browser reload; a saved page with a copied preset opens on 1.3.0-shaped data without error.
- **Risk:** two browser tabs editing the same theme. The last save wins, as it does today.

### Task 11: Preset export and import

- **New files:** `plugin/files/js/preset-file.js`, `tests/unit/preset_file_test.js`.
- **Existing files:** `theme-mode.js`.
- **Acceptance:** export then import into an empty theme gives the same styles; a file with a bad value, an unknown family or an unknown design is refused by name; a class clash is renamed, never overwritten.

### Task 12: Members for the listed components

- **Objective:** Text Field, Textarea, Number Field, Password, Select List, Popup LOV, Combobox, Checkbox, Checkbox Group, Radio Group, Static Content and Standard Region each appear as a member with its own sample. Fix selectors that task 0 found wrong. Add "Button Group" as task 0 defines it.
- **Existing files:** `flutter-variants.js`, `look-selectors.js`.
- **Acceptance:** each member opens a gallery; each renders correctly on a real page (manual row per member).

### Task 13: Size guard

- **Objective:** refuse a save whose merged page CSS or JS would exceed the import limit, with a message that says how large it is and what to do.
- **Depends on:** task 0, question 1. If inline CSS has no such limit, this covers JS only.
- **Existing files:** `flutter-mode.js` (`save`), or `pkg_vd_page_writer.sql` if the check belongs on the server.
- **Acceptance:** an oversized save is refused before the page is touched.

### Task 14: Release 1.4.0

- Version in `pkg_vd_plugin.sql`, CHANGELOG, USER_GUIDE, SECURITY (presets and import), ROADMAP, checklist rows, rebuild, clean-install run.

---

## E. Database impact

**Recommended option: no schema change.**

- Presets are theme styles in `VD_THEME_VERSIONS.THEME_JSON`.
- Page designs gain only optional JSON fields (`presetOf`, state values) inside `VD_PAGE_CODE_VERSIONS.DESIGN_JSON`.
- No PL/SQL change is required. The version constant changes for the release, which makes the plug-in reinstall its packages on first use; that path already exists and keeps data.

**Alternative: a workspace-level preset table** (only if decision 2 goes that way).

- New table `VD_PRESETS (PRESET_ID, WORKSPACE_ID, FAMILY, NAME, VARIANT, VALUES_JSON, SAVED_BY, SAVED_AT)`, a new AJAX part, a new package, an install chunk, an uninstall line and a database test suite.
- It gives sharing across applications without files. It costs a second place where "a named design with values" is stored, next to theme styles, and the two would need to be kept apart in the interface.

---

## F. Risk register

| # | Risk | Kind | Likelihood | Effect | Response |
| --- | --- | --- | --- | --- | --- |
| 1 | The brief targets APEX 24.1. The code has one selector map (26.2) and a page writer built on the 26.2 export format; the docs claim 26.1 with only 26.2 tested. | Compatibility | High | A wrong claim, or broken pages on older releases | Decision 1. Recommended: Phase 1 stays on the floor the repository states. Older releases become their own project with a real instance. |
| 2 | Generated CSS grows with every designed component and every state setting. If inline CSS has the same 32,767 limit as page JS, a busy page cannot be saved. | Technical | Unknown until task 0 | Save fails | Task 0 measures; task 13 guards. If the limit is real and low, moving page CSS to a static file becomes a Phase 2 item. |
| 3 | The refactor of the library changes generated CSS by accident. | Regression | Medium | Saved pages look different after their next save | Task 1 golden test before any refactor. |
| 4 | A third-party family registers bad CSS or script. | Security | Low today | CSS or JS reaches every user of a designed page | Families are plug-in files, installed by whoever imports the plug-in. Registration checks structure only. SECURITY.md must say a family file is trusted code. |
| 5 | Imported preset files carry unsafe values. | Security | Medium | CSS injection | Import runs every value through `cleanParam` and refuses unknown keys. Extra CSS keeps its existing whitelist. |
| 6 | Design items and the Theme Designer both write the theme. | Data | Medium | A preset is lost | Theme Designer reloads on entry (task 10). Versions keep every draft, so nothing is unrecoverable. |
| 7 | State styling hides APEX's own error or disabled cues. | Accessibility | Medium | Users cannot tell a field is invalid | Defaults stay as APEX and the design draw them. The checklist adds contrast and focus-visible checks. |
| 8 | Try-on leaves the preview in a wrong state. | Technical | Low | Confusing preview | The preview is always regenerated from the design on leave; a test asserts it. |
| 9 | Saves still sign users out (page re-import). | Existing | Certain | Annoyance | Unchanged in Phase 1. Preset saves avoid it, because they write a theme draft only. |
| 10 | Scope: 14 tasks. | Delivery | Medium | Late release | Section H marks a cut line after task 10. |

---

## G. Definition of done

1. All unit tests pass, including the golden test, with no change to its fixture after task 1.
2. A test-only family file gets a browser entry, a gallery, thumbnails, theme selectors and generated CSS with no edit to `component-registry.js`, `flutter-codegen.js`, `fl-params.js`, `theme-codegen.js`, `flutter-mode.js` or `theme-mode.js`.
3. A page saved by 1.3.0 opens in 1.4.0 with no "Unsaved changes" and generates the same CSS.
4. A theme pushed by 1.3.0 opens and pushes again with the same CSS.
5. Every member in task 12 has a passed manual row on a real page: looks right, value submits, validation error shows, a Dynamic Action refresh keeps the design.
6. Presets: save, copy, link, export and import each have a passed manual row and unit tests.
7. Undo and redo cover design choice, settings, reset and preset copy.
8. The Theme Designer, Layout Board and Chart Designer pass their existing checklist rows.
9. `tests/INSTALL_CHECKLIST.md` has a 1.4.0 section with results, and no open FAIL.
10. SECURITY.md and USER_GUIDE.md describe presets, import and family files.

---

## H. Execution order

1. **Task 0** first: its answers can change tasks 12 and 13 and decision 1.
2. **Task 1** before any refactor, so there is a baseline.
3. **Tasks 2, 3, 4** in that order: registry, then the library on it, then the readers. Each is invisible to users and separately releasable.
4. **Tasks 5, 6**: the settings schema, then the state settings that need it.
5. **Tasks 7, 8, 9**: the gallery, then the browser and try-on that sit on it.
6. **Task 10**: presets, which need the gallery slot. *Cut line: a release after task 10 is a complete Component Studio.*
7. **Tasks 11, 12, 13** can follow in any order.
8. **Task 14** last.

---

## 11. Self-review

| Question | Answer |
| --- | --- |
| Is it extensible? | Yes for families and designs, once the five scattered maps live in the family definition. The DoD has a test that proves it. |
| Can a design be added without editing core files? | Yes: one new file calling `registerVariant`, plus its name in the script manifest. |
| Can one settings system serve every family? | It already does for 12 types. Reports and grids need more show / hide switches than fields, which the per-family `hides` covers. Charts keep their own model. |
| Are previews accurate? | The page preview and try-on use the real component. Thumbnails are approximations and are labelled as samples. |
| Can presets be shared across applications? | By file in Phase 1. Not live. Live sharing needs the table in section E. |
| Will existing designs keep working? | Yes, if ids and keys stay and new settings default to empty. The golden test and DoD 3 and 4 check it. |
| Is the scope right for 1.4.0? | Tasks 0 to 10 are. Tasks 11 to 13 can slip to 1.4.1 without leaving a half feature. |
| Smallest viable version? | Tasks 0 to 4 and 7 to 10: registry, gallery, browser, try-on and presets, with today's settings. |

**Assumptions**

- "Design items" keeps its name in the rail; "Component Studio" is the feature name. Not asked.
- English interface only, as today.
- Presets are per application unless decision 2 says otherwise.

**Not verified in this audit**

- The inline CSS import limit (task 0).
- The Combobox and Popup LOV markup against the current selectors (task 0).
- Any behaviour on a release other than 26.2.

---

## 12. Decisions needed

| # | Decision | Recommended | Alternative |
| --- | --- | --- | --- |
| 1 | APEX version floor for 1.4.0 | Keep the repository's floor (26.1, tested on 26.2). Treat 24.1 as a separate project. | Add 24.1 now: needs a 24.1 instance, a second selector map and a page writer review. |
| 2 | Where presets live | Theme named styles, per application, no database change. | New workspace table `VD_PRESETS`. |
| 3 | Family granularity | Styling families with members (Textarea is a member of `text`). | A separate family per APEX type: needs a migration of saved themes and designs. |
| 4 | Meaning of "Button Group" | Decide after task 0. | Drop it from Phase 1. |
| 5 | How a new family file is listed | One name added to the script list in `index.html`. | A `families.json` manifest read by the build. |
| 6 | Thumbnails | Sample markup, plus try-on on the real component. | Render every card inside the preview iframe. |
| 7 | Responsive settings | Not in Phase 1. | Add a breakpoint dimension to settings now. |
| 8 | Cut line | Release after task 10; tasks 11 to 13 follow. | One release with all 14 tasks. |

## Files expected to change

- `plugin/files/js/flutter-variants.js`
- `plugin/files/js/fl-params.js`
- `plugin/files/js/flutter-mode.js`
- `plugin/files/js/theme-codegen.js`
- `plugin/files/js/theme-mode.js`
- `plugin/files/js/app.js`
- `plugin/files/js/look-selectors.js` (only if task 0 finds wrong selectors)
- `plugin/files/js/repository.js` (only if a preset helper is needed)
- `plugin/files/css/editor.css`
- `plugin/files/index.html`
- `database/packages/pkg_vd_plugin.sql` (version constant only)
- `plugin/region_type_plugin_apex_visual_designer.sql` (rebuilt, never edited by hand)
- `tests/unit/flutter_variants_test.js`, `fl_params_test.js`, `theme_mode_test.js`, `flutter_mode_picker_test.js`
- `tests/INSTALL_CHECKLIST.md`, `CHANGELOG.md`, `docs/USER_GUIDE.md`, `docs/SECURITY.md`, `docs/ROADMAP.md`

## New files expected

- `plugin/files/js/component-registry.js`
- `plugin/files/js/preset-file.js`
- `tests/unit/component_registry_test.js`
- `tests/unit/library_golden_test.js`
- `tests/unit/fixtures/library_golden.json`
- `tests/unit/preset_file_test.js`
- `docs/superpowers/notes/2026-11-14-component-studio-spikes.md`

## Testing summary

| Area | Automated (Node) | Manual (APEX runtime) |
| --- | --- | --- |
| Discovery | Existing `repository_test.js` | `plugin_api_tests.sql`; a page with every member type |
| Registration, variant loading | `component_registry_test.js` | none |
| CSS generation and isolation | Golden test; every rule starts with the component's scoped selector | Two designed components of one family on one page do not affect each other or an undesigned third |
| Setting validation | `flutter_variants_test.js` | none |
| Gallery, browser, selection | `fl_params_test.js`, `flutter_mode_picker_test.js` | Visual check per family |
| Try-on | Preview state restored (unit, with a fake frame) | Pointer and keyboard on a real page |
| Apply, save, restore | Existing `page_code_tests.sql` | Save and restore on a scratch page |
| Undo and redo | `undo_stack_test.js` plus preset copy and reset cases | none |
| Presets and files | `preset_file_test.js`, `theme_mode_test.js` | Save, copy, link, export, import across two applications |
| States | One rule per set state (unit) | Disabled, read-only, error, hover and focus on a real page |
| Page and AJAX refresh, Dynamic Actions | none | Refresh a designed region; a Dynamic Action that sets, disables and hides a designed item; submit with a validation error |
| Theme compatibility | Golden theme CSS | A page under a pushed theme, with and without a page design |
| APEX versions | none | 26.2 always; others per decision 1 |
