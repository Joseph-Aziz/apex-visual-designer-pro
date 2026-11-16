'use strict';
// Accessibility checks of the editor chrome, dark and light, in every workspace:
//   contrast   visible text against its effective background, at least 4.5:1
//              (3:1 for text of 24px, or 18.66px bold);
//   target     buttons, inputs, selects and links at least 32px in both directions
//              (inline links inside running text are exempt);
//   focus      each control reached with Tab shows an outline or a ring.
// The previews (.fl-thumb, .th-sample-box, .th-gallery, .sv-thumb, iframes) are
// the user's design, not chrome, and are skipped.
//   node a11y.js            exits 1 when anything fails
const scr = require('./screens.js');
const run = require('./run.js');

const SKIP = '.fl-thumb, .th-sample-box, .th-gallery, .sv-thumb, .lk-frame, .lb-preview, iframe';

function audit(frame, skip) {
  return frame.evaluate(function (skip) {
    function rgba(s) {
      const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
    }
    function lum(c) {
      return [0, 1, 2].map(function (i) { const v = c[i] / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
        .reduce(function (a, v, i) { return a + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
    }
    function blend(top, under) {
      const a = top[3];
      return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a), 1];
    }
    // Effective background: composite the ancestors' backgrounds from the root down.
    function bgOf(el) {
      const chain = [];
      for (let e = el; e; e = e.parentElement) {
        const s = getComputedStyle(e);
        if (s.backgroundImage !== 'none' && /gradient/.test(s.backgroundImage) && e !== document.body && e !== document.documentElement) {
          const g = s.backgroundImage.match(/rgba?\([^)]+\)/); if (g) chain.push(rgba(g[0]));
        }
        const c = rgba(s.backgroundColor); if (c && c[3] > 0) chain.push(c);
        if (c && c[3] === 1) break;
      }
      let out = [255, 255, 255, 1];
      for (let i = chain.length - 1; i >= 0; i--) out = blend(chain[i], out);
      return out;
    }
    function visible(el) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return false;
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || +s.opacity === 0) return false;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
      return true;
    }
    function label(el) {
      return el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
        ' "' + (el.textContent || el.value || el.getAttribute('aria-label') || '').trim().slice(0, 30) + '"';
    }
    const contrast = [], target = [];
    document.querySelectorAll('body *').forEach(function (el) {
      if (el.closest(skip)) return;
      if (!visible(el)) return;
      const own = Array.from(el.childNodes).some(function (n) { return n.nodeType === 3 && n.textContent.trim(); });
      if (own) {
        const s = getComputedStyle(el);
        const disabled = el.closest(':disabled, [aria-disabled="true"]');
        if (!disabled) {
          let fg = rgba(s.color); const bg = bgOf(el);
          let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
          fg = blend([fg[0], fg[1], fg[2], fg[3] * op], bg);
          const a = lum(fg), b = lum(bg);
          const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
          const size = parseFloat(s.fontSize), bold = +s.fontWeight >= 700;
          const need = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5;
          if (ratio < need) contrast.push(label(el) + ' ' + ratio.toFixed(2) + ':1 at ' + size + 'px');
        }
        if (parseFloat(s.fontSize) < 12) contrast.push(label(el) + ' text is ' + s.fontSize + ' (< 12px)');
      }
      if (el.matches('button, input:not([type=hidden]), select, textarea, a[href], [role=button], [role=tab], summary')) {
        if (el.matches('a') && el.closest('p, li')) return;
        if (el.matches('input[type=checkbox], input[type=radio]') && el.closest('label')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 32 || r.height < 32) target.push(label(el) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      }
    });
    return { contrast: contrast, target: target };
  }, skip);
}

async function focusCheck(page, frame, max) {
  const bad = [];
  await frame.evaluate(function () { document.activeElement && document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const r = await frame.evaluate(function (skip) {
      const el = document.activeElement;
      if (!el || el === document.body || el.closest(skip)) return null;
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 1) || (s.boxShadow && s.boxShadow !== 'none');
      return { ring: ring, name: el.tagName.toLowerCase() + '.' + String(el.className).trim().split(/\s+/).join('.') };
    }, SKIP);
    if (r && !r.ring) bad.push(r.name);
  }
  return Array.from(new Set(bad));
}

(async function () {
  const { chromium } = require('playwright');
  const server = await run.startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: run.cachedChromium() || undefined });
  let failed = 0;
  try {
    for (const appearance of ['dark', 'light']) {
      const e = await scr.openEditor(browser, base, { appearance: appearance, dir: 'ltr', size: scr.VIEWPORTS.desktop });
      try {
        for (const ws of scr.WORKSPACES) {
          await scr.goTo(e.page, e.frame, ws);
          const r = await audit(e.frame, SKIP);
          const f = await focusCheck(e.page, e.frame, 40);
          const list = r.contrast.map(function (x) { return 'contrast ' + x; })
            .concat(r.target.map(function (x) { return 'target ' + x; }))
            .concat(f.map(function (x) { return 'focus ' + x; }));
          const uniq = Array.from(new Set(list));
          uniq.forEach(function (x) { console.log('FAIL ' + ws[0] + '-' + appearance + ': ' + x); });
          if (!uniq.length) console.log('ok   ' + ws[0] + '-' + appearance);
          failed += uniq.length;
        }
      } finally { await e.ctx.close(); }
    }
  } finally { await browser.close(); server.close(); }
  console.log('a11y: ' + failed + ' problem(s)');
  if (failed) process.exitCode = 1;
})().catch(function (e) { console.error(e); process.exit(1); });
