-- APEX Visual Designer - PKG_VD_PAGE_CODE
-- Installed by database/install.sql into the schema &&VD_SCHEMA.

CREATE OR REPLACE PACKAGE &&VD_SCHEMA..PKG_VD_PAGE_CODE AUTHID DEFINER AS
  c_start CONSTANT VARCHAR2(30) := '/* vd-flutter:start */';
  c_end   CONSTANT VARCHAR2(30) := '/* vd-flutter:end */';

  -- Places p_block between the markers in p_existing (appends when there are none;
  -- an empty block removes the markers). Raises -20231 when the markers are broken.
  FUNCTION merge_block(p_existing IN CLOB, p_block IN CLOB) RETURN CLOB;

  -- Short token that changes whenever the page's CSS or JS changes.
  FUNCTION code_token(p_css IN CLOB, p_js IN CLOB) RETURN VARCHAR2;

  FUNCTION add_version(p_app IN NUMBER, p_page IN NUMBER, p_css IN CLOB, p_js IN CLOB,
                       p_design IN CLOB, p_note IN VARCHAR2) RETURN NUMBER;

  FUNCTION version_count(p_app IN NUMBER, p_page IN NUMBER) RETURN NUMBER;

  -- Latest version for the page; all outs are NULL when there is none.
  PROCEDURE get_latest(p_app IN NUMBER, p_page IN NUMBER, p_version_id OUT NUMBER,
                       p_css OUT CLOB, p_js OUT CLOB, p_design OUT CLOB);

  -- Raises -20232 unless the version belongs to this workspace, app and page.
  PROCEDURE get_version(p_version_id IN NUMBER, p_app IN NUMBER, p_page IN NUMBER,
                        p_css OUT CLOB, p_js OUT CLOB, p_design OUT CLOB);

  -- Rows: VERSION_ID, NOTE, SAVED_BY, SAVED_AT (newest first).
  FUNCTION list_versions(p_app IN NUMBER, p_page IN NUMBER) RETURN SYS_REFCURSOR;
END PKG_VD_PAGE_CODE;
/

CREATE OR REPLACE PACKAGE BODY &&VD_SCHEMA..PKG_VD_PAGE_CODE AS
  FUNCTION workspace RETURN NUMBER IS
    l_ws NUMBER := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
  BEGIN
    IF l_ws IS NULL OR l_ws <= 0 THEN
      RAISE_APPLICATION_ERROR(-20200, 'An authenticated APEX workspace is required for repository access.');
    END IF;
    RETURN l_ws;
  END workspace;

  FUNCTION actor RETURN VARCHAR2 IS
  BEGIN
    RETURN COALESCE(SYS_CONTEXT('APEX$SESSION', 'APP_USER'), SYS_CONTEXT('USERENV', 'SESSION_USER'));
  END actor;

  FUNCTION occurrences(p_text IN CLOB, p_find IN VARCHAR2) RETURN PLS_INTEGER IS
    l_n PLS_INTEGER := 0;
    l_pos PLS_INTEGER := 1;
  BEGIN
    LOOP
      l_pos := DBMS_LOB.INSTR(p_text, p_find, l_pos);
      EXIT WHEN NVL(l_pos, 0) = 0;
      l_n := l_n + 1;
      l_pos := l_pos + LENGTH(p_find);
    END LOOP;
    RETURN l_n;
  END occurrences;

  FUNCTION rtrim_ws(p_text IN CLOB) RETURN CLOB IS
    l_len PLS_INTEGER := NVL(DBMS_LOB.GETLENGTH(p_text), 0);
  BEGIN
    WHILE l_len > 0 AND DBMS_LOB.SUBSTR(p_text, 1, l_len) IN (' ', CHR(9), CHR(10), CHR(13)) LOOP
      l_len := l_len - 1;
    END LOOP;
    IF l_len = 0 THEN RETURN NULL; END IF;
    RETURN SUBSTR(p_text, 1, l_len);
  END rtrim_ws;

  FUNCTION merge_block(p_existing IN CLOB, p_block IN CLOB) RETURN CLOB IS
    l_text    CLOB := p_existing;
    l_starts  PLS_INTEGER := occurrences(p_existing, c_start);
    l_ends    PLS_INTEGER := occurrences(p_existing, c_end);
    l_a       PLS_INTEGER;
    l_b       PLS_INTEGER;
    l_wrapped CLOB;
    l_block   CLOB := rtrim_ws(p_block);
  BEGIN
    IF l_starts > 1 OR l_ends > 1 THEN
      RAISE_APPLICATION_ERROR(-20231, 'The page code has the designer markers more than once. Fix it in Page Designer first.');
    END IF;
    IF l_starts <> l_ends OR (l_starts = 1 AND DBMS_LOB.INSTR(l_text, c_start) > DBMS_LOB.INSTR(l_text, c_end)) THEN
      RAISE_APPLICATION_ERROR(-20231, 'The page code has a broken designer block (a start or end marker is missing). Fix it in Page Designer first.');
    END IF;
    IF l_block IS NOT NULL THEN
      l_wrapped := c_start || CHR(10) || l_block || CHR(10) || c_end;
    END IF;

    IF l_starts = 0 THEN
      IF l_wrapped IS NULL THEN RETURN l_text; END IF;
      IF rtrim_ws(l_text) IS NULL THEN RETURN l_wrapped; END IF;
      RETURN rtrim_ws(l_text) || CHR(10) || l_wrapped;
    END IF;

    l_a := DBMS_LOB.INSTR(l_text, c_start);
    l_b := DBMS_LOB.INSTR(l_text, c_end) + LENGTH(c_end);
    IF l_wrapped IS NOT NULL THEN
      RETURN SUBSTR(l_text, 1, l_a - 1) || l_wrapped || SUBSTR(l_text, l_b);
    END IF;
    -- Remove the block and the line break that joined it to its neighbours.
    IF l_a > 1 AND DBMS_LOB.SUBSTR(l_text, 1, l_a - 1) = CHR(10) THEN
      l_a := l_a - 1;
    ELSIF DBMS_LOB.SUBSTR(l_text, 1, l_b) = CHR(10) THEN
      l_b := l_b + 1;
    END IF;
    RETURN SUBSTR(l_text, 1, l_a - 1) || SUBSTR(l_text, l_b);
  END merge_block;

  FUNCTION code_token(p_css IN CLOB, p_js IN CLOB) RETURN VARCHAR2 IS
    l_all  CLOB := NVL(p_css, ' ') || CHR(1) || NVL(p_js, ' ');
    l_len  PLS_INTEGER := DBMS_LOB.GETLENGTH(l_all);
    l_hash NUMBER := 0;
    l_pos  PLS_INTEGER := 1;
  BEGIN
    WHILE l_pos <= l_len LOOP
      l_hash := DBMS_UTILITY.GET_HASH_VALUE(TO_CHAR(l_hash) || DBMS_LOB.SUBSTR(l_all, 3900, l_pos), 1, 1073741824);
      l_pos := l_pos + 3900;
    END LOOP;
    RETURN l_len || '-' || l_hash;
  END code_token;

  FUNCTION add_version(p_app IN NUMBER, p_page IN NUMBER, p_css IN CLOB, p_js IN CLOB,
                       p_design IN CLOB, p_note IN VARCHAR2) RETURN NUMBER IS
    l_id    NUMBER;
    l_ws    NUMBER := workspace;
    l_actor VARCHAR2(128) := actor;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(p_app);
    INSERT INTO &&VD_SCHEMA..VD_PAGE_CODE_VERSIONS
      (WORKSPACE_ID, APP_ID, PAGE_ID, INLINE_CSS, JS_ONLOAD, DESIGN_JSON, NOTE, SAVED_BY)
    VALUES (l_ws, p_app, p_page, p_css, p_js, p_design, p_note, l_actor)
    RETURNING VERSION_ID INTO l_id;
    RETURN l_id;
  END add_version;

  FUNCTION version_count(p_app IN NUMBER, p_page IN NUMBER) RETURN NUMBER IS
    l_n  NUMBER;
    l_ws NUMBER := workspace;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT COUNT(*) INTO l_n FROM &&VD_SCHEMA..VD_PAGE_CODE_VERSIONS
     WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page;
    RETURN l_n;
  END version_count;

  PROCEDURE get_latest(p_app IN NUMBER, p_page IN NUMBER, p_version_id OUT NUMBER,
                       p_css OUT CLOB, p_js OUT CLOB, p_design OUT CLOB) IS
    l_ws NUMBER := workspace;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT VERSION_ID, INLINE_CSS, JS_ONLOAD, DESIGN_JSON
      INTO p_version_id, p_css, p_js, p_design
      FROM &&VD_SCHEMA..VD_PAGE_CODE_VERSIONS
     WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
     ORDER BY VERSION_ID DESC
     FETCH FIRST 1 ROW ONLY;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      p_version_id := NULL; p_css := NULL; p_js := NULL; p_design := NULL;
  END get_latest;

  PROCEDURE get_version(p_version_id IN NUMBER, p_app IN NUMBER, p_page IN NUMBER,
                        p_css OUT CLOB, p_js OUT CLOB, p_design OUT CLOB) IS
    l_ws NUMBER := workspace;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT INLINE_CSS, JS_ONLOAD, DESIGN_JSON INTO p_css, p_js, p_design
      FROM &&VD_SCHEMA..VD_PAGE_CODE_VERSIONS
     WHERE VERSION_ID = p_version_id AND WORKSPACE_ID = l_ws
       AND APP_ID = p_app AND PAGE_ID = p_page;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20232, 'Version not found for this page.');
  END get_version;

  FUNCTION list_versions(p_app IN NUMBER, p_page IN NUMBER) RETURN SYS_REFCURSOR IS
    l_cur SYS_REFCURSOR;
    l_ws  NUMBER := workspace;
  BEGIN
    &&VD_SCHEMA..PKG_VD_DESIGN_API.assert_target_app(p_app);
    OPEN l_cur FOR
      SELECT VERSION_ID, NOTE, SAVED_BY, SAVED_AT
        FROM &&VD_SCHEMA..VD_PAGE_CODE_VERSIONS
       WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
       ORDER BY VERSION_ID DESC;
    RETURN l_cur;
  END list_versions;
END PKG_VD_PAGE_CODE;
/
