# Shared page bar (short design)

## Why
The Flutter Designer and the Layout Board each have their own App, Page and Open page
controls. The user types the page twice, and the two views can sit on different pages.
The user wants to open a page once and then choose what to do with it: design its items
or change its layout.

## Design
- One page bar above the views, owned by the shell: App, Page, Add application, Open page.
- The rail names the two page views by task: "Design items" (Flutter Designer) and
  "Layout" (Layout Board). Route names in the URL stay `flutter` and `layout`.
- Open page loads the page into the current view. A view that is entered later loads the
  shared page when its own page differs.
- The Theme Designer works on the application, so the page bar is hidden there.
- Switching views with unsaved changes asks first. The Layout Board already asks
  (apply, discard or stay); the Flutter Designer gets the same: save, discard or stay.
  This keeps one view from saving over a page the other view still has old changes for.
- Opening another page with unsaved changes asks to discard them, as each view does today.
- The open page is kept in browser storage and comes back after a reload.
- Each view keeps only its own actions (Undo, Redo, Use page, History, Save to page;
  Revert, Undo apply, Apply, Preview).

## Approaches
- Shared bar in the shell (chosen): one place to open a page, views follow it.
- Keep both pickers and sync them: rejected, two pickers can still disagree.

## Left to the builder
Markup and styling of the bar, following the existing `.lk-top` look.
