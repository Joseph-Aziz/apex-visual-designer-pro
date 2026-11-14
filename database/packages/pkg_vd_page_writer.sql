-- APEX Visual Designer - PKG_VD_PAGE_WRITER (runs as the calling app schema)
-- Installed by database/install.sql into the schema that runs it.

CREATE OR REPLACE PACKAGE PKG_VD_PAGE_WRITER AUTHID CURRENT_USER AS
  -- For the database tests: when TRUE every page write fails after its import, to prove that
  -- the page is put back as it was.
  g_fail_after_import BOOLEAN := FALSE;

  -- Current Inline CSS and Execute when Page Loads JS of a page.
  PROCEDURE read_code(p_app IN NUMBER, p_page IN NUMBER, p_css OUT CLOB, p_js OUT CLOB);

  -- Replaces both attributes by exporting and re-importing the one page.
  PROCEDURE write_code(p_app IN NUMBER, p_page IN NUMBER, p_css IN CLOB, p_js IN CLOB);

  -- Merges the designer blocks into the page and records the version. Raises -20230
  -- when the page code no longer matches p_token. Returns the new token.
  FUNCTION save_design(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2,
                       p_design IN CLOB, p_css_block IN CLOB, p_js_block IN CLOB) RETURN VARCHAR2;

  -- Writes a stored version back into the page (recording the current code first when
  -- it was changed outside the designer). Returns the new token.
  FUNCTION restore_version(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2,
                           p_version_id IN NUMBER) RETURN VARCHAR2;

  -- Gives one region or button (p_kind 'region' or 'button') of the page a Static ID.
  -- Raises -20236 for an invalid name, -20237 when the page already uses it and
  -- -20238 when the component is not on the page. The page CSS and JS are untouched.
  PROCEDURE set_static_id(p_app IN NUMBER, p_page IN NUMBER, p_kind IN VARCHAR2,
                          p_component_id IN NUMBER, p_static_id IN VARCHAR2);

  -- Puts the theme style class vd-<p_type>-<p_cls> on one region, button or item (p_kind
  -- 'region', 'button' or 'item'), replacing any other vd-<p_type>-* class; a NULL p_cls only
  -- removes it. Raises -20236 for an invalid class name and -20238 when the component is not
  -- on the page.
  PROCEDURE set_css_class(p_app IN NUMBER, p_page IN NUMBER, p_kind IN VARCHAR2,
                          p_component_id IN NUMBER, p_type IN VARCHAR2, p_cls IN VARCHAR2);

  -- Records a PUSHED theme version, uploads vd-theme.css (and vd-theme.js, or removes it when
  -- p_js is empty) as static application files, and points the page 0 region with static id
  -- vd-theme-link at them, creating that region on the first push. Returns the version id.
  FUNCTION push_theme(p_app IN NUMBER, p_theme IN CLOB, p_css IN CLOB, p_js IN CLOB) RETURN NUMBER;

  -- Puts a PUSHED or RESTORED version back into the app as a new RESTORED version.
  FUNCTION restore_theme(p_app IN NUMBER, p_version_id IN NUMBER) RETURN NUMBER;
  -- Layout board: applies a change list (JSON array of {kind, id, slot, parent | region, seq,
  -- newRow, newCol, colStart, span}) to the page and keeps the old values for undo (10 per page).
  -- Raises -20230 when p_token is not the page's layout token and -20243 when a change is not valid.
  -- p_fail_after_import is for the database tests: it fails after the import to prove the rollback.
  FUNCTION apply_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2, p_changes IN CLOB,
                        p_fail_after_import IN BOOLEAN DEFAULT FALSE) RETURN VARCHAR2;
  -- Puts back the values before the newest applied change list and forgets it. Returns the new token.
  FUNCTION undo_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2) RETURN VARCHAR2;
END PKG_VD_PAGE_WRITER;
/

CREATE OR REPLACE PACKAGE BODY PKG_VD_PAGE_WRITER AS
  PROCEDURE guard(p_app IN NUMBER, p_page IN NUMBER) IS
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    IF p_page IS NULL OR p_page < 0 THEN
      RAISE_APPLICATION_ERROR(-20233, 'A page number is required.');
    END IF;
    -- The designer never rewrites the page it is running on.
    IF p_app = NV('APP_ID') AND p_page = NV('APP_PAGE_ID') THEN
      RAISE_APPLICATION_ERROR(-20233, 'The designer cannot save into its own page.');
    END IF;
  END guard;

  PROCEDURE read_code(p_app IN NUMBER, p_page IN NUMBER, p_css OUT CLOB, p_js OUT CLOB) IS
  BEGIN
    PKG_VD_DESIGN_API.assert_target_app(p_app);
    EXECUTE IMMEDIATE
      'SELECT INLINE_CSS, JAVASCRIPT_CODE_ONLOAD FROM APEX_APPLICATION_PAGES WHERE APPLICATION_ID = :a AND PAGE_ID = :p'
      INTO p_css, p_js USING p_app, p_page;
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE_APPLICATION_ERROR(-20233, 'Page ' || p_page || ' does not exist in application ' || p_app || '.');
  END read_code;

  -- PL/SQL expression for a text value with no line breaks in the source, so the
  -- export's "/" block separators can never appear inside it.
  FUNCTION literal(p_text IN CLOB) RETURN CLOB IS
    l_out   CLOB;
    l_len   PLS_INTEGER := NVL(DBMS_LOB.GETLENGTH(p_text), 0);
    l_pos   PLS_INTEGER := 1;
    l_chunk VARCHAR2(32767);
  BEGIN
    IF l_len = 0 THEN RETURN 'null'; END IF;
    WHILE l_pos <= l_len LOOP
      l_chunk := DBMS_LOB.SUBSTR(p_text, 1000, l_pos);
      l_chunk := REPLACE(l_chunk, '''', '''''');
      l_chunk := REPLACE(l_chunk, CHR(13), ''' || chr(13) || ''');
      l_chunk := REPLACE(l_chunk, CHR(10), ''' || chr(10) || ''');
      l_out := l_out || CASE WHEN l_pos > 1 THEN ' || ' END || 'to_clob(''' || l_chunk || ''')';
      l_pos := l_pos + 1000;
    END LOOP;
    RETURN l_out;
  END literal;

  -- Drops one ",p_arg=>..." argument (it may run over several lines) from a call body.
  FUNCTION drop_arg(p_text IN CLOB, p_arg IN VARCHAR2) RETURN CLOB IS
    l_a PLS_INTEGER;
    l_b PLS_INTEGER;
  BEGIN
    l_a := DBMS_LOB.INSTR(p_text, CHR(10) || ',' || p_arg || '=>');
    IF NVL(l_a, 0) = 0 THEN RETURN p_text; END IF;
    l_b := DBMS_LOB.INSTR(p_text, CHR(10) || ',p_', l_a + 1);
    IF NVL(l_b, 0) = 0 THEN l_b := DBMS_LOB.GETLENGTH(p_text) + 1; END IF;
    RETURN SUBSTR(p_text, 1, l_a - 1) || SUBSTR(p_text, l_b);
  END drop_arg;

  -- The export of one page, with the import settings that keep every component id.
  FUNCTION export_page(p_app IN NUMBER, p_page IN NUMBER, p_owner OUT VARCHAR2) RETURN CLOB IS
    l_src CLOB;
  BEGIN
    EXECUTE IMMEDIATE 'SELECT OWNER FROM APEX_APPLICATIONS WHERE APPLICATION_ID = :a' INTO p_owner USING p_app;
    EXECUTE IMMEDIATE q'[
      declare
        l_files apex_t_export_files;
      begin
        apex_application_install.set_workspace_id(:ws);
        apex_application_install.set_application_id(:app);
        apex_application_install.set_offset(0);
        apex_application_install.set_schema(:owner);
        l_files := apex_export.get_application(p_application_id => :app2,
                     p_components => apex_t_varchar2('PAGE:' || :page));
        :src := l_files(1).contents;
      end;]'
      USING APEX_APPLICATION.GET_SECURITY_GROUP_ID, p_app, p_owner, p_app, p_page, OUT l_src;
    RETURN l_src;
  END export_page;

  -- Runs each begin...end block of a page export (blocks end with a line holding "/").
  PROCEDURE import_page(p_src IN CLOB) IS
    l_block CLOB;
    l_a     PLS_INTEGER;
    l_pos   PLS_INTEGER := 1;
    l_next  PLS_INTEGER;
  BEGIN
    LOOP
      l_next := DBMS_LOB.INSTR(p_src, CHR(10) || '/' || CHR(10), l_pos);
      EXIT WHEN NVL(l_next, 0) = 0;
      l_block := SUBSTR(p_src, l_pos, l_next - l_pos);
      l_a := DBMS_LOB.INSTR(l_block, 'begin');
      IF NVL(l_a, 0) > 0 THEN
        l_block := SUBSTR(l_block, l_a);
        EXECUTE IMMEDIATE l_block;
      END IF;
      l_pos := l_next + 3;
    END LOOP;
  EXCEPTION
    -- APEX refuses page changes from outside App Builder until the target application allows it.
    WHEN OTHERS THEN
      IF SQLCODE = -20987 OR INSTR(SQLERRM, 'API call has been prohibited') > 0 THEN
        RAISE_APPLICATION_ERROR(-20230,
          'Allow page edits: Shared Components > Security Attributes > Runtime API Usage > Modify This Application.');
      END IF;
      RAISE;
  END import_page;

  -- Replaces the arguments of the call that starts with p_head in an export
  -- (drops every argument named in p_drop, then appends p_add). Raises -20234 when it is missing.
  FUNCTION edit_call(p_src IN CLOB, p_head IN VARCHAR2, p_drop IN apex_t_varchar2, p_add IN CLOB) RETURN CLOB IS
    l_a    PLS_INTEGER;
    l_b    PLS_INTEGER;
    l_call CLOB;
  BEGIN
    l_a := DBMS_LOB.INSTR(p_src, p_head);
    l_b := CASE WHEN NVL(l_a, 0) > 0 THEN DBMS_LOB.INSTR(p_src, CHR(10) || ');', l_a) END;
    IF NVL(l_a, 0) = 0 OR NVL(l_b, 0) = 0 THEN
      RAISE_APPLICATION_ERROR(-20234, 'Page export has an unexpected format; nothing was changed.');
    END IF;
    l_call := SUBSTR(p_src, l_a, l_b - l_a);
    FOR i IN 1 .. p_drop.COUNT LOOP
      l_call := drop_arg(l_call, p_drop(i));
    END LOOP;
    RETURN SUBSTR(p_src, 1, l_a - 1) || l_call || p_add || SUBSTR(p_src, l_b);
  END edit_call;

  -- Imports p_new over a page whose export is p_old. A page import removes the page first, so
  -- when any part of it fails the old export is imported again; the page is never left removed.
  PROCEDURE replace_page(p_old IN CLOB, p_new IN CLOB, p_fail_after_import IN BOOLEAN DEFAULT FALSE) IS
  BEGIN
    import_page(p_new);
    IF p_fail_after_import OR g_fail_after_import THEN
      RAISE_APPLICATION_ERROR(-20234, 'Test failure after the import.');
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      import_page(p_old);
      RAISE;
  END replace_page;

  PROCEDURE write_code(p_app IN NUMBER, p_page IN NUMBER, p_css IN CLOB, p_js IN CLOB) IS
    l_owner VARCHAR2(128);
    l_src   CLOB;
  BEGIN
    guard(p_app, p_page);
    l_src := export_page(p_app, p_page, l_owner);
    replace_page(l_src, edit_call(l_src, 'wwv_flow_imp_page.create_page(',
      apex_t_varchar2('p_inline_css', 'p_javascript_code_onload'),
      CHR(10) || ',p_inline_css=>' || literal(p_css) || CHR(10) || ',p_javascript_code_onload=>' || literal(p_js)));
  END write_code;

  FUNCTION save_design(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2,
                       p_design IN CLOB, p_css_block IN CLOB, p_js_block IN CLOB) RETURN VARCHAR2 IS
    l_css CLOB; l_js CLOB; l_new_css CLOB; l_new_js CLOB; l_id NUMBER;
  BEGIN
    guard(p_app, p_page);
    read_code(p_app, p_page, l_css, l_js);
    IF p_token IS NULL OR p_token <> PKG_VD_PAGE_CODE.code_token(l_css, l_js) THEN
      RAISE_APPLICATION_ERROR(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
    END IF;
    l_new_css := PKG_VD_PAGE_CODE.merge_block(l_css, p_css_block);
    l_new_js  := PKG_VD_PAGE_CODE.merge_block(l_js, p_js_block);
    IF PKG_VD_PAGE_CODE.version_count(p_app, p_page) = 0 THEN
      l_id := PKG_VD_PAGE_CODE.add_version(p_app, p_page, l_css, l_js, NULL, 'ORIGINAL');
    END IF;
    write_code(p_app, p_page, l_new_css, l_new_js);
    l_id := PKG_VD_PAGE_CODE.add_version(p_app, p_page, l_new_css, l_new_js, p_design, 'SAVED');
    RETURN PKG_VD_PAGE_CODE.code_token(l_new_css, l_new_js);
  END save_design;

  FUNCTION restore_version(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2,
                           p_version_id IN NUMBER) RETURN VARCHAR2 IS
    l_css CLOB; l_js CLOB; l_v_css CLOB; l_v_js CLOB; l_v_design CLOB;
    l_last_id NUMBER; l_last_css CLOB; l_last_js CLOB; l_last_design CLOB; l_id NUMBER;
  BEGIN
    guard(p_app, p_page);
    read_code(p_app, p_page, l_css, l_js);
    IF p_token IS NULL OR p_token <> PKG_VD_PAGE_CODE.code_token(l_css, l_js) THEN
      RAISE_APPLICATION_ERROR(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
    END IF;
    PKG_VD_PAGE_CODE.get_version(p_version_id, p_app, p_page, l_v_css, l_v_js, l_v_design);
    PKG_VD_PAGE_CODE.get_latest(p_app, p_page, l_last_id, l_last_css, l_last_js, l_last_design);
    IF l_last_id IS NULL OR PKG_VD_PAGE_CODE.code_token(l_last_css, l_last_js)
                            <> PKG_VD_PAGE_CODE.code_token(l_css, l_js) THEN
      l_id := PKG_VD_PAGE_CODE.add_version(p_app, p_page, l_css, l_js, NULL, 'EDITED OUTSIDE');
    END IF;
    write_code(p_app, p_page, l_v_css, l_v_js);
    l_id := PKG_VD_PAGE_CODE.add_version(p_app, p_page, l_v_css, l_v_js, l_v_design, 'RESTORED');
    RETURN PKG_VD_PAGE_CODE.code_token(l_v_css, l_v_js);
  END restore_version;

  PROCEDURE set_static_id(p_app IN NUMBER, p_page IN NUMBER, p_kind IN VARCHAR2,
                          p_component_id IN NUMBER, p_static_id IN VARCHAR2) IS
    l_owner VARCHAR2(128);
    l_src   CLOB;
    l_n     NUMBER;
    l_head  VARCHAR2(200);
    l_arg   VARCHAR2(30);
  BEGIN
    guard(p_app, p_page);
    IF p_kind = 'region' THEN
      l_head := 'wwv_flow_imp_page.create_page_plug(';
      l_arg := 'p_region_name';
      EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = :a AND PAGE_ID = :p AND REGION_ID = :i'
        INTO l_n USING p_app, p_page, p_component_id;
    ELSIF p_kind = 'button' THEN
      l_head := 'wwv_flow_imp_page.create_page_button(';
      l_arg := 'p_button_static_id';
      EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM APEX_APPLICATION_PAGE_BUTTONS WHERE APPLICATION_ID = :a AND PAGE_ID = :p AND BUTTON_ID = :i'
        INTO l_n USING p_app, p_page, p_component_id;
    END IF;
    IF NVL(l_n, 0) = 0 THEN
      RAISE_APPLICATION_ERROR(-20238, 'That region or button is not on page ' || p_page || '.');
    END IF;
    IF p_static_id IS NULL OR NOT REGEXP_LIKE(p_static_id, '^[A-Za-z][A-Za-z0-9_-]{0,59}$') THEN
      RAISE_APPLICATION_ERROR(-20236, 'A Static ID starts with a letter and has only letters, digits, _ and - (at most 60).');
    END IF;
    -- Unique among the page's region and button Static IDs and item names (items use their name as id).
    EXECUTE IMMEDIATE
      'SELECT (SELECT COUNT(*) FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = :a1 AND PAGE_ID = :p1 AND UPPER(STATIC_ID) = UPPER(:s1) AND NOT (:k1 = ''region'' AND REGION_ID = :i1))' ||
      '     + (SELECT COUNT(*) FROM APEX_APPLICATION_PAGE_BUTTONS WHERE APPLICATION_ID = :a2 AND PAGE_ID = :p2 AND UPPER(BUTTON_STATIC_ID) = UPPER(:s2) AND NOT (:k2 = ''button'' AND BUTTON_ID = :i2))' ||
      '     + (SELECT COUNT(*) FROM APEX_APPLICATION_PAGE_ITEMS WHERE APPLICATION_ID = :a3 AND PAGE_ID = :p3 AND UPPER(ITEM_NAME) = UPPER(:s3)) FROM DUAL'
      INTO l_n USING p_app, p_page, p_static_id, p_kind, p_component_id,
                     p_app, p_page, p_static_id, p_kind, p_component_id, p_app, p_page, p_static_id;
    IF l_n > 0 THEN
      RAISE_APPLICATION_ERROR(-20237, 'Page ' || p_page || ' already uses "' || p_static_id || '". Choose another Static ID.');
    END IF;
    l_src := export_page(p_app, p_page, l_owner);
    replace_page(l_src, edit_call(l_src,
      l_head || CHR(10) || ' p_id=>wwv_flow_imp.id(' || TO_CHAR(p_component_id) || ')',
      apex_t_varchar2(l_arg), CHR(10) || ',' || l_arg || '=>''' || p_static_id || ''''));
  END set_static_id;

  -- The class list with every vd-<p_type>-* class removed and vd-<p_type>-<p_cls> added.
  FUNCTION with_class(p_classes IN VARCHAR2, p_type IN VARCHAR2, p_cls IN VARCHAR2) RETURN VARCHAR2 IS
    l_out VARCHAR2(4000);
  BEGIN
    l_out := REGEXP_REPLACE(' ' || p_classes || ' ', '\s+', '  ');
    l_out := REGEXP_REPLACE(l_out, ' vd-' || p_type || '-[a-z0-9-]+ ', ' ');
    l_out := TRIM(REGEXP_REPLACE(l_out, '\s+', ' '));
    IF p_cls IS NOT NULL THEN l_out := TRIM(l_out || ' vd-' || p_type || '-' || p_cls); END IF;
    RETURN l_out;
  END with_class;

  PROCEDURE set_css_class(p_app IN NUMBER, p_page IN NUMBER, p_kind IN VARCHAR2,
                          p_component_id IN NUMBER, p_type IN VARCHAR2, p_cls IN VARCHAR2) IS
    l_owner   VARCHAR2(128);
    l_src     CLOB;
    l_classes VARCHAR2(4000);
    l_head    VARCHAR2(200);
    l_arg     VARCHAR2(30);
    l_sql     VARCHAR2(400);
  BEGIN
    guard(p_app, p_page);
    IF p_type IS NULL OR NOT REGEXP_LIKE(p_type, '^[a-z]{2,10}$')
       OR (p_cls IS NOT NULL AND NOT REGEXP_LIKE(p_cls, '^[a-z][a-z0-9-]{0,30}$')) THEN
      RAISE_APPLICATION_ERROR(-20236, 'A style class name starts with a letter and uses only a-z, 0-9 and - (at most 31).');
    END IF;
    IF p_kind = 'region' THEN
      l_head := 'wwv_flow_imp_page.create_page_plug('; l_arg := 'p_region_css_classes';
      l_sql := 'SELECT REGION_CSS_CLASSES FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = :a AND PAGE_ID = :p AND REGION_ID = :i';
    ELSIF p_kind = 'button' THEN
      l_head := 'wwv_flow_imp_page.create_page_button('; l_arg := 'p_button_css_classes';
      l_sql := 'SELECT BUTTON_CSS_CLASSES FROM APEX_APPLICATION_PAGE_BUTTONS WHERE APPLICATION_ID = :a AND PAGE_ID = :p AND BUTTON_ID = :i';
    ELSIF p_kind = 'item' THEN
      l_head := 'wwv_flow_imp_page.create_page_item('; l_arg := 'p_item_css_classes';
      l_sql := 'SELECT ITEM_CSS_CLASSES FROM APEX_APPLICATION_PAGE_ITEMS WHERE APPLICATION_ID = :a AND PAGE_ID = :p AND ITEM_ID = :i';
    ELSE
      RAISE_APPLICATION_ERROR(-20238, 'Unknown component kind.');
    END IF;
    BEGIN
      EXECUTE IMMEDIATE l_sql INTO l_classes USING p_app, p_page, p_component_id;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20238, 'That component is not on page ' || p_page || '.');
    END;
    l_classes := with_class(l_classes, p_type, p_cls);
    l_src := export_page(p_app, p_page, l_owner);
    replace_page(l_src, edit_call(l_src,
      l_head || CHR(10) || ' p_id=>wwv_flow_imp.id(' || TO_CHAR(p_component_id) || ')',
      apex_t_varchar2(l_arg), CASE WHEN l_classes IS NOT NULL THEN CHR(10) || ',' || l_arg || '=>' || literal(l_classes) END));
  END set_css_class;

  -- The start of an APEX import session for p_app (the page writes run the same way). The
  -- import API version and release come from the running APEX instance.
  FUNCTION import_start RETURN VARCHAR2 IS
    l_api VARCHAR2(30);
    l_rel VARCHAR2(30);
  BEGIN
    EXECUTE IMMEDIATE 'SELECT API_COMPATIBILITY, VERSION_NO FROM APEX_RELEASE' INTO l_api, l_rel;
    RETURN 'apex_application_install.set_workspace_id(:ws); apex_application_install.set_application_id(:app); ' ||
      'apex_application_install.set_offset(0); apex_application_install.set_schema(:owner); ' ||
      'wwv_flow_imp.import_begin(p_version_yyyy_mm_dd => ' || DBMS_ASSERT.ENQUOTE_LITERAL(l_api) || ', p_release => ' || DBMS_ASSERT.ENQUOTE_LITERAL(l_rel) || ', ' ||
      'p_default_workspace_id => :ws2, p_default_application_id => :app2, p_default_id_offset => 0, p_default_owner => :owner2); ';
  END import_start;

  -- Creates or replaces one static application file of p_app.
  PROCEDURE put_file(p_app IN NUMBER, p_owner IN VARCHAR2, p_name IN VARCHAR2, p_mime IN VARCHAR2, p_text IN CLOB) IS
    l_ws NUMBER := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
  BEGIN
    EXECUTE IMMEDIATE 'declare l_id number; begin ' || import_start ||
      'select max(application_file_id) into l_id from apex_application_static_files where application_id = :app3 and file_name = :name; ' ||
      'wwv_flow_imp_shared.create_app_static_file(p_id => nvl(l_id, wwv_flow_id.next_val), p_file_name => :name2, ' ||
      'p_mime_type => :mime, p_file_charset => ''utf-8'', p_file_content => apex_util.clob_to_blob(:text)); ' ||
      'wwv_flow_imp.import_end; end;'
      USING l_ws, p_app, p_owner, l_ws, p_app, p_owner, p_app, p_name, p_name, p_mime, p_text;
  END put_file;

  -- Removes one static application file of p_app when it exists.
  PROCEDURE drop_file(p_app IN NUMBER, p_owner IN VARCHAR2, p_name IN VARCHAR2) IS
    l_ws NUMBER := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
    l_id NUMBER;
  BEGIN
    EXECUTE IMMEDIATE 'SELECT MAX(APPLICATION_FILE_ID) FROM APEX_APPLICATION_STATIC_FILES WHERE APPLICATION_ID = :a AND FILE_NAME = :n'
      INTO l_id USING p_app, p_name;
    IF l_id IS NULL THEN RETURN; END IF;
    EXECUTE IMMEDIATE 'begin ' || import_start ||
      'wwv_flow_imp_shared.remove_app_static_file(p_id => :id, p_flow_id => :app3); wwv_flow_imp.import_end; end;'
      USING l_ws, p_app, p_owner, l_ws, p_app, p_owner, l_id, p_app;
  END drop_file;

  -- Points page 0's vd-theme-link region at version p_version of the theme files, creating
  -- the region (no template chrome, first in its position) when the page has none.
  PROCEDURE write_theme_link(p_app IN NUMBER, p_version IN NUMBER, p_has_js IN BOOLEAN) IS
    l_owner  VARCHAR2(128);
    l_src    CLOB;
    l_html   VARCHAR2(1000);
    l_region NUMBER;
    l_tpl    NUMBER;
    l_new    NUMBER;
    l_a      PLS_INTEGER;
    l_b      PLS_INTEGER;
    l_old    CLOB;
  BEGIN
    l_html := '<link rel="stylesheet" href="#APP_FILES#vd-theme.css?v=' || p_version || '">' ||
      CASE WHEN p_has_js THEN '<script src="#APP_FILES#vd-theme.js?v=' || p_version || '"></script>' END;
    l_src := export_page(p_app, 0, l_owner);
    l_old := l_src;
    EXECUTE IMMEDIATE 'SELECT MAX(REGION_ID) FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = :a AND PAGE_ID = 0 AND STATIC_ID = ''vd-theme-link'''
      INTO l_region USING p_app;
    IF l_region IS NOT NULL THEN
      l_src := edit_call(l_src, 'wwv_flow_imp_page.create_page_plug(' || CHR(10) || ' p_id=>wwv_flow_imp.id(' || TO_CHAR(l_region) || ')',
        apex_t_varchar2('p_plug_source'), CHR(10) || ',p_plug_source=>' || literal(l_html));
    ELSE
      EXECUTE IMMEDIATE 'SELECT MIN(REGION_TEMPLATE_ID) FROM APEX_APPLICATION_TEMP_REGION ' ||
        'WHERE APPLICATION_ID = :a AND TEMPLATE_NAME = ''Blank with Attributes (No Grid)''' INTO l_tpl USING p_app;
      EXECUTE IMMEDIATE 'SELECT wwv_flow_id.next_val FROM DUAL' INTO l_new;
      l_a := DBMS_LOB.INSTR(l_src, 'wwv_flow_imp_page.create_page(');
      l_b := CASE WHEN NVL(l_a, 0) > 0 THEN DBMS_LOB.INSTR(l_src, CHR(10) || ');', l_a) END;
      IF NVL(l_b, 0) = 0 OR l_tpl IS NULL THEN
        RAISE_APPLICATION_ERROR(-20234, 'Page 0 export has an unexpected format; nothing was changed.');
      END IF;
      l_src := SUBSTR(l_src, 1, l_b + 2) || CHR(10) ||
        'wwv_flow_imp_page.create_page_plug(' || CHR(10) ||
        ' p_id=>wwv_flow_imp.id(' || TO_CHAR(l_new) || ')' || CHR(10) ||
        ',p_plug_name=>''VD Theme''' || CHR(10) ||
        ',p_region_name=>''vd-theme-link''' || CHR(10) ||
        ',p_region_template_options=>''#DEFAULT#''' || CHR(10) ||
        ',p_plug_template=>' || TO_CHAR(l_tpl) || CHR(10) ||
        ',p_plug_display_sequence=>1' || CHR(10) ||
        ',p_plug_display_point=>''REGION_POSITION_05''' || CHR(10) ||
        ',p_plug_item_display_point=>''ABOVE''' || CHR(10) ||
        ',p_location=>null' || CHR(10) ||
        ',p_plug_source=>' || literal(l_html) || CHR(10) ||
        ');' || SUBSTR(l_src, l_b + 3);
    END IF;
    replace_page(l_old, l_src);
  END write_theme_link;

  PROCEDURE apply_theme(p_app IN NUMBER, p_version IN NUMBER, p_css IN CLOB, p_js IN CLOB) IS
    l_owner VARCHAR2(128);
  BEGIN
    EXECUTE IMMEDIATE 'SELECT OWNER FROM APEX_APPLICATIONS WHERE APPLICATION_ID = :a' INTO l_owner USING p_app;
    put_file(p_app, l_owner, 'vd-theme.css', 'text/css', p_css);
    IF NVL(DBMS_LOB.GETLENGTH(p_js), 0) > 0 THEN
      put_file(p_app, l_owner, 'vd-theme.js', 'text/javascript', p_js);
    ELSE
      drop_file(p_app, l_owner, 'vd-theme.js');
    END IF;
    write_theme_link(p_app, p_version, NVL(DBMS_LOB.GETLENGTH(p_js), 0) > 0);
  END apply_theme;

  FUNCTION push_theme(p_app IN NUMBER, p_theme IN CLOB, p_css IN CLOB, p_js IN CLOB) RETURN NUMBER IS
    l_id NUMBER;
  BEGIN
    guard(p_app, 0);
    l_id := PKG_VD_THEME.add_version(p_app, p_theme, p_css, p_js, 'PUSHED');
    apply_theme(p_app, l_id, p_css, p_js);
    RETURN l_id;
  END push_theme;

  FUNCTION restore_theme(p_app IN NUMBER, p_version_id IN NUMBER) RETURN NUMBER IS
    l_theme CLOB; l_css CLOB; l_js CLOB; l_id NUMBER;
  BEGIN
    guard(p_app, 0);
    PKG_VD_THEME.get_pushed(p_app, p_version_id, l_theme, l_css, l_js);
    l_id := PKG_VD_THEME.add_version(p_app, l_theme, l_css, l_js, 'RESTORED');
    apply_theme(p_app, l_id, l_css, l_js);
    RETURN l_id;
  END restore_theme;
  -- Layout board ---------------------------------------------------------------------------

  -- Layout arguments of the export calls (confirmed on APEX 26.2, see PKG_VD_PAGE_CODE.layout_json).
  FUNCTION region_args RETURN apex_t_varchar2 IS
  BEGIN
    RETURN apex_t_varchar2('p_plug_display_sequence', 'p_plug_display_point', 'p_parent_plug_id',
      'p_plug_new_grid_row', 'p_plug_new_grid_column', 'p_plug_display_column', 'p_plug_grid_column_span');
  END region_args;

  FUNCTION item_args RETURN apex_t_varchar2 IS
  BEGIN
    RETURN apex_t_varchar2('p_item_sequence', 'p_item_plug_id', 'p_begin_on_new_line',
      'p_begin_on_new_field', 'p_grid_column', 'p_colspan');
  END item_args;

  -- p_button_position is left out of the export for body buttons, and the grid flags when they
  -- hold their defaults, so the writer always gives all of them.
  FUNCTION button_args RETURN apex_t_varchar2 IS
  BEGIN
    RETURN apex_t_varchar2('p_button_sequence', 'p_button_plug_id', 'p_button_position',
      'p_grid_new_row', 'p_grid_new_column', 'p_grid_column', 'p_grid_column_span');
  END button_args;

  PROCEDURE refuse(p_reason IN VARCHAR2) IS
  BEGIN
    RAISE_APPLICATION_ERROR(-20243, p_reason || ' Nothing was changed.');
  END refuse;

  -- A whole number from 1 to 12, or null (automatic).
  FUNCTION column_value(p_obj IN JSON_OBJECT_T, p_key IN VARCHAR2) RETURN NUMBER IS
    l_n NUMBER;
  BEGIN
    IF NOT p_obj.has(p_key) OR p_obj.get(p_key).is_null THEN RETURN NULL; END IF;
    l_n := p_obj.get_number(p_key);
    IF l_n IS NULL OR l_n <> TRUNC(l_n) OR l_n NOT BETWEEN 1 AND 12 THEN
      refuse('A span or column start runs from 1 to 12.');
    END IF;
    RETURN l_n;
  END column_value;

  -- A component id given as text or number; null when absent or not a number.
  FUNCTION id_value(p_obj IN JSON_OBJECT_T, p_key IN VARCHAR2) RETURN NUMBER IS
  BEGIN
    IF NOT p_obj.has(p_key) OR p_obj.get(p_key).is_null THEN RETURN NULL; END IF;
    RETURN TO_NUMBER(p_obj.get_string(p_key) DEFAULT NULL ON CONVERSION ERROR);
  END id_value;

  -- Merges p_changes into the page's current layout (p_state), checks the result and returns the
  -- old values of the changed components, as change objects, for undo.
  FUNCTION merge_layout(p_state IN OUT NOCOPY JSON_OBJECT_T, p_changes IN JSON_ARRAY_T) RETURN JSON_ARRAY_T IS
    l_old     JSON_ARRAY_T := JSON_ARRAY_T();
    l_list    JSON_ARRAY_T;
    l_ch      JSON_OBJECT_T;
    l_comp    JSON_OBJECT_T;
    l_prev    JSON_OBJECT_T;
    l_kind    VARCHAR2(10);
    l_id      VARCHAR2(40);
    l_ref     NUMBER;
    l_found   BOOLEAN;
    l_changed apex_t_varchar2 := apex_t_varchar2();
    l_state   CLOB;
    l_reason  VARCHAR2(200);
  BEGIN
    FOR i IN 0 .. p_changes.get_size - 1 LOOP
      IF NOT p_changes.get(i).is_object THEN refuse('A change is not valid.'); END IF;
      l_ch := TREAT(p_changes.get(i) AS JSON_OBJECT_T);
      l_kind := l_ch.get_string('kind');
      l_id := TO_CHAR(id_value(l_ch, 'id'));
      IF l_kind IS NULL OR l_kind NOT IN ('region', 'item', 'button') OR l_id IS NULL THEN refuse('A change is not valid.'); END IF;
      IF NOT l_ch.has('seq') OR l_ch.get_number('seq') IS NULL OR l_ch.get_number('seq') < 0 THEN
        refuse('A change is not valid.');
      END IF;
      IF l_kind || ':' || l_id MEMBER OF l_changed THEN refuse('A component is listed twice.'); END IF;
      l_list := p_state.get_array(l_kind || 's');
      l_found := FALSE;
      FOR j IN 0 .. l_list.get_size - 1 LOOP
        l_comp := TREAT(l_list.get(j) AS JSON_OBJECT_T);
        IF l_comp.get_string('id') = l_id THEN
          l_found := TRUE;
          l_prev := JSON_OBJECT_T();
          l_prev.put('kind', l_kind);
          l_prev.put('id', l_id);
          IF l_kind = 'region' THEN
            l_prev.put('parent', l_comp.get('parent'));
            l_prev.put('slot', l_comp.get('slot'));
            l_ref := id_value(l_ch, 'parent');
            IF l_ref IS NULL AND l_ch.has('parent') AND NOT l_ch.get('parent').is_null THEN
              refuse('That region is not on this page.');
            END IF;
            IF l_ref IS NULL THEN
              l_comp.put_null('parent');
              l_comp.put('slot', l_ch.get_string('slot'));
            ELSE
              l_comp.put('parent', TO_CHAR(l_ref));
              l_comp.put('slot', 'SUB_REGIONS');
            END IF;
          ELSE
            l_prev.put('region', l_comp.get('region'));
            l_ref := id_value(l_ch, 'region');
            IF l_ref IS NULL THEN refuse('An ' || l_kind || ' must be inside a region.'); END IF;
            l_comp.put('region', TO_CHAR(l_ref));
            IF l_kind = 'button' THEN
              l_prev.put('position', l_comp.get('position'));
              IF NOT REGEXP_LIKE(l_ch.get_string('position'), '^[A-Z0-9_]{1,30}$') THEN
                refuse('That button position is not valid.');
              END IF;
              l_comp.put('position', l_ch.get_string('position'));
            END IF;
          END IF;
          l_prev.put('seq', l_comp.get('seq'));
          l_prev.put('newRow', l_comp.get('newRow'));
          l_prev.put('newCol', l_comp.get('newCol'));
          l_prev.put('colStart', l_comp.get('colStart'));
          l_prev.put('span', l_comp.get('span'));
          l_old.append(l_prev);
          l_comp.put('seq', l_ch.get_number('seq'));
          l_comp.put('newRow', CASE WHEN l_ch.has('newRow') AND l_ch.get('newRow').is_false THEN FALSE ELSE TRUE END);
          l_comp.put('newCol', CASE WHEN l_ch.has('newCol') AND l_ch.get('newCol').is_false THEN FALSE ELSE TRUE END);
          IF column_value(l_ch, 'colStart') IS NULL THEN l_comp.put_null('colStart');
          ELSE l_comp.put('colStart', column_value(l_ch, 'colStart')); END IF;
          IF column_value(l_ch, 'span') IS NULL THEN l_comp.put_null('span');
          ELSE l_comp.put('span', column_value(l_ch, 'span')); END IF;
          l_changed.EXTEND; l_changed(l_changed.COUNT) := l_kind || ':' || l_id;
          EXIT;
        END IF;
      END LOOP;
      IF NOT l_found THEN refuse('That ' || l_kind || ' is not on this page.'); END IF;
    END LOOP;

    -- Check the merged page: slots, parents, no region inside itself, 12-column rows.
    l_state := p_state.to_clob;
    WITH slots AS (
      SELECT name, grid FROM JSON_TABLE(l_state, '$.slots[*]' COLUMNS (
        name VARCHAR2(255) PATH '$.name', grid VARCHAR2(5) PATH '$.grid'))
    ), r AS (
      SELECT * FROM JSON_TABLE(l_state, '$.regions[*]' COLUMNS (
        id VARCHAR2(40) PATH '$.id', parent VARCHAR2(40) PATH '$.parent', slot VARCHAR2(255) PATH '$.slot',
        seq NUMBER PATH '$.seq', new_row VARCHAR2(5) PATH '$.newRow', span NUMBER PATH '$.span'))
    ), i AS (
      SELECT * FROM JSON_TABLE(l_state, '$.items[*]' COLUMNS (
        id VARCHAR2(40) PATH '$.id', region VARCHAR2(40) PATH '$.region',
        seq NUMBER PATH '$.seq', new_row VARCHAR2(5) PATH '$.newRow', span NUMBER PATH '$.span'))
    ), b AS (
      SELECT * FROM JSON_TABLE(l_state, '$.buttons[*]' COLUMNS (
        id VARCHAR2(40) PATH '$.id', region VARCHAR2(40) PATH '$.region', position VARCHAR2(30) PATH '$.position',
        seq NUMBER PATH '$.seq', new_row VARCHAR2(5) PATH '$.newRow', span NUMBER PATH '$.span'))
    ), changed AS (
      SELECT column_value k FROM TABLE(l_changed)
    ), cyc AS (
      SELECT MAX(CONNECT_BY_ISCYCLE) c FROM r
       START WITH 'region:' || id IN (SELECT k FROM changed)
       CONNECT BY NOCYCLE id = PRIOR parent
    ), roots AS (
      SELECT id, CONNECT_BY_ROOT slot root_slot FROM r
       START WITH parent IS NULL CONNECT BY NOCYCLE parent = PRIOR id
    ), comps AS (
      SELECT 'region:' || r.id k, 'region' kind,
             CASE WHEN r.parent IS NULL THEN 'slot:' || r.slot ELSE 'region:' || r.parent END cont,
             r.seq, r.new_row, r.span FROM r
      UNION ALL
      -- Items and body buttons share rows; other buttons sit outside the grid.
      SELECT 'item:' || i.id, 'field', 'region:' || i.region, i.seq, i.new_row, i.span FROM i
      UNION ALL
      SELECT 'button:' || b.id, 'field',
             CASE WHEN b.position = 'BODY' THEN 'region:' ELSE 'btn:' || b.position || ':' END || b.region,
             b.seq, b.new_row, b.span FROM b
    ), grid AS (
      SELECT DISTINCT c.cont FROM comps c
        LEFT JOIN roots ro ON c.cont = 'region:' || ro.id
        JOIN slots s ON s.name = CASE WHEN c.cont LIKE 'slot:%' THEN SUBSTR(c.cont, 6) ELSE ro.root_slot END
       WHERE s.grid = 'true' AND c.cont IN (SELECT c2.cont FROM comps c2 JOIN changed ON changed.k = c2.k)
    ), numbered AS (
      SELECT c.cont, c.kind, c.span,
             SUM(CASE WHEN c.new_row = 'false' THEN 0 ELSE 1 END)
               OVER (PARTITION BY c.cont, c.kind ORDER BY c.seq, c.k ROWS UNBOUNDED PRECEDING) row_no
        FROM comps c JOIN grid g ON g.cont = c.cont
    )
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM r JOIN changed ON changed.k = 'region:' || r.id
                    WHERE r.parent IS NULL AND (r.slot IS NULL OR r.slot NOT IN (SELECT name FROM slots)))
        THEN 'The page template has no such slot.'
      WHEN EXISTS (SELECT 1 FROM r JOIN changed ON changed.k = 'region:' || r.id
                    WHERE r.parent IS NOT NULL AND r.parent NOT IN (SELECT id FROM r))
        THEN 'That region is not on this page.'
      WHEN (SELECT c FROM cyc) = 1 OR EXISTS (SELECT 1 FROM r WHERE r.parent = r.id)
        THEN 'A region cannot go inside itself.'
      WHEN EXISTS (SELECT 1 FROM i JOIN changed ON changed.k = 'item:' || i.id
                    WHERE i.region NOT IN (SELECT id FROM r))
        THEN 'An item must be inside a region.'
      WHEN EXISTS (SELECT 1 FROM b JOIN changed ON changed.k = 'button:' || b.id
                    WHERE b.region NOT IN (SELECT id FROM r))
        THEN 'A button must be inside a region.'
      WHEN EXISTS (SELECT 1 FROM numbered GROUP BY cont, kind, row_no HAVING SUM(NVL(span, 0)) > 12)
        THEN 'A row cannot be wider than 12 columns.'
      END
      INTO l_reason FROM DUAL;
    IF l_reason IS NOT NULL THEN refuse(l_reason); END IF;
    RETURN l_old;
  END merge_layout;

  -- The export with the layout arguments of each listed component replaced by its new values.
  FUNCTION layout_source(p_src IN CLOB, p_comps IN JSON_ARRAY_T) RETURN CLOB IS
    l_src  CLOB := p_src;
    l_c    JSON_OBJECT_T;
    l_add  VARCHAR2(4000);
    l_slot VARCHAR2(255);
    FUNCTION num(p_key IN VARCHAR2) RETURN VARCHAR2 IS
    BEGIN
      RETURN CASE WHEN l_c.has(p_key) AND NOT l_c.get(p_key).is_null THEN TO_CHAR(l_c.get_number(p_key)) END;
    END num;
    FUNCTION is_false(p_key IN VARCHAR2) RETURN BOOLEAN IS
    BEGIN
      RETURN l_c.has(p_key) AND l_c.get(p_key).is_false;
    END is_false;
  BEGIN
    FOR i IN 0 .. p_comps.get_size - 1 LOOP
      l_c := TREAT(p_comps.get(i) AS JSON_OBJECT_T);
      IF l_c.get_string('kind') = 'region' THEN
        l_slot := CASE WHEN id_value(l_c, 'parent') IS NOT NULL THEN 'SUB_REGIONS' ELSE l_c.get_string('slot') END;
        IF NOT REGEXP_LIKE(l_slot, '^[A-Za-z0-9_]{1,255}$') THEN refuse('The page template has no such slot.'); END IF;
        l_add := CHR(10) || ',p_plug_display_sequence=>' || num('seq')
          || CHR(10) || ',p_plug_display_point=>''' || l_slot || ''''
          || CASE WHEN id_value(l_c, 'parent') IS NOT NULL
                  THEN CHR(10) || ',p_parent_plug_id=>wwv_flow_imp.id(' || id_value(l_c, 'parent') || ')' END
          || CASE WHEN is_false('newRow') THEN CHR(10) || ',p_plug_new_grid_row=>false' END
          || CASE WHEN is_false('newCol') THEN CHR(10) || ',p_plug_new_grid_column=>false' END
          || CASE WHEN num('colStart') IS NOT NULL THEN CHR(10) || ',p_plug_display_column=>' || num('colStart') END
          || CASE WHEN num('span') IS NOT NULL THEN CHR(10) || ',p_plug_grid_column_span=>' || num('span') END;
        l_src := edit_call(l_src, 'wwv_flow_imp_page.create_page_plug(' || CHR(10)
          || ' p_id=>wwv_flow_imp.id(' || id_value(l_c, 'id') || ')', region_args, l_add);
      ELSIF l_c.get_string('kind') = 'button' THEN
        IF NOT REGEXP_LIKE(l_c.get_string('position'), '^[A-Z0-9_]{1,30}$') THEN refuse('That button position is not valid.'); END IF;
        l_add := CHR(10) || ',p_button_sequence=>' || num('seq')
          || CHR(10) || ',p_button_plug_id=>wwv_flow_imp.id(' || id_value(l_c, 'region') || ')'
          || CHR(10) || ',p_button_position=>''' || l_c.get_string('position') || ''''
          || CHR(10) || ',p_grid_new_row=>''' || CASE WHEN is_false('newRow') THEN 'N' ELSE 'Y' END || ''''
          || CHR(10) || ',p_grid_new_column=>''' || CASE WHEN is_false('newCol') THEN 'N' ELSE 'Y' END || ''''
          || CASE WHEN num('colStart') IS NOT NULL THEN CHR(10) || ',p_grid_column=>' || num('colStart') END
          || CASE WHEN num('span') IS NOT NULL THEN CHR(10) || ',p_grid_column_span=>' || num('span') END;
        l_src := edit_call(l_src, 'wwv_flow_imp_page.create_page_button(' || CHR(10)
          || ' p_id=>wwv_flow_imp.id(' || id_value(l_c, 'id') || ')', button_args, l_add);
      ELSE
        l_add := CHR(10) || ',p_item_sequence=>' || num('seq')
          || CHR(10) || ',p_item_plug_id=>wwv_flow_imp.id(' || id_value(l_c, 'region') || ')'
          || CASE WHEN is_false('newRow') THEN CHR(10) || ',p_begin_on_new_line=>''N''' END
          || CASE WHEN is_false('newCol') THEN CHR(10) || ',p_begin_on_new_field=>''N''' END
          || CASE WHEN num('colStart') IS NOT NULL THEN CHR(10) || ',p_grid_column=>' || num('colStart') END
          || CASE WHEN num('span') IS NOT NULL THEN CHR(10) || ',p_colspan=>' || num('span') END;
        l_src := edit_call(l_src, 'wwv_flow_imp_page.create_page_item(' || CHR(10)
          || ' p_id=>wwv_flow_imp.id(' || id_value(l_c, 'id') || ')', item_args, l_add);
      END IF;
    END LOOP;
    RETURN l_src;
  END layout_source;

  -- Checks the token, merges and checks the changes and writes the page once; when the import
  -- fails the original export is imported again. Returns the old values of the changed components.
  FUNCTION write_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2, p_changes IN CLOB,
                        p_fail_after_import IN BOOLEAN) RETURN JSON_ARRAY_T IS
    l_state   JSON_OBJECT_T;
    l_changes JSON_ARRAY_T;
    l_old     JSON_ARRAY_T;
    l_owner   VARCHAR2(128);
    l_src     CLOB;
  BEGIN
    guard(p_app, p_page);
    IF p_token IS NULL OR p_token <> PKG_VD_PAGE_CODE.layout_token(p_app, p_page) THEN
      RAISE_APPLICATION_ERROR(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
    END IF;
    BEGIN
      l_changes := JSON_ARRAY_T.parse(p_changes);
    EXCEPTION
      WHEN OTHERS THEN refuse('A change is not valid.');
    END;
    IF l_changes IS NULL OR l_changes.get_size = 0 THEN refuse('There are no changes.'); END IF;
    l_state := JSON_OBJECT_T.parse(PKG_VD_PAGE_CODE.layout_json(p_app, p_page));
    l_old := merge_layout(l_state, l_changes);
    l_src := export_page(p_app, p_page, l_owner);
    replace_page(l_src, layout_source(l_src, l_changes), p_fail_after_import);
    RETURN l_old;
  END write_layout;

  FUNCTION apply_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2, p_changes IN CLOB,
                        p_fail_after_import IN BOOLEAN DEFAULT FALSE) RETURN VARCHAR2 IS
    l_old JSON_ARRAY_T;
    l_txt CLOB;
    l_ws  NUMBER := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
  BEGIN
    l_old := write_layout(p_app, p_page, p_token, p_changes, p_fail_after_import);
    -- SQL cannot call a JSON object type's methods (ORA-40573), so the text is taken first.
    l_txt := l_old.to_clob;
    INSERT INTO VD_LAYOUT_VERSIONS (WORKSPACE_ID, APP_ID, PAGE_ID, CHANGES, SAVED_BY)
    VALUES (l_ws, p_app, p_page, l_txt,
            COALESCE(SYS_CONTEXT('APEX$SESSION', 'APP_USER'), SYS_CONTEXT('USERENV', 'SESSION_USER')));
    DELETE FROM VD_LAYOUT_VERSIONS
     WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
       AND VERSION_ID NOT IN (SELECT VERSION_ID FROM VD_LAYOUT_VERSIONS
                               WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
                               ORDER BY VERSION_ID DESC FETCH FIRST 10 ROWS ONLY);
    RETURN PKG_VD_PAGE_CODE.layout_token(p_app, p_page);
  END apply_layout;

  FUNCTION undo_layout(p_app IN NUMBER, p_page IN NUMBER, p_token IN VARCHAR2) RETURN VARCHAR2 IS
    l_ws  NUMBER := APEX_APPLICATION.GET_SECURITY_GROUP_ID;
    l_id  NUMBER;
    l_old CLOB;
    l_tmp JSON_ARRAY_T;
  BEGIN
    guard(p_app, p_page);
    BEGIN
      SELECT VERSION_ID, CHANGES INTO l_id, l_old
        FROM VD_LAYOUT_VERSIONS
       WHERE WORKSPACE_ID = l_ws AND APP_ID = p_app AND PAGE_ID = p_page
       ORDER BY VERSION_ID DESC FETCH FIRST 1 ROW ONLY;
    EXCEPTION
      WHEN NO_DATA_FOUND THEN
        RAISE_APPLICATION_ERROR(-20232, 'There is no layout change to undo on this page.');
    END;
    l_tmp := write_layout(p_app, p_page, p_token, l_old, FALSE);
    DELETE FROM VD_LAYOUT_VERSIONS WHERE VERSION_ID = l_id;
    RETURN PKG_VD_PAGE_CODE.layout_token(p_app, p_page);
  END undo_layout;
END PKG_VD_PAGE_WRITER;
/
