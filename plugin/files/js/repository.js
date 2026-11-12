/* APEX Visual Designer - server calls. Every call goes to the AJAX handler of the Visual
   Designer region that hosts this editor (VD.config.ajax), with x10 naming the handler part:
   components (page components), flutter (page designs), theme (app theme), register (add an app). */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;

  function repoError(code, message) {
    var e = new Error(message || 'Repository operation failed.');
    e.code = code;
    return e;
  }

  // The host page's apex object (the editor runs in a same-origin iframe of the region).
  function apexApi() {
    try {
      if (window.parent && window.parent.apex && window.parent.apex.server && window.parent.apex.server.plugin) return window.parent.apex;
    } catch (e) { /* not same origin */ }
    return null;
  }

  var PART = { VD_PAGE_COMPONENTS: 'components', VD_FLUTTER: 'flutter', VD_THEME: 'theme', VD_REGISTER: 'register' };

  function callProcess(name, data) {
    var api = apexApi(), ajax = VD.config && VD.config.ajax;
    if (!api || !ajax) return Promise.reject(repoError('VD_OFFLINE', 'The designer must run inside an APEX Visual Designer region.'));
    var payload = {};
    Object.keys(data || {}).forEach(function (k) { payload[k] = data[k]; });
    payload.x10 = PART[name];
    return new Promise(function (resolve, reject) {
      try {
        var req = api.server.plugin(ajax, payload, { dataType: 'json' });
        if (req && typeof req.done === 'function') {
          req.done(function (response) {
            if (response && response.success === false) {
              reject(repoError(response.code || 'VD_REPOSITORY_ERROR',
                response.message || 'Repository operation failed.'));
            } else {
              resolve(response || {});
            }
          }).fail(function (xhr) {
            var response = xhr && xhr.responseJSON;
            reject(repoError(
              (response && response.code) || 'VD_TRANSPORT',
              (response && response.message) || 'The Oracle repository request failed.'));
          });
        } else {
          Promise.resolve(req).then(function (response) {
            if (response && response.success === false) {
              reject(repoError(response.code || 'VD_REPOSITORY_ERROR', response.message || 'Repository operation failed.'));
            } else {
              resolve(response || {});
            }
          }, reject);
        }
      } catch (e) {
        reject(repoError('VD_TRANSPORT', e.message));
      }
    });
  }

  // Lets the designer work on another application of this workspace.
  function registerApp(appId) {
    return callProcess('VD_REGISTER', { x01: String(appId) });
  }

  function listPageComponents(appId, pageId) {
    return callProcess('VD_PAGE_COMPONENTS', { x01: String(appId), x02: String(pageId) });
  }

  // Flutter designer: the region handler part "flutter", with x03 as the action.
  function flutterCall(action, appId, pageId, extra) {
    var data = { x01: String(appId), x02: String(pageId), x03: action };
    Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
    return callProcess('VD_FLUTTER', data);
  }
  // -> { token, slots, regions, items } (layout board)
  function layout(appId, pageId) {
    return flutterCall('layout', appId, pageId).then(function (r) { return r.layout; });
  }
  // changes: VD.layoutModel.changes(board). -> { token } (the page's new layout token)
  function applyLayout(appId, pageId, token, changes) {
    return flutterCall('apply_layout', appId, pageId, { x04: token, p_clob_01: JSON.stringify(changes) });
  }
  // Puts back the layout before the newest applied change list. -> { token }
  function undoLayout(appId, pageId, token) {
    return flutterCall('undo_layout', appId, pageId, { x04: token });
  }
  // -> { token, css, js, design? }
  function readFlutter(appId, pageId) { return flutterCall('read', appId, pageId); }
  // -> { token }
  function saveFlutter(appId, pageId, token, design, css, js) {
    return flutterCall('save', appId, pageId, {
      x04: token, p_clob_01: JSON.stringify({ design: design, css: css, js: js })
    });
  }
  // -> { versions: [{ versionId, note, savedBy, savedAt }] }
  function flutterHistory(appId, pageId) { return flutterCall('history', appId, pageId); }
  // -> { token }
  function restoreFlutter(appId, pageId, versionId, token) {
    return flutterCall('restore', appId, pageId, { x04: token, x05: String(versionId) });
  }
  // kind 'region' | 'button'; componentId from listPageComponents (id). -> {}
  function setStaticId(appId, pageId, kind, componentId, staticId) {
    return flutterCall('staticid', appId, pageId, { x05: kind, x06: String(componentId), x07: staticId });
  }

  // The theme style class vd-<type>-<cls> on one component (cls '' removes it). -> {}
  function setCssClass(appId, pageId, kind, componentId, type, cls) {
    return flutterCall('cssclass', appId, pageId, { x05: kind, x06: String(componentId), x07: type, x08: cls || '' });
  }

  // Theme designer: the region handler part "theme", with x02 as the action.
  function themeCall(action, appId, extra) {
    var data = { x01: String(appId), x02: action };
    Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
    return callProcess('VD_THEME', data);
  }
  // -> { theme?, versionId, note, pushed: { theme, versionId } | null }
  function readTheme(appId) { return themeCall('read', appId); }
  // -> { versionId }
  function saveThemeDraft(appId, theme, css, js) {
    return themeCall('draft', appId, { p_clob_01: JSON.stringify({ theme: theme, css: css, js: js }) });
  }
  // -> { versionId }
  function pushTheme(appId, theme, css, js) {
    return themeCall('push', appId, { p_clob_01: JSON.stringify({ theme: theme, css: css, js: js }) });
  }
  // -> { versions: [{ versionId, note, savedBy, savedAt }] }
  function themeHistory(appId) { return themeCall('history', appId); }
  // -> { versionId }
  function restoreTheme(appId, versionId) { return themeCall('restore', appId, { x03: String(versionId) }); }

  VD.repository = {
    setCssClass: setCssClass,
    readTheme: readTheme,
    saveThemeDraft: saveThemeDraft,
    pushTheme: pushTheme,
    themeHistory: themeHistory,
    restoreTheme: restoreTheme,
    registerApp: registerApp,
    listPageComponents: listPageComponents,
    readFlutter: readFlutter,
    saveFlutter: saveFlutter,
    flutterHistory: flutterHistory,
    restoreFlutter: restoreFlutter,
    setStaticId: setStaticId,
    layout: layout,
    applyLayout: applyLayout,
    undoLayout: undoLayout
  };
})();
