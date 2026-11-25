# ADR 0081 Opus レビュー round 2

- 対象: `docs/adr/0081-tree-branch-style-and-tags.md`（ブランチ `docs/adr-mindmap-branch-style`、PR #463、9415737e）
- 見方: round 1 の B1・M1〜M8 が直ったかを確かめ、そのあと改訂で新しく入った Blocker / Major を探す。根拠はすべてこのワークツリーの `ファイル:行`。
- 結果: **Blocker 0 / Major 4 / Minor 10**

## round 1 の指摘が直ったか

| ID | 判定 | 理由 |
|---|---|---|
| B1 | 直った | D5 で「木の説明文は変えない」とした。木の帯に `describe` がなく（`lib/bands/tree.ts:13-29`）、`<desc>` は `describe` からしか作られない（`lib/core.ts:402-407`）ことと合う |
| M1 | 直った | `LaidOutTree.edges` は 1 本の枝につき 1 つのまま、分割は `renderTree` でする。`snapBandNodes`（`lib/layout-tree.ts:31-38`）は点を動かすだけなので、`[0..n-2]` / `[n-2..n-1]` に分けても線はつながる。漏斗の `e.child` での除去（`:101`）も変わらない。PPTX は分割しないと決めた |
| M2 | 直った（細部は m1） | `levelGap` を 48 以上にすれば、right / down / radial のその項目だけの区間は `levelGap/2` 以上（`lib/graph-layout.ts:55,79`、`:115-136`）。list は `indent - 14` = 24（`lib/map-layouts.ts:36-39`）。compact（`space` 0.75）でも `max(…, 48)` で 24 になる。`layoutHanging` は `space` を使わないので list / org は compact で変わらない |
| M3 | 直った（細部は m6） | 表で決まった。光る枝は最後に描く（`lib/emit-tree.ts:14`）ので、光る幹の accent が兄弟の幹の上に乗る |
| M4 | 一部 | SVG は白黒反転で決まった。PPTX の札の色が決まっていない（下の M3） |
| M5 | 直った | 札を `texts` に入れず `nodes[i].tags` に置く。PPTX の `nodeRunsOf` の `lineYs` は札の分だけ下がるが、`lib/pptx/shapes.ts:29-32` が最初の行の位置から上の余白を作るので、本文は札の下に来る |
| M6 | 直った | 検査は DSL で 1 回、試行の中では広げるだけ |
| M7 | ほぼ直った（m3） | 表が「新しい属性」と「新しい値」に分かれた。`muted` は `PALETTE.muted` 固定と決まった。ただし「新しい属性」の一部は、木の出力に既にある |
| M8 | 直った（細部は m4・m5） | D3 の表と「正規化してから比べる」「比べる範囲」が入った |

---

## Major

### M1: org の根では、縦の下り口を左右の兄弟がみな共有する。D2 の「rcx の同じ側どうしで比べる」だと、下り口が 2 つの見た目で重ねて描かれる

- **指摘**: org の根から子への 4 点の線は、どれも `(rcx, root.h) → (rcx, bus)` の縦の下り口から始まる。左右の子は**同じ下り口**を通り、バスの横の部分だけが rcx の左右で分かれる。D2 の規則は「org の根のバスは rcx の同じ側」の兄弟だけで比べる。そのため、左側の子がみな `danger`、右側の子がみな `accent` だと、左の組の幹は赤、右の組の幹は青になる。どちらの幹にも共有の下り口が入っているので、同じ線分を赤と青で重ねて描くことになり、後から描いた方が見える（描く順は D2 の比べ方の関数による）。D2 の表（「縦の下り口と、バスの rcx の左右それぞれ」）と規則が合っていない。
- **根拠**: `lib/map-layouts.ts:62`（`bus`、`rcx`）、`:68`（4 点 `[(rcx, root.h), (rcx, bus), (ccx, bus), (ccx, rowTop)]`。始めの 2 点は子によらない）、`:67`（2 点の子は rcx を通らない）
- **提案**: 「同じ幹を持つ兄弟」を、配置の名前ではなく形で決める。たとえば「同じ親を持ち、`points[0]` が同じ枝（2 点の枝は除く）」。そうすると radial（左右で `points[0]` が違う。`lib/graph-layout.ts:134`）、org（下り口を通る枝はみな同じ組）、list・right・down（親ごとに 1 組）がすべて同じ規則で決まる。実装の人が配置ごとに場合分けしなくてよくなり、`layoutBalanced` の左右の情報（`TreeLayout` に出ていない。`lib/graph-layout.ts:17-24`）も要らない。org でバスの左右の見た目を分けたいなら、幹を「下り口」と「バス」の 2 段に分ける必要があり、v1 では入れないと書く。

### M2: 「分割するかどうか」の条件が D2 と D6 で食い違っている。出力のバイト列と破線の見え方が実装しだいになる

- **指摘**: D2 は「`style` も `trunk` もない枝は今と同じ 1 本の `path`」としているので、`style` か `trunk` のどちらかがあれば 2 本に分けることになる。一方 D6 は「兄弟で `edge` が違うとき」に 2 本になると書いている。次の場合が決まっていない。
  1. 兄弟がみな同じ `{danger, dashed}`（`trunk` = `style`）。D2 に従うと 2 本、D6 に従うと 1 本。2 本に分けると、つなぎ目で破線の周期がやり直しになり、`dashed`（6,4）の線に短い切れ目や長い線分が出る。1 本なら今の `lineAttrs` と同じ見た目になる。
  2. 子が 1 つだけの親（兄弟の組が 1 つ）。上と同じ。
  3. `focus` で光る枝で、`edge.line` が `dashed`（幹は accent の実線、その項目だけの区間は accent の破線。表のとおり）。兄弟が違わなくても分ける必要がある。
  4. 幹は既定と同じなので `trunk` を持たず、`style` だけがある場合。D2 の「既定と同じなら持たせない」だと、`trunk` がないことが「幹も `style` で描く」と「幹は既定で描く」のどちらの意味かが分からない。
- **根拠**: ADR D2 の最後から 3 つ目の項目と D6 の 2 つ目の表の 2 行目。`lib/emit-tree.ts:17-18`（今は 1 本の `path`）、`lib/emit-common.ts:90-92`
- **提案**: 描く段階の規則を 1 つにして D2 に書く。例:「その項目だけの区間の見た目 S と、幹の見た目 T を決める（`focus` と `dim` は表のとおり）。S = T なら今と同じ 1 本の `path` を S で描く。S ≠ T なら 2 本に分ける」。`LaidOutTree.edges` の要素には、既定と違うときだけ `style` を、`style` と違うときだけ `trunk` を持たせる（`trunk` がない = 幹も `style`。どちらもない = 今のまま）。D6 の行もこれに合わせる。テストに「兄弟がみな同じ破線のとき 1 本」を入れる。

### M3: PPTX の札の色が決まっていない。D4 の言う「`box` の札と同じ図形」は、札の色ではなく箱の色で塗る

- **指摘**: D4 の PPTX の項目は「`box` の札と同じ角丸の図形（`lib/pptx/box-band.ts` の札）」としている。ところがその `boxBadge` は、**札をのせる箱の tone**（`b.tone`）で `boxXml` を作る。札の tone（`tagTone`）も、SVG の「塗り = `toneStyle(tone).ink`、文字 = 白」も使っていない。そのまま使うと、次のようになる。
  - ふつうの箱の札は白地に黒の文字になり、`accent` / `danger` / `muted` の区別が PPTX から消える。
  - `solid` の箱の札は accent の塗りに白の文字になり、箱の塗りと同じ色になる。札の形が見えない。round 1 の M4 が PPTX で残る。
  - 「muted の塗りに白の文字」に当たる `ToneName` はない（`muted` の tone は塗りが `code`、文字が muted）。`plainBox` の `tone` に渡すだけでは、SVG と同じ色にできない。
- **根拠**: `lib/pptx/box-band.ts:21`（`boxBadge(ctx, b.tone, …)`）、`lib/pptx/box-decoration.ts:13-17`（`plainBox(rect, text, {…, tone, frame: true})`）、`lib/tokens.ts:114-122`（`muted`・`solid`・`solid-danger` の塗りと文字）、`lib/emit-box.ts:30-33`（SVG の札は `tagTone` の ink で塗る）
- **提案**: PPTX の札の色を D4 に表で書く（ふつうの箱 / 塗りのある箱 / `focus` で muted の項目、それぞれの塗りと文字の色）。作り方は、`boxBadge` に色を直接渡せる引数を足すか、木だけの関数を作るかを決める（`boxBadge` を変えるなら、`box` の PPTX の golden が変わらないことを D8 に書く）。札の文字の大きさも決める（`boxBadge` は `badgeSize` で 8〜12。`lib/pptx/box-decoration.ts:11`）。

### M4: 札の高さ `TAG_H`（24）は固定のまま、文字はキャンバスで大きくなる。スライドの木では、札の文字が札からはみ出し、検査にも引っかかる

- **指摘**: D4 は札の高さを `TAG_H`（24）、文字を `roles.tag ?? 14` とした。`canvas: 'slide'`（`minText` 24）では倍率が `ceil(24/14×100)/100` = 1.72 になり、`roles.tag` は `round(14×1.72)` = **24** になる。24px の太字を高さ 24px の札に入れると、`box` の札と同じ置き方（ベースラインは `t.y + 17` で固定）では、漢字の上端が札の上に約 4px はみ出す。`box` の札は箱の枠の上に重ねるので目立たないが、D4 では札を箱の中の最上段に置くので、はみ出しが箱の中で見える。`lib/svg-lint.ts` の「囲む箱から文字がはみ出す」検査（余白 4px、3px 超で報告）にも当たる。デッキ（`canvas: 'slide'`）でマインドマップを描くのは、依頼者の使い方の中心になる。D4 の「札の行 = 24 + 4」も、キャンバスでは文字に対して小さい。
- **根拠**: `lib/tokens.ts:280-282`（`canvasFontScale`）、`:295-297`（`canvasRoles` は `tag` も倍にする）、`:278`（`SLIDE_CANVAS.minText` 24）、`lib/layout-util.ts:57`（`TAG_H = 24` 固定）、`lib/emit-box.ts:33`（`baseline: t.y + 17` 固定）、`lib/svg-lint.ts:126-148`（はみ出しの検査）
- **提案**: 木の札は高さとベースラインを文字の大きさに合わせると決める。例: `s = roles.tag / 14`、札の高さ `round(24×s)`、ベースライン `round(17×s)`、左右の余白 `round(8×s)`、札の間 `round(6×s)`、札の行の下 `round(4×s)`、`rx` は高さの半分。D6 の `rx="12"` も「高さの半分」に直す。`box` の札（同じ問題がある）は直さないなら、範囲外と書く。

---

## Minor

- **m1（org のバスの 24px）**: 「`org` の根のバスから子の上端までを 24」は、バスを上げる（`root.h + 20`）のか、子を下げる（`rowTop = root.h + 46`）のかが決まっていない（`lib/map-layouts.ts:47,62`）。どちらにするか書く。`layoutHanging` の引数に足すもの（`indent` は既にある。`bus` / `rowTop` はない。`:27`）も書く。
- **m2（`from` の子と兄弟の比べ方）**: `from` の子は元の線が消える（`lib/layout-tree.ts:101`）。`edge` を書けないので既定として比べられ、兄弟がみな同じ `edge` でも幹が既定に戻る。「2 点の子」と同じく、比べる組から外すと書く。
- **m3（D6 の「新しい属性」）**: `stroke-dasharray="6,4"` と `stroke-dasharray="2,5" stroke-linecap="round"` は、木の出力に既にある（`removed` の箱と、`dim` の箱の `rect`。`lib/emit-box-frame.ts:17-19`）。「`path` に新しく付く属性」と書く。札の `rect` に `data-node` を付けるか（付けないと、札をクリックしても項目が選ばれない。`lib/emit-box-frame.ts:19`）も D6 に書く。
- **m4（spec の検査）**: D7 の `check()` は配置だけを見ている。spec の `mindmap` は `edges: false` を受け付け（`lib/spec-parts/mindmap.ts:12`）、根も同じ `treeItem` を使う（`:10`）。`edges: false` と根の `edge` も `check()` で位置付きで返すと書く。
- **m5（「8 文字」の数え方）**: JSON Schema の `maxLength` は UTF-16 の単位で数える（絵文字は 2）。DSL で何を数えるか（`[...s].length`、`splitAtoms` など）を決めて、spec と同じにする。札の `tone` が `TagTone` でないときのエラーも D4 に書く。
- **m6（札の muted と反転の優先）**: (a) 「`focus` で muted になった項目」は、`LaidOutTree.nodes` に `focusLit` がないので、利用者が書いた `tone: 'muted'` と区別できない（`lib/types/diagrams.ts:419`、`lib/dsl/tree.ts:28`）。「`tone` が `muted` の項目の札は muted」と単純にするか、印を `nodes[i]` に足すかを決める。(b) `dim` の箱は塗りが白に戻る（`lib/emit-box-frame.ts:16`）ので、`solid` でも反転させない（`box` の `ringed` も `dim` を除く。`lib/box-step-geometry.ts:11`）と書く。
- **m7（反転の条件と `tones` の上書き）**: 反転を tone の名前（`solid` / `solid-danger`）で決めると、`diagram({tones})` で別の tone の塗りを札と同じ色にした場合に見えなくなる（`lib/tokens.ts:137-141`）。また `a11y-text-contrast` は `box` の札しか見ず、木を見ない（`lib/legacy-core.ts:123-128`）。v1 で検査しないなら、そう書く（`lib/bands/` の外に `b.type === 'tree'` を足さない。ADR 0080 D2b）。
- **m8（札を描く順）**: 札の `rect` と `text` を、`renderTree` のどこで出すか（箱の `rect` の後、項目の文字の前）を書く。文字の後に図形を描くと、`lib/svg-lint.ts:150-167` の「後から描いた図形が文字を覆う」検査の対象になる。
- **m9（PPTX の `focus` と線の形）**: D2 の PPTX の項目は `style` だけを言っている。`focus` の表（光らない枝は muted、光る枝は accent）を PPTX でも同じに使うこと、`fitConnector` が合わずに freeform になる枝（`lib/pptx/tree.ts:84`）にも線種を渡すこと（`freeformPathXml` は `opts` を受け付ける。`lib/pptx/line-shapes.ts:27`）を書く。
- **m10（行番号）**: 背景の「`lib/emit-tree.ts:17`」の線の色は 18 行目。

## 問題がなかったところ

- **24px の規則とバイト不変**: `levelGap` は `layoutTreeBand` の中で `round(44 × space)` として作られ（`lib/tree.ts:124-125`）、`fitLayout` の試行は `maxW` と向きだけを変える（`lib/tree.ts:100,138-143`）。`edge` があるかどうかは `band.root` から決まり、試行によらない。`edge` のない木では値が変わらないので、D8 は保てる。`tree({dir: 'auto'})` は `best` で全部の試行を比べるが、どの試行も同じ間隔になるので、比べ方は崩れない。
- **`LaidOutTree.edges` を使う所**: `lib/emit-tree.ts`、`lib/pptx/tree.ts`、`lib/layout-tree.ts`（吸着と漏斗）だけ。`verify-tree.ts` は `nodes` だけを、`emit-node-ids.ts` は `nodes` に `dataNode` を付けるだけを、`verify-edge-bends.ts` は木を見ない（`:17`）。`reveal` は `visibleAt(e, stage)` で 1 本ずつ見るので、分割しても変わらない。HTML 用の別の出力はない（`renderTree` / `treeXml` を呼ぶのは帯の定義と PPTX の adapter だけ）。`lib/dsl/rewrite.ts:104-108` は項目を `...item` で写すので、`edge` / `tags` は残る。
- **D3 の表**: `tree()` の `edges` は `false` だけ（`lib/dsl/tree.ts:41`）、帯ノードの `sub` / `tone` のエラー（`:58`）、`mindmap()` の `edges` は後から付く（`:79-80`）、漏斗は down / up / org だけ（`lib/layout-tree.ts:83-84`）。表のとおり。`focusTree` は `tone` 以外を `...rest` で残す（`lib/dsl/tree.ts:29-30`）ので、`focus` と `edge` / `tags` は一緒に使える。
- **PPTX の線種**: `connectorShapeXml` と `freeformPathXml` は `dashed` / `dotted` を `prstDash` の `dash` / `sysDot` で出せる（`lib/pptx/line-shapes.ts:7-10,21,27`）。
