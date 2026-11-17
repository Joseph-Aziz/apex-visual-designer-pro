# APEX Visual Designer

## Project overview
- Oracle APEX region plug-in (APEX 26.1+, tested on 26.2). The editor is plain browser JavaScript with no framework or bundler. The database side is PL/SQL. Tools and tests run on Node.
- Key folders:
  - `plugin/files/`: plug-in source (index.html, css/editor.css, js/*.js, lib/echarts). This is the source of truth.
  - `plugin/region_type_plugin_apex_visual_designer.sql`: GENERATED export. Never hand-edit it.
  - `database/`: install.sql, uninstall.sql, host_setup.sql, packages/ (pkg_vd_*), tables/ (vd_*).
  - `tools/`: build_plugin.js, db_test_block.js.
  - `tests/unit/`: *_test.js files and fixtures/ (library_golden.json, variants_v1_v6.json).
  - `tests/browser/`: headless Chromium smoke test (Playwright).
  - `tests/db/`: SQL suites run in APEX SQL Workshop.
  - `design-handoff/`: static copies of the editor screens, overwritten by tests/browser/snapshot.js.
  - `docs/`: INSTALL, USER_GUIDE, SECURITY, ROADMAP, DESIGN.
- Build the plug-in export after any change to plugin/files: `node tools/build_plugin.js`
- Unit tests, one file each: `node tests/unit/<name>_test.js`
- Update the golden fixture after an intentional change: `node tests/unit/library_golden_test.js --update`
- Browser smoke test: `cd tests/browser && npm install && npm test`
- Do not run `tests/browser/snapshot.js` unless asked; it overwrites design-handoff/.
- DB suites: `node tools/db_test_block.js tests/db/<file>.sql <schema> <app> <page>` prints SQL Commands blocks to paste into SQL Workshop.
- Database install: `@database/install.sql VD_DESIGNER MY_APP_SCHEMA` (SQLcl, as the schema owner). The plug-in import is described in docs/INSTALL.md.

## Skills
- Before fixing any bug, use the `superpowers:systematic-debugging` skill.
- Before building a new feature, use `superpowers:brainstorming`, then `superpowers:writing-plans`.
- Before claiming a task is done, use `superpowers:verification-before-completion`.
- For SQL or PL/SQL work, use `data:sql-queries`.
- For editor design or UI work, use `ui-ux-pro-max:ui-ux-pro-max` and `frontend-design`. Don't use other design or UI skills in this project.
