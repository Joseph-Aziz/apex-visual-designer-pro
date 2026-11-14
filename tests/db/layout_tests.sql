-- Parameters: @layout_tests.sql VD_SCHEMA TEST_APP SCRATCH_PAGE
SET DEFINE ON
SET VERIFY OFF
DEFINE VD_SCHEMA = '&1'
DEFINE TEST_APP = '&2'
DEFINE SCRATCH_PAGE = '&3'
-- Layout board: reading a page's layout. Read only; run in SQL Commands (APEX workspace session).
-- The scratch page needs at least one region and one item in a region, on a template with a Body slot.
SET SERVEROUTPUT ON
DECLARE
  l_pass PLS_INTEGER := 0;
  l_fail PLS_INTEGER := 0;
  l_json CLOB;
  l_obj  JSON_OBJECT_T;
  l_arr  JSON_ARRAY_T;
  l_el   JSON_OBJECT_T;
  l_n    NUMBER;
  l_bad  PLS_INTEGER := 0;
  l_grid BOOLEAN := FALSE;
  l_id     VARCHAR2(40);
  l_region VARCHAR2(40);

  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
BEGIN
  l_json := &&VD_SCHEMA..PKG_VD_PAGE_CODE.layout_json(&&TEST_APP, &&SCRATCH_PAGE);
  ok('layout is valid JSON', l_json IS JSON);
  l_obj := JSON_OBJECT_T.parse(l_json);
  ok('token matches layout_token',
     l_obj.get_string('token') = &&VD_SCHEMA..PKG_VD_PAGE_CODE.layout_token(&&TEST_APP, &&SCRATCH_PAGE));

  SELECT COUNT(*) INTO l_n FROM apex_application_page_regions
   WHERE application_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE;
  ok('one entry per region', l_obj.get_array('regions').get_size = l_n);

  l_arr := l_obj.get_array('items');
  FOR i IN 0 .. l_arr.get_size - 1 LOOP
    l_el := TREAT(l_arr.get(i) AS JSON_OBJECT_T);
    -- JSON object methods cannot be called inside SQL, so read the values first.
    l_id := l_el.get_string('id');
    l_region := l_el.get_string('region');
    SELECT COUNT(*) INTO l_n FROM apex_application_page_items
     WHERE application_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE
       AND item_id = TO_NUMBER(l_id)
       AND NVL(TO_CHAR(region_id), '-') = NVL(l_region, '-');
    IF l_n = 0 THEN l_bad := l_bad + 1; END IF;
  END LOOP;
  ok('each item sits in its dictionary region', l_bad = 0 AND l_arr.get_size > 0);

  l_arr := l_obj.get_array('slots');
  FOR i IN 0 .. l_arr.get_size - 1 LOOP
    l_el := TREAT(l_arr.get(i) AS JSON_OBJECT_T);
    IF l_el.get_string('name') = 'BODY' AND l_el.get_boolean('grid') THEN l_grid := TRUE; END IF;
  END LOOP;
  ok('BODY slot uses the grid', l_grid);

  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/

-- Layout board: applying and undoing changes. WRITES the scratch page; run only on a scratch page.
-- Each change is undone at the end, so the page ends as it started.
DECLARE
  l_pass  PLS_INTEGER := 0;
  l_fail  PLS_INTEGER := 0;
  l_token VARCHAR2(40);
  l_r1    VARCHAR2(40);
  l_seq   NUMBER;
  l_n     NUMBER;

  PROCEDURE ok(p_name VARCHAR2, p_cond BOOLEAN) IS
  BEGIN
    IF p_cond THEN l_pass := l_pass + 1; DBMS_OUTPUT.PUT_LINE('PASS ' || p_name);
    ELSE l_fail := l_fail + 1; DBMS_OUTPUT.PUT_LINE('FAIL ' || p_name); END IF;
  END;
  -- Runs a change list that must be refused with p_code.
  PROCEDURE refused(p_name VARCHAR2, p_token VARCHAR2, p_changes VARCHAR2, p_code NUMBER) IS
    l_t VARCHAR2(40);
  BEGIN
    l_t := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.apply_layout(&&TEST_APP, &&SCRATCH_PAGE, p_token, p_changes);
    ok(p_name, FALSE);
  EXCEPTION
    WHEN OTHERS THEN ok(p_name || ' (' || SQLCODE || ')', SQLCODE = p_code);
  END;
  FUNCTION region_seq(p_id VARCHAR2) RETURN NUMBER IS
    l_s NUMBER;
  BEGIN
    SELECT display_sequence INTO l_s FROM apex_application_page_regions
     WHERE application_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE AND region_id = TO_NUMBER(p_id);
    RETURN l_s;
  END;
BEGIN
  SELECT TO_CHAR(region_id), display_sequence INTO l_r1, l_seq FROM apex_application_page_regions
   WHERE application_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE AND parent_region_id IS NULL
     AND display_position_code = 'BODY'
   ORDER BY display_sequence FETCH FIRST 1 ROW ONLY;
  l_token := &&VD_SCHEMA..PKG_VD_PAGE_CODE.layout_token(&&TEST_APP, &&SCRATCH_PAGE);

  refused('stale token refused', 'x' || l_token,
    '[{"kind":"region","id":"' || l_r1 || '","slot":"BODY","parent":null,"seq":5}]', -20230);
  refused('unknown region refused', l_token,
    '[{"kind":"region","id":"1","slot":"BODY","parent":null,"seq":5}]', -20243);
  refused('region inside itself refused', l_token,
    '[{"kind":"region","id":"' || l_r1 || '","parent":"' || l_r1 || '","seq":5}]', -20243);
  refused('span 13 refused', l_token,
    '[{"kind":"region","id":"' || l_r1 || '","slot":"BODY","parent":null,"seq":5,"span":13}]', -20243);
  refused('unknown slot refused', l_token,
    '[{"kind":"region","id":"' || l_r1 || '","slot":"NO_SUCH_SLOT","parent":null,"seq":5}]', -20243);
  refused('empty change list refused', l_token, '[]', -20243);
  BEGIN
    l_token := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.apply_layout(&&TEST_APP, &&SCRATCH_PAGE, l_token,
      '[{"kind":"region","id":"' || l_r1 || '","slot":"BODY","parent":null,"seq":' || (l_seq + 1) || '}]', TRUE);
    ok('failure after import raises', FALSE);
  EXCEPTION
    WHEN OTHERS THEN ok('failure after import puts the page back', region_seq(l_r1) = l_seq);
  END;
  l_token := &&VD_SCHEMA..PKG_VD_PAGE_CODE.layout_token(&&TEST_APP, &&SCRATCH_PAGE);

  l_token := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.apply_layout(&&TEST_APP, &&SCRATCH_PAGE, l_token,
    '[{"kind":"region","id":"' || l_r1 || '","slot":"BODY","parent":null,"seq":' || (l_seq + 1) || '}]');
  ok('apply writes the sequence', region_seq(l_r1) = l_seq + 1);
  ok('apply returns the new token', l_token = &&VD_SCHEMA..PKG_VD_PAGE_CODE.layout_token(&&TEST_APP, &&SCRATCH_PAGE));
  SELECT COUNT(*) INTO l_n FROM &&VD_SCHEMA..VD_LAYOUT_VERSIONS WHERE app_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE;
  ok('apply keeps a version', l_n >= 1);

  l_token := &&VD_SCHEMA..PKG_VD_PAGE_WRITER.undo_layout(&&TEST_APP, &&SCRATCH_PAGE, l_token);
  ok('undo puts the sequence back', region_seq(l_r1) = l_seq);
  SELECT COUNT(*) - l_n INTO l_n FROM &&VD_SCHEMA..VD_LAYOUT_VERSIONS WHERE app_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE;
  ok('undo forgets the version', l_n = -1);

  DBMS_OUTPUT.PUT_LINE(l_pass || ' passed, ' || l_fail || ' failed');
END;
/
