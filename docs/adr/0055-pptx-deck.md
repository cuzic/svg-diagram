# ADR 0055: 複数の図を、16:9 のスライドのデッキとして 1 つの PowerPoint にする

- 状態: 実装済み
- 日付: 2026-11-13
- 基点: `main`(ADR 0054 まで、PR #363)
- 関連: ADR 0027(PowerPoint 書き出し)、ADR 0018(deck viewer)、ADR 0052(スライド用キャンバス)、ADR 0054(グループと名前)。MCP 側の使い方は svg-diagram-mcp-plugin の ADR 0001。

## 背景

PowerPoint 書き出し(ADR 0027)は、図 1 つを 1 枚の pptx にする。スライドの大きさは図の大きさで、見出しもノートもない。研修の資料(Slidev の 3 枚)を pptx にもしたいとき、作り手は外のスクリプト(`build-pptx-figures.ts` と `build-pptx.py`)で、図ごとの pptx から spTree を取り出し、座標と文字を k 倍してスライドに移し、見出し・リード・枠・ノートを足していた。このやり方は次のとおり動いたが、画像の帯を持つ図は移せず、パッケージの組み直し(rels・Content_Types・presentation.xml・app.xml)を外で持っていた。

- グループを縮めると、PowerPoint は中の文字を縮めない。だから図を 1 つのグループとして縮めるのでなく、図形 1 つ 1 つの座標と大きさと文字を k 倍する。
- 図形の id は図のものをそのまま使う(コネクタの `stCxn` / `endCxn` が指している)。

## 決定

- D1. 入力は JSON のデッキ(`lib/deck-spec.ts`): `{title?, slides: [{title?, lead?, figure?, callouts?: [{label?, text}], source?, notes?}]}`。`figure` は図 1 つの JSON spec(`lib/spec.ts`)そのもの。スライドは 30 枚まで、強調の枠は 1 枚に 3 つまで。`notes` だけが改行を持てる。
  - `deckSchema`(図の spec を含む JSON Schema)と `validateDeck()`(場所付きの誤り)を公開する。図の誤りは `slides[2].figure.parts[0].nodes[1]` のように、デッキの中の場所で返す(図全体の誤りは `slides[2].figure`)。
- D2. スライドは 1280 × 720px(13.333 × 7.5in、PowerPoint の 16:9)。上から見出し(37px 太字)とリード(19px)、下から出典(13px)と強調の枠(16px、地の文は細字・本文は太字、薄い青の地に左の線)。残った領域に図を置く。
- D3. 図は自分の大きさで配置し(`planSlide`、ADR 0027 のまま)、領域に収まる倍率 k(上限 1.25)で、図形 1 つ 1 つを k 倍して置く(`placeShapes`)。
  - k 倍するのは、スライド上の長さ: `a:off` / `a:chOff`(と平行移動)、`a:ext` / `a:chExt`、表の `gridCol w` と `tr h`、`tcPr` と `bodyPr` の余白、段落の `marL` / `indent`、`tab pos`、文字の `sz`、`spcPts`、線の太さ(`a:ln` と表の `lnL` / `lnR` / `lnT` / `lnB` の `w`)。
  - k 倍しないのは、図形の中の座標系(`a:path w/h`、`a:pt`、`a:pos`、`arcTo wR/hR`)、角度、色、id、数。
  - 書き出しが出す数値の属性はすべて、どちらかに分けてテストに書く(`test/pptx-deck.test.ts`)。新しい属性を出すようになると、そのテストが落ちる。
- D4. k 倍した後のいちばん小さい文字が 9pt を下回るときは、ファイルは作ったうえで警告(`warnings`、場所は `slides[i].figure`)を返す。見出し・リード・枠・出典で図の領域が残らない(高さ 48px 未満)ときは誤り(`slides[i]`)にする。縮めた後に、重なりなどの検査はやり直さない。重なりは図自身の検査(`renderSpecEdge` / `build`)の結果が、倍率を変えても保たれる。
- D5. 図形の id は図のものをそのまま使い、スライドで足す図形はその最大の次から振る。暗い図(`appearance: 'dark'`)は、その背景色の長方形を図の後ろに置く(スライド自体は明るいまま)。
- D6. 画像の帯(svgBlip + PNG)は、スライドごとの rels で同じ rId(`imageRids`)のまま使い、media の名前だけをデッキ全体の通し番号にする(`image1.png`、`image2.svg` ...)。
- D7. パッケージは 1 枚のときと同じテンプレート(ADR 0027 D4)から作る。スライドの数だけ slide・notesSlide とその rels を置き、`presentation.xml`(大きさ・スライドの一覧)、その rels、`[Content_Types].xml`、`docProps/app.xml`(枚数とスライドの名前)、`docProps/core.xml`(デッキの題)を書き換える。テンプレートの `presentation.xml` はスライドの一覧がノートマスターの一覧より前にあり、pml.xsd に通らない。デッキではスキーマの順(`notesMasterIdLst` の後)に置く。1 枚の書き出し(`packageEntries`)は golden を変えるので、別に直す。
- D8. 入口は 2 つ。
  - `svg-diagram/pptx/deck/edge` の `renderDeckPptxEdge(deck, engine, {rasterize, font?, pngScale?})`: ファイルシステムなし(`renderPptxEdge` と同じ受け取り方)。図ごとの配置と画像の文字のアウトライン化は `renderPptxEdge` と共通の `planFigureEdge`。見出しなどの幅は `engine.textBox` で測る。
  - CLI `svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]`: `figure` には spec のほか、デッキのファイルからの相対パスで `.ts`(DSL の図)か `.json`(spec のファイル)を書ける。測り方と PNG は `svg-diagram pptx` と同じ(プロジェクトのフォント、resvg)。見出しなどの文字は、図と同じく atom ごとにまとめて測る。
- D9. 同じ入力からは同じバイト列ができる(テストで比べる)。

## 結果

- `~/spacely/nov18` の 3 枚のデッキ(表・フロー・比較の図、リード、強調の枠、出典、ノート)が、外のスクリプトなしで作れる。Worker 相当(workerd の text engine)で 3 枚 170ms ほど。2 枚目のフローの図は 85% に縮められ、いちばん小さい文字が 8.9pt になるので警告が出る。
- 確かめたこと: pml.xsd でスライド・ノート・presentation.xml がすべて通る、python-pptx で開ける、すべての図形がスライドの枠内、コネクタの接着先がそのスライドにある、`test/helpers/pptx/preview.ts`(スライド番号を指定できるようにした)で見た目。
- 確かめていないこと: PowerPoint 実機で開いたときの修復の確認と見た目。Google スライドと Keynote(SVG の画像の帯は PNG で描かれる)。
- 既知の限界: 図の文字はリードなどと違い、図の配置の時点で折り返しが決まっている。k 倍しても折り返しは変わらないので、PowerPoint のフォントで幅が少し違うと、1 枚のときと同じだけ行がずれる(ADR 0027 の既知の限界のまま)。

## 検討したほかの案

- 図をスライドの領域の幅で配置し直す: 文字を縮めずに済むが、spec に幅の指定がなく、部品ごとに配置の結果が変わる(図自身の検査と golden も別になる)。k 倍は 1 枚の書き出しの結果をそのまま使える。
- 図を 1 つのグループにして縮める: PowerPoint はグループを縮めても文字を縮めない。
- Slidev の md を直接読む: 書き方が自由で、何を見出しやリードとみなすかが利用者ごとに違う。まず JSON にし、md からの変換は使う側に置く。

## レビュー(Opus、2026-11-13)で直したこと

- CLI で `.ts` の図を書いたスライドは、検証を通すために入れた仮の見出し(図のパス)がそのまま見出しとファイルのプロパティに出ていた → 仮の見出しは検証用の写しにだけ入れ、描くのは書かれたとおりのスライドにした。`.json` が読めないとき・拡張子が違うときは、場所付きのエラーにした。
- 図のないスライドで、上の文字(見出し・リード)と下の文字(枠・出典)が重なっても何も言わなかった → 重なるときは `slides[i]` の誤りにした(`roomMessage`)。
- 拡大縮小のテストが、縮め忘れ(値が変わらない)を見逃していた → 半分にしたときに、下限で丸める属性(文字 1pt、線 0.25pt)以外は必ず半分になることを確かめる。
- テンプレートの置換が外れても気づかなかった → 置換ごとに当たったことを確かめ、外れたら止める(`once`)。
- ノートの空行と字下げが消えていた → 空行は空の段落、字下げ(タブ)は残す。`notes` のタブは検証で拒まない。
- 拡大した図にも「to fit」と警告していた → 縮めたときだけそう書く(`smallTextWarning`)。
- 図の形が割り当ての領域から数 px はみ出すことがあった → 図の領域の上下に 6px の余白を取る。
- `{callouts: undefined}` のような値で検証が例外になった → 誤りとして返す(spec.ts の `describe`)。
- 残したこと: 画像(アウトライン化した SVG)の中の文字の大きさは `minTextPt` に入らない。図の検証が自分で付ける「and N more」は、デッキでも 1 件の誤りとして数える。
