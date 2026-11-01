/*
 * 盤面の基本ロジック（ブラウザと Node の両方で使う）
 * セル番号 i = 0..80（行優先）。候補はビットマスク（bit d-1 が数字 d）。
 */
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.NumberPlace = lib;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ALL = 0x1ff;
  const bit = (d) => 1 << (d - 1);
  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
  const idx = (r, c) => r * 9 + c;
  const name = (i) => `r${rowOf(i) + 1}c${colOf(i) + 1}`;

  const UNITS = { r: [], c: [], b: [] };
  for (let k = 0; k < 9; k++) {
    UNITS.r.push([]);
    UNITS.c.push([]);
    UNITS.b.push([]);
  }
  for (let i = 0; i < 81; i++) {
    UNITS.r[rowOf(i)].push(i);
    UNITS.c[colOf(i)].push(i);
    UNITS.b[boxOf(i)].push(i);
  }
  const ALL_UNITS = [...UNITS.r, ...UNITS.c, ...UNITS.b];

  const PEERS = [];
  for (let i = 0; i < 81; i++) {
    const s = new Set([...UNITS.r[rowOf(i)], ...UNITS.c[colOf(i)], ...UNITS.b[boxOf(i)]]);
    s.delete(i);
    PEERS.push([...s]);
  }
  const sees = (a, b) => a !== b && (rowOf(a) === rowOf(b) || colOf(a) === colOf(b) || boxOf(a) === boxOf(b));

  const digitsOf = (mask) => {
    const out = [];
    for (let d = 1; d <= 9; d++) if (mask & bit(d)) out.push(d);
    return out;
  };
  const maskOf = (digits) => {
    let m = 0;
    for (const ch of String(digits)) if (ch >= '1' && ch <= '9') m |= bit(+ch);
    return m;
  };
  const popcount = (m) => {
    let n = 0;
    while (m) { m &= m - 1; n++; }
    return n;
  };

  const tokens = (spec) => (Array.isArray(spec) ? spec : String(spec || '').split(/[\s,]+/)).filter(Boolean);

  /* "r1c23" -> r1c2, r1c3 / "r5" "c3" "b5" -> そのユニットの全セル */
  function cellsOfToken(tok) {
    let m = /^r([1-9]+)c([1-9]+)$/.exec(tok);
    if (m) {
      const out = [];
      for (const r of m[1]) for (const c of m[2]) out.push(idx(+r - 1, +c - 1));
      return out;
    }
    m = /^([rcb])([1-9])$/.exec(tok);
    if (m) return UNITS[m[1]][+m[2] - 1].slice();
    throw new Error(`bad cell token: ${tok}`);
  }
  function cells(spec) {
    const out = [];
    for (const t of tokens(spec)) for (const i of cellsOfToken(t)) if (!out.includes(i)) out.push(i);
    return out;
  }

  /* "r1c23:57" -> [[r1c2,5],[r1c2,7],[r1c3,5],[r1c3,7]] */
  function cands(spec) {
    const out = [];
    for (const t of tokens(spec)) {
      const [c, ds] = t.split(':');
      if (!ds) throw new Error(`bad candidate token: ${t}`);
      for (const i of cellsOfToken(c)) for (const ch of ds) out.push([i, +ch]);
    }
    return out;
  }

  /* "r1 c5 b9" -> [{t:'r',n:0}, ...] */
  function units(spec) {
    return tokens(spec).map((t) => {
      const m = /^([rcb])([1-9])$/.exec(t);
      if (!m) throw new Error(`bad unit token: ${t}`);
      return { t: m[1], n: +m[2] - 1 };
    });
  }

  function parseGrid(g) {
    const s = (Array.isArray(g) ? g.join('') : String(g)).replace(/\s+/g, '');
    if (s.length !== 81) throw new Error(`grid must be 81 chars (got ${s.length})`);
    return [...s].map((ch) => (ch >= '1' && ch <= '9' ? +ch : 0));
  }

  /* 盤上の数字だけから決まる候補（行・列・ブロックの効きを除いたもの） */
  function basicCands(grid) {
    const out = new Array(81).fill(0);
    for (let i = 0; i < 81; i++) {
      if (grid[i]) continue;
      let m = ALL;
      for (const p of PEERS[i]) if (grid[p]) m &= ~bit(grid[p]);
      out[i] = m;
    }
    return out;
  }

  /* 例題の初期状態 */
  function initialState(ex) {
    const grid = parseGrid(ex.givens);
    const kind = grid.map((d) => (d ? 'given' : null));
    const cand = basicCands(grid);
    if (ex.cands) {
      for (const [spec, ds] of Object.entries(ex.cands)) {
        for (const i of cells(spec)) cand[i] = maskOf(ds);
      }
    }
    return { grid, kind, cand };
  }

  function applyPlace(st, i, d) {
    st.grid[i] = d;
    st.kind[i] = 'placed';
    st.cand[i] = 0;
    for (const p of PEERS[i]) st.cand[p] &= ~bit(d);
  }

  /* k 番目のステップを表示する直前の状態（それ以前のステップの確定・消去を反映） */
  function stateAt(ex, k) {
    const st = initialState(ex);
    for (let s = 0; s < k; s++) {
      const step = ex.steps[s];
      for (const [i, d] of cands(step.elim)) st.cand[i] &= ~bit(d);
      for (const [i, d] of cands(step.place)) applyPlace(st, i, d);
    }
    return st;
  }

  return {
    ALL, bit, rowOf, colOf, boxOf, idx, name, UNITS, ALL_UNITS, PEERS, sees,
    digitsOf, maskOf, popcount, tokens, cells, cands, units, parseGrid,
    basicCands, initialState, stateAt, applyPlace,
  };
});
