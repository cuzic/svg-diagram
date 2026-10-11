# ADR 0004: 資料づくりで見つかったツール側の改善要望(bars / spotlight / reveal / plane / table / 色 / 文字サイズ)

- 状態: 提案(改訂 3。Opus レビュー 2 回分を反映し、収束を確認。実装前)
- 日付: 2026-10-11
- 基点: `main`(ADR 0002・0003 の実装、表の行の高さ `rowh`、矢印の太さ `weight`、アイコンを含む)
- 関連: ADR 0002(量・強調の部品)、ADR 0003(部分強調)

## 背景

ADR 0002 の部品(`bars()` / `stat()` / `spotlight` / `reveal` など)を実際の資料づくりに使ったところ、次の 8 件がツール側の制約として見つかった。ハードルの高さと階段は「ラベルなしの棒」で作れず、HTML のままになった。

| # | 要望 | 要約 |
|---|---|---|
| 1 | bars: 値ラベル・目盛り・格子を消せない | ハードルの高さと階段を作れず、迫力が出ない |
| 2 | bars: 棒の高さの下限が大きい | 短い棒を並べられない |
| 3 | spotlight が bars に直接効かない | group で包む必要がある |
| 4 | reveal が stat / plane の点 / versus() の group に付けられない | |
| 5 | plane: 折れ線を滑らかにできない | |
| 6 | 表に「行ラベル用の列」がない | 左端のラベル |
| 7 | 色のトーンが少ない | 主役の濃い青・次点の青・薄い青を使い分けにくい |
| 8 | 文字の最小 14px がスライドの主役の絵には小さい | `display` は stat 専用 |

## レビューで分かったこと(初版からの訂正)

改訂 1 は実行して確かめていない前提を含んでいた。Opus が実際に動かして確かめた事実は次のとおり。

1. **個々の棒を対象にした spotlight は今も壊れている**。`dimBand`(`lib/spotlight.ts`)が bars band 全体に dim を 1 つ付け、`renderBand`(`emit.ts:484-491`)が塗りを正規表現ですべて `muted` に置き換えるので、**主役の棒も灰色になる**。要望 #3「group で包む必要がある」の本当の原因はこれで、band に id を足すだけでは直らない。
2. **grouprow の中の group に付けた reveal が子に伝わらない**。`prepareReveal`(`lib/reveal.ts`)の `walk` は row / grouprow の子に `set` するだけで、子の group の `children` へ降りない。`row([group(..), group(.., {reveal: 2})])` は、枠と見出しだけが消え、**中の箱が早い段階で浮く**。`versus()` は `row([leftGroup, rightGroup])` に展開されるので、`versus` に reveal を足す案は、この修正が先に要る。
3. **`mid`(中間の青)は、3:1 を満たすと `accent` に寄って区別できない**(下の表)。
4. **bars の最小高さは 145px ではなく約 136px**(`plotT = y + 22`、`plotB = y + h - 33.6`、`plotB - plotT >= 80` から `h >= 135.6`。実行で 130 は throw、136 は通る)。しかも**縦棒だけ**の話で、下の 33.6px は**カテゴリラベル**(`BarDatum.label`)のための余白。ラベル・目盛りを消しても空くのは上の 22px だけ。
5. **`<title>` に値を残す案は届かない**。ルートの `<svg>` が `role="img" aria-labelledby="svg-title …"` を持つので、子の `<title>` は支援技術に読まれない。slide 媒体は title も desc も出さない。
6. **`caption({role: 'display'})` は今すでに使える**(`CaptionOpts.role?: Role`、`layout.ts:52`)。**`box({size})` は何もしない引数**(`types.ts:251` に「Not used by layout」、layout / emit のどちらも読まない)。ADR 0002 の「任意 px の抜け道」という認識は誤り。
7. **`table` と `sequence` は既に `id` を受けて spotlight の対象になる**。`swimlane` は `id` を受けるが `LaidOutSwimlane` で落とす(spotlight の対象にすると throw)。`id` が無いのは `plane` と bars band だけ。
8. **`plane.ts:11` の `const SIZE = ROLES.note` は読み込み時に 14 に固定**される。fill モードは `applyScale` が `ROLES` を書き換える(`dsl.ts`)ので、plane の文字は 14px として測られ拡大後の大きさで描かれる(既存のバグ)。

### 中間色 `mid` の計算(WCAG の相対輝度、sRGB で accent→soft を補間)

| テーマ | accent(白地比) | 白地 3:1 と soft 上 3:1 を両方満たす最も薄い色 | accent との比 | 白文字 4.5:1 も満たす最も薄い色 | accent との比 |
|---|---|---|---|---|---|
| blue | #1d5fa8 (6.45) | #5688c0 | **1.74** | #4179b7 | **1.43** |
| teal | #1f6e73 (5.94) | #508f93 | **1.61** | #3b8185 | **1.32** |
| amber | #a8632b (4.68) | #b27543 | **1.23** | #a9662e | **1.03**(accent とほぼ同じ) |

「白地 3:1 と soft 上 3:1」を同時に求めると、`mid` は `accent` のすぐ近くに寄る。amber では「次点の青(茶)」が主役と同じ色になる。文字を濃い色にする案(白地 3:1・`text` 文字 4.5:1)なら blue #6291c4(accent 比 1.96)のように離せるが、soft 上では 3:1 に届かない。

## 決定案

### 0. 前提のバグ修正(別 PR、機能より先)

次の 4 件は、機能追加と切り離して先に直す。**既存の出力を変えるバグ修正**なので、受け入れ条件の「1 バイトも変えない」の**例外**として、変わってよい対象を明記する(spotlight で bars の棒を対象にした図、grouprow の中の group に reveal を付けた図、fill モードの plane、swimlane の id を使った spotlight。golden の既存の図は変わらない)。

1. **bars を棒の単位で dim する**: `BarRect.dim` / `BarText.dim` を足し、`renderBars` が要素ごとに muted で描く。`renderBand` の一括置換から bars を外す。
2. **grouprow の reveal 継承**: `prepareReveal` の `walk` が、row / grouprow の子の group の `children` へ降りる。受け入れ条件: `versus` 相当(row + group)の右側に `reveal: 2` を付けると、`reveal1.svg` に右側の文字が 1 つも無く、接続線も無い。
3. **plane の文字サイズの出どころを 1 か所に**: 測定時と描画時が同じ値を読む(fill モードの plane で、測った幅と描いた幅が一致する)。
4. **swimlane の id を laidOut まで運ぶ**: swimlane band を spotlight の対象にできる。

### 1. bars: 値・目盛り・格子の出し分け(#1)

`BarsOpts` に次を足す。既定はすべて現状どおり(出力は変わらない)。

```ts
bars(data, {labels: 'all' | 'category' | 'none', axis: false, grid: false, baseline: false})
```

- **`labels`**(3 段階): `'all'`(既定。値ラベルとカテゴリラベル)、`'category'`(**カテゴリラベルだけ残し**、値ラベルを消す。名前は残すものを指す)、`'none'`(どちらも消す)。カテゴリラベルを消せないと余白が空かない(上の事実 4)ので、値ラベルだけの `false` は不十分。
- **`axis: false`**: 目盛りの数値・目盛り線・縦の軸線を消す。**カテゴリ側の基線は残す**(ハードルや階段は、地面の線があって初めてそう読める)。基線は `baseline: false` で個別に消せる。
- **`grid`**: 補助線(目盛りに沿った線)。**既定は `axis` の値に連動**する(`axis: false, grid: true`=数値の無い格子は意味が無いので、その組み合わせは throw)。
- **横棒の基線**: 横棒の `out.ticks.push({x1: plotL, y1: axisY, x2: plotR, y2: axisY})`(`bars.ts:85`)は**値の軸(下の線)**で、カテゴリ側の基線ではない。カテゴリ側の基線にあたる x = 0 の縦線は、今は値 0 の目盛り線が兼ねている。`axis: false` で基線を残すには、横棒では **x = plotL の縦線を新しく引く**(`axis: false` のときだけなので既存の出力は変わらない)。下の線は axis 側として消す。縦棒は値 0 の目盛り線(`plotL - TICK` から `plotR`)と基線(`plotL` から `plotR`)が今も重なって 2 本描かれており、`axis: false` で目盛りの線だけを消せば基線が残る(テストはこの重なりを前提にする)。
- **実装上の分割**: 縦棒の目盛り線は `plotL - TICK` から `plotR` まで 1 本、横棒も 1 本で、`renderBars` はすべて同じ線で描いている。`LaidOutBars.ticks` を `ticks` / `grid` / `baseline` に分ける。**既定(axis と grid が両方 on)では、今と同じ 1 本の線**(縦棒は `plotL - TICK` から `plotR`、横棒は `y` から `axisY + TICK`)を出す必要がある。目盛りの短い線と格子線を 2 本の path に分けるとバイトが変わり、emit 側で連結すると `Math.round` の丸めで端点がずれうるので、**レイアウトの段階で「結合した線」「短い目盛り線だけ」「格子線だけ」を選ぶ**。今の push の順序(縦棒は目盛りごとの線 → 縦の軸線 → 基線、横棒は目盛りごとの線 → 下の線)も保つ。
- **横棒への連動**: `needH` に含まれる `tickH + 8`(`bars.ts:57`)、左右に取る `labelW` / `valueW`(49-50 行)、幅の検査 `plotW < 80`(54 行)を `axis` / `labels` に連動させる。
- **値を伝える**(a11y)の条件(実装との整合): emit は **title が空のとき `<title>` も `<desc>` も出さない**(title は `d.title`・caption・banner の見出し・group の見出しから決まる)。値が見えない判定は 1 つに定める: **値ラベルが隠れていて(`labels` が `'category'` / `'none'`)、かつ `axis: false`**。`bars-values-hidden` の warn は、desc ではなく「**doc 媒体で `diagramTitle(d)` が空**」のときに出す(値を隠した bars は desc に自動追記するので、desc が空になることはもう無い)。`diagramDesc` は `d.desc` があるとそれだけを返す(`rules.ts:378`)ので、**利用者が desc を書いた図には追記しない**(利用者の desc を優先。desc に値が含まれているかは機械的に判定できないので警告しない。README に書く)。自動の desc は、他に要素が無いときだけ箱の見出しの一覧を入れる(`if (!parts.length)`、`rules.ts:387`)ので、bars の値の追記は**この分岐の外**で足す(足さないと、箱と値を隠した bars が混在する図で、箱の見出しが desc から消える)。reveal の段階ファイルでは `diagramDesc` が段階によらず同じなので、`reveal0.svg` の desc にも後の段階の値が入る(許容する)。
- **値を伝える**(a11y): 画面に値を出さない bars(`labels: 'none'` かつ `axis: false` など)は、**値の列を `diagramDesc`(`rules.ts`)の `<desc>` に自動で追記**する(子の `<title>` は読まれない)。doc 媒体で、diagram に title / desc が無いとき `bars-values-hidden` を warn する。slide 媒体は title も desc も出さないので、README に「値を別の箇所に書く」運用を書く(色や長さだけに頼らない原則)。
- ハードルの高さ・階段は、`dir: 'v'` + `labels: 'none'` + `axis: false` + `grid: false` + 各棒の値で作る。**階段は棒どうしが接していないと階段に見えない**ので、下の「棒の幅と間隔」が要る。

### 2. bars: 図の最小高さと棒の幅・間隔(#2)

- 縦棒の最小高さ(約 136px)は、`plotT = y + 22` と `plotB = y + h - 33.6`(カテゴリラベル)と、プロット領域の最小 80px の和。`axis: false` / `labels` の指定に応じて余白を取らず、プロット領域の最小値も 80px から下げる(目安: 20px)。**受け入れ条件: ハードル(`dir: 'v'`、`labels: 'none'`、`height: 60`)で、プロット領域が 50px 以上**。
- 小さい図で小さい値(0 を含む)が棒 1px 以下になるのは正当なので、**throw ではなく warn**(値 0 は今も許されている)。
- **棒の幅と間隔**: 今の棒の幅は `slot * .62` 固定(`bars.ts:116`)、縦棒は最大 64px・積み上げ 72px。`barW` ではなく、**棒の幅の比率(`barRatio`: 0〜1)** を足し、**間隔 0(`barRatio: 1`)を許す**(階段)。**省略時は「未指定」で従来の挙動のまま**(`0.62` の上限 64px が効く)。指定したときだけ最大幅の上限を外す(`barRatio: 0.62` を明示した図と省略した図で出力が変わるのは、この意図による)。意味: 縦棒・縦の複数棒は `slot * barRatio`、横棒は `BAR / (BAR + GAP)` を比率に置き換える(`BAR 28` / `GAP 18` 固定の代わり)、積み上げ(棒が 1 本)は対象外。
- 縦と横の両方で受け入れ条件を持つ(横棒の `needH`、`labelW`、`valueW` の連動を含む)。

### 3. spotlight: bars を対象にする(#3)

- 前提: §0-1(棒ごとの dim)。これが直らない限り、棒を 1 本だけ主役にする用途は成り立たない。
- `BarsOpts` に `id?: string` を足し、bars band 自体を `spotlight` の対象にできるようにする(子孫=各棒も主役)。実装に要るもの: `LaidOutBars.id`、戻り値の型を `Declares<Id | BarIds> & HandleOf<Id> & AnchorsOf<BarIds>` に、**band の id と棒の id が重複しない検査**(今は棒どうしの重複だけ見ている、`dsl.ts:652-653`)。band の id は `connect` の端点にもなる(その意図を README に書く)。
- `plane` にも `id` を足す(`PlaneOpts.id`)。`table` / `sequence` は既に受ける。`swimlane` は §0-4。
- 知らない id を指定したときの throw は今でも働いている(`applySpotlight` の `missing`)。

### 4. reveal: 付けられないものに付ける(#4)

- **前提**: §0-2(grouprow の reveal 継承)。`versus` に reveal を足す前に直す。
- **付けられないものの一覧**(実行時に黙って捨てるものを含む): `stat()`(`StatOpts` が `reveal` を拾わず、`dsl.ts:130-135` は明示したフィールドで box を作るので、型だけでなく構築時に渡す)、bars band 自体(`BarsOpts` が `RevealOpts` を継承せず、`bars()` は明示したフィールドで band を作るので `{reveal}` を黙って捨てる)、`PlanePoint` / `PlaneLine` / `PlaneDim` / `PlaneLabel`、`VersusPart`、`caption`(`prepareReveal` が `continue` で飛ばす)、`sequence`、`swimlane`。
- 各構築関数で `reveal` が **laidOut まで残る**ことを確かめる表形式のテストを置く。受けられない関数に `reveal` を渡したら**構築関数の実行時検査で throw**(TS の過剰プロパティ検査は JS 利用者に効かない)。
- **plane の要素ごとの reveal は小さくない作業**: `renderPlane(b, day)` が stage を受け取らない(`emit.ts:245`。`renderBandPlain` から stage を通す)、点のラベルが `texts` に平たく入っていてどの点のものか紐付いていない、`PlaneLine` / `PlaneDim` の端点が座標(`PlanePos`)でもよい、`PlaneLabel.at` が座標しか取らない。規則は「**id で指した端点の max を継承し、座標の端点は 0**」とし、テキストに reveal を持たせる。明示した reveal が端点より早いときの warn は connect と同じ規則。
- `VersusPart` に `reveal` を足し、左右の group に渡す。共通部にも同様。`connectLabels` の接続線は両端の max を継承する。

### 5. plane: 折れ線の平滑化(#5)

- 複数点を通る別の部品 `PlanePath`: `paths: [{through: [refs…], smooth?: boolean, dashed?, tone?, arrow?, reveal?}]`。
- **`smooth: true` の既定は単調 3 次補間(Fritsch–Carlson、`curveMonotoneX` 相当。x が単調増加の道筋)**。点を必ず通り、行き過ぎない。**Catmull-Rom は採らない**: y = 0, 0, 10, 10 を通すと、0 の区間で下に・10 の区間で上に、実在しない山と谷ができ、データを誤って表す。x が単調でない道筋だけを centripetal Catmull-Rom(α = 0.5)にする。
- 検査: 制御点の範囲を障害物にするとラベルの重なりを過剰に指摘するので、**曲線を細かい線分に分け、既存の `inkSeg` に流す**。
- **既定の破線**: `PlaneLine` は既定で `dashed: true`(`types.ts:521`、`plane.ts:130`)。データの線は実線が自然なので、**`PlanePath` の既定は実線**とし、`dashed` を明示した場合だけ破線にする(既存の複数 `PlaneLine` の図は変わらない)。
- 矢印の向きは、終点の接線(最後の制御点から終点へ)で決める(弦の向きではない)。

### 6. table: 行ラベル用の列(#6)

- **前提: #26(行ごとの `h` / `headerH` / `dense`)がマージ済み**(main に入っている)。組み合わせも受け入れ条件に入れる。
- `table(columns, rows, {rowHeader: true})`: 左端の列を行見出しとして扱う。
- **塗りの規則**(行の tone との矛盾を解消): **行ラベルのセルは常に `soft` で塗り、行ラベル列の右側に強い縦の罫線を引く**(塗りに頼らない区別)。行の tone の塗りが `soft`(`accent` / `new`)と重なる行は warn(`rowheader-tone-collides`)。`muted` / `removed`(塗り `code`)の行でも、行ラベルのセルは `soft`。
- 描画: `renderTable` は行ごとに角丸の path を 1 本描く(`emit.ts:382-388`)。行ラベルのセルは別の path が要り、角の丸めが条件で変わる(見出し行も title も無いときは左上、最終行では左下)。
- 縦位置: `cellH` を指定しないときは、本文のセルが上揃えなので**行ラベルも上揃え**にそろえる(行ラベルだけ縦中央にすると、本文が折り返した行で 1 行目がずれる)。`cellH` / 行の `h` があるときは縦中央。
- 受け入れ条件: 3 層の表(`cellH` / `dense` と併用)で、左端が行ラベルとして読めること。

### 7. 色: 新しい色を足さず、既存の `solid` で 3 段階を作る(#7)

**`mid` は作らない**(上の計算表: 3:1 を満たすと `accent` の 1.2〜1.7 倍の明るさにしかならず、amber では主役と同じ色になる。`secondary`〔白地・枠 mid〕は既存の `changed`〔白地・枠 accent〕と枠の色の差 1.2〜1.96:1 でしか区別できず、「色だけに頼らない」に反する)。

- **既存の `solid` / `solid-danger` を、箱の tone として使えるようにする**: **主役=`solid`**(accent の塗り+白文字。白文字の比は blue 6.45 / teal 5.94 / amber 4.68 で、いずれも 4.5 以上)、**次点=`accent`**(soft の塗り+accent の枠)、**その他=`plain` / `changed`**。塗りの有無で区別でき、新しい色が要らない。
- **型の範囲**: `BoxTone` そのものは広げない。`BoxTone` は箱のほかに group・banner・legend の項目・table の tone と行の tone・sequence の参加者と note・swimlane のレーンでも使われるので、広げると `group({tone:'solid'})`(子の白い箱が accent の上に並ぶ)や表の行の `tone: 'solid'`(表のセルの文字は `resolveTextColor(c.tone)` で決まり、accent の上に濃い文字が出る。しかも表の文字にはコントラスト検査が無い)が型を通ってしまう。**`box()` / `banner()` / `stat()` / swimlane の手順だけが受ける型 `EmphasisTone = BoxTone | 'solid' | 'solid-danger'`** を作り、legend の項目にだけ同じ型を足す。`DEFAULT_LEGEND_LABELS` の `satisfies` も、この型から `tone:solid` / `tone:solid-danger` を要求するように変える。group・表の行・sequence では**型エラー**(実行時にも throw)。
- **文字色の規則**(今は仕組みが無い): 箱の文字色は箱の tone ではなく run の tone で決まり(`emit.ts` の `renderTextRuns`、`verify.ts` の `contrastFor`。`TONES[*].text` は箱の文字には使われていない)、`box({tone:'solid'})` は accent の塗りの上に濃い文字が出て、`verify` が 3 件落ちる(実行で確認)。そこで:
  1. `solid` / `solid-danger` の箱では、**run の tone が未指定なら `bg`(白)** にする(title・body・lines・stat の値)。note や stat のラベルなど既定が `muted` の run も白にする(muted を accent の上に置くと 1.1:1)。
  2. 明示した `accent` / `danger` / `muted` の run と、ADR 0003 の span の tone(`em.accent` など)は、solid の上では塗りと同じ色になって見えないので **throw**(ADR 0003 の「run と同じ tone は error」と同じ考え方)。太字(`em.b`)は許す。
  3. `verify.ts` の `contrastFor` と `rules.ts` の `a11y-text-contrast` が、1. の解決後の色で計算する。
  4. **`a11y-nontext-contrast` の誤検知を直す**: stroke が null のトーンは `resolveBoxStyle` が stroke に fill を入れる(`emit.ts:56`)ため、`rules.ts:179` の `min(stroke と自分の塗り, stroke と白地)` が必ず 1.0:1 になる。stroke の無いトーンは「fill と白地」で判定する(accent と白地は 6.45 で通る)。
  5. **dim(spotlight)のとき**は、今の箱と同じく塗りを `bg`、文字を `muted` にする。白文字を残すと白地の上で見えなくなるので、dim の分岐が文字色の解決より**先**に来ることをテストする。
- **凡例**: `tone:solid` は `line:solid`(実線)・`weight:strong` と接頭辞が違い、キーは衝突しない。意味の衝突がある: `accent` の凡例の既定ラベルは「強調」(`rules.ts:56`)なので、`solid` と併用した図の自動凡例は「主役 / 強調」になり、どちらが上か読めない。**(a) solid を使う図では `accent` の凡例ラベルを「次点」にする**(`legendLabels` で図ごとに変えられるなら、README にその例を書く)。`solid` のラベルは「主役」、`solid-danger` は「異常(強)」。凡例ラベルの無い tone を渡されたとき `legend: 'auto'` が `splitAtoms(undefined)` で落ちるのを、throw する検査に変える。
- **実装時に決める 2 点**(Opus の最終確認で出たもの): (1) solid の箱では、**手順の番号バッジ(`step`)と `tag` の pill が箱の塗りと同じ accent 色**になり、見えなくなる(または溶ける)。白い縁を付けるか、solid との併用を throw にするかを決め、テストを足す。(2) `accent` の凡例ラベルを「次点」に変えるのが**自動**(solid を使う図で自動的に)か**利用者の指定**(`legendLabels`)かを決める。
- **受け入れ条件**: solid の箱(title / body / note / lines / stat)が `verify` と `rules` の両方で**警告ゼロ**。group・表の行・sequence では型エラー。dim の solid の箱が読める。
- bars の「次点」は、新しい系列色ではなく、既存の `SHADES`(不透明度の段)と `blendLuminance` / `bestTextColor` を使う(トークンの色に fill-opacity を付けるだけなので off-token-color を通る)。bars の系列 `d` を足す場合は、`dsl.ts:641` の `['a','b','c']` の直書きの検査、`BarSeries` 型、`SERIES` の対応表を更新する(bars の系列は凡例に載らない: `usedNotation` は box の tone しか見ない)。
- `TextTone` には足さない(ADR 0003 の `em.*` が span の tone を `TextTone` に限っているのと整合する)。
- 実際の図(主役 / 次点 / その他の 3 段階)で、この組み合わせが要望を満たすかを先に確かめる。満たさない場合に限り、`mid` を最後の手段として再検討する(名前は表のセル記号 `CellMark 'mid'` と紛らわしいので `accent2` など。要件は「白地 3:1、`mid` 上の文字 4.5:1」で、`test/tones.test.ts` の拡張を受け入れ条件にする。`Palette` は `Record<Theme, ThemeColors>` なので、`blue` / `teal` / `amber` に加えテーマ `1` / `2` にも要る。`colorOf` の解決も直す)。

### 8. 文字: 主役の絵に大きい文字(#8)

- **訂正**: `caption({role: 'display'})` は今すでに使える。`box({size})` は何もしない引数なので、「抜け道」ではなく**削除対象**。
- **`size` は warn にして、次の版で throw**(文言は「効果がない」)。`BoxChrome.size` の型は残す期間の warn のため、型の `@deprecated` を付ける。
- **`hero`(18px)を削除**: `tokens.ts:101` と `types.ts:38` 以外に、どの worktree・skill・slidev addon でも使われていない(`test/types/options.ts:58` は `@ts-expect-error` で、削除後もエラーのまま成立する)。`Role` は公開型なので破壊的変更になる。ADR 0002 の「`hero` は触らない」を覆すことをここに明記する。
- **大きい文字の入口**は、**ロールで選ぶ**(`labelScale` の小数倍は採らない: ADR 自身の「任意 px ではなくロールを広げる」原則に合わない):
  - `banner` の見出し: `headlineRole: 'banner' | 'stat' | 'display'`(`size` は `box({size})`〔px・無効〕と `stat({size})`〔ロール〕の 2 つの意味を既に持つので、3 つ目にしない)。
  - `bars` / `plane` の軸ラベル・値ラベル: `labelRole: 'note' | 'banner' | 'stat'`。
- **前提**: §0-3(plane の文字サイズの出どころを 1 か所に)。そのうえで、`barsTexts` / `planeTexts` に拡大後の大きさを登録する(登録漏れは `widthOf` が 0 を返し警告も出ない)。plane の固定 px 値(`LABEL_H 20`、`padT 34/40`、`padB 40`、目盛りの `+16` / `+26`、寸法線のチップの高さ 24、`DIM_OFFSET 26` など)を、すべて拡大に連動させる。
- **fit**: `analyzeFit`(`fit.ts:34-42`)が最小文字サイズに数えるのは、箱の run・bars の texts・connect のラベルだけで、plane と table の文字は入っていない。本当の危険は、**大きい文字で図が高くなり、他の 14px の文字が縮小で 12px を割る**こと。plane と table の文字を `analyzeFit` に含めてから `labelRole` を入れる。fill の倍率(最大 1.8)と重なる上限(`labelRole: 'stat'` の 34px × 1.8 ≒ 61px)は、実装時に決める。

## 検討した代替案

| 案 | 判断 |
|---|---|
| bars の `labels: false` だけ(値ラベルのみ) | カテゴリラベルの余白(下の 33.6px)が空かない。3 段階にする |
| `axis: false` で基線まで消す | ハードル・階段は地面の線があって読める。基線は残し `baseline: false` で消す |
| `<title>` に値を残す | 子の `<title>` は `role="img"` に隠れて届かない。`<desc>` に追記し warn |
| band に id を足すだけで spotlight の bars を直す | 棒ごとの dim が壊れている原因が残る。§0-1 を先に |
| `mid` を各テーマに足す | 3:1 を満たすと accent に寄り、amber では同色。`solid` の昇格で 3 段階を作る |
| `secondary` トーン | 既存の `changed` と枠の色の差だけで区別できず、色だけに頼らない原則に反する |
| plane の曲線を Catmull-Rom + 制御点のクランプ | 実在しない山と谷ができデータを誤って表す。単調 3 次補間を既定にする |
| `labelScale`(小数倍) | 「任意 px ではなくロール」の原則に反し、plane の固定 px との連動も崩れる |
| `box({size})` を「任意 px の抜け道」として扱う | 実際は何もしない引数。warn → throw で削除 |

**§0 の例外に、fit の警告も含める**: §8 で plane と table の文字を `analyzeFit` に含めると、既存の図の**警告**(SVG ではなく fit の warnings)が増えうる。「1 バイトも変えない」は SVG の話なので矛盾しないが、ここに明記する。

## 実装順と受け入れ条件

0. **前提のバグ修正(別 PR)**: bars の棒ごとの dim、grouprow の reveal 継承、plane の文字サイズの出どころ、swimlane の id。
1. **bars の出し分けと最小高さ・棒の幅(§1・§2)**: ハードル(`dir: 'v'`、`labels: 'none'`、`height: 60` でプロット領域 ≥ 50px)と階段(間隔 0)が bars で作れること。値の `<desc>` 追記と `bars-values-hidden`。
2. **reveal と spotlight の受け皿(§3・§4)**: stat / bars band / caption / plane の要素 / versus。付けられないものは構築関数で throw。
3. **table の `rowHeader`(§6)**。
4. **plane の `paths`(§5)**: 単調 3 次補間を既定に。
5. **文字(§8)**: `hero` の削除、`size` の warn、`headlineRole`、`labelRole`(plane / table の fit を先に)。
6. **色(§7)**: `EmphasisTone` の追加と `solid` / `solid-danger` の文字色・コントラスト検査の修正。実際の図で 3 段階を確かめる。`mid` は最後の手段。

どの段階でも `pnpm test` / `pnpm typecheck` / `pnpm golden` を通す。**新しい指定を使わない図の出力は 1 バイトも変えない。ただし §0 のバグ修正は例外**(変わってよい対象は §0 に列挙したものだけ)。各項目に `examples/` の図を足す。

## 影響とリスク

- 良い点: 実際の資料で HTML のまま残った図(ハードル・階段)が、bars で作れる。reveal / spotlight が黙って効かないものが一覧で分かる。新しい色を足さずに主役 / 次点 / その他の 3 段階が作れる。
- リスク:
  - ラベルなし・目盛りなしの bars は量を値で読めない。`<desc>` への自動追記と warn、README の運用で補う。
  - §0 のバグ修正は既存の出力(spotlight の bars、reveal の段階ファイル、fill モードの plane)を変える。
  - `solid` / `solid-danger` の `BoxTone` への昇格は、`DEFAULT_LEGEND_LABELS`・`usedNotation`・`legend-missing` に及ぶ。#27 の `weight` が凡例に項目を足したので、凡例・notation の整合を確かめる。
  - `hero` の削除は公開型 `Role` の破壊的変更。
- 未決: `solid` の凡例ラベルの文言、`labelRole` の上限(fill との重なり)、`barRatio` の既定、`rowheader-tone-collides` の severity。
