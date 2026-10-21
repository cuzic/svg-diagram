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
- 戻る辺・飛ばす辺は `stateDiagram` と同じ。**既定の `returns` は `'outer'`**(流れ図の「やり直し」はほぼ必ず判断へ戻る。`inline` だと別の節の外接矩形を通って build が止まり、`outer` なら横の頂点に入ることを実測した)。自己ループは判断・終端では throw(ひし形の頂点に付かない。流れ図では稀)。
- ノードの `id` は `connect()` の端点(`b.anchors.<id>`、`scope` も既存)。

### D2: 実装は `StatesBand` を作る薄い入口。名前と向きは帯に持たせる
- `StateItem.shape` を `'box' | 'circle' | 'diamond' | 'pill'` に広げる。laid-out の節は `circle?: true` に代えて **`shape`** を持つ(`circle` はそこから導く。D5 の検査もこれを見る)。`flowchart()` は `kind` をこれに写して `stateDiagram` と同じ帯を返す。新しい帯の型は作らない(型で引く表が 10 か所以上あり、どれも states の関数を呼ぶだけになるため)。
- 帯と laid-out に **`flavor?: 'flowchart'`**。エラー・検査の文言は、flavor から名前(`flowchart()` / 節→「ノード」、遷移→「矢印」)を引く 1 つの表にまとめる(`stateDiagram()` / `state "x"` が、`states.ts` の throw、`fitLayout` の前置き、`layout-handlers` の id の衝突、`verify-base` の `statesProblems`、`rules.ts` の交差・`density-compact-restored`・`auto-fit-applied` に出るので、flowchart では出さない)。
- **既定の向きは帯の `defaultDir: 'down'`**(`dir` に書き込まない)。`dir` を帯に書くと「作者が明示した向き」になり、幅に収まらないとき向きを変えずに止まり、`auto-fit-applied` も出ない。`explicitDir` は作者が書いたかどうかだけで決める。省略・`'auto'`・`'down'` の 3 通りをテストする。
- `initial` / `final` は flowchart の入口で受けない(開始・終了は `terminator`。二重線は付けない)。`stateDiagram` 側で `diamond` / `pill` と `final` を組み合わせると throw する(矩形の内枠が形に重なるため)。

### D3: ひし形の大きさは、中の文字から決める(自動拡大)。矢印は輪郭まで延ばす
- 文字は、ひし形に内接する矩形として置く。文字の幅 tw・高さ th(`sub` と icon の行を含む)に対し、幅 W・高さ H は `(tw + 2·8) / W + (th + 2·6) / H ≤ 1`(角の文字が線にかからない余白)。W と H は別々に 8 の倍数へ切り上げる。W : H = 1.6 : 1。
- **折り返しは、行数を 1〜4 通り試して、W が最小のもの(同点なら H が小さいもの)を取る**。`maxNodeW` は上限としてだけ使う。「`maxNodeW` の比率で狭める」は取らない: 1 行増えるごとに W は 32px 増えるので、狭めるほどひし形は広がる(実測: 20 字で W 232 → 368)。`fitLayout` の「節を狭めれば図が狭くなる」という前提がひし形では逆になるので、W が `maxNodeW` に対して単調非増加になるよう、上限の中で最小を取る。カタカナの長い語の床(`keepWords`、最大 240px)は許容する。
- **`round` は矢印を辺の中央に寄せない**(直線化を止めるだけ。同じ辺に出入りする矢印は 14px ずつずれて並ぶ)。ひし形は輪郭が斜めなので、頂点から d ずれたポートは外接矩形の辺から `d·H/W` だけ輪郭が離れ、矢印が 4〜9px 浮く。そこで、**経路を作った後に、ひし形側の端点を最初(最後)の線分に沿って輪郭まで延ばす/縮める補正**を入れる(線分は辺に垂直なので、動かす量は `d·H/W`)。戻る辺の端にもかける。円(`circle`)にも同じ補正を入れられる。補正の後は、ひし形を `round` から外して直線化を許す(端点が頂点から外れた直線になっても、補正で輪郭に届く)。golden で、直線化の有無を比べて決める。
- 判断から出る辺のラベルは、**最初の直線部分(柄)の側から**置く候補を足す(流れ図の Yes/No は判断のそばにある。いまは「最後の直線部分から」置くので、行き先の手前に出る)。柄が短い(18px)ときは、柄を延ばす。

### D4: 描画
- `diamond`: 4 点の `path`(bpmn のゲートウェイと同じ。`polygon` は HTML 出力で CSS 化されない)。`pill`: `rx = h / 2` の矩形で、両端の余白を `h / 2 - PAD_X` ぶん足す。文字は中央(円と同じ分岐。条件を `shape === 'circle'` から「box 以外」に変える)。
- 矢じり・辺ラベルの chip・`dim`(spotlight)は `stateDiagram` のまま。検査の外接矩形の判定は、最初はそのまま(安全側の誤検出で build が止まる方向。golden で確認して、増えるなら形に沿った判定にする)。
- PPTX は `states` が画像として入るので、分岐は要らない(将来、図形で書き出すときに `flowChartDecision` を足す)。

### D5: 検査(情報レベルから)
- `flowchart-decision-edges`(情報): `decision` から出る辺が 2 本より少ない(分岐になっていない)、または**判断から出る**辺にラベルがない(Yes/No など、分岐の意味が読めない。判断へ入る辺は対象外)。3 本以上は「2 つの判断に分ける」を勧める。`shape === 'diamond'` で見る(flavor に依らない)。
- 既存の `text-mid-word-break` / `edge-crossings` / `cjk-line-long` はそのまま効く。

### D6: 範囲外
- レーン(担当)を持つ流れ図: `bpmn` を使う。
- 入出力・書類・データベースなどの記号(平行四辺形など): 後で `kind` を足せる形にしておく。
- 自動の `fold`(長い流れの折り返し): 縦横比の info(`aspect-tall`)の案内に任せる。

## 決めたこと(レビューを受けて)
1. PPTX の分岐: 要らない(D4)。
2. 折り返し幅と縦横比: 行数を試して W 最小(D3)。縦横比は 1.6 : 1(2.0 だと斜辺が寝てひし形に見えにくい)。高さが箱の 2〜3 倍になる点は、README で「判断が多い流れは `dir: 'right'`」と案内し、`aspect-tall` の info に任せる。golden で 1.6 と 2.0 を並べて確かめる。
3. `decision` の既定の tone: `plain`(形が判断の印。`accent` を既定にすると、判断が多い図で強調色が散り、`tone` を「この図の要点」に使う約束と衝突する)。

## 作業の順
1. 形の追加(`diamond` / `pill`)と寸法(D3 の W 最小、余白、格子)、ひし形側の端点の補正、文字の中央寄せ、`final` との組の扱い、laid-out の `shape`。
2. 帯と laid-out に `flavor`、名前の表、`defaultDir`、flowchart の既定 `returns: 'outer'`。ここまでを `stateDiagram({shape})` で golden にして見る。
3. `flowchart()` の入口、`flowchart-decision-edges`、判断から出る辺のラベルの置き方。
4. README・skill・`examples/flowchart.ts`・golden。golden に入れる形: 判断 2 本、判断 3 本、判断へ戻る辺、dir right、狭い幅(`fitApplied`)、density compact、20 字の質問。

テストで押さえる失敗: (i) ひし形の端点が輪郭上にある(輪郭までの距離 < 1px)、(ii) 省略時に `fitApplied` の mode が `'omitted'`、(iii) `maxNodeW` を狭めてもひし形の W が増えない、(iv) flowchart の検査・エラーの文言に `stateDiagram` / `state "` が出ない。

## 範囲外(追記)
- ブラウザ版図解(`node-ids`)での流れ図: `states` には `data-node` が付かない(既存の穴)。選べるようにするときに足す。
