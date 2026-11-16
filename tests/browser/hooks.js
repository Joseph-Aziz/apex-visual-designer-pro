'use strict';
// DOM hook inventory for the Creative Studio redesign.
//   node hooks.js --static                      HEAD vs working copy of the editor's markup sources
//   node hooks.js --rendered [--out f] [--compare baseline.json]
//                                                hooks of the rendered editor in a fixed list of states
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SOURCES = ['plugin/files/index.html'].concat(
  ['app', 'page-bar', 'flutter-mode', 'theme-mode', 'layout-mode', 'fl-params', 'chart-designer']
    .map(function (n) { return 'plugin/files/js/' + n + '.js'; }));

// token -> reason. Listed in the report, never a failure.
const ALLOW = {
  'div.fl-left': 'the rendered baseline came from the pre-Studio WIP tree, where fl-left had moved to a div; it is back on aside.lk-left as at HEAD',
  'div.fl-right': 'the rendered baseline came from the pre-Studio WIP tree, where fl-right had moved to a div; it is back on aside.lk-right as at HEAD'
};

const CLASS_RE = /\b(?:vd|fl|th|lb|lk|pb|sv|cd|rail|brand|studio|look|view|is)-[a-z0-9-]+\b/g;
const PAIR_RE = /<(div|span|strong|ul|li|button|input|select|textarea|a|label|details|summary|aside|section|nav|main|header)\b[^>]*?class=\\?["']([^"'\\]+)/g;

function extract(text) {
  const set = new Set();
  const pairs = new Set();
  (text.match(CLASS_RE) || []).forEach(function (t) { set.add('class:' + t); });
  let m;
  const cls = /class=\\?["']([^"'\\]*)/g;
  while ((m = cls.exec(text))) {
    m[1].split(/\s+/).forEach(function (t) {
      if (/^(shell|views|view|rail|topbar|brand)$/.test(t)) set.add('class:' + t);
    });
  }
  const id = /\bid=\\?["']([A-Za-z][\w-]*)/g;
  while ((m = id.exec(text))) set.add('id:' + m[1]);
  const attr = /\b((?:data|aria)-[a-z-]+)(?==)/g;
  while ((m = attr.exec(text))) set.add('attr:' + m[1]);
  const role = /\brole=\\?["']([a-z]+)/g;
  while ((m = role.exec(text))) set.add('role:' + m[1]);
  PAIR_RE.lastIndex = 0;
  while ((m = PAIR_RE.exec(text))) {
    m[2].split(/\s+/).filter(Boolean).forEach(function (c) { pairs.add(m[1] + '.' + c); });
  }
  return { set: set, pairs: pairs };
}

function runStatic() {
  const head = { set: new Set(), pairs: new Set() };
  const work = { set: new Set(), pairs: new Set() };
  SOURCES.forEach(function (rel) {
    let old = '';
    try { old = execFileSync('git', ['show', 'HEAD:' + rel], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { /* new file */ }
    const abs = path.join(ROOT, rel);
    const now = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : '';
    const a = extract(old), b = extract(now);
    a.set.forEach(function (t) { head.set.add(t); });
    a.pairs.forEach(function (t) { head.pairs.add(t); });
    b.set.forEach(function (t) { work.set.add(t); });
    b.pairs.forEach(function (t) { work.pairs.add(t); });
  });
  const problems = [];
  head.set.forEach(function (t) { if (!work.set.has(t)) problems.push('removed ' + t); });
  head.pairs.forEach(function (p) {
    if (work.pairs.has(p)) return;
    const cls = p.slice(p.indexOf('.') + 1);
    const now = Array.from(work.pairs).filter(function (q) { return q.slice(q.indexOf('.') + 1) === cls; });
    if (now.length) problems.push('moved ' + p + ' -> ' + now.join(', '));
  });
  let failed = 0;
  problems.forEach(function (p) {
    const token = p.split(' ')[1];
    if (ALLOW[token]) console.log('ALLOWED ' + p + ' — ' + ALLOW[token]);
    else { console.log('FAIL ' + p); failed++; }
  });
  if (failed) { console.log('static hooks: ' + failed + ' problem(s)'); process.exit(1); }
  console.log('static hooks: OK (' + head.set.size + ' tokens, ' + head.pairs.size + ' tag/class pairs)');
}

// ------------------------------------------------------------------ rendered
function collect(frame) {
  return frame.evaluate(function () {
    const out = [];
    document.querySelectorAll('*').forEach(function (el) {
      if (el.closest('.fl-thumb, .th-sample-box, .th-gallery, .sv-thumb')) return;
      const attrs = [];
      const aria = [];
      Array.from(el.attributes).forEach(function (a) {
        if (a.name.indexOf('data-') === 0) attrs.push(a.name + '=' + a.value);
        else if (a.name.indexOf('aria-') === 0) aria.push(a.name);
      });
      const classes = Array.from(el.classList).sort();
      if (!el.id && !classes.length && !attrs.length && !aria.length && !el.getAttribute('role')) return;
      out.push([el.tagName.toLowerCase(), el.id ? '#' + el.id : '', classes.length ? '.' + classes.join('.') : '',
        attrs.sort().join(' '), aria.sort().join(' '), el.getAttribute('role') || '', el.getAttribute('type') || ''].join('|'));
    });
    return Array.from(new Set(out)).sort();
  });
}

// (tag, hook) facts of one state, for the comparison.
function facts(list) {
  const f = new Set();
  list.forEach(function (row) {
    const p = row.split('|');
    const tag = p[0];
    if (p[1]) f.add(tag + p[1]);
    if (p[2]) p[2].slice(1).split('.').forEach(function (c) { f.add(tag + '.' + c); });
    if (p[3]) p[3].split(' ').forEach(function (a) { f.add(tag + '[' + a.split('=')[0] + ']'); });
  });
  return f;
}

async function runRendered(args) {
  const { chromium } = require('playwright');
  const run = require('./run.js');
  const server = await run.startServer();
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: run.cachedChromium() || undefined });
  const result = {};
  try {
    const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
    await page.goto(base + '/tests/browser/host.html', { waitUntil: 'domcontentloaded' });
    const frame = await run.editorFrame(page);
    await frame.waitForSelector('.fl-top');
    await page.waitForTimeout(400);
    // A view change may first ask about unsaved changes: discard them.
    async function leave(target) {
      // The first question is "save now?" (Cancel), the second "discard?" (OK).
      for (let i = 0; i < 2; i++) {
        await frame.waitForFunction(function (t) { return !!document.querySelector('.vd-ask, ' + t); }, target, { timeout: 12000 });
        if (!(await frame.$('.vd-ask'))) break;
        if (i === 0) await run.cancelAsk(frame); else await run.confirmAsk(frame);
        await page.waitForTimeout(200);
      }
      {
        await frame.waitForSelector(target, { state: 'attached', timeout: 12000 });
      }
      await page.waitForTimeout(500);
    }
    const states = [
      ['design-no-page', async function () {}],
      ['page-open', async function () {
        await frame.fill('.pb-page', '1');
        await frame.click('.pb-open');
        await frame.waitForSelector('.fl-left .lk-slot');
      }],
      ['item-selected', async function () {
        await frame.click('.fl-left .lk-slot[data-key="item:P1_EMAIL"]');
        await frame.waitForSelector('.fl-right .fl-variant');
      }],
      ['variant-picked', async function () {
        await frame.click('.fl-right [data-variant="v2"]');
        await page.waitForTimeout(300);
      }],
      ['all-components', async function () {
        await frame.click('.fl-left [data-view="all"]');
        await frame.waitForSelector('.fl-tile');
      }],
      ['theme-global', async function () {
        await frame.click('.fl-left [data-view="page"]');
        await frame.click('.rail-item[data-view="theme"]');
        await leave('.th-top');
        await page.waitForTimeout(500);
      }],
      ['theme-more-open', async function () { await run.openMore(frame); await page.waitForTimeout(200); }],
      ['layout', async function () {
        await frame.click('.rail-item[data-view="layout"]');
        await leave('.lb-top');
        await page.waitForTimeout(500);
      }],
      ['library', async function () {
        await frame.click('.rail-item[data-view="saved"]');
        await leave('.sv-page');
      }]
    ];
    for (const [name, go] of states) {
      try { await go(); result[name] = await collect(frame); console.log('state ' + name + ': ' + result[name].length + ' elements'); }
      catch (e) { console.log('state ' + name + ': NOT REACHED — ' + e.message.split('\n')[0]); }
    }
  } finally {
    await browser.close();
    server.close();
  }
  const out = args.out || path.join(__dirname, 'out', 'hooks-rendered.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log('wrote ' + out);
  if (!args.compare) return;
  const baseline = JSON.parse(fs.readFileSync(args.compare, 'utf8'));
  let missing = 0;
  Object.keys(baseline).forEach(function (state) {
    if (!result[state]) { console.log('MISSING state ' + state); missing++; return; }
    const now = facts(result[state]);
    facts(baseline[state]).forEach(function (f) {
      if (!now.has(f) && !ALLOW[f]) { console.log('MISSING ' + state + ': ' + f); missing++; }
    });
  });
  if (missing) { console.log('rendered hooks: ' + missing + ' missing'); process.exit(1); }
  console.log('rendered hooks: OK');
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--static') a.static = true;
    else if (argv[i] === '--rendered') a.rendered = true;
    else if (argv[i] === '--out') a.out = path.resolve(argv[++i]);
    else if (argv[i] === '--compare') a.compare = path.resolve(argv[++i]);
  }
  return a;
}

const args = parseArgs(process.argv.slice(2));
if (args.static) runStatic();
else if (args.rendered) runRendered(args).catch(function (e) { console.error(e); process.exit(1); });
else console.log('usage: node hooks.js --static | --rendered [--out file] [--compare baseline.json]');
