# Layout board: design

## Why

Today the designer styles a page's components but cannot move them. To move a region or an item,
the owner goes back to Page Designer in App Builder. The owner wants to rearrange a page inside
the Visual Designer: drag regions and items into rows and columns, set how wide each one is, and
save the result into the real page.

## Goals

- A **Layout** board in the designer shows the open page as boxes on APEX's 12-column grid:
  one box per region, with the region's items inside it, grouped by page slot (Body, Breadcrumb
  Bar, Dialog Footer and the other slots the page template offers).
- The owner can:
  - drag a region to another position, slot or parent region (sub-region);
  - drag an item to another position or another region;
  - put a component on the same row as the one before it, or start a new row;
  - drag a box's right edge to set its column span (1 to 12).
- Changes collect on the board until the owner clicks **Apply**. Apply writes every moved
  component in one page re-import, then reloads the live preview.
- **Revert** discards unapplied changes. **Undo apply** puts back the layout from before the
  last apply (the last 10 applies per page are kept).

## Non-goals

- Buttons, dynamic actions, processes and validations do not move. Buttons stay where they are,
  even when their region moves (they move with their region because they belong to it).
- No creating, deleting or copying components. No changing region templates or item types.
- No dragging on the live preview itself (approach A below). It may come later as a shortcut.
- No dark mode or responsive preview; they are parked.

## Anti-goals

- An apply must never leave the page half-changed: either every moved component is written, or
  nothing is.
- An apply must never overwrite changes made in App Builder since the board was loaded. The
  designer refuses and asks the owner to reload the board.
- An apply must never produce a layout APEX rejects or renders broken. Examples are a row
  wider than 12 columns, a region inside itself or its own sub-region, an item outside every
  region, or a slot the page template does not have.

## Constraints

- APEX 26.2. The write path is the existing one: export the page, edit the component's create
  call, and re-import (`PKG_VD_PAGE_WRITER.edit_call`, `export_page`, `import_page`).
- A re-import ends the sessions of the application's users (already documented).
- The plug-in installs its own objects, so a new table goes into `build_plugin.js`'s INSTALL
  list and `database/install.sql`, and the bootstrap version goes up.
- The same authorization and target-application checks as every other designer call
  (`guard(p_app, p_page)`).
- No environment names in repository files.

## Approaches considered

1. **Layout board next to the preview (chosen by the owner).** Each box maps to exactly one
   component, so every drop gives exact settings. Handles hidden items, sub-regions and slots.
   Cost: you work on boxes, and see the real look only after Apply.
2. **Drag on the live preview.** It shows the real look, but mapping a drop on rendered HTML
   back to grid settings depends on the template, and hidden items and slots cannot be dropped
   on. Left for later.
3. **APEX internal update APIs.** Not supported for this use. Dropped.

## Design

### Reading the layout

A new function `PKG_VD_PAGE_CODE.layout_json(p_app, p_page) RETURN CLOB` returns:

- `token`: the same kind of change token `save_design` uses, computed over the layout
  columns below, so Apply can detect changes made elsewhere.
- `slots`: the page template's display points (name and label).
- `regions`: for each region, its id, title, parent id, slot, sequence, new row, new column,
  column start, column span, and whether it is hidden by a condition or server-side setting
  (shown greyed).
- `items`: for each item, its id, name, label, region id, sequence, new row, new column, column
  start, column span, and item type (hidden items are shown as thin boxes).

The data comes from `APEX_APPLICATION_PAGE_REGIONS` and `APEX_APPLICATION_PAGE_ITEMS`. The exact
column names are confirmed against APEX 26.2 when building; the export arguments that hold
them are, per component, `p_plug_display_sequence`, `p_plug_display_point`,
`p_parent_plug_id`, `p_plug_new_grid_row`, `p_plug_new_grid_column`, `p_plug_grid_column_span`
(and the column start argument), and for items `p_item_sequence`, `p_item_plug_id`,
`p_begin_on_new_line`, `p_begin_on_new_field`, `p_colspan` and the grid column arguments.

### The board (client)

A new mode file `plugin/files/js/layout-mode.js` and its styles in `editor.css`:

- Renders slots top to bottom. Each slot has rows, each row a 12-column CSS grid, and each
  region box holds its own rows of item boxes (and sub-region boxes) the same way.
- Uses HTML5 drag and drop, with the existing `.vd-dropline` style as the drop marker. A drop
  before or after a box keeps that row. A drop on a row gap starts a new row.
- A handle on each box's right edge sets the span. Spans snap to whole columns.
- When a row would exceed 12 columns, the drop is refused and the marker shows red. When the
  span is left at the template default ("automatic"), the box shows that and it is not written.
- Keyboard: a selected box moves with arrow keys, and Shift+arrow changes its span, so the board
  works without a mouse.
- Unapplied changes are highlighted. Leaving the mode with changes asks to apply or discard.

The board keeps the layout as plain data. Each change rewrites the sequence numbers of the
affected container in steps of 10, so only components whose values changed are sent.

### Applying

A new function `PKG_VD_PAGE_WRITER.apply_layout(p_app, p_page, p_token, p_changes CLOB)
RETURN VARCHAR2` (the new token):

1. `guard(p_app, p_page)`.
2. Re-read the layout; if its token differs from `p_token`, raise -20240 "The page changed
   outside the designer. Reload the layout."
3. Validate every change against the current page, so the server never trusts the board. The
   ids must be on the page and the parent must not be the region itself or a descendant. Items
   need a region, slots must exist in the template, spans run 1 to 12, and no row exceeds 12.
   Any failure raises -20241 with the component and reason, and nothing is written.
4. Store the current values of the changed components in `VD_LAYOUT_VERSIONS`, keeping 10 per
   page.
5. Export once, apply `edit_call` per changed component (dropping and re-adding only the
   layout arguments), import once.

`PKG_VD_PAGE_WRITER.undo_layout(p_app, p_page, p_token) RETURN VARCHAR2` applies the newest
stored version the same way and removes it.

The plug-in AJAX dispatcher (`PKG_VD_PLUGIN`) gets the actions `layout`, `apply_layout` and
`undo_layout`, with the same authorization check as the existing actions.

### New table

`VD_LAYOUT_VERSIONS (ID, APPLICATION_ID, PAGE_ID, CHANGES CLOB JSON, CREATED_AT, CREATED_BY)`.
It is created by the install script like the other version tables and dropped by
`uninstall.sql`.

## Testing

- Unit (node): board model operations (move, new row, span, sequence rewrite, row-width
  check, parent-cycle check) and the change list it produces.
- Database (`tests/db/layout_tests.sql`, on a scratch page): read, apply a move, apply a span,
  move an item between regions, move a region into a sub-region position, stale-token refusal,
  each validation refusal leaves the page unchanged, and undo restores the previous values.
- Build test: the new table is in the install script in order.
- Manual: a page with tabs (sub-regions), a modal dialog page (footer slot), and a page with
  hidden items.

## Left to the builder

- The exact dictionary view columns and export argument names for column start and span in
  APEX 26.2. Confirm them against a real export before writing the edit.
- How the board draws region titles that use substitutions.

## Calls made after the builder check

These were settled by the designer, not the owner, and can be changed on review.

- **Failed import.** `import_page` runs the export block by block with no rollback. `apply_layout`
  keeps the original export and, if the edited import fails, imports the original again before
  raising the error. Validation runs before any import, so this path is for APEX errors only.
- **Editing many arguments.** `edit_call` is generalised to drop a list of argument names. An
  argument that APEX left out of the export (a default) is skipped when dropping. "Automatic"
  span or column start is written by leaving the argument out.
- **What the token covers.** The token is the page's last-changed time from
  `APEX_APPLICATION_PAGES`, not only the layout columns, so any App Builder change after the
  board loaded stops Apply. Undo checks the token the same way.
- **What is on the board.** Only regions and page items. Items without a region sit in a
  "No region" strip; they can be moved into a region but nothing moves out to it. Hidden items
  show as thin boxes and can move. An item can go into any region of any slot.
- **Slots without a grid.** Slots whose template ignores the 12-column grid (for example the
  Breadcrumb Bar or Dialog Footer, as the page template reports) show a plain list: order and
  parent only, no rows and no span handles, and no row-width check.
- **Rows and columns.** Board rows map to `p_plug_new_grid_row` / `p_plug_new_grid_column` for
  regions and `p_begin_on_new_line` / `p_begin_on_new_field` for items. A moved component's
  explicit column start is cleared (automatic); an unmoved one keeps it.
- **Undo.** Undo is not itself stored as an apply, so it cannot be undone. Component ids stay
  the same across a re-import, so stored versions keep matching.
- **The owner's own session.** When the designer hosts itself as the target, the re-import ends
  the owner's session too, as saves already do; the board reloads after sign-in.
