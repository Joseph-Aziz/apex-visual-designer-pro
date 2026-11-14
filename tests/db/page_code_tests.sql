-- Parameters: @page_code_tests.sql VD_SCHEMA TEST_APP SCRATCH_PAGE
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
DEFINE TEST_APP = '&2'
DEFINE SCRATCH_PAGE = '&3'
-- Flutter designer: page code versions and page writer tests.
-- Run in SQL Commands (APEX workspace session) after install_pkg_vd_page_code.sql.
-- Uses scratch page &&SCRATCH_PAGE of app &&TEST_APP; it writes that page's CSS and JS and adds
-- version rows for it. Re-runnable: counts only look at rows added by this run.
SET SERVEROUTPUT ON
DECLARE
  c CONSTANT VARCHAR2(30) := &&VD_SCHEMA..PKG_VD_PAGE_CODE.c_start;
  e CONSTANT VARCHAR2(30) := &&VD_SCHEMA..PKG_VD_PAGE_CODE.c_end;
  nl CONSTANT VARCHAR2(1) := CHR(10);
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  l_css CLOB; l_js CLOB; l_tok VARCHAR2(100); l_n NUMBER; l_id NUMBER; l_d CLOB;
  l_orig_css CLOB; l_orig_js CLOB; l_start NUMBER; l_had NUMBER;
  -- The scratch page needs at least one region, one button and one item; the tests use the first of each.
  l_region NUMBER; l_item VARCHAR2(255);

  -- Versions with this note added by this run (read through the package API).
  FUNCTION cnt(p_note VARCHAR2) RETURN NUMBER IS
    l_cur SYS_REFCURSOR; v_id NUMBER; v_note VARCHAR2(30); v_by VARCHAR2(128); v_at TIMESTAMP WITH TIME ZONE; n NUMBER := 0;
  BEGIN
    l_cur := &&VD_SCHEMA..PKG_VD_PAGE_CODE.list_versions(&&TEST_APP, &&SCRATCH_PAGE);
    LOOP
      FETCH l_cur INTO v_id, v_note, v_by, v_at;
      EXIT WHEN l_cur%NOTFOUND;
      IF v_id > l_start AND v_note = p_note THEN n := n + 1; END IF;
    END LOOP;
    CLOSE l_cur;
    RETURN n;
  END;

  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
  PROCEDURE raises(p_name VARCHAR2, p_code NUMBER, p_sql VARCHAR2) IS
  BEGIN
    EXECUTE IMMEDIATE p_sql;
    ok(p_name || ' (no error raised)', FALSE);
  EXCEPTION WHEN OTHERS THEN
    ok(p_name || CASE WHEN SQLCODE <> p_code THEN ' got ' || SQLCODE END, SQLCODE = p_code);
  END;
  FUNCTION m(p_existing VARCHAR2, p_block VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN TO_CHAR(&&VD_SCHEMA..PKG_VD_PAGE_CODE.merge_block(p_existing, p_block));
  END;
BEGIN
  SELECT MIN(REGION_ID) INTO l_region FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE;
  SELECT MIN(ITEM_NAME) INTO l_item FROM APEX_APPLICATION_PAGE_ITEMS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE;
  -- merge_block mirrors js/flutter-codegen.js merge()
  ok('merge appends when no markers', m('a{}', 'X') = 'a{}' || nl || c || nl || 'X' || nl || e);
  ok('merge into empty text', m(NULL, 'X') = c || nl || 'X' || nl || e);
  ok('merge replaces only the block',
     m('before{}' || nl || c || nl || 'OLD' || nl || e || nl || 'after{}', 'NEW')
       = 'before{}' || nl || c || nl || 'NEW' || nl || e || nl || 'after{}');
  raises('merge refuses duplicate markers', -20231,
     'declare x clob; begin x := &&VD_SCHEMA..PKG_VD_PAGE_CODE.merge_block(''' || c || ' a ' || e || ' ' || c || ' b ' || e || ''', ''N''); end;');
  raises('merge refuses start without end', -20231,
     'declare x clob; begin x := &&VD_SCHEMA..PKG_VD_PAGE_CODE.merge_block(''a ' || c || ' b'', ''N''); end;');
  raises('merge refuses end without start', -20231,
     'declare x clob; begin x := &&VD_SCHEMA..PKG_VD_PAGE_CODE.merge_block(''a ' || e || ''', ''N''); end;');
  ok('merge with empty block removes the markers',
     m('before{}' || nl || c || nl || 'OLD' || nl || e || nl || 'after{}', NULL) = 'before{}' || nl || 'after{}');
  ok('merge with empty block and no markers keeps text', m('a{}', NULL) = 'a{}');

  -- code_token
  ok('token stable', &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('a', 'b') = &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('a', 'b'));
  ok('token changes with css', &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('a', 'b') <> &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('a ', 'b'));
  ok('token tells css from js', &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('ab', NULL) <> &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('a', 'b'));
  l_css := RPAD('x', 32000, 'x') || RPAD('y', 32000, 'y');
  ok('token covers long code', &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token(l_css, NULL)
        <> &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token(l_css || 'z', NULL));

  -- target guard
  raises('app 1 rejected', -20215, 'declare n number; begin n := &&VD_SCHEMA..PKG_VD_PAGE_CODE.version_count(1, 1); end;');
  raises('writer rejects app 1', -20215, 'declare a clob; b clob; begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(1, 1, a, b); end;');

  -- save and restore on scratch page &&SCRATCH_PAGE
  &&VD_SCHEMA..PKG_VD_PAGE_CODE.get_latest(&&TEST_APP, &&SCRATCH_PAGE, l_start, l_css, l_js, l_d);
  l_start := NVL(l_start, 0);
  l_had := &&VD_SCHEMA..PKG_VD_PAGE_CODE.version_count(&&TEST_APP, &&SCRATCH_PAGE);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.write_code(&&TEST_APP, &&SCRATCH_PAGE, 'p{color:red}', 'var a = ''it''''s'';');
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_orig_css, l_orig_js);
  ok('write_code round-trips quotes', l_orig_css = 'p{color:red}' AND l_orig_js = 'var a = ''it''''s'';');

  -- a write that fails after the import puts the page back as it was (it must never be lost)
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.g_fail_after_import := TRUE;
  BEGIN
    &&VD_SCHEMA..PKG_VD_PAGE_WRITER.write_code(&&TEST_APP, &&SCRATCH_PAGE, 'lost{}', NULL);
    ok('failed write_code raises', FALSE);
  EXCEPTION
    WHEN OTHERS THEN NULL;
  END;
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.g_fail_after_import := FALSE;
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGES WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE;
  ok('failed write_code keeps the page', l_n = 1);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_css, l_js);
  ok('failed write_code puts the old code back', l_css = l_orig_css AND l_js = l_orig_js);
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND REGION_ID = l_region;
  ok('failed write_code keeps the regions', l_n = 1);

  raises('save with stale token', -20230,
     'declare t varchar2(100); begin t := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.save_design(&&TEST_APP, &&SCRATCH_PAGE, ''0-0'', ''{}'', ''X'', NULL); end;');

  l_tok := &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token(l_orig_css, l_orig_js);
  l_tok := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.save_design(&&TEST_APP, &&SCRATCH_PAGE, l_tok, '{"components":[]}',
             'body #' || l_item || '_CONTAINER input { border-radius: 12px; }' || nl || '/' || nl || 'x{}', 'window.vdSaved = 1;');
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_css, l_js);
  ok('save keeps existing css before the block', l_css LIKE 'p{color:red}' || nl || c || '%');
  ok('save survives a line with only a slash', INSTR(l_css, nl || '/' || nl || 'x{}') > 0);
  ok('save writes js block', l_js LIKE 'var a%' || c || nl || 'window.vdSaved = 1;' || nl || e);
  ok('save returns the new token', l_tok = &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token(l_css, l_js));
  ok('first save snapshots the original code (only when the page had no versions)', cnt('ORIGINAL') = CASE WHEN l_had = 0 THEN 1 ELSE 0 END);
  &&VD_SCHEMA..PKG_VD_PAGE_CODE.get_latest(&&TEST_APP, &&SCRATCH_PAGE, l_n, l_css, l_js, l_d);
  ok('latest version holds the design', TO_CHAR(l_d) = '{"components":[]}');
  -- Restore target: a snapshot of the original code written above.
  l_id := &&VD_SCHEMA..PKG_VD_PAGE_CODE.add_version(&&TEST_APP, &&SCRATCH_PAGE, l_orig_css, l_orig_js, NULL, 'ORIGINAL');

  l_tok := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.save_design(&&TEST_APP, &&SCRATCH_PAGE, l_tok, '{"components":[1]}', 'q{}', NULL);
  ok('second save does not snapshot again', cnt('ORIGINAL') = CASE WHEN l_had = 0 THEN 2 ELSE 1 END);
  ok('each save adds a SAVED version', cnt('SAVED') = 2);

  -- someone edits the page outside the designer, then the owner restores the original
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.write_code(&&TEST_APP, &&SCRATCH_PAGE, 'edited{}', NULL);
  l_tok := &&VD_SCHEMA..PKG_VD_PAGE_CODE.code_token('edited{}', NULL);
  l_tok := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.restore_version(&&TEST_APP, &&SCRATCH_PAGE, l_tok, l_id);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_css, l_js);
  ok('restore writes the stored code back', l_css = l_orig_css AND l_js = l_orig_js);
  ok('restore records outside edits first', cnt('EDITED OUTSIDE') = 1);
  ok('restore records a RESTORED version', cnt('RESTORED') = 1);
  raises('restore of a foreign version', -20232,
     'declare t varchar2(100); begin t := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.restore_version(&&TEST_APP, &&SCRATCH_PAGE, ''' || l_tok || ''', -1); end;');

  -- page components survive saves
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_ITEMS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND ITEM_NAME = l_item;
  ok('item survives saves', l_n = 1);
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND REGION_ID = l_region;
  ok('region id stays the same', l_n = 1);

  -- set_static_id gives a region or button a Static ID and leaves the page code alone
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_orig_css, l_orig_js);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, 'region', l_region, 'vd_test_region');
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_REGIONS
   WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND REGION_ID = l_region AND STATIC_ID = 'vd_test_region';
  ok('region gets the static id', l_n = 1);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, 'region', l_region, 'vd_test_region2');
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_REGIONS
   WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND REGION_ID = l_region AND STATIC_ID = 'vd_test_region2';
  ok('static id can be changed', l_n = 1);
  SELECT MIN(BUTTON_ID) INTO l_id FROM APEX_APPLICATION_PAGE_BUTTONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE;
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, 'button', l_id, 'vd_test_btn');
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_BUTTONS
   WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND BUTTON_ID = l_id AND BUTTON_STATIC_ID = 'vd_test_btn';
  ok('button gets the static id', l_n = 1);
  &&VD_SCHEMA..PKG_VD_PAGE_WRITER.read_code(&&TEST_APP, &&SCRATCH_PAGE, l_css, l_js);
  ok('static id leaves page code alone', NVL(l_css, 'x') = NVL(l_orig_css, 'x') AND NVL(l_js, 'x') = NVL(l_orig_js, 'x'));
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_ITEMS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND ITEM_NAME = l_item;
  ok('item survives static id writes', l_n = 1);
  raises('static id must be a valid name', -20236,
     'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, ''region'', ' || l_region || ', ''1 bad"id''); end;');
  raises('static id must be unique on the page', -20237,
     'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, ''region'', ' || l_region || ', ''vd_test_btn''); end;');
  raises('static id cannot reuse an item name', -20237,
     'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, ''region'', ' || l_region || ', ''' || l_item || '''); end;');
  raises('static id needs a component of the page', -20238,
     'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, ''region'', -1, ''vd_x''); end;');
  raises('static id needs a known kind', -20238,
     'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_static_id(&&TEST_APP, &&SCRATCH_PAGE, ''item'', 1, ''vd_x''); end;');

  COMMIT;
  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
