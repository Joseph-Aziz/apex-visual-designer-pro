# APEX Visual Designer plug-in — design

Date: 2026-11-11
Status: draft for approval
Builds on: the Flutter Designer and Theme Designer as they run on page 19 of app 144
(branch `feature/flutter-designer`, commit `4905802`).

## Intent

The owner wants a brand-new, clean repository, `apex-visual-designer-plugin`, that holds only
what page 19 does today, the Flutter Designer and the Theme Designer, packaged as one native
APEX plug-in so any APEX developer can install it and use it in their own app.

A developer installs it in three steps:

1. Run one database install script. It creates schema objects for the designer.
2. Import the plug-in into their application.
3. Add a "Visual Designer" region to any page. That page becomes their designer, as page 19 is
   for the owner.

## Decisions taken with the owner

- **Product:** one region plug-in plus database scripts. It is not a separate companion
  application, and there is no runtime plug-in for target apps.
- **Nothing old comes back:** no canvas designer, JSON runtime, publishing or access packages,
  and no old tables. The current repository stays untouched as the archive.
- **New repository:** `apex-visual-designer-plugin`. It starts empty, with no history from the
  old repository.

## Goals

- **The plug-in** is a region type, `APEX Visual Designer`. Its render function draws the
  designer iframe, and its AJAX function serves every designer call.
- **The editor files** (`index.html`, `css/editor.css`, `js/*.js`) are the plug-in's own files,
  served from `#PLUGIN_FILES#`, so nobody uploads static files by hand.
- **The three page 19 processes** (`VD_PAGE_COMPONENTS`, `VD_FLUTTER`, `VD_THEME`) become one
  plug-in AJAX handler, chosen by an `action` value. The editor calls it through
  `apex.server.plugin` with the region's AJAX identifier, instead of
  `apex.server.process`.
- **Plug-in attributes:**
  - *Designer authorization*: the name of an authorization scheme in the host app. Empty means
    App Builder developers only.
  - *Default target application*: optional. Empty means the host app.
  - *Height*: optional.
- **Database:** one `install.sql` and one `uninstall.sql`.
  - The schema name is a substitution variable, default `VD_DESIGNER`. Nothing is hardcoded to
    `HTML_DESIGN`.
  - Grants go to the host app's parsing schema, which is passed as a parameter.
  - It installs today's objects:
    - packages: design API (`assert_target_app`), page code, page writer, theme;
    - tables: `VD_TARGET_APPLICATIONS`, `VD_PAGE_CODE_VERSIONS`, `VD_THEME_VERSIONS`.
- **Target registration:** a script, `register_target.sql <app_id>`. The first designer screen
  also explains how to run it when the target is not registered. A registration UI is v1.1.
- **No environment values in the source:** no workspace id, app id, schema name, user name,
  authorization scheme name or URL. The APEX release string used by the page writer is read
  from `APEX_RELEASE`.
- **Tests:**
  - the existing Node suites;
  - the SQL suites, rewritten to take the test app and scratch page as parameters;
  - a written clean-install checklist for a new workspace.
- **Docs:** README (what it is, quick start), INSTALL, SECURITY, CHANGELOG (1.0.0), LICENSE
  (MIT unless the owner says otherwise).

## Non-goals

- A runtime plug-in or loader for target apps. Designs stay inside each target app's page code
  and theme file, as they are today.
- A separate companion application.
- Registration and role management screens (v1.1).
- Supporting APEX releases before 26.2. The page writer depends on 26.2's export and import
  format.

## Anti-goals

- The current pilot must keep working. Page 19 in app 144 is not changed by this work. The owner
  can switch to the plug-in when ready.
- No behaviour change in the designers: same designs, settings, saves, history, push and
  restore.
- No server action may rely on the browser alone. Every AJAX action checks the authorization
  attribute and target registration on the server.

## Constraints

- APEX 26.2. Plug-in files are served with the plug-in's file prefix, which APEX versions, so
  the Cloudflare build stamp is no longer needed. Check this live.
- The page writer re-imports pages, which still signs users out. Document it.
- Page writes run as the host app's parsing schema (`AUTHID CURRENT_USER`). Writing to another
  application in the same workspace must be checked live, since it was only ever proven on the
  host app itself.

## Approaches considered

- **A. Region plug-in hosting the existing editor in an iframe (picked).** It reuses every
  editor file unchanged, apart from the call layer. Only one function in `js/repository.js`
  changes.
- **B. Region plug-in rendering the editor inline, without an iframe.** The editor's CSS would
  collide with the host page's Universal Theme, and every file would need scoping. That is a
  rewrite for no user benefit.
- **C. Packaged companion application.** The owner chose a plug-in that any app can host.

## Repository layout

```
apex-visual-designer-plugin/
  README.md  CHANGELOG.md  LICENSE
  plugin/
    region_type_plugin_apex_visual_designer.sql   plug-in export (render + AJAX code)
    files/          index.html, css/editor.css, js/*.js  (the plug-in's files)
  database/
    install.sql  uninstall.sql  register_target.sql
    packages/  tables/
  tests/
    unit/   Node tests
    db/     SQL tests
    INSTALL_CHECKLIST.md
  tools/
    build_plugin.js   writes the plug-in export from plugin/files and the PL/SQL sources
  docs/
    INSTALL.md  SECURITY.md  USER_GUIDE.md
```

## Left to the builder

- How `build_plugin.js` embeds the files: base64 blobs in the export, as APEX exports do.
- The exact AJAX payload names. Keep x01 to x08 and `p_clob_01` as today, so the editor changes
  stay minimal.
- Making the GitHub repository needs the owner signed in on github.com in the browser pane.
