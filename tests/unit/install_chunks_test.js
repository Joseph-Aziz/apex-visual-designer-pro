/* The install script is cut into statements at "/" lines; a bad cut must stop the build. Run: node tests/unit/install_chunks_test.js */
const assert = require('assert');
const path = require('path');
const { checkChunk } = require(path.join(__dirname, '..', '..', 'tools', 'build_plugin.js'));

assert.doesNotThrow(() => checkChunk('t', 'CREATE OR REPLACE PACKAGE X AS\n  p NUMBER;\nEND X;'));
assert.doesNotThrow(() => checkChunk('t', '-- note\nDECLARE l NUMBER;\nBEGIN NULL;\nEND;'));
// a "/" line inside a comment or literal splits a package: the tail starts mid-code
assert.throws(() => checkChunk('t', 'p NUMBER;\nEND X;'), /does not start/);
// the head of such a split does not end with END
assert.throws(() => checkChunk('t', 'CREATE OR REPLACE PACKAGE X AS\n/* a'), /does not end/);
// the separator inside package text would split it on the database
assert.throws(() => checkChunk('t', 'BEGIN NULL;\n--@@VD_STMT@@\nEND;'), /separator/);
console.log('install_chunks_test: all passed');
