// 検証用の制約ソルバー（候補マスク付きの盤面の解の個数を数える）
'use strict';
const S = require('../assets/sudoku.js');

const SINGLE = new Map();
for (let d = 1; d <= 9; d++) SINGLE.set(S.bit(d), d);

function propagate(m) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < 81; i++) {
      if (m[i] === 0) return false;
      if (SINGLE.has(m[i])) {
        for (const p of S.PEERS[i]) {
          if (m[p] & m[i]) {
            m[p] &= ~m[i];
            if (m[p] === 0) return false;
            changed = true;
          }
        }
      }
    }
    for (const u of S.ALL_UNITS) {
      for (let d = 1; d <= 9; d++) {
        const b = S.bit(d);
        let cnt = 0, last = -1;
        for (const i of u) if (m[i] & b) { cnt++; last = i; }
        if (cnt === 0) return false;
        if (cnt === 1 && m[last] !== b) { m[last] = b; changed = true; }
      }
    }
  }
  return true;
}

/* masks: 81 要素（確定マスは 1 ビット）。解の数を limit まで数える */
function count(masks, limit = 2, budget = { nodes: 2e6 }) {
  const m = Int16Array.from(masks);
  if (!propagate(m)) return 0;
  let best = -1, bc = 10;
  for (let i = 0; i < 81; i++) {
    if (SINGLE.has(m[i])) continue;
    const c = S.popcount(m[i]);
    if (c < bc) { bc = c; best = i; }
  }
  if (best < 0) return 1;
  if (--budget.nodes < 0) throw new Error('search budget exceeded');
  let total = 0;
  for (const d of S.digitsOf(m[best])) {
    const n = Int16Array.from(m);
    n[best] = S.bit(d);
    total += count(n, limit - total, budget);
    if (total >= limit) break;
  }
  return total;
}

function solveOne(masks) {
  const m = Int16Array.from(masks);
  const rec = (m) => {
    if (!propagate(m)) return null;
    let best = -1, bc = 10;
    for (let i = 0; i < 81; i++) {
      if (SINGLE.has(m[i])) continue;
      const c = S.popcount(m[i]);
      if (c < bc) { bc = c; best = i; }
    }
    if (best < 0) return Array.from(m, (x) => SINGLE.get(x));
    const ds = S.digitsOf(m[best]);
    for (let k = ds.length - 1; k > 0; k--) {
      const j = Math.floor(Math.random() * (k + 1));
      [ds[k], ds[j]] = [ds[j], ds[k]];
    }
    for (const d of ds) {
      const n = Int16Array.from(m);
      n[best] = S.bit(d);
      const r = rec(n);
      if (r) return r;
    }
    return null;
  };
  return rec(m);
}

/* 状態 -> 81 マスのマスク（与えられた数字は 1 ビット） */
function masksOf(st) {
  return st.grid.map((d, i) => (d ? S.bit(d) : st.cand[i]));
}

/* 1 つの数字だけに注目した配置問題（各行・列・ブロックにちょうど 1 つ） */
function digitCount(positions, limit = 2) {
  // positions: Set of cell indices where the digit may go (含む: 既に置かれている数字のマス)
  const cols = [];
  const rec = (r, usedC, usedB) => {
    if (r === 9) return 1;
    let total = 0;
    for (let c = 0; c < 9; c++) {
      const i = S.idx(r, c);
      if (!positions.has(i)) continue;
      const b = S.boxOf(i);
      if (usedC & (1 << c) || usedB & (1 << b)) continue;
      cols.push(i);
      total += rec(r + 1, usedC | (1 << c), usedB | (1 << b));
      cols.pop();
      if (total >= limit) return total;
    }
    return total;
  };
  return rec(0, 0, 0);
}

module.exports = { propagate, count, solveOne, masksOf, digitCount };
