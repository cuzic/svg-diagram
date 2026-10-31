# ADR 0049: `tree()` / `mindmap()` のノードに任意の band を使う

- 状態: 第 1 段(ノードに band を置く)は実装済み(PR #348 マージ済み)。第 2 段の一部(D6: `from` と `edges: false`)は実装済み(レビュー前)。第 1b 段(`scale`)と、子の帯を親の段の真下に寄せること(D7)は設計だけで、未実装
- 日付: 2026-10-31
- 基点: `main`(PR #346 まで)
- 関連: ADR 0046(`valueChain()`)、ADR 0045(ブラウザ入口)、ADR 0017(文字サイズの下限)、Issue #347(依頼の原文)
- 範囲外: `chevronTree()`(専用の帯)、兄弟を畳んで「＋3」と出すこと(呼び出し側が「＋3」というラベルの band を置けば足りる)、`renderInBrowser()` の `nodes`(id → 矩形)の表(別の小さな要望。別 PR)

## 背景
Artifact「仕事の全体図」から、「矢羽根の帯を入れ子にして、全体の中のいまどこを見せる図」の依頼が来た(Issue #347)。依頼の案は `chevronTree()` という専用の帯で、子の帯を親の矢羽根の真下に収め、漏斗状の線でつなぐ。ユーザーの判断は、**専用の帯は作らず、マインドマップ(木)のノードとして任意の band を使えるようにする**こと。矢羽根に限らず、`swimlane()` / `table()` / `plane()` / `box()` など何でもノードにできれば、この依頼も他の「入れ子の全体図」も同じ部品で描ける。
文字サイズについては、「ノードごとに小さい文字を許す」とした(依頼の「4 段でも 14px 以上に自動で縮め、入らなければ畳む」は求めない)。

## 決定
### D1: ノードは `{label, band, w, id?, children?}`
`TreeItem` に `band?: Band` と `w?: number` を足す。`band` があるノードは、ボックスと文字の代わりにその band を、幅 `w` で描く。
- `label` は名前(エラー文・check 用)。図には出ない。`sub` / `tone` は書けない(band が自分で描く)。`w`(40 以上)は必須で、`band` なしの `w` は throw。`connect` と `spacer` はノードにできない。
- `id` はノードの矩形の anchor。band の中の id(矢羽根の段など)も、その band の anchor として図全体に登録される(`connect()` の端点になる。型でも `TreeIds` が band の宣言した id を足すので、`.connect('a2:bottom', ...)` が通る)。同じ id を両方に使うと、重複で throw(ふつうの anchor と同じ)。同じ band のオブジェクトを 2 つのノードに使うことは throw(1 回だけ配置される。id も衝突する)。
- `swimlane()` は配列を返すので、ノードには `swimlane(...)[0]` を渡す(線は別に足す)。配列を渡すと、そう教える文で throw する。
- `tree()` の全部の向き(`down` / `right`)と、`mindmap()` の全部のレイアウトで使える。文字のノードと混ぜられる。
### D2: 高さは「試しに配置して測り、巻き戻す」
木の配置は、ノードの大きさ(w, h)から位置を決める。band の高さは配置してみないと分からないので、`layoutSwimlane` などを実際に `ctx.stack` で走らせて高さを測り(カーソルの進み − gap。`raw({h: 0})` のように gap を足さない band のため 0 で止める)、その後で `laidOut`・anchor(Map ごと)・`nodeBottoms`・`areaIds`・connect・scope の表を、走らせる前に戻す(`measureBandHeight`、シェル側。throw のときも戻す)。戻す処理は `snapshotCtx` / `restoreCtx` の 1 組で、`layoutGroupRow` の「行をやり直す」と共通(こちらは scope の表を戻していなかったので、それも直る)。`LayoutCtx` に状態を足すときは、この 1 組に足す。
限界: スライドの画面(`canvas`)の上の `grid({fit: 'aspect'})` は、残りの高さをカーソルの y から決めるので、y=0 での測りと本配置の高さが合わない(band のノードにしない)。幅の探索(`fitLayout`)が何度も組み直すので、(band, 幅)ごとに 1 回だけ測る。幅は band 側から決められないので、`w` を固定する(文字ノードのような自動の幅はない)。
### D3: 置き方
1. 木が、測った大きさで位置を決める(`lib/tree.ts` は純粋なまま。高さを返す関数を引数で受ける)。
2. band は他の band と同じく 4px の格子に乗せて置かれる。木の矩形(と、その矩形に着く線の端。brace の `{` の端も)を、置かれる位置に合わせて動かす(`snapBandNodes`。2 点だけの線は、相手の端が別のノードの上にあれば動かさず、brace の `{` や背骨の上なら一緒に動かす)。
3. 木を先に描き(線が下)、各 band を、その矩形に `ctx.stack([band], x, w)` で本配置する。
木が引く線は、いまの `tree()` と同じ、親の矩形の辺の中央から子の矩形の辺の中央まで。
### D4: 検査
木の `rects`(重なりの検査)は、文字のノードだけ。band のノードは、band として検査される(`group` の子と同じ)。木は band のノードに文字も `labelBoxes` も作らない。band を含まない木は、出力が 1 バイトも変わらない(origin/main と 13 通りの SVG を比べて確かめた)。
- **段階表示(`reveal`)**: 木の `reveal` / `until` は band のノードに受け継がれ、band に書いた `reveal` も段の数に数えられる(`reveal-handlers` の `tree` は `nested`)。
- **同じ band を見る処理**: `childrenOf` に band のノードを足したので、spotlight・rules・measure・scope が band のノードの中を見る。`diagram()` の既定(`connectDefaults` / `wireframeDefaults`)も、`mapBands` が木の中を辿って届く。型では、`TreeIds` が band の宣言した id を足す(id を宣言しない band は `IdsOf` で落とす。`unknown` に崩れると、図全体の `connect` の id の検査が消える)。
- **既知の差**: ラベル付きの `connect` のための row の gap の拡張(`sharedGaps`)は、木の外の walk で集めるので、band のノードの中の `cols` つきの row には届かない(測りと本配置は同じ値を使うのでずれない)。
### D5: 文字サイズ — 第 1b 段の設計(未実装)
ノードに `scale`(0.5〜1)を許し、小さい文字で遠くのノード(祖先・畳んだ兄弟)を描く。ADR 0017 の 14px の下限は、`canvas.minText` と `fontFloor` で緩める仕組みで、図全体の宣言だった。ここではノードごとの拡縮にする。
- **方式**: band を仮想の幅 `w / scale` で配置し、出力を `<g transform="translate(x y) scale(s)">` で包む。仮想の座標で配置するので、中の配置は変わらない。anchor は図全体の座標に写して登録する(外からの `connect()` が届く)。
- **`LaidOut` の側の持ち物**: 仮想の座標のまま `laidOut` に入れると、図全体の座標を前提にする処理が変換を知る必要がある。そこで、縮めた band の出力は **1 つの `scaled` の入れ物**(`{type: 'scaled', x, y, w, h, scale, items}`)にまとめ、変換を読む場所を決めておく: emit(`<g>` で包む)、verify(中の items は仮想の座標のまま、中だけで検査し、図の外・他の band との重なりは入れ物の矩形で見る)、spotlight・reveal(入れ物ごと)、PPTX(画像で書き出す。`table` などネイティブで書き出す band は、縮めた band では画像にする)、connect の障害物(入れ物の矩形。ただし外から中の id へ引く connect の端点を含む入れ物は、障害物から外す。group の中の box につなぐときと同じ扱い)。reveal は入れ物ごとではなく、emit が入れ物の中の items にも `visibleAt` を当てる(縮めた band の中の `reveal` も効く。D4 の約束と揃える)。
- **線の太さ**: `transform` は線も縮める(0.5 なら 2px が 1px)。`vector-effect: non-scaling-stroke` は、PNG・PPTX の描き手(resvg、PowerPoint の取り込み)が対応しているか未確認で、対応していないと、ブラウザは 2px、PNG・PPTX は 1px と食い違う。そこで **配置のときに線の太さを `2 / scale` で描く**(emit に倍率を渡す)ことを第一案にする(矢じりなどの塗りは縮む)。
- **下限**: 実効の大きさ(`size × scale`)は、図が宣言した下限(`canvas.minText` と `fontFloor` の仕組み。宣言がなければ 14px)を下回ったら止める。止めたくないときは、図の側で下限を下げる宣言をする(ADR 0017 と同じ作り)。実効の大きさが 14px 未満の箇所は、情報の規則(`scaled-text-small`)で `check` に一覧を出す。静的 lint は `font-size` の数値だけを読むので、縮めた文字を見られない。この規則がその代わりをする。縮めた band の中の文字と大きさの一覧は、配置済みの `LaidOut*` からでなく、配置の前に全 band が文字を挙げる `MEASURE_HANDLERS`(`lib/layout-measure.ts`)から集める(帯ごとの追加なし)。宣言がなければ 14px で止めるので、`scale: 0.5` は、`canvas.minText` / `fontFloor` を宣言しない限りほぼ必ず throw する。エラーの文と例で「`scale` を使うなら、先に下限を宣言する」と案内する。
- **採らなかった案**: ① 文字の役割(`roles`)を縮めて配置する。emit が `roles` を図全体のものとして読む帯(swimlane・tree・plane)があり、配置と描画で文字サイズが食い違う。② 配置済みの幾何を縮める。`LaidOut*` の型が帯ごとに違い、全部に縮める関数が要る。
- 第 1 段では、band の中の文字は ふつうの大きさのまま。小さい文字が要る band は、いまも `size`(14 未満は `canvas.minText` / `fontFloor` で許したとき)で書ける。
### D6: 漏斗の線 — `from` と `edges: false`(第 2 段の一部)
依頼元が第 1 段を試した結果(Issue #347)で、最重要は「線を、親の帯の中の、いま選んでいる段から出したい」こと(帯の下辺の中央から出ると、左端の段を選んだとき誤解を招く)。
- **`from`**: 子のノードに `from: 親の band の中の id` を書く。その子への線は、その部品の近い辺の両端から、子のノードの近い辺の両端へ、2 本の線(漏斗)で引く。**子が親の band の全体の真下(真上)にあるレイアウトに限る**(tree `down`、mindmap `down` / `up` / `org` / `list`)。横にあるレイアウト(`dir: 'right'`、radial の左右、brace)では、「どの段から」が線で表せない(線が親の band の中をなぞる)ので、配置のときに throw する。
- **端の取り方**: 部品が矢羽根のような flow shape のとき、anchor の外接の矩形でなく、**描いた多角形の近い辺の両端**を使う(矢羽根の辺は、矢じりの手前で止まる)。子の側も、子の band の多角形の近い辺の両端(多角形がなければ矩形の辺)。始点の高さは、**親の band の辺**(`pr.y + pr.h`、上なら `pr.y`)。swimlane の手順のように、部品が band の辺にないときも、線が親の band の中の他の部品をまたがない。x は部品の範囲のまま。
- **配置の後に解決する**: 木の線は band の本配置の前に決まるが、band の中の anchor は本配置の後でないと分からない。そこで、`layoutTree`(シェル)が、band を置いた後(`resolveAnchor` で `ctx.anchors` を引く。scope のある band の中の id も短い名前で引ける)、その子への木の線(`LaidOutTree.edges` の `child`。`from` のある木にだけ付く)を外して、漏斗の 2 本に置き換える。他の子は、これまでの木の線のまま。
- **段階表示**: 漏斗の 2 本は、子の band と親の band の `reveal` の遅い方で出る(`edges` の `reveal` / `until`。`renderTree` が段を受け取る)。木の他の線(band のノードへの普通の線)は、これまでどおり木と同じ段で出る(残り)。
- **検証**: `from` は、根・親が band のノードでないとき・`edges: false` と一緒のとき throw。名前が親の band の中の id でない(木のノードの id、band 全体の id、他の band の id)ときは、配置のときに、その band の中の id の一覧つきで throw(宣言がなければそう書く)。`from` を型では絞らない(親子をたどる型が重い。打ち間違いは配置のときの throw)。
- **`edges: false`**: 木の枝の線(と brace)を引かない。`tree()` にも `mindmap()` にも書ける。呼び出し側が `connect()` を自由に引ける。fishbone / timeline の背骨(`bold` の線)は図そのものなので残す。
### D7: 子の帯を親の段の真下に寄せる(未実装)
依頼元の第 2 の要望。いまは、子の帯は親ノードの中央ぞろえ(`w` 固定)。親の `from` の段の x 範囲に寄せたい。回避は、いまは呼び出し側が、子の `w` を親の段の幅に合わせて書くこと。
- **段の位置は、測りから取れる**: `measureBandHeight` は、band を x=0・幅 `w` で試しに配置し、巻き戻す前の `ctx.anchors` に、band の中の部品の矩形(band の左上を原点とする座標)が入っている。これを `{h, parts: Map<id, Rect>}` で返せば、木の配置の前に、段の x の範囲が分かる(追加の配置は要らない。band の配置は x の平行移動で変わらない)。scope のある band は `resolveAnchor` で引く。
- **木の配置は「親の中央に子をそろえる」純粋な規則**: 子を段の下に寄せるには、配置の後で、`from` のある子の部分木を、段の中央へ横に動かす(動かせる量は、兄弟の部分木との隙間と図の幅まで。寄せきれなければ、寄せられる所まで寄せ、漏斗の線で残りをつなぐ)。動かした後に `snapBandNodes` を走らせる順序にしないと、線の端がまたずれる。木の配置のアルゴリズムに「望む中心」を渡す案は、既存の配置を壊しやすいので採らない。

## 結果と残り
- 例 `examples/tree-band-nodes.ts` と `examples/tree-band-funnel.ts`(どちらも golden あり)。テストは `test/tree-band-nodes.test.ts`。
- 残り: D5(`scale` と `scaled-text-small`)、D7(子の帯を親の段の真下に寄せる)、`renderInBrowser()` の `nodes`(id → 矩形)の表(別 PR)、band のノードの `data-node`(`nodeIds`)、`legend` や `status` など意味のない band の型を止めるか(いまは通る)、木の矩形が、格子に動いた最後のノードの分だけ band の下端と最大 3px ずれること。
- Opus レビュー(#349 の 1 巡目): 高 2・中 4・低 4 を受けて、矢羽根の多角形の辺の両端、始点を親の band の辺に、横のレイアウトでは throw、漏斗の段階表示、`edges: false` は背骨を残す、scope の短い名前、from の候補の絞り込み、D7 の設計の追記を入れた。
- Opus レビュー(#348 の 1 巡目): 高 3・中 4・低 7 を受けて、`reveal` を band のノードへ、`TreeIds` に band の id、`mapBands` が木の中を辿る、`snapshotCtx` / `restoreCtx`(throw でも戻す)、brace と 2 点の線、同じ band の再利用の検査、D5・D6 の設計の追記を入れた。
- 罠: band の高さは配置してみて測るので、幅の探索が多い図(`dir: 'auto'`)で、band が重いと遅くなる(幅ごとに 1 回)。測りの巻き戻しは `ctx` の持ち物を全部戻す前提なので、新しい状態を `ctx` に足したら、`measureBandHeight` も直す。
