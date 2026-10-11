# ADR 0002: 量・強調を表す部品の追加(stat / bars / reveal / spotlight / versus)

- 状態: 提案(改訂 3。Opus レビュー 2 回分を反映)
- 日付: 2026-10-11
- 基点: 0.5.0(検査は `lib/svg-lint.ts` 基準)

## 背景

実際の資料づくり(約 40 枚)で、手組みの `row + group + connect` に頼った場面を優先度順に整理する。

| 優先 | 部品案 | 手組みの内容 |
|---|---|---|
| 1 | 量を形で表す `bars()` | 76%と31%の棒、帯(16/34/34/16%)、3層の帯幅、ハードル・階段の高さ |
| 2 | 大きな数字 `stat()` | 76%、31%、10万円、40%→29% |
| 3 | 段階表示 | 階段、クイックウィン、2段の流れ |
| 4 | 強調と薄め `spotlight` | ほぼ全部の図で「主役だけ目立たせる」 |
| 5 | 左右の対比 `versus()` | 地続き、持ち出せる/出せない、見立て/実際の原因 |

手で回避している制約: (a) row に box / group しか入らず、table / plane を並べると group で包んで外枠が二重になる、(b) 表の行高、(c) 矢印の太さ、(d) 箱内の部分強調、(e) 「架空の例」などの stamp が画面部品にしかない。

メタファー素材(人・鍵・橋など)は、記憶には効くが理解・検索には効きにくいという調査結果から、本 ADR の範囲外とする。

## 既存コードで確認した事実(レビューで訂正済み)

- **`stat` は今でも band で描ける。** `BoxLine.role` があり(`types.ts:200`)、`layout.ts:61-63` は `ROLES[role]` で文字サイズを決める。`Role` に `'stat'`(34px)がある。`box({lines:[{text:'76%', role:'stat'}]})` と `caption(.., {role:'stat'})` は現状で通る。`wf.stat` はワイヤーフレーム側の別実装(34 を直書き、`wireframe.ts:386`)。
- **箱の幅は指定できる。** `BoxChrome.flex` / `width`(`types.ts:216-219`)があり、`row(..., {justify:'start'})` なら `width` がそのまま使われる(`layout.ts:156-172`)。`cols` の無い row の `row#N` は実際の子の矩形なので、比例幅でも壊れない。壊れるのは `cols` 付きの共有格子だけ。
- `ROLES.hero` は **18px** で `stat`(34px)より小さく、`Role` 型以外から使われていない。
- `box({size})` が 14〜72 の任意整数を受け付ける(`types.ts:238`, `strict.ts:150`)。「任意 px は不可」という方針の既存の抜け道で、本 ADR では触らない。
- 固定 id が `emit.ts` にある(`dsl-arrow` marker、`svg-title`、`svg-desc`、`<metadata id="svg-diagram">`)。`<style>` はインライン時に文書全体へ効く。
- slidev addon は SVG を `<img>` で表示し(`SvgDiagram.vue:16`)、`slide-budget.ts:88-94` / `fit.ts` も `<img>` 前提。`<img>` 内の SVG には CSS もスクリプトも届かない。
- 検査: 失敗(problem)になるのは `verify.ts` の輝度差 ≥ 70・重なり・connect・plane・bounds。さらに `build` は `lint-svg --strict` を通し、advisory も含めて失敗にする。WCAG 4.5:1 / 3:1 は `rules.ts` の warn。描画後の検査は `svg-lint.ts` がジオメトリ上で行い、塗りの `fill-opacity × opacity` を合成して判定する(文字自身の opacity は掛けない)。

## 決定案

### 1. `stat()` — box を返す薄いヘルパー(最優先・最初に出す)

```ts
stat('76%', '導入前の離脱率', {tone: 'danger', size: 'stat' | 'display'})
```

- 実体は `box({align:'center', lines:[{text: value, role, bold:true, tone}, {text: label, tone:'muted'}]})`。**`tone` は数字の色(`BoxLine.tone`)にだけ当て、箱は plain のまま**にする。箱の tone にすると `usedNotation`(`rules.ts:70-81`)が `danger`(「異常・注意」)の凡例を足し、破線の箱になって「導入前の離脱率」が異常の箱に見えるため。**row の拡張なしに `row([stat(..), stat(..)])` が動き**、`row#N`・高さ揃え・verify の検査もそのまま効く。
- **値は折り返さない(1 行)。** `wrapAtoms`(`wrap.ts`)が「10万 / 円」のように数字を割るのは誤読につながる。値が列幅に収まらなければ verify の problem にして throw する(fill の 1.8 倍拡大後も同様)。
- 大きさは `ROLES` 経由の 2 段階。`hero`(18px)は未使用なので、**`display`(例: 56px)を新設**し、`hero` は触らない。`stat` ヘルパーは `stat`(34)と `display` を選べる。fill モードの拡大(`dsl.ts:689`)は ROLES を読むので連動する。`wf.stat` は 34 直書きのままで、ROLES 化はしない(`stat()` とは fill 時の拡大が異なる)。
- 大きい文字のコントラスト(WCAG の 3:1)は `rules.ts:124` が一律 4.5:1 なので、サイズ別の基準にするかを実装時に決める(まずは 4.5:1 のまま、厳しい側に倒す)。
- 変化表示(40%→29%)は 2 つの stat + 矢印で書ける。専用の `to` は作らない。

### 2. `bars()`

値→長さの正規化、軸・目盛り、値ラベルの内外配置、縦棒、積み上げを担う band。比例幅の横棒だけなら `box({width})` で既に書ける。`bars` を分ける理由はこの 5 点。

```ts
bars([{label:'導入前', value:76, series:'a'}, {label:'導入後', value:31, series:'b'}],
     {max:100, unit:'%', dir:'h' | 'v', stack?:boolean, height?:number})
```

- 軸・目盛りは **`plane` の目盛り決定(`niceStep` / `ticksOf`、`plane.ts:26-37`)を流用**する。現状 export されていないので切り出す(小作業)。bars は負値をエラーにするので min は 0 固定。
- 検証: 負値・`NaN`・`Infinity`・`max <= 0`・`max` を**超える**値(積み上げでは合計が `max` を超える)はエラー。全値 0 も明示エラー。`max` 省略時は最大値。
- 値の個別 `h` は**入れない**(値と長さが一致しなくなる)。ハードル・階段のような「値でない高さ」は別途 `box({height})` が必要なら別 ADR。
- 縦棒は `height` で図の高さを指定(既定は 4 段階の目盛りが収まる高さ)。
- **色は tone ではなく系列**(`series: 'a' | 'b' | 'c'`)。棒は非テキスト要素なので白地で 3:1 が要る。満たすトークンは accent / text / muted だけ(`danger` は意味を持つので系列に回さない。`soft` / `border` は約 1.2〜1.3:1 で不可)。割り当ては a=accent、b=text、c=muted とし、実装時に表で固定する。tone を使うと `usedNotation`(`rules.ts:70-81`)が「`new` = 新規」の凡例を勝手に足し、「導入後=新規」と誤読される。bars は凡例対象外とし、系列名は棒のラベルで示す。**積み上げでは区分の間に白い区切り(2px の隙間)を必ず入れ**、4 区分以上や同色が隣り合っても境目が見えるようにする。各区分には値ラベルを付け、狭くて入らなければ棒の外に出す(省かない)。
- `verify.ts:61` の `collectRects` は band 型の白リストなので `'bars'` を追加する。値ラベル(棒の内外)は `checkPlanes`(`verify.ts:69-90`)相当で矩形検査に載せる。
- 値ラベルのサイズは `CONNECT_LABEL_SIZE` 等の定数ではなく `ROLES` から読む(fill モードで拡大される)。スライドの縮小で実効 12px を割りやすい点は `fit.ts`(`minEffectiveFont`、既定 12)の検査に任せる。
- 各棒に任意の `id` を持たせ、connect / spotlight のアンカーにできる。

### 3. 段階表示 — `reveal: n`(`step` から改名)+ 段階別 SVG ファイル

- **改名**: `box({step})` は既存のタイトル行の番号バッジ(`types.ts:237`)で、`swimlane` の step や `PlaneAxis.step` もある。`step: n` は同名 2 義になり golden を壊すので、新しいキーは **`reveal: n`**(1 始まり)とする。
- **出力規約**:
  - `name.svg` = **全段階を出した最終形**。文書の `![](name.svg)`、`show`、`contact-sheet` は従来どおり動く。`name.reveal0.svg`(reveal 付きを除いた、クリック前の絵)、`name.reveal1.svg` … `name.revealN.svg`(N は最大の reveal)が累積した各段。**`reveal: k` は k 回目のクリックで出る**(`v-click` の意味と一致)。addon はクリック数 k で `revealK.svg` を表示する。
  - **レイアウトは全段階込みで 1 回だけ行い、まだ出ない要素も場所を取ったまま**にする(各ファイルは同じキャンバス寸法。段ごとにレイアウトし直すとクリックのたびに図が動き、`<img>` の高さも変わる)。
  - 各ファイルの `<metadata id="svg-diagram">` に段番号を入れ、`drift-no-provenance` にならないようにする。
  - drift 検査(`check-diagram.ts:116-137`)は全 N+1 ファイルを再生成して比較し、段数が減ったとき残る古い `revealK.svg` を孤児として報告する(`build` は掃除する)。
  - `doc-orphan-svg`(`rules.ts:48`、`docs-check.ts:71-78`)は `*.revealN.svg` を除外し、対応する `name.svg` が参照されていれば孤児としない。
  - `slide-budget`(`slide-budget.ts:88-91`)のセレクタ `img[src$="/svg/name.svg"]` を **`name(.reveal\d+)?.svg` まで許す**よう広げる(本リポジトリで閉じる)。全段が同寸なので、どの段を計測しても同じ高さになる。
- 配信は段階ごとの別ファイルslidev addon は `v-click` のクリック数で `<img src>` を差し替えるだけでよく、固定 id の衝突・`<style>` の漏れ・`slide-budget` / `fit` の `<img>` 前提の破壊を避けられる。PDF 出力・`show`(sixel)・文書用途も「何段目の絵か」が明確。`data-reveal` 属性は補助情報として付けてよいが主経路にしない。
- 累積が既定。`stepOnly` は作らない(必要なら spotlight の段階指定で表現できる)。
- 対象は box / group / row 子 / connect / bars の棒 / banner / table / plane。caption・legend・spacer には付けない。`legend: 'auto'` は全段階の記法を最初の段から載せる(許容する)。
- 継承規則: 未指定要素は常に表示。**connect の既定は両端の max を継承**。group の子は `max(親, 自分)`。connect の端点が `row#N` のときは、その列の子の reveal を継承元とする。矢印が端点より先に出る場合は warn。
- emit は band ごとの `<g>` を持たないフラット出力(`emit.ts:489`)なので、laidOut に reveal を伝播して「n 以下の要素だけ」を出す(上記のとおり座標は全段階込みで確定済み)。
- addon の受け取り方(ファイル名規約、`SvgDiagram.vue` の差し替え)を**先に addon 側で決める**。本リポジトリ側はファイル出力規約を確定してから実装する。

### 4. `spotlight`

```ts
diagram({spotlight: 'main'})
```

- 不透明度は**不採用ではなく比較対象**: 重なり検査はジオメトリだけ、コントラストも `svg-lint.ts` が `fill-opacity × opacity` を合成するので、不透明度案が検査を壊すわけではない。ただし文字自身の opacity は `svg-lint.ts:75` が掛けていないため、不透明度案は svg-lint の修正が前提になる。
- 採用は**色寄せ(`dim` 属性)**。tone を書き換えず、laidOut に `dim` を持たせる:
  - (a) `usedNotation` から除外する(`muted` の「補助・任意」凡例を勝手に足さない)。
  - (b) コントラスト検査は dim 後の実色で評価する。`build` は `lint-svg --strict`(`dsl.ts:733`)を通すので、描画後のコントラスト(輝度差 < 70)・トークン外の色は **build の失敗**になる(rules の WCAG は warn)。dim の組み合わせ(muted × bg / code)は輝度差 140 以上で問題ない。
  - (c) 破線(`danger` / `removed` / `dashed: true`)・線種・マークなど**形の手がかりは保持**する(色だけに頼らない原則)。破線の箱は破線のまま色だけ寄せる。
  - (d) 矢じりの marker を色ごとに持つ(`emit.ts:478` は 1 個・黒固定)。`dsl-arrow-dim` を dim 使用時のみ追加する(インライン化はしないので id 衝突は問題にならない)。
  - (e) **dim の箱は本物の `muted` トーンの箱と見分けがつかない**(薄い色が 1 段しかない)。dim は塗りを `bg`(muted 箱は `code`)に統一し、もともと実線の箱は枠を点線にして差をつける(破線の箱は上記(c)のまま、塗り `bg` だけで muted の箱(`code`)と区別する)。spotlight を使う図で `muted` トーンを併用したら warn する。
- 薄めに使える色はトークン上 `muted` のみ(`border` は白地で約 1.3:1)。**弱め幅は 1 段のみ**と割り切る。コントラストの扱いは (b) のとおり(新しい problem は足さない)。
- 対象 id: group を指したら子孫は主役、`row#N` も指せる、connect は**「片端でも主役なら主役」**を既定とし(主役に出入りする矢印が全部薄くなるのを避ける)、`spotlight: {ids, edges: 'touching' | 'between'}` で選べるようにする。examples で両方の見え方を比べて既定を最終確認する。
- reveal との併用は、段階別 SVG ならファイルごとに 1 つの spotlight を当てるだけで解ける(`spotlight: {1:'a', 2:'b'}` の記法は reveal ファイル別の指定として扱う)。

### 5. `versus(left, right, {shared})`

内部は row(cols 12)+ group 2 つ + 共通部への connect の糖衣。新しいレイアウト原理は足さない。1〜4 を実際に使ってから、組み立てコードを見て形を確定する(最後)。

### 6. 小さな制約の解消

| 制約 | 方針 |
|---|---|
| (a) 並べると外枠が二重 | **まず `group(..., {frame: false})`(枠なし・pad 0)を足す**(`emit.ts:123` が必ず枠を描くのが原因)。row の子の拡張は、これで足りないと分かってから。 |
| row の子の拡張(必要になった場合) | `assertBoxChildren` は grid 用に残し、変えるのは `assertRowChildren`(`dsl.ts:368`)と `hasGroup` 判定 →「box 以外を含む row は grouprow 経路」に広げる。`row` 型は box 専用のまま。先に決めること: 高さ揃え(table / plane は伸ばせない→上揃え。row#N アンカー矩形と描画矩形の不一致)、`width` の二重の意味(row の子幅 vs table/plane 自身の `width`)、`layout.ts:512` の `as LaidOutGroup` キャスト、共有格子の gap 走査(`layout.ts:275-291`)。 |
| (b) 表の行高 | `table(..., {cellH})`。`stateMatrix` の `cellH` と意味も揃え、**固定高**とする。折り返しで 2 行になったセルに足りなければエラー(伸ばさない)。 |
| (c) 矢印の太さ | **実装済み(別 ADR は立てず本項を更新)**: `connect({weight: 'strong'})`(5px。`heavy` ではなく意味の名前。任意 px は不可)。`line: 'double'` との併用は例外(意味が競合)、solid / dashed / dotted とは併用できる。矢じりは `markerUnits="userSpaceOnUse"` の専用 marker(`dsl-arrow-strong`、使用時のみ defs に出す。dim 用は `dsl-arrow-strong-dim`)で、線を矢じりの手前で止めて先端を箱の縁に合わせる。凡例キーは `weight:strong`(「強い流れ」)で、`legend: 'auto'` / `legend-missing` の対象。`edgeStats` の重なり判定は線の太さに応じて間隔を広げる(`edgeStats` は `verify.ts` ではなく `rules.ts`)。`connectDefaults` には入れない。 |
| (d) 箱内の部分強調 | 単独の ADR。`measure` が部分ごとの太さを見る必要があり、実装コストが最大。 |
| (e) stamp の汎用化 | stamp は `WfFrameDecor.stamp`(`types.ts:918-924`)で、`wf.stamp` という関数ではない。box の右下に出すなら `placeBoxLike`(`layout.ts:311`)の高さ計算で領域を確保し、tag の `tagBox` と同様に `stampBox` を verify の矩形検査に載せる(箱単位の `collectRects` では検出されないため)。 |

## 検討した代替案

| 案 | 判断 |
|---|---|
| `step: n` 名のまま `data-step` 属性を出し addon が読む | `<img>` 埋め込みでは読めない。インライン化は固定 id・`<style>` 漏れ・budget 計測を壊す。名前も既存 `box({step})` と衝突。不採用 |
| row に比例幅の機構を足す | 箱の `width` / `flex` で既に書ける。軸・目盛り・値ラベル・縦棒・積み上げが要るので `bars` に分ける(理由を訂正) |
| `spotlight` を不透明度で実装 | 検査が壊れるわけではないが、文字 opacity が svg-lint に掛からない。色寄せ + `dim` を採用。比較は実装時に svg-lint の修正を含めて再評価してよい |
| `heavy` 矢印 | `double` と競合。当面不採用 |
| `stat` の専用 band | box ヘルパーで足りる。row 拡張に律速されなくなる |
| row に banner / table / plane を入れる(先頭で実装) | リスクが最大。`frame: false` で足りるか確認してから |
| メタファー素材 | 別 ADR |

## 実装順と受け入れ条件

1. `stat()`(box ヘルパー)+ `display` ロール。
2. `bars()`(横棒 → 縦棒 → 積み上げ)。
3. `group({frame:false})`、`table({cellH})`、`stamp` の昇格。
4. `reveal`(addon との規約を先に決め、本リポジトリは段階別ファイル出力)。
5. `spotlight`(`dim`・凡例除外・marker)。
6. 必要なら row の子の拡張、部分強調(別 ADR)、`versus`。

どの段階でも `pnpm test` / `pnpm typecheck` / `pnpm golden` を通す。**出力が変わりうる変更は個別に列挙する**(`display` ロール追加は既存出力に影響なし、marker の色別化は `<defs>` が変わるので dim 使用時のみ出す)。各部品に `examples/` の図を足し、既存の手組み(row + group + connect)を新部品で書き直した before/after を 1 つ入れて、要望との対応を検証する。

## 影響とリスク

- 良い点: 最初の 2 部品(stat / bars)は row や layout の根幹に触れずに出せる。reveal を段階別ファイルにすることで addon の既存の `<img>` 構成を保てる。追加のみで既存図の出力は変わらない。
- リスク: reveal は addon 側の規約合意が前提。spotlight は marker の色別化と `dim` の凡例・検査への伝播が複数箇所に及ぶ。row の子の拡張は(必要になれば)高さ・幅・アンカーに影響が大きい。
- 未決: `display` の具体 px、stat のコントラスト基準(サイズ別にするか)、spotlight の connect 既定(examples で確認)、reveal のファイル名規約を addon 側と合意すること。
