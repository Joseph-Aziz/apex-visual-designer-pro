# Security

## Who can use the designer

Every server call goes through the plug-in's AJAX function. Before doing anything, it runs two checks:

1. **Access.** The region's *Designer authorization* scheme must admit the current user.
   - When the attribute is empty, only a developer signed in to App Builder in the same browser is allowed.
   - A scheme name that does not exist in the host application refuses everyone.
2. **Target.** The application being designed must be registered and active for the current workspace in `VD_TARGET_APPLICATIONS` (see `register_target.sql`).

The browser cannot widen either check, because the region attributes are read on the server.

## What the designer can change in a target application

- A page's *Inline CSS* and *Execute when Page Loads* JavaScript, only between the markers `/* vd-flutter:start */` and `/* vd-flutter:end */`.
- A region's or button's Static ID, and the `vd-<type>-<name>` class of a region, button or item.
- The static files `vd-theme.css` and `vd-theme.js`, and the page 0 region with static id `vd-theme-link`.

The designer never writes into the page it runs on.

## What the authorization scheme grants

A user the *Designer authorization* scheme admits can write JavaScript that runs for every user of every registered target application: page JavaScript, and `vd-theme.js`, which page 0 loads on every page. Give the scheme only to people you would trust as developers of those applications. Register only the applications they should change.

## Privileges

- The tables and packages live in the host application's parsing schema, and run with that schema's rights. No grants or synonyms are created. Code the plug-in installs comes only from the plug-in's own file `install/vd-install.sql`, which only someone who can import plug-ins into the application can change. That person can therefore run any DDL or DML as the parsing schema at the next page view. Install errors show their Oracle detail only to developers signed in to App Builder.
- `PKG_VD_PLUGIN` and `PKG_VD_PAGE_WRITER` use invoker rights. APEX metadata reads and page writes run with the host schema's own rights, inside the current APEX workspace.
- The workspace and user always come from the APEX session, never from the request.
- Anyone who can run code as the host schema (for example in SQL Workshop) can call the packages directly. This skips the Designer authorization check; only the workspace and registration checks remain. Treat that schema, and every application that parses as it, as trusted. If several applications share the parsing schema, consider a separate parsing schema for the host application.

## Input handling

- **Design values** are whitelisted per kind (colours, sizes, options).
- **Extra CSS** is the only free-form value. It accepts declarations only, and refuses:
  - braces, angle brackets and `@`;
  - comments;
  - `url(`, `expression(`, `javascript:` and `import`.
- **Names are checked:**
  - Static IDs must match `^[A-Za-z][A-Za-z0-9_-]{0,59}$` and be unique on the page.
  - Style class names must match `^[a-z][a-z0-9-]{0,30}$`.
- **Page exports:** values written into page exports are quoted as PL/SQL literals.
- **Generated CSS** is scoped to one component id (page designs) or to type and class selectors (themes). Every declaration is `!important`.

## External requests

When a design uses a Google font, the generated JavaScript loads it from `fonts.googleapis.com`. Choose the system font to avoid any external request.
