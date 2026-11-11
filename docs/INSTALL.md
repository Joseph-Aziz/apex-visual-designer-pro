# Install

**Requirements:**
- Oracle APEX 26.2.
- Oracle Database 19c or later.
- SQLcl or SQL*Plus for the database scripts. The scripts take arguments and include each other, which APEX SQL Commands cannot run.

**Names used below:**

- `VD_DESIGNER` is the schema that will hold the designer's tables and packages. Any name works.
- `MY_APP_SCHEMA` is the parsing schema of the application that will host the designer.
- `100` is an application you want to design. It must be in the same workspace as the host app.

## 1. Create the designer schema (DBA)

```sql
CREATE USER VD_DESIGNER IDENTIFIED BY "<password>" DEFAULT TABLESPACE USERS QUOTA 200M ON USERS;
GRANT CREATE SESSION, CREATE TABLE, CREATE SEQUENCE, CREATE PROCEDURE, CREATE TRIGGER TO VD_DESIGNER;
```

Assign the schema to your APEX workspace, so that `register_target.sql` can run in the workspace's SQL Workshop. In APEX administration, go to Manage Workspaces > Manage Workspace to Schema Assignments.

## 2. Install the database objects

Connected as `VD_DESIGNER`, run:

```
cd database
@install.sql VD_DESIGNER MY_APP_SCHEMA
```

Re-running is safe. Tables are created only when missing, and packages are replaced.

## 3. Give the host schema its synonym

Connected as `MY_APP_SCHEMA`, run:

```
@host_setup.sql VD_DESIGNER
```

This creates the synonym `VD_DESIGNER_API`, the only name the plug-in uses.

## 4. Import the plug-in

In App Builder, open the host application, go to Shared Components > Plug-ins > Import, and import `plugin/region_type_plugin_apex_visual_designer.sql`.

## 5. Add the designer to a page

Create a page (a blank page is enough). Add a region of type **APEX Visual Designer**, then set its attributes:

| Attribute | Meaning |
| --- | --- |
| Designer authorization | The name of an authorization scheme that admits designers. Empty means only developers signed in to App Builder. |
| Default target application | The application id the designer opens. Empty means the host application. |
| Height (px) | The designer's height. Default 800. |

Protect the page itself with the same authorization scheme. The server checks the attribute on every call either way.

## 6. Register the applications to design

Run this in the workspace's SQL Workshop, or in SQLcl connected as `VD_DESIGNER` with the workspace set:

```
@register_target.sql VD_DESIGNER 100
```

The designers refuse any application that is not registered.

## Good to know

- **Re-imports sign users out.** Saving a page design, setting a Static ID or class, and pushing a theme all re-import the changed page (page 0 for themes). That ends the signed-in sessions of that application, and users must log in again.
- **What a pushed theme adds.** A static file `vd-theme.css` (plus `vd-theme.js` when a style needs it), and a region with static id `vd-theme-link` on page 0. Nothing else on page 0 changes.

## Upgrade

Run `install.sql` again with the same arguments, then import the new plug-in export over the old one. Saved versions are kept.

## Uninstall

1. Delete the Visual Designer region and the plug-in from the host application.
2. As `MY_APP_SCHEMA`, run `DROP SYNONYM VD_DESIGNER_API;`.
3. As `VD_DESIGNER`, run `@uninstall.sql VD_DESIGNER`. This deletes all saved versions.

Designed applications keep working, because their CSS and JS live in their own pages and files.
