# ADR 0017: 稠密なスライド向けの文字サイズ下限の緩和(`canvas.minText` と `fontFloor`)

- 状態: 提案
- 日付: 2026-10-15
- 基点: `origin/main`(479c188、PR #194 まで)
- 関連: ADR 0008(#7 スライド用キャンバス。最小文字 24px)、ADR 0006(`--html`。文字サイズの検査は SVG だけ)、ADR 0014(byte 同一の扱い。D3)、ADR 0016(実装計画の書き方)
- 依頼の原文: 「Medius への AI・DX 提案資料」の図づくりで挙がった要望の C1。「文字は 10px でも」と言われたが、静的 lint が「14px 未満は不可」で止まる(`font-size-too-small`)。キャンバスを 2304×1296 に広げて代用した。提案は `.svg-diagram.json` に `"fontFloor": 10` のような設定、あるいは `canvas: {density: 'dense'}`。(原文のファイルは作業環境に無かったので、依頼文の引用による。)

## 背景

要望は「稠密なスライドのために、文字サイズの下限を緩めたい」。下限は 14px 固定で、緩める手段が無いと受け取られている。実際には**下限は 1 つではなく、層ごとに別の値と別の出どころがある**。緩める範囲と残す検査を決める前に、事実を確かめた。

### 現状(事実)

下限が効いている場所(すべて `origin/main` を読んだ)。

| 層 | 値 | 出どころ | 働き |
|---|---|---|---|
| 役割の表 | 14〜56 | `lib/tokens.ts:253-255` の `ROLES`(`label` / `body` / `note` が 14、`title` 15) | 通常の図は役割からしか文字の大きさを選べない。`lib/tokens.ts:245` の `MIN_FONT_SIZE = 14` が根拠の定数 |
| 明示の `size` | ≥14 | `lib/dsl/shared.ts:65-69` の `assertFontSize`(呼び出しは `lib/dsl/text-bands.ts:28`、`lib/dsl/sequence-table-swimlane.ts:84`) | 14 未満は throw(「この deck は小さい文字を使わない。レイアウトを見直せ」) |
| 型 | 14〜72 | `lib/strict.ts:155-156` の `FontSize` | 14 未満の `size` は型エラー |
| wordart | ≥14 | `lib/wordart.ts:47`、`:65`、`lib/wordart-vertical.ts:62`(`tcySize`) | 同上 |
| **静的 lint** | **14** | **`lint-svg.ts:98-110`**(数値 `14` が直書き。`MIN_FONT_SIZE` を使っていない) | 出力済みの SVG の `font-size` を正規表現で読み、14 未満なら `font-size-too-small`(エラー)。`--fix` は 14 に引き上げる(`lint-svg.ts:17-19`、`:103-107`)。`build` は `lint-svg.ts --strict` を必ず走らせる(`build-diagram.ts:180-184`)ので、1 つでもあればビルドが失敗する |

要望が当たっているのは最後の行である。そして、この検査は**図のソース(DSL)を知らない**。SVG ファイルの文字列だけを見て、キャンバスの種類も、図が何を宣言したかも見ない(読む設定は `fonts` だけ。`lint-svg.ts:200`)。`accept`(`lib/config.ts:43-50`)は `RULE_DOCS` の規則 id しか受けない(`checkAccept`、`lib/config.ts:43`)ので、`font-size-too-small` は `RULE_DOCS` に無く、`accept` でも許容できない。

#### 既存機能で足りないか

| 手段 | 判定 | 根拠 |
|---|---|---|
| `diagram({canvas: {minText}})` | **文字を小さくするところまでは既にできる。止まるのは lint だけ** | `canvasFontScale(minText) = ceil(minText / 14 × 100) / 100`(`lib/tokens.ts:267-269`)が倍率で、`lib/dsl/render.ts:46` で `{...SLIDE_CANVAS, ...opts.canvas}` を合成し、`:144` で倍率を決める。`minText` に下限の検査は無い。実測(2026-10-15、worktree で `canvas: {minText}` を 24 / 14 / 10 にして `renderDiagram`): 倍率 1.72 / 1 / 0.72、SVG の `font-size` は `26,24` / `15,14` / `11,10`。出力した SVG を `lint-svg.ts` にかけると、10 のものは `font-size-too-small`(`10, 11px`)で exit 1 |
| 要望者の代用(キャンバスを 2304×1296 に広げる) | **通るが、実体は同じ縮小** | 文字の `font-size` は 14 以上を保ち、見せる縮尺で小さくしている(1280 幅に縮めると 0.556 倍。24px が約 13px)。lint は「実際に読む大きさ」を見ていないので、下限は守られているのではなく迂回されている |
| `diagram({slide})` / `fill` | **別の仕組み** | 本文のあるスライドの中の図。`slide-budget.ts` は `<img>` に使える高さ・幅を Slidev で実測する(`lib/slide-budget.ts:1-20`、`BOTTOM_LIMIT = 520`)だけで、文字サイズの下限は持たない。実効の文字が `minEffectiveFont`(既定 **12**、`lib/fit.ts:37`)未満になると `on-slide text is ~Npx` を警告する(`lib/fit.ts:52-53`)。`canvas` の図はこの検査を飛ばす(`lib/fit.ts:51` の `d.canvas` で早期 return)。つまり**スライド上では、実効 12px が既に別の下限になっている** |
| `accept` | **届かない** | 上のとおり、`font-size-too-small` は静的 lint で `RULE_DOCS` の外 |
| `table({dense: true})` | **別物** | 行の余白を 8px から 4px に詰めるだけで、文字は 14px のまま(README:167) |
| `.svg-diagram.json` | **設定項目に無い** | `Config`(`lib/types/project.ts:6-23`)は `accept` `maxWidth` `terms` `legend` `legendLabels` `tones` `measure` `fonts` だけ |

#### ADR 0008 #7 との関係

ADR 0008 #7 の `canvas: 'slide'` は「会場の後ろ(約 20m)から読める」ための**上げる**方向の仕組みで、既定の最小文字は 24px(`lib/tokens.ts:265` の `SLIDE_CANVAS.minText`)、検査は `slide-min-text` / `slide-canvas-overflow`(`lib/rules.ts:634-637`)。C1 は**同じキャンバスの `minText` を下げる**要望で、投影ではなく、手元の画面・配布資料で読む稠密な図が対象になる。仕組み(倍率で文字を揃え、`minText` 未満を警告する)は共有でき、**新しい種類のキャンバスは要らない**。24px の既定は変えない。

#### アクセシビリティ方針との関係

文字サイズそのものの方針は ADR(0006 を含む)に書かれていない(0006 は HTML 出力の ADR で、`font-size` の下限の記述は無い)。方針は `a11y-*` の検査として実装されている: `a11y-text-contrast`(WCAG 4.5:1、`lib/rules.ts:43`、`:224`)、`a11y-nontext-contrast`(3:1、`:45`)、`a11y-color-only-emphasis`(`:44`)。ビルド時の lint-svg 側にも同じ閾値のコントラスト検査(`lib/lint-browser.ts`、`lib/svg-lint.ts`)と、はみ出し(container-overflow)・重なりの検査がある。いずれも文字サイズを入力にしない(輪郭文字の判定だけ `font-size` を見る: `lib/svg-lint.ts:101`)ので、文字を小さくしても**検査は残り、緩まない**。

## 論点

1. 緩める範囲: 図ごと / 設定ファイル(案件全体) / キャンバスの密度。
2. 下限の値。
3. 緩めたときに残す検査。
4. 既存の図の SVG への影響(byte 同一の条件)。
5. 緩めた事実を `check` / lint にどう出すか。
6. 誤用(アクセシビリティを黙って下げる)の防ぎ方。

## 決定

### D1. 緩める単位は「キャンバスの図が自分で宣言する `canvas.minText`」。`fontFloor` は案件の許可の下限

- **図ごとの宣言**: `diagram({canvas: {minText: 10}})`。新しい項目は作らない(`density: 'dense'` は採らない。D の代替案)。宣言はソースに残り、レビューで見える。`minText` は**キャンバス自身の単位**(キャンバスは 1:1 で表示する前提。README:1010)。
- **案件の許可**: `.svg-diagram.json` に `"fontFloor": 10` を足す。意味は「この案件で、図が `canvas.minText` をここまで下げてよい」。**既定は 14**(省略時は今と同じ)。`fontFloor` だけでは**どの図の文字も小さくならない**(図が宣言しない限り何も変わらない)。依頼の提案(設定ファイルで下限を下げる)は、この形で取り入れる。
- 図が `fontFloor` を下回る `minText` を宣言したら、`applyConfig`(`lib/config.ts:62`)で throw する(「`minText: 10` は案件の `fontFloor`(14)より小さい。`.svg-diagram.json` の `fontFloor` を下げるか、`minText` を上げる」)。`diagram()` は設定を知らない(`applyConfig` で合流する)ので、検査はここ。
- 対象は **`canvas` の図だけ**。文書の図(幅 940px 前後、縮小表示がある)と、`slide` / `fill` の図は、14px(と実効 12px)のまま。通常の図の下限を下げる手段は作らない。
- 明示の `size:`(`assertFontSize`、`FontSize` 型、wordart)は **14 のまま**。`canvas` の図で文字が 14 未満になるのは、役割の倍率(`canvasRoles`)の結果だけ。固定サイズの文字は倍率に乗らず、`minText` 未満なら `slide-min-text`(README:1007)になる、という既存の動きを変えない。

### D2. 下限の値

- 絶対の下限は **10px**(`lib/tokens.ts` に `MIN_TEXT_ABSOLUTE = 10` を足す。依頼の「10px でも」)。`canvas.minText` が 10 未満・有限でない・数でないなら throw。`fontFloor` も同じ範囲(10 以上 14 以下の数。14 超は意味がないので throw)。
- **既定は動かさない**: `canvas: 'slide'` は 24px、`fontFloor` の既定は 14。10 は、**宣言した図だけ**。
- **前提(ユーザー決定)**: 10 は「**投影しない手元・配布用の稠密な `canvas` の図**」が対象。`slide` / `fill` の実効 12px(`lib/fit.ts:37`)とは**別の層**で、そちらは変えない。`canvas` は 1:1 表示の前提なので矛盾しない。縮めて見せる場合は著者が換算する(下の未決 1)。README の `canvas` の節にも、この前提(投影には向かない)を書く。

### D3. 緩めても残す検査

次はキャンバスの図でも、文字サイズに関係なく**同じ強さで効く**(変えない)。

- `a11y-text-contrast`(4.5:1)、`a11y-nontext-contrast`(3:1)、`a11y-color-only-emphasis`。大きい文字への緩い閾値(3:1)は**使わない**。小さい文字ほど厳しく見る方向なので、閾値の例外は作らない。
- はみ出し(container-overflow)、文字の重なり(verify と lint-svg の幾何検査)、`slide-canvas-overflow`。
- `slide-min-text` は、**宣言した `minText`** に対して今のまま効く(固定サイズの文字が 10px 未満になれば警告)。
- lint-svg の `font-size-too-small` は、床を「14」から**「その SVG が宣言した床」**に変える(D5)。宣言のない SVG は 14 のまま、`--fix` も従来どおり 14 に引き上げる。

### D4. 既存の図の SVG は byte 同一

- 出力の変更は、**ルートに `data-min-text="N"` を足すこと 1 つだけ**。足すのは `canvas.minText < 14` のときだけ(`lib/emit.ts:105-106` の `data-appearance` と同じ並びの末尾)。`minText ≥ 14` の図(`canvas: 'slide'` の 24 を含む)と、`canvas` を使わない図は、**1 byte も変わらない**。
- `minText < 14` の `canvas` の図は、今の lint を通らない(実測)ので、リポジトリにコミット済みの SVG は無い想定。`examples/` に該当があれば、そこだけ属性が増える(PR の説明に書く)。
- 検証: 基点の `origin/main` と変更後で `examples/*.ts` と `test/` の fixture を同じ環境(`measure: 'font'`)で全部描き、SVG を diff する。属性が増えるのは `minText < 14` の図だけ、という確認をテストにする(下のテスト方針)。

### D5. 検査(`check` / lint)への出し方

- `check` の新しい規則 **`font-floor-lowered`(info)**: `canvas.minText < 14` の図で、「文字の下限を 14px から Npx に下げている(最小の文字 Mpx)。キャンバスは 1:1 で読まれる前提。投影には向かない」と知らせる。`RULE_DOCS` に登録するので、`accept` でも許容できる(`lib/rules.ts:527-531` の仕組み)。`diagram({canvas, ...})` を読んだ人に見える info で、警告にはしない(宣言した本人の意図なので)。出す場所は `slide-min-text` の隣(`lib/rules.ts:634-637`)。
- **`build` 自身が 1 行出す**: `canvas.minText < 14` の図を書き出すたびに、`⚠ <out>: 文字の下限を Npx に下げている(fontFloor M。投影には向かない)` を標準エラーに出す。`build` は図のデータを持つので、lint の出力を読まない(終了 0 のときは出力を捨てる現行の作りのまま)。実装は U3b。
- lint-svg:
  - 床 = ルートの `data-min-text`(あれば)、なければ 14。`font-size-too-small` はその床に対して今と同じエラー。`--fix` は床まで引き上げる。
  - **許可の突き合わせ**: `loadConfig().fontFloor ?? 14` より小さい `data-min-text` を宣言した SVG は、新しいエラー `font-floor-not-permitted` にする(古い SVG や、案件の許可なしに生成した SVG が、静かに通らない)。
  - 緩めた事実は、**失敗しない「お知らせ」の階層**で 1 行出す(**lint-svg を単独で走らせたとき用**。build では見えない)(`font-floor-lowered: minText Npx(案件の fontFloor M)`)。`lint-svg.ts` には今、エラー(`staticFindings`)と助言(`advisoryFindings`。`--strict` で失敗。`build` は `--strict` なので助言でも失敗する)しかない。`build` を失敗させずに出すため、第 3 の階層(失敗に数えない)を足す。
  - **設定の探し方**: lint-svg は `.svg-diagram.json` を、cwd ではなく**検査する SVG のあるディレクトリ**から上へ探す(ファイルごと)。`--config <path>` で明示もできる。`build` / `check` は cwd から探すが、md と remark の経路(`lib/render-source.ts:52`)はソースのディレクトリから探すため、別ディレクトリから lint すると `font-floor-not-permitted` になる食い違いを避ける。
- `--stale`(README:37)は、設定のハッシュを見るので、`fontFloor` を変えると図は古いと判定される(追加の対応は不要)。

### D6. 誤用の防ぎ方(黙って下げない)

1. 下げるには、**図のソースに `canvas: {minText: N}`(N < 14)と、案件の `.svg-diagram.json` の `fontFloor ≤ N` の 2 つ**が要る。どちらか片方では throw(図 → 設定の順)か、lint-svg のエラー(SVG → 設定)になる。
2. 設定の `fontFloor` が既定の 14 のままなら、今と挙動は同じ。`fontFloor` を書く人は、コミットに残る形で許可を出している。
3. 下げた図は、`check` の `font-floor-lowered`(info)と、**`build` 自身が出す 1 行**(D5)に、毎回出る。`build` は lint の出力を、終了コードが 0 でないときだけ表示する(`build-diagram.ts:182-185`)ので、lint の「お知らせ」は build では見えない。`accept` で消せるのは `check` の info だけで、理由が要る(`lib/config.ts:43-50`)。
4. 10 未満は throw。`size:` の 14 の下限は変えない。
5. 文書の図(940 幅)と `slide` / `fill` の図は、手段が無い。
6. コントラスト・はみ出し・重なりは緩めない(D3)。

## 代替案

| 案 | 採らない理由 |
|---|---|
| `.svg-diagram.json` の `"fontFloor": 10` だけで、案件の全図の下限を下げる(依頼の提案どおり) | どの図が小さくなったかがソースにも出力にも残らず、**案件全体で黙って下がる**。許可の下限としては採り、図の宣言を必須にした(D1) |
| `canvas: {density: 'dense'}` のような名前の段階 | 何 px かがソースで読めない。`minText` という数が既に同じ役割。段階が欲しくなったら、`minText` へ展開する糖衣として後から足せる(今は足さない) |
| `accept: {'font-size-too-small': ...}` | `font-size-too-small` は静的 lint の検査で、`accept` の対象(`RULE_DOCS`)ではない。対象にすると、SVG を見る lint が図のソースの `accept` を読む必要があり、層が逆転する(lint-svg は SVG だけを見る設計。ADR 0007 の関数コアと入出力の分離にも反する) |
| 要望者の代用(広いキャンバス)を正式な手段にする | 実効の大きさが検査に見えない。24px × 0.556 = 約 13px のように、下限をすり抜ける |
| 下限を 14 から一律に 12 / 10 へ(全図) | 全図の下限を黙って下げる。文書の図は 940 幅の縮小表示で既に実効が下がる(`doc-width`)ため、危険が大きい |
| `lint-svg.ts` の 14 を `MIN_FONT_SIZE` の import に置き換えるだけ | 値は 1 か所になるが、下限を下げる手段にはならない。ただし、数値の直書きは U3 で解消する(同じ変更の中で) |

## 影響

- 既存の図: `minText ≥ 14` の `canvas` の図と、`canvas` を使わない図の SVG は byte 同一(D4)。`lint-svg` の挙動も、`data-min-text` の無い SVG は同じ。
- 新しい設定項目は `fontFloor` 1 つ。`Config`(`lib/types/project.ts`)、`loadConfig` の検査(`lib/config.ts` の `check*` と同じ流儀で、数でなければ throw)、README の「共通設定」(README:1113)に載せる。
- 新しい `check` の規則は 1 つ(`font-floor-lowered`、info)。lint-svg の新しい検査は 1 つ(`font-floor-not-permitted`、エラー)と、お知らせの階層。
- **互換**: `--no-lint` で `minText < 14` の図を作っていた案件は、今後 `applyConfig` で throw する(`.svg-diagram.json` に `fontFloor` を足す必要がある)。
- `--html`(ADR 0006)の出力は、文字サイズの検査を SVG にしか持たないので、今回の対象外。`minText < 14` の図を `--html` で描くと文字は小さくなるが、案件の許可の検査(`applyConfig`)は共通で効く。
- 読みにくい図が増える危険は残る。ただし、**図・設定・出力の 3 か所に、下げた事実が毎回残る**。

## 実装計画

並列エージェントで進める。基点は各 PR 直前の `main`。各単位は自分の worktree で作業し、触るファイルを下の表に限る。

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U1 | 定数と検査: `MIN_TEXT_ABSOLUTE = 10`。`canvas.minText` の範囲検査(数・有限・10 以上)。`Config.fontFloor` の型と `loadConfig` の検査(10〜14 の数)。`applyConfig` で、図の `minText` が `fontFloor ?? 14` 未満なら throw(`canvas` の図だけ) | `lib/tokens.ts`、`lib/dsl/render.ts`(`:46` 付近)、`lib/types/core.ts`(`SlideCanvas` の注)、`lib/types/project.ts`、`lib/config.ts`、`test/config.test.ts`(無ければ新規 `test/font-floor-config.test.ts`) | なし(最初) |
| U2 | 出力: `canvas.minText < 14` のときだけ、ルートに `data-min-text` を足す。それ以外は byte 同一 | `lib/emit.ts`(`:105-106`)、`test/font-floor-emit.test.ts`(新規) | U1 |
| U3 | lint-svg: 床 = `data-min-text` ?? 14(14 の直書きを 1 か所の定数に)。`--fix` の引き上げ先を床に。`font-floor-not-permitted`(エラー)。失敗に数えない「お知らせ」の階層と `font-floor-lowered` の 1 行(単独実行用)。設定は SVG のあるディレクトリから探す・`--config` | `lint-svg.ts`(`:56-57` の階層、`:98-110`、出力の整形)、`test/lint-cli.test.ts` に追加(または新規 `test/lint-font-floor.test.ts`) | U1(`fontFloor` の読み取り) |
| U3b | `build` が `canvas.minText < 14` の図に 1 行出す(`⚠ <out>: 文字の下限を Npx に下げている(fontFloor M。投影には向かない)`)。`build` は図のデータを持つので lint の出力に頼らない | `build-diagram.ts`(`:140-180` の書き出しの付近)、`test/cli.test.ts` に追加(標準エラーに行がある・`minText ≥ 14` では無い) | U1 |
| U4 | `check` の規則 `font-floor-lowered`(info)。`RULE_DOCS` の登録、`slide-min-text` の隣で出す。`--rules` / `--explain` の文面 | `lib/rules.ts`(`:83-84`、`:633-637`)、`test/slide-canvas.test.ts` に追加 | U1(定数) |
| U5 | 文書: README の `canvas` の節(`:1001-1010`)に「下げる場合」(投影しない手元・配布用が対象、`slide` / `fill` の実効 12px とは別の層)、共通設定(`:1113`)に `fontFloor`、14px 未満の行(`:1181`)の注、`check` の規則の一覧、`skills/svg-diagram/SKILL.md`(`:41` の 14px の記述)。この ADR の状態と「実装」の表 | `README.md`、`skills/svg-diagram/SKILL.md`、この ADR | U2〜U4 のあと |

U2・U3・U4 は互いに別ファイルなので、U1 のあとに並行できる。型の追加は U1 に集める(各単位は型を触らない)。

### テスト方針(フォントに依存する絶対値を使わない)

- 文字の幅・高さ・行数・座標を**主張しない**(フォントで変わる)。次の関係だけを主張する。
  - `canvas: {minText: N}` で描いた SVG の `font-size` の最小値が、役割の表と倍率から決まる値(`round(14 × canvasFontScale(N))`)になる。これは測定ではなく `lib/tokens.ts` の計算なので、フォントに依存しない(`test/slide-canvas.test.ts:21` の `Math.min(...sizes) === 24` と同じ種類)。
  - `data-min-text` がルートにある ⇔ `minText < 14`。ない図(`canvas: 'slide'`、`canvas` なし、`minText: 14`)は、**属性が付く前後で SVG が同一**(文字列の完全一致を、基点で生成した値ではなく「`data-min-text` を除いたものが従来の出力と一致する」で確かめる。比較は同じ環境の中で完結させる)。
  - lint-svg: (a) 属性なしで 10px の文字 → `font-size-too-small`、(b) `data-min-text="10"` で 10px の文字、`.svg-diagram.json` の `fontFloor` なし → `font-floor-not-permitted`、(c) `fontFloor: 10` あり → 通り、お知らせが出て終了コード 0、(d) `data-min-text="10"` で 9px の文字 → `font-size-too-small`、(e) `--fix` は床まで上げる。SVG は手書きの小さな文字列(フォントも測定も使わない)にする。
  - 設定: `fontFloor` が数でない・9・15 → `loadConfig` が throw。`canvas.minText` が 9・`NaN` → throw。図の `minText` が `fontFloor` 未満 → `applyConfig` が throw。
  - `check`: `font-floor-lowered` が info で出る(`minText < 14`)、`minText ≥ 14` では出ない、`accept` で理由つきの info のまま。文面の数字は `canvas.minText` から作るので、測定値に依存しない。
- 既存のテストは変えない。`test/dsl-exports.test.ts` の fixture は、公開 API を足さないので変わらない(U1 が公開する名前があれば更新)。
- byte 同一の回帰は、`examples/*.ts` を基点と変更後で描いて SVG を比べるスクリプトを PR の説明に添える(CI の対象にはしない)。

## 未決

1. **縮めて見せるキャンバスの換算**。`minText` はキャンバスの単位で、実効の大きさ(縮尺をかけたもの)ではない。2304×1296 のキャンバスを 1280 幅に縮めて見せるなら、実効 10px は `minText ≈ 18`。`canvas: {displayWidth}` を足し、実効で検査するか(`slide` / `fill` の `minEffectiveFont` と同じ考え方)、著者の換算に任せるか。今回は後者(`canvas` は 1:1 の前提を変えない)。
2. (解決済み)**10 という絶対の下限**: ユーザー決定により 10px のまま。投影しない手元・配布用の稠密な `canvas` の図が対象で、`slide` / `fill` の実効 12px とは別の層(D2)。
3. **`density` の糖衣**。`minText` に展開する名前(`'dense'` = 14 など)を後から足すか。要望者に、数のほうが良いかを聞く。
4. **`--html`(ADR 0006)の `minText < 14`**。HTML 出力に lint-svg 相当の許可の検査が無い。`applyConfig` で足りるか。
5. **`slide` / `fill` の図で実効 12px 未満を許す手段**(要望の範囲外)。必要なら、`minEffectiveFont` の設定化として別の ADR で扱う。
6. 要望者の元のソースで、`canvas: {minText: 10}` に直したとき、実際の見た目(1280×720、10px)が読めるかの確認。
