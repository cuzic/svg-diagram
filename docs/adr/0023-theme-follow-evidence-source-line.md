# ADR 0023: ダークモードへの追従(F2)・数字の根拠の強さ(F3)・`--no-source-line`

- 状態: 提案
- 日付: 2026-10-15
- 基点: `origin/main`(ADR 0020 までと、#226 の TOC 修正を含む `4f70b45`)
- 関連: ADR 0002(`stat()`)、ADR 0008 #1(`appearance`・`transparent`)・#8(`sourceLine`)、ADR 0013(古い出力・`<metadata>` のハッシュ)、ADR 0017(文字の下限 14px)、ADR 0018(deck ビューア。F2 は「別件」とされていた)、ADR 0020(H10 取り下げ後の代替案として `--no-source-line` を将来の候補にした)
- 範囲外: PR #151(`stat` の `tone: 'accent'` で塗る。別セッションで未マージ。本 ADR の実装はそのマージ後に `lib/dsl/text-bands.ts` の `stat()` へ足す)。ワイヤーフレームの `wf.stat`。HTML 形式(`--html`)への F2 の対応

## 背景

依頼元から、いずれも優先度「低」の 3 件が届いた(原文の要旨)。

| ID | 要望 | 提案 |
|---|---|---|
| F2 | ダークモードでの追従。SVG は常に白い背景のパネルに置いた | `appearance` の自動(CSS 変数)で、埋め込み先の `prefers-color-scheme` に追従する出力。要確認: `appearance` の現状 |
| F3 | 図の中の「根拠の強さ」。数字の出典と信頼度(◎一次資料、○報道、△未確認)を、表に手書きした | `stat(value, label, {source, confidence})` と、出典が無いと警告する検査 |
| — | `--no-source-line`(H10 の代替案)。スライド用に、`sourceLine` を書き換えずに、CLI の build / preview のフラグか環境変数で出典行だけ消したい | 要望の本質は「文書用とスライド用で 1 つのソースを使い分けたい」こと |

3 件は互いに独立で、触るファイルもほぼ重ならない。それぞれ「既存の機能で足りないか」を、コードで確かめてから決める。

## 現状(コードで確かめた事実)

### F2: `appearance` と色の置換

- 型は `'light' | 'dark' | {dark: {bg, text, muted, border, code, danger, accent, soft}}`(`lib/types/core.ts:13`、検証 `lib/dsl/render.ts:34`。ADR 0008 #1 の実装)。`diagram({appearance, transparent})` は `lib/dsl/render.ts:50` で保持される。
- 色の置換は**描いたあとの文字列置換**。図は常に明るいトークンで組み、`recolor()`(`lib/tokens.ts:85`)が、`<style>` の中身と、タグの `fill / stroke / stop-color / flood-color / color / style / data-assumed-bg` 属性の `#rrggbb` だけを、明→暗の 1 対 1 の表 `DARK_OF`(`lib/tokens.ts:36`)で書き換える。呼び出しは `lib/emit.ts:104`(`recolor(svgText, laidOutDiagram.appearance)`)。ルートに `data-appearance="dark"` が付く(`lib/emit.ts:105`)。暗い側の 16 進は明るい側と重ならない(`lib/tokens.ts` の注釈)ので、置換は冪等。
- 検査は**描いた色**で行う。`paintOf(appearance)`(`lib/tokens.ts:79`)が、`lib/rules.ts:19,226,368`、`lib/verify-handlers.ts:241,270`、`lib/charts-verify.ts:19`、`lib/layout-handlers.ts:491`、`lib/wordart-look.ts:109` に渡される。透明な図は、背景を `pageColorOf(appearance)`(`lib/tokens.ts:81`)の色と仮定して検査される(`data-assumed-bg`)。
- `prefers-color-scheme` を使っているのは、ビューアの枠の CSS だけ(`lib/deck-viewer/viewer.css:4`)。**図の SVG は固定の 16 進で、CSS 変数も `prefers-color-scheme` も使わない**(ADR 0018:35、同 :118 は「F2 が実現したら deck は 1 行で切り替えられる」と書いている)。deck は `data-appearance="dark"` の図にだけ `slide-dark` を付ける(`lib/deck-html.ts:80`)。
- SVG に `style="…"` 属性は無い(ADR 0018 の調査)。色は `fill` / `stroke` などの属性で、`<style>` には `text { font-family }` / `.mono` / `.emoji` の 3 規則だけ(`lib/emit.ts:72-75`)。
- `<style>` を図に閉じ込める `scopeRules()`(`lib/scope-style.ts:5`)は、`(^|\})\s*([^{}@]+)\{` で「`}` の直後のセレクタ」だけを書き換える。**`@media (…) { sel { … } }` の内側の規則は、`{` の直後にあるので書き換えられず、文書全体に漏れる**。`deck-html.ts:79` と `markdown-target.ts:65` が使う。
- CLI の `--dark` / `--transparent` は、描く前に図へ上書きする(`build-diagram.ts:134-135`)。`--stale` はこの 2 つがあるとき無視される(`:122`)。README(:957)にも書いてある。

結論: 「ダークにする」機構は既にあるが、**図 1 枚が 1 つの配色に固定される**。埋め込み先が明暗を切り替える場合、図ごとに `--dark` 版と明るい版の 2 枚を作って `<picture>` などで出し分けるしかなく、1 つのソースから 1 枚の SVG で追従する方法は無い。`appearance` の既存値では足りない。

### F3: `stat()` と出典

- `stat(value, label, opts)` は 2 行の箱を返す薄いヘルパー(`lib/dsl/text-bands.ts:58-72`)。1 行目が値(role `stat` か `display`、太字、`tone` の色)、2 行目が `label`(`tone: 'muted'`)。`StatOpts` は `id flex width col span reveal until tone size` だけ(`lib/types/text-bands.ts:120`)。値は折り返さない(`statValue`、`verify-handlers.ts:205`)。`hero()` は `stat` の `{value, label, ...opts}` をそのまま `stat()` に渡す(`lib/hero.ts:47-48`)ので、`stat` にオプションを足せば `hero` でも使える。
- ADR 0002 の方針: `stat` は箱の `tone` を使わず(凡例 `usedNotation` が増えるため)、数字の色だけを変える。色だけで意味を持たせない、という同じ考え方を F3 にも使う。
- **既存機能でも「見せる」ことはできる**。`label` に `'件数(出典: 総務省 2025 ◎)'` と書く、または `stat` の下に `caption(..., {role: 'note'})` を置く。足りないのは (1) 構造化されたデータとして持てない(文字列の中)、(2) 書式がばらつく、(3) **出典が無い数字を見つける検査が無い**、の 3 点。`diagram({sourceLine})`(`lib/layout-util.ts:184-188`)は図に 1 行だけの固定位置の出典で、数字ごとの出典ではない。
- 検査の重大度の仕組み: `diagram({layoutCheck})` と `tocCheck` が `'info' | 'strict'` で、**書かなければ検査自体を出さない**(`lib/dsl/render.ts:39-40,71-72`、`lib/toc-rules.ts`)。規則の説明は `RULE_DOCS`(`lib/rules.ts:68-81` に `toc-*` が並ぶ)。

### `--no-source-line`: `sourceLine` と CLI

- `sourceLine` は `diagram({sourceLine})`(`lib/dsl/render.ts:37,70`)。レイアウトが、常に**最後の band**(左寄せ、note、muted)として末尾に足す(`lib/layout-util.ts:184-188`)。1 行に収まらなければ `source-wraps`(`lib/rules.ts:658`)。出典行は spotlight の対象外(`lib/spotlight.ts:104`)。つまり出典行は**図の高さを持つ**(消すと図が低くなり、`fill` / スライドの予算の計算も変わる)。
- `build`(`build-diagram.ts`)だけが、ソースを読んで描く。`build-diagram.ts:134-135` に、描く前に `d.appearance` / `d.transparent` を上書きする前例がある(`--dark` / `--transparent`)。`d.sourceLine = undefined` も同じ形で書ける。
- `preview`(`preview-svg.ts:41`)と `show`(`show-diagram.ts:103`)は、**できあがった SVG を読む**だけで、ソースを描き直さない。出典行はすでに SVG に焼かれているので、`preview` / `show` にフラグを足しても、消せるのは「描く前」ではなく「描いたあと」だけになる。
- `deck`(`deck-diagram.ts:50`)は、`.ts` の入力を `renderSource(file, {fresh: false})` で描き、`.svg` の入力はそのまま読む。`renderSource`(`lib/render-source.ts:27-37,54`)は `{budget, fresh, html, configFrom}` の 4 つのオプション。`md`(`lib/markdown.ts:77`)・remark(`lib/remark.ts:47`)も同じ入口を使う。
- `<metadata id="svg-diagram">` のハッシュは、**出力ではなく入力のハッシュ**。`DiagramSource` は `toolVersion / source / sourceSha256 / configSha256 / depsSha256 / reveal`(`lib/types/core.ts:197-208`)で、`build-diagram.ts:133` が詰める。`sourceSha256` はソースファイルのバイト列のハッシュなので、描き方のオプションは入らない。
  - `check --drift` は `sourceSha256` と `depsSha256` だけを比べる(`check-diagram.ts:262-263`)。`--rebuild` は、**フラグ無しの素の `build` で作り直して、バイト列を比べる**(`:264-300`)。
  - `build --stale` は、`sourceSha256`・`toolVersion`・`configSha256`・`depsSha256` を比べて、一致すればスキップする(`build-diagram.ts:122-126`)。
- 環境変数の前例は `SVG_DIAGRAM_MEASURE`(測り方)、`SVG_DIAGRAM_STRICT_WIDTH`、`SVG_DIAGRAM_ICONIFY_API`(`lib/measure.ts:109`、`lib/layout-measured.ts:12`、`lib/icon-find.ts:41`)で、**図の中身(出力のバイト列)を変えるものは無い**(測り方は変えうるが、環境の違いの吸収が目的)。

## 論点

1. F2: 追従をどの仕組み(CSS 変数か、媒体クエリで色を上書きするか)で作るか。検査は静的に両方の配色を見られるか。既存の図は 1 バイトも変えない。
2. F3: 型、表示(記号か語か)、アクセシビリティ、警告の重大度。
3. `--no-source-line`: フラグ名、環境変数の要否、`build` / `preview` / `show` / `deck` の関係、ハッシュ(drift / stale)への影響、後処理か描画前か。

## 決定

### F2. `appearance: 'auto'`(opt-in)

**D1. 値を足す。** `appearance` に `'auto'` と `{auto: {bg, text, muted, border, code, danger, accent, soft}}` を足す(後者は `{dark: {…}}` と同じ検証・同じ意味で、「暗いときの色」を差し替える)。書かなければ、今までと同じ(`undefined` / `'light'` / `'dark'` / `{dark}` の出力は 1 バイトも変わらない)。

**D2. 仕組みは「CSS 変数」ではなく、媒体クエリで属性の色を上書きする。** 図は今までどおり**明るいトークンで描く**(`mapOf('auto')` は `null` を返し、`recolor()` は何もしない)。そのうえで `<style>` に 1 ブロックを足す。

```css
@media (prefers-color-scheme: dark) {
  [fill="#ffffff" i] { fill: #1b1a17 } [stroke="#…" i] { stroke: #… } …
}
```

- 規則は、**その図が実際に使っている明るい色だけ**を、`DARK_OF`(`{auto}` ならそのカスタム版。タイルの `tones` の `dark` 対も `mapOf` が持っている)で変換して並べる。`fill` / `stroke` / `stop-color` / `flood-color` / `color` の 5 属性。色の並びは昇順に固定し、同じ図は同じバイト列になる。
- 理由(CSS 変数にしない): (1) 変数にすると、`fill="var(--sd-text)"` のように本文の属性を全部書き換えることになり、`auto` を使わない図との差が大きくなり、`lint-svg` の色の読み取り(`lint-svg.ts:146-152`)と衝突する。(2) 属性値の `var()` は、サポートが描画系(resvg、各種ビューア、Inkscape)で揺れる。属性セレクタの CSS 規則は、属性(詳細度 0)に勝ち、読めない環境では**明るい図に戻るだけ**で壊れない。(3) 明→暗は 1 対 1 で、暗い側の 16 進は明るい側と重ならない(`tokens.ts` の注釈)ので、セレクタが曖昧にならない。
- ルートの `data-appearance` は `"auto"`。`deck-html.ts:80` の正規表現(`"dark"` だけ)には掛からないので、deck の `slide-dark`(枠を暗くする)は付かない。枠の追従はビューアの CSS(`viewer.css:4`)のまま。
- 背景の矩形(`transparent` でないとき)は `fill` 属性を持つので、同じ規則で暗くなる。`transparent: true` なら矩形が無いので、埋め込み先の色に重なる。依頼元の「常に白いパネルに置いた」は、`appearance: 'auto'`(矩形あり)にすれば、パネル自体が暗くなって不要になる。
- `<img src>` に使うと、図の中の `prefers-color-scheme` は、**ブラウザ/OS の設定**で決まる(ページの `class="dark"` などの切り替えには反応しない)。Slidev addon(`<img>`)で使うときの注意として、利用者向けの文書に書く。

**D3. `scopeRules()` を `@media` に対応させる(F2 の前提)。** `lib/scope-style.ts` が `@media … { … }` の内側の規則にも `#<id> ` を付けないと、deck / md に貼ったとき、規則が他の図と文書へ漏れる。`@media` ブロックを再帰的に処理する。この修正は、F2 を使わない図には影響しない(`@media` を含まない CSS は同じ結果)。

**D4. 検査は、静的に両方の配色で行う。** 色は 1 対 1 の表で決まるので、描く前に両方を見られる。

- `verifyDiagram` と `lintRules`(`lib/verify.ts`、`lib/rules.ts` の入口)で、`appearance` が `auto` のとき、**図のコピーを `appearance: 'light'` と `'dark'`(`{auto}` なら対応する `{dark}`)で 2 回検査**し、結果を結合する。`paintOf` を使う 7 か所(上の事実)を直さずに済む。色に依存する指摘だけが違うので、メッセージが同一のものは 1 つにまとめ、暗い側にだけ出たものには `(暗い配色)` を付ける。
- `transparent: true` かつ `auto`: 背景の色が分からないので、明るい側は `PALETTE.bg`、暗い側は `DARK_PALETTE.bg`(カスタムならその `bg`)の**両方**を仮定して検査する(上の 2 回の検査が、そのまま `pageColorOf` の違いになる)。
- `lint-svg`(描画後): `data-appearance="auto"` なら、許す色を明暗両方のトークン(`ALLOWED_COLORS` と `DARK_COLORS`、`data-palette`)にし、ブラウザを `colorScheme: 'light'` と `'dark'` の 2 回で描いて検査する(Playwright の `emulateMedia`)。
- コントラストの全組み合わせは、`test/dark-theme.test.ts` が全テーマで見ている(既存)。

**D5. HTML 形式(`--html`、`emit-html.ts`)は対応しない。** `auto` と `html: true` の組み合わせは、`diagram` の検証ではなく `build` で「`appearance: 'auto'` は SVG だけ」と throw する(黙って明るい図を出さない)。理由: HTML 形式の色は `style="…"` 属性 13 か所と `<style>` で、属性セレクタの上書きは `style` に負ける。要望も SVG。

**D6. CLI。** `--dark`(`build-diagram.ts:134`)は、`typeof d.appearance !== 'object'` のとき `'dark'` に上書きするので、`'auto'` も `'dark'` に上書きされる(明示のフラグが勝つ)。`{auto: {…}}` は、`{dark}` と同様に残す。`--auto` のフラグは作らない(図が自分で宣言する)。

**やらないこと。** `prefers-color-scheme` 以外(`class="dark"` など)への追従。`preview` / `show` / PNG への暗い配色(ラスタライザは媒体クエリを評価しない可能性があり、**明るい側で描かれる**。実装時に resvg で確かめて README に書く)。

### F3. `stat(value, label, {source, confidence})`

**D7. 型。**

```ts
stat('76%', '導入前の離脱率', {source: '総務省 通信利用動向調査 2025', confidence: 'primary'})
// confidence: 'primary' | 'secondary' | 'unverified'
```

- `source?: string`(1 行、`RichText` ではなく素の文字列。`sourceLine` と同じく改行を許さない)、`confidence?: 'primary' | 'secondary' | 'unverified'`。**`confidence` だけで `source` が無いときは throw**(根拠の強さだけ書いて出典が無いのは、F3 が防ぎたい状態そのもの)。`unverified` でも `source` は要る(「どこで聞いたか」を書く。書けないなら数字を載せない、という運用を促す)。
- `hero({stat: {…}})` は `stat()` に素通しするので、そのまま使える(`lib/hero.ts:47`)。

**D8. 表示は「記号 + 語」で、色にしない。**

| `confidence` | 表示 |
|---|---|
| `primary` | `◎ 一次資料` |
| `secondary` | `○ 報道・二次資料` |
| `unverified` | `△ 未確認` |

- 箱の**3 行目**として、`出典: <source>  <記号 語>` を、role `note`(14px、ADR 0017 の下限)・muted・中央揃えで足す。`source` も `confidence` も無い `stat` は、行が増えない(**既存の図は 1 バイトも変わらない**)。
- 記号だけでは読み上げ(「二重丸」「丸」「三角」)と、白黒印刷・色覚の違いで意味が伝わらないので、**語を必ず併記**する。色は使わない(ADR 0002 の「箱の tone で意味を持たせない」、既存の「色だけで意味を持たせない」検査と同じ立場)。語は `label` 側の自由記述にせず、3 値で固定する(表記ゆれを防ぐ)。ラベルの差し替えは作らない。
- 出典が長いと箱の中で折り返す(`stat` の 3 行目は折り返してよい。数字の 1 行目だけ折り返さない既存の規則は変えない)。長い出典は本文へ、と README に書く(`source-wraps` と同じ方針だが、箱の内側なので警告は出さない)。

**D9. 内部の持ち方。** 箱の band に `evidence?: {source: string; confidence?: …}`(`statValue` の隣、内部用)を持たせ、表示の 3 行目は `stat()` が `lines` に足す。検査(D10)は `evidence` の有無を、`statValue` を持つ箱について見る。

**D10. 検査 `stat-no-source`(既定は出ない。opt-in)。** `diagram({evidenceCheck: 'info' | 'strict'})` を足す(`layoutCheck` / `tocCheck` と同じ形。**書かなければ検査自体が無い**)。書いたとき、`source` の無い `stat`(`statValue` を持つ箱で `evidence` が無い)ごとに、`info`(`'strict'` なら `warn`)で「数字 `76%` に出典がない(`source` を足す)」を出す。`RULE_DOCS` に 1 行足す(`lib/rules.ts`、`accept` で個別に許せる)。プロジェクト全体の既定は、`.svg-diagram.json` の `evidenceCheck` に後から足せる(本 ADR の範囲外。未決事項)。

**やらないこと。** `confidence: 'unverified'` の `stat` を `strict` で警告にする規則(表示で「△ 未確認」と見えているので十分)。`bars()` / `people()` / `chart` など、`stat` 以外の数字への出典。数字を文章中から拾う検査(誤検知が多い)。`wf.stat`。

### `--no-source-line`

**D11. 描く前のオプションにする(後処理にしない)。** `build-diagram.ts` で、`--dark` / `--transparent` と同じ位置に `if (NO_SOURCE_LINE) d.sourceLine = undefined` を足す(`:134-135` の隣)。出典行は図の最後の band で**高さを持つ**ので、描いたあとの SVG から行だけ消すと、空白(`pad` と行の高さ)が残り、`fill` / スライドの予算もずれる。描く前に消せば、**出力は、ソースに `sourceLine` を書かなかったときの SVG と同じバイト列**になる(テストの不変条件にする)。

**D12. 名前と範囲。**

- フラグ: `svg-diagram build x.ts --no-source-line`。`--no-lint` / `--no-stale-banner` と同じ `--no-*` の形。`sourceLine` が無い図では何も起きない(エラーにしない)。
- `deck`: 同じ名前で受け、`.ts` の入力にだけ効かせる(`renderSource` に渡す)。`.svg` の入力は焼かれているので効かない。`.svg` を 1 つでも含み、このフラグがあるときは `⚠ <file>: .svg の出典行は消えない(.ts から描き直す)` と警告する。
- `renderSource`(`lib/render-source.ts`)に `noSourceLine?: boolean` を足す(Slidev addon、Vite、md の呼び出し側が使う。`md` の既定は変えない)。
- **`preview` / `show` にはフラグを作らない**。これらは SVG を読むだけで、描き直さない(上の事実)。出典行を消した図を見たいなら、`build --no-source-line --out-dir <別の場所>` の SVG を `preview` / `show` に渡す。ここが「後処理で消す案」を採らない理由とも一致する。
- **環境変数は作らない。** 出力のバイト列を変える環境変数は、同じコマンドが環境で違う SVG を作ることになり、`check --drift --rebuild` の誤報と、CI とローカルの食い違いを生む。既存の環境変数は図の中身を変えない(上の事実)。要望の「フラグか環境変数」のうち、フラグだけにする。

**D13. ハッシュ(drift / stale)との関係。** `<metadata>` のハッシュは入力のハッシュなので、ソースが同じなら `sourceSha256` は変わらない。しかしそのままだと、(a) `check --drift --rebuild` は、フラグ無しの素の `build` で作り直して比べるので、**フラグ付きで作った SVG を「再生成と一致しない」と誤って報告する**。(b) `build --stale` は、フラグの有無が違っても「最新」と判断してスキップする(文書用の SVG を、スライド用のフラグで上書きしないときは問題ないが、同じ出力先で切り替えると古いまま残る)。対処:

- フラグを使ったときだけ、`DiagramSource` に `noSourceLine: true` を足す(`<metadata>` の JSON に 1 項目。**使わないときはキーを書かない**ので、既存の SVG と `<metadata>` は 1 バイトも変わらない)。
- `check --drift --rebuild`(`check-diagram.ts:264-270`)は、`meta.noSourceLine` があれば `d.sourceLine = undefined` にして作り直す。ハッシュの比較(`:262-263`)は変えない。
- `build --stale`(`build-diagram.ts:122-126`)は、`!!meta.noSourceLine === NO_SOURCE_LINE` も一致の条件に足す。`--dark` / `--transparent` のように「`--stale` を無視」にはしない(1 つの出力先で繰り返し同じフラグで作るのが、このフラグの使い方なので)。
- `lib/freshness.ts` の `fresh/stale` 判定(`preview` / `show` の古さの警告)は、ソースとインポートのハッシュだけなので変えない。

### やらない判断の推奨

- F2 の CSS 変数方式(上記 D2 で却下)、F2 の HTML 形式、F3 の `unverified` の警告化、`--no-source-line` の環境変数・`preview` / `show` のフラグは、上に書いたとおり**作らない**。
- 3 件の中で、費用に対する効きが最も小さいのは F3(既存機能でも「見せる」ことは書ける。足りないのは検査)。F2 は `scopeRules` の修正を含み、検査が両配色になるため最も大きいが、依頼元の「白いパネル」を外せる。`--no-source-line` は小さく、文書用とスライド用の 1 ソース化に直接効く。実装の順は、`--no-source-line` → F2 → F3 を勧める。F3 は、PR #151(`stat`)のマージ後。

## 代替案

| 案 | 採らない理由 |
|---|---|
| F2: `fill="var(--sd-text, #…)"` と、`:root` の変数を `@media` で差し替える | 本文の属性を全部変える。描画系の対応が揺れる。`lint-svg` の色の読み取りと衝突する。既存の図との差が大きい |
| F2: `<picture><source media="(prefers-color-scheme: dark)">` で、2 枚の SVG を出し分ける | 既存の `--dark` で今でもできる。要望は 1 枚で追従すること。出し分けは SVG の外(HTML / Markdown)の話で、`md` の出力形式を変える |
| F2: `appearance: 'auto'` を、暗い色で描いて明るい側を CSS で上書きする | 図の「素の色」が暗くなり、CSS を読めない環境(resvg、メール、PNG)で暗い図になる。明るい側を素にするほうが退行が小さい |
| F3: `confidence` を ◎○△ の文字そのものにする(`'◎'`) | 型が記号になり、語と読み上げが揃わない。3 値の名前 + 固定の表示で、表記ゆれを防ぐ |
| F3: 出典を `label` に書く運用のまま(検査だけ足す) | 検査が「`label` に `出典` の語があるか」の文字列探しになり、誤検知する |
| F3: `source` を必須にする | 既存の全図が壊れる。opt-in の検査(`evidenceCheck`)で足りる |
| `--no-source-line`: 描いたあとに、SVG の最後の `<text>` を消す | 行の高さが残る、予算とずれる、`<metadata>` に何も残らず drift で追えない |
| `--no-source-line`: `preview` / `show` のフラグ | それらはソースを描かない(描画済みの SVG を読む) |
| `--no-source-line`: 環境変数 `SVG_DIAGRAM_NO_SOURCE_LINE` | 出力のバイト列が環境で変わる。drift の誤報。D12 |
| `sourceLine` を `diagram({sourceLine: {doc: '…', slide: false}})` のように媒体別にする | 依頼元が出した「ソースを書き換えない」に反する。H10 の代替という経緯に合わない |

## 影響

- 既存の図: F2・F3・`--no-source-line` は、いずれも書かなければ、**SVG も `<metadata>` も 1 バイトも変わらない**。`scopeRules` の `@media` 対応(D3)も、`@media` を含まない CSS に対しては同じ出力。
- 新しい公開面: `appearance: 'auto' | {auto}`、`stat` の `source` / `confidence`、`diagram({evidenceCheck})`、`build` / `deck` の `--no-source-line`、`renderSource` の `noSourceLine`、`DiagramSource.noSourceLine`。
- 利用者への注意: `auto` の図を `<img>` で使うと、追従はページではなく OS/ブラウザの設定に従う。`preview` / `show` / PNG は明るい側。
- 検査の実行時間: `auto` の図だけ、検査が 2 倍(幾何の検査なので、描画は 1 回)。`lint-svg` は、`auto` の図だけ 2 回描く。

## 実装計画(並列エージェントへの分担)

5 つの単位。U1→U2、U3→U4 は順番、**F2(U1・U2)、F3(U3・U4)、`--no-source-line`(U5)の 3 系統は独立**。共通のテストの方針: **フォント依存の絶対値(幅・高さ・x/y)を使わない**。見るのは、(a) 文字列の有無、(b) 2 つの出力の**同一性・差**(「フラグ有りの SVG が、ソースに `sourceLine` を書かない SVG と一致する」など)、(c) 色の計算値(`tokens.ts` の表から導いた期待値)、(d) 高さの大小比較(「出典行が無いほうが低い」。値は書かない)。モックのフォントで測る既存のテストの流儀(`test/timeline-source.test.ts:10` の `laid`)に合わせる。

| 単位 | 内容 | 触るファイル | テスト |
|---|---|---|---|
| U1(F2 の中核) | `auto` / `{auto}` の型・検証・`mapOf` の分離(描画は明るい、暗い表は別関数)、`emit.ts` の `@media` ブロックとルートの `data-appearance="auto"`、`scopeRules` の `@media` 対応、`build` で `html` と併用したら throw | `lib/types/core.ts:13`、`lib/tokens.ts`、`lib/dsl/render.ts:34`、`lib/emit.ts:72-106`、`lib/scope-style.ts`、`build-diagram.ts`(throw)、README | 新規 `test/appearance-auto.test.ts`: (1) `auto` の SVG から `@media` ブロックと属性を取り除くと、`'light'` の SVG と一致する、(2) ブロックの規則が、本文に出る色の集合と `DARK_OF` から期待どおり(色の数・昇順・`i` フラグ)、(3) `undefined` / `'light'` / `'dark'` / `{dark}` の出力が変わらない(既存の `dark-theme.test.ts` が通る)、(4) `scopeRules` が `@media` の内側に `#id ` を付ける、deck・`inlineSvg` に貼った出力で他の図に漏れない |
| U2(F2 の検査) | `auto` のとき、`verifyDiagram` と `lintRules` を明暗の 2 回行い結合(同一メッセージは 1 つ、暗い側のみは `(暗い配色)`)、`transparent` は両方の背景を仮定、`lint-svg` の許す色と `colorScheme` 2 回、`--dark` の上書き | `lib/verify.ts`、`lib/rules.ts`(入口のみ)、`lint-svg.ts:146-152,226`、`build-diagram.ts:134` | `test/appearance-auto.test.ts` に追加: 暗い側だけコントラストが足りない設定(`{auto: {text: '#333333'}}` など)で、暗い側の指摘が出る(比率の数字は `wcagRatio` で計算して比べる)。明るい側だけ足りない `tones` で明るい側が出る。`transparent` で両方の背景が使われる。`lint-svg` は、`auto` の SVG を通し、暗い側の許可色を使っても落ちない |
| U3(F3 の表示) | `stat` の `source` / `confidence`、`evidence` の保持、3 行目の追加、`confidence` のみで throw、型 | `lib/dsl/text-bands.ts:58-72`、`lib/types/text-bands.ts:120`、`lib/hero.ts`(通すだけ)、README、`skills/` の該当記述。**PR #151 のマージ後に着手**(同じ `stat()` を触る) | `test/stat-bars.test.ts` に追加: 3 行目の文字列が `出典: …` と `◎ 一次資料` などを含む。`source` なしの `stat` の band が今までと同じ(`lines` の長さ 2)。`confidence` のみは throw。`hero` に通る。SVG の本文が読み上げの語(`一次資料`)を含む |
| U4(F3 の検査) | `diagram({evidenceCheck})`、規則 `stat-no-source`、`RULE_DOCS`、`accept` 対応 | `lib/dsl/render.ts`、`lib/types/core.ts`(`DiagramOpts` / `DiagramData`)、`lib/rules.ts`(`RULE_DOCS` と規則)、`check-diagram.ts`(規則一覧に出る) | `test/rules.test.ts` に追加: `evidenceCheck` 無しなら出ない、`'info'` で `info`、`'strict'` で `warn`、`source` のある `stat` は出ない、`accept` で消せる。メッセージは数字を含む(座標は含めない) |
| U5(`--no-source-line`) | `build` のフラグと `--stale` の比較、`DiagramSource.noSourceLine`、`check --drift --rebuild` の対応、`deck` のフラグと警告、`renderSource({noSourceLine})` | `build-diagram.ts:73-79,122-135`、`lib/types/core.ts:198-208`、`check-diagram.ts:264-270`、`deck-diagram.ts:21-50`、`lib/render-source.ts:25-52`、README(:957 付近) | 新規 `test/no-source-line.test.ts`: (1) フラグ有りの SVG が、ソースから `sourceLine` を除いた SVG と**同一**(`<metadata>` の `noSourceLine` を除く)、(2) フラグ無しの出力は変わらない、(3) 高さがフラグ有りのほうが低い(比較だけ)、(4) `check --drift --rebuild` が、フラグ付きの SVG を「一致」と判定し、フラグ無しで作り直した場合は不一致、(5) `--stale` が、フラグの有無が違えば再生成し、同じなら飛ばす、(6) `renderSource({noSourceLine: true})` の SVG に出典の文字列が無い、(7) `sourceLine` の無い図では何も変わらない |

U1 と U2 は `lib/tokens.ts` と `build-diagram.ts` で、U3〜U4 は `lib/types/*.ts` で、U5 は `build-diagram.ts` で触れ合う。**別の worktree で作り、`build-diagram.ts` と `lib/types/core.ts` は行が別れているので、マージ時の衝突は機械的に直せる**。実装後は、Opus レビュー(コード)を 1 巡通す(ADR 0020 に倣う)。

## 未決事項

- F2: `{auto: {…}}` の形を最初から入れるか、`'auto'` だけで始めるか(依頼元の色の希望を聞く。ADR 0008 #1 は `{dark: {…}}` を要望から足した)。
- F2: Slidev addon が `<img>` で図を出す場合、Slidev の暗い切り替え(`html.dark`)に追従させたいなら、addon 側で `<object>` かインラインにする必要がある(`prefers-color-scheme` ではなく、クラスで切り替えるため)。F2 の範囲外にしたが、deck 側の希望を聞く。
- F2: resvg(`lib/raster.ts`)が `@media (prefers-color-scheme)` を評価するかを、U1 で確かめる。評価しないなら、PNG は明るい側で、それを README に書く。
- F3: プロジェクト全体の既定(`.svg-diagram.json` の `evidenceCheck`)を足すか。依頼元の文書では全図に掛けたいはず。
- F3: ラベルの文言(「報道・二次資料」)は依頼元の表(◎一次資料、○報道、△未確認)に合わせたが、差し替えを許すか。
- `--no-source-line`: 同じ要望が「見出しのキャプション」にも広がるか(H10 は図に題名が描かれない前提の誤りだった)。広がるなら、フラグを一般化せず、別の ADR にする。
