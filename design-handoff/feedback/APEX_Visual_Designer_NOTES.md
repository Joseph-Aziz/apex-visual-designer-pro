# APEX Visual Designer — UX refinement notes

## Files included

- `1-design-items.html`
- `2-theme-designer.html`
- `3-layout.html`
- `4-theme-styles.html`
- `editor.css`
- `NOTES.md`
- `VALIDATION.json`

## What changed

### Shared application shell
- Added a keyboard-accessible **Skip to workspace** link.
- Added a stable `#main-workspace` target and `tabindex="-1"` to the main landmark.
- Added `aria-current="page"` to the active navigation control.
- Added accessible labels to the four workspace sections and the Design Items / Theme Designer side panes.

### Design Items
- Kept the component browser, page preview, and style gallery as distinct work areas.
- Moved the less-frequently used **History** action into a native **More** disclosure menu.
- The `fl-history` button itself remains a `<button>` and retains its original class and title. It remains inside the original toolbar group.

### Visual system
- Refined panel hierarchy, toolbar grouping, spacing, borders, typography, status labels, and empty-state presentation.
- Strengthened keyboard focus indicators and minimum interactive target sizing.
- Added narrow-screen layouts for the workspace panels and toolbars.
- Used logical CSS properties for directional layout and added RTL-specific refinements.
- Kept all styles local; no external fonts, images, stylesheets, or CDN dependencies were introduced.

## Hook and control preservation

The updated HTML was compared with the supplied `apex-visual-designer-ux-restructured.zip` baseline.

- All original `class`, `id`, `data-*`, and `aria-*` hook attributes were retained.
- All original `<button>`, `<input>`, `<select>`, and `<textarea>` elements remain present with their original element kinds.
- No original IDs were duplicated.
- No original action was removed.
- New attributes and wrappers are additive.

## Developer integration notes

1. The `fl-history` button is now nested inside `<details class="vd-more vd-more--history">`, but it remains inside `.vd-toolbar-group--tools`. Check for JavaScript selectors that require `.fl-history` to be a *direct child* of that group; delegated selectors and class-based selectors continue to find it.
2. The four HTML files are static design references. They do not contain the application's runtime JavaScript. The actual plug-in must be tested to confirm event binding, generated gallery/list rendering, drag-and-drop, save/publish/apply flows, and the `vd-ask` confirmation dialog.
3. The page preview iframe content was not redesigned. Only the editor's surrounding frame is styled.
4. Contrast figures in `VALIDATION.json` are representative palette-pair checks, not a complete automated audit of every generated state or every user-supplied preview.

## Validation performed

- HTML parsed and inspected with BeautifulSoup.
- Original hook attributes and control counts compared against the supplied baseline.
- Duplicate IDs checked.
- CSS parsed with `tinycss2`, including declaration blocks.
- Logical-direction property scan completed.
- External CSS/font URL scan completed.

A headless Chromium screenshot attempt was not successful in this environment, so browser rendering and interaction testing remain a developer QA step.
