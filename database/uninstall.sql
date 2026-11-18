-- APEX Visual Designer - uninstall
-- Run connected as the designer schema owner:
--   @uninstall.sql VD_DESIGNER
-- Drops the designer packages, tables and sequence, including all saved versions. Target
-- applications keep what was saved into them (page CSS and JS, vd-theme.css, the page 0 link).
-- Drop the synonym PKG_VD_PLUGIN in the host schema and the plug-in in the app yourself.
SET DEFINE ON
SET VERIFY OFF
SET SERVEROUTPUT ON
DEFINE VD_SCHEMA = '&1'
DECLARE
  PROCEDURE x(p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
    DBMS_OUTPUT.PUT_LINE('dropped: ' || p_sql);
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLCODE IN (-942, -4043, -2289) THEN NULL; ELSE RAISE; END IF;
  END;
BEGIN
  FOR p IN (SELECT column_value n FROM TABLE(sys.odcivarchar2list(
              'PKG_VD_PLUGIN', 'PKG_VD_PAGE_WRITER', 'PKG_VD_THEME', 'PKG_VD_PAGE_CODE', 'PKG_VD_DESIGN_API'))) LOOP
    x('DROP PACKAGE &&VD_SCHEMA..' || p.n);
  END LOOP;
  FOR t IN (SELECT column_value n FROM TABLE(sys.odcivarchar2list(
              'VD_PAGE_BACKUPS', 'VD_LAYOUT_VERSIONS', 'VD_THEME_VERSIONS', 'VD_PAGE_CODE_VERSIONS', 'VD_TARGET_APPLICATIONS', 'VD_INSTALL'))) LOOP
    x('DROP TABLE &&VD_SCHEMA..' || t.n || ' PURGE');
  END LOOP;
  x('DROP SEQUENCE &&VD_SCHEMA..VD_SEQ_TARGET');
END;
/
