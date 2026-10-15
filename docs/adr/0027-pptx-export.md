# ADR 0027: PowerPoint(.pptx)への書き出し(`svg-diagram pptx`)

- 状態: 提案(Opus レビュー 3 巡目・スパイク・PoC 実装済み。PowerPoint 実機での確認が残る)
- 日付: 2026-10-15
- 基点: `origin/main`(d7b9f75、PR #224 まで)
- 関連: ADR 0007(結果が入力だけで決まること), ADR 0012(id の衝突), ADR 0017(最小の文字サイズ), ADR 0018(`deck`)

## 背景

SVG を出す代わりに、PowerPoint で開いて**直せる**ファイルを出したい。受け手は PowerPoint 2016 以降(Microsoft 365 / Office 2019 以降を主、買い切りの 2016 を従とする。D3)。

SVG を PowerPoint に貼って「図形に変換」すれば、矩形・線・文字がばらばらの部品として得られる。それでは編集する人に嬉しくない(箱を動かしても矢印がついてこない、文字が箱と別物、表が表でない)。このプロジェクトは、レイアウト済みモデル(`LaidOut*`)に**意味**を持っている(箱とその文字、接続の `fromId` / `toId`、表の行と列)。この意味を PowerPoint のオブジェクトへそのまま写すことが、この機能の価値である。

## 決定

### D1: 元は SVG ではなく `LaidOutDiagram`。全バンドに「ネイティブ / 画像」の表

`emitSvg` の出力を読み戻して変換することはしない。`layoutDiagram()` の結果(`laidOut: LaidOutBand[]`、`connects: LaidOutConnect[]`)から、**バンドの種類ごとの PPTX 用ハンドラ**で作る。`lib/emit-handlers.ts` の `EMIT_HANDLERS`(`satisfies {[T in LaidOutType]: …}`)と同じく、全バンド種に「ネイティブ」か「画像」の宣言がないとコンパイルが通らない形にする。いまの実装では chart は全 kind が画像なので、kind ごとの宣言は持たない(ネイティブのチャートを作るときに足す)。この表が段階の計画を兼ねる(D2・D3)。

### D2: 意味を写す対応表(第 1 段)

| 元の意味 | PowerPoint での形 |
|---|---|
| `LaidOutBox` / banner / caption | **文字を内包した 1 つの図形**(角丸の矩形。caption は枠なしの図形)。色は tone から、フォントは D6 |
| tag ピル・stamp・step バッジ・icon を持つ箱 | 箱と部品を 1 つのグループにする(別の図形が要るので、「別のテキストボックスを重ねない」は部品の無い箱の規則) |
| `LaidOutConnect`(`fromId` / `toId`) | **コネクタ**。両端を図形の**接続点に結ぶ**(`a:stCxn` / `a:endCxn`)。箱を動かすと線がついてくる |
| 接続線のラベル | 別のテキストボックス。**線にはついてこない**(`p:cxnSp` は文字を持てない)。既知の制限としてノートに書く |
| row / grid | 図形のグループ(名前は DSL の id)。row の id は図形ではないので、row が端のコネクタは代表の子につなぐか、つながない |
| `LaidOutRow.arrows` | id を持たない `{x1,y1,x2,y2}`。隣り合う子から端を推定できるときだけコネクタ、できないときはただの線 |
| group | 枠の図形(子は別のバンドとして後ろに並ぶ。pptx のグループにするには layout が子の範囲を記録する型の変更が要る。第 2 段) |
| table | **ネイティブの表**(第 1 段の PoC に含める) |
| speaker notes | 第 3 段 |

接続できない端(box でない端が 60 個中 9 個: 画像にするバンドの中のアンカーなど)は、アンカーごとに**透明な矩形**を画像と同じグループに置き、そこへつなぐ。注釈(`annot`: bracket / callout)はコネクタにしない。

### D3: 写せないものは、バンド単位で SVG の画像にする

第 1 段で画像にするもの: chart(全 kind。D2 のネイティブチャートは、`LaidOut` にデータを残す型の変更とセットで第 2 段以降)、bars、math、wordart、wireframe、screens、cloud、people、dots、curve、plane、quadrant、image など。

- PowerPoint の `asvg:svgBlip`(Microsoft 365 / Office 2019 以降)で、SVG のまま拡大縮小できる(ベクタ)。「図形に変換」もできる。**買い切りの Office 2016 は svgBlip を描かず、フォールバックの PNG を出す**。2016 では画像バンドはラスタになる(PNG の解像度の既定を 2 倍にするのは、Google スライドと 2016 のため)。
- OOXML の決まりで**フォールバック用の PNG が必須**。`@resvg/resvg-js`(既存の依存)で作る。resvg は `marker orient="auto-start-reverse"` を正しく扱わず、縦向きの矢印の頭が横を向くことがあった(`examples/arrow-weight.ts`)。渡す前に、マーカーを向きごとに明示した形へ直す前処理を入れる。
- **バンド単位で切り出す**(要素単位ではない。重なりの崩れを避ける)。`renderBand` の断片は根の `<defs>`(マーカー)と `<style>` に頼っているので、切り出すたびに付ける。viewBox はバンドのインクの範囲(タグ・chip・ラベルが矩形からはみ出す)で決める。
- 画像バンドの SVG の中の文字は、受け手のフォントで置き換わって幅が変わる。**アウトラインにする**(harfbuzzjs で作れる。math はすでにアウトライン)。
- **Google スライドは SVG に対応していない**(直接挿入は「Unsupported image type」。`svgBlip` の扱いは情報が見つからず、フォールバック PNG になると推測するが未確認)。
- ファイルサイズ: PNG は SVG の約 14 倍(arrow-weight、2 倍解像度で 41KB 対 3KB)。解像度の指定、パレット化、同一画像の共有で抑える。

### D4: パッケージもスライドも自前で書く(`pptxgenjs` は使わない)

- スライドの XML(`p:sp` / `p:cxnSp` / `p:grpSp` / `p:pic` / 表の `graphicFrame`)は、レイアウト結果から自前で書く。
- パッケージの骨組み(`[Content_Types].xml`、マスター、レイアウト、テーマ、`presentation.xml` など 18 ファイル、約 30KB)は、**PowerPoint で開けると実績のある pptxgenjs の出力をそのまま雛形**としてリポジトリに置く(`lib/pptx/template/`)。変えるのはスライド本体、スライドの関係、スライドの大きさ、`[Content_Types].xml` の拡張子の宣言だけ。削る(ノート関連など)のは、PowerPoint 実機で確かめてから。
- zip は `node:zlib` による自前の書き出し(`zip.ts`、約 30 行)。順序・日時・圧縮を固定し、フォルダ項目を作らない。
- **pptxgenjs と JSZip の依存は入れない**。pptxgenjs はグループ・接続コネクタが無く、表と図形の id が衝突し、Node では SVG の PNG フォールバックが壊れる(SVG のバイト列が `.png` に入る)。決定論を崩す要素(日時、UUID、`Math.random`、入れ子の xlsx)も多い。後処理で補うより自前のほうが短かった(スパイクで確認)。
- **チャートは第 1 段では画像**(D3)。ネイティブチャートは XML と埋め込みの xlsx が要る。その時点で、チャートの部分だけ pptxgenjs の出力を雛形にするか自前で書くかを選ぶ。waterfall と treemap は chartex(`cx:chart`)で、pptxgenjs にも無い。
- Rust のライブラリやバインディングは使わない。配布が重くなり、必要な機能(接続・グループ・svgBlip・決定論)が汎用ライブラリの外にある。

### D5: 決定論(ADR 0007)

同じ入力から、同じ環境で同じバイト列を出す。zip の日時を固定し、フォルダ項目を作らず、順序を固定する(自前の zip)。**DEFLATE の出力は zlib の版で変わりうる**ので、保証するのは「同じ Node / zlib の中」とする(版をまたいで保証したいときは STORE にする)。チャートと埋め込み xlsx を入れるときは、そこも確認する。

### D6: フォント・文字・色

- **測るフォントと書き出すフォントを同じにする**。既定は BIZ UDPGothic(Windows 10 1809 以降に標準。OFL で Linux にも入れられる)。`.svg-diagram.json` の `fonts.sans` で、測る側も同じファイルにする。Mac 版 PowerPoint に入っているかは未確認。フォント埋め込みは編集で入力できない文字が出るので採らない。mono の run は等幅のフォントを使う。
- 折り返しは、layout の行ごとに明示の改行(`<a:br/>`)で固定する。文字の領域は layout の折り返し幅より少し(2px)**広く**する。`wrap="none"` は使わない(ユーザーが文字を足したとき折り返さない)。
- `lang="ja-JP"`、`kern="0"`(harfbuzz は大きさに関係なく詰めるため)。行送りは `spcPts` の固定。
- `indent`(step バッジや icon の逃げ)は、**その run の全行**を右へ寄せて幅を狭める(`lib/emit-common.ts` の `renderTextRuns`)。`a:pPr marL` で表す(`indent` 属性の「1 行目だけ」は誤り)。
- 接続線のラベルと、`nowrap` の run(stat の値など)は `wrap="none"`(折り返さない)にする例外。ラベルは余裕 0 で置くので、そのままだと行が増える。`nowrap` の run が箱の一部のときは、箱全体を `none` にするか、`<a:br/>` だけで済ませるかを PoC で決める。
- 色は `srgbClr` に固定する。`schemeClr` にすると、別のデッキに「貼り付け先のテーマを使用」で貼ったとき色が変わり、`check` が保証したコントラストが崩れる。

### D7: コネクタの経路(スパイクで確かめた)

- PowerPoint は**開いたときに経路を計算し直さない**(保存された `xfrm` と `prstGeom` と `adj` のとおりに描く)。違う形になるのは、ユーザーがつながった図形を最初に動かしたとき。
- 直交折れ線は 1 区間 = `straightConnector1`、2〜5 区間 = `bentConnector2〜5` と回転・反転・`adj` で表す(`lib/pptx/geom.ts`)。縮退(始点と終点が同じ軸の U 字・C 字)は、最小の ext(1pt)と大きな `adj` で表し、1pt ずれる。6 区間以上と斜め線は、画像にするか freeform にする(gantt の依存線 4 本、cloud の斜め 1 本)。
- 接続点は、矩形・角丸矩形で 上・左・下・右 = 0〜3。**端が乗っている辺**(`fromLabel` / `toLabel` の side)で選び、辺の上の位置は無視する(最も近い辺の中央で選ぶと、`column-grid.ts` の `fuse` が違う辺につながる)。端の 34% は辺の中央になく、最初に動かすと中央へ跳ぶ。

### D8: `check` が保証する範囲

pptx では、図形と線の幾何は保証する(layout のまま)。文字は D6 のフォントで保証する(受け手に無ければ保証しない)。ネイティブの表(行が文字に合わせて伸びる)とチャートの書式は PowerPoint 任せで、検査が届かない。`dim`(spotlight)・`appearance: 'dark'`・`transparent`・`reveal` の写し方は第 1 段で決める(未決)。

## 未決

1. **スライドの大きさ**。図の幅は 940px(9.79in)。`canvas: 'slide'`(1280×720)は LAYOUT_WIDE(13.333×7.5in)と 1 対 1。縦に長い doc 図は 16:9 に入らない(縮める / 図に合わせる / 分ける)。
2. 画像にするバンドの扱いが、`dim` / `reveal` と組み合わさったとき。
3. 端が辺の中央にない接続に、`custGeom`(`cxnLst` で任意の位置に接続点)を任意で使うか。代わりに「図形の変更」で接続点が消え、角丸の調整ハンドルが使えなくなる。
4. 接続線のラベルの置き方(線の中点か、端の近くか)。
5. テーマ色に寄せる案は D6 で却下済み。ただし貼り付け先での見え方は PowerPoint 実機で確認する。
6. reveal(段階表示)を PowerPoint のアニメーションで再現するか。
7. ファイルサイズの工夫(PNG の解像度、パレット化、同一画像の共有)。

## 段階

- **PoC**: box / banner / caption / row / grid / group + コネクタ(接続込み)+ table。残り(chart を含む)は D3 の画像。`examples/*.ts` 全体を通し、バンド・kind ごとの「ネイティブ / 画像」の一覧を出す。
- **第 2 段**: swimlane、sequence、tree、states、timeline、gantt、classes、bpmn。ネイティブチャート(`bars` / `stacked` / `combo` から)。group の入れ子。
- **第 3 段**: deck(複数枚)、ノート、reveal。

難所は経路の再現ではなく、グループ・id・文字・決定論・画像バンドの切り出しだった(下の結果)。

## 却下した案

- **SVG のプリミティブ(rect / line / text / path)を汎用に PPTX の図形へ**: 全バンドを一度にカバーできるが、結果は「図形に変換」と同じ**部品の山**になり、元の意味が消える。画像にするバンドについては、SVG を `custGeom` と文字の枠に機械変換する層を、`svgBlip` の代わりに将来の選択肢として残す(2016 でもベクタのまま、編集もできる)。
- **EMF に変換して埋め込む**: Inkscape / LibreOffice という外部依存が要り、グラデーション・破線・日本語フォントが崩れやすい。PowerPoint 2016 以降では SVG のほうが忠実。必要になったら任意の旗として足す。
- **python-pptx / pptxgenjs / Rust のライブラリ**: D4。

## スパイクの結果(コミット de02f08 の `spike/pptx/`。昇格後に削除した)

実装: `geom.ts`(コネクタの当てはめと評価器)、`run.ts`(`LaidOutDiagram` → 箱・caption・グループ・接続コネクタ・ラベルの pptx。自前の XML、骨組みは `template/`、zip は `zip.ts`)、`batch.ts`(全 examples)、`edges.ts`(バンド内の辺)、`svgblip.ts`、`lines.ts`、`judge-geom.ts` と `judge-glue.ts`(評価器とは独立の判定役)。型検査は `spike/tsconfig.json`(本体の `tsconfig.json` の対象外)。PowerPoint は無いので、判定は仕様の式による評価器と LibreOffice 7.4(参考)による。**LibreOffice での合格は、PowerPoint での合格を意味しない**。

| 判定項目 | 結果 |
|---|---|
| 経路の再現(評価器) | 合成 4000 本は縮退を除き誤差 0。実例の `connects` 35 本は最大 0.0001px。バンド内の辺 284 本のうち 279 本が当てはまる。 |
| **経路の再現(独立した判定役)** | 評価器は生成器と同じ変換の理解を共有し、自分との整合しか見ない(反転と回転の順、回転の向き、回転図形の xfrm の意味)。そこで同じプリセットと xfrm を**ふつうの `p:sp`** にして LibreOffice の描画エンジンで描かせ、PDF から経路を取り出して比べた(`judge-geom.ts`)。**1〜5 区間 × 始点の軸 × 全方向の組み合わせ 124 通りと、縮退(U・C・S 字)6 通りの計 130 通りが、すべて 1.5px 以内で一致**(絶対座標・始点から終点の向きのまま比べた最大の差は 1.36px。縮退の 1pt)。実例には rot90 + 反転 1 つの組み合わせが 0 件だったが、これで確かめられた。 |
| 当てはまらないもの | gantt の依存線 4 本(7 区間)、cloud の斜め 1 本。 |
| 縮退(U 字・C 字) | 最小の ext(1pt)で `adj` を大きくし、1.33px(= 1pt)ずれる(states の辺 1 本)。PowerPoint が保存し直したときの形は未確認。 |
| 接続(`stCxn` / `endCxn`) | 35 本中 25 本が両端、3 本が片端、7 本は端が箱でない。端は宣言された辺で選ぶ(最も近い辺だと 1 個が違う辺になった)。 |
| **接続点の番号(独立した判定役)** | ODF の接着点は 上・右・下・左 なので、odp の番号が同じだったことは根拠にならない。そこで、コネクタの座標を接続点から 150px ずらして書き(`SHIFT`、既定 150)、LibreOffice が接続から経路を作り直す性質を使って、4×4 の組み合わせ 16 通りで、端が期待した辺に来ることを確かめた(`judge-glue.ts`)。座標を無視して接続だけを使っているので、番号の取り違えがあれば不合格になる。上・左・下・右 = 0〜3 が正しい。 |
| 文字の行数(LibreOffice、BIZ UDPGothic で測り・書き出し) | **箱ごとに**数えた(`lines.ts`、pdftotext の単語を箱の矩形へ割り当て)。320 個(box / banner / caption / row・grid の子)のうち **308 個が一致**、12 個が 1 行多い(icons の箱 3・icons の caption 2、canvas-bmc / canvas-seven-s、emphasis の stat、hero / qc-affinity / qc-arrow の caption)。原因は未確定。emphasis は `nowrap` の値が折り返された疑い、icons は絵文字と icon の字下げ、caption は他の文字(接続線のラベルなど)の混入か、余裕 0 での折り返しの疑い。この測り方は、caption の枠外にはみ出した単語を拾うために他の箱の矩形を除いており、完全な判定ではない。どれも PowerPoint で確かめる。 |
| 決定論 | 146 本とも 2 回の書き出しがバイト一致。別プロセス・別タイムゾーン(UTC / Asia/Tokyo / America/Los_Angeles)・時間差の 12 通りも一致。最初に不一致だった原因は JSZip のフォルダ項目の時刻で、自前の zip で解消。 |
| id の重複 | 0(自前で振る)。 |
| svgBlip | 自前の書き出しで、SVG + resvg の PNG フォールバックの pptx が作れ、LibreOffice で描ける。pptxgenjs を Node で使うと PNG に SVG のバイト列が入る(確認済み)。バンド単位の切り出しは未試行。 |
| 出力できたバンド | box / banner / caption / row / grid / group / connect(ラベル込み)。chart(50)・tree・cause・table・wordart などは未対応(スパイクの範囲外)。 |

スパイク自体の誤りも見つかり、直した(2〜3 巡目のレビューで): 太字の判定が常に偽だった(weight は 400 / 700 の数値)、余白の既定値が layout と違っていた(16/12 でなく `BOX_PAD_X` / `BOX_PAD_Y`)、`spike/` が型検査の対象外だったこと、mono の run を等幅にしていなかったこと、`indent` を 1 行目だけと思い込んだこと、`judge-glue.ts` がずらしていなかったこと(ADR の記述と実装が食い違っていた)、`judge-geom.ts` が相対座標・逆向き許容で甘かったこと。最初に出した「行数一致 143/146」は、この誤りで合格側に偏っていたので採らない。

### PoC の最初に入れるもの(PowerPoint が無くてもできる)

- **スキーマ検証**: `xmllint` と ECMA-376 の XSD で、生成した XML を検証する(dotnet の Open XML SDK が無くてもできる)。
- スライドの大きさの下限: PowerPoint は 1in(96px)未満を受け付けない(最小の例は 100px)。丸めと、図の外の余白の足し方を決める。
- 表の 1 例(`graphicFrame` の `a:tbl`、結合セル、行の伸び)。
- 接続線のラベルと caption の置き方(線の中点か、端の近くか)。

### 残っている判定(PowerPoint 実機が要る)

1. 開いたときの表示が SVG と一致するか。**箱を動かしたときの再接続**(グループの中の図形へ、グループの外のコネクタをつないだ場合を含む)と、**縮退した U 字の保存し直し**。
2. 文字の行数と縦位置(第一行の字下げ `indent` の解釈を含む)、受け手のフォント(游ゴシックなど)で置き換わったときのずれ。caption と接続線のラベルの位置。
3. 「修復しますか」が出ないこと(Open XML SDK の検証器は dotnet が無く未実施)。表の行の伸び。
4. svgBlip の描画(`marker orient`、`<style>`、日本語)と、バンド単位の切り出し。

## PoC の実装(`lib/pptx/`、`svg-diagram pptx`)

スパイクを昇格して実装した(Codex が実装し、レビューと検証は別に行った)。入口は `emitPptx(laidOut, opts): Buffer`(`lib/pptx/emit.ts`)、CLI は `svg-diagram pptx <source.ts>... [--out FILE | --out-dir DIR] [--png-scale N] [--font NAME]`。全 `LaidOutType` を「ネイティブ(帯を XML にする関数)/ 画像」に分ける表は `lib/pptx/bands.ts` の `BAND_HANDLERS`(網羅していないとコンパイルが通らず、ネイティブの帯は関数そのものなので、宣言と実装が食い違わない)。構成は FCIS(ADR 0007)に沿い、核は純粋関数 `planSlide`(`slide.ts`、帯 → スライド XML)と `packageEntries`(`package.ts`)、殻は `emit.ts`(雛形の読み込み、resvg での PNG 化、zip)。PNG に使うフォントは `rasterFonts` で呼び出し側が明示する(測定器のグローバルを読まない)。雛形は `lib/pptx/template/`(`pnpm run build` で `dist/` にも入る)。`./pptx` の公開エクスポートは付けていない。

`examples/*.ts` の 146 本を通した結果(以下の数値はスパイクの `batch.ts` と PoC の診断用 `Report` が数えたもので、リファクタで両方とも削除した。再現するなら、出力 zip の `slide1.xml` の `<p:cxnSp>` / `stCxn` / `endCxn` / `<p:pic>` を数える):

- **全 146 本が生成でき**、zip は壊れず、スライド XML はすべて整形式(`xmllint`)。`dist/` から出したものとソースから出したものはバイト一致。
- ネイティブ(283 バンド): caption 153、group 45、row 30、box 30、table 10、banner 9、grid 6。画像(166 バンド): tree 10、cause 11、wordart 12、bars 14、plane 11、quadrant 9、legend 8、timeline 5 ほか、chart は全 kind(sankey・treemap・heatmap を含む)。
- コネクタ: 両端接続 25、片端 3、接続なし 7。経路が当てはまらなかったバンド内の辺 5 本(gantt の依存線 4、cloud の斜め 1)は画像バンドの中に残る。
- LibreOffice で描いた見た目は、表・箱・グラフ(画像)とも SVG と一致している(目視)。
- 型検査と PPTX のテスト 9 件(判定役を含む)は通る。全体の `pnpm test`(1781 件)で落ちるのは既知のフォント差の 2 件(layout-budget、svg-lint-browser)のみ。

PoC で未完のもの(後続):

- icon の絵柄は描かない(空の枠は出さない)。画像バンドの透明アンカーは、画像と同じグループに入っていない。画像バンドの範囲はバンドの矩形に 12px の余白を足したもので、インクの範囲ではない。画像の中の文字のアウトライン化は未着手。
- `.svg-diagram.json` の `fonts` と PowerPoint の書体名を自動で対応づけられないので、書体名は既定(BIZ UDPGothic)か `--font`。
