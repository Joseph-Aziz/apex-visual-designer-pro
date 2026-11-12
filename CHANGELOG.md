# Changelog

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
