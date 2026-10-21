# ADR 0041: `flowchart()` — 判断(ひし形)のある流れ図を、状態遷移図の配置のうえに作る

- 状態: 提案
- 日付: 2026-10-21
- 基点: `main`(PR #326 まで)
- 関連: ADR 0039 項目 9、ADR 0016(経路 `layered-route.ts`)、ADR 0019(`maxNodeW`・`dir: 'auto'`)、ADR 0036(`density`)、`lib/states.ts`、`lib/bpmn.ts`
- 由来: 利用者の報告(判断フロー: Yes/No の分岐を、箱と辺ラベルで代用していた)。「長い日本語の質問文がひし形に収まるよう、ひし形の中の折り返しと自動拡大も」という要望

## 背景

Yes/No の分岐を持つ流れ図(処理・判断・開始/終了)を描く部品がない。実測(ADR 0039):
- `bpmn` を 1 レーンで使うと、ゲートウェイの `label` は図形の左上に出るため、長い質問文(「自分で答えられる？」)が隣のタスクに重なり、build が止まる。縦向きもない。
- 箱と `connect` で組むと、分岐の菱形は描けず、辺ラベルの配置・矢印の経路は手作業になる(利用者の実例: 箱 10 個と `connect` 10 本)。

## 検討

| 案 | 内容 | 判断 |
|---|---|---|
| A: `bpmn` を直す | ゲートウェイの文字を中に入れ、レーン無し・縦向きを足す | BPMN の表記(レーンが前提、ゲートウェイの記号 ×/＋/○ は文字を持たない)を壊す。依頼の形(質問文が菱形の中)とは別の部品 |
| B: 新しい帯を一から作る | 配置・経路・描画・検査を新規に | 重い。`stateDiagram` が必要な部分(層に分ける配置、直角の経路、辺ラベルの chip、`dir`、`maxNodeW`、`density`、`returns`、`fold` の検討)を既に持つ |
| C: `stateDiagram` の配置を使う薄い入口 | 節の形に `diamond` / `pill` を足し、`flowchart()` が `StatesBand` を作る | **採る**。配置・経路・辺ラベル・検査・PPTX の扱いを再利用できる |

## 決定

### D1: API
```ts
flowchart(
  [
    {id: 'start', kind: 'terminator', label: '新人からの相談'},
    {id: 'q1', kind: 'decision', label: '自分で答えられる？'},
    {id: 'a1', label: '回答する'},                       // kind は省略すると process
  ],
  [{from: 'start', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'q2', label: 'No'}],
  {dir: 'down'},   // 既定 'down'。'right' / 'auto' も(stateDiagram と同じ)
)
```
- `kind`: `process`(角丸の箱。既定)/ `decision`(ひし形)/ `terminator`(両端が丸い箱)。`label` は必須、`sub`(2 行目)、`tone`、`icon` は `stateDiagram` の節と同じ。
- 辺: `{from, to, label?, line?, tone?, ...}` は `stateDiagram` の遷移と同じ。ラベルは辺の上の白い chip(既存)。
- 戻る辺・飛ばす辺・自己ループは `stateDiagram` と同じ扱い(`returns: 'outer'` も通る)。
- ノードの `id` は `connect()` の端点(`b.anchors.<id>`、`scope` も既存)。

### D2: 実装は `StatesBand` を作る薄い入口
- `StateItem.shape` を `'box' | 'circle' | 'diamond' | 'pill'` に広げる。`flowchart()` は `kind` をこれに写して `stateDiagram` と同じ帯を返す(新しい帯の型は作らない。layout / emit / verify / PPTX の分岐は増えない)。既定の向きだけ違う(`dir: 'down'`)。
- エラーの前置きは `flowchart():`(帯に `who` を持たせる)。`stateDiagram` の `initial` / `final` は持たない(開始・終了は `terminator`)。

### D3: ひし形の大きさは、中の文字から決める(自動拡大)
- 文字は、ひし形の内側に収まる矩形として置く: 文字の幅 tw・高さ th に対し、ひし形の幅 W・高さ H は `tw / W + th / H ≤ 1` を満たす。縦横比を W : H = 1.6 : 1 に決めると `W = ceil8(tw + 1.6 × th + 余白)`。
- 文字の折り返し幅は、箱より狭く(ひし形の幅が膨らみすぎないよう、`maxNodeW` の 6 割)取る。語は割らない(`keepWords` の対象に含める)。それでも広くなるときは、ひし形が広がる(自動拡大)。幅に収まらなければ `dir: 'auto'` / `maxNodeW` の既存の手順に従う。
- 4 つの頂点が矢印の出入口。`circle` と同じく、矢印は辺の中央に寄せる(`round`)。

### D4: 描画
- `diamond`: 4 点の多角形(塗りと線は箱と同じ tone)。`pill`: `rect` の `rx = h / 2`。文字は中央(円と同じ扱い)。
- 矢じり・辺ラベルの chip・`dim`(spotlight)は `stateDiagram` のまま。

### D5: 検査(情報レベルから)
- `flowchart-decision-edges`(情報): `decision` から出る辺が 2 本より少ない(分岐になっていない)、またはラベルのない辺がある(Yes/No など、分岐の意味が読めない)。
- 既存の `text-mid-word-break` / `edge-crossings` / `cjk-line-long` はそのまま効く。

### D6: 範囲外
- レーン(担当)を持つ流れ図: `bpmn` を使う。
- 入出力・書類・データベースなどの記号(平行四辺形など): 後で `kind` を足せる形にしておく。
- 自動の `fold`(長い流れの折り返し): 縦横比の info(`aspect-tall`)の案内に任せる。

## 決めたいこと(レビューで見てほしい)
1. `StatesBand` の再利用で、PPTX の書き出し(`lib/pptx/bands.ts` の `states` の分類)に、ひし形・丸の箱の分岐が要るか。
2. ひし形の文字の折り返し幅(`maxNodeW` の 6 割)と、縦横比 1.6 : 1 が、日本語の質問文(全角 10〜20 字)で見た目に合うか。
3. `decision` の既定の tone(`plain` のままか、`accent` か)。

## 作業の順
1. `shape` の追加と、ひし形・丸の箱の大きさ・描画(`stateDiagram({shape})` としても使える)。
2. `flowchart()` の入口と、`flowchart-decision-edges`。
3. README・skill・例(`examples/flowchart.ts`)・golden。
