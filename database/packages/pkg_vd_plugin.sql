-- APEX Visual Designer - PKG_VD_PLUGIN: render and AJAX functions of the region plug-in.
-- Installed into the host application's parsing schema by the plug-in itself, or into a separate
-- designer schema by database/install.sql (the host schema then has the synonym PKG_VD_PLUGIN).
-- Invoker rights: APEX metadata reads and page writes run as the host application's schema.

CREATE OR REPLACE PACKAGE PKG_VD_PLUGIN AUTHID CURRENT_USER AS
  -- Region attributes: attribute_01 authorization scheme name (empty = App Builder developers
  -- only), attribute_02 default target application id (empty = the host app), attribute_03
  -- height in pixels (default 800).
  PROCEDURE render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                   p_param IN apex_plugin.t_region_render_param,
                   p_result IN OUT NOCOPY apex_plugin.t_region_render_result);

  -- Every designer call. apex_application.g_x10 names the part: components, flutter, theme.
  PROCEDURE ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                 p_param IN apex_plugin.t_region_ajax_param,
                 p_result IN OUT NOCOPY apex_plugin.t_region_ajax_result);

  -- TRUE when the current session may design: an App Builder developer session when p_scheme is
  -- empty, otherwise the named authorization scheme of the host app. An unknown name is FALSE.
  FUNCTION allowed(p_scheme IN VARCHAR2) RETURN BOOLEAN;
  -- The same two callbacks in the function style APEX also uses for region plug-ins.
  FUNCTION render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                  p_is_printer_friendly IN BOOLEAN) RETURN apex_plugin.t_region_render_result;
  FUNCTION ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin)
    RETURN apex_plugin.t_region_ajax_result;
END PKG_VD_PLUGIN;
/

CREATE OR REPLACE PACKAGE BODY PKG_VD_PLUGIN AS
  -- Release of the editor files; it ends up in the iframe URL as ?v=, with the plug-in's file
  -- prefix (which APEX versions itself) in front of it.
  c_version CONSTANT VARCHAR2(20) := '1.1.0';

  -- A region attribute. APEX 26.2 keeps them in p_region.attributes; the classic
  -- attribute_NN fields stay empty for regions created or edited in 26.2.
  FUNCTION attr(p_region IN apex_plugin.t_region, p_name IN VARCHAR2) RETURN VARCHAR2 IS
  BEGIN
    RETURN p_region.attributes.get_varchar2(p_name);
  END attr;

  FUNCTION allowed(p_scheme IN VARCHAR2) RETURN BOOLEAN IS
    l_n NUMBER;
  BEGIN
    IF p_scheme IS NULL THEN
      RETURN COALESCE(v('APP_BUILDER_SESSION'), TO_CHAR(apex_application.g_edit_cookie_session_id)) IS NOT NULL;
    END IF;
    EXECUTE IMMEDIATE 'SELECT COUNT(*) FROM APEX_APPLICATION_AUTHORIZATION WHERE APPLICATION_ID = :a AND AUTHORIZATION_SCHEME_NAME = :n'
      INTO l_n USING NV('APP_ID'), p_scheme;
    RETURN l_n > 0 AND apex_authorization.is_authorized(p_scheme);
  EXCEPTION
    WHEN OTHERS THEN RETURN FALSE;
  END allowed;

  PROCEDURE render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                   p_param IN apex_plugin.t_region_render_param,
                   p_result IN OUT NOCOPY apex_plugin.t_region_render_result) IS
    l_app    NUMBER := COALESCE(TO_NUMBER(attr(p_region, 'attribute_02') DEFAULT NULL ON CONVERSION ERROR), NV('APP_ID'));
    l_height NUMBER := COALESCE(TO_NUMBER(attr(p_region, 'attribute_03') DEFAULT NULL ON CONVERSION ERROR), 800);
  BEGIN
    IF NOT allowed(attr(p_region, 'attribute_01')) THEN
      sys.htp.p('<p class="vd-denied">You are not allowed to use the Visual Designer.</p>');
      RETURN;
    END IF;
    sys.htp.p('<iframe class="vd-designer" title="APEX Visual Designer" style="display:block;width:100%;height:' ||
      l_height || 'px;border:0" src="' || apex_escape.html_attribute(p_plugin.file_prefix) || 'index.html?v=' ||
      c_version || chr(38) || 'ajax=' ||
      apex_escape.html_attribute(apex_plugin.get_ajax_identifier) || chr(38) || 'app=' || l_app || '"></iframe>');
  END render;

  -- TRUE when the host application and p_app share one APEX session: both current
  -- authentication schemes use the same session cookie (Workspace Sharing or a custom name).
  FUNCTION shares_session(p_app IN NUMBER) RETURN BOOLEAN IS
    l_n PLS_INTEGER;
  BEGIN
    SELECT COUNT(*) INTO l_n
      FROM apex_application_auth h
      JOIN apex_application_auth t ON t.cookie_name = h.cookie_name
     WHERE h.application_id = apex_application.g_flow_id AND h.is_current_authentication = 'Y'
       AND t.application_id = p_app AND t.is_current_authentication = 'Y'
       AND h.cookie_name IS NOT NULL;
    RETURN l_n > 0;
  EXCEPTION
    WHEN OTHERS THEN RETURN FALSE;
  END shares_session;

  PROCEDURE do_components IS
  l_app  NUMBER;
    l_page NUMBER;
  BEGIN
    BEGIN
      l_app  := TO_NUMBER(apex_application.g_x01);
      l_page := TO_NUMBER(apex_application.g_x02);
    EXCEPTION
      WHEN VALUE_ERROR THEN
        RAISE_APPLICATION_ERROR(-20215, 'Application is not a registered active target.');
    END;
    pkg_vd_design_api.assert_target_app(l_app);

    apex_json.open_object;
    apex_json.write('success', TRUE);
    apex_json.write('sharedSession', shares_session(l_app));
    apex_json.open_array('regions');
    FOR r IN (
      SELECT r.region_css_classes, r.region_id, r.static_id, r.region_name, COALESCE(r.source_type_plugin_name, r.source_type_code) source_type_code, p.static_id parent_static_id, r.display_sequence
        FROM apex_application_page_regions r
        LEFT JOIN apex_application_page_regions p ON p.region_id = r.parent_region_id
       WHERE r.application_id = l_app AND r.page_id = l_page
       ORDER BY r.display_sequence, r.region_id
    ) LOOP
      apex_json.open_object;
      apex_json.write('id', TO_CHAR(r.region_id));
      apex_json.write('staticId', r.static_id);
      apex_json.write('name', r.region_name);
      apex_json.write('type', r.source_type_code);
      apex_json.write('component', CASE r.source_type_code WHEN 'NATIVE_IG' THEN 'ig'
                                       WHEN 'NATIVE_IR' THEN 'ir'
                                       WHEN 'NATIVE_SQL_REPORT' THEN 'classic' END);
      apex_json.write('parentStaticId', r.parent_static_id);
      apex_json.write('cssClasses', r.region_css_classes);
      apex_json.write('needsStaticId', r.static_id IS NULL);
      apex_json.close_object;
    END LOOP;
    apex_json.close_array;
    apex_json.open_array('items');
    FOR i IN (
      SELECT i.item_id, i.item_css_classes, i.item_name, i.display_as_code, r.static_id region_static_id
        FROM apex_application_page_items i
        LEFT JOIN apex_application_page_regions r ON r.region_id = i.region_id
       WHERE i.application_id = l_app AND i.page_id = l_page
         AND i.display_as_code <> 'NATIVE_HIDDEN'
       ORDER BY i.display_sequence, i.item_id
    ) LOOP
      apex_json.open_object;
      apex_json.write('name', i.item_name);
      apex_json.write('type', i.display_as_code);
      apex_json.write('regionStaticId', i.region_static_id);
      apex_json.write('id', TO_CHAR(i.item_id));
      apex_json.write('cssClasses', i.item_css_classes);
      apex_json.close_object;
    END LOOP;
    apex_json.close_array;
    apex_json.open_array('buttons');
    FOR b IN (
      SELECT b.button_css_classes, b.button_id, b.button_static_id, b.button_name, r.static_id region_static_id
        FROM apex_application_page_buttons b
        LEFT JOIN apex_application_page_regions r ON r.region_id = b.region_id
       WHERE b.application_id = l_app AND b.page_id = l_page
       ORDER BY b.button_sequence, b.button_id
    ) LOOP
      apex_json.open_object;
      apex_json.write('id', TO_CHAR(b.button_id));
      apex_json.write('staticId', b.button_static_id);
      apex_json.write('name', b.button_name);
      apex_json.write('regionStaticId', b.region_static_id);
      apex_json.write('needsStaticId', b.button_static_id IS NULL);
      apex_json.write('cssClasses', b.button_css_classes);
      apex_json.close_object;
    END LOOP;
    apex_json.close_array;
    apex_json.close_object;
  EXCEPTION
    WHEN OTHERS THEN
      apex_json.open_object;
      apex_json.write('success', FALSE);
      apex_json.write('code', SQLCODE);
      apex_json.write('message',
        CASE WHEN SQLCODE BETWEEN -20299 AND -20200 THEN SQLERRM
             ELSE 'Page component read failed.' END);
      apex_json.close_object;
    END do_components;

  PROCEDURE do_flutter IS
  l_app    NUMBER;
    l_page   NUMBER;
    l_action VARCHAR2(20) := apex_application.g_x03;
    l_css    CLOB;
    l_js     CLOB;
    l_vid    NUMBER;
    l_v_css  CLOB;
    l_v_js   CLOB;
    l_design CLOB;
    l_token  VARCHAR2(100);
    l_body   JSON_OBJECT_T;
    l_cur    SYS_REFCURSOR;
    v_id     NUMBER;
    v_note   VARCHAR2(30);
    v_by     VARCHAR2(128);
    v_at     TIMESTAMP WITH TIME ZONE;
  BEGIN
    BEGIN
      l_app  := TO_NUMBER(apex_application.g_x01);
      l_page := TO_NUMBER(apex_application.g_x02);
    EXCEPTION
      WHEN VALUE_ERROR THEN
        RAISE_APPLICATION_ERROR(-20215, 'Application is not a registered active target.');
    END;
    pkg_vd_design_api.assert_target_app(l_app);

    -- Do all the work first, so a failure never leaves half-written JSON.
    IF l_action = 'read' THEN
      pkg_vd_page_writer.read_code(l_app, l_page, l_css, l_js);
      pkg_vd_page_code.get_latest(l_app, l_page, l_vid, l_v_css, l_v_js, l_design);
      l_token := pkg_vd_page_code.code_token(l_css, l_js);
    ELSIF l_action = 'save' THEN
      l_body := JSON_OBJECT_T.parse(apex_application.g_clob_01);
      l_token := pkg_vd_page_writer.save_design(l_app, l_page, apex_application.g_x04,
        l_body.get_object('design').to_clob, l_body.get_clob('css'), l_body.get_clob('js'));
    ELSIF l_action = 'restore' THEN
      l_token := pkg_vd_page_writer.restore_version(l_app, l_page, apex_application.g_x04,
        TO_NUMBER(apex_application.g_x05));
    ELSIF l_action = 'staticid' THEN
      pkg_vd_page_writer.set_static_id(l_app, l_page, apex_application.g_x05,
        TO_NUMBER(apex_application.g_x06), apex_application.g_x07);
    ELSIF l_action = 'cssclass' THEN
      pkg_vd_page_writer.set_css_class(l_app, l_page, apex_application.g_x05,
        TO_NUMBER(apex_application.g_x06), apex_application.g_x07, apex_application.g_x08);
    ELSIF l_action = 'history' THEN
      l_cur := pkg_vd_page_code.list_versions(l_app, l_page);
    ELSE
      RAISE_APPLICATION_ERROR(-20233, 'Unknown designer action.');
    END IF;

    apex_json.open_object;
    apex_json.write('success', TRUE);
    IF l_token IS NOT NULL THEN apex_json.write('token', l_token); END IF;
    IF l_action = 'read' THEN
      apex_json.write('css', l_css);
      apex_json.write('js', l_js);
      IF l_design IS NOT NULL THEN apex_json.write_raw('design', l_design); END IF;
    ELSIF l_action = 'history' THEN
      apex_json.open_array('versions');
      LOOP
        FETCH l_cur INTO v_id, v_note, v_by, v_at;
        EXIT WHEN l_cur%NOTFOUND;
        apex_json.open_object;
        apex_json.write('versionId', v_id);
        apex_json.write('note', v_note);
        apex_json.write('savedBy', v_by);
        apex_json.write('savedAt', TO_CHAR(v_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'));
        apex_json.close_object;
      END LOOP;
      CLOSE l_cur;
      apex_json.close_array;
    END IF;
    apex_json.close_object;
  EXCEPTION
    WHEN OTHERS THEN
      apex_json.open_object;
      apex_json.write('success', FALSE);
      apex_json.write('code', SQLCODE);
      apex_json.write('message',
        CASE WHEN SQLCODE BETWEEN -20299 AND -20200 OR SQLCODE = -20001 THEN SQLERRM
             ELSE 'Flutter designer request failed.' END);
      apex_debug.error('VD_FLUTTER %s: %s', SQLERRM, DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);
      apex_json.close_object;
    END do_flutter;

  PROCEDURE do_theme IS
  l_app    NUMBER;
    l_action VARCHAR2(20) := apex_application.g_x02;
    l_id     NUMBER;
    l_theme  CLOB;
    l_css    CLOB;
    l_js     CLOB;
    l_note   VARCHAR2(10);
    l_p_id   NUMBER;
    l_p_th   CLOB;
    l_p_css  CLOB;
    l_p_js   CLOB;
    l_p_note VARCHAR2(10);
    l_body   JSON_OBJECT_T;
    l_cur    SYS_REFCURSOR;
    v_id     NUMBER;
    v_note   VARCHAR2(30);
    v_by     VARCHAR2(128);
    v_at     TIMESTAMP WITH TIME ZONE;
  BEGIN
    BEGIN
      l_app := TO_NUMBER(apex_application.g_x01);
    EXCEPTION
      WHEN VALUE_ERROR THEN
        RAISE_APPLICATION_ERROR(-20215, 'Application is not a registered active target.');
    END;
    pkg_vd_design_api.assert_target_app(l_app);

    IF l_action = 'read' THEN
      pkg_vd_theme.get_latest(l_app, 'N', l_id, l_theme, l_css, l_js, l_note);
      pkg_vd_theme.get_latest(l_app, 'Y', l_p_id, l_p_th, l_p_css, l_p_js, l_p_note);
    ELSIF l_action IN ('draft', 'push') THEN
      l_body := JSON_OBJECT_T.parse(apex_application.g_clob_01);
      IF l_action = 'draft' THEN
        l_id := pkg_vd_theme.add_version(l_app, l_body.get_object('theme').to_clob,
          l_body.get_clob('css'), l_body.get_clob('js'), 'DRAFT');
      ELSE
        l_id := pkg_vd_page_writer.push_theme(l_app, l_body.get_object('theme').to_clob,
          l_body.get_clob('css'), l_body.get_clob('js'));
      END IF;
    ELSIF l_action = 'restore' THEN
      l_id := pkg_vd_page_writer.restore_theme(l_app, TO_NUMBER(apex_application.g_x03));
    ELSIF l_action = 'history' THEN
      l_cur := pkg_vd_theme.list_versions(l_app);
    ELSE
      RAISE_APPLICATION_ERROR(-20233, 'Unknown designer action.');
    END IF;

    apex_json.open_object;
    apex_json.write('success', TRUE);
    IF l_action = 'read' THEN
      IF l_theme IS NOT NULL THEN apex_json.write_raw('theme', l_theme); END IF;
      apex_json.write('versionId', l_id);
      apex_json.write('note', l_note);
      IF l_p_th IS NOT NULL THEN
        apex_json.open_object('pushed');
        apex_json.write_raw('theme', l_p_th);
        apex_json.write('versionId', l_p_id);
        apex_json.close_object;
      ELSE
        apex_json.write('pushed', CAST(NULL AS VARCHAR2), TRUE);
      END IF;
    ELSIF l_action = 'history' THEN
      apex_json.open_array('versions');
      LOOP
        FETCH l_cur INTO v_id, v_note, v_by, v_at;
        EXIT WHEN l_cur%NOTFOUND;
        apex_json.open_object;
        apex_json.write('versionId', v_id);
        apex_json.write('note', v_note);
        apex_json.write('savedBy', v_by);
        apex_json.write('savedAt', TO_CHAR(v_at, 'YYYY-MM-DD"T"HH24:MI:SSTZH:TZM'));
        apex_json.close_object;
      END LOOP;
      CLOSE l_cur;
      apex_json.close_array;
    ELSE
      apex_json.write('versionId', l_id);
    END IF;
    apex_json.close_object;
  EXCEPTION
    WHEN OTHERS THEN
      apex_json.open_object;
      apex_json.write('success', FALSE);
      apex_json.write('code', SQLCODE);
      apex_json.write('message',
        CASE WHEN SQLCODE BETWEEN -20299 AND -20200 THEN SQLERRM
             ELSE 'Theme designer request failed.' END);
      apex_debug.error('VD_THEME %s: %s', SQLERRM, DBMS_UTILITY.FORMAT_ERROR_BACKTRACE);
      apex_json.close_object;
    END do_theme;

  PROCEDURE ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                 p_param IN apex_plugin.t_region_ajax_param,
                 p_result IN OUT NOCOPY apex_plugin.t_region_ajax_result) IS
  BEGIN
    IF NOT allowed(attr(p_region, 'attribute_01')) THEN
      RAISE_APPLICATION_ERROR(-20235, 'You are not allowed to use the Visual Designer.');
    END IF;
    CASE apex_application.g_x10
      WHEN 'components' THEN do_components;
      WHEN 'flutter' THEN do_flutter;
      WHEN 'theme' THEN do_theme;
      ELSE RAISE_APPLICATION_ERROR(-20233, 'Unknown designer action.');
    END CASE;
  EXCEPTION
    WHEN OTHERS THEN
      apex_json.open_object;
      apex_json.write('success', FALSE);
      apex_json.write('code', SQLCODE);
      apex_json.write('message', CASE WHEN SQLCODE BETWEEN -20299 AND -20200 THEN SQLERRM ELSE 'Visual Designer request failed.' END);
      apex_json.close_object;
  END ajax;

  FUNCTION render(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin,
                  p_is_printer_friendly IN BOOLEAN) RETURN apex_plugin.t_region_render_result IS
    l_param  apex_plugin.t_region_render_param;
    l_result apex_plugin.t_region_render_result;
  BEGIN
    render(p_region, p_plugin, l_param, l_result);
    RETURN l_result;
  END render;

  FUNCTION ajax(p_region IN apex_plugin.t_region, p_plugin IN apex_plugin.t_plugin)
    RETURN apex_plugin.t_region_ajax_result IS
    l_param  apex_plugin.t_region_ajax_param;
    l_result apex_plugin.t_region_ajax_result;
  BEGIN
    ajax(p_region, p_plugin, l_param, l_result);
    RETURN l_result;
  END ajax;
END PKG_VD_PLUGIN;
/
