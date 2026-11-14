-- APEX Visual Designer - PKG_VD_PAGE_CODE
-- Installed by database/install.sql into the schema that runs it.

CREATE OR REPLACE PACKAGE PKG_VD_PAGE_CODE AUTHID DEFINER AS
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
  -- Layout board: page last-changed time as text, used to refuse writes over newer changes.
  FUNCTION layout_token(p_app IN NUMBER, p_page IN NUMBER) RETURN VARCHAR2;
  -- Layout board: {token, slots, regions, items} of one page (ids as text, null span = automatic).
  FUNCTION layout_json(p_app IN NUMBER, p_page IN NUMBER) RETURN CLOB;
END PKG_VD_PAGE_CODE;
/

CREATE OR REPLACE PACKAGE BODY PKG_VD_PAGE_CODE AS
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
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    INSERT INTO VD_PAGE_CODE_VERSIONS
      (WORKSPACE_ID, APP_ID, PAGE_ID, INLINE_CSS, JS_ONLOAD, DESIGN_JSON, NOTE, SAVED_BY)
    VALUES (l_ws, p_app, p_page, p_css, p_js, p_design, p_note, l_actor)
    RETURNING VERSION_ID INTO l_id;
    RETURN l_id;
  END add_version;

  FUNCTION version_count(p_app IN NUMBER, p_page IN NUMBER) RETURN NUMBER IS
    l_n  NUMBER;
    l_ws NUMBER := workspace;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT COUNT(*) INTO l_n FROM VD_PAGE_CODE_VERSIONS
     WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page;
    RETURN l_n;
  END version_count;

  PROCEDURE get_latest(p_app IN NUMBER, p_page IN NUMBER, p_version_id OUT NUMBER,
                       p_css OUT CLOB, p_js OUT CLOB, p_design OUT CLOB) IS
    l_ws NUMBER := workspace;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT VERSION_ID, INLINE_CSS, JS_ONLOAD, DESIGN_JSON
      INTO p_version_id, p_css, p_js, p_design
      FROM VD_PAGE_CODE_VERSIONS
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
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT INLINE_CSS, JS_ONLOAD, DESIGN_JSON INTO p_css, p_js, p_design
      FROM VD_PAGE_CODE_VERSIONS
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
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    OPEN l_cur FOR
      SELECT VERSION_ID, NOTE, SAVED_BY, SAVED_AT
        FROM VD_PAGE_CODE_VERSIONS
       WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
       ORDER BY VERSION_ID DESC;
    RETURN l_cur;
  END list_versions;
  -- The page's regions, items and region buttons as JSON arrays: the rows the layout board shows
  -- and Apply changes. Buttons without a region are page-level and stay off the board.
  PROCEDURE layout_rows(p_app IN NUMBER, p_page IN NUMBER, p_regions OUT CLOB, p_items OUT CLOB,
                        p_buttons OUT CLOB) IS
  BEGIN
    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'id' VALUE TO_CHAR(REGION_ID), 'title' VALUE COALESCE(REGION_NAME, TITLE), 'parent' VALUE TO_CHAR(PARENT_REGION_ID),
             'slot' VALUE DISPLAY_POSITION_CODE, 'seq' VALUE DISPLAY_SEQUENCE,
             'newRow' VALUE CASE WHEN NEW_GRID_ROW = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'newCol' VALUE CASE WHEN NEW_GRID_COLUMN = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'colStart' VALUE GRID_COLUMN, 'span' VALUE GRID_COLUMN_SPAN,
             'hidden' VALUE CASE WHEN CONDITION_TYPE_CODE = 'NEVER' THEN 'true' ELSE 'false' END FORMAT JSON
             NULL ON NULL)
             ORDER BY DISPLAY_SEQUENCE, REGION_ID RETURNING CLOB)
      INTO p_regions
      FROM APEX_APPLICATION_PAGE_REGIONS
     WHERE APPLICATION_ID = p_app AND PAGE_ID = p_page;

    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'id' VALUE TO_CHAR(ITEM_ID), 'name' VALUE ITEM_NAME, 'label' VALUE LABEL,
             'region' VALUE TO_CHAR(REGION_ID), 'seq' VALUE DISPLAY_SEQUENCE,
             'newRow' VALUE CASE WHEN BEGINS_ON_NEW_ROW = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'newCol' VALUE CASE WHEN BEGINS_ON_NEW_CELL = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'colStart' VALUE GRID_COLUMN, 'span' VALUE COLUMN_SPAN, 'type' VALUE DISPLAY_AS_CODE,
             'hidden' VALUE CASE WHEN CONDITION_TYPE_CODE = 'NEVER' THEN 'true' ELSE 'false' END FORMAT JSON
             NULL ON NULL)
             ORDER BY DISPLAY_SEQUENCE, ITEM_ID RETURNING CLOB)
      INTO p_items
      FROM APEX_APPLICATION_PAGE_ITEMS
     WHERE APPLICATION_ID = p_app AND PAGE_ID = p_page;

    SELECT JSON_ARRAYAGG(JSON_OBJECT(
             'id' VALUE TO_CHAR(BUTTON_ID), 'name' VALUE BUTTON_NAME, 'label' VALUE LABEL,
             'region' VALUE TO_CHAR(REGION_ID), 'position' VALUE DISPLAY_POSITION_CODE,
             'seq' VALUE BUTTON_SEQUENCE,
             'newRow' VALUE CASE WHEN NEW_GRID_ROW = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'newCol' VALUE CASE WHEN NEW_GRID_COLUMN = 'No' THEN 'false' ELSE 'true' END FORMAT JSON,
             'colStart' VALUE GRID_COLUMN, 'span' VALUE GRID_COLUMN_SPAN,
             'hidden' VALUE CASE WHEN CONDITION_TYPE_CODE = 'NEVER' THEN 'true' ELSE 'false' END FORMAT JSON
             NULL ON NULL)
             ORDER BY BUTTON_SEQUENCE, BUTTON_ID RETURNING CLOB)
      INTO p_buttons
      FROM APEX_APPLICATION_PAGE_BUTTONS
     WHERE APPLICATION_ID = p_app AND PAGE_ID = p_page AND REGION_ID IS NOT NULL;
  END layout_rows;

  -- A hash of the page's region and item layout. LAST_UPDATED_ON is not used: pages written
  -- through the import API keep it empty, which made every Apply fail as "Page changed".
  FUNCTION layout_token(p_app IN NUMBER, p_page IN NUMBER) RETURN VARCHAR2 IS
    l_n       PLS_INTEGER;
    l_regions CLOB;
    l_items   CLOB;
    l_buttons CLOB;
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGES WHERE APPLICATION_ID = p_app AND PAGE_ID = p_page;
    IF l_n = 0 THEN
      RAISE_APPLICATION_ERROR(-20233, 'Page ' || p_page || ' does not exist in application ' || p_app || '.');
    END IF;
    layout_rows(p_app, p_page, l_regions, l_items, l_buttons);
    RETURN code_token(l_regions, l_items || CHR(1) || l_buttons);
  END layout_token;

  FUNCTION layout_json(p_app IN NUMBER, p_page IN NUMBER) RETURN CLOB IS
    -- Names confirmed on APEX 26.2 by exporting a scratch page:
    --   create_page_plug: p_plug_display_sequence, p_plug_display_point ('SUB_REGIONS' for sub-regions),
    --     p_parent_plug_id, p_plug_new_grid_row, p_plug_new_grid_column, p_plug_display_column,
    --     p_plug_grid_column_span.
    --   create_page_item: p_item_sequence, p_item_plug_id, p_begin_on_new_line, p_begin_on_new_field,
    --     p_grid_column, p_colspan.
    --   APEX_APPLICATION_PAGE_REGIONS: DISPLAY_SEQUENCE, DISPLAY_POSITION_CODE, PARENT_REGION_ID,
    --     NEW_GRID_ROW, NEW_GRID_COLUMN, GRID_COLUMN, GRID_COLUMN_SPAN ('Yes'/'No' flags).
    --   APEX_APPLICATION_PAGE_ITEMS: DISPLAY_SEQUENCE, REGION_ID, BEGINS_ON_NEW_ROW, BEGINS_ON_NEW_CELL,
    --     GRID_COLUMN, COLUMN_SPAN.
    --   Slots: APEX_APPL_TEMP_PAGE_DP.PLACEHOLDER / NAME / HAS_GRID_SUPPORT for the page's template
    --     (the page's own template, else the current theme's default page or dialog template).
    l_token VARCHAR2(100) := layout_token(p_app, p_page);
    l_slots CLOB;
    l_regions CLOB;
    l_items CLOB;
    l_buttons CLOB;
    l_out CLOB;
  BEGIN
    -- Templates are matched by name, preferring the current theme: an app's templates may sit under
    -- another theme number, and one theme may hold two templates of the same name (slots are merged).
    -- Positions used by the page's top regions but missing from the template are listed too, so
    -- every region shows on the board.
    WITH pg AS (
      SELECT COALESCE(p.PAGE_TEMPLATE, CASE p.PAGE_MODE WHEN 'Normal' THEN th.DEFAULT_PAGE_TEMPLATE
               ELSE th.DEFAULT_DIALOG_TEMPLATE END) tname, th.THEME_NUMBER theme
        FROM APEX_APPLICATION_PAGES p
        LEFT JOIN APEX_APPLICATION_THEMES th ON th.APPLICATION_ID = p.APPLICATION_ID AND th.IS_CURRENT = 'Yes'
       WHERE p.APPLICATION_ID = p_app AND p.PAGE_ID = p_page),
    tpl AS (
      SELECT t.TEMPLATE_ID, DENSE_RANK() OVER (ORDER BY CASE WHEN t.THEME_NUMBER = pg.theme THEN 0 ELSE 1 END,
               t.THEME_NUMBER) rk
        FROM APEX_APPLICATION_TEMP_PAGE t JOIN pg ON t.TEMPLATE_NAME = pg.tname
       WHERE t.APPLICATION_ID = p_app),
    dps AS (
      SELECT dp.PLACEHOLDER name, MAX(dp.NAME) label,
             MAX(CASE WHEN dp.HAS_GRID_SUPPORT = 'Yes' THEN 1 ELSE 0 END) grid
        FROM APEX_APPL_TEMP_PAGE_DP dp JOIN tpl ON tpl.TEMPLATE_ID = dp.PAGE_TEMPLATE_ID AND tpl.rk = 1
       WHERE dp.APPLICATION_ID = p_app
       GROUP BY dp.PLACEHOLDER),
    used AS (
      SELECT DISTINCT r.DISPLAY_POSITION_CODE name
        FROM APEX_APPLICATION_PAGE_REGIONS r
       WHERE r.APPLICATION_ID = p_app AND r.PAGE_ID = p_page AND r.PARENT_REGION_ID IS NULL
         AND r.DISPLAY_POSITION_CODE IS NOT NULL
         AND r.DISPLAY_POSITION_CODE NOT IN (SELECT name FROM dps)),
    all_slots AS (
      SELECT name, label, grid FROM dps
      UNION ALL
      SELECT name, name, CASE WHEN name = 'BODY' THEN 1 ELSE 0 END FROM used)
    SELECT JSON_ARRAYAGG(JSON_OBJECT('name' VALUE name, 'label' VALUE label,
             'grid' VALUE CASE WHEN grid = 1 THEN 'true' ELSE 'false' END FORMAT JSON)
             ORDER BY name RETURNING CLOB)
      INTO l_slots
      FROM all_slots;

    layout_rows(p_app, p_page, l_regions, l_items, l_buttons);

    SELECT JSON_OBJECT('token' VALUE l_token,
             'slots' VALUE COALESCE(l_slots, TO_CLOB('[]')) FORMAT JSON,
             'regions' VALUE COALESCE(l_regions, TO_CLOB('[]')) FORMAT JSON,
             'items' VALUE COALESCE(l_items, TO_CLOB('[]')) FORMAT JSON,
             'buttons' VALUE COALESCE(l_buttons, TO_CLOB('[]')) FORMAT JSON RETURNING CLOB)
      INTO l_out FROM DUAL;
    RETURN l_out;
  END layout_json;
END PKG_VD_PAGE_CODE;
/
