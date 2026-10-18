# ADR 0036: `diagram({density: 'compact'})` — 層状の図の間隔を詰めて、同じ図を小さい面積に収める

- 状態: 実装済み(PR 本文を参照)。Opus の読み取りレビューを受ける
- 日付: 2026-10-18
- 基点: `main`(PR #293 = ADR 0035 まで)
- 関連: ADR 0016(経路 `layered-route.ts`)、ADR 0019(`maxNodeW` の格子)、ADR 0031(FCIS。`WrapEnv` / `LayoutCtx` を純粋な層へ渡す口)、ADR 0010(幅・高さに収める `fitLayout`)
- 範囲外: 箱の中の余白(`PAD`)、文字の大きさ、`width: 'fit'` 以外の図の幅の決め方、層状でない図(表・グラフ・チャート・ワイヤーフレーム)、`mindmap` の `layout: 'radial'` 以外の配置の個別調整

## 背景

利用者から「もっと密度を上げてほしい」と求められた。聞き直した結果、意味は次のとおり:
- **図を小さくまとめる**: 箱と箱、層と層の間隔を詰めて、同じ内容をより小さい面積に収める。線の本数と交差は変えない。
- **対象は図の種類を問わず全部**(層状の図)。

層状の図の間隔は、図の種類ごとに別々の定数が持っている(実測。`lib/` の定数):

| 図 | 兄弟の間隔 | 層の間隔 | 線のレーン・スタブ |
|---|---|---|---|
| 因果ツリー(`toc.ts`) | `GAP = 28` | `LEVEL = 64`、`gapFor(...)` | `layered-route.ts` の `STUB = 18`、`LANE = 14` |
| 状態遷移(`states.ts`) | `GAP = 28` | 72 / 64 / `widest + STUB + ARROW + 8` | 同上 |
| クラス図(`classes.ts`) | `GAP = 36` | `LEVEL_GAP = 72` | 同上 |
| ツリー(`tree.ts`。組織図・マインドマップ) | `GAP = 24` | `LEVEL_GAP = 44` | — |
| 故障の木(`fta.ts`) | `GAP = 24` | `LEVEL_GAP = 36` | — |
| BPMN(`bpmn.ts`) | — | `COL_GAP = 52 / 36` | `STUB = 16` |

定数を直接書き換えると、既存の図(golden)が全部変わる。図ごとの間隔を 1 つの指定で変える口が要る。

## 決定

### D1: `diagram({density: 'normal' | 'compact'})`。既定は `'normal'`(今のまま)
- `DiagramOpts.density` / `DiagramData.density`。検証は `diagram()` で(`'normal'` か `'compact'` 以外は throw: `diagram({density}) must be 'normal' or 'compact'`)。
- `'compact'` は間隔の倍率 **0.75**(`spaceOf`、`lib/layout.ts`)。倍率は値で書かせない(`density: 0.6` のような自由な数は、図が壊れる下限を利用者に背負わせるので入れない。段階が要るなら語を足す)。
- 書かない図の SVG は 1 バイトも変わらない(`pnpm golden` の差分ゼロ。実測)。

### D2: 倍率は `WrapEnv.space`(省略可、既定 1)で、既にレイアウトまで届いている env に載せる
- `WrapEnv` は `layoutBands` が作る `LayoutCtx`(`extends WrapEnv`)が、そのまま各レイアウト関数に `env` として渡している(`layout-handlers.ts` の `layoutBpmn(..., ctx)` など)。`space` を足すと、純粋な層(`toc.ts` など)に**新しい引数を足さず**に届く。`space` は省略可なので、`{wrap, keepWords}` の literal を作るテストは変わらない。
- 純粋な層はモジュールの状態を持たない(`core-purity.test.ts`)ので、定数を差し替えるのではなく、使う場所で `Math.round(定数 * (env.space ?? 1))` と掛ける。
- `layered-route.ts` は、`STUB` / `LANE` を `stubOf(space)` / `laneOf_(space)`(`Math.round`)で関数にし、`routeLayered` の先頭で局所の `STUB` / `LANE` として**同名で隠す**(関数の中の約 12 か所の参照を書き換えない)。`gapFor(n, chip, space)`、`layoutWithLanes(..., chip, space)`、`AttemptOpts.space` が受ける。

### D3: 詰める対象と、詰めない対象
詰める(`env.space` を掛ける):
- 因果ツリー: `GAP`、`LEVEL`、`gapFor(degree)`、レーンとスタブ(`AttemptOpts.space`)。`PORT = 22`(AND の矢じりの間隔)は詰めない(矢じり 12px が離れる最小のため)。
- 状態遷移: 兄弟の間隔(自己ループの無いとき)、層の間隔、`gapFor`、レーンとスタブ。自己ループのある行間は詰めない(ループの腕 `LOOP = 26` の置き場)。
- ツリー(組織図・マインドマップ・`layoutBalanced`)・故障の木: `GAP` と `LEVEL_GAP`。
- BPMN: 列の間隔 `COL_GAP`。レーンの高さ(`PAD_Y`)・フロー用の `flowRoom` は詰めない(ラベルの置き場)。

詰めない:
- **クラス図の兄弟の間隔(`GAP`)とレーン・スタブ**。多重度のラベル(`1`、`1..*` など)を矢印の端に置くので、詰めるとラベルどうしが重なる(実測: `GAP` を詰めると `classes: label "1" overlaps label "1..*" by 1x6px`、スタブを詰めても同じ)。クラス図は**層の間隔の基本値だけ**詰める。
- 箱の中の余白(`PAD_X` / `PAD_Y`)と文字の大きさ(`roles`)。範囲外。

### D4: 効く範囲(事実を書いておく)
- **幅が決まっている図(`width: 940` など)では、間隔を詰めても SVG の幅は変わらない**。図が狭くなって中央に寄るだけで、縦長の図(層が縦に積む図)の**高さが減る**。ツリー・状態遷移・BPMN のように、図が幅で決まる(層が横に並ぶ)図は、高さが変わらない。幅も縮めたいときは `width: 'fit'`(既存)と組む。
- 詰めた結果、図が幅や高さの予算に**収まりやすくなる**はず(間隔は小さくしかならない)。`maxNodeW` の格子や `fold` への影響は**測っていない**(未解決)。

### D5: 検査は変えない
`edge-bends`・`cause-crossing`・箱の貫通など、図の検査は変えない。詰めた結果、ラベルが重なる・矢印が箱に触れる、など検査が失敗するときは、その図で `density` を使わない(D3 のクラス図が例)。

## 検証(実装 PR での実測。`examples/` の同じ図を normal と compact で並べた)

| 図 | 通常 | compact |
|---|---|---|
| 因果ツリー(現状ツリー。利用者の図、15 節) | 732px | 636px |
| 因果ツリー(`toc-crt`) | 596px | 524px |
| 因果ツリー(`toc-frt`) | 616px | 544px |
| PDPC(`qc-pdpc`) | 848px | 740px |
| 故障の木(`fta`) | 702px | 675px |
| 組織図(`org-chart`) | 312px | 290px |
| マインドマップ(`mindmap`) | 316px | 292px |
| クラス図(`class-diagram`) | 688px | 664px |
| 状態遷移・BPMN | 268px / 500px | 同じ(幅で決まる図) |

- 型検査、全体テスト(既知のフォント差 2 件を除いて通る)、全例の `golden`(`density` を書かない図は差分ゼロ)。テスト: `diagram({density: 'compact'})` で因果ツリーが 5% 以上低くなり、`'normal'` と書かない図は同じ辺・同じ高さ、`density: 'tight'` は throw。
- 目視: `qc-pdpc`・`toc-frt` を並べて、線の重なり・矢じりの重なりが無いことを確認した。

## 未解決の項目
- **倍率 0.75 の根拠は目視**(箱の高さ 36〜55px に対し、レーン 14 → 10〜11px、スタブ 18 → 14px)。因果ツリーの 15 節の図で、間隔 0.55 倍(`STUB = 12`、`LANE = 10`、`GAP = 18`、`LEVEL = 40`)でも読めたが、AND の矢じりが近づく図・ラベルのある図で確かめていない。
- **対象外の層状の図**: `pert` / `dependencyNetwork` / `causalLoop` / `semnet` / `arrowDiagram`(同じ `layoutLayered` を使うが、`density` を渡していない)。`states` の自己ループのある行間。
- **検査の追加**: 詰めすぎで `edge-bends` が増える図があるかを、実在の図(`medius-research` の因果ツリー 33 本など)で測っていない。
- **図の幅が決まる図**(ツリー・状態遷移・BPMN)では、`density` の効果が図の幅に出ない(D4)。`width: 'fit'` の組み合わせの例を足すかは未定。
- **`density: 'compact'` を `width: 'fit'` と組んだときの検査**(`doc-width` など)は、組み合わせの実測が無い。
