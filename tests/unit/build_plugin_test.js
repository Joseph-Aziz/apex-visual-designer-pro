/* tools/build_plugin.js writes an importable APEX 26.2 plug-in export. Run: node tests/unit/build_plugin_test.js */
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const out = path.join(os.tmpdir(), 'vd_plugin_test_' + process.pid + '.sql');
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build_plugin.js'), '--out', out, '--version', '9.9.9'], { cwd: ROOT });
const sql = fs.readFileSync(out, 'utf8');
fs.unlinkSync(out);

assert.ok(sql.includes('wwv_flow_imp_shared.create_plugin('), 'create_plugin call');
assert.ok(sql.includes(",p_plugin_type=>'REGION TYPE'"));
assert.ok(sql.includes(",p_name=>'COM.APEXVD.VISUAL_DESIGNER'"));
assert.ok(sql.includes(",p_display_name=>'APEX Visual Designer'"));
// the bootstrap in the plug-in's own PL/SQL code installs the database objects, then dispatches
assert.ok(sql.includes(",p_render_function=>'vd_render'"));
assert.ok(sql.includes(",p_ajax_function=>'vd_ajax'"));
assert.ok(sql.includes(',p_plsql_code=>wwv_flow_string.join(wwv_flow_t_varchar2('), 'plug-in PL/SQL code');
assert.ok(!sql.includes('VD_DESIGNER_API'), 'no synonym wording');
// procedure-style render and AJAX callbacks (p_result IN OUT) need plug-in API version 2
assert.ok(sql.includes(',p_api_version=>2'), 'api version 2');
assert.ok(sql.includes(",p_version_identifier=>'9.9.9'"));
['attribute_01', 'attribute_02', 'attribute_03'].forEach((a) =>
  assert.ok(sql.includes(",p_static_id=>'" + a + "'"), a));

// one plug-in file per editor file, each decoding back to the same bytes
function list(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
const FILES = path.join(ROOT, 'plugin', 'files');
const files = list(FILES).map((f) => path.relative(FILES, f).split(path.sep).join('/'));
assert.strictEqual((sql.match(/create_plugin_file\(/g) || []).length, files.length + 1, 'one create_plugin_file per file, plus the install script');
const blocks = sql.split('wwv_flow_imp.g_varchar2_table := wwv_flow_imp.empty_varchar2_table;').slice(1);
files.forEach((rel) => {
  const block = blocks.find((b) => b.includes(",p_file_name=>'" + rel + "'"));
  assert.ok(block, 'file block for ' + rel);
  const hex = [...block.matchAll(/g_varchar2_table\(\d+\) := '([0-9A-F]+)';/g)].map((m) => m[1]).join('');
  assert.ok(Buffer.from(hex, 'hex').equals(fs.readFileSync(path.join(FILES, rel))), 'bytes of ' + rel);
});

// the install script: every table and package script in install.sql order, one statement per chunk
const MARK = '\n--@@VD_STMT@@\n';
const iblock = blocks.find((b) => b.includes(",p_file_name=>'install/vd-install.sql'"));
assert.ok(iblock, 'install/vd-install.sql is a plug-in file');
const install = Buffer.from([...iblock.matchAll(/g_varchar2_table\(\d+\) := '([0-9A-F]+)';/g)].map((m) => m[1]).join(''), 'hex').toString('utf8');
assert.ok(install.includes(MARK), 'statement marker');
assert.ok(!/^\/\s*$/m.test(install), 'no SQL*Plus slash lines');
assert.ok(install.includes('CREATE OR REPLACE PACKAGE BODY PKG_VD_PLUGIN'), 'plug-in package body');
const chunks = install.split(MARK).filter((c) => c.trim());
const order = ['VD_INSTALL', 'VD_TARGET_APPLICATIONS', 'VD_PAGE_CODE_VERSIONS', 'VD_THEME_VERSIONS',
  'PACKAGE PKG_VD_DESIGN_API', 'PACKAGE PKG_VD_PAGE_CODE', 'PACKAGE PKG_VD_THEME', 'PACKAGE PKG_VD_PAGE_WRITER', 'PACKAGE PKG_VD_PLUGIN'];
let at = -1;
order.forEach((name) => { const i = install.indexOf(name); assert.ok(i > at, name + ' in install.sql order'); at = i; });
chunks.forEach((c, i) => {
  const units = new Set([...c.matchAll(/CREATE OR REPLACE PACKAGE (?:BODY )?(PKG_VD_\w+)/g)].map((m) => m[0]));
  assert.ok(units.size <= 1, 'chunk ' + (i + 1) + ' holds one unit: ' + [...units].join(', '));
  assert.ok(!/&&|^\s*(SET|PROMPT|DEFINE)\b/im.test(c), 'chunk ' + (i + 1) + ' has no SQL*Plus commands');
});
// one chunk per slash-terminated statement in the source scripts
const SOURCES = ['tables/vd_install', 'tables/vd_target_applications', 'tables/vd_page_code_versions', 'tables/vd_theme_versions',
  'packages/pkg_vd_design_api', 'packages/pkg_vd_page_code', 'packages/pkg_vd_theme', 'packages/pkg_vd_page_writer', 'packages/pkg_vd_plugin'];
const slashes = SOURCES.reduce((n, f) => n + (fs.readFileSync(path.join(ROOT, 'database', f + '.sql'), 'utf8').match(/^\/\s*$/gm) || []).length, 0);
assert.strictEqual(chunks.length, slashes, 'one chunk per statement');

// importable into any workspace: no environment values, only the import defaults APEX overrides
assert.ok(!/p_default_workspace_id=>\d/.test(sql), 'workspace comes from the importing session');
console.log('build_plugin_test: all passed');
