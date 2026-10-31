(function () {
  'use strict';
  const S = window.Sudoku;
  const DATA = window.TECHNIQUES;

  /* ---------- 盤面の座標 ---------- */
  const CS = 60; // セルの大きさ
  const M = 24; // 行・列ラベルの余白
  const N = CS * 9;
  const VB = M + N + 3;
  const X = (c) => M + c * CS;
  const Y = (r) => M + r * CS;
  const cellXY = (i) => [X(S.colOf(i)), Y(S.rowOf(i))];
  // big: 1つの数字だけを表示するモードでは、候補をマスの中央に大きめに描く
  const candXY = (i, d, big) => {
    const [x, y] = cellXY(i);
    if (big) return [x + CS / 2, y + CS / 2];
    return [x + (((d - 1) % 3) + 0.5) * (CS / 3), y + (Math.floor((d - 1) / 3) + 0.5) * (CS / 3)];
  };
  const unitRect = (u) => {
    if (u.t === 'r') return [X(0), Y(u.n), N, CS];
    if (u.t === 'c') return [X(u.n), Y(0), CS, N];
    return [X((u.n % 3) * 3), Y(Math.floor(u.n / 3) * 3), CS * 3, CS * 3];
  };
  const key = (i, d) => i * 10 + d;
  const f = (n) => Math.round(n * 10) / 10;

  /* 役割指定 {色: spec} を正規化（文字列だけなら既定の色） */
  function roleEntries(v, def) {
    if (!v) return [];
    if (typeof v === 'string' || Array.isArray(v)) return [[def, v]];
    return Object.entries(v);
  }

  function parseRays(spec) {
    const out = [];
    for (const tok of S.tokens(spec)) {
      const [c, dir] = tok.split('/');
      for (const i of S.cells(c)) out.push([i, dir || 'rcb']);
    }
    return out;
  }

  let uid = 0;

  /* ---------- 盤面 SVG ---------- */
  function boardSVG(ex, k) {
    const step = ex.steps[k];
    const st = S.stateAt(ex, k);
    // 仮定した数字。{ b: spec } のように色を指定できる（既定はオレンジ）
    const assumed = new Map();
    const assumedColor = new Map();
    for (const [role, spec] of roleEntries(step.assume, 'o')) {
      for (const [i, d] of S.cands(spec)) { assumed.set(i, d); assumedColor.set(i, role); }
    }
    const placeNow = new Map(S.cands(step.place));
    const elimNow = new Set(S.cands(step.elim).map(([i, d]) => key(i, d)));
    const candRole = new Map();
    for (const [role, spec] of roleEntries(step.cand, 'b')) for (const [i, d] of S.cands(spec)) candRole.set(key(i, d), role);
    const filter = step.only ? S.maskOf(step.only) : ex.digit && !step.full ? S.bit(ex.digit) : S.ALL;
    const scopeSpec = step.scope !== undefined ? step.scope : ex.scope;
    const scope = scopeSpec ? new Set(S.cells(scopeSpec)) : null;
    const showPM = step.pm !== false;
    const big = !!ex.digit && !step.full && !step.only;
    const R = big ? 14 : 9.5; // 候補の印の半径
    const id = `b${++uid}`;
    const o = [];

    o.push(`<svg class="board" viewBox="0 0 ${VB} ${VB}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${ex.name} ステップ ${k + 1}">`);
    o.push(`<defs><marker id="${id}-ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" class="ar"/></marker></defs>`);

    // ラベル
    for (let n = 0; n < 9; n++) {
      o.push(`<text class="lbl" x="${X(n) + CS / 2}" y="${M - 8}">c${n + 1}</text>`);
      o.push(`<text class="lbl" x="${M / 2 - 1}" y="${Y(n) + CS / 2 + 4}">r${n + 1}</text>`);
    }
    o.push(`<rect class="bg" x="${M}" y="${M}" width="${N}" height="${N}"/>`);

    // セルの背景
    const cellRole = new Map();
    for (const i of placeNow.keys()) cellRole.set(i, 'g');
    for (const [i, role] of assumedColor) cellRole.set(i, role);
    for (const [role, spec] of roleEntries(step.cells, 'y')) for (const i of S.cells(spec)) cellRole.set(i, role);
    for (const [i, role] of cellRole) {
      const [x, y] = cellXY(i);
      o.push(`<rect class="cb cb-${role}" x="${x}" y="${y}" width="${CS}" height="${CS}"/>`);
    }

    // ユニットの塗り
    const unitList = [];
    for (const [role, spec] of roleEntries(step.units, 'b')) for (const u of S.units(spec)) unitList.push([role, u]);
    for (const [role, u] of unitList) {
      const [x, y, w, h] = unitRect(u);
      o.push(`<rect class="uf uf-${role}" x="${x}" y="${y}" width="${w}" height="${h}"/>`);
    }

    // 効き（行・列の帯とブロックの塗り）。"r2c3/c" のように向きを限定できる（r: 行, c: 列, b: ブロック）
    const bw = CS * 0.3;
    for (const [i, dir] of parseRays(step.rays)) {
      const cls = assumed.has(i) ? `ray ray-${assumedColor.get(i)}` : 'ray';
      const [x, y] = cellXY(i);
      const b = S.boxOf(i);
      if (dir.includes('r')) o.push(`<rect class="${cls}" x="${M}" y="${f(y + CS / 2 - bw / 2)}" width="${N}" height="${f(bw)}"/>`);
      if (dir.includes('c')) o.push(`<rect class="${cls}" x="${f(x + CS / 2 - bw / 2)}" y="${M}" width="${f(bw)}" height="${N}"/>`);
      if (dir.includes('b')) o.push(`<rect class="${cls} ray-box" x="${X((b % 3) * 3)}" y="${Y(Math.floor(b / 3) * 3)}" width="${CS * 3}" height="${CS * 3}"/>`);
    }

    // 罫線
    for (let n = 0; n <= 9; n++) {
      const cls = n % 3 === 0 ? 'gl gl-b' : 'gl';
      o.push(`<line class="${cls}" x1="${X(n)}" y1="${M}" x2="${X(n)}" y2="${M + N}"/>`);
      o.push(`<line class="${cls}" x1="${M}" y1="${Y(n)}" x2="${M + N}" y2="${Y(n)}"/>`);
    }

    // 数字
    for (let i = 0; i < 81; i++) {
      let d = st.grid[i];
      let cls = st.kind[i] === 'given' ? 'given' : 'placed';
      if (!d && placeNow.has(i)) { d = placeNow.get(i); cls = 'placed now'; }
      if (!d && assumed.has(i)) { d = assumed.get(i); cls = `assumed assumed-${assumedColor.get(i)}`; }
      if (!d) continue;
      const [x, y] = cellXY(i);
      o.push(`<text class="dg ${cls}" x="${x + CS / 2}" y="${y + CS / 2 + 11}">${d}</text>`);
    }

    // 候補
    const marks = [], texts = [], strikes = [];
    for (let i = 0; i < 81; i++) {
      if (st.grid[i] || assumed.has(i) || placeNow.has(i)) continue;
      for (const d of S.digitsOf(st.cand[i])) {
        const kk = key(i, d);
        const role = elimNow.has(kk) ? 'elim' : candRole.get(kk);
        if (!role && (!showPM || !(filter & S.bit(d)) || (scope && !scope.has(i)))) continue;
        const [x, y] = candXY(i, d, big);
        if (role) marks.push(`<circle class="cm cm-${role}" cx="${f(x)}" cy="${f(y)}" r="${R}"/>`);
        texts.push(`<text class="pm${big ? ' pm-big' : ''}${role ? ' pm-hl pm-' + role : ''}" x="${f(x)}" y="${f(y + (big ? 7 : 5))}">${d}</text>`);
        const k8 = R - 1.5;
        if (role === 'elim' || role === 'x') strikes.push(`<line class="sk sk-${role}" x1="${f(x - k8)}" y1="${f(y + k8)}" x2="${f(x + k8)}" y2="${f(y - k8)}"/>`);
      }
    }
    o.push(marks.join(''), texts.join(''), strikes.join(''));

    // × 印（その数字が入らないマス）
    for (const i of S.cells(step.x)) {
      const [x, y] = cellXY(i);
      const c = CS / 2, r = 9;
      o.push(`<path class="xm" d="M${x + c - r} ${y + c - r}L${x + c + r} ${y + c + r}M${x + c + r} ${y + c - r}L${x + c - r} ${y + c + r}"/>`);
    }

    // リンク
    for (const l of step.links || []) {
      const [[i1, d1]] = S.cands(l[0]);
      const [[i2, d2]] = S.cands(l[1]);
      const type = l[2] || 's';
      let [x1, y1] = candXY(i1, d1, big);
      let [x2, y2] = candXY(i2, d2, big);
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const bend = l[3] !== undefined ? l[3] : Math.min(20, len * 0.12);
      const cx = (x1 + x2) / 2 - (dy / len) * bend;
      const cy = (y1 + y2) / 2 + (dx / len) * bend;
      const trim = (x, y) => {
        const vx = cx - x, vy = cy - y, vl = Math.hypot(vx, vy) || 1;
        return [x + (vx / vl) * (R + 1), y + (vy / vl) * (R + 1)];
      };
      [x1, y1] = trim(x1, y1);
      [x2, y2] = trim(x2, y2);
      const arrow = type.includes('a') ? ` marker-end="url(#${id}-ar)"` : '';
      const cls = type.startsWith('w') ? 'lk lk-w' : 'lk lk-s';
      o.push(`<path class="${cls}" d="M${f(x1)} ${f(y1)}Q${f(cx)} ${f(cy)} ${f(x2)} ${f(y2)}"${arrow}/>`);
    }

    // ユニットの枠
    for (const [role, u] of unitList) {
      const [x, y, w, h] = unitRect(u);
      o.push(`<rect class="ul ul-${role}" x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}"/>`);
    }
    o.push('<g class="hover"></g></svg>');
    return o.join('');
  }

  function hoverMarkup(spec) {
    let cells;
    try { cells = S.cells(spec); } catch (e) { return ''; }
    return cells.map((i) => {
      const [x, y] = cellXY(i);
      return `<rect class="hv" x="${x + 2}" y="${y + 2}" width="${CS - 4}" height="${CS - 4}"/>`;
    }).join('');
  }

  /* 本文中の r2c3 / 2行目 / 3列目 / ブロック5 をホバーで盤面に示す */
  function linkify(html) {
    return html
      .replace(/(^|[^\w"=])(r[1-9]c[1-9])(?![\w])/g, '$1<span class="ref" data-ref="$2">$2</span>')
      .replace(/([1-9])行目/g, '<span class="ref" data-ref="r$1">$1行目</span>')
      .replace(/([1-9])列目/g, '<span class="ref" data-ref="c$1">$1列目</span>')
      .replace(/ブロック([1-9])/g, '<span class="ref" data-ref="b$1">ブロック$1</span>');
  }

  /* ---------- ページ ---------- */
  const main = document.getElementById('main');
  const nav = document.getElementById('nav');
  const navToggle = document.querySelector('.nav-toggle');
  const catName = Object.fromEntries(DATA.categories.map((c) => [c.id, c.name]));
  const list = DATA.techniques;
  let current = null; // { ex, k }

  function buildNav() {
    const o = ['<a href="#" class="nav-intro">はじめに・記法</a>'];
    for (const cat of DATA.categories) {
      const items = list.filter((t) => t.cat === cat.id);
      if (!items.length) continue;
      o.push(`<p class="nav-cat">${cat.name}</p><ul>`);
      for (const t of items) o.push(`<li><a href="#${t.id}" data-id="${t.id}">${t.name}${t.ja ? `<span class="nav-ja">${t.ja}</span>` : ''}</a></li>`);
      o.push('</ul>');
    }
    nav.innerHTML = o.join('');
  }

  function markNav(id) {
    for (const a of nav.querySelectorAll('a')) {
      const on = (a.dataset.id || '') === (id || '') && (id || a.classList.contains('nav-intro'));
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }

  function techView(ex) {
    const n = list.indexOf(ex);
    const prev = list[n - 1], next = list[n + 1];
    const li = (arr) => (arr && arr.length ? `<ul>${arr.map((x) => `<li>${linkify(x)}</li>`).join('')}</ul>` : '');
    return `
      <article class="tech">
        <header class="tech-head">
          <p class="crumb">${catName[ex.cat] || ''}</p>
          <h1>${ex.name}${ex.ja ? ` <span class="ja">${ex.ja}</span>` : ''}</h1>
          ${ex.aliases ? `<p class="aliases">別名: ${ex.aliases.join(' / ')}</p>` : ''}
          <p class="summary">${linkify(ex.summary)}</p>
        </header>
        <div class="tech-body">
          <div class="board-col">
            <div class="board-wrap" id="board"></div>
            <p class="board-note" id="board-note"></p>
          </div>
          <div class="step-col">
            <div class="controls">
              <button type="button" class="btn" id="prev" aria-label="前のステップ">◀ 前へ</button>
              <span class="counter" id="counter"></span>
              <button type="button" class="btn btn-primary" id="next" aria-label="次のステップ">次へ ▶</button>
            </div>
            <div class="pips" id="pips"></div>
            <div class="step-text" id="step-text" aria-live="polite"></div>
            <section class="rule">
              <h2>条件</h2>${li(ex.rule)}
              <h2>結論</h2>${li(ex.result)}
              ${ex.tips ? `<h2>見つけ方・補足</h2>${li(ex.tips)}` : ''}
            </section>
          </div>
        </div>
        <nav class="pager" aria-label="手筋の移動">
          ${prev ? `<a href="#${prev.id}" class="pager-prev">← ${prev.name}</a>` : '<span></span>'}
          ${next ? `<a href="#${next.id}" class="pager-next">${next.name} →</a>` : '<span></span>'}
        </nav>
      </article>`;
  }

  function renderStep() {
    const { ex, k } = current;
    const step = ex.steps[k];
    document.getElementById('board').innerHTML = boardSVG(ex, k);
    document.getElementById('counter').textContent = `${k + 1} / ${ex.steps.length}`;
    document.getElementById('prev').disabled = k === 0;
    const nextBtn = document.getElementById('next');
    nextBtn.disabled = k === ex.steps.length - 1;
    document.getElementById('step-text').innerHTML = `<p class="step-no">ステップ ${k + 1}</p>${linkify(step.t)}`;
    const pips = document.getElementById('pips');
    pips.innerHTML = ex.steps.map((_, j) =>
      `<button type="button" class="pip${j === k ? ' on' : j < k ? ' done' : ''}" data-step="${j}" aria-label="ステップ ${j + 1}"${j === k ? ' aria-current="step"' : ''}>${j + 1}</button>`).join('');
    const filterDigits = step.only || (ex.digit && !step.full ? String(ex.digit) : '');
    let note = '';
    if (step.pm === false) note = '候補は非表示';
    else if (filterDigits) note = `候補は数字 ${filterDigits.split('').join('・')} のみ表示`;
    else if (step.scope !== undefined ? step.scope : ex.scope) note = '解説に関係するマスの候補のみ表示';
    document.getElementById('board-note').textContent = note;
  }

  function go(k) {
    if (!current) return;
    const max = current.ex.steps.length - 1;
    current.k = Math.max(0, Math.min(max, k));
    renderStep();
  }

  function showTech(ex) {
    current = { ex, k: 0 };
    main.innerHTML = techView(ex);
    document.getElementById('prev').addEventListener('click', () => go(current.k - 1));
    document.getElementById('next').addEventListener('click', () => go(current.k + 1));
    document.getElementById('pips').addEventListener('click', (e) => {
      const b = e.target.closest('[data-step]');
      if (b) go(+b.dataset.step);
    });
    renderStep();
    document.title = `${ex.name} - 数独 手筋プレイブック`;
  }

  /* ---------- はじめに ---------- */
  function icon(inner, w = 64, h = 40) {
    return `<svg class="icon" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">${inner}</svg>`;
  }
  function introView() {
    const cell = '<rect class="bg" x="12" y="0" width="40" height="40"/><rect class="gl-icon" x="12" y="0" width="40" height="40"/>';
    const legend = [
      [icon(`${cell}<text class="dg given" x="32" y="29" style="font-size:24px">5</text>`), '最初から盤にある数字（与えられた数字）'],
      [icon(`${cell}<text class="dg placed" x="32" y="29" style="font-size:24px">5</text>`), '解説の中で確定した数字'],
      [icon(`<rect class="cb cb-o" x="12" y="0" width="40" height="40"/><rect class="gl-icon" x="12" y="0" width="40" height="40"/><text class="dg assumed" x="32" y="29" style="font-size:24px">5</text>`), '「もしここが5なら」と仮定した数字（そのステップだけの仮置き）'],
      [icon(`${cell}<text class="pm" x="22" y="14">1</text><text class="pm" x="42" y="14">3</text><text class="pm" x="32" y="27">5</text>`), '候補（そのマスに入る可能性がある数字）'],
      [icon(`${cell}<circle class="cm cm-b" cx="32" cy="20" r="9.5"/><text class="pm pm-hl" x="32" y="25">5</text>`), '注目している候補（2色目はオレンジ）'],
      [icon(`${cell}<circle class="cm cm-elim" cx="32" cy="20" r="9.5"/><text class="pm pm-hl pm-elim" x="32" y="25">5</text><line class="sk sk-elim" x1="24" y1="28" x2="40" y2="12"/>`), 'このステップで消去される候補'],
      [icon(`${cell}<circle class="cm cm-x" cx="32" cy="20" r="9.5"/><text class="pm pm-hl" x="32" y="25">5</text><line class="sk sk-x" x1="24" y1="28" x2="40" y2="12"/>`), '仮定のもとでは入らなくなる候補'],
      [icon('<rect class="ray" x="0" y="14" width="64" height="12"/><rect class="ray" x="26" y="0" width="12" height="40"/><text class="dg given" x="32" y="28" style="font-size:18px">5</text>'), '数字の効き（同じ行・列・ブロックにはその数字が入らない）'],
      [icon('<path class="lk lk-s" d="M8 20L56 20"/>'), '強リンク：2つのうち少なくとも一方は正しい（例: その列に5の候補が2マスしかない）'],
      [icon('<path class="lk lk-w" d="M8 20L56 20"/>'), '弱リンク：2つが同時に正しくなることはない（例: 同じ行にある2つの5）'],
      [icon('<rect class="ul ul-b" x="4" y="6" width="56" height="28"/>'), '注目している行・列・ブロック'],
    ];
    const rows = list.map((t) => `<tr><td><a href="#${t.id}">${t.name}</a>${t.ja ? `<br><span class="ja-s">${t.ja}</span>` : ''}</td><td>${catName[t.cat]}</td><td>${t.summary}</td></tr>`).join('');
    return `
      <article class="intro">
        <h1>数独 手筋プレイブック</h1>
        <p>数独の定石手筋を、1つの盤面をステップごとに前後しながら確認するためのページです。各手筋の盤面は解説用に作った局面で、完成したパズルではありません。表示している候補は盤上の数字と矛盾しないように作ってあり、各ステップの消去・確定はその時点の候補から論理的に導けることを全探索で確認しています（唯一解を前提とする Unique Rectangle の消去を除く）。</p>
        <h2>操作</h2>
        <ul>
          <li>「次へ」「前へ」ボタン、または <kbd>←</kbd> <kbd>→</kbd> キーでステップを進める・戻す。番号ボタンで任意のステップへ移動。</li>
          <li>本文中の <span class="ref" data-ref="r2c3">r2c3</span> や「3行目」にマウスを乗せると、盤面上の位置が枠で示されます。</li>
        </ul>
        <h2>記法</h2>
        <ul>
          <li><b>r2c3</b>: 2行目（上から2番目）・3列目（左から3番目）のマス。</li>
          <li><b>ブロック1〜9</b>: 3×3の区画。左上がブロック1、右へ2・3、次の段が4・5・6、最下段が7・8・9。</li>
          <li><b>ユニット</b>: 行・列・ブロックの総称。どのユニットにも1〜9が1つずつ入る。</li>
          <li><b>候補</b>: そのマスに入る可能性が残っている数字。手筋は「候補を減らす」か「数字を確定させる」ための推論。</li>
          <li><b>効き</b>: ある数字が置かれると、同じ行・列・ブロックの他のマスにはその数字が入らない。この範囲を効きと呼ぶ。</li>
        </ul>
        <h2>凡例</h2>
        <ul class="legend">${legend.map(([i, t]) => `<li>${i}<span>${t}</span></li>`).join('')}</ul>
        <h2>手筋一覧</h2>
        <p>おおむね易しい順に並べています。</p>
        <div class="table-wrap"><table class="tech-table"><thead><tr><th>手筋</th><th>分類</th><th>概要</th></tr></thead><tbody>${rows}</tbody></table></div>
      </article>`;
  }

  function showIntro() {
    current = null;
    main.innerHTML = introView();
    document.title = '数独 手筋プレイブック';
  }

  /* ---------- ルーティング・イベント ---------- */
  function route() {
    const id = decodeURIComponent(location.hash.replace(/^#/, ''));
    const ex = list.find((t) => t.id === id);
    if (ex) showTech(ex);
    else showIntro();
    markNav(ex ? ex.id : null);
    nav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
    window.scrollTo(0, 0);
  }

  document.addEventListener('keydown', (e) => {
    if (!current || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { go(current.k + 1); e.preventDefault(); }
    else if (e.key === 'ArrowLeft') { go(current.k - 1); e.preventDefault(); }
    else if (e.key === 'Home') { go(0); e.preventDefault(); }
    else if (e.key === 'End') { go(current.ex.steps.length - 1); e.preventDefault(); }
  });

  main.addEventListener('mouseover', (e) => {
    const r = e.target.closest('.ref');
    const g = main.querySelector('.board .hover');
    if (!g) return;
    g.innerHTML = r ? hoverMarkup(r.dataset.ref) : '';
  });
  main.addEventListener('mouseleave', () => {
    const g = main.querySelector('.board .hover');
    if (g) g.innerHTML = '';
  });

  navToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(open));
  });

  buildNav();
  window.addEventListener('hashchange', route);
  route();
})();
