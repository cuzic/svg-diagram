# ADR 0018: 複数の図をまとめたビューア(`svg-diagram deck`)

- 状態: 実装済み(第 1 段: 単位 A〜E は PR #200・#201・#202・#212・#213。第 2 段の `--lazy`・全画面(`f`)・図ごとの名前付き `@page`・`--render html`・reveal の段階表示は未着手)
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
svg-diagram deck <a.ts|a.svg>... --out deck.html [--title <text>] [--cols N] [--csp] [--render svg|html]
```

- 入力は `.ts`(図のソース)と `.svg`(書き出し済み)を混ぜてよい。順序が表示順。`contact` が `.svg` だけ、`show` が両方を取る前例(`show-diagram.ts:1`)のうち、`show` に合わせる。
- `--out` は既定 `deck.html`。標準出力には出さない(自己完結 HTML は大きく、`md` のように Markdown の流れに乗らない)。
- **`build --deck` にしない理由**: `build` は「ソース 1 つ → ファイル 1 つ(と隣の png / html / reveal)」を書く道で、`--out` は入力が 1 つのときだけ、`--stale`・`--png`・`--fit`・lint・`--id-prefix` はどれもその形を前提にしている(`build-diagram.ts:68-83`、`:140-160`)。「入力が複数で出力が 1 つ」は、この道にすでにある旗の組み合わせの意味を壊す(`--out` の複数入力の禁止、`--stale` の「この SVG は最新か」)。コマンドを分ければ、`build` の挙動は 1 バイトも変わらない。
- `bin/svg-diagram` に `deck)` の 1 行、新しい入口は `deck-diagram.ts`(`contact-sheet.ts` と同じ作り)。

### D2: 描画は `renderSource` を使い、**何も中間ファイルに書かない**

- `.ts` は `renderSource(file, {fresh: false})` で SVG を得る。`ok === false`(検証の失敗、または XML として壊れている)は、**1 つでもあれば全体を失敗(終了コード 1)にし、`--out` に書かない**。既存の `deck.html` は**削除も書き換えもしない**(ADR 0013)。その `--out` が前回の deck の出力として残っているときは、「前回の `deck.html` が残っている(今の入力と一致しない古いもの)」と標準エラーに出す。warning は表示するだけ。
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
- **CSP**: `--csp` を付けると `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-…'; script-src 'sha256-…'; img-src data:">` を出す。**文書の `<style>` はちょうど 1 ブロック**にする。各図の SVG は自分の `<style>`(`lib/emit.ts:72`)を持つので、そのまま置くと `<style>` が「ビューアの 1 つ + 図の数」になり、`style-src` のハッシュ 1 つでは図の `<style>` が止まる。そこで **図の `<style>` を取り除き、規則を `#sN` でスコープ化してビューアの 1 つの `<style>` に合流させる**(D5)。スコープ化した規則は図の順に連結するだけにする(全図で本体がほぼ同じ規則の重複は、サイズの問題になったら第 2 段でセレクタを `,` でまとめて減らす)「CSP に全ブロックのハッシュを並べる」案は、ハッシュの数が図の数で増え、`meta` が膨らむので採らない。`<script>` もちょうど 1 ブロック。内容は入力だけで決まる(ADR 0007)ので、ハッシュも決まる。SVG 形式には `style` 属性がないので、この方針で通る。**既定では `--csp` を付けない**: メールの添付やファイルの直開きで `meta` の CSP が不要な副作用を起こさないため。ホストがヘッダで CSP を持つ場合の受け渡しは未決事項。`--render html` と `--csp` の併用は、`style-src-attr` が要るので第 2 段で決める。
- **JS がなくても読める**: `<html class="no-js">` のとき、CSS だけで全スライドを縦に並べる(各図は幅に縮む)。スクリプトが動くと `no-js` を外して、1 枚表示に切り替える。CSP でスクリプトが止められた、印刷、検索エンジンやスクリーンリーダーの全文走査、のどれでも全図が見える。

### D4: 操作

| 操作 | 内容 |
|---|---|
| 前・次 | `←` `→`、`PageUp` `PageDown`、`Space`(次)、`Shift+Space`(前)、`Home` `End`。画面の端に実体の `<button>`(前へ・次へ)も置く(タッチ・マウス用)。**`Space` と `Enter` は、`<button>`(一覧の縮小を含む)・`a`・`summary` にフォーカスがあるときは奪わない**(そのボタンの動作が先) |
| 一覧 | `g`(または `Esc` でも閉じる)で、全スライドの縮小を格子(`--cols`、既定は幅で自動)で出す。**一覧は SVG を複製しない**。複製すると、実行時に id が重複し(`<metadata>` を消して守った一意性が崩れ、`aria-labelledby` は先の方を指す)、複製は `<section id="sN">` の外に置かれるので `#sN text` の規則が効かずフォントの指定を失う。代わりに、**同じ `<section>` 群を、`#deck` の `grid` クラス(CSS の grid)で並べ替えて縮小する**(全 `<section>` の `hidden` を外し、各図を列の幅に縮める。DOM の `<svg>` の数と id は変わらない)。各 `<section>` の中に、**全面を覆う透明な `<button aria-label="3 / 8: 名前">`** を 1 つ置く(通常表示では隠し、一覧のときだけ有効)。押すとその 1 枚に移って一覧を閉じる。`Tab` で巡れて、現在の 1 枚のボタンにフォーカスが当たって開く。`contact` の PNG とは別物で、PNG は作らない |
| 拡大 | 通常は窓に収める(`viewBox` の縦横比のまま `max-width:100%;max-height:100%`。`inlineSvg` の `max-width:100%;height:auto` と同じ考え)。`z`(または図のクリック)で「等倍(論理サイズ)」に切り替え、はみ出すぶんはスクロールで見る。もう一度で戻る。ピンチ・ホイールの拡大は**やらない**(ブラウザの拡大に任せる)。**一覧のときは `z` とクリックでの拡大を無効にする**(有効だと一覧で等倍に切り替わり、`max-width` が外れて格子が崩れる) |
| URL ハッシュ | `#3`(1 始まりの番号)と `#<名前>`(ソースの basename。`idPrefixFor` と同じ規則で安全にしたもの)を受ける。移動のたびに `history.replaceState` で更新(戻るボタンで 1 枚ずつ遡らず、deck を離れる)。`hashchange` と最初の読み込みで同期。一覧を開いている状態は `#grid`(これだけは `pushState` で、戻るで一覧が閉じる) |
| 印刷 | `@media print`: 全スライドを出し、1 枚 1 ページ(`break-after: page`)、ビューアの枠・ボタン・一覧は隠す。`@page` の `size` は**最大の図の論理サイズ**に合わせた 1 つだけ(図ごとの名前付き `@page` は第 2 段) |

ショートカットは、`input` / `textarea` / `select` にフォーカスがあるとき、および `Ctrl` `Alt` `Meta` を伴うときは**奪わない**。

### D5: id の衝突は `prefixSvgIds` の流用で解く

- 各スライドの図に、`idPrefixFor(`s${n}`, name)`(`n` は 1 始まりの位置)のように**位置と名前**から決めた接頭辞(`s1-flow`、`s2-gap` …。`idPrefixFor('s', name)` は `s-name` を返すので、位置は第 1 引数に入れる)を付けて `prefixSvgIds(svg, prefix)` を呼ぶ。同じ名前が 2 回出ても番号で区別される。`--id-prefix auto`(内容のハッシュ)は使わない: スライドの並びを変えても同じ図が同じ id になる利点より、**位置の番号が読めること(URL ハッシュ `#3` との対応、差分の読みやすさ)**を取る。内容が同じ図の 2 回目は、位置の番号が違うので衝突しない。`<section>` の id は `sN`(図の内部の id は必ず `sN-…` になるので重ならない)。
- **新しい接頭辞処理を足さない**。ADR 0012 が「3 つの別々の処理は寄せない」とした方針を守る: `md` の `inlineSvg` / `htmlFigure` / `raster.embedSvg` には触らない。deck は `prefixSvgIds` だけを呼ぶ。
- **`<style>` のスコープ化と合流**は `prefixSvgIds` が持たない。図の `<style>` を取り除き、各規則の前に `#sN ` を付けて、ビューアの 1 つの `<style>` に合流させる(D3 の CSP)。規則の前に `#<pre> ` を付ける部分は、**`lib/markdown-target.ts` の `inlineSvg()` からそのまま取り出して** `lib/scope-style.ts`(新規)に置き、`inlineSvg` からも呼ぶ(挙動を変えず、重複を作らない)。deck はそれに加えて「`<style>` を本文から抜き、スコープ化した規則を**図の順に連結するだけ**」を行う(これは `lib/deck-html.ts`)。同じ本体の規則のセレクタを `,` でまとめる最適化は、サイズ削減のためで CSP には要らない(要るのは「ブロックが 1 つ」だけ)ので、HTML の大きさが問題になったら第 2 段で行う。`md` の出力が 1 バイトも変わらないことを、既存の `markdown-target` のテストで確かめる。
- 入力の `.svg` に、すでに `build --id-prefix` が付いていても、二重に付くだけで害はない。**`<metadata id="svg-diagram">` は deck では取り除く**。`prefixSvgIds` は ADR 0012 のとおりこの id を書き換えないが、そのまま 1 つの HTML に並べると同じ id が図の数だけ出て HTML として不正になる(id の一意性の検査が落ちる)。また `.svg` 入力ではソースのパスとハッシュが HTML の外に出てしまう。deck の出力は `check --drift` / `build --stale` / `preview` の古さの警告の対象ではない(これらは `build` が書く SVG を見る)ので、取り除いて困ることはない。入力の `.svg` ファイル自体は書き換えない。
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
- ビューアの枠(`#deck`)は `tabindex="0"` で、`:focus-visible` の輪郭を消さない。移動後は、枠にフォーカスを残す(スライドの中にフォーカスを移さない)。`<div aria-live="polite" class="sr-only">` に「3 / 8: <名前>」を入れて、移動を読み上げる。ボタンは実体の `<button>` で、`aria-label`(前のスライド / 次のスライド / 一覧)を持つ。一覧を開くとき、現在のスライドのボタンにフォーカスし、閉じるときは枠に戻す。一覧を開いている間に `inert` にするのは、**前へ・次へのボタンなど「枠の操作部品」だけ**。`#deck` と各 `<section>` は対象外(一覧のボタンは `#deck` の中の `<section>` にあるので、`#deck` を `inert` にすると押せずフォーカスも当たらない)。一覧のときだけ、各 `<svg>` に `aria-hidden="true"` を付ける(閉じたら外す)。付けないと `role="img"` + `aria-labelledby` の名前と、ボタンの `aria-label` が同じ名前を 2 回読み上げる。
- 動き(アニメーション)は**入れない**。切り替えは即時。`prefers-reduced-motion` で変える必要がない。
- 色だけに頼らない: 現在位置は「3 / 8」の文字と、一覧の現在の枠の太さ(色以外の差)で示す。

### D8: 大きい図の遅延描画 — v1 では入れない

- v1 は全スライドの SVG をインラインで置く(D3)。`hidden` の部分木は描画されないので、初期表示のコストは構文解析だけ。数十枚・数 MB まではこれで足りる見込みだが、**測っていない**。
- `--lazy`(`<template>` に入れて最初の表示の直前に複製。JS なしでは見えないので `<noscript>` と `beforeprint` の扱いが要る)は、測る前に作る機能ではないので**第 2 段**(単位 F)に回す。着手の条件は、実際の deck(`examples/` と medius-research の 8 枚、数十枚)で構文解析の時間と HTML の大きさを測り、問題が出ること。
- 後から足せるように、各スライドは `<section>` 1 つに図 1 つ、という構造を保つ(`<template>` に差し替えやすい形)。

### D9: `build --html` との役割分担

- **`build --html`**: 図 1 枚の HTML/CSS 断片(`<name>.html`)を書く。Slidev・VitePress・自分の HTML に**埋め込む**ための部品。
- **`deck`**: 複数の図を、**ビューアつきの 1 つの HTML 文書**にする。**見る・渡す**ための完成品。
- deck は `build --html` の出力を**読まない**(`renderSource` を直接呼ぶ)。したがって `build` を先に走らせる必要はなく、`svg/` の古い SVG が deck に混ざることもない。入力に `.svg` を渡したときだけ、書き出し済みのものを使う。
- `md --html` / remark / markdown-it の埋め込みは、そのまま。deck はそれらの代わりではない(文書の中の図は文書が見せる)。

## 代替案

1. **`build --deck`**。D1 のとおり、`build` の旗の意味(`--out` の入力は 1 つ、`--stale`、`--png`、lint、`--fit`)と衝突する。出力が 1 つで入力が複数の道は別。却下。
2. **`build --html` の複数入力に `--out deck.html` を許す**。「断片を 1 つに連結する」と「ビューアにする」が同じ旗で表すと区別がつかない。却下。
3. **`contact` に `--html` を足す**。`contact` は resvg に渡す 1 枚の SVG を組む道(`lib/contact.ts`)で、HTML は全く別の組み立て。入力が `.svg` だけである点も合わない。一覧の**格子の寸法の計算(`cols` と幅)**だけ、`lib/contact.ts` の考え方を参考にする。却下。
4. **各図を `<img src="data:image/svg+xml;base64,…">` で置く**。id の衝突も `<style>` の漏れも原理的に起きず、実装が最も小さい。だが、文字の検索・選択ができず、図の中の `<title>` / `aria-label` が支援技術に届かず、`img-src data:` が要る。ビューアの用途(レビューで文字を探す、スクリーンリーダー)に合わない。却下。
5. **`<object>` / `<iframe srcdoc>`**。文書が分かれるので衝突はないが、フォーカスとキーボードの扱いが分断され、サイズの計算も面倒。却下。
6. **ビューアを別パッケージ(Slidev のアドオン、`svg-diagram/render` の利用者)に任せる**。Slidev アドオンは「Slidev の中で図を見せる」道で、Slidev を持たない相手に 1 ファイルを渡す用途を満たさない。却下。

## 影響

- **既存の出力は 1 バイトも変わらない**。`build`、`md`、`contact`、`check` の挙動に触らない。変わりうるのは `inlineSvg()` の内部を共有関数に抜く部分(D5)だけで、`md` の出力のバイト一致を既存のテストで固定する。
- 新しいサブコマンドが増える(`bin/svg-diagram` の 1 行、README と `skills/svg-diagram` の一覧、ヘルプの文面)。
- deck の出力は、`<style>` と `<script>` が各 1 ブロック(図の `<style>` は合流させる)で、日時や乱数を含まない(ADR 0007): 同じ入力から同じバイト列。CI で `deck.html` の差分を見られる。
- HTML は SVG の数だけ大きくなる(SVG 形式のスライド 1 枚は数十 KB のことが多い)。数十枚で数 MB の見込み。D8 の閾値で調整する。
- ビューアの JS が新しい保守対象になる。**ブラウザなしで検査できる形**(純関数の状態遷移)に分け、DOM の薄い層は小さくする(下の実装計画)。
- スライド向きの図に `<title>` が付かない(D7)のは、deck では「basename の名前」に落ちる。品質を上げるには別の変更が要る(未決事項)。

## 実装計画

独立に進められる単位に分ける。**触るファイルの重なりは、`bin/svg-diagram` と README を最後に 1 人がまとめて触る点だけ**(単位 E)。

### A. ビューアの状態遷移(純関数)

- 触るファイル: `lib/deck-viewer/state.js`(新規。素の ES モジュール。下の単位 C と同じ資産置き場)、`test/deck-state.test.ts`(新規。`state.js` を直接 import する)
- 中身: 状態 `{index, total, grid, zoom}` と、入力(`next` / `prev` / `first` / `last` / `goto(n)` / `toggleGrid` / `toggleZoom`)から次の状態を返す関数。URL ハッシュの解釈(`#3`、`#<名前>`、`#grid`、範囲外・不正は先頭)と書き出し。キーの名前 → 入力の対応表(`Shift+Space` や、`Ctrl` 付きは無視、などの規則)。**DOM も `window` も使わない**(`test/core-purity.test.ts` を通す)。
- テスト: 端で止まる(最後で `next` は動かない / 巻き戻さない)、範囲外のハッシュ、名前のハッシュ、`goto` の丸め、`Ctrl+←` は無視、`input` にフォーカス中は無視(「入力中か」は引数で渡す)。

### B. 文書の組み立て(純関数)

- 触るファイル: `lib/deck-html.ts`(新規)、`lib/scope-style.ts`(新規。`inlineSvg` から規則のスコープ化を取り出す)、`lib/markdown-target.ts`(`inlineSvg` が共有関数を呼ぶだけに)、`test/deck-html.test.ts`(新規)、`test/markdown-target.test.ts` など既存の `inlineSvg` のテスト(**無変更で通る**)
- 中身: `buildDeck(slides: {name, svg, title?}[], opts): string`。`prefixSvgIds` の呼び出し、図の `<style>` の除去とスコープ化・合流、`<metadata>` の除去、`<section>` の骨格、`<noscript>`、`--csp` のハッシュ計算(`node:crypto`)、印刷の `@page`、`<title>` と `lang`。ビューアの CSS と JS は、単位 A / C の成果物を文字列として受ける(この単位は A / C の中身に依存しない。ダミーの文字列でテストできる)。
- テスト(**HTML の構造で確かめる。フォントや寸法の絶対値は使わない**):
  - 全スライドの全 id が文書の中で**一意**(`id="…"` を集めて重複がない)。同じ図を 2 回渡しても。
  - すべての `url(#…)` / `href="#…"` / `aria-labelledby` が、文書の中の存在する id を指す。
  - 図の中に `<style>` が残らない。文書の `<style>` は**ちょうど 1 ブロック**。その全規則のセレクタが `#sN ` で始まる(素の `text {` が残らない)。規則は図の順に並ぶ(2 つの図で規則が別々に残る)。一覧を開いても(DOM の模擬で `grid` クラスを付けても)`id="…"` の数と `<svg>` の数が変わらず、id は重複しない(一覧が SVG を複製しない)。
  - 文書に `style="` 属性がない。`<metadata` が 1 つもない。
  - 外部参照がない: `src=` / `href="http…"` / `@import` / `url(http…)` を含まない(データ URI と `#fragment` だけ)。
  - `<script>` が 1 ブロック。`--csp` の `style-src` / `script-src` のハッシュが、それぞれそのブロックの SHA-256 と一致する。
  - `<section>` の数 = 入力の数、`aria-label` に「N / M」。`hidden` が付くのは、JS が入るまでの CSS 側ではなく `no-js` の規則で全部見える(クラスと規則の存在で確かめる)。
  - 同じ入力でバイト一致(2 回呼んで同じ)。`.svg` 入力のソースのパス・ハッシュ(`<metadata>` の中身)が出力に含まれない。

### C. ビューアの DOM の層(スクリプトと CSS)

- 触るファイル: `lib/deck-viewer/viewer.js` と `lib/deck-viewer/viewer.css`(新規。**素の `.js` / `.css` の資産ファイル**。`Function#toString` で TS の関数を文字列化して埋める方式は、`tsc` 後の `dist/` で壊れやすいので採らない。`viewer.js` は `state.js` を読み込んで文書に埋める際、1 つの `<script>` にまとめる)、`lib/deck-viewer.ts`(新規。資産を `fs.readFileSync(new URL(…, import.meta.url))` で読んで返すだけ)、`package.json` の `files` と `prepack` / `tsconfig.build.json` の資産コピー、`test/deck-viewer.test.ts`(新規)
- 中身: キー入力 → A の状態 → `hidden` / `inert` / ハッシュ / `aria-live` の更新。`<button>`、一覧(`grid` クラスの付け外しと、各 `<section>` の透明なボタン)、等倍。
- テスト: **DOM の模擬(最小の `document` / `window`)**で、キーイベントを流して `hidden` の付け替え・`location.hash` の更新・`aria-live` の文字・一覧を開いたとき「各 `<section>` のボタンにフォーカスが当たり、前へ・次へのボタンは `inert`(`#deck` と `<section>` は `inert` でない)」「各 `<svg>` に `aria-hidden="true"` が付き、閉じると外れる」「一覧で `z` を押しても等倍にならない」を確かめる。実ブラウザを使う検証(キー、フォーカス、印刷)は、`playwright-chromium` が使える環境のときだけ走らせる 1 つのスモーク(`test/deck-browser.test.ts`。`lint-svg` の `--engine browser` と同じ前提で、なければ skip): 次へ → ハッシュが `#2`、`g` で一覧、`Esc` で戻る、印刷メディアでの全スライドの表示数(`page.emulateMedia({media: 'print'})` の `display` の数)。**文字や箱の絶対座標・寸法は見ない**。

### D. コマンド本体(入出力)

- 触るファイル: `deck-diagram.ts`(新規)、`test/deck-cli.test.ts`(新規。`test/cli.test.ts` と同じく子プロセスで実行)
- 中身: 引数の解釈(`--out`、`--title`、`--cols`、`--csp`、`--render`、未知の旗はエラー)、`.ts` は `renderSource`、`.svg` は読み込み、失敗の集約(1 つでも失敗なら何も書かず終了コード 1)、`closeMeasurer()`(`contact-sheet.ts` と同じ後始末)、B と C を呼んで書く。ディレクトリを作る。
- テスト: 入力 2 つ(`.ts` 1 つと `.svg` 1 つ)で `deck.html` ができ、`section` が 2 つ。検証に失敗するソースを混ぜると**終了コード 1 で、既存の `deck.html` が書き換わらない**(ADR 0013)。入力なし・未知の旗・`--cols 0` は終了コード 2 とヘルプ。壊れた XML の `.svg`。

### E. 配線とドキュメント(最後に 1 人)

- 触るファイル: `bin/svg-diagram`(`deck)` の行と冒頭のヘルプの行)、`README.md`(コマンド一覧と短い節)、`skills/svg-diagram/`(コマンドの一覧)、`package.json`(`files` に新しいファイルが含まれるか。`tsconfig.build.json` が拾うか)、`test/cli.test.ts` か `test/bin.test.ts` の、ヘルプにコマンド名が出るテスト
- 依存: A〜D が入ってから。

### F. 第 2 段(別 PR)

- `--render html`(HTML/CSS 形式のスライド。D5 の `rootId` つきの接頭辞、`style-src-attr` の CSP の扱い)。
- `--lazy`(D8)、全画面(`f`)、図ごとの名前付き `@page`。いずれも測る前・要望の前の機能なので v1 に入れない。
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
3. **`--csp` のホスト側ヘッダ**: `meta` の CSP は `frame-ancestors` などを扱えない。ホストがヘッダで CSP を持つ場合の、ハッシュの受け渡しの形(標準エラー出力 / `--csp-hashes` の別旗)。
4. **ソースの切り替え**: 1 枚のスライドに、ソースのパスと「古い(freshness)」の表示を出すか(`preview` の赤い帯の考え方)。`.svg` 入力で `freshness()` が stale を返すとき、deck に警告を出す価値はあるか。
5. **`.svg` と `.ts` の混在の順序**: 順序は引数順(ディレクトリやグロブの展開はシェルに任せる)。ディレクトリを渡す(`svg/*.svg` の自然順)入力は、第 1 段では扱わない。
6. **F2(CSS 変数のダーク追従)**: D6 の「パネルの色を図の `appearance` に合わせる」は暫定。F2 の方式が決まったときに見直す。

## 実装での補足

実装(PR #200・#201・#202・#212・#213)と、この ADR の書き方との食い違い・補足。

- **積み方**: D(#202)は B(#201)の上に積み、最小版の `viewerAssets()`(JS なし・印刷・縦並びの CSS と、空のスクリプトブロックだけ)を置いた。C(#212)が同じ署名のまま本体に差し替えた。E は配線だけ(#213。C とは独立にマージできる)で、文書(README / SKILL)はこの ADR の後続の文書 PR で追記した。
- **A(状態)**: ADR が決めていなかった仕様を置いた。別のスライドに移ると `zoom` は解除、一覧を開くと `zoom` は解除、一覧中の `toggleZoom` は何もしない(D4 の「一覧では `z` 無効」)。一覧のサムネイルの押下は `goto` とは別の入力 `select`(移動して一覧を閉じる)。`#grid` は番号を持たないので、`parseHash` は直前に見ていた 1 枚(`current`)を引数に取る。範囲外・不正なハッシュは先頭。
- **B(組み立て)**: 暗い図(`data-appearance="dark"`)の `<section>` に `slide-dark` クラスを付ける(D6 のパネル色。色の規則は C の CSS が持つ)。**`<noscript>` は出さない**(B の説明は出すと書いていたが): `no-js` クラスの CSS だけで JS なしでも全スライドが見え、`<noscript>` の中の `<style>` を足すと「`<style>` は文書にちょうど 1 ブロック」に反するため。`inlineSvg` から規則のスコープ化を `lib/scope-style.ts`(`scopeRules`)に取り出し、`lib/markdown-target.ts` はそれを呼ぶだけにした(出力は同一)。
- **スライドの名前**: 読み上げ名(`aria-label`)と一覧のボタンの名前は、図の `<title>`(文書向きの図)、なければソースの basename。`diagram({title})` を `renderSource` から直接読む手段がないので SVG の `<title>` を使う(未決事項 2 と同じ制約)。URL ハッシュの `#<名前>` と `data-name` は、`<title>` ではなく**常に basename**(`slideHashName`)。スライド向きの図には `<title>` が付かないので、読み上げ名も basename になる。
- **C(ビューア)**: 一覧を**閉じるときは、`pushState` した `#grid` を戻さず `replaceState(#N)`** にした(D4 は「戻るで一覧が閉じる」と書く。戻るボタンで同じスライドに戻る履歴が 1 つ余るだけ)。ボタンの `aria-label` は、`lang` が `ja` 以外のとき英語(Previous slide / Next slide / Overview)。ビューアの JS は `state.js` と `viewer.js` を読み、`export` と `import` の行を除いて 1 つの `<script>` に連結する(`Function#toString` は使わない)。`package.json` の `build` / `prepack` と `scripts/release.sh` は、`lib/deck-viewer/*.js`・`*.css` を `dist/lib/deck-viewer/` にコピーする(`build:assets`)。スクリプトは `style` 属性を一切設定しない(CSP のハッシュ 1 つで通る)。一覧の `inert` は前へ・次へのボタンだけ(`#deck` と `<section>` は対象外)。テストは jsdom を使わず、最小の DOM(`test/helpers/mini-dom.ts`)と、Chromium があるときだけ走るスモーク(`test/deck-browser.test.ts`。サイズ・座標は見ない)。
- **D(コマンド)**: 使い方の誤り(入力なし、未知の旗、値のない旗、`--cols` が 1 以上の整数でない、`--render` が `svg` 以外、`.ts` / `.svg` 以外)は終了コード 2 と usage。`--render html` は「まだない」と言って終了コード 2。失敗時は全部の失敗を表示して終了コード 1、何も書かず、既存の出力は触らない。前回の deck(`<main id="deck"` を持つファイル)なら「the previous X is still there, untouched」と知らせ、deck でないファイルには何も言わない。`closeMeasurer()` の後始末をし、`--out` の親ディレクトリを作る。
- **E(配線)**: `bin/svg-diagram` に `deck)` の 1 行と、冒頭のヘルプの 1 行を足した。ヘルプの切り出し(`sed -n 2,15p`)は変えていないので、行が 1 つ増えた分、これまでヘルプの末尾に出ていた `set -euo pipefail` の行が出なくなる(意図した副作用)。
- **未着手**: 第 2 段(F): `--render html`、`--lazy`(D8)、全画面(`f`)、図ごとの名前付き `@page`、reveal の段階表示(v1 は最終の段階だけ。未決事項 1)、スライド向きの図への `<title>`(D7)。未決事項 3(ホストのヘッダの CSP)・4(古さの表示)は扱っていない。
