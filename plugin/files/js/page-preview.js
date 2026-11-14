/* APEX Visual Designer — shared live page preview helpers (Page Look, Flutter). */
(function () {
  window.VD = window.VD || {};

  // URL of an APEX page in the host app's session. The editor is served from static
  // files, so the URL is built from the host page's ORDS base
  // (".../ords/r/<workspace>/<app>/..." gives "/ords").
  function url(appId, pageId, sharedSession) {
    // The host session goes only to the host app's own pages, or to another app that shares
    // it (both use Workspace Sharing). Otherwise the other app ends the host session.
    var session = '';
    try {
      var env = (window.parent.apex && window.parent.apex.env) || {};
      if (sharedSession || String(env.APP_ID) === String(appId)) session = env.APP_SESSION || '';
    } catch (e) { session = ''; }
    var base = '/ords';
    try {
      var path = window.parent.location.pathname;
      base = path.indexOf('/r/') > 0 ? path.slice(0, path.indexOf('/r/')) : path.replace(/\/[^/]*$/, '');
    } catch (e) { base = '/ords'; }
    return base + '/f?p=' + appId + ':' + pageId + (session ? ':' + session : '');
  }

  // APEX refuses to run page 0 by URL; its components show on every other page instead.
  function runnable(pageId) { return pageId != null && String(pageId) !== '0'; }

  // Message for a page that has no preview.
  var NO_PREVIEW = 'Page 0 cannot run by itself, so there is no preview. Its components show on every page; pick them in the list.';

  function doc(frame) {
    try { return frame && frame.contentDocument; } catch (e) { return null; }
  }

  // Puts css into a <style id="..."> in the framed page, creating it on first use.
  function setStyle(frame, id, css) {
    var d = doc(frame);
    if (!d || !d.head) return false;
    var el = d.getElementById(id);
    if (!el) { el = d.createElement('style'); el.id = id; d.head.appendChild(el); }
    el.textContent = css;
    return true;
  }

  window.VD.pagePreview = { url: url, runnable: runnable, noPreview: NO_PREVIEW, doc: doc, setStyle: setStyle };
})();
