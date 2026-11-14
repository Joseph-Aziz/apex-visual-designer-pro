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

// a box that does not lead its row and outgrows it starts a row of its own
r = M.setSpan(b, 'region', 'R2', 7);
assert.ok(r.ok, 'R2 span 7 moves R2 to its own row');
assert.strictEqual(find(M.changes(b), 'R2').newRow, true, 'R2 starts a new row');
b = M.load(fixture());
assert.ok(M.setSpan(b, 'region', 'R2', 4).ok, 'R2 span 4 ok');
assert.strictEqual(find(M.changes(b), 'R2').newRow, false, 'R2 keeps its row when it fits');
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

// review fix: leaving a row keeps the next box on its own row
function rowFixture() {
  const f = fixture();
  f.regions = [
    { id: 'A', title: 'A', parent: null, slot: 'BODY', seq: 10, newRow: true, newCol: true, colStart: null, span: 6, hidden: false },
    { id: 'B', title: 'B', parent: null, slot: 'BODY', seq: 20, newRow: true, newCol: true, colStart: null, span: 8, hidden: false },
    { id: 'C', title: 'C', parent: null, slot: 'BODY', seq: 30, newRow: false, newCol: true, colStart: null, span: 4, hidden: false },
    { id: 'R1', title: 'One', parent: null, slot: 'BODY', seq: 40, newRow: true, newCol: true, colStart: null, span: null, hidden: false }
  ];
  f.items = [];
  return f;
}
b = M.load(rowFixture());
assert.ok(M.move(b, 'region', 'B', { container: 'region:R1', before: null, sameRow: false }).ok, 'move B into R1');
assert.strictEqual(b.comps['region:C'].newRow, true, 'C starts a new row after B leaves');
assert.strictEqual(M.rows(b, 'slot:BODY').length, 3, 'A, C and R1 rows kept');

// review fix: rows are grouped per kind, as the server does
b = M.load(fixture());
b.comps['region:R3'].span = 8; b.comps['item:I1'].span = 8; b.comps['item:I1'].newRow = false;
assert.ok(M.setSpan(b, 'item', 'I1', 8).ok, 'span-8 item after span-8 sub-region is a separate row');

console.log('layout_model_test: all passed');
// drop at the end of a row that has a row after it: joins that row, the next row stays
{
  const f = fixture();
  f.regions[1].newRow = true;
  f.regions.push({ id: 'R4', title: 'Four', parent: null, slot: 'BODY', seq: 30, newRow: true, newCol: true, colStart: null, span: 3, hidden: false });
  const bb = M.load(f);
  assert.ok(M.move(bb, 'region', 'R4', { container: 'slot:BODY', before: 'R2', sameRow: true, endOfRow: true }).ok, 'R4 end of row 1');
  const rows = M.rows(bb, 'slot:BODY').map((row) => row.map((c) => c.id));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(rows)), [['R1', 'R4'], ['R2']], 'R4 beside R1, R2 keeps its row');
}
console.log('layout_model_test: end of row passed');
// buttons: body buttons share rows with items, others sit in a strip of their region and position
{
  const f = fixture();
  const rid = f.regions[0].id;
  f.items = [{ id: 'I9', name: 'P1_X', label: 'X', region: rid, seq: 10, newRow: true, newCol: true, colStart: null, span: 6, hidden: false }];
  f.buttons = [
    { id: 'B1', name: 'SAVE', label: 'Save', region: rid, position: 'BELOW_BOX', seq: 10, newRow: true, newCol: true, colStart: null, span: null, hidden: false },
    { id: 'B2', name: 'GO', label: 'Go', region: rid, position: 'BODY', seq: 20, newRow: false, newCol: true, colStart: null, span: 6, hidden: false }
  ];
  const bb = M.load(f);
  assert.deepStrictEqual(Array.from(bb.order['btn:' + rid + ':BELOW_BOX']), ['button:B1'], 'BELOW_BOX strip');
  const body = M.rows(bb, 'region:' + rid).map((row) => row.map((c) => c.kind + ':' + c.id));
  assert.ok(body.some((row) => row.join() === 'item:I9,button:B2'), 'item and body button share a row');
  assert.ok(M.move(bb, 'button', 'B1', { container: 'region:' + rid, beforeKey: 'item:I9', sameRow: false }).ok, 'strip button into body');
  assert.strictEqual(bb.comps['button:B1'].position, 'BODY', 'becomes a body button');
  assert.strictEqual(bb.order['btn:' + rid + ':BELOW_BOX'].length, 0, 'strip kept, empty');
  assert.ok(M.move(bb, 'button', 'B2', { container: 'btn:' + rid + ':BELOW_BOX', beforeKey: null, sameRow: false }).ok, 'body button into strip');
  assert.strictEqual(bb.comps['button:B2'].position, 'BELOW_BOX', 'takes the strip position');
  assert.ok(!M.move(bb, 'item', 'I9', { container: 'btn:' + rid + ':BELOW_BOX', beforeKey: null }).ok, 'items stay out of strips');
  const ch = Array.from(M.changes(bb)).filter((c) => c.kind === 'button').map((c) => c.id + ':' + c.position).sort();
  assert.deepStrictEqual(ch, ['B1:BODY', 'B2:BELOW_BOX'], 'button changes carry their position');
}
console.log('layout_model_test: buttons passed');
