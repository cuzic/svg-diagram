# ADR 0034: 描いた SVG に、ノードの名前を `data-node` で出せるようにする(希望したときだけ)

- 状態: 起草(実装あり: `lib/emit-node-ids.ts`、`test/node-ids.test.ts`)。Opus の批判レビューを受けて、当初の「描いた SVG の文字列に属性を足す後処理」を、「ノードに名前を持たせて `renderBoxRect` が書く」形に作り直した
- 日付: 2026-10-17
- 基点: `main`(e19eb38、PR #290 まで)
- 関連: ADR 0012(scope と名前)、ADR 0031(FCIS。新しい `lib/` はコアで、純粋関数は名前でテストされる)

## 背景

描いた SVG は、`<rect>` / `<text>` / `<path>` が平らに並んだものだ。どの図形がどのノードかは、SVG から分からない。折り返した文は複数の `<text>` に分かれ、ノードごとのグループも id も無い。

SVG を表示する側(ブラウザのページ、Slidev の addon など)は、「このノードをクリックした」「このノードに印を付ける」をしたい。いまは、文字の並びからノードの枠を推測するしかない。折り返しの規則やレイアウトが変わると壊れる。使う側として最初に決まっているのは、ブラウザで図を操作するページ(`renderDiagram` を直接呼ぶ)。

## 決定

1. **オプションにする**: `renderDiagram(d, {nodeIds: true})`(`emitOutputs` / `emitSvg` / `emitRevealStage` も同じ)。既定は off で、**off のときの SVG は 1 バイトも変わらない**(見本の図すべてと、帯の種類ごとの図で、on の SVG から属性を取り除くと元と一致することをテストで確かめる)。
2. **名前**: `connect()` や spotlight が使う名前と同じ。scope があれば `scope.id`、なければ素の id(ADR 0012)。2 つの図が同じ id を使っても、scope が違えば `data-node` も違う。whyWhyTree が自分で付けた名前(`id` を渡さないときの `problem`、`w1` など。`unanchored`)は、作者が使える名前ではないので付けない(`id` を渡したときの `<id>.problem` は、`connect()` が使える名前なので付く)。
3. **付ける場所**: ノードの枠の `<rect>`。`BoxLike`(`renderBoxRect` が受け取るもの)に `dataNode` を足し、`renderBoxRect` が `data-node="…"` を書く。ノードを `{...n}` で渡している描画側は、そのまま運ぶので変えない。
4. **対象**: 名前を持つ `box`(単独の帯、`row` / `grid` の子。`canvas` の領域は `grid` として配置されるので付く。`swimlane` の作業も、配置では box として置かれるので付く)、`tree`(`mindmap` を含む)、cause 系(`causeTree` / `relationDiagram` / `whyWhyTree`)、`bpmn` の作業(task)。矩形で描かれないもの(cause の六角形、bpmn のゲートウェイとイベント)と、二重枠の内側の枠は付けない。
5. **作り方**: `withNodeIds(laidOut)`(純粋)が、配置済みの帯をコピーして、名前のあるノードに `dataNode` を足す。`emitSvg` が `nodeIds` のときだけ呼ぶ。cause と bpmn では `anchors[i]` が `nodes[i]` の名前(どちらも配置が同じ一覧から作る。描画側の `renderCause` も同じ添字で読む)。

## 却下した案

- **描いた SVG の文字列に、あとから属性を足す**(当初案): `<rect x y width height rx="8"` の一致に頼るので、`renderBoxRect` の出力の形が変わると、黙って付かなくなる。行・グリッドの子の box も拾えなかった。ノードに値を持たせて `renderBoxRect` が書くほうが、小さく、壊れにくい。
- **いつも出す**: 全図の golden が変わる。使わない人の SVG も大きくなる。
- **`<g data-node>` で囲む**: ノードごとの `<g>` にするには、描く順を変える必要がある(いまは枠をすべて描いてから、文字をまとめて描く)。
- **表示する側が、文字の並びから推測する**: 折り返し・レイアウトの変更で壊れる。

## リスクと限界

- **ラベルの `<text>` は、枠の `<rect>` の上に兄弟として重なる**。ラベルの上のクリックは `event.target` が `<text>` になり、`closest('[data-node]')` では枠に届かない。表示する側が、`text { pointer-events: none }` を当てるか、`elementsFromPoint` で枠を探す。この ADR は文字には付けない(文字の判定は枠の内側かどうかで、表示側のほうが簡単にできる)。
- 付くのは SVG だけで、HTML 出力(`--html`)には付かない。click-through の段階の SVG は `emitRevealStage(laid, stage, {nodeIds: true})` で付く。
- 対象外の帯(fta / bowtie / states / flowShape / cloud など)には付かない。必要になったら、`withNodeIdsBand` に足す。
- 名前は 1 つの図の中で一意(同じ名前は配置の段階でエラーになる)。同じ id を 2 つの図で使うときは、scope を付ければ `scope.id` で区別される。

## 後回し

- CLI の `build --node-ids`。
- 対象の帯を増やす。矩形でないノード(円・菱形・六角形)の印の付け方。
