-- Parameters: @theme_tests.sql VD_SCHEMA TEST_APP SCRATCH_PAGE
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
DEFINE TEST_APP = '&2'
DEFINE SCRATCH_PAGE = '&3'
-- App theme: theme versions, push to page 0 and CSS class writer tests.
-- Run in SQL Commands (APEX workspace session, as the host schema) after
-- install_pkg_vd_theme.sql and install_pkg_vd_page_code.sql.
-- It pushes a harmless test theme into app &&TEST_APP (static file vd-theme.css and the page 0
-- region vd-theme-link) and changes the CSS classes of the first region of scratch page &&SCRATCH_PAGE.
-- Re-importing page 0 ends signed-in app sessions.
SET SERVEROUTPUT ON
DECLARE
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  c_theme CONSTANT VARCHAR2(100) := '{"global":{},"types":{}}';
  c_css   CONSTANT VARCHAR2(100) := '/* vd-theme test */';
  l_id NUMBER; l_id2 NUMBER; l_id3 NUMBER; l_n NUMBER; l_regions NUMBER; l_src VARCHAR2(4000);
  l_theme CLOB; l_css CLOB; l_js CLOB; l_note VARCHAR2(10); l_vid NUMBER;
  l_other_before NUMBER; l_other_after NUMBER;
  l_region NUMBER; l_classes VARCHAR2(4000);

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
    ok(p_name || CASE WHEN SQLCODE <> p_code THEN ' got ' || SQLCODE || ' ' || SQLERRM END, SQLCODE = p_code);
  END;
  FUNCTION link_count RETURN NUMBER IS n NUMBER;
  BEGIN
    SELECT COUNT(*) INTO n FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = 0 AND STATIC_ID = 'vd-theme-link';
    RETURN n;
  END;
  FUNCTION link_source RETURN VARCHAR2 IS s VARCHAR2(4000);
  BEGIN
    SELECT MAX(DBMS_LOB.SUBSTR(REGION_SOURCE, 4000, 1)) INTO s FROM APEX_APPLICATION_PAGE_REGIONS
     WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = 0 AND STATIC_ID = 'vd-theme-link';
    RETURN s;
  END;
  -- Content of the page 0 regions other than the theme link (a re-import renews their
  -- timestamps, so the test compares what they hold).
  FUNCTION others_hash RETURN NUMBER IS n NUMBER;
  BEGIN
    SELECT SUM(ORA_HASH(REGION_ID || '|' || REGION_NAME || '|' || TEMPLATE || '|' || DISPLAY_SEQUENCE || '|' || DISPLAY_POSITION || '|' ||
                        REGION_CSS_CLASSES || '|' || DBMS_LOB.GETLENGTH(REGION_SOURCE) || '|' || DBMS_LOB.SUBSTR(REGION_SOURCE, 3000, 1)))
      INTO n FROM APEX_APPLICATION_PAGE_REGIONS
     WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = 0 AND NVL(STATIC_ID, '-') <> 'vd-theme-link';
    RETURN n;
  END;
  FUNCTION region_classes RETURN VARCHAR2 IS s VARCHAR2(4000);
  BEGIN
    SELECT REGION_CSS_CLASSES INTO s FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE AND REGION_ID = l_region;
    RETURN s;
  END;
BEGIN
  -- 1. drafts
  l_id := &&VD_SCHEMA..PKG_VD_THEME.add_version(&&TEST_APP, c_theme, c_css, NULL, 'DRAFT');
  &&VD_SCHEMA..PKG_VD_THEME.get_latest(&&TEST_APP, 'N', l_vid, l_theme, l_css, l_js, l_note);
  ok('draft is the latest version', l_vid = l_id AND l_note = 'DRAFT');
  raises('invalid theme json', -20240, q'[declare n number; begin n := &&VD_SCHEMA..PKG_VD_THEME.add_version(&&TEST_APP, 'not json', null, null, 'DRAFT'); end;]');

  -- 2. first push creates exactly one link region
  SELECT COUNT(*) INTO l_regions FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = 0 AND NVL(STATIC_ID, '-') <> 'vd-theme-link';
  l_other_before := others_hash;
  l_id2 := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.push_theme(&&TEST_APP, c_theme, c_css, NULL);
  ok('push makes one link region', link_count = 1);
  ok('link points at the pushed version', INSTR(link_source, 'vd-theme.css?v=' || l_id2 || '"') > 0);
  ok('no script without js', INSTR(link_source, 'vd-theme.js') = 0);

  -- 5. the static file holds the css
  SELECT MAX(DBMS_LOB.GETLENGTH(FILE_CONTENT)) INTO l_n FROM APEX_APPLICATION_STATIC_FILES WHERE APPLICATION_ID = &&TEST_APP AND FILE_NAME = 'vd-theme.css';
  ok('vd-theme.css uploaded', l_n = LENGTH(c_css));

  -- 3. second push (with js) edits the same region
  l_id3 := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.push_theme(&&TEST_APP, c_theme, c_css, '/* js */');
  ok('second push keeps one link region', link_count = 1);
  ok('second push has the new version', INSTR(link_source, 'vd-theme.css?v=' || l_id3 || '"') > 0 AND INSTR(link_source, 'vd-theme.js?v=' || l_id3) > 0);
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = 0 AND NVL(STATIC_ID, '-') <> 'vd-theme-link';
  ok('other page 0 regions are still there', l_n = l_regions);

  -- 4. other page 0 regions are unchanged
  l_other_after := others_hash;
  ok('other page 0 regions not edited', l_other_after = l_other_before);

  -- 6. restore (no js) re-links and removes the js file
  l_vid := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.restore_theme(&&TEST_APP, l_id2);
  &&VD_SCHEMA..PKG_VD_THEME.get_latest(&&TEST_APP, 'Y', l_n, l_theme, l_css, l_js, l_note);
  ok('restore adds a RESTORED version', l_n = l_vid AND l_note = 'RESTORED');
  ok('restore re-links', INSTR(link_source, 'vd-theme.css?v=' || l_vid || '"') > 0 AND INSTR(link_source, 'vd-theme.js') = 0);
  SELECT COUNT(*) INTO l_n FROM APEX_APPLICATION_STATIC_FILES WHERE APPLICATION_ID = &&TEST_APP AND FILE_NAME = 'vd-theme.js';
  ok('vd-theme.js removed when the theme has no js', l_n = 0);

  -- 9. unknown version
  raises('restore unknown version', -20242, 'declare n number; begin n := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.restore_theme(&&TEST_APP, -1); end;');
  raises('restore a draft', -20242, 'declare n number; begin n := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.restore_theme(&&TEST_APP, ' || l_id || '); end;');

  -- 7. css classes on scratch page &&SCRATCH_PAGE
  SELECT MIN(REGION_ID) INTO l_region FROM APEX_APPLICATION_PAGE_REGIONS WHERE APPLICATION_ID = &&TEST_APP AND PAGE_ID = &&SCRATCH_PAGE;
  IF l_region IS NULL THEN
    ok('page &&SCRATCH_PAGE has a region for the class tests', FALSE);
  ELSE
    &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_css_class(&&TEST_APP, &&SCRATCH_PAGE, 'region', l_region, 'region', 'outlined');
    ok('class added', INSTR(' ' || region_classes || ' ', ' vd-region-outlined ') > 0);
    &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_css_class(&&TEST_APP, &&SCRATCH_PAGE, 'region', l_region, 'region', 'card');
    ok('class replaced', INSTR(region_classes, 'vd-region-outlined') = 0 AND INSTR(' ' || region_classes || ' ', ' vd-region-card ') > 0);
    &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_css_class(&&TEST_APP, &&SCRATCH_PAGE, 'region', l_region, 'region', NULL);
    ok('class removed', INSTR(NVL(region_classes, ' '), 'vd-region-') = 0);
    -- 8. bad names and unknown components
    raises('bad class name', -20236, 'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_css_class(&&TEST_APP, &&SCRATCH_PAGE, ''region'', ' || l_region || ', ''region'', ''Out Lined''); end;');
    raises('component not on page', -20238, 'begin &&VD_SCHEMA..PKG_VD_PAGE_WRITER.set_css_class(&&TEST_APP, &&SCRATCH_PAGE, ''region'', -1, ''region'', ''card''); end;');
  END IF;

  COMMIT;
  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
