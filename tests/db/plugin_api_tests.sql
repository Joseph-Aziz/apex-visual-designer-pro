-- PKG_VD_PLUGIN and register_target checks.
-- Parameters: @plugin_api_tests.sql VD_SCHEMA TEST_APP
-- Run as the host schema in an APEX SQL Workshop session after install.sql and host_setup.sql.
SET DEFINE ON
SET VERIFY OFF
SET SERVEROUTPUT ON
DEFINE VD_SCHEMA = '&1'
DEFINE TEST_APP = '&2'
DECLARE
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  l_n    NUMBER;
  l_builder BOOLEAN := COALESCE(v('APP_BUILDER_SESSION'), TO_CHAR(apex_application.g_edit_cookie_session_id)) IS NOT NULL;
  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
BEGIN
  -- empty scheme = App Builder developers only (a SQL Workshop session may or may not count)
  ok('empty scheme follows the builder session rule', VD_DESIGNER_API.allowed(NULL) = l_builder);
  ok('unknown scheme is refused', NOT VD_DESIGNER_API.allowed('No such scheme ' || SYS_GUID()));
  SELECT COUNT(*) INTO l_n FROM &&VD_SCHEMA..VD_TARGET_APPLICATIONS
   WHERE APP_ID = &&TEST_APP AND WORKSPACE_ID = APEX_APPLICATION.GET_SECURITY_GROUP_ID AND IS_ACTIVE = 'Y';
  ok('test app registered once', l_n = 1);
  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
