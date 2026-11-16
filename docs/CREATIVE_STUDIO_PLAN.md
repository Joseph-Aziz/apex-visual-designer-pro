# APEX Creative Studio — implementation plan

This plan moves the editor to the "APEX Creative Studio" look: a dark graphite workspace with blue accents, a light appearance, and both LTR and RTL. It keeps every existing DOM hook and every existing function.

## 0. Verdict on the current uncommitted work

**Keep and finish:**
- the `index.html` shell: skip link, `vd-app-shell`, `main#main-workspace`, the context in the top bar, the appearance switch and Help;
- in `app.js`: `aria-current`, the `vd-screen-*` body classes and `bindStudio()`;
- in `page-bar.js`: the `.vd-page-fields` and `.vd-page-actions` wrappers;
- in `flutter-mode.js`: the toolbar groups.

**Redo:**
1. **`editor.css`.** Rewrite it as one hand-curated stylesheet. Today it has five stacked layers, built by a lightness heuristic. Known defects:
   - The primary button is white on #3978E8, which is 4.18:1 and fails.
   - The light `--subtle` colour on `--surface-3` is 4.46:1 and fails.
   - Global input and min-size rules leak into the sample markup.
   - The RTL fixes are patches instead of logical properties.
2. **`.fl-left` and `.fl-right`.** Put these classes back on the `<aside>` elements. Render the generated content into an inner `.vd-pane-body`.
3. **"Connected to APEX".** It is static text, which makes it fake UI. Drive it from `repository.js`.
4. **Appearance button.** Use a fixed `aria-label` and toggle only `aria-pressed`.
5. **`tools/studio_theme.py`.** Delete it.

Do not run `tests/browser/snapshot.js` before the hooks baseline exists. It overwrites the pre-Studio files in `design-handoff/`.

## 1. Prototype to real hooks

| Prototype | Real implementation |
|---|---|
| App and page context | `#page-bar` inside `.studio-context` on Design and Layout. On Theme and Library, `span.studio-app` shows "Application N". Names are not available. |
| Connection dot | `.studio-status[data-state]`, driven by `VD.repository.onStatus` |
| Save draft and Apply in the top bar | They stay in each workspace's mode bar: `.fl-save`, `.th-save`, `.th-push`, `.lb-apply` inside `.vd-toolbar-primary` |
| Rail and Help | `button.rail-item[data-view]` and `.studio-help` |
| Mode bar | `.lk-top.fl-top`, `.lk-top.th-top` and `.lk-top.lb-top`, each with `.vd-toolbar-heading`, the device switch and undo/redo |
| Left panel | Design: `aside.lk-left.fl-left`. Theme: `aside.lk-left.th-left`. |
| Canvas | `.lk-center` with a dotted background; `.lb-board` in Layout |
| Inspector | `aside.lk-right.fl-right`, `aside.lk-right.th-right`, and `.lb-preview` in Layout |

## 2. Token layer

Dark is the default on `:root`. Light applies to `:root[data-appearance="light"]`. The **paper scope** is `.fl-thumb, .th-sample-box, .th-gallery`. It re-declares the light tokens so the APEX samples keep their light-page assumptions.

| Token | Dark | Light |
|---|---|---|
| `--bg` | #10141C | #F4F6F9 |
| `--chrome` | #151B25 | #FFFFFF |
| `--surface` / `--surface-2` / `--surface-3` | #1B2330 / #202A39 / #273241 | #FFFFFF / #F7F9FC / #EEF2F6 |
| `--canvas` / `--canvas-dot` | #111720 / #2A3545 | #EEF2F6 / #CBD5E1 |
| `--line-soft` / `--line` / `--line-strong` | #273241 / #303B4C / #465770 | #E8EDF2 / #DCE5ED / #B7C3D2 |
| `--control-border` | #6B7F9C | #7D8EA1 |
| `--text` | #EEF3FA | #1E2F43 |
| `--muted` | #A3B1C3 | #53677D |
| `--subtle` | #98A6B9 | #586A7E |
| `--accent` | #76A9FF | #1769AA |
| `--accent-fill` / `--accent-fill-hover` | #2F68CF / #2B62C4 | #16375F / #214B78 |
| `--accent-soft` | rgba(88,145,245,.16) | #E8EEF6 |
| `--live` / `--live-hover` / `--on-live` | #E2B957 / #EBC86E / #1D2430 | same |
| `--gold` | #D7B45C | #7A5D08 |
| `--success` | #65C99A | #127A53 |
| `--danger` | #F0959B | #B53333 |
| `--warn-soft` | rgba(215,180,92,.14) | #FFF9E8 |
| `--paper` / `--paper-ink` | #FFFFFF / #1C1B1F | same |

Other tokens:
- Fonts: system fonts only.
- Type: from `--fs-xs` (11px) to `--fs-xl` (20px).
- Spacing: `--sp-1` to `--sp-6`.
- Radius: `--r-sm`, `--r-md`, `--r-lg`, `--r-pill`.
- Shadows: `--sh-1` to `--sh-3`.
- Sizes: `--topbar-h` 58px, `--rail-w` 68px, `--left-w` 258px, `--right-w` 300px, `--right-w-chart` 460px, `--control-h` 32px.
- Motion and focus: `--dur-fast`, `--dur`, `--ease`, `--focus`.
- Legacy aliases: none are kept.

## 3. Hook inventory

`tests/browser/hooks.js` has three modes:

- **`--static`** compares the `git show HEAD` version of `index.html` and the mode scripts with the working copy. It checks classes, ids, `data-*` and `aria-*` attributes, roles, and which tag carries each class. HEAD must be a subset of the working copy, apart from an explicit ALLOW list with a reason for each entry.
- **`--rendered`** drives the editor with Playwright through 19 UI states and records every element's hooks. With `--compare`, it diffs the result against a baseline.
- **`--css`** checks for missing styles, dead selectors and physical properties.

## 4. Steps

Gates:
- **U**: run the unit tests:
  ```bash
  for f in tests/unit/*_test.js; do node "$f" >/dev/null 2>&1 || echo FAIL $f; done
  ```
- **B**: run the browser tests:
  ```bash
  cd tests/browser && npm test
  ```
- **H**: run the hook inventory (`hooks.js`).

**A. Baseline**
- A1. Run U and B on the current tree.
- A2. Write `hooks.js` and take the baseline. Export the ask and More helpers from `run.js`.
- A3. Add `?dir=rtl` to `host.html`. Add `tests/browser/out/` to `.gitignore`.
- A4. Delete `tools/studio_theme.py`.

**B. Shell**
- B1. `index.html`:
  - add `.studio-app`;
  - give the appearance button a fixed label;
  - add `aria-hidden` to the rail icons;
  - inherit RTL from the parent page;
  - leave the script list unchanged.
- B2. `app.js`:
  - add `VD.studio.paneHead`;
  - fill `.studio-app` in `route()`;
  - toggle only `aria-pressed` on the appearance button;
  - close the More menu with Escape or an outside click;
  - rename the workspaces in the guides.
- B3. `repository.js`:
  - add `status()` and `onStatus()`, with the states offline, ready, connected and error;
  - drive `.studio-status` from them;
  - add unit and browser checks.
- B4. `page-bar.js`: add `type="button"` to the buttons and `aria-label`s to the inputs.
- B5. Fix `savePreset()`, which calls `window.prompt`. Prompts are blocked in the editor's iframe. Give `VD.ask` an input option and update the browser check to use it.

**C. Workspace markup**
- C1. Design Studio:
  - put the classes back on the asides and render into the pane bodies;
  - add `.vd-toolbar-heading` with the title "Design Studio";
  - update `run.js` for the new title.
- C2. Theme Lab:
  - use the same pane pattern;
  - group the toolbar into a view group, the More menu, and the primary group (DRAFT and LIVE);
  - set `aria-pressed` on the toggle buttons.
- C3. Layout Studio: wrap the board and the preview in `.vd-pane` elements and put the headings outside the sections that are re-rendered. Group the toolbar.
- C4. Layout RTL: mirror the pointer and arrow-key maths. If that is unstable, fall back to `direction: ltr` on the board.
- C5. Design Library:
  - add a mode bar;
  - show each style as a card with its real thumbnail, using `VD.flParams.card`;
  - add an empty state.

**D. Stylesheet rewrite**

Write the new stylesheet in this order, and run B after each part:
- D1. Tokens, reset and accessibility base.
- D2. Controls.
- D3. Shell.
- D4. Workspace frame.
- D5. Design Studio.
- D6. Theme Lab.
- D7. Layout Studio.
- D8. Library and dialog.
- D9. Responsive rules, without hiding any function.
- D10. CSS coverage check.

Keep these functional rules:
- `[hidden]`;
- `.view`;
- the `.lb-*` grid and the drop line;
- `[data-pv]`;
- the wider inspector for the Chart Designer;
- `.vd-ask-message { white-space: pre-line }`;
- the sample helpers.

**E. Verification**
- E1. `screens.js`: 48 screenshots, covering dark and light, LTR and RTL, desktop, tablet and mobile, and the four workspaces. Check that nothing overflows sideways and that the save buttons are visible. Compare the thumbnails against the HEAD stylesheet.
- E2. `a11y.js`: check contrast (4.5:1), target size (32px) and visible focus.
- E3. Fix the findings.

**F. Build and docs**
- F1. Run `node tools/build_plugin.js`, then U and B.
- F2. Update `docs/USER_GUIDE.md`.
- F3. Update `CHANGELOG.md`, under 1.4.0.
- F4. Write `docs/CREATIVE_STUDIO.md`: tokens, DOM map, hooks report, regression report and gaps.
- F5. Run the final gates. Make no commit.

## 5. Risks

- Tests depend on structure and text: `.fl-title`, the first `.fl-right h3`, `.lk-state` values, the 10 `.fl-left .lk-slot` items, and `.sv-page .sv-list li`.
- The undo key guard uses `offsetParent`.
- Bodies that are rebuilt with `innerHTML` lose static headings placed inside them.
- Dark chrome can leak into the light samples.
- `color-scheme: dark` changes the native controls.
- The `.lb-body` grid columns are set inline.
- RTL drag maths can break.
- The new `VD.ask` input changes the focus trap.
- `snapshot.js` overwrites the handoff baseline.

## 6. Prototype features with no real function behind them (gaps)

These are documented, not built:
- application and page names;
- a global Save or Apply in the top bar;
- Style, Layout and Advanced tabs in the inspector;
- an Apply style footer;
- range sliders;
- visibility per device;
- an Add component grid;
- "•••" menus;
- Preview ↗ in Design and Theme;
- a selection tag on the canvas;
- theme preset cards;
- the Layout regions panel and inspector;
- Library metadata, and apply or delete in the Library;
- toasts;
- Page and Components tabs;
- translated strings;
- search in "On this page".
