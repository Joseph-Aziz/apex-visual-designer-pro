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

## Layout board (1.2.0)

Run in an APEX 26.2 application on a scratch page. Apply and Undo apply re-import the page, which signs out the application's users.

| # | Check | Result |
| --- | --- | --- |
| M1 | A page with tabs (sub-regions): move a tab region, apply; the page renders | Not run |
| M2 | A modal dialog page: reorder the buttons region in the Dialog Footer slot (list mode) | Not run |
| M3 | A page with hidden items: move one, apply | Not run |
| M4 | Change the page in App Builder, then Apply: refused with the reload message (-20230) | Not run |
| M5 | Drag a change, switch to the Flutter Designer: asked to apply or discard | Not run |
| M6 | Undo apply restores the previous layout | Not run |

## Page bar and Chart Designer (1.3.0)

Run after a fresh install (uninstall, delete the plug-in and region, then the quick start again).

Last run: 2026-11-14, APEX 26.2, an existing host application after its designer objects were dropped. The database suites were run as blocks from `tools/db_test_block.js` in SQL Commands. The suites that write the scratch page or page 0 were not run, because no scratch page was confirmed for them.

| # | Check | Result |
| --- | --- | --- |
| D1 | Import 1.3.0 over 1.2.11: plug-in shows 1.3.0; the first view upgrades `VD_INSTALL` to 1.3.0 | PASS |
| D2 | `tests/db/bootstrap_tests.sql` | PASS 6/6 (a first run before the re-import failed the version check, as expected) |
| D3 | `tests/db/plugin_api_tests.sql` | PASS 6/6 |
| D4 | `tests/db/layout_tests.sql`, read block | 4/5: "each item sits in its dictionary region" fails because the page used was the designer's own page, which has no items; the suite needs a page with at least one item in a region |
| D6 | The designer's file URLs carry the release version | FAIL, fixed, then PASS: `PKG_VD_PLUGIN` stamped `index.html?v=1.1.0`, so browsers could keep old files after an upgrade; the stamp now follows the release and a unit test holds it. After re-import (with `VD_INSTALL` marked older so the package reinstalls) the iframe loads `index.html?v=1.3.0` |
| D5 | `tests/db/layout_tests.sql` apply block, `page_code_tests.sql`, `theme_tests.sql` | Not run (they write the scratch page and page 0) |
| P1 | Open page with an empty page number: "Enter an app and page number.", nothing opens | PASS |
| P2 | Open a page in Design items; switch to Layout: the same page is loaded without opening it again | PASS |
| P3 | Theme hides the page bar; Design items and Layout show it | PASS |
| P4 | Reload the browser: the page bar and the view come back on the same page | PASS |
| P5 | Change a design, switch to Layout: asked to save, discard or stay; Save then switches | PASS (a page with a region, an item and a button; OK on the prompt saved the design, then Layout opened) |
| P6 | Page 0 opens in Design items | FAIL, fixed, then PASS: the preview showed APEX's \"cannot be invoked using a URL\" error; page 0 now lists its components and shows a no-preview message in Design items and Layout |
| C1 | A native chart: Open Chart Designer, change a series colour: the live chart updates | PASS (series colour set to red; the live Oracle JET line turned red) |
| C2 | Switch the engine to ECharts: the chart is drawn again; a gauge or heatmap type is offered | PASS (ECharts drew the chart on a canvas; gauge, waterfall and heatmap offered) |
| C3 | Save to page, run the page outside the designer: the chart looks the same, and still refreshes | FAIL, fixed, then PASS: the save first failed with ORA-06502, because it wrote the whole chart runtime (about 57,000 characters) into the page JavaScript and the page import takes at most 32,767. The page now loads the runtime from the plug-in files. After re-import, the page run outside the designer loaded the four chart files, kept the 12px corners and background, and kept them after a region refresh |
| C4 | A page saved with an old chart look (before 1.3.0) opens with its settings converted and "Unsaved changes" | Not run |
| U1 | `uninstall.sql`, delete the plug-in and region, import again: the first view installs, and a page designed before still looks designed | Not run |

## Component Studio (1.4.0)

Run after importing 1.4.0 over 1.3.0, then again after a fresh install.

| # | Check | Result |
| --- | --- | --- |
| S1 | Import 1.4.0 over 1.3.0: plug-in shows 1.4.0; the first view upgrades `VD_INSTALL` to 1.4.0; the iframe loads `index.html?v=1.4.0` | Not run |
| S2 | A page saved by 1.3.0 opens with no "Unsaved changes" and Save writes the same CSS | Not run |
| S3 | A theme pushed by 1.3.0 opens and pushes again with the same CSS | Not run |
| S4 | Gallery: pointing at a card tries it on the preview; leaving puts the design back; clicking keeps it | Not run |
| S5 | Browser: a category, then a member, shows its sample and the page components of that member; a missing member is browse only | Not run |
| S6 | Preview width: Desktop, Tablet and Mobile resize the preview | Not run |
| S7 | State settings: hover, focus, disabled, read-only and error colours show on the run page | Not run |
| S8 | Undo and redo cover design choice, settings, reset and preset copy | Not run |
| S9 | Save as preset: the theme draft gets the style; another page shows it in the gallery; copy applies it | Not run |
| S10 | Push the theme, then link a preset with Theme style: the component gets the class | Not run |
| S11 | Saved designs lists the presets by family | Not run |
| S12 | Export presets, then Import presets into another application: same styles; a clash is renamed | Not run |
| S13 | Import a file with a bad value, an unknown family and an unknown design: each refused by name, nothing added | Not run |
| S14 | Size guard: a page designed past 32,767 characters of CSS or JavaScript is refused and not touched | Not run |
| S15 | Oversized inline CSS on a scratch page (outside the designer): does the import refuse it? Record the answer | Not run |
| K01 | Text Field: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K02 | Textarea: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K03 | Number Field: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K04 | Password: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K05 | Select List: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K06 | Popup LOV: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K07 | Combobox: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K08 | Checkbox: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K09 | Checkbox Group: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K10 | Radio Group: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K11 | Static Content: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| K12 | Standard Region: looks right, value submits, a validation error shows, a Dynamic Action refresh keeps the design | Not run |
| R1 | Theme Designer, Layout Board and Chart Designer: the 1.3.0 rows above pass again | Not run |

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
