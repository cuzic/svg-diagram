# ADR 0024: `stat()` の値が幅に収まらないとき、値の文字を自動で縮める

- 状態: 提案
- 日付: 2026-10-15
- 基点: `origin/main`(4f70b45、PR #226 まで)
- 関連: ADR 0002(量・強調の部品。`stat()` の出どころ)、ADR 0003(`stat` の値に spans を許さない)、ADR 0008(#7 スライド用キャンバス)、ADR 0014(byte 同一の扱い)、ADR 0016(実装計画の書き方)、ADR 0017(文字サイズの下限 `canvas.minText`)
- 番号について: 0021 は別セッションの原因分析の図、0022 は gantt、0023 はダーク追従などの ADR に割り当て済みのため、本 ADR は 0024。
- 依頼の原文(B7、優先度: 低): 「`stat` の値が収まらない: 『3割未満』が `size: 'stat'` でも『wrapping なしでは収まらない』で throw。span を広げて回避した。提案: 値のフォントを自動で縮小する。または収まる最大サイズを選ぶ。」

## 背景

`stat('3割未満', '…')` を、細い列(`span` が小さい `grid` の 1 マス、`row` の `flex` の小さい箱)に置くと、検査が止まる。回避は箱を広げることだけだった。要望は「収まる最大の大きさを、ツールが選ぶ」。

### 現状(事実。すべて `origin/main` の worktree で読んだ)

**`stat()` の実体**(`lib/dsl/text-bands.ts:57-72`)。plain の `box()` に `align: 'center'`、`lines: [{text: 値, role, bold: true, tone}, {text: ラベル, tone: 'muted'}]`、`statValue: 値` を持たせたもの。`role` は `opts.size ?? 'stat'`。`size` は `'stat'` か `'display'` の 2 値だけ(`:60`、型は `lib/types/text-bands.ts:123`)。文字の大きさは `ROLES`(`lib/tokens.ts:263-265`)で `stat` = 34px、`display` = 56px。`canvas` / `fill` の倍率は `scaleRoles`(`:266-268`)で表全体に掛かる。

**「size: 'stat'」の意味**。大きさの段階の名前であって、「小さい方に落とす」段階ではない。段階は 2 つしかなく(34 / 56)、既定が下の段なので、`size: 'stat'` に**これより小さい段は無い**。エラー文の「or use size: 'stat'」は、`display` で書いた値を 1 段下げる意味。依頼の「`size: 'stat'` でも」の場合、文面の直し方のうち残るのは「箱を広げる」だけ。

**折り返さない仕組み**。値の run だけ `nowrap: band.statValue === line.text && runs.length === 0`(`lib/layout-text.ts:42`)。`layoutBoxContent` は `nowrap` の run を `wrapStyledAtoms` に通さず `[run.text]` の 1 行にする(`:109-110`)。値に spans を付けると `withSpans` が throw する(`:17`。ADR 0003 の決定どおり)。

**「収まらない」の判定**。`lib/layout.ts:145-148`(`placeBoxLike`)で、`nowrap` の run の幅 `textWidth(widthOf, r.text, r.size, r.weight, …)` が `wrapWidth - indent + 0.5` を超えたら、その値を `placed.nowrapOverflow` に積む。`wrapWidth` は `w - 2 * (padX ?? BOX_PAD_X)`(`:132`)。ここでは throw しない。判定の位置は 1 箇所。

**エラーの出どころ**。`lib/verify-handlers.ts:205` の `checkNoWrap` が `nowrapOverflow` を読んで、`stat: value "…" does not fit its box without wrapping (widen the box or use size: 'stat')` を `verdict.problems` に積む(`box` は `:317`、`row` / `grid` の子は `:321-322`。検査の相は `'nowrap'`、`:28`)。`problems` が 1 つでもあると `build()` は `layout verification failed before any SVG was written:` で throw する(`lib/dsl/io.ts:87`)。つまり**レイアウトは最後まで走って SVG もできるが、検査が止める**。依頼の「wrapping なしでは収まらない」はこれ。既存のテストは `test/stat-bars.test.ts:23-29`(幅 180 に `display` の 20 桁。`verdict.problems` が `/stat: value .* does not fit/`、`wrappedRuns[0].lines.length === 1`)。

**ほかの `stat` の経路**。`hero({stat})`(`lib/hero.ts`)は `stat()` を呼ぶので同じ。`wf.stat`(`lib/wireframe.ts:53`、高さ 88 固定)は別実装で、`nowrapOverflow` の検査を持たない(本 ADR の範囲外)。`people()` の `side`(`lib/people.ts:15-33`)は数字の幅を測って、列に収まらなければ**別の文面で throw**する(`cols / size / gap を見直す`)。これも範囲外。`labelRole: 'stat'`(`lib/tokens.ts:256`)は bars / plane / image のラベルの大きさで、折り返す文字なので無関係。

**測定**。幅は 2 段で決まる。先に `lib/layout-measure.ts:53-62` の `registerRequests` が、`textRuns` の各 run の(atom, size, weight, font)を**登録**し、ヘッドレス Chromium の `getBBox()` でまとめて測る(`lib/measure.ts`)。レイアウトは登録済みの値を引くだけ。したがって「登録していない大きさの幅」は引けない。縮めた大きさで幅を引くには、**登録の側にも候補の大きさを入れる**必要がある(下の D3)。

**既存の下限**(ADR 0017 の表のとおり。再掲)。役割の表は 14 以上(`lib/tokens.ts:263`、`MIN_FONT_SIZE = 14`:`:245`)。明示の `size` は `assertFontSize` で 14 未満を throw。静的 lint は SVG の `font-size` が 14 未満なら `font-size-too-small`(`lint-svg.ts:98-110`)。`canvas.minText`(下限 10、`MIN_TEXT_ABSOLUTE`:`lib/tokens.ts:247`)を下げた図は、`font-floor-lowered`(info、`lib/rules.ts:646`)。スライド用キャンバスの `slide-min-text` は最小文字が `canvas.minText`(既定 24、`SLIDE_CANVAS`:`:272`)未満で warn(`:645-647`、最小値は `lib/fit.ts:27-34` の `minTextSize`)。`minTextSize` は `bandTextSizes`(`lib/fit-handlers.ts`。帯ごとの文字の大きさ)を見る。縮めた値の大きさが入ることは、実装時に確認する(未読)。

**既存機能で足りないか**:

| 手段 | 判定 | 根拠 |
|---|---|---|
| 箱を広げる(`span` / `flex` / `width`) | できる。要望者の回避 | レイアウトの自由度を、文字の長さに取られる。表の列が揃わなくなる |
| `size: 'stat'`(`display` から落とす) | 既に 34 なら効かない | 段が 2 つだけ |
| 値を短くする、単位を `label` に出す | できる。ただし値そのものが言葉(「3割未満」)のとき、文を変える | |
| 値に `caption({role: 'stat'})` を使って折り返させる | できる | 数字の `stat()` ではなくなり、`row()` の高さ揃えや `statValue` の検査に乗らない。別の部品を使う負担 |
| `canvas.minText` や `fill` で全体を縮める | 効かない | 全体の倍率で、収まるかどうかの比は変わらない(幅も同じ倍率で変わる) |
| `accept` | 届かない | `nowrap` の問題は `RULE_DOCS` の規則ではなく `verdict.problems`(`accept` は規則 id のみ。`lib/config.ts:43`) |

つまり、**箱を広げる以外に、収まらない値の大きさを調整する手段は無い**。

**PR #151「stat tone accent」**(`feat/stat-accent-card`、別セッション、未マージ)は `lib/dsl/text-bands.ts` の `stat()` の中の `tone` と `rich` の扱い(`:61-70` 付近)を触る。本 ADR の実装は `stat()` の関数本体を変えない(値の run に印を付けるだけで足りる。D2)ので、衝突は同ファイルの別の行になる。ただし #151 が先にマージされる前提で、実装の PR は **#151 の後**に作る(下の実装計画の順序)。#151 の差分は読んだだけで触っていない(`git diff` はローカルの読み取り)。

## 論点

1. どこまで縮めるか(下限の大きさ。lint の 14px と ADR 0017 の `minText` との関係)。
2. 縮め方(既存の `size` の語彙に沿った段か、連続値か)。
3. 縮めたことを知らせるか。
4. 収まっていた図の SVG が変わらないこと。
5. 縮めても収まらないときのエラー。

## 決定

### D1. 縮めるのは `stat()` の値の run だけ。既定で自動(オプトアウトは作らない)

収まらない値は、これまで必ず検査で止まっていた(`verdict.problems`)ので、**自動で縮めても、今通っている図の挙動は変わらない**(D4)。新しいオプション(`fit: 'shrink'` など)は作らない。理由: 付け忘れると同じ throw に当たるだけで、付ける利点が無い。値を縮めたくない人は、箱を広げる(今と同じ)。必要になれば `stat({fit: false})` を後から足せる(未決 1)。

### D2. 縮める判断はレイアウト(`placeBoxLike` / `layoutBoxContent`)で行う。検査は残す

- 値の run に「縮めてよい」の印(`TextRun.fit?: {min: number}`)を付ける。印を付けるのは `boxRuns`(`lib/layout-text.ts:42`)の `nowrap` の run だけ(`stat()` の値)。`stat()` の関数本体は変えない(PR #151 と衝突しない)。
- `layoutBoxContent`(`lib/layout-text.ts:100-`)は、`nowrap` かつ `fit` のある run について、`wrapWidth - indent` に収まる**最大の大きさ**を `run.size` から `fit.min` まで 1px 刻みで下げて探し、見つかった大きさを `WrappedRun.size` に入れる(`WrappedRun` は `size` を持つ。`lib/types/text-bands.ts:151-`)。高さ(`lineYs`、`textHeight`)は縮めた大きさで計算するので、箱の高さは自然に縮む。`row()` の高さ揃えは既存の仕組みのまま。
- `fit.min` まで縮めても収まらないときだけ、今までどおり `nowrapOverflow` に積む(`lib/layout.ts:146-147`)。エラーは検査(`checkNoWrap`)が出す。**検査の位置と段(`'nowrap'` 相)は変えない**。縮める前に出していた判定を「縮めた後の幅」で行うだけ。

### D3. 縮め方は「1px 刻みの連続に近い整数」。既存の段は増やさない

`size` の語彙(`'stat'` / `'display'`)には段を足さない。理由: (a) `ROLES` に新しい名前を足すと、`fill` / `canvas` の倍率、`Role` 型、`HEADLINE_PX`(`lib/rules.ts:553`。`test/diagram-api.test.ts` が `ROLES` と一致を保つ)、`fillScaleLimit` の 4 箇所が連動する。(b) 要望は「収まる最大」で、34 と 56 の間や下に刻みを置いても、細い列ごとに最適な大きさは違う。

- 大きさは**整数 px**(既存の `scaleRoles` が `Math.round` するのと同じく、SVG の `font-size` は整数)。`display` の 56 からでも、1px ずつ下げる。
- 測定: 幅は登録済みの値しか引けないので、`registerRequests`(`lib/layout-measure.ts:56`)は `fit` のある run について、`fit.min` から `run.size` までの**全ての整数の大きさ**で登録する(1 つの値あたり、`display` で最大 33 通り。atom 数と同じ数だけ増える。キャッシュは(text, size, weight, font)でキーされるので、同じ値は 1 度だけ測る)。比例で割り算して近似する案は取らない(`getBBox()` の幅は、ヒンティングで大きさに比例しないことがあり、`lint-svg.ts` の container-overflow と食い違うと、レイアウトを通ったのに lint で落ちる。`lib/measure.ts:13-17` の方針)。

### D4. 下限は round(24 × s)(s は `fill` / `canvas` の倍率)。稠密な canvas では、その倍率の分だけ小さく縮められる

決定は **(a) 倍率をかけた下限**。「24px の絶対の下限」(b)にはしない。

- `fit.min = min(run.size, max(round(24 × s), canvasMinText ?? 0))`。`s` は `scaleRoles` と同じ倍率(`canvasFontScale(minText)`、`lib/tokens.ts:274-276`。倍率 1 なら 24)。`canvasMinText` は `diagram({canvas: {minText}})` の値で、図が宣言した文字の下限を下回らないための保険(通常は `round(24 × s)` の方が大きい)。外側の `min(run.size, …)` は、縮める前の大きさが下限以下のとき縮めない(`fit.min = run.size`)ための式。
- 理由: ADR 0017 の趣旨は「投影しない手元・配布用の稠密な canvas の図は、小さい文字を許す」。`canvas.minText: 10` の図は倍率が約 0.72 で、`stat` は 34 × 0.72 ≒ 24 で描かれる。ここで下限を絶対の 24 にすると、`stat` の通常の大きさがすでに下限で、「縮める余地が無い」うえに、他の文字より値だけが縮められない不ぞろいになる。倍率を掛ければ、稠密な図では `round(24 × 0.72)` = 17 まで縮められ、`stat` と他の文字の比(約 1.7 倍)が通常の図と同じになる。
- 24 の根拠(倍率 1 のとき): (1) 既に使っている数(`SLIDE_CANVAS.minText = 24`、ADR 0008 #7)で、新しい定数を作らない。(2) ラベル(14px)の約 1.7 倍で、縮んでも「大きな数字」として読める。`stat` の 34px からは約 7 割まで縮められる。これを下回ると、ラベルと区別が付かない(`banner` が 16px)。下限は「ラベルとの比」なので、倍率に追従するのが自然。
- 14px の下限との関係: 倍率 1 では 24 ≧ 14。倍率が小さい図(稠密な canvas)では、`max(…, minText)` が `font-floor-lowered`(info、`lib/rules.ts:646`)の宣言した下限を守る。`lint-svg.ts` の静的な 14px の下限は、そもそも `minText < 14` の図が通らないことが ADR 0017 の既存の問題(別の仕組み)で、本 ADR はそれを変えない(縮めた値は `minText` を下回らない、以上)。
- 縮める前の大きさが下限以下(`fit.min = run.size`)なら縮めず、`nowrapOverflow` に回す(検査が止める)。

### D5. 縮めたことは info で知らせる(黙らない)。規則 `stat-fit-shrunk`

- `lib/rules.ts` に info の規則 `stat-fit-shrunk` を足す(`RULE_DOCS` と `accept` の対象になる)。文面: `stat の値 "3割未満" を 34px から 27px に縮めた(箱の幅 120px に収めるため)。同じ列の stat と大きさがそろわない。箱を広げるか、値を短くすると、そろう。`
- 理由: 縮んだ値は、隣の `stat` と**大きさがそろわなくなる**(`row([stat('76%', …), stat('3割未満', …)])` で、片方だけ 27px)。意図した結果かどうかを、見る人が判断できるようにする。warn にはしない(縮めること自体が仕様で、直さなくても図は成立する)。info なので、`check` を失敗させない(既存の info の規則と同じ扱いのはず。実装時に確認)。
- 情報は `placed` に持たせる: `LaidOutBox.statShrunk?: {value: string; from: number; to: number}[]`(`nowrapOverflow` と同じ形のフィールド。`lib/types/text-bands.ts:164`)。規則は帯を歩いてこれを読む(`rules.ts` の既存の `walkBands` ではなく、レイアウト後の帯なので、`nowrapOverflow` を読む `verify-handlers.ts:205` と同じ側の処理に置く。実装時に確認)。

### D6. 既存の図の SVG は byte 同一

- 収まっていた値は**縮めない**(最大の大きさが `run.size` のまま = 探索の最初の候補)。`WrappedRun.size`、`lineYs`、`textHeight` は変わらない。
- 追加するフィールド(`TextRun.fit`、`LaidOutBox.statShrunk`)は、縮めたときだけ付く(`nowrapOverflow` と同じく、無いときは undefined のまま。スプレッドで空の値を作らない)。SVG への出力は `WrappedRun.size` だけなので、収まっている図の出力は変わらない。
- 測定の登録に候補の大きさが増える(D3)が、測定結果は SVG に出ない。`examples/out/*.svg` と `svg/` 以下のゴールデンに差分が出ないことを、実装の受け入れ条件にする。
- 今まで `stat: value … does not fit` で止まっていた図は、SVG ができるようになる(止まっていた図の出力は元々無い)。

### D7. 縮めても収まらないときの throw の文面(直し方つき)

`checkNoWrap`(`lib/verify-handlers.ts:205`)の文を書き換える。縮めた先の下限と、実測の幅を出す:

```
stat: value "3割未満" does not fit its box even at the smallest size (24px: needs 148px, the box has 120px).
  fix: widen the box (span / flex / width), shorten the value, or put the unit in the label.
```

`display` から縮めても足りないなら、`size` を挙げる必要は無い(縮めは自動で、`size` の段は関係ない)。「or use size: 'stat'」は削る。`test/stat-bars.test.ts:23-29` の正規表現 `/stat: value .* does not fit/` は残る文面にする(先頭の `stat: value "…" does not fit` を保つ)。

## 代替案

- **縮めず、`stat` の `size` に小さい段(`'small'` など)を足す**: 段を選ぶのは人で、収まらない箱ごとに毎回選ぶ負担が残る。`ROLES` と連動する 4 箇所(D3)も触る。却下。
- **比例で縮める(`幅 / 実測の幅 × 大きさ`、連続値、小数 px)**: `font-size` が小数になる。lint の `getBBox()` と測定の食い違いが出る(D3)。SVG の `font-size` を整数にそろえている現状(`scaleRoles` の `Math.round`)とも合わない。却下。
- **値を折り返す**: 「3割未満」を 2 行にすると、`stat` の「大きな数字 1 つ」という意味(ADR 0002、`nowrap` の理由。ADR 0003 は値の spans も許さない)が崩れる。却下。
- **同じ `row()` の `stat` をそろえて縮める**: 見た目は良いが、`row` が子を覗く仕組み(`stat` の `statValue` を行から見る)が要る。D5 の info で気づける。未決 2。
- **`wf.stat` / `people({side})` も同じように縮める**: `wf.stat` は別実装(固定高 88、検査なし)、`people()` は列が決まる別の throw。要望は `stat()` の値。範囲外(未決 3)。
- **下限を、`stat` の役割の大きさの比(例 70%)にする**: `display`(56)は 39 まで、`stat`(34)は 24 まで縮み、56 の方が緩い。要望者の例は 34 側。固定の 24 の方が、「何 px 以下にならないか」を説明しやすい。却下。

## 影響

- 細い列に置いた長い値が、検査で止まらずに通る。値の大きさは、収まる最大(24px 以上)。
- 縮んだ値は info `stat-fit-shrunk` に出る(`check` の出力と、`accept` で許容できる)。
- 収まっている図の SVG は変わらない(D6)。
- 測定の登録が `stat` の値 1 つあたり最大 33 通りの大きさ分増える(初回のみ。キャッシュあり)。
- 触る型: `TextRun`(`lib/types/text-bands.ts:149 付近`)、`LaidOutBox`(`:164`)。`WrappedRun.size` は既存。
- `stat()` の本体(`lib/dsl/text-bands.ts`)は触らない。`stat()` に触る PR は 3 つ(#151 stat tone accent=別セッション・未マージ、本 ADR、ADR 0023 U3=本体に 3 行目を足す)。**順序は #151 → 0024 → 0023 U3**。

## 実装計画

触るファイルと、独立に進められる単位。**テストはフォントに依存した絶対値(「27px になる」「148px」)を書かない**。幅の関係で書く(下の各単位)。測定には既存の `checkDiagram` / 測定のスタブ(`test/` で使っているもの。無ければ `widthOf` を差し込めるテストを使う)を使う。

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U1 | `TextRun` に `fit?: {min: number}` を足す。`boxRuns` で `nowrap` の run に `fit` を付ける(値は D4 の `min`。倍率と `canvas.minText` は `roles` / `d.canvas` から。`min` の計算は純関数 `statFitMin(roles, minText)` として `lib/layout-text.ts` か `lib/tokens.ts` に置く) | `lib/types/text-bands.ts`、`lib/layout-text.ts`、(関数の置き場)`lib/tokens.ts` | なし |
| U2 | 測定の登録: `registerRequests` で `fit` のある run を、`fit.min..size` の全整数の大きさで登録 | `lib/layout-measure.ts` | U1 |
| U3 | レイアウト: `layoutBoxContent` で `nowrap` + `fit` の run を縮める(最大の収まる大きさを下から探す。収まらなければ `fit.min`)、`WrappedRun.size` と `lineYs` を縮めた大きさで。`placeBoxLike` の `nowrapOverflow` の判定は、縮めた後の `r.size` で行う(今の式のまま `r.size` を読んでいるので変更は無いはず)。縮めた run を `LaidOutBox.statShrunk` に積む | `lib/layout-text.ts`、`lib/layout.ts`、`lib/types/text-bands.ts` | U1、U2 |
| U4 | info の規則 `stat-fit-shrunk`(`RULE_DOCS` に 1 行、検出の関数、`accept` の対象に)。D5 の文面 | `lib/rules.ts`(+ 規則を数える `test/` の既存の「規則の一覧と文書の一致」のテスト) | U3 の型だけ(U3 と並行可) |
| U5 | 検査の文面(D7)。`checkNoWrap` の文を書き換え。縮めた後の下限と実測の幅を出す(`nowrapOverflow` を `{value, width, avail, min}[]` にするか、`string[]` のまま文面は `min` を省くかは実装時に選ぶ) | `lib/verify-handlers.ts`、`lib/types/text-bands.ts` | U3 |
| U6 | README の `stat` の節(`README.md:188`。「値は折り返さず、幅に収まらない図は検証エラーになる」を「収まらなければ 24px まで縮め、それでも収まらなければ検証エラー」に)、`skills/` の `svg-diagram` の該当行、`examples/stat.ts` に細い列の例を 1 つ足す(`examples/out/stat.svg` は PR #151 が変える。#151 のマージ後に再生成) | `README.md`、`skills/svg-diagram/…`、`examples/stat.ts` | U3〜U5 |

並列の分け方: **U1 → (U2 ∥ U4) → U3 → U5 → U6**。U2 と U4 は U1 の型ができれば独立。1 人でやるなら 1 PR(小さい)。分けるなら、PR-A = U1〜U3、PR-B = U4〜U6。

テスト方針(フォント依存の絶対値を使わない):

1. **収まる図は変わらない**: 十分広い箱の `stat('76%', …)` の `wrappedRuns[0].size` が `ROLES.stat`(定数)と等しい、`statShrunk` が無い。既存の `examples/out` / ゴールデンの SVG が byte 同一(U3 の受け入れ)。
2. **縮む**: 細い箱(幅を `textWidth` から逆算して決める。幅 = 「その値の 34px での幅」の 0.8 倍)で、`wrappedRuns[0].size < ROLES.stat` かつ `>= statFitMin(...)`、`textWidth(…, size) <= wrapWidth + 0.5`(収まっている)、かつ `size + 1` では収まらない(最大性)。幅から決めるので、フォントが変わっても成り立つ。
3. **下限**: さらに細い箱(幅 = 24px での幅の 0.5 倍)で `verdict.problems` が出て、その文面に `fix:` の行がある。`canvas.minText` を 36 にした図では、`wrappedRuns[0].size >= 36`(下限が `minText` に追従する)。**稠密な canvas**(`canvas: {minText: 10}`、倍率 s < 1)では、`wrappedRuns[0].size >= round(24 × s)` で、かつ絶対の 24 を下回る大きさまで縮められること(`24 × s < 24` なので、`size < 24` になる箱の幅を、幅の関係で作って確かめる)。同じ図の倍率 1 版では、`size >= 24`。
4. **`display`**: `size: 'display'` の値が縮み、`size` の段が 2 つのままであること(`ROLES` のキーが変わらない)。
5. **info**: 縮んだ図の `check` が `stat-fit-shrunk` を info で返す。`accept` で許容できる。縮んでいない図には出ない。
6. **lint**: 縮めた図の SVG の `font-size` が 14 以上(`lint-svg.ts` が通る)。
7. **測定の登録**: `registerRequests` が `fit.min..size` の全ての大きさを登録している(`requests` のキーの集合で検査)。
8. **`stat` 以外**: `caption({role: 'stat'})` や `people({side})`、`wf.stat` が変わらない(縮まない。既存のテストが通る)。

## 未決事項

1. **オプトアウト**: `stat({fit: false})` を足すか。今は足さない(D1)。固定の大きさにしたい需要が出たら足す。
2. **同じ行の `stat` の大きさをそろえるか**: 縮んだ 1 つだけが小さくなると不ぞろい(D5 の info で知らせるだけにした)。そろえる案は、`row` / `grid` が子の `stat` を見て、全員を最小の収まる大きさに縮める。ただし「収まっているのに縮む」ので D6(byte 同一)を破る。オプトインの `row({stats: 'same'})` なら破らない。要望が来たら別 ADR。
3. **`wf.stat` と `people({side})`**: 同じ縮め方を入れるか。`wf.stat` は別実装、`people()` は列の寸法の throw(別の文面)。今回は触らない。
4. **下限 24 の妥当性**: ADR 0008 #7 の 24 を流用した。ラベルの 14 との比、`display` を使った強い見せ場(56 → 24 は 4 割)が許せるか。実物(要望者の図)で見て、不自然なら `display` だけ下限を上げる(例 34 = `stat` の既定)。
5. **`minText` が大きいとき**: `stat` の既定の大きさ(34 × s)を超える `minText` では、縮める余地が無い(`fit.min = run.size`、D4)。その場合は縮めず検査に回す。現行の `slide-min-text` との整合を、実装時にテストで確かめる。
