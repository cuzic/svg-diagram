# ADR 0020: TOC の残りの図(NBR・TT)と検査(H4・H5・H8)。H6 は検査の誤検知、H10 は取り下げ

- 状態: 一部実装済み(H6: #219、U1 NBR: 本 PR)。U2 TT・U3 PRT の検査と `mirrors` は未着手。Opus レビュー 2 巡(第 2 巡でブロッカー無し)。依頼元の返事(2026-10-15)を、下の「依頼元の返事」に反映
- 日付: 2026-10-15
- 基点: `main`(ADR 0019 の U0〜U4 マージ後)
- 関連: ADR 0015(`tree`・`tocCheck`・`kind: 'blocks'`・凡例)、ADR 0019(ALAP・`maxNodeW: 'auto'`。H1〜H3)、ADR 0016(戻り辺・AND の弧)。要望の原文は `medius-research/docs/svg-diagram-feature-requests.md` の H 節(H4・H5・H6・H8・H10)。レビューで、H6 は検査の誤検知(#219 で修正)、H10 は前提が違う(図に題名は描かれない)と分かり、本 ADR の決定から外した
- 範囲外: H7・H9(不具合として #199・#198 で修正済み)、H11(ADR 0017 の `minText`)、H1〜H3(ADR 0019)

## 背景

TOC の 6 つの図(CRT・FRT・PRT・TT・NBR・EC)のうち、NBR と TT だけは専用の描き方・検査がない。依頼元の優先順は H4+H5 → H8。

| ID | 要望 | 優先度 |
|---|---|---|
| H4 | `tree: 'nbr'`、`role: 'tipping'`・`'trim'`、`foldsInto`。lint(転換点が AND の節か、トリミングが転換点の手前か) | 中 |
| H5 | TT の「単位」(現状 + ニーズ + 行動 → 新しい現実)の描画、`role: 'need'` | 中 |
| H6 | AND の弧が、戻り辺も入る節にかかるとエラー | 中(**検査の誤検知。PR #219 で修正済み**) |
| H8 | `tocCheck` の追加規則(PRT の最下段が行動でない、障害:中間目標が 1:1 だけ、FRT の DE と CRT の UDE の対応、NBR の枝に転換点がない、障害の文が「〜ない」「不足」で終わる) | 中 |
| H10 | スライド用に、図の中のタイトル・出典の行を消す `chrome: false` | 低(**取り下げ。下の「H10 の扱い」**) |

ユーザー決定: 手動の整列ヒントは作らない(本 ADR に該当は無い)。

## 現状(コードで確かめた事実)

**役割と凡例(H4・H5)。** `CauseRole`(`lib/types/diagrams.ts`)は `effect ude root de injection goal obstacle io action start step risk measure precondition`。見た目は `CAUSE_ROLES`(`lib/toc.ts`)の `{tone, double?}`、障害・リスクは六角形(`hex`)。凡例(`legend: 'auto'`、ADR 0015 D6)の文言は `lib/rules.ts` の `role:*` の表(`:113`)に並ぶので、役割を足すときは凡例の表にも足す。辺の種類は `kind: 'blocks'`(破線 + 横棒)と `back: true`(戻り)で、検査の因果の数え方から外れる(`toc-rules.ts` の `isCause`)。`tree` は `'crt' | 'frt' | 'prt' | 'tt'`(型 `:145`、検証 `lib/dsl/diagrams.ts:134`)。`prt` / `tt` には、`toc-orphan`・`toc-cycle-undeclared`・(`precondition` への)`toc-source-has-cause` だけが掛かる(ADR 0015 D2。`toc-source-has-cause` は全部の `tree` で `precondition` に掛かる)。

**TT の大きさ(H5)。** 依頼元の「3 入力の AND を 6 段つなぐと階段状で縦に 1216px」を、ADR 0019 の U2・U3 の後の `main` で測った(6 単位。現状の事実 1 + ニーズ 6 + 行動 6 + 結果 6。AND は 3 入力、前の単位の結果が次の単位の「現状」。固定幅のモックフォント、幅 1800・高さ予算 1080。値は固定しない):

| 条件 | 図の大きさ | 備考 |
|---|---|---|
| `layer: 'asap'`、`dir: 'up'`、`maxNodeW: 'auto'` | 1800x872 | `auto` が 120 まで狭めた |
| `layer: 'alap'`、`dir: 'up'`、`maxNodeW: 'auto'` | 1800x732 | `auto` は 260 のまま(箱が広く、行が少ない) |
| `layer: 'alap'`、`dir: 'right'`、`maxNodeW: 'auto'` | 1800x521 | |

短いラベルでは、ADR 0019 で大きさの不満の多くが解ける(ALAP で入力が結果の手前に寄り、`auto` が広い箱を選べる)。**ただし実際の日本語のラベル(25 字ほど)では、`canvas` が 1800x1080 のとき 3 つとも収まらず throw した**(レビューでの実測。幅だけ 1800 で `canvas` 無しなら、`asap` 1760x1172、`alap` 1760x872、`alap`・右向き 1760x731)。大きさはラベルの長さに依存する。役割(`need`)と、単位を書く手間(同じ形を 6 回書く)と、検査は、大きさと別に残る。

**AND の弧と戻り辺(H6)。** エラーは `lib/verify-handlers.ts` の `cause: the AND arc into "e9" also covers the arrow from "e10" (it reads as part of the AND)`。再現した(結果 `e9` に AND の弧、`e9` から出る `e10` が `back: true` で `e9` へ戻る。全方向・ALAP の有無・`returns` の指定で。依頼元の `diagrams/story/f2b-frt.ts` も `main` で同じに失敗する)。**原因は描画ではなく検査の誤検知**: 戻り辺は箱の**反対側**に着く(f2b-frt では、AND の矢印が箱の下辺、戻り辺が上辺)が、検査は矢じりの「弧に沿った座標」だけを弧の範囲と比べ、矢じりが箱のどの辺にあるかを見ない。戻り辺の座標が偶然、弧の範囲に入ると、誤って問題になる。当初の見立て(戻り辺の矢じりが `end === 0` で並べ替えに割り込む)は誤り(`graph-layout.ts:566-568` は反転した辺の `from`/`to` を保ち、戻り辺は別の辺のポートの並びに入る)。**修正は PR #219**(弧に垂直な座標が AND の矢印と違う矢印は、弧の下ではないので見ない。SVG は変わらない)。

**タイトルと出典(H10)。** `diagram({title})` は SVG の `<title>` と `aria-labelledby` にだけ使われ、**図の中には描かれない**(描画して確かめた。`d.title` を読むのは `a11y-no-title` の検査だけ)。図に見えるのは `sourceLine`(出典の行。`layout-util.ts` の `withSourceLine`)だけで、これは書かなければ出ない。依頼元の TOC の図(`t4-prt.ts`・`t3b-nbr.ts`)に `caption()` は無い。

## 依頼元の返事(2026-10-15)

- **H10**: 取り下げでよい(依頼元の勘違い。title は図に描かれず、見えるのは `sourceLine` だけ)。本質は「文書用とスライド用で 1 つのソースを使い分けたい」。**将来**: `sourceLine` を書き換えずに、CLI の `build` / `preview` のフラグ(例: `--no-source-line`)か環境変数で、出典行だけ消す。優先度は低い。
- **NBR の `foldsInto`**: 箱の注記の文字(「施策 3 に組み込む」)で足りる(辺にすると、図に施策の節を足すことになり、図が大きくなる)。あれば便利なのは、注記を箱の端に小さく出す専用の書式だけ(将来)。D1 の実装(U1)は、この方針のとおり。
- **TT の実物で測った**(`toc/t5-tt.ts`・`poc/p5-tt.ts`・`toc/t4-prt.ts`・`toc/t3-frt.ts`。`canvas` を `width: 1920` に替えた写しを、現在の `main`(ADR 0019 の U0〜U5 を含む)で `build`。依頼元のファイルは変更していない。フォントは実行環境のもの。値は固定しない): 高さは `layer: 'asap'`(以前と同じ配置)→ 既定の ALAP の順に、`t5-tt` 1216 → 598、`p5-tt` 1276 → 719、`t4-prt` 1556 → 710、`t3-frt` 1158 → 1016(いずれも幅 1920)。以前の報告(1216 / 1276 / 1556)と一致し、**ADR 0019 の ALAP で、依頼元の実物の TT・PRT の大きさは解けた**(単位グループのレイアウトは要らない。D2 の未解決はこれで閉じる)。FRT の `cause-parallel`(e3→e4 と i5→e4)は、ADR 0016 D11 / U13(経路)の仕事として残る。

## 論点

1. NBR の「転換点」「トリミング」「組み込み」を、新しい役割・辺で書くか、既存の `blocks` と箱のラベルで済ませるか。
2. TT の「単位」を新しいレイアウトのバンドにするか、ADR 0019 で足りるとして役割と書き方の助けだけにするか。
3. `mirrors`(FRT の DE と CRT の UDE の対応)は、別の図(別の `causeTree`)をどう参照するか。
4. 日本語の文末の検査(「〜ない」)の扱い(規則の偽陽性)。
5. (H6 は検査の誤検知と分かり、PR #219 で直した。論点から外す。)

## 決定

### D1: NBR は `tree: 'nbr'` と役割 `tipping`・`trim`、節の注記 `foldsInto`(H4)

- **`tree: 'nbr'`** を足す(型・検証・`toc-rules.ts`)。ADR 0019 D1 の ALAP の既定の対象にも入れる(`layer: 'asap'` で戻せる)。`trim` は `keep` に入れない(ALAP で、断つ先の手前へ動く)。
- **`role: 'tipping'`**(転換点): 見た目は `{tone: 'danger', double: true}`(二重枠。UDE の赤との区別は二重枠で、色だけにしない)。
- **`role: 'trim'`**(トリミングの施策): 悪い枝を断つ施策。`injection` と同じく原因を持たない節として扱う(`toc-source-has-cause`。現状は `tree === 'frt'` の `injection` だけなので、`nbr` の `injection` と `trim` を足す)。見た目は `{tone: 'changed'}` に**破線の枠**。**`CAUSE_ROLES` に `dashed?: boolean` を足し**、`LaidOutCause.nodes` に持たせ、`renderCause` の箱と六角形の両方、凡例の見本(`layout-handlers.ts` の凡例の作り、`LaidOutLegendItem.swatch`(`types/containers.ts`)に `dashed` を持たせる、`emit-boxes.ts` の見本の描画で `dashed` を渡す)を、`dashed` を読むように直す(いまの破線は `removed` のトーンの属性だけ)。`kind: 'blocks'` の辺で、断つ先へつなぐ(ADR 0015 D5 のまま)。
- **`foldsInto: '<text>'`(節の属性。`trim` だけ)**: 元の施策へ組み込む印は、**辺ではなく、箱の注記の 1 行(`sub`)として描く**(`→ <text> に組み込む`)。注記は**DSL の層で `sub` に足す**(`coreDriver` の `到達 UDE n` と同じ。配置の層で足すと、`causeTexts` が測る文字に入らず、strict-width の補助が throw する)。`coreDriver` は `trim` の節を数えない・注記を足さない(`trim` は原因を持たない節に見えるので、数えると `到達 UDE 0` が付く)。依頼元の NBR(`t3b-nbr.ts`)では、組み込み先の施策(「施策 1」「施策 3」「施策 5」)は FRT の節で、NBR の図の**中に節が無い**ので、辺では書けない。文字列にして、図の中に節があるかを問わない(あっても辺は引かない)。辺の種類 `folds` は作らない(開いた矢じり・辺の種類の型・凡例・`toc-analysis` の探索・層の決定への影響が、すべて要らなくなる)。凡例には出さない(注記は箱の文字なので)。
- **凡例**(`legend: 'auto'`): `tipping`・`trim` を `role:*` の表に足す(`lib/rules.ts` の `role:*` の表と `satisfies` のキー、`usedNotation`、凡例の見本)。
- **検査**(`tree: 'nbr'` の図だけ。D6 の規則):
  - `toc-nbr-parts`: `trim` が無い、または `ude` が無い。
  - `toc-nbr-no-tipping`: **切断で判定する**: `tipping` の節を取り除いたとき、原因を持たない節(入る辺が無い節。`injection` に限らない。依頼元の NBR は、枝の根が普通の節と `precondition`、トリミングが `injection`)から `ude` へ至る道が残るなら、転換点の無い枝がある。**たどるのは因果の辺だけ**(`blocks`・`back` は通らない)。線形時間(道の列挙はしない)。
  - `toc-nbr-tipping-not-and`: `tipping` の節が、AND(`from` が配列)の結果でない。依頼元の NBR の転換点は、3 つとも AND の結果。
  - `toc-nbr-trim-too-late`: `trim` が `blocks` で断つ先が、`tipping` より**結果側(下流)**にある。**`tipping` の節そのものを断つのは良い**(依頼元の書き方)。

### D2: TT は役割 `need` と、単位を書く補助。専用のレイアウトは、測ってなお要るときだけ(H5)

- **`role: 'need'`**(ニーズ): 見た目は `{tone: 'accent'}`(二重枠なし)。`root`・`goal`・`start` と同じ色で、二重枠の有無だけが違う(凡例で区別する。色だけにしない)。TT の単位は `from: ['<現状 or 前の結果>', '<need>', '<action>']` の AND(いまのまま)。依頼元の `t5-tt2.ts` は、ニーズを `precondition` で書いている(移行は可。`need` は書き換えを強制しない)。
- **補助 `transitionUnits()`**(DSL。レイアウトを持たない糖衣): `[{id, current?, need, action, result, resultRole?}, ...]` から `causeTree` の節と辺を作る。**id は単位ごとに 1 つ、書き手が与える**(その単位の `result` の id。`accept`・凡例・`mirrors` が使う)。ほかの節の id は、`<id>.need`・`<id>.action`、1 つ目の単位の現状は `<id>.current`(`current` に既存の節の id を書けば、それを使う)と決める。役割は既定で `current`: 1 つ目は `precondition`・2 つ目以降は前の `result`、`need`: `need`、`action`: `action`、`result`: `io`。**単位ごとに `resultRole` で上書きできる**(最後の結果を `goal` にするなど)。`test/fixtures/dsl-exports.json` に足す。
- **専用のレイアウト(単位を詰めて積む)は、いま作らない**。ADR 0019 の U2・U3 の後に、6 単位の TT(現状 1 + 単位 6。結果が次の現状)を、固定幅のモックで測った: 短いラベルでは `layer: 'asap'`・`dir: 'up'`・`maxNodeW: 'auto'` が 1800x872、`alap` が 1800x732、`alap`・`dir: 'right'` が 1800x521。**ただし、実際の日本語のラベル(25 字ほど)では、`canvas` が 1800x1080 のとき 3 つとも収まらず throw した**(幅だけ 1800 で `canvas` 無しなら、`asap` 1760x1172、`alap` 1760x872、`alap`・右向き 1760x731。レビューでの実測)。ラベルの長さに依存するので、「ADR 0019 で H5 の大半は解けた」とは言わない。依頼元の `t5-tt2.ts` は、段に分けて通っている。**依頼元の元の 6 単位のソースで測った(上の「依頼元の返事」): `canvas` 1920 幅で 1216 → 598px。単位グループのレイアウトは要らない**。
- **検査**: `toc-tt-unit`(`tree: 'tt'`): AND の結果が、`need`(または `precondition`)と `action` を持たない。

### D3: FRT の DE と CRT の UDE の対応は、節の `mirrors` と、`causeTree` の opts の `mirrors: <CRT の band>`(H8 ③)

- 節に `mirrors?: '<ude の id>'`(`role: 'de'` か `'goal'` の節。FRT は最終の望む結果を `goal` で書くことがある)。`causeTree(nodes, links, {tree: 'frt', mirrors: crt})` の `crt` は、**`causeTree()` が返した CRT の band(値)**。check・build は、ソースを `import()` して `define()` を呼ぶので(`load-source.ts`)、別のモジュールが export した band も、チェックの時点で生きた値として届く。`source-deps` が静的な `import` をたどるので、`--stale`・`--drift` も CRT のファイルを追う。
- **費用**(レビューの指摘): CRT のファイルは、band をモジュールのトップレベルで export する形に直す必要がある。**FRT の band に CRT の band を持たせない**: `causeTree()` の時点で、CRT の**節の id と `ude` の id だけ**を取り出して持つ(`TocBand` の `mirrors: {ids, udes}`)。band ごと持つと、`consistency.ts` の `textsOf`(band の全フィールドをたどる)が CRT のラベルを FRT の図の用語として数え、用語の揺れ(warn)を出し、`nestedBandsOf`・`walkBands` が降りれば CRT の `toc-*` 規則と凡例の役割まで FRT の図の中で走る。テストで固定する(CRT のラベルが FRT の `consistency` に出ない)。「型で追える」とは言わない(節の `mirrors: string` は、`opts` より先に `nodes` から推論されるので、CRT の id との照合に型は使わない。実行時の検査だけ)。
- **規則は 1 つ**: `toc-mirror`(メッセージ 3 種): `mirrors` の id が CRT に無い・`ude` でない / CRT の `ude` に対応する `de`(`goal`)が無い / 同じ `ude` を 2 つ以上が `mirrors` している。FRT が CRT の一部だけを扱う図では「対応が無い」が出る(info が既定。`accept` で理由つきで外せる)。CRT の band の `tree` が `'crt'` でないときは throw。

### D4: 障害・中間目標・行動の検査(H8 ①②④)

- `toc-prt-bottom-not-action`(`tree: 'prt'`): **`io` の鎖の底**(`io` / `goal` のうち、入る辺に `io` が無いもの)に、`action` が入っていない。依頼元の `t4-prt.ts` は、障害(`obstacle`)を入る辺の無い節として書くので、「入る辺が無い節で `action` でないもの」と定義すると、障害 8 つが全部出る(レビューで確認)。底の `io` に `action` がつながっているかで見る。
- `toc-prt-one-to-one`(`tree: 'prt'`): 障害と中間目標が**全部 1 対 1 だけ**(どの `io` にも `obstacle` がちょうど 1 つ、どの `obstacle` も `io` 1 つにつながる)で、`io` が 2 つ以上のとき。
- `toc-obstacle-phrase`(`tree: 'prt'`・日本語のラベル): 障害のラベルが「ない」「無い」「不足」で終わる(末尾の句読点と閉じ括弧は除いて判定する。「できない」「足りない」は「ない」に含まれる)。**常に info**(`tocCheck: 'strict'` でも warn にしない)。偽陽性が出る(「少ない」「危ない」「〜しかない」。依頼元の PRT の障害 2 つ(「時間がない」「書かれていない」)にも出る)ので、`accept` で理由つきで外せる info に留める。**規則ごとの重大度**が要る: いまの `tocRules`(`lib/rules.ts`)は、すべての `toc-*` に 1 つの重大度を付けるので、`TocFinding` に `severity?: 'info'`(固定)を足す(`rules.ts` で `f.severity ?? severity`)。

### D5: H6 は検査の修正(PR #219)

決定は「現状」に書いたとおり。本 ADR の実装単位には入れない。

### D6: 規則の登録と重大度

- 新しい規則は `toc-rules.ts` の `TocRule` に足し(`toc-nbr-parts` `toc-nbr-no-tipping` `toc-nbr-tipping-not-and` `toc-nbr-trim-too-late` `toc-tt-unit` `toc-mirror` `toc-prt-bottom-not-action` `toc-prt-one-to-one` `toc-obstacle-phrase`)、`RULE_DOCS` に登録する(`accept` が使える)。重大度は ADR 0015 D3 のまま(info 既定、`tocCheck: 'strict'` で warn。`toc-obstacle-phrase` だけ常に info)。
- 純粋な関数(座標を見ない)。`tree` を書いた図にだけ掛かる。ADR 0015 D2 の「`prt` / `tt` には `toc-orphan` と `toc-cycle-undeclared` だけ」は、`toc-source-has-cause` が `precondition` に全部の `tree` で掛かるので不正確(レビューの指摘)。

### H10 の扱い: 取り下げ

`diagram({title})` は図の中に描かれない(SVG の `<title>` と a11y 用だけ)ので、「題名が二重になる」は、依頼元の図では `caption()` が原因のはず(TOC の図には無い)。出典の行は、`sourceLine` を書かなければ出ない。**要望の本質は「1 つのソースを、文書用とスライド用で使い分けたい」**で、図ごとの指定(`chrome: false`)では、ソースを媒体ごとに書き換える手間が残る。実装するなら、ビルド側の切り替え(CLI の `--no-source-line` や、`define()` に媒体を渡す仕組み)の方向だが、依頼の再確認が先(依頼元に、題名が描かれているのかを確かめる)。本 ADR では実装しない。

## 代替案

| 案 | 採らない理由 |
|---|---|
| NBR を `kind: 'blocks'` と箱のラベル(「転換点:」)だけで書く(現状) | ツールが転換点を知らないので検査できない。凡例にも出ない |
| TT の単位を専用のレイアウト(単位グループ)にする | 大きさはラベルの長さに依存する(短いラベルでは ADR 0019 で収まる。実際のラベルでは収まらない図がある)。依頼元の元の 6 単位のソースで測ってから、要るなら別 ADR |
| `mirrors` を CRT の id の文字列(`'crt#u3'`)で参照する | 別ファイルの図を文字列で参照すると、`check` が別の図を読む仕組みが要る(ADR 0015 の未決の「図をまたぐ用語」)。band の値を渡す。band の値を渡せば、型で追える |
| 障害の文末の検査を warn にする | 日本語の文末の偽陽性が出る。info で、`accept` できる |
| 組み込みを辺の種類 `folds` で書く | 依頼元の組み込み先は FRT の節で、NBR の図の中に無い。型・凡例・矢じり・層の決定・`toc-analysis` に波及する。注記の文字列で足りる |
| `mirrors` を別々の 3 つの規則にする | 同じ対応の 3 つの見方。1 つの規則に 3 つのメッセージ |

## 影響

- **新しい指定**: `tree: 'nbr'`、`role: 'tipping' | 'trim' | 'need'`、節の `foldsInto` / `mirrors`、`transitionUnits()`、`causeTree({mirrors})`。型・検証(`CAUSE_ROLES` の列挙を出すエラーメッセージ `dsl/diagrams.ts`・`dsl/text-bands.ts` を含む。メッセージに一致するテストを確かめる)・凡例・`dsl-exports` の fixture に足す。README / SKILL への追記は、運用に従い PR 本文に書いて最後にまとめる。
- **変わる出力**: 既存の図は変わらない(新しい役割・指定を書かない限り。`legend: 'auto'` は使った役割だけを出す)。
- **触るファイル**: `lib/types/diagrams.ts`、`lib/dsl/diagrams.ts`、`lib/dsl/text-bands.ts`、`lib/toc.ts`(`CAUSE_ROLES` の `dashed`、ALAP の既定の対象)、`lib/toc-rules.ts`(`TocRule`・`TocFinding.severity`)、`lib/rules.ts`(凡例の表・`satisfies`・`usedNotation`・`RULE_DOCS`・`tocRules`)、`lib/layout-handlers.ts`(凡例の見本)、`lib/emit-figures.ts`(`trim` の破線枠。箱と六角形)、`lib/emit-boxes.ts`(凡例の見本の破線)。`toc-analysis.ts`・`layered-route.ts`・`emit-common.ts` は触らない。

## 実装計画

| 単位 | 内容 | 依存 |
|---|---|---|
| (済) | H6: 検査の誤検知の修正(PR #219) | |
| U1 | D1 NBR(`tree: 'nbr'`・役割・`dashed`・`foldsInto`・凡例・規則・`TocFinding.severity`) | なし |
| U2 | D2 TT(`need`・`transitionUnits()`・`toc-tt-unit`) | U1 と独立 |
| U3 | D4・D3 PRT の検査と `toc-mirror` | `TocFinding.severity` は U1 |

依頼元の優先順(H4+H5 → H8)に合わせ、U1・U2 → U3。

## 未解決

- D1 の `toc-nbr-tipping-not-and` が、実際の NBR(転換点が AND でない書き方)で偽陽性になるか。依頼元の NBR の実例で確かめる。
- `mirrors` の CRT の band を、別ファイルから `import` する形が、`svg-diagram build` の単位(1 ファイル 1 図)で成り立つか(レビューでは `import()` で生きた値として届くと確認。実装時にテスト)。
- H10 の将来: CLI の `--no-source-line` のようなフラグ(依頼元の返事。優先度は低い)。
