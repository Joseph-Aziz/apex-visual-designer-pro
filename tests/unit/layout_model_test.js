/* Unit tests for js/layout-model.js. Run: node tests/unit/layout_model_test.js */
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const window = {};
const ctx = { window, JSON };
vm.runInNewContext(fs.readFileSync('plugin/files/js/layout-model.js', 'utf8'), ctx, { filename: 'layout-model.js' });
const M = window.VD && window.VD.layoutModel;
assert.ok(M, 'VD.layoutModel is undefined');

function fixture() {
  return {
    token: 't1',
    slots: [{ name: 'BODY', label: 'Body', grid: true }, { name: 'REGION_POSITION_08', label: 'Dialog Footer', grid: false }],
    regions: [
      { id: 'R1', title: 'One', parent: null, slot: 'BODY', seq: 10, newRow: true, newCol: true, colStart: null, span: 6, hidden: false },
      { id: 'R2', title: 'Two', parent: null, slot: 'BODY', seq: 20, newRow: false, newCol: true, colStart: null, span: 6, hidden: false },
      { id: 'R3', title: 'Three', parent: 'R1', slot: 'SUB_REGIONS', seq: 10, newRow: true, newCol: true, colStart: null, span: null, hidden: false }
    ],
    items: [
      { id: 'I1', name: 'P1_A', label: 'A', region: 'R1', seq: 10, newRow: true, newCol: true, colStart: null, span: null, type: 'TEXT', hidden: false },
      { id: 'I2', name: 'P1_B', label: 'B', region: 'R1', seq: 20, newRow: true, newCol: true, colStart: null, span: null, type: 'TEXT', hidden: false },
      { id: 'I9', name: 'P1_X', label: 'X', region: null, seq: 10, newRow: true, newCol: true, colStart: null, span: null, type: 'HIDDEN', hidden: false }
    ]
  };
}
const find = (list, id) => list.find((c) => c.id === id);

// load: nothing changed
let b = M.load(fixture());
assert.deepStrictEqual(Array.from(M.changes(b)), [], 'no changes after load');
assert.strictEqual(M.dirty(b), false, 'not dirty after load');

// move region before
b = M.load(fixture());
assert.ok(M.move(b, 'region', 'R2', { container: 'slot:BODY', before: 'R1', sameRow: true }).ok, 'move R2 before R1');
let ch = M.changes(b);
assert.strictEqual(find(ch, 'R2').seq, 10, 'R2 seq 10');
assert.strictEqual(find(ch, 'R1').seq, 20, 'R1 seq 20');
assert.ok(ch.every((c) => c.id === 'R1' || c.id === 'R2'), 'only changed components');
assert.strictEqual(M.dirty(b), true, 'dirty after move');
assert.strictEqual(M.rows(b, 'slot:BODY').length, 1, 'still one row');

// new row
b = M.load(fixture());
assert.ok(M.move(b, 'region', 'R2', { container: 'slot:BODY', before: null, sameRow: false }).ok, 'R2 new row');
assert.strictEqual(find(M.changes(b), 'R2').newRow, true, 'R2 newRow');
assert.strictEqual(M.rows(b, 'slot:BODY').length, 2, 'two rows');

// row overflow refused
b = M.load(fixture());
let r = M.setSpan(b, 'region', 'R1', 8);
assert.strictEqual(r.ok, false, 'R1 span 8 refused');
assert.ok(/12 columns/.test(r.reason), 'reason names 12 columns');
assert.strictEqual(M.dirty(b), false, 'board unchanged after refusal');

// span resize refused when row overflows
r = M.setSpan(b, 'region', 'R2', 7);
assert.strictEqual(r.ok, false, 'R2 span 7 refused');
assert.ok(M.setSpan(b, 'region', 'R2', 4).ok, 'R2 span 4 ok');
assert.strictEqual(find(M.changes(b), 'R2').span, 4, 'span change listed');
assert.strictEqual(M.setSpan(b, 'region', 'R2', 13).ok, false, 'span above 12 refused');

// parent cycle refused
b = M.load(fixture());
r = M.move(b, 'region', 'R1', { container: 'region:R3', before: null, sameRow: false });
assert.strictEqual(r.ok, false, 'R1 into R3 refused');
assert.ok(/inside itself/.test(r.reason), 'cycle reason');
r = M.move(b, 'region', 'R1', { container: 'region:R1', before: null, sameRow: false });
assert.strictEqual(r.ok, false, 'R1 into R1 refused');
assert.strictEqual(M.dirty(b), false, 'unchanged after cycle refusal');

// region moves with children
b = M.load(fixture());
assert.ok(M.move(b, 'region', 'R1', { container: 'slot:REGION_POSITION_08', before: null, sameRow: false }).ok, 'R1 to footer');
ch = M.changes(b);
assert.ok(find(ch, 'R1') && find(ch, 'R1').slot === 'REGION_POSITION_08', 'R1 in footer');
assert.ok(!find(ch, 'R3') && !find(ch, 'I1') && !find(ch, 'I2'), 'children unchanged');

// no grid slot
assert.strictEqual(M.setSpan(b, 'region', 'R1', 4).ok, false, 'no span in a no-grid slot');
assert.strictEqual(find(M.changes(b), 'R1').newRow, true, 'newRow untouched in a no-grid slot');

// item between regions
b = M.load(fixture());
assert.ok(M.move(b, 'item', 'I2', { container: 'region:R2', before: null, sameRow: false }).ok, 'I2 into R2');
const i2 = find(M.changes(b), 'I2');
assert.strictEqual(i2.kind, 'item');
assert.strictEqual(i2.region, 'R2');
assert.strictEqual(i2.seq, 10);
assert.ok(!find(M.changes(b), 'I1'), 'I1 unchanged');

// no region strip
b = M.load(fixture());
assert.ok(M.move(b, 'item', 'I9', { container: 'region:R1', before: 'I1', sameRow: false }).ok, 'no-region item into R1');
assert.strictEqual(M.move(b, 'item', 'I1', { container: 'noregion', before: null, sameRow: false }).ok, false, 'nothing moves to no region');
assert.strictEqual(M.move(b, 'item', 'I1', { container: 'slot:BODY', before: null, sameRow: false }).ok, false, 'items need a region');

// moved component loses column start
const f = fixture();
f.regions[0].colStart = 3;
f.regions[1].colStart = 9;
b = M.load(f);
assert.ok(M.move(b, 'region', 'R1', { container: 'slot:BODY', before: null, sameRow: true }).ok, 'R1 to end');
ch = M.changes(b);
assert.strictEqual(find(ch, 'R1').colStart, null, 'moved colStart cleared');
assert.strictEqual(find(ch, 'R2').colStart, 9, 'unmoved keeps colStart');

console.log('layout_model_test: all passed');
