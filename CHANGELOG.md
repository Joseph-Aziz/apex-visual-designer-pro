# Changelog

## 1.3.0 - 2026-11-14

- **Shared page bar:** open a page once (App, Page, Add application, Open page) above the views, then choose **Design items** or **Layout** in the rail. The open page is remembered after a reload. The Theme Designer hides the bar, because it works on the whole application.
- **Leaving with unsaved changes:** Design items now asks to save, discard or stay, as Layout already did.
- **Chart Designer:** a native chart region opens a designer of its own. Pick the engine, Oracle JET or Apache ECharts (shipped with the plug-in, no CDN), then style each part: chart, series, points, axes, labels, legend, tooltip and reference lines, with Basic and Advanced settings, undo and redo, and templates such as Monthly sales and Statistics. ECharts adds gauge, waterfall and heatmap. Older chart looks are converted to Chart Designer settings when the page is opened.
- **Dashboard looks:** a seventh look, **Dashboard**, for Region, Cards, Button, Radio group, Checkbox group and Date field, matching a hand-built statistics page (white cards, 16px corners, soft shadow, Cairo font).
- **Theme style on a component:** Design items can put one of the pushed theme's named styles on the selected component.
- **Page 0:** Design items accepts page 0, as the page bar and Layout already did.
- **Fix:** when a page write fails after the import step, the page is put back as it was. A page is never lost.
- **Fix:** the CSS class list is quoted when written into the page.

## 1.2.0 - 2026-11-12

- **Layout Board:** rearrange the open page's regions and items on APEX's 12-column grid: drag between slots and regions, start or join a row, set the column span. **Apply** writes every change in one page re-import, **Revert** discards unapplied changes, and **Undo apply** restores the layout from before the last apply (the last 10 per page are kept). Apply is refused when the page changed in App Builder since the board loaded it.

## 1.1.0 - 2026-11-12

- **One-step install:**
  - Import the plug-in and add the region; nothing else is needed.
  - On the first page view, the plug-in creates its tables and packages in the application's parsing schema and registers the application. A newer plug-in version updates them on the next view.
  - The install guide covers only this one-step install. The separate designer schema setup is no longer documented.
- **Add application:** the Flutter Designer can register another application of the workspace.
- **Clearer error:** when Runtime API Usage blocks a save, the designer names the setting to change.

## 1.0.2 - 2026-11-11

- **Preview of other applications:** when the host application and the designed application share one session (Session Sharing set to Workspace Sharing in both authentication schemes), the live preview opens the other application's page in that session.

## 1.0.1 - 2026-11-11

- **Fix:** opening a page of another application in the designer no longer ends the host application session. The live preview now passes the session id only for the host application's own pages.
- **Install:** `install.sql` skips the grants when the host schema is the designer schema.

## 1.0.0 - 2026-11-11

This is the first release as a native APEX region plug-in.

- **Flutter Designer:** six Material 3 designs for every supported region, item and button type. Each design has Basic, Icon, Show / hide and Advanced settings. Designs are saved into the page, with history and restore.
- **Theme Designer:**
  - app-wide default and named styles;
  - gallery and page preview;
  - push to the application through one static file and a page 0 link region;
  - history, restore and download.
- **Database scripts:** install, host setup, target registration and uninstall, with a configurable schema name.

Before 1.0.0, the designer ran as page 19 of a single pilot application. That setup is not part of this repository.
