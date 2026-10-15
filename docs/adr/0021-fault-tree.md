# ADR 0021: 故障の木(`faultTree`)を足す

- 状態: 提案(未実装)。第 1 回の Opus レビュー(blocker 2 / major 17 / minor 13)を受けて、FTA だけに絞り直した。表の包み・なぜなぜ・ボウタイは ADR 0022
- 日付: 2026-10-15
- 基点: `main`(d7b9f75、PR #224 まで)
- 関連: ADR 0022(IS/IS NOT・なぜなぜ・ボウタイ。同じ調査から分けた)、ADR 0015 / 0020(TOC の検査。重大度の仕組みを借りる)、ADR 0010(幅)、ADR 0007(関数の芯とポート)

## 背景

原因分析の手法(なぜなぜ分析、特性要因分析、KT 法、FTA、システム思考、A3)と、今の図の対応を調べた。「手法と図は一対一ではない。**原因探索の向き・分類の枝・AND/OR・増減の ±** は別の意味で、同じ形の箱と線に別の意味を載せない」が出発点の説明である(説明の原文はリポジトリに無いので、ここに要点を残す)。

| 手法 | 今ある図(関数。例のファイルは括弧) | 状態 |
|---|---|---|
| 特性要因分析 | `mindmap({layout: 'fishbone'})`(`examples/mindmap-fishbone.ts`、`examples/qc-fishbone.ts`) | 足りている |
| システム思考 | 因果ループ図(`causalLoop`。`examples/semnet-causal*.ts`) | 足りている |
| A3 | `canvas('a3')`(区画だけ。中身は他の図) | 足りている |
| FMEA・パレート・親和図・連関図・PDPC・TOC の各ツリー | あり | 足りている |
| **FTA(故障の木)** | 無い。`bpmn` のゲートと `causeTree` の AND の弧で似せるしかない | **本 ADR** |
| KT 法の IS/IS NOT 表、なぜなぜ分析、ボウタイ | 表・mindmap で手書きはできるが、専用の形式と検査が無い。ボウタイは無い | ADR 0022 |

`causeTree` の AND(`from` が配列)は「原因が揃えば結果が起こる」の 1 種類で、OR は「別々のリンク」で表す。FTA は AND / OR をゲートの**記号として描き分ける**のが約束で、`causeTree` に足すと、役割・AND の弧・TOC の検査(`toc-*`)・凡例の意味が混ざる。

## 論点

1. `causeTree` を拡張するか、新しいバンドにするか。
2. 入力の形(入れ子か、ノードとリンクか)。同じ事象が 2 か所に出るときの書き方。
3. 配置: 既存のどのレイアウトの部品を使うか。ゲートは層のノードか、事象の付属物か。
4. 定量(最小カットセット・確率)の範囲と、数学の前提。
5. 検査の重大度の指定(`tocCheck` を流用するか)。凡例・アンカー・配線。

## 決定

### D1. 新しいバンド `fta`(`causeTree` を拡張しない)

- 理由は 2 つに絞る: (a) ゲートは実体ではなく、**事象の下に立つ記号**で、`CauseNode` / `CauseLink` に入れると `role`・`tree`・`toc-*`・凡例の意味が崩れる。(b) 事象の種類が 5 つ(矩形・円・ひし形・家・楕円)あり、`CAUSE_ROLES` のトーンと二重枠では表せない(`causeTree` に六角形などの形の描き分けはあるが、役割に結び付いた少数の形で、ゲートの記号は別の仕組みになる)。
- 新設: `lib/fta.ts`(型・検証・入れ子 → 複合ノード・配置)、`lib/emit-fta.ts`(描画)、`lib/fta-analysis.ts`(D4)、`lib/fta-rules.ts`(D5)。
- 配線(`bpmn` が載っている場所を実際に数えた): `lib/types/diagrams.ts`(`FtaBand`・`LaidOutFta`・`Band` / `LaidOutBand`)、`lib/layout-handlers.ts`(`LAYOUT_HANDLERS`)、`lib/band-children.ts`(`CHILD_BANDS` / `STACK_WIDTH`。`bpmn: none` / `bpmn: noStack` に並べる)、`lib/reveal-handlers.ts`(`bpmn: plain` に並べる)、`lib/layout-measure.ts`(`MEASURE_HANDLERS`)、`lib/emit-handlers.ts`(`EMIT_HANDLERS`)、`lib/fit-handlers.ts`、`lib/band-ids.ts`(アンカー。D3)、`lib/verify-handlers.ts`(`CHECK_PHASES` と各ハンドラ)、`lib/rules.ts`(`routedBands`(`edge-bends` で `fta` は数えない)、`usedNotation`(凡例。D6)、`fitApplied` の注)、`lib/dsl/diagrams.ts`(`faultTree()`)、`lib/dsl.ts`(型の再エクスポート)、`test/fixtures/dsl-exports.json`(**関数名**だけ。型は入らない)。`lib/emit-html.ts` の `kindOf` は既定が `'svg'` なので手を入れない。キーが引用符の無い `bpmn:` の箇所があり `grep "'bpmn'"` では見つからないので、`grep -rn "bpmn" lib` で数える。コンパイラが足りない分を教えるので、実装時に差分を確かめる。

### D2. 入力は入れ子の木。表すものは種類ごとに許す欄を決める

```ts
faultTree({
  label: 'サービス停止', gate: 'or',
  children: [
    {label: 'DB 全体停止', gate: 'and', children: [
      {label: '主系停止', kind: 'basic', p: 1e-3},
      {id: 'sw', label: '待機系へ切替不能', kind: 'basic', p: 5e-2},
    ]},
    {label: 'アプリ全台停止', kind: 'undeveloped'},
  ],
}, {id: 'fta1'})
```

| `kind` | 記号 | `gate` / `children` | 他の欄 |
|---|---|---|---|
| `'event'`(既定) | 矩形(頂上と中間の事象) | **必須**(`gate` と 1 つ以上の `children`)。無ければ throw(`kind` を `'undeveloped'` にする) | `sub?` |
| `'basic'` | 円 | 持てない(あれば throw) | `p?` |
| `'undeveloped'` | ひし形(これ以上展開しない) | 持てない | `p?`(分かっていれば) |
| `'house'` | 家形(常に起きる / 起きないと仮定) | 持てない | **`state: true | false` 必須**(MOCUS と確率で、真なら AND から外れ、偽ならその枝が落ちる) |
| `'condition'` | 楕円(条件付き事象。`inhibit` の `condition` にだけ置ける) | 持てない | `p?` |

- **事象の説明は常に矩形に書く**。種類の記号(円・ひし形・家・楕円)は、矩形の**下**に小さく付ける(円の中に文を書くと、同じ文字数でも直径が矩形の幅より大きくなり、`layoutTree` が輪郭を詰めない分と重なって木が広がるため。実務の FTA も説明の矩形 + 記号の形が多い)。ゲートのある事象は、矩形の下にゲートの記号が付く(複合ノード。D3)。
- `gate`: `'and' | 'or' | 'vote' | 'inhibit'`。`vote` は整数 `k`(1 ≤ k ≤ 入力数)を要る。`inhibit` は入力 1 つ(`children` が 1 つ)と、`condition: FtaEvent`(`kind: 'condition'`)を 1 つ要る。排他的 OR・優先 AND・NOT は第 1 段では入れない(coherent な木だけを扱う。D4 の前提)。
- **`ref`**: `{ref: 'sw'}` で、別の場所に書いた `id` の事象をもう一度出す。**第 1 段は葉の事象(`basic` / `undeveloped` / `house` / `condition`)だけ**を指せる(中間事象を指すと部分木が複製されて図が爆発する。IEC 61025 の移行記号(三角)で受ける案は第 2 段で、未決 2)。`ref` の節に他の欄を書いたら throw。`condition` は `inhibit` の `condition` にだけ置ける: この制約は `ref` を解いたあとの位置にも掛ける(`{ref: 'c1'}` を `inhibit` の外の子に置いたら throw)。指す先が無い、中間事象を指す、は throw。
- 検証で throw: `vote` の `k` が整数でない / `k < 1` / `k > 入力数`、`inhibit` の入力が 1 つでない、`condition` が `inhibit` 以外にある、`p` が 0〜1 の外、`house.state` が無い、`id` の重複、`kind` ごとの禁止の欄。
- **ゲートの記号**は、NUREG-0492 / IEC 61025 の distinctive shape に揃える(AND = 平らな底の弾丸型、OR = 尖った頭の盾型、`vote` = OR の形 + `k/n` の文字、`inhibit` = 六角形)。IEC 61025 には IEC 60617-12 の矩形の論理記号(`&`、`≥1`)も載るので、**どちらを採るかは第 1 段では shape に固定**し、矩形版は `symbols: 'iec60617'` の追加として未決 1 に残す。
- 向きは上から下のみ(`dir` なし)。**矢じりは付けない**(FTA の線は因果の矢印でなく、ゲートの入出力のつながり。矢じりを付けると `causeTree` と見分けがつかない)。
- 事象の `id` は、バンドの `id` と同じく `scope` で修飾される(`lib/band-ids.ts`。バンドの `id`(`fta1`)の下の名前になる)。

### D3. 配置: 「事象 + その下のゲート」を 1 つの複合ノードにして、`layoutTree` で置く

- `ref` で複製するので、配置の時点で FTA は**純粋な木**。`layoutTree`(`lib/graph-layout.ts`。親を子の中央に置き、折れ線も返す)がそのまま合う。`layoutLayered`(Sugiyama 型)は選ばない: 交差を減らすための並べ替えとダミーのノードは木には要らず、**ゲートが出力事象の真下に来る保証が無い**。
- 複合ノード = 事象の箱 + 短い縦線 + ゲートの記号(`gate` があるとき)。`inhibit` の条件の楕円は、ゲートの右に横線でつなぐ(複合ノードの幅に含める)。子の接続は、複合ノードの下端(ゲートの出力)から。
- 折り返し(`fold`)は FTA では使わない: 層を折り返すと、ゲートから 2 行目の子への線が 1 行目の子の間を抜けて読めなくなる。幅が足りないときは、`maxNodeW`(既定 200)を 100 まで縮め、それでも足りなければ throw(「試した幅」を書く。`dir` を書かないので `causeTree` の自動の探索は無い)。**収まる大きさの目安**: `layoutTree` は輪郭を詰めない(図の幅 ≈ 葉の幅の合計 + 間隔 24 × (葉 − 1))ので、既定の内幅 900px では、葉が 7 個程度(幅 100)までで、それを超える木は `diagram({width})` を広げる。このときの throw の文面に「`diagram({width})` を広げる」を書く。
- **アンカー**: ノードの `id` を持つ元の事象だけが `connect()` / spotlight / reveal のアンカーになる(`lib/band-ids.ts` の `nodeIdsOf`)。`ref` の複製は `<id>~2`、`<id>~3` の内部の名前を持つが、**アンカーにしない**(どちらの記号に付くか決まらないため)。

### D4. 定量は 2 段階。第 1 段は最小カットセット、第 2 段は確率(いずれも coherent な木の前提)

- **前提**: 木は coherent(NOT・排他的 OR を含まない)。`house` は定数に畳む。`inhibit` は `AND(入力, 条件)` と同じに扱う。
- **U2: 最小カットセット**(`minimalCutSets`、`lib/fta-analysis.ts`。純関数。MOCUS 法)。`vote(k, n)` は C(n, k) 個の AND に展開する。**途中の集合の数が 5000 を超えたら打ち切る**(吸収による最小化の前の集合の方が先に増えるので、途中で数える)。打ち切ったときは、`cutSets: true` / `quant: true` を書いた図では throw(単純化を促す。黙って近似しない)、検査(`fta-single-point`)では throw せず、「カットセットが多すぎて単一故障点を調べていない」を info で出す。`ref` は同じ基本事象 1 つの変数に畳む。
- **単一故障点**: 大きさ 1 のカットセットを `faultTree(..., {cutSets: true})` で強調する(太枠とバッジ)。バッジの文言は事象の種類で変える: `basic` / `condition` →「単一故障点」、`undeveloped` →「未展開・単独で頂上へ」(展開していないだけの事象を「単一故障点」とは呼ばない)。`house`(真)は定数なので数えない。
- **U5: 確率**。`p` は**確率**(0〜1、無次元。ある期間 T の間の不信頼度)。`quant: true` で `p` の無い葉(`undeveloped` / `condition` は `p` が任意)があれば throw(どの事象に `p` が無いかを挙げる)。頻度(`/年`)は扱わない(AND で掛けると次元が崩れる)。期間は `quantPeriod: '1 年間'` で注に書く。
  - 基本の式: AND = Π p、OR = 1 − Π(1 − p)、`vote(k, n)` = 独立で値の異なる入力の k-out-of-n(Poisson 二項。動的計画法)、`inhibit` = AND。
  - **共有がある(`ref`)とき**: 共有された基本事象(12 個まで)の上で場合分け(Shannon 展開 / pivotal decomposition)して厳密に求める。共有された事象の部分木は葉だけ(D2)なので、変数は常に基本事象。
  - 共有が 12 個を超えるとき: **min-cut upper bound(MCUB)** `1 − Π(1 − P(cut))` を、「上限(概算)」と明示して出す。coherent で独立なら 厳密 ≤ MCUB ≤ ΣP(cut)(稀事象近似)。式の名前を取り違えない。
  - 前提の注を図に出す(外せない): 「基本事象は互いに独立と仮定」。
- `cutSets` と `quant` は独立に指定できる。

### D5. 検査: 純関数 + 既定 info、図ごとの opt-in で warn(`rcaCheck`)

- `diagram({rcaCheck: 'strict'})` を新設(`DiagramOpts` と `DiagramData`、`lib/dsl/render.ts` の検証、`lib/types/core.ts`)。`tocCheck`(TOC の名前)も `layoutCheck`(配置の名前)も流用しない。重大度の決め方は `tocRules`(`lib/rules.ts`)と同じ形(`f.severity ?? severity`)で、`rcaRules()` を足す。`rcaRules()` は `b.type === 'fta'` のバンド(型による分岐)と、ADR 0022 の `rca` 欄を持つ表・木・`bowtie` を拾う。**`rcaCheck` と空の `rcaRules()` は、小さな独立した単位 U0 として先に入れる**(ADR 0022 も U0 に依存する。どちらの ADR が先に U0 を入れてもよい)。
- 規則(`lib/fta-rules.ts`。ノードだけを見て、配置・フォントは見ない)。「常に info」は strict でも info(`accept` は warn を info に下げるだけなので、意味があるのは「strict で warn に上がる」規則):

| 規則 | 出す条件 | 重大度 |
|---|---|---|
| `fta-gate-one-input` | `and` / `or` / `vote` の入力が 1 つ(`inhibit` は除く。入力 1 つの `vote` はこの規則だけを出す) | 既定 info、strict で warn |
| `fta-vote-degenerate` | `vote` の `k = 1`(OR と同じ)または `k = 入力数`(AND と同じ)で、入力が 2 つ以上 | 既定 info、strict で warn |
| `fta-top-is-leaf` | 頂上が 1 事象だけ(ゲートが無い) | 既定 info、strict で warn |
| `fta-undeveloped-left` | 未展開事象が残っている | 常に info |
| `fta-single-point` | 大きさ 1 のカットセットがある(`cutSets` を使わない図でも、純関数で計算して出す) | 常に info |

- 規則は 5 個。throw にする入力の誤りは D2 の一覧。

### D6. 凡例: 事象とゲートを `legend: 'auto'` の単位に入れる

- `usedNotation`(`lib/rules.ts`)が、`fta` バンドの事象の種類(`fta-event:basic` / `undeveloped` / `house` / `condition`)とゲート(`fta-gate:and` / `or` / `vote` / `inhibit`)をキーとして集める。`DEFAULT_LEGEND_LABELS` に日本語のラベルを足し、`LegendItem` に記号の見本の描画を足す(ADR 0015 D6 の役割の凡例と同じ作法)。
- **既存の図に警告を増やさない**: キーを集めるのは `fta` バンドだけで、**`cause` の役割と同じく `withCause` の内側(`legend: 'auto'` だけが読む)で集める**。`legendRules`(`legend-missing` / `legend-incomplete`)は `withCause = false` で呼ぶので、凡例を書いていない FTA の図に warn は出ない。`fta` を置かない図の凡例も変わらない。

## 代替案

- **`causeTree` にゲート用の役割を足す**。却下(D1)。
- **入力をノードとリンクの 2 配列にする**。却下。FTA は頂上から読む木で、入れ子の方が子の並びと図の並びが一致する。
- **`ref` を作らず DAG(線が飛ぶ)にする**。却下。ゲートの入出力の線が長く交差して読めない。FTA の標準も「同じ記号を繰り返す」。
- **`layoutLayered` を使う**。却下(D3)。木には過剰で、ゲートが真下に来る保証が無く、辺の折れ線は別に作る必要がある。
- **ゲートを独立の層のノードにする**。却下。事象 1 つが 2 層を使い、図が縦に倍になる。
- **確率を入れない**。第 1 段としては採る(D4)。重要度の比較が FTA の本来の価値なので、第 2 段で入れる。
- **頻度(`/年`)を扱う**。却下(D4)。AND の積で次元が崩れる。
- **`tocCheck` を流用する**。却下(D5)。
- **IEC 60617-12 の矩形の記号を採る**。第 1 段は見送り(D2)。記号の見本の描画と凡例が倍になる。

## 影響

- **SVG**: `faultTree` を使った図だけが変わる。既存の `examples/out/*.svg` は byte 同一(`pnpm golden`)。
- **API**: 追加のみ。`faultTree()`、型 `FtaEvent` / `FtaBand`、`DiagramOpts.rcaCheck`。`dsl-exports.json` には関数名 `faultTree` だけ(`minimalCutSets` は DSL から export しない)。
- **検査**: 規則 5 個を `RULE_DOCS` と README の規則の一覧に足す。
- **ファイル**: D1 の一覧。
- **リスク**: (1) ゲート記号の細部(vote の `k/n` の置き場所、inhibit の形)が流派でずれる。shape に固定し、矩形版を追加の opts で吸収する。(2) 確率の誤用(独立でない事象を独立と扱う)。図の注で明示する。(3) 複合ノードの幅(`inhibit` の条件の楕円)で木が広がる。`maxNodeW` を縮めて足りなければ throw。

## 実装計画

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U0 | `diagram({rcaCheck})`(`DiagramOpts` / `DiagramData` / `lib/dsl/render.ts` の検証 / `lib/types/core.ts`)と、空の `rcaRules()`(`lib/rules.ts`。重大度の決め方と、`fta` / `rca` の欄 / `bowtie` を型で拾う枠) | `lib/types/core.ts`、`lib/dsl/render.ts`、`lib/rules.ts` | なし |
| U1 | `fta` 本体: 型・検証(D2 の一覧)・複合ノード・`layoutTree` での配置・描画・アンカー・配線・`fta-gate-one-input` / `fta-vote-degenerate` / `fta-top-is-leaf` / `fta-undeveloped-left` | D1 の配線の一覧(`lib/fta.ts`、`lib/emit-fta.ts`、`lib/fta-rules.ts` ほか)、`lib/rules.ts`(`routedBands` など) | U0 |
| U2 | `minimalCutSets`・`cutSets: true`(バッジ)・`fta-single-point` | `lib/fta-analysis.ts`、`lib/emit-fta.ts`、`lib/fta-rules.ts` | U1 |
| U3 | 凡例(`usedNotation`・`DEFAULT_LEGEND_LABELS`・記号の見本) | `lib/rules.ts`(`usedNotation`・`legendKeys`)、`lib/types/containers.ts`(`LegendItem`)、配置(`lib/layout*.ts` の凡例の `swatch`)、`lib/emit-boxes.ts`(凡例の描画)、`lib/emit-fta.ts`(見本の描画を U1 の描画関数から借りる) | U1 |
| U4 | 確率(`p`・`quant`・`quantPeriod`・厳密・MCUB・注) | `lib/fta-analysis.ts`、`lib/emit-fta.ts` | U2 |
| U5 | 文書: README、`skills/svg-diagram/SKILL.md`、`examples/fta.ts`(+ golden)、この ADR の状態 | `README.md`、`skills/`、`examples/` | U1〜U4 |

進める順番: U0 → U1 → U2・U3(並行。どちらも `lib/emit-fta.ts` に手を入れるので、先にマージした方へ合わせる)→ U4 → U5。

### テスト方針(フォントに依存する絶対値を使わない)

- **純関数**: `minimalCutSets`(AND / OR / `vote` / `inhibit` / `ref` の共有 / `house` の真偽、大きさ 1、5000 超で throw)。確率: `ref` が無く `vote` が無いときは式(Π と 1 − Π(1 − p))と一致、`vote` は列挙(全部の組合せ)と一致、`ref` があるときは全基本事象の 0 / 1 の列挙と一致、MCUB は厳密以上で ΣP(cut) 以下。
- **数値の基準**: 2-out-of-3 で `p = 0.1` が 3 つなら `3·0.1²·0.9 + 0.1³ = 0.028`。共有の例: `OR(AND(a, b), AND(a, c))` は `a·(1 − (1 − b)(1 − c))`(独立を誤って仮定した `1 − (1 − ab)(1 − ac)` とは違う)。
- **配置は関係だけ**: 頂上が最上段、ゲートの子が 1 段下、**ゲートの記号の中心の x が、出力事象の中心の x と一致**し、ゲートが事象の下・子の群の上にある、`inhibit` の条件が同じ高さで右にある。
- **描画**は SVG の性質で見る: AND と OR の `path` が異なる、基本事象に円・未展開にひし形、**ゲートの線の終点に `<marker>` も矢じり(多角形)も無い**(このリポジトリは矢じりを多角形でも描く)、`ref` の複製が別の記号として描かれる。
- **幅**: 葉 12 個の木が `diagram({width: 1400})` で収まり、既定の 900 では試した幅を書いて throw する。
- **凡例**: `faultTree` を置いた既定の図(凡例なし)で `check --strict` が落ちない。
- **検査**: カットセットが多すぎる木で、検査は throw せず info を出し、`cutSets: true` では throw する。
- **byte 同一**: `examples/*.ts` の全部が、新しい例を除いて前後で同一。

### 完了の基準

- 説明の FTA の例(サービス停止 → OR → DB 全体停止(AND: 主系停止、待機系へ切替不能)/ アプリ全台停止)が `faultTree` 数行で描け、AND と OR が記号で区別できる。
- 同じ例に `cutSets: true` を付けると、「アプリ全台停止」(未展開)に「未展開・単独で頂上へ」のバッジが付き、AND の 2 事象には付かない。「アプリ全台停止」を `kind: 'basic'` にした例では「単一故障点」になる。
- `quant: true` の例(2-out-of-3 と共有)で、テスト方針の数値と一致する。
- `legend: 'auto'` で、使った事象とゲートだけの凡例が出る。
- 既存の `examples/out/` が byte 同一。

## 未決(実装担当が確認して追記する)

1. ゲート記号の出典: IEC 61025(対応する JIS は JIS C 5750-4-4)と NUREG-0492 の図で、vote・inhibit・house の形を確かめる。確かめられなければ、第 1 段の `kind` の名前だけ残して形は IEC に揃える。矩形版(`symbols: 'iec60617'`)を足すかも、需要を見て決める。
2. 中間事象への `ref`(移行記号の三角)を足すか。足すなら、移行先の頂上の名前の付け方と、`ref` が自分の祖先を指す循環の検査を決める。
3. 排他的 OR・優先 AND・NOT を足すなら、MOCUS と MCUB の coherent の前提が崩れる。足す場合は D4 の前提ごと書き直す。
