-- APEX Visual Designer - PKG_VD_DESIGN_API (target application check)
-- Installed by database/install.sql into the schema that runs it.

-- The designers only work on applications registered as active targets in
-- VD_TARGET_APPLICATIONS for the current APEX workspace.

CREATE OR REPLACE PACKAGE PKG_VD_DESIGN_API AUTHID DEFINER AS
  -- Raises ORA-20215 unless p_app_id is an active target of the current workspace.
  PROCEDURE assert_target_app(p_app_id IN NUMBER);
  -- Registers p_app_id (an application of the current workspace) as an active target, or
  -- re-activates it. Raises ORA-20231 for an application outside the current workspace.
  PROCEDURE register_app(p_app_id IN NUMBER);
END PKG_VD_DESIGN_API;
/

CREATE OR REPLACE PACKAGE BODY PKG_VD_DESIGN_API AS

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
      FROM VD_TARGET_APPLICATIONS t
     WHERE t.WORKSPACE_ID = l_workspace
       AND t.APP_ID = p_app_id
       AND t.IS_ACTIVE = 'Y';
    IF p_app_id IS NULL OR l_count = 0 THEN
      RAISE_APPLICATION_ERROR(-20215, 'Application is not a registered active target.');
    END IF;
  END assert_target_app;

  PROCEDURE register_app(p_app_id IN NUMBER) IS
    l_workspace NUMBER := current_workspace;
    l_owner     VARCHAR2(128);
    l_name      VARCHAR2(255);
    l_alias     VARCHAR2(255);
  BEGIN
    BEGIN
      SELECT OWNER, APPLICATION_NAME, ALIAS INTO l_owner, l_name, l_alias
        FROM APEX_APPLICATIONS
       WHERE APPLICATION_ID = p_app_id AND WORKSPACE_ID = l_workspace;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20231, 'Application ' || p_app_id || ' is not in this workspace.');
    END;
    MERGE INTO VD_TARGET_APPLICATIONS t
    USING (SELECT l_workspace ws, p_app_id app FROM DUAL) s
       ON (t.WORKSPACE_ID = s.ws AND t.APP_ID = s.app)
     WHEN MATCHED THEN UPDATE SET IS_ACTIVE = 'Y', PARSING_SCHEMA = l_owner, TARGET_NAME = l_name, APP_ALIAS = l_alias
     WHEN NOT MATCHED THEN INSERT (WORKSPACE_ID, APP_ID, APP_ALIAS, PARSING_SCHEMA, TARGET_NAME)
          VALUES (s.ws, s.app, l_alias, l_owner, l_name);
  END register_app;

END PKG_VD_DESIGN_API;
/
