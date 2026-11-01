#!/usr/bin/env node
// 例題の与えられた数字（givens）を自動で探す補助ツール。
//
// 1) 単一数字モード:  node tools/design.js digit <d> --cand "<spec>" --not "<spec>" [--occupy "<spec>"]
//    --cand のマスは d の候補として残し、--not のマスは d の候補にしない（d の効きで消すか、
//    他の数字で埋める）。埋めるマスが最小になる d の配置を探し、他の数字は正しい解答盤面から取る。
//
// 2) 複数数字モード:  node tools/design.js multi '<JSON {cell: digits}>' [--fill "<units>"] [--tries N]
//    指定セルの基本候補がちょうど指定どおりになるような givens を探す。
//    --fill のユニット内で指定セル以外のマスはすべて givens にする。
//    --lack '<JSON {cell: digits}>' のマスは指定数字を候補にしない（他の数字の given になってもよい）。
'use strict';
const S = require('../assets/number-place.js');
const { solveOne } = require('./solver.js');
const { print } = require('./show.js');

function allPlacements() {
  const out = [];
  const rec = (r, usedC, usedB, cur) => {
    if (r === 9) { out.push(cur.slice()); return; }
    for (let c = 0; c < 9; c++) {
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      if (usedC & (1 << c) || usedB & (1 << b)) continue;
      cur.push(S.idx(r, c));
      rec(r + 1, usedC | (1 << c), usedB | (1 << b), cur);
      cur.pop();
    }
  };
  rec(0, 0, 0, []);
  return out;
}

function fullGridWith(fixed) {
  const masks = new Array(81).fill(S.ALL);
  for (const [i, d] of fixed) masks[i] = S.bit(d);
  return solveOne(masks);
}

function digitMode(d, pSpec, nSpec, occupySpec) {
  // P: 候補として残すマス / N: 候補にしないマス（効きで消えるか、他の数字で埋める）/ それ以外は自由
  const P = new Set(S.cells(pSpec));
  const N = new Set(S.cells(nSpec));
  const forcedOcc = new Set(S.cells(occupySpec));
  const results = [];
  for (const D of allPlacements()) {
    // D のうち P 以外は given にする。ただし自由マスで P に効いてしまうものは候補のまま残す
    const seesP = (i) => S.PEERS[i].some((p) => P.has(p));
    if (D.some((i) => N.has(i) && seesP(i))) continue;
    const G = D.filter((i) => !P.has(i) && !seesP(i));
    if (G.some((i) => forcedOcc.has(i))) continue;
    const seen = new Set();
    for (const g of G) for (const p of S.PEERS[g]) seen.add(p);
    const O = [];
    for (const i of N) if (!G.includes(i) && (!seen.has(i) || forcedOcc.has(i))) O.push(i);
    for (const i of forcedOcc) if (!O.includes(i)) O.push(i);
    results.push({ D, G, O });
  }
  results.sort((a, b) => a.O.length - b.O.length || a.G.length - b.G.length);
  if (!results.length) { console.log('no placement'); return; }
  const best = results.filter((r) => r.O.length === results[0].O.length);
  console.log(`placements: ${results.length}, best occupied=${results[0].O.length} (${best.length} ties)`);
  const pick = [];
  for (let k = 0; k < 3 && best.length; k++) pick.push(best.splice(Math.floor(Math.random() * best.length), 1)[0]);
  for (const r of pick) {
    const sol = fullGridWith(r.D.map((i) => [i, d]));
    const grid = new Array(81).fill(0);
    for (const i of r.G) grid[i] = d;
    for (const i of r.O) grid[i] = sol[i];
    const str = grid.map((x) => x || '.').join('');
    console.log(`\nd at: ${r.D.map(S.name).join(' ')}  occupied: ${r.O.map(S.name).join(' ')}`);
    console.log(rows(str));
    const st = { grid, cand: S.basicCands(grid) };
    console.log(print(st, { digit: d }));
  }
}

function rows(str) {
  const out = [];
  for (let r = 0; r < 9; r++) out.push(`      '${str.slice(r * 9, r * 9 + 9)}',`);
  return out.join('\n');
}

function multiMode(json, fillSpec, tries, lackJson) {
  const want = {};
  for (const [spec, ds] of Object.entries(JSON.parse(json))) for (const i of S.cells(spec)) want[i] = S.maskOf(ds);
  const scope = Object.keys(want).map(Number);
  // lack: 空きマスのまま、指定数字だけは候補にしない（他の候補は自由）
  const lack = {};
  for (const [spec, ds] of Object.entries(JSON.parse(lackJson || '{}'))) for (const i of S.cells(spec)) lack[i] = S.maskOf(ds);
  const fill = new Set();
  for (const u of S.units(fillSpec)) for (const i of S.UNITS[u.t][u.n]) if (!(i in want)) fill.add(i);
  let best = null;
  for (let t = 0; t < tries; t++) {
    const masks = new Array(81).fill(S.ALL);
    for (const i of scope) masks[i] = want[i];
    for (const i in lack) masks[i] &= ~lack[i];
    const sol = solveOne(masks);
    if (!sol) { console.log('no solution grid with these candidate sets'); return; }
    const allowed = (y) => !(y in want) && S.PEERS[y].every((x) => !(x in want) || !(want[x] & S.bit(sol[y])));
    if ([...fill].some((y) => !allowed(y))) continue;
    const givens = new Set(fill);
    const need = [];
    for (const x of scope) {
      for (let e = 1; e <= 9; e++) {
        if (want[x] & S.bit(e)) continue;
        need.push([x, e]);
      }
    }
    for (const x in lack) for (const e of S.digitsOf(lack[x])) need.push([+x, e]);
    const covered = ([x, e]) => givens.has(x) || S.PEERS[x].some((y) => givens.has(y) && sol[y] === e);
    let ok = true;
    let pending = need.filter((n) => !covered(n));
    while (pending.length) {
      // greedy: choose the allowed cell covering most pending requirements
      const score = new Map();
      for (const [x, e] of pending) {
        for (const y of S.PEERS[x]) if (sol[y] === e && allowed(y)) score.set(y, (score.get(y) || 0) + 1);
        if (x in lack && allowed(x)) score.set(x, (score.get(x) || 0) + 0.5);
      }
      if (!score.size) { ok = false; break; }
      const [y] = [...score.entries()].sort((a, b) => b[1] - a[1] || Math.random() - 0.5)[0];
      givens.add(y);
      pending = pending.filter((n) => !covered(n));
    }
    if (!ok) continue;
    if (!best || givens.size < best.givens.size) best = { givens, sol };
  }
  if (!best) { console.log('not found'); return; }
  const grid = new Array(81).fill(0);
  for (const y of best.givens) grid[y] = best.sol[y];
  const str = grid.map((x) => x || '.').join('');
  console.log(`givens: ${best.givens.size}`);
  console.log(rows(str));
  console.log(print({ grid, cand: S.basicCands(grid) }, { scope: scope.map(S.name).join(' ') }));
  console.log('solution:', scope.map((i) => `${S.name(i)}=${best.sol[i]}`).join(' '));
}

const argv = process.argv.slice(2);
const opt = (k, def) => { const j = argv.indexOf(k); return j >= 0 ? argv[j + 1] : def; };
if (argv[0] === 'digit') digitMode(+argv[1], opt('--cand', ''), opt('--not', ''), opt('--occupy', ''));
else if (argv[0] === 'multi') multiMode(argv[1], opt('--fill', ''), +opt('--tries', 300), opt('--lack', '{}'));
else console.log('usage: see header');
