-- APEX Visual Designer - PKG_VD_THEME
-- Installed by database/install.sql into the schema that runs it.

CREATE OR REPLACE PACKAGE PKG_VD_THEME AUTHID DEFINER AS
  -- Adds a version (p_note DRAFT, PUSHED or RESTORED) and returns its id.
  -- Raises -20240 when p_theme is not a JSON object.
  FUNCTION add_version(p_app IN NUMBER, p_theme IN CLOB, p_css IN CLOB, p_js IN CLOB,
                       p_note IN VARCHAR2) RETURN NUMBER;

  -- Latest version of the app (p_pushed_only 'Y': latest PUSHED or RESTORED one).
  -- All outs are NULL when there is none.
  PROCEDURE get_latest(p_app IN NUMBER, p_pushed_only IN VARCHAR2, p_version_id OUT NUMBER,
                       p_theme OUT CLOB, p_css OUT CLOB, p_js OUT CLOB, p_note OUT VARCHAR2);

  -- A PUSHED or RESTORED version of this app; raises -20242 for any other id.
  PROCEDURE get_pushed(p_app IN NUMBER, p_version_id IN NUMBER,
                       p_theme OUT CLOB, p_css OUT CLOB, p_js OUT CLOB);

  -- Rows: VERSION_ID, NOTE, SAVED_BY, SAVED_AT (newest first).
  FUNCTION list_versions(p_app IN NUMBER) RETURN SYS_REFCURSOR;
END PKG_VD_THEME;
/

CREATE OR REPLACE PACKAGE BODY PKG_VD_THEME AS
  FUNCTION workspace RETURN NUMBER IS
  BEGIN
    RETURN APEX_APPLICATION.GET_SECURITY_GROUP_ID;
  END workspace;

  FUNCTION actor RETURN VARCHAR2 IS
  BEGIN
    RETURN COALESCE(SYS_CONTEXT('APEX$SESSION', 'APP_USER'), SYS_CONTEXT('USERENV', 'SESSION_USER'));
  END actor;

  FUNCTION add_version(p_app IN NUMBER, p_theme IN CLOB, p_css IN CLOB, p_js IN CLOB,
                       p_note IN VARCHAR2) RETURN NUMBER IS
    l_id NUMBER;
    l_ok NUMBER;
    l_ws NUMBER := workspace;
    l_by VARCHAR2(128) := actor;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT COUNT(*) INTO l_ok FROM DUAL WHERE p_theme IS JSON AND LTRIM(DBMS_LOB.SUBSTR(p_theme, 20, 1)) LIKE '{%';
    IF p_theme IS NULL OR l_ok = 0 THEN
      RAISE_APPLICATION_ERROR(-20240, 'The theme is not valid. Reload the Theme Designer and try again.');
    END IF;
    INSERT INTO VD_THEME_VERSIONS (WORKSPACE_ID, APP_ID, THEME_JSON, CSS, JS, NOTE, SAVED_BY)
    VALUES (l_ws, p_app, p_theme, p_css, p_js, p_note, l_by)
    RETURNING VERSION_ID INTO l_id;
    RETURN l_id;
  END add_version;

  PROCEDURE get_latest(p_app IN NUMBER, p_pushed_only IN VARCHAR2, p_version_id OUT NUMBER,
                       p_theme OUT CLOB, p_css OUT CLOB, p_js OUT CLOB, p_note OUT VARCHAR2) IS
    l_ws NUMBER := workspace;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT VERSION_ID, THEME_JSON, CSS, JS, NOTE
      INTO p_version_id, p_theme, p_css, p_js, p_note
      FROM VD_THEME_VERSIONS
     WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app
       AND (p_pushed_only = 'N' OR NOTE IN ('PUSHED', 'RESTORED'))
     ORDER BY VERSION_ID DESC
     FETCH FIRST 1 ROW ONLY;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN NULL;
  END get_latest;

  PROCEDURE get_pushed(p_app IN NUMBER, p_version_id IN NUMBER,
                       p_theme OUT CLOB, p_css OUT CLOB, p_js OUT CLOB) IS
    l_ws NUMBER := workspace;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT THEME_JSON, CSS, JS INTO p_theme, p_css, p_js
      FROM VD_THEME_VERSIONS
     WHERE VERSION_ID = p_version_id AND WORKSPACE_ID = l_ws AND APP_ID = p_app
       AND NOTE IN ('PUSHED', 'RESTORED');
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20242, 'That theme version was not found for this application.');
  END get_pushed;

  FUNCTION list_versions(p_app IN NUMBER) RETURN SYS_REFCURSOR IS
    l_cur SYS_REFCURSOR;
    l_ws NUMBER := workspace;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    OPEN l_cur FOR
      SELECT VERSION_ID, NOTE, SAVED_BY, SAVED_AT
        FROM VD_THEME_VERSIONS
       WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app
       ORDER BY VERSION_ID DESC;
    RETURN l_cur;
  END list_versions;
END PKG_VD_THEME;
/
