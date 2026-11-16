-- Diagnostic: lists the regions, buttons and items of one page whose call the Layout Board
-- cannot find in the page export (the cause of ORA-20234 on Layout Board apply).
-- Run in SQL Commands; set l_app and l_page first. Read only.
DECLARE
  l_app  NUMBER := 102;
  l_page NUMBER := 4;
  l_src  CLOB;
  l_bad  PLS_INTEGER := 0;
  PROCEDURE chk(p_kind VARCHAR2, p_head VARCHAR2, p_id NUMBER, p_name VARCHAR2) IS
    l_a PLS_INTEGER;
  BEGIN
    l_a := DBMS_LOB.INSTR(l_src, p_head || CHR(10) || ' p_id=>wwv_flow_imp.id(' || TO_CHAR(p_id) || ')');
    IF NVL(l_a, 0) = 0 THEN
      l_bad := l_bad + 1;
      DBMS_OUTPUT.PUT_LINE('NOT FOUND ' || p_kind || ' ' || p_id || ' ' || p_name);
    ELSIF NVL(DBMS_LOB.INSTR(l_src, CHR(10) || ');', l_a), 0) = 0 THEN
      l_bad := l_bad + 1;
      DBMS_OUTPUT.PUT_LINE('NO END ' || p_kind || ' ' || p_id || ' ' || p_name);
    END IF;
  END;
BEGIN
  l_src := apex_export.get_application(p_application_id => l_app,
             p_components => apex_t_varchar2('PAGE:' || l_page))(1).contents;
  FOR r IN (SELECT region_id, region_name FROM apex_application_page_regions
             WHERE application_id = l_app AND page_id = l_page) LOOP
    chk('region', 'wwv_flow_imp_page.create_page_plug(', r.region_id, r.region_name);
  END LOOP;
  FOR r IN (SELECT button_id, button_name FROM apex_application_page_buttons
             WHERE application_id = l_app AND page_id = l_page) LOOP
    chk('button', 'wwv_flow_imp_page.create_page_button(', r.button_id, r.button_name);
  END LOOP;
  FOR r IN (SELECT item_id, item_name FROM apex_application_page_items
             WHERE application_id = l_app AND page_id = l_page) LOOP
    chk('item', 'wwv_flow_imp_page.create_page_item(', r.item_id, r.item_name);
  END LOOP;
  DBMS_OUTPUT.PUT_LINE(l_bad || ' component(s) not matched; export length ' || DBMS_LOB.GETLENGTH(l_src));
END;
