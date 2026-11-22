# ADR 0077: 吹き出しのオートシェイプ — `balloon()`(Office の `wedge*Callout` / `cloudCallout` に当たる箱の部品)と、`speechBubble()` と分け合う 1 つの輪郭の生成

- 状態: 承認(Accepted。2026-11-22。**ADR 0078 が一部変更**: `balloon()` の既定は `place: 'overlay'`(図の上に浮かべる)。この ADR の D2 の箱(行・格子の子)は `place: 'flow'` を書く。0078 の「他の ADR への変更」M1〜M9、M17〜M19)。レビュー 3 回で収束。Q1・Q3・Q6・Q7・Q8・Q10・Q14 は決める人がすべて推奨どおりに決定。下の「決定済み」。**実装は U1 から始めてよい**。設計と小さなスパイクで、`lib/` は変えていない)
- 日付: 2026-11-22
- 基点: `main`(PR #436 まで)
- 関連: ADR 0074(`comic()` / `speechBubble()`。D2 のしっぽ。実装は PR #436 = U1)、ADR 0076(PR #434。マンガの拡張。幾何の地図の `tails` と層の順)、ADR 0069(freeform / `board`)、ADR 0012(id のスコープ)、ADR 0034(`data-node`)、ADR 0050(組み合わせられる帯)、ADR 0007(純粋な核)、ADR 0071(JSON Schema)
- 範囲外: PPTX への書き出しの実装(D7 は材料だけ)。縦書き。吹き出しの自動配置。`think` / `shout` の形を雲・ぎざぎざにすること(ADR 0074 D2 のまま。後の ADR)。ぎざぎざの吹き出し(D3。予約するだけ)
- 例の文はすべてこの ADR のための中立な作り話(「ここが変更点」「要確認」)

## 背景

決める人の依頼: 「吹き出しのオートシェイプを追加してほしい。office にもあるし」。Office(PowerPoint)の「図形」には、四角形・角丸四角形・楕円・雲の吹き出し、線の吹き出しがあり、しっぽの先は黄色いハンドルで動かせる。svg-diagram では、箱に文字を入れてどこかを指す図が毎回 `box` + `callout()` の組み合わせになる。

### コードで確かめたこと

| 部品 | 場所 | この ADR との関係 |
|---|---|---|
| `callout()` | `lib/layout-connect.ts` の `resolveAnnotation`(`ConnectBand.annot`)、`examples/bracket-callout.ts` | **引き出し線 + 角丸の札**のコネクタ。目標の縁から、辺の法線に沿って 4px(`ANNOT_GAP`)手前で止まる 28px(`CALLOUT_LEN`)の線の先に札を置く。輪郭は 1 つにならず、箱ではない |
| 接続の参照 | `resolveRef` / `anchorPoint`(`id.side@at`)、`scopes`(ADR 0012) | 目標の指し方をそのまま使う(D2) |
| 箱 | `lib/dsl/text-bands.ts` の `box()` と `BOX_KEYS`、`lib/types/text-bands.ts` の `BoxChrome`、`lib/emit-boxes.ts` の `renderBoxRect`(`<rect rx="8">`、破線 `6,4`、`frameGeometry` で 4px に揃える) | 吹き出しは箱の一種として作る(D2) |
| 型の検査 | `connect` / `callout` は `Ok<T>` を受け `Refers<T>` を返す(綴りの誤りがコンパイルで落ちる) | `balloon()` も同じ型にする(D2) |
| `speechBubble()`(PR #436。#436 は `main` に入った(8b047605)。数字の一致は固定せず、U1 の基準は「`comic` の golden が変わらない」にする) | `lib/comic/balloon-path.ts` の `balloonPath(body, kind, tail?) → {d, base?}`。角丸の四角 + しっぽの**1 本の閉じた path**。冒頭に「`lib/shapes/` へ移せる」とある。`kind` は `say` / `think` / `shout` / `narration`(角丸 `min(h/2, 24)`(`think` も同じ)/ `min(h/2, 24)` / 6 / 0。さらに `min(r, w/2)`)。しっぽの幅は 16(`halfWidth` 既定 8)で、**辺の直線部が狭ければ `half = min(half, 直線部/2)`、`half < 1` ならしっぽなし**。付け根は先の位置に寄せて角の弧から離す。先が**外接矩形の内側(厳密に)または有限でない**ときはしっぽなし。辺の選びは同点で上下 | 共通の輪郭の**起点**。これを `lib/shapes/` に移して広げる(D6) |
| PPTX | `lib/pptx/bands.ts`(高さのある帯は、図形にできないとき `bandPicture` で SVG + PNG の絵にする。`row` / `grid` は図形) | 未対応の箱の扱い(D2) |

### Office の形の定義(ECMA-376 `presetShapeDefinitions.xml` で確かめた)

ECMA-376 第 5 版 Part 1(2016)の `OfficeOpenXML-DrawingMLGeometries.zip` の `presetShapeDefinitions.xml`。公開リポジトリ `cuzic/ooxml-rs` の `reference/ecma-376-drawingml-geometries/`(コミット d8741d4e)に、無変更で置いてある。

- `wedgeRectCallout` / `wedgeRoundRectCallout`: `adj1`・`adj2` は**しっぽの先の、中心からのずれ**で、幅・高さの 1/100000(`dxPos = w*adj1/100000`、`dyPos = h*adj2/100000`、先は `(hc+dxPos, vc+dyPos)`)。既定は `adj1 = -20833`、`adj2 = 62500`(角丸は `adj3 = 16667`。角の半径は `ss*adj3/100000`、`ss = min(w, h)`。上限は 50000)。付け根の辺は、`|dyPos| > |dxPos*h/w|`(`dz > 0`)なら上下、そうでなければ左右(**同点は左右**)。付け根は**固定**: 辺の 2/12〜5/12(先が中心より左・上)か 7/12〜10/12(右・下)。付け根の幅は辺の 1/4。
- `wedgeEllipseCallout`: 先の向きの媒介変数 `pang = atan2(dyPos*w, dxPos*h)` の ±660000(= ±11°)の 2 点が付け根。付け根から楕円の弧を長い側へ回って閉じる。
- `cloudCallout`: 雲の本体は 43200 × 43200 の座標に固定の 11 個の弧。しっぽは 3 つの円で、半径は `ss/12`、`ss/18`、`ss/36`。いちばん小さい円の中心が先。しっぽの最小の長さの条件は `g9 = ss*6600/21600`(0.306 ss)。
- 文字の矩形(`<rect l t r b>`): 角丸四角形は角の半径の 29.289% 内側、楕円は幅・高さの 70.7%、雲は幅の 13.8%〜79.1%・高さの 15.1%〜80.3%(約 65%。**これは Office の雲の矩形で、この ADR の雲には当てはまらない**。D3)。
- 線の吹き出し(`borderCallout1`、`accentCallout1`…)の `adj1`〜`adj4` は、線の始点 `(y1, x1)` と終点 `(y2, x2)` で、同じく高さ・幅の 1/100000。しっぽの輪郭は無く、箱 + 線。
- ギザギザ(`irregularSeal1/2`)や `star*` には、しっぽ(`adj` の先)が無い。**Office には、しっぽのあるギザギザの吹き出しが無い**。

## スパイクの結果(`spikes/balloon-autoshape/`。`lib/` は触っていない)

`balloon.ts`(共通の輪郭の原型。**PR #436 の `balloonPath` の四角・角丸の部分を土台にして**、`radius`、楕円、雲、Office の付け根を足した。純粋で import なし)、`office.ts`(`wedgeRectCallout` の `gdLst` を 1 行ずつ写した評価)、`run.ts`(SVG と数字)。四角・角丸・楕円・雲を、本体 200×80 に、8 方向(45° ごと、縁から 50px)の目標で描いた。SVG は `spikes/balloon-autoshape/out/`。数字の出どころは `measurements.txt`。

| 測ったこと | 結果 |
|---|---|
| **#436 との一致**(main の #436 のあと、`lib/comic/balloon-path.ts` に対して) | `say` / `think` / `shout`、高さ 30〜128、幅 60〜300(**辺が狭い本体を含む**)のランダムな先 6000 個で、`balloonOutline('round', {radius: balloonRadius(kind, h), halfWidth: 8})` が #436 の `balloonPath` と**パスの文字列まで同じ**(うち 1492 個は辺の直線部がしっぽの幅 16 より狭い縮退の場合)。ちがうのは、先が本体の対角線上に厳密にある場合(同点)だけで、左右の辺か上下の辺かが逆(D6 の表。2 例)。**この数は固定の主張ではない**(#436 はこのあとも直る)。U1 の基準は「#436 が入ったあと `comic` の golden が変わらない」と、同じ性質テストの再実行 |
| 縮退した入力(`run.ts`) | 有限でない先、本体の内側の先、半径 0〜500、60×30 の本体の 4 形 × 4 先 × 4 半径 = 64 通りで、出力に `NaN` / `Infinity` は **0**。最初の版は有限でない先で `LNaN 3` を出していた |
| Office の `wedgeRectCallout`(`gdLst` を写した評価)との一致 | `rect` + `office` の付け根で、ランダムな先(本体の外 3px 以上)1779 個が**同じ多角形**(4 つの角 + 付け根・先・付け根、0.1px 以内)。`adj` への丸め(1/100000)が先を動かすのは最大 0.002px。既定の `adj1 = -20833`、`adj2 = 62500` は、200×80 の先 (58.3, 90) の `officeAdj` と一致(D7 の式の確認)。**この比較は四角だけ**。角丸・楕円は、レビューが別の評価で付け根の一致を確かめたが、このスパイクの `run.ts` には入っていない(U1 で入れる) |
| 回帰(コードを自分自身と比べるだけ。**忠実さの証拠ではない**) | 8 方向 × 4 形 = 32 個がすべて `M…Z` で閉じ、同じ入力で同じ文字列。四角・角丸・楕円の付け根が輪郭の上(最大 8e-8px。四角・角丸は小数 1 桁の丸めで ≤ 0.07px)。四角・角丸の付け根は角の弧に入らない(8 方向での最小は角から半径 + 2.6px。端でのクランプは U1 の単体テスト) |
| 雲(**実際の輪郭**に対して。幅 100〜600 × 高さ 48〜120、縦横比 1:1〜6:1 の **24 通り**、各 360 方向) | **`NaN` の方向 0。内側の判定の誤り 0**(中心は内側、長軸の両端の 3px 外は外側)。1 つ目の円が実際の輪郭に重なる方向 **0**(隙間 2.00〜2.25px)。**最初の版は 200×80 だけを測り、しかも弧の半径を全体で 1 つ(周の平均)にしていたため、幅が高さの約 3 倍を超える本体で `sqrt` の中が負になり `NaN` の多角形ができた**(例: 300×120 の本体の左 111px の先が `inside` と誤判定されて、しっぽが描かれない)。直し方: 点を楕円の**弧の長さで等間隔**に置き、弧の半径を**弦ごとに** `R_i = 0.62·弦_i`(≥ 弦/2 なので弧がいつも存在する)にした。1:1〜6:1 を超える 7 通り(最大 12.5:1)でも `NaN` 0、重なり 0 |
| 雲の最小のしっぽの長さ | 3 つの円が(2px 空けて)重ならない最短 `minLength` は、200×80 で **30.4〜42.7px**。下限は閉じた式 `2·r1 + 2·r2 + r3 + 6 = 0.306 ss + 6`(Office 自身の限界 `g9` は 24.4px で、これより長く要る)。**24 通りの全体では 0.36〜1.02 × `ss`**(先が輪郭にほぼ接する方向では、1 つ目の円を輪郭から離すために外へ押すので長くなる)。`minLength` ちょうどのしっぽで、円どうしの隙間は最小 2.00px。最初の版の「`ss/4` = 20px」は誤り(長さ 23.7px で 2・3 つ目の円が -4.8px 重なる)。したがって検査は固定の式ではなく、生成が返す `minLength` を使う(D3) |
| 最小の本体(`ss = 48`)の雲 | 円の半径が 4.0 / 2.7 / 1.3px。点にしか見えない(D3 で本体の最小を決める) |

**目標が近いとき**(本体の右の縁から目標まで。目標は縁の外):

| 縁からの距離 | 四角・角丸のしっぽの長さ(頂角) | 楕円(頂角) | 雲の最短(円の列) |
|---|---|---|---|
| 0px | 0.0(三角が潰れる。180°) | 1.8(153°) | 30.4 以上が要る |
| 4px | 4.0(136°) | 5.8(105°) | 同上 |
| 8px | 8.0(103°) | 9.8(76°) | 同上 |
| 16px | 16.0(64°) | 17.8(46°) | 同上 |

頂角(しっぽの先の角度)で見ると、付け根の幅 16(漫画)と 28(箱の上辺)で、長さ 4 → 127° / 148°、8 → 90° / 121°、14 → 59° / 90°、30 → 30° / 50°、80 → 11° / 20°、160 → 6° / 10°、300 → 3° / 5°。つまり「ちょん」と見える短さと「針」に見える長さは、**付け根の幅に対する割合**で決まる(D3)。

**角の近く**(角丸。先が右上の角の斜め上): 付け根は辺の端から `max(半径, 4) + 半幅` 離れて置かれ、先と付け根の三角が**傾く**(先が付け根の真上でなくなる)。細い鋭角の三角になるが、目標へ向かう向きは保たれる。Office の固定の付け根との見た目の比較は `out/rect-follow-vs-office.svg`(同じ先で両方の付け根を描いた。1 枚の図の判断で、数字では測っていない)。先が角丸の**角の切り欠き**(外接矩形の中だが輪郭の外)にあるときは、#436 と同じく `inside`(真)として扱う(しっぽなし。切り欠きは半径 8 で輪郭から最大 3.3px なので、どのみち短すぎるしっぽ)。

**しっぽの外接矩形(検査の幾何。D8)**: 既存の `pathSegments` が使う矩形は線分の外接矩形 + 3px で、斜めの線ではほとんどが空き。しっぽの三角形(角丸、8 方向、先 50px)では、三角形が外接矩形に占める割合は **約 40%**。先が右へ 40px・下へ 60px の傾いた例では **18%**。この傾いた例の外接矩形の中の、三角形に触れない 30×20 の隣の箱を、外接矩形では「重なり」、三角形と矩形の分離軸の判定(SAT)では「重ならない」と判定する。

## 決定

### D1. 部品の名前と `callout()` との違い — `balloon()`

新しい部品を **`balloon()`**(吹き出し)とする。

- **`callout()` は変えない。** `callout()` は**コネクタ**(目標から離した場所に札を置く引き出し線)で、輪郭は 1 つにならず、札は目標から固定の距離に自動で置かれる。`balloon()` は**箱**(行・列・grid に並び、`id` を持ち、大きさが文字で決まる)で、しっぽが輪郭の一部になる。使い分け: 注記を**目標の近くに自動で**添えるなら `callout()`、**自分で置いた**吹き出しがどこかを指すなら `balloon()`。
- 名前: `bubble` は泡グラフの公開名(`lib/dsl-pure.ts`)にあり、ADR 0074 の DSL も `speechBubble()` になった。`callout` は既にある。`balloon` は「吹き出し」の英語として自然で、衝突しない(`test/fixtures/dsl-exports.json` に足す)。
- `comic()` の中の `speechBubble()` は、話し手・コマ・読む順・穴と一緒に決まる ADR 0074 の部品のまま。`balloon()` は**一般の図**で使う。両者は輪郭の生成だけを分け合う(D6)。

### D2. 表現(箱 + `balloon` の欄)、書き方、データの流れ

**決定: `balloon()` は新しい帯ではなく、`BoxBand` に任意の欄 `balloon` を足した箱とする。** `balloon({...})` は `box({..., balloon: {...}})` の書き方を平らにした DSL(同じ帯を返す)。

- 理由: 箱の置き方(`flex` / `width` / `col` / `span`、`reveal` / `until`)、文字の折り返し、行・列・grid・areas・`board`(ADR 0069 D4 の `kind: 'box'`)の子になる経路、`Declares` / `HandleOf` が、**そのまま**効く。新しい帯の種類にすると、`Band` の union、`row()` の子の型、`band-ids.ts`、`band-children.ts`、レイアウト・描画・検査・PPTX の帯ごとの表が、すべて 1 つずつ要る。
- 代わりに払う費用: 箱の欄を知らない読み手が、しっぽの無い角丸の箱として描く危険。**知っておくべき場所**(U2 で全部に手を入れ、テストで固定する):
  - `lib/emit-boxes.ts` の `renderBoxRect`(`<rect rx="8">` を描く所): `balloon` の欄があれば、1 本の `<path>`(D3)を描く。
  - `lib/pptx/bands.ts`: **決定: 吹き出しの箱だけを絵(SVG + PNG)にして、まわりの `row` / `grid` / `group` / areas / `board` はそのまま図形で書く。** `bandPicture` は高さのある帯(`LaidOutBand & {h}`)しか受けず、`LaidOutGrid` は `h` を持たない(`row` / `group` は図形)ので、帯ごと絵にはできない。かわりに、**配置済みの箱の矩形**(本体 ∪ しっぽの外接矩形)から絵を作る小さな関数(`rectPicture`。`bandPicture` と同じ SVG → PNG の道。U2 で足す)を使い、行・格子の子として図形のあいだに絵を置く。`imageBand` と同じく、箱の id を持つ**見えない図形**を同じ位置に置き、ネイティブのコネクタが接続できる(のり付けできる)ようにする。文字は絵になる(PowerPoint では編集できない)。ネイティブの `wedge*` で書く(編集できる)のは、D7 のあとの ADR。
  - `board`(ADR 0069 D4): `kind: 'box'` の節が `balloon` を持てる。`kind: 'group'` / `'caption'` は持てない(エラー)。
  - 検査の表(`lib/verify-handlers.ts` の `rects`): 本体の矩形は今までの箱と同じ。しっぽの検査は専用の読み手(D8)。
- **データの流れ**(コネクタと同じ段で、配置のあと):
  1. 配置が、本体の矩形(`anchors`)を決める。しっぽの大きさは含めない。
  2. `lib/layout-connect.ts` の隣の関数 `resolveBalloons`(新設)が、配置済みの木を `childrenOf` でたどり(`collectConnects` と同じ歩き方)、`balloon` の欄のある箱を見つけ、`resolveRef`(`scopes` つき。ADR 0012)で `to` を矩形に直し、共通の輪郭の生成(D6)を呼んで、`LaidOutBox.balloonTail`(`Balloon` の `d`・`base`・`tip`・`dots` など)に入れる。暗黙の `ConnectBand` は作らない。
  3. 描画と検査は `balloonTail` を読むだけ。
  - `to` の参照は、本体どうしの位置が決まったあとに解くので、循環しない(吹き出しが吹き出しを指してもよい。しっぽは本体を動かさない)。
- **`balloon` の欄は `balloon()` だけが設定する**(`BOX_KEYS` と公開の `box()` の欄に**入れない**。`box({balloon: …})` は未知の欄のエラー)。`box()` 経由だと `Refers<T>` の型の検査を迂回でき、JSON の `box` の部品にも入ってしまうため。欄は帯の内部の項目で、`balloon()` が `box()` の欄を検査したうえで付ける。
- **綴りの検査(型)**: `connect` / `callout` と同じ `Refers<T>` を返す。署名は `balloon<const Id extends string = never, const T extends string = never>(opts: BalloonInput<Id, T>): BoxBand & Declares<Id> & HandleOf<Id> & Refers<T>`。`to` に未宣言の id を書くとコンパイルで落ちる(U2 のテストに `@ts-expect-error` で入れる)。

```ts
balloon({
  place: 'flow',          // ADR 0078: 既定は 'overlay'(図の上に浮かべる)。この ADR の D2 の箱(行・格子の子)は 'flow'
  title: 'ここが変更点',
  id: 'note1',
  to: 'step2.top',        // 目標。箱の id と side / at(connect と同じ文字列)
  // tip: [dx, dy],       // または、本体の中心からのずれ(px)で
  shape: 'round',         // 'rect' | 'round' | 'ellipse' | 'cloud'。既定 'round'(予約: 'spiky'。D3)
  base: 'follow',         // 'follow' | 'office'。しっぽの付け根の置き方(D3)。既定 'follow'
  dashed: true,           // ささやき(box と同じ欄。輪郭(本体 + しっぽ)が破線。雲のしっぽの円は破線にしない)
  tone: 'changed',        // box と同じ EMPHASIS_TONES
  gap: 4,                 // 目標の縁の手前で止める距離。既定 4
  radius: 8,              // 'round' の角の半径。既定 8(box と同じ rx)
})
```

**`box()` との対応(欠けは作らず、ない欄は明記する)**
- 受ける欄: `id`、`tone`(`plain` / `accent` / `new` / `changed` / `removed` / `muted` / `danger` / `solid` / `solid-danger`。`box` と同じ表)、`dashed`(`box` と同じ欄。破線は `6,4`)、`align`、`padX` / `padY`、`flex` / `width` / `col` / `span`(行・grid での置き方)、`reveal` / `until`、`size`、`title` / `body` / `lines` / `note`、`titleTone` / `titleMono` / `bodyTone` / `bodyMono` / `noteTone`。
- 受けない欄(`box()` と同じ文言のエラー。`balloon(): '…' is not supported — …`)。`radius` / `halfWidth` / `gap` が有限でない数(`NaN`、`±Infinity`)のときも、`box()` が大きさの欄でするのと同じに、`balloon(): 'radius' must be a finite number` のエラーで止める(生成器は有限な入力だけを受ける。D6): `tag` / `tagTone` / `tagAt`(上の辺の札はしっぽと同じ辺で重なる)、`stamp`(右下の札は、楕円・雲の文字の矩形の外にはみ出す)、`icon` / `iconTone` / `iconAt` / `iconSize`、`step` / `stepWord`、`frame`。要望が出たら、輪郭の形ごとの置き場を決めて足す。
- 追加の欄: `balloon` の中身(`shape`、`to` / `tip`、`base`、`gap`、`radius`)。`to` と `tip` の両方は書けない。どちらも無い箱は、しっぽの無い箱(普通の箱と同じに描く)。
- エラー: `to` の id が無い → `balloon(): unknown anchor id "x" (give the box an id)`(`callout()` と同じ)。`to` が**自分自身** → `balloon(): cannot point at itself`。`to` の目標と吹き出しが**重なる** → 下の D3(目標の決め方)。

### D3. 形(Office の対応表)と、しっぽの幾何

#### 形と Office のプリセット

| `shape` | 輪郭 | Office のプリセット | 文字の矩形(本体に対する割合) | しっぽ |
|---|---|---|---|---|
| `rect` | 角の無い四角 | `wedgeRectCallout` | 100% | 三角 |
| `round`(既定) | 角丸四角(`radius` 既定 8。`box` の `rx` と同じ) | `wedgeRoundRectCallout`(`adj3 = radius / min(w,h) * 100000`。**上限 50000**) | 各辺から半径の 29.289% 内側(さらに `padX` / `padY`) | 三角 |
| `ellipse` | 楕円 | `wedgeEllipseCallout` | 幅・高さの 70.7% | 楕円に付く三角(付け根は媒介変数 ±11°) |
| `cloud` | 雲(弧の連なり) | `cloudCallout`(**近いが同じではない**。下) | **この雲の輪郭から求める**(下。Office の 65% ではない) | 3 つの小さな円(半径 `ss/12`、`ss/18`、`ss/36`) |

- **雲は Office に似せるだけで、同じ形ではない。** Office の雲の本体は 43200 角の座標に固定の 11 個の弧。この ADR の雲は、楕円に沿って**弧の長さで等間隔**に置いた点(個数は周の長さ ÷ 46px、8 個以上)を、**弦ごとの半径** `0.62·弦` の弧でつないだもの(弧の数と膨らみが違う。細長い本体でも弧がいつも存在する)。縦横比が 6:1 を超えても `NaN` は出ない(12.5:1 まで確認)が、そこまで細い雲は雲らしくない(見た目は決める人の判断。検査は足さない)。しっぽの円の半径と文字の矩形の割合は Office の式と同じ。PPTX のネイティブの雲(D7)に書き出すと、本体の形は Office のものに変わる。
- **ぎざぎざ(`spiky`)は v1 に入れない。** Office に、しっぽのあるぎざぎざの形が無く(上)、スパイクでも試していない(刺の数・深さ、しっぽにする刺の選び方、内側の判定、本体の大きさの係数、PPTX の経路が未決)。型・Schema の列挙には**入れず**、「予約された値」としてここに書くだけにする(あとで値を足しても、後方互換を壊さない)。`speechBubble()` の `shout`(四角に近い太い枠)は ADR 0074 のまま。
- **線の吹き出し(`borderCallout*`、`accentCallout*`、`accentBorderCallout*`)は `balloon()` にしない。** 「箱 + 線」で、しっぽが輪郭の一部ではない。`callout()`(線 + 札)が近いが、線が箱の側面から出る Office の見た目とは札の位置が逆。必要なら `box` + `connect` の線で描ける。
- 本体の大きさ: `box` の文字の規則(折り返し・縮め)で出した文字の矩形(余白 `padX` / `padY` を含む)を、上の「文字の矩形の割合」で割る。楕円は各方向 1.41 倍になる(ADR 0074 が楕円を既定にしなかった理由と同じ)。**雲は割合を固定しない**: スパイクで、この ADR の雲の輪郭に入る最大の同じ縦横比の矩形(四隅と辺の中点が実際の輪郭の内側)を測ると、24 通りの大きさ(幅 100〜600 × 高さ 48〜120)で **幅・高さの 49%〜70%**(多くは 56〜65%。弧の位相で変わる。Office の雲の矩形は 65%)だった。Office の 65% を使うと、隅の文字が弧の外へ出る大きさがある。したがって U1 で `cloudTextRect(body)`(二分法で最大の矩形を求める純粋な関数)を足し、本体の大きさは「文字の矩形(余白込み)を 0.58 で割った大きさから始め、`cloudTextRect` に収まるまで 5% ずつ大きくする(最大 8 回)」で決める。収まる矩形の四隅が輪郭の内側にあることを U1 のテストにする。本体は `frameGeometry` で 4px に揃える(揃えないと座標格子の検査が出る)。**雲の本体の最小は 72×48**(それより小さいと円の半径が 1.3px になり点に見える。スパイク)。暫定値(U1 で見た目を決める人に見せる)。

#### しっぽ(四角・角丸)

| 項目 | 規則 |
|---|---|
| 付け根の辺 | Office と同じ。本体の中心から先へのずれ `(dx, dy)` で、`\|dy\|·w > \|dx\|·h` なら上下、そうでなければ左右(**同点は左右**。#436 は同点で上下。D6 の表) |
| 付け根の位置と幅(`base: 'follow'`、既定) | 先の真下 / 真横に付け根の中心を置く。半幅 `half` は、指定がなければ `clamp(辺の長さ/4, 12, 28) / 2`。付け根の端は、角の弧(と最低 4px)から離す: `max(radius, 4) + half` が両端のクランプ。`speechBubble()` は `half = 8` を渡す(#436 と同じ) |
| 付け根の位置(`base: 'office'`) | Office の固定: 辺の 2/12〜5/12 または 7/12〜10/12(`half` は辺の 1/8)。Office の多角形と一致(スパイク) |
| 付け根(楕円) | 先の向きの媒介変数 ±11°(Office と同じ。付け根の幅は本体の大きさで決まる) |
| 形 | 直線の三角形(付け根 2 点と先)。本体としっぽは**1 本の閉じた `<path>`**(`M…Z`)。`stroke-linejoin: round`(鋭い先がミター結合で 4〜5px はみ出し、`gap` を食うのを防ぐ) |
| 曲線のしっぽ | 第 2 版(Q4) |

#### しっぽ(雲)

雲の本体は 1 本の閉じた `<path>`、しっぽの 3 つの円は**別の `<circle>`**。**円はいつも実線**(`dashed: true` でも破線にしない。半径 1.3px の円の破線は意味がなく、本体の破線だけで「ささやき」は伝わる)。円の列は、**実際の輪郭**(弧)から作る: 中心から先へ引いた線が輪郭を出る点を起点にし、1 つ目の円は輪郭から 2px 空くまで外へ押し、3 つ目の円の中心が先、2 つ目はその中間(円どうし 2px 以上空ける)。この方法で、24 通りの大きさ(縦横比 1:1〜6:1)× 360 方向のすべてで 1 つ目の円が輪郭に重ならない(スパイク)。生成が `minLength`(円が重ならない最短。0.36〜1.02 × `ss`)を返し、検査はそれを使う。

#### 縮退した入力(共有の生成の規則。`radius` を指定した場合も同じ)

入力は有限な数(本体は `w, h > 0`)。次は**どの形でも** `NaN` を出さず、規則どおりに描く:

1. **半径**: `radius = min(radius, w/2, h/2)`。
2. **先が有限でない**: しっぽを描かない(本体だけの輪郭)。
3. **先が本体の内側**: しっぽを描かない(`inside: true`)。判定は四角・角丸は**外接矩形の厳密な内側**(#436 と同じ。角の切り欠きも内側)、楕円・雲は輪郭の内側(雲は実際の輪郭の多角形)。`speechBubble()` が渡す先は、本体の外にある(`tailOf` が頭の円の手前で止める)ので、この規則は `comic` の出力を変えない。
4. **狭い辺**: しっぽの付け根が置ける直線部 `straight = 辺の長さ − 2·max(radius, 4)` より、付け根の半幅 `half` が大きいとき、`half = min(half, straight/2)`(狭くする)。`half < 1` ならしっぽを描かない。付け根の中心は `[端 + max(radius,4) + half, 端 + 辺 − max(radius,4) − half]` に収める(上下限を入れ替えない)。`base: 'office'` も同じ(収まらない縮退では Office の多角形と一致しない)。

#### 目標の決め方(`to` と `gap`)

- `to` が**辺つき**(`step2.top`): 目標の点 = 矩形のその辺の `anchorPoint`(`@at` の位置)。**先 = 目標の点 + 外向きの法線 × `gap`**(`callout()` の `ANNOT_GAP` と同じ向きと既定の 4px)。
- `to` が**辺なし**(`step2`): 目標の矩形のうち、**吹き出しの中心のほうを向く辺**を選ぶ(目標の中心から吹き出しの中心へのずれに、Office と同じ `dz` の規則を当てる)。辺の上の位置は、吹き出しの中心を辺に落とした点(辺の内側に収める)。吹き出しの中心が目標の矩形の中にあるときはエラー(`balloon(): the balloon lies inside its target "step2" — give a side, or move it`)。**中心は外だが本体が目標と一部重なる**ときは、しっぽは描くが、`balloon-tail-through-target` の文言を「**overlaps its target**」(吹き出しが目標に重なっている。配置を直す)にして報告する(しっぽが目標を通り抜ける場合と区別する)。
- `tip: [dx, dy]`: 先 = 本体の中心 + `[dx, dy]` そのもの(`gap` は効かない。吹き出しが動いても向きが保たれる)。
- 先が内側(`inside`。上の縮退の規則 3): **しっぽを描かず**、`balloon-target-inside`(問題。文言は「the target lies within the body's bounding box」: 角の切り欠きも内側)。
- **しっぽが自分の目標を通り抜ける**(辺つきの `to` で、吹き出しが目標の反対側にあるとき。例: 吹き出しが目標の下にあるのに `to: 'step2.top'`): 描くが、`balloon-tail-through-target`(問題)で報告する(目標を検査から除外しない)。

#### しっぽの長さの限度(暫定。U3 で例の図で決める)

頂角 `apex = 2·atan(half / length)` で決める(付け根の幅に依らない。スパイクの表):
- **短すぎ**(`balloon-tail-short`、助言): 頂角が **90° を超える**(`length < half`。付け根 28px なら 14px 未満、漫画の 16px なら 8px 未満)。スパイクでは、長さ 8px(付け根 16)で 90°、4px で 127° の「ちょん」。雲は生成が返す `minLength`(`0.306·ss + 6` 以上。200×80 で 30.4〜42.7px、縦横比 1:1〜6:1 の全体で 0.36〜1.02 × `ss`)未満。
- **長すぎ**(`balloon-tail-long`、助言): 頂角が **12° 未満**(`length > half / tan 6°`。付け根 28 なら約 133px)。「針」に見える。
- 12°・90° は、スパイクの表から選んだ**暫定値**で、見た目の根拠は 1 枚の図の判断にすぎない。U3 で例の図を測って決める。

### D4. 文字の折り返し、テーマ、アクセシビリティ

- **文字は `box` の規則そのまま**(`wrapStyledAtoms`、`MIN_FONT_SIZE` までの縮め)。ADR 0074 D2 の `comic` / `chat` 専用の幅の規則(全角を 1 em、英字を整数 px に切り上げ)は**持ち込まない**: あれは「値を入れても配置が動かない」ための規則で、`balloon()` には要らず、持ち込むと既存の図の箱の幅が変わる。
- **テーマ**: 塗りと枠は `resolveBoxStyle`(PALETTE のトークン)で `box` と同じ。しっぽも同じ塗りと枠(1 本の path)。色を直接書く欄は無い。暗い配色の golden を 1 枚足す(U5)。
- **アクセシビリティ**: 本体の `<g>` に `data-node`(ADR 0034)。**`<title>` は付けない**(文字は生きた `<text>`で、`<title>` に同じ文字を入れると読み上げが 2 回になり、箱にない吹き出しだけに説明が出る)。目標との関係は `data-balloon-to="目標の id"` に出す(機械が読める。見た目に影響しない)。`aria-describedby` などで目標に関係を張ることは、v1 ではしない(目標側の要素を書き換える必要があり、箱の出力を変えるため)。`role` は付けない。

### D5. レイアウトでの位置づけ

- 本体は箱で、行・列・grid・areas・freeform・`board` の `kind: 'box'` に、箱と同じ規則で置かれる。レイアウトが決めるのは本体の矩形(`frameGeometry` で 4px)だけで、しっぽは含まない。本体は `anchors` に登録され、ほかのコネクタ・`callout()` の目標にもなれる。
- **空きは確保しない**: 目標は配置のあとでしか分からず、確保すると配置が目標に引かれて循環しうる。しっぽが他の箱を通るときは検査で知らせる(D8)。本体と他の箱の重なりは既存の検査がそのまま見る。目標のそばに置きたいときは、行・列の `gap` で調整する。
- **図の範囲**: **図(キャンバス)はしっぽのために広げない。** 配置のあとにキャンバスを広げると、すべての帯の座標が動く。しっぽ(三角形の頂点、雲の円)が図の外に出るときは、SAT の読み手が `balloon-out-of-bounds`(問題)で報告する(直すのは置き方の側)。行の高さは、楕円・雲の大きくなった本体の高さで決まる(しっぽでは決まらない)。
- **枠と `via`**: 枠(グループの枠線)は検査の矩形ではなく、しっぽが枠線を横切っても報告されない。`balloon()` に `via`(ADR 0069 D2)は無い。目標が別のグループの中にあっても、`to` はグローバルな id(`scopes` の規則)で解ける。
- **`reveal` / `until`**: しっぽは吹き出しの箱の `reveal` に従う(箱が出ればしっぽも出る)。目標が吹き出しより**あとに**現れるとき、`balloon-reveal-order`(助言)。
- **CRT・辺の経路**(ADR 0070 / 0073): しっぽは層の順や辺の経路探索には見えない(辺がしっぽを通りうる)。`balloon-tail-edge`(助言)が唯一の見張り。v1 はこれで足りるとする。

### D6. 共通の輪郭の生成(`lib/shapes/balloon.ts`)

PR #436 の `lib/comic/balloon-path.ts`(`balloonPath(body, kind, tail?) → {d, base?}`)を、**`lib/shapes/balloon.ts` に移して広げる**。新しい競合する生成器は作らない。

```ts
type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud';
interface BalloonOpts { radius?: number; halfWidth?: number; base?: 'follow' | 'office' }
balloonOutline(shape: BalloonShape, body: Rect, tip?: Pt, opts?: BalloonOpts): Balloon
// Balloon = {d, base?, tip?, side?, dots?, length, minLength?, apex, inside}
officeAdj(body: Rect, tip: Pt): [number, number]   // D7
```

名前は `balloonOutline`(DSL の `balloon` と紛れないように)。**契約: 入力は有限な数(本体は `w, h > 0`)で、縮退した入力(上の D3 の規則)でも `NaN` / `Infinity` を出さない。** スパイクの `balloon.ts` が原型で、四角・角丸の部分は #436 のコードの小数 1 桁の丸めと `H` / `V` の書き方を保ち、#436 の押された先頭と**同じパス文字列**を出す(スパイクの比較は上。固定の主張ではない)。

**`speechBubble()` 側は、薄い包みにする**(`lib/comic/balloon-path.ts` に残す): `balloonPath(body, kind, tail?)` が、`kind` から `radius`(`balloonRadius`)を決め、`balloonOutline('round', body, tip, {radius, halfWidth: tail.halfWidth ?? 8})` を呼ぶ。`narration` はしっぽ無し。したがって **`comic` の見た目は変わらない**(golden も変えない)。`think` と `shout` の形は ADR 0074 D2 のまま(破線の角丸の三角のしっぽ、太い枠の四角)で、この ADR では**写し替えない**。雲・ぎざぎざに寄せるかは、後の ADR で決める。

**二つの生成器の食い違いと、どちら側を変えるか**

| 項目 | #436(0074 U1) | 0077 のスパイク | 決定(どちらが変わるか) |
|---|---|---|---|
| 辺の選び(同点) | 上下 | 左右(Office) | **Office に合わせる**(`wedgeRect*` の `dz > 0` と同じ。D7 の書き出しと一致)。変わるのは #436 側で、先が本体の**対角線上に厳密にある**ときだけ(スパイクで 2 例が違う。ランダムな先 6000 個は一致)。ふつうの図で起こらないが、U1 のテストで固定する |
| 付け根の端と角の距離、狭い辺 | `r + half`(中心の下限)。直線部が狭ければ `half` を狭め、`half < 1` でしっぽなし | `r + 4 + half`(最初の版)→ 揃えた | **`max(r, 4) + half` と D3 の縮退の規則**(0077 側を #436 に寄せる。`r ≥ 4` の `say` / `think` / `shout` では #436 と同じ。`rect`(`r = 0`)でだけ 4px を足す) |
| 先が本体の内側 / 有限でない | 外接矩形の厳密な内側、または有限でない → しっぽなし | (最初の版は角丸の輪郭の内側。`NaN` を出した) | **#436 に合わせる**(外接矩形。D3 の規則 3)。角の切り欠きの先も「内側」 |
| `think` の半径 | `min(h/2, 24)`(`say` と同じ) | — | #436 のとおり。`balloonRadius` は `comic` に残る |
| 付け根の幅 | 16 固定(`halfWidth` の既定 8) | `clamp(辺/4, 12, 28)` | **既定は 0077 の式、`speechBubble()` は `halfWidth: 8` を明示**(0074 の規範の「16」を変えない)。#436 の `halfWidth` の欄がそのまま使える |
| 丸め | 小数 1 桁 | 2 桁 | **1 桁**(rect / round)。楕円・雲は 2 桁(楕円・雲は #436 に無い) |
| 角丸の半径 | `kind` ごと(24 / 28 / 6 / 0) | 8(`box` と同じ) | `radius` の欄で両立。`balloon()` の既定は 8 |
| 付け根が先の下に寄るか | 寄る(`t` = 先の座標をクランプ) | 同じ(`follow`) | 同じ。ADR 0074 D2 の文章は「その線が縁を通る点」だが、#436 の実装は先に寄せる。**文章と実装の食い違いは ADR 0074 の側の訂正**で、この ADR は変えない(`tailAngle` の 10° の検査は、実装のまま通る) |

**ADR 0074 / 0076 との関係**

| 0074 / 0076 の規則 | 0077 がすること | 訂正が要るか |
|---|---|---|
| 0074 D2: `think` = 破線の三角、`shout` = 太い枠の四角 | 触らない(`balloon()` の `cloud` は一般の図用) | 無し |
| 0074 D2: しっぽの先は頭の円の 6px 手前、検査は 10° | 触らない(先を決める `tailOf` は `comic` の規則のまま。生成器には先を渡すだけ) | 無し(0074 の `think` の半径 `min(h/2, 28)` の記述は、#436 が 24 に直した。0074 の文章の訂正) |
| 0074 D2: 付け根は「線が縁を通る点」 | #436 の実装(先に寄せる)と食い違う。0077 は実装の側に合わせる | 0074 の文章を訂正(0077 の範囲外) |
| 0076 D1: 幾何の地図 `tails: Record<id, [x, y][]>`(三角形の 3 点) | `tails[id] = [base0, tip, base1]` を `Balloon.base` / `tip` から作る(四角・角丸・楕円)。**雲には `tails` の項目を作らない(v1)**(雲は `comic` に出ない。`balloon()` は幾何の地図の対象外) | 無し(0076 が `tails` を足すとき、この作り方を使う) |
| 0076 D1: 層の順 「…マンプ → しっぽ → ふきだし」 | #436 が既に、ふきだしの本体としっぽを**1 本の path**にしている。しっぽの層は、ふきだしの層に含まれる(しっぽがふきだしより下に隠れる継ぎ目の線が無くなるだけ。塗りが同じなので見た目は同じ) | 0076 の層の順に「しっぽはふきだしの path に含まれる」と足す(0076 の側) |
| 0076: `comic-tail-cross`(しっぽの三角形の辺で判定) | 同じ。三角形は `tails` から | 無し |

**U1 は #436 のあとに入れる**(`lib/comic/balloon-path.ts` を移すため。#436 が入る前に `lib/shapes/` を足すと、同じ関数が 2 つになる)。

### D7. 将来の PPTX の書き出し(範囲外。材料だけ)

プリセットの対応表(D3)があるので、後の PPTX の書き出し(`lib/pptx/`)は `balloon()` を**ネイティブの `prstGeom`** で書ける: `rect` → `wedgeRectCallout`、`round` → `wedgeRoundRectCallout`、`ellipse` → `wedgeEllipseCallout`、`cloud` → `cloudCallout`(近似。D3)。それまでは、D2 のとおり絵(SVG + PNG)に落とす。

**`adj1` / `adj2` の式**(ECMA-376 の `gdLst` で確認済み。上の「Office の形の定義」と、スパイクの `officeAdj` と `office.ts`):

```
adj1 = round((tip.x - (body.x + body.w/2)) / body.w * 100000)
adj2 = round((tip.y - (body.y + body.h/2)) / body.h * 100000)
```

先の**本体の中心からのずれを幅・高さの 1/100000** で表す。既定の (-20833, 62500) は、200×80 の本体で先 (58.3, 90) = 中心から (-41.7, +50)。`adj` への丸めが先を動かすのは最大 0.002px(スパイク)。

注意点: (1) ネイティブの形は付け根が Office の固定なので、**`base: 'follow'`(既定)の SVG とは付け根の位置が違う**。PowerPoint で同じ絵にしたい作者は `base: 'office'` を選べる(公開の欄)。ネイティブの書き出しは、`follow` の吹き出しに**警告**(「PowerPoint では付け根の位置が変わります」)を出す。(2) 先は `gap` だけ手前で止めたあとの点を `adj` にする。(3) 線の吹き出し(`borderCallout1`、`adj1`〜`adj4` = 始点 `(y, x)` と終点 `(y, x)`)は `box` + `connect` の線から作る別の話。(4) `adj3` は `radius / min(w, h) * 100000` を 50000 で打ち切る。

**出典と著作権**: ECMA-376 の定義を `test/` に写す(`office.ts`)ときは、Ecma の注意書き(「© Ecma International」。Ecma の text copyright policy の既定の注意書き。`cuzic/ooxml-rs` の `reference/ecma-376-drawingml-geometries/COPYRIGHT-NOTICE.txt` と同じ)をファイルの頭に付ける。

### D8. 検査(既存の検査の仕組みを広げる)

**幾何は専用の読み手で行う**(`lib/verify-handlers.ts` に `balloon` の読み手)。しっぽは、既存の `rects`(線分の外接矩形 + 3px。斜めの線でほとんどが空きになる。スパイク: 三角形が占めるのは外接矩形の 40%、傾いた例では 18%)には**出さない**。本体の矩形だけを今までどおり箱として出す。しっぽの三角形(雲は円)と箱の矩形は、**分離軸の判定(SAT)**で、実際の重なりが 0.5px を超えるかで見る。重なりの検査(本体どうし)としっぽの検査(`balloon-tail-box`)は、見る対象が別なので、同じ誤りを 2 回報告しない。

| id | 重さ | 内容 |
|---|---|---|
| `balloon-target-inside` | 問題 | 先が本体の外接矩形の内側(しっぽを描けない。文言は「the target lies within the body's bounding box」。楕円・雲は輪郭の内側) |
| `balloon-tail-box` | 問題 | しっぽが、自分と目標以外の箱を横切る。メッセージに、ほかの辺なら通らないか(同じ向きの別の辺)を添える(`unreachable` は別の検査にしない: 直す手は同じで、1 つの誤りに 1 つの報告) |
| `balloon-tail-through-target` | 問題 | しっぽが自分の目標の箱を通り抜ける(D3)。吹き出しの本体が目標と一部重なるときは、同じ id で文言が「overlaps its target」 |
| `balloon-tail-short` / `balloon-tail-long` | 助言 | D3 の暫定の限度 |
| `balloon-tail-edge` | 助言 | しっぽが、コネクタの線と交わる |
| `balloon-out-of-bounds` | 問題 | しっぽ(三角形の頂点、雲の円)が図の外に出る(D5。図は広げない) |
| `balloon-reveal-order` | 助言 | 目標が吹き出しよりあとに出る(D5) |
| 文字の検査(既存) | — | `box` と同じ。文字が本体の文字の矩形に収まるか |

閾値(0.5px、頂角 90° / 12°、雲の最小)は暫定。U3 で例の図を測って決める。

### D9. JSON の spec、Schema、MCP のパーツ一覧

- `lib/spec-parts/` に `balloon` を**spec の部品**として足す(`title` / `to` / `tip` / `shape` / `base` / `dashed` / `tone` / `gap` / `radius` / `id`、箱の置き方の欄)。spec の部品は `example`(検査 0 件で描ける例)を持つ(`spec-kit.ts` の要求)。`to` と `tip` の排他は JSON Schema の `oneOf` では書けない(ADR 0069 の `validateOneOf` の制限)ので、部品の `check`(issues。`r3.ts` と同じ)で止め、Schema には両方が任意と出る。`pnpm schema` で `schema/*.schema.json` を作り直す(ADR 0071)。`spiky` は列挙に入れない。
- **MCP の `list_diagram_parts` は、このリポジトリではなく**、プラグインのリポジトリ(`svg-diagram-mcp-plugin`)の `src/tools.ts` が、コアの `partCatalog()`(`lib/spec.ts`)を返している。したがって、コアに spec の部品を足し、**プラグインでコアの版を上げる**(ADR 0069 D4 と同じ手順)。ChatGPT は「Refresh tools」が要る。
- `callout` は spec の部品ではなく `connect` の注記なので、「輪郭のつながった吹き出しは balloon」の一言は、`skills/svg-diagram/references/relationship.md`(`callout` が載っている所)と README に書く。

## 代替案

- **新しい帯の種類にする**: 未対応の読み手が、無視か落ちるかで安全に失敗できる(PPTX は絵になる)。しかし `Band` の union、`row()` の子の型、`band-ids` / `band-children`、レイアウト・描画・検査・PPTX の帯ごとの表のすべてに登録が要り、`flex` / `col` / `span` / `reveal` / `board` も作り直しになる。箱の欄にして、知っておくべき場所(D2)を U2 で全部直す。
- **`callout()` に `shape` を足す**: 部品の数が増えない。しかし `callout()` は箱ではなくコネクタで、札の置き場所が目標から決まり、行・列に並べられない。却下。
- **`speechBubble()` だけを一般の図でも使えるようにする**: 部品は 1 つで済む。しかし `speechBubble()` は `comic()` の帯の中で、話し手・コマ・読む順・穴と一緒に配置される。帯の外で使うために任意にすると ADR 0074 の規範が薄まる。輪郭の生成だけを共有する(D6)。
- **Office の `adj` をそのまま既定にする(付け根は 2/12〜5/12 の固定)**: PPTX と同じ絵になる。しかし先が付け根の真上でない傾いた三角になる。`base: 'office'` の公開の欄として残し、既定は `follow`(Q2)。
- **しっぽを曲線にする**: 漫画らしい。しかし付け根の幅・曲がり・検査が増え、PPTX の `wedge*` に対応しない。第 2 版(Q4)。
- **しっぽのために空きを確保する**: 配置が目標に引かれて循環しうる。検査で知らせる(D5)。
- **線の吹き出しも `balloon()` に入れる**: しっぽが輪郭の一部でない。`callout()` / `connect` で足りる(D3)。
- **ぎざぎざを v1 に入れる**: Office に無く、スパイクもしていない。予約するだけ(D3)。
- **本体の大きさを文字の矩形と同じにする(楕円・雲でも)**: 文字が輪郭にはみ出す。Office の文字の矩形の割合で本体を大きくする(D3)。
- **しっぽの先を本体の座標の絶対値にする**: 吹き出しが動くとしっぽの向きが変わる。`tip` は中心からのずれ(D3)。
- **しっぽの検査に既存の `pathSegments` の矩形を使う**: 斜めのしっぽで外接矩形の 60%〜80% が空きで、誤検出が出る。SAT にする(D8)。

## 影響

- 新しい DSL `balloon`(`BoxBand` の任意の欄 `balloon` を足す)。実装は `lib/shapes/balloon.ts`(輪郭。#436 の `balloon-path.ts` を移して広げる)、`lib/layout-connect.ts` の隣の `resolveBalloons`、`lib/emit-boxes.ts` の `renderBoxRect` の分岐、`lib/verify-handlers.ts` の読み手、`lib/pptx/bands.ts` の箱だけの絵への落とし(`rectPicture`)、`lib/dsl/text-bands.ts` の `balloon()`。表への登録: spec-parts、`dsl-pure`、`test/fixtures/dsl-exports.json`、README(U2。`dsl-exports.json` の検査は U2 で落ちるため)。
- 既存の `callout()` / `box` の出力は変えない。`BoxBand` の欄が増えるだけで、欄の無い箱の出力は変わらない(golden が変わらないことをテストで確かめる)。
- ADR 0074 / #436 との関係は D6。`lib/comic/` に入るのは薄い包みへの置き換えだけ(見た目は変わらない)。
- PPTX: 吹き出しの箱を含む帯は絵になる(D2)。ネイティブの吹き出しは D7 のあとの ADR。
- プラグイン(`svg-diagram-mcp-plugin`)でコアの版を上げる(U4)。
- 描画は決定的(入力が数値だけの純粋な関数。同じ入力が同じ文字列になることをスパイクで確認)。

## 実装計画

どの単位も、`main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる。

### U1: 共通の輪郭の生成(`lib/shapes/balloon.ts`)

- 前提: PR #436(ADR 0074 U1)が `main` に入っていること。
- 範囲: `lib/comic/balloon-path.ts` を `lib/shapes/balloon.ts` へ移して広げる(`balloonOutline`: `radius`、楕円、雲、`base: 'office'`)。`lib/comic/balloon-path.ts` は薄い包み(D6)。`officeAdj()`。同点を Office に合わせる。
- 完了の基準: (1) **#436 が入ったあと、`comic` の golden が変わらない**(固定の数の一致ではなく、この基準。補助として、#436 の `balloonPath` に対する性質テスト: `say` / `think` / `shout`、狭い辺・低い本体を含む範囲で、同点を除いてパス文字列が同じ)。(1b) 縮退した入力(有限でない先、内側の先、半径 0・40・500、辺が狭い本体、`half < 1`)で `NaN` / `Infinity` が出ない。(2) どの形・どの方向の先でも、付け根が輪郭の上にある(四角・角丸・楕円は誤差 0.1px 以内)。(3) 経路が `M` で始まり `Z` で終わる。(4) 同じ入力は同じ文字列。(5) 付け根の端が、角の弧と 4px から離れる(辺が短いときは付け根を縮める。端のクランプの単体テスト)。(6) `base: 'office'` が `wedgeRectCallout` の `gdLst` の評価と同じ多角形(**角丸と楕円も**。`office.ts` を `test/` に移して、`wedgeRoundRectCallout` と `wedgeEllipseCallout` の評価も足す)。(7) 先が輪郭の内側のとき `inside: true`(角丸の切り欠きは外)。(8a) 雲の文字の矩形: `cloudTextRect` が返す矩形の四隅と辺の中点が実際の輪郭の内側にあり、余白込みの文字の矩形が収まる大きさを返す。(8) 雲: 幅 100〜600 × 高さ 48〜120(縦横比 6:1 まで)× 360 方向で、`NaN` が出ない、`inside` が正しい、1 つ目の円が実際の輪郭に重ならない、`minLength` を返す。本体の最小 72×48。(9) 既存の golden が変わらない。
- テスト: 性質テスト(乱数の本体・先の組 1000 通り以上)、8 方向の固定の例、近い目標の表、Office との一致、`officeAdj` の逆変換(先 → `adj` → 先で 0.002px 以内)、同点の 2 例。

### U2: 部品とレイアウト

- 範囲: `BoxBand` の内部の欄 `balloon`(`BOX_KEYS` には入れない)、DSL の `balloon()`(受ける欄・受けない欄・エラーは D2)、`resolveBalloons`(D2 のデータの流れ)、`renderBoxRect` の分岐、PPTX の絵への落とし、`test/fixtures/dsl-exports.json` と README。
- 完了の基準: (1) 吹き出しの箱が、row・grid・areas・group・`board`(`kind: 'box'`)に置ける。(2) 吹き出しを動かしても、**目標を動かしても**、しっぽが目標を指し続ける。`tip` は吹き出しが動いても向きが変わらない。(3) 既存の golden が変わらない。(4) 文字の折り返しは `box` と同じ。(5) `to` の型の検査: 未宣言の id が `@ts-expect-error` で落ちる。(6) 受けない欄が `box()` と同じ文言のエラーになる。`box({balloon: …})` が未知の欄のエラーになる。(7) PPTX で、吹き出しの箱だけが絵(`rectPicture`)になり、まわりの `row` / `grid` / `group` / areas / `board` は図形のまま。見えない図形が箱の id を持ち、のり付けできる。(8) `balloon()` が `dsl-exports.json` に載る。
- テスト: 配置の golden、エラー文言(未知の id、自分自身、目標の中に吹き出し、`to` と `tip` の両方)、`dashed`、`scope` の中の参照、`reveal`。

### U3: 検査

- 範囲: D8 の検査(SAT の読み手)と、暫定の閾値を例の図で決める。
- 完了の基準: わざと悪くした図(目標が本体の中、しっぽが別の箱を横切る、目標を通り抜ける、短すぎる、長すぎる、矢印と交わる、目標があとに出る)で、それぞれ期待の id だけが報告される(同じ誤りが重なりの検査と二重にならない)。例の図では 0 件。外接矩形では「重なり」になり SAT では「重ならない」配置が、報告されない。閾値の根拠(例の図の測定)を ADR の「決定済み」に足す。
- テスト: 上の悪い図ごとの検査の結果、閾値の境、傾いたしっぽと隣の箱(スパイクの 18% の例)。

### U4: spec の部品とプラグイン

- 範囲: `lib/spec-parts/` の `balloon`(`example` つき。`to` と `tip` の排他は `check`)、`pnpm schema`、`skills/svg-diagram/references/relationship.md` と README の一言。**プラグインでコアの版を上げる**(`svg-diagram-mcp-plugin`。ChatGPT は「Refresh tools」)。
- 完了の基準: `pnpm schema` の結果がコミットされ、`test/schema-files.test.ts` が通る。spec の部品の `example` が検査 0 件で描ける。`balloon` を含む JSON の spec が、DSL と同じ SVG になる。プラグインの `list_diagram_parts` に `balloon` が出る(プラグイン側の PR)。
- テスト: DSL と spec の同値、`shape` の列挙(`spiky` が無い)、`to` と `tip` の排他の issue。

### U5: 例と golden

- 範囲: `examples/balloon-autoshape.ts`(形 4 種、8 方向、ささやき、目標が近い・遠い)、暗い配色の golden 1 枚。
- 完了の基準: 例の図で検査が 0 件。golden は `scripts/golden-docker.sh` で作る。既存の golden が変わらない。
- 例の文: 「ここが変更点」「要確認」など中立な文だけ。

## テスト方針

- 輪郭の生成は純粋な関数で、フォントに依存しない。性質テストが中心。
- Office との一致は、`gdLst` を写した評価を正とする。ECMA の注意書きを写しの頭に付ける(D7)。
- 「吹き出しを動かしてもしっぽが目標を指す」は、先の座標の差で見る。
- `speechBubble()` の golden が変わらないことが、U1 の受け入れの核。

## 質問と決定

すべて決定済み。決める人の決定は 2026-11-22(Q1・Q3・Q6・Q7・Q8・Q10・Q14 は推奨どおり)。それ以外は調整役の決定(レビュー 1〜3 回で収束)。

**決定済み**

| # | 質問 | 決定 |
|---|---|---|
| Q1 | 部品の名前 | `balloon()`(`bubble` は泡グラフ、`callout` は既にある)。決める人 |
| Q2 | 付け根を先の真下に寄せる(`follow`)か、Office の固定(`office`)か | 既定は `follow`。`base: 'follow' \| 'office'` は**公開の欄**。ネイティブの書き出しは `follow` に警告 |
| Q3 | 線の吹き出し(`borderCallout*`、`accentCallout*`) | 入れない(`callout()` / `connect` で足りる。要望が出たら別の ADR)。決める人 |
| Q4 | 曲線のしっぽ | 第 1 版は直線。曲線は第 2 版 |
| Q5 | ぎざぎざ(`spiky`) | v1 に入れない。予約された値として書くだけ(列挙・Schema に入れない) |
| Q6 | 目標を `tip: [dx, dy]`(中心からの相対)でも指定できるようにするか | 入れる(`to` で指せない自由な点用。吹き出しが動いても向きが保たれる)。決める人 |
| Q7 | しっぽのために空きを確保するか | 確保しない(目標が配置のあとでしか分からず循環しうる)。検査で知らせる。決める人 |
| Q8 | 文字の折り返しに ADR 0074 の D2 の幅の規則を持ち込むか | 持ち込まない(`comic` / `chat` の中だけ。`box` と同じ規則)。決める人 |
| Q9 | 共通の輪郭の生成 | #436 の `balloon-path.ts` を `lib/shapes/` へ移して広げる(U1。#436 は `main` に入った)。`speechBubble()` は薄い包みで、`think` / `shout` は ADR 0074 のまま。基準は `comic` の golden が変わらないこと |
| Q10 | 吹き出しの ARIA | `role` と `<title>` は付けない。`data-balloon-to` だけ。決める人 |
| Q11 | 表現 | `BoxBand` の内部の欄(`balloon()` だけが設定)。PPTX は吹き出しの箱だけを絵にする |
| Q12 | しっぽの長さの閾値(頂角 90° / 12°)、雲の最小 | **暫定**。U3 で例の図を測って決める(雲の文字の矩形は D3 のとおり U1 で輪郭から求める) |
| Q13 | 辺の選びの同点 | Office に合わせる(#436 は上下 → 左右に。対角線上に厳密にあるときだけ変わる) |
| Q14 | しっぽがはみ出すとき、図を広げるか、検査で報告するか | 広げない。`balloon-out-of-bounds`(問題)で報告(広げると全帯の座標が動く)。決める人 |

## スパイクの再現

```
node spikes/balloon-autoshape/run.ts [outdir]   # SVG(8 方向・近い目標・角の近く・Office の付け根との比較)と、上の数字
```

`spikes/balloon-autoshape/out/` に、形ごとの 8 方向の SVG、近い目標の SVG、`measurements.txt` を置いた。`run.ts` は `main` の `lib/comic/balloon-path.ts` を直接読んで比べる(コピーは置かない)。`office.ts` の頭に Ecma の注意書きを付けた。この ADR を採るなら、`balloon.ts` と `office.ts` は U1 で `lib/shapes/` と `test/` に移して、スパイクは消す。
