# Install

## Quick start

1. **Import the plug-in.** Download `plugin/region_type_plugin_apex_visual_designer.sql` from this repository. In App Builder, open the application that will host the designer, go to Shared Components > Plug-ins > Import, and import the file.
2. **Allow page edits.** In the same application, go to Shared Components > Security Attributes > Runtime API Usage and tick **Modify This Application**.
3. **Allow the live preview.** Under Shared Components > Security Attributes > Browser Security, set **Embed in Frames** to **Allow from same origin**. The designer shows the page in a frame; without this, the preview stays blank.
4. **Add the region.** Create a page (a blank page is enough) and add a region of type **APEX Visual Designer**. Run the page.

On that first page view, the plug-in creates its tables and packages in the application's parsing schema, registers the application, and shows the designer. This takes a few seconds, once. No extra schema and no SQL scripts are needed.

**Requirements:**
- Oracle APEX 26.1 or later (tested on 26.2), and Oracle Database 19c or later. Earlier APEX releases are not supported: the page writer uses the export and import format of 26.1 and later.
- The parsing schema of the host application holds CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE and CREATE TRIGGER. Schemas that APEX creates for a workspace have them.

If the install fails, a developer who opens the page from App Builder sees which install step failed and the Oracle error; other users see a short notice. Fix the cause (usually a missing privilege) and reload the page: the install runs again.

### Region attributes

| Attribute | Meaning |
| --- | --- |
| Designer authorization | The name of an authorization scheme that admits designers. Empty means only developers signed in to App Builder. |
| Default target application | The application id the designer opens. Empty means the host application. |
| Height (px) | The designer's height. Default 800. |

Protect the page itself with the same authorization scheme. The server checks the attribute on every call either way.

If saving fails with "Allow page edits: Shared Components > Security Attributes > Runtime API Usage > Modify This Application.", step 2 is missing. If the preview stays blank, step 3 is missing.

## Designing other applications

1. In the Flutter Designer, type the application id in **App** and click **Add application**. Only applications of the same workspace are accepted.
2. In the host application, also tick **Modify Other Applications** under Runtime API Usage.
3. For the live preview of the other application's pages, both applications need Session Sharing set to Workspace Sharing in their current authentication scheme (Shared Components > Authentication Schemes). The designed application also needs Security Attributes > Browser Security > Embed in Frames set to "Allow from same origin". Without these settings, the component list still works but the preview stays blank.

## Good to know

- **Re-imports sign users out.** Saving a page design, setting a Static ID or class, applying or undoing a layout, and pushing a theme all re-import the changed page (page 0 for themes). That ends the signed-in sessions of that application, and users must log in again.
- **The Layout Board.** It moves a page's regions and items between slots and regions and changes their order and column span. Nothing changes until Apply, which writes all the changes in one page re-import. Undo apply puts back the layout before the last Apply; the plug-in keeps the last 10 per page. Apply is refused when someone changed the page after the board loaded it: open the page again.
- **What a pushed theme adds.** A static file `vd-theme.css` (plus `vd-theme.js` when a style needs it), and a region with static id `vd-theme-link` on page 0. Nothing else on page 0 changes.
- **Objects the plug-in creates** in the parsing schema:
  - the tables `VD_INSTALL`, `VD_TARGET_APPLICATIONS`, `VD_PAGE_CODE_VERSIONS`, `VD_THEME_VERSIONS`, `VD_LAYOUT_VERSIONS` and `VD_PAGE_BACKUPS`;
  - the sequence `VD_SEQ_TARGET` and its trigger;
  - the packages `PKG_VD_DESIGN_API`, `PKG_VD_PAGE_CODE`, `PKG_VD_THEME`, `PKG_VD_PAGE_WRITER` and `PKG_VD_PLUGIN`.

## Upgrade

Import the new plug-in export over the old one. The next view of a page with the designer region updates the packages. Tables, saved versions and registered applications are kept.

## Separate designer schema (optional)

By default the plug-in installs its objects into the host application's parsing schema. To keep them in a schema of their own instead, run the scripts in `database/` before the first page view:

1. `install.sql <designer schema> <parsing schema>`, connected as the designer schema's owner. It creates the tables and packages and grants the parsing schema execute on `PKG_VD_PLUGIN`.
2. `host_setup.sql <designer schema>`, connected as the parsing schema. It creates the synonym `PKG_VD_PLUGIN`. When the plug-in finds that synonym, it installs nothing of its own.
3. `register_target.sql <designer schema> <application id>` for each application to design, or use **Add application** in the designer.

Upgrades then mean running `install.sql` again with the new scripts; the plug-in does not update a separate schema.

## Uninstall

1. Delete the Visual Designer region and the plug-in from the host application.
2. Connected as the schema that holds the objects (the parsing schema, or the separate designer schema), run `database/uninstall.sql` with that schema's name. This deletes all saved versions. With a separate schema, also drop the synonym `PKG_VD_PLUGIN` in the parsing schema.

Designed applications keep working, because their CSS and JS live in their own pages and files.
