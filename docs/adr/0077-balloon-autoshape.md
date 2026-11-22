# ADR 0077: 吹き出しのオートシェイプ — `balloon()`(Office の `wedge*Callout` / `cloudCallout` に当たる部品)と、`bubble()` と分け合う 1 つの輪郭の生成

- 状態: 提案(Draft。2026-11-22。決める人の回答待ち。設計と小さなスパイクで、`lib/` は変えていない)
- 日付: 2026-11-22
- 基点: `main`(f32571ed、PR #433 まで)
- 番号: 0075 は PR #432、0076 は漫画の拡張の ADR(別のエージェントが下書き中)が使う見込みなので、その次の 0077 を取る。マージ前に `docs/adr/` と `gh pr list` で空きを確かめ直す
- 関連: ADR 0074(`comic()` / `bubble()`。D2 のしっぽと「楕円は後で `shape: 'ellipse'`」)、ADR 0069(freeform)、ADR 0050(組み合わせられる帯)、ADR 0012(id のスコープ)、ADR 0007(純粋な核)、ADR 0045(測定を外から渡す)、ADR 0071(JSON Schema)
- 範囲外: PPTX への書き出しの実装(下の D7 は材料だけ)。縦書き。吹き出しの自動配置(目標へ近づける)。`comic()` の側の実装(ADR 0074 の U1 は別のエージェントが進行中)。ここでは `lib/` を変えない
- 例の文はすべてこの ADR のための中立な作り話(「ここが変更点」「要確認」)

## 背景

決める人の依頼: 「吹き出しのオートシェイプを追加してほしい。office にもあるし」。Office(PowerPoint)の「図形」には、四角形・角丸四角形・楕円・雲の吹き出し、線の吹き出しがあり、尾(しっぽ)の先は黄色いハンドルで動かせる。svg-diagram では、箱に文字を入れて、どこかを指す、という図が毎回 `box` + `callout()` の組み合わせになる。

### コードで確かめたこと

| 部品 | 場所 | この ADR での関係 |
|---|---|---|
| `callout()` | `lib/layout-connect.ts` の `resolveAnnotation`(`kind: 'callout'`)、`examples/bracket-callout.ts` | **引き出し線 + 角丸の札**。目標の縁から 4px(`ANNOT_GAP`)手前で止まる 28px(`CALLOUT_LEN`)の線の先に、文字の札を置く。札と線は別の要素で、輪郭は 1 つにつながらない。コネクタの帯(`ConnectBand.annot`)で、箱ではない |
| 接続の参照 | `resolveRef` / `anchorPoint`(`id.side@at` の文字列) | 目標の指し方をそのまま使う(D2) |
| 帯の矩形の寄与 | `lib/verify-handlers.ts` の `rects`(各帯が「箱」として検査へ出す) | 吹き出しの本体を 1 つの箱として出す(D5) |
| ADR 0074 の `bubble()` | `comic()` の帯の中。`say` / `think` / `shout` / `narration`。しっぽは話し手の口へ向ける | 同じ「本体 + しっぽ」の輪郭。ADR 0074 の実装(U1)は進行中で、`feat/comic-u1`(ローカル、WIP `9e26b5be`。push されていない)の `lib/comic/layout.ts` の `tailOf` と `emit.ts` の `tailSvg` / `shapeSvg` は、**しっぽを別の三角形、本体を別の `<rect>` で描く** |
| PPTX | `lib/pptx/`(`prstGeom` を使う書き出しがある) | 将来の書き出しは、Office のプリセット名と `adj` で書ける(D7) |

### Office の形の定義(ECMA-376 `presetShapeDefinitions.xml` で確かめた)

リポジトリの外のコピー(`ooxml-rs/reference/ecma-376-drawingml-geometries/presetShapeDefinitions.xml`)の `gdLst` を読んだ。

- `wedgeRectCallout` / `wedgeRoundRectCallout`: `adj1`・`adj2` は**しっぽの先の、中心からのずれ**で、幅・高さの 1/100000(`dxPos = w*adj1/100000`、`dyPos = h*adj2/100000`、先は `(hc+dxPos, vc+dyPos)`)。既定は `adj1 = -20833`、`adj2 = 62500`(角丸は `adj3 = 16667`。角の半径は `ss*adj3/100000`、`ss = min(w, h)`)。付け根がある辺は、`|dyPos| > |dxPos*h/w|`(`dz > 0`)なら上下、そうでなければ左右。付け根の位置は**固定**: 辺の 2/12〜5/12(先が中心より左・上)か 7/12〜10/12(右・下)。つまり付け根の幅は辺の 1/4。
- `wedgeEllipseCallout`: 先の向きの媒介変数 `pang = atan2(dyPos*w, dxPos*h)` の ±660000(= ±11°)の 2 点が付け根。付け根から楕円の弧を長い側へ回って閉じる。
- `cloudCallout`: 雲の本体は 43200 × 43200 の座標に固定の 11 個の弧。しっぽは 3 つの円で、半径は `ss/12`、`ss/18`、`ss/36`(`g12`、`g25`、`g26`)。いちばん小さい円の中心が先。
- 文字の矩形(`<rect l t r b>`)は、角丸四角形で角の半径の 29.289%(`il = u1*29289/100000`)、楕円で幅・高さの `cos 45°` = 70.7%、雲で幅の 13.8%〜79.1%・高さの 15.1%〜80.3%(約 65%)。
- 線の吹き出し(`borderCallout1`、`accentCallout1`…)の `adj1`〜`adj4` は、線の始点 `(y1, x1)` と終点 `(y2, x2)` で、同じく高さ・幅の 1/100000。しっぽの輪郭は無く、箱 + 線。
- ギザギザ(`irregularSeal1` / `irregularSeal2`)や `star*` には `adj` の先(しっぽ)が無い。**Office には、しっぽのあるギザギザの吹き出しが無い**。

## スパイクの結果(`spikes/balloon-autoshape/`。`lib/` は触っていない)

`balloon.ts`(輪郭の生成。純粋で import なし)、`office.ts`(`wedgeRectCallout` の `gdLst` を 1 行ずつ写した評価)、`run.ts`(SVG と数字)。四角・角丸・楕円・雲を、本体 200×80 に、8 方向(45° ごと、縁から 50px)の目標で描いた。SVG は `spikes/balloon-autoshape/out/`(8 方向、近い目標、角の近く、Office の付け根との比較)。

| 測ったこと | 結果 |
|---|---|
| 8 方向 × 4 形 = 32 個 | すべて `M…Z` で閉じる。同じ入力は同じ文字列(決定的) |
| 付け根が輪郭の上にあるか(四角・角丸・楕円) | 輪郭からの距離の最大 7.9e-8 px(丸めの誤差)。つまり常に輪郭の上 |
| 四角・角丸の付け根と角の距離(角丸は半径を引く) | 最小 4.0px。目標が角の斜め上でも、付け根は角から 4px 以上離れる(下の「角の近く」) |
| 雲: 縁の包絡線と、しっぽの 1 つ目の円の隙間 | 0.9〜3.0px(つながって見える) |
| Office の `wedgeRectCallout`(`gdLst` を写した評価)との一致 | ランダムな先 1779 個で、付け根の位置を Office の規則(`office` モード)にすると**同じ多角形**(頂点の集合が 0.02px 以内)。`adj` への丸め(1/100000)が先を動かすのは最大 0.002px。既定の `adj1 = -20833`、`adj2 = 62500` は、200×80 の先 (58.3, 90) の `officeAdj` と一致(D7 の式の確認) |

**目標が近いとき**(本体の右の縁から目標まで。目標は縁の外):

| 縁からの距離 | 四角・角丸のしっぽの長さ | 楕円 | 雲の円の列 |
|---|---|---|---|
| -20px(中) | 目標が内側(`inside`) | 内側 | 内側 |
| 0 | 0.0(三角が潰れる) | 1.8(弦の中点からの長さ) | 11.7 |
| 2 | 2.0 | 3.8 | 13.7 |
| 4 | 4.0 | 5.8 | 15.7 |
| 8 | 8.0 | 9.8 | 19.7 |
| 16 | 16.0 | 17.8 | 27.7 |

四角・角丸・楕円は、先が縁の外 6px 未満だと三角が「ちょん」と出るだけで、吹き出しの尻尾に見えない(短すぎる)。雲は 3 つの円(1 つ目 = 縁から 9.7px、2 つ目、先の円)が、長さ 20px(= `ss/4`)未満で重なる。この数字が D3 の閾値の根拠。

**角の近く**(角丸。先が右上の角の斜め上): 付け根は辺の端から離れて(角の半径 + 4px)置かれ、先と付け根の三角が**傾く**(先が付け根の真上でなくなる)。細い鋭角の三角になるが、目標へ向かう向きは保たれる。Office の固定の付け根との比較は `out/rect-follow-vs-office.svg`(同じ先で両方の付け根を描いた。数字では測っていない)。

見た目の限界(スパイクで見えたこと): 目標が遠く(本体の高さの 2 倍以上)のとき、直線の三角は細い針になる。これは D3 の「長すぎる」検査で拾う。

## 決定

### D1. 部品の名前と `callout()` との違い — `balloon()`

新しい部品を **`balloon()`**(吹き出し)とする。

- **`callout()` は変えない。** `callout()` は**コネクタ**(目標の縁から離した場所に札を置く引き出し線)で、輪郭は 1 つにならず、札は目標から固定の距離に自動で置かれる。吹き出しは**箱**(行や列に並び、`id` を持ち、大きさが文字で決まる)で、しっぽが輪郭の一部になる。使い分け: 注記を**目標の近くに自動で**添えるなら `callout()`、**自分で置いた**吹き出しがどこかを指すなら `balloon()`。
- 名前の候補と理由: `bubble` は ADR 0074 の `comic()` の中の部品の名前で、`bubble` の名前の図(`charts-bubble`、泡グラフ)もある。`callout` は既にある。`speechBubble` は長い。`balloon` は日本語の「吹き出し」の英語として自然で、衝突しない。
- ADR 0074 の `bubble()` は `comic()` の中で使う部品のまま(話し手・コマ・読む順・穴と一緒に決まる)。`balloon()` は**一般の図**で使う。両者は輪郭の生成だけを分け合う(D6)。

### D2. 部品の形

```ts
balloon('ここが変更点', {
  id: 'note1',
  shape: 'round',            // 'rect' | 'round' | 'ellipse' | 'cloud' | 'spiky'。既定 'round'
  to: 'step2.top',           // 目標。箱の id と side / at(コネクタの参照と同じ)
  // または  tip: [dx, dy]   // 目標を本体の中心からのずれ(px)で
  outline: 'solid',          // 'solid' | 'dashed'(ささやき)
  tone: 'warn',              // 箱の tone と同じ
  gap: 4,                    // 目標の縁の手前で止める距離(既定 4。callout() の ANNOT_GAP と同じ)
})
```

- 文字は `box` と同じ書き方(`title` 相当、`**強調**` などの印、`detail`)。
- **目標の指定は 2 通り。**
  1. `to`: `resolveRef` と同じ `id.side@at` の文字列(`step2`、`step2.top`、`step2.right@0.3`)。レイアウトのあとに箱の位置から決まる(D5)。`side` が無いときは、吹き出しの中心から見て近い側。
  2. `tip: [dx, dy]`: **本体の中心からのずれ**(px)。図の絶対座標ではなく相対にするのは、レイアウトで吹き出しが動いてもしっぽの向きが保たれるから(Office の `adj1` / `adj2` と同じ考え方。D7)。`to` と `tip` の両方は書けない(エラー)。どちらも無い吹き出しは、しっぽの無い角丸の箱(普通の吹き出しの「語り」)。
- `to` が自分自身の箱の中を指す、または id が無い場合は、`callout()` と同じ文言のエラー(`balloon(): unknown anchor id "x" (give the box an id)`)。

### D3. 形(Office の対応表)と、しっぽの幾何

#### 形と Office のプリセット

| `shape` | 輪郭 | Office のプリセット | 文字の矩形(本体に対する割合。Office の `<rect>` と同じ) | しっぽ |
|---|---|---|---|---|
| `rect` | 角の無い四角 | `wedgeRectCallout` | 100% | 三角 |
| `round`(既定) | 角丸四角(半径 `min(w,h)/6`。`radius` で上書き) | `wedgeRoundRectCallout`(`adj3 = 16667` と同じ) | 幅・高さとも、各辺から半径の 29.289% 内側 | 三角 |
| `ellipse` | 楕円 | `wedgeEllipseCallout` | 幅・高さの 70.7% | 楕円の弧に付く三角(付け根は媒介変数で ±11°) |
| `cloud` | 雲(弧の連なり) | `cloudCallout` | 幅の約 65%・高さの約 65% | 小さな円の列(3 つ。半径 `ss/12`、`ss/18`、`ss/36`) |
| `spiky` | 星形のぎざぎざ。しっぽは目標へ向く 1 本の長い刺 | **対応なし**(Office は `irregularSeal1/2`・`star*` に `adj` のしっぽが無い) | 約 60%(第 1 版は 1 つの値。U1 で測る) | 刺の長いもの 1 本 |
| 線の吹き出し(`borderCallout1/2/3`、`accentCallout1/2/3`、`accentBorderCallout*`) | — | `balloon()` では出さない | — | — |

- **線の吹き出しは `balloon()` にしない。** これらは「箱 + 線」で、しっぽが輪郭の一部ではない。`callout()` が「線 + 札」で近いが、札の位置が逆(Office は線が箱の側面から出る。`callout()` は目標から札を離す)。必要なら `box` + `connect` の線で描ける。PPTX では、将来 `borderCallout1` として書くための入口(D7)だけ記録する。
- 文字を収める本体の大きさは、**`box` の文字の規則**(折り返し・縮め・余白)で出した文字の大きさを、上の表の「文字の矩形の割合」で割って決める。楕円は各方向 1.41 倍、雲は約 1.53 倍になる(ADR 0074 が楕円を既定にしなかった理由と同じ。√2 倍)。`ellipse` と `cloud` は幅が増える代わりに形が分かりやすい。
- `spiky` の刺の数・長さは、スパイクでは試していない(四角・角丸・楕円・雲だけ)。U1 で四角・楕円と同じ性質(付け根が輪郭の上・閉じている・決定的)の検査を通す形で試す(ADR 0074 の `shout` の「ぎざぎざは U1 で試す」と同じ扱い)。

#### しっぽ

| 項目 | 規則 |
|---|---|
| 付け根の辺(四角・角丸) | Office と同じ。本体の中心から先へのずれ `(dx, dy)` で、`|dy| > |dx|*h/w` なら上下、そうでなければ左右。同点は左右 |
| 付け根の位置(四角・角丸) | **先の真下 / 真横**(辺に沿う座標)を中心に、付け根の幅 `bw = clamp(辺の長さ/4, 12, 28)` px で置く。ただし両端は角から `半径 + 4px` 以上離す(クランプ)。辺が `2×(半径+4) + 12` より短ければ、付け根の幅を縮める。スパイクで、付け根が角から最小 4.0px、輪郭の上 |
| 付け根の位置(Office の固定) | `baseMode: 'office'`(内部の選択。D7 の書き出しで同じ絵にしたいときに使う): 辺の 2/12〜5/12 または 7/12〜10/12。スパイクで Office の多角形と一致 |
| 付け根(楕円) | 先の向きの媒介変数 ±11°(Office と同じ。弦の幅は本体の大きさで決まる) |
| 付け根(雲) | 先の向きの媒介変数に当たる雲の包絡線の点。そこから `ss/12 + 3px` の位置に 1 つ目の円、先に 3 つ目の円、2 つ目はその中間(1 つ目の円と重ならない位置に寄せる) |
| 形 | **直線の三角形**(付け根 2 点と先)。曲線のしっぽは第 2 版(Q4)。輪郭は本体としっぽで**1 本の閉じた `<path>`**(`M…Z`)。雲は本体の `<path>` と、円 3 つの `<path>` を 1 つの `<g>` に |
| 長さ(最小) | 先から付け根の中点まで **6px 未満**は `balloon-tail-short`(助言)。雲は `ss/4` 未満(円が重なる。スパイクの 20px の根拠) |
| 長さ(最大) | 本体の長い辺の **1.5 倍**を超えたら `balloon-tail-long`(助言)。細い針になる(スパイクで見えた)。初期値は U1 で、例の図の見た目で調整する |
| 先が本体の中 | `inside` = 先が輪郭の内側(四角は `|dx| < w/2` かつ `|dy| < h/2`、楕円・雲は楕円の式)。**しっぽを描かず**、`balloon-target-inside`(問題)を報告する。目標が縁の外 0px 〜 6px は、描くが `balloon-tail-short`(助言) |
| 目標の縁との隙間 | `to` の指定では、先は目標の縁から `gap`(既定 4px)手前で止める(`callout()` と同じ。線が箱にくっつかない)。`tip` の指定では、先は指定の点そのもの |
| 破線(ささやき) | `outline: 'dashed'` は、輪郭(本体 + しっぽ)の 1 本の `<path>` に `stroke-dasharray`(既定 `6 3`、ADR 0074 の `think` の破線と同じ)。雲は円の `<path>` にも付ける |
| 重なる順 | 本体としっぽは 1 つの `<path>` なので、しっぽと本体の境目に線が引かれない(別々に描く ADR 0074 の U1 の `tailSvg` + `shapeSvg` では、付け根に線が残る) |

### D4. 文字の折り返しと縮め、テーマ、アクセシビリティ

- **文字は `box` の規則をそのまま**使う(`wrapStyledAtoms`、`MIN_FONT_SIZE` までの縮め、`splitAtoms`)。ADR 0074 の D2 のうち、**`comic` / `chat` の中だけの規則(全角を測らず 1 em、英字を整数 px に切り上げる)は持ち込まない**: あれは「値を入れても配置が動かない」のための規則で、`balloon()` は値が固定なので要らない。持ち込むと既存の図の箱の幅が変わる(ADR 0074 の「全部の帯に整数 px の丸めを広げる」の却下と同じ理由)。
- 本体の大きさは、折り返したあとの文字の矩形を D3 の表の割合で割って出す(最小の大きさ: 幅 48px・高さ 32px)。`id` を持つ箱として、行・列・`grid`・`freeform`(ADR 0069)に置ける。
- **テーマ**: 塗りと枠は `box` の `tone` と同じ役割(`fill` / `stroke` / 文字の色)。しっぽも同じ塗りと枠。枠の太さは箱と同じ。`outline: 'dashed'` は枠の線種だけを変える。色を `balloon()` に直接書くことはしない(テーマの規則を守る)。
- **アクセシビリティ**: 本体の `<g data-balloon="id">` に `<title>`(吹き出しの文字をそのまま。目標があれば「→ 目標の箱の title」は付けない: 読み上げの順序は文書の順で決まるため)。文字は生きた `<text>` のまま(読み上げ・検索・コピーができる)。`role` は付けない(`img` にすると中の文字が隠れる)。`data-node` は ADR 0034 に従い付ける。目標との関係(「この吹き出しはこの箱を指す」)は `data-balloon-to="目標の id"` に出す(機械が読める。見た目には影響しない)。

### D5. レイアウトでの位置づけ(箱として置き、しっぽはあとで決める)

- **本体は箱**: 行・列・grid・freeform の中に、他の箱と同じ規則で置かれる。レイアウトが決めるのは**本体の矩形だけ**(しっぽは含まない)。本体の矩形は `anchors`(`id`)に登録され、ほかのコネクタ・`callout()` の目標にもなれる。
- **しっぽは配置のあと**(コネクタと同じ段): `layout-connect` の段で `to` を `resolveRef` + `anchorPoint` で矩形に直し、輪郭の生成(D6)を呼ぶ。つまり、本体の位置はしっぽに依存せず、目標の箱の位置はしっぽに依存しない(循環しない)。しっぽを動かしても、箱は動かない。
- **空きの確保はしない**: 本体の外へ出るしっぽの場所を前もって確保しない(目標はレイアウトの後でしか分からず、確保すると配置が目標に引かれて ADR 0074 の「台詞を変えても配置が動かない」のような独立が崩れる)。かわりに、**検査**(D8)で、しっぽが他の箱を横切るときに知らせる。本体と他の箱の重なりは、既存の重なりの検査がそのまま見る。目標のそばに置きたいときの `gap` は、本体と目標の間を行・列の `gap` で調整する。
- **検査への寄与**(`verify-handlers` の `rects`): 本体を 1 つの箱として出す。しっぽは、`pathSegments` が線を細い矩形にするのと同じ方法で、三角形の 2 辺を細い矩形として出す(三角形の外接矩形は本体や他の箱を含みすぎる)。雲の円列は、円の外接矩形。
- **`bubble()`(ADR 0074)とは別の経路**: `comic()` の中の `bubble()` はコマの帯が配置する。`balloon()` はふつうの箱として配置する。生成する輪郭だけが共通(D6)。

### D6. 共通の輪郭の生成(`lib/shapes/balloon.ts`)と、ADR 0074 の U1 との分担

純粋な 1 つのモジュール `lib/shapes/balloon.ts`(import なし、測定なし、入力は数値)を、`balloon()` と ADR 0074 の `bubble()` の下に置く。スパイクの `balloon.ts` がその原型。

```ts
type Pt = readonly [number, number];
type BalloonShape = 'rect' | 'round' | 'ellipse' | 'cloud' | 'spiky';
interface BalloonOpts { radius?: number; baseWidth?: number; baseMode?: 'follow' | 'office' }
interface Balloon {
  d: string;                 // 本体 + しっぽの 1 本の閉じた path(雲は円の path も続く)
  base: [Pt, Pt];            // しっぽが輪郭から出る 2 点(雲は同じ点 2 つ)
  tip: Pt;
  side?: 'top' | 'right' | 'bottom' | 'left';
  dots?: {c: Pt; r: number}[];   // 雲の円列(本体側から)
  length: number;            // 先から付け根の中点まで
  inside: boolean;           // 先が本体の内側
}
balloon(shape: BalloonShape, body: Rect, tip: Pt, opts?: BalloonOpts): Balloon
officeAdj(body: Rect, tip: Pt): [number, number]   // D7
```

- 名前は ADR 0074 の `ComicLaidBubble.tail` の `{base, tip}` に合わせた(`feat/comic-u1` の `lib/types/comic.ts:78` を読んで確認。ローカルの WIP で、未 push なので変わりうる)。`from`(`tailAngle` の始点)は `comic` 側で付ける。
- **ADR 0074 の U1 に求めること(U1 は本体・しっぽを今のまま別の図形で出してよい)**:
  1. U1 は `lib/shapes/balloon.ts` を待たない。`tailOf`(先を頭の円の 6px 手前に決める規則)は `comic` の規則なので、`comic` に残る。
  2. U1 の `ComicLaidBubble.tail` の型 `{base: [Pt, Pt], tip: Pt, from: Pt}` は変えない(この ADR の `Balloon` と同じ名前)。`TAIL_HALF`(8)・`TAIL_MIN`(10)などの定数は `lib/comic/constants.ts` のまま。
  3. U1 の `say` の角丸 `min(h/2, 24)` は、`balloon` の `radius` で表せる(`radius` を上書きできる設計にしてある)。`think`・`shout` の形は U1 の「試す」に任せる(雲は `balloon` の `cloud`、ぎざぎざは `spiky` で既に試作の入口がある)。
- **U1 のあとの整理(この ADR の単位 U2 の後)**: `lib/comic/emit.ts` の `tailSvg` + `shapeSvg` を、`balloon()` が返す 1 本の `d` に置き換える。`comic` の `tailOf` は先 `tip` だけを返す形にして、`base` は `balloon()` から受ける。`from` は付け根の中点にする(`tailAngle` の 10° の検査は、付け根の中点から先へ・口への向きで見る。付け根の位置が変わるので、**comic の golden はその PR で一度だけ変わる**。人が見て受け入れる)。`think` は `cloud`、`shout` は `spiky`、`say` は `round`、`narration` はしっぽ無し(`tip` なし)。
- 衝突を避ける取り決め: この ADR の実装は `lib/shapes/balloon.ts` を**新しいファイル**として足し、`lib/comic/` を触らない。ADR 0074 の U1 の PR は `lib/shapes/` を触らない。整理の PR は、後に入った方のあとで、`comic` と `shapes` の両方を知る 1 人が出す。

### D7. 将来の PPTX の書き出し(範囲外。材料だけ)

プリセットの対応表(D3)があるので、後の PPTX の書き出し(`lib/pptx/`)は `balloon()` を**ネイティブの `prstGeom`** で書ける: `rect` → `wedgeRectCallout`、`round` → `wedgeRoundRectCallout`(`adj3` は `radius / min(w, h) * 100000`)、`ellipse` → `wedgeEllipseCallout`、`cloud` → `cloudCallout`。`spiky` は対応するプリセットが無いので、`custGeom` か通常の図形(SVG の経路)で書く。

**`adj1` / `adj2` の式**(ECMA-376 の `gdLst` で確認済み。上の「Office の形の定義」と、スパイクの `officeAdj` と `office.ts`):

```
adj1 = round((tip.x - (body.x + body.w/2)) / body.w * 100000)
adj2 = round((tip.y - (body.y + body.h/2)) / body.h * 100000)
```

すなわち、先の**本体の中心からのずれを幅・高さの 1/100000** で表す。既定の (-20833, 62500) は、200×80 の本体で先 (58.3, 90) = 中心から (-41.7, +50)。スパイクで、`adj` への丸めが先を動かすのは最大 0.002px だった。

注意点: (1) ネイティブの形は付け根が Office の固定(2/12〜5/12 または 7/12〜10/12)なので、SVG の `follow`(先の真下に寄せる)とは**付け根の位置が違う**。同じ絵にしたければ、書き出しに限って `office` モードで描く(Q2)。(2) 先を `gap` だけ手前で止めた後の点を `adj` にする。(3) 線の吹き出し(`borderCallout1` の `adj1`〜`adj4` = 始点 `(y, x)` と終点 `(y, x)`)は `box` + `connect` の線から作る別の話。

### D8. 検査(既存の検査の仕組みを広げる)

既存の検査(`verifyDiagram` の箱の重なり・コネクタが箱を通る・図の外)に、`balloon` の本体と、しっぽの細い矩形(D5)を出して、次を足す。

| id | 重さ | 内容 |
|---|---|---|
| `balloon-target-inside` | 問題 | 先が本体の内側(しっぽを描けない) |
| `balloon-tail-box` | 問題 | しっぽが、目標の箱と自分の箱以外の箱を横切る(三角形と箱の矩形の重なりが 0.5px を超える。コネクタの「箱を通る」と同じ許容) |
| `balloon-unreachable` | 問題 | しっぽが他の箱を通らずに先へ届く向きが無い。具体的には、付け根の辺の候補(上下左右の最大 4 つ)のどれからの直線も他の箱を横切る(v1 は迂回しないので、直すのは配置の側) |
| `balloon-tail-short` | 助言 | D3 の最小の長さ未満 |
| `balloon-tail-long` | 助言 | D3 の最大の長さ超え |
| `balloon-tail-edge` | 助言 | しっぽが、コネクタの線(矢印)と交わる |
| `balloon-text-fit` | (既存の文字の検査) | 文字が本体の文字の矩形に収まらない(`box` の検査と同じ) |

`balloon-unreachable` は、`balloon-tail-box` が出ているものの特別な場合(全部の方向が塞がっている)で、原因を 1 つにするため、`unreachable` のときは `tail-box` を出さない(1 つの誤りに 1 つの報告。ADR 0074 と同じ)。検査の閾値は、U3 の例の図で調整する。

### D9. JSON の spec、Schema、パーツ一覧

- `lib/spec-parts/` に `balloon` を足す(`text`、`shape`、`to`、`tip`、`outline`、`tone`、`gap`、`id`)。`pnpm schema` で `schema/*.schema.json` を作り直す(ADR 0071。`test/schema-files.test.ts` が新しい Schema の差を見る)。
- MCP のパーツ一覧(`list_diagram_parts`)の項目に `balloon` を足す: 一行の説明は「箱に文字を入れ、しっぽで別の箱や点を指す吹き出し(Office の吹き出しの図形)。注記を目標の近くに自動で添えるなら callout」。`callout` の項目に「輪郭のつながった吹き出しは balloon」を足す。
- `skills/svg-diagram/references/` と README の部品の表に足す。

## 代替案

- **`callout()` に `shape` を足す**: 部品の数が増えない。しかし `callout()` は箱ではなくコネクタで(札の置き場所が目標から決まり、行・列に並べられない)、しっぽが輪郭の一部になる箱とは作りが違う。名前の意味もずれる。却下。
- **ADR 0074 の `bubble()` だけを一般の図でも使えるようにする**: 部品は 1 つで済む。しかし `bubble()` は `comic()` の帯の中で、話し手・コマ・読む順・穴と一緒に配置される。帯の外で使うために、それらを任意にすると ADR 0074 の規則(規範の数値)が薄まる。輪郭の生成だけを共有する(D6)。
- **Office の `adj` をそのまま既定にする(付け根は 2/12〜5/12 の固定)**: PPTX と同じ絵になる。しかし先が付け根の真上でない傾いた三角になり、小さな箱では見た目が悪い(スパイクの角の近く)。内部の `office` モードとして残し、既定は `follow`(Q2)。
- **しっぽを曲線にする**: 見た目は漫画らしい。しかし付け根の幅・曲がりの向き・先の検査が増え、PPTX の `wedge*` に対応しない。第 2 版(Q4)。
- **しっぽのために空きを確保する**: 配置が目標に引かれて循環しうる。検査で知らせる(D5)。
- **線の吹き出し(`borderCallout*`)も `balloon()` に入れる**: Office の見た目に合う。しかし「箱 + 線」で、`callout()` / `connect` で足りる。しっぽが輪郭の一部であることが `balloon()` の存在理由で、別の部品にする(D3)。
- **本体の大きさを文字の矩形と同じにする(楕円・雲でも)**: 文字が輪郭にはみ出す。Office の文字の矩形の割合で本体を大きくする(D3)。
- **しっぽの先を本体の座標の絶対値にする**: 簡単。しかし吹き出しが動くとしっぽの向きが変わる。`tip` は中心からのずれ(D2)。

## 影響

- 新しい部品 `balloon`。実装は `lib/shapes/balloon.ts`(輪郭。約 150 行)、`lib/layout-connect.ts` の隣のしっぽの解決(目標の参照 + 輪郭の呼び出し)、検査(`lib/verify-handlers.ts` と検査の id)。表への登録(spec-parts、`dsl-pure`、`test/fixtures/dsl-exports.json`、パーツ一覧、`skills/svg-diagram/references/`、README)は、`callout()` の登録と同じ場所。
- 既存の `callout()` / `box` の出力は変えない。golden の既存の図は変わらない(テストで確かめる)。`balloon()` を含む新しい図だけが増える。
- ADR 0074 との関係は D6。`lib/comic/` を触るのは、U1 と、その後の整理の PR だけ。
- PPTX は、`balloon()` を含む図は今のところ SVG 経路の図形になる(未対応の部品の扱いは既存のまま)。ネイティブの吹き出しは D7 の後の ADR。
- 描画は決定的(入力が数値だけの純粋な関数。スパイクで同じ入力が同じ文字列になることを確認)。

## 実装計画

どの単位も、`main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる。

### U1: 輪郭の生成(`lib/shapes/balloon.ts`)

- 範囲: 四角・角丸・楕円・雲・ぎざぎざ。`balloon()`、`officeAdj()`。`lib/` の他は触らない。
- 完了の基準: (1) どの形・どの方向の先でも、付け根が輪郭の上にある(四角・角丸・楕円は誤差 1e-6 以内。雲は 1 つ目の円の隙間が 4px 以内)。(2) 経路が `M` で始まり `Z` で終わり(閉じる)。(3) 同じ入力は同じ文字列。(4) 四角・角丸の付け根が角から `半径 + 4px` 以上離れる(辺が短いときは付け根を縮める)。(5) `baseMode: 'office'` で、`wedgeRectCallout` の `gdLst` の評価(`office.ts` を `test/` に移す)と同じ多角形。(6) 先が内側のとき `inside: true`。(7) 既存の golden が変わらない。
- テスト: 性質テスト(乱数の本体・先の組を 1000 通り: 付け根が輪郭の上、閉じている、決定的、付け根の幅が `bw` 以下、先が外のとき `length > 0`)、8 方向の固定の例、近い目標の表(D3)、Office との一致、`officeAdj` の逆変換(先 → `adj` → 先で 0.002px 以内)。
- `spiky` は、四角と同じ性質の検査を通る形に限る。見た目は U1 の最後に決める人に見せる。

### U2: 部品とレイアウト

- 範囲: `balloon()` の部品(D2)。本体は文字から大きさを決める箱(D4)。目標の解決(D5)。`to` / `tip` の検査。描画(`<g data-balloon>`、`<title>`、1 本の `<path>`、破線)。
- 完了の基準: (1) `to` で箱の側面を指す吹き出しが、行・列・grid・freeform に置ける。(2) 吹き出しを動かしても(行の順を変えても)しっぽが目標を指し続ける。(3) `tip` の指定は吹き出しが動いても向きが変わらない。(4) 既存の golden が変わらない。(5) 文字の折り返しは `box` と同じ(同じ文字で同じ行)。
- テスト: 配置の golden、`to` が未知の id のときのエラー文言、`to` と `tip` の両方のエラー、`outline: 'dashed'`。

### U3: 検査

- 範囲: D8 の 6 つの検査。
- 完了の基準: わざと悪くした図(目標が本体の中、しっぽが別の箱を横切る、全方向が塞がる、短すぎる、長すぎる、矢印と交わる)で、それぞれ期待の id だけが報告される(`unreachable` のときは `tail-box` が出ない)。例の図では 0 件。
- テスト: 上の悪い図ごとの検査の結果、閾値の境(5.9px / 6.0px)。

### U4: Schema と MCP のパーツ一覧

- 範囲: `lib/spec-parts/` の `balloon`、`pnpm schema`、`list_diagram_parts` の項目と `callout` の注記、`skills/svg-diagram/references/`、README。
- 完了の基準: `pnpm schema` の結果がコミットされ、`test/schema-files.test.ts` が通る。`balloon` を含む JSON の spec が、DSL と同じ SVG になる。
- テスト: DSL と spec の同値、Schema の検証(`shape` の列挙、`to` と `tip` の排他)。

### U5: 例と golden

- 範囲: `examples/balloon-autoshape.ts`(形 4〜5 種、8 方向、ささやき、目標が近い・遠い)。golden を足す。
- 完了の基準: 例の図で検査が 0 件。golden は `scripts/golden-docker.sh` で作る。既存の golden が変わらない。
- 例の文: 「ここが変更点」「要確認」など中立な文だけ。

### U6(ADR 0074 の U1 のあと): `bubble()` と輪郭を 1 つにする

- 範囲: D6 の整理。`lib/comic/emit.ts` と `tailOf` を `lib/shapes/balloon.ts` を使う形へ。
- 完了の基準: `comic` の golden が、付け根の位置の変化の分だけ変わる(人が見て受け入れる)。`tailAngle` の 10° の検査は同じ許容のまま通る。
- 前提: ADR 0074 の U1 と、この ADR の U1 が `main` に入っていること。

## テスト方針

- 輪郭の生成は純粋な関数で、フォントに依存しない(測定は文字の矩形を出す側にある)。性質テストが中心。
- Office との一致は、`gdLst` を写した評価を正とする(ECMA-376 の定義そのもの)。リポジトリの外のコピーに依存しないよう、U1 で必要な式を `test/` に写す。
- 「吹き出しを動かしてもしっぽが目標を指す」「`tip` は相対」は、`deepEqual` ではなく、先の座標の差で見る。

## 質問と推奨

| # | 質問 | 推奨 |
|---|---|---|
| Q1 | 部品の名前を `balloon()` にするか | `balloon()`。`bubble` は ADR 0074 と泡グラフに使われ、`callout` は既にある。`callout()` の説明に「輪郭のつながった吹き出しは balloon」を足す |
| Q2 | しっぽの付け根を、先の真下に寄せる(`follow`)か、Office の固定(2/12〜5/12)にするか | 既定は `follow`(傾きが小さく見た目がよい。スパイクで確かめた)。PPTX の書き出しだけが `office` を使う。書き出しと SVG で付け根が少し違うのを許すか、決める人に確認 |
| Q3 | 線の吹き出し(`borderCallout*`、`accentCallout*`)を `balloon()` に入れるか | 入れない(「箱 + 線」で `callout()` / `connect` で足りる。しっぽが輪郭の一部であることが `balloon()` の理由)。要望が出たら別の ADR |
| Q4 | しっぽを曲線にするか(漫画風) | 第 1 版は直線。要望が出たら `tail: 'curve'` を第 2 版で(ADR 0074 の `bubble()` と同時に決める) |
| Q5 | ぎざぎざ(`spiky`)を第 1 版に入れるか | 入れる(Office に無いが、強調・叫びで使う)。ただし U1 で性質の検査を通る形に限り、見た目は決める人が見て決める。通らなければ後に回す |
| Q6 | 目標を `tip: [dx, dy]`(中心からの相対)で指定できるようにするか。それとも `to` だけにするか | 入れる(`to` が使えない自由な点を指したいとき。相対にして、吹き出しが動いても向きが保たれる。Office の `adj` と同じ) |
| Q7 | しっぽのために空きを確保するか | 確保しない(目標が配置の後でしか分からず、循環しうる)。検査で知らせる(`balloon-tail-box`) |
| Q8 | 文字の折り返しに ADR 0074 の D2 の幅の規則(全角を 1 em、整数 px)を持ち込むか | 持ち込まない(`comic` / `chat` の中だけ)。`balloon()` は `box` と同じ規則 |
| Q9 | 共通の輪郭の生成を、ADR 0074 の U1 を待たず `lib/shapes/balloon.ts` に別に足すか。`comic` の整理は U1 のあと(U6)か | 別に足す。U1 は今のまま(別の図形)で進め、整理は両方が入ったあとの U6 で 1 回。comic の golden はその PR で一度だけ変わる |
| Q10 | 吹き出しの `role` / ARIA | `role` は付けない(`<title>` と生きた `<text>`)。目標との関係は `data-balloon-to` に出す |

## スパイクの再現

```
node spikes/balloon-autoshape/run.ts [outdir]   # SVG(8 方向・近い目標・角の近く・Office の付け根との比較)と、上の数字
```

`spikes/balloon-autoshape/out/` に、形ごとの 8 方向の SVG、近い目標の SVG、`measurements.txt` を置いた。この ADR を採るなら、`balloon.ts` と `office.ts` は U1 で `lib/shapes/` と `test/` に移して、スパイクは消す。
