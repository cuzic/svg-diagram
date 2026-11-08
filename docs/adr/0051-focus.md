# ADR 0051: 図の中の「今ここ」(`focus`)と、塗りつぶしの色の体系

- 状態: 実装済み(PR 待ち)
- 日付: 2026-11-08
- 基点: `main`(#360 まで)
- 関連: ADR 0002(`spotlight`)、ADR 0004(色のトーン)、ADR 0049(`tree()` のノードに band)

## 背景

研修の資料づくりで、章の頭に同じ全体像(マインドマップ)を繰り返し出し、「今ここ」の枝だけを目立たせたかった。
`diagram({spotlight})` は**図全体**を単位にするので、マインドマップの中の 1 つの枝を残せない(節の id を渡すと「図に id を付けて図ごと指せ」と止まる)。
作り手は節ごとに `tone` を書き分けて代わりにしたが、塗りつぶし(`solid`)は木の節では使えず、今の枝が十分に浮かなかった。

調べると、「1 つを目立たせる」書き方と色の語彙が部品ごとにばらばらだった。

| 部品 | 目立たせ方 | 項目の色 |
|---|---|---|
| `box` / `stat` / `banner` | `tone: 'solid'` | 9 色(`solid` / `solid-danger` を含む) |
| `stateDiagram` / `flowchart` | 状態ごとの `tone` | 9 色 |
| `tree` / `mindmap` / `causeTree` / `classDiagram` / `bpmn` | 節ごとの `tone` | 7 色(塗りつぶしなし) |
| `chevron` | `current` / `highlight`(0 始まり) | 7 色 |
| `steps` | `highlight`(1 始まり)+ `highlightTone` | 7 色 |
| `funnel` / `cycle` / `emblem` / `valueChain` | 項目ごとの `tone` | 7 色 |

## 決定

### D1. 項目のある図は、同じ 9 色を受け付ける

`plain / accent / new / changed / removed / muted / danger / solid / solid-danger`。`solid` / `solid-danger` は塗りつぶしで、文字(2 行目も)を白にする。
対象: `tree` / `mindmap`、`causeTree`(と `pdpc` / `relationDiagram` / `whyWhyTree`)、`classDiagram`、`bpmn` の節、`chevron` / `funnel` / `cycle` / `emblem` / `valueChain` の項目。
塗りつぶしの上に描く線は白にする: 原因の木の二重枠の内側、クラス図の区切り線、BPMN のゲートウェイの記号。循環(`cycle`)の塗りつぶした項目は、淡い輪ではなく塗った円にする。
レーン・表・ベン図・同心円は対象外(項目が「枠」ではなく「領域」なので、塗りつぶすと中身が読めない)。

### D2. `focus`: どの図でも同じ書き方で「今ここ」

`focus: 項目の id`(配列も可。並びの図では 1 始まりの番号も)。規則は 1 つ:
**focus の項目は `solid`、それに関係する項目は `accent`、ほかは `muted`。** 項目に書いた `tone` は置き換わる。

「関係する」は図の形で決まる。

| 形 | 図 | 関係する項目 | 線 |
|---|---|---|---|
| 木 | `tree` / `mindmap` | focus の下の節と、ルートまでの道の節 | その道と下への枝を強調色(上に重ねる) |
| 網の目 | `stateDiagram` / `flowchart` / `causeTree` / `pdpc` / `relationDiagram` / `classDiagram` / `bpmn` / `swimlane` | 矢印 1 本でつながる項目(向きは問わない) | focus に触れる矢印を強調色、ほかを灰色 |
| 並び | `chevron` / `funnel` / `cycle` / `steps` / `emblem` / `valueChain` | なし | 変えない |

網の目で「直接の相手まで」にしたのは、前後の流れが読めるから(ユーザーの選択)。並びは隣が自明なので、focus だけが浮くほうが「今ここ」として読みやすい。

### D3. 解決は DSL で、純粋に行う

`lib/focus.ts` の `resolveFocus` / `graphTones` / `sequenceTones` / `litLink` が、項目の**写し**に色を書き込む(渡した配列や木は書き換えない)。レイアウトと検査は、ふだんの `tone` を見るだけで済む。
矢印の色: `stateDiagram` / `flowchart` は遷移の `tone`、`swimlane` は流れ(connect)の `tone` に書く。`causeTree` / `classDiagram` / `bpmn` の矢印は色を持たないので、band に focus の id(`focused`)を持たせ、レイアウトがそのまま描画へ渡し、描画が「focus に触れるか」で強調色と灰色を選ぶ。木は線ごとに `lit` を持つ。

### D4. 線の色に合わせた矢じり

`connect` は線に `tone` を付けても矢じりが黒のままだった(マーカーが 1 色)。`accent` / `muted` / `danger` の線には同じ色の矢じり(`dsl-arrow-accent` など)を使う。強い線・二重線・暗くした線・矢じりなしは従来どおり。使われた色のマーカーだけを `<defs>` に足すので、色付きの線のない図の出力は 1 バイトも変わらない(golden は不変)。
**focus と無関係に変わる出力**: 既存の図で `connect(..., {tone: 'accent' | 'muted' | 'danger'})` を使っているものは、矢じりがその色になる(golden の例には該当がない)。これは不具合の修正として受け入れる。

### D5. 既存の書き方は残す

`chevron` の `current` / `highlight`、`steps` の `highlight` / `highlightTone` はそのまま(その項目を強調色にするだけで、ほかは薄くしない、より軽い強調)。`focus` と同時に書くと、どちらか一方にするよう止まる。

## 確かめたこと

- `test/focus.test.ts`(16 本)と `test/mindmap-focus.test.ts`(7 本): 各部品の色、線の点灯、白い文字、エラーの文面、入力を書き換えないこと。
- レビュー(Opus)で見つかった点を直した: 漏斗の増減率が塗りの上で読めない、BPMN の `iconTone` が塗りの上で消える、スイムレーンの focus が手順の文字色(`titleTone` など)で止まる(塗る手順ではそれらを外す)、木の band 節への線が常に点灯する(点灯は focus の走査で決める)、`legend: 'auto'` が focus した原因の木で役割の色を並べる、状態遷移図の開始の矢印が focus に従わない、`*Band` の型に `focus` が残る。
- 既存のテストと golden は、変更前と同じ結果(環境による既存の失敗を除いて差分なし)。意図した変更は 2 件: `bpmn` と `causeTree` の節が `solid` を受けるようになった(以前は拒否を確かめていたテストを、受けることの確認に直した)。

## 範囲外

- `pptx` 出力: これらの図は画像として貼るので、SVG と同じ見た目になる(個別の対応は不要)。
- HTML 出力(`--html`)は対象の図を扱わない。
- `spotlight` を項目単位にすること: 図全体を薄くする今の意味を変えず、図の中は `focus` が受け持つ。spotlight に図の中の節を渡したときのエラーで、`focus` を案内する。
