# Roadmap

Last updated: 2026-11-14.

## Done

- **1.0.0 (2026-11-11):** native APEX region plug-in with the Flutter Designer and the Theme Designer.
- **1.1.0 (2026-11-12):** one-step install (the plug-in installs its own objects on first use) and Add application.
- **1.2.0 (2026-11-12):** Layout Board for regions and items on the 12-column grid.
- **1.3.0 (2026-11-14):** shared page bar, Chart Designer (Oracle JET and Apache ECharts), Dashboard looks, a theme style per component, and the fix that puts a page back when a write fails.

## Next

- Finish the 1.3.0 clean install checklist (`tests/INSTALL_CHECKLIST.md`). Not yet run: C4 (old chart looks converted), U1 (uninstall and reinstall), D5 (the database suites that write a scratch page and page 0), and M1 to M6 (Layout Board on tabs, dialogs, hidden items, conflicts and undo).
- Run the designer once on APEX 26.1. The docs claim 26.1 or later, but only 26.2 has been tested.

## Later

Each item has an open question to settle before it is planned.

- **Sign-out on every save:** a page re-import ends the application's sessions. Can a page import keep sessions, or can saves be batched per page so this happens less often?
- **Roles and registration screens:** the Designer authorization attribute and Add application may already cover this. Decide whether to drop it from the plan.
- **Public release path:** the original plan named a separate public repository. Decide whether this repository becomes public or a release export is copied there.
- **Drag on the live preview:** use the preview as a shortcut into the Layout Board. Is dragging inside the preview frame reliable enough?
- **Dark mode and responsive preview:** parked in the Layout Board design. Which comes first, and does the theme push need to change for dark mode?
