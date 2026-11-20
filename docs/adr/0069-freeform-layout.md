# ADR 0069: 自由な図の配置 — ラベルの間隔、`via`、`areas`、spec の `board`

- 状態: 提案
- 日付: 2026-11-20
- 基点: `main`(7a95096e、ADR 0067 まで)。D1 と D2 は PR #377(`fix/freeform-small`)の上に作る。
- 関連: ADR 0012(id のスコープ)、ADR 0014(そろえと余白、`group({valign})`)、ADR 0016(矢印の端のそろえ)、ADR 0027(PowerPoint 書き出し、接続の判定)、ADR 0050(組み合わせられる帯)、ADR 0054(PowerPoint のグループ)、ADR 0055(デッキ)、ADR 0057(spec の `canvas`)、ADR 0061(段の幅の自動)

## 背景

nov27 の研修のデッキで `versus` を使いすぎていたため、利用者は 8 枚の図を TS の DSL(`box` / `group` / `row` / `connect`)で描き直した(`~/ai-dev-training/nov27/fig/*.diagram.ts`: s04-memo、s07-detail、s08-unseen、s10-ears、s13-scenario、s21-judge、s28-layers、s33-trace)。そのとき困ったことは次の 8 つ。

1. `cols` のない row で、子の `span` / `col` が黙って無視される。
2. 枠のない group(`frame: false`)が `valign` を無視する。
3. 高さの違う箱を左右でつなぐと、線が少し斜めになる。
4. 箱の間が狭いとラベル付きの矢印が `connect-label-covers-arrow` で止まる。
5. group の中の箱へ、group の枠の辺でつなぎたい(「頭の中」の枠 → 決定メモ)。
6. 行をまたいだそろえ(s33 の M → R → S → T)を、`span` / `col` の足し算なしで書きたい。
7. 自由な図は TS だけで書ける。JSON spec(`lib/spec.ts`)にないので、deck.json、MCP サーバー、ChatGPT からは描けない。選べるのは型のある部品だけで、`versus` に偏る理由の 1 つになっている。
8. SKILL.md に `branch()` がない。自由な図の手引き(`references/freeform.md`)がない。

1〜3 と 8 は PR #377 で直している。3 は `lib/layout-connect.ts` の `levelSides` で、左右の辺どうしでつなぐ 2 つの箱について次のようにする。

- 一方の端の真ん中の高さが、相手の箱の上下から 12px(`LEVEL_CLEAR`)以上内側にあれば、相手の端だけをその高さに動かす(片方だけ動かすのを先に試す)。両方の端の真ん中が互いの箱の内側にあるときは、高い方の箱の端を動かす(線は低い方の箱の真ん中の高さを通る)。
- そうでなければ、2 つの箱の高さの重なりが上下の角から 12px ずつ空けても残るとき、両端を重なりの真ん中に動かす。
- `branch()` の矢印は `fan: true` を持ち、行き先の端だけを動かす(扇の始点は 1 つのまま)。`@` で置いた端は動かさない。

この ADR は 4〜7 を扱う。

### 今の仕組み(コードを読んで分かったこと)

- **ラベルのための間隔(4)**: `lib/layout.ts` の前処理 `gapNeeded` / `gapForLabels` / `sharedGaps` が、ラベル付きの直線の connect(`route: 'straight'`)で、row の隣り合う子を右 → 左(または左 → 右)でつなぐものについて、row の `gap` を「ラベルの幅 + chip なら 16 + 両側 6px(`LABEL_MARGIN`)」まで既定で広げる。
  - `cols` の row では、同じ `cols` / `gap` の行がすべて同じ広げた間隔を使う(`sharedGaps`)。どの子も元の幅の 7 割(40px 以上)を保てるときだけ広げる。
  - `cols` のない row では、子が `MIN_CHILD_W`(80px)より細くならないときだけ広げる(`maxGap`)。
  - 検査は 2 つあり、それぞれ別の値で判定する。
    - `lib/verify.ts` の `checkConnects`: ラベルが自分の端の箱に重なる(エラー)。
    - `lib/connect-rules.ts` の `labelCover` / `hidesArrow`(`connect-label-covers-arrow`、警告): ラベルが経路の 6 割(`LABEL_COVER_MAX`)より多くを覆い、かつ見える部分が 20px(`LABEL_VISIBLE_MIN`)未満。
  - 試した結果(2026-11-20、この worktree):
    - 隣どうしの row で chip のラベル「照らし合わせる」: chip の幅は 114px、間隔は 128px に広がるが、経路の長さは 132px(4px の格子への丸めで、宣言した間隔と経路の長さが違う)。見える部分は 18px で `connect-label-covers-arrow` が出る。広げる目標(両側 6px)が、検査の 20px に足りていない。
    - `cols: 12` の row で `col` を 1 つ空けた 2 つの箱: 前処理は「間の空いた列が場所を作る」として飛ばす(`b.col !== a.col + a.span`)。空いた列が 1 つでは足りず、端の箱に重なるエラーになる。
    - 縦(`a:bottom` → `b:top`)のラベル: 帯と帯の間は `diagram({gap})`(既定 16)のままで、広げる仕組みがない。chip でも chip でないラベルでも端の箱に重なるエラーになる。`gap: 40` では `connect-label-covers-arrow`(見える部分 15px)。利用者が s10・s21 で `gap: 56` を書いたのはこのため。
    - `route: 'elbow'` は前処理が集めない(`collectConnects` が `'straight'` だけを見る)。辺を書かない connect(中心から中心)も対象外(`gapNeeded` が `right` / `left` の辺を見る)。
- **端の位置(5)**: `resolveConnect`(`lib/layout-connect.ts`)は `'id:side@t'` を `parseRef` で読み、`ctx.anchors` の矩形の辺の点(`anchorPoint`)を端にする。その後に、ノードの下端(`nodeBottoms`)、`plumb`、#377 の `levelSides` の順で端を直す。
  - group は `id` があるときだけ枠の矩形を anchors に登録する(`layoutGroupAt`)。箱がどの group の中にあるかは、どこにも記録していない。ただし `LaidOutGroup.span`(ADR 0054 D5)が、続く何本の帯が中身かを持っている。
  - 検査の矩形では group の枠は障害物ではない(`lib/verify-handlers.ts` の `group: {}`)。端の箱は `isOwnEndpoint`(`lib/verify.ts`)が id と `fromArea` / `toArea` で見分ける。
- **列のそろえ(6)**: 行をまたいで列をそろえる手段は 2 つある。
  - `row({cols})` の共有の列(`rowChildGeometry` と `gridColumns`、ADR 0014 D1): 同じ `cols` と `gap` の行は同じ列の端を使う。子ごとに `span` と `col` を書く。
  - `canvas()`(`lib/canvas.ts`)の `grid` 帯: テンプレートのセル(`place: {col, row, cs, rs}`)に箱を置き、行をまたぐ箱も書ける。列の幅は比(`colW`)、行の高さは中身から決まる(`canvasRowHeights`)。
    - ただし `GridBand.children` は `BoxBand[]` だけで、テンプレートは BMC・SWOT などの決まったものだけ(`TEMPLATES`)。
    - `layoutCanvasGrid` は箱を `placeBoxLike` で置くだけで、group を置けない。
    - `CanvasLayout` には `worded` / `floor` / `empty` / `requireAll` / `aspect` など、型のあるキャンバスのための項目が多い。
  - 純粋な幾何の関数 `canvasColumns` / `canvasSpan` / `canvasRowHeights` は、`CanvasLayout` のうち `colW` / `rowW` / `place` しか読まない。`canvasColumns` は間隔が 4 の倍数だと仮定している(`canvasBand` が丸める)。行の y を 4px の格子に乗せる処理は `layoutCanvasGrid` の中にある。
- **group の並び(6)**: `layoutGroupRow` は、子(箱と group)をまず上端からそれぞれ置き、いちばん高いものに枠を伸ばす。
  - 伸ばした分が 16px(`GROUP_FILL_MIN`)以上あれば、`snapshotCtx` / `restoreCtx` で取り消して、`valign` に従って中身を置き直す(ADR 0014 D2)。
  - #377 の後は、枠のある group は既定で中央、枠のない group は `valign` を書いたときだけ動き、既定は上。
  - 箱は `LaidOutRow` で包んで出す。
  - 前処理の `walk`(`lib/layout.ts`)は、中の幅を `stackWidthOf`(`lib/band-children.ts` の `STACK_WIDTH`。幅 1 つか `null` を返す)で求め、`grouprow` は自分で子の幅を計算して中を歩く。
- **JSON spec(7)**: `lib/spec.ts` の `PARTS` と `lib/spec-parts/r1〜r7.ts` に 64 の部品がある。
  - どれも型のある部品で、box / group / row / connect に当たるものはない。
  - 部品ごとに `schema` / `example` / `check` / `build` を持ち、`build` が DSL の関数を呼ぶ。
  - MCP の `list_diagram_parts`(プラグインの `src/tools.ts`)は `partCatalog()` をそのまま返す。デッキの図(ADR 0055)も同じ spec。
  - `parts` は 4 つまで。部品をまたぐ id の重複は、`checkAnchors` が部品の `anchors` に書いたキーの一覧(最上位だけ)で調べる。
  - 検証の `validateOneOf` は、オブジェクトの枝を `const` の項目か必須の項目で選ぶ。`kind` を省略できる枝の分け方には使えない。
- **PowerPoint(ADR 0054、0027)**:
  - group の枠は `LaidOutGroup.span` で中身の帯と 1 つのグループになる(`lib/pptx/slide.ts`)。
  - コネクタは `glueOf` で端の箱の図形に貼り付け、辺は `siteIndex` が参照の `:side` から選ぶ。`@t` の位置は無視して辺の真ん中に貼る。
  - PowerPoint は、貼り付けた図形を動かすまで書かれた座標のまま描く。LibreOffice は開いたときに、貼り付けから経路を作り直す(ADR 0027 の `judge-glue`)。そのため、端が辺の真ん中にないコネクタを貼ると、LibreOffice では線が辺の真ん中へ動く。

## 決定

### D1. ラベルのための間隔を、検査と同じ基準で、縦と空いた列にも広げる(4)

- 新しいオプション(`gap: 'auto'`)は作らない。横の row では今も既定で広げている。足りないのは、広げる量と、広げる場所。
- **基準を 1 つにする**: `lib/connect-rules.ts` に `labelRoom(label, chip, axis, labelAt, roles, widthOf)` を足し、ラベルのある経路が要る長さを返す。`axis` は `'horizontal'` / `'vertical'`(両端の x がそろう)/ `'slanted'`(縦で両端の x がそろわない)。前処理では、両端が同じ stack の帯そのものの箱(`box`)で `@t` が同じとき(どちらも stack の幅いっぱいなので x がそろう)だけ `'vertical'`(ただし node(アイコンが文字の上の箱)は真ん中のアイコンでつなぐので、`@0.5` 以外では node を含むと `'slanted'`)、ほかの縦は x が分からないので `'slanted'`(安全側)で求める。2 つの量を分けて求める。
  - `E`(経路に沿ったラベルの長さ。点を中心に置いたとして): 横で chip でなければ文字の幅 `lw`、横で chip なら `lw + 16`、縦で chip なら 24、縦で x のそろった線の chip でないラベルは文字の高さ `h`(大きさ + 4。線の横に、点を中心に置く)。
  - 斜めの線(`'slanted'`)の chip でないラベルは、横の線と同じく点の上に置かれる(`resolveConnect` の `dy = −6`。矩形の上端は点の `h + 2` 上、下端は点の 2px 上)。どちらの端が上でも足りるよう、`E = 2 × (h + 2)` とする。
  - `C`(ラベルが覆う線の長さ): chip なら `E`。chip でないラベルは線の上か横に置くので 0。ただし斜めの線では線がラベルの高さを横切るので `h`(経路が端の箱から離れる長さ `2h + 4` 以上あれば、覆うのは半分未満)。
  - 端の箱に重ならない長さ: `(E / 2 + LABEL_MARGIN) / min(t, 1 − t)`。`t` は `labelAt`(既定 0.5。そのとき `E + 2 × LABEL_MARGIN`)。
  - 覆いすぎない長さ: `C > 0` なら `min(C / LABEL_COVER_MAX, C + LABEL_VISIBLE_MIN)`(`hidesArrow` が成り立たない)、`C = 0` なら 0。
  - 要る長さは、この 2 つの大きい方。
  - 矩形の大きさは `resolveConnect` の `labelBox` / `chipBox` と同じ式で求める(式を `layout-connect.ts` から書き出して共有する)。
  - `gapNeeded` と `labelCoverRules` / `checkConnects` が同じ定数と式を見るので、「広げたのに検査で止まる」ことがなくなる。chip でない横のラベルは今と同じ `lw + 12` で、今より狭くならない。
  - 検査の側は、描いた connect のラベルの矩形と経路から同じ量を読む(`connectRoom(c)`。E と C は矩形の幅か高さで、`labelRoom` と同じ式の結果)。E と C から要る長さを出す式は `roomFor(E, C, labelAt)` 1 つで、両方がそれを呼ぶ。
  - `connectRoom` の向きは傾きではなく端の辺で決める(`right` → `left` なら横、`bottom` → `top` なら縦。x がそろえば `'vertical'`、そろわなければ `'slanted'`)。端どうしが向き合わない線(下の箱の `bottom` から上の箱の `top` へ、箱を通って戻る線など)は、箱の間の長さが要る長さにならないので undefined にし、文言に N px を書かない。
  - 要る長さちょうどの経路で `hidesArrow` が成り立たないよう、`hidesArrow` は比べるときにわずかな許し(share は 1e-9、見える部分は 1e-6)を持つ。CJK の chip は幅が 4 の倍数になりやすく、経路が要る長さちょうどになると、浮動小数点で見える部分が 19.99999999999994px になって警告が出ていた。
- **経路の長さで比べる**: 要る長さは、宣言した間隔ではなく実際の経路の長さと比べる。経路は 4px の格子への丸めで間隔と数 px 違う(上の例では間隔 128px で経路 132px)。`gridColumns` は列の間を `ceilGrid(gap)` より狭くしないので、隣どうしの子では間隔を `ceil4(要る長さ)` にすれば経路は要る長さ以上になる。上の例の chip(114px)では、要る長さは max(114 + 12、min(114 / 0.6、114 + 20)) = 134px で、間隔は 136px になる。
- **空いた列**: `cols` の row で、間に空いた列がある 2 つの子も対象にする。
  - 今の「空いた列があれば飛ばす」をやめ、実際の距離が要る長さに足りないときだけ、`sharedGaps` の共有の間隔を広げる。
  - 空いた列が `k` 本なら、距離は `(k + 1) × gap + k × colW`、`colW = (cw − (cols − 1) × gap) / cols` で、`gap` の 1 次式になる。要る長さを満たす `gap` を式で解き、4 の倍数に切り上げる。
  - ただし `gridColumns`(`lib/layout-util.ts`)は列の幅を 4px 単位に切り下げて配るので、式の距離より実際の距離が短くなることがある。解いた `gap` で `gridColumns` を呼んで実際の距離を確かめ、足りなければ 4px ずつ足す。
  - 子の幅の 7 割の制約は今と同じ。
  - `cols` の grouprow の group の中にある `cols` の row は、共有の間隔で狭くなった幅で求める。共有の間隔はすべての行を見るまで決まらないので、前処理の walk を、前の回の共有の間隔で歩き直し、変わらなくなるまで(4 回まで)繰り返す。ふつうの図は 1 回で終わる。一度 7 割の制約で広げられなかった共有の間隔は、以後の回も宣言の値のままにする(広げない値で入れ子の row が広がり、また収まるようになって、回ごとに 2 つの値を行き来するのを防ぐ)。
- **縦**: 同じ stack の続く 2 つの帯の間を広げる。ラベル付きの直線の connect が、前の帯の中の id の `bottom` から次の帯の中の id の `top` へ(または逆向きに)つなぐときが対象で、その間を要る長さまで広げる。
  - 高さを取らない帯(`connect`、高さ 0 の `spacer` など)は飛ばして「続く 2 つ」を数える。
  - 前処理で、帯ごとに「この帯の後に足す高さ」(`Map<Band, number>`)を求める。`ctx.stack` の中で、その帯を置いた直後に `ctx.y` に足す(group は子を 1 つずつ `ctx.stack([c])` で置くので、group の中の帯にも効く)。各ハンドラーが足す `d.gap` は変えない。
  - 帯と帯の間を `ceil4(要る長さ + 2)` にする(足す高さは、それから `d.gap` を引いたもの)。次の帯の上端は 4px の格子に丸められ(`snapGrid`)、前の帯の下端は格子に乗るとは限らないので、経路は間隔より最大 2px 短くなる(実装のとき、column-grid の例で下端 148.6、次の上端 176 を確かめた)。その 2px を足す。
  - 検査を通る図は動かさない: `d.gap − 2`(経路の最短)が、余白なし(`margin` 0)で求めた長さ、つまり検査が止まり始める長さ以上なら足さない。足すときは余白込みの要る長さまで広げる。
  - 端の id が帯の中のどこにあっても(group や row の中でも)、その帯に属するとみなす(今の `idsIn` と同じ)。前処理では帯の下端・上端を知らないので、端から帯の端までの距離(group の内側の余白など)を引かない。端が帯の内側にあれば経路はその分長くなるので、足りなくなることはなく、その分広めになる。
  - 対象は続く 2 つの帯だけ。間に高さのある帯があるときは、その帯の高さが経路を伸ばすので広げない(足りなければ検査が知らせる)。
  - 下の端が node(アイコンが文字の上の箱)の `top` のときは、端がアイコンの上端、つまり箱の上端より上の余白の分(`padY`)だけ下にある。ラベルは経路全体に沿って置かれるので、その分だけ下の箱に近づく。要る長さ(余白なしの長さも)に `padY × t / (1 − t)` を足す(`t` は上の端から数えたラベルの位置。`labelAt` 0.5 なら `padY` そのもの)。areas の縦も同じ。
  - `image({over})` の上に置く部品の帯の間は広げない。絵の高さは決まっていて、広げると部品が絵からはみ出して throw になる(今は検査が知らせるだけ)。
  - 自分で中を置く帯(tree・flowchart などの項目、`scope` の付いた名前 `plan.p0`)の id は `idsIn` が見ないので、その項目につなぐ線では広げない(今の横の前処理と同じ。検査が知らせる)。
- **対象外**: `route: 'elbow'`(未決 1)と、辺を書かない connect(中心から中心。線の向きが箱の位置で決まり、前処理では分からない)。どちらも検査が知らせる。注釈(`bracket` / `callout`)も集めない(今は横の前処理が集めていたが、注釈の線は箱の間を通らない)。
- **広げられないとき**: `cols` の row で子が 7 割より細くなるとき、`cols` のない row で子が 80px(`MIN_CHILD_W`)より細くなるとき、`justify` が `center` / `start` の row のときは、今と同じく間隔を変えない。そのときは検査の文言に「間隔を N px 以上に」と要る長さを書く(今は「箱の間隔を広げる」とだけ言う)。N は `ceil4(要る長さ)`。`checkConnects` は `widen the gap between the boxes to N px or more`、`connect-label-covers-arrow` は項目ごとに「要る間隔 N px」と書き、項目が 1 つなら直し方にも「箱の間隔を N px 以上に広げる」と書く。直線でない connect(elbow など)は今の文言のまま。
- **出力の変わる図**: 今エラーか `connect-label-covers-arrow` の警告(許容した図を含む)になる図だけ。検査を通る図の間隔は変わらない(要る長さ以下なら広げない)。例外が 1 つある: 縦で、端が row や group の中にあって x のそろいが前処理で分からない chip でないラベルは `'slanted'` として求めるので、実際には x がそろっていて検査を通る図(帯の間が `h` 以上 `2 × (h + 2)` 未満)も広がる。`examples/` にはこの形の図はない。

### D2. 枠で止まる端(`via`)(5)

    memo: box({title: '決定メモ', body: '1枚に書き出す', tone: 'solid'}),
    convs: group([box({id: 'c1', …}), box({id: 'c2', …}), box({id: 'c3', …})], {title: '同じ前提で始まる'}),
    connect('memo:right', 'c1:left', {via: {to: 'group'}, route: 'elbow'}),

- **オプション**: `ConnectOpts` に `via?: 'group' | {from?: 'group'; to?: 'group'}` を足す。
  - `{from: 'group'}` / `{to: 'group'}` はその端にだけ効く。その端が枠のある group の中になければ誤り。
  - `'group'` は、枠のある group の中にある端すべてに効く。どちらの端も枠のある group の中になければ誤り。片方だけなら、その端にだけ効く。
- **意味**: 端の箱を囲む枠のある group のうち、もう一方の端を含まない**いちばん外側**の group を選び、その枠の辺に端を移す。
  - 辺は参照の `:side` で決まる(`c1:left` なら枠の左辺)。
  - 辺の上の位置は箱の範囲で決まる(左右の辺なら箱の上端〜下端、上下の辺なら左端〜右端)。`@t` も箱の範囲に対して読む。
  - 線は枠の外から来て枠で止まり、枠を横切らない。いちばん外側にしたのは、入れ子の内側の枠で止めると外側の枠を横切るため。
- **作り**:
  - 端の矩形を「枠の辺 × 箱の範囲」に置き換える。左右の辺なら `{x: 枠の左端(右辺なら右端), y: 箱.y, w: 0, h: 箱.h}`。
  - 置き換えた矩形から、`anchorPoint`、`plumb`、#377 の `levelSides` の順で今の処理を通す。`levelSides` は箱の高さの範囲で読むので、片方だけ動かす規則(両方が内側なら高い方の箱の端を動かす)・12px の空き・`fan` の扱いはそのまま効く。
  - `via` の端には `nodeBottoms` を使わない。node() の下の辺で止める `via` の端が、ラベルの下端(枠の内側)へ引き戻されるため。
  - その端の矩形(枠)を `LaidOutConnect` の `fromVia` / `toVia` に残す。`bend: 'auto'` の障害物の判定(`inside()`)と `verify.ts` の `isOwnEndpoint` は、`fromArea` / `toArea` と並べて `fromVia` / `toVia` も読み、枠の中の箱を自分の端として扱う(group の枠そのものは検査の矩形ではない)。
  - `fromArea` / `toArea` には入れない。`lib/rules.ts` のグラフの検査(`endIds`)は area の中の箱をすべて端として数えるので、入れると同じ枠の中の c2・c3 も線につながったことになり、`graph-orphan-node` / `graph-disconnected` を逃れてしまう。グラフの検査は変えない。
  - `LaidOutConnect` の `fromId` / `toId` は箱の id のまま。グラフの検査は箱どうしの線として読む。
- **枠の見つけ方**: レイアウトの途中の状態(`ctx` の表)には持たない。`snapshotCtx` / `restoreCtx`(`layoutGroupRow`、`measureBandHeight`、D3 の 2 回目)が取り消す表に新しいものを足すと、取り消し漏れで古い枠が残るため。
  - 代わりに、`via` のある connect は必ず後回し(`ctx.deferred`)にし、すべての帯を置いた後に、最後の `laidOut` から求める。
  - 後回しの connect を解決するとき、端の id の矩形(`anchors`)を、枠のある `LaidOutGroup` の矩形それぞれと比べ、含まれるものを集める。枠は入れ子になるか離れているかで、重なり合うことはないので、含まれる枠を大きさの順に並べれば内側から外側の順になる。箱の種類(`LaidOutRow` の子、帯の箱、ほかの帯の項目)を問わず、anchor のあるものなら同じに扱える。row に伸ばされた後の枠の高さもそのまま読める。
  - 後回しにした connect は最後に描かれる(SVG と PowerPoint で、ほかの connect との重なりの順が変わる)。線どうしの重なりの順なので、見た目には影響しない。
- **誤り**(throw。spec では link の場所つき):
  - 端に辺がない(`'memo'` だけ)、または辺が `center`。どの辺で止めるか決まらない。
  - 辺がもう一方の端と反対を向いている(相手が左にあるのに `c1:right` で止める)。線が枠の中を戻って横切る。左右の辺は相手が左右どちらにあるか、上下の辺は上下どちらにあるかで判定する。相手の位置は、相手の端の点(相手にも `via` があれば、枠の辺に置き換えた後の点)で比べる。
  - その端が枠のある group の中にない(上の「オプション」の規則)。「`via` を外すか、箱を group に入れる」。
  - 端が group の id そのもの(`'convs:left'`)。もともと枠の辺なので `via` は要らない。
  - `route` が `loop-under` / `loop-side`、または注釈(`bracket` / `callout`)。
- **PowerPoint**: `via` の端だけを貼り付けない(`glueOf` を呼ばない)。
  - `via` の端は枠の辺の上にあり、箱の辺の上にない。箱に貼ると、箱を動かしたとき(LibreOffice では開いたとき)に、線が箱の辺へ、つまり枠の内側へ引き直される。
  - 貼らない端は、図形を動かしてもついてこない(ADR 0027 の「ラベルは箱について動かない」と同じ種類の制約として README に書く)。PowerPoint で開いたときの見た目は SVG と同じ。
  - 箱の自分の辺の上にある端は、今どおり貼る。`@t`、#377 の `levelSides`、`plumb` で辺の真ん中から動いた端もここに入る。PowerPoint は貼り付けた図形を動かすまで書かれた座標で描くので、開いたときの見た目は SVG と同じで、箱を動かせば線がついてくる(編集のしやすさを取る)。
  - 知られた制約として README に書く: LibreOffice は開いたときに貼り付けから経路を作り直すので、これらの端は辺の真ん中に戻る。ADR 0027 のとおり、LibreOffice で合っていることは PowerPoint で合っていることの代わりにならず、ここでは PowerPoint を優先する。
  - 貼り付けの決まりをすべての端で 1 つにする案は別案 7。採るとしても、この ADR の PR とは別の PR にする。

### D3. 名前の領域で置く `areas`(6)

    areas(`
      head  memo  convs
      head  memo  convs
      .     note  note
    `, {
      head: group([...], {title: '担当者の頭の中', tone: 'muted'}),
      memo: box({title: '決定メモ', body: '1枚に書き出す', tone: 'solid'}),
      convs: group([...], {title: '同じ前提で始まる', tone: 'accent'}),
      note: caption('…'),
    }, {cols: [4, 3, 4], gap: 64})

- **新しい帯 `areas`**(`AreasBand`)にする。今の `grid` 帯(canvas)は広げない(別案 1)。
  - `template`: CSS の `grid-template-areas` と同じ書き方。行は改行で区切る(文字列の配列でもよい。D4 の JSON と同じ形)。セルは ASCII の空白とタブ(`/[ \t]+/`)で区切り、`.` 1 文字が空きのセル。先頭と末尾の空行と字下げは捨てる。
  - 全角の空白(U+3000)は区切りにも名前にも使えない誤りにし、「全角の空白がある。半角の空白で区切る」と行と桁を示して返す。日本語の入力で混ざりやすいが、黙って区切りにすると、名前の中の打ち間違いと見分けられない(名前は ASCII なので、全角の空白が正しく使われる場所はない)。
  - `cells`: 名前 → 中身。中身は box、group、または row が包むもの(caption・table など。`stat` は box なのでそのまま置く)。
    - row が包むものは、row と同じく `group(x, {frame: false})` で包む。row の中の閉じた関数 `wrappable` / `wrap` を `lib/dsl/containers.ts` の関数に書き出し、row と areas で共有する。
    - row / grouprow / grid / areas / connect / spacer は直接は置けない(group に入れる)。
  - オプション:
    - `cols?: number[]`: 列の幅の比。既定は等分。
    - `gap?: number`: 列の間。既定 16。4 の倍数に切り上げる(列の端を 4px の格子に乗せるため)。
    - `rowGap?: number`: 行の間。既定は `gap`。同じく 4 の倍数に切り上げる(行の端を格子に乗せる `trackRowYs` の前提)。
    - `id?: string`: 全体の anchor。row の `id` と同じく `areaIds` に入れ、中の箱をその端として扱う。
  - areas は row の子にできない(`row([areas(…)])` は誤り。group で包む)。row の子は 1 行の中の 1 つの幅を取るものに限る、という今の決まりを保つ。
- **中身の位置の項目は誤り**: セルの中身の `span` / `col` / `flex` / `width` は、セルが位置と幅を決めるので、書いたら throw する(#377 で `cols` のない row の `span` を誤りにしたのと同じ考え)。
- **テンプレートの検査**(組み立てのとき。どれも名前つきの誤り):
  - どの行も同じ数のセル。
  - 名前は `^[A-Za-z][A-Za-z0-9_-]*$`(canvas の `id` と同じ)。
  - 1 つの名前のセルは長方形になる(CSS と同じ。L 字や離れた 2 か所は誤り)。
  - `..` や `...` は誤り(CSS では 1 つの空きのセル。ここでは `.` 1 文字だけにして、桁をそろえるための点と名前の打ち間違いを見分けやすくする)。
  - `.` だけの行は誤り。行の高さは中身から決まる(`rowW` はすべて 1)ので、中身のない行は高さ 0 になり、`rowGap` が 2 つ重なるだけになる。
  - `.` だけの列は許す。列の幅は `cols` の比で決まるので、空きの列は本当の余白になる(s21 の左右の箱の間のような空き)。
  - テンプレートの名前と `cells` のキーが一致する(足りない名前・余った名前の両方を挙げる)。
  - `cols` の数は列の数と同じ。列と行はそれぞれ 12 まで。
- **id**: 名前がそのまま中身の id になる(`connect('memo:right', …)` がそのまま書ける)。
  - 中身に名前と違う `id` があれば誤り(名前は 1 つにする)。同じ id があれば、今の anchor の重複の誤り。
  - row が包むもの(caption など)は、包んだ枠なしの group が名前を id に持つ。包まれる band 自身が名前と同じ `id` を持つときは、その band が anchor のままで、包む group には id を付けない(同じ id が 2 つにならないように)。そのとき `connect` の端はセル(伸ばした枠)ではなく、その band の自然な大きさの矩形になる。
  - 名前は帯に `names`(中身と同じ順)として持ち、誤りの文言(幅・reveal)は中身の id でなくこれを読む(包んだ band が id を持つとき、包む group には id がない)。
  - 名前は中身の写しに入れる。`spanRow` と同じく `Object.create(Object.getPrototypeOf(c), …)` で写し、`withHandle` の付いた箱の `.top` などの持ち手を保つ。
  - TS の型は、`cells` のキーと、セルの中身が宣言する id(`IdsOf<cells の値>`。group の中の `c1` など)の両方を `Declares` に入れ、`Refers<RefsOf<…>>` も row と同じく引き継いで、`connect` の参照の型の検査(今の row と同じ仕組み)に乗せる。
- **配置**(`lib/layout-handlers.ts` に `layoutAreas`):
  - 行の幾何は canvas と共有する。`canvasRowHeights` の引数の型を、`CanvasLayout` から `Pick<CanvasLayout, 'colW' | 'rowW' | 'place'>`(`TrackGrid` と名付ける)に狭める。`canvasSpan` はそのまま使う。areas の `rowW` はすべて 1(高さは中身だけで決め、比は使わない)。
  - 列の幅は `canvasColumns` ではなく、areas の関数 `areasColumns`(`lib/areas.ts`)で決める(実装で変えた。下の理由)。
    - `canvasColumns` は列の左端をそれぞれ 4px に丸めるので、等分のつもりの列が 184 / 184 / 180 / 184px のように 4px ずれる。s33 を書き直した例で `layout-sibling-size` が 2 つ出た(元の s33 の `row({cols: 12})` の幅では出なかった。`gridColumns` でも幅によっては 288 / 292 / 288px のように違う)。canvas の出力を変えずに直せないので、canvas の関数は変えない。
    - `areasColumns` は、幅を 4px の数で比に分け(切り捨て)、余った数を「同じ比の列すべてに 1 つずつ配れるとき」だけ配る(比の端数の大きい順)。同じ比の列は必ず同じ幅になる。それでも余った数は、どの列の間にも同じ数ずつ足せる分だけ足し(間隔はどこも同じ。`layout-gutter-uneven` を出さない)、残り(列の間の数より少ない)は右に残す。
  - 行の y を 4px の格子に乗せる処理を、`layoutCanvasGrid` から関数(`trackRowYs`)に書き出して共有する。canvas の出力は変わらない。
  - 1 回目: 各セルを、その列の x と幅で上端から置き、自然な高さを測る(`layoutGroupRow` と同じく、box は `placeBoxLike`、group は `ctx.stack`)。
  - 行の高さ: `canvasRowHeights(grid, needs, rowGap, 0)`。1 行のセルは行の高さ、複数の行にまたがるセルはその行の和(+ 間の `rowGap`)。足りなければ、またぐ行を等しく伸ばす(canvas と同じ)。
  - 2 回目: `snapshotCtx` / `restoreCtx` で取り消し、各セルを行の y に置き直す。セルの中身は 1 回目と同じ幅なので、文字の折り返しは変わらない。
    - box はセルの高さに伸ばす(row と同じ)。
    - group は枠をセルの高さに伸ばし、16px 以上の余りを中身に渡す(`GroupFill`)。決まりは #377 と同じで、枠のある group は既定で中央、枠のない group(row が包んだ caption なども)は `valign` を書いたときだけ動き、既定は上。
  - 出力の帯は今の型だけを使う(box は `LaidOutRow` で包む、group は `layoutGroupAt` の `LaidOutGroup` と `span`)。`emit.ts`・`emit-html.ts`・PowerPoint(D6)・`data-node`・spotlight は変えない。
  - 領域(名前のセル)の幅が 96px(`CANVAS_MIN_REGION_W`)未満になれば誤り。判定は列ごとではなく領域ごとにする。`.` だけの列(`cols: [4, 1, 4]` の真ん中のような余白)はどれだけ細くてもよい。文言は canvas() のものを使わず、`areas: area "memo" is only Npx wide …` と areas の言葉で書く。
- **ラベルの間隔**(D1 と同じ基準):
  - 横に並ぶセル(行が重なり、間の列がすべて空き)の間をラベル付きの connect がつなぐときは `gap` を、縦に並ぶセル(列が重なり、間の行がすべて空き。ただし `.` だけの行は誤りなので、ふつうは隣り合う行)のときは `rowGap` を、要る長さまで広げる。
  - 距離は、間の空きの列の幅の和 + (空きの列の数 + 1) × `gap`。隣り合うセルなら `gap` だけ。s21 のように余白の列をはさむ場合も、この距離で比べる。空きの列の幅も `gap` で変わるので、D1 の空いた列と同じく式で解き、`areasColumns` で確かめて足りなければ 4px ずつ足す。
  - 実装は `lib/layout.ts` の `areasGapFor(band, cw)` 1 か所で、前処理の walk と `layoutAreas` の両方が同じ値を読む(PR 2 は D1 と並行で作り、D1 が main に入った後にここへつないだ)。
  - 横: 要る長さは `labelRoom(…, 'horizontal')`。宣言の `gap` での実際の距離(`areasColumns`)が要る長さ以上なら広げない(row と同じ)。
  - 縦: 端が両方ともセルにじかに置いた box で、同じ列の範囲・同じ `@t`(node は `@0.5` だけ)なら `'vertical'`、ほかは `'slanted'`(D1 の stack と同じ)。対象は隣り合う行の 2 つだけ。間に行があると(ほかの列に中身があり)、その高さは配置まで分からないので広げず、検査に任せる(高い行なら経路は足りていて、広げると下がすべて動くため)。行の端は 4px の格子に乗るので、経路は `rowGap` 以上ある。それが余白なしの長さ(検査が止まり始める長さ)以上なら広げず、足りなければ `ceil4(要る長さ)` にする(D1 の帯の間の 2px はない)。
  - 横の組は、すべての線の要る間隔の大きい方を取った後に、最後の `gap` で組ごとに測り直し、足りない組があれば 4px ずつ足す(`areasColumns` は列を 4px 単位に切るので、`gap` が広がると空きの列の距離が 4px 縮むことがある)。
  - `image({over})` の部品の中の areas は広げない(D1 の帯と同じ。前処理の walk が印を付ける)。
  - 広げた `gap` で、どの領域も元の幅の 7 割と 96px(元が 96px 以上なら)を保てなければ、宣言の `gap` のままにする。検査の文言が要る間隔を書く。
  - 間に中身のあるセルをはさむ 2 つのセルは対象外(線がそのセルを横切る。検査が知らせる)。
  - areas の間隔は 1 つなので、どれか 1 本が要れば全体が広がる(列のそろえを崩さないため)。
  - 子を 7 割より細くするなら広げない(D1 と同じ)。
- **前処理の順**(`lib/layout.ts` の `walk`):
  - `STACK_WIDTH.areas = null`(幅 1 つでは中を表せない)。`walk` に areas の枝を足す。
  - まず areas の間隔(D1 で広げた後のもの。`areasGapFor`)を決め、次にその間隔で `areasColumns` からセルの幅を求めて、group の中身を歩く(中の row のラベルの間隔の計算に使う)。
  - 今の `grouprow` の枝は、広げた間隔を使う場合と宣言の間隔を使う場合(`cols` の row)が混ざっている。areas は常に「間隔が先、中の幅が後」とする。
- **周りの登録**:
  - `CHILD_BANDS` と `STACK_WIDTH`(`lib/band-children.ts`。表に型がないとコンパイルが通らない)
  - `itemIdsOf`、`layoutHandlerFor`、`measureBandHeight`
  - `lib/reveal-handlers.ts`(中身の段階を中身ごとに読む。row と同じ)
  - `lib/dsl/rewrite.ts` の `NO_REVEAL` と、`assertNoReveal`(areas 全体には `reveal` を書けない。中身に書く。row と同じ)
- spotlight は `areas({id})` を指せない(`row({id})` と同じ。areas 全体の帯は出力にないため)。中の領域の名前(中身の id)を指す。
- canvas() を areas の上に作り直すことはしない(未決 3)。

### D4. JSON spec の型のない部品 `board`(7)

    {"type": "board",
     "areas": ["head memo convs", "head memo convs", ". note note"],
     "cols": [4, 3, 4],
     "gap": 64,
     "nodes": [
       {"id": "head", "kind": "group", "title": "担当者の頭の中", "tone": "muted",
        "children": [{"title": "提出先の手引き"}, {"title": "社内ルール"}, {"title": "環境の制約"}]},
       {"id": "memo", "title": "決定メモ", "body": "1枚に書き出す", "tone": "solid"},
       {"id": "convs", "kind": "group", "title": "同じ前提で始まる", "tone": "accent",
        "children": [{"id": "c1", "title": "今の会話"}, {"id": "c2", "title": "新しい会話"}, {"id": "c3", "title": "別の人・別のAI"}]},
       {"id": "note", "kind": "caption", "text": "前提は 1 か所にだけ書く"}],
     "links": [{"from": "head", "to": "memo"},
               {"from": "memo", "to": "c1", "via": "to", "route": "elbow"}]}

- **D3 と同じ配置の仕組みを使う**: `build` は `areas(…)`(と group の中の `areas(…)`)と `connect(…)` を呼ぶだけで、spec 専用の配置は持たない。TS と JSON で同じ図が同じ SVG になる。
- **node のスキーマ**: 1 つの平らなオブジェクトにし、`kind` を列挙(`box`(既定)/ `group` / `caption`)で持つ(`flowchart` の node と同じ形)。`validateOneOf` は `kind` を省略できる枝を選べないので、`oneOf` は使わない。`kind` に合わない項目は `check()` が `parts[0].nodes[1].text` などの場所で断る。
  - box: `id`、`title`、`body`、`lines`(箇条書き、8 まで)、`tone`、`stamp`。
  - group: `id`、`title`、`tone`、`dashed`、`valign`、`children`、`areas`、`cols`、`gap`、`rowGap`。
    - `children` は node(1〜8)。box と caption のほか、group も書ける。ただし入れ子は最上位の group の中の group 1 段まで(board → group → group → box の 3 段)。
    - `areas` があれば中を名前の領域で置く(DSL の `group([areas(…)])`)。そのとき children の `id` は必須(テンプレートの名前)。`areas` がなければ縦に積む。
  - caption: `id`、`text`、`bold`、`tone`。
  - 最上位の node の `id` は必須(テンプレートの名前)。`areas` のない group の中の node の `id` は、つなぐときだけ要る。
  - テンプレートの名前になる `id`(最上位の node と、`areas` のある group の children)は D3 の名前の規則(`^[A-Za-z][A-Za-z0-9_-]*$`)に従う。spec の `id()` は任意の文字列を許すので、`check()` が `parts[0].nodes[2].id` の場所で断る。
- **board の項目**:
  - `areas`(省略可): 文字列の配列。省略すると、最上位の node を書いた順に 1 行に並べる。最上位の node が 12 を超えるのに `areas` がないときは、「`areas` を書く」と返す(列は 12 まで)。group の中の `areas` も同じ。
  - `cols`、`gap`、`rowGap`: D3 と同じ。
  - `nodes`: 入れ子を含めて 24 まで。
  - `links`: 0〜40。
- **links**: 項目は `from`、`to`、`fromSide` / `toSide`(`left` / `right` / `top` / `bottom`)、`label`(40 字)、`chip`、`line`、`tone`、`arrow`、`route`(`straight` / `elbow`)、`via`(`from` / `to` / `both`)。
  - `via` は D2 の `{from: 'group'}` / `{to: 'group'}` / `'group'` に直す。
  - 端は同じ board の box か group の node だけ。caption の node と、ほかの部品の anchor は誤り(部品をまたぐ線は、部品の配置が別々で、つながりが読めない)。
  - **辺の省略**: `fromSide` / `toSide` がなければ、テンプレートの上のセルの位置から決める。モデルは辺の名前を間違えやすいので、多くの場合に書かなくて済むようにする。
    - 両端をともに含む、いちばん内側の容れ物(board か group)を探す。それぞれの端について、その容れ物の直接の子である祖先(端そのものか、端を含む group)を取り、その 2 つのセルを比べる。
    - 容れ物に `areas` があれば(board は省略時も 1 行のテンプレートがある)、列の範囲が重ならず行の範囲が重なれば左右(左にある方が `right`)、行の範囲が重ならず列の範囲が重なれば上下で決める。
    - 容れ物が `areas` のない group(縦に積む)なら、上下で決める(先に書いた方が上)。
    - 一方の端がもう一方の祖先のとき(group G から G の中の box へ)は、「直接の子である祖先」が決まらないので、辺を書かなければ誤り(`parts[0].links[i].fromSide` の場所で「辺を書く」)。
    - どれでも決まらない(斜めのセル)ときは、`parts[0].links[i].fromSide` の場所で「辺を書く」と返す。
    - DSL の `connect()` の省略時(中心から中心)は変えない。
- **check**(組み立ての前、場所つき):
  - D3 のテンプレートの検査を `parts[i].areas[2]` などの場所で返す。
  - node の id の重複(group の中も含む)。`checkAnchors` は部品の `anchors` のキーの最上位しか見ないので、`PartDef.anchors` を「キーの名前」か「id を集める関数」にし、board は入れ子を平らにした一覧を返す。
  - `links` の端の存在と種類、`via` の端が枠のある group の中の box であること。
- 上限(node 24・link 40)は、spec の今の考え(`MAX_TOTAL_TEXT` など)に合わせた。`flowchart` の 40 / 60 より小さい。自由な図は手で読める量に絞る。
- **description**(`list_diagram_parts` に出る): 「A free layout: boxes and framed groups placed by named areas, joined by arrows. Use it when the figure is a few blocks and the arrows between them, and no typed part names that shape (a memo that feeds several conversations, a trace across stages, layers with what slips through). Prefer a typed part when one fits: a comparison is compare or versus, a process is flowchart or steps.」
  - 型のある部品を優先する一文を入れ、`board` が新しい偏りにならないようにする。
- `example` は上の s04 の形を小さくしたもの。
- **MCP とデッキ**: プラグインの `list_diagram_parts` は `partCatalog()` を返すので、core を取り込めば `board` が出る(ADR 0057 と同じ)。デッキの図も spec なので、deck.json でも書ける。プラグインへの取り込みと、ChatGPT のツールの更新(ウィジェットのキャッシュ。プラグインの手順)は別の PR にする。

### D5. 作る順と PR

1. **PR 1(D1)**: ラベルの間隔。`labelRoom` のために `layout-connect.ts` の矩形の式を書き出すので、#377 の上に作る。D3 と D4 も同じ基準を使う。
2. **PR 2(D3)**: `areas`。`canvas.ts` の幾何の型を狭める変更を含む。
3. **PR 3(D2)**: `via`。PR 2 の後。どちらも `layout-handlers.ts` と `layout-ctx.ts`(後回しの扱い)を触るので、並行させずに順に入れる。PowerPoint は `via` の端を貼らないことだけを含め、ほかの端の貼り付けの決まりは変えない(別案 7)。
4. **PR 4(D4)**: `board`。PR 2 と PR 3 の後。続けて、プラグインのリポジトリで core を取り込む PR を作る。

4 つの PR は、それぞれ Opus のレビューを受けてから main に入れる。PR 2 の後に nov27 の 8 枚を `areas` で書き直し、`span` / `col` と `gap: 56` がいくつ消えるかを数えて、PR 2 の説明に書く。

### D6. PowerPoint(ADR 0054)

- `areas` は今の帯の型(包んだ `row`、`group` と `span`)だけを出すので、PowerPoint の書き出しは変えない。group の枠と中身は今どおり 1 つのグループになる。`areas` 全体はグループにしない(row や grid も全体ではまとめていない)。
- 貼り付けは D2 のとおり。`via` の端だけを貼らず、ほかは今どおり。
- `board` は spec から DSL を組み立てるだけなので、`pptx-deck` と `svg-diagram/pptx/deck/edge` でもそのまま描ける。

### D7. 文書(ADR 0066 D9 と同じく、PR ごとに)

- **SKILL.md**(`skills/svg-diagram/SKILL.md`): PR 2 で `areas`、PR 3 で `via` を、自由な図の書き方の一覧に足す。PR 4 で「JSON で自由な図を描くなら `board`。型のある部品が合えばそちらを先に」を足す。
- **`references/freeform.md`**(#377 で足す): PR 2 で「行をまたいでそろえる: `areas`」の節を足し、s33 と s04 の書き直しを例にする。PR 3 で「枠で止める: `via`」、PR 1 で「ラベル付きの矢印の間隔は自動で広がる。広がらない場合」の節を足す。
- **README**: DSL の節に `areas` と `connect({via})`、spec の節に `board`、PowerPoint の節に、`via` の端は貼らないことと、LibreOffice では `@t`・`levelSides`・`plumb` で動いた端が開いたときに辺の真ん中に戻ること(知られた制約、D2)を足す。
- **`test/fixtures/untested-exports.json`**: 新しく出す関数(`areas`、`labelRoom`、テンプレートの解析、`areasColumns`、`trackRowYs`)はテストを書き、この一覧には足さない。
- spec の `description`(node・link・各項目)は、MCP の利用者が読む唯一の説明なので、D4 の決まり(辺の省略、`via`、`kind` ごとの項目)をそこに書く。

## 検討したほかの案

1. **canvas の `grid` 帯に名前のテンプレートを足す**: 幾何(列の比、またぐ行、行の高さ)は同じだが、次の理由で帯を分け、幾何の関数だけを共有した。
   - `GridBand.children` は箱だけで、`layoutCanvasGrid` は group を置けない。
   - `CanvasLayout` は型のあるキャンバスのための項目(`worded`・`floor`・`empty`・`requireAll`・`aspect`・タグの下の余白)を持ち、`canvas-region-empty` などの検査がそれを読む。
   - group を入れると、それらの検査と HTML 出力(`emit-html.ts` が grid の子を箱として描く)の両方に手が入る。
2. **`row({cols})` を広げる(行をまたぐ `rowSpan`)**: row は 1 行ずつの帯で、行をまたぐ子を置くには前後の行を知る必要がある。名前の領域なら、行の数と列の数を 1 か所で見て書ける。
3. **`gap: 'auto'`(依頼の案)**: 横の row は既に既定で広げているので、`'auto'` を足すと「書かなくても広がる」と「書けば広がる」が混ざる。既定で広げ、その範囲を縦と空いた列に広げた(D1)。広げてほしくない図のための逃げ道(`gap: {fixed: true}` など)は、要る例が出るまで作らない。
4. **`via` を参照の書き方に入れる(`'convs>c1:left'`、`'c1:left^'`)**: JSON の `from` / `to` が文字列のまま書けるが、記号の意味が読んで分からない。今の `'id:side@t'` の文法も複雑になる。そのためオプションにした。
5. **`via` で、いちばん内側の group で止める**: 入れ子の group で外側の枠を横切るので、外側にした(D2)。止める group を id で選ぶ書き方(`via: {to: 'convs'}`)は未決 2。
6. **囲む枠を、レイアウトの途中で `ctx` の表に記録する**: `snapshotCtx` / `restoreCtx` の取り消しに入れ忘れると古い枠が残る。取り消す場所は 3 つ(`layoutGroupRow`、`measureBandHeight`、areas の 2 回目)ある。後回しの connect を解決するときに、anchor の矩形が枠の矩形に含まれるかで求めることにした(D2)。
7. **PowerPoint の貼り付けをすべての端で 1 つの決まりにする(辺の真ん中から 0.5px 以内の端だけを貼る)**: LibreOffice で開いても線が動かなくなるが、`levelSides`・`plumb`・`@t` で動いた端がすべて貼られなくなり、PowerPoint で箱を動かしても線がついてこなくなる。
   - 失う範囲の目安(ソースの文字列で数えた上限。実際に動く端の数はレイアウトしないと分からない): `examples/` の 188 個のうち、`@t` を使うのは 3 個。左右の辺どうしの connect(`levelSides` の候補)は 7 個の例に 15 本。nov27 の 8 枚では、左右の辺から出る connect が 18 本と、テンプレート文字列で書いた 4 本。`plumb` は `versus` の共有の箱への 2 本で、`shared` のある versus のすべて。
   - 自由な図では `levelSides` で動く端がふつうにあり、編集のしやすさを大きく失う。ADR 0027 のとおり、LibreOffice での合格は PowerPoint での合格の代わりにならない。採らない。採るなら、実際に失う端の数を examples と nov27 で数えたうえで、この ADR の PR とは別の PR にする(未決 8)。
8. **spec の `board` を、row / group / connect をそのまま JSON にしたもの(`{type: 'row', children: [...]}` の木)にする**: DSL と 1 対 1 で作りやすい。しかし行をまたぐそろえが `span` / `col` の足し算に戻り、モデルが書き間違えやすい(この ADR の 6 の理由そのもの)。配置は名前の領域だけにした。
9. **`board` の node を `kind` ごとの `oneOf` にする**: `validateOneOf` はオブジェクトの枝を `const` か必須の項目で選ぶので、`kind` を省略できる box の枝を選べない。平らなオブジェクトにした(D4)。
10. **`board` に node の座標(x / y)を書かせる**: 重なりや文字のはみ出しを書き手が防ぐことになり、このツールの「座標を書かない」作りに反する(`lib/dsl.ts` の冒頭)。

## 未決

1. `route: 'elbow'` のラベルの間隔。ラベルは真ん中の脚に乗り、脚の長さは間隔ではなく箱の位置の差で決まる。今は検査に任せる。
2. `via` で止める group を id で選ぶ(`via: {to: 'convs'}`)。いちばん外側でない枠で止めたい例が出たら足す。
3. `canvas()` を `areas` の上に作り直すか(テンプレートを `areas` の文字列で書く)。出力を 1 byte も変えずにできるかを確かめてから決める。
4. `areas` の列の幅を中身から決める(ADR 0061 の `width: "auto"` のように)。今は比だけ。
5. `areas` の行の比と高さ(`rows`、`h`)。今は中身の高さだけ。
6. `board` の上限(node 24・link 40)で足りるか。nov27 の 8 枚は、どれも node 12 以下・link 6 以下。
7. `board` の links に、`branch()`(1 つから複数へ。#377 の `fan`)に当たる書き方を入れるか。今は link を並べる。
8. PowerPoint の貼り付けを、辺の真ん中から外れた端(`@t`・`levelSides`・`plumb`)で変えるか(別案 7)。LibreOffice で開く利用者が困る例が出たら、失う端の数を examples と nov27 で実際に数え、別の PR で決める。

## テスト

- **D1**(`test/connect-label-gap.test.ts`):
  - 次の場所で、chip あり・なし、短い・長いラベル、`labelAt` 0.5 と 0.3 の connect を描き、`connect-label-covers-arrow` と「端の箱に重なる」のどちらも出ないことを確かめる。
    - 隣どうしの row
    - `cols` の row で列を 1 つ・2 つ空けたもの(`gridColumns` の 4px の切り下げで、式の距離より短くなる幅も含める)
    - 縦の 2 つの帯(間に connect の帯があるものも)
    - group の中の縦の 2 つの帯
  - `labelRoom` を経路の実際の長さと比べ、`hidesArrow` が成り立たないこと、`checkConnects` の重なりが出ないことを、同じ関数で突き合わせる(基準のずれを防ぐ)。
  - chip でない横のラベルの間隔が、今の `gapNeeded` より狭くならないこと。
  - 広げられない row(`cols` で 7 割、`cols` なしで 80px)では間隔が変わらず、文言に要る長さが出ること。
  - ラベルのない図と、今の基準で検査を通る図の SVG が変わらないこと(`examples/` の golden)。
- **D2**(`test/connect-via-group.test.ts`):
  - 端が枠の辺の上にあり、y が箱の範囲の中にあり、線が枠を横切らないこと。row で伸ばされた枠(`layoutGroupRow` の後)と、areas の 2 回目で置き直した枠の辺に乗ること(取り消し後の古い枠を読まない)。
  - 入れ子の group では、いちばん外側の枠で止まること。両端が同じ group の中のときは、その group では止まらないこと。
  - 誤りの文言: 辺なし・`center`・反対向きの辺・枠のある group の外・group の id・loop と注釈。
  - #377 の `levelSides` と合わせて水平になること(片方だけ動く場合と、重なりの真ん中に動く場合)。`branch()` の `fan` と合わせても始点が 1 つのままであること。
  - `bend: 'auto'` の elbow が、枠の中の箱を障害物にしないこと。`verify.ts` が枠の中の箱との重なりを誤りにしないこと。
  - PowerPoint: `via` の端に `stCxn` / `endCxn` がないこと。もう一方の端と、`levelSides`・`@t`・`plumb` で動いた端は今どおり貼られること。
  - グラフの検査: 枠の中の c1 だけにつないだとき、同じ枠の c2・c3 が今どおり `graph-orphan-node` / `graph-disconnected` の対象になること(`fromArea` / `toArea` に枠を入れていないこと)。
  - node() の下の辺で止める `via` の端が、枠の辺の上にあること(`nodeBottoms` を使わない)。
  - 箱でない anchor(表の行や図の項目など、anchor のあるもの)を囲む枠でも止まること。
- **D3**(`test/areas.test.ts`):
  - テンプレートの解析: 空行・字下げ・配列、`.`、`..`・`...`、`.` だけの行(誤り)と列(許す。`cols` の比の幅の空きになる)、全角の空白(行と桁つきの誤り)、長方形でない名前、行のセルの数の違い、名前とキーの過不足、`cols` の数。
  - 中身の `span` / `col` / `flex` / `width`、名前と違う `id`、`row([areas(…)])`、areas 全体の `reveal` が誤りになること。
  - 列がそろうこと: 違う行の同じ列のセルの x と幅が同じ。同じ比の列は同じ幅(`areasColumns`)。行をまたぐセルの高さが行の和。group の枠がセルの高さに伸び、`valign` が #377 と同じ決まりで効くこと。
  - 名前が id になり、`connect('memo:right', …)` が解決すること。持ち手のある箱(`withHandle`)で `.right` が使えること。`areas({id})` を端にできること。
  - 中の row のラベルの間隔が、広げた areas の間隔から求めた幅で決まること(前処理の順)。
  - canvas の例の SVG が変わらないこと(幾何の型を狭め、行の y の処理を書き出しただけ)。
  - PowerPoint: `areas` の中の group が `span` で 1 つのグループになること(`test/pptx` の今の検査に例を足す)。
  - s04・s33 を `areas` で書いた例を `examples/` に足し、`build`(lint --strict)を警告なしで通ること。
- **D4**(`test/spec-board.test.ts`):
  - `partCatalog()` の全例のテスト(ADR 0057 の全例を描くテスト)に `board` が入り、通ること。
  - 場所つきの誤り:
    - `parts[0].areas[1]`(長方形でない)
    - `parts[0].nodes[2].id`(重複、group の中も含む。名前の規則に合わない)
    - `parts[0].nodes[1].text`(`kind` に合わない項目)
    - `parts[0].nodes[0].children[1].id`(`areas` のある group で id がない)
    - `parts[0].links[0].to`(ない id、caption、ほかの部品の id)
    - `parts[0].links[1].fromSide`(斜めで辺が決まらない)
    - `parts[0].links[2].via`(枠のある group の中でない)
  - 入れ子の上限(group の中の group の中の group)、node の数(入れ子を含めて 24)、`areas` のない 13 個の node が誤りになること。
  - 辺の省略: 左右・上下・group の中の box・同じ group の中(`areas` あり・なし)の場合に、DSL で辺を書いたものと同じ SVG になること。
  - 同じ図を DSL(`areas` + `connect`)と spec(`board`)で書き、SVG がバイト単位で同じこと。
  - デッキ(`validateDeck`)の図に `board` を書けること。
