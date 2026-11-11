/* Fails when a value from the original pilot environment appears in the release.
   Run: node tests/unit/no_env_values_test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..', '..');
const SKIP = new Set(['CHANGELOG.md', 'docs/DESIGN.md', 'tests/unit/no_env_values_test.js']);
const SKIP_DIRS = new Set(['.git', '.superpowers', 'node_modules', 'dist']);
const VALUES = ['2202031942456798', '11021248789416648', 'SHABAB_PUBLIC', 'STANTONYAD', 'HTML_DESIGN',
  'stantony', 'shababdb', 'امانة الخدمة', 'v2461355170023'];

function walk(dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else out.push(path.relative(ROOT, path.join(dir, e.name)).split(path.sep).join('/'));
  });
  return out;
}

const found = [];
walk(ROOT, []).filter((f) => !SKIP.has(f)).forEach((f) => {
  const text = fs.readFileSync(path.join(ROOT, f), 'utf8');
  VALUES.forEach((v) => { if (text.includes(v)) found.push(f + ': ' + v); });
  if (/\.(js|sql)$/.test(f) && /\b144\b/.test(text)) found.push(f + ': 144');
});
assert.deepStrictEqual(found, [], 'environment values found:\n' + found.join('\n'));
console.log('no_env_values_test: all passed');
