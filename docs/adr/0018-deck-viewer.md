# ADR 0018: 複数の図をまとめたビューア(`svg-diagram deck`)

- 状態: 提案
- 日付: 2026-10-15
- 基点: `origin/main`(479c188、PR #194 まで)
- 関連: ADR 0006(`--html`), ADR 0007(結果が入力だけで決まること), ADR 0008(`appearance` / ダーク), ADR 0012(id の衝突と `--id-prefix`), ADR 0013(失敗したビルドの古い出力)。要望原文は medius-research の `docs/svg-diagram-feature-requests.md` の F1(優先度は中)

## 背景

資料づくりの側から、次の要望が届いた。

> F1 複数の図をまとめたビューアの出力。8枚のスライドを前へ・次へで見られるビューア(キーボード操作、一覧、拡大)を、Python で自作した。提案: `svg-diagram deck a.ts b.ts --html out.html`。要確認: `build --html` との関係。

使い道は、スライドの下書きの確認、レビュー依頼(1 ファイルをメールやチャットで渡せる)、PoC 資料の配布。Python で自作した側は、各 SVG を 1 つの HTML に貼る処理と、id の衝突の回避を自前で持っていた(ADR 0012 の D2 で報告された問題と同じ)。

### 現状(コードで確かめたこと)

**「既存機能で足りないか」への答えは、足りない。** 近い機能は 5 つあるが、どれも「複数の図を、ブラウザで、前へ・次へで見る 1 つの出力」にならない。

| 既存 | できること | 足りない点(ファイル:行) |
|---|---|---|
| `contact`(`contact-sheet.ts`、`lib/contact.ts`) | 複数の SVG を 1 枚の絵に並べる | 出力は **PNG だけ**(`contact-sheet.ts:33` で `rasterize(sheet.svg, {png: true, …})`)。入力も `.svg` だけ(同 15 行)。静的で、前へ・次へも拡大もない。レビュー用の「一覧」としては使えるが、ビューアではない。各図の id は `embedSvg(…, 'f<n>-')`(`lib/contact.ts:31`)で付け替えるが、これは resvg に渡す 1 枚の SVG の中の話で、HTML には使えない |
| `build --html`(`build-diagram.ts:71`、`lib/dsl/io.ts:92-95`) | 図 1 枚を HTML/CSS で書く | 出力は **HTML の断片**(`<style>` と `<div id="sd-…" class="sd">`。`lib/emit-html.ts` の `emitHtml`)で、`<html>` も操作もない。ソース 1 つにつき `<name>.html` を SVG の隣に書くだけで、複数をまとめる処理がない。`--out` は入力が 1 つのときだけ(`build-diagram.ts:81-83`)。つまり「複数ファイルへの対応」は、複数を**別々に**書くこと |
| `md`(`markdown-diagram.ts`、`lib/markdown.ts`) | Markdown の `![](x.diagram.ts)` を SVG / HTML に展開 | 出力は Markdown。複数の図を並べられるが、ページ送りも一覧もない。`inlineSvg()` / `htmlFigure()`(`lib/markdown-target.ts`)は、Markdown のページに図を埋めるための id 付け替えで、**ビューアの部品には使える**(後述) |
| `show` / `preview`(`show-diagram.ts`、`preview-svg.ts`) | 端末の sixel / PNG に描く | 端末と PNG が対象。HTML ではない。`show` は複数の入力を縦に並べるだけ |
| `notes`(`notes-diagram.ts`) | ワイヤーフレームの注釈を Markdown のリストにする | deck 的な出力ではない(重複なし) |

再利用できる部品は、すでにある。

- **ソースを SVG / HTML にする(何も書かずに)**: `lib/render-source.ts` の `renderSource(file, {html?})` は、`from 'svg-diagram'` の解決、`.svg-diagram.json`、検証(`verdict`)まで済ませて、`{svg, html?, ok, problems, warnings}` を返す。何もディスクに書かない。`md` と remark / markdown-it が使っているのと同じ入口。
- **id の衝突の解決**: `lib/svg-ids.ts` の `prefixSvgIds(markup, prefix, {rootId})`(ADR 0012 D2)と `idPrefixFor(prefix, basename)`。`id="…"`、`url(#…)`、`href="#…"`、`aria-labelledby` / `aria-describedby`、`<style>` の `#id` を書き換え、`<metadata id="svg-diagram">` は残す。SVG に出る id は固定の少数(`svg-title` / `svg-desc`、矢じりの `dsl-arrow*`)。複数の SVG を 1 つの HTML に貼ると、これらが重なる。
- **`<style>` の扱い**: SVG の `<style>` は `text { … }` / `.mono` / `.emoji` という**素のセレクタ**(`lib/emit.ts:72-75`)で、インライン SVG として HTML に貼ると**文書全体に効く**。いまは全図で同じ内容なので害はないが、図ごとに違う規則が入ると漏れる。`inlineSvg()`(`lib/markdown-target.ts`)は、この `<style>` の各規則の前に `#<pre> ` を付けて 1 枚の図に閉じ込めている。`prefixSvgIds` は `#id` セレクタの付け替えだけで、このスコープ化はしない。
- **`style="…"` 属性**: `lib/emit*.ts`(`emit-html.ts` 以外)の SVG 出力には **`style="` が 1 つもない**(数えた)。一方 `emit-html.ts` の HTML 形式は、絶対配置の `div` に `style="left:…;top:…"` を 13 か所で書く。**CSP を厳しくできるのは SVG 形式だけ**で、HTML 形式は `style-src-attr 'unsafe-inline'` が要る。
- **アクセシビリティの名前**: doc 向きの図は、`<title id="svg-title">` / `<desc id="svg-desc">` と `role="img"` を持つ(`lib/emit.ts:84-87`)。ただし `medium === 'doc'` のときだけ。スライド向き(`canvas: 'slide'`)の図には**ない**ので、deck は名前の出所を自分で決める必要がある。
- **ダーク**: `appearance: 'dark'` の図は、色を `recolor()` で**固定の 16 進**に置き換えて書く(`lib/emit.ts:104`)。ルートに `data-appearance="dark"` が付く(同 105 行)。CSS 変数でも `prefers-color-scheme` でもない(F2 は別件)。透明な図(`transparent: true`)は背景を塗らない。
- **freshness**: SVG の `<metadata id="svg-diagram">` は、`check --drift` と `build --stale` と `preview` の古さの警告が読む(ADR 0013)。deck の入力に SVG を許すなら、これを書き換えない(`prefixSvgIds` はすでに守っている)。
- **reveal**: 段階表示の図は、`build` が `<name>.reveal<N>.svg` を書く(`lib/dsl/io.ts:97-104`)。deck の v1 はこれを扱わない(下の未決事項)。

## 論点

1. コマンド名と引数。`svg-diagram deck` か、`build --deck` か。
2. 出力。1 つの自己完結した HTML。外部依存なし。CSP をどう考えるか。
3. 操作。キーボード、一覧、拡大、URL ハッシュ、印刷。
4. 各図の id の衝突。`--id-prefix`(ADR 0012)をどう流用するか。
5. ダークモード追従(F2)との関係。
6. アクセシビリティ(alt / title、フォーカス)。
7. 大きい図(多数・重い図)の遅延描画。
8. `build --html` との役割分担。

## 決定

### D1: 新しいサブコマンド `svg-diagram deck`(`build --deck` にはしない)

```
svg-diagram deck <a.ts|a.svg>... --out deck.html [--title <text>] [--cols N] [--lazy] [--csp] [--render svg|html]
```

- 入力は `.ts`(図のソース)と `.svg`(書き出し済み)を混ぜてよい。順序が表示順。`contact` が `.svg` だけ、`show` が両方を取る前例(`show-diagram.ts:1`)のうち、`show` に合わせる。
- `--out` は既定 `deck.html`。標準出力には出さない(自己完結 HTML は大きく、`md` のように Markdown の流れに乗らない)。
- **`build --deck` にしない理由**: `build` は「ソース 1 つ → ファイル 1 つ(と隣の png / html / reveal)」を書く道で、`--out` は入力が 1 つのときだけ、`--stale`・`--png`・`--fit`・lint・`--id-prefix` はどれもその形を前提にしている(`build-diagram.ts:68-83`、`:140-160`)。「入力が複数で出力が 1 つ」は、この道にすでにある旗の組み合わせの意味を壊す(`--out` の複数入力の禁止、`--stale` の「この SVG は最新か」)。コマンドを分ければ、`build` の挙動は 1 バイトも変わらない。
- `bin/svg-diagram` に `deck)` の 1 行、新しい入口は `deck-diagram.ts`(`contact-sheet.ts` と同じ作り)。

### D2: 描画は `renderSource` を使い、**何も中間ファイルに書かない**

- `.ts` は `renderSource(file, {fresh: false})` で SVG を得る。`ok === false`(検証の失敗、または XML として壊れている)は、**1 つでもあれば全体を失敗(終了コード 1)にし、`--out` に書かない**(ADR 0013。古い `deck.html` を残さず、残っているときはそう言う)。warning は表示するだけ。
- deck は **lint(Chromium での `lint-svg --strict`)を走らせない**。`build` / `check` を通した図を見る道で、`deck` はその検査の代わりではない(ヘルプに書く)。
- `.svg` は読むだけ。XML として壊れていれば `lib/xml-check.ts` で止める。

### D3: 出力は 1 つの自己完結 HTML。既定は SVG をインラインで置く

- 構造(1 ファイルで、外部への参照を持たない):

```html
<!doctype html>
<html lang="ja" class="no-js">
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>…</title>
<style>/* 1 つの <style>: ビューアの枠と @media print */</style>
<main id="deck" aria-label="…">
  <section id="s1" class="slide" role="group" aria-roledescription="slide" aria-label="1 / 8: …">
    <svg …>(prefixSvgIds 済み、<style> は #s1 に閉じ込めた SVG)</svg>
  </section>
  …
</main>
<script>/* 1 つの <script>: 操作 */</script>
```

- **既定は SVG 形式**。理由は、(a) 検証と lint の対象になる絵そのもの(ADR 0006 の「SVG は従来どおり作る。drift・lint・検査は SVG のまま」)、(b) `style="` 属性がないので CSP を厳しくできる(上記)、(c) サイズが小さい、(d) 文字は `<text>` として選択・検索できる。HTML/CSS 形式(`--render html`)は第 2 段。必要になった理由が出るまで足さない(下の「実装計画」の単位 F)。
- **外部依存なし**: `src` / `href` / `@import` / `url(http…)` / フォントの取得を**1 つも出さない**。フォントは `FONT_STACKS` の名前を指すだけ(閲覧する側の環境にあるもの)。図の中の画像(`image()`)は、ソースがデータ URI で持つもののみ。外部 URL を `href` に持つ `<image>` を見つけたら warning を出す(自己完結でなくなる)。
- **CSP**: `--csp` を付けると `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-…'; script-src 'sha256-…'; img-src data:">` を出す。`<style>` と `<script>` はそれぞれ**ちょうど 1 つのブロック**で、内容が入力だけで決まる(ADR 0007)ので、ハッシュも決まる。SVG 形式なら `style` 属性がないので、この方針で通る。**既定では `--csp` を付けない**: メールの添付やファイルの直開きで `meta` の CSP が不要な副作用を起こさないため。ホストがヘッダで CSP を持つ場合は、同じハッシュを `--csp` が標準エラーに出す形にする(要確認)。`--render html` と `--csp` の併用は、`style-src-attr` が要るので第 2 段で決める。
- **JS がなくても読める**: `<html class="no-js">` のとき、CSS だけで全スライドを縦に並べる(各図は幅に縮む)。スクリプトが動くと `no-js` を外して、1 枚表示に切り替える。CSP でスクリプトが止められた、印刷、検索エンジンやスクリーンリーダーの全文走査、のどれでも全図が見える。

### D4: 操作

| 操作 | 内容 |
|---|---|
| 前・次 | `←` `→`、`PageUp` `PageDown`、`Space`(次)、`Shift+Space`(前)、`Home` `End`。画面の端に実体の `<button>`(前へ・次へ)も置く(タッチ・マウス用) |
| 一覧 | `g`(または `Esc` でも閉じる)で、全スライドの縮小を格子(`--cols`、既定は幅で自動)で出す。縮小は同じインライン SVG を CSS で縮めたもの(`contact` の PNG とは別物。PNG は作らない)。各縮小は `<button>` で、押すとその 1 枚に移る。`Tab` で巡れて、現在の 1 枚にフォーカスが当たって開く |
| 拡大 | 通常は窓に収める(`viewBox` の縦横比のまま `max-width:100%;max-height:100%`。`inlineSvg` の `max-width:100%;height:auto` と同じ考え)。`z`(または図のクリック)で「等倍(論理サイズ)」に切り替え、はみ出すぶんはスクロールで見る。もう一度で戻る。ピンチ・ホイールの拡大は**やらない**(ブラウザの拡大に任せる) |
| URL ハッシュ | `#3`(1 始まりの番号)と `#<名前>`(ソースの basename。`idPrefixFor` と同じ規則で安全にしたもの)を受ける。移動のたびに `history.replaceState` で更新(戻るボタンで 1 枚ずつ遡らず、deck を離れる)。`hashchange` と最初の読み込みで同期。一覧を開いている状態は `#grid`(これだけは `pushState` で、戻るで一覧が閉じる) |
| 全画面 | `f`(`requestFullscreen` が使えれば) |
| 印刷 | `@media print`: 全スライドを出し、1 枚 1 ページ(`break-after: page`)、ビューアの枠・ボタン・一覧は隠す。`@page` の `size` は**最大の図の論理サイズ**に合わせる(図の大きさがそろっていれば 1 つの `@page`、違えば `@page` を図ごとに名前付きで出す: 未決)。遅延描画のときは、`beforeprint` で全部を実体にする |

ショートカットは、`input` / `textarea` / `select` にフォーカスがあるとき、および `Ctrl` `Alt` `Meta` を伴うときは**奪わない**。

### D5: id の衝突は `prefixSvgIds` の流用で解く

- 各スライドの図に、`idPrefixFor('s', name)` のように**位置と名前**から決めた接頭辞(`s1-flow`、`s2-gap` …)を付けて `prefixSvgIds(svg, prefix)` を呼ぶ。同じ名前が 2 回出ても番号で区別される。`--id-prefix auto`(内容のハッシュ)は使わない: スライドの並びを変えても同じ図が同じ id になる利点より、**位置の番号が読めること(URL ハッシュ `#3` との対応、差分の読みやすさ)**を取る。内容が同じ図の 2 回目は、位置の番号が違うので衝突しない。
- **新しい接頭辞処理を足さない**。ADR 0012 が「3 つの別々の処理は寄せない」とした方針を守る: `md` の `inlineSvg` / `htmlFigure` / `raster.embedSvg` には触らない。deck は `prefixSvgIds` だけを呼ぶ。
- **`<style>` のスコープ化**だけは `prefixSvgIds` が持たない。スライドの `<section id="s1">` の中に閉じ込めるため、各 `<style>` の規則の前に `#s1 ` を付ける小さな関数を、**`lib/markdown-target.ts` の `inlineSvg()` からそのまま取り出して** `lib/svg-ids.ts`(または新しい `lib/scope-style.ts`)に置き、`inlineSvg` からも呼ぶ(挙動を変えず、重複を作らない)。`md` の出力が 1 バイトも変わらないことを、既存の `markdown-target` のテストで確かめる。
- 入力の `.svg` に、すでに `build --id-prefix` が付いていても、二重に付くだけで害はない。`<metadata id="svg-diagram">` は書き換えない(同じ id を持つ `<metadata>` が複数並ぶが、HTML のインライン SVG の中では検索の対象にならない。deck は drift の対象ではない)。
- `--render html` のとき(第 2 段)は、`prefixSvgIds(html, prefix, {rootId})`(`build-diagram.ts:147-148` の呼び方)を使う。

### D6: ダークモード(F2)との関係 — ビューアの枠だけが追従し、図は図の指定に従う

- ビューアの枠(背景・ボタン・一覧)は、`color-scheme: light dark` と CSS 変数で、`prefers-color-scheme` に追従する。
- **図そのものは追従させない**(F2 の「`appearance` を CSS 変数にする」は別の ADR)。いまの図の色は固定の 16 進(`lib/emit.ts:104`)で、図の側は変えられない。
- ただし、図が暗い(`data-appearance="dark"` が付く。`lib/emit.ts:105`)ときは、その 1 枚の**パネルの背景を暗色トークンの `bg` にする**。透明な図(`transparent: true`)は、パネルの背景がそのまま見える: 明るい枠 + 暗色の透明な図(白い文字)が読めなくなる事故を避けるため、スライドのパネルは**図の `appearance` に合わせた色**(明: `PALETTE.bg`、暗: 暗色の `bg`)で塗り、枠の色とは独立にする。
- F2 が実現して、図が `prefers-color-scheme` に追従する形になったとき、deck 側は「パネルの色を図に任せる」に 1 行で切り替えられる(パネルの背景の指定を外すだけ)。F2 は deck の前提にしない。

### D7: アクセシビリティ

- 各スライドは `<section role="group" aria-roledescription="slide" aria-label="N / M: <名前>">`。名前は、(1) ソースの `diagram({title})` またはその既定(`lib/emit.ts` の `diagramTitle`。doc 向きの図が `<title id="svg-title">` に入れるもの)、(2) なければソースの basename、の順。**スライド向きの図には `<title>` が付かない**(上記)ので、(2) に落ちることが多い。要望: スライド向きの図にも `title` を出せるようにする話は別件(未決事項)。
- 図の中の `role="img"` + `aria-labelledby="svg-title svg-desc"` は、`prefixSvgIds` が接頭辞付きの id に直す(ADR 0012: `aria-labelledby` の複数 id を書き換える)ので、スライドごとに正しい名前が付く。`<title>` を持たない図は、`<section>` の `aria-label` が名前になる。
- 表示していないスライドは `hidden`(`display:none`)にして、DOM とアクセシビリティの木から外す(`aria-hidden` ではなく、フォーカスもされないように)。**JS なし、または印刷では全部が見える**(D3)。
- ビューアの枠(`#deck`)は `tabindex="0"` で、`:focus-visible` の輪郭を消さない。移動後は、枠にフォーカスを残す(スライドの中にフォーカスを移さない)。`<div aria-live="polite" class="sr-only">` に「3 / 8: <名前>」を入れて、移動を読み上げる。ボタンは実体の `<button>` で、`aria-label`(前のスライド / 次のスライド / 一覧)を持つ。一覧を開くとき、現在のスライドのボタンにフォーカスし、閉じるときは枠に戻す。一覧を開いている間、背面の枠は `inert`。
- 動き(アニメーション)は**入れない**。切り替えは即時。`prefers-reduced-motion` で変える必要がない。
- 色だけに頼らない: 現在位置は「3 / 8」の文字と、一覧の現在の枠の太さ(色以外の差)で示す。

### D8: 大きい図の遅延描画 — 既定は全部インライン、`--lazy` で `<template>`

- 既定: 全スライドの SVG をインラインで置く(D3)。数十枚・数 MB までは、`hidden` の部分木は描画されないので、ページの初期表示のコストは構文解析だけ。
- `--lazy`(または、合計が閾値を超えたときの自動。**閾値は測ってから決める**: 未決事項): 各スライドの SVG を `<template>` に入れ、**最初に表示する直前に**複製して `<section>` に入れる。`<template>` の内容は DOM に入らない(id が重ならず、描画も構文解析以外のコストもない)。一覧の縮小は、`IntersectionObserver` で見えたものから複製する。次のスライドを 1 枚先読みする。
- `--lazy` のとき、JS が止まるか、`<noscript>` が見えるときは、全図が見えない。`<noscript>` に「このファイルは JavaScript が必要です。`--lazy` なしで作り直してください」と出す。印刷は `beforeprint` で全部を実体にする(D4)。`--lazy` を既定にしない理由は、D3 の「JS なしでも読める」を既定の約束にしたいから。
- 重い図(数千要素の図)の 1 枚だけを遅らせる方針(図ごとに選ぶ)はやらない。

### D9: `build --html` との役割分担

- **`build --html`**: 図 1 枚の HTML/CSS 断片(`<name>.html`)を書く。Slidev・VitePress・自分の HTML に**埋め込む**ための部品。
- **`deck`**: 複数の図を、**ビューアつきの 1 つの HTML 文書**にする。**見る・渡す**ための完成品。
- deck は `build --html` の出力を**読まない**(`renderSource` を直接呼ぶ)。したがって `build` を先に走らせる必要はなく、`svg/` の古い SVG が deck に混ざることもない。入力に `.svg` を渡したときだけ、書き出し済みのものを使う。
- `md --html` / remark / markdown-it の埋め込みは、そのまま。deck はそれらの代わりではない(文書の中の図は文書が見せる)。

## 代替案

1. **`build --deck`**。D1 のとおり、`build` の旗の意味(`--out` の入力は 1 つ、`--stale`、`--png`、lint、`--fit`)と衝突する。出力が 1 つで入力が複数の道は別。却下。
2. **`build --html` の複数入力に `--out deck.html` を許す**。「断片を 1 つに連結する」と「ビューアにする」が同じ旗で表すと区別がつかない。却下。
3. **`contact` に `--html` を足す**。`contact` は resvg に渡す 1 枚の SVG を組む道(`lib/contact.ts`)で、HTML は全く別の組み立て。入力が `.svg` だけである点も合わない。一覧の**格子の寸法の計算(`cols` と幅)**だけ、`lib/contact.ts` の考え方を参考にする。却下。
4. **各図を `<img src="data:image/svg+xml;base64,…">` で置く**。id の衝突も `<style>` の漏れも原理的に起きず、実装が最も小さい。だが、文字の検索・選択ができず、図の中の `<title>` / `aria-label` が支援技術に届かず、`img-src data:` が要る。ビューアの用途(レビューで文字を探す、スクリーンリーダー)に合わない。却下(ただし `--lazy` の縮小のフォールバックには使える余地がある)。
5. **`<object>` / `<iframe srcdoc>`**。文書が分かれるので衝突はないが、フォーカスとキーボードの扱いが分断され、サイズの計算も面倒。却下。
6. **ビューアを別パッケージ(Slidev のアドオン、`svg-diagram/render` の利用者)に任せる**。Slidev アドオンは「Slidev の中で図を見せる」道で、Slidev を持たない相手に 1 ファイルを渡す用途を満たさない。却下。

## 影響

- **既存の出力は 1 バイトも変わらない**。`build`、`md`、`contact`、`check` の挙動に触らない。変わりうるのは `inlineSvg()` の内部を共有関数に抜く部分(D5)だけで、`md` の出力のバイト一致を既存のテストで固定する。
- 新しいサブコマンドが増える(`bin/svg-diagram` の 1 行、README と `skills/svg-diagram` の一覧、ヘルプの文面)。
- deck の出力は、`<style>` と `<script>` が各 1 ブロックで、日時や乱数を含まない(ADR 0007): 同じ入力から同じバイト列。CI で `deck.html` の差分を見られる。
- HTML は SVG の数だけ大きくなる(SVG 形式のスライド 1 枚は数十 KB のことが多い)。数十枚で数 MB の見込み。D8 の閾値で調整する。
- ビューアの JS が新しい保守対象になる。**ブラウザなしで検査できる形**(純関数の状態遷移)に分け、DOM の薄い層は小さくする(下の実装計画)。
- スライド向きの図に `<title>` が付かない(D7)のは、deck では「basename の名前」に落ちる。品質を上げるには別の変更が要る(未決事項)。

## 実装計画

独立に進められる単位に分ける。**触るファイルの重なりは、`bin/svg-diagram` と README を最後に 1 人がまとめて触る点だけ**(単位 E)。

### A. ビューアの状態遷移(純関数)

- 触るファイル: `lib/deck-state.ts`(新規)、`test/deck-state.test.ts`(新規)
- 中身: 状態 `{index, total, grid, zoom}` と、入力(`next` / `prev` / `first` / `last` / `goto(n)` / `toggleGrid` / `toggleZoom`)から次の状態を返す関数。URL ハッシュの解釈(`#3`、`#<名前>`、`#grid`、範囲外・不正は先頭)と書き出し。キーの名前 → 入力の対応表(`Shift+Space` や、`Ctrl` 付きは無視、などの規則)。**DOM も `window` も使わない**(`test/core-purity.test.ts` を通す)。
- テスト: 端で止まる(最後で `next` は動かない / 巻き戻さない)、範囲外のハッシュ、名前のハッシュ、`goto` の丸め、`Ctrl+←` は無視、`input` にフォーカス中は無視(「入力中か」は引数で渡す)。

### B. 文書の組み立て(純関数)

- 触るファイル: `lib/deck-html.ts`(新規)、`lib/scope-style.ts`(新規。`inlineSvg` から `<style>` のスコープ化を取り出す)、`lib/markdown-target.ts`(`inlineSvg` が共有関数を呼ぶだけに)、`test/deck-html.test.ts`(新規)、`test/markdown-target.test.ts` など既存の `inlineSvg` のテスト(**無変更で通る**)
- 中身: `buildDeck(slides: {name, svg, title?}[], opts): string`。`prefixSvgIds` の呼び出しと `<style>` のスコープ化、`<section>` の骨格、`<noscript>`、`--csp` のハッシュ計算(`node:crypto`)、印刷の `@page`、`<title>` と `lang`。ビューアの CSS と JS は、単位 A / C の成果物を文字列として受ける(この単位は A / C の中身に依存しない。ダミーの文字列でテストできる)。
- テスト(**HTML の構造で確かめる。フォントや寸法の絶対値は使わない**):
  - 全スライドの全 id が文書の中で**一意**(`id="…"` を集めて重複がない)。同じ図を 2 回渡しても。
  - すべての `url(#…)` / `href="#…"` / `aria-labelledby` が、文書の中の存在する id を指す。
  - 各 `<style>` の全規則が、そのスライドの `#sN ` で始まる(素の `text {` が残らない)。
  - 外部参照がない: `src=` / `href="http…"` / `@import` / `url(http…)` を含まない(データ URI と `#fragment` だけ)。
  - `<style>` と `<script>` がそれぞれ 1 ブロック、`--csp` のハッシュが、そのブロックの SHA-256 と一致する。
  - `<section>` の数 = 入力の数、`aria-label` に「N / M」。`hidden` が付くのは、JS が入るまでの CSS 側ではなく `no-js` の規則で全部見える(クラスと規則の存在で確かめる)。
  - 同じ入力でバイト一致(2 回呼んで同じ)。`<metadata id="svg-diagram">` が書き換わっていない。

### C. ビューアの DOM の層(スクリプトと CSS)

- 触るファイル: `lib/deck-viewer.ts`(新規。CSS 文字列と JS 文字列を返す。JS は単位 A の関数を**同じソースから**文字列化して埋める、または A を ES モジュールにして `Function#toString` を使う。どちらにするかは実装で決める。ビルド(`tsc`)後の `dist/` でも同じ動きになること)、`test/deck-viewer.test.ts`(新規)
- 中身: キー入力 → A の状態 → `hidden` / `inert` / ハッシュ / `aria-live` の更新。`<button>`、一覧、等倍、全画面、`beforeprint`。`--lazy` の `<template>` の複製(`IntersectionObserver`)。
- テスト: **DOM の模擬(最小の `document` / `window`)**で、キーイベントを流して `hidden` の付け替え・`location.hash` の更新・`aria-live` の文字・一覧を開いたときの `inert` を確かめる。実ブラウザを使う検証(キー、フォーカス、印刷)は、`playwright-chromium` が使える環境のときだけ走らせる 1 つのスモーク(`test/deck-browser.test.ts`。`lint-svg` の `--engine browser` と同じ前提で、なければ skip): 次へ → ハッシュが `#2`、`g` で一覧、`Esc` で戻る、印刷メディアでの全スライドの表示数(`page.emulateMedia({media: 'print'})` の `display` の数)。**文字や箱の絶対座標・寸法は見ない**。

### D. コマンド本体(入出力)

- 触るファイル: `deck-diagram.ts`(新規)、`test/deck-cli.test.ts`(新規。`test/cli.test.ts` と同じく子プロセスで実行)
- 中身: 引数の解釈(`--out`、`--title`、`--cols`、`--lazy`、`--csp`、`--render`、未知の旗はエラー)、`.ts` は `renderSource`、`.svg` は読み込み、失敗の集約(1 つでも失敗なら何も書かず終了コード 1)、`closeMeasurer()`(`contact-sheet.ts` と同じ後始末)、B と C を呼んで書く。ディレクトリを作る。
- テスト: 入力 2 つ(`.ts` 1 つと `.svg` 1 つ)で `deck.html` ができ、`section` が 2 つ。検証に失敗するソースを混ぜると**終了コード 1 で、既存の `deck.html` が書き換わらない**(ADR 0013)。入力なし・未知の旗・`--cols 0` は終了コード 2 とヘルプ。壊れた XML の `.svg`。

### E. 配線とドキュメント(最後に 1 人)

- 触るファイル: `bin/svg-diagram`(`deck)` の行と冒頭のヘルプの行)、`README.md`(コマンド一覧と短い節)、`skills/svg-diagram/`(コマンドの一覧)、`package.json`(`files` に新しいファイルが含まれるか。`tsconfig.build.json` が拾うか)、`test/cli.test.ts` か `test/bin.test.ts` の、ヘルプにコマンド名が出るテスト
- 依存: A〜D が入ってから。

### F. 第 2 段(別 PR)

- `--render html`(HTML/CSS 形式のスライド。D5 の `rootId` つきの接頭辞、`style-src-attr` の CSP の扱い)。
- reveal の段階表示(`<name>.reveal<N>.svg` を 1 枚のスライドの中の段階として、`Space` / `→` で進める。`renderSource` が段階の SVG を返す入口が要る)。
- スライド向きの図に `<title>` を出す(D7)。

### 並列の進め方

A、B、C、D は**別々のファイル**を触るので 4 人で並列にできる。契約(関数の型)だけ先に決める: A は `reduce(state, input): state` と `parseHash` / `formatHash`、B は `buildDeck(slides, {css, js, …}): string`、C は `viewerAssets(opts): {css: string; js: string}`、D は B と C を呼ぶだけ。E は最後。`lib/markdown-target.ts` に触るのは B だけ。

### 検証(全体)

- `pnpm test`(`node --test "test/*.test.ts"`)と `pnpm typecheck` が通る。
- `pnpm golden`(`examples/out` の SVG が変わらない)が通る: deck は SVG の出力に触らない。
- 手元の確認(任意): `examples/*.ts` の数枚で `svg-diagram deck … --out /tmp/deck.html` を作り、ブラウザで開く。

## 未決事項

1. **reveal のある図**: v1 は最終の段階だけ(`renderSource` が返す `svg`)を見せる。段階を `Space` で進める形(単位 F)にするか、別の図として並べるか。
2. **スライド向きの図の名前**: `<title>` が付かない(`lib/emit.ts:84` は doc のみ)ので、deck は basename に落ちる。スライド向きの図にも `title` を出すか(SVG の出力が変わる別の ADR)、deck の側で `diagram({title})` を読むだけにするか。
3. **印刷の `@page`**: 図の大きさがそろわないときの扱い(最大に合わせる / 名前付き `@page`)。
4. **`--lazy` の自動の閾値**: 実際の deck(`examples/` と medius-research の 8 枚、数十枚)で、構文解析の時間と HTML の大きさを測ってから決める。測るまでは `--lazy` は明示のときだけ。
5. **`--csp` のホスト側ヘッダ**: `meta` の CSP は `frame-ancestors` などを扱えない。ホストがヘッダで CSP を持つ場合の、ハッシュの受け渡しの形(標準エラー出力 / `--csp-hashes` の別旗)。
6. **ソースの切り替え**: 1 枚のスライドに、ソースのパスと「古い(freshness)」の表示を出すか(`preview` の赤い帯の考え方)。`.svg` 入力で `freshness()` が stale を返すとき、deck に警告を出す価値はあるか。
7. **`.svg` と `.ts` の混在の順序**: 順序は引数順(ディレクトリやグロブの展開はシェルに任せる)。ディレクトリを渡す(`svg/*.svg` の自然順)入力は、第 1 段では扱わない。
8. **F2(CSS 変数のダーク追従)**: D6 の「パネルの色を図の `appearance` に合わせる」は暫定。F2 の方式が決まったときに見直す。
