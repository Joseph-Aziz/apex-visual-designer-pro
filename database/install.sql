-- =============================================================================
-- APEX Visual Designer - database install
--
-- Run connected as the designer schema owner (or a DBA), for example in SQLcl:
--   @install.sql VD_DESIGNER MY_APP_SCHEMA
--   1st argument  VD_SCHEMA    the schema that will hold the designer objects
--   2nd argument  HOST_SCHEMA  the parsing schema of the application that hosts the
--                              Visual Designer region
-- In APEX SQL Workshop, set the two DEFINE values below instead of passing arguments.
-- Re-runnable: tables are created only when missing, packages are replaced.
-- Then run host_setup.sql connected as HOST_SCHEMA.
-- =============================================================================
SET SERVEROUTPUT ON
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
DEFINE HOST_SCHEMA = '&2'

PROMPT Installing APEX Visual Designer into &&VD_SCHEMA for host schema &&HOST_SCHEMA

@@tables/vd_target_applications.sql
@@tables/vd_page_code_versions.sql
@@tables/vd_theme_versions.sql
@@packages/pkg_vd_design_api.sql
@@packages/pkg_vd_page_code.sql
@@packages/pkg_vd_theme.sql
@@packages/pkg_vd_page_writer.sql
@@packages/pkg_vd_plugin.sql

-- The plug-in runs with the host schema's rights, so the host schema needs every package.
BEGIN
  FOR p IN (SELECT column_value name FROM TABLE(sys.odcivarchar2list(
              'PKG_VD_DESIGN_API', 'PKG_VD_PAGE_CODE', 'PKG_VD_THEME', 'PKG_VD_PAGE_WRITER', 'PKG_VD_PLUGIN'))) LOOP
    EXECUTE IMMEDIATE 'GRANT EXECUTE ON ' || DBMS_ASSERT.ENQUOTE_NAME(UPPER('&&VD_SCHEMA')) || '.' || p.name ||
      ' TO ' || DBMS_ASSERT.ENQUOTE_NAME(UPPER('&&HOST_SCHEMA'));
  END LOOP;
  DBMS_OUTPUT.PUT_LINE('Granted the designer packages to &&HOST_SCHEMA.');
END;
/

PROMPT Done. Next: run host_setup.sql as &&HOST_SCHEMA, then register_target.sql for each application to design.
