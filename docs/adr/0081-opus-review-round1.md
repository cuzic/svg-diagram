# ADR 0081 Opus レビュー round 1

- 対象: `docs/adr/0081-tree-branch-style-and-tags.md`（ブランチ `docs/adr-mindmap-branch-style`、PR #463、b38dd626）
- 見方: ADR の主張をこのワークツリーのコードと突き合わせ、Blocker / Major を探す。根拠はすべて `ファイル:行`。
- 結果: **Blocker 1 / Major 8 / Minor 9**

## 先に結論

- D2 の「兄弟は親側の区間を共有し、最後の 1 区間は私有」は、7 つの配置すべてで**構造としては正しい**（下の表）。ただし、分割を `LaidOutTree.edges` で行う（U1 の書き方）と、帯ノードの吸着と PPTX の糊付けが壊れる（M1）。`list` では私有区間が 14px しかない（M2）。
- D5 の「`diagramDesc` に札の文字を含める」は、前提が誤り。木はいま説明文に何も出していない（B1）。
- 札を箱の中に置く D4 は、`focus` の `solid` の箱では札が見えなくなる（M4）。さらに、札の文字を `TreeNodeText` に入れると SVG と PPTX の両方で位置から色と段落を決める処理に巻き込まれる（M5）。

### D2 の検証: 配置ごとの点列と私有区間

| 配置 | 点列を作る場所 | 点列 | 兄弟で重なる区間 | 私有区間（最後の 1 区間）の長さ |
|---|---|---|---|---|
| right | `lib/graph-layout.ts:78-80` | `[a, (mid,a.y), (mid,b.y), b]` | 1 区間目は同一。2 区間目（x=mid の縦）は親に近い側が重なる | `(b.x-a.x)/2` ≥ `levelGap/2` = 22px（compact では 16.5px。`lib/tree.ts:124`） |
| left | 上を `mirror(…,'x')`（`lib/map-layouts.ts:15-19`）。点の順は保たれる | 同上 | 同上 | 同上 |
| down | `lib/graph-layout.ts:78-80` | `[a, (a.x,mid), (b.x,mid), b]` | 1 区間目は同一。2 区間目（y=mid の横）は同じ側どうしで重なる | `(b.y-a.y)/2` ≥ 22px |
| up | `mirror(…,'y')` | 同上 | 同上 | 同上 |
| radial | 根の子: `rootEdge`（`lib/graph-layout.ts:131-136`）。それより下: `layoutTree` の右向きを左右に写す（`:138-141`） | `[a, (m,a.y), (m,b.y), b]` | **左右それぞれ**の兄弟だけが重なる（根の左右で幹が別） | ≥ 22px |
| org | 根 → 子: `lib/map-layouts.ts:62-68`。それより下は `list` と同じ（`:39`） | 4 点（バス）、または**2 点**（根の中心から 4px 以内の子: `:67`） | 根から下りる縦は同一。バス（y=bus の横）は rcx の左右それぞれで重なる。2 点の線は何も共有しない | 根の子: `rowTop-bus` = 22px（`:47`, `:62`）。下の段: 14px |
| list | `lib/map-layouts.ts:39` | **3 点** `[(x+14,y+h), (x+14,cy), (cx,cy)]` | 1 区間目（縦の柱）が、前から順に長くなりながら重なる | `cx-(x+14)` = `indent-14` = **14px**（`indent` 28: `:28`） |

`straight` / `curve` は `lib/tree.ts:132` で `[始点, 終点]` の 2 点に縮められるので、共有区間はない（ADR の主張どおり）。

---

## Blocker

### B1: D5「`diagramDesc` に札の文字を項目の前に含める」— 木はいま説明文を出していない。実装すると全ての木の `<desc>` が変わり、D8 と矛盾する

- **指摘**: D5（ADR:87）は、木の説明文に項目の文字が既に出ていて、その前に札を足せばよいという前提で書かれている。実際は、木の帯は `describe` を持たない。そのため木の項目の文字は `<desc>` に出ていない。「[決定] 導入する」を出すには木の説明文を新しく作るしかない。そうすると `edge` / `tags` を書いていない木の `<desc>` も変わり（`joinBandDescriptions` は structure があると box の代わりの説明を出さない）、D8「今とバイト単位で同じ」と矛盾する。札を書いた木だけに説明文を出すと、札の有無で説明文の有無が変わり、それも筋が通らない。
- **根拠**:
  - `lib/bands/tree.ts:13-29`: 木の帯の定義に `describe` がない
  - `lib/core.ts:403-407`: `<desc>` は帯の定義の `describe?.()` だけから作られる
  - `lib/diagram-description.ts:39-52`（旧経路の `describeBands`）: swimlane / sequence / table / box / bars / chart / image / math だけで、tree は扱っていない
  - `lib/diagram-description.ts:30-37`: structure があると box の代わりの説明を出さない
- **提案**: D5 から説明文の文を消し、「v1 では木の説明文を変えない（木は今も項目を説明文に出していない）」と書く。木の説明文は別の ADR で、全ての木に対して決める。どうしても札を読ませたいなら、SVG の札の `<rect>`/`<text>` に何を付けるか（`aria-hidden` にするか、など）を D6 に入れて決める。

## Major

### M1: 共有区間の分割を `LaidOutTree.edges` で行うと（U1）、帯ノードの吸着と PPTX の糊付け・折れ線の当てはめが壊れる。分割は描く段階で行うと決めるべき

- **指摘**: U1（ADR:116）は「`layoutTreeBand` が … `LaidOutTree.edges` に写す（…共有区間の分割）」としている。1 本の枝を 2 つの `edges` 要素に分けると、次の 3 か所が壊れる。
  1. `snapBandNodes` は、ノードの上にある端点だけを動かす。`right` / `radial` の木に帯ノードがあると、私有区間 `[(mid,b.y), b]` は動くが、共有区間の終点 `(mid,b.y)` はノードの上にないので動かない。線が途切れる。
  2. PPTX は線の両端を `nodeAt` でノードに糊付けする（ノードを動かすと線が付いてくる）。分けた線は、片方の端が分岐の列にあってノードの上にないので、片側しか糊付けされない。
  3. PPTX は点列を `fitConnector` で bentConnector に当てはめる。2 点・3 点の断片はこれを通らず、freeform になったり当てはめ方が変わったりする。
- **根拠**:
  - `lib/layout-tree.ts:22-49`（`snapBandNodes`）、特に `:31-38`（ノードの上の点 `on(p)` と、その隣の点だけを動かす）
  - `lib/pptx/tree.ts:23-27`（`nodeAt`）、`:73-75`（両端の糊）、`:77-84`（`fitConnector` と freeform）
  - `lib/layout-tree.ts:101`（`from` の子は `e.child` で線を消して、`:108` で漏斗の 2 本に置き換える。ここも分割後の数に依存する）
- **提案**: `LaidOutTree.edges` の要素は 1 本の枝につき 1 つのままにする。要素には `edge?: {tone, line}` と `shared?: {tone, line} | 'default'`（共有区間の見た目）を持たせる。分割は `renderTree` の中で、点列の `[0..n-2]` と `[n-2..n-1]` に分けて行う。PPTX は D2 の分割をしない。1 本のコネクタで両端を糊付けし、線全体を項目の `edge` で描く（PPTX では兄弟の幹が重なる見え方を受け入れる）か、別の決め方をする。どちらにするかを ADR で決める。

### M2: `list`（と `org` の 2 段目より下）では、私有区間が 14px しかなく、線種も色もほとんど読めない

- **指摘**: D2 では、兄弟の `edge` が 1 人でも違うと、共有区間は muted の実線になり、項目の見た目が出るのは最後の 1 区間だけになる。`list` ではその区間が `indent-14` = 14px で、`dashed`（6,4）は破線 1 つ半、`dotted`（2,5）は点 2 つにしかならない。賛否を線で見分けるという依頼（背景 1）が、D3 が使えるとした `list` / `org` では満たせない。`right` / `down` でも、私有区間は compact のとき 16.5px まで短くなる。
- **根拠**: `lib/map-layouts.ts:28`（`indent` 28）、`:39`（柱は `x+14`、子は `cx=x+28`）、`:47` / `:62`（org のバスは根の下 22px、子の上端は 44px）、`lib/tree.ts:124`（`levelGap = round(44*space)`）
- **提案**: 次のどれかを ADR で決める。(a) 兄弟の `edge` が違うときは、私有区間を最低 N px（例: 24px）確保するよう、`edge` がある木だけ `indent` / `levelGap` を広げる（`edge` がなければ配置は変わらないので D8 は保てる）。(b) `list` / `org` は v1 で `edge` を色だけにする。(c) `list` / `org` は D3 から外す。いずれも配置ごとの私有区間の長さを ADR に書き、テストで最小の長さを確かめる。

### M3: `focus` と `edge` の組み合わせが決まっていない（光らない枝の色、光る枝の共有区間、`danger` が accent に負けること）

- **指摘**:
  1. `focus` の木では、光らない項目は全部 `muted` になる。光らない枝に `edge.tone: 'danger'` があるとき、赤のままか muted か、ADR に書いていない。赤のままだと、`focus` の「ここを見る」が赤い枝に負ける。
  2. 光る枝（`lit`）の共有区間をどう描くか。今は、光る線を全体で最後に描いて、根までの道を accent でつないでいる。D2 のとおり兄弟が違うときに共有区間を muted で描くと、根までの道が途中で muted に戻る。ADR はこれを決めていない。
  3. D2 では、光る枝の線種は `edge.line` を保つ。破線の光る線を、兄弟が描いた実線の muted の幹の上に重ねると、幹が「muted の実線に accent の破線を重ねた」見た目になる。
  4. `danger` の枝を光らせると accent になり、賛否の意味が消える。それでよいのかを書いていない。
  5. D4 の「`focus` で `dim` になった項目」は、コードにない概念。`focus` は項目の tone を `muted` にするだけで、`dim` は `diagram({spotlight})` が帯全体に付けるもの。
- **根拠**: `lib/dsl/tree.ts:19-33`（`focusTree` は tone と `focusLit` を書くだけ）、`lib/tree.ts:164`（`lit` は子の `focusLit` から）、`lib/emit-tree.ts:13-18`（光る線を最後に描く理由のコメントと、`e.lit && !b.dim`）、`lib/emit-box.ts:30-33`（`box` の札が muted になるのは `band.dim` のときだけ）
- **提案**: 表で決める。たとえば「`focused` の木: 光る枝は分割せず、線全体を accent で描く。線種は光る枝では実線にする（または `edge.line` を保つ）。光らない枝は `edge.tone` を無視して muted にし、線種だけ保つ。札は項目が `muted`（focus の OTHER）なら muted で塗る」。`dim`（spotlight）と `focus` の `muted` を分けて書く。

### M4: 札を箱の中に置くと、`solid` / `solid-danger` の箱（`focus` の中心の項目）では同じ色の札が見えなくなる

- **指摘**: `solid` の塗りは accent、`solid-danger` の塗りは danger。D4 の札は `toneStyle(tone).ink` で塗るので、accent の札を `solid` の箱に、danger の札を `solid-danger` の箱に置くと、塗りが同じ色になって札が見えない。`focus` の中心の項目は必ず `solid` になり、札の既定は accent なので、よく起きる。`box` の札は角に重ねて箱の外の背景に出るうえ、`solid` の箱では白い縁（`ringed`）を付けている。D4 はこの縁に触れていない。muted の箱（塗りは `code`）に muted の札を置いた場合の見え方も書いていない。
- **根拠**: `lib/tokens.ts:121-122`（`solid` は `fill: 'accent'`、`solid-danger` は `fill: 'danger'`）、`lib/emit-box.ts:30-33`（札の塗りと、`ringed` のときの `stroke: PALETTE.bg`）、`lib/box-step-geometry.ts:11`（`ringed`）、`lib/dsl/tree.ts:28`（focus の中心は `solid`）
- **提案**: 塗りのある箱の中の札をどうするかを決める。案: 塗りのある箱の札は白地にその色の文字（白黒反転）にする、または白い縁（`stroke="#ffffff" stroke-width="2"`）を必ず付ける。決めた結果を D6 にも載せる（M7）。

### M5: 札の文字を `TreeNodeText` に入れると、SVG の `ink()` と PPTX の `nodeRunsOf` が、位置を見て箱の文字として扱ってしまう

- **指摘**: U2（ADR:117）は「`nodeRuns` の札」としている。札の文字を、今と同じ形の `TreeNodeText` として `texts` に入れると、次の 2 か所が困る。
  1. SVG の `ink()` は、文字の位置を含む箱を探して、その箱の tone で色を決める（`dim` なら muted、`solid` なら白、それ以外は tone の文字色）。そのため白い札の文字が、accent・muted・本文の色に塗り替わる。
  2. PPTX の `nodeRunsOf` も、箱の中にある文字を全部その箱の段落に入れる。そのため札の文字が箱の本文の 1 行目になり、`lineYs` の基準（`NODE_TEXT_PAD_Y`）もずれる。

  さらに `nodeRuns` / `measureNode` は、`states`・`bpmn`・`fta`・`toc`・`cloud`・`bowtie`・`flow-nodes` も使っている。引数の形を変えると、これら全部に影響する。
- **根拠**: `lib/emit-tree.ts:26-34`（`ink()`）、`lib/pptx/node-runs.ts:13-29`、`lib/pptx/tree.ts:63`、`lib/pptx/tree.ts:96-98`。`nodeRuns` / `measureNode` を使う所: `lib/states.ts:81,134`、`lib/bpmn.ts:66,178`、`lib/bpmn-vertical.ts:131`、`lib/fta.ts:125,130,178`、`lib/toc.ts:402,491`、`lib/cloud.ts:51,66`、`lib/bowtie.ts:77,85`、`lib/flow-nodes.ts:22`
- **提案**: 札は `texts` に入れず、`LaidOutTree.nodes[i].tags?: {text, tone, x, y, w}[]` のような別の場所に置く。`measureNode` は省略できる引数 `opts.tags` を足すだけにし、他の部品の呼び方は変えないと ADR に書く。PPTX は `box-band.ts` の `boxBadge` と同じ図形を、項目の枝のグループに入れる。

### M6: 「札の行が `maxNodeW` より広ければエラー」を、幅合わせの試行ごとに確かめると、正しい図が落ちる

- **指摘**: `maxNodeW` を書かない木や mindmap は、ノードの幅を 200 → 160 → 130 → 110 と狭めて試す。`dir: 'auto'` の `tree()` は、全部の試行を走らせてから一番よいものを選ぶ（`best`）。D4 の判定を「その試行の `maxW`」に対して行うと、200 で収まる図でも、110 の試行で札の行（たとえば 120px）がエラーを投げて図全体が失敗する。`first` のときも、収まらない図で本来出る「何を試したか」のエラーが、札のエラーに置き換わる。`keepWords` の 2 段目、`bunsetsu-soft` の作り直しも同じ。
- **根拠**: `lib/fit-width.ts:105-106`（`NARROWING`）、`:184`（`maxNodeW` を書かないときに狭める）、`lib/fit-width.ts:50-65`（`fitWidth`。`best` は全部の試行を走らせる）、`lib/tree.ts:141`（`best: band.dir === 'auto' && !band.balanced`）、`lib/tree.ts:109`（試行ごとの `measureNode`）
- **提案**: エラーにする判定は DSL（`tree()` / `mindmap()`）で、**書かれた** `maxNodeW`（なければ 200。`bunsetsu` なら 1.5 倍）に対して 1 回だけ行うと書く。試行の中では、箱を札の行の幅まで広げるだけにして、投げない。

### M7: D6（許可リスト）が足りない、または誤っている

- **指摘**:
  1. 塗りのある箱の札に白い縁（`stroke` / `stroke-width` の付いた `rect`）を付けるなら（M4。`box` の札は付けている）、表に載っていない。
  2. 札の `font-size` は `roles.tag ?? 14` で、キャンバスでは大きさが変わる（`tokens.ts:296`）。表の「`font-size`」には値の幅を書くべき。札の高さは `TAG_H`（24）で変わらないので、`rx="12"` は正しい。ただし、大きくなった文字が札からはみ出しうる。
  3. `edge.tone: 'muted'` を書いたときの色は、ADR の式（`colorOf(toneStyle(tones,'muted').ink)`）だと `diagram({tones})` の上書きに従う。一方、今の既定の線は `PALETTE.muted` の固定値で、上書きに従わない。「`muted` を書いたものと書かないものが同じ色か」が決まっていない。
  4. 「新しく現れる」とした `text-anchor="middle"`・`font-weight="700"`・`rx` は、木の出力に既にある（`emit-tree.ts:34`、`emit-box-frame.ts:19` の `rx="8"`）。属性として本当に新しいのは `stroke-dasharray`・`stroke-linecap` と、新しい値だけ。許可リストを作る人が誤解しないよう分けて書く。
- **根拠**: `lib/emit-box.ts:33`、`lib/tokens.ts:224-227,296,313`、`lib/layout-util.ts:57`、`lib/emit-tree.ts:18`（既定の線は `PALETTE.muted`）
- **提案**: 表を「新しい属性」と「既にある属性の新しい値」に分ける。縁の有無と `font-size` の幅を加える。`edge.tone` が既定と同じ値を書いたときの扱い（M8）と合わせて、`muted` の色の出どころを決める。

### M8: 使える場所と使えない場所の検査が決まっていない（`tree()`、帯ノード、`from`、比べ方）

- **指摘**: ADR は `mindmap` の配置だけを書いている。しかし `TreeItem` は `tree()` と共通なので、次のことが決まっていない。
  1. `tree()`（`dir: 'down'|'right'|'auto'`）で `edge` / `tags` を使えるか。D7 では spec の `tree` 部品に出さないとしているが、DSL の `tree()` はそのままだと型の上で受け付ける。
  2. 帯ノード（`band`）に `tags` を書いた場合。帯ノードは `sub` / `tone` を受け付けない（エラーになる）。
  3. `from`（漏斗）の子に `edge` を書いた場合。漏斗の 2 本の線は、元の線を消して作り直される。
  4. D2 の「兄弟全員の `edge` が同じ」をどう比べるか。`undefined`、`{}`、`{tone:'muted', line:'solid'}` を同じとみなすか（既定値を入れてから比べるか）。これで分割するかどうか、つまり出力のバイト列が変わる。
  5. 比べる兄弟の範囲。radial は根の左右で幹が別なので、片側だけで比べてよい。org の根のバスは rcx の左右で分かれ、2 点の子は何も共有しない。
  6. `mindmap({edges: false})` は `tree()` の検査の後で `Object.assign` されるので、D1 の「`edges: false` で `edge` があればエラー」は `mindmap()` 側で確かめる必要がある。
- **根拠**: `lib/dsl/tree.ts:43-62`（`tree()` の検査。`band` に `sub` / `tone` があるとエラー: `:58`）、`lib/dsl/tree.ts:78-80`（mindmap の `edges` は後から付く）、`lib/layout-tree.ts:81-109`（漏斗）、`lib/graph-layout.ts:131-141`、`lib/map-layouts.ts:62-68`
- **提案**: D3 に表を足す（`tree()` の down / right / auto、mindmap の各配置、帯ノード、`from` の子、それぞれで使えるか、エラーか）。D2 に「既定値を入れてから比べる」「比べる範囲は同じ幹を持つ兄弟（radial は片側、org のバスは左右それぞれ）」と書く。

## Minor

### m1: D2 が引く点列は `down` の形だけ。配置ごとの点列を ADR に載せる

- **指摘**: `[a, (a.x, mid), (b.x, mid), b]` は `down` の形で、`right` / radial は `(mid, a.y)`、`list` は 3 点、`org` には 2 点の線がある。
- **根拠**: 上の表、`lib/map-layouts.ts:39,67`
- **提案**: 上の表を ADR に載せ、「私有区間 = 点列の最後の 1 区間（2 点の線では線全体）」と書く。

### m2: D3 の、`fishbone` / `timeline` / `brace` で使えない理由の一部が事実と違う。札を使えない理由も弱い

- **指摘**: `brace` の子への短い線、`fishbone` の原因への短い線、`timeline` の柱は、どれも 1 つの子だけの線で、その下の段は `layoutHanging`（`list` と同じ）。「骨・軸が線を兼ねる」はそれぞれの根の子にしか当てはまらない。また D4 自身が「箱の中なら配置の計算は箱が少し大きいだけ」と書いているので、札をこの 3 つの配置で禁じる理由とつじつまが合わない。
- **根拠**: `lib/map-layouts.ts:80-90,108,127-136,159-175`
- **提案**: 札は全部の配置で使えるようにする。`edge` は「v1 では入れない（需要がないため）」と理由を書き換える。

### m3: 札の文字の測り方を正確に書く

- **指摘**: `treeTexts` は `roles.body` / `roles.note` で測っている。札は `roles.tag ?? TAG_SIZE`（14）の太字なので、それで測るよう書くべき。札の行と箱の左右の余白（`PAD_X` 14）を含めるかも書いていない。
- **根拠**: `lib/tree.ts:25-32,55-70`、`lib/layout-box-like.ts:45`（`TAG_PAD_X` 8）
- **提案**: 「札 1 つの幅 = 文字の幅 + 2×8、札の間 6、札の行 + 2×14 ≤ 箱の幅」と書く。

### m4: spec の「札の文字は 12 文字まで」と、描く時のエラーが合わない

- **指摘**: 12 文字の札は約 184px になり、3 つ並べると spec の `maxNodeW` の上限 400 も超える。spec の検査は通るのに、描くと必ず失敗する入力ができる（MCP では LLM がそれを書く）。
- **根拠**: `lib/spec-kit.ts:86`（`MAX_NODE_WIDTH` 120〜400）、`lib/spec-parts/mindmap.ts:16-19`（`check` は数しか見ない）
- **提案**: 札は 6 文字程度、最大 3 つにする。または `check()` で札の行の文字数の合計を確かめ、spec の段階で分かる言葉のエラーにする。

### m5: spec の `treeItem` を深さごとに入れ子で作ると、スキーマが大きくなる

- **指摘**: `treeItem(levels)` は深さごとにスキーマを入れ子で作る（`MAX_TREE_DEPTH` 4 → 5 段）。`edge` と `tags`（`oneOf` を含む）が 5 回繰り返され、`partCatalog` と MCP のツールの説明が大きくなる。
- **根拠**: `lib/spec-kit.ts:20,154-159`
- **提案**: 大きさが増える量を U3 で測り、PR に書くと決める。

### m6: 線の意味が凡例の検査に引っかからない

- **指摘**: このライブラリは「使った線種・トーンに凡例がない」ことを `legend-missing` で警告する。木の線は `usedBandNotation` に数えられないので、破線や赤の枝を凡例なしで描いても警告が出ない。D5 は自動の凡例を作らないとしか書いていない。
- **根拠**: `lib/legend-notation.ts:61-75,181`、`lib/rules.ts:45`
- **提案**: v1 で警告しない（と理由）を D5 に書く。あるいは、`edge` を書いた木では `line:dashed` などを数える（`withCause` でないとき）。

### m7: 描く順の変更（既定 → `edge` → `lit`）は PPTX の並べ方にも要る

- **指摘**: PPTX も、`lit` だけで並べ替えている。
- **根拠**: `lib/pptx/tree.ts:68`、`lib/emit-tree.ts:14`
- **提案**: U1 に、SVG と PPTX で同じ比べ方の関数を使うと書く。

### m8: D8 のバイト不変の確認に PPTX の golden が入っていない

- **指摘**: `examples/out/` の golden は SVG だけ。PPTX の golden は手で起動するワークフローでしか比べない。
- **根拠**: AGENTS.md「完了の定義」（`pptx-golden.yml`）
- **提案**: D8 に「`pptx-golden.yml` を `update=false` で回し、差がないことを確かめる」と足す。

### m9: 帯の種類で分岐するコードを `lib/bands/` の外に増やさないこと（ADR 0080 D2b）を書く

- **指摘**: 凡例（m6）や説明文（B1）を木に足すとき、`legend-notation.ts` や `diagram-description.ts` に `b.type === 'tree'` を増やしやすい。上限はラチェットで見張られている。
- **根拠**: AGENTS.md「コードの約束」、`test/band-type-literals.test.ts`、`lib/band-def.ts:148`（`describe` のフック）
- **提案**: 木の帯に何かを足すときは `lib/bands/tree.ts` のフック（`describe` など）で行う、と U2 に書く。

## ブラウザの入口について（問題なし）

`pillSvg`（`lib/badge.ts`）は `tokens.ts` だけを import しており、`node:*` を使わない。`lineAttrs`（`lib/emit-common.ts:90-92`）も純粋な関数。`svg-diagram/browser` の条件は満たせる。
