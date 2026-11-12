# One-step install: design

## Why

Today the designer needs a DBA-created schema, grants, a synonym in the host schema, and a
registration script before the plug-in works. The owner wants someone to download the plug-in
export from GitHub, import it into their application, and start designing, with no security or
schema changes beyond what any page-editing tool needs.

## Goals

- Importing `plugin/region_type_plugin_apex_visual_designer.sql` and adding the region is the
  whole install for designing the host application.
- The plug-in creates its tables and packages in the host application's parsing schema on first
  use, and upgrades them when a newer plug-in version is imported.
- The host application registers itself automatically.
- The one remaining setting, Runtime API Usage "Modify This Application", is explained by the
  region itself when it is off, with the menu path, instead of the raw APEX error.

## Non-goals

- No change to the editor (Flutter and Theme modes) or what saving does.
- No automatic setup for designing *other* applications. That still needs "Modify Other
  Applications", Workspace Sharing and same-origin framing, and a registration (see below).

## Anti-goals

- The first page view must not half-install: a failure leaves either nothing or a working set,
  and the region shows what went wrong.
- No second page view may pay the install cost again.

## Approaches considered

1. **Self-install on first use (chosen).** The plug-in carries the DDL and runs it in the parsing
   schema. Works with the normal App Builder import.
2. **DDL inside the export script.** App Builder's import may reject non-APEX statements and the
   executing schema is unclear. Fragile across APEX versions.
3. **Starter app with Supporting Objects.** Reliable, but it is an app, not a plug-in someone
   adds to their own app.

The separate-schema install stays as an advanced option for people who want the designer's
objects apart from their data.

## Design

- **Object names are unqualified.** The build turns `&&VD_SCHEMA..` references into plain names,
  so the same package source compiles in any schema. The separate-schema path keeps working
  through `install.sql`, which compiles the same files into `VD_DESIGNER` with a synonym, as today.
- **Install payload.** `tools/build_plugin.js` concatenates the table and package scripts, in
  `install.sql` order, into a plug-in file `install/vd-install.sql`, split into statements the
  bootstrap can run one by one.
- **Bootstrap.** The plug-in's own PL/SQL source (in the export) defines the render and AJAX
  callbacks. They check a version marker (a one-row table `VD_INSTALL` holding the installed
  plug-in version). When it is missing or older than the plug-in, they read `vd-install.sql`
  from `APEX_APPL_PLUGIN_FILES`, run each statement with `EXECUTE IMMEDIATE`, register the host
  app in `VD_TARGET_APPLICATIONS`, and write the marker. They then call `PKG_VD_PLUGIN` through
  dynamic PL/SQL, because the package does not exist when the plug-in source is first compiled.
- **Concurrency.** The install runs under `DBMS_LOCK` (or a `SELECT ... FOR UPDATE` on the
  marker), and re-checks the marker after taking the lock.
- **Errors.** If a statement fails, the region shows the statement number and the Oracle error,
  for example a missing CREATE TABLE privilege. Table scripts are already re-runnable and
  packages are `CREATE OR REPLACE`, so a retry after the fix continues safely.
- **Runtime API Usage check.** Before a save, the package checks the host app's runtime API
  setting. When it is off, the designer shows: "Allow page edits: Shared Components > Security
  Attributes > Runtime API Usage > Modify This Application."
- **Other applications.** A small "Add application" action in the designer registers another
  app of the same workspace, for users the authorization scheme admits. `register_target.sql`
  remains for scripted setups.
- **Docs.** `INSTALL.md` leads with the three-step quick start (import, tick the setting, add the
  region). The current procedure moves to an "Advanced: separate designer schema" section.
  `SECURITY.md` explains that in quick-start mode the designer's objects live in the app schema.

## Left to the builder

- Whether dynamic PL/SQL can bind the `apex_plugin` callback records directly. If not, the
  bootstrap passes the region id and attributes as scalars to a thin entry point in
  `PKG_VD_PLUGIN`. A short spike settles this first.
- How the build splits statements (a marker line between them is enough).

## Owner's test after implementation

The owner removes the current setup (designer schema objects, synonym, region, plug-in) from
their test environment, imports the plug-in export from GitHub into a fresh app, and follows
`INSTALL.md` from the top.
