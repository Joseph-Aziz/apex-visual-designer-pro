# Layout Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Layout board in the designer that moves regions and items on APEX's 12-column grid and writes the moves into the real page in one re-import, with undo.

**Architecture:** A pure board model (`layout-model.js`) holds the layout as data and produces a change list. A mode file (`layout-mode.js`) draws it and handles drag and drop. The server reads the layout (`PKG_VD_PAGE_CODE.layout_json`), validates and writes changes (`PKG_VD_PAGE_WRITER.apply_layout` / `undo_layout`) through the existing export, edit and import path, and keeps old values in `VD_LAYOUT_VERSIONS`.

**Tech Stack:** Oracle APEX 26.2 plug-in, PL/SQL, plain browser JS (IIFE modules on `window.VD`), Node `assert` unit tests run with `vm`.

**Spec:** `docs/superpowers/specs/2026-11-12-layout-board-design.md`

## Global Constraints

- APEX 26.2; Oracle Database 19c or later.
- Writes go only through `export_page` → `edit_call` → `import_page` in `PKG_VD_PAGE_WRITER`.
- Every server entry point calls `guard(p_app, p_page)` first.
- Error codes: -20240 stale page, -20241 invalid change (message names component and reason).
- Spans 1 to 12; a grid row holds at most 12 columns; sequences rewritten in steps of 10.
- Keep 10 layout versions per page.
- New table goes into `tools/build_plugin.js` INSTALL list, `database/install.sql` and `database/uninstall.sql`; plug-in version becomes `1.2.0`.
- No environment names (workspace, schema or app names of the owner's systems) in repository files; `tests/unit/no_env_values_test.js` must stay green.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. A page whose export omits layout arguments (all defaults): moving a component must add only what differs and leave others out. Covered in Task 3 test `apply_on_default_page`.
2. A drop that makes a row exceed 12 columns through span resize, not only through move. Covered in Task 1 test `span resize refused when row overflows`.
3. Moving a region that has sub-regions and items: children stay with it, nothing else changes. Covered in Task 1 test `region moves with children` and Task 3 test `move_parent_keeps_children`.
4. Apply fails inside APEX import after validation passed: page comes back as before. Covered in Task 3 test `import_failure_restores_page` (inject a failure with a bad argument value).
5. Board left with unapplied changes when the user switches mode or page: asked to apply or discard, nothing lost silently. Covered in Task 4 manual check M5.

---

### Task 1: Board model

**Files:**
- Create: `plugin/files/js/layout-model.js`
- Test: `tests/unit/layout_model_test.js`

**Interfaces:**
- Consumes: the layout JSON shape of Task 2 (`{token, slots:[{name,label,grid}], regions:[{id,title,parent,slot,seq,newRow,newCol,colStart,span,hidden}], items:[{id,name,label,region,seq,newRow,newCol,colStart,span,type,hidden}]}`; `span`/`colStart` null means automatic; `region` null means no region).
- Produces: `window.VD.layoutModel = { load(json) → board, move(board, kind, id, target) → {ok, reason}, setSpan(board, kind, id, span) → {ok, reason}, changes(board) → [{kind:'region'|'item', id, slot?, parent?, region?, seq, newRow, newCol, colStart, span}], rows(board, containerKey) → [[component]], dirty(board) → boolean }`. `target` = `{container: 'slot:<name>' | 'region:<id>' | 'noregion', before: <id>|null, sameRow: boolean}`.

- [ ] **Step 1: Write the failing tests** in `tests/unit/layout_model_test.js` (load with `vm` like `theme_codegen_test.js`), with a fixture of slot `BODY` (grid) and `REGION_POSITION_08` (no grid), regions R1 (span 6), R2 (span 6, same row), R3 (sub-region of R1), items I1, I2 in R1:
  - `load` then `changes` → `[]`, `dirty` → false.
  - `move region before`: move R2 before R1 in BODY → changes list R2 seq 10, R1 seq 20; only components whose values changed appear.
  - `new row`: move R2 with `sameRow:false` → R2 `newRow:true`.
  - `row overflow refused`: setSpan R1 to 8 while R2 is 6 on the same row → `{ok:false, reason: /12 columns/}`, board unchanged.
  - `span resize refused when row overflows`: same through `setSpan` on R2 to 7.
  - `parent cycle refused`: move R1 into `region:R3` → `{ok:false, reason: /inside itself/}`.
  - `region moves with children`: move R1 to slot `REGION_POSITION_08` → changes contain only R1; R3, I1, I2 unchanged.
  - `no grid slot`: in `REGION_POSITION_08`, setSpan → `{ok:false}`; move gives `newRow` untouched.
  - `item between regions`: move I2 into `region:R2` → change `{kind:'item', id:I2, region:R2, seq:10}`.
  - `no region strip`: item with `region:null` moves into R1 → ok; moving I1 to `noregion` → `{ok:false}`.
  - `moved component loses column start`: R1 with `colStart:3` moved → change has `colStart:null`; unmoved keeps it (not in changes).

- [ ] **Step 2: Run** `node tests/unit/layout_model_test.js`. Expected: FAIL, `VD.layoutModel is undefined`.

- [ ] **Step 3: Implement** `plugin/files/js/layout-model.js` with the interface above. Keep the original snapshot from `load` and compute `changes` by comparing each component to it; sequences of every touched container are rewritten 10, 20, 30…

- [ ] **Step 4: Run** `node tests/unit/layout_model_test.js`. Expected: `layout_model_test: all passed`.

- [ ] **Step 5: Commit** `feat: add layout board model`.

### Task 2: Read the layout

**Files:**
- Modify: `database/packages/pkg_vd_page_code.sql` (spec and body)
- Modify: `database/packages/pkg_vd_plugin.sql` (flutter dispatcher, action `layout`)
- Modify: `plugin/files/js/repository.js`
- Test: `tests/db/layout_tests.sql` (new), `tests/unit/repository_test.js`

**Interfaces:**
- Produces: `PKG_VD_PAGE_CODE.layout_token(p_app IN NUMBER, p_page IN NUMBER) RETURN VARCHAR2` (page last-changed time from `APEX_APPLICATION_PAGES`, as text); `PKG_VD_PAGE_CODE.layout_json(p_app IN NUMBER, p_page IN NUMBER) RETURN CLOB` (shape in Task 1). AJAX: x10 `flutter`, action `layout` returns `{success:true, layout:{…}}`. JS: `VD.repository.layout(app, page) → Promise<layout>`.

- [ ] **Step 1: Confirm column names.** Export a scratch page with a region of span 4 starting at column 3 on a new column, and an item with span 6; record the exact `create_page_plug` / `create_page_item` argument names for sequence, slot, parent, new row, new column, column start and span, and the matching columns of `APEX_APPLICATION_PAGE_REGIONS` / `APEX_APPLICATION_PAGE_ITEMS`. Write them as a comment block at the top of `layout_json`'s body. Also find how the page template marks grid vs non-grid display points (`APEX_APPLICATION_TEMP_PAGE_DP` or equivalent) and record it.

- [ ] **Step 2: Write failing DB tests** in `tests/db/layout_tests.sql` (parameters `VD_SCHEMA TEST_APP SCRATCH_PAGE`, pass/fail counters like `page_code_tests.sql`): `layout_json` is valid JSON; has `token` equal to `layout_token`; region count equals the dictionary count for the page; each item's `region` matches `ITEM_PLUG_ID`; `BODY` slot has `grid:true`.

- [ ] **Step 3: Run** the script in SQL Commands on the scratch page. Expected: fails with `PLS-00302` (function missing).

- [ ] **Step 4: Implement** both functions with `apex_json` (as `pkg_vd_plugin` does), the `layout` action in the flutter dispatcher after `guard`, and `repository.layout`; add a repository unit test that `layout` posts x10 `flutter`, action `layout`.

- [ ] **Step 5: Run** DB tests (Expected: all PASS) and `node tests/unit/repository_test.js` (Expected: passed).

- [ ] **Step 6: Commit** `feat: read a page's layout for the layout board`.

### Task 3: Apply and undo

**Files:**
- Create: `database/tables/vd_layout_versions.sql`
- Modify: `database/packages/pkg_vd_page_writer.sql`, `database/packages/pkg_vd_plugin.sql`, `database/install.sql`, `database/uninstall.sql`, `tools/build_plugin.js` (INSTALL list, default version `1.2.0`), `plugin/files/js/repository.js`
- Test: `tests/db/layout_tests.sql`, `tests/unit/build_plugin_test.js`, `tests/unit/install_chunks_test.js`

**Interfaces:**
- Consumes: `layout_token`, `layout_json` (Task 2); change list shape (Task 1) as JSON array text.
- Produces: `PKG_VD_PAGE_WRITER.apply_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2, p_changes IN CLOB) RETURN VARCHAR2`; `PKG_VD_PAGE_WRITER.undo_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2) RETURN VARCHAR2`; both return the new token. `edit_call` changes to `edit_call(p_src IN CLOB, p_head IN VARCHAR2, p_drop IN apex_t_varchar2, p_add IN CLOB) RETURN CLOB` (existing callers pass their one or two names). AJAX actions `apply_layout` (x04 token, x05 changes) and `undo_layout` return `{success:true, token}`. JS: `VD.repository.applyLayout(app, page, token, changes)`, `VD.repository.undoLayout(app, page, token)`. Table `VD_LAYOUT_VERSIONS (VERSION_ID identity PK, WORKSPACE_ID, APP_ID, PAGE_ID, CHANGES CLOB IS JSON, SAVED_BY, SAVED_AT)`, index on `(WORKSPACE_ID, APP_ID, PAGE_ID, VERSION_ID)`.

- [ ] **Step 1: Write failing tests.**
  - Build tests: INSTALL order lists `tables/vd_layout_versions` after `tables/vd_theme_versions`; `SOURCES` in `build_plugin_test.js` and `install_chunks_test.js` updated to match.
  - DB tests in `layout_tests.sql`: `apply_move_region` (swap two regions, re-read: sequences swapped); `apply_span` (span 4 then re-read 4); `apply_item_to_other_region`; `apply_on_default_page` (a region with no layout arguments in the export gets only the changed ones); `move_parent_keeps_children`; `stale_token` raises -20240 and the page's last-changed time is unchanged; each validation case raises -20241 and nothing changes (unknown id, region into own descendant, item with no region, unknown slot, span 13, row over 12); `import_failure_restores_page` (a change carrying a slot the dictionary accepts but the import rejects, or a forced failure via a test hook argument `p_fail_after_import => TRUE` in a test-only overload; page re-read equals before); `undo_restores` (apply then undo: values equal the original); `undo_stale_token` raises -20240; `keeps_ten` (11 applies leave 10 rows).

- [ ] **Step 2: Run** `node tests/unit/build_plugin_test.js` (Expected: FAIL on install order) and the DB script (Expected: `PLS-00302` for `apply_layout`).

- [ ] **Step 3: Implement.** Table script like `vd_theme_versions.sql`. In `apply_layout`: guard, token check, validate every change against the dictionary (rules listed in Step 1), store the old values of the changed components, then export once, `edit_call` per change dropping all layout argument names from Task 2 Step 1 and re-adding only non-null values, import; on import error re-import the saved original export and re-raise. `undo_layout`: token check, take newest version, apply it the same way without storing a version, delete it. Add AJAX actions and repository calls. Uninstall drops the table.

- [ ] **Step 4: Run** all unit tests (`for f in tests/unit/*.js; do node $f; done`) and the DB script. Expected: all pass.

- [ ] **Step 5: Commit** `feat: apply and undo layout changes`.

### Task 4: The board UI

**Files:**
- Create: `plugin/files/js/layout-mode.js`
- Modify: `plugin/files/js/app.js` (`VIEWS.layout`), `plugin/files/index.html` (mode tab and script list: `layout-model`, `layout-mode` after `repository`), `plugin/files/css/editor.css`
- Test: `tests/unit/layout_mode_test.js`

**Interfaces:**
- Consumes: `VD.layoutModel` (Task 1), `VD.repository.layout/applyLayout/undoLayout` (Tasks 2–3), `VD.pagePreview.url` for reload.
- Produces: `window.VD.layoutMode = { enter(), leave() → boolean (false when the user cancels leaving with changes) }`.

- [ ] **Step 1: Write failing test** `tests/unit/layout_mode_test.js`: with a minimal fake DOM stub as in `flutter_mode_picker_test.js`, `VD.layoutMode` exists with `enter` and `leave`; `app.js` VIEWS has `layout`; `index.html` loads `layout-model` before `layout-mode`.

- [ ] **Step 2: Run** it. Expected: FAIL.

- [ ] **Step 3: Implement.** Slots top to bottom; grid slots as rows of 12-column CSS grids, non-grid slots as plain lists; region boxes contain their item and sub-region rows; "No region" strip. HTML5 drag and drop with `.vd-dropline` as marker, red (`.is-refused`) when the model returns `ok:false`, showing `reason`. Right-edge handle sets span by whole columns. Keyboard: arrows move the selected box, Shift+arrows change span. Changed boxes get `.is-changed`. Buttons Apply, Revert, Undo apply; Apply shows the re-import warning text already used by saves, then calls `applyLayout`, reloads the board and the preview. Errors -20240/-20241 show the server message. `leave()` with `dirty` asks Apply / Discard / Cancel.

- [ ] **Step 4: Run** the unit test and all unit tests. Expected: pass.

- [ ] **Step 5: Manual checks** in an APEX 26.2 app on a scratch page, recorded in `tests/INSTALL_CHECKLIST.md` under a new "Layout board (1.2.0)" table:
  - M1: a page with tabs (sub-regions): move a tab region, apply, page renders.
  - M2: a modal dialog page: reorder buttons' region in the Dialog Footer slot (list mode).
  - M3: a page with hidden items: move one, apply.
  - M4: change the page in App Builder, then Apply: refused with the reload message.
  - M5: drag a change, switch to Flutter mode: asked to apply or discard.
  - M6: Undo apply restores the previous layout.

- [ ] **Step 6: Commit** `feat: add the layout board to the designer`.

### Task 5: Docs and build

**Files:**
- Modify: `docs/INSTALL.md` (Good to know: the Layout board and that Apply re-imports; objects list adds `VD_LAYOUT_VERSIONS`), `README.md` (feature line), `plugin/region_type_plugin_apex_visual_designer.sql` (rebuilt)

- [ ] **Step 1: Rebuild** `node tools/build_plugin.js`. Expected: `wrote plugin/region_type_plugin_apex_visual_designer.sql (… files, version 1.2.0)`.
- [ ] **Step 2: Run** all unit tests. Expected: all pass.
- [ ] **Step 3: Commit** `docs: describe the layout board; build 1.2.0`.
