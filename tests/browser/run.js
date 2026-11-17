/* Browser smoke test for the APEX Visual Designer editor.
   Serves the repo root over a local HTTP server, opens tests/browser/host.html (a fake APEX
   host) in headless Chromium, and drives the real editor through the four modes.

   Run: cd tests/browser && npm install && npm test
   Exits non-zero when any named check fails. */
'use strict';

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..', '..');
const results = [];   // { status: 'PASS' | 'FAIL' | 'SKIP', name, detail }

// Playwright 1.65.1 expects a newer Chromium revision than some pre-installed caches hold.
// Fall back to the newest cached Chromium so the smoke test needs no browser download.
function cachedChromium() {
  const dir = process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(process.env.LOCALAPPDATA || os.homedir(), 'ms-playwright');
  let entries = [];
  try { entries = fs.readdirSync(dir); } catch (e) { return null; }
  const shells = entries.filter(function (n) { return /^chromium_headless_shell-\d+$/.test(n); })
    .sort(function (a, b) { return Number(b.split('-')[1]) - Number(a.split('-')[1]); });
  const full = entries.filter(function (n) { return /^chromium-\d+$/.test(n); })
    .sort(function (a, b) { return Number(b.split('-')[1]) - Number(a.split('-')[1]); });
  const candidates = shells.map(function (n) {
    return path.join(dir, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe');
  }).concat(full.map(function (n) {
    return path.join(dir, n, 'chrome-win64', 'chrome.exe');
  }));
  return candidates.filter(function (p) { return fs.existsSync(p); })[0] || null;
}


function assert(cond, message) { if (!cond) throw new Error(message); }

function pass(name) { results.push({ status: 'PASS', name }); console.log('PASS ' + name); }
function fail(name, error) {
  const detail = error && error.message ? error.message : String(error);
  results.push({ status: 'FAIL', name, detail });
  console.log('FAIL ' + name + ' — ' + detail);
}
function skip(name, reason) {
  results.push({ status: 'SKIP', name, detail: reason });
  console.log('SKIP ' + name + ' — ' + reason);
}
async function check(name, fn) {
  try { await fn(); pass(name); }
  catch (e) { fail(name, e); }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

// The APEX page the designer previews. It only needs a same-origin document with the item
// containers and region ids the editor targets; the real page is never loaded.
function previewHtml() {
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page 1</title></head><body>' +
    '<main class="t-Body">' +
    '<div class="t-Region" id="EMPLOYEES"><h2 class="t-Region-title">Employees</h2><div class="t-Region-body">' +
    '<div class="t-Form-fieldContainer" id="P1_EMAIL_CONTAINER"><label class="t-Form-label">Email</label>' +
    '<input class="text_field apex-item-text" id="P1_EMAIL" value="ada@example.com"></div>' +
    '<div class="t-Form-fieldContainer" id="P1_NOTES_CONTAINER"><label class="t-Form-label">Notes</label>' +
    '<textarea class="textarea apex-item-textarea" id="P1_NOTES">A note</textarea></div>' +
    '<div class="t-Form-fieldContainer" id="P1_STATUS_CONTAINER"><label class="t-Form-label">Status</label>' +
    '<select class="selectlist apex-item-select" id="P1_STATUS"><option>Active</option></select></div>' +
    '<div class="t-Form-fieldContainer" id="P1_TOPICS_CONTAINER"><span class="apex-item-group apex-item-checkbox">' +
    '<span class="apex-item-option"><input type="checkbox" id="P1_TOPICS_0"><label for="P1_TOPICS_0">One</label></span></span></div>' +
    '<button class="t-Button" id="SAVE_BTN" type="button">Save</button>' +
    '</div></div>' +
    '<div class="t-Region" id="INTRO"><div class="t-Region-body">Static content</div></div>' +
    '<div class="t-Region" id="SALES_CHART"><div class="t-Region-body">Chart</div></div>' +
    '</main></body></html>';
}

function startServer() {
  return new Promise(function (resolve, reject) {
    const server = http.createServer(function (req, res) {
      let pathname;
      try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
      catch (e) { pathname = '/'; }

      if (pathname === '/favicon.ico') { res.writeHead(204); res.end(); return; }
      // pagePreview.url() builds <base>/f?p=<app>:<page>; that is the preview document.
      if (pathname.endsWith('/f')) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        res.end(previewHtml());
        return;
      }

      const file = path.resolve(ROOT, pathname.replace(/^\/+/, ''));
      if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
        res.writeHead(403, { 'content-type': 'text/plain' });
        res.end('Forbidden');
        return;
      }
      fs.readFile(file, function (err, data) {
        if (err) {
          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          res.end('Not found: ' + pathname);
          return;
        }
        res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', function () { resolve(server); });
  });
}

async function editorFrame(page) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const frame = page.frames().find(function (f) { return f.url().indexOf('/plugin/files/index.html') >= 0; });
    if (frame) return frame;
    await page.waitForTimeout(50);
  }
  throw new Error('the editor iframe never appeared');
}

async function calls(page) { return page.evaluate(function () { return window.__calls; }); }

async function waitForCall(page, match, after) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const list = await calls(page);
    for (let i = after || 0; i < list.length; i++) if (match(list[i])) return list[i];
    await page.waitForTimeout(50);
  }
  throw new Error('timed out waiting for a server call');
}

async function waitText(frame, selector, text, timeout) {
  await frame.waitForFunction(function (arg) {
    const el = document.querySelector(arg.selector);
    return !!el && el.textContent.indexOf(arg.text) >= 0;
  }, { selector: selector, text: text }, { timeout: timeout || 12000 });
}

// The Theme Designer keeps History, the preset file actions and Download CSS in its More menu.
async function openMore(frame) {
  const open = await frame.evaluate(function () {
    const d = document.querySelector('.th-top .vd-more');
    return !!d && d.open;
  });
  if (!open) await frame.click('.th-top .vd-more > summary');
}

// The editor asks in-page (native dialogs are blocked in its iframe): accept or cancel the question.
// The handle is waited on, not the selector: a chained question replaces .vd-ask at once.
async function answerAsk(frame, accept) {
  const box = await frame.waitForSelector('.vd-ask', { timeout: 12000 });
  const button = await box.$(accept ? '.vd-ask-ok' : '.vd-ask-cancel');
  assert(button, 'the question has no ' + (accept ? 'OK' : 'Cancel') + ' button');
  await button.click();
  await box.waitForElementState('hidden', { timeout: 12000 });
}
function confirmAsk(frame) { return answerAsk(frame, true); }
function cancelAsk(frame) { return answerAsk(frame, false); }

async function waitPreviewCss(frame) {
  await frame.waitForFunction(function () {
    const f = document.querySelector('.fl-preview iframe');
    return !!(f && f.contentDocument && f.contentDocument.getElementById('vd-flutter'));
  }, null, { timeout: 12000 });
}

async function previewCss(frame) {
  return frame.evaluate(function () {
    const f = document.querySelector('.fl-preview iframe');
    const d = f && f.contentDocument;
    const s = d && d.getElementById('vd-flutter');
    return s ? s.textContent : null;
  });
}

async function main() {
  let server = null, browser = null;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-smoke-'));
  const consoleErrors = [];
  let promptAnswer = 'Smoke preset';

  try {
    server = await startServer();
    const base = 'http://127.0.0.1:' + server.address().port;
    try {
      browser = await chromium.launch({ headless: true });
    } catch (launchError) {
      const executablePath = cachedChromium();
      if (!executablePath) throw launchError;
      browser = await chromium.launch({ headless: true, executablePath: executablePath });
    }
    const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
    const page = await context.newPage();

    page.on('console', function (msg) {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', function (e) { consoleErrors.push('pageerror: ' + e.message); });
    page.on('dialog', async function (dialog) {
      try {
        if (dialog.type() === 'prompt') await dialog.accept(promptAnswer);
        else await dialog.accept();
      } catch (e) { /* the dialog already went away */ }
    });
    page.on('download', function (download) {
      // Downloads that a check does not save are still consumed by Chromium; keep a note for debug.
      if (process.env.VD_SMOKE_DEBUG) console.log('download: ' + download.suggestedFilename());
    });

    await page.goto(base + '/tests/browser/host.html', { waitUntil: 'domcontentloaded' });
    let frame = await editorFrame(page);
    await frame.waitForSelector('.fl-top');
    await page.waitForTimeout(400);

    // ------------------------------------------------------------------ editor
    await check('Editor: loads in headless Chromium with no console errors', async function () {
      assert(await frame.isVisible('.fl-top'), 'the Design items toolbar is not visible');
      assert(consoleErrors.length === 0, 'console errors: ' + consoleErrors.join(' | '));
    });

    // ------------------------------------------------------------------ Flutter
    await check('Flutter: open page', async function () {
      await frame.fill('.pb-page', '1');
      await frame.click('.pb-open');
      await frame.waitForSelector('.fl-left .lk-slot');
      await frame.waitForFunction(function () {
        const s = document.querySelector('.fl-top .lk-state');
        return !!s && s.textContent.indexOf('Saved') >= 0;
      }, null, { timeout: 12000 });
      await waitPreviewCss(frame);
      assert((await frame.textContent('.fl-title')) === 'Design Studio', 'wrong view');
    });

    await check('Shell: connection state follows the server calls', async function () {
      await frame.waitForSelector('.studio-status[data-state="connected"]', { timeout: 12000 });
      await waitText(frame, '.studio-status-text', 'Connected to APEX');
    });

    await check('Flutter: component list', async function () {
      const count = await frame.locator('.fl-left .lk-slot').count();
      assert(count === 10, 'expected 10 page components, got ' + count);
      const text = await frame.textContent('.fl-left');
      ['Text fields', 'Lists', 'Checkboxes and radios', 'Buttons', 'Regions', 'Charts'].forEach(function (h) {
        assert(text.indexOf(h) >= 0, 'missing group ' + h);
      });
      const names = await frame.locator('.fl-left .lk-slot b').allTextContents();
      ['P1_NAME', 'P1_EMAIL', 'P1_NOTES', 'P1_STATUS', 'P1_TOPICS', 'Employees', 'Intro text', 'Sales chart'].forEach(function (n) {
        assert(names.indexOf(n) >= 0, 'missing component ' + n);
      });
    });

    await check('Flutter: Set Static ID on a component that has none', async function () {
      await frame.click('.fl-left .lk-slot[data-key="button:CANCEL"]');
      await frame.waitForSelector('.fl-right .fl-sid-save');
      await frame.fill('.fl-right .fl-sid', 'CANCEL_BTN');
      await frame.click('.fl-right .fl-sid-save');
      await waitText(frame, '.fl-msg', 'Static ID CANCEL_BTN set');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const button = debug.pages['102:1'].components.buttons.filter(function (b) { return b.id === '302'; })[0];
      assert(button.staticId === 'CANCEL_BTN', 'the fake page did not store the Static ID');
      assert(button.needsStaticId === false, 'the button is still marked as needing a Static ID');
    });

    await check('Flutter: component browser by category and member', async function () {
      await frame.click('.fl-left [data-view="all"]');
      await frame.waitForSelector('.fl-tile');
      const categories = await frame.locator('.fl-tile-list h3').allTextContents();
      ['Form', 'Selection', 'Actions', 'Display', 'Regions', 'Reports'].forEach(function (c) {
        assert(categories.indexOf(c) >= 0, 'missing category ' + c);
      });
      const tile = frame.locator('.fl-tile[data-family="text"][data-member="Text Field"]');
      assert(await tile.count() === 1, 'the Text Field member tile is missing');
      assert((await tile.textContent()).indexOf('2 on this page') >= 0, 'Text Field should count two fields');
      await tile.click();
      await frame.waitForSelector('.fl-browse-gallery .fl-variant');
      assert((await frame.textContent('.fl-right h3')) === 'Text Field', 'wrong member panel');
      assert(await frame.locator('.fl-right [data-key]').count() === 2, 'the two text fields should be listed');
      await frame.click('.fl-left [data-view="page"]');
      await frame.waitForSelector('.fl-left .lk-slot');
    });

    await check('Flutter: select a component', async function () {
      await frame.click('.fl-left .lk-slot[data-key="item:P1_EMAIL"]');
      await frame.waitForSelector('.fl-right .fl-variant');
      assert((await frame.textContent('.fl-right h3')) === 'P1_EMAIL', 'right panel did not open P1_EMAIL');
      const status = await frame.textContent('.fl-status');
      assert(status.indexOf('P1_EMAIL') >= 0, 'status strip does not name P1_EMAIL');
    });

    await check('Flutter: gallery shows cards', async function () {
      const cards = await frame.locator('.fl-right .fl-variant').count();
      assert(cards >= 6, 'expected at least 6 design cards, got ' + cards);
      const labels = await frame.locator('.fl-right .fl-variant b').allTextContents();
      ['Filled', 'Outlined', 'Soft', 'Underline', 'Glass', 'Pill'].forEach(function (l) {
        assert(labels.indexOf(l) >= 0, 'missing design ' + l);
      });
    });

    await check('Flutter: hovering a card tries it on and leaving restores it', async function () {
      const before = await previewCss(frame);
      await frame.hover('.fl-right [data-variant="v2"]');
      await frame.waitForFunction(function (was) {
        const f = document.querySelector('.fl-preview iframe');
        const s = f && f.contentDocument && f.contentDocument.getElementById('vd-flutter');
        return !!(s && s.textContent !== was);
      }, before, { timeout: 5000 });
      const during = await previewCss(frame);
      assert(during !== before, 'hovering did not change the preview');
      await frame.hover('.fl-title');
      await frame.waitForFunction(function (was) {
        const f = document.querySelector('.fl-preview iframe');
        const s = f && f.contentDocument && f.contentDocument.getElementById('vd-flutter');
        return !!(s && s.textContent === was);
      }, before, { timeout: 5000 });
    });

    await check('Flutter: clicking a card keeps it', async function () {
      await frame.click('.fl-right [data-variant="v2"]');
      await frame.waitForSelector('.fl-right .fl-variant.is-selected[data-variant="v2"]');
      const css = await previewCss(frame);
      assert(css.indexOf('#P1_EMAIL_CONTAINER') >= 0, 'preview is not scoped to P1_EMAIL_CONTAINER');
      assert((await frame.textContent('.fl-right')).indexOf('Outlined settings') >= 0, 'settings did not switch to Outlined');
    });

    await check('Flutter: change a setting', async function () {
      await frame.fill('.fl-right [data-param="radius"]', '4');
      await frame.waitForFunction(function () {
        const f = document.querySelector('.fl-preview iframe');
        const s = f && f.contentDocument && f.contentDocument.getElementById('vd-flutter');
        return !!(s && s.textContent.indexOf('border-radius:4px') >= 0);
      }, null, { timeout: 5000 });
      assert((await frame.inputValue('.fl-right [data-param="radius"]')) === '4', 'setting did not stick');
      // Reset settings must appear at once, without selecting the component again.
      await frame.waitForSelector('.fl-right [data-gallery="reset"]:not([hidden])', { timeout: 2000 });
    });

    await check('Flutter: Reset settings', async function () {
      await frame.click('.fl-right [data-gallery="reset"]');
      await frame.waitForFunction(function () {
        const i = document.querySelector('.fl-right [data-param="radius"]');
        return !!i && i.value === '12';
      }, null, { timeout: 5000 });
      assert(await frame.locator('.fl-right [data-gallery="reset"]:not([hidden])').count() === 0, 'Reset settings is still offered');
    });

    await check('Flutter: Undo and Redo', async function () {
      await frame.click('.fl-top .fl-undo');
      await frame.waitForFunction(function () {
        const i = document.querySelector('.fl-right [data-param="radius"]');
        return !!i && i.value === '4';
      }, null, { timeout: 5000 });
      await frame.click('.fl-top .fl-redo');
      await frame.waitForFunction(function () {
        const i = document.querySelector('.fl-right [data-param="radius"]');
        return !!i && i.value === '12';
      }, null, { timeout: 5000 });
      assert(await frame.locator('.fl-right [data-gallery="reset"]:not([hidden])').count() === 0, 'Redo did not restore the reset state');
    });

    await check('Flutter: Desktop / Tablet / Mobile preview width', async function () {
      const width = function () { return frame.evaluate(function () {
        return document.querySelector('.fl-preview').style.width;
      }); };
      await frame.click('.fl-top [data-width="tablet"]');
      assert((await width()) === '768px', 'tablet width is not 768px');
      await frame.click('.fl-top [data-width="mobile"]');
      assert((await width()) === '375px', 'mobile width is not 375px');
      await frame.click('.fl-top [data-width="desktop"]');
      assert((await width()) === '', 'desktop width is not the full width');
    });

    await check('Confirm: Cancel on Save to page sends no request', async function () {
      const before = (await calls(page)).length;
      await frame.click('.fl-top .fl-save');
      await cancelAsk(frame);
      await page.waitForTimeout(250);
      assert((await calls(page)).length === before, 'Cancel on Save to page still sent a request');
      assert((await frame.textContent('.fl-msg')).indexOf('Saved into page') < 0, 'the page was reported as saved after Cancel');
    });

    await check('Flutter: Save to page sends the expected payload', async function () {
      const before = (await calls(page)).length;
      await frame.click('.fl-top .fl-save');
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'flutter' && c.payload.x03 === 'save';
      }, before);
      await waitText(frame, '.fl-msg', 'Saved into page 1.');
      assert(call.ajax === 'TEST', 'wrong AJAX identifier');
      assert(call.opts.dataType === 'json', 'the request did not ask for JSON');
      assert(call.payload.x01 === '102' && call.payload.x02 === '1', 'wrong app/page');
      assert(typeof call.payload.x04 === 'string' && call.payload.x04.length > 0, 'no page token');
      const body = JSON.parse(call.payload.p_clob_01);
      const entry = (body.design.components || []).filter(function (c) { return c.key === 'item:P1_EMAIL'; })[0];
      assert(!!entry, 'the design does not contain item:P1_EMAIL');
      assert(entry.variant === 'v2', 'the saved design is not the clicked variant');
      assert(body.css.indexOf('#P1_EMAIL_CONTAINER') >= 0, 'the saved CSS does not target P1_EMAIL_CONTAINER');
      assert(typeof body.js === 'string', 'the saved JavaScript is not a string');
    });

    await check('Flutter: the size guard refuses an oversized save and sends no request', async function () {
      await page.evaluate(function () { window.FakeVD.server.setOversize(true); });
      const beforeOpen = (await calls(page)).length;
      await frame.click('.pb-open');
      await waitForCall(page, function (c) { return c.payload.x03 === 'read'; }, beforeOpen);
      await page.waitForTimeout(250);
      await frame.click('.fl-left .lk-slot[data-key="item:P1_EMAIL"]');
      await frame.waitForSelector('.fl-right [data-variant="v3"]');
      await frame.click('.fl-right [data-variant="v3"]');
      await frame.waitForSelector('.fl-right .fl-variant.is-selected[data-variant="v3"]');

      const beforeSave = (await calls(page)).length;
      await frame.click('.fl-top .fl-save');
      await waitText(frame, '.fl-msg', 'Not saved');
      const after = (await calls(page)).length;
      assert(after === beforeSave, 'the editor sent a save request despite the size guard');
      const message = await frame.textContent('.fl-msg');
      assert(message.indexOf('32,767') >= 0, 'the size guard message does not name the limit: ' + message);
      // The refusal explains the fix in a dialog; close it so the run can continue.
      await frame.waitForSelector('.vd-ask');
      const help = await frame.textContent('.vd-ask-message');
      assert(help.indexOf('preset') >= 0 && help.indexOf('Theme style') >= 0, 'the refusal does not explain presets: ' + help);
      await frame.click('.vd-ask-cancel');

      // Back to a normal page for the rest of the run.
      await page.evaluate(function () { window.FakeVD.server.setOversize(false); });
      const beforeReopen = (await calls(page)).length;
      await frame.click('.pb-open');
      await confirmAsk(frame);
      await waitForCall(page, function (c) { return c.payload.x03 === 'read'; }, beforeReopen);
      await frame.waitForFunction(function () {
        const s = document.querySelector('.fl-top .lk-state');
        return !!s && s.textContent === 'Saved';
      }, null, { timeout: 12000 });
    });

    await check('Flutter: Save as theme style', async function () {
      await frame.click('.fl-left .lk-slot[data-key="item:P1_EMAIL"]');
      await frame.waitForSelector('.fl-right [data-gallery="save"]');
      const before = (await calls(page)).length;
      await frame.click('.fl-right [data-gallery="save"]');
      const field = await frame.waitForSelector('.vd-ask .vd-ask-input', { timeout: 12000 });
      await field.fill('Smoke preset');
      await confirmAsk(frame);
      await waitForCall(page, function (c) {
        return c.payload.x10 === 'theme' && c.payload.x02 === 'draft';
      }, before);
      await waitText(frame, '.fl-msg', 'Preset Smoke preset saved');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const versions = debug.apps['102'].versions;
      const latest = versions[versions.length - 1];
      const styles = (((latest.theme || {}).types || {}).text || {}).styles || [];
      assert(styles.some(function (s) { return s.name === 'Smoke preset'; }), 'the preset was not saved into the theme');
    });

    await check('Flutter: Theme styles lists the preset', async function () {
      await frame.click('.rail-item[data-view="saved"]');
      await frame.waitForSelector('.sv-page .sv-list li');
      const text = await frame.textContent('.sv-page');
      assert(text.indexOf('Smoke preset') >= 0, 'Theme styles does not list Smoke preset');
    });

    // ------------------------------------------------------------------ Theme
    await check('Theme: open', async function () {
      await frame.click('.rail-item[data-view="theme"]');
      await frame.waitForSelector('.th-top');
      await waitText(frame, '.th-msg', 'Draft loaded');
      const top = await frame.textContent('.th-top');
      assert(top.indexOf('App 102') >= 0, 'the Theme Designer is not on app 102');
      assert((await frame.textContent('.th-left')).indexOf('Smoke preset') >= 0, 'the saved draft is not listed');
    });

    await check('Theme: edit a style', async function () {
      await frame.click('.th-left .th-add[data-add="text"]');
      await frame.waitForSelector('.th-right .th-name');
      await frame.fill('.th-right .th-name', 'Smoke edited');
      await frame.locator('.th-right .th-name').press('Tab');
      await frame.waitForFunction(function () {
        const i = document.querySelector('.th-right .th-name');
        return !!i && i.value === 'Smoke edited';
      }, null, { timeout: 5000 });
      await frame.fill('.th-right [data-param="radius"]', '7');
      await frame.waitForFunction(function () {
        const css = document.getElementById('th-gallery-css');
        return !!css && css.textContent.indexOf('7px') >= 0;
      }, null, { timeout: 5000 });
      assert((await frame.textContent('.th-left')).indexOf('Smoke edited') >= 0, 'the renamed style is not in the left list');
    });

    await check('Theme: Save draft', async function () {
      const before = (await calls(page)).length;
      await frame.click('.th-top .th-save');
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'theme' && c.payload.x02 === 'draft';
      }, before);
      await waitText(frame, '.th-msg', 'Draft saved (version');
      const body = JSON.parse(call.payload.p_clob_01);
      const styles = (((body.theme || {}).types || {}).text || {}).styles || [];
      const edited = styles.filter(function (s) { return s.name === 'Smoke edited'; })[0];
      assert(!!edited, 'the draft does not contain Smoke edited');
      assert(String(edited.values.radius) === '7', 'the draft does not contain the changed setting');
    });

    await check('Theme: Publish theme', async function () {
      const before = (await calls(page)).length;
      await frame.click('.th-top .th-push');
      await confirmAsk(frame);
      await waitForCall(page, function (c) {
        return c.payload.x10 === 'theme' && c.payload.x02 === 'push';
      }, before);
      await waitText(frame, '.th-msg', 'Pushed as version');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const app = debug.apps['102'];
      const latest = app.versions[app.versions.length - 1];
      assert(latest.note === 'PUSHED', 'the push did not add a PUSHED version');
      assert(app.pushedVersionId === latest.versionId, 'the pushed version was not remembered');
    });

    await check('Theme: History and Restore', async function () {
      await openMore(frame);
      await frame.click('.th-top .th-history');
      await frame.waitForSelector('.th-right [data-restore]');
      const history = await frame.textContent('.th-right');
      assert(history.indexOf('pushed') >= 0, 'the pushed version is not in the history');
      const restore = frame.locator('.th-right [data-restore]').first();
      const versionId = await restore.getAttribute('data-restore');
      const before = (await calls(page)).length;
      await restore.click();
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'theme' && c.payload.x02 === 'restore';
      }, before);
      assert(call.payload.x03 === versionId, 'Restore used the wrong theme version');
      await waitText(frame, '.th-msg', 'Theme loaded (restored version');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const app = debug.apps['102'];
      assert(app.versions[app.versions.length - 1].note === 'RESTORED', 'the fake server did not add a RESTORED version');
    });

    await check('Theme: Download CSS', async function () {
      await openMore(frame);
      const downloadPromise = page.waitForEvent('download');
      await frame.click('.th-top .th-download');
      const download = await downloadPromise;
      assert(download.suggestedFilename() === 'vd-theme.css', 'unexpected download name ' + download.suggestedFilename());
      const target = path.join(tmp, 'downloaded-theme.css');
      await download.saveAs(target);
      const css = fs.readFileSync(target, 'utf8');
      assert(css.indexOf('.vd-text-') >= 0, 'the downloaded CSS has no text style rules');
    });

    let presetsPath = '';
    await check('Theme: Export presets downloads a vd-presets JSON file', async function () {
      await openMore(frame);
      const downloadPromise = page.waitForEvent('download');
      await frame.click('.th-top .th-export');
      const download = await downloadPromise;
      assert(download.suggestedFilename() === 'vd-presets-app102.json', 'unexpected download name ' + download.suggestedFilename());
      presetsPath = path.join(tmp, 'vd-presets-app102.json');
      await download.saveAs(presetsPath);
      const file = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      assert(file.format === 'vd-presets' && file.version === 1, 'not a version 1 vd-presets file');
      assert(Array.isArray(file.families.text) && file.families.text.length === 2, 'expected two text presets');
    });

    await check('Theme: Import presets renames a clashing class', async function () {
      assert(!!presetsPath, 'the export check did not produce a file');
      const beforeCount = await frame.locator('.th-left [data-type="text"]').count();
      await openMore(frame);
      const chooserPromise = page.waitForEvent('filechooser');
      await frame.click('.th-top .th-import');
      const chooser = await chooserPromise;
      await chooser.setFiles(presetsPath);
      await waitText(frame, '.th-msg', 'Imported 2 presets');
      const message = await frame.textContent('.th-msg');
      assert(message.indexOf('renamed') >= 0, 'the import did not report a renamed class: ' + message);
      assert(message.indexOf('smoke-preset-2') >= 0, 'the clashing class was not renamed to smoke-preset-2');
      assert(await frame.locator('.th-left [data-type="text"]').count() === beforeCount + 2, 'the imported styles are not listed');
    });

    await check('Theme: import of a bad file shows the error and adds nothing', async function () {
      const badPath = path.join(tmp, 'bad-presets.json');
      fs.writeFileSync(badPath, JSON.stringify({ format: 'not-vd', version: 1, families: {} }), 'utf8');
      const beforeCount = await frame.locator('.th-left [data-type="text"]').count();
      await openMore(frame);
      const chooserPromise = page.waitForEvent('filechooser');
      await frame.click('.th-top .th-import');
      const chooser = await chooserPromise;
      await chooser.setFiles(badPath);
      await waitText(frame, '.th-msg', 'Import refused');
      assert(await frame.locator('.th-left [data-type="text"]').count() === beforeCount, 'a bad file added a style');
    });

    // ------------------------------------------------------------------ Layout Board
    await check('Layout Board: open', async function () {
      await frame.click('.rail-item[data-view="layout"]');
      await frame.waitForSelector('.lb-board .lb-box');
      const boxes = await frame.locator('.lb-board .lb-box').count();
      assert(boxes >= 9, 'expected the page regions, items and buttons, got ' + boxes + ' boxes');
      assert((await frame.textContent('.lb-board')).indexOf('Body') >= 0, 'the Body slot is missing');
      assert(await frame.locator('.lb-apply').isDisabled(), 'Apply should start disabled');
      assert((await frame.textContent('.lb-top .lk-state')) === 'Applied', 'the board does not start applied');
    });

    await check('Layout Board: resize one component', async function () {
      const box = frame.locator('.lb-box[data-key="item:201"]');
      await box.focus();
      await box.press('Shift+ArrowLeft');
      await frame.waitForSelector('.lb-box[data-key="item:201"].is-changed');
      assert(!(await frame.locator('.lb-apply').isDisabled()), 'Apply did not become available');
      const meta = await frame.textContent('.lb-box[data-key="item:201"] .lb-meta');
      assert(meta.indexOf('5 col') >= 0, 'the item did not change to 5 columns: ' + meta);
    });

    await check('Layout Board: Apply sends the expected changes', async function () {
      const before = (await calls(page)).length;
      await frame.click('.lb-top .lb-apply');
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'flutter' && c.payload.x03 === 'apply_layout';
      }, before);
      await waitText(frame, '.lb-msg', 'Applied.');
      assert(call.payload.x04 === 'lay-1', 'wrong layout token ' + call.payload.x04);
      const changes = JSON.parse(call.payload.p_clob_01);
      const change = changes.filter(function (c) { return c.kind === 'item' && c.id === '201'; })[0];
      assert(!!change, 'item 201 is not in the change list');
      assert(change.span === 5, 'item 201 did not send span 5');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const pageState = debug.pages['102:1'];
      const item = pageState.layout.items.filter(function (i) { return i.id === '201'; })[0];
      assert(item.span === 5, 'the fake server did not store the new span');
      assert(pageState.layout.token === 'lay-2', 'the layout token did not advance');
    });

    await check('Layout Board: Undo', async function () {
      const before = (await calls(page)).length;
      await frame.click('.lb-top .lb-undo');
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'flutter' && c.payload.x03 === 'undo_layout';
      }, before);
      await waitText(frame, '.lb-msg', 'The previous layout is back.');
      assert(call.payload.x04 === 'lay-2', 'Undo used the wrong layout token');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const item = debug.pages['102:1'].layout.items.filter(function (i) { return i.id === '201'; })[0];
      assert(item.span === 6, 'Undo did not put span 6 back');
      const meta = await frame.textContent('.lb-box[data-key="item:201"] .lb-meta');
      assert(meta.indexOf('6 col') >= 0, 'the board still shows the changed span: ' + meta);
    });

    // ------------------------------------------------------------------ Chart Designer
    await check('Chart Designer: open', async function () {
      await frame.click('.rail-item[data-view="flutter"]');
      await frame.waitForSelector('.fl-left .lk-slot');
      await frame.click('.fl-left .lk-slot[data-key="region:SALES_CHART"]');
      await frame.waitForSelector('.fl-right .fl-chart-open');
      await frame.click('.fl-right .fl-chart-open');
      await frame.waitForSelector('.cd-head');
      assert((await frame.inputValue('.cd-head [data-engine]')) === 'jet', 'the chart does not start on Oracle JET');
    });

    await check('Chart Designer: switch library (Oracle JET / Apache ECharts)', async function () {
      await frame.selectOption('.cd-head [data-engine]', 'echarts');
      await frame.waitForFunction(function () {
        const el = document.querySelector('.cd-head [data-engine]');
        return !!el && el.value === 'echarts';
      }, null, { timeout: 5000 });
      const types = await frame.locator('.cd-head [data-type] option').allTextContents();
      assert(types.indexOf('gauge') >= 0, 'the ECharts-only chart types are not offered');
    });

    await check('Chart Designer: change a look', async function () {
      await frame.selectOption('.cd-head [data-template]', 'monthlySales');
      await confirmAsk(frame);
      await frame.waitForSelector('.cd-fields [data-list="global.palette"]');
      const color = await frame.locator('.cd-fields [data-list="global.palette"]').first().inputValue();
      assert(color.toLowerCase() === '#465fff', 'the Monthly sales palette was not applied: ' + color);
    });

    await check('Chart Designer: save', async function () {
      const before = (await calls(page)).length;
      await frame.click('.fl-top .fl-save');
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'flutter' && c.payload.x03 === 'save';
      }, before);
      await waitText(frame, '.fl-msg', 'Saved into page 1.');
      const body = JSON.parse(call.payload.p_clob_01);
      const chart = (body.design.components || []).filter(function (c) { return c.key === 'region:SALES_CHART'; })[0];
      assert(!!chart && !!chart.chart, 'the saved design has no chart configuration');
      assert(chart.chart.engine === 'echarts', 'the saved chart engine is not echarts');
      assert(chart.chart.type === 'column', 'the saved chart type is not the template type');
      assert(chart.chart.global.palette[0] === '#465FFF', 'the saved chart palette is not the template palette');
    });

    await check('Flutter: History and Restore', async function () {
      await frame.click('.fl-top .fl-history');
      await frame.waitForSelector('.fl-history-list li');
      const rows = await frame.locator('.fl-history-list li').count();
      assert(rows >= 2, 'expected the ORIGINAL and SAVED page versions, got ' + rows);
      const restore = frame.locator('.fl-history-list [data-restore]').first();
      const versionId = await restore.getAttribute('data-restore');
      const before = (await calls(page)).length;
      await restore.click();
      await confirmAsk(frame);
      const call = await waitForCall(page, function (c) {
        return c.payload.x10 === 'flutter' && c.payload.x03 === 'restore';
      }, before);
      assert(call.payload.x05 === versionId, 'Restore used the wrong page version');
      await waitText(frame, '.fl-msg', 'Restored.');
      const debug = await page.evaluate(function () { return window.FakeVD.server.debug(); });
      const history = debug.pages['102:1'].history;
      assert(history[history.length - 1].note === 'RESTORED', 'the fake page did not record the restore');
    });

    await check('Flutter: leaving with unsaved changes stays on Cancel and continues on Discard', async function () {
      await frame.click('.fl-left .lk-slot[data-key="item:P1_EMAIL"]');
      await frame.waitForSelector('.fl-right [data-variant="v2"]');
      await frame.click('.fl-right [data-variant="v2"]');
      await frame.waitForSelector('.fl-right .fl-variant.is-selected[data-variant="v2"]');

      // Save them now? Cancel, then Discard? Cancel: the designer stays open.
      await frame.click('.rail-item[data-view="saved"]');
      await cancelAsk(frame);
      await cancelAsk(frame);
      assert(await frame.isVisible('.fl-top'), 'the designer did not stay open after both questions were cancelled');

      // Save them now? Cancel, then Discard? OK: the route continues to the requested view.
      await frame.click('.rail-item[data-view="saved"]');
      await cancelAsk(frame);
      await confirmAsk(frame);
      await frame.waitForSelector('.sv-page');
      assert(await frame.isVisible('.sv-page'), 'the Theme styles view did not open after Discard');
    });

    await check('Layout Board: leaving with changes stays on Cancel and continues on Discard', async function () {
      await frame.click('.rail-item[data-view="layout"]');
      await frame.waitForSelector('.lb-board .lb-box');
      const box = frame.locator('.lb-box[data-key="item:201"]');
      await box.focus();
      await box.press('Shift+ArrowRight');
      await frame.waitForSelector('.lb-box[data-key="item:201"].is-changed');

      // Apply them now? Cancel, then Discard? Cancel: the board stays open.
      await frame.click('.rail-item[data-view="flutter"]');
      await cancelAsk(frame);
      await cancelAsk(frame);
      assert(await frame.isVisible('.lb-board'), 'the board did not stay open after both questions were cancelled');

      // Apply them now? Cancel, then Discard? OK: the route continues and the changes are dropped.
      await frame.click('.rail-item[data-view="flutter"]');
      await cancelAsk(frame);
      await confirmAsk(frame);
      await frame.waitForSelector('.fl-top');
      assert(await frame.isVisible('.fl-top'), 'the Design items view did not open after Discard');

      // The discarded change is not on the board when it is opened again.
      await frame.click('.rail-item[data-view="layout"]');
      await frame.waitForSelector('.lb-board .lb-box');
      const meta = await frame.textContent('.lb-box[data-key="item:201"] .lb-meta');
      assert(meta.indexOf('6 col') >= 0, 'the discarded span change is still on the board: ' + meta);
    });

    // Functions that need a real Oracle database or a real APEX session are named here, never faked.
    skip('Theme: Page preview mode', 'The Page/Gallery switch is reachable, but proving the theme renders needs a real APEX page session; the static stub is not an APEX page served by the host application.');
  } catch (e) {
    fail('Harness: run end to end', e);
  } finally {
    if (browser) { try { await browser.close(); } catch (e) { /* already closed */ } }
    if (server) { try { server.close(); } catch (e) { /* already closed */ } }
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* best effort */ }

    const passed = results.filter(function (r) { return r.status === 'PASS'; }).length;
    const failed = results.filter(function (r) { return r.status === 'FAIL'; }).length;
    const skipped = results.filter(function (r) { return r.status === 'SKIP'; }).length;
    console.log('');
    console.log('Summary: ' + passed + ' passed, ' + failed + ' failed, ' + skipped + ' skipped, ' + results.length + ' checks.');
    if (failed) {
      console.log('Failed checks: ' + results.filter(function (r) { return r.status === 'FAIL'; })
        .map(function (r) { return r.name; }).join(' | '));
    }
    process.exitCode = failed ? 1 : 0;
  }
}

module.exports = { startServer, editorFrame, cachedChromium, calls, waitForCall, waitText, openMore, answerAsk, confirmAsk, cancelAsk };
if (require.main === module) main();
