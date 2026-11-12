-- Checks what the plug-in bootstrap leaves behind after its first page view.
-- Parameters: @bootstrap_tests.sql HOST_APP VERSION
-- Run as the parsing schema of the host application, after a page with the designer region
-- was opened once (quick-start install; no separate designer schema).
SET DEFINE ON
SET VERIFY OFF
SET SERVEROUTPUT ON
DEFINE HOST_APP = '&1'
DEFINE VD_VERSION = '&2'
DECLARE
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  l_n    NUMBER;
  l_v    VARCHAR2(20);
  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
BEGIN
  EXECUTE IMMEDIATE 'SELECT MAX(VERSION) FROM VD_INSTALL' INTO l_v;
  ok('VD_INSTALL records version &&VD_VERSION', l_v = '&&VD_VERSION');
  SELECT COUNT(*) INTO l_n FROM USER_TABLES
   WHERE TABLE_NAME IN ('VD_INSTALL', 'VD_TARGET_APPLICATIONS', 'VD_PAGE_CODE_VERSIONS', 'VD_THEME_VERSIONS');
  ok('all four tables exist', l_n = 4);
  SELECT COUNT(*) INTO l_n FROM USER_OBJECTS
   WHERE OBJECT_TYPE IN ('PACKAGE', 'PACKAGE BODY') AND STATUS = 'VALID'
     AND OBJECT_NAME IN ('PKG_VD_DESIGN_API', 'PKG_VD_PAGE_CODE', 'PKG_VD_THEME', 'PKG_VD_PAGE_WRITER', 'PKG_VD_PLUGIN');
  ok('all five packages are valid, spec and body', l_n = 10);
  SELECT COUNT(*) INTO l_n FROM USER_SYNONYMS WHERE SYNONYM_NAME = 'PKG_VD_PLUGIN';
  ok('no PKG_VD_PLUGIN synonym (quick-start install)', l_n = 0);
  BEGIN
    EXECUTE IMMEDIATE 'BEGIN PKG_VD_DESIGN_API.assert_target_app(:a); END;' USING &&HOST_APP;
    ok('host application is registered', TRUE);
  EXCEPTION WHEN OTHERS THEN ok('host application is registered (' || SQLERRM || ')', FALSE);
  END;
  BEGIN
    EXECUTE IMMEDIATE 'BEGIN PKG_VD_DESIGN_API.register_app(:a); END;' USING -1;
    ok('register_app refuses an application outside the workspace (no error raised)', FALSE);
  EXCEPTION WHEN OTHERS THEN ok('register_app refuses an application outside the workspace', SQLCODE = -20231);
  END;
  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
