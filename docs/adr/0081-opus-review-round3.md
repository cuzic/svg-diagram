# ADR 0081 Opus レビュー round 3

- 対象: `docs/adr/0081-tree-branch-style-and-tags.md`（ブランチ `docs/adr-mindmap-branch-style`、PR #463、0ae22e75）
- 見方: round 2 の M1〜M4 が直ったかを確かめ、そのあと改訂で残った・新しく入った Blocker / Major を探す。根拠はすべてこのワークツリーの `ファイル:行`。
- 結果: **Blocker 0 / Major 0 / Minor 7**（収束）

## round 2 の指摘が直ったか

| ID | 判定 | 理由 |
|---|---|---|
| M1 | 直った | D2 の「同じ幹の組」が「同じ親 + 同じ `points[0]`（2 点と `from` の子は除く）」になった。配置ごとに確かめた: right / down は親の辺の中点が全員同じ（`lib/graph-layout.ts:78`）、x=mid / y=mid も同じ段の子で同じ（`:55,79`。子の位置は段ごとに揃う `:69`）。radial の根の子は左右で `a.x` が違う（`:134`）ので 2 組、その下は半分の木の `layoutTree` を写すだけ（`:140`）。left / up は `mirror` が全点を同じ式で写す（`lib/map-layouts.ts:16,19`）ので等しさは保たれる。org の根の 4 点の子は `(rcx, root.h)` が全員同じ（`:62,68`）で 1 組、2 点の子（`:67`）は除く。list と org の下の段は `(x+14, y+h)` が親ごとに同じ（`:39`）。`edges: 'straight' / 'curve'` は全部 2 点（`lib/tree.ts:132`）なので組がなく T = S。帯ノードの吸着（`lib/layout-tree.ts:31-39`）は、親が帯ノードなら全兄弟の `points[0]` を同じ `dy` だけ動かし、水平の脚なら隣の点も一緒に動かす（`:37`）ので、組も「その項目だけの区間」の向きも崩れない（組は配置の段階で決めるので、そもそも吸着の前） |
| M2 | 直った | S と T の規則が 1 つになり、「S = T なら 1 本」が明記された。T は「組の共通の S」か「既定」のどちらかなので、`style` がない枝は必ず `trunk` もない（`trunk` があるのは S が既定でなく T が既定のときだけ）。`style`・`trunk` の持ち方に矛盾はない。round 2 の 4 つの場合（同じ破線の兄弟、子 1 つ、光る破線、`trunk` なし）はすべて決まる。分割したときの T は（ふつうの状態では）常に既定の実線、`focus` / `dim` でも実線なので、破線の周期が継ぎ目でやり直しになる場合は起きない |
| M3 | 直った（細部は m5） | PPTX の札は木だけの関数で、色は SVG と同じ表、`boxBadge` と `box` の PPTX は変えない、と決まった |
| M4 | 直った | 札の寸法がすべて `s = f/14` に比例する。`f = 14`（`roles.tag` なし）なら高さ 24・ベースライン 17・左右 8 で、今の `box` の札（`lib/emit-box.ts:33`、`lib/layout-util.ts:57`、`lib/layout-box-like.ts:45-46`）と同じ形。`svg-lint` の「囲む箱からのはみ出し」は余白 4px 固定（`lib/svg-lint.ts:136`）なので、`s` > 1 ではむしろ余裕が増える。札の文字の囲む箱は札の `rect`（中心を含む最小の `rect`。`:126-145`） |

---

## Blocker / Major

なし。

確かめたが問題がなかった点（Major を探した範囲）:

- **バイト不変（D8）**: `edge` も `tags` もない木では、`style` / `trunk` / `nodes[i].tags` が付かない。描く順の比べ方を「既定 → `style` → 光る」にしても、`style` がなければ今の `lit` だけの比べ方（`lib/emit-tree.ts:14`、`lib/pptx/tree.ts:68`）と同じ順（`toSorted` は安定）。`focus` だけの木は、光る枝が T = S = accent の実線、光らない枝が T = S = muted の実線で 1 本ずつ、色も今の `e.lit && !b.dim ? accent : muted`（`lib/emit-tree.ts:18`）と同じ。`layoutHanging` の `rowTop` と `indent`、`levelGap` の 48 は `edge` のある木だけ。`measureNode` の `opts.tags` は省略時に何も変えない（`lib/tree.ts:55-70`）。
- **24px の規則**: right / down の「その項目だけの区間」は `b` から mid まで = `(levelAt[l+1] - 親の端)/2` で、親が段の最大より小さいと長くなるだけなので、最小は `levelGap/2`（`lib/graph-layout.ts:55,78-80`）。radial の根の子も、半分の木の 1 段目が `levelGap` の位置にあるので `levelGap/2`（`:112,125,134-136`）。org の根の子は `rowTop - bus` = 46 − 22 = 24（`lib/map-layouts.ts:47,62,68`）。list は `indent - 14` = 24（`:36,39`）。`fitLayout` の試行は `maxW` と向きだけを変える（`lib/tree.ts:100,124-125`）ので、どの試行でも同じ間隔。
- **`focus` / `dim` の上書き**: `focusTree` は焦点の下の項目もすべて光らせる（`lib/dsl/tree.ts:24-28`）ので、同じ組に光る兄弟が複数ありうるが、表はどの枝にも T と S を 1 つに決めるので描き方は一意。光る枝は最後に描く（同じ組の光らない兄弟の muted の幹の上に accent の幹が乗る）。PPTX では `dim` の木は絵のまま（`lib/pptx/tree-band.ts:8`）なので、`dim` の行は SVG だけに効く（m4）。
- **色が同じなら反転**: 箱の塗りと札の塗りは、どちらも `colorOf(…, day)`（`lib/tokens.ts:224-227`）で同じ表（`toneStyle`、`:127-130`）から解決するので、比べるのは決まった 2 つの `#rrggbb`。`solid` の塗り `accent` と accent の札の ink `accent`、`solid-danger` と danger は既定で等しい（`:121-122`）。`dim` の箱は塗りが白に戻る（`lib/emit-box-frame.ts:16`）。
- **PPTX の札と本文**: 札は `texts` に入らないので `nodeRunsOf`（`lib/pptx/node-runs.ts:19`）は拾わず、`lineYs` が札の行だけ下がり、`boxXml` の上の余白（`lib/pptx/shapes.ts:29-30`）が札の下から本文を始める。線種は `connectorShapeXml` / `freeformPathXml` の `opts`（`lib/pptx/line-shapes.ts:7,21,27`）で出せる。
- **D6**: 札は `pillSvg`（`lib/badge.ts:89-92`）で `rect`（`x y width height rx fill`）と `text`（`x y text-anchor font-size font-weight fill`）だけを出し、`g` や `data-badge` は出さない。D6 の表と合う。

---

## Minor

- **m1（帯ノードの子の 24px）**: down / up / org で子が帯ノードのとき、吸着は最後の点だけを `dy` 動かし、縦の「その項目だけの区間」の長さが `dy` だけ変わる（`lib/layout-tree.ts:26,37-38`。`q` は縦なので動かない）。`dy` は `roundGrid`（4 の倍数に丸める。`lib/layout-util.ts:85-89`）なので −2〜+2、最短で 22px になる。right / left / list / radial は最後の脚が水平で `q` も動く（`:37`）ので変わらない。U1 のテスト「24px 以上」は帯ノードの子を除くか、「帯ノードの子は ±2px」と D2 に書く。
- **m2（`focus` と `dim` が両方あるとき）**: 表の「`focus` あり」と「`dim`」の行が両方当てはまる場合の優先が書かれていない。今のコードは `dim` が勝つ（`lib/emit-tree.ts:18`、`lib/pptx/tree.ts:71`）。「`dim` の行が優先」と 1 行書く。札の色の表（D4）も、行が重なる場合（`dim` > 項目が muted > 色が同じ > ふつう）の順を書く。
- **m3（D6 の分割の行）**: 「どの指定で」が「同じ幹の組で `edge` が違うとき、または `focus`」になっているが、`focus` だけでは分割しない（`edge.line` が実線なら S = T）。正しくは「S ≠ T のとき: 同じ組で `edge` が違う、または `focus` / `spotlight` で線種が実線でない枝」。
- **m4（PPTX の `dim`）**: D2 の PPTX の項目は「`focus` / `dim` の表は PPTX でも同じ」とするが、`dim` の木は PPTX で図形にならず絵になる（`lib/pptx/tree-band.ts:6-8`）。「`dim` は今どおり絵（SVG の見た目）」と書く。
- **m5（PPTX の札の形）**: 角丸の比（`roundRectAdj` 相当で高さの半分）、文字の上下の置き方（`plainBox` のような `lineYs: [size]` か）、グループの中で箱の**後**に置くこと（`pieces` の順。`lib/pptx/tree.ts:67,95-97`）を書く。
- **m6（D4 の色の式）**: 表の 1 行目の `colorOf(toneStyle(tones, tone).ink)` に `day` がない（D1 は `theme` 付き）。同じ式にそろえる。
- **m7（`tags` の行の位置の持ち方）**: `measureNode` は `{label, sub, w, h}` しか返さず、`nodeRuns` は `r.y + PAD_Y` から書き始める（`lib/tree.ts:34,73-77`）。札の行の高さを `NodeLines` に足す（省略時 0）のか、`nodeRuns` の引数にするのかを書く（`nodeRuns` は `states()` と共有）。
