# Clean install checklist

## Quick start (1.1.0)

Follow the quick start in `docs/INSTALL.md` in an application whose parsing schema has no designer objects. Record each result.

Last run: 2026-11-12, APEX 26.2, an existing host application.

| # | Check | Result |
| --- | --- | --- |
| Q1 | Import the export; plug-in at 1.1.0 with 13 files | PASS (blocks loaded through SQL Commands) |
| Q2 | First page view installs: `tests/db/bootstrap_tests.sql` | PASS 6/6 |
| Q3 | The designer lists the page's components | PASS |
| Q4 | Add application: own app accepted; an id outside the workspace refused with -20231 | PASS |
| Q5 | Re-import with the installed version marked old: the next view reinstalls and keeps registrations | PASS |
| Q6 | Saving with Runtime API Usage off shows the "Allow page edits" message | Not run (needs the owner to change the setting) |
| Q7 | Import through App Builder's Import wizard, then add the region | PASS (after the header fix: the wizard needs plain values in import_begin) |

## Separate designer schema (1.0.x)

Follow `docs/INSTALL.md` exactly in a workspace that has never had the designer, using a new
designer schema and a new host application. Record each result.

## Last run: 2026-11-11, APEX 26.2

- **Designer schema:** `VD_TEST`, new and empty.
- **Host app:** a new blank application (parsing schema shared with the workspace's other apps).
- **Design target:** a second application in the same workspace, scratch page 9990.

| # | Check | Result |
| --- | --- | --- |
| 1 | `install.sql` into the new schema; all objects valid | PASS |
| 2 | `install.sql` a second time: no errors | PASS |
| 3 | `host_setup.sql` creates `VD_DESIGNER_API` | PASS |
| 4 | `register_target.sql` for both apps; registering again keeps one row | PASS |
| 5 | `tests/db/plugin_api_tests.sql` | PASS 4/4 |
| 6 | `tests/db/page_code_tests.sql` on the target's scratch page | PASS 40/40 |
| 7 | `tests/db/theme_tests.sql` on the host app | PASS 20/20 |
| 8 | Import the plug-in; 12 files and 3 attributes | PASS |
| 9 | The region renders the designer from the plug-in files | PASS (after the fixes below) |
| 10 | The designer opens the other app's page and lists its components | PASS |
| 11 | A Flutter save from the host app lands in the other app's page | PASS once Runtime API Usage allows it |
| 12 | Theme push from the screen into the host app: one `vd-theme-link` on page 0 | PASS |
| 13 | Designer authorization set to an unknown scheme: the region refuses | PASS (after the fix below) |
| 14 | Two designer regions on one page, each using its own AJAX identifier | PASS |
| 15 | `uninstall.sql` empties the schema; designed apps keep their CSS and theme file | PASS |
| 16 | `install.sql` after uninstall; register again | PASS |

## Fixes the run found

- The plug-in API version had to be 2 for the procedure-style callbacks. The package also offers the function-style callbacks.
- APEX 26.2 keeps region settings in the attributes object. Reading `attribute_NN` ignored the Designer authorization.
- The host application needs Runtime API Usage set to "Modify This Application" and "Modify Other Applications" (now in INSTALL.md).
- Re-importing only the plug-in definition in REPLACE mode drops its files. Always import the whole export.

## Not covered by this run

- (1.1.0 run covered the Import wizard.)
- A designer schema named other than `VD_TEST`/`VD_DESIGNER` on a second database.
