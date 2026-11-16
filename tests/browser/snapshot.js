/* Writes a static copy of every editor screen to design-handoff/ for a visual designer.
   Each file is the editor's real rendered markup (scripts removed) and links one shared
   editor.css, so restyling that stylesheet restyles every screen. Run: node snapshot.js */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startServer, editorFrame, cachedChromium } = require('./run.js');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'design-handoff');

async function grab(frame, file, title) {
  const html = await frame.evaluate(function () {
    const doc = document.documentElement.cloneNode(true);
    const live = document.querySelectorAll('iframe');
    doc.querySelectorAll('iframe').forEach(function (f, i) {
      // The page preview is another document: keep its markup inline as srcdoc.
      try { f.setAttribute('srcdoc', live[i].contentDocument.documentElement.outerHTML.replace(/<script[\s\S]*?<\/script>/gi, '')); } catch (e) { /* cross-origin */ }
      f.removeAttribute('src');
    });
    doc.querySelectorAll('script').forEach(function (s) { s.remove(); });
    doc.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) { l.remove(); });
    return doc.outerHTML;
  });
  const out = '<!doctype html>\n' + html
    .replace('<head>', '<head>\n<link rel="stylesheet" href="editor.css">')
    .replace(/<title>[^<]*<\/title>/, '<title>' + title + '</title>');
  fs.writeFileSync(path.join(OUT, file), out);
  console.log('wrote design-handoff/' + file);
}

(async function () {
  fs.mkdirSync(OUT, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'plugin/files/css/editor.css'), path.join(OUT, 'editor.css'));
  const server = await startServer();
  let browser;
  try {
    try { browser = await chromium.launch({ headless: true }); }
    catch (e) { browser = await chromium.launch({ headless: true, executablePath: cachedChromium() }); }
    const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    page.on('dialog', function (d) { d.accept().catch(function () {}); });
    await page.goto('http://127.0.0.1:' + server.address().port + '/tests/browser/host.html');
    const frame = await editorFrame(page);
    await frame.waitForSelector('.fl-top');
    await frame.fill('.pb-page', '1');
    await frame.click('.pb-open');
    await frame.waitForSelector('.fl-left .lk-slot');
    await frame.click('.fl-left .lk-slot');
    await page.waitForTimeout(1500);
    await grab(frame, '1-design-items.html', 'Design items');
    for (const [view, file, title] of [['theme', '2-theme-designer.html', 'Theme Designer'], ['layout', '3-layout.html', 'Layout'], ['saved', '4-theme-styles.html', 'Theme styles']]) {
      await frame.click('.rail-item[data-view="' + view + '"]');
      await page.waitForTimeout(1500);
      await grab(frame, file, title);
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})();
