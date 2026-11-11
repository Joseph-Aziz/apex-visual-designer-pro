-- APEX Visual Designer - host schema setup
-- Run connected as the parsing schema of the application that hosts the Visual Designer region:
--   @host_setup.sql VD_DESIGNER
-- The plug-in calls the designer only through this synonym, so its code never names a schema.
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
CREATE OR REPLACE SYNONYM VD_DESIGNER_API FOR &&VD_SCHEMA..PKG_VD_PLUGIN;
PROMPT Synonym VD_DESIGNER_API created.
