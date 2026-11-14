#!/usr/bin/env node
/*
 * Turns a tests/db SQL file into runnable blocks for APEX SQL Commands.
 *
 *   node tools/db_test_block.js <tests/db/file.sql> <schema> <app> <page> [--out <dir>]
 *
 * Substitutes &&VD_SCHEMA. / &&TEST_APP / &&SCRATCH_PAGE, drops SQL*Plus lines
 * (SET, DEFINE, PROMPT, @), splits on lines that are exactly "/", and drops
 * comment lines before a block's first statement. Other &&NAME stay as they are.
 */
const fs = require('fs');
const path = require('path');

const SQLPLUS_LINE = /^\s*(SET\s|DEFINE\s|PROMPT\s|@)/i;

function blocks(sqlText, { schema, app, page }) {
  const out = [];
  let cur = [];
  const flush = () => {
    while (cur.length && /^\s*(--.*)?$/.test(cur[0])) cur.shift();
    const block = cur.join('\n').trim();
    if (block) out.push(block);
    cur = [];
  };
  for (const raw of sqlText.split(/\r?\n/)) {
    if (raw.trim() === '/') { flush(); continue; }
    if (SQLPLUS_LINE.test(raw)) continue;
    cur.push(raw
      .split('&&VD_SCHEMA.').join(schema)
      .split('&&TEST_APP').join(app)
      .split('&&SCRATCH_PAGE').join(page));
  }
  flush();
  return out;
}

module.exports = { blocks };

if (require.main === module) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outDir = outIdx >= 0 ? args.splice(outIdx, 2)[1] : null;
  const [file, schema, app, page] = args;
  if (!file || !schema || !app || !page || (outIdx >= 0 && !outDir)) {
    console.error('usage: node tools/db_test_block.js <tests/db/file.sql> <schema> <app> <page> [--out <dir>]');
    process.exit(2);
  }
  const list = blocks(fs.readFileSync(file, 'utf8'), { schema, app, page });
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    const name = path.basename(file, '.sql');
    list.forEach((b, i) => fs.writeFileSync(path.join(outDir, `${name}_${i + 1}.sql`), b + '\n'));
    console.log(`wrote ${list.length} block(s) to ${outDir}`);
  } else {
    list.forEach((b, i) => console.log(`-- block ${i + 1} --\n${b}\n`));
  }
}
