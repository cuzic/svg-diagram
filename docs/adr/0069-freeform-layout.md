# ADR 0069: 自由な図(box / group / row / connect)の配置 — ラベルの間隔、枠で止まる矢印、名前の領域(`areas`)、JSON spec の `board`

- 状態: 提案
- 日付: 2026-11-20
- 基点: `main`(7a95096e、ADR 0067 まで)
- 関連: ADR 0012(id のスコープ)、ADR 0014(そろえと余白、`group({valign})`)、ADR 0016(矢印の端のそろえ)、ADR 0050(組み合わせられる帯)、ADR 0054(PowerPoint のグループ)、ADR 0055(デッキ)、ADR 0057(spec の `canvas`)、ADR 0061(段の幅の自動)

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

1〜3 と 8 は別の PR(ブランチ `fix/freeform-small`)で直している。3 は `lib/layout-connect.ts` に `levelSides` を足し、左右の辺どうしで高さが重なる箱は、重なりの真ん中の高さで水平につなぐ。この ADR は 4〜7 を扱う。

### 今の仕組み(コードを読んで分かったこと)

- **ラベルのための間隔(4)**: `lib/layout.ts` の前処理 `gapNeeded` / `gapForLabels` / `sharedGaps` が、ラベル付きの直線の connect(`route: 'straight'`)で、row の隣り合う子を右 → 左(または左 → 右)でつなぐものについて、row の `gap` を「ラベルの幅 + chip の 16 + 両側 6px(`LABEL_MARGIN`)」まで既定で広げる。`cols` の row では、同じ `cols` / `gap` の行がすべて同じ広げた間隔を使う(`sharedGaps`。どの子も元の幅の 7 割を保てるときだけ)。検査は 2 つあり、どちらも別の値で判定する。
  - `lib/verify.ts` の「ラベルが自分の端の箱に重なる」(エラー)。
  - `lib/connect-rules.ts` の `labelCover` / `hidesArrow`(`connect-label-covers-arrow`、警告): ラベルが経路の 6 割(`LABEL_COVER_MAX`)より多くを覆い、かつ見える部分が 20px(`LABEL_VISIBLE_MIN`)未満。
  - 試した結果(2026-11-20、この worktree):
    - 隣どうしの row で chip のラベル「照らし合わせる」: 間隔は広がるが、見える部分は 18px で `connect-label-covers-arrow` が出る。広げる目標(両側 6px、計 12px)が検査の 20px に足りていない。
    - `cols: 12` の row で `col` を 1 つ空けた 2 つの箱: 前処理は「間の空いた列が場所を作る」として飛ばす(`b.col !== a.col + a.span`)が、空いた列が 1 つでは足りず、端の箱に重なるエラー。
    - 縦(`a:bottom` → `b:top`)のラベル: 帯と帯の間は `diagram({gap})`(既定 16)のままで、広げる仕組みがない。chip でも chip でないラベルでも端の箱に重なるエラー、`gap: 40` では `connect-label-covers-arrow`(見える部分 15px)。利用者が s10・s21 で `gap: 56` を書いたのはこのため。
    - `route: 'elbow'` は前処理が集めない(`collectConnects` が `'straight'` だけを見る)。
- **端の位置(5)**: `resolveConnect`(`lib/layout-connect.ts`)は `'id:side@t'` を `parseRef` で読み、`ctx.anchors` の矩形の辺の点(`anchorPoint`)を端にする。group は `id` があるときだけ枠の矩形を anchors に登録する(`layoutGroupAt`)。箱がどの group の中にあるかは、どこにも記録していない。
- **列のそろえ(6)**: 行をまたいで列をそろえる手段は 2 つある。
  - `row({cols})` の共有の列(`rowChildGeometry` と `gridColumns`、ADR 0014 D1): 同じ `cols` と `gap` の行は同じ列の端を使う。子ごとに `span` と `col` を書く。
  - `canvas()`(`lib/canvas.ts`)の `grid` 帯: テンプレートのセル(`place: {col, row, cs, rs}`)に箱を置き、行をまたぐ箱も書ける。列の幅は比(`colW`)、行の高さは中身から(`canvasRowHeights`)。ただし `GridBand.children` は `BoxBand[]` だけで、テンプレートは BMC・SWOT などの決まったものだけ(`TEMPLATES`)。`layoutCanvasGrid` は箱を `placeBoxLike` で置くだけで、group を置けない。`CanvasLayout` には `worded` / `floor` / `empty` / `requireAll` / `aspect` など、型のあるキャンバスのための項目が多い。
  - 純粋な幾何の関数 `canvasColumns` / `canvasSpan` / `canvasRowHeights` は、`CanvasLayout` のうち `colW` / `rowW` / `place` しか読まない。
- **group の並び(6)**: `layoutGroupRow` は、子(箱と group)をまず上端からそれぞれ置き、いちばん高いものに枠を伸ばす。伸ばした分が 16px(`GROUP_FILL_MIN`)以上あれば、`snapshotCtx` / `restoreCtx` で取り消して、`valign` に従って中身を置き直す(ADR 0014 D2)。box は `LaidOutRow` で包んで出す。
- **JSON spec(7)**: `lib/spec.ts` の `PARTS` と `lib/spec-parts/r1〜r7.ts` に 64 の部品がある。どれも型のある部品で、box / group / row / connect に当たるものはない。部品ごとに `schema` / `example` / `check` / `build` を持ち、`build` が DSL の関数を呼ぶ。MCP の `list_diagram_parts`(プラグインの `src/tools.ts`)は `partCatalog()` をそのまま返す。デッキの図(ADR 0055)も同じ spec。`parts` は 4 つまで。部品をまたぐ id の重複は `checkAnchors` が部品の `anchors` の一覧(最上位だけ)で調べる。
- **PowerPoint(ADR 0054)**: group の枠は `LaidOutGroup.span` で中身の帯と 1 つのグループになる(`lib/pptx/slide.ts`)。コネクタは `glueOf` で端の箱の図形に貼り付け、辺は `siteIndex` が参照の `:side` から選ぶ(`@t` の位置は無視し、辺の真ん中に貼る)。

## 決定

### D1. ラベルのための間隔を、検査と同じ基準で、縦と空いた列にも広げる(4)

- 新しいオプション(`gap: 'auto'`)は作らない。横の row では今も既定で広げている。足りないのは、広げる量と、広げる場所。
- **基準を 1 つにする**: `lib/connect-rules.ts` に `labelRoom(label, chip, axis, roles, widthOf)` を足し、ラベルのある経路が要る長さを返す。
  - ラベルの矩形の長さ `L`(横は chip なら幅 + 16、chip でなければ線の上に乗るので 0。縦は chip なら 24、chip でなければ線の横に置くので 0)。矩形は `resolveConnect` の `labelBox` / `chipBox` と同じ式で求める(式を `layout-connect.ts` から書き出して共有する)。
  - 要る長さ = max(`L` + 2 × `LABEL_MARGIN`(端の箱に重ならない)、min(`L` / `LABEL_COVER_MAX`、`L` + `LABEL_VISIBLE_MIN`)(`hidesArrow` が成り立たない))。chip でない縦のラベルは、線の横に置く文字の高さ(文字の大きさ + 4)+ 2 × `LABEL_MARGIN`。
  - `gapNeeded` と `labelCoverRules` / `verify.ts` が同じ定数を見るので、「広げたのに検査で止まる」ことがなくなる。chip の「照らし合わせる」(chip の幅 116px)なら、間隔は今の 128px(116 + 12)から 136px(min(116 / 0.6, 116 + 20) = 136 と 128 の大きい方)になる。経路の長さと間隔の差(線の太さ、矢じり)は実装で確かめ、テストで検査と突き合わせる。
- **空いた列**: `cols` の row で、間に空いた列がある 2 つの子も対象にする。今の「空いた列があれば飛ばす」をやめ、実際の距離(空いた列の幅 + 間隔)が要る長さに足りないときだけ、`sharedGaps` の共有の間隔を広げる。列の幅は間隔から決まるので、`width(cw, span, gap)` の式で、要る長さを満たす最小の間隔を求める(二分探索。7 割の制約は今と同じ)。
- **縦**: 帯と帯の間(`ctx.stack` が並べる、同じ stack の続く 2 つの帯)を、ラベル付きの直線の connect が下 → 上(または上 → 下)でつなぐとき、その間を要る長さまで広げる。
  - 前処理で、帯ごとに「この帯の後に足す高さ」(`Map<Band, number>`)を求め、`ctx.stack` の中で次の帯を置く前に `ctx.y` に足す。各ハンドラーが足す `d.gap` は変えない。
  - 端の id が帯の中のどこにあっても(group や row の中でも)、その帯に属するとみなす(今の `idsIn` と同じ)。ただし端から帯の端までの距離(group の内側の余白など)も経路の長さに入るので、前処理では帯の下端・上端を知らず、余白の分を引かない(安全側に広げすぎることはない。足りないときは今と同じ検査が知らせる)。
  - 対象は stack の続く 2 つの帯だけ。間に別の帯があるときは、その帯の高さが経路を伸ばすので広げない(足りなければ検査が知らせる)。
- `route: 'elbow'` は対象にしない(未決 1)。
- 広げられない(子を 7 割より細くする、`justify` が `center` / `start` の row)ときは今と同じく間隔を変えず、検査が知らせる。そのとき検査の文言に「間隔を N px 以上に」と、要る長さを書く(今は「箱の間隔を広げる」とだけ言う)。
- 出力が変わるのは、今エラーか `connect-label-covers-arrow` の警告(許容を含む)になる図だけ。検査を通る図の間隔は変わらない(要る長さ以下なら広げない)。

### D2. 枠で止まる端(`via: 'group'`)(5)

    group([box({title: '決定メモ', id: 'memo'})], {title: '書き出す先'}),
    group([box({id: 'c1', …}), box({id: 'c2', …}), box({id: 'c3', …})], {id: 'convs', title: '同じ前提で始まる'}),
    connect('memo:right', 'c1:left', {via: 'group', route: 'elbow'}),

- `ConnectOpts` に `via?: 'group' | {from?: 'group'; to?: 'group'}` を足す。
  - `'group'` は両端に、`{from: 'group'}` / `{to: 'group'}` は片方の端にだけ効く。
- 意味: 端の箱を囲む枠のある group のうち、もう一方の端を含まない**いちばん外側**の group の枠の辺に、端を移す。辺は参照の `:side`(`memo:right` なら枠の右辺)。辺の上の位置は箱の範囲(左右の辺なら箱の上端〜下端、上下の辺なら左端〜右端)で、`@t` も箱の範囲に対して読む。線は枠の外から来て枠で止まり、枠を横切らない。いちばん外側にしたのは、入れ子の group の内側の枠で止めると、外側の枠を横切るため。
- 作り: 端の矩形を「枠の辺 × 箱の範囲」に置き換えてから、今の `anchorPoint` と別 PR の `levelSides` に渡す。たとえば左右の辺なら `{x: 枠.x(右辺なら 枠.x + 枠.w), y: 箱.y, w: 0, h: 箱.h}`。経路・ラベル・`levelSides` の水平そろえ・`bend: 'auto'` の障害物の判定は、そのまま使える(障害物から、その端の group の枠の中の箱を外すのは `fromArea` / `toArea` と同じ扱い)。
- 箱を囲む group の記録: `layoutGroupAt` が、自分の中身として置いた anchor の名前ごとに、枠(`LaidOutGroup` そのもの。`id` のない group も)の一覧を `ctx.enclosing: Map<string, LaidOutGroup[]>`(内側から外側の順)に足す。row に伸ばされた後の枠の高さを読むため、`via` のある connect は必ず後回し(`ctx.deferred`)にして、すべての帯を置いた後に解決する。
- 誤り(throw。spec では link の場所つき):
  - 端に `:side` がない(`'memo'` だけ)。どの辺で止めるか決まらない。
  - 端の箱を囲む、枠のある group がない(`frame: false` だけ、または group の外)。「`via` を外すか、箱を group に入れる」。
  - 端が group の id そのもの(`'convs:left'`)。もともと枠の辺なので `via` は要らない。
  - `route` が `loop-under` / `loop-side`、または注釈(`bracket` / `callout`)。
- 検査と記録: `LaidOutConnect` の `fromId` / `toId` は箱の id のまま(グラフの検査 `graph-orphan-node` などは箱どうしの線として読む)。`fromVia` / `toVia` に、止めた枠の矩形を残す。`lib/verify.ts` の「端の箱に重なる」の判定は、その端では枠を端として扱う。
- PowerPoint: `via` の端はコネクタを図形に貼り付けない(`glueOf` を呼ばない)。貼ると PowerPoint が箱の辺の真ん中(枠の内側)へ線を引き直すため。開いたときの見た目は SVG と同じで、箱を動かしてもその端は動かない(ADR 0027 の「ラベルは箱について動かない」と同じ種類の制約として README に書く)。

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
  - `template`: CSS の `grid-template-areas` と同じ書き方。行は改行(配列でもよい。D4 の JSON と同じ形)、セルは空白で区切り、`.` は空きのセル。先頭と末尾の空行と字下げは捨てる。
  - `cells`: 名前 → 中身。中身は box、group、または row が包むもの(caption・table・stat など。row と同じく `group(x, {frame: false})` で包む。`lib/dsl/containers.ts` の `wrappable` を共有する)。row / grid / areas / connect / spacer は直接は置けない(group に入れる)。
  - オプション: `cols?: number[]`(列の幅の比。既定は等分)、`gap?: number`(列の間。既定 16)、`rowGap?: number`(行の間。既定は `gap`)、`id?: string`(全体の anchor)。
- **検査**(組み立てのとき、名前つきの誤り):
  - どの行も同じ数のセル。名前は `^[A-Za-z][A-Za-z0-9_-]*$`。
  - 1 つの名前のセルは長方形になる(CSS と同じ。L 字や離れた 2 か所は誤り)。
  - テンプレートの名前と `cells` のキーが一致する(足りない名前・余った名前の両方を挙げる)。
  - `cols` の数は列の数と同じ。列と行はそれぞれ 12 まで。
- **id**: 名前がそのまま中身の id になる(`connect('memo:right', …)` がそのまま書ける)。中身に名前と違う `id` があれば誤り(名前は 1 つにする)。同じ id があれば今の anchor の重複の誤り。TS の型は、`cells` のキーを `Declares` に入れて、`connect` の参照の型の検査(今の row と同じ仕組み)に乗せる。
- **配置**(`lib/layout-handlers.ts` に `layoutAreas`):
  - 幾何は canvas と共有する。`canvasColumns` / `canvasSpan` / `canvasRowHeights` の引数の型を、`CanvasLayout` から `Pick<CanvasLayout, 'colW' | 'rowW' | 'place'>`(`TrackGrid` と名付ける)に狭める。canvas の出力は変わらない。
  - 1 回目: 各セルを、その列の x と幅で、上端からそれぞれ置き、自然な高さを測る(`layoutGroupRow` と同じく、box は `placeBoxLike`、group は `ctx.stack`)。
  - 行の高さ: `canvasRowHeights(grid, needs, rowGap, 0)`。1 行のセルは行の高さ、複数の行にまたがるセルはその行の和(+ 間の `rowGap`)で、足りなければまたぐ行を等しく伸ばす(canvas と同じ)。
  - 2 回目: `snapshotCtx` / `restoreCtx` で取り消し、各セルを行の y に置き直す。box はセルの高さに伸ばす(row と同じ)。group は枠をセルの高さに伸ばし、16px 以上の余りは `valign` に従って中身に渡す(`GroupFill`。ADR 0014 D2 と同じ)。セルの中身が 1 回目と同じ幅なので、文字の折り返しは変わらない。
  - 出力の帯は今の型だけを使う(box は `LaidOutRow` で包む、group は `layoutGroupAt` の `LaidOutGroup` と `span`)。`emit.ts`・`emit-html.ts`・PowerPoint(D6)・`data-node`・spotlight・reveal は変えない。
  - 列は 4px の格子に乗せる(`canvasColumns` が既にそうしている)。列の幅が 96px(`CANVAS_MIN_REGION_W`)未満になれば、canvas と同じ文言で誤り。
- **ラベルの間隔**(D1 と同じ基準): 横に隣り合うセル(左のセルの最後の列 + 1 = 右のセルの最初の列、行が重なる)の間をラベル付きの connect がつなぐとき `gap` を、縦に隣り合うセルなら `rowGap` を、要る長さまで広げる。areas の間隔は 1 つなので、どれか 1 本が要れば全体が広がる(列のそろえを崩さないため)。子を 7 割より細くするなら広げない(D1 と同じ)。
- **周りの登録**: `CHILD_BANDS`(`lib/band-children.ts`)・`stackWidthOf`(セルの幅で中を歩く)・`itemIdsOf`・`layoutHandlerFor`・`measureBandHeight` に `areas` を足す。`CHILD_BANDS` は表に型がないとコンパイルが通らない作り。
- canvas() を areas の上に作り直すことはしない(未決 3)。

### D4. JSON spec の型のない部品 `board`(7)

    {"type": "board",
     "areas": ["head memo convs", "head memo convs", ". note note"],
     "cols": [4, 3, 4],
     "nodes": [
       {"id": "head", "kind": "group", "title": "担当者の頭の中", "tone": "muted",
        "children": [{"title": "提出先の手引き"}, {"title": "社内ルール"}, {"title": "環境の制約"}]},
       {"id": "memo", "title": "決定メモ", "body": "1枚に書き出す", "tone": "solid"},
       {"id": "convs", "kind": "group", "title": "同じ前提で始まる", "tone": "accent",
        "children": [{"id": "c1", "title": "今の会話"}, {"id": "c2", "title": "新しい会話"}, {"id": "c3", "title": "別の人・別のAI"}]},
       {"id": "note", "kind": "caption", "text": "前提は 1 か所にだけ書く"}],
     "links": [{"from": "head", "to": "memo"},
               {"from": "memo", "to": "c1", "via": "to", "route": "elbow"}]}

- **D3 と同じ配置の仕組みを使う**: `build` は `areas(…)` と `connect(…)` を呼ぶだけで、spec 専用の配置は持たない。TS と JSON で同じ図が同じ SVG になる。
- `nodes`(1〜24):
  - `kind: 'box'`(既定): `id`、`title`、`body`、`lines`(箇条書き、8 まで)、`tone`、`stamp`。
  - `kind: 'group'`: `id`、`title`、`tone`、`dashed`、`valign`、`children`(box の node、1〜8)、`areas` と `cols`(中を名前の領域で置く。なければ縦に積む。DSL の `group([areas(…)])` になる)。group の中の group は 1 段まで(全体で 3 段)。
  - `kind: 'caption'`: `id`、`text`、`bold`、`tone`。
  - 最上位の node の `id` は必須(テンプレートの名前)。group の中の node の `id` は、つなぐときだけ要る。
- `areas`(最上位、省略可): 文字列の配列。省略すると、最上位の node を書いた順に 1 行に並べる(`[nodes の id を空白でつないだもの]`)。group の中の `areas` も同じ。
- `links`(0〜40): `from`、`to`(node の id。group の中の box も)、`fromSide` / `toSide`(`left` / `right` / `top` / `bottom`)、`label`(40 字)、`chip`、`line`、`tone`、`arrow`、`route`(`straight` / `elbow`)、`via`(`from` / `to` / `both`。D2 の `{from: 'group'}` などに直す)。
  - **辺の省略**: `fromSide` / `toSide` がなければ、テンプレートの上のセルの位置から決める。両端の最上位のセル(group の中の box なら、その group のセル)の列の範囲が重ならず行の範囲が重なれば左右(左にある方が `right`)、行の範囲が重ならず列の範囲が重なれば上下。どちらでもない(斜め)ときは、`links[i].fromSide` の場所で「辺を書く」と返す。同じセルの中の 2 つの box も同じく返す。モデルが辺の名前を間違えやすいので、多くの場合に書かなくて済むようにする。DSL の `connect()` の省略時(中心どうし)は変えない。
- `check`(組み立ての前、場所つき): D3 のテンプレートの検査を `parts[i].areas[2]` などの場所で返す。node の id の重複(group の中も含めて。`checkAnchors` が最上位しか見ないので、`board` の `anchors` には入れ子を平らにした一覧を渡す。`PartDef.anchors` を「キーの名前」から「id を集める関数」も受けるように広げる)。`links` の端の存在。`via` の端が group の中の box であること。
- 上限は spec の今の考え(`MAX_TOTAL_TEXT` など)に合わせ、node 24・link 40 とする(`flowchart` の 40 / 60 より小さい。自由な図は手で読める量に絞る)。
- **description**(`list_diagram_parts` に出る): 「A free layout: boxes and framed groups placed by named areas, joined by arrows. Use it when the figure is a few blocks and the arrows between them, and no typed part names that shape (a memo that feeds several conversations, a trace across stages, layers with what slips through). Prefer a typed part when one fits: a comparison is compare or versus, a process is flowchart or steps.」型のある部品を優先する一文を入れ、`board` が新しい偏りにならないようにする。
- `example` は上の s04 の形を小さくしたもの。
- MCP: プラグインの `list_diagram_parts` は `partCatalog()` を返すので、core を取り込めば `board` が出る(ADR 0057 と同じ)。デッキの図も spec なので、deck.json でも書ける。プラグインの取り込みと、ChatGPT のツールの更新(ウィジェットのキャッシュ。プラグインの手順)は別の PR。

### D5. 作る順と PR

1. **PR 1(D1)**: ラベルの間隔。いちばん小さく、ほかに依存しない。`labelRoom` の基準は D3 と D4 も使う。
2. **PR 2(D3)**: `areas`。`canvas.ts` の幾何の型を狭める変更を含む。`references/freeform.md`(別 PR で足す)に節を足す。
3. **PR 3(D2)**: `via: 'group'`。`layout-connect.ts` を触るので、`levelSides` の入った別 PR の後。PR 2 とは触るファイルがほぼ別で、並行して進められる。
4. **PR 4(D4)**: `board`。PR 2 と PR 3 の後。続けて、プラグインのリポジトリで core を取り込む PR。

4 つの PR は、それぞれ Opus のレビューを受けてから main に入れる。PR 2 の後に、nov27 の 8 枚を `areas` で書き直して、`span` / `col` と `gap: 56` がいくつ消えるかを数え、PR 2 の説明に書く。

### D6. PowerPoint(ADR 0054)

- `areas` は今の帯の型(包んだ `row`、`group` と `span`)だけを出すので、PowerPoint の書き出しは変えない。group の枠と中身は今どおり 1 つのグループになる。`areas` 全体はグループにしない(row や grid も全体ではまとめていない)。
- `via` の端は貼り付けない(D2)。
- `board` は spec から DSL を組み立てるだけなので、`pptx-deck` と `svg-diagram/pptx/deck/edge` でもそのまま描ける。

## 検討したほかの案

1. **canvas の `grid` 帯に名前のテンプレートを足す**: 幾何(列の比、またぐ行、行の高さ)は同じだが、`GridBand.children` は箱だけで、`layoutCanvasGrid` は group を置けない。`CanvasLayout` は型のあるキャンバスのための項目(`worded`・`floor`・`empty`・`requireAll`・`aspect`・タグの下の余白)を持ち、`canvas-region-empty` などの検査がそれを読む。group を入れると、それらの検査と HTML 出力(`emit-html.ts` が grid の子を箱として描く)の両方に手が入る。幾何の関数だけを共有し、帯は分けた。
2. **`row({cols})` を広げる(行をまたぐ `rowSpan`)**: row は 1 行ずつの帯で、行をまたぐ子を置くには前後の行を知る必要がある。名前の領域の方が、行の数と列の数を 1 か所で見て書ける。
3. **`gap: 'auto'`(依頼の案)**: 横の row は既に既定で広げているので、`'auto'` を足すと「書かなくても広がる」と「書けば広がる」が混ざる。既定で広げ、その範囲を縦と空いた列に広げた(D1)。広げてほしくない図のための `gap: {fixed: true}` のような逃げ道は、要る例が出るまで作らない。
4. **`via` を参照の書き方に入れる(`'convs>c1:left'`、`'c1:left^'`)**: JSON の `from` / `to` が文字列のまま書けるが、記号の意味が読んで分からない。今の `'id:side@t'` の文法も複雑になる。オプションにした。
5. **`via` で、いちばん内側の group で止める**: 入れ子の group で外側の枠を横切る。外側にした(D2)。止める group を id で選ぶ書き方(`via: {to: 'convs'}`)は未決 2。
6. **spec の `board` を、row / group / connect をそのまま JSON にしたもの(`{type: 'row', children: [...]}` の木)にする**: DSL と 1 対 1 で作りやすいが、行をまたぐそろえは `span` / `col` の足し算に戻り、モデルが書き間違えやすい(この ADR の 6 の理由そのもの)。配置は名前の領域だけにした。
7. **`board` に node の座標(x / y)を書かせる**: 重なりや文字のはみ出しを書き手が防ぐことになり、このツールの「座標を書かない」作りに反する(`lib/dsl.ts` の冒頭)。

## 未決

1. `route: 'elbow'` のラベルの間隔。ラベルは真ん中の脚に乗り、脚の長さは間隔ではなく箱の位置の差で決まる。今は検査に任せる。
2. `via` で止める group を id で選ぶ(`via: {to: 'convs'}`)。いちばん外側でない枠で止めたい例が出たら足す。
3. `canvas()` を `areas` の上に作り直すか(テンプレートを `areas` の文字列で書く)。出力を 1 byte も変えずにできるかを確かめてから決める。
4. `areas` の列の幅を中身から決める(ADR 0061 の `width: "auto"` のように)。今は比だけ。
5. `areas` の行の比と高さ(`rows`、`h`)。今は中身の高さだけ。
6. `board` の上限(node 24・link 40)が足りるか。nov27 の 8 枚はどれも node 12 以下・link 6 以下。
7. `board` の links に `branch()`(1 つから複数へ)に当たる書き方を入れるか。今は link を並べる。

## テスト

- **D1**(`test/connect-label-gap.test.ts`):
  - 隣どうしの row、`cols` の row で列を 1 つ空けたもの、縦の 2 つの帯、group の中の縦の 2 つの帯のそれぞれで、chip あり・なし、短い・長いラベルの connect を描き、`connect-label-covers-arrow` と「端の箱に重なる」のどちらも出ないこと。
  - `labelRoom` の値で、`hidesArrow` が成り立たないこと、`verify.ts` の重なりが出ないことを、同じ関数で突き合わせる(基準のずれを防ぐ)。
  - 広げられない row(子が 7 割より細くなる)では間隔が変わらず、文言に要る長さが出ること。
  - ラベルのない図と、今の基準で検査を通る図の SVG が変わらないこと(`examples/` の golden)。
- **D2**(`test/connect-via-group.test.ts`):
  - 端が枠の辺の上で、y が箱の範囲の中、線が枠を横切らないこと。row で伸ばされた枠(`layoutGroupRow` の後)の辺に乗ること。
  - 入れ子の group でいちばん外側の枠に止まること。両端が同じ group の中のときは、その group では止まらないこと。
  - 誤り 4 種の文言。`levelSides` と合わせて水平になること。
  - PowerPoint: `via` の端に `stCxn` / `endCxn` がないこと、もう一方の端は今どおり貼られること。
- **D3**(`test/areas.test.ts`):
  - テンプレートの解析(空行・字下げ・配列、`.`、長方形でない名前、行のセルの数の違い、名前とキーの過不足、`cols` の数)。
  - 列がそろうこと: 違う行の同じ列のセルの x と幅が同じ。行をまたぐセルの高さが行の和。group の枠がセルの高さに伸び、`valign` が効くこと。
  - 名前が id になり、`connect('memo:right', …)` が解決すること。名前と違う `id` が誤りになること。
  - canvas の例の SVG が変わらないこと(幾何の型を狭めただけ)。
  - PowerPoint: `areas` の中の group が `span` で 1 つのグループになること(`test/pptx` の今の検査に例を足す)。
  - s04・s33 を `areas` で書いた例を `examples/` に足し、`build`(lint --strict)を警告なしで通ること。
- **D4**(`test/spec-board.test.ts`):
  - `partCatalog()` の全例のテスト(ADR 0057 の全例を描くテスト)に `board` が入り、通ること。
  - 場所つきの誤り: `parts[0].areas[1]`(長方形でない)、`parts[0].nodes[2].id`(重複、group の中も)、`parts[0].links[0].to`(ない id)、`parts[0].links[1].fromSide`(斜めで辺がない)、`parts[0].links[2].via`(group の中でない)。
  - 辺の省略: 左右・上下・group の中の box の場合に、DSL で辺を書いたものと同じ SVG になること。
  - 同じ図を DSL(`areas` + `connect`)と spec(`board`)で書き、SVG がバイト単位で同じこと。
  - デッキ(`validateDeck`)の図に `board` を書けること。
