-- APEX Visual Designer - register an application the designers may edit
-- Run connected as the designer schema owner, inside the APEX workspace of the application
-- (for example in that workspace's SQL Workshop):
--   @register_target.sql VD_DESIGNER 100
-- Re-runnable: registering again re-activates the application.
SET DEFINE ON
SET VERIFY OFF
SET SERVEROUTPUT ON
DEFINE VD_SCHEMA = '&1'
DEFINE TARGET_APP = '&2'
DECLARE
  l_ws     NUMBER;
  l_owner  VARCHAR2(128);
  l_name   VARCHAR2(255);
  l_alias  VARCHAR2(255);
BEGIN
  SELECT WORKSPACE_ID, OWNER, APPLICATION_NAME, ALIAS INTO l_ws, l_owner, l_name, l_alias
    FROM APEX_APPLICATIONS WHERE APPLICATION_ID = TO_NUMBER('&&TARGET_APP');
  MERGE INTO &&VD_SCHEMA..VD_TARGET_APPLICATIONS t
  USING (SELECT l_ws ws, TO_NUMBER('&&TARGET_APP') app FROM DUAL) s
     ON (t.WORKSPACE_ID = s.ws AND t.APP_ID = s.app)
   WHEN MATCHED THEN UPDATE SET IS_ACTIVE = 'Y', PARSING_SCHEMA = l_owner, TARGET_NAME = l_name, APP_ALIAS = l_alias
   WHEN NOT MATCHED THEN INSERT (WORKSPACE_ID, APP_ID, APP_ALIAS, PARSING_SCHEMA, TARGET_NAME)
        VALUES (s.ws, s.app, l_alias, l_owner, l_name);
  COMMIT;
  DBMS_OUTPUT.PUT_LINE('Registered application &&TARGET_APP (' || l_name || ', schema ' || l_owner || ').');
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE_APPLICATION_ERROR(-20215, 'Application &&TARGET_APP is not visible in this workspace.');
END;
/
