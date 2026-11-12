-- PKG_VD_PLUGIN and register_target checks.
-- Parameters: @plugin_api_tests.sql VD_SCHEMA TEST_APP
-- Run as the host schema in an APEX SQL Workshop session after install.sql and host_setup.sql (or after the plug-in installed itself).
SET DEFINE ON
SET VERIFY OFF
SET SERVEROUTPUT ON
DEFINE VD_SCHEMA = '&1'
DEFINE TEST_APP = '&2'
DECLARE
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  l_builder BOOLEAN := COALESCE(v('APP_BUILDER_SESSION'), TO_CHAR(apex_application.g_edit_cookie_session_id)) IS NOT NULL;
  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
BEGIN
  -- empty scheme = App Builder developers only (a SQL Workshop session may or may not count)
  ok('empty scheme follows the builder session rule', PKG_VD_PLUGIN.allowed(NULL) = l_builder);
  ok('unknown scheme is refused', NOT PKG_VD_PLUGIN.allowed('No such scheme ' || SYS_GUID()));
  -- the host schema reaches registration only through the package, never the table
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(&&TEST_APP);
    ok('test app is a registered target', TRUE);
  EXCEPTION WHEN OTHERS THEN ok('test app is a registered target (' || SQLERRM || ')', FALSE);
  END;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(-1);
    ok('unregistered app refused (no error raised)', FALSE);
  EXCEPTION WHEN OTHERS THEN ok('unregistered app refused', SQLCODE = -20215);
  END;
  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
