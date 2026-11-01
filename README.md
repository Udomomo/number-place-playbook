# ナンプレ 手筋プレイブック

ナンプレの定石手筋を、1つの盤面をステップごとに前後しながら確認する静的サイトです。ビルド不要で、`index.html` をそのまま配信できます。

## 収録している手筋

| 分類 | 手筋 |
| --- | --- |
| シングル | Hidden Single / Naked Single |
| ブロックと行・列の交差 | Pointing / Claiming |
| 同盟（ペア・トリプル） | Naked Pair（二国同盟）/ Naked Triple（三国同盟）/ Hidden Pair / Hidden Triple |
| フィッシュ | X-Wing / Swordfish / Finned X-Wing |
| 1数字のパターン | Skyscraper / 2-String Kite / Empty Rectangle / Simple Coloring |
| ウィング | XY-Wing / XYZ-Wing / W-Wing |
| チェーン | XY-Chain |
| 唯一解の利用 | Unique Rectangle / BUG+1 |

## ローカルで見る

```bash
npx http-server -p 8080 .
```

`http://localhost:8080/` を開きます（`file://` で直接開いても動きます）。

## デプロイ

静的ファイルのみです。GitHub Pages なら Settings → Pages で「Deploy from a branch」を選び、このブランチのルート（`/`）を指定します。Netlify・Cloudflare Pages などでもビルドコマンドなし、公開ディレクトリはルートで配信できます。

## 構成

```
index.html              ページの骨組み
assets/style.css        スタイル
assets/sudoku.js        盤面の基本ロジック（セル指定の解析、候補の計算、ステップごとの状態）
assets/techniques.js    手筋データ（盤面・各ステップの表示と説明文）
assets/app.js           描画（SVG の盤面、ステップ操作、ナビゲーション）
tools/validate.js       手筋データの検証
tools/design.js         例題の与えられた数字を探す補助ツール
tools/gen.js            唯一解パズルを生成し、BUG+1 になる局面を探すツール
tools/show.js           盤面を端末に表示
tools/solver.js         検証用の制約ソルバー
```

## 手筋データと検証

手筋は `assets/techniques.js` に1件ずつ書きます。形式はファイル先頭のコメントを参照してください。盤面の候補は「盤上の数字の効き」から自動で計算し、必要な場合だけ `cands` で絞り込みます。

データを変更したら検証を実行します。

```bash
node tools/validate.js
```

検証内容:

- 与えられた数字どうしが矛盾していないこと
- 表示する候補が盤上の数字の効きと矛盾しないこと（`cands` は基本候補の部分集合）
- 各ステップの消去・確定が、その時点の候補から論理的に導けること（反例がないことを全探索で確認）
- ハイライト・仮定・リンクが実在する候補を指していること

唯一解を前提とする消去（Unique Rectangle）は、ステップに `uniq: true` を付けて論理的含意の確認から外しています。BUG+1 の局面は実際の唯一解パズルを基本手筋で解き進めたもので、`uniqueCheck` で解が1つであることを確認しています。
