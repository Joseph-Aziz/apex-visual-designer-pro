/* tools/db_test_block.js turns a tests/db SQL file into blocks for SQL Commands. Run: node tests/unit/db_test_block_test.js */
const assert = require('assert');
const path = require('path');
const { blocks } = require(path.join(__dirname, '..', '..', 'tools', 'db_test_block.js'));

const opts = { schema: 'S1', app: '100', page: '7' };

const text = [
  '-- Parameters: @x.sql VD_SCHEMA TEST_APP SCRATCH_PAGE',
  'SET DEFINE ON',
  '  set serveroutput on',
  "DEFINE VD_SCHEMA = '&1'",
  'PROMPT running',
  '@@tables/x.sql',
  '-- first suite',
  'BEGIN',
  "  x := &&VD_SCHEMA..PKG.f(&&TEST_APP, &&SCRATCH_PAGE, 'a/b', &&OTHER);",
  'END;',
  '/',
  'DECLARE n NUMBER := 1 / 2;',
  'BEGIN NULL; END;',
  '/',
  ''
].join('\n');

const b = blocks(text, opts);
assert.strictEqual(b.length, 2, 'two "/" lines give two blocks, no empty trailing block');
assert.ok(b[0].startsWith('BEGIN'), 'dropped lines and leading comments are gone: ' + b[0].slice(0, 40));
assert.ok(b[0].includes("S1.PKG.f(100, 7, 'a/b', &&OTHER)"), 'substitutions; unknown && kept; "/" in a line does not split');
assert.ok(!/SET |DEFINE |PROMPT |@@/i.test(b.join('\n')), 'SQL*Plus lines dropped');
assert.ok(b[1].startsWith('DECLARE n NUMBER := 1 / 2;'));
assert.ok(!b[1].endsWith('/'), 'block is trimmed and has no slash');

assert.deepStrictEqual(blocks('/\n\n/\n', opts), [], 'empty blocks dropped');
assert.deepStrictEqual(blocks('BEGIN NULL; END;\r\n/\r\n', opts), ['BEGIN NULL; END;'], 'CRLF input');

console.log('db_test_block_test: PASS');
