# ADR 0014: 整列と余白を、生成時の既定で美しくする(格子に乗った幅・間隔、枠の余りの配分、内容の中央寄せ。`check` は物差しと取りこぼしの網)

- 状態: 提案
- 日付: 2026-10-13
- 基点: `main`(4e58744、PR #124 まで)
- 関連: ADR 0009(折れ・端点整列。自動配置の線)、ADR 0010(幅の自動調整・非連結成分)、ADR 0008(同じ依頼元)、ADR 0005 #8(文字を 4px の格子に丸める案の見送り)

## 背景

ユーザーから次の要望が来た。

> 余白が大きいというか、左揃え・中央揃えなどができていない。もっとレイアウトを美しいと思えるようにしてほしい。

方針は次のとおり(ユーザーの確認済み)。

- **理想は、最初から美しい配置が出ること。** 主役は生成側の既定。`check` は補助で、(a) 生成側を直したかを測る物差しと、(b) 手書き座標や `connect` など生成側で直せない所の取りこぼしの網にする。
- 依頼の原文(medius 資料づくり)の C2(`row` の中の `group` の高さ揃えで空白)、B3(非連結成分の空白)、A2(端点の整列)のうち、B3 と A2 は ADR 0009 / 0010 の範囲。**本 ADR は、それらと重ならない「部品の既定の整列と余白」を扱う。**

## 観察(事実)

`examples/out/*.svg`(115 枚。段階表示の派生を除く)を、寸法と座標で調べた。画像でも目視した(`contact-sheet.ts` で 12 枚ずつ)。測定は scratchpad のスクリプトで行い、リポジトリには残していない。数字は SVG の座標そのもの。

### O1. 等しい列が 4px ずれる(最も広く出ている)

`row({cols: [6, 6]})`、`row([a, b])`(`justify: 'stretch'`)など、**等分したはずの兄弟の幅が、444 と 440 になる**。内容幅 900、gap 16 なら列幅は 442 ずつで、4px の格子に乗らない。`lib/layout.ts` の `rowChildGeometry`(`:231-266`)は 442 で配置し、`lib/emit.ts:141` の `renderBoxRect` が左端と右端を別々に `snap4`(`:31`)で丸める。左は x=20、右端は 462 → 464、右の枠は 478 → 480 から 920。結果は幅 444 と 440。

- 再現(同じ `group` を 2 つ並べるだけ。`examples/versus.ts` 系と同じ形): `x=20 w=444` と `x=480 w=440`。中の箱は `x=36 w=412` と `x=496 w=408`。**左右の枠の幅が違い、中の箱の幅も違う。**
- group の題の文字は枠の丸め前の座標で置かれる。右の group の題は `x=494.00000000000006`、中の箱の左端は 496。**2px ずれ**(左は 36 と 36 で偶然合う)。
- 同じ形が、比べた図の 18 枚に出る(幅が 1〜4px だけ違う兄弟の組が 35 件): `versus`、`versus-manual`、`stat`、`dark-theme`、`emphasis`、`emphasis-tiers`(212/216/212/212)、`bracket-callout`(212/216/212/212)、`spotlight`(288/292/288)、`column-grid`(264/260/264)、`steps`(168/168/164/168/168)、`icons`、`class-diagram`(176/180)、`cloud-architecture`(420/416)、`qc-affinity`、`quadrant-risk`(264/260/260)、`inventory-*`。
- `quadrant-ge` と `quadrant-risk` は、マス同士の間隔が 8 と 4 を行き来する(gap が 6 で、丸めで 4 か 8 になる)。**間隔が不均一。**
- 一方、`canvas`(`lib/layout.ts:927`、`:947`)は、すでに「縁をすべて 4px の格子に乗せる」ことを意識して行を `Math.ceil(v / 4) * 4` で組む。**同じ考えが row / grid / group には入っていない。**
- `examples/out/qc-relation.svg` には、横に並ぶ 2 つの節で上端が 24 と 20(4px 差)の組がある。原因は未調査(層状レイアウトか丸めか)。

### O2. 枠が中身より大きく、下が空く(上詰めのまま、余りが配られない)

- **`row` の中の `group`(C2 そのもの)。** `lib/layout.ts:862-890`(`grouprow`)は、各 child を独立に置いたあと、**枠だけ**を最も高い child の高さに引き伸ばす。コメントに「a group's inner content keeps its natural height」とある。再現: 左の group に箱 4 つ、右に箱 1 つを並べると、右の枠は `y=20 h=320`、中の箱は `y=64〜116`。**枠の下 224px(70%)が空**。
- `small-constraints.svg`: 左の表(`cellH: 44`)に合わせて右の `box` が `y=56 h=176`。文字は `y=86` と `114.6` で終わり、**下の約 113px(64%)が空**(stamp が下の帯を取るため、機械的な測定では見えにくい)。
- **`canvas`(business model / empathy / 5 forces / 7S / SWOT / VPC)。** 高さを `cv.aspect * cw`(`lib/layout.ts:942`、`lib/canvas.ts:40-126`)の床にして、内容の高さは使わない。実測(枠の下の空き): `canvas-seven-s` の `216x248` の枠で 186px(75%)、`canvas-bmc` の `172x388` で 269px(69%)、`canvas-empathy` の `292x212` で 150px(71%)、`canvas-five-forces` で 126px(58%)、`canvas-swot` の `444x220` で 101px(46%)、`canvas-vpc` で 85px(48%)。
- `hero.svg`: 3 枚の札(`188x140` など)は、文字が `y=121〜153` で終わり、**下の約 78px(56%)が空**。4 枚目の `-67%`(56px の文字)の高さ 140 に合わせた結果。同じ行で札の文字は左揃い、4 枚目だけ中央揃い。
- **`semnet-causal` / `semnet-pert`。** 図の高さは書き手が与える(`height: 250`)。内容は `y=47〜104` で 57px。`networkCanvas`(`lib/semnet.ts:88`)は横は中央(`ox`)に置くのに、縦は `oy = g.y + 8` の**上詰め**。下に 164px の空き(上は 32px)。
- `slide-canvas.svg`(1280x720): 内容は `y=36〜492`、下に 228px。上詰めで、縦の中央には置かない。

### O3. 図の内容が左右どちらかに寄る

- `concentric-stakeholders`: 円は `x=36〜476`、ラベルは `x=484` から(「顧客と取引先」は全角 6 字で約 84px、右端は約 570)。内容は 36〜570 で、幅 940 の中で**左が 36、右が約 370**。円とラベルを合わせた塊を中央に置いていない(`concentric-security` は円だけなので中央)。
- 自動配置の図(`qc-relation`、`toc-crt`、`qc-pdpc`、`class-diagram`、`qc-systematic` など)は、内容が左右対称に置かれる(例: `qc-relation` は `x=276〜664`、左右とも 276)。**偏りではなく、キャンバス幅(940)に対して内容が細い**(`qc-relation` 388px = 41%、`toc-crt` 364px、`qc-pdpc` 340px、`class-diagram` 444px、`chevron-vertical` 420px、`cycle-learning` 448px)。これは「余白が大きい」の主な原因だが、**幅を内容に合わせるか**は別の決定(下の D6)。

### O4. 揃え方が部品で食い違う(観察のみ)

- 既定の `align` は、`box` / `group` の題が左、`stat` / `banner` / `caption` の既定が中央。`hero` のように同じ行に両方を置くと、札の文字が左と中央で混ざる(上記)。**部品の意味(数字は中央、説明は左)としては意図どおり**で、直す対象とは限らない。
- `box` に縦方向の揃え(`valign`)は無い(表の cell にだけある: `lib/types.ts:1463` の `vAlign`)。`row` の `justify`(`lib/types.ts:502`)は横の配り方だけ。`group` の `titleAlign` はある。

### コードの現状(事実)

| 項目 | 場所 | 今の挙動 |
|---|---|---|
| 行の列幅 | `lib/layout.ts` `rowChildGeometry`(`:231`) | 実数のまま計算。4px の格子を考えない |
| 枠の描画 | `lib/emit.ts:141` | 左端と右端を別々に `round(n / 4) * 4`。文字は丸めない(ADR 0005 #8 で見送り) |
| 枠の引き伸ばし | `lib/layout.ts:862-890`(`grouprow`)、`:895-`(`row`) | 枠・箱の `h` だけを伸ばす。中身は動かない |
| 箱の中の文字 | `lib/emit.ts:146-` `renderBoxText` | `y = band.y + padY` から。上詰め |
| canvas の高さ | `lib/layout.ts:941-948` | `aspect * cw` が床。行は 4px の格子 |
| 図の幅 | `lib/types.ts`(`DiagramOpts`、内部の `maxWidth`) | 既定 940 の固定。内容に合わせて狭めない |
| `check` の整列・余白の規則 | `lib/rules.ts` | **無い**(`quadrant-empty-cell`、`canvas-region-empty` は「空のマス」だけ)。折れ数は ADR 0009 の `edge-bends`(提案) |
| `check` の出力 | `check-diagram.ts:75`, `:245`, `:253` | 所見は `{file, line, rule, severity, message}`。`info` は `--strict` でも落とさない。`--format json` あり |

## 指標を examples に当てた実測

候補の指標を、**SVG の座標に対する代用の計算**で `examples/out/*.svg` 全部に当てた(実装は `LaidOut` の帯に対して行うので、ここは「何が出るか・誤検出はあるか」の見積もり)。閾値は原則から決めたもので、examples に合わせて調整していない。

| 指標(案の規則名) | 定義 | 検出 | 実際に直すべきもの(目視と座標で確認) | 誤検出・限界 |
|---|---|---|---|---|
| 兄弟の大きさの不揃い(`layout-sibling-size`) | 同じ行の兄弟の幅(高さ)が 1〜4px だけ違う | 18 枚 / 35 組(幅) | 18 枚とも O1 の丸め(`cols` の等分)で、**生成側で直せる** | 無し。ただし `inventory-*` は箱を自作の座標で置くので、4px の差は手書き由来の可能性(未確認) |
| 縁の近接ずれ(`layout-edge-misalign`) | 縦に重なる枠の左端(右端)、横に並ぶ枠の上端が 1〜4px 違う(0 は一致、5px 以上は別物として扱う) | 4 枚(`inventory-component-spec`、`inventory-wireframe`、`qc-relation`) | `inventory-component-spec`(144/148 が交互)は手書き座標、`qc-relation` は未調査 | 少ない。見逃しは、5px 以上のずれ |
| 間隔の不均一(`layout-gutter-uneven`) | 同じ行の兄弟の間の gap の最大と最小が 2px 以上違う | 3 枚(`quadrant-ge`、`quadrant-risk`、`org-chart`) | `quadrant-*` の 8/4 は O1 の丸め | `org-chart` の `[160, 68]` は木の配置で、意図(誤検出)。木・マインドマップは対象から外す |
| 枠の中の余り(`layout-unused-space`) | 枠(`box` / `group` / canvas の領域)の下の余りが 48px 以上、かつ高さの 40% 以上 | 20 枚 / 59 枠 | 本物: `canvas-*` 6 枚、`hero`、(`small-constraints`)。8 枚ほど | **誤検出が多い**: `quadrant-*`(点が座標で置かれる。余りは意図)、`image*`(画像の上の注釈)、`inventory-*` / `bpmn`(ワイヤーフレームとレーン)、`venn`。**部品ごとの除外が要る**(`LaidOut` の帯の種類で決められる。SVG からは決められない) |
| 図全体の左右の偏り(`layout-figure-offset`) | 内容の外接矩形の左右の余白の差が 48px 以上(出典行は除く) | SVG の代用では 20 枚が出たが、**全部が誤検出**(出典行が `x=20` から始まるため、グラフ・軸のラベルの見積もりのずれ) | `concentric-stakeholders` だけ(O3)。ただし代用の測定では見つからなかった(円の 36〜476 とラベルを別に数えたため) | **SVG からは出せない。`LaidOut` の帯の外接矩形(ラベル込み)で測る**。出典行は除く |
| 図が細い(`layout-figure-narrow`) | 内容幅が図の幅の 50% 未満 | 20 枚 | 偏りでなく幅の問題(O3)。`funnel`、`cycle`、`concentric`、`people`、`chevron-vertical` は中央で意図どおり | 「直すべき」とは限らない。**情報(info)のみ**にして、直し方に `diagram({width})` を示す |
| 孤立した大きな空白(`layout-void`、矩形の最大空き) | 内容の外接矩形の中の最大の空き矩形が 96px 角以上かつ 12% 以上 | 34 枚 | `people`(67%)、`people-two-tone`、`image-labels`(62%) など、**図全体の構成の問題** | **誤検出が非常に多い**: 層状・木の図は隅が三角に空くのが普通(`qc-relation` の 256x1144 など)。**規則として採用しない**(測定で効かなかったことを記録する) |
| 揃えの不統一(`layout-align-mixed`) | 同じ行の箱の `text-anchor` が混在 | **未測定**(`hero` で 1 件を確認しただけ) | 意図(数字は中央)が多いと見込む | 優先度は低い。着手時に測る |

**結論。** 兄弟の大きさ・間隔・枠の余りは、規則として使える(後 2 つは帯の種類による除外が前提)。偏りは `LaidOut` で測る。孤立した大きな空白は採用しない。

## 論点

1. 整列の既定を、何にするか(格子・兄弟の等幅・等間隔・枠の余りの配分・内容の中央寄せ・テキストの揃え)。
2. 既存の図の SVG が変わる範囲をどう制御するか(既定で変える / opt-in)と、golden の更新と承認の手順。
3. `check` の指標をどう位置づけるか(補助。生成側が直ったら指標が良くなることを受け入れ条件にする)。
4. 実装の分担と、ADR 0009 / 0010 とのファイル・関数の衝突。

## 決定

### D1. 原則(生成時の既定で守る 5 つ)

1. **横の列の区切りを、4px の格子の上で、内容幅ごとに 1 回だけ決める。** 今は描画で左端と右端を別々に丸めている。配置の段階で、(内容幅, `cols`, 宣言された gap)の組ごとに、列の区切りを **12 列(`cols` 列)の格子として 1 回だけ**計算する。左から累積で、各列の左端・右端を 4px の格子に丸め、**同じ組を持つすべての行がその区切りを共有する**(`lib/layout.ts:443` の `grids` が、行をまたいで gap を共有する今の仕組みと同じ向き)。**行ごとに gap を変えない**(変えると、`cols` の縦の揃えが壊れる)。中の箱・group の題の文字の原点(x)は、この格子に乗った左端から出す。縦(上端・下端・文字の y)の格子化は、**本 ADR の第 1 段には入れない**(下の D1 の注と U1b)。`emit` の `snap4` は安全網として残す。
2. **同じ行(列)の兄弟は、できるだけ等しい幅にする。** 等分の行(同じ span・`justify: 'stretch'`)では、1 の累積の丸めで、**幅の差が 0 か 4px の 1 つだけ**になる。内容幅 900・gap 16・2 列なら、区切りは左の列が 20〜460、右の列が 480〜920(幅 440 ずつ、見かけの gap は 20)。`flex` や span が違う兄弟は、比で割った値を同じ累積で丸める。`cols` を持たない行は、その行だけで同じ丸めをする。
3. **兄弟の間隔は均等にする。** 丸めで 8 と 4 を行き来させない(1 と同じ仕組みで直る)。
4. **枠の余りは、中身に配る。** 枠の高さが中身より大きいとき(行の高さ揃え、canvas の床)、中身を上に寄せたまま下を空けない。部品ごとの配り方を D2 に決める。
5. **図全体は、塊として中央に置く。** 内容の外接矩形(ラベル込み、出典行は除く)を、幅と(高さが与えられたとき)縦の中央に置く。

**D1 の注(縦の格子化は U1b で、横の U1 の次の PR)。** 上端・下端・文字の原点 y も、配置で格子に乗せる(**ユーザー決定: 縦も含めて一括で変える**)。ほぼ全図(約 120 枚)が最大 2px 動くことを承知の上である。ただし golden が大差分になるので、**PR は U1(横)→ U1b(縦)の 2 つに分ける**。

**ADR 0005 #8 / ADR 0008 #11 で見送った理由を、どう乗り越えたか。** 見送りの理由は 2 つだった。(i) 文字だけを丸めても、枠(rect)の丸めと文字の baseline の差が `c-2〜c+2` から「切り捨て」に変わるだけで、最悪値が直らない(ADR 0005 の測定: 635 個中 539 個が最大 2px 動き、良くなる位置と悪くなる位置が半々)。(ii) 全図が動くのに、検査の問題(`padY: 0` の 16px の見出しが枠の内側 4px を割る)は解けない。**本 ADR の案は、emit で丸めるのでなく、配置で枠の上端と文字の原点を同じ格子から出す**。枠の上端が常に 4 の倍数になるので、上端から baseline までの距離が位置によらず一定(`c`)になり、(i) の「位置で `c-2〜c+2` に振れる」原因そのものがなくなる。(ii) の検査の問題も、枠の上端が丸め前の `y` でなく格子の `y` になるため再現しなくなる(U1b の受け入れ条件で、ADR 0005 #8 の再現ソース=`padY: 0` の banner が `padY` の迂回なしで通ることを確かめる)。代償は「ほぼ全図が最大 2px 動く」ことで、**ユーザーが承知のうえで承認した**。


**カードの題の高さは揃えるので、箱の中の文字の縦位置は上詰めのままにする。** 箱の高さが違っても、行の中で題の `y` が揃う(`emphasis-tiers`、`hero`)ことのほうが、中央揃えより読みやすい。中央に置くのは、箱でなく「枠の中の箱の塊」と「図全体」。

### D2. 部品ごとの既定の変更

| 部品 | 直す所 | 既定の新しい挙動 | 区分(D3) |
|---|---|---|---|
| `row` / `grid` / `canvas` / `quadrant` の横の列 | `rowChildGeometry`、`gridChildGeometry`、`canvasColumns`(`lib/canvas.ts`)、`lib/quadrant.ts` | 列の区切りを内容幅ごとに 1 回だけ決め、4px の格子に累積で丸める。全行が共有する(D1-1〜3)。文字の原点(x)も格子の左端から出す(group の題が `494.00…` にならない) | 既定で変える(欠陥の修正)。横だけ |
| `row` の中の `group`(C2) | `lib/layout.ts` の `grouprow`(`:862-890`)、`GroupOpts` | 枠を伸ばすとき、題は上に、**題の下の中身(箱の列)を、余りの中で縦に中央に置く**。箱が複数なら、間隔を最大 +16px ずつまで広げ、なお余るぶんを上下に分ける。`group({valign: 'top' \| 'center' \| 'stretch'})` で変えられる(`'stretch'`: 箱が 1 つなら箱が枠いっぱいに伸びる)。余りが 16px 未満なら何もしない(上詰めのまま) | 既定で変える(余りが 16px 以上のときだけ SVG が変わる) |
| `canvas` | `lib/layout.ts:941-948`、`CanvasOpts` | **高さは内容から決める(既定。ユーザー決定済み)**。各行 = 領域の必要な高さ + 余白、最小の行高は 96px。`aspect` は `canvas(..., {fit: 'aspect'})` と明示したときだけ床になり、従来の見た目に戻せる。空の領域(`requireAll` でない)は最小の行高のまま | 既定で変える。**canvas の図はすべて SVG が変わる**(`examples/` では 6 枚)。U3 の条件に、変更前後の指標比較表と、`contact-sheet` の前後画像での目視承認を置く |
| `networkCanvas`(`semnet`: `pert` / `causalLoop` / `dependencyNetwork`) | `lib/semnet.ts:88`(`oy = g.y + 8`) | `height` が与えられて内容より高いとき、内容を縦の中央に置く(`oy = g.y + (h − naturalH·scale) / 2`) | 既定で変える(`semnet-causal` / `semnet-pert` の 2 枚と、ADR 0011 の図) |
| `concentric`(ラベル付き)ほか、単独の図形部品 | `lib/flow-shapes.ts` と `lib/layout.ts:328` / `:1046` | 円とラベルを合わせた外接矩形で中央に置く(`concentric-stakeholders`: 左 36 → 約 180)。ラベルなしは今のまま | 既定で変える(1 枚) |
| `box` の縦の揃え | `BoxChrome`(`lib/types.ts:299`)、`renderBoxText` | `valign?: 'top' \| 'center'`(既定 `'top'`)と、`row({valign})`(行の既定)。`hero` のように、書き手が「この行は中央」と決められる | opt-in(新しい項目) |
| `diagram` の幅 | `lib/types.ts` `DiagramOpts`、`lib/layout.ts`、`lib/emit.ts` | `diagram({width: 'fit'})`: 内容の外接矩形 + 余白に幅を縮める(文字の大きさは変えない)。既定の 940 は変えない | opt-in(O3 の細い図。**文書の幅が変わるので既定にしない**) |
| `canvas: 'slide'` の縦 | `lib/layout.ts` の slide 周り | `diagram({canvas: 'slide', valign: 'center'})`(opt-in)。既定は上詰め | opt-in |
| テキストの揃え | 既定は変えない | 部品の意味(数字・帯は中央、説明は左)が意図なので、既定は変えない。混在は `check`(`layout-align-mixed`、info)で知らせる | 変えない |
| 表・`banner`・`stat`・`caption`・`column` | 今回は既定を変えない | 調査では、これらの単体に整列の欠陥は見つからなかった(表の cell は `vAlign` を持つ。`banner` の文字は中央)。行に入れたときの 4px(O1)は D2 の先頭の行で直る | - |
| `causeTree` / `relationDiagram` / `pdpc` / `stateDiagram` / `classDiagram` | **ADR 0009 / 0010 に任せる** | 端点の整列(0009)、非連結成分の詰め(0010 → 0009 U2)、幅の自動調整(0010)。本 ADR は触らない。キャンバスの幅に対して細い(O3)のは `width: 'fit'` で対応 | - |

### D3. 既存の図の SVG が変わる範囲の制御

3 つに分ける。

1. **既定で変える(欠陥の修正)**: D2 の「既定で変える」の行。**変わる図を、実装の前に実測で列挙する**(下の「変更前後の比較表」)。見積もり: 横の列の区切り(O1、U1)は 18 枚前後(動くのは主に 2px)、`grouprow` の余りは `examples/` に現れない(再現の合成図で確かめる)、`canvas` は 6 枚(内容駆動の既定。**すべて大きく変わる**)、`semnet` は 2 枚、`concentric` は 1 枚、**縦の格子化(U1b)はほぼ全図(約 120 枚)が最大 2px**。
2. **opt-in**: `valign`、`width: 'fit'`、`canvas: 'slide'` の `valign`、`group({valign: 'stretch'})`、`canvas({fit: 'aspect'})`(従来に戻す)、`diagram({layoutCheck: 'strict'})`(D4)。
3. **変えない**: 木・マインドマップ・層状の配置の座標(0009 / 0010 の範囲)、表・banner・stat の既定の揃え。

**golden の更新の手順(PR ごと)。**

1. 直前の `main` で `pnpm golden` を通した状態から始める。
2. 実装後、`pnpm golden` が報告する差分の図を全部列挙する。**列挙した図が、PR の説明にある「変わると予告した図」と一致すること。** 予告にない図が動いたら、理由が説明できるまで通さない。
3. 動いた図は、`diff-svg.ts`(`lib/svg-diff.ts`)で、何が何px動いたかを説明に付ける。ほとんどが 2px の移動(O1)なら、そう書く。
4. `contact-sheet.ts` で「変更前 / 変更後」を並べた画像を作り、PR に貼る。**目視で、悪化した図が無いことを書き手(担当エージェント)と、もう 1 人(レビューか別のエージェント)が確かめる。** 変更前の PNG は、同じ `contact-sheet.ts` を直前の `main` で実行して作る。
5. `examples/out/` を再生成して同じ PR に含める(`golden` が通る状態でマージ)。

**PR に載せる変更前後の指標比較表**(必須)。D4 の指標を、PR 直前の `main` と変更後で、`examples/` 全図に当てる。列は「図 / 規則 / 件数(前 → 後)/ 悪化の有無」。**悪化した図があれば通さない**(ADR 0009 と同じ基準。悪化 = 件数の増加、または枠の余りの増加)。生成側の PR は、**自分が直す対象の規則の件数が下がること**が受け入れ条件(指標が先ではなく、生成を直した結果として指標が良くなること)。

**動いてはいけない図の固定**: 上の「変えない」に挙げた部品の図(木・マインドマップ・層状・表・banner・stat)で、格子に影響を受けない図は byte 同一であること(各 PR 直前の `main` と比較)。(**U1b を除く**。U1b はほぼ全図が動く。下の手順で承認する)

**U1b(縦の格子化)の PR の条件。** 全図が動く PR なので、「視覚上同一」を自動比較で示す。

1. **動く図の全リスト**を PR に載せる(図の名前 / 動いた要素の数 / 最大の動き(px)/ 動いた方向)。`examples/` 全図(約 115 枚)と、`test/` が作る図が対象。リストに無い図が動いたら通さない。
2. **構造が不変**であること(自動): 要素の種類と数、文字の内容と順、id、`<metadata>` の `sourceSha256` 以外、`verify` と lint の所見の集合が、前後で同じ。
3. **動きが小さい**こと(自動): `diff-svg.ts` で、同じ要素どうしの座標の差を測り、**最大 2px(x は 0)を超える要素が無い**。超えたら理由が説明できるまで通さない。
4. **見え方が同じ**こと(自動 + 目視): 前後を `raster.ts`(resvg)で同じ解像度に描き、図ごとに「画素の差の割合」と「2px のずらしを許した差(1 画素のずれを許す比較)」を出す。後者が 0 に近いことを根拠にする(2px の移動は、前者では差として出るが、後者では出ない)。さらに **`contact-sheet.ts` の前後を並べた画像を全図について作り**、PR に貼る。動きの最大が大きい上位 10 枚と、種類の違う部品を 1 枚ずつ(表、banner、swimlane、chart、wireframe など)は、100% の拡大で見る。**目視は、担当エージェントとレビュー 1 人**が行い、悪化した図が無いことを PR に書く。
5. **ADR 0005 #8 の再現**(`padY: 0` の banner)が `padY` の迂回なしで lint を通る。
6. **指標比較表**(上)。`layout-*` の件数は、悪化(増加)しないこと。


### D4. `check` の品質指標(補助)

**位置づけ。** (a) 生成側の PR の前後比較に使う物差し、(b) 手書き座標(`raw()`、`inventory-*`、`connect` の `annot`、自作の `plane` など)や、生成側で直せない所の取りこぼしの網。**既定の整列を担うのは生成側で、指標は直さない。**

**規則(`lib/rules.ts` の既存の形に合わせる)。** 既存の規則は `{rule, severity: 'warn' | 'info', message}` を返し、`RULE_DOCS`(`lib/rules.ts:30-78`)に説明を持ち、`accept`(`.svg-diagram.json` と `diagram({accept})`)で理由つきで許容できる。同じ形で次を足す。

| 規則 | 重大度(初期) | 内容 |
|---|---|---|
| `layout-sibling-size` | info | **等分の行**(同じ span・`stretch`)の兄弟の幅が 1〜4px だけ違う(`flex` や span が違う兄弟は対象外) |
| `layout-edge-misalign` | info | 隣り合う枠の縁が 1〜4px ずれている(0 は一致)。**自動配置の帯(層状・木)は対象外** |
| `layout-gutter-uneven` | info | 同じ行の兄弟の間隔が 2px 以上不均一(木・マインドマップは対象外) |
| `layout-unused-space` | info | 枠の中の余りが 48px 以上かつ 40% 以上(除外: `quadrant` の点、`image` の注釈、ワイヤーフレーム、`bpmn` / swimlane のレーン、stamp の帯、`height` を書き手が与えた `semnet`) |
| `layout-figure-offset` | info | 内容(ラベル込み、出典行を除く)の左右の余白が 48px 以上違う |
| `layout-figure-narrow` | info | 内容が図の幅の 50% 未満(直し方に `diagram({width: 'fit'})`) |
| `layout-align-mixed` | info | 同じ行の箱で `align` が混在(着手時に測って決める) |
| (`孤立した大きな空白` は採用しない) | - | 実測で誤検出が多い(上の表) |

- **閾値は原則から固定する**(4px の格子、1 行の高さ 24px の 2 倍、40% など)。**examples に合わせて決めない**。決めた閾値は `RULE_DOCS` に理由とともに書く。
- **初期は全部 info。** `--strict` を使う既存の CI は落ちない(`check-diagram.ts:253` は info で終了コードを変えない)。warn への格上げは、生成側の PR が入って examples で 0 件になった規則から、**別の PR で、一つずつ**。**いつ上げるか**は、その規則を全 examples と手元の依頼者の図で 0 件にしたあと。
- **`diagram({layoutCheck: 'strict'})`(図ごとの opt-in)で、その図だけ `layout-*` を warn にする。**
  - 名前と型: `layoutCheck?: 'info' | 'strict'`(既定 `'info'`)。`DiagramOpts`(`lib/types.ts`)に足し、`lib/dsl.ts` の `diagram()` で検証する(他の値は throw)。`lib/strict.ts` の未知のオプション検査にも載せる。
  - 効果: `'strict'` の図では、`layout-*` の所見(と、ADR 0009 D6 の `edge-bends`)の重大度が `warn` になる。**`check --strict` はその図で落ちる**(`info` の図は落ちない)。`accept`(理由つき)で、規則ごとの許容はできる。
  - **SVG への影響は無い。** `layoutCheck` は検査の設定なので、描画(座標・属性・`<metadata id="svg-diagram">`)には出さない。したがって、このオプションを足しても既存の SVG は byte 同一で、`--drift` の差分も出ない。`check` はソースから図を組み立てて規則を評価するので、SVG に埋めなくても読める。SVG だけを見て検査する経路(`--svg-dir` だけの検査)が将来必要になったら、そのときに別の ADR で `metadata` への追記を決める(全 SVG が変わるので今は入れない)。
  - **ADR 0009 D6 の `edge-bends` も、同じ仕組みに乗る**(`layoutCheck: 'strict'` の図では warn)。0009 側の記述は別途更新される。重大度を決める関数は 1 つ(`lib/rules.ts` の `layoutSeverity(d)`)にして、`layout-*` と `edge-bends` の両方がそれを呼ぶ。
  - 実装は U0 に含める(`lib/types.ts` / `lib/dsl.ts` / `lib/strict.ts` の 1 項目と、`lib/rules.ts` の重大度の関数。**「型は最後」の例外**。`DiagramOpts` に 1 行足すだけで、0010 U4 の `maxWidth` と同じ型の別の行)。docs: README の `check` の規則の一覧と `diagram()` のオプションの表に、`layoutCheck` と、`'strict'` にしたときに `--strict` で落ちること、`accept` の書き方を例つきで足す。
  - テスト(U0): 既定で `layout-*` が info、`'strict'` で warn、`check --strict` の終了コードが `'strict'` の図だけ 1 になる、不正な値で throw、`'strict'` を付けても SVG が byte 同一。
- **所見は、どの要素がどれだけずれたか・空いているか、直し方つき**にする。例: `layout-unused-space: group「役割」の下に 224px(70%)の空き。row({valign: 'center'}) か、group({valign: 'center'}) を使う`。`LaidOut` の帯から、帯の id・位置・寸法を取り出す。
- **ADR 0009 の `edge-bends` と共通化する。** `edge-bends`(折れの数)も、本 ADR の規則も、「図の品質の物差し」。実装は次のようにまとめる。
  - 新規 `lib/layout-metrics.ts`(`LaidOut` の帯を入力にして、各指標の生の数を返す純関数。ADR 0007 の純粋な核)。ADR 0009 U1 の `lib/polyline-metrics.ts`(折れ・交差)とは**別ファイル**にして、`lib/rules.ts` の `layoutQualityRules()` から両方を呼ぶ。
  - 規則名の接頭辞は、本 ADR は `layout-`。`edge-bends`(0009)は名前を変えない。
  - 重大度・`accept` の扱い・出力の形は同じ。

### D5. 出力の形(`--format json` / `--verbose`)

- 所見に、機械が読む `data` を足す(`check-diagram.ts:75` の `CheckFinding` を拡張。**既存の項目は変えない**): `{file, line, rule, severity, message, data?: {band?: string, measured: number, threshold: number, fix?: string}}`。`data` は `--format json` でだけ出す。text の出力は、今の 1 行のまま(`info` は `--verbose` のときだけ。今の挙動)。
- **総合スコアは入れない(見送り)。** 規則ごとの件数で足りる。スコアの式と重みは、決めても説明が増えるだけで、CI の判定には使えない。必要になったら別の ADR で。
- `--format github` は、info を `::notice` で出すかを実装時に決める(今は warn のみ。要確認)。

### D6. 細い図(`width: 'fit'`)は、opt-in

内容の幅が、キャンバス幅(940)の 50% 以下の図が 20 枚ある。文書に貼ったとき、文字の大きさと余白の比が変わるので、**既定にはしない**(ADR 0010 の `diagram({maxWidth})` が上限、本 ADR の `width: 'fit'` が内容に合わせる縮め、と並べて README に書く)。`layout-figure-narrow`(info)で知らせる。

## 代替案

- **`check` を主役にして、整列の指標で図を採点し、悪い図を手で直してもらう。** 却下。ユーザーの方針(最初から美しい配置)に反する。指標は物差しと網に使う。
- **描画で丸めるのをやめ、実数のまま描く(`snap4` を外す)。** 却下。今、枠の線が 2.5px で、半端な座標だと線がにじむ。ADR 0005 の見送りも、全図の差分を伴うことが理由だった。**配置の段階で格子に乗せる**ほうが、見た目が同じで、枠と中の文字の差が出ない。
- **文字だけを 4px の格子に丸める(ADR 0005 #8 の案そのまま)。** 却下のまま。丸めの誤差が切り捨てに変わるだけで、最悪値が悪化する場合がある。**本 ADR は、emit で丸めず、配置で枠も文字も同じ格子から出す**(D1 の注)ので、この案とは違う。
- **カードの文字を、既定で縦中央にする。** 却下。題の高さが行の中で揃わなくなる(D1 の注)。書き手が `valign: 'center'` で選ぶ。
- **canvas の `aspect` を既定のまま、床だけ下げる。** 却下。内容駆動のほうが、図の高さが内容と一致する(ユーザー決定)。「空欄を埋める用紙」としての広い枠が要る書き手は、`fit: 'aspect'` で従来に戻せる。
- **`width: 'fit'` を既定にする。** 却下。文書の幅が変わる。
- **孤立した大きな空白を、規則にする。** 却下。層状・木の図は、隅が三角に空くのが普通で、実測で 34 枚が出て、ほとんどが誤検出だった。

## 影響

- 既定で変える図: 横の列の区切りで約 18 枚(動くのは主に 2px)、`canvas` 6 枚(大きく変わる)、`semnet-causal` / `semnet-pert`、`concentric-stakeholders`、縦の格子化でほぼ全図(約 120 枚、最大 2px)。`pnpm golden` の差分として出る。**ADR 0009 / 0010 の PR が先に入ると、基準が動く**ので、各 PR は直前の `main` と比べる(0009 の方式と同じ)。
- **縦の格子化(U1b)は、U1 とは別の PR。** 上端・下端・文字の原点 y を配置で格子に乗せる。ほぼ全図が最大 2px 動く(ADR 0005 #8 / 0008 #11 で見送った案と同規模。乗り越えた理由は D1 の注、ユーザー承認済み)。golden の大差分は、動く図の全リストと、視覚上同一と言える根拠(D3)を条件にして通す。
- 公開 API の追加(すべて省略可能): `group({valign})`、`box({valign})`、`row({valign})`、`canvas({fit})`、`diagram({width: 'fit', valign, layoutCheck})`。`lib/types.ts` / `lib/strict.ts` / `lib/dsl.ts` の型の追加は、0009 U8 と同じく**最後にまとめる**(下の順序)。**例外: `layoutCheck` だけは U0 に含める**(`check` の重大度が読むため。D4)。
- `check` に `layout-*` の規則(info)が増える。`--strict` の既存の CI は落ちない。`accept` に規則名を書けば許容できる。
- 並びの変更の副作用: 列の区切りが最大 ±4px 動くので、`connect` の経路が動く図がある(`loop-under` などの位置は箱の位置から出るので追従する)。

## 実装計画

並列エージェントで進める。各単位は自分の worktree で作業し、触るファイルを下の表に限る。**基点は各 PR 直前の `main`**。型の追加は最後(U9)。

| 単位 | 内容 | 触るファイル | 依存 |
|---|---|---|---|
| U0(測定) | `layoutCheck` の型・検証・重大度(D4)と、`lib/layout-metrics.ts`(`LaidOut` から指標の生の数を出す純関数)と `layoutQualityRules()`、`layout-*` の規則(info)、`RULE_DOCS`、`--format json` の `data`、README の規則の一覧。**出力は変えない**(既存の SVG は byte 同一) | 新規 `lib/layout-metrics.ts`、`lib/rules.ts`(`layoutQualityRules`、`layoutSeverity`、`RULE_DOCS`)、`lib/types.ts` / `lib/dsl.ts` / `lib/strict.ts`(`layoutCheck` の 1 項目)、`check-diagram.ts`(`CheckFinding` の `data`)、`README.md`、新規 `test/layout-metrics.test.ts` | なし。**独立の 1 単位。** 他の単位の前後どちらでもよいが、先に入ると、他の PR が「変更前後の表」を `check --format json` で作れる。入るまでは、PR の説明に scratchpad の測定スクリプトの結果を貼る |
| U1(横の列の区切り) | D1-1〜3。列の区切りの計算を 1 つの関数にまとめ(内容幅・`cols`・gap をキーに 1 回、左から累積で 4px の格子に丸める)、`rowChildGeometry`、`gridChildGeometry`、`canvasColumns`、`quadrant` がそれを使う。文字の原点 x を格子の左端から出す。**縦は触らない** | `lib/layout.ts`(`rowChildGeometry`、`gridChildGeometry`、`:407-450` の `grids`)、`lib/canvas.ts`(`canvasColumns`)、`lib/quadrant.ts`、`test/layout-grid.test.ts`(新規) | なし。**最初の組**(基準が動く。U2 以降が同じ `layout.ts` を触る) |
| U1b(縦の格子化) | 上端・下端・文字の原点 y を配置で格子に乗せる(`cursorY` の積み上げ、`padY`・行の間隔・文字の baseline の出し方を、4 の倍数の座標から出す)。ほぼ全図が最大 2px 動く。**条件(D3): 動く図の全リスト、視覚上同一の根拠(自動比較と目視)、ADR 0005 #8 の再現ソースが `padY` の迂回なしで通ること** | `lib/layout.ts`(縦の積み上げ全般)、`lib/emit.ts`(`snap4` は恒等になる。安全網として残す)、`examples/out/*.svg` の再生成、`test/layout-vgrid.test.ts`(新規) | **U1 のあと**(別の PR。U1 の `main` を基準にする)。U2 / U3 とは同じ `layout.ts` を触るので、U2・U3 が入ったあとか、U2・U3 が rebase して先に入れる(担当を 1 人にする) |
| U2(row / group) | D2: `grouprow` の余りの配分、`group({valign})`、`row({valign})`、`box({valign})` の描画 | `lib/layout.ts`(`grouprow`: `:862-890`)、`lib/emit.ts`(`renderBoxText`)、`test/layout-grid.test.ts`(新規) | U1 のあと(同じファイルの別の領域) |
| U3(canvas) | D2: 内容駆動の高さ(既定)、`fit: 'aspect'`(従来へ戻す) | `lib/layout.ts`(`:941-948`)、`lib/canvas.ts`(`canvasRowHeights`)、`examples/canvas-*.ts` の見直し、`test/canvas.test.ts` | U1 のあと。U2 とは別の領域なので並行してよい。**条件: 変更前後の指標比較表と、`contact-sheet` の前後画像での目視承認(canvas の図は全部 SVG が変わる)** |
| U4(semnet / 図形) | `networkCanvas` の縦中央、`concentric` の塊の中央寄せ | `lib/semnet.ts`(`:88`)、`lib/flow-shapes.ts`、`lib/layout.ts`(`:328`、`:1046`) | **ADR 0009 U0 / U4 のあと**(`networkCanvas` を `layeredAttempt` の形にする PR と同じ関数)。ADR 0011 C のあとでもよい |
| U5(`width: 'fit'` と `valign`) | `diagram({width: 'fit'})`、`diagram({canvas: 'slide', valign})` | `lib/layout.ts`(図の幅の確定)、`lib/emit.ts`、`lib/dsl.ts`(`diagram`) | **ADR 0010 U4 のあと**(`DiagramOpts` の `maxWidth` と同じ型・同じ関数) |
| U6(部品ごとの確認) | 表・banner・stat・column・chevron・quadrant・causeTree 系の画像を、U1〜U4 の後に目視で確認。直す点が出たら、単位を足す | なし(確認)。見つかった点は PR か ADR の追記 | U1〜U5 |
| U9(型と文書) | `lib/types.ts` / `lib/strict.ts` / `lib/dsl.ts` の新しい opts の型と検証(`layoutCheck` は U0)。README(整列の既定、`valign`、`width: 'fit'`、`layout-*` の規則、`layoutCheck`)、`skills/` の該当記述、この ADR の状態と「実装」の表 | `lib/types.ts`、`lib/strict.ts`、`lib/dsl.ts`、`README.md`、`skills/` | U1〜U5 のあと(各単位は opts の名前と型をコメントで宣言) |

**並列の進め方。** U0 と U1 を同時に始める(別のファイル)。U1 が入ったら、U2 と U3 を同時に(同じ `lib/layout.ts` の別の領域。マージ時の衝突は小さい)。U4 は 0009 の後。U5 は 0010 の後。U9 は最後。

### ADR 0009 / 0010 との衝突とマージ順

| ファイル・関数 | 本 ADR | 0009 / 0010 | 扱い |
|---|---|---|---|
| `lib/semnet.ts`(`networkCanvas`、`:83-95`) | U4(`oy` の縦中央) | 0009 U0(`layeredAttempt` の形に揃える)、0009 U4(候補の選択)、0011 C(inset) | **0009 U4 と 0011 C のあと**。`oy` の 1 行なので衝突は小さいが、同じ関数 |
| `lib/layout.ts` | U1 / U2 / U3(row、grouprow、canvas の領域) | 0010 U1〜U3 は `toc.ts` / `states.ts` / `tree.ts` が中心で `layout.ts` は触らない。0012 B(`scope` の接続)が `layout.ts` の `claimed()` 周りを触る | 0012 B と領域が別。0012 B が先に入るなら、そのあとで rebase |
| `lib/rules.ts` | U0(`layoutQualityRules`、`RULE_DOCS`) | 0009 U1(`edgeStats` の作り直し)、0009 U6(`edge-bends`)、0010 U4(`auto-fit-applied`) | 同じファイル。**`RULE_DOCS` の追加と `README.md` の規則の一覧が衝突しやすい**。U0 は `layoutQualityRules` を別の関数として足し、`RULE_DOCS` の行は最後にまとめて追記する。0009 U6 と 0010 U4 のあとに入れると楽 |
| `lib/types.ts` / `lib/dsl.ts` | U9(最後) | 0009 U8、0010 U4(`DiagramOpts.maxWidth`)、0011 B、0012 | 「型は最後」。U5 の `width: 'fit'` は 0010 U4 の `maxWidth` と同じ `DiagramOpts` に項目を足すので、0010 U4 のあと |
| `check-diagram.ts` | U0(`data`、`layout` の出力) | 0013(`lib/error-format.ts`、`check-diagram.ts` のループ) | 0013 のあと。同じファイルの別の領域(出力の整形とエラー) |
| `lib/graph-layout.ts`、`lib/layered-route.ts`、`lib/toc.ts`、`lib/states.ts`、`lib/classes.ts`、`lib/tree.ts` | **触らない** | 0009 / 0010 | 衝突なし |

**マージ順。** 全体の順序は **ADR 0009 の「実装順序」節に 0014 を追記する**(そちらが正)。0014 側は、次の対応だけを示す: U0(測定)と U1(横の列の区切り)は**最初の組**(0009 U0 より前でよい。別のファイルだが、全図の基準が動くので、0009 U0 の PR は U1 が入った `main` で再生成してから比べる)。**U4 は 0009 U4 と 0011 C の「後に必ず」**入れる(`networkCanvas` の同じ関数)。**U1b(縦の格子化)は U1 の次の別 PR**で、U2・U3 と同じ `lib/layout.ts` を触るため担当を 1 人にして順に入れる(全図が動くので、0009 の本体より前か、0010 のあとの静かな時期に入れ、基準を動かす回数を減らす)。U5 は 0010 U4 のあと。U9 は最後。

### テスト方針

- **U1(横の列の区切り)**: `test/layout-grid.test.ts`(新規)に、(a) `row({cols: [6, 6]})` と `row([a, b])` で、内容幅 900・gap 16 のとき、左右の枠の幅が等しく(440)、すべての横の縁が 4 の倍数。(b) **同じ `cols` を持つ複数の行で、同じ span の縁(左端・右端)が行をまたいで一致する**(例: `cols: 12` の行 3 本、span の組み合わせを変えて)。(c) 3 列・5 列で、幅の最大 − 最小が 0 か 4px。(d) group の題の文字の x と、中の箱の左端の差が、左右の group で同じ(494 と 496 の差が消える)。(e) `quadrant` の gap が一定。性質テスト: 内容幅 200〜900、gap 8〜24、`cols` 2〜12 の組を数百個、乱数の種を固定して、「横の縁がすべて 4 の倍数」「等分の行で幅の差が 4px 以内」「同じ `cols` の行で同じ span の縁が一致」「描画の `snap4` を通しても横の座標が変わらない」。縦(y)は変わらないことも byte で確かめる(`cols` を持たず割り切れる行の図は byte 同一)。
- **U2**: 再現の図(箱 4 つの group と箱 1 つの group を並べた行)で、枠の高さが同じ・中の箱が余りの中で縦中央・題の `y` が両方で同じ。余り 16px 未満なら byte 同一。`valign: 'top'` で従来と byte 同一。`group` が 1 つだけの行、ネストした group でも枠の中に収まる。
- **U3**: `canvas-*` の 6 枚で、各領域の中身の高さ + 余白 = 行の高さ(上限)、最小の行高 96px、空の領域の行高。`fit: 'aspect'` で従来と byte 同一(6 枚の旧 SVG を fixture に固定)。
- **U1b**: `test/layout-vgrid.test.ts`(新規)で、(a) すべての枠の上端・下端が 4 の倍数、(b) 枠の上端から題の baseline までの距離が、枠の位置によらず一定(ADR 0005 #8 の振れの再現: y を 0.25px 刻みで動かして、距離が変わらない)、(c) ADR 0005 #8 の再現ソース(`padY: 0` の 16px 見出しの banner)が `padY` の迂回なしで lint を通る、(d) 構造が不変(要素数、文字の内容と順、id、`verify` と lint の所見の集合が前後で同じ)。
- **U4**: `semnet-causal` の内容が `height` の中央に来る(上の余白 = 下の余白 ± 4px)。`height` が内容より小さいとき(0 以下の余り)は動かない。
- **U0(指標)**: 固定の `LaidOut` の入力に対して、各指標が期待の件数になる。除外(`quadrant` の点、`image` の注釈、stamp)で出ない。`accept` で許容できる。閾値の境界(47px / 48px、39% / 40%)。`--format json` の `data` の形、`info` が `--strict` で終了コードを変えない。**既存の `examples/` 全図の SVG が byte 同一**。
- **図の回帰**: D3 の「変更前後の指標比較表」を、各 PR の説明に付ける。**生成側の PR は、対象の規則の件数が下がること**を受け入れ条件にする。`test/layout-budget.test.ts`(新規。各 `examples/` 図の `layout-*` の件数の上限を、変更後の実測で固定。件数が増えたら落ちる)。
- **SVG の差分**: `pnpm golden` の差分を列挙し、予告した図と一致すること、`diff-svg.ts` と `contact-sheet.ts` で承認する(D3)。

## 未決

1. `group` の余りの配分(中央 / 間隔を広げる)の細部(間隔の上限 +16px など)は、再現の図と実例で見て決める。
2. `--format github` で info を `::notice` で出すか。
3. `qc-relation` の上端の 4px 差(24 と 20)の原因(層状レイアウトか、丸めか)。U1 の後に再測定して、0009 に渡すか決める。
4. `inventory-*` の 4px の差が、手書き座標か丸めか。U1 の後に再測定。
5. `layout-align-mixed` の測定(未測定)。


(解決済み: `canvas` の既定は内容駆動に決定(D2)。縦の格子化は U1b として一括で変えることに決定(D1 の注)。`layout-*` の warn は `diagram({layoutCheck: 'strict'})` の図だけ(D4)。)
