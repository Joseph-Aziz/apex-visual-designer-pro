# Shared Page Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Open a page once in a shared bar, then design its items or its layout.

**Architecture:** A new `page-bar.js` holds the open page (app, page) in browser storage and draws
the bar. `app.js` owns the bar and tells the current view to open the page. Each page view exposes
`open(app, page)` and syncs to the shared page on `enter()`.

**Tech Stack:** Plain browser JavaScript, Node `vm` unit tests.

**Spec:** docs/superpowers/specs/2026-11-14-shared-page-bar-design.md

## Global Constraints
- No environment names or hardcoded app/page numbers in repo files.
- The SQL export comes from `node tools/build_plugin.js` only.

## Review Focus
- Empty or non-numeric App/Page input shows "Enter an app and page number." and opens nothing.
- Page 0 is a valid page.
- Browser storage that throws or holds bad JSON falls back to no page.

---

### Task 1: page-bar.js

**Files:** Create `plugin/files/js/page-bar.js`; Test `tests/unit/page_bar_test.js`.

**Interfaces:** Produces `VD.pageBar.parse(appText, pageText) -> {app, page} | {error}`,
`VD.pageBar.current() -> {app, page} | null`, `VD.pageBar.remember(app, page)`,
`VD.pageBar.render(el, opts)` with `opts.onOpen(app, page)` and `opts.onAddApp(app)`.

- [ ] Write test: parse('102','0') = {app:102,page:0}; parse('','5'), parse('102',''), parse('x','1') give error;
      remember/current round-trips; current() is null when storage throws or holds bad JSON.
- [ ] Run `node tests/unit/page_bar_test.js`, expect failure (file missing).
- [ ] Implement; run again, expect pass.

### Task 2: shell and views

**Files:** Modify `app.js`, `flutter-mode.js`, `layout-mode.js`, `index.html`, `css/editor.css`.

- [ ] `app.js`: render the bar into `#page-bar`, hide it on the theme view; on open, remember the page
      and call the current view's `open`; on add application, `VD.flutterMode.addApp`.
- [ ] Both views: drop their App/Page/Open/Add controls, add `open(app, page)` (discard confirm, then
      attach) and sync to `VD.pageBar.current()` in `enter()`.
- [ ] Flutter view: add `leave(onLeave)`: save, discard or stay; `save(then)` runs `then` after saving.
- [ ] Rail labels: "Design items", "Layout".
- [ ] Run all unit tests and `node tools/build_plugin.js`.
