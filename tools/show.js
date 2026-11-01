#!/usr/bin/env node
// 盤面と候補を端末に表示する: node tools/show.js <id> [step]
'use strict';
const S = require('../assets/number-place.js');
const DATA = require('../assets/techniques.js');

function print(st, opts = {}) {
  const lines = [];
  const scope = opts.scope ? new Set(S.cells(opts.scope)) : null;
  const w = 9;
  for (let r = 0; r < 9; r++) {
    if (r % 3 === 0) lines.push('+' + ('-'.repeat(w * 3 + 2) + '+').repeat(3));
    let line = '|';
    for (let c = 0; c < 9; c++) {
      const i = S.idx(r, c);
      let s;
      if (st.grid[i]) s = `  [${st.grid[i]}]`;
      else if (opts.digit) s = st.cand[i] & S.bit(opts.digit) ? `   ${opts.digit}` : '   .';
      else if (scope && !scope.has(i)) s = '   ';
      else s = S.digitsOf(st.cand[i]).join('');
      line += ' ' + s.padEnd(w - 1) + (c % 3 === 2 ? ' |' : '');
    }
    lines.push(line);
  }
  lines.push('+' + ('-'.repeat(w * 3 + 2) + '+').repeat(3));
  return lines.join('\n');
}

if (require.main === module) {
  const [id, step] = process.argv.slice(2);
  const ex = DATA.techniques.find((t) => t.id === id);
  if (!ex) { console.log(DATA.techniques.map((t) => t.id).join('\n')); process.exit(1); }
  const st = S.stateAt(ex, step ? +step - 1 : 0);
  console.log(print(st, { scope: ex.scope, digit: ex.digit }));
  if (ex.digit) console.log(print(st, { scope: ex.scope }));
}
module.exports = { print };
