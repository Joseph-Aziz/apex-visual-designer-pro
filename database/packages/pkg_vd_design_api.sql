-- APEX Visual Designer - PKG_VD_DESIGN_API (target application check)
-- Installed by database/install.sql into the schema &&VD_SCHEMA.

CREATE OR REPLACE
--
-- The Flutter Designer (PKG_VD_PAGE_CODE and the page 19 processes) only works
-- on applications registered as active targets in VD_TARGET_APPLICATIONS for the
-- current APEX workspace. The old design repository API that used to live in
-- this package was removed with the old designer screens on 2026-11-11.
-- =============================================================================

SET SERVEROUTPUT ON
SET DEFINE OFF

CREATE OR REPLACE PACKAGE &&VD_SCHEMA..PKG_VD_DESIGN_API AUTHID DEFINER AS
  -- Raises ORA-20215 unless p_app_id is an active target of the current workspace.
  PROCEDURE assert_target_app(p_app_id IN NUMBER);
END PKG_VD_DESIGN_API;
/

CREATE OR REPLACE PACKAGE BODY &&VD_SCHEMA..PKG_VD_DESIGN_API AS

  FUNCTION current_workspace RETURN NUMBER IS
    l_workspace NUMBER;
  BEGIN
    l_workspace := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
    IF l_workspace IS NULL OR l_workspace <= 0 THEN
      RAISE_APPLICATION_ERROR(
        -20200,
        'An authenticated APEX workspace is required for repository access.');
    END IF;
    RETURN l_workspace;
  END current_workspace;

  PROCEDURE assert_target_app(p_app_id IN NUMBER) IS
    l_workspace NUMBER := current_workspace;
    l_count     PLS_INTEGER;
  BEGIN
    SELECT COUNT(*)
      INTO l_count
      FROM &&VD_SCHEMA..VD_TARGET_APPLICATIONS t
     WHERE t.WORKSPACE_ID = l_workspace
       AND t.APP_ID = p_app_id
       AND t.IS_ACTIVE = 'Y';
    IF p_app_id IS NULL OR l_count = 0 THEN
      RAISE_APPLICATION_ERROR(-20215, 'Application is not a registered active target.');
    END IF;
  END assert_target_app;

END PKG_VD_DESIGN_API;
/
