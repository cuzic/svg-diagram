# ADR 0010: 幅の超過を自動で収める(`dir: 'auto'`・段階的な縮め・非連結成分の詰め置き)

- 状態: 提案
- 日付: 2026-10-13
- 基点: `main`(4e58744、PR #120 まで)
- 関連: ADR 0008。要望の原文は「資料づくり(medius)からの要望」の B 節(B1 / B2 / B3)

## 背景

資料づくりの側から、レイアウトが幅を超えて止まる問題が 3 件届いた(B4〜B7 は別の ADR で扱う)。

| ID | 要望 | 実例 | 優先度 |
|---|---|---|---|
| B1 | 幅の超過で止まらず、自動で収める。`dir: 'auto'`、ラベルの折り返し、ノード幅の縮小、段組み。それでも無理なら直し方つきで throw | `causeTree`(現状ツリー)が「1460px だが 900px しかない」で throw。`dir` を変えて試行錯誤した。特性要因図も 6 つの骨で 1157px になり、骨を 4 つに減らした | 高 |
| B2 | 図ごとに幅の上限を変える。`diagram({maxWidth: 1200})` | 文書向け 940px と、スライド向けの大きなキャンバスで事情が違う。要確認: すでにあるか | 中 |
| B3 | 非連結の成分を詰めて置く | `dir: 'right'` にすると、独立した 2 つの因果の塊が離れて置かれ、中央に大きな空白ができた | 高 |

### 現状(コードで確かめた事実)

**エラーの出所。** 「1460px だが 900px」は `lib/toc.ts:95` のメッセージ `causeTree(): the figure is ${total.w}px wide but it has ${w}px (use a smaller maxNodeW, dir: 'right' or 'left', or fewer entities on one level)`。`w` は図の内幅で、`diagram()` の既定の幅 940(`lib/dsl.ts:120`)から左右の余白 20×2(`lib/dsl.ts:122`)を引いた 900。同じ形の throw が他に 3 つある。

| 部品 | 場所 | 超過時の挙動 |
|---|---|---|
| `causeTree` | `lib/toc.ts:95` | throw |
| `stateDiagram` | `lib/states.ts:77` | throw(`dir: 'right'` を勧める) |
| `tree` / `mindmap` | `lib/tree.ts:94` | throw(fishbone / org / timeline は `layout: 'list'` などを勧める) |
| `classDiagram` | `lib/classes.ts:67` | throw(`dir: 'right'` を勧める) |
| `bpmn` | `lib/bpmn.ts:99` | throw(`fit: 'shrink'` を勧める。今回の対象外) |

すべて「レイアウトを 1 回だけ試し、はみ出したら throw」。試行は 1 回で、`dir` を変えるかどうかは書き手に任されている。

**`dir` の扱い。** 部品ごとに語彙も既定も違う。

- `causeTree`: `'up'`(既定)/`'down'`/`'right'`/`'left'`(`lib/types.ts:1123`)。内部では常に `dir: 'right'` の層状レイアウトを走らせ、縦向きは転置して使う(`lib/toc.ts:93-94`)。
- `stateDiagram`: `'right'`(既定)/`'down'`(`lib/types.ts:1083`、`lib/states.ts:35`)。
- `classDiagram`: `'down'`(既定)/`'right'`(`lib/types.ts:1221`)。
- `tree`: `'down'`(既定)/`'right'`(`lib/types.ts:1014`、`lib/tree.ts:82`)。mindmap は `layout`(`lib/types.ts:1037`)に radial / right / left / down / up / org / list / brace / fishbone / timeline がある。
- `pert` / `causalLoop` / `dependencyNetwork`: `direction: 'LR' | 'TB'`(`lib/semnet.ts:24`)。
- `'auto'` を受ける `dir` はどこにもない。

**幅の上限。** `maxWidth` は 2 か所にある。
`.svg-diagram.json` の `maxWidth`(`lib/types.ts:2646`、`lib/config.ts:54`)と、`DiagramData.maxWidth`(`lib/types.ts:210`)。後者は `applyConfig` が設定ファイルの値を写す先で、コメントは「図自身の指定が勝つ」(`lib/config.ts:51`)と書くが、`diagram()` のオプションにも `DiagramOpts`(`lib/types.ts:125` 以降)にも `maxWidth` は無い(`lib/dsl.ts` に `maxWidth` の参照は無し)。つまり**図ごとの指定は現状できない**。しかも `maxWidth` を読むのは検査 `doc-width` だけ(`lib/rules.ts:499`: `d.medium === 'doc' && !d.canvas && d.width > (d.maxWidth ?? 940)` で警告)。レイアウトの幅は `diagram({width})`(`lib/dsl.ts:120`)で決まり、`maxWidth` は幅を決めない。README の案内も設定ファイルの例だけ(`README.md:950`)。

**fit.ts は別物。** `lib/fit.ts` は完成した図が**スライド上でどれだけ縮むか**の見積もり(`SLIDE_USABLE_WIDTH = 860`、`lib/fit.ts:19`)と警告で、レイアウトが収まらないときの再試行には関わらない。B1 の自動化はここではなくレイアウト側に置く。

**非連結の成分。** `lib/graph-layout.ts` の `layoutLayered`(160 行)に連結成分の概念は無い。全ノードを 1 つの層分けにかけ、層ごとに最も広い層へ中央揃えする(同 253-255 行 `widest`)。層は成分をまたいで共有されるので、短い鎖の成分は長い成分の層に引きずられ、成分の間に空白が生じる(要望の実例)。`layoutLayered` の利用者は `toc.ts:93`、`states.ts:64`、`classes.ts:59`、`semnet.ts:86`(いずれも `layoutWithLanes` 経由、`lib/layered-route.ts:155`)と `bpmn.ts:84`(層の算出にだけ使う)。

## 論点

1. 自動化の範囲: 既存の図(いま収まっている図)の出力を変えてよいか。
2. `dir: 'auto'` をどこまで広げるか(部品ごとの語彙の違い)。
3. 収まらないときの縮め方の順序と、止めどころ(文字の下限 14px との関係)。
4. 段組み(折り返して 2 段)を今回入れるか。
5. B2 は何を満たすべきか(検査の閾値か、レイアウトの幅か)。
6. B3 の詰め方(成分の積む向き)と、既存の図への影響。

## 決定

### D0: 前提(ADR 0009 の共通 PR)

層状レイアウトの 1 回分の試行(配置、辺の経路、点数、大きさ、`loose`)は、ADR 0009 の共通 PR が `layeredAttempt(nodes, edges, opts, {portStep, groupOf, transpose, maxAcross})` として切り出す。呼び出し側に散っている `routeLayered` の `place` / `portStep` / `groupOf`、幅の判定、転置(`lib/toc.ts:93-122`、`lib/states.ts:64-77`、`lib/classes.ts:59-67`)はそこに集まる。**本 ADR はこれに依存し、`graph-layout.ts` / `layered-route.ts` の配置アルゴリズムは触らない**。B3 の成分配置も ADR 0009(層番号は全体で 1 つ、成分ごとに座標を決めて詰める。0009 U2 の手順 4・5)が引き取る(D4)。マージ順は ADR 0009「実装順序」節に従い、0013 / 0012-E → 0011 U0・A → 共通 PR → 0009 → **0010** → 0012 の順で、0010 は 0009 の後。

### D1: 自動は「`dir` を省略した図」と `dir: 'auto'` だけ(B1)

明示した指定を黙って変えない。

| 書き手の指定 | 収まるとき | 収まらないとき |
|---|---|---|
| `dir` 省略 | 従来どおり(出力は不変) | 次の試行で収める。**適用したら warn**(`auto-fit-applied`) |
| `dir: 'auto'` | 下の選び方で選ぶ。適用の内容を **info** で出す | 同上で試し、それでも無理なら throw |
| `dir` 明示(`'up'`、`'right'` など) | 従来どおり | **自動で変えず、試した案つきで throw**(下記) |
| `maxNodeW` 明示 | 従来どおり | 明示値は縮めない。同上の throw |

`fit: 'strict'` は**作らない**(明示した指定は元々変わらないので不要で、既存の `fit: 'shrink'` / `--fit` と名前がぶつかる)。

**試行の順序**(省略時と `'auto'` で共通。各試行は `layeredAttempt` を 1 回呼ぶ):

1. 宣言なしの既定の向き(部品ごと。causeTree は `'up'`)。
2. 軸を変えた向き(`up` → `right`。意味が反転する `up` → `down` は試さない)。
3. 各向きで `maxNodeW`(`MAX_W`、`lib/toc.ts`)を 200 → 160 → 130 → 110 と狭める。下限は 100px で、ノード内の 1 行が 2 字未満(「支払/い」型)になる手前まで(`lib/rules.ts:330` の `shrink-narrow-text` の考え方)。文字サイズは下げない(`MIN_FONT_SIZE`、`lib/tokens.ts:245`)。

**`dir: 'auto'` の定義(1 つに絞る)**: 試行の候補を上の順序で並べ、**幅に収まり、かつ高さがキャンバスの高さ予算内**の案のうち、`layeredAttempt` の点数(ADR 0009 の (交差, 折れ) の辞書式)が最良のもの。同点なら順序の早い方。高さ予算は、`diagram({canvas})` なら `canvas.height`、スライドの測定があれば `maxDisplayHeight`(`lib/fit.ts`)、どちらも無ければ予算なし(幅だけ判定)。縦にして高さが予算を超える案は候補から外す。**`dir` 省略時は「最初に収まった案」**(面積では選ばない。既存の出力との連続性を優先)。

**意味優先**: 候補にしてよい向きの切り替えは、causeTree なら `up` ⇄ `right`、states / classes / tree なら縦横の反対側だけ。ADR 0009 D7 の pdpc の既定 `'outer'` のように、0009 の変更で幅が増えて、いま収まっている図がはみ出す場合は、**0009 が「収まっていた図は収まる」を点数の足切りで保証する**(0009 の責務。0010 は「0009 の後の `main` で収まっている図は不変」を条件にする)。

**全部で収まらないとき、または明示した指定のとき**は throw する。**試した案とその幅・高さを並べ、効きそうな直し方を 1 つ指す**。

```
causeTree(): the figure does not fit 900px.
  dir 'up' (as written) 1460px; 'right' 1180px (not tried: dir is explicit — write dir: 'auto' to let it change)
  fix: dir: 'auto', or widen the figure (diagram({width: 1100}))
```

直し方は「`dir: 'auto'` にする」「`width` を広げる」「図を 2 つに分ける」の 3 つから 1 つ選ぶ(分ける位置までは出さない)。

### D2: 段組みは今回の第 1 段階では入れない(B1 の一部)

層状レイアウトを折り返して 2 段にするには、段をまたぐ辺の経路が必要で、`edge-crossings` への影響が大きい。D1 の試行で、依頼の実例(現状ツリー 1460px、依頼者のソース)が収まるかを測ってから決める。足りなければ第 2 段階として、(a) tree / mindmap(fishbone)の兄弟を 2 段に分ける、(b) 層状の蛇行配置、を別 ADR で起こす。

### D3: 自動で変えたことは検査で知らせる

新しい検査 `auto-fit-applied`。`dir` 省略で自動が働いたら **warn**(`build` が出す `warnings` に載り、書き手が必ず目にする。`build-diagram.ts:149` の経路は warnings のみ表示するため、info では見えない)。`dir: 'auto'` と書いた図は意図どおりなので **info**。内容は「`dir` を `up` から `right` に変えた(1460→1180px)」「`maxNodeW` を 200→130 に縮めた」。warn は `check --strict` を落とす(`check-diagram.ts:253`)ので、省略時の warn は書き手に「`dir: 'auto'` と明示すれば info に下がる」と案内する。`accept` で許容できる(`RULE_DOCS` に登録、`lib/config.ts:43`)。

### D4: 非連結成分の詰め置き(B3)は ADR 0009 に移す

当初案(成分ごとに層を 0 から振り、`levelGap` も成分ごと)は、`routeLayered` が層番号で `layerRight` / `layerLeft` を引き、成分をまたいで最大・最小を取る実装(`lib/layered-route.ts:53-59,123`)と両立しない(折れる位置が別成分の隙間に出て箱を貫く)ので**捨てる**。ADR 0009 U2 の手順 4・5 が、**層番号は全体で 1 つのまま**、手順 4 で同じ成分を連続して並べ、手順 5 で成分ごとに座標を決めて詰める。本 ADR は B3 の受け入れだけを持つ。

- 先に空白の原因を再現して確かめる(依頼者の現状ツリーを `dir: 'right'` にして、層ごとの中央揃え(`lib/graph-layout.ts:253-255`)と成分の層の共有のどちらが空白を作るかを測る)。結果は 0009 の U2 に渡す。
- 成分が 1 つの図は現状と同一の出力。複数成分の既存の図は変わるので、ゴールデンの差分を個別に確認する(0009 の PR で)。
- `bpmn` は層番号を使うので影響を受けない前提で、0009 側で確認する。

### D5: 図ごとの `maxWidth`(B2)

要確認の結果は「**無い**」。ただし本来の要望(大きなキャンバスで 940px の警告を止めたい)は、次で満たす。

1. **`diagram({maxWidth})`**: `DiagramOpts` に `maxWidth?: number`(正の有限数)を足し、`diagram()` が `DiagramData.maxWidth` に保存する。`applyConfig`(`lib/config.ts:54`)は図の指定を優先する実装なので検査の側は変えない。意味は従来どおり**検査 `doc-width` の閾値**で、レイアウトの幅ではない。
2. **`width` との関係を README に書く**: 幅を広げるのは `diagram({width})`、警告の閾値を変えるのが `maxWidth`。`maxWidth` だけ大きくして `width` を省略しても幅は 940 のまま。D1 の throw で、`maxWidth` を指定した図が収まらなかったときは `width` を勧める。

`canvas` の図は `doc-width` の対象外(`lib/rules.ts:499`)で変えない。README(`README.md:950`)に、設定ファイルと図ごとの両方の例を足す。

### D6: semnet は対象から外す

`networkCanvas`(`lib/semnet.ts:83`)は幅が超えても throw せず、`scale = min(1, (g.w - 8) / naturalW)`(同 88 行)で縮める。収まらない問題の形が違うので、`direction: 'auto'` は**今回入れない**。縦横の選択で文字を大きく保てる場合の扱い(縮小率が小さいときだけ向きを試す、など)は、別の要望として起こす。`pert` / `causalLoop` / `dependencyNetwork` の `networkCanvas` は ADR 0009 U4 と ADR 0011 C も触るため、本 ADR は触らない。

## 代替案

- **A1: `dir: 'auto'` を既定にする。** 既存の図の向きが変わるので却下。
- **A2: 明示した `dir` も自動で変える(当初案)。** 書き手の意図が静かに変わり、通知(info)は `build` では見えない(`build-diagram.ts:149`)ので却下。D1 は明示した図を変えない。
- **A3: 文字を縮めて収める。** 14px の下限と `slide-min-text` に反する。
- **A4: `fit: 'strict'` で自動を止める。** 明示した指定が変わらなくなったので不要。既存の `fit: 'shrink'` / `--fit` と名前もぶつかる。
- **A5: 最初から全案を試して最良を選ぶ。** 収まる図の出力も変わる。省略時は最初に収まった案で止める。
- **A6: B3 を本 ADR の D4(成分ごとの層番号)で直す。** `routeLayered` と両立しない。0009 の全体で 1 つの層番号に統一した。
- **A7: B2 の `maxWidth` をレイアウトの幅にする。** 既存の意味(検査の閾値)と矛盾する。
- **A8: 段組みを最初から入れる。** D2 のとおり、測ってから。
- **A9: semnet にも `'auto'` を入れる。** D6 のとおり、throw でなく縮小なので別の問題。

## 影響

- **出力の互換**: 収まっている図は不変(省略時も明示時も)。変わるのは「いま throw している図で、`dir` 省略か `'auto'` のもの」。B3 の成分配置は 0009 の変更として別に差分が出る。
- **検査**: `auto-fit-applied`(省略時 warn、`'auto'` 時 info)を追加。README の検査一覧(`README.md:964` 付近)と `RULE_DOCS` を同期する。warn は `check --strict` で exit 1 になる点に注意(D3)。
- **API**: 追加のみ。`dir: 'auto'`(causeTree / stateDiagram / classDiagram / tree)、`diagram({maxWidth})`。`fit: 'strict'` と semnet の `'auto'` は作らない。`CauseOpts` / `StatesOpts` には 0009(straighten, returns)と 0012(scope)も同時に項目が足されるので、`types.ts` は各 PR が自分の項目だけを足す(順序は D0)。
- **エラー文**: 4 か所の throw(`toc.ts:95`、`states.ts:77`、`tree.ts:94`、`classes.ts:67`)が、試した案つきの共通の文面になる。文言を検査している既存のテスト(`test/toc.test.ts`、`test/states.test.ts`、`test/tree.test.ts` で `wide but` を grep)を直す。
- **リスク**: (1) 0009 の `layeredAttempt` の形が本 ADR の想定と違う場合は、D1 の試行の呼び出しを合わせる(0010 は 0009 の後なので追従できる)。(2) 縦向きの候補が高さ予算を超える(D1 で除外)。(3) fishbone の幅は骨の数で決まり、`maxNodeW` の縮小では足りないことが多い(D2 の第 2 段階の対象)。

## 実装計画

前提: ADR 0009 の共通 PR(`layeredAttempt`)と 0009 が `main` に入った後に着手する(D0)。`byte` 比較の基準は、各 PR 直前の `main`。

### U0: 試行の共通ヘルパ

- 新規 `lib/fit-width.ts`: `fitWidth(who, w, attempts, {mode: 'first' | 'best', heightBudget?})`。`attempts` は `{label, run: () => AttemptResult}` の列で、`AttemptResult` は `layeredAttempt` の戻り値(`size`、`score`、`loose` ほか)。**`fitWidth` は `layeredAttempt` を包むだけで、配置と経路は自分で持たない**。順に試し、`first` は最初に幅内の案、`best` は幅と高さ予算内で点数最良(同点は順序)。失敗は D1 の文面を組み立てる `fitFailure(who, w, tried, hint)`。
- `lib/types.ts`: `FitApplied`(適用した案の記録)と、各 `LaidOutXxx` の `fitApplied?: FitApplied[]`。
- テスト: 新規 `test/fit-width.test.ts`(`layeredAttempt` を偽の結果で差し替えた単体)。順序、`first` / `best` の選び分け、高さ予算での除外、明示指定で変えないこと、失敗文の中身。

### U1: causeTree(`lib/toc.ts`、`lib/dsl.ts:1531-1540`、`lib/types.ts:1123`)

`dir: 'auto'` を足し、`layoutCauseBand`(`lib/toc.ts:48`)の幅判定(`toc.ts:95`)を `fitWidth` に置き換える。`measureNode` の `maxW` を案ごとに変える。`dir` / `maxNodeW` が明示されたかを、`dsl.ts` で `undefined` との違いとして保持する。テスト(`test/toc.test.ts`): (a) `dir` 省略の広い図が収まり warn が出る、(b) `'auto'` は info、(c) `dir: 'up'` 明示は変えず、試した案つきで throw、(d) `maxNodeW` 明示は縮めない、(e) 収まっている図の SVG が不変(`main` 直前との byte 比較)、(f) 高さ予算を超える縦案を `'auto'` が選ばない。

### U2: stateDiagram / classDiagram(`lib/states.ts:77`、`lib/classes.ts:67`、`lib/types.ts:1083,1221`)

U1 と同型。ループ辺の幅(`reserve`)を含めた総幅で判定する。`test/states.test.ts`、`test/classes.test.ts`。U1 とファイルが別なので並列でよい。

### U3: tree / mindmap(`lib/tree.ts:94`、`lib/types.ts:1014`)

`dir: 'auto'`(down ⇄ right)と `maxNodeW` の縮小。balanced の `layout`(fishbone / org / timeline)は自動で `'list'` に変えず、メッセージで勧める。`test/tree.test.ts`、`test/mindmap-layouts.test.ts`。tree は `layeredAttempt` を使わないので、`fitWidth` に `layoutTree` の結果を直接渡す小さなアダプタを `tree.ts` に置く。

### U4: `auto-fit-applied` 検査と `diagram({maxWidth})`

- `lib/rules.ts`: `auto-fit-applied`(省略時 warn、`'auto'` 時 info)。`fitApplied` を読んで 1 行にする。`RULE_DOCS` と README の検査一覧に追記。
- `lib/types.ts` の `DiagramOpts` に `maxWidth?: number`、`lib/dsl.ts:120` 付近で検証して保存。README(`README.md:950`)に例と `width` との違い。
- テスト(`test/cli.test.ts` の `doc-width`、`test/cli.test.ts:111` の隣): `diagram({maxWidth: 1200})` で警告が出ない、設定ファイルより図が勝つ、不正値で throw、`auto-fit-applied` が省略時 warn / 明示時 info で出て `build` の warnings に載る。

U1〜U4 は `types.ts` の同じ型に項目を足すので、各 PR が自分の項目だけを足す。

### 順序と分担

(0009 の共通 PR と 0009)→ U0 → (U1、U2、U3 を並列)→ U4。各 PR 前に `pnpm test` と `pnpm run typecheck`。ゴールデンは `pnpm run golden` で、直前の `main` との差分が U1〜U3 では「いま throw していた図が出るようになる」以外に無いことを確認する。

### 受け入れ条件

- 依頼者の現状ツリーのソース(1460px の実物。合成の図では代替しない)が、`dir` 省略か `'auto'` で、既定の幅で throw せずに出る。省略時は warn、`'auto'` は info。そのソースを `examples/` に置く(依頼者の許可を得た範囲で)。
- 同じソースで `dir: 'up'` を明示すると、変えずに試した案つきで throw する。
- 収まっている既存の `examples/` は byte 同一(各 PR 直前の `main` と比較)。
- `diagram({maxWidth: 1200})` で、`width: 1200` の `medium: 'doc'` の図が `doc-width` を出さない。
- 特性要因図の 1157px(6 本の骨)は第 1 段階では収まらない可能性が高い。その場合は、throw の文面が試した案と幅を出すこと、第 2 段階(D2)の要否を測った数字つきで記録することを条件にする。

### 未決(実装担当が確認して ADR に追記する)

- 0009 の `layeredAttempt` の最終的な型(D0。0010 は 0009 の後なので、着手時に合わせる)。
- 依頼者の 1460px の実物が D1 の試行で収まるか。収まらなければ D2 の第 2 段階を別 ADR で起こす。
- B3 の空白の原因の再現結果(D4。0009 U2 に渡す)。
