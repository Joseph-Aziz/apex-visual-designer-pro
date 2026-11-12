/* The table and package scripts name no schema, so they compile into whichever schema runs them.
   Run: node tests/unit/schema_free_test.js */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

let n = 0;
for (const dir of ['database/tables', 'database/packages']) {
  for (const f of fs.readdirSync(dir)) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/&&VD_SCHEMA/.test(text), dir + '/' + f + ' still names the schema');
    assert.ok(!/\bALL_(TABLES|SEQUENCES)\b/.test(text), dir + '/' + f + ' should check USER_ views');
    n++;
  }
}
const install = fs.readFileSync('database/install.sql', 'utf8');
const a = install.indexOf('@@tables/vd_install.sql');
assert.ok(a >= 0, 'install.sql runs tables/vd_install.sql');
assert.ok(a < install.indexOf('@@tables/vd_target_applications.sql'), 'vd_install comes first');
assert.ok(fs.existsSync('database/tables/vd_install.sql'));
const host = fs.readFileSync('database/host_setup.sql', 'utf8');
assert.ok(/SYNONYM PKG_VD_PLUGIN FOR/.test(host), 'host_setup creates the PKG_VD_PLUGIN synonym');
assert.ok(!/VD_DESIGNER_API/.test(host), 'no VD_DESIGNER_API synonym');
console.log('schema_free_test: ' + n + ' files checked, all passed');
