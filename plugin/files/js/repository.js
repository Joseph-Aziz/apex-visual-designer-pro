/* APEX Visual Designer - Oracle repository adapter for the Flutter Designer.
   Talks to the page 19 On Demand processes VD_PAGE_COMPONENTS and VD_FLUTTER. */
(function () {
  window.VD = window.VD || {};
  var VD = window.VD;

  function repoError(code, message) {
    var e = new Error(message || 'Repository operation failed.');
    e.code = code;
    return e;
  }

  function apexApi() {
    if (window.apex && window.apex.server && window.apex.server.process) return window.apex;
    try {
      if (window.parent && window.parent !== window &&
          window.parent.apex && window.parent.apex.server &&
          window.parent.apex.server.process) {
        return window.parent.apex;
      }
    } catch (e) { /* cross-origin/desktop */ }
    return null;
  }

  function callProcess(name, data) {
    var api = apexApi();
    if (!api) return Promise.reject(repoError('VD_OFFLINE', 'Oracle repository is unavailable.'));
    return new Promise(function (resolve, reject) {
      try {
        var req = api.server.process(name, data || {}, { dataType: 'json', cache: false });
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
          Promise.resolve(req).then(resolve, reject);
        }
      } catch (e) {
        reject(repoError('VD_TRANSPORT', e.message));
      }
    });
  }

  function listPageComponents(appId, pageId) {
    return callProcess('VD_PAGE_COMPONENTS', { x01: String(appId), x02: String(pageId) });
  }

  // Flutter designer: one On Demand process, VD_FLUTTER, with x03 as the action.
  function flutterCall(action, appId, pageId, extra) {
    var data = { x01: String(appId), x02: String(pageId), x03: action };
    Object.keys(extra || {}).forEach(function (k) { data[k] = extra[k]; });
    return callProcess('VD_FLUTTER', data);
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

  // Theme designer: one On Demand process, VD_THEME, with x02 as the action.
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
    listPageComponents: listPageComponents,
    readFlutter: readFlutter,
    saveFlutter: saveFlutter,
    flutterHistory: flutterHistory,
    restoreFlutter: restoreFlutter,
    setStaticId: setStaticId
  };
})();
