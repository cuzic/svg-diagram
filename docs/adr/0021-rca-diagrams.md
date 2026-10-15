# ADR 0021: 原因分析の図を足す(`faultTree`・`isIsNot`・`bowtie`・`whyWhy`)

- 状態: 提案(未実装)
- 日付: 2026-10-15
- 基点: `main`(d7b9f75、PR #224 まで)
- 関連: ADR 0015 / 0020(TOC の因果ツリーと検査。検査の重大度の仕組みを借りる)、ADR 0007(関数の芯とポート)、ADR 0014(`layoutCheck`)

## 背景

原因分析の手法(なぜなぜ分析、特性要因分析、KT 法、FTA、システム思考、A3)と、このリポジトリの図の対応を調べた。

| 手法 | 今ある図 | 状態 |
|---|---|---|
| 特性要因分析 | `qc-fishbone`、`mindmap({layout: 'fishbone'})` | 足りている |
| システム思考 | `semnet-causal`(因果ループ図。強化/調整ループ、介入点) | 足りている |
| A3 | `canvas('a3')`(区画だけ。中身は他の図を置く) | 足りている |
| FMEA・パレート・親和図・連関図・PDPC・TOC の各ツリー | あり | 足りている |
| FTA(故障の木) | **無い**。`bpmn` のゲートと `causeTree` の AND の弧で似せるしかない | 本 ADR |
| KT 法の IS / IS NOT 表 | **無い**。`table()` で手書きはできる | 本 ADR |
| ボウタイ図 | **無い** | 本 ADR |
| なぜなぜ分析 | `mindmap` / `table()` で描けるが、専用の形式(「なぜ 1〜5 → 真因 → 対策」の表、真因・対策の印)と検査が無い | 本 ADR |

`causeTree` の AND(`from` が配列)は「原因が揃えば結果が起こる」の 1 種類だけで、OR は「別々のリンク」で表す。FTA は AND / OR を**記号として描き分ける**のが約束で、`causeTree` に足すと役割・AND の弧・TOC の検査(`toc-*`)の意味が混ざる。

貼られた説明が言うとおり、手法ごとに線の意味が違う(原因探索の向き、分類の枝、AND / OR、増減の ±)。**同じ形の箱と線に別の意味を載せない**ことを方針にする。

## 論点

1. FTA は `causeTree` を拡張するか、新しいバンドにするか。
2. FTA の入力は、ノードとリンクの 2 配列(`causeTree` 風)か、入れ子の木か。同じ事象が 2 か所に出る(木でなく DAG)ときの書き方。
3. FTA の定量(確率・最小カットセット)を入れるか。入れるなら範囲。
4. IS / IS NOT と なぜなぜの表は、`table()` の包みで足りるか(新しいバンドが要るか)。
5. ボウタイ図は FTA の部品を使うか、別の固定配置か。
6. 検査の重大度の指定(`tocCheck` を流用するか)。

## 決定

### D1. FTA は新しいバンド `fta` にする(`causeTree` を拡張しない)

- 理由: (a) ゲートは実体ではなく、辺の途中に立つ記号。`causeTree` の節と辺の型(`CauseNode` / `CauseLink`)に入れると、`role`・`tree`・`toc-*`・凡例の意味が 1 つずつ崩れる。(b) FTA の事象の種類(矩形・円・ひし形・家・楕円)は図形が違い、`CAUSE_ROLES` の「トーンと二重枠」では表せない。(c) 上から下の木で、層の決定は `layoutLayered`(`lib/graph-layout.ts`)で足りる。`bpmn` がレイアウトの部品を共有しているのと同じ作り。
- 新設: `lib/fta.ts`(型と配置)、`lib/emit-fta.ts`(描画)。バンド型の配線は、wordart のときの一覧(`Band` / `LaidOutBand`、`CHILD_BANDS` / `STACK_WIDTH`、`LAYOUT_HANDLERS`、`MEASURE_HANDLERS`、`EMIT_HANDLERS`、`FIT_HANDLERS`、reveal、`VERIFY_HANDLERS`、`lib/dsl/figures.ts`、`lib/dsl.ts` の型の再エクスポート、`test/fixtures/dsl-exports.json`、`lib/emit-html.ts` の `kindOf`)に従う。

### D2. 入力は入れ子の木。同じ事象は `ref` で書く

```ts
faultTree({
  id: 'top', label: 'サービス停止', gate: 'or',
  children: [
    {label: 'DB 全体停止', gate: 'and', children: [
      {label: '主系停止', kind: 'basic', p: 1e-3},
      {id: 'sw', label: '待機系へ切替不能', kind: 'basic', p: 5e-2},
    ]},
    {label: 'アプリ全台停止', kind: 'undeveloped'},
  ],
}, {id: 'fta1'})
```

- 事象 `FtaEvent`: `{id?, label, sub?, kind?, gate?, children?, k?, condition?, p?, ref?}`。`kind`: `'event'`(既定。ゲートの出力。矩形)、`'basic'`(基本事象。円)、`'undeveloped'`(未展開。ひし形)、`'house'`(家事象。常に起きる / 起きないを仮定する。家形)。
- ゲート `gate`: `'and' | 'or' | 'vote' | 'inhibit'`。`vote` は `k`(k 個以上の入力で成立)を要る。`inhibit` は `condition`(条件付き事象。楕円)を 1 つ要る。**排他的 OR・優先 AND は第 1 段では入れない**(実務の使用が少なく、記号の合意が流派で揺れる。入れるなら追加のみ)。
- **`ref`**: 別の場所で書いた事象(`id`)をもう一度出す。図には同じ記号が 2 回描かれ、同じ `p` を共有する(FTA の標準の扱い。矢印を飛ばして DAG にしない)。`ref` の指す先が無い、`ref` が自分の祖先を指す(循環)ときは、構築時に throw。
- ゲートの記号は IEC 61025 の形(AND = 平らな底の弾丸型、OR = 尖った盾型、vote は OR の中に `k/n`、inhibit は六角形)。JIS の記号との差は、実装時に確かめる(未決 1)。
- 向きは上から下のみ(`dir` は無し)。FTA の読み方は、頂上事象 → 原因へ下る。**矢じりは付けない**(FTA の線は因果の矢印ではなく、ゲートの入出力のつながり。矢じりを付けると TOC の木と見分けがつかない)。
- 幅が足りないときは `maxNodeW` を縮める → 同じ階層を折り返す、の順(`causeTree` の ADR 0010 D7 と同じ作法。`fit: 'shrink'` は第 1 段では無し)。

### D3. 定量は 2 段階。第 1 段は最小カットセットまで、確率は第 2 段

- 第 1 段(U2): 最小カットセットを純関数 `minimalCutSets(tree)`(`lib/fta-analysis.ts`)で求める(MOCUS 法。`ref` は同じ記号として 1 つの変数に畳む)。`faultTree(..., {cutSets: true})` で、**大きさ 1 のカットセット(単一故障点)の基本事象**に太枠と「単一故障点」のバッジを付ける。大きさ 2 以上は表にしない(図の外。`fta-analysis` の戻り値で取れる)。
- 第 2 段(U5): `p` を持つ基本事象から、頂上事象の確率を求めて頂上の下に出す(`quant: true`)。繰り返しの事象(`ref`)があるので、**単純な積・和は誤る**。`ref` で共有された事象の上でだけ場合分け(Shannon 展開)して厳密に求め、共有が 12 個を超えるときは、カットセットの稀事象近似(`1 − Π(1 − P(cut))` の上限)に落として「概算」と明示する。**独立を仮定すること**を図の注に書く(外せない)。`p` が 0〜1 の外なら throw。
- 確率の表示は有効数字 2 桁の指数表記(`1.0e-3`)。単位や期間(`/年`)は `quantUnit` で足す。

### D4. `isIsNot`: 表を返す関数。新しいバンドは作らない

- `lib/semantic-table.ts` に `isIsNotParts`(`fmeaParts` と同じ形: 入力の検査 → 列と行 → `table()` の引数)を足し、`lib/dsl/qc-semantic.ts` から `isIsNot(rows, opts)` を `TableBand` で返す。
- 入力: `rows: {dim: 'what' | 'where' | 'when' | 'extent' | string, is: string, isNot: string, distinct?: string, change?: string}[]`。`dim` の既定の見出し: 何に(対象・欠陥)/どこで/いつ/程度(大きさ・数)。KT の「IS NOT」は「そうであってもおかしくないのに、そうでない」比較対象。
- 列: 観点 | IS | IS NOT | 違い | 変化。**「違い」と「変化」の列を両方出す**(貼られた説明の表は「違い・関連する変化」を 1 列にまとめていたが、KT は別の問い: 違い = IS と IS NOT の差、変化 = その差に関わる最近の変更)。
- 仮説の検定: `hypotheses?: {text: string; explainsIs: Mark; explainsIsNot: Mark; assumes?: string}[]`(`Mark` は `matrix()` の `◎○△×` と同じ)。表の下に、仮説ごとの「IS を説明するか / IS NOT を説明するか / 要る仮定」の 2 つ目の表を足す(`isIsNot` は `[spec, tests]` の配列を返す。`affinity` が配列を返すのと同じ)。両方が `◎` か `○` の仮説だけを太字にする。**図が仮説を選ぶのではなく、読者が見る手がかり**(`accent` トーン + 太字。「◎」は 9 点という別の意味を持つ QFD と混ざらないよう、○/× の記号は使わず、`tone` と文言「説明できる / できない」で出す)。
- 理由: この手法の中心は表。バンドを増やすと配線(D1 の一覧)の費用が、表の包みで済むものに対して見合わない。

### D5. `bowtie`: 固定の 3 列配置の新しいバンド(第 1 段は脅威・バリア・頂上・結果だけ)

- 入力: `bowtie({top, threats: [{label, barriers?: string[]}], consequences: [{label, barriers?: string[]}]})`。左 = 脅威 → 予防バリアの列 → 頂上事象(中央の楕円) ← → 低減バリアの列 → 結果(右)。1 つの脅威(結果)が 1 行。
- 配置は **行ごとの単純な固定位置**(脅威の数・結果の数の大きい方の行数。足りない側は中央に寄せる)で、`layoutLayered` は使わない。バリアの箱は、その行の線の上に直列に乗る。
- FTA の部品は使わない(木ではなく、左右の 2 つの扇)。ただし図形(頂上事象の楕円、基本事象)は `lib/emit-fta.ts` の描画関数を再利用する(U4 が U1 のあと)。
- 第 1 段で入れない: 劣化要因(バリアの効きを弱めるもの)、バリアの種類(人 / 設備 / 手順)の印、脅威とバリアの対応の複数対複数。入れるなら追加のみ(`escalation?:`、`barrierKind?:`)。

### D6. `whyWhy`: 2 つの形(表・木)を、既存のバンドで描く

- **表** `whyWhyTable(problem, chains, opts)`: 列は 問題 | なぜ 1 | なぜ 2 | … | 真因 | 対策(なぜの深さは `max(chains の長さ)`。短い鎖は右の空欄を空けたまま「真因」の列へ)。`table()` を返す(D4 と同じ作り)。行 = 1 本の鎖。同じ原因を共有する鎖は、左の列を縦に結合する(`table()` の行結合があるときのみ。無ければ同じ文を繰り返す)。
- **木** `whyWhyTree(problem, whys, opts)`: `mindmap({layout: 'right'})` を返す。入力は入れ子 `{why, because?: [...], root?: true, measure?: string}`。`root: true` の節に「真因」の印(`accent` の二重枠と「真因」のラベル)、`measure` の文を持つ節の右に「対策」の箱(`changed` トーン)を足す。
- 方向を図に書く: 凡例に「→ なぜ? の向き(結果 → 原因)」と固定の 1 行を出す(`legend` の項目に追加。貼られた説明が挙げた、探索の向きと因果の向きの取り違えを防ぐ)。**矢印の向きは「問題 → 原因」に固定**し、反転する opts は作らない(読み方が図ごとに変わると、この印の意味が失われる)。
- 検査(D7): 末端が真因でも対策でもない(`whywhy-open-end`)、真因が 1 本の鎖の途中にある(掘りが浅い疑いではなく、**真因より下に掘っている**: `whywhy-root-not-leaf`)、なぜの鎖が 1 本だけ(`whywhy-single-chain`: 分岐を検討した形跡が無い。info)。

### D7. 検査の仕組み: 純関数 + 既定は info、図ごとの opt-in で warn(ADR 0015 D3 / ADR 0020 と同じ)

- 検査は純関数(`lib/fta-rules.ts`、`lib/isisnot-rules.ts` など。配置・フォントを見ない)。`RULE_DOCS` に足し、既定 info(`check --verbose`)。`check --strict` の結果は、既存の図では変わらない。
- 指定: 既存の `diagram({tocCheck})` は TOC の検査の名前を持つので流用しない。**`diagram({rcaCheck: 'strict'})` を新設**する(`tocCheck` と同じ値)。`tocCheck` と別々に厳しくできる。
- 規則:

| 規則 | 対象 | 出す条件 |
|---|---|---|
| `fta-gate-one-input` | `fta` | ゲートの入力が 1 つ(ゲートが意味を持たない) |
| `fta-vote-k` | `fta` | `vote` の `k` が 1 〜 入力数の外、または `k = 入力数`(AND と同じ)・`k = 1`(OR と同じ) |
| `fta-undeveloped-left` | `fta` | 未展開事象が残っている(情報。意図した省略なら `accept`) |
| `fta-single-point` | `fta` | 大きさ 1 のカットセットがある(`cutSets` を使うとき。単一故障点を挙げる。情報) |
| `fta-top-is-basic` | `fta` | 頂上事象が基本事象・未展開(ゲートの無い 1 事象の木) |
| `isisnot-no-isnot` | `isIsNot` | `isNot` が空の行(比較対象が無い。この手法の中心が欠ける) |
| `isisnot-no-distinct` | `isIsNot` | `is` も `isNot` もあるのに `distinct` が空 |
| `isisnot-no-hypothesis-stands` | `isIsNot` | 仮説を書いたのに、IS と IS NOT の両方を説明できるものが 1 つも無い(情報。「原因がまだ分かっていない」を図に残す) |
| `bowtie-barrier-missing` | `bowtie` | 脅威または結果にバリアが 1 つも無い |
| `whywhy-open-end` / `whywhy-root-not-leaf` / `whywhy-single-chain` | `whyWhy*` | D6 のとおり |

- 構築時に throw する入力の誤り(`ref` の指す先が無い、`vote` の `k` が数でない、`p` が範囲外、`dim` が空、ゲートを持つのに子が無い)は、検査にしない(`fmea()` が不正な入力を throw するのと同じ)。

## 代替案

- **FTA を `causeTree` に足す(ゲート用の役割 `gate-and` / `gate-or`)**。却下(D1)。TOC の検査・凡例・`role` の意味が混ざり、事象の記号も描けない。
- **FTA の入力をノードとリンクの 2 配列にする**。却下。FTA は木で、頂上から読む。入れ子の方が、ゲートの子の並びと図の並びが一致する。繰り返しの事象だけ `ref` で補う。
- **`ref` を作らず、DAG(矢印が飛ぶ)にする**。却下。ゲートの入出力の線が長く交差し、読めない。FTA の標準も「同じ記号を繰り返す」。
- **確率を入れない**。第 1 段としては採る(D3)。ただし定量は FTA の本来の価値(重要度の比較)なので、第 2 段で入れる。独立の仮定を外せないことは、図に書く。
- **IS / IS NOT を新しいバンドにする**。却下(D4)。表で足りる。
- **`isIsNot` の仮説の判定を自動で「正解」として選ぶ**。却下。図が因果を証明すると読まれる。手がかりとしての強調にとどめる。
- **ボウタイを `fta` + 事象の木(イベントツリー)の 2 つのバンドの並びで作る**。却下。ボウタイは中央の頂上事象で左右が対になる 1 枚の図。イベントツリーは別の図で、需要は限られる(今回は作らない)。
- **`tocCheck` を流用する**。却下(D7)。名前が TOC を指し、`layoutCheck` を TOC に流用しなかった ADR 0015 D3 と同じ理由。
- **STAMP / STPA、AcciMap、8D、SIPOC を足す**。今回は見送り。需要が少ない(STAMP / AcciMap)か、A3 のキャンバスと既存の表で足りる(8D / SIPOC)。

## 影響

- **SVG**: 新しい関数を使った図だけが変わる。既存の `examples/out/*.svg` は byte 同一(`pnpm golden` で確認)。
- **API**: 追加のみ。`faultTree` / `isIsNot` / `bowtie` / `whyWhyTable` / `whyWhyTree`、`DiagramOpts.rcaCheck`、型 `FtaEvent`・`IsIsNotRow`・`BowtieOpts` など。`test/fixtures/dsl-exports.json` に足す。
- **検査**: 規則 14 個前後を `RULE_DOCS` と README の規則の一覧に足す。既定 info。
- **ファイル**: 新規 `lib/fta.ts`、`lib/emit-fta.ts`、`lib/fta-analysis.ts`、`lib/fta-rules.ts`、`lib/bowtie.ts`。既存は `lib/semantic-table.ts`、`lib/dsl/qc-semantic.ts`(表の 2 つ)、`lib/rules.ts`、配線の一覧。
- **リスク**: (1) ゲート記号の細部(IEC と JIS の差、vote の `k/n` の置き場所)が流派でずれる。第 1 段は IEC 61025 に揃え、ずれは追加の opts で吸収する。(2) 確率計算の誤用(独立でない事象を独立として扱う)。図の注で明示し、`ref` の共有だけを厳密に扱う範囲を README に書く。(3) 検査の閾値や文言が、現場の流儀と合わない。info 既定と `accept` で外せる。

## 実装計画

各単位は自分の worktree で作業し、触るファイルを表に限る。基準は各 PR 直前の `main`。

| 単位 | 内容 | 依存 |
|---|---|---|
| U1 | `fta`: 型・検証(`ref`・`vote`)・入れ子 → ノードとゲートの列・`layoutLayered` での配置・描画(記号)・バンド型の配線・`fta-gate-one-input` / `fta-vote-k` / `fta-undeveloped-left` / `fta-top-is-basic`・`rcaCheck` | なし |
| U2 | `minimalCutSets`(純関数)・`cutSets: true`(単一故障点の強調)・`fta-single-point` | U1 |
| U3 | `isIsNot`(`isIsNotParts`・仮説の表・`isisnot-*`) | `rcaCheck` の部分だけ U1(U1 が先でなければ、U3 の PR が `rcaCheck` を足す) |
| U4 | `bowtie`(固定配置・`bowtie-barrier-missing`) | U1(描画関数の再利用) |
| U5 | `fta` の確率(`p`・`quant`・厳密計算と近似・注) | U2 |
| U6 | `whyWhyTable` / `whyWhyTree`・`whywhy-*`・凡例の「なぜの向き」 | なし(`rcaCheck` は U1 / U3 のどちらか先) |
| U7 | 文書: README、`skills/svg-diagram/SKILL.md`、`examples/` に `fta.ts`・`is-is-not.ts`・`bowtie.ts`・`why-why.ts`(golden を足す)、この ADR の状態 | U1〜U6 |

進める順番: U1 → (U2、U3、U4、U6 は並行) → U5 → U7。**U1 が最優先**(最も新しい記法で、他の単位が部品を借りる)。

### テスト方針

- **純関数**: `minimalCutSets`(AND / OR / vote / `ref` の共有、1 事象の木、大きさ 1 のカットセット)、確率(`ref` が無いときは積・和の式と一致、共有があるときは全場合の列挙と一致、近似は厳密以上の上限)、各検査規則(ノードの入力だけで出る)。
- **配置**は関係だけを見る(座標の絶対値を書かない): 頂上が最上段、ゲートの子が 1 段下、AND / OR のゲートの記号が子の上にある。
- **描画**は SVG の性質で見る(AND と OR の `path` が異なる、基本事象に円、未展開にひし形、ゲートの線に矢じりの `marker` が無い)。
- **byte 同一**: `examples/*.ts` の全部が、新しい例を除いて前後で同一。
- すべて `pnpm test` と `pnpm run typecheck` を通す。

### 完了の基準

- 貼られた説明の FTA の例(サービス停止 → OR → DB 全体停止(AND: 主系停止、待機系へ切替不能)/ アプリ全台停止)が、`faultTree` 数行で描け、AND と OR が記号で区別できる。
- 同じ例で `cutSets: true` を付けると、「アプリ全台停止」が単一故障点として強調され、AND の 2 事象は強調されない。
- IS / IS NOT の例(API A / B、リージョン X / Y、デプロイ前 / 後、一部 / その他)が `isIsNot` で描け、仮説の表で「接続設定の変更」だけが両方を説明できる印になる。
- 既存の `examples/out/` が byte 同一。

## 未決(実装担当が確認して追記する)

1. ゲート記号の細部を、IEC 61025 と JIS C 0508(故障の木解析)の規格の図で確かめる(特に vote、inhibit、house の形)。確かめられないときは、第 1 段の `kind` の名前だけ残して形は IEC に揃える。
2. `ref` を `faultTree` の外(別のバンド)の事象へ張れるようにするか(複数のバンドで 1 つの基本事象を共有する)。第 1 段は同じ木の中だけ。
3. `whyWhyTable` の行結合(同じ原因を共有する鎖)が `table()` で作れるか。作れないなら、同じ文の繰り返しにする。
4. ボウタイのバリアが 1 本の線の上に直列に乗る描き方で、複数対複数の対応を表したい要望がどれだけ出るか。
