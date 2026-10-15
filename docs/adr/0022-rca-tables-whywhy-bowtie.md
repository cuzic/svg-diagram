# ADR 0022: IS/IS NOT 表・なぜなぜ分析・ボウタイ図を足す(`isIsNot`・`whyWhy*`・`bowtie`)

- 状態: 提案(未実装)。ADR 0021(故障の木)と同じ調査から分けた。Opus レビューを 4 回まわし、収束した(0021 と同じ経緯。第 4 回は blocker 0 / major 0 / minor 6)。第 1 回の指摘(表と木に検査を載せる手段、`mindmap` で真因の印と矢印が描けない、KT 法の仮説検定、ボウタイのハザード)を反映済み
- 日付: 2026-10-15
- 基点: `main`(d7b9f75、PR #224 まで)
- 関連: ADR 0021(`diagram({rcaCheck})` と空の `rcaRules()` を、独立した小さな単位 U0 として足す。**本 ADR の検査は U0 に依存し、FTA 本体(0021 U1)は待たない**)、ADR 0015 / 0020(TOC の検査。`kind: 'blocks'`・`role: 'measure'`・`root`)、ADR 0007

## 背景

ADR 0021 の背景の表のとおり、KT 法の IS/IS NOT 表・なぜなぜ分析・ボウタイ図は、今は表や `mindmap` で手書きはできるが、専用の形式(入力の型、読み方の約束、検査)が無い。

2 つの事実が設計を決める。

1. **表や木には「どの関数が作ったか」の印が無い**。`TableBand` の検査の手段は `semanticWarnings?: readonly string[]` だけで、`semantic-table-warning` という 1 つの規則名・`severity: 'warn'` 固定で出る(`lib/rules.ts`)。規則ごとの名前・既定 info・`accept` を満たすには、検査の欄を足す必要がある。
2. **`mindmap` は真因の二重枠も矢じりも描けない**(`TreeItem` は `{label, sub?, id?, tone?, children?}`。`lib/types/diagrams.ts`)。一方 `causeTree` は `role: 'root'`(accent の二重枠)、`role: 'measure'`(changed)、`kind: 'blocks'`(辺の終わりが棒)、凡例の自動生成を**すでに持つ**。

## 論点

1. 表・木に、規則ごとの検査をどう載せるか(`rcaCheck`・`accept` と合うか)。
2. KT 法の仮説の検定を、実際の手法にどこまで合わせるか。
3. なぜなぜの木を何で描くか。向きの約束(探索の向きと因果の向き)をどう守るか。
4. ボウタイの第 1 段の範囲と、頂上事象の記号。

## 決定

### D1. 検査の手段: 構築時に純関数で作った `rca` の欄を、`TableBand` と `CauseBand` に足す

- `TableBand` と `CauseBand` に、任意の欄 `rca?: {kind: RcaKind; findings: {rule: RcaRule; message: string; severity?: 'info'}[]}` を足す。`isIsNot()` などの関数が、**構築時に**純関数(`lib/rca-rules.ts`。表・木の入力だけを見て、配置もフォントも見ない)で `findings` を詰める。
- `rcaRules()`(ADR 0021 U0 で、空の枠として足す)に、0022 U1 が `walkBands` で `rca` を持つ表・木を拾う分岐を足し(`bowtie` は自前のバンドなので、`b.type === 'bowtie'` の分岐を U4 が足す。D4)、`f.severity ?? severity`(`tocRules` と同じ形)で出す。**既定 info、`diagram({rcaCheck: 'strict'})` で warn**(`severity: 'info'` と書いた規則は strict でも info)。`accept` は規則名で効く。
- **この欄は描画に渡さない**(`lib/emit-*` は読まない。`<title>` / `<desc>` / `data-*` にも出さない)。byte 同一の根拠として、テストで「`isIsNot()` の SVG が、同じ内容を手で `table()` に渡した SVG と byte 同一」を確かめる。
- 既存の `semanticWarnings`(`semantic-table-warning`。入力の注意点が warn 固定で出る)は変えない。`rca` は別の欄で、入力の誤りは throw(`fmea()` と同じ)。
- 変える共有の型は 2 つ(`lib/types/sequence-table-swimlane.ts` の `TableBand`、`lib/types/diagrams.ts` の `CauseBand`)。どちらも任意の欄の追加で、既存の図に影響しない。`CauseBand` にはもう 1 つ、作者は書かない内部の欄 `layerFrom: 'effect'`(D3。`lib/toc.ts` が読む)を足す。

### D2. `isIsNot`: 表を返す 2 つの関数(仕様の表と、仮説の検定の表)

- `isIsNot(rows, opts?)` → `TableBand & Declares<Id> & HandleOf<Id>`(`fmea()` と同じ多重定義)。`isIsNotTests(rows, hypotheses, opts?)` → `TableBand`。仮定の数は **`assumes.length`**。`ifAssumed` のセルがあるのに `assumes` が空なら throw。返り値の型は揺れず、`id` / reveal / spotlight は 1 つの関数に 1 つの表で付く。
- **仕様の表**(`lib/semantic-table.ts` に `isIsNotParts`。`fmeaParts` と同じ形)。`rows: {dim: IsIsNotDim; is: string; isNot: string; distinct?: string; change?: string}[]`。`IsIsNotDim = 'what' | 'where' | 'when' | 'extent' | (string & {})`(補完を効かせる)。`dim` の既定の見出し: 何に(対象・欠陥)/ どこで / いつ / 程度(大きさ・数)。「IS NOT」は「そうであってもおかしくないのに、そうでない」比較対象。列: 観点 | IS | IS NOT | 違い | 変化。**違い**(IS と IS NOT の差)と**変化**(その差に関わる最近の変更)は別の問いなので別の列にする。
- **仮説の検定**: KT では、仮説が「真の原因なら、スペックの各行の IS と IS NOT を説明できるか」を**行ごと**に 3 値で確かめ、仮定が最も少ないものを残す。`hypotheses: {text: string; results: ('yes' | 'ifAssumed' | 'no')[]; assumes?: string[]}[]`(`results` はスペックの行ごと、長さは `rows` と同じ)。表は「仮説 × スペックの行」の行列で、各セルは文言「説明できる / 仮定すれば / できない」(**`◎○△×` と `MatrixMark` は使わない**。QFD と `matrix()` では ◎ = 9 点の別の意味)、右に「説明できない行の数」「仮定の数」の列。**`no` が 0 個の仮説の行を太字**にし、そのうち仮定の数が最少のものに「最少の仮定」の文言を足す(図が原因を選ぶのではなく、読者の手がかり。色だけで示さない)。
- **`rowHeader` は使わない**(`rowheader-tone-collides`(warn)が、行トーンの `soft` の塗りと衝突する)。強調は太字と文言だけで、行トーンは使わない。「既定の出力で `check --strict` が落ちない」をテストに入れる。
- 検査(D1 の仕組み): `isisnot-no-isnot`(`isNot` が空の行がある。比較対象が無い)、`isisnot-no-distinct-at-all`(`distinct` が 1 つも無い表。KT では違いは鋭いものだけを挙げるので、行ごとには出さない)、`isisnot-no-hypothesis-stands`(仮説を書いたのに `no` が 0 個のものが無い。「原因がまだ分かっていない」を図に残す。常に info)。
- throw: `rows` が空、`dim` が空、`results` の長さが `rows` と違う、仮説の `text` が空。

### D3. `whyWhy`: 表と木の 2 つ。木は `causeTree` で描く

- **表** `whyWhyTable(problem, chains, opts?)` → `TableBand`。`chains: {whys: string[]; trueCause?: string; measure?: string}[]`(木の `trueCause` と名前を揃える)。列は 問題 | なぜ 1 … なぜ N(N は最も長い鎖)| 真因 | 対策。行は鎖 1 本。同じ原因を共有する鎖は**同じ文を繰り返す**(`TableBand` に行の結合は無く、足すと共有の描画の経路を変える)。
- **木** `whyWhyTree(problem, whys, opts?)`。入力は入れ子 `{id?: string; why: string; because?: WhyNode[]; trueCause?: true; measure?: string}`(`trueCause: true`: その節が真因。表の `trueCause` は真因の文)。作る節の id は `<opts.id>.w1`、`<opts.id>.w1.m` のように接頭辞を付ける(1 つの図に 2 つ置いても、アンカーが衝突しない。作者は入力の `id?` で上書きできる。**`opts.id` が無く、入力の `id` も書かない節は、アンカーに登録しない**(`CauseBand` の内部の欄 `anchors: false`(作者は書かない)を `lib/band-ids.ts` が見る。連番の `scope` をモジュールの変数で数えると、同じプロセスで先に作った図の数で名前が変わる)。`connect()` などで節を指したい図は、`opts.id` か、節の `id` を書く)。`causeTree` の節と辺に直して返す(**`mindmap` は使わない**: 真因の印と矢じりが描けない):
  - 問題 = `role: 'effect'` に `tone: 'danger'`(`role: 'ude'` にしない: `legend: 'auto'` が「好ましくない現象(UDE)」と出し、TOC の言葉になる。cause ノードのトーンは `usedNotation` が読まない)。なぜの節 = 役割なし。`trueCause` の節 = `role: 'root'`(accent の二重枠)。`measure` の文を持つ節には、`role: 'measure'` の節(changed)を足し、`{from: <対策>, to: <`measure` を持つ節>, kind: 'blocks'}`(辺の終わりが棒)で結ぶ(`measure` は真因でない節にも書ける。それは `whywhy-measure-without-root` で知らせる)。凡例の自動生成では「根本原因」「対策」「断つ」が出る。この言い換えは受け入れ、README で `legendLabels: {'role:root': '真因'}` を案内する。
  - 辺は**原因 → 結果**(`causeTree` と同じ向き)。矢印は問題へ向かう。**軸は `up`(`causeTree` の既定。渡す値は `dir: 'auto'`。下の「幅の調整」)で、問題を上、なぜを下に並べる**(`left` は 5 段 + 対策の 7 層が横に並び、内幅 900px を超える)。「なぜ?」は矢印をさかのぼる向き(下へ)に読む。
  - **層は問題からの深さで置く**: `causeTree` の層の既定は `asap`(入る矢印の無い節をすべて最下段に置く)で、浅い枝の「なぜ」が最下段に落ち、同じ「なぜ 2」が揃わない(`whyWhyTable` の列と食い違う)。`whyWhyTree` は `CauseBand` の内部の欄 `layerFrom: 'effect'`(作者は書かない。`base` / `returnsDefault` と同じ作法)を立て、`lib/toc.ts` が `alap` の「動かさない節(`keep`)」を空にして、すべての節(`root` も)を「最も近い結果の 1 層下」に置く。対策の節は、結んだ節の 1 層下になる。欄の無い図は従来どおり(byte 同一)。
  - **幅の調整**: 関数は内部で `dir: 'auto'` を渡す(軸は `up` のまま。ADR 0010 D1)。縮めと折り返しは `auto-fit-applied` の info になり、作者に直せない warn(`dir` の opts が無いので)を出さない。
  - `tree` は書かない(`toc-*` は掛からない)。読む向きの 1 行(「矢印は原因 → 結果。なぜ? は矢印をさかのぼって(下へ)読む」)は、関数が木と**`caption` バンドの 2 つの配列**を返して添える(`opts.readingNote: false` で外す。`diagram().add()` は `bands.flat()` し、`affinity` も配列を返すので、既存の作法に合う)。注には「**対策(破線の棒)は真因に打つ手で、なぜの答えではない**」も書く(下へ読み進めると対策に行き着き、最も深いなぜの答えに見えるため)。向きを反転する opts は作らない(読み方が図ごとに変わると、この約束が意味を失う)。
- 検査(D1): 表と木の形ごとに定義する。

| 規則 | 表 | 木 | 重大度 |
|---|---|---|---|
| `whywhy-no-root` | `trueCause` の無い行 | `trueCause` の無い葉 | 既定 info、strict で warn |
| `whywhy-measure-without-root` | `trueCause` が無いのに `measure` がある行 | `trueCause` でない節に `measure` がある(症状への対策) | 既定 info、strict で warn |
| `whywhy-single-chain` | 行が 1 つ | 分岐する節が無い(1 本の鎖) | 常に info |
| `whywhy-dig-below-root` | (表では構造上起きない) | `trueCause` の節に `because` がある(真因より下を掘っている) | 常に info |

- throw: `problem` が空、鎖・節の文が空、`whys` が空。

### D4. `bowtie`: 新しいバンド(第 1 段は ハザード・脅威・予防バリア・頂上事象・低減バリア・結果)

- 入力: `bowtie({hazard?: string, top: string, threats: {label: string; barriers?: string[]}[], consequences: {label: string; barriers?: string[]}[]})`。**`hazard`**(頂上事象の上の箱。何の制御を失ったのか)を第 1 段に入れる。劣化要因・バリアの種類の印・複数対複数の対応は第 1 段に入れない(追加のみ)。
- 配置は単純な固定位置(`layoutLayered` / `layoutTree` は使わない): 行 = 脅威 / 結果。左から右へ、脅威 → 予防バリア(行ごとに直列)→ 頂上事象 → 低減バリア → 結果(**すべて右向き**。時間の向き)。脅威と結果の行数が違うときは、少ない側を縦の中央に均等に置く。頂上事象は、**説明を矩形(3 行まで)に書き、結び目の円を矩形の上に添える**(上から ハザードの箱 → 円 → 説明の矩形の順。ハザードが無ければ円から)(円の中に長い文を書くと直径が大きくなる)。円は `emit-bowtie.ts` で `<circle>` を直接描く(`lib/svg-geom.ts` は描き終えた SVG を測る検査用の幾何で、描画の部品ではない)。**FTA の描画(`emit-fta.ts`)は借りない**(FTA の楕円は「条件付き事象」で意味が違う)。矢じりは流れの終点に付ける。
- バンド型の配線は ADR 0021 D1 の一覧から `routedBands` と凡例を除いたもの(凡例は第 2 段)。**`rcaRules()` に `b.type === 'bowtie'` の分岐を足す**(U4。`lib/rules.ts`、`lib/rca-rules.ts`)。幅が足りないときは `maxNodeW` を縮め、足りなければ throw。
- 検査: `bowtie-barrier-missing`(脅威または結果にバリアが 1 つも無い。既定 info、strict で warn)。throw: `top` が空、脅威か結果が 0 個、文が空。

## 代替案

- **`semanticWarnings` に検査を載せる**。却下(D1)。規則名が 1 つ・warn 固定で、`rcaCheck`・`accept` と合わない。
- **表を返さず、新しいバンド `isisnot` を作る**。却下。表で足り、配線の費用が見合わない。ただし検査の欄は共有の型に足す必要があり、その費用は D1 に書いた。
- **仮説の検定を `Mark`(◎○△×)で受ける**。却下(D2)。行ごとの 3 値と仮定の数を持てず、◎ の意味が QFD / `matrix()` と衝突する。
- **`whyWhyTree` を `mindmap` で描く**。却下(D3)。真因の印も矢じりも描けない。`TreeItem` と tree の描画を変えると、mindmap の全出力に関わる。
- **矢印の向きを「問題 → 原因」にして探索の向きを表す**。却下。`causeTree` と同じ形の線に逆の意味を載せ、「同じ形の線に別の意味を載せない」(ADR 0021 の背景)と衝突する。
- **表の同じ原因を行の結合で表す**。却下(D3)。
- **ボウタイの頂上事象を FTA の描画で描く**。却下(D4)。記号の意味がずれる。
- **ボウタイに劣化要因まで入れる**。第 1 段は見送り。入力の型が複雑になり、需要も未確認。

## 影響

- **SVG**: 新しい関数を使った図だけが変わる。既存の `examples/out/*.svg` は byte 同一。`isIsNot()` の SVG が、同じ内容の手書きの `table()` と byte 同一(D1)。
- **API**: 追加のみ。`isIsNot` / `isIsNotTests` / `whyWhyTable` / `whyWhyTree` / `bowtie`、`TableBand.rca` / `CauseBand.rca` / `CauseBand.layerFrom` / `CauseBand.anchors`(作者は書かない)。`dsl-exports.json` に関数名。
- **検査**: 規則 8 個(`isisnot-no-isnot`、`isisnot-no-distinct-at-all`、`isisnot-no-hypothesis-stands`、`whywhy-no-root`、`whywhy-measure-without-root`、`whywhy-single-chain`、`whywhy-dig-below-root`、`bowtie-barrier-missing`)を `RULE_DOCS` と README の規則の一覧に足す。ADR 0021 の `fta-*` 5 個は別。
- **ファイル**: `lib/rca-rules.ts`(新規)、`lib/semantic-table.ts`、`lib/dsl/qc-semantic.ts`、`lib/dsl/diagrams.ts`、`lib/types/sequence-table-swimlane.ts`、`lib/types/diagrams.ts`、`lib/toc.ts`(`layerFrom`)、`lib/band-ids.ts`(`anchors`)、`lib/rules.ts`、`lib/bowtie.ts`・`lib/emit-bowtie.ts`(新規)と配線。
- **リスク**: (1) `whyWhyTree` の層の置き方(`layerFrom`。`lib/toc.ts` の変更)と `kind: 'blocks'` の棒が、`causeTree` の配置で期待どおりか(未決 1)。スライドの図では、7 層(なぜ 5 段 + 問題 + 対策)が高さ 740〜870px ほどになり `maxDisplayHeight` を超えやすいので、README に「スライドなら `whyWhyTable` か、段を減らす」と書く。(2) `rca` の欄が描画やハッシュに漏れる(D1 のテストで防ぐ)。(3) 規則の閾値が現場の流儀と合わない。info 既定と `accept` で外せる。

## 実装計画

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U1 | `rca` の欄と `rcaRules()` の接続・`isIsNot` / `isIsNotTests`・`isisnot-*` | `lib/types/sequence-table-swimlane.ts`、`lib/semantic-table.ts`、`lib/dsl/qc-semantic.ts`、`lib/rca-rules.ts`、`lib/rules.ts` | **ADR 0021 U0**(`rcaCheck`・空の `rcaRules()`) |
| U2 | `whyWhyTable`・`whywhy-*`(表) | `lib/semantic-table.ts`、`lib/dsl/qc-semantic.ts`、`lib/rca-rules.ts` | U1 |
| U3 | `whyWhyTree`(`causeTree` への変換・読む向きの注・`CauseBand.rca`・`whywhy-*`(木)) | `lib/dsl/diagrams.ts`、`lib/types/diagrams.ts`、`lib/toc.ts`(`layerFrom`)、`lib/rca-rules.ts` | U1 |
| U4 | `bowtie`(固定配置・描画・配線・`bowtie-barrier-missing`) | `lib/bowtie.ts`、`lib/emit-bowtie.ts`、配線の一覧、`lib/rules.ts`、`lib/rca-rules.ts` | ADR 0021 U0 |
| U5 | 文書: README、`skills/svg-diagram/SKILL.md`、`examples/` に `is-is-not.ts`・`why-why.ts`・`bowtie.ts`(+ golden)、この ADR の状態 | `README.md`、`skills/`、`examples/` | U1〜U4 |

進める順番: ADR 0021 U0 → U1 → (U2・U3・U4 並行。U2 と U3 は `lib/rca-rules.ts` を共有するので、先にマージした方へ合わせる)→ U5。

### テスト方針(フォントに依存する絶対値を使わない)

- **純関数**: `rca-rules`(入力だけで出る)。仮説の判定(`no` が 0 個の仮説の抽出、仮定の数が最少のもの、行ごとの数え)。`whyWhyTree` の変換(節と辺の数、`trueCause` が `root`、`measure` が `blocks` の辺、辺が原因 → 結果)。
- **byte 同一**: `isIsNot()` の SVG = 同じ内容の手書きの `table()`。既存の全 example が前後で同一。
- **既定の出力で `check --strict` が落ちない**(`isIsNot` の仮説の表を含む)。`rcaCheck: 'strict'` を付けると、D2・D3 の warn の規則が出る。
- **配置は関係だけ**: `whyWhyTree` で問題が最も上、真因が下、`measure` の節が真因の側にある。**完了の基準の例で、なぜ 2 の 2 つの節(影響範囲が広かった / 不具合の発見が遅かった)が同じ層にある**。縮めが起きた木で `auto-fit-applied` が info で、`check --strict` が落ちない。**なぜ 5 段 + 対策 + 分岐 2 本の木が、既定の幅で throw しない**。同じ図に 2 つの `whyWhyTree`(`opts.id` 違い、または `opts.id` 無し)を置いてもアンカーが衝突しない。`bowtie` で頂上事象が中央、脅威が左・結果が右、各行のバリアが左から右に並ぶ。
- **描画**: `blocks` の辺が破線で棒の端を持つ(`causeTree` の既存の性質)。`bowtie` の頂上事象が円(`circle`)で、FTA の楕円ではない。

### 完了の基準

- 説明の IS/IS NOT の例(API A / B、リージョン X / Y、デプロイ前 / 後、一部 / その他)が `isIsNot` で描け、違いと変化が別の列になる。仮説「接続設定の変更」(全行 `yes` または `ifAssumed`)の行が太字になり、「最少の仮定」が付く。
- 説明のなぜなぜの例(リリースが遅れた → 修正に時間がかかった → 影響範囲が広かった / 不具合の発見が遅かった → 検証が最後に集中していた)が `whyWhyTree`(`dir: 'up'`)で描け、真因の二重枠、対策の破線の棒つきの辺、読む向きの注が出る。同じ内容が `whyWhyTable` でも描ける。
- `bowtie` の例(ハザード・頂上事象・脅威 2・結果 2・各バリア)が描け、`check` が通る。
- 既存の `examples/out/` が byte 同一。

## 未決(実装担当が確認して追記する)

1. `layerFrom: 'effect'` で、問題からの深さ(なぜ n)と層が一致するか(`alap` の `keep` を空にして、`role: 'root'` も動く側にする)。`dir: 'up'` で、`role: 'measure'` から `kind: 'blocks'` で真因へ結ぶ配置・描画が期待どおりに出るか(第 3 回の確認では、`blocks` の辺も層を決める矢印に入り、対策は結んだ節の 1 層下に置かれる)、なぜ 5 段 + 対策が既定の幅(900px)に収まるか。出なければ、`measure` を `sub` の 1 行にして `blocks` の辺を使わない案に戻す。
2. ボウタイの凡例(バリア・脅威・結果の印)と、劣化要因を第 2 段で入れるか。需要を見て決める。
