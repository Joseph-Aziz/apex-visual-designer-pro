'use strict';
// Screenshot matrix of the Creative Studio editor.
//   node screens.js [--out dir]
// 2 appearances x 2 directions x 3 viewports x 4 workspaces = 48 PNGs, plus a
// layout check per shot: no sideways overflow, and the workspace's save
// action is on screen. Exits 1 when a check fails.
const fs = require('fs');
const path = require('path');
const run = require('./run.js');

const VIEWPORTS = { desktop: [1440, 900], tablet: [834, 1112], mobile: [390, 844] };
const WORKSPACES = [
  ['design', '.fl-top', '.fl-save'],
  ['theme', '.th-top', '.th-save'],
  ['layout', '.lb-top', '.lb-apply'],
  ['library', '.sv-page', null]
];

// Opens the editor at one combination; returns { page, frame } ready on Design with page 1 open.
async function openEditor(browser, base, opts) {
  const ctx = await browser.newContext({ viewport: { width: opts.size[0], height: opts.size[1] } });
  const page = await ctx.newPage();
  await page.goto(base + '/tests/browser/host.html' + (opts.dir === 'rtl' ? '?dir=rtl' : ''), { waitUntil: 'domcontentloaded' });
  const frame = await run.editorFrame(page);
  await frame.waitForSelector('.fl-top');
  if (opts.appearance === 'light') await frame.click('.studio-appearance');
  await frame.fill('.pb-page', '1');
  await frame.click('.pb-open');
  await frame.waitForSelector('.fl-left .lk-slot');
  await page.waitForTimeout(300);
  return { ctx: ctx, page: page, frame: frame };
}

// Switches workspace, answering any unsaved-changes question with Discard.
async function goTo(page, frame, ws) {
  const view = ws[0] === 'library' ? 'saved' : ws[0] === 'design' ? 'flutter' : ws[0];
  const btn = await frame.$('.rail-item[data-view="' + view + '"]');
  if (btn && !(await frame.$(ws[1]))) await btn.click();
  for (let i = 0; i < 2; i++) {
    await frame.waitForFunction(function (t) { return !!document.querySelector('.vd-ask, ' + t); }, ws[1], { timeout: 12000 });
    if (!(await frame.$('.vd-ask'))) break;
    if (i === 0) await run.cancelAsk(frame); else await run.confirmAsk(frame);
    await page.waitForTimeout(200);
  }
  await frame.waitForSelector(ws[1], { state: 'attached', timeout: 12000 });
  await page.waitForTimeout(500);
}

function layoutCheck(frame, save) {
  return frame.evaluate(function (save) {
    const out = [];
    const d = document.documentElement;
    if (d.scrollWidth > d.clientWidth + 1) out.push('page scrolls sideways (' + d.scrollWidth + ' > ' + d.clientWidth + ')');
    if (save) {
      const el = document.querySelector(save);
      if (!el) out.push(save + ' missing');
      else {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1 || r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1) {
          out.push(save + ' not on screen');
        }
      }
    }
    return out;
  }, save);
}

async function main() {
  const args = process.argv.slice(2);
  const outDir = args[0] === '--out' ? path.resolve(args[1]) : path.join(__dirname, 'out', 'screens');
  fs.mkdirSync(outDir, { recursive: true });
  const { chromium } = require('playwright');
  const server = await run.startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: run.cachedChromium() || undefined });
  let shots = 0, failed = 0;
  try {
    for (const appearance of ['dark', 'light']) {
      for (const dir of ['ltr', 'rtl']) {
        for (const vp of Object.keys(VIEWPORTS)) {
          const e = await openEditor(browser, base, { appearance: appearance, dir: dir, size: VIEWPORTS[vp] });
          try {
            for (const ws of WORKSPACES) {
              const name = [ws[0], appearance, dir, vp].join('-');
              try {
                await goTo(e.page, e.frame, ws);
                await e.page.screenshot({ path: path.join(outDir, name + '.png') });
                shots++;
                const problems = await layoutCheck(e.frame, ws[2]);
                if (problems.length) { failed++; console.log('FAIL ' + name + ': ' + problems.join('; ')); }
                else console.log('ok   ' + name);
              } catch (err) { failed++; console.log('FAIL ' + name + ': ' + err.message.split('\n')[0]); }
            }
          } finally { await e.ctx.close(); }
        }
      }
    }
  } finally { await browser.close(); server.close(); }
  console.log('screens: ' + shots + ' shots, ' + failed + ' problem(s) -> ' + outDir);
  if (failed) process.exitCode = 1;
}

module.exports = { VIEWPORTS: VIEWPORTS, WORKSPACES: WORKSPACES, openEditor: openEditor, goTo: goTo };
if (require.main === module) main().catch(function (e) { console.error(e); process.exit(1); });
