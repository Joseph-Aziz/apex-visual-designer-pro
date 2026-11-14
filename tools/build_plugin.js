#!/usr/bin/env node
/* Builds plugin/region_type_plugin_apex_visual_designer.sql: a plug-in export in the APEX 24.2 format (imports into 24.2 and later) with
   every file under plugin/files as a plug-in file. No dependencies beyond Node itself.
   Usage: node tools/build_plugin.js [--version 1.0.0] [--out <file>] */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FILES = path.join(ROOT, 'plugin', 'files');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const VERSION = opt('version', '1.2.11');
const OUT = opt('out', path.join(ROOT, 'plugin', 'region_type_plugin_apex_visual_designer.sql'));
const NAME = 'COM.APEXVD.VISUAL_DESIGNER';

// Stable component ids, so re-importing a new build replaces the same plug-in parts.
function id(key) { return BigInt('0x' + crypto.createHash('sha1').update(NAME + ':' + key).digest('hex').slice(0, 14)).toString(); }
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

function list(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap((e) => e.isDirectory() ? list(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

// The database scripts the plug-in runs on first use, in database/install.sql order. Each
// slash-terminated statement becomes one chunk; MARK separates the chunks.
const MARK = '\n--@@VD_STMT@@\n';
const INSTALL = ['tables/vd_install', 'tables/vd_target_applications', 'tables/vd_page_code_versions',
  'tables/vd_theme_versions', 'tables/vd_layout_versions', 'packages/pkg_vd_design_api', 'packages/pkg_vd_page_code', 'packages/pkg_vd_theme',
  'packages/pkg_vd_page_writer', 'packages/pkg_vd_plugin'];

// A cut at a "/" line inside a comment or literal, or the separator inside the text, would run a
// broken statement on the database; stop the build instead.
function checkChunk(file, chunk) {
  if (chunk.includes(MARK.trim())) throw new Error(file + '.sql: contains the statement separator');
  const code = chunk.replace(/^(\s*--[^\n]*\n)+/, '').trim();
  if (!/^(CREATE|DECLARE|BEGIN)\b/i.test(code)) throw new Error(file + '.sql: a statement does not start with CREATE, DECLARE or BEGIN');
  if (!/\bEND(\s+\w+)?\s*;$/i.test(code)) throw new Error(file + '.sql: a statement does not end with END;');
}

function installScript() {
  const chunks = [];
  INSTALL.forEach((f) => {
    const text = fs.readFileSync(path.join(ROOT, 'database', f + '.sql'), 'utf8').replace(/\r\n/g, '\n');
    const parts = text.split(/^\/[ \t]*$/m);
    if (parts.pop().trim()) throw new Error(f + '.sql: text after the last "/"');
    parts.forEach((c) => { if (c.trim()) { checkChunk(f, c.trim()); chunks.push(c.trim()); } });
  });
  return chunks.join(MARK) + MARK;
}

function fileBlock(abs) {
  return contentBlock(path.relative(FILES, abs).split(path.sep).join('/'), fs.readFileSync(abs));
}

// The plug-in's own PL/SQL code, as APEX exports it.
function plsqlCode() {
  const text = fs.readFileSync(path.join(ROOT, 'plugin', 'bootstrap.sql'), 'utf8').replace(/\r\n/g, '\n')
    .split('#VD_VERSION#').join(VERSION);
  const lines = text.replace(/\n+$/, '').split('\n');
  return 'wwv_flow_string.join(wwv_flow_t_varchar2(\n' + lines.map(q).join(',\n') + '))';
}

function contentBlock(rel, bytes) {
  const hex = bytes.toString('hex').toUpperCase();
  const lines = [];
  for (let i = 0, n = 1; i < hex.length; i += 200, n++) lines.push('wwv_flow_imp.g_varchar2_table(' + n + ') := ' + q(hex.slice(i, i + 200)) + ';');
  return 'begin\nwwv_flow_imp.g_varchar2_table := wwv_flow_imp.empty_varchar2_table;\n' + lines.join('\n') + '\nnull;\nend;\n/\n' +
    'begin\nwwv_flow_imp_shared.create_plugin_file(\n p_id=>wwv_flow_imp.id(' + id('file:' + rel) + ')\n' +
    ',p_plugin_id=>wwv_flow_imp.id(' + id('plugin') + ')\n,p_file_name=>' + q(rel) + '\n' +
    ',p_mime_type=>' + q(MIME[path.extname(rel)] || 'application/octet-stream') + '\n' +
    ',p_file_content=>wwv_flow_imp.varchar2_to_blob(wwv_flow_imp.g_varchar2_table)\n);\nend;\n/\n';
}

function attribute(n, prompt, type, help) {
  const s = String(n).padStart(2, '0');
  return 'wwv_flow_imp_shared.create_plugin_attribute(\n p_id=>wwv_flow_imp.id(' + id('attr:' + s) + ')\n' +
    ',p_plugin_id=>wwv_flow_imp.id(' + id('plugin') + ')\n,p_attribute_scope=>\'COMPONENT\'\n' +
    ',p_attribute_sequence=>' + n + '\n,p_display_sequence=>' + (n * 10) + '\n,p_static_id=>' + q('attribute_' + s) + '\n' +
    ',p_prompt=>' + q(prompt) + '\n,p_attribute_type=>' + q(type) + '\n,p_is_required=>false\n,p_is_translatable=>false\n' +
    ',p_help_text=>' + q(help) + '\n);\n';
}

const sql =
`prompt --application/set_environment
set define off verify off feedback off
whenever sqlerror exit sql.sqlcode rollback
--------------------------------------------------------------------------------
-- APEX Visual Designer ${VERSION}: region type plug-in ${NAME}
-- Generated by tools/build_plugin.js from plugin/files. Import it in App Builder
-- (Shared Components > Plug-ins > Import) into the application that hosts the designer.
-- The plug-in installs its database objects into the parsing schema on first use.
--------------------------------------------------------------------------------
begin
wwv_flow_imp.import_begin (
 p_version_yyyy_mm_dd=>'2024.11.30'
,p_release=>'24.2.0'
,p_default_workspace_id=>1000
,p_default_application_id=>100
,p_default_id_offset=>0
,p_default_owner=>'VD_OWNER'
);
end;
/
begin
  -- replace components
  wwv_flow_imp.g_mode := 'REPLACE';
end;
/
prompt --application/shared_components/plugins/region_type/com_apexvd_visual_designer
begin
wwv_flow_imp_shared.create_plugin(
 p_id=>wwv_flow_imp.id(${id('plugin')})
,p_plugin_type=>'REGION TYPE'
,p_name=>'${NAME}'
,p_display_name=>'APEX Visual Designer'
,p_api_version=>2
,p_plsql_code=>${plsqlCode()}
,p_render_function=>'vd_render'
,p_ajax_function=>'vd_ajax'
,p_substitute_attributes=>true
,p_version_scn=>'1'
,p_help_text=>${q('Flutter Designer and Theme Designer for Oracle APEX pages. On first use it creates its tables and packages in the parsing schema of the application.')}
,p_version_identifier=>'${VERSION}'
,p_about_url=>'https://github.com/josephaaziz-byte/apex-visual-designer-plugin'
,p_files_version=>1
);
${attribute(1, 'Designer authorization', 'TEXT', 'Name of an authorization scheme of this application. Users it admits may use the designer. Leave empty to allow only developers signed in to App Builder.')}${attribute(2, 'Default target application', 'INTEGER', 'Application id the designer opens by default. Leave empty for this application. The target must be registered with database/register_target.sql.')}${attribute(3, 'Height (px)', 'INTEGER', 'Height of the designer. Default 800.')}end;
/
${list(FILES).map(fileBlock).join('')}${contentBlock('install/vd-install.sql', Buffer.from(installScript(), 'utf8'))}prompt --application/end_environment
begin
wwv_flow_imp.import_end(p_auto_install_sup_obj => nvl(wwv_flow_application_install.get_auto_install_sup_obj, false));
commit;
end;
/
set verify on feedback on define on
prompt  ...done
`;

module.exports = { checkChunk };
if (require.main === module) {
fs.writeFileSync(OUT, sql);
console.log('wrote ' + path.relative(process.cwd(), OUT) + ' (' + (list(FILES).length + 1) + ' files, version ' + VERSION + ')');
}
