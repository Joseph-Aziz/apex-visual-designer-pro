/* In-memory fake of the four Visual Designer AJAX handlers (components, flutter, theme,
   register). It mirrors the response shapes written by database/packages/pkg_vd_plugin.sql,
   pkg_vd_page_code.sql and pkg_vd_page_writer.sql, including the page tokens, so a save
   followed by a reload returns what was saved. The browser smoke test drives this through
   host.html's fake apex.server.plugin; nothing here needs a database or APEX. */
(function () {
  'use strict';

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function iso() { return new Date().toISOString(); }
  function pageKey(app, page) { return String(app) + ':' + String(page); }
  function fail(code, message) { return { success: false, code: code, message: message }; }

  // One page's page components, as APEX_APPLICATION_PAGE_* would list them: text fields,
  // a textarea, a select list, a checkbox group, two buttons, a standard region, a static
  // content region and a Jet chart.
  function seedPage() {
    return {
      tokenRev: 1,
      token: 'tok-1',
      css: '',
      js: '',
      design: { components: [] },
      history: [],
      versionSeq: 0,
      oversizeCss: false,
      components: {
        sharedSession: false,
        regions: [
          { id: '101', staticId: 'EMPLOYEES', name: 'Employees', type: 'NATIVE_PLAIN', component: null,
            parentStaticId: null, cssClasses: '', needsStaticId: false },
          { id: '102', staticId: 'INTRO', name: 'Intro text', type: 'NATIVE_STATIC', component: null,
            parentStaticId: null, cssClasses: '', needsStaticId: false },
          { id: '103', staticId: 'SALES_CHART', name: 'Sales chart', type: 'NATIVE_JET_CHART', component: null,
            parentStaticId: null, cssClasses: '', needsStaticId: false }
        ],
        items: [
          { id: '205', name: 'P1_NAME', type: 'NATIVE_TEXT_FIELD', regionStaticId: 'EMPLOYEES', cssClasses: '' },
          { id: '201', name: 'P1_EMAIL', type: 'NATIVE_TEXT_FIELD', regionStaticId: 'EMPLOYEES', cssClasses: '' },
          { id: '202', name: 'P1_NOTES', type: 'NATIVE_TEXTAREA', regionStaticId: 'EMPLOYEES', cssClasses: '' },
          { id: '203', name: 'P1_STATUS', type: 'NATIVE_SELECT_LIST', regionStaticId: 'EMPLOYEES', cssClasses: '' },
          { id: '204', name: 'P1_TOPICS', type: 'NATIVE_CHECKBOX', regionStaticId: 'EMPLOYEES', cssClasses: '' }
        ],
        buttons: [
          { id: '301', staticId: 'SAVE_BTN', name: 'SAVE', regionStaticId: 'EMPLOYEES', needsStaticId: false, cssClasses: '' },
          { id: '302', staticId: null, name: 'CANCEL', regionStaticId: 'EMPLOYEES', needsStaticId: true, cssClasses: '' }
        ]
      },
      layoutRev: 1,
      layout: {
        token: 'lay-1',
        slots: [{ name: 'BODY', label: 'Body', grid: true }],
        regions: [
          { id: '101', title: 'Employees', parent: null, slot: 'BODY', seq: 10, newRow: true, newCol: true, colStart: null, span: 6, hidden: false },
          { id: '102', title: 'Intro text', parent: null, slot: 'BODY', seq: 20, newRow: false, newCol: true, colStart: null, span: 6, hidden: false },
          { id: '103', title: 'Sales chart', parent: null, slot: 'BODY', seq: 30, newRow: false, newCol: true, colStart: null, span: null, hidden: false }
        ],
        items: [
          { id: '205', name: 'P1_NAME', label: 'Full name', region: '101', seq: 5, newRow: true, newCol: true, colStart: null, span: 6, type: 'NATIVE_TEXT_FIELD', hidden: false },
          { id: '201', name: 'P1_EMAIL', label: 'Email', region: '101', seq: 10, newRow: true, newCol: true, colStart: null, span: 6, type: 'NATIVE_TEXT_FIELD', hidden: false },
          { id: '202', name: 'P1_NOTES', label: 'Notes', region: '101', seq: 20, newRow: false, newCol: true, colStart: null, span: 6, type: 'NATIVE_TEXTAREA', hidden: false },
          { id: '203', name: 'P1_STATUS', label: 'Status', region: '101', seq: 30, newRow: true, newCol: true, colStart: null, span: null, type: 'NATIVE_SELECT_LIST', hidden: false },
          { id: '204', name: 'P1_TOPICS', label: 'Topics', region: '101', seq: 40, newRow: false, newCol: true, colStart: null, span: null, type: 'NATIVE_CHECKBOX', hidden: false }
        ],
        buttons: [
          { id: '301', name: 'SAVE_BTN', label: 'Save', region: '101', position: 'BODY', seq: 10, newRow: true, newCol: true, colStart: null, span: null, hidden: false },
          { id: '302', name: 'CANCEL', label: 'Cancel', region: '101', position: 'BODY', seq: 20, newRow: false, newCol: true, colStart: null, span: null, hidden: false }
        ]
      },
      layoutHistory: []
    };
  }

  var apps = {};
  var pages = {};

  function appState(appId) {
    var id = String(appId);
    apps[id] = apps[id] || { versions: [], versionSeq: 0, pushedVersionId: null };
    return apps[id];
  }
  function pageState(appId, pageId) {
    var k = pageKey(appId, pageId);
    pages[k] = pages[k] || seedPage();
    return pages[k];
  }
  function componentList(p, kind) {
    if (kind === 'region') return p.components.regions;
    if (kind === 'button') return p.components.buttons;
    return p.components.items;
  }

  // ------------------------------------------------------------ components
  function doComponents(payload) {
    var p = pageState(payload.x01, payload.x02);
    return {
      success: true,
      sharedSession: p.components.sharedSession,
      regions: clone(p.components.regions),
      items: clone(p.components.items),
      buttons: clone(p.components.buttons)
    };
  }

  // ------------------------------------------------------------ flutter
  function checkToken(p, token) {
    return token != null && String(token) === String(p.token);
  }
  function doFlutter(payload) {
    var p = pageState(payload.x01, payload.x02);
    var action = payload.x03;

    if (action === 'read') {
      var css = p.oversizeCss ? p.css + new Array(40001).join('x') : p.css;
      var out = { success: true, token: p.token, css: css, js: p.js };
      if (p.design) out.design = clone(p.design);
      return out;
    }
    if (action === 'save') {
      if (!checkToken(p, payload.x04)) return fail(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
      var body;
      try { body = JSON.parse(payload.p_clob_01 || '{}'); } catch (e) { return fail(-20200, 'The design is not valid JSON.'); }
      if (!p.history.length) {
        p.history.push({ versionId: ++p.versionSeq, note: 'ORIGINAL', savedBy: 'SMOKE', savedAt: iso(), css: p.css, js: p.js, design: null });
      }
      p.design = body.design || { components: [] };
      p.css = body.css || '';
      p.js = body.js || '';
      p.history.push({ versionId: ++p.versionSeq, note: 'SAVED', savedBy: 'SMOKE', savedAt: iso(), css: p.css, js: p.js, design: clone(p.design) });
      p.tokenRev += 1;
      p.token = 'tok-' + p.tokenRev;
      return { success: true, token: p.token };
    }
    if (action === 'history') {
      return {
        success: true,
        versions: p.history.slice().reverse().map(function (v) {
          return { versionId: v.versionId, note: v.note, savedBy: v.savedBy, savedAt: v.savedAt };
        })
      };
    }
    if (action === 'restore') {
      if (!checkToken(p, payload.x04)) return fail(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
      var version = p.history.filter(function (v) { return String(v.versionId) === String(payload.x05); })[0];
      if (!version) return fail(-20232, 'Version not found for this page.');
      p.css = version.css || '';
      p.js = version.js || '';
      p.design = version.design ? clone(version.design) : { components: [] };
      p.history.push({ versionId: ++p.versionSeq, note: 'RESTORED', savedBy: 'SMOKE', savedAt: iso(), css: p.css, js: p.js, design: clone(p.design) });
      p.tokenRev += 1;
      p.token = 'tok-' + p.tokenRev;
      return { success: true, token: p.token };
    }
    if (action === 'staticid') {
      var list = componentList(p, payload.x05);
      var c = list.filter(function (x) { return String(x.id) === String(payload.x06); })[0];
      if (!c) return fail(-20238, 'That region or button is not on page ' + payload.x02 + '.');
      if (!/^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(String(payload.x07 || ''))) {
        return fail(-20236, 'A Static ID starts with a letter and has only letters, digits, _ and - (at most 60).');
      }
      c.staticId = payload.x07;
      c.needsStaticId = false;
      return { success: true };
    }
    if (action === 'cssclass') {
      var target = componentList(p, payload.x05).filter(function (x) { return String(x.id) === String(payload.x06); })[0];
      if (!target) return fail(-20238, 'Unknown component kind.');
      var type = String(payload.x07 || '');
      target.cssClasses = String(target.cssClasses || '').split(/\s+/).filter(function (cls) {
        return cls && cls.indexOf('vd-' + type + '-') !== 0;
      }).join(' ');
      if (payload.x08) target.cssClasses = (target.cssClasses ? target.cssClasses + ' ' : '') + 'vd-' + type + '-' + payload.x08;
      return { success: true };
    }
    if (action === 'layout') {
      return { success: true, layout: clone(p.layout) };
    }
    if (action === 'apply_layout') {
      if (!payload.x04 || String(payload.x04) !== String(p.layout.token)) return fail(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
      var changes;
      try { changes = JSON.parse(payload.p_clob_01 || '[]'); } catch (e) { return fail(-20200, 'The layout change list is not valid JSON.'); }
      p.layoutHistory.push({ slots: clone(p.layout.slots), regions: clone(p.layout.regions), items: clone(p.layout.items), buttons: clone(p.layout.buttons), token: p.layout.token });
      changes.forEach(function (ch) {
        var arr = ch.kind === 'region' ? p.layout.regions : ch.kind === 'item' ? p.layout.items : ch.kind === 'button' ? p.layout.buttons : null;
        var item = arr && arr.filter(function (x) { return String(x.id) === String(ch.id); })[0];
        if (!item) return;
        Object.keys(ch).forEach(function (k) { if (k !== 'kind' && k !== 'id') item[k] = ch[k]; });
      });
      p.layoutRev += 1;
      p.layout.token = 'lay-' + p.layoutRev;
      return { success: true, token: p.layout.token };
    }
    if (action === 'undo_layout') {
      if (!payload.x04 || String(payload.x04) !== String(p.layout.token)) return fail(-20230, 'Page changed since it was opened. Reload it in the designer and try again.');
      var prev = p.layoutHistory.pop();
      if (!prev) return fail(-20232, 'There is no layout change to undo on this page.');
      p.layout.slots = prev.slots;
      p.layout.regions = prev.regions;
      p.layout.items = prev.items;
      p.layout.buttons = prev.buttons;
      p.layoutRev += 1;
      p.layout.token = 'lay-' + p.layoutRev;
      return { success: true, token: p.layout.token };
    }
    return fail(-20233, 'Unknown designer action.');
  }

  // ------------------------------------------------------------ theme
  function latestTheme(a, pushedOnly) {
    for (var i = a.versions.length - 1; i >= 0; i--) {
      if (!pushedOnly || a.versions[i].note !== 'DRAFT') return a.versions[i];
    }
    return null;
  }
  function addThemeVersion(a, theme, css, js, note) {
    var v = { versionId: ++a.versionSeq, note: note, theme: clone(theme || {}), css: css || '', js: js || '',
      savedBy: 'SMOKE', savedAt: iso() };
    a.versions.push(v);
    if (note !== 'DRAFT') a.pushedVersionId = v.versionId;
    return v;
  }
  function doTheme(payload) {
    var a = appState(payload.x01);
    var action = payload.x02;
    if (action === 'read') {
      var latest = latestTheme(a, false), pushed = latestTheme(a, true);
      return {
        success: true,
        theme: latest ? clone(latest.theme) : null,
        versionId: latest ? latest.versionId : null,
        note: latest ? latest.note : null,
        pushed: pushed ? { theme: clone(pushed.theme), versionId: pushed.versionId } : null
      };
    }
    if (action === 'draft' || action === 'push') {
      var body;
      try { body = JSON.parse(payload.p_clob_01 || '{}'); } catch (e) { return fail(-20240, 'The theme is not valid. Reload the Theme Designer and try again.'); }
      if (!body.theme || typeof body.theme !== 'object') return fail(-20240, 'The theme is not valid. Reload the Theme Designer and try again.');
      var v = addThemeVersion(a, body.theme, body.css, body.js, action === 'draft' ? 'DRAFT' : 'PUSHED');
      return { success: true, versionId: v.versionId };
    }
    if (action === 'history') {
      return {
        success: true,
        versions: a.versions.slice().reverse().map(function (v) {
          return { versionId: v.versionId, note: v.note, savedBy: v.savedBy, savedAt: v.savedAt };
        })
      };
    }
    if (action === 'restore') {
      var old = a.versions.filter(function (v) { return String(v.versionId) === String(payload.x03); })[0];
      if (!old) return fail(-20242, 'That theme version was not found for this application.');
      var restored = addThemeVersion(a, old.theme, old.css, old.js, 'RESTORED');
      return { success: true, versionId: restored.versionId };
    }
    return fail(-20233, 'Unknown designer action.');
  }

  // ------------------------------------------------------------ register
  function doRegister(payload) {
    var appId = Number(payload.x01);
    if (!appId) return fail(-20233, 'Enter an application number.');
    appState(appId);
    return { success: true };
  }

  window.FakeVD = window.FakeVD || {};
  window.FakeVD.server = {
    handle: function (ajax, payload) {
      payload = payload || {};
      switch (payload.x10) {
        case 'components': return doComponents(payload);
        case 'flutter': return doFlutter(payload);
        case 'theme': return doTheme(payload);
        case 'register': return doRegister(payload);
        default: return fail(-20233, 'Unknown designer action.');
      }
    },
    // The smoke test toggles one page's page CSS to the size that a page import refuses.
    setOversize: function (on, appId, pageId) {
      pageState(appId == null ? 102 : appId, pageId == null ? 1 : pageId).oversizeCss = !!on;
    },
    // A read-only snapshot for assertions about what a save stored.
    debug: function () {
      return clone({ apps: apps, pages: pages });
    }
  };
})();
