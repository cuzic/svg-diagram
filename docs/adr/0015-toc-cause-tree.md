# ADR 0015: TOC の因果ツリー(`causeTree`)を TOC の書き方に合わせる(役割・検査・中核ドライバー・断つ辺・凡例)

- 状態: 実装済み(G3: #166、G7: #167、G8: #168、G4: #173・#178、G9: #174・#179。`prt` / `tt` の規則は第 2 段で未着手)
- 日付: 2026-10-14
- 基点: `main`(54f0784、PR #162 まで)
- 関連: ADR 0016(戻り辺・循環の AND・AND の並走。G1 / G2 / G6 はそちらに追記)、ADR 0010(幅と向き・日本語の折り返し。G5 / G10 はそちらに追記)、ADR 0014(`layoutCheck` の仕組み)、ADR 0008(同じ依頼元)。要望の原文は `medius-research/svg-diagram-feature-requests.md` の G 節(G1〜G10)

## 背景

資料づくり側が、現状ツリー(CRT)と未来現実ツリー(FRT)を TOC の標準の書き方(Dettmer、Flying Logic のガイド)に合わせて描き直して、10 件の要望(G1〜G10)が出た。最初に描いた「戻り矢印つきの 1 本鎖」は TOC の図ではないと指摘され、しかも `check --strict` は通った。つまり、ツールは「TOC の図になっていない」ことに気づけていない。

| ID | 要望 | 扱う ADR |
|---|---|---|
| G1 | 戻り辺(`back: true`)を層の決定から外す | **0016 D9** |
| G2 | 循環の途中の AND を描く | **0016 D10** |
| G3 | `role: 'precondition'`、root と Action の区別 | **本 ADR D1** |
| G4 | TOC の検査(UDE の数、根本原因に先行、一本鎖、FRT の部品、孤立) | **本 ADR D2・D3** |
| G5 | 上向きのまま段組み・幅 | **0010 D7** |
| G6 | AND の矢印の並走・順序の指定 | **0016 D11** |
| G7 | 中核ドライバーの自動の強調 | **本 ADR D4** |
| G8 | `kind: 'blocks'`(断つ辺)、ネガティブブランチ | **本 ADR D5** |
| G9 | 凡例 `auto` が FRT で出ない | **本 ADR D6** |
| G10 | 日本語の長い文が語の途中で折れる | **0010 D8** |

優先順は原文のとおり(G1+G5 → G4+G3 → G7)。本 ADR は、TOC 専用の G3・G4・G7・G8・G9 を決める。

## 現状(コードで確かめた事実)

ファイル:行は、基点の `main` のもの。再現は、フォントに依存しない形(層の上下・折れの数・警告の有無)で測った(scratchpad の最小例。リポジトリには残さない)。

### 役割・AND・循環の実装

- 役割は 13 個(`CauseRole`、`lib/types/diagrams.ts:95`)。見た目は `CAUSE_ROLES`(`lib/toc.ts:23-36`)が、役割 → (トーン, 二重枠)で決める。`root` と `goal` と `start` が二重枠(accent)、`ude` と `risk` が danger(赤の破線。`lib/tokens.ts:122` の danger が `dashed: true`)、`obstacle` と `risk` が六角形(`lib/toc.ts:137`、描画は `lib/emit-figures.ts:288`)。**`precondition` は無い**。
- **Action の役割は既にある**: FRT の施策は `injection`、移行ツリーの行動は `action`(どちらも `changed` トーン)。`root`(accent の二重枠)は CRT の根本原因で、見た目も別。「root が Action と区別できない」は、`injection` / `action` を使えば満たされる。足りないのは「統制できない現状の事実」だけ。
- AND は `from` が配列のリンク。矢印ごとの行き先 1 つに束ね、描けるときだけ矢じりの手前に弧(`lib/toc.ts:105-112`, `:151-163`)。矢印が実体の同じ側・同じ向きで着かない、または弧の分の余裕が無いと `loose` に入り(`:116-120`)、`lib/verify-handlers.ts:181` が「循環の矢印は反対側から着く」と止める。
- **`back: true` の記法は無い**。`CauseLink` は `{from, to, line}` だけ(`lib/types/diagrams.ts:109-114`)、`causeTree()` の検証も `line` だけ(`lib/dsl/diagrams.ts:110`)。循環は書けるが、どの辺が「戻り」かは `layoutLayered` の DFS が決める(`lib/graph-layout.ts:168-182`。**入力の並びの先頭の節から**たどり、スタック上の節への辺を逆向きにする)。`causeTree` は `start` を渡さない(`lib/toc.ts:114`)ので、並びの最初の節が起点になる。README の「循環も書ける(戻る矢印として描く)」(`README.md:305`)はこの挙動。
- 辺の描き方は `arrowPath`(`lib/emit-common.ts:123`)で、矢じり(三角)固定。太さは引数 `width`(既定 2)で変えられる。T 字の端は無い。

### G1 の再現(循環で UDE が最下段に落ちる)

`examples/toc-crt.ts` と同じ 7 節(`late` が最初の節)に、悪循環の戻り `late -> kpi` を足した。

| 入力 | 層(`late` と `kpi` の上下) | 折れの合計 |
|---|---|---|
| 循環なし | `late` は最上段、`kpi` は最下段 | 10 |
| 循環あり(節の並びは同じ) | **`late` が `kpi` より下**(最下段) | 14 |
| 循環あり(`kpi` を最初の節に並べ替え) | 正しい(`late` が上)。ただし `late -> kpi` が 4 折れ、`kpi -> start` も 2 折れに増える | 16 |

原因は DFS の起点が節の並びで決まること。`late` から始めると `late → kpi → start → wip → switch → late` と回り、**`switch -> late`(順方向の辺)が戻り辺として逆向きにされる**。意味上の戻り辺(`late -> kpi`)ではない。同じグラフが、節の並びを変えるだけで違う図になる。

### G2 の再現(循環の途中の AND)

FRT 風の `inj → tool`、`[tool, trust] → use`、`use → result`、`result → trust`(成果が信頼を生む循環)。

- `inj` から DFS すると `inj → tool → use → result → trust → use` と回り、**AND の一員 `trust -> use` が戻り辺にされる**(意味上の戻りは `result -> trust`)。`trust` が `use` より上の層に置かれ、`use` への矢印が反対側から着く → `loose: ['use']`、verify が止まる。
- 節の並びを `result` 先頭に変えると止まらない(が、折れは 8 → 12)。
- AND の中の **原因そのものが戻り辺**(`[tool, result] -> use`、`use -> result`)だと、どの並びでも止まる(反対側から着くのが避けられない)。
- verify の文面は `use` だけを名指しし、どの原因が反対側から着くかは言わない。

### G6 の再現(AND の矢印の並走)

6〜8 節の AND を含む乱数のグラフ(種固定)18 個のうち 3 個で `[cause-parallel]` が出た。1 つを取ると(7 節、`[n0, n2, n3] -> n5` を含む)、節の並びを 5 通り試して、**4 通りで同じ警告が残り**、並びを逆にしたときだけ消えた。「節の順序を替える」という直し方は、確実な手段ではない。

並走の原因は経路にある。並走した 2 本は、AND の頭 `n5` に入る直接の矢印(`n2 -> n5`、隣り合う層)と長い矢印(`n3 -> n5`、層を飛ぶ)。直接の矢印の最後の縦の run(座標 470)と、長い矢印がダミーの列で最後の曲がりまで通る縦の run(座標 474)が、y 方向 22px にわたって 4px 隔てて並ぶ。直接の矢印の曲がり(`lib/layered-route.ts:124`)と長い矢印の最後の曲がり(`:132`)が別々に決まるため。詳細と直し方は ADR 0016 D11。

### G9 の調査(凡例 `auto` が出ない原因)

- `legend: 'auto'` は `applyAutoLegend`(`lib/rules.ts:156`)が、`usedNotation`(`:116`)の集めた記法のうち凡例に無いものを足す。**`usedNotation` が読むバンドは `connect` と `box` だけ**(`:123-127`)。`cause` バンドの実体の役割・トーン・線種・AND の弧は、集計に入らない。
- 再現: `legend: 'auto'` の図に `causeTree`(`injection`、`de`、`ude`、破線の AND つき)だけを置くと、凡例のバンドは**生成されない**。同じ図に `tone: 'danger'` の `box()` を 1 つ足すと、凡例は出るが**その box の「異常・注意」だけ**で、`causeTree` の役割は載らない。`legend-missing` 検査(`lib/rules.ts:261`)も同じ集計を使うので、警告も出ない。
- README の記述は、表では FRT を「凡例を添える」(`README.md:298`)、箇条では「色(`role` / `tone`)は凡例の自動生成にまだ入らない。見出しか手書きの `legend()` で添える」(`:305`)。**箇条の方が実装と合う**。表の書き方は、自動で出るように読める。**食い違いは README の表の言い回しにあり、実装は未対応**(出ない条件は「`cause` バンドが主題のとき、いつも」)。
- 役割の凡例は、トーンだけでは作れない: `de` と `io` は同じ `new` トーン、`effect` と `obstacle` は同じ `plain`、二重枠と六角形はトーンの外(`CAUSE_ROLES`)。役割そのものを凡例の単位にする必要がある。

### G10 の確認

`wrap: 'phrase'` は **図全体の指定**で(`diagram({wrap})`、`lib/dsl/render.ts:34`。`layoutWith` が `setWrapMode(data.wrap ?? 'phrase')`、`lib/layout.ts:37`)、**既定がすでに `'phrase'`**。band 単位の指定は無く、`causeTree` の `measureNode`(`lib/tree.ts:43`)も同じ全体の指定を読むので、「band 単位で効くか」は、全 band に効く、が答え。ただし `'phrase'` が束ねるのは**カタカナの連続と漢字の連続だけ**(`lib/wrap.ts:34-39`, `:53`)で、ひらがなは束ねない。依頼の折れ方は、既定のまま出る(`maxNodeW: 110` の実測で「現場が協力 / せず、形だ / け使う」。`wrap: 'char'` でも同じ)。詳細は ADR 0010 D8。

## 論点

1. 役割を 1 つ足すだけか、「統制できるか」を別の軸にするか(G3)。
2. TOC の検査を、`causeTree` を使う全部の図(`relationDiagram` / `pdpc` を含む)に掛けるか、TOC の図だけに掛けるか。どの種類の TOC の図かを、どう知るか(G4)。
3. 検査の重大度の仕組みを、ADR 0014 の `layoutCheck` に乗せるか(G4)。
4. 中核ドライバーを数える範囲(AND・戻り辺・UDE 以外の終端)(G7)。
5. 「断つ」は節への辺か、辺への辺か(G8)。
6. 役割の凡例の単位と、既存の図に警告が増えないこと(G9)。

## 決定

### D1. `role: 'precondition'` を足す。root と Action は既存の役割で区別する(G3)

- `CauseRole` に `'precondition'`(統制できない現状の事実)を足す。見た目は `CAUSE_ROLES` に `{tone: 'removed'}`(灰色の塗り・灰色の破線。`lib/tokens.ts:120`)。新しい描画は要らない(`removed` の箱は既に破線)。凡例の文言は役割で付くので(D6)、トーン名の「対象外」は見えない。色だけの違いにならないよう、赤の破線(`ude`)とは**塗り(灰色 / 白)と文字色**でも分かれる。形(六角形など)は足さない(代替案)。
- 並べ方: `precondition` は原因を持たない節として扱う(D3 の `toc-source-has-cause`)。FRT の「現状の事実との AND」は、`from: ['injection の結果', 'precondition']` と書く。AND の弧の仕組みはそのまま。
- **root と Action の区別は、新しい役割を足さずに既存で満たす**: `root` = CRT の根本原因(accent の二重枠)、`injection` = FRT の施策、`action` = 移行ツリーの行動(どちらも `changed`。統制できる行動)。README の役割の説明に「統制できるか」の軸を書く(U6)。FRT に `root` を使うのは検査で気づけるようにする(D3 の `toc-parts`)。
- `CauseRole` に足すだけなので、既存の図は 1 バイトも変わらない。

### D2. TOC の検査は、`causeTree(..., {tree: 'crt' | 'frt' | 'prt' | 'tt'})` を書いた図だけに掛ける(G4)

- 新しい opts `tree`(現状・未来現実・前提条件・移行ツリーのどれか)。**書かなければ検査は走らない**。`relationDiagram` / `pdpc` / `arrowDiagram` など、`causeTree` を中で使う別の図には掛からない(それらは TOC の図ではない)。種類を役割から推測しない(`ude` と `root` があれば CRT、のような推測は、`pdpc` の `goal` や手書きの役割で外れる)。
- 検査は純粋な関数 `lib/toc-rules.ts`(新規)に置く。入力は `CauseBand`(ノード・リンク・`tree`)だけで、配置の結果は要らない(座標を見ないので、`laidOut` の型は変えない)。`lib/rules.ts` の `lintAll` から呼び、`RULE_DOCS` に登録するので `accept` が使える。
- 規則(`toc-*`)。数える辺は `back` と `blocks` を除いた因果の辺。

| 規則 | 対象 | 出す条件 |
|---|---|---|
| `toc-ude-count` | `crt` | `ude` の数が 5〜10 の外(TOC の指針の範囲。examples の実測ではなく、原則から固定する)。理由文に「CRT の一部を抜き出した部分図(スライド用など)なら `accept` で許容する」と書く |
| `toc-parts` | `crt` / `frt` | `crt` に `root` が無い。`frt` に `injection` か `de` が無い。`frt` に `root` がある(施策は `injection`。`ude` はネガティブブランチで使うので数えない) |
| `toc-source-has-cause` | 全部 | `root`(`crt`)・`injection`(`frt`)・`precondition`(全部)に、先行する(入る)辺がある |
| `toc-chain-only` | `crt` / `frt` | 分岐も合流も AND も無い 1 本鎖(どの節も、入る辺・出る辺が各 1 本以下で、AND が 0) |
| `toc-orphan` | 全部 | どのリンクにも出てこない節(`graph-orphan-node`(`lib/rules.ts:521`)は `connect()` の線しか見ないので、`causeTree` の節には効かない) |
| `toc-cycle-undeclared` | 全部 | 循環があるのに、戻り辺に `back: true` が付いていない(ADR 0016 D9。どの辺が戻りとして扱われたかを書く) |

- 例: 依頼の最初の図(5 節の 1 本鎖、UDE 1 つ、AND なし、根本原因が循環に取り込まれている)は、`toc-ude-count`(UDE 1 つ)・`toc-chain-only`(分岐・AND なし)・`toc-cycle-undeclared`(循環に `back` が無い)で気づける。`back: true` を付けたうえで根本原因に入る辺が残っていれば、`toc-source-has-cause` も出る。
- `prt` / `tt` の規則は、第 1 段では足さない(`prt` は障害と中間目標の対、`tt` は 3 点セットが約束で、依頼に無い)。`tree: 'prt' | 'tt'` は予約し、`toc-orphan` と `toc-cycle-undeclared` だけが掛かる。

### D3. 重大度は ADR 0014 と同じ仕組み(info 既定、図ごとの opt-in、SVG に出さない)に乗せるが、指定は別に作る

- **仕組みには乗る**: 既定 info(`check --verbose` でだけ見える)、`diagram({tocCheck: 'strict'})` を明示した図だけ warn(`check --strict` で終了コード 1)。重大度を決める関数は `lib/rules.ts` の `layoutSeverity`(`:447`)の隣に `tocSeverity(d)` として足し、`accept` で個別に外せる。描画・`<metadata>` には出さない(SVG は byte 同一)。
- **指定は別にする(`layoutCheck` を流用しない)**: `layoutCheck` の意味は「`layout-*`(整列・余白)の重大度」(`lib/types/core.ts:133`)。TOC の検査は内容の約束で、配置の良し悪しとは別の軸。1 つに束ねると、整列を厳しく見たいだけの図が TOC の内容の指摘で落ち、逆もある。検査を運ぶ手段(`DiagramOpts` に 1 項目、`lib/dsl/render.ts` の検証、`lib/strict.ts` の既知の項目)は 0014 U0 と同じ形にする。
- 既存の図(`examples/toc-crt.ts` ほか)は `tree` を書かないので、何も変わらない。`examples/toc-crt.ts` に `tree: 'crt'` を足すなら、UDE が 2 つ(5〜10 の外)なので、`accept` の理由つきか、例を 5 つ以上に直す(U3 で判断)。

### D4. 中核ドライバー: `causeTree(..., {coreDriver: true})`(G7)

- 各「起点の節」(入る辺が無い節。`back` と `blocks` を除く)から、順方向の辺をたどって**到達できる `ude` の数**を数える。AND は、束ねた原因の全部が結果に到達するものとして数える(AND の一員も、結果が `ude` に至るなら到達する)。節自身は数えない。`blocks` の辺は通らない(防ぐ辺は、引き起こさない)。
- 強調: 到達数が最多で 2 以上の起点に、**`role` とは別の印(`core`: 太い枠と「中核」のバッジ)**を付ける。同数なら全部。**`role` は変えない**(`toc-parts` が CRT に `root` を求めるので、普通の CRT では根本原因が全部 `root` で、`role` を印にすると中核が見た目で区別できない。`relationDiagram` の `role` 上書き(`lib/dsl/diagrams.ts:236-240`)には倣わない)。`LaidOutCause.nodes[]` に `core?: true` を持たせ、描画は枠を太く(3.5)してバッジを角に置く。凡例の項目 `edge:` の隣に `mark:core`(中核ドライバー)を 1 つ足す(D6)。到達数は箱の注記に `到達 UDE n` と書く(`counts: false` で消す。`relationDiagram` の `出 n・入 n` と同じ作法)。起点の全部に書くので、強調されなかった根本原因の数も見える。
- **`relationDiagram` との違い**: あちらは出る辺の本数(直接の数)で、`ude` を見ない。こちらは間接を含む `ude` の数。`relationDiagram` は変えない。
- 実装は DSL の層(`lib/dsl/diagrams.ts` の `causeTree()` が、注記と `core` の印を足した節を返す)。配置のアルゴリズムは変えない。描画は、`core` の節の枠の太さとバッジを足す(`renderCause`)。注記の行が増えるぶん箱が高くなるのも、`coreDriver` を書いた図だけ。数える純粋な関数は `lib/toc-analysis.ts`(新規。`reachCounts`)。`coreDriver` を書かない図は byte 同一。

### D5. `kind: 'blocks'`: 辺の種類を足す(G8)

- `CauseLink` に `kind?: 'cause' | 'blocks'`(既定 `'cause'`)。`blocks` は「この節が、その節を防ぐ(トリミング)」。`from` は 1 つの節(配列は不可)。ネガティブブランチは、悪い結果を `role: 'ude'` で書き、施策から `blocks` の辺を引く。
- 見た目: 破線で、矢じりの代わりに**横棒(T 字の端)**。因果の矢印と形で区別できる(色だけにしない)。`arrowPath` に端の種類(`end: 'bar'`)を足す。
- 配置: 層の決定には、通常の辺として入れる(防ぐ側が原因側の下、防がれる結果が上。向きの意味が因果と同じなので、レイアウトを変えない)。AND には入れない。D4 の到達数・`toc-chain-only` の数え方には入れない。`LaidOutCause.edges[]` に `kind` を持たせる。
- **辺への辺(「辺を断つ」)にしない**: 実体の間の矢印そのものを指す記法は、辺に id が要り、配置・検査・描画のすべてに波及する。節への辺で、依頼の「この施策がこの結果を防ぐ」は書ける(代替案)。
- 優先度は低いので、最後の単位(U5)。

### D6. 役割と AND の弧を、凡例の自動生成(`legend: 'auto'`)の単位に入れる(G9)

- **単位は役割**。`usedNotation`(`lib/rules.ts:116`)が、`cause` バンドの節の役割を `role:<役割>` のキーとして集める(意味を持たない `effect` / `step` は除く)。辺の側は `edge:and`(AND の弧が描かれた)、`edge:back`(ADR 0016 D9)、`edge:blocks`(D5)。`cause` のリンクの `line`(`line:dashed` など)は集めない(`pdpc` の破線は、`risk` / `measure` の役割が既に意味を持つ)。
- 凡例の項目 `LegendItem`(`lib/types/containers.ts:69`)に `role?: CauseRole` と `edge?: 'and' | 'back' | 'blocks'` を足す。見本は、役割なら `CAUSE_ROLES` のトーン・二重枠・六角形を縮めた箱、`edge` なら矢印の見本(AND は弧つき、`back` は太線、`blocks` は棒の端)。手書きの `legend([{role: 'ude', label: '…'}])` でも使える(`legendKeys` が同じキーに直すので、自動と二重にならない)。
- ラベルの既定(`DEFAULT_LEGEND_LABELS`、`lib/rules.ts:97`)に追加: `ude` 好ましくない現象(UDE)、`root` 根本原因、`de` 望む結果(DE)、`injection` 施策、`precondition` 現状の事実、`goal` 目標、`io` 中間目標、`obstacle` 障害、`action` 行動、`start` 開始、`risk` 懸念、`measure` 対策、`edge:and` 合わせて原因(AND)、`edge:back` 戻り(フィードバック)、`edge:blocks` 断つ、`mark:core` 中核ドライバー。`legendLabels` で上書きできる(`lib/config.ts:37` の検査は、この表のキーを読むので自動で通る)。
- **既存の図に警告を増やさない**: 役割のキーを集めるのは `applyAutoLegend` からの呼び出し(`legend: 'auto'`)だけで、`legendRules`(`legend-missing` / `legend-incomplete`、`:261`)は従来のまま(集めない)。`legend: 'auto'` を書いた図で `cause` バンドがあるものだけが変わる(`examples/` には無い。`legend: 'auto'` と `causeTree` / `relationDiagram` / `pdpc` を両方使う図は 0 件)。
- README の表の「凡例を添える」(`README.md:298`)は、自動で出ると誤読される。`legend: 'auto'` で出る、に直し、箇条(`:305`)の「まだ入らない」を消す(U6)。

## 代替案

- **`precondition` を六角形などの形にする**。却下。六角形は `obstacle` / `risk` が使っている。形を増やすと凡例の見本・検査・描画に波及する。灰色の破線の箱(既存のトーン)で足りる。色だけの識別に頼らないために凡例を付ける(D6)。
- **「統制できるか」を役割と別の軸(`controllable: boolean`)にする**。却下。TOC の実体の種類(UDE・root・injection・precondition・DE・action)は、役割がそのまま「統制できるか」を含む。軸を増やすと矛盾した組(`precondition` なのに統制できる)が書ける。
- **TOC の検査を、`causeTree` の全部の図に掛ける**。却下。`relationDiagram` / `pdpc` / `arrowDiagram` は TOC の図ではなく、UDE の数や根本原因の規則が意味を持たない。`tree` を書いた図だけにする(D2)。
- **`tree` を役割から推測する**。却下。推測が外れた図に、誤った指摘が出る。
- **`layoutCheck` を流用して `layoutCheck: 'strict'` で TOC の検査も warn にする**。却下(D3)。内容の約束と配置の良し悪しを 1 つにすると、片方だけ厳しくできない。
- **検査の既定を warn にする**。却下。`check --strict` が利用者の CI を勝手に落とす(ADR 0016 D6 と同じ理由)。
- **到達数を `relationDiagram` と同じ「出る辺の本数」にする**。却下。要望は「間接的に引き起こす UDE の数」。直接の数だと、中間の節が多い現状ツリーで主役がずれる。
- **`blocks` を辺への辺にする**。却下(D5)。
- **凡例を `tone` から作る**。却下(現状の調査)。`de` と `io`、`effect` と `obstacle` が区別できず、二重枠と六角形が落ちる。
- **`legend-missing` にも役割のキーを入れる**。却下。既存の図に warn が増えて、`check --strict` が落ちる。

## 影響

- **SVG**: 新しい opts / 役割 / 辺の種類を使った図だけが変わる。既存の `examples/out/*.svg` は byte 同一(`legend: 'auto'` と `cause` を併用する例は無い)。`tree` / `coreDriver` を書かない図、`precondition` / `blocks` を使わない図、`legend: 'auto'` と `cause` を併用しない図は 1 バイトも変わらない。
- **検査**: 規則 6 個(`toc-*`)を `RULE_DOCS` と README の規則の一覧(`README.md:962` 付近)に足す。既定 info で、`check --strict` の結果は変わらない。
- **API**: 追加のみ(すべて省略可能): `CauseRole` の `'precondition'`、`CauseOpts.tree` / `coreDriver`、`CauseLink.kind`、`DiagramOpts.tocCheck`、`LegendItem.role` / `edge`。`relationDiagram` / `pdpc` のリンクの型にも `kind`(と ADR 0016 の `back`)は通す。
- **ADR 0016 との関係**: `toc-cycle-undeclared` は 0016 D9 の `back` の導入後に出せる。D6 の `edge:back` も同じ。0016 の U11 が先。
- **リスク**: (1) `toc-chain-only` と `toc-ude-count` の閾値は、TOC の流派でずれる。info なので害は小さく、`accept` で外せる。(2) 役割の凡例の項目が増えると、凡例の行が増える(`layoutLegend` は折り返す、`lib/layout-handlers.ts:284`)。(3) `coreDriver` の `到達 UDE n` は日本語固定。`legendLabels` のような差し替えは作らない(文言の一般化は別の要望)。

## 実装計画

並列エージェントで進める。各単位は自分の worktree で作業し、触るファイルを下の表に限る。byte 比較の基準は、各 PR 直前の `main`。

### 作業単位

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U1 | `role: 'precondition'`(D1)。型・`CAUSE_ROLES`・検証の文言・README の役割の説明と skills の役割の列挙(`skills/svg-diagram/SKILL.md:82`) | `lib/types/diagrams.ts`(`CauseRole`)、`lib/toc.ts`(`CAUSE_ROLES`)、`README.md`、`skills/svg-diagram/SKILL.md`、`test/toc.test.ts` | なし |
| U2 | 中核ドライバー(D4)。`reachCounts`(純関数)と `causeTree` の `coreDriver` | 新規 `lib/toc-analysis.ts`、`lib/dsl/diagrams.ts`(`causeTree()` の中)、`lib/types/diagrams.ts`(`CauseOpts.coreDriver`、`LaidOutCause.nodes[].core`)、`lib/emit-figures.ts`(`renderCause` の枠の太さとバッジ)、新規 `test/toc-analysis.test.ts`、`test/toc.test.ts` | なし(U1 とは別の行を足すだけ) |
| U3 | TOC の検査(D2・D3)。`tree` と `tocCheck`、`lib/toc-rules.ts`、`RULE_DOCS`、`lintAll` への接続、README の規則の一覧。`toc-cycle-undeclared` は除く(U7) | 新規 `lib/toc-rules.ts`、`lib/rules.ts`(`tocSeverity`・`RULE_DOCS`・`lintAll` の 1 行)、`lib/types/diagrams.ts`・`lib/types/core.ts`(`tree`・`tocCheck`)、`lib/dsl/diagrams.ts`・`lib/dsl/render.ts`(検証・保存)、`lib/strict.ts`、`README.md`、新規 `test/toc-rules.test.ts`、`test/rules.test.ts` | U1(役割の一覧が確定してから)、U2 の `lib/toc-analysis.ts`(辺の集計を共有) |
| U4 | 凡例の自動生成(D6)。`usedNotation` の `cause` 対応、`LegendItem.role` / `edge`、見本の描画、ラベルの既定 | `lib/rules.ts`(`usedNotation`・`applyAutoLegend`・`DEFAULT_LEGEND_LABELS`)、`lib/types/containers.ts`(`LegendItem`)、`lib/layout-handlers.ts`(`layoutLegend`)、`lib/emit-boxes.ts`(`renderLegend`)、`lib/config.ts`(キー検査は表から自動)、`README.md`(`:298`・`:305` の直し)、`test/rules.test.ts`、`test/toc.test.ts` | U1(役割が確定してから)。`edge:back` は 0016 U11 の後、`edge:blocks` は U5 の後に足す(それまでは項目を出さない) |
| U5 | `kind: 'blocks'`(D5)。型・検証・配置への受け渡し・棒の端の描画 | `lib/types/diagrams.ts`(`CauseLink.kind`、`LaidOutCause.edges[].kind`)、`lib/toc.ts`(辺の種類を持たせる)、`lib/dsl/diagrams.ts`(検証)、`lib/emit-common.ts`(`arrowPath` の `end`)、`lib/emit-figures.ts`(`renderCause`)、`README.md`、`test/toc.test.ts` | なし(優先度は低い) |
| U6 | 文書。README(TOC の節の役割・`tree`・`coreDriver`・凡例・`blocks`、`precondition`)、`skills/`、この ADR の状態と「実装」の表。`examples/` に FRT の例(`precondition`・`blocks`・`legend: 'auto'` を使う)を追加 | `README.md`、`skills/svg-diagram/SKILL.md`、新規 `examples/toc-frt.ts`(+ `examples/out/`)、この ADR | U1〜U5 のあと |
| U7 | `toc-cycle-undeclared`(D2)。0016 の `breakCycles`(DFS の結果を返す関数)を使って、戻りとして扱われた辺を書く | `lib/toc-rules.ts`、`test/toc-rules.test.ts` | U3、ADR 0016 U11 |

進める順番: U1・U2・U5 は同時に着手できる。U3 は U1・U2 のあと。U4 は U1 のあと。U6 は最後。U7 は 0016 U11 のあと。この ADR の単位は `lib/graph-layout.ts` と `lib/layered-route.ts` に**触らない**(配置は変えない)ので、ADR 0016 の本体の前後どちらでもマージでき、0016 の byte 比較の基準(直前の `main`)に影響しない。型の追加は、`lib/types/diagrams.ts` の `CauseLink` / `CauseOpts` に集中する(`back`・`kind`・`tree`・`coreDriver`・`fold`・`straighten`・`returns`・`dir: 'auto'`)。**各単位は自分の項目の行だけを足し**、他の単位の行・並びは触らない。衝突は rebase で解く。

### マージ順(全体の順序は ADR 0016「実装順序」の節が正)

0016 の節に、この ADR の単位を組み込んだ(U1・U2・U5 は早い組、U3・U4 はその後、U7 は 0016 U11 の後、U6 は最後)。

### テスト方針(フォントに依存する絶対値を使わない)

- **純関数**: `reachCounts`・`toc-rules` は、ノードとリンクだけを入れて検査する(配置もフォントも使わない)。固定の入力で、(a) 到達数(AND を通る・`back` と `blocks` を通らない・同数は全部)、(b) 各規則が出る入力と出ない入力の組、(c) `tree` が無いと何も出ない、(d) `accept` で info に下がる、(e) `tocCheck: 'strict'` で warn、既定は info。
- **配置を見るテスト**は、`test/toc.test.ts` の作法に従い、**関係**だけを見る(絶対座標を書かない): `precondition` が `removed` トーンで描かれる、`coreDriver` で指定した起点だけが `double` になる、`blocks` の辺が `kind` を持ち AND に入らず層の順を保つ、verify が通る。
- **凡例**: `legend: 'auto'` の図に `cause` バンドだけを置いたとき、(a) 凡例が生成され、使った役割・AND の項目だけが並ぶ、(b) 手書きの `legend([{role}])` と二重にならない、(c) `legend: 'auto'` を書かない図では、`legend-missing` / `legend-incomplete` が従来どおり(増えない)、(d) `legendLabels` の上書きが効く。項目のラベルの幅(フォント)は見ず、項目の**並びと個数**だけを検査する。
- **byte 同一**: `examples/*.ts` の全部が、この ADR の PR の前後で byte 同一(新しい例 `toc-frt.ts` を除く)。`pnpm golden`(`--drift --rebuild`)で確認する。
- **描画**: `blocks` の辺は SVG の文字列の性質(棒の端の `path` があり、矢じりの三角が無い、破線である)で見る。座標の値は固定しない。
- すべて `pnpm test` と `pnpm run typecheck` を通す。

### 完了の基準

- 依頼の最初の図(5 節の 1 本鎖、UDE 1 つ、AND なし、戻り辺が根本原因を取り込む)に `tree: 'crt'` を付けると、`toc-ude-count`・`toc-chain-only`・`toc-cycle-undeclared` が出る(`tocCheck: 'strict'` で `check --strict` が落ちる)。
- `legend: 'auto'` の FRT(`injection`・`de`・`precondition`・AND)で、使った役割と AND の弧の凡例が出る。
- 既存の `examples/out/` が byte 同一。

## 未決(実装担当が確認して追記する)

- `toc-ude-count` の 5〜10 の範囲と `toc-chain-only` の定義は、TOC の指針(Dettmer)に合わせた初期値。依頼者(medius-research)の図で、誤検知が無いかを確かめる。
- `tree: 'prt'` / `'tt'` の規則(障害に中間目標が対になっているか、`tt` の 3 点セット)。依頼に無いので第 2 段階。
- 循環の戻り辺に付ける注釈(`label`。Flying Logic のループの印 `R` / `B`)。G1 は「太く、注釈を付けられる」と言うが、`CauseLink` に `label` が無く、ラベルの置き場所(辺の脇)の設計は ADR 0011(`causalLoop` のループの印)と合わせたい。本 ADR は太さだけ(0016 D9)。
- `coreDriver` の `到達 UDE n` の文言の差し替え(`legendLabels` のような設定)。
