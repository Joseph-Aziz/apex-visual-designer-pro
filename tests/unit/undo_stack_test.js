/* Unit tests for js/undo-stack.js (spec §7). Run: node tests/unit/undo_stack_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
vm.runInNewContext(fs.readFileSync('plugin/files/js/undo-stack.js', 'utf8'), { window, JSON }, { filename: 'undo-stack.js' });
const U = window.VD.undoStack;
assert.ok(U, 'VD.undoStack is undefined');

let s = U.create(100);
assert.ok(!s.canUndo() && !s.canRedo());
assert.strictEqual(s.undo('a'), null, 'nothing to undo');

// record(before) is called with the state before each change
s.record('a');            // a -> b
s.record('b');            // b -> c
assert.ok(s.canUndo());
assert.strictEqual(s.undo('c'), 'b');
assert.strictEqual(s.undo('b'), 'a');
assert.ok(!s.canUndo() && s.canRedo());
assert.strictEqual(s.redo('a'), 'b');
assert.strictEqual(s.redo('b'), 'c');
assert.strictEqual(s.redo('c'), null);

// a new change after undo drops the redo branch
s.undo('c');              // now b
s.record('b');            // b -> d
assert.ok(!s.canRedo());
assert.strictEqual(s.undo('d'), 'b');

// recording the same state twice in a row keeps one step (typing in a field)
s = U.create(100);
s.record('a'); s.record('a');
assert.strictEqual(s.undo('b'), 'a');
assert.ok(!s.canUndo());

// at most `limit` steps; the oldest go first
s = U.create(100);
for (let i = 0; i < 150; i++) s.record('s' + i);
let n = 0, cur = 'end';
while (s.canUndo()) { cur = s.undo(cur); n++; }
assert.strictEqual(n, 100);
assert.strictEqual(cur, 's50');

// clear forgets everything (another page opened)
s.record('x'); s.clear();
assert.ok(!s.canUndo() && !s.canRedo());

console.log('undo_stack_test: all passed');
