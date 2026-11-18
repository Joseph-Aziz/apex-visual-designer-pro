-- APEX Visual Designer - host schema setup (separate designer schema only)
-- Run connected as the parsing schema of the application that hosts the Visual Designer region:
--   @host_setup.sql VD_DESIGNER
-- The plug-in calls PKG_VD_PLUGIN by its plain name. This synonym points that name at the designer
-- schema, and tells the plug-in not to install its own copy in the host schema.
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
CREATE OR REPLACE SYNONYM PKG_VD_PLUGIN FOR &&VD_SCHEMA..PKG_VD_PLUGIN;
PROMPT Synonym PKG_VD_PLUGIN created.
