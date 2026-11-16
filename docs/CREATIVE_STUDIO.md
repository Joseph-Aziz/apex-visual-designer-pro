# APEX Creative Studio

The 1.4.0 redesign of the editor chrome. It follows the plan in `CREATIVE_STUDIO_PLAN.md`. This file records what was built, how it was checked, and what was left out.

## Tokens

All colours, radii, shadows and sizes are CSS custom properties on `:root` in `plugin/files/css/editor.css`. Dark is the default. `:root[data-appearance="light"]` swaps in the light set; the top bar's `.studio-appearance` button sets that attribute on `<html>`.

| Token | Dark | Light |
|---|---|---|
| `--bg` | #10141C | #F4F6F9 |
| `--chrome` | #151B25 | #FFFFFF |
| `--surface` / `--surface-2` / `--surface-3` | #1B2330 / #202A39 / #273241 | #FFFFFF / #F7F9FC / #EEF2F6 |
| `--canvas` | #111720 | #EEF2F6 |
| `--line-soft` / `--line` / `--line-strong` | #273241 / #303B4C / #465770 | #E8EDF2 / #DCE5ED / #B7C3D2 |
| `--control-border` | #6B7F9C | #7D8EA1 |
| `--text` / `--muted` / `--subtle` | #EEF3FA / #A3B1C3 / #8D9CB0 | #1E2F43 / #53677D / #5F7185 |
| `--accent` / `--accent-text` | #76A9FF / #8DB8FF | #1769AA / #16375F |
| `--accent-strong` / `--on-accent` | #2A64CF / #FFFFFF | #16375F / #FFFFFF |
| `--accent-soft` | rgba(88,145,245,.16) | #E8EEF6 |
| `--live` / `--live-hover` / `--on-live` | #E2B957 / #EBC86E / #1D2430 | same |
| `--gold` | #D7B45C | #8A6A0C |
| `--success` / `--danger` | #65C99A / #E47C83 | #16865C / #C23B3B |
| `--warn-soft` | rgba(215,180,92,.14) | #FFF9E8 |

Also: `--r-xs` to `--r-lg` (5–16px), `--radius` (11px), `--sh-1` to `--sh-3`, `--font`, `--mono`, `--topbar-h` (58px), `--rail-w` (68px) and `--dur` (.16s).

The previews of the user's own components (`.fl-thumb`, `.th-sample-box`, `.th-gallery`, `.sv-thumb`) stay on a light paper background in both appearances, because the APEX samples assume a light page.

## DOM map

| Area | Elements |
|---|---|
| Top bar | `a.brand` (`.brand-name`, `.brand-sub`); `.studio-context` holding `#page-bar` on Design and Layout, or `span.studio-app` on Theme and Library; `.studio-status[data-state]` fed by `VD.repository.onStatus`; `.studio-appearance` |
| Rail | `button.rail-item[data-view]` with `flutter` (Design), `theme`, `layout` and `saved` (Library); `.rail-item.studio-help` |
| Mode bar | `.lk-top.fl-top`, `.lk-top.th-top`, `.lk-top.lb-top`, each with `.vd-toolbar-heading` and `.vd-toolbar-primary` (`.fl-save`, `.th-save`, `.th-push`, `.lb-apply`) |
| Left panel | `aside.lk-left.fl-left`, `aside.lk-left.th-left`; panes use `.vd-pane`, `.vd-pane-eyebrow`, `.vd-pane-description`, `.vd-pane-body` |
| Canvas | `.lk-center`, `.fl-preview iframe`; `.lb-board` in Layout |
| Inspector | `aside.lk-right.fl-right`, `aside.lk-right.th-right`, `.lb-preview` |
| Library | `.sv-page`, `.sv-top`, `.sv-list`, `.sv-card`, `.sv-thumb`, `.sv-empty` |
| Dialogs | `.vd-ask`, with the new `.vd-ask-input` for questions that take a name |

Structural changes in markup and CSS carry a `CHANGED:` comment.

## Hooks report

`tests/browser/hooks.js` makes sure no id, class, `data-*`, `aria-*` or role that pages, scripts or tests rely on was lost.

- `--static`: every hook in the `HEAD` version of `index.html` and the mode scripts is still in the working copy, on the same tag. Result: **OK** (234 tokens, 156 tag/class pairs).
- `--rendered --compare`: the editor is driven through 19 UI states, and every rendered element's hooks are compared against a baseline recorded before the redesign. Result: **OK**.

## Regression report

| Gate | Result |
|---|---|
| Unit tests (`tests/unit/*.js`, 33 files) | all pass |
| Browser tests (`node tests/browser/run.js`) | 39 passed, 0 failed, 1 skipped |
| Screens (`node tests/browser/screens.js`): dark and light × LTR and RTL × desktop 1440×900, tablet 834×1112, mobile 390×844 × 4 workspaces | 48 shots, 0 problems (no sideways scroll; the save button is on screen) |
| Accessibility (`node tests/browser/a11y.js`): contrast 4.5:1 (3:1 large), text at least 12px, targets at least 32px, a focus ring on every Tab stop | 0 problems, dark and light, all workspaces |
| Stylesheet pruning | computed styles of the editor before and after: 0 differences |
| Build (`node tools/build_plugin.js`) | 28 files, version 1.4.0 |

Found and fixed along the way:
- `tests/browser/host.html` had a stray backspace character in its `?dir=rtl` check, so RTL never applied in tests.
- On narrow screens the top bar overlapped the brand. It now wraps, and the page context takes its own row.
- 178 accessibility findings: text of 9–11px raised to 12px; the dark `--accent-strong` darkened to #2A64CF (white text was 4.18:1); the rail icons at full opacity; the hint close button and the Theme preview switch at 32px.
- Gallery try-on (`fl-params.js`) now needs real pointer movement. A gallery redrawn under a resting pointer used to preview whichever card landed there, which hid setting changes.

## Gaps

These parts of the visual prototype have no real function behind them, so they were documented, not built:

- application and page names in the top bar (only ids are available);
- a global Save or Apply in the top bar (each workspace keeps its own);
- Style, Layout and Advanced tabs in the inspector, and an Apply style footer;
- range sliders;
- visibility per device;
- an Add component grid;
- "•••" menus, and Preview ↗ in Design and Theme;
- a selection tag on the canvas;
- theme preset cards;
- the Layout regions panel and inspector;
- Library metadata, and apply or delete in the Library;
- toasts;
- Page and Components tabs;
- translated strings;
- search in "On this page".

Also not done:
- The Layout board is forced left to right in RTL, because its drag and column maths assume LTR.
- The Layout panels were not wrapped in `.vd-pane`.
- The same action has two names: the gallery button and the Library's empty state say "Save as theme style", while Design items and the user guide say **Save as preset**.

## Rulings

- **Stylesheet:** instead of rewriting `editor.css` in the planned D1–D10 order, the four stacked token layers were merged into one `:root` block and 406 rules for classes nothing produces any more were removed. The computed-style diff showed no change, and this carries less risk than a reorder. If wrong: the file is less tidy than planned, but behaves the same.
- **Legacy aliases:** the plan said none would be kept. `--vd-*` and `--navy*` aliases remain, because rules and the paper scope still read them. If wrong: a few extra tokens, no visual effect.
- **Text size:** every text below 12px was raised to 12px, rather than redesigning the small labels. If wrong: some eyebrows and sub-labels are slightly larger than in the prototype; the screen checks show no overflow.
- **Try-on:** the gallery fix changes product behaviour, not the test, because the stale preview was a real user-facing bug.
