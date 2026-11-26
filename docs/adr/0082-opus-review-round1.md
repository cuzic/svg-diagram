# ADR 0082 Opus レビュー 第 1 回

- 対象: `docs/adr/0082-chevron-rows.md`（PR #468、ブランチ `docs/adr-chevron-wrap`）
- 見方: ADR の主張を `ファイル:行` と試し（spike）で確かめた。試しはリポジトリの外のコピーで、`layoutChevron` に D2・D4 を最小限に入れて `build` / `check --strict` / `preview` / PPTX を回した。
- 試しで確かめて問題がなかったこと（指摘にしない）:
  - **D8 のバイト同一:** 段の式（`cols = min(perRow, n)`、`yy = out.y + row*(cellH+rowGap)`、`out.h = rows*cellH + (rows-1)*rowGap`）で、`examples/chevron-release.ts` と `examples/chevron-vertical.ts` の SVG が今と 1 バイトも違わない。`rows = 1` では `1*cellH + 0*rowGap === cellH`、`out.y + 0 === out.y` で、浮動小数も変わらない。
  - **`t.wrap` の繰り返し:** `Texts.wrap`（`lib/flow-layout-core.ts:74-78`）は `wrapText` と `widthOf` を呼ぶだけで、`out` に何も足さない。`t.place` だけが `texts` と `labelBoxes` に足す（同 84-93）。`'auto'` の探索で何度呼んでもよい。測る文字（atom）は `measureFlow` が幅によらず先に測る（`lib/flow-definition.ts:13-17`）。
  - **PPTX:** 続きの線は `freeformPathXml` の `cxnSp` になり、`tailEnd type="triangle"` が付く（`lib/pptx/flow.ts:47`）。
  - **HTML:** 下の B1 を直せば、重ねる `<svg>` に `dsl-arrow` が 1 つ入る。

## Blocker

### B1. 続きの線の矢じりが `<defs>` に出ず、`check` が誤りで止まる

- 節: D4、D6、「ラチェット」の段落（「分岐は要らない」）
- 根拠:
  - `<defs>` の `dsl-arrow` は `needsArrow` のときだけ出る（`lib/emit-svg-core.ts:38`、`:47-50`）。`needsArrow` は、つなぎ線か、帯の定義の `svgDefs` が `arrow: true` を返したときだけ真になる。
  - chevron の定義には `svgDefs` が無い（`lib/bands/chevron.ts:13-26`）。concentric（`lib/bands/concentric.ts:24`）と cycle（`lib/bands/cycle.ts:23`）にはある。
  - 試し: つなぎ線のない 7 つの chevron を `perRow: 4` にすると、`marker-end="url(#dsl-arrow)"` が出るのに `<marker>` が無い。build が `[undefined-marker] … no <marker id="dsl-arrow"> is defined in this file` の誤りで止まる。
- 問題: D6 の「marker の出し方は既存の仕組みに従う」は成り立たない。既存の仕組みのままでは、矢じりが出ない。D4 と「ラチェット」の段落は「新しい primitive も分岐も要らない」と言うが、帯の定義に hook を 1 つ足すことが要る。spotlight で暗くなるときの `dsl-arrow-dim` も同じで、`needsDimArrow` は `d.arrow && laidOut[i].dim` を見る（`lib/emit-svg-core.ts:39`）。
- 直し方:
  - D4 か D6 に、次を決定として書く。「`lib/bands/chevron.ts` の定義に `svgDefs: laid => ({arrow: laid.primitives.some(p => p.k === 'path' && !!p.arrow)})` を足す（concentric と同じ形）」。
    - 1 段のときは `arrow: false` を返すので、D8 は保たれる。試しで確かめた。
    - `lib/bands/` の中なので、ラチェットにも触れない。
  - U1 のテストに 2 つ足す。
    - つなぎ線の無い図で `<marker id="dsl-arrow"` が出ること。
    - 別の帯に spotlight を当てたとき `dsl-arrow-dim` が出ること。
  - 足したあとの `check --strict` は試しで通った。

## Major

### M1. 木の `from` を最後の段に限る理由が、コードと合わない。上向きの木では逆になり、決めた場所では検査できない

- 節: D5 の表の「木の帯ノードの `from`」、U1 のテスト
- 根拠:
  - funnel の線は、指した step の高さからではなく、**親の帯の端** `y0 = pr.y + pr.h`（上向きなら `pr.y`）から引く（`lib/layout-tree.ts:105`、`:108`）。コメントにも「a part inside it (a swimlane's step) does not draw a line across the parts below it」とある。
  - ADR の引く `lib/layout-tree.ts:111` は関数の閉じ括弧で、線の位置の行ではない。
  - 子が親の上にある木（`layout: 'up'`。`below`/`above` は 93 行で判定）では、線は帯の**上**の端から出る。
  - 段の情報は `LaidOutFlowShape` に無い（`lib/flow-types.ts:67`）。`funnelEdges` は `lib/bands/` の外にあり、ラチェットの許可リストにも無い（`test/band-type-literals.test.ts:20-`）。`.type === 'chevron'` の分岐を足せない。
- 問題:
  1. 「上の段の step から引くと、下の段を横切る」は誤り。線は帯の外から始まるので、何も横切らない。見た目の問題は、線が下の段の step の下から出て、どの step から出ているかが紛れることだけ。
  2. 上向きの木で「最後の段だけ」を強いると、紛れる方の段を許し、正しい方の段（1 段目）を断ってしまう。
  3. `rows: 'auto'` では、段数が配置のときまで決まらない。
  4. どこで throw するかが書かれておらず、上の理由で今のままでは書けない。
- 直し方: 次のどちらかを選び、ADR に書く。
  - (a) **制限をやめる**（推奨）。swimlane と同じく「帯の端から出る」を正とする。D5 の行を「変えない。線は帯の端から、指した step の x の幅で出る（`lib/layout-tree.ts:105`）」に直す。U1 のテストから「木の `from` の制限」を外す。
  - (b) **形で検査する。** `funnelEdges` の中で、型を見ずに判定する。指した部分（`part`）と `y0` の間に、同じ帯の別の多角形が x で重なって入っていれば throw する（既存の `polygonsIn` が使える。`lib/layout-tree.ts:78-79`）。
    - これで向き（下・上）と `'auto'` の両方に効き、ラチェットにも触れない。
    - swimlane など今の木の例がこれで落ちないことを、実装の前に試しで確かめる。
    - エラー文の直し方は、向きで変える（下向きなら「最後の段」、上向きなら「1 段目」）。

### M2. `loopBack` を `rows: 'auto'` と一緒に使ったとき、いつ throw するかが決まっていない

- 節: D5 の表の `loopBack`、D3
- 根拠:
  - `loopBack` のつなぎ線は、配置より前の `expandLoopBacks` で作られる（`lib/core.ts:159-169`、`lib/loop-back-connectors.ts:17`）。
  - 今の `loopBack` の検査は DSL の `chevronBand` の中にある（`lib/flow-chevron.ts:17-18`）。
  - `'auto'` の段数は、配置の中（`layoutChevron`）でしか決まらない（D3「計算は同じ `layoutChevron` の中で閉じる」）。
- 問題: 「段が 2 以上なら throw」は、数の `rows` と `perRow` なら DSL で判定できる。`'auto'` では判定できない。
  - 配置で 2 段に決まると、loop-under の線が下の段を横切った図がそのまま出る。
  - 配置の中で throw すると、幅（スライドかどうか、`fit-width`、木のノードの幅）しだいで同じ図が通ったり落ちたりする。
- 直し方: D1 の throw の一覧に「`loopBack` と `rows: 'auto'` を一緒に指定した」を足す。数の `rows` と `perRow` は `chevronBand` で `ceil(n/perRow) > 1` を見て throw する、と書く。
  - エラー文の例: 「`chevron(): loopBack は 1 段の chevron だけに引ける。rows / perRow を外すか、loopBack を外す`」。
  - D7（spec）は `loopBack` を出していないので、変えなくてよい。

### M3. `'auto'` の基準（ラベルだけ）では、背景に書いた困りごとが解けない

- 節: D3、背景
- 根拠（試し、幅 940、note 14px、7 つ、1 段）:
  - `textW` はおよそ 78px。
  - 5 字のラベル「要件の確認」は 1 行に収まる。6 字の「設計の見直し」は 2 行に折れる。
  - 7 字の sub「説明の文が入る」は、どの step でも 2 行に折れる。
- 問題: ラベルが 5 字以下なら `'auto'` は 1 段を選ぶ。sub が 2〜3 行に折れて「低く横長」のままになる。
  - 背景には、困りごとが「sub（8 字ほど）が 2〜3 行に折れる」「上下が空く」と書いてある。D3 の「`sub` の行数は見ない」は、これに答えていない。
  - スライドの幅では `textW` がもっと広く、さらに 1 段に決まりやすい。
- 直し方: 基準を、次のどれかにして D3 に書く。
  - 「ラベルが 1 行、かつ sub が 2 行以下」
  - 「全ての step の文字ブロックの行数の最大が、ある数以下」
  - 縦横の比で決める
  - あわせて、背景の例（5〜6 字のラベルと 8 字ほどの sub、幅 940 と 16:9 のスライド幅）で何段になるかの表を、試しで作って ADR に載せる。
  - ラベルだけで決める案を残すなら、背景の困りごとのうち `'auto'` が解かないものを、範囲外に書く。
  - 明示の `\n` を含むラベルは、何段にしても 1 行にならない（`lib/wrap.ts:80`）。この扱いも書く。たとえば「`\n` で区切った各行が折れないこと」を基準にする。

## Minor

### m1. 矢じりの長さの見積もりが合わない（「8px 以上」にならない）

- 節: D4「段の間 `rowGap` と線」
- 根拠: `dsl-arrow` は `markerWidth="7"`、`refX="9"`、`viewBox 0 0 10 10` で、`markerUnits` は既定の `strokeWidth`（`lib/emit-svg-core.ts:49`）。線幅 1.5 では、矢じりの長さは 7×1.5 = 10.5px で、終点から約 9.5px 手前まで伸びる。
- 問題: `rowGap = 32` の最後の縦の線は 16px しかない。矢じりの後ろに見える線は約 6.5px になる。試しの PNG でも、縦の線はほとんど矢じりだけに見えた。
- 直し方:
  - 数字を試しの値に直す。
  - 短すぎると判断するなら、次のどれかにする。
    - `rowGap = 40`
    - 横線を段の間の真ん中ではなく上寄せにする（例: 下りる線 12px、最後の縦の線 28px）
    - 終点を矢羽根の上辺から 2px 離す（太い枠 3.5 の `current` に矢じりの先が埋まるのも避けられる）

### m2. 線は灰色、矢じりは濃い色になる

- 節: D4「線の描き方」
- 根拠:
  - 線は `tone: 'muted'`（`#6f6659`）で描かれる（`lib/emit-flow-shape.ts:34`）。
  - `dsl-arrow` の塗りは `PALETTE.text`（`lib/emit-svg-core.ts:50`）。
  - 試しの絵でも、灰色の線の先に黒い矢じりが付いた。concentric にも同じ組み合わせがある（`lib/flow-concentric.ts:445`）。
- 直し方: 次のどちらかを決めて書く。
  - 「`tone: 'text'` にして線と矢じりを揃える」
  - 「`muted` のまま、色の違いを受け入れる（concentric と同じ）」
  - `arrow: true` と `thin: true` の組み合わせは今どこにも無い。D6 の「どれも今の帯が既に出しているもの」は、属性ごとには正しいが、この組み合わせは新しい。そう書き直す。

### m3. 続きの線の座標の丸めと、描く順が決まっていない

- 節: D2、D4
- 根拠:
  - `cellH` は文字の高さで決まり、4px の格子に乗らない（試しでは 76.7）。
  - path の `d` は丸めずにそのまま出る（`lib/emit-flow-shape.ts:34`）。ほかの帯は `f1` や `r1` で丸めてから `d` を作る（`lib/flow-cycle.ts:75`、`lib/flow-concentric.ts:185`）。
  - 試しのように行の途中で path を足すと、次の段の矢羽根の後に描かれず、前に描かれる。矢じりの先が、次の段の枠（`current` なら 3.5px）の下に入る。
- 直し方:
  - D4 に「座標は `f1` で丸める」と書く。
  - 「続きの線は、全ての矢羽根と文字の後に足す」と書く（2 段以上のときだけの順なので、D8 には触れない）。

### m4. `fit-width` は続きの線を測らない

- 節: D5 の `fit-width` の行
- 根拠: `drawnExtent` は、`box` の無い path を数えない（`lib/layout-fit-width.ts:39`、コメント「a line has no extent of its own」）。
- 問題: 「続きの線も含めて測る」は誤り。ただし、線は矢羽根の x の範囲の中にあるので、結果は変わらない。
- 直し方: 「線は測らない。線は矢羽根の x の範囲の中にあるので、幅は変わらない」に直す。

### m5. 続きの線は重なりの検査に入らない

- 節: D4「なぜこの形か」、D5 の `connect()` の行
- 根拠:
  - chevron の検査の矩形は `figureRects` = アンカーだけ（`lib/bands/chevron.ts:25`、`lib/verify-rects.ts:16`）。
  - `flowProblems` は文字の箱しか見ない（`lib/verify-flow.ts:4-8`）。
- 問題: 上の段の step から下へ引いた `connect()` は、段の間を通る。続きの横線と交わっても、何も知らせない。
- 直し方: 次のどちらかを ADR に書く。
  - 「既知の限界として受け入れる」
  - 「続きの線の分節（`pathSegments` と同じ形）を、つなぎ線の交差の検査に渡す」
  - D5 の「重なりは既存の検査が見る」は、この線には当たらないことも明記する。

### m6. D1 の「1 段になる指定」の文が読めない

- 節: D1
- 問題: 「`rows: 1`、`perRow >= n`、`rows >= n` で `perRow` が 1 になる場合は除く」は意味が通らない。`rows >= n` は `perRow = 1` で n 段になり、1 段にはならない。
- 直し方: 「1 段になる指定（`rows: 1`、`perRow >= n`、1 段に決まった `'auto'`）は、指定しないときと同じ出力になる」と書く。`rows >= n` は「`perRow` が 1 になり、n 段になる」と別に書く。
  - 「`rows` が 1 未満の整数」は「`rows` が 1 以上の整数でも `'auto'` でもない」に直す（1.5 も断ることがわかるように）。

### m7. spec の `check`「9 つ以上を 1 段」は、`'auto'` と `perRow` での扱いが決まっていない

- 節: D7
- 問題: `rows: 'auto'` は配置しないと段数が決まらない。`check`（spec の段階）では、1 段になるかどうかがわからない。`perRow: 10` で 10 個のときも 1 段になる。
- 直し方: issue にする条件を書く。たとえば「steps が 9 以上で、`rows` も `perRow` も無いか、`rows: 1` か、`perRow >= 9`」。`'auto'` は通す。
  - `rows` の schema は `spec-kit` の `oneOf()`（文字列の enum だけ。`lib/spec-kit.ts:79`）ではなく、`{oneOf: [{type: 'integer', …}, {type: 'string', enum: ['auto']}]}` で書く（`lib/spec-parts/pareto.ts:16` と同じ形）。そう明記する。

## nit

- n1. D9 の PPTX の線の名前は `nameOf('line', …)` ではなく、文字列 `'line'` そのもの（`lib/pptx/flow.ts:47`）。
- n2. D9「`pptx-golden.yml` で新しい例のエントリを足す」: workflow は `examples/*.ts` を全部回す（`.github/workflows/pptx-golden.yml:39`）。「workflow を回して `pptx-golden.json` を作り直す」と書けば足りる。
- n3. D5 の `mid-word` の新しい文は、既に `rows: 2` のときにも「`rows: 2` で折り返す」と言う。「段を増やす（`rows`）」の言い方にする。

## 結論

- **Blocker 1 つ（B1）、Major 3 つ（M1〜M3）が残る。** 状態を「提案」のまま直し、第 2 回のレビューに回す。
- B1 は、定義に `svgDefs` を足すことを決定に書けば閉じる。試しでは、足したあと `check --strict` が通り、1 段のときはバイト同一のままだった。
- M1 は (a) 制限をやめるか、(b) 型を見ない形の検査かを決める。
- M2 は `loopBack` と `'auto'` を一緒に使うことを禁じる。
- M3 は `'auto'` の基準を、試しの表と一緒に決め直す。
