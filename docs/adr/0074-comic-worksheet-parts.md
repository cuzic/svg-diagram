# ADR 0074: 穴(空欄)のあるマンガの部品 — `comic()`(コマ)、`bubble()`(ふきだし)、キャラクター、穴(slot)、Artifact との受け渡し、`chat()`

- 状態: 承認(Accepted。2026-11-22。横並びの割り(`2x1` `3x1` `4x1`)と `fontSize` を 2026-11-26 に追補(下の「横並びの割りと文字の大きさの実装メモ」)。レビュー 3 回で収束。Q1〜Q10 は決める人がすべて推奨どおりに決定。下の「決定済み」。一部実装済み。U1(`comic()` と台詞 1 つの `speechBubble()`)、U2(顔と素材の形)、U3a(穴の値・値の検査・幾何の地図・最初の `renderComic`・穴への接続)は実装した(`lib/comic/`。下の各実装メモ)。U2 は PR #442 の round 1 と round 2 の素材検査、および補足仕様の `anchors.top` の公開型を反映。レビューの反映: 1 回目 Blocker 1・Major 7、2 回目 Major 2(穴の後ろのひらがなの結び方、値に依存する検査と `verdict` の関係)、3 回目 Major 1(`update` の差分の基準))
- 日付: 2026-11-22
- 基点: `main`(eec05f8c、PR #431 まで)
- 関連: ADR 0045(`svg-diagram/browser`、測定を外から渡す)、ADR 0057(spec の `canvas`)、ADR 0071(JSON Schema をパッケージに入れる)、ADR 0034(`data-node`)、ADR 0050(組み合わせられる帯)、ADR 0012(id のスコープ)、ADR 0009(縦書き)、ADR 0007(Ports)
- 範囲外: Artifact の画面(状態・保存など)は svg-diagram の外。ここで出すのは見本のテンプレートだけ。`Dialogue` / `cast` / `Values` を使うほかの図は、必要になったときのあとの ADR で決める
- 例のデータはすべてこの ADR のための作り話(テーマ「週に一度は早く帰る」。同僚の台詞「最近、{change}ね」など)

## 背景

claude.ai の Artifact(1 枚の HTML。`svg-diagram/browser` を jsDelivr から読む)のようなページで、台詞に短い穴のあるマンガを組み、値を入れて SVG / PNG に書き出したい。書き出しでは、印刷用に文字を輪郭にできること。同じ台詞のデータを、LINE 風のチャットとしても描けること。

そのため、**データは意味が先**(テンプレートと穴の値)で、配置とは別にする。台詞を書き換えてもキャラクターやコマは動かず、同じデータと同じ値は同じ絵になる。

### コードで確かめたこと(再利用できるもの)

| 部品 | 場所 | この ADR での使い道 |
|---|---|---|
| ブラウザ入口 | `lib/web.ts`(`renderInBrowser(diagram, {measure})`、`svgMeasurer`)。`WebMeasurer` は非同期でもよい(`web.ts:25`)。結果の `WebRender` は `verdict` / `fit` / `laidOut` を持つ。`image()` と `math()` はここでは投げる | 描画の入口。`renderComic` はこの隣に置く(D5)。`image()` が使えないので、キャラクターは絵のファイルでなく SVG の断片で持つ(D3) |
| 配置の流れ | `lib/layout-measure.ts` の `collectMeasures`(1 回目: 使う文字を全部登録)→ 同期の `layoutWith(widthOf)` → 測定なしの `emitOutputs`。登録のない原子の幅は 0 | 穴の**値**は 1 回目に分からない(D5 の設計の理由) |
| JSON の spec と Schema | `lib/spec.ts`、`lib/spec-parts/r1〜r7.ts`、`lib/schema-files.ts`、`schema/*.schema.json`、`test/schema-files.test.ts`(ADR 0071) | `comic` を部品として spec に足し、`schema/comic.schema.json` を同じやり方で出す(D6) |
| 日本語の折り返し | `lib/wrap.ts` の `wrapStyledAtoms`(禁則、`phrase` / `char` / `bunsetsu`、原子の `glue`)、`lib/atoms.ts` の `splitAtoms` | ふきだしの行分け(D2) |
| 語の途中の改行の検査 | `lib/text-rules.ts` の `midWordBreaksIn`。見るのはカタカナと英字の連なりだけで、ひらがなと漢字の切れ目は見ない(`text-rules.ts:1-5`、`:33-48`) | 使えない。穴のあるふきだしと「上が / ります」のようなひらがなの切れ目には専用の検査を書く(D2) |
| 縦書き | `lib/wordart-vertical.ts` の `verticalColumns(text, size, weight, widthOf, {limit, spacing})`、`COLUMN_PITCH = 1.4`、約物のぶら下げ | 縦書きのふきだし(D2、第 2 版) |
| 文字の輪郭化 | `lib/svg-outline.ts` の `outlineText(svg, OutlineFont, textBox)`。字形は呼び出し側が渡す(ADR 0007)。`svg-diagram/spec/edge` が同じ形で公開 | 印刷用の書き出し。ブラウザ側の `OutlineFont` は今は無い(D5) |
| ラスタ | `lib/raster.ts`(resvg / Chromium)。Node のみ | Node 側の PNG。ブラウザでは canvas を使う(スパイクで確認) |
| アイコン | `lib/icon-registry.ts` の `icon.use(manifest)`(モジュールの大域の状態)、`lib/icon-store.ts` の `IconGlyph`、`glyphFromBody`(正方形の viewBox の中に中央寄せする)、`sanitizeBody`(名前つきの色、`<text>`、`<use>`、`<style>`、mask、filter を拒む) | 素材の置き場と掃除のやり方。ただし癖があるので、そのままは使わない(D3) |
| 人のかたち | `lib/people.ts` の `PERSON_PATH`(24px の箱の頭と肩) | 顔のない人物の既定(第 2 版以降) |
| 注釈の吹き出し | `lib/dsl/connect.ts` の `callout()`(`ConnectBand` の `annot`。箱への引き出し線と札) | マンガのふきだしとは別物。使わない |
| 帯を足す手間 | `valueChain` で grep すると `lib/` の 21 ファイル。ただし `valueChain` は `flow-shapes` を使い回していて、ほとんどが 1 行の表の登録 | `comic` は本物の配置・測定・検査・出力を持つので、20〜25 ファイルの登録(多くは 1 行)と、`lib/comic/` の約 8 ファイル(影響) |
| 検査の仕組み | `lib/rules.ts`(`RULE_DOCS`、WCAG のコントラスト)、`lib/verify-handlers.ts` の `rects` / `check`、`lib/finding-rules.ts` の `at()`、`lib/emit-node-ids.ts`(帯の種類ごとの `switch`)、`lib/anchor-scope.ts`(`assertScope` が `. : @ #` を拒む) | D6 の検査、D5 の地図、id の文法 |
| canvas・reveal | `lib/canvas.ts`、`lib/reveal-handlers.ts`(`plain`) | コマ単位の `reveal`(第 1 版は帯ごとの `plain`) |
| 最小の文字 | `lib/tokens.ts` の `MIN_FONT_SIZE = 14`(`canvas.minText` は 10 まで下げられる) | ふきだしの文字を縮める下限(D2) |

### スパイクの結果(`spikes/comic-worksheet/`。`lib/` は触っていない)

`proto.ts`(約 236 行)は、意味が先のデータから、縦 1×4 のマンガの SVG と矩形の地図を作る使い捨ての試作。測定は関数で受け取る。`run.ts` は Node(HarfBuzz)で、`browser-check.mjs` は headless Chromium で動かす。レビュー 1 回目のあとで、D2〜D5 の規則(下)を試作に入れて測り直した。

| 測ったこと | 結果 |
|---|---|
| 1×4(1 コマ 420×300)、顔 8 表情、ふきだし 6 個、穴 5 個 | 描ける。顔は約 60 行(目 4 種・眉の傾き・口 8 種・髪と服の色相)。決定的で、ライセンスの問題がない。絵としては粗い |
| 日本語の行分け(本物の `wrapStyledAtoms`、`bunsetsu`、18px、内側 162px) | 規則の選び直し(2 回目のレビュー)。穴の後ろのひらがなを**全部**穴に結ぶと、ふつうの文型で箱が広がりすぎた(`先に{p}しておきます。` 260px、`{p}してもらえると助かります。` 312px)。そこで 4 つの結び方を、ふつうの 9 文型で測った(下の表)。採ったのは `fit2q`(3 回目のレビューで `fit2p` から直した): 結ぶのは助詞(は が を に で の と も へ や。「です」の「で」は除く)と、内側の幅に収まる範囲で最大 2 字まで。結果の箱は 188〜204px(2 個が横に並ぶ)。「ひらがなの連なりの中での改行」は 4 で、穴を使わず漢字で書いた同じ文(`literal`)と同数。穴の直後の改行が 2 つあるが、どちらも「穴 | です」「穴 | してもらえる」という自然な切れ目 |
| 穴の幅 | 穴は最大 9 字(= 内側の幅 162px)に制限する(製品の制約。D4)。穴 + 結んだひらがなが内側の幅を超えるときは、内側の幅をその分だけ広げる(最大で内側 + 2 字) |
| 穴を埋めても幾何が変わらないか | 空・埋めた・飛ばし・長すぎる値の 4 状態で、穴の中身と `<title>` を除いた SVG が完全に一致する。`<title>` は値で変わるので、`update` の結果に含める(D5) |
| 長すぎる値 | 18px から 14px(`MIN_FONT_SIZE`)まで縮め、それでも入らなければ穴の矩形で切り(`clipPath`)、`slot-overflow`(問題)を返す。隣の文字には重ならない |
| 矩形の地図 | コマ 4・ふきだし 6・穴 5・頭 8・点(口と頭の円)8 の 31 件で 1375 バイト(約 45 バイト / 件) |
| 値を変えたときの描き直し | 試作の `svg(values)`(配置は持ち越し。値の幅だけを測って覚える)は、Node で新しい値 1 個が 0.14 ms、同じ値の繰り返しが 0.1 ms。実際の Chromium の `svgMeasurer` では、新しい値 1 個が 0.7〜1.2 ms、5 個が 0.4〜0.5 ms(暖まったあと、測るたびに揺れる)。**これは文字列の組み直しの下限であって、`renderInBrowser` の費用ではない。** 小さな図 3 帯の `renderInBrowser` は同じ headless Chromium で 36〜48 ms。最初の配置は Node で 65〜74 ms(試作が 1 文字ごとに HarfBuzz を呼ぶので上限の目安。ブラウザでの配置は別に測っていない) |
| 測定の揺れ | 同じ文字を HarfBuzz は 16、Chromium は 16.0156 と測る。全角の原子は測らずちょうど 1 em にし、それ以外の原子は 1/4px に丸めてから整数 px に切り上げる(D2)。サンプルのすべての測定に ±0.0156px の揺れを足しても幾何も SVG も変わらず、Node と headless Chromium の SVG の**文字列が完全に一致**した(原子の位置まで同じ)。ただし、どの丸めにも崖があり、英字の原子では、揺れが崖をまたぐ幅が 1.6%(0.0156px の揺れのとき)ある。**CJK は厳密、英字は高い確率で一致、だが保証ではない**(D2 の 2) |
| 色のコントラスト | 案内と飛ばしの文字 `#5a6072`(白の上で 6.27:1)、埋めた値 `#bb2233`(6.2:1)。最初の版の `#889` は 3.5:1 前後で、14px の文字の規則(4.5:1)に届かなかったので直した |
| 検査が働くか | わざと悪くした台詞(同じ側に 2 人、話し手が舞台にいない、`max` が範囲外、案内が長すぎる、穴の定義がない、1 コマに 3 個の穴)で、D6 の「試」の検査 7 種がすべて報告した。D6 の表の「試」がついていない規則は、まだ紙の上だけ。**サンプルは書き換えていない**: 1 回目のレビューのあと、通すためにサンプルの 2 行(`先に{prep}しておきます。`、`えっ、{what}は大丈夫なの？`)を短くしてしまったが、2 回目のレビューの指摘で元の台詞に戻した。元の台詞だと 2 コマ目は、3 行のふきだしが 2 個積まれて、根本の原因の `comic-bubble-zone`(積みが 222px、帯は 184px まで)と `comic-text-budget`(積んだ行が 6)の 2 件だけを報告する。顔やしっぽの検査は、帯があふれたふきだしでは走らせない(その結果にすぎないため。1 つの誤りに 1 つの報告)。高さの予算は D1 |
| 配布経路(jsDelivr、headless Chromium、npm の 0.9.0) | `import('https://cdn.jsdelivr.net/npm/svg-diagram@0.9.0/dist/lib/web.js')` が動く(168 リクエスト、約 170 KB。読み込みは 0.2〜0.3 秒。初回は 3〜7 秒かかることがある)。`diagram` / `box` / `row` / `wordart` / `people` を描けて verdict は ok。`callout` / `canvas` / `icon` / `image` も公開名にある(`image()` は設計どおり投げる)。`…/browser/+esm` は 1 リクエストで 135 の公開名が取れた(初回の測定のみ)。同じページで SVG → `<img>` → canvas → PNG(2 倍、約 300 KB)も動いた |
| まだ確かめていないこと | (1) 実際の Artifact の枠(CSP、iframe の制限)の中での動作。(2) ブラウザでの文字の輪郭化(日本語の `OutlineFont` をブラウザで作る手段は今ない)。(3) 日本語のフォントが入っていない環境での `svgMeasurer`(豆腐の幅)と検査の振る舞い(測った環境にはフォントがある)。(4) `+esm` の再測定 |

## 決定

全体の方針: **コマ・ふきだし・穴・キャラクターは、帯 `comic()` の中で閉じた 1 つのモデルとして配置する**(個別の `box` の寄せ集めにしない)。しっぽ・顔・穴の検査に「話し手」「口の位置」「穴の矩形」という関係が要り、一般の箱と矢印では持てないため。実装は `lib/comic/` に集める。入力は D6 の JSON が正で、TS の DSL(`comic({...})`)は同じ形を書くだけの薄い入口にする。

**ID の文法(全体の規則)。** コマ・人物・台詞・穴の id は `^[A-Za-z][A-Za-z0-9_-]*$`(`. : @ #` を使わない。`assertScope` と同じ)。これらを `.` でつなぐと一意な名前になる(コマ `p1`、ふきだし `p1.d2`、人物の頭 `p1.me`)。帯に scope(ADR 0012)があれば、さらに前に `scope.` が付く。穴の id はワークシート全体で一意(D4)。ほかの帯の id との衝突は `comic-id-collision`(問題)で止める。

### D1. `comic()` 帯(コマの割り)

**選択肢**: A. 縦 1×4 だけ。B. 名前付きの割り(`1x4` / `2x2` / `1x3` / `1x2`)で `span` を持たない。C. 自由な格子(`cols` / `rows` / `span`)。

**推奨: B。** 日本の 4 コマの標準は縦 1×4(スマホの縦長の画面にも合う)で、2×2 は印刷の A4 用に要る。C は大ゴマが要るマンガに向くが、検査の幾何と LLM の出力の安定が先に崩れる。名前を数個に絞れば Schema の `enum` で止められる。

- 大きさ: コマの幅は内容幅(1×4 は 420px を基準に `canvas` の幅に合わせる)、縦横比は 6:5(`aspect` で `7:5` / `1:1` にも変えられる。U1 で 7:5 と比べて確定した。Q10。スパイクは 7:5 の 420×300)。高さは 4px の格子に丸める(6:5 は 352px)。2×2 は縦横比 1:1 が既定で、コマの幅は 360px(U1 で決めた。縦の列は 420px)。
- 枠と溝: 枠線 3px、溝 16px、外側の余白 16px。すべて 4px の格子に乗せる(`coordinate-grid` の助言を通すため)。
- 番号: 左上に 24px の黒い札で 1〜4(`numbering: true` が既定)。`labels: ['起', '承', '転', '結']` で中身を変えられる。
- コマの読む順: 上から下(1×4)、左から右へ行ごと(2×2)。`dir: 'rtl'` は縦書き(第 2 版)で予約し、`ltr` 以外は未実装のエラーにする。
- **コマの中の人物(規範)。** `at` は `left` / `center` / `right`。頭の中心の x は、`left` がコマの左端から 104px、`right` が右端から 104px、`center` が幅の半分を 4px の格子に切り下げた位置(420px のコマで 208px、360px のコマで 180px)。頭の高さは下から 76px で固定(半径 36px)、胸から下は枠で切る。同じ `at` に 2 人は置けない(`comic-at-collision`)。
- **コマの中のふきだし(規範。決定的で、データだけから決まる)。** ふきだしは `dialogue` の並びの順(= 読む順)に置く。x は話し手の頭にそろえ、コマの中に収める(4px の格子)。y は、コマの上(16px)から置き、**先に置いたふきだしのうち、横の範囲が重なるもの、または自分より右にあるものの下に積む**。つまり、同じ高さに並べてよいのは、先のふきだしがすべて自分より左にあるときだけ(左から右へ読む順と、台詞の順が食い違わない)。台詞の順が右から左なら、2 つ目は 1 つ目の下になる。`anchor: 'top-left'` などで上書きでき、上書きが読む順と食い違えば `comic-reading-order`(助言)。
- 背景: `bg` は色味(`tint: 'warm' | 'cool' | 'plain'`)と、あれば 1 つのアイコン。絵の背景は範囲外。
- **ふきだしの高さの予算(規範)。** 頭の上の帯は、コマの上 16px から頭の上端の 4px 手前(1 コマ 300px のとき 184px)までの 168px。ふきだしの高さは「行数 × 26px + 20px」を 4px の格子に切り上げた値(1 行 48、2 行 72、3 行 100)で、積むときの隙間は 6px。したがって 2 個を積めるのは、行数が 2+2 か 1+3(150〜154px)まで。3+2(178px)は入らない。入らなければ `comic-bubble-zone`(問題)。`comic-text-budget`(問題)は、同じことを入力側の数で言う: 1 コマの積むふきだしの行数の合計が、帯に入る行数(`(帯の高さ − 6 − 40) / 26` の切り捨て。7:5 の 300px で 4、6:5 の 352px で 6)を超える、または 1 個のふきだしが 4 行以上(穴を最大の幅で数える)。**U1 で、行数の上限を縦横比に連動させた**(4 に固定すると、6:5 で入る 3+3 行を誤って止めるため)。

### D2. `bubble()`(ふきだし)

**種類**

| `kind` | 形 | しっぽ |
|---|---|---|
| `say` | 角丸の四角(角丸 `min(高さ/2, 24)`。ほぼ楕円に見える) | 三角。話し手の口へ向ける |
| `think` | 同じ形を破線に | 第 1 版は破線の三角で、`say` と同じしっぽの検査を使う。小さな丸 3 つのしっぽは U1 で試し、そのときは丸を結ぶ線の向きを同じ許容(10°)で見る |
| `shout` | 太い枠の四角(ぎざぎざは U1 で試す) | 三角 |
| `narration` | 四角、しっぽなし | なし(コマの隅に置く) |

**楕円にしない理由。** 楕円の中に文字の四角を収めるには、両方向に √2 倍が要る。内側 168px の文が幅 260px になり、420px のコマに 2 個が横に並ばない。丸角の四角なら余白 12 / 10px で足りる。本物の楕円は `shape: 'ellipse'` として後で足せる。

**しっぽの向き(規範)。** ふきだしの中心から話し手の口のアンカーへ引いた線上に、しっぽの先を置く。先は、その線が頭の円に入る点の手前 6px で止める(顔を覆わない)。付け根は、その線がふきだしの縁を通る点。検査は、付け根から先への向きと、付け根から口への向きの差が 10°(0.17 rad)以内かを見る。

**文字**

- 横書きを第 1 版で出す(Q1)。縦書きは `writing: 'vertical'` として、同じ「箱は最大の文字数から決める」規則のまま `verticalColumns` で列に割る第 2 版にする。
- 文字は 18px(`MIN_FONT_SIZE` = 14 まで縮める余地を 22% 残す)、行の高さ 26px。穴の案内と札の数字は 14px。
- **出力。** 1 行は 1 つの `<text>`(穴で途切れるときは、穴の前後で別の `<text>`)。ふきだしごとに `<title>`(穴を値か「＿＿」で埋めた文)を付け、コピー・検索・読み上げの手がかりにする。原子ごとに `<text>` を作らない(スパイクの最初の版は 1 文字 1 要素で 67 個になった)。

**大きさ(規範。「穴を埋めても配置が動かない」を成り立たせる決定)**

1. ふきだしの箱は、**テンプレートの穴を、それぞれの最大の文字数(`max`)× 全角 1 文字分で置き換えた文**から決める。値は箱を決めるときに使わない。
2. **幅の数え方(`comic` / `chat` の中だけ)。** 全角の原子(CJK・全角の約物、`splitAtoms` が 1 字ずつ分けるもの)は、測らずにちょうど 1 em とする。それ以外の原子(英字・数字の連なり)は、測った幅を 1/4px に丸めてから、整数 px に切り上げる(`Math.ceil(Math.round(w * 4) / 4)`)。HarfBuzz は 16、Chromium は 16.0156 と測るので、素朴な丸めでは .5 や 4px の格子の境で割れる。丸めに崖は必ずあり、これは崖を `k + 0.125` に置く(フォントの送り幅が実際に来にくい所)。0.0156px の揺れで崖をまたぐ幅は 1.6% なので、**英字の原子の一致は保証でなく高い確率**。全角だけのテンプレートは厳密に一致する。`WidthOf` を包む `comic` 専用の関数で行い、ほかの帯の `textWidth` は変えない(既存の golden は変わらない。テストで確かめる)。
3. 折り返しは `wrapStyledAtoms` に **`bunsetsu`** で行う(`char` と `phrase` はひらがなの切れ目に効かない)。穴は途中で折らない 1 つの原子で、**穴の後ろのひらがなのうち、助詞(は が を に で の と も へ や。ただし「です」の「で」は助詞に数えない)と、塊が内側の幅(既定 162px = 9 字)に収まる範囲で最大 2 字までを `glue` で穴につける**(`fit2q`)。残りは通常の `bunsetsu` に任せる。塊が行に入らなければ、穴の前で折る。内側の幅は、既定 162px と、助詞まで結んだ塊のうち大きい方にする。それでも内側の幅 + 2 字を超えるなら `comic-bubble-wide`(助言。穴を短くするか、ひらがなを減らす)。穴の後ろを全部結ぶ規則(`all`)は、ふつうの文型で 260〜312px になり、2 個のふきだしが横に並べなくなるので採らない。結び方は文字で決める近似で、形態素の解析ではない(「でき」「でも」の「で」、「やる」の「や」は助詞でなくても結ぶ。害は幅が少し変わるだけ)。下の数字は、この 9 文型と `max`(穴の列)に固有で、助詞までの塊が 162px を超えると「2 字まで」が働かなくなる(`最近、{p}ですね。`(9) が分かれる理由)。下の表は 9 文型の測定(18px、`max` は穴の列。`literal` は穴を同じ幅の漢字で書いた場合の `bunsetsu` の結果で、基準)。

| 規則 | 箱の幅(9 文型) | 広い箱(> 188px)の数 | ひらがなの連なりの中の改行 | 穴の直後の改行 |
|---|---|---|---|---|
| `all`(全部結ぶ) | 188〜312 | 8 | 1 | 0 |
| `two`(2 字まで) | 188〜260 | 5 | 6 | 0 |
| `particle`(助詞だけ) | 188〜204 | 4 | 5 | 1 |
| `fit2`(収まる範囲で 2 字まで) | 188〜204 | 2 | 4 | 3(うち助詞の「の」が穴から離れるものがある) |
| `fit2p`(助詞は必ず結び、それ以外は収まる範囲で 2 字まで) | 188〜204 | 4 | 5(`で / すね。` が増える) | 1 |
| **`fit2q`(採用: `fit2p` だが「です」の「で」は結ばない)** | **188〜204** | **3** | **4(`literal` と同数)** | **2(自然な切れ目)** |
| `literal`(基準: 穴なし、漢字で書く) | 188〜204 | — | 4 | — |

`fit2q` は、箱の幅を 2 個が横に並ぶ幅(188 + 204 ≤ 404px)に収めつつ、穴の直後で助詞が離れることをなくし、基準の `literal` より連なりの中の改行を増やさない。残る「連なりの中の改行」(`{p}してお / きます。` など)は、基準も同じに出す、ライブラリの `bunsetsu` の限界。`comic-follower-split`(助言)が、穴の後ろの連なりが 3 字以下で割れるものを報告する。(`fit2` は、助詞の「の」が穴から離れる例があって採らなかった。)
4. **孤立行を作らない。** 最後の行が 2 字以下(「…」「ね。」「！？」の連なり)なら、内側の幅を 1 字、さらに 2 字まで広げて折り直し、直る最初の幅を採る。ただし、広げた幅が `comic-bubble-wide` の閾値(内側 162px + 2 字)を超えるときは広げない。直らなければ `comic-orphan-line`(助言)。広げる以外の方法(「…」を前の原子に結ぶ、約物のぶら下げ)は、幅を増やさずに済むので、U1 で試す(未決)。
5. 箱の幅と高さは 4px の格子に切り上げる。行の位置は、内側の矩形の中で行ごとに中央ぞろえ。穴の矩形の位置と大きさは、この「最大の文」で決まる。実際の値は、穴の矩形の中に中央ぞろえで書く。そのため、行数・穴の位置・後ろの文字の位置は、値に左右されない。
6. 値の幅は 1 回目の測定(`collectMeasures`)では分からない。D5 のとおり、値は帯のデータにせず、値の測定は `renderComic` の側で行う。
7. 値が穴の幅(`max` × 1 em)より広いときは、文字を縮める(下限 14px = `MIN_FONT_SIZE`。`canvas.minText` があればそちら)。下限でも入らなければ、**穴の矩形で切り**(`clipPath`)、隣の文字には重ねない。このとき `slot-overflow` を**値の検査の問題**として返す(D5。書き出しの前に止めるのはページの仕事)。**全角の値は、字数が `max` 以内なら 1 em × `max` を超えないので、縮みも切れも起きない**(`maxlength` = `max` と矛盾しない。D4)。全角でない値(幅のある英字の連なり、2 em ぶんを取る絵文字の結合列)は、字数が `max` 以内でも穴を超えうるので、縮み、下限でも入らなければ切れる。

**語の途中の改行の検査。** `midWordBreaksIn`(`lib/text-rules.ts`)は、ひらがなと漢字の切れ目を見ず、`{id}` を含む行も扱えないので使えない。`comic` 専用に、次の 3 つを見る: 孤立行(2 字以下の最終行)、穴の後ろのひらがなの連なりが 3 字以下で割れている(`comic-follower-split`)、内側の幅の超過(`comic-bubble-wide`)。

**保存した SVG と字体。** 穴の外の文字は、測ったフォントで 1 つの `<text>` として書かれる。保存した SVG を別のマシン(別の日本語フォント)で開くと、字幅が違って見えることがある(特に英字・数字)。字体に依存しないのは、文字を輪郭にした書き出し(D5)だけ。

### D3. キャラクターの素材

**素材の形(規範)**。渡す `CharacterManifest` は表情ごとの SVG 断片を含む 1 つの JSON。

```json
{
  "id": "colleague-a",
  "name": "同僚",
  "box": [0, 0, 200, 240],
  "anchors": {"head": {"cx": 100, "cy": 90, "r": 56}, "mouth": [100, 112], "hand": [150, 190]},
  "bubbleSides": ["top-left", "top", "top-right"],
  "expressions": {"neutral": "<circle cx=\"100\" cy=\"90\" r=\"56\"/>", "smile": "<path d=\"M82 108q18 16 36 0\"/>"},
  "license": {"spdx": "CC-BY-4.0", "author": "…", "url": "https://…"}
}
```

- `box` は座標の基準。表情の SVG はこの `viewBox` で描く。`anchors` は `box` の座標で、描くときに倍率をかけてコマの座標へ移す。`bubbleSides` は、ふきだしを置いてよい側(`anchor` の上書きの検査に使う。`comic-bubble-side`)。`license` は必須。
- `anchors.top` は任意で、全表情を通して絵が最も上に達する y 座標を指定する。省略時は頭の円の上端(`head.cy - head.r`)とする。コマに写した絵の上端から頭の円の上端までの範囲(横幅は箱の幅)がふきだしと重なれば、`comic-bubble-zone` を報告する。
- `box` の幅と高さはそれぞれ 0 より大きく 4096 以下とする。`anchors.head` の円は箱の中に収め、半径は短辺の 1/50 以上、半分以下とする。`license.url` は `http://` または `https://` に続けて空白を含まない文字を 1 字以上書く。
- **読み込み。** `icon-store` の `glyphFromBody` をそのままは使わない。(a) `glyphFromBody` は表情を**正方形**の viewBox の中に中央寄せするので、200×240 の `box` で x が 20px ずれ、アンカーが合わなくなる。読み込みは `box` をそのまま保つ。(b) `sanitizeBody` は、名前つきの色(`fill="white"`)・`<text>`・`<use>`・`<style>`・mask・filter を拒む。一般の描画ソフトの出力はこれに当たるので、素材を作る人向けに「許す要素」の一覧を `character.json` の説明に書く。(c) `<defs>` の id は、人物の 1 回の登場ごとに書き換える(同じ人物が 1 つのマンガに 2 回出ても、グラデーションの id が重ならない。ADR 0012 の考え方)。
- **渡し方。** U2 は `comic(sheet, {characters})` で素材を渡す。U3 の `renderComic(sheet, {characters})` も同じ引数を使う(1 回の描画ごと。`icon.use` のようなモジュールの大域の状態にしない。1 つのページで別の素材を使う描画が混ざらない)。`character.use(manifest)` は用意しない。ライセンスの欠落は素材を読み込むときに `comic-license-missing` で投げる。検査経路への登録は U4。
- manifest は 1 つの JSON(表情の断片を入れたもの)で、パッケージの `characters/` に入れて配るか、ページが自分で取得して渡す。

**既定: パラメトリックな簡単な顔。** 目(4 種)・眉(傾きと高さ)・口(8 種)の組み合わせで 8 表情(`neutral` / `smile` / `laugh` / `surprise` / `worry` / `angry` / `think` / `sad`)を、頭の円・髪・肩から数値だけで描く(スパイクの `face()`)。人物の違いは髪と服の色相(0〜359)と髪型(2 種で始める)で出す。アンカーは式で出す。**絵師がいなくても PoC が動き、決定的で、ライセンスの問題がない。** 素材の形と同じインタフェース(`{fragment(expression), anchors, box}`)を持つので、あとで絵師の素材に差し替えても、コマ・ふきだし・検査は変わらない。入口に内蔵し、ファイルを読まない。

参照は、データでは `cast` の `asset: "colleague-a"`(manifest の id)か `face: {hue, hair}`(パラメトリック)。同じ `cast` の中で混ぜてよい。見つからなければ `comic-asset-missing`。第 2 版以降: 顔のない人物の既定として `people()` の `PERSON_PATH` を使う。

### D4. 穴(slot)

**テンプレート**: `"tpl": "最近、{change}ね。"`。`{id}` は ID の文法に従う。波括弧そのものは `{{` / `}}`。穴の id は**ワークシート全体で一意**(値を 1 つの平らな表 `{change: '…'}` で持てる。コマごとの名前空間にすると値の表が入れ子になり、チャットとの共有も面倒になる)。重複は `comic-slot-duplicate`。

**穴の定義**(台詞の `slots`): `{max, prompt, fallback?, choices?}`。

| フィールド | 規則(検査 `comic-slot-*`) |
|---|---|
| `max` | 整数 1〜9(全角 1 文字 = 1)。**これは製品の制約で、物理的な制約ではない**: 穴が必ず内側の幅(162px = 9 字)の 1 行に入るようにして、「配置が動かない」の保証を簡単にするための上限。第 2 版の逃げ道として、`slot.wrap: true`(穴そのものを 2 行に割る)と、上限を上げて `comic-bubble-wide` に任せる案を残す。Schema の `minimum` / `maximum` でも止める。`choices` があって `max` が無いときは、いちばん長い候補の字数 |
| `prompt` | 空のときの案内、2〜4 字 |
| `fallback` | 飛ばしたときの文言、`max` 字以内(既定 `…`) |
| `choices` | 候補(Artifact がチップを出すためのもの。描画には使わない)。各候補は `max` 字以内、1 行、制御文字なし |

字数は書記素(絵文字や結合文字を 1 と数える)で数える。

**状態と描き方**(値の表では、未設定 = 空、`null` = 飛ばし、文字列 = 埋めた)

| 状態 | 描き方 |
|---|---|
| 空 | 穴の矩形の下に点線の下線(2px)。中央に案内(14px、`#5a6072`)。`blank: 'line'` では案内を出さず下線だけ(紙に手で書く用) |
| 埋めた | 矩形の中央に値(太字、強調色 `#bb2233`)。下線は出さない。長ければ縮め、それでも入らなければ切る(D2 の 7) |
| 飛ばし | `fallback`(既定の `…`)を `#5a6072` で、通常の太さで |

どの状態でも、穴の矩形と周りの文字は同じ位置にある。

**値の規則(`renderComic` が `values` に対して見る)**: 1 行・制御文字なし(ADR 0071 の `ONE_LINE` と同じ)、`max` 字以内、`choices` があっても候補外の値は許す(候補は提案。`strict: true` で候補外を問題にする)。定義のない穴の id の値は、無視して助言(`comic-values-unknown`)。

**1 コマに穴は 2 個まで**: `comic-slots-per-panel` が、1 コマの全ふきだしを合わせた穴の数(重複を除く)が 3 個以上のとき止める(問題)。1 つのふきだしの穴の数はこれに含まれる(上限はコマの数と同じ)。0 個のコマは許す。

**穴の幅の隙間と `max`(Q5)。** 穴は最大の幅で固定するので、短い値だと後ろの文字との間が空く(スパイクの見た目の問題)。`max` は「値として入れてよい最大の字数」で、入力欄の `maxlength`(書記素)と同じ数にする。したがって、`max` を詰めると入力も詰まる。LLM の判断に頼らず、`choices` を書く場合は最長の候補を `max` の既定とし、検査が 9 字を超える `max` を止める。第 2 版で、穴の後ろの文字を行の中で詰める方式(ふきだしの箱は動かさず、文字の位置が値で動く)を測る。

### D5. Artifact との受け渡し

**どこに値が入るか(規範)。** 穴の値は帯のデータにしない。理由: 配置の流れは、1 回目の測定(`collectMeasures`)で使う文字を全部登録し、その後は同期の純粋な関数で、値の幅は 1 回目に分からない。`comic` の帯は、**値に依存しない幾何だけ**を流れの中で配置し(全角の原子は測らず、英字の原子だけを登録し、穴の幅は `max` × 1 em)、穴は空の状態の `<g data-slot>` として出す。`renderComic` が、その上に値を載せる。

**`renderComic` は `renderInBrowser` の隣の関数にする**(第 2 の描画経路ではなく、中で `renderInBrowser` を呼ぶ)。したがって `verdict` / `xml` / `fit` / `laidOut` は共通で、検査の結果は 1 つの形(`verdict`)になる。

```ts
import {renderComic, svgMeasurer} from 'svg-diagram/browser';

const r = await renderComic(sheet, {measure: svgMeasurer(), values: {}, characters});
r.svg; r.width; r.height; r.verdict;                   // WebRender と同じ。値に依存しない検査だけ(下)
r.findings;                                            // 値に依存する検査(slot-overflow など)。最初の values に対する結果
r.geometry;                                            // 下
const u = await r.update({change: '早く帰る'});        // 値の全体の表を渡す。{seq, svg, slots, titles, findings}(下)
r.thumbnail('p1', {width: 160});                       // 1 コマの縮小図
```

- **`update(values)` は非同期にする(Promise を返す)。** `WebMeasurer` は非同期でもよい(`web.ts:25`)。同期の測定を要求すると、Worker や canvas の測定を持つページを締め出す。同期の `svgMeasurer` でも、`await` のコストは数マイクロ秒で、体感に影響しない。測るのは、**値が変わった穴の文字だけ**(同じ文字・大きさ・太さは一度測って覚える)。
- **`update` の契約(規範)。**
  - 引数は**値の全体の表**(`Values`。パッチではない)。穴を空に戻すには、その id をキーごと外す(`undefined` と同じ)。飛ばしは `null`。表にある定義のない id は無視し、`comic-values-unknown`(助言)を返す。
  - 戻りは次の和の型(`await` したあと `stale` を見てから使う):
    ```ts
    type UpdateResult =
      | {stale: true; seq: number}                                  // 古い結果。捨てる
      | {stale?: false; seq: number; svg: string;
         slots: Record<string, string>;    // 穴の id → '<g data-slot…>'
         titles: Record<string, string>;   // ふきだしの id → 穴を値か「＿＿」で埋めた文
         findings: Finding[]};             // この結果の値に対する値の検査
    ```
    `svg` は全体(置き換えるだけならこれで足りる)。`slots` と `titles` は、ページが DOM を部分的に直すためのもの(`<g data-slot>` の置き換えと、ふきだしの `<title>` の書き換え)。部分的に直すときは両方を適用する。**差分の基準は、最後に実際に届けた(`stale` でない)結果**であって、直前の呼び出しではない。`stale` の呼び出しは、値は計算するが `{stale: true, seq}` だけを返し、基準を動かさない。基準は、届ける時点(完了の順)で決める。これで、#1 を届け、#2 が `stale` になり、#3 を届けるとき、#3 の `slots` / `titles` は #1 との差分になり、#2 で入った変更が抜け落ちない。最初の `renderComic` の `findings` は、最初の `values` に対する結果の控えにすぎず、あとの `update().findings` とは別(それぞれ、その結果の値に対する検査)。
  - **最後の呼び出しが勝つ(それ以前の結果は `stale` になる)。** 各呼び出しに通し番号 `seq` を付け、呼び出しは順に始まる。測定が終わった時点で、自分の `seq` がまだ最新でなければ `stale` を返す(途中でやめるとは限らない)。非同期の測定で結果が順不同に戻っても、ページは `stale` でない結果だけを使う。
  - 値に依存する検査(`slot-overflow`、`comic-values-unknown`、値の規則に反する値)は、`verify-handlers` の規則でなく、**`renderComic` / `update` が返す `findings`**(`{rule, severity, message}`。`RULE_DOCS` に説明を持つ)。`verdict`(`ok` を含む)は値に依存しない配置の検査だけで、値が入っても変わらない。値の `findings` に問題があるときに保存を止めるのは、ページの仕事(見本が示す)。デッキ・MCP・CLI の経路(`comic` を spec の部品として描く)には値がないので、これらの検査は存在せず、空の状態の `verdict` だけが出る。値を持ち込む経路は `renderComic` だけ。
  - 保証の範囲: 幾何は値で変わらず、`verdict` と `fit` は空の状態で計算して、どの値の状態にも当てはまる(穴の文字は穴の矩形に切られ、ふきだしの箱は `max` で決まるため)。
- **保証: `update` は幾何を変えない**(`geometry` は同じ値のまま。テストで `deepEqual`)。測定の揺れを足しても、全角のテンプレートでは変わらない。
- **正直な費用。** 最初の `renderComic` は `renderInBrowser` と同じ(スパイクの小さな図で 36 ms。コマが 4 つの `comic` は別に測る: U3 の基準)。`update` は、スパイクで新しい値 1 個が 1.2 ms、5 個が 0.5 ms(`svgMeasurer`、暖まったあと)。この数値は文字列の組み直しの下限で、U3 では本物の `svgMeasurer` と、変わった穴の数を変えて測り直す。
- **幾何の地図(`geometry`)。** 型のある 1 つの構造で、`comic` の配置の関数が作る(`anchors` から集めない): `{panels, bubbles, slots, heads: Rect を id ごとに, points: {mouth: [x, y], head: [cx, cy, r]} を人物ごとに}`。口や頭の円のような**点**は、矩形の `Anchor`(`lib/types/core.ts`)に押し込まず、`points` に別に持つ。矩形は SVG の座標(viewBox の座標)で、ページは `getBoundingClientRect().width / r.width` の倍率で入力欄を重ねたり、クリックの当たりを調べたりする。キーは ID の文法のとおり: コマ `p1`、ふきだし `p1.d2`、穴は穴の id、頭は `p1.me`(帯に scope があれば前に `scope.`)。その一部(コマ・ふきだし・穴)は、接続の端にもなるよう `anchors` に登録する。大きさは、スパイクで 31 件、1.4 KB。
- **`data-node`。** `emit-node-ids.ts` は帯の種類ごとの `switch` なので、`comic` の case を足し、同じ地図のコマ・ふきだし・穴の枠に `data-node` を付ける(`nodeIds: true` のとき)。クリックは DOM からも引ける。
- **公開するか(Q4)。** 推奨は、`renderComic` と `geometry`・`update`・`thumbnail` を `svg-diagram/browser` に出し、**実験的**と README に書く。`lib/` には `@experimental` の印の前例がないので、「README に実験的と書き、semver の保証の対象外とする」と定める。`update` を使わず、毎回 `renderComic` を呼んでも正しく動く(速度だけの最適化)ので、取り消す被害は小さい。
- **縮小図。** 同じ配置の SVG の `viewBox` を 1 コマ(`thumb: true` のコマ。既定は 1 コマ目)に切って、`width` を縮める。穴は空のまま、案内は出さない。配置を作り直さない。縮小図は絵として扱い、文字の下限(14px)の対象外とする(18px の文字は 160px 幅で約 7px になる)。
- **入力欄を重ねる補助。** SVG の `viewBox` の矩形を画面の矩形に直す `toClientRect(rect, svgElement)`(`preserveAspectRatio` の余白、CSS の拡大、スクロールを含む)を `geometry` と一緒に出す。IME の変換中(`compositionstart` から `compositionend` まで)は `update` を呼ばない。`maxlength` は UTF-16 の単位で数えるので、見本は書記素で数える(U6)。

**注意(印刷用の輪郭化)。** ブラウザには、日本語の字形から `OutlineFont` を作る手段が今ない(Node は HarfBuzz、Worker は `svg-diagram/spec/edge` に呼び出し側が渡す)。第 1 版の Artifact は、(a) 文字が生きた SVG と、(b) canvas 経由の PNG(スパイクで動作)を出す。どちらも、見る人の端末のフォントで描かれる(D2 の「保存した SVG と字体」)。字体に依存しない輪郭化した SVG は、MCP / Node の経路で作る(Q6)。

### D6. データの型、JSON Schema、検査

**型(JSON。`comic` 部品の `spec` の形でもある)**

```ts
interface ComicWorksheet {
  version: 1;
  title: string;
  layout: '1x4' | '2x2' | '1x3' | '1x2' | '2x1' | '3x1' | '4x1';
  cast: Record<string, Cast>;          // 人物。id → 素材か顔のパラメータ
  panels: ComicPanel[];                // layout の数と一致
  numbering?: boolean; labels?: string[]; blank?: 'prompt' | 'line';
}
interface Cast { name: string; asset?: string; face?: {hue: number; hair?: 'short' | 'long'} }
interface ComicPanel {
  id: string; bg?: {tint?: 'warm' | 'cool' | 'plain'; icon?: string}; thumb?: boolean;
  stage: {who: string; at: 'left' | 'center' | 'right'; expression: Expression}[];
  dialogue: Dialogue[];                // 読む順
}
interface Dialogue {                   // チャットと共有する型
  id: string; who: string; kind: 'say' | 'think' | 'shout' | 'narration';
  tpl: string; slots?: Record<string, {max?: number; prompt: string; fallback?: string; choices?: string[]; strict?: boolean}>;
}
type Values = Record<string, string | null>;   // 値は別(状態)。無い = 空、null = 飛ばし
```

意味が先であることの保証: **データには座標も大きさも置かない**(`at` と `expression` は意味の名前)。値(`Values`)はデータに含めず、状態として別に持つ。

**Schema。** `comic` は spec の部品(`{type: 'comic', …ワークシート}`)として登録し、`schema/spec.schema.json` の `definitions` に入る(ADR 0071 D1)。ワークシート単体のファイルは `schema/comic.schema.json` で、ルートは同じ定義(`spec.schema.json#/definitions/…`)を相対で参照する(定義は 1 か所)。`lib/schema-files.ts` から作り、`pnpm schema` で書く。`version` は 1 だけを許し、それ以外は誤りにする。`layout` と `panels` の数の対応は、`if` / `then` の `minItems` / `maxItems` で Schema にも書く(エディタが警告する)。`who` が `cast` にあること、`tpl` の `{id}` と `slots` の対応などは Schema では言えないので検査に回す(ADR 0071 D5 の分担)。 別のファイルへの相対 `$ref` は、すでに `figure.schema.json` と `deck.schema.json` が `spec.schema.json#/definitions/parts` に対して使っていて、`test/schema-files.test.ts` が `ajv.addSchema` で解く(新しいやり方ではない)。 Schema の `description` には、LLM が検査の前に読めるよう、「ふきだしが 2 個あるコマでは、合わせて、7:5 は 4 行まで(1 個を 2 行まで。約 14 字)、既定の 6:5 は 6 行まで(1 個を 3 行まで)。穴を含めて数える」「穴は 1 コマに 2 個まで」「`max` は 1〜9」を書く。

**色。** 色は `lib/tokens.ts` のトーンの値を使う(スパイクは決め打ち)。マンガは紙の色のままにし、ダークテーマの変種は持たない(印刷と書き出しのため。`appearance` が `dark` / `auto` でも、帯の中の色は変わらない。実装は、ダークの再配色が触れない `rgb()` の書き方で出す)。案内・飛ばしの文字は白の上で 4.5:1 以上(スパイクの `#5a6072` は 6.27:1)。

**検査**(規則名は案。失敗する問題は `verify-handlers`、助言は `rules.ts` の `RULE_DOCS`。スパイクで動いたものに「試」)

| 規則 | 重さ | 内容 |
|---|---|---|
| `comic-asset-missing` | 問題 | 素材の id が manifest に無い、表情が素材に無い |
| `comic-license-missing` | 問題 | 素材にライセンスが無い |
| `comic-speaker-unknown` 試 | 問題 | `who` が `cast` に無い、または `stage` にいない |
| `comic-cast-unused` | 助言 | `cast` にいて、どのコマにも出ない |
| `comic-at-collision` 試 | 問題 | 同じコマの同じ `at` に 2 人 |
| `comic-panel-count` | 問題 | `panels` の数が `layout` と違う |
| `comic-slots-per-panel` 試 | 問題 | 1 コマの穴が 3 個以上 |
| `comic-slot-duplicate` / `comic-slot-undefined` 試 | 問題 | 穴の id の重複、`tpl` と `slots` の食い違い |
| `comic-slot-max` / `comic-slot-prompt` 試 | 問題 | `max` が 1〜9 の外、案内が 2〜4 字でない、`fallback` と `choices` が `max` を超える |
| `comic-id-collision` | 問題 | id の文法違反、またはほかの帯の id と衝突 |
| `comic-bubble-covers-face` 試 | 問題 | ふきだしが頭の円(+ 4px)と重なる |
| `comic-tail-off-speaker` 試 | 問題 | しっぽの向きが口への向きから 10° を超えてずれる |
| `comic-bubble-zone` | 問題 | ふきだしが頭の上の帯に積みきれない |
| `comic-bubble-side` / `comic-reading-order` | 助言 | `anchor` の上書きが `bubbleSides` や読む順に反する |
| `comic-bubble-wide` 試 / `comic-orphan-line` 試 / `comic-follower-split` 試 | 助言 | D2 の行分け |
| `comic-text-budget` | 問題 | 1 コマの積むふきだしの行数の合計が、帯に入る行数(7:5 で 4、6:5 で 6。D1 の高さの予算)を超える、または 1 個が 4 行以上(穴を最大の幅で数える) |
| `comic-tail-crosses-bubble` | 問題 | しっぽが、同じコマの別の話し手のふきだしの後ろを通る(U1 で足した。同じ話し手のふきだしの後ろを通るしっぽは、描かない。下の U1 の実装メモ) |

**値の検査**(`renderComic` / `update` の `findings`。`verdict` には入らない。D5)

| 規則 | 重さ | 内容 |
|---|---|---|
| `slot-overflow` 試 | 問題 | 値が下限の文字でも穴に入らない(穴の矩形で切って描く) |
| `comic-value-invalid` | 問題 | 値が 1 行でない、制御文字を含む、`max` 字を超える、`strict: true` の候補にない |
| `comic-values-unknown` | 助言 | `values` に、定義のない穴の id |

### D7. `chat()` 帯(同じ `Dialogue` を LINE 風に)

- 入力は、同じ `ComicWorksheet`(または `dialogue` の列と `cast`)。コマの順に `dialogue` をつなげて、縦に積む。`who` が「自分」(`self: 'me'`)なら右、それ以外は左。
- 見た目: 角丸の吹き出し(しっぽは小さく、片側のみ)、左側の人物は顔(同じ素材の頭の部分を丸く切る)と名前。時刻や既読は出さない。
- 大きさ: D2 と同じ規則(`lib/comic/` の共有の関数 `reserveDialogue`)。内側の幅は、列の 70% と、いちばん広い穴の塊のうち大きい方(ただし列の幅まで)。穴の状態の描き方、値は共有なので、マンガに入れた値がそのままチャットにも出る。
- コマの区切り(`separators: true` で細い線)は任意。

### U1 の実装メモ(2026-11-22。実装で決めたことと、ADR の字面からの違い)

- 場所: `lib/comic/`(`layout.ts` 配置、`reserve.ts` 行分け、`width.ts` 幅の数え方、`template.ts` `{id}` の解析、`check.ts` 顔としっぽの検査、`emit.ts` 描画、`measure.ts` 1 回目の測定、`balloon-path.ts` ふきだしの輪郭)。`lib/dsl/comic.ts` が `comic()` と `speechBubble()`。
- **`bubble()` は `speechBubble()` にした。** `bubble` はバブルチャートの公開名で、同じ名前を取れない。
- 検査: 問題は `verify-handlers.ts` の `comic` の段階(`[comic-…]` の規則名つき)、助言(`comic-bubble-wide` / `comic-orphan-line` / `comic-follower-split`)は `lib/rules.ts` の規則。U1 に入れたのは、スパイクで「試」がついたものと `comic-panel-count`。U2 で `comic-asset-missing` を追加した。`comic-license-missing` の検査経路への登録、`comic-cast-unused` / `comic-id-collision`(ほかの帯との衝突は帯の `id` の登録が投げる)/ `comic-bubble-side` / `comic-reading-order`(`anchor` の上書き)は U4。`anchor` の上書き自体は未実装。
- ふきだしの輪郭は、本体としっぽを 1 本の閉じた経路にする(`balloonPath(本体の矩形, 種類, {tip})`)。しっぽは、本体の中心から先へ引いた線が通る辺の、まっすぐな部分に付く(まっすぐな部分がしっぽより狭いと、しっぽを細くする。無ければ付けない。先が本体の中か、数でないときも付けない)。`think` の角丸は `say` と同じ(破線にするだけ)。
- 番号の札は、コマの左上の角に半分はみ出して置く(24px。コマの中は、ふきだしの帯の上端 16px から始まるので重ならない)。
- `think` のしっぽは、第 1 版は破線の三角(丸 3 つは試していない)。`shout` は太い枠の四角(ぎざぎざは試していない)。
- 色は `lib/tokens.ts` の値を使い、`rgb()` で書く(`#rrggbb` だとダークの再配色が紙と墨を反転する。D6 は紙の色のまま)。`appearance: 'dark'` / `'auto'` でも帯の描画は同じ(テストがある)。
- **幅は固定**: コマの幅は 420px(2×2 は 360px)で、`canvas` の幅に合わせて縮めない(D1 の「`canvas` の幅に合わせる」は、U1 では帯を中央に置くだけ。狭い図では、はみ出しを既存の検査が止める)。
- **しっぽ(U1 で足した規則)**: 先は円の外に止める(円との間は 6px、足りないときは最短 10px の長さを優先し、それでも円の 1px 手前まで)。先が円に入らないことは `comic-tail-off-speaker` も見る。同じ話し手のふきだしが同じコマに 2 個以上あり、上のしっぽが下のふきだしの後ろを通るときは、上のしっぽを描かない(下のふきだしが持つ)。別の話し手のふきだしの後ろを通るときは `comic-tail-crosses-bubble`(問題)。あふれたふきだしはしっぽを描かないことがある(根本の `comic-bubble-zone` を報告する)。
- **積みの余白**: 横の範囲が重なるかの判定に 6px の余白を使う(隙間が 6px 以内なら積む)。ナレーションは左から 20px に置く(番号の札と 2px あける)。
- `comic-slot-undefined` は `slots` にあって `tpl` にない id も、`comic-slot-max` は `fallback` と `choices` が `max` を超えるものも見る。
- 半角カナ(U+FF61〜FF9F)と半角形(U+FFE8〜FFEE)は全角の原子に数えず、測る。
- 穴は空の状態(点線の下線と案内。`blank: 'line'` は下線だけ)で描く。値は U3。

### U2 の実装メモ(2026-11-22。顔と素材の形)

- 場所: `lib/comic/face.ts`(内蔵の顔)、`lib/comic/character.ts`(素材の読み込みと置き方)。`comic()` が `characters` を受け取り、読み込む。
- **内蔵の顔**: 頭の円(半径 36px)、顔(目・眉・口で 8 表情)、髪(`short` / `long`)、肩。髪と服は色相(`hsl()`)から、肌は `COLOR.skin`(U1 と同じトークン)。`face.hue` は 0〜359 の整数、`face.hair` は `short` / `long`(それ以外は `comic()` が投げる)。
- **既定の色相**: `face` の無い人物は `(210 + 137 × cast での位置) mod 360`。同じ人物は全コマで同じ色を使う。cast 全体で順番が隣り合う人物どうしと、最初の 6 人の各組は、色相環で 30° 以上離れる。
- **体の境目の 3 層(ADR 0076 A2 / Q16。U2 に取り込んだ)**: 頭と服、髪の生え際、長い髪の房の内側と服にかかる所は、**紙色のキーライン 1.5px・インク 2.5px・紙色のキーライン 1.5px** で描く。外側の縁はインクの線だけ(クリップパスで、内側の境目だけに 3 層を出す。ID は人物ごとに `ch-<コマ>-<人物>-…`)。眼鏡は U4。これで、**U1 の例の golden が変わる**(仮の丸が顔になる)。
- **素材**: `CharacterManifest` は 1 つの JSON(`{id, name, box, anchors: {head, mouth, hand?, top?}, bubbleSides?, expressions: {表情: SVG の断片}, license: {spdx, author, url}}`)。読み込み(`loadCharacter`)は、(a) 箱を正方形にせず、そのまま保つ、(b) 断片を `sanitizeBody`(`icon-store`)の許す要素だけにする(`<text>` `<use>` `<style>` `<script>` `<image>` mask・filter・外への参照・名前つきの色は投げる)、(c) 描くときに id に接頭辞を付ける(`prefixIds`)。**ライセンスが無い(`spdx` `author` `url` のどれかが空)と投げる**(`comic-license-missing`)。
- **置き方**: 箱の頭の円が、舞台の頭の円(半径 36px)に重なるように倍率を決める。箱の原点とアンカー(口・手)は同じ式でコマの座標に写す。ふきだしの本体は舞台の頭の位置を基準に置き、しっぽは素材の口へ向ける(`tailOf`)。断片は入れ子の `<svg viewBox=箱>` で置き、胸から下はコマの枠で切る(`clip-path`)。SVG の id はコマと人物に加え、帯の scope でも区別する。素材の色も図の `appearance` にかかわらず保つ。
- **検査**: `comic-asset-missing`(問題): `cast` の `asset` が `characters` に無い、素材にその表情が無い。どちらも内蔵の顔で描く。`renderComic({characters})` は U3 の関数なので、U2 は `comic(sheet, {characters})` で渡す(帯のデータに入るのは読み込んだあとの JSON。1 回の描画ごとに渡し、大域の状態にしない点は同じ)。U3 の `renderComic` は、この引数を `comic()` に渡せばよい。
- 手のアンカー(`ComicLaidHead.hand`)は、素材が持つときだけ(内蔵の顔は無い)。マンプと小道具(ADR 0076 U1)が使う。
- PR #442 の round 1・2: `license.spdx` と `license.author` は空でない文字列にする。素材には紙色とインク色を十六進表記で指定する(`currentColor` は使えない)。箱と頭の円の範囲、および素材の上端を使う `comic-bubble-zone` の検査は D3 のとおり。U3a で `box[1] <= anchors.top <= head.cy - head.r` を検証するようにした。確かめる範囲は箱の幅いっぱい。絵が箱より狭いと横のふきだしでも `comic-bubble-zone` が出るので、箱を絵に合わせて切る。

### U3 の実装メモ(前半 U3a。Issue #449)

- `renderComic(sheet, {measure, values, characters, aspect, nodeIds})` をブラウザ入口に追加した。帯の固定幅(コマ幅 × 列数 + 溝 + 左右の帯余白)に図の左右の余白 20px ずつを足す。幅は縦の列で 492px、2×2 で 808px。
- `renderInBrowser` で配置して検査し、SVG の元のマンガの断片が 1 つだけあることを確かめて差し替える。飛ばした穴は `fallback`(既定 `…`)を絵と `<title>` に使う。値の検査は `findings` に入れ、値の書記素数と ADR 0071 の `ONE_LINE`(空白だけの値も不可)を確認する。
- コマ・ふきだし・穴を接続のアンカーと `data-node` に使う。地図の鍵に帯の `scope` を付け、頭の矩形と口・頭の点を持つ。値のクリップ ID は仕様どおり `slot-clip-<穴の id>`。同じ穴の id のある複数のマンガを 1 つの SVG に入れる場合には重複しうる。
- 穴への接続では、その穴を含むコマとふきだしを経路が通れる。別のコマと、端のコマ内にある別のふきだしに経路が重なると報告する(PR #452 の補足仕様)。
- 縮小図は同じ配置から 1 コマを取り出し、番号札の分だけ各辺を 8px 広げ、穴は下線だけで描く。`update` と測定時間は U3b、`toClientRect` は U6(調整役が Issue #449 で確認)。

### 横並びの割りと文字の大きさの実装メモ(2026-11-26。追補。D1・D2 の決定は変えない)

- **割りの追加**: `2x1` / `3x1` / `4x1`(列 × 行 = 列の数 × 1)。コマは左から右へ並び、番号も読む順も左から右。名前付きの割りに足しただけで、`span` は持たない(D1 の選択肢 B のまま)。
- **コマの幅は図の幅から決まる**: 横並びのコマは、帯に渡された幅 `w`(図の幅から左右の余白を除いたもの)を列で分ける。`floor((w - 2 × 16 - 16 × (列 - 1)) / 列)` を 4px の格子に切り下げ、420px を上限にする。幅が分からないとき(`renderComic` の寸法決め、`panelSize` の既定)は `canvas: 'slide'` の中身の幅 1212px を使う。`canvas: 'slide'` では 4×1 が 280px、3×1 が 380px、2×1 が 420px で、帯はちょうど収まる。`slide: true`(900px)では 4×1 が 204px になる。図の幅を超えるマンガは作らない(縦の列と 2×2 は従来どおり固定の 420px / 360px)。コマが狭すぎてふきだしが入らないときは、ふきだしごとに `comic-bubble-zone` が「`fontSize` を小さく、列を減らす(コマを広く)、図を広く、穴を短く」と知らせる。
- **コマの高さ**: 既定の縦横比は新しい `'3:4'`(幅 280px のとき高さ 372px。2 つのふきだしを積む行数 `lineBudget` が 18px の文字で 7 行取れる)。`aspect` を明示すれば従来の `'7:5'` `'6:5'` `'1:1'` も使える。
- **人物の位置**: 左と右の人物は、コマの端から `min(104, 幅 / 2 - 76)`px(下限 40px)に立てる。3 人(左・中・右)の頭の円(半径 36px)の間は 4px 空く(280px のコマで 64 / 140 / 216px)。縦の列・2×2 の位置(104px)は変えていない。
- **ふきだし(横並びだけ)**: 文字を折り返す幅は、コマに入る幅(`コマの幅 - 2 × 8px - 2 × 余白`)までにする。1 つのコマで 2 人が話すときは、ふきだしを横に並べて置けるように半分の幅までにする。ふきだしの幅は 9 字の下限を持たず、折り返した文字の幅(穴は最大の字数で数えた幅)に合わせる。値に依存しないので、値を入れても動かない(D2)。2 つのふきだしは、横に重ならなければ同じ高さに並べる(縦の列と 2×2 は従来どおり、後のふきだしが左にあれば下に積む)。それでも 2 人のしっぽが交わるとき(行が長い、穴がある)は、`comic-tail-crosses-bubble` が「1 行を短く、またはコマのふきだしを 1 つに」と知らせる。
- **文字の大きさ**: `comic(sheet, {fontSize})`(`renderComic` も同じ名前)。整数で 14〜28、既定は 18。ふきだしの文字、行の高さ(26px × `fontSize` / 18)、ふきだしの余白、穴の高さ・案内の文字、全角 9 字の内側の幅(9 × `fontSize`)、`comic-bubble-wide` のしきい(11 字)、番号札(24px の箱と 14px の字)、ふきだしの置き始め(`zoneTop`)と地の文の左(`narrationLeft`)がすべて `fontSize` / 18 倍になる。穴は今までどおり最大の字数 × 1 em で数えるので、値を入れても動かない(D2 の幅の規則: 全角の原子は 1 em のまま測らない)。人物の大きさは変えない。
- 既定(18)のときは数も出力も変わらない(`LaidOutComic.fontSize` は既定でないときだけ付く。縦の列と 2×2 の golden は変わらない)。
- **スライドの文字の下限(24px)**: `canvas: 'slide'` の下限を満たすには、ふきだしの文字(`fontSize`)が 24 以上で、番号札の字と穴の案内(どちらも 14 × `fontSize` / 18)が出ていないことが要る。この 2 つは `fontSize` が最大の 28 でも 22px なので、**番号札(`numbering: false`)と案内(`blank: 'line'`、下線だけ)を出さない**。`blank: 'line'` では案内の字を、描かないので文字の大きさの検査にも入れない。免除は設けない。
- 例: `examples/comic-row.ts`(4×1、`fontSize: 24`、`canvas: 'slide'`、`numbering: false`、`blank: 'line'`)。

## 代替案

- **既存の `box` / `row` / `connect` / `callout` で描く**: 帯の追加を避けられる。しかし、`callout()` は箱への引き出し線と札で、しっぽの向き・穴の矩形・顔との重なりを検査できない。却下。
- **別のパッケージ(`svg-diagram-comic`)にする**: 核を小さく保てる。しかし spec・デッキ・MCP・check・reveal の仕組みに乗れない。`lib/comic/` に実装を閉じ込めるので、あとで切り出せる。
- **値を帯のデータにして、値が変わるたびに `renderInBrowser` をやり直す**: 流れは 1 つで済む。しかし値の幅が 1 回目の測定に入るので、箱が値で動く(穴の幅を最大で固定しても、測定の登録が値に依存する)。毎回数十 ms かかり、入力欄のある画面ではちらつく。却下(D5)。
- **HTML / CSS でマンガを描く**: 入力欄との相性はよい。SVG・PNG への書き出しと、印刷用の輪郭化ができない。却下。
- **画像生成や絵のファイルを既定の顔にする**: 決定的でなく、ライセンスと配布の手間がある。差し替えの口(D3)だけ用意する。
- **楕円のふきだしを既定にする**: 幅が √2 倍になり 1×4 に 2 個入らない(D2)。後で `shape: 'ellipse'`。
- **穴の後ろの文字を値に合わせて詰める**: 文字の位置が値で動く。D4 のとおり第 2 版で測る。
- **穴の id をコマごとの名前空間にする**: コマの複製に強いが、値の表が入れ子になる。ワークシート全体で一意にし、重複を検査で止める。
- **全部の帯に整数 px の丸めを広げる**: 既存の golden のほとんど(英字の入った箱)が変わる。`comic` / `chat` の中だけに止める(D2 の 2)。

## 影響

- 新しい帯 `comic`・`chat`(と部品としての `bubble`)。実装は `lib/comic/`(約 8 ファイル: 配置・ふきだし・顔・穴・地図・検査・チャット・素材)。表への登録が 20〜25 ファイル(多くは 1 行): `layout-handlers`・`layout-measure`(`MEASURE_HANDLERS`)・`emit-handlers`・`verify-handlers`・`fit-handlers`・`reveal-handlers`・`band-ids`・`emit-node-ids`・`spec-kit` / `spec-parts`・`dsl-pure` と `web.ts` の公開名・`test/fixtures/dsl-exports.json`・`skills/svg-diagram/references/`・README。
- ADR 0050 との関係: `rewrite` の書き換えの表は帯の種類ごとに決まっているので、`comic` が受けるのは `reveal` / `until` だけ。`comic` の id は、`anchors` に登録したものだけが `connect()` の端になれる。
- `svg-diagram/browser` に `renderComic` が増える(実験的)。パッケージは `characters/`(既定のパラメトリックな顔は内蔵なので、第 1 版は空でよい)と `schema/comic.schema.json` の分だけ大きくなる。
- PowerPoint の書き出し(`lib/pptx/bands.ts`)は対象外。第 1 版の挙動(U1 で確かめた): `comic` は `'image'` の帯として、ほかの絵の帯(`bowtie` など)と同じに、1 枚の絵(PNG と SVG)で出る。文字は PowerPoint で編集できない。
- golden: `examples/` に 2 つ足す(1×4 と 2×2)。幅の数え方は `comic` / `chat` の中だけなので、既存の図の出力は変わらない(テストで確かめる)。
- 描画は決定的(全角の原子は測らない。英字の原子は 0.03px の揺れを許す)。ただし、英字・数字の字幅は、保存した SVG を開く端末のフォントで変わりうる(D2)。
- 配布: jsDelivr が読むのは npm の版。`renderComic` を含む版は、まだ出ていない(0.9.0 には無い。リポジトリの `package.json` は 0.5.0 で、版の付け方は `scripts/release.sh` に従う。U6 で、実際にその版が付くことを確かめる)。

## 実装計画

どの単位も、`main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる(ADR 0073 と同じ)。

### U1: `comic()` と `bubble()`

- 範囲: 1×4 と 2×2 の割り、枠・溝・番号、舞台と、ふきだしの置き方(D1 の規則)、ふきだし 4 種、しっぽ、横書き、D2 の大きさの規則(幅の数え方、`bunsetsu` + 穴の塊の `glue`、孤立行の解消)。穴の描画は U3。顔は丸だけの仮(U2 で置き換える)。
- 完了の基準: (1) 4 コマ・ふきだし 6 個の図が、Node と headless Chromium で**SVG の文字列として一致する**(原子の位置まで。スパイクで確認済みの方式)。(2) すべての測定に ±0.0156px を足しても幾何が変わらない。(3) 台詞のテキストだけを変えても、コマ・人物の位置が変わらない。(4) 6 つの台詞(サンプルの元の台詞。**書き換えない**)と下の 9 文型で、測った箱の大きさと改行の位置が期待どおり。**`aspect: '7:5'` では**、元の台詞の 2 コマ目は、3 行のふきだしが 2 個積まれるので、根本の `comic-bubble-zone` と `comic-text-budget` の 2 件だけを報告するのが期待(顔・しっぽの検査は走らせない。直すのは台詞の側)。(5) PowerPoint の挙動を確かめて、影響の節を埋める。(6) 既存の golden が変わらない。
- テスト: 配置の golden(2 種)、`wrapStyledAtoms` に穴の塊を渡したときの行の分け、箱が 4px の格子に乗る、しっぽの向き(10° 以内)、`test/web-entry.test.ts` と同じ「`node:*` に届かない」の束ね確認。
- 9 文型のテスト(`fit2q`、18px、Noto Sans JP で測った値。`max` は穴の列。箱は幅 × 高さ): `先に{p}しておきます。`(6)188×100「先に / {p}してお / きます。」、`{p}しておきます。`(6)188×72「{p}してお / きます。」、`明日までに{p}をお願いしてもいいですか？`(6)204×100「明日までに / {p}をお願 / いしてもいいですか？」、`{p}だと思っているんですけど…`(6)204×72「{p}だと思っ / ているんですけど…」、`最近、{p}ですね。`(9)188×100「最近、 / {p} / ですね。」、`{p}してもらえると助かります。`(9)188×100「{p} / してもらえると / 助かります。」、`ちょっと{p}かもしれません。`(4)188×100「ちょっと / {p}かもしれま / せん。」、`{p}`(9)188×48、`今日は{p}の予定があるので、先に帰ります。`(9)204×124「今日は / {p}の / 予定があるので、先に / 帰ります。」。期待値は、今は不完全な改行(「{p}してお / きます。」など)も含めて記録したもので、U1 で改行を直したら更新する(連なりの中の改行が基準の `literal` より増えないことを下限にする(今は 4 と 4))。スパイク(`spikes/comic-worksheet/wrap-modes.ts`)は U1 で消した。再現は `test/comic-wrap.test.ts`(9 文型の箱と改行が、ADR の値と一致する)。

### U2: 顔と素材の形

- 範囲: パラメトリックな顔(8 表情、髪型 2 種、色相)、`CharacterManifest` の型と読み込み(D3 の 3 点の規則)、`comic(sheet, {characters})`、アンカー。
- 完了の基準: 8 表情が描ける。同じ入力は同じ SVG。素材に差し替えても、コマ・ふきだしの配置がアンカーだけで決まる(200×240 の素材でずれない)。ライセンスが無いと投げる。
- テスト: 表情ごとの golden、掃除(外部参照や `script` を落とす。名前つきの色を拒む)、`box` が正方形でないときのアンカー、`<defs>` の id の書き換え、ライセンス欠落。

### U3: 穴、幾何の地図、値だけの描き直し

- 範囲: `{id}` の解析(`{{` / `}}`)、3 状態と切り、`slot-overflow`、幾何の地図(`points` を含む)と `data-node`、`renderComic` の `update`(非同期)、縮小図。 `update` の契約(全体の表、`seq`、`titles`、値の検査の `findings`)。
- 完了の基準: **空・埋めた・飛ばし・長すぎるの 4 状態で `geometry` が `deepEqual`**。`update` は変わった穴だけを測る(測定の呼び出しを数える)。地図は 12 穴で 4 KB 未満。`blank: 'line'` が案内を出さない。本物の `svgMeasurer` で、変わった穴が 1・5・12 個のときの `update` の時間と、4 コマの `comic` の最初の `renderComic` の時間を測り、この ADR に書く。 `update` を 2 回続けて速く呼び、最後の呼び出しの結果だけが採られる(古い `seq` は `stale`)。穴を外した表で空に戻る。`titles` が値と同期する。値の `findings` が `verdict.ok` を変えない。 **差分の基準のテスト**: `update` を #1・#2・#3 と待たずに呼び、#2 を `stale` にして、#1 の DOM に #3 の `slots` / `titles` を適用し、`renderComic({values: v3}).svg` の新しい描画と DOM が一致する。`r.findings`(最初の値)と最新の `update().findings` が別のものであること。
- テスト: 4 状態の幾何の一致、`update` と `renderComic({values})` の SVG が同じ、測定回数、縮小図の `viewBox`、値の規則。

### U4: Schema と検査

- 範囲: `schema/comic.schema.json`、`comic` を spec の部品に、D6 の検査の全部と ID の文法。
- 完了の基準: LLM が書いた場面(作り話の 3 例)が Schema と検査を通る。誤った例(穴が 3 個、話し手が舞台にいない、素材がない、`max` が範囲外、id に `.`)が、期待の規則で止まる。`pnpm schema` のあとで `test/schema-files.test.ts` が通る。色のコントラストが 4.5:1 以上。
- テスト: 正しい例と誤った例、Schema(ajv)と CLI の判定の一致(ADR 0071 のやり方)、規則ごとの単体。

### U5: `chat()`

- 範囲: D7 の帯。`reserveDialogue` を U1 と共有する。
- 完了の基準: U1 と同じデータが、チャットでも描ける。同じ値で幾何が動かない。吹き出しの幅が、列の 70% と最も広い穴の塊の大きい方(列の幅まで)を超えない。
- テスト: golden、同じ値での穴の一致、長い台詞の折り返し。

### U6: リリースと Artifact の見本

- 範囲: (1) U1〜U5 を入れたあと、`renderComic` を含む版を npm に出す(jsDelivr は npm の版を読む)。(2) `examples/artifact/` に見本の HTML(1 枚。`svg-diagram/browser` を jsDelivr から読み、台詞の穴の入力欄を `geometry` の位置に重ねる(`toClientRect`)。書記素で数える `maxlength`、IME の変換中は `update` しない、SVG / PNG の保存)。版を固定した URL と `+esm` を使う。
- 完了の基準: **ゲート: 人が小さなページを実際の Artifact に 1 回公開して、jsDelivr の `import()` と `svgMeasurer` が動くことを確かめる(Q7)。** headless Chromium(`browser-check.mjs` の方式)で、読み込み・描画・入力 → `update` → 保存まで通る。日本語フォントのない環境での `svgMeasurer` と検査の振る舞いを測って記録する。
- テスト: headless の通し(CI では任意。ネットワークが要る)、見本が `renderComic` の公開 API だけを使うこと。

## テスト方針

- 配置は純粋な関数にして、測定を関数で渡す(ADR 0045 D2 と同じ)。単体のテストは、固定の幅の測定で行い、フォントに依存しない。
- Node(HarfBuzz)とブラウザ(`svgMeasurer`)で同じ SVG になることを、スパイクの `run.ts` と `browser-check.mjs` の方式でテストに取り込む。
- 「穴を埋めても幾何が変わらない」は、状態の組(空・埋めた・飛ばし・長すぎる)ごとの `deepEqual` を、すべての golden で取る。

## 決定済み(2026-11-22。決める人。Q1〜Q10 すべて推奨どおり)

決定の中身は、下の各質問の「推奨」のとおり。2 点だけ、確定の条件がある。

- **Q10(縦横比の既定 6:5)は、U1 で見た目を測ってから確定する。** 試作は 7:5 だけで、6:5 は測っていない。測って悪ければ、この ADR に結果を足して、7:5 のままか別の値かを決め直す。
- **Q7 の関門は、U6 の頭に、実際の Artifact で `import()` を確かめること。** 確かめるための小さなページは公開済みで、決める人の報告を待っている。報告が来るまで U6 は始めない(U1〜U5 は Artifact なしで進められる)。

## 質問と決定の一覧(以下の質問は決定済み。推奨がそのまま決定)

**質問の一覧**(すべて決定済み。推奨がそのまま決定。詳しくは下)

| # | 質問 | 決定(= 推奨) |
|---|---|---|
| Q1 | 第 1 版で縦書きのふきだしを出すか | 出さない(第 2 版。型の予約だけ) |
| Q2 | 簡単な顔が先か、絵師の素材が先か | 簡単な顔が先 |
| Q3 | 入力は HTML の入力欄を重ねるか、SVG の中で編集するか | HTML の入力欄を重ねる |
| Q4 | 幾何の地図と値だけの描き直しを公開 API にするか | 公開する(README に実験的と書く) |
| Q5 | 穴の幅の隙間をどう扱うか | `max` = `maxlength`、候補から既定の `max` |
| Q6 | 印刷用の輪郭化をどの経路にするか | MCP / Node の経路。Artifact は生きた SVG と PNG |
| Q7 | 実際の Artifact の枠で jsDelivr の `import()` が動くか | U6 の頭に、実際の Artifact で確かめる(確認用のページは公開済み、報告待ち) |
| Q8 | 幅の数え方 | 全角は 1 em、英字は丸めて、`comic` / `chat` の中だけ |
| Q9 | 文字の最小の大きさ | 下げない |
| Q10 | コマの縦横比の既定 | 6:5。ただし U1 で見た目を測ってから確定 |


- **Q1. 第 1 版で縦書きのふきだしを出すか。** 推奨: 出さない(第 2 版)。横書きで穴埋めの価値は確かめられる。縦書きは `verticalColumns` を再利用できるが、右から左の読む順とコマの並び(`dir: 'rtl'`)まで一緒に決めないと半端になる。型の予約(`writing`、`dir`)だけ第 1 版に入れる。
- **Q2. 簡単な顔が先か、絵師の素材が先か。** 推奨: 簡単な顔が先。絵師なしで決定的に動き、ライセンスの問題がなく、素材の形(D3)を実際の使い方で確かめられる。見た目は粗い(スパイクの絵)。素材は、形が固まってから差し替える。
- **Q3. 入力は HTML の入力欄を重ねるか、SVG の中で編集するか。** 推奨: HTML の入力欄を重ねる。日本語の IME(変換中の文字)は SVG の `<text>` で扱えない。`geometry` の矩形に入力欄を置き、確定したら `update` を呼ぶ。位置合わせの補助(`toClientRect`)を一緒に出す。
- **Q4. 幾何の地図と値だけの描き直しを公開 API にするか。** 推奨: 公開する(`svg-diagram/browser`。README に実験的と書く)。見本と実際の Artifact がどちらも使う。使わなくても動く(毎回 `renderComic`)。
- **Q5. 穴の幅の隙間をどう扱うか。** 推奨: 第 1 版は `max` = 入力欄の `maxlength` の字数とし、`choices` から既定の `max` を出す(D4)。LLM の判断には頼らない。見た目が悪ければ、第 2 版で穴の後ろの文字を行の中で詰める。
- **Q6. 印刷用の輪郭化をどの経路にするか。** 推奨: 第 1 版は MCP / Node の経路で作り、Artifact は生きた文字の SVG と canvas の PNG を出す(字体は端末のもの)。ブラウザで日本語の字形(opentype.js + woff のフォント)を持ち込めるかは、U6 のあとで別に測る。重い(数 MB)ので既定にはしない。
- **Q7. 実際の Artifact の枠で、jsDelivr の `import()` が動くか。** headless Chromium では動いた。Artifact の枠の制限(CSP など)は未確認。推奨: **U6 の頭のゲート**にする(U1〜U5 は Artifact なしで進められる)。動かなければ、`+esm` か `<script type=module>` の形に変える。
- **Q8. 幅の数え方。** 推奨: D2 の 2 のとおり(全角は 1 em、英字は 1/4px に丸めてから整数 px に切り上げ、`comic` / `chat` の中だけ)。ほかの帯の箱は変えない。英字の一致は保証でなく高い確率(崖をまたぐ幅は 1.6%)と承知しておく。
- **Q9. 文字の最小の大きさ。** 既定の下限 14px が縮める余地を決める(18px → 14px で 22%)。推奨: 下げない(読めない大きさのものは意味がない)。値が長すぎるときは、入力欄の `max` で止める。
- **Q10. コマの縦横比(`aspect`)の既定。** 試作は 7:5(420×300)で、2 人が話すふつうの文(穴を最大で数えて 3 行)は積むと入らず、ふきだしは実質 2 行までになる(積める高さの帯は 168px)。6:5(420×350。格子に丸めて 352)なら帯は 220px で 3+3 行が入る。推奨: 6:5 を既定にする(2 人が話すコマが典型なので)。4 コマで縦に 1400px を超えるが、縦長の画面ではどのみちスクロールする。**6:5 の見た目は試作で測っていない**ので、U1 で測ってから決める。Schema の説明には、縦横比ごとに「ふきだしが 2 個あるコマでは、合わせて 7:5 は 4 行まで、6:5 は 6 行まで」を書く(D6)。

**Q10 の U1 での測定(2026-11-22。確定: 6:5)。** `lib/comic/layout.ts` の配置を、2 つの縦横比で測った(H = 4 コマの図の高さ、いずれも外側の余白 16px を含む)。
- 1×4 の高さ: 7:5 は 1280px(コマ 300)、**6:5 は 1488px**(コマ 352。4px の格子に丸めた。350 そのままだと座標が格子に乗らない)。ADR の見込みどおり 1400px を超えるが、縦長の画面ではどのみちスクロールする。
- ADR のサンプル 6 台詞(書き換えない): 7:5 は 2 コマ目が `comic-bubble-zone`(積みが 222px、帯は 184px まで)と `comic-text-budget`(6 行)の 2 件。**6:5 は 0 件**(帯は 220px、行数の上限は 6)。顔・しっぽの検査も 0 件。
- 9 文型を、2 人が話す 1 コマの 2 個のふきだしの全組み合わせ(右の人が先、左の人が後。9×9 = 81 通り。穴は各文型の `max`)で測った: 帯に収まる(問題 0)のは、7:5 が **19 通り**、6:5 が **64 通り**。収まらない組は 7:5 が 62 通り、6:5 が 17 通り(`comic-bubble-zone` は 7:5 が 62、6:5 が 11。残りの 6 通りは 1 個が 4 行以上の `comic-text-budget`)。この順で話す 2 個は、必ず上下に積まれる(同じ高さに並ぶのは、左の人が先のときだけ)。
- 見た目(目視): 6:5 では、1 個だけのふきだしのコマで、しっぽが長くなって余白が目立つ。顔やふきだしの文字には影響がない。2 個を積んだコマは、ふきだしと顔の間に余りが残る。7:5 は 3+3 行のコマで顔にかかる。
- 決定: 6:5 を既定にする。`aspect: '7:5'` は残す。**行数の上限は縦横比に連動させた**(D1 の高さの予算)。

## スパイクの再現

```
node spikes/comic-worksheet/run.ts [outdir]        # Node(HarfBuzz)。4 状態の一致、揺れへの強さ、地図の大きさ、行分け、検査
node spikes/comic-worksheet/browser-check.mjs      # headless Chromium。jsDelivr の 0.9.0、Node の SVG との一致、PNG(ネットワークが要る)
```

スパイクは U1 の PR で `lib/comic/` に置き換えて消した(元のコードは、この ADR の PR #433 のコミット f32571ed にある)。
