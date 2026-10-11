# ADR 0003: 箱の文字の一部だけを太字・色にする(部分強調)

- 状態: 提案(改訂 3。Opus レビュー 2 回分を反映。実装前)
- 日付: 2026-10-11
- 基点: 0.5.0 + ADR 0002 の実装(`main` = 0d59ae1 以降)
- 関連: ADR 0002 の「部分強調」(別 ADR が先と決めた項目)
- 注: `lib/budget.ts` と `lib/verify.ts` のコメントが「ADR 0003 / `docs/adr/0003-text-budget-warning.md`」を指している(リポには無い、元のデッキ由来)。実装 PR でそのコメントを直す(別物を指しているため)。

## 背景

「Claude in Chrome」のように、箱の文章の中の一部だけを太字・色にしたい場面がある。今は 1 つの run が 1 つの太さ・1 つの色しか持てないので、run を別の行に分けるか、強調をあきらめている。

## 既存コードで確認した事実

- 文字は `TextRun`(`text, size, weight, mono, tone, indent, nowrap`、`types.ts`)で、**run ごとに太さ 1 つ・色 1 つ**。`textRuns()`(`layout.ts:49`)が title / body / lines / note から作り、swimlane の手順も `placeBoxLike`(`layout.ts:420`)を通るので範囲内。
- 測定は atom 単位。`splitAtoms`(`measure.ts:40`)は CJK を 1 文字ずつ、**Latin・数字・記号・絵文字の連なりを 1 atom** にする。`wrapAtoms`(`wrap.ts`)は空白でない atom の境目をすべて改行可能とみなし、行頭の空白・改行 atom を捨て、行末の開き括弧を次行へ移し、`trimEnd` して **`string[]`** を返す(行は平文の連続した切片にならない)。
- `registerRequests`(`layout.ts:96`)が `(atom, size, weight, font)` を集め、`layoutBoxContent`(`layout.ts:110`)が `widthOf` を引く。**未登録の atom は幅 0 で例外も警告もない**(`layout.ts:243`)。`verify.ts` は「構造上はみ出しは起きない」前提で見ない。
- 描画は `renderTextRuns`(`emit.ts:59`)で 1 行 = 1 つの `<text font-weight fill>`、中身は `emojiSpan(line)`(`<tspan class="emoji">`)。
- **描画後の検査のうち、幅だけが tspan に対応している。** `textBoxOf`(`svg-geom.ts:192`)は tspan ごとに `fontWeight` で測る(`test/svg-geom.test.ts:208`)。**コントラストは対応していない**: `svg-lint.ts:76` は `<text>` 要素の色だけ、`lint-browser.ts:39,51` も `querySelectorAll('text')` の `fill` だけを見る(`computeStyles` は tspan の fill を解決するが、結果はどこからも読まれない)。したがって色付き tspan は、そのままでは**無検査**で出る。
- band に残る生の文字列を読む箇所がある: `budget.ts:39`(`r.text !== box.title`)、`layout.ts:64`(`band.statValue === line.text`)、`rules.ts:341-366` の `diagramTitle` / `diagramDesc`(SVG の `<title>` / `<desc>`、swimlane の手順名)、`verify.ts:43` の `labelOf`。`fit.ts` は run の `text` を使わない(`r.size` だけ)。
- 図の入口は `.ts` のみ(`load-source.ts`)。

## 決定案

### 1. 文字列記法は採らず、型付きの部品で書く

```ts
import {b, danger} from 'svg-diagram';
box({title: 'ブラウザ操作', body: ['許可は ', danger(b('ユーザー')), ' が決める']})
box({body: ['**API** と書いても ', 'これはただの文字']})   // 配列の中の string は常にそのままの文字
```

- 型 `RichText = string | readonly RichPart[]`、`RichPart = string | Styled`。`Styled` は **unique symbol のブランド**を持つ(`{readonly [RICH]: true; …}`)ので、`BoxLine` のオブジェクト(`{text, bold?, tone?}`、`types.ts:211`)と構造的に重ならない。`b(x)`(太字)、`accent(x)` / `danger(x)` / `muted(x)` / `text(x)`(色)。入れ子は `danger(b('..'))` / `b(danger('..'))` を許す(どちらも「太字 + 色」)。引数は `string | Styled`。
- **`lines` の要素は `string | {text: RichText; …}` に限る**。`Styled` 単体や `RichPart[]` を `lines` の要素に置くと型エラー(置けると、`lines: ['許可は ', danger('ユーザー'), ' が決める']` が型を通って 3 行の別の line になる)。強調入りの 1 行は `lines: [{text: ['許可は ', danger('ユーザー'), ' が決める']}]` と書く。
- **既存の `string` はどのフィールドでも構造的に不変**(記法の解析をしないので、`{frame: false}` や `lib/**/*.ts`、JSON 例が影響を受けない)。エスケープ記法も要らない。
- 範囲内のフィールドだけ型を `string` → `RichText` に広げる: `box` の `title` / `body` / `note` / `lines[].text`、`banner` の `headline` / `sub`、`caption` の `text`、`group` の `title`、`stat` のラベル、swimlane の手順の同名フィールド。**範囲外(tag / stamp / legend / connect のラベル / lane label / 表のセル / ワイヤーフレーム)は型が `string` のまま**なので、`b()` を渡すと型エラーになる(黙って文字になることがない)。
- `rich` タグ付きテンプレート(`rich\`許可は ${danger(b('ユーザー'))} が決める\``)は、配列形の糖衣として足してよいが、本 ADR の必須ではない。

### 2. 入力の型と band の型を分け、解析は DSL 関数 1 か所

**型の分割**: 今は `BoxBand extends BoxOpts`、`BannerBand extends BannerOpts`、`SwimlaneStepBand extends SwimlaneStep`(`types.ts:254,272,700,728`)なので、入力を `RichText` に広げると band の型も広がり、「band には平文だけ」が型で守られない(`add()` は `Band` を直接受けるので、正規化を素通りした `RichText` が layout まで届く)。そこで:

1. **入力の型だけ**(`BoxOpts` / `BannerOpts` / `SwimlaneStep` / `GroupOpts` / `caption` の第 1 引数 / stat のラベル)を `RichText` にし、**Band の型は `Omit<…Opts, 'title' | 'body' | 'note' | 'lines' | …> & {title?: string; …}` で平文のまま**にする(`extends` の鎖を切る)。`strict.ts` の `SwimlaneStepIn` / `StepCheck` の `UnknownKeys<S[K], SwimlaneStep>`(`strict.ts:204,225`)は入力側の型を見るので、それを保つ。
2. **spans の置き場所**は band の内部用の 1 フィールド `spans?: {title?: Span[]; body?: Span[]; note?: Span[]; headline?: Span[]; sub?: Span[]; text?: Span[]}` と `lines[i].spans`。フィールドごとに散らさない。`groupTitleBand`(`layout.ts:92`)は GroupBand から CaptionBand を作り直すので、そこで `spans.title` → `spans.text` を引き継ぐ(書かないと group title の強調が消える)。
3. 受け入れ条件(`test/types/`): Band 型の `title` は `string`、`add({type: 'box', title: [b('x')]})` は型エラー、`lines: ['a', danger('b')]` は型エラー。

**解析の場所**:

`RichText` は **DSL 関数(box / banner / caption / group / stat / swimlane の手順)の中で、平文 + spans に正規化**し、band には**平文(`string`)と `spans`** だけを持たせる。生の `RichText` は band に残さない。これで `budget.ts` / `rules.ts` の `diagramTitle` / `diagramDesc` / `verify.ts` の `labelOf` / `layout.ts` の `statValue` 比較が、今のまま平文を読む(SVG の `<title>` / `<desc>` に記号が混ざらない)。

- **正規化の不変条件**: `Styled` を含まない配列(`['許可', 'は']`)も `spans: undefined`(平文だけ)になる。隣り合う同じスタイルの断片は**統合**する(統合しないと `['API', 's']` が 2 つの span になり、glue が入って「記法を使わない出力は 1 バイトも変えない」が配列入力で破れる)。空の入力(`[]` / `['']`)は平文 `''` で、`undefined` と同じ扱い(`box()` の `step` に title が要る判定や `StepRule` は**正規化後の平文**で見る)。**tone の入れ子はエラー**(`danger(muted('x'))`。許すのは `b()` と tone の組み合わせだけ)。`swimlane()` の未知の lane のエラーなどは、正規化後の平文でメッセージを作る。
- 正規化の関数 `richOf(input: RichText): {text: string; spans?: Span[]}` は 1 つだけ。`Span = {text: string; bold?: boolean; tone?: TextTone}` の**断片の列**で、**連結すると `text` に一致する**ことを不変条件にする(違反は実装のバグとして throw)。span が 1 つも無い入力(`string` のみ)は `spans: undefined`。
- 太い run(title、banner の headline、group title、stat の値、`caption({bold})`、`line.bold`)の中の `b()` は意味がないので**エラー**(「強調したつもりが出ない」を防ぐ)。run と同じ tone の `color()` もエラー(比較は **`resolveTextColor` と同じ解決をした後の tone** で行う。run の tone が未指定の `undefined` と `'text'` は同じ、caption と note / sub の既定は `'muted'`)。冒頭の例のように、強調したい語は太字でない run(body など)に置く。
- `nowrap` の run(stat の値)の `spans` は許さない(値は 1 つの文字列)。

### 3. 測定と折り返し: スタイル付き atom を 1 つの関数で作る

- 「`TextRun` → スタイル付き atom 列 `StyledAtom = {text: string; weight: FontWeight; tone?: TextTone}`」を作る関数を **1 つ** 用意し、`registerRequests`、`layoutBoxContent`、`nowrap` 判定(`layout.ts:329`)、group title の `inkW`(`layout.ts:353`)が**すべて同じ関数**を使う(登録と配置で atom の切り方がずれて幅 0 になるのを防ぐ)。
- 平文を `splitAtoms` で atom に分けたあと、span 境界が atom の中にある場合(`**API**s` のような Latin の途中)は、その atom を境界で分割し、**分割で生じた境目に glue(改行不可)の印**を付ける。折り返しは glue でつながった atom 列を 1 単位として扱い、幅は各片の和とする。
- `wrapAtoms` は `string[]` 版を残し、内部に `wrapStyledAtoms<A extends {text: string; glue?: boolean}>(atoms: A[], {maxWidth, atomWidth: (a: A) => number}): A[][]`(行ごとの atom 列)を足して、`wrapAtoms` を「それを `map(l => l.join('').trimEnd())`」の薄い包みにする。行頭空白の破棄・開き括弧の移動・禁則は atom 列の上で行うので、span は atom に付いたまま行に引き継がれ、**オフセット計算に頼らない**。
- glue が付くのは「**1 つの平文 atom を span 境界で割った境目**」だけで、CJK の atom(1 文字)と空白には付かない(禁則とは干渉しない)。**glue 単位が 1 行より広い場合**は、既存と同じく行頭なら単位ごと置いてはみ出しを許し、単位の途中では割らない。内部版は**行末の空白 atom の除去(`trimEnd` 相当)を内部で行う**(包みの `join('').trimEnd()` だけに任せると、描画側が受ける atom 列に太字の空白が残り、無駄な `<tspan font-weight="700"> </tspan>` が出る)。
- 開発時の保険: `widthOf` の miss(未登録 atom)で throw するフラグ(テスト・golden では on)。受け入れ条件に「全 golden と新テストで miss が 0 回」を入れる。

### 4. 描画

- span のある行は `<text>` の中を `<tspan>` に分ける。**tspan の間に空白・改行を出力しない**(`<tspan>許可は </tspan><tspan font-weight="700" fill="…">ユーザー</tspan><tspan> が決める</tspan>` のように 1 行に詰める)。`xml:space="preserve"` は付けない(`textBoxOf` の `norm` は tspan 境界をまたいで空白を畳み込む。付けると、強調の有無で同じ入力の見た目が変わり、改行・インデントが空白として描かれる)。
- 強調のない範囲は地の文字(`<text>` 直下のテキストノード)のままにして tspan の数を最小にする。
- **絵文字は入れ子を許す**: `<tspan font-weight="700" fill="…"><tspan class="emoji">✅</tspan>OK</tspan>`。`textBoxOf` と `raster.ts` のフォント収集は tspan を再帰するので問題ない。強調の外へ出すと、layout は 700 で測り描画・lint は 400 で測るずれが出るので、外へは出さない。
- `dim`(spotlight)のとき、色の強調は `muted` に寄せる。太字は残す(意図: 主役でない箱にも強調の太字が残るが、色が消えるので目立ちにくい。気になる場合は dim で太字も解除する案を、実際の図で見て決める)。

### 5. 検査: 描画と同じ段階で入れる(色付き tspan が無検査で出る期間を作らない)

実装 PR の中で、描画(§4)と**同時に**次を入れる:

1. `svg-lint.ts` と `lint-browser.ts` のコントラストを、**`<text>` の子で色(`fill`)が異なる tspan ごと**に評価する(文字の中心の背景は text 全体の箱で近似してよい。tspan の色 × 背景)。絵文字の tspan(色を継承)は自動的に除く。`<text>` 直下に文字が無く全部が子の tspan にある場合は、親の色は評価しない。指摘の文言は tspan の文字(`textOf(tspan)`)を出す。**手書きの SVG(`svg/`、`lint-svg.ts`)にも新しい指摘が出うる**ので、`svg/` と `examples/out` を lint して、tspan 対応の前後で指摘が増えないことを確かめる(増えたものは実際の不足と確認する)。
2. `verify.ts` / `rules.ts` のコントラスト検査(laidOut の tone から色を引く)に、span の `tone` を足す(span の色 × 箱の塗り)。
3. 色だけの強調(`danger` / `accent` の span で太字を伴わないもの)に **warn**(`rules.ts` の a11y 系、doc 媒体のみ)。`muted` は弱める用途なので対象外。
4. `nowrapOverflow`(stat の値)は span を持たないので変更なし。

### 6. 範囲と段階

1. 範囲: §1 の範囲内のフィールドのみ(`renderTextRuns` を通る box / banner / caption / group title / swimlane の手順)。表のセル・シーケンス図・ワイヤーフレームは後続(別経路の `lines: string[]` で、型が `string` のままなのでそれまでは誤用が型エラーになる)。
2. 色の名前は `TextTone`(accent / danger / muted / text)のみ。トークン外の色は書けない。

## 検討した代替案

| 案 | 判断 |
|---|---|
| 文字列記法 `**太字**` / `{tone:文字}`(改訂 1 の案) | `**`(glob: `lib/**/*.ts`)、`{...}`(`{frame: false}` など実在の caption)が既存文字列と衝突し、片方だけだとエラー、2 個あると黙って改変される。TS の文字列では `\*\*` が書けない(`'\*\*'` は `**` になる)。tone 名の綴りも型で検査できない。不採用 |
| 文字列記法を `[[danger:..]]` などに変えて残す | 衝突は減るが、エスケープ・mono での無効化・太い run 内のエラーなど規則が増える。型付き部品で十分。第二候補として記録 |
| 強調を別の run(別の行)にする(現状の回避策) | 折り返しの途中で強調できない。不採用 |
| SVG を後処理で tspan に分ける | 折り返しの測定が太字を知らないのではみ出す。不採用 |
| 任意の色(`#rrggbb`) | トークン外の色は lint が落とす。`TextTone` に限る |

## 実装順と受け入れ条件

1. `wrapStyledAtoms`(行ごとの atom 列)と glue。既存の `wrapAtoms` の出力は不変(既存テスト + golden + 「記法を使わない任意の文字列で平文 === 入力・spans なし」のプロパティテスト)。
2. `RichText` / `b` / `danger` ほかの型、`richOf` の正規化(DSL 関数 1 か所)、太い run 内のエラー、範囲外フィールドの型エラーのテスト(`test/types/`)。`TextRun.spans`。
3. スタイル付き atom の共通関数(`registerRequests` / `layoutBoxContent` / `nowrap` / `inkW`)、太字の測定、`renderTextRuns` の tspan 出力、**§5 の検査を同時に**。
4. examples と README(強調の例、`string` はそのままの文字、範囲、エラー)、`budget.ts` / `verify.ts` のコメント修正。

受け入れ条件(すべてテストで固定):

- 全 golden と新テストで `widthOf` の miss が 0 回。
- span のある行について、layout の行幅(atom 幅の和)と `textBoxOf` の幅の差が 0.5px 以内(left / center / right、境目の空白、絵文字、Latin の分割を含む)。
- `b()` を含む `'**API**s'` 相当(`['API'を太字, 's を呼ぶ']`)が、幅ぎりぎりの箱で単語の途中で折り返さない。
- 行頭の空白が落ちる・開き括弧が移る・`\n` を含む場合に span がずれない。
- `examples/small-constraints.ts` の caption と `'lib/**/*.ts'`(mono)が今と同じ出力。
- 強調入りの図の `<title>` / `<desc>` に記号が出ない。budget の title 判定が変わらない。
- danger の箱に `danger()`、muted の箱に `muted()` を入れると verify と svg-lint の**両方**が落とす。
- 太い run の中の `b()`、同 tone の `color()` が throw。範囲外フィールドへの `b()` が型エラー。
- `svg/` と `examples/out` の lint 指摘が、tspan 対応の前後で増えない。
- 配列入力(`['API', 's']`)が統合されて `spans: undefined`、`danger(muted('x'))` が throw、`title: []` が未指定と同じ扱い。
- 記法(型付き部品)を使わない図の出力は 1 バイトも変わらない(golden + プロパティテスト)。

## 影響とリスク

- 良い点: 既存の文字列は構造的に不変で、エスケープも要らない。tone の綴りが型で検査され、範囲外のフィールドでの誤用が型エラーになる。
- リスク:
  - `wrapAtoms` の折り返しに触る(glue・行ごとの atom 列)。既存の関数を包みに変え、プロパティテストと golden で出力不変を守る。
  - 太字は幅が増えるので行が増え、箱が高くなる。row の高さ揃えに影響するが、レイアウトで吸収される。
  - 型を `string` → `RichText` に広げる範囲が広い(DSL 関数と型の strict 検査の両方)。`strict.ts` の型推論(IdsOf など)を壊さない確認が要る。
- 未決: 公開名(`text()` は `wf.text()` と紛らわしく、`b` は 1 文字でローカル変数と衝突しやすい。`em.b()` / `em.danger()` の名前空間か、`bold()` / `tone('danger', …)` か。実装時に決める)、`rich` タグ付きテンプレートを足すか、dim での太字の扱い(残す案を既定)。表のセル・ワイヤーフレームへの拡張は後続の ADR。
