#!/usr/bin/env node
// 手筋データの検証: node tools/validate.js [id ...]
// - 与えられた数字に矛盾がないか
// - 表示する候補が「盤上の数字の効き」と矛盾しないか（cands 指定は基本候補の部分集合であること）
// - 各ステップの消去・確定が、その時点の候補から論理的に導けるか（背理法で全探索）
// - ハイライトや仮定が実在する候補・マスを指しているか
'use strict';
const S = require('../assets/number-place.js');
const { count, masksOf, digitCount } = require('./solver.js');
const DATA = require('../assets/techniques.js');

const only = process.argv.slice(2);
let errors = 0;
const err = (ex, msg) => { errors++; console.log(`  ✗ [${ex.id}] ${msg}`); };

function digitPositions(st, d) {
  const s = new Set();
  for (let i = 0; i < 81; i++) if (st.grid[i] === d || (!st.grid[i] && st.cand[i] & S.bit(d))) s.add(i);
  return s;
}

function impliedElim(ex, st, i, d, digitMode) {
  if (digitMode) {
    const pos = digitPositions(st, d);
    for (const p of S.PEERS[i]) pos.delete(p);
    return digitCount(pos, 1) === 0;
  }
  const m = masksOf(st);
  m[i] = S.bit(d);
  return count(m, 1) === 0;
}
function impliedPlace(ex, st, i, d, digitMode) {
  if (digitMode) {
    const pos = digitPositions(st, d);
    pos.delete(i);
    return digitCount(pos, 1) === 0;
  }
  const m = masksOf(st);
  m[i] &= ~S.bit(d);
  return m[i] === 0 || count(m, 1) === 0;
}

for (const ex of DATA.techniques) {
  if (only.length && !only.includes(ex.id)) continue;
  console.log(`- ${ex.id}`);
  const grid = S.parseGrid(ex.givens);
  for (let i = 0; i < 81; i++) {
    if (!grid[i]) continue;
    for (const p of S.PEERS[i]) if (p > i && grid[p] === grid[i]) err(ex, `given conflict ${S.name(i)} ${S.name(p)} (${grid[i]})`);
  }
  const basic = S.basicCands(grid);
  const init = S.initialState(ex);
  let narrowed = 0;
  for (let i = 0; i < 81; i++) {
    if (grid[i]) continue;
    if (init.cand[i] & ~basic[i]) {
      if (!ex.rawCands) err(ex, `cands ${S.name(i)}=${S.digitsOf(init.cand[i]).join('')} は盤上の数字と矛盾 (基本候補 ${S.digitsOf(basic[i]).join('')})`);
    } else if (init.cand[i] !== basic[i]) narrowed++;
  }
  if (narrowed) console.log(`    note: ${narrowed} cell(s) narrowed beyond basic candidates`);

  try {
    const n = count(masksOf(init), 2);
    if (n === 0) err(ex, 'initial state has no solution');
    else if (ex.uniqueCheck && n !== 1) err(ex, `expected unique solution, got ${n}+`);
  } catch (e) { err(ex, `solve: ${e.message}`); }

  ex.steps.forEach((step, k) => {
    const st = S.stateAt(ex, k);
    const digitMode = !!ex.digit && !step.full;
    const where = `step ${k + 1}`;
    const assumeSpec = step.assume && typeof step.assume === 'object' ? Object.values(step.assume).join(' ') : step.assume;
    const assumed = new Map(S.cands(assumeSpec).map(([i, d]) => [i, d]));
    const hasCand = (i, d) => !st.grid[i] && (st.cand[i] & S.bit(d));
    for (const [i, d] of assumed) if (!hasCand(i, d)) err(ex, `${where}: assume ${S.name(i)}=${d} is not a candidate`);
    for (const [role, spec] of Object.entries(step.cand || {})) {
      for (const [i, d] of S.cands(spec)) if (!hasCand(i, d)) err(ex, `${where}: cand.${role} ${S.name(i)}:${d} not present`);
    }
    for (const l of step.links || []) {
      for (const end of l.slice(0, 2)) {
        const [[i, d]] = S.cands(end);
        if (!hasCand(i, d) && !(assumed.get(i) === d)) err(ex, `${where}: link end ${end} not present`);
      }
    }
    for (const i of S.cells(S.tokens(step.rays).map((t) => t.split('/')[0]))) {
      if (!st.grid[i] && !assumed.has(i)) err(ex, `${where}: rays from empty cell ${S.name(i)}`);
    }
    for (const [i, d] of S.cands(step.elim)) {
      if (!hasCand(i, d)) { err(ex, `${where}: elim ${S.name(i)}:${d} not present`); continue; }
      if (step.uniq) continue;
      try {
        if (!impliedElim(ex, st, i, d, digitMode)) err(ex, `${where}: elim ${S.name(i)}:${d} is NOT implied`);
      } catch (e) { err(ex, `${where}: elim check ${e.message}`); }
    }
    for (const [i, d] of S.cands(step.place)) {
      if (!hasCand(i, d)) { err(ex, `${where}: place ${S.name(i)}:${d} not a candidate`); continue; }
      if (step.uniq) continue;
      try {
        if (!impliedPlace(ex, st, i, d, digitMode)) err(ex, `${where}: place ${S.name(i)}=${d} is NOT implied`);
      } catch (e) { err(ex, `${where}: place check ${e.message}`); }
    }
  });
  const fin = S.stateAt(ex, ex.steps.length);
  try { if (count(masksOf(fin), 1) === 0) err(ex, 'final state has no solution'); } catch (e) { err(ex, e.message); }
}

console.log(errors ? `\n${errors} error(s)` : '\nall ok');
process.exit(errors ? 1 : 0);
