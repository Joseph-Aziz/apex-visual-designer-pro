# APEX Visual Designer plug-in

A native Oracle APEX region plug-in (APEX 26.1 or later) that adds APEX Creative Studio, a Material 3
style visual designer, to any application. Add the region to a page, open any page of the application (or of
another application in the same workspace), and work in four workspaces:

- **Design:** pick a design for each region, item, button, report and chart, tune its colours, shape and spacing
  in a live preview, and save. The generated CSS and JavaScript go into that page, with undo, a version history
  and an automatic page backup.
- **Theme:** set one look for the whole application and push it as a single theme file.
- **Layout:** move a page's regions and items on the 12-column grid and apply the new layout in one step, with undo.
- **Library:** keep favourite designs as named presets and reuse them on every page.

- Install: import the plug-in, add the region, done. Details: [docs/INSTALL.md](docs/INSTALL.md)
- Using it: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- Security: [docs/SECURITY.md](docs/SECURITY.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)

Requires Oracle APEX 26.1 or later (tested on 26.2). License: MIT.

Rebuild the plug-in export after changing `plugin/files`: `node tools/build_plugin.js`.
Tests: `node tests/unit/<name>_test.js` for each file in `tests/unit`; the SQL suites in
`tests/db` run in an APEX SQL Workshop session (see each file's header).
`node tools/db_test_block.js tests/db/<file>.sql <schema> <app> <page>` prints the file as blocks for SQL Commands.
