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
    SELECT COUNT(*) INTO l_n FROM apex_application_page_items
     WHERE application_id = &&TEST_APP AND page_id = &&SCRATCH_PAGE
       AND item_id = TO_NUMBER(l_el.get_string('id'))
       AND NVL(TO_CHAR(region_id), '-') = NVL(l_el.get_string('region'), '-');
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
