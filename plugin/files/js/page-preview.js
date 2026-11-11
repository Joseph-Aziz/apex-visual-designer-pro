/* APEX Visual Designer — shared live page preview helpers (Page Look, Flutter). */
(function () {
  window.VD = window.VD || {};

  // URL of an APEX page in the host app's session. The editor is served from static
  // files, so the URL is built from the host page's ORDS base
  // (".../ords/r/<workspace>/<app>/..." gives "/ords").
  function url(appId, pageId) {
    // Only the host app's own pages get its session. Another app has its own session and
    // login; handing it the host's session id ends the host session.
    var session = '';
    try {
      var env = (window.parent.apex && window.parent.apex.env) || {};
      if (String(env.APP_ID) === String(appId)) session = env.APP_SESSION || '';
    } catch (e) { session = ''; }
    var base = '/ords';
    try {
      var path = window.parent.location.pathname;
      base = path.indexOf('/r/') > 0 ? path.slice(0, path.indexOf('/r/')) : path.replace(/\/[^/]*$/, '');
    } catch (e) { base = '/ords'; }
    return base + '/f?p=' + appId + ':' + pageId + (session ? ':' + session : '');
  }

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

  window.VD.pagePreview = { url: url, doc: doc, setStyle: setStyle };
})();
