# Install

## Quick start

1. **Import the plug-in.** Download `plugin/region_type_plugin_apex_visual_designer.sql` from this repository. In App Builder, open the application that will host the designer, go to Shared Components > Plug-ins > Import, and import the file.
2. **Allow page edits.** In the same application, go to Shared Components > Security Attributes > Runtime API Usage and tick **Modify This Application**.
3. **Add the region.** Create a page (a blank page is enough) and add a region of type **APEX Visual Designer**. Run the page.

On that first page view, the plug-in creates its tables and packages in the application's parsing schema, registers the application, and shows the designer. This takes a few seconds, once. No extra schema and no SQL scripts are needed.

**Requirements:**
- Oracle APEX 26.2 and Oracle Database 19c or later.
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

- **Re-imports sign users out.** Saving a page design, setting a Static ID or class, and pushing a theme all re-import the changed page (page 0 for themes). That ends the signed-in sessions of that application, and users must log in again.
- **What a pushed theme adds.** A static file `vd-theme.css` (plus `vd-theme.js` when a style needs it), and a region with static id `vd-theme-link` on page 0. Nothing else on page 0 changes.
- **Objects the plug-in creates** in the parsing schema:
  - the tables `VD_INSTALL`, `VD_TARGET_APPLICATIONS`, `VD_PAGE_CODE_VERSIONS` and `VD_THEME_VERSIONS`;
  - the sequence `VD_SEQ_TARGET` and its trigger;
  - the packages `PKG_VD_DESIGN_API`, `PKG_VD_PAGE_CODE`, `PKG_VD_THEME`, `PKG_VD_PAGE_WRITER` and `PKG_VD_PLUGIN`.

## Upgrade

Import the new plug-in export over the old one. The next view of a page with the designer region updates the packages. Tables, saved versions and registered applications are kept.

## Uninstall

1. Delete the Visual Designer region and the plug-in from the host application.
2. Connected as the parsing schema, run `database/uninstall.sql` with that schema's name. This deletes all saved versions.

Designed applications keep working, because their CSS and JS live in their own pages and files.

## Advanced: separate designer schema

Use this when the designer's tables and packages must not live in the application's parsing schema. It needs a DBA, and SQLcl or SQL*Plus, because the scripts take arguments and include each other.

**Names used below:**
- `VD_DESIGNER` is the schema for the designer's objects. Any name works.
- `MY_APP_SCHEMA` is the host application's parsing schema.
- `100` is an application to design.

1. **Create the designer schema (DBA):**

   ```sql
   CREATE USER VD_DESIGNER IDENTIFIED BY "<password>" DEFAULT TABLESPACE USERS QUOTA 200M ON USERS;
   GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO VD_DESIGNER;
   ```

   Assign the schema to your APEX workspace (APEX administration > Manage Workspaces > Manage Workspace to Schema Assignments), so that `register_target.sql` can run in the workspace's SQL Workshop.

2. **Install the objects.** Connected as `VD_DESIGNER`, run:

   ```
   cd database
   @install.sql VD_DESIGNER MY_APP_SCHEMA
   ```

   Re-running is safe: tables are created only when missing, and packages are replaced.

3. **Point the host schema at them.** Connected as `MY_APP_SCHEMA`, run:

   ```
   @host_setup.sql VD_DESIGNER
   ```

   This creates the synonym `PKG_VD_PLUGIN`. When the plug-in finds it, it installs nothing in the host schema and uses the designer schema instead.

4. **Import the plug-in and add the region**, as in the quick start.

5. **Register the applications to design.** Run this in the workspace's SQL Workshop, or in SQLcl as `VD_DESIGNER` with the workspace set:

   ```
   @register_target.sql VD_DESIGNER 100
   ```

**Upgrade:** run `install.sql` again with the same arguments, then import the new plug-in export.

**Uninstall:**
1. Delete the region and the plug-in.
2. As `MY_APP_SCHEMA`, run `DROP SYNONYM PKG_VD_PLUGIN;`.
3. As `VD_DESIGNER`, run `@uninstall.sql VD_DESIGNER`.
