-- APEX Visual Designer: plug-in bootstrap (the plug-in's own PL/SQL code).
-- On first use, and after a newer plug-in version is imported, it runs the plug-in file
-- install/vd-install.sql in the application's parsing schema. Then it hands every render and
-- AJAX call to PKG_VD_PLUGIN. The package is called dynamically, because it does not exist yet
-- when this code is compiled for the first time.
-- A synonym PKG_VD_PLUGIN in the parsing schema means the designer lives in a separate schema
-- (database/install.sql); then nothing is installed here.
c_vd_version CONSTANT VARCHAR2(20) := '#VD_VERSION#';
c_vd_mark    CONSTANT VARCHAR2(20) := '--@@VD_STMT@@';

FUNCTION vd_installed_version RETURN VARCHAR2 IS
  l_v VARCHAR2(20);
BEGIN
  EXECUTE IMMEDIATE 'SELECT VERSION FROM VD_INSTALL WHERE ID = 1' INTO l_v;
  RETURN l_v;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END vd_installed_version;

-- Runs the install script. NULL on success, otherwise what failed.
FUNCTION vd_run_script(p_plugin IN apex_plugin.t_plugin) RETURN VARCHAR2 IS
  l_blob BLOB;
  l_text CLOB;
  l_dest INTEGER := 1;
  l_src  INTEGER := 1;
  l_ctx  INTEGER := DBMS_LOB.DEFAULT_LANG_CTX;
  l_warn INTEGER;
  l_pos  INTEGER := 1;
  l_next INTEGER;
  l_stmt CLOB;
  l_n    PLS_INTEGER := 0;
BEGIN
  SELECT FILE_CONTENT INTO l_blob
    FROM APEX_APPL_PLUGIN_FILES
   WHERE APPLICATION_ID = apex_application.g_flow_id
     AND PLUGIN_NAME = p_plugin.name
     AND FILE_NAME = 'install/vd-install.sql';
  DBMS_LOB.CREATETEMPORARY(l_text, TRUE);
  DBMS_LOB.CONVERTTOCLOB(l_text, l_blob, DBMS_LOB.LOBMAXSIZE, l_dest, l_src,
                         NLS_CHARSET_ID('AL32UTF8'), l_ctx, l_warn);
  LOOP
    l_next := DBMS_LOB.INSTR(l_text, CHR(10) || c_vd_mark || CHR(10), l_pos);
    EXIT WHEN l_next = 0;
    l_stmt := TRIM(DBMS_LOB.SUBSTR(l_text, l_next - l_pos, l_pos));
    l_pos := l_next + LENGTH(c_vd_mark) + 2;
    IF l_stmt IS NOT NULL THEN
      l_n := l_n + 1;
      BEGIN
        EXECUTE IMMEDIATE l_stmt;
      EXCEPTION
        WHEN OTHERS THEN
          RETURN 'Install step ' || l_n || ' failed: ' || SQLERRM;
      END;
    END IF;
  END LOOP;
  IF l_n = 0 THEN
    RETURN 'Install script install/vd-install.sql is empty.';
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN 'Plug-in file install/vd-install.sql is missing. Import the whole plug-in export again.';
END vd_run_script;

-- Makes sure this schema has the objects of this plug-in version. NULL when ready, otherwise a
-- message for the region. Only one session installs; the others wait for it, up to a minute.
FUNCTION vd_ensure(p_plugin IN apex_plugin.t_plugin) RETURN VARCHAR2 IS
  l_n    PLS_INTEGER;
  l_msg  VARCHAR2(4000);
  l_mine BOOLEAN := FALSE;
BEGIN
  SELECT COUNT(*) INTO l_n FROM USER_SYNONYMS WHERE SYNONYM_NAME = 'PKG_VD_PLUGIN';
  IF l_n > 0 OR vd_installed_version = c_vd_version THEN
    RETURN NULL;
  END IF;
  -- The marker table comes first, so sessions can claim the install through its one row.
  -- DDL commits, which would release a table lock, so the claim is the row's VERSION value.
  EXECUTE IMMEDIATE q'[
    DECLARE l_n NUMBER;
    BEGIN
      SELECT COUNT(*) INTO l_n FROM USER_TABLES WHERE TABLE_NAME = 'VD_INSTALL';
      IF l_n = 0 THEN
        EXECUTE IMMEDIATE 'CREATE TABLE VD_INSTALL (ID NUMBER(1) DEFAULT 1 NOT NULL, VERSION VARCHAR2(20) NOT NULL,
          INSTALLED_AT TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL,
          CONSTRAINT VD_INSTALL_PK PRIMARY KEY (ID), CONSTRAINT VD_INSTALL_ONE_CK CHECK (ID = 1))';
      END IF;
    END;]';
  FOR i IN 1 .. 60 LOOP
    BEGIN
      EXECUTE IMMEDIATE 'INSERT INTO VD_INSTALL (ID, VERSION) VALUES (1, ''INSTALLING'')';
      l_mine := TRUE;
    EXCEPTION
      WHEN DUP_VAL_ON_INDEX THEN
        -- Claim an older version, or an install that stopped more than five minutes ago.
        EXECUTE IMMEDIATE q'[UPDATE VD_INSTALL SET VERSION = 'INSTALLING', INSTALLED_AT = SYSTIMESTAMP
          WHERE ID = 1 AND VERSION <> :v
            AND (VERSION <> 'INSTALLING' OR INSTALLED_AT < SYSTIMESTAMP - INTERVAL '5' MINUTE)]' USING c_vd_version;
        l_mine := SQL%ROWCOUNT = 1;
    END;
    COMMIT;
    EXIT WHEN l_mine;
    IF vd_installed_version = c_vd_version THEN
      RETURN NULL;
    END IF;
    DBMS_SESSION.SLEEP(1);
  END LOOP;
  IF NOT l_mine THEN
    RETURN 'The Visual Designer is being installed. Reload the page in a minute.';
  END IF;

  l_msg := vd_run_script(p_plugin);
  IF l_msg IS NULL THEN
    BEGIN
      EXECUTE IMMEDIATE 'BEGIN PKG_VD_DESIGN_API.register_app(:a); END;' USING apex_application.g_flow_id;
    EXCEPTION
      WHEN OTHERS THEN l_msg := 'Registering this application failed: ' || SQLERRM;
    END;
  END IF;
  -- On failure, release the claim so the next page view tries again.
  EXECUTE IMMEDIATE 'UPDATE VD_INSTALL SET VERSION = :v, INSTALLED_AT = SYSTIMESTAMP WHERE ID = 1'
    USING CASE WHEN l_msg IS NULL THEN c_vd_version ELSE 'FAILED' END;
  COMMIT;
  RETURN l_msg;
END vd_ensure;

-- APEX calls a plug-in's inline PL/SQL code through the function interface, whatever the API
-- version: g_region_render_result := vd_render(p_region, p_plugin, p_is_printer_friendly), and
-- vd_ajax(p_region, p_plugin). PKG_VD_PLUGIN takes the procedure interface; it reads neither
-- p_param nor p_result, so empty records are passed.
FUNCTION vd_render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                   p_is_printer_friendly IN BOOLEAN) RETURN apex_plugin.t_region_render_result IS
  l_msg    VARCHAR2(4000) := vd_ensure(p_plugin);
  l_param  apex_plugin.t_region_render_param;
  l_result apex_plugin.t_region_render_result;
BEGIN
  IF l_msg IS NOT NULL THEN
    sys.htp.p('<p class="vd-denied">' || apex_escape.html(l_msg) || '</p>');
    RETURN l_result;
  END IF;
  EXECUTE IMMEDIATE 'BEGIN PKG_VD_PLUGIN.render(:1, :2, :3, :4); END;'
    USING p_region, p_plugin, l_param, IN OUT l_result;
  RETURN l_result;
END vd_render;

FUNCTION vd_ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin)
  RETURN apex_plugin.t_region_ajax_result IS
  l_msg    VARCHAR2(4000) := vd_ensure(p_plugin);
  l_param  apex_plugin.t_region_ajax_param;
  l_result apex_plugin.t_region_ajax_result;
BEGIN
  IF l_msg IS NOT NULL THEN
    sys.htp.p('{"success":false,"message":"' || apex_escape.json(l_msg) || '"}');
    RETURN l_result;
  END IF;
  EXECUTE IMMEDIATE 'BEGIN PKG_VD_PLUGIN.ajax(:1, :2, :3, :4); END;'
    USING p_region, p_plugin, l_param, IN OUT l_result;
  RETURN l_result;
END vd_ajax;
