#!/usr/bin/env node
// 実際の唯一解パズルを生成し、基本手筋（シングル・ブロックと列の交差・ペア/トリプル）で
// 解ける所まで解いて止まった局面が BUG+1 なら出力する: node tools/gen.js [puzzles]
'use strict';
const S = require('../assets/sudoku.js');
const { solveOne, count } = require('./solver.js');
const { print } = require('./show.js');

const shuffle = (a) => { for (let k = a.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [a[k], a[j]] = [a[j], a[k]]; } return a; };

function makePuzzle() {
  const T = solveOne(new Array(81).fill(S.ALL));
  const grid = T.slice();
  for (const i of shuffle([...Array(81).keys()])) {
    const d = grid[i];
    grid[i] = 0;
    const masks = grid.map((x, j) => (x ? S.bit(x) : S.ALL));
    if (count(masks, 2) !== 1) grid[i] = d;
  }
  return { T, grid };
}

function combos(arr, k, start = 0, cur = [], out = []) {
  if (cur.length === k) { out.push(cur.slice()); return out; }
  for (let i = start; i < arr.length; i++) { cur.push(arr[i]); combos(arr, k, i + 1, cur, out); cur.pop(); }
  return out;
}

// 1 ステップ進める。進んだら true
function step(g, c) {
  // naked single
  for (let i = 0; i < 81; i++) if (!g[i] && S.popcount(c[i]) === 1) { place(g, c, i, S.digitsOf(c[i])[0]); return true; }
  // hidden single
  for (const u of S.ALL_UNITS) for (let d = 1; d <= 9; d++) {
    const cs = u.filter((i) => !g[i] && c[i] & S.bit(d));
    if (cs.length === 1 && !u.some((i) => g[i] === d)) { place(g, c, cs[0], d); return true; }
  }
  let changed = false;
  const elim = (i, d) => { if (c[i] & S.bit(d)) { c[i] &= ~S.bit(d); changed = true; } };
  // locked candidates
  for (let b = 0; b < 9; b++) for (let d = 1; d <= 9; d++) {
    const cs = S.UNITS.b[b].filter((i) => !g[i] && c[i] & S.bit(d));
    if (cs.length < 2) continue;
    const rs = new Set(cs.map(S.rowOf)), cl = new Set(cs.map(S.colOf));
    if (rs.size === 1) for (const i of S.UNITS.r[[...rs][0]]) if (S.boxOf(i) !== b && !g[i]) elim(i, d);
    if (cl.size === 1) for (const i of S.UNITS.c[[...cl][0]]) if (S.boxOf(i) !== b && !g[i]) elim(i, d);
  }
  if (changed) return true;
  for (const u of [...S.UNITS.r, ...S.UNITS.c]) for (let d = 1; d <= 9; d++) {
    const cs = u.filter((i) => !g[i] && c[i] & S.bit(d));
    if (cs.length < 2) continue;
    const bs = new Set(cs.map(S.boxOf));
    if (bs.size === 1) for (const i of S.UNITS.b[[...bs][0]]) if (!u.includes(i) && !g[i]) elim(i, d);
  }
  if (changed) return true;
  // naked / hidden subsets (2, 3)
  for (const u of S.ALL_UNITS) {
    const empty = u.filter((i) => !g[i]);
    for (const k of [2, 3]) {
      for (const set of combos(empty, k)) {
        const m = set.reduce((a, i) => a | c[i], 0);
        if (S.popcount(m) === k) for (const i of empty) if (!set.includes(i)) for (const d of S.digitsOf(m)) elim(i, d);
      }
      const ds = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((d) => !u.some((i) => g[i] === d));
      for (const dset of combos(ds, k)) {
        const m = dset.reduce((a, d) => a | S.bit(d), 0);
        const cells = empty.filter((i) => c[i] & m);
        if (cells.length === k) for (const i of cells) for (let d = 1; d <= 9; d++) if (!(m & S.bit(d))) elim(i, d);
      }
      if (changed) return true;
    }
  }
  return false;
}

function place(g, c, i, d) {
  g[i] = d; c[i] = 0;
  for (const p of S.PEERS[i]) c[p] &= ~S.bit(d);
}

function bugPlus1(g, c) {
  const empty = [...Array(81).keys()].filter((i) => !g[i]);
  const tri = empty.filter((i) => S.popcount(c[i]) === 3);
  if (tri.length !== 1 || empty.some((i) => S.popcount(c[i]) > 3 || S.popcount(c[i]) < 2)) return null;
  const x0 = tri[0];
  for (const d of S.digitsOf(c[x0])) {
    const c2 = c.slice();
    c2[x0] &= ~S.bit(d);
    const ok = S.ALL_UNITS.every((u) => {
      for (let e = 1; e <= 9; e++) {
        const n = u.filter((i) => !g[i] && c2[i] & S.bit(e)).length;
        if (n !== 0 && n !== 2) return false;
      }
      return true;
    });
    if (ok) return { x0, d, empty: empty.length };
  }
  return null;
}

const n = +(process.argv[2] || 300);
let stuck = 0;
for (let k = 0; k < n; k++) {
  const { T, grid } = makePuzzle();
  const g = grid.slice();
  const c = S.basicCands(g);
  while (step(g, c));
  if (g.every(Boolean)) continue;
  stuck++;
  const b = bugPlus1(g, c);
  if (!b) continue;
  console.log(`# puzzle ${k}: BUG+1 at ${S.name(b.x0)} -> ${b.d} (true ${T[b.x0]}), empty ${b.empty}, givens ${grid.filter(Boolean).length}`);
  const str = g.map((x) => x || '.').join('');
  for (let r = 0; r < 9; r++) console.log(`      '${str.slice(r * 9, r * 9 + 9)}',`);
  const orig = grid.map((x) => x || '.').join('');
  console.log('original puzzle:', orig);
  const cands = {};
  for (let i = 0; i < 81; i++) if (!g[i]) cands[S.name(i)] = S.digitsOf(c[i]).join('');
  console.log(JSON.stringify(cands));
  console.log(print({ grid: g, cand: c }));
}
console.error(`puzzles ${n}, stuck ${stuck}`);
