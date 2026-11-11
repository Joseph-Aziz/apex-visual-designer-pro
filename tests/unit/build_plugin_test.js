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
assert.ok(sql.includes(",p_render_function=>'VD_DESIGNER_API.render'"));
assert.ok(sql.includes(",p_ajax_function=>'VD_DESIGNER_API.ajax'"));
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
assert.strictEqual((sql.match(/create_plugin_file\(/g) || []).length, files.length, 'one create_plugin_file per file');
const blocks = sql.split('wwv_flow_imp.g_varchar2_table := wwv_flow_imp.empty_varchar2_table;').slice(1);
files.forEach((rel) => {
  const block = blocks.find((b) => b.includes(",p_file_name=>'" + rel + "'"));
  assert.ok(block, 'file block for ' + rel);
  const hex = [...block.matchAll(/g_varchar2_table\(\d+\) := '([0-9A-F]+)';/g)].map((m) => m[1]).join('');
  assert.ok(Buffer.from(hex, 'hex').equals(fs.readFileSync(path.join(FILES, rel))), 'bytes of ' + rel);
});

// importable into any workspace: no environment values, only the import defaults APEX overrides
assert.ok(!/p_default_workspace_id=>\d/.test(sql), 'workspace comes from the importing session');
console.log('build_plugin_test: all passed');
