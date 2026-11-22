# ADR 0074: 穴(空欄)のあるマンガの部品 — `comic()`(コマ)、`bubble()`(ふきだし)、キャラクター、穴(slot)、Artifact との受け渡し、`chat()`

- 状態: 草案(Draft。2026-11-22。設計と小さなスパイク。`lib/` は変えていない。レビュー 1 回目(PR #433)の Blocker 1・Major 7 を反映。決める人への質問は末尾の Q1〜Q9)
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

`proto.ts`(約 230 行)は、意味が先のデータから、縦 1×4 のマンガの SVG と矩形の地図を作る使い捨ての試作。測定は関数で受け取る。`run.ts` は Node(HarfBuzz)で、`browser-check.mjs` は headless Chromium で動かす。レビュー 1 回目のあとで、D2〜D5 の規則(下)を試作に入れて測り直した。

| 測ったこと | 結果 |
|---|---|
| 1×4(1 コマ 420×300)、顔 8 表情、ふきだし 6 個、穴 5 個 | 描ける。顔は約 60 行(目 4 種・眉の傾き・口 8 種・髪と服の色相)。決定的で、ライセンスの問題がない。絵としては粗い |
| 日本語の行分け(本物の `wrapStyledAtoms`、`bunsetsu`、穴の後ろのひらがなを `glue` で穴につける、18px、内側 162px) | 6 つの台詞は「今週から、毎週 / {day}は定時で / 上がります。」「先に / {prep}します。」「最近、/ {change}ね。」のように、穴を先頭に回し、後ろのひらがなを穴から離さずに折れる。語の途中の切れ目は 0。レビューの実験(`char` と `phrase` は同じ結果で、ひらがなに効かない。穴の後ろのひらがなが行より長い塊になると 1 字ずつに落ちる。`見られているのかも…` は「…」だけの行が残る)は再現した。そのため D2 の規則(`glue`、内側の幅の拡張、孤立行の解消)を入れた |
| 穴の幅 | 穴は最大 9 字(= 内側の幅 162px)に制限する。穴 + 後ろのひらがなの塊が内側の幅を超えるときは、内側の幅をその塊まで広げる(試作: 180px)。最初の版は `max` を 12 まで許し、塊が 234px になって 1 コマに 2 個入らず、検査が `comic-bubble-covers-face` と `comic-tail-off-speaker` を報告した |
| 穴を埋めても幾何が変わらないか | 空・埋めた・飛ばし・長すぎる値の 4 状態で、穴の中身と `<title>` を除いた SVG が完全に一致する |
| 長すぎる値 | 18px から 14px(`MIN_FONT_SIZE`)まで縮め、それでも入らなければ穴の矩形で切り(`clipPath`)、`slot-overflow`(問題)を返す。隣の文字には重ならない |
| 矩形の地図 | コマ 4・ふきだし 6・穴 5・頭 8・点(口と頭の円)8 の 31 件で 1375 バイト(約 45 バイト / 件) |
| 値を変えたときの描き直し | 試作の `svg(values)`(配置は持ち越し。値の幅だけを測って覚える)は、Node で新しい値 1 個が 0.14 ms、同じ値の繰り返しが 0.1 ms。実際の Chromium の `svgMeasurer` では、新しい値 1 個が 1.2 ms、5 個が 0.5 ms(暖まったあと)。**これは文字列の組み直しの下限であって、`renderInBrowser` の費用ではない。** 小さな図 3 帯の `renderInBrowser` は同じ headless Chromium で 36 ms。最初の配置は Node で 66〜74 ms(試作が 1 文字ごとに HarfBuzz を呼ぶので上限の目安。ブラウザでの配置は別に測っていない) |
| 測定の揺れ | 同じ文字を HarfBuzz は 16、Chromium は 16.0156 と測る。全角の原子を測らずちょうど 1 em にし、それ以外の原子は 0.03px を許して整数 px に切り上げる(D2)。すべての測定に ±0.0156px の揺れを足しても、幾何も SVG も変わらない。さらに、Node と headless Chromium の SVG の**文字列が完全に一致**した(原子の位置まで同じ) |
| 色のコントラスト | 案内と飛ばしの文字 `#5a6072`(白の上で 6.27:1)、埋めた値 `#bb2233`(6.2:1)。最初の版の `#889` は 3.5:1 前後で、14px の文字の規則(4.5:1)に届かなかったので直した |
| 検査が働くか | わざと悪くした台詞(同じ側に 2 人、話し手が舞台にいない、`max` が範囲外、案内が長すぎる、穴の定義がない、1 コマに 3 個の穴)で 7 種の検査がすべて報告した(`comic-at-collision` / `comic-bubble-wide` / `comic-speaker-unknown` / `comic-slot-max` / `comic-slot-prompt` / `comic-slot-undefined` / `comic-slots-per-panel`、のほか、前の版では顔を隠す・しっぽの向きも設計の誤りを見つけた) |
| 配布経路(jsDelivr、headless Chromium、npm の 0.9.0) | `import('https://cdn.jsdelivr.net/npm/svg-diagram@0.9.0/dist/lib/web.js')` が動く(168 リクエスト、約 170 KB。読み込みは 0.2〜0.3 秒。初回は 3〜7 秒かかることがある)。`diagram` / `box` / `row` / `wordart` / `people` を描けて verdict は ok。`callout` / `canvas` / `icon` / `image` も公開名にある(`image()` は設計どおり投げる)。`…/browser/+esm` は 1 リクエストで 135 の公開名が取れた(初回の測定のみ)。同じページで SVG → `<img>` → canvas → PNG(2 倍、約 300 KB)も動いた |
| まだ確かめていないこと | (1) 実際の Artifact の枠(CSP、iframe の制限)の中での動作。(2) ブラウザでの文字の輪郭化(日本語の `OutlineFont` をブラウザで作る手段は今ない)。(3) 日本語のフォントが入っていない環境での `svgMeasurer`(豆腐の幅)と検査の振る舞い(測った環境にはフォントがある)。(4) `+esm` の再測定 |

## 決定

全体の方針: **コマ・ふきだし・穴・キャラクターは、帯 `comic()` の中で閉じた 1 つのモデルとして配置する**(個別の `box` の寄せ集めにしない)。しっぽ・顔・穴の検査に「話し手」「口の位置」「穴の矩形」という関係が要り、一般の箱と矢印では持てないため。実装は `lib/comic/` に集める。入力は D6 の JSON が正で、TS の DSL(`comic({...})`)は同じ形を書くだけの薄い入口にする。

**ID の文法(全体の規則)。** コマ・人物・台詞・穴の id は `^[A-Za-z][A-Za-z0-9_-]*$`(`. : @ #` を使わない。`assertScope` と同じ)。これらを `.` でつなぐと一意な名前になる(コマ `p1`、ふきだし `p1.d2`、人物の頭 `p1.me`)。帯に scope(ADR 0012)があれば、さらに前に `scope.` が付く。穴の id はワークシート全体で一意(D4)。ほかの帯の id との衝突は `comic-id-collision`(問題)で止める。

### D1. `comic()` 帯(コマの割り)

**選択肢**: A. 縦 1×4 だけ。B. 名前付きの割り(`1x4` / `2x2` / `1x3` / `1x2`)で `span` を持たない。C. 自由な格子(`cols` / `rows` / `span`)。

**推奨: B。** 日本の 4 コマの標準は縦 1×4(スマホの縦長の画面にも合う)で、2×2 は印刷の A4 用に要る。C は大ゴマが要るマンガに向くが、検査の幾何と LLM の出力の安定が先に崩れる。名前を数個に絞れば Schema の `enum` で止められる。

- 大きさ: コマの幅は内容幅(1×4 は 420px を基準に `canvas` の幅に合わせる)、縦横比は 7:5(`aspect` で変えられる。スパイクは 420×300)。2×2 は縦横比 1:1 が既定。
- 枠と溝: 枠線 3px、溝 16px、外側の余白 16px。すべて 4px の格子に乗せる(`coordinate-grid` の助言を通すため)。
- 番号: 左上に 24px の黒い札で 1〜4(`numbering: true` が既定)。`labels: ['起', '承', '転', '結']` で中身を変えられる。
- コマの読む順: 上から下(1×4)、左から右へ行ごと(2×2)。`dir: 'rtl'` は縦書き(第 2 版)で予約し、`ltr` 以外は未実装のエラーにする。
- **コマの中の人物(規範)。** `at` は `left` / `center` / `right`。頭の中心の x は、`left` がコマの左端から 104px、`right` が右端から 104px、`center` が幅の半分を 4px の格子に丸めた位置(420px のコマで 208px)。頭の高さは下から 76px で固定(半径 36px)、胸から下は枠で切る。同じ `at` に 2 人は置けない(`comic-at-collision`)。
- **コマの中のふきだし(規範。決定的で、データだけから決まる)。** ふきだしは `dialogue` の並びの順(= 読む順)に置く。x は話し手の頭にそろえ、コマの中に収める(4px の格子)。y は、コマの上(16px)から置き、**先に置いたふきだしのうち、横の範囲が重なるもの、または自分より右にあるものの下に積む**。つまり、同じ高さに並べてよいのは、先のふきだしがすべて自分より左にあるときだけ(左から右へ読む順と、台詞の順が食い違わない)。台詞の順が右から左なら、2 つ目は 1 つ目の下になる。`anchor: 'top-left'` などで上書きでき、上書きが読む順と食い違えば `comic-reading-order`(助言)。
- 背景: `bg` は色味(`tint: 'warm' | 'cool' | 'plain'`)と、あれば 1 つのアイコン。絵の背景は範囲外。
- ふきだしを置ける高さ(頭の上の帯)に積みきれないときは `comic-bubble-zone`(問題)。スパイクで、1 コマ 2 個が入る条件が数値で分かった(D2)。

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
2. **幅の数え方(`comic` / `chat` の中だけ)。** 全角の原子(CJK・全角の約物、`splitAtoms` が 1 字ずつ分けるもの)は、測らずにちょうど 1 em とする。それ以外の原子(英字・数字の連なり)は、測った幅から 0.03px を引いて整数 px に切り上げる。HarfBuzz は 16、Chromium は 16.0156 と測るので、四捨五入や素朴な丸めでは .5 や 4px の格子の境で割れる。`WidthOf` を包む `comic` 専用の関数で行い、ほかの帯の `textWidth` は変えない(既存の golden は変わらない。テストで確かめる)。
3. 折り返しは `wrapStyledAtoms` に **`bunsetsu`** で行う(`char` と `phrase` はひらがなの切れ目に効かない)。穴は途中で折らない 1 つの原子で、**穴の後ろのひらがなは `glue` で穴につける**(穴と後ろのひらがなが 1 つの塊)。塊が行に入らなければ、穴の前で折る。内側の幅は、既定 162px(18px で 9 字)と、いちばん広い塊のうち大きい方にする。塊が広すぎて内側の幅 + 2 字を超えるときは `comic-bubble-wide`(助言。穴を短くするか、ひらがなを減らす)。
4. **孤立行を作らない。** 最後の行が 2 字以下(「…」「ね。」「！？」の連なり)なら、内側の幅を 1 字、さらに 2 字まで広げて折り直し、直る最初の幅を採る。直らなければ `comic-orphan-line`(助言)。
5. 箱の幅と高さは 4px の格子に切り上げる。行の位置は、内側の矩形の中で行ごとに中央ぞろえ。穴の矩形の位置と大きさは、この「最大の文」で決まる。実際の値は、穴の矩形の中に中央ぞろえで書く。そのため、行数・穴の位置・後ろの文字の位置は、値に左右されない。
6. 値の幅は 1 回目の測定(`collectMeasures`)では分からない。D5 のとおり、値は帯のデータにせず、値の測定は `renderComic` の側で行う。
7. 値が穴の幅(`max` × 1 em)より広いときは、文字を縮める(下限 14px = `MIN_FONT_SIZE`。`canvas.minText` があればそちら)。下限でも入らなければ、**穴の矩形で切り**(`clipPath`)、隣の文字には重ねない。このとき `slot-overflow` を**問題**として返す(書き出しの前に止める)。字数が `max` 以内なら、全角の値は 1 em × `max` を超えないので、縮みも切れも起きない(`maxlength` = `max` と矛盾しない。D4)。

**語の途中の改行の検査。** `midWordBreaksIn`(`lib/text-rules.ts`)は、ひらがなと漢字の切れ目を見ず、`{id}` を含む行も扱えないので使えない。`comic` 専用に、次の 3 つを見る: 孤立行(2 字以下の最終行)、穴の後ろのひらがなが穴と別の行になっている(`comic-follower-split`)、内側の幅の超過(`comic-bubble-wide`)。

**保存した SVG と字体。** 穴の外の文字は、測ったフォントで 1 つの `<text>` として書かれる。保存した SVG を別のマシン(別の日本語フォント)で開くと、字幅が違って見えることがある(特に英字・数字)。字体に依存しないのは、文字を輪郭にした書き出し(D5)だけ。

### D3. キャラクターの素材

**素材の形(規範)**

```
character/<id>/character.json
character/<id>/<expression>.svg        (表情ごとに 1 ファイル。例: neutral.svg, smile.svg)
```

`character.json`:

```json
{
  "id": "colleague-a",
  "name": "同僚",
  "box": [0, 0, 200, 240],
  "anchors": {"head": {"cx": 100, "cy": 90, "r": 56}, "mouth": [100, 112], "hand": [150, 190]},
  "bubbleSides": ["top-left", "top", "top-right"],
  "expressions": ["neutral", "smile", "laugh", "surprise", "worry", "angry", "think", "sad"],
  "license": {"spdx": "CC-BY-4.0", "author": "…", "url": "https://…"}
}
```

- `box` は座標の基準。表情の SVG はこの `viewBox` で描く。`anchors` は `box` の座標で、描くときに倍率をかけてコマの座標へ移す。`bubbleSides` は、ふきだしを置いてよい側(`anchor` の上書きの検査に使う。`comic-bubble-side`)。`license` は必須。
- **読み込み。** `icon-store` の `glyphFromBody` をそのままは使わない。(a) `glyphFromBody` は表情を**正方形**の viewBox の中に中央寄せするので、200×240 の `box` で x が 20px ずれ、アンカーが合わなくなる。読み込みは `box` をそのまま保つ。(b) `sanitizeBody` は、名前つきの色(`fill="white"`)・`<text>`・`<use>`・`<style>`・mask・filter を拒む。一般の描画ソフトの出力はこれに当たるので、素材を作る人向けに「許す要素」の一覧を `character.json` の説明に書く。(c) `<defs>` の id は、人物の 1 回の登場ごとに書き換える(同じ人物が 1 つのマンガに 2 回出ても、グラデーションの id が重ならない。ADR 0012 の考え方)。
- **渡し方。** `renderComic(sheet, {characters})` で素材を渡す(1 回の描画ごと。`icon.use` のようなモジュールの大域の状態にしない。1 つのページで別の素材を使う描画が混ざらない)。`character.use(manifest)` は用意しない。ライセンスの欠落は、素材を読み込むときに投げる(`comic-license-missing` は、検査の経路で同じことを見る)。
- manifest は 1 つの JSON(表情の断片を入れたもの)で、パッケージの `characters/` に入れて配るか、ページが自分で取得して渡す。

**既定: パラメトリックな簡単な顔。** 目(4 種)・眉(傾きと高さ)・口(8 種)の組み合わせで 8 表情(`neutral` / `smile` / `laugh` / `surprise` / `worry` / `angry` / `think` / `sad`)を、頭の円・髪・肩から数値だけで描く(スパイクの `face()`)。人物の違いは髪と服の色相(0〜359)と髪型(2 種で始める)で出す。アンカーは式で出す。**絵師がいなくても PoC が動き、決定的で、ライセンスの問題がない。** 素材の形と同じインタフェース(`{fragment(expression), anchors, box}`)を持つので、あとで絵師の素材に差し替えても、コマ・ふきだし・検査は変わらない。入口に内蔵し、ファイルを読まない。

参照は、データでは `cast` の `asset: "colleague-a"`(manifest の id)か `face: {hue, hair}`(パラメトリック)。同じ `cast` の中で混ぜてよい。見つからなければ `comic-asset-missing`。第 2 版以降: 顔のない人物の既定として `people()` の `PERSON_PATH` を使う。

### D4. 穴(slot)

**テンプレート**: `"tpl": "最近、{change}ね。"`。`{id}` は ID の文法に従う。波括弧そのものは `{{` / `}}`。穴の id は**ワークシート全体で一意**(値を 1 つの平らな表 `{change: '…'}` で持てる。コマごとの名前空間にすると値の表が入れ子になり、チャットとの共有も面倒になる)。重複は `comic-slot-duplicate`。

**穴の定義**(台詞の `slots`): `{max, prompt, fallback?, choices?}`。

| フィールド | 規則(検査 `comic-slot-*`) |
|---|---|
| `max` | 整数 1〜9(全角 1 文字 = 1。内側の幅 162px = 9 字に、穴が必ず 1 行に入るため。Schema の `minimum` / `maximum` でも止める)。`choices` があって `max` が無いときは、いちばん長い候補の字数 |
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
r.svg; r.width; r.height; r.verdict;                   // WebRender と同じ
r.geometry;                                            // 下
const u = await r.update({change: '早く帰る'});        // 値だけの描き直し(下)。{svg, slots: {change: '<g data-slot…>'}, findings}
r.thumbnail('p1', {width: 160});                       // 1 コマの縮小図
```

- **`update(values)` は非同期にする(Promise を返す)。** `WebMeasurer` は非同期でもよい(`web.ts:25`)。同期の測定を要求すると、Worker や canvas の測定を持つページを締め出す。同期の `svgMeasurer` でも、`await` のコストは数マイクロ秒で、体感に影響しない。測るのは、**値が変わった穴の文字だけ**(同じ文字・大きさ・太さは一度測って覚える)。返す断片は、変わった穴の `<g data-slot>` で、ページは SVG ごと差し替えても、その要素だけ差し替えてもよい。
- **保証: `update` は幾何を変えない**(`geometry` は同じ値のまま。テストで `deepEqual`)。
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
  layout: '1x4' | '2x2' | '1x3' | '1x2';
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

**Schema。** `comic` は spec の部品(`{type: 'comic', …ワークシート}`)として登録し、`schema/spec.schema.json` の `definitions` に入る(ADR 0071 D1)。ワークシート単体のファイルは `schema/comic.schema.json` で、ルートは同じ定義(`spec.schema.json#/definitions/…`)を相対で参照する(定義は 1 か所)。`lib/schema-files.ts` から作り、`pnpm schema` で書く。`version` は 1 だけを許し、それ以外は誤りにする。`layout` と `panels` の数の対応は、`if` / `then` の `minItems` / `maxItems` で Schema にも書く(エディタが警告する)。`who` が `cast` にあること、`tpl` の `{id}` と `slots` の対応などは Schema では言えないので検査に回す(ADR 0071 D5 の分担)。

**色。** 色は `lib/tokens.ts` のトーンから取る(スパイクは決め打ち)。マンガは紙の色のままにし、ダークテーマの変種は持たない。案内・飛ばしの文字は白の上で 4.5:1 以上(スパイクの `#5a6072` は 6.27:1)。

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
| `comic-text-budget` | 助言 | 1 コマの文字数(穴を最大で数える)が多すぎる(LLM の出力がふきだしの帯を埋める前の目安) |
| `slot-overflow` 試 | 問題(値が入ったとき) | 値が下限の文字でも穴に入らない(切って描く) |
| `comic-values-unknown` | 助言 | `values` に、定義のない穴の id |

### D7. `chat()` 帯(同じ `Dialogue` を LINE 風に)

- 入力は、同じ `ComicWorksheet`(または `dialogue` の列と `cast`)。コマの順に `dialogue` をつなげて、縦に積む。`who` が「自分」(`self: 'me'`)なら右、それ以外は左。
- 見た目: 角丸の吹き出し(しっぽは小さく、片側のみ)、左側の人物は顔(同じ素材の頭の部分を丸く切る)と名前。時刻や既読は出さない。
- 大きさ: D2 と同じ規則(`lib/comic/` の共有の関数 `reserveDialogue`)。内側の幅は、列の 70% と、いちばん広い穴の塊のうち大きい方(ただし列の幅まで)。穴の状態の描き方、値は共有なので、マンガに入れた値がそのままチャットにも出る。
- コマの区切り(`separators: true` で細い線)は任意。

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
- PowerPoint の書き出し(`lib/pptx/bands.ts`)は対象外。第 1 版の挙動は U1 で確かめて、ここに書く。
- golden: `examples/` に 2 つ足す(1×4 と 2×2)。幅の数え方は `comic` / `chat` の中だけなので、既存の図の出力は変わらない(テストで確かめる)。
- 描画は決定的(全角の原子は測らない。英字の原子は 0.03px の揺れを許す)。ただし、英字・数字の字幅は、保存した SVG を開く端末のフォントで変わりうる(D2)。
- 配布: jsDelivr が読むのは npm の版。`renderComic` を含む版は、まだ出ていない(0.9.0 には無い。リポジトリの `package.json` は 0.5.0 で、版の付け方は `scripts/release.sh` に従う。U6 で確かめる)。

## 実装計画

どの単位も、`main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる(ADR 0073 と同じ)。

### U1: `comic()` と `bubble()`

- 範囲: 1×4 と 2×2 の割り、枠・溝・番号、舞台と、ふきだしの置き方(D1 の規則)、ふきだし 4 種、しっぽ、横書き、D2 の大きさの規則(幅の数え方、`bunsetsu` + 穴の塊の `glue`、孤立行の解消)。穴の描画は U3。顔は丸だけの仮(U2 で置き換える)。
- 完了の基準: (1) 4 コマ・ふきだし 6 個の図が、Node と headless Chromium で**SVG の文字列として一致する**(原子の位置まで。スパイクで確認済みの方式)。(2) すべての測定に ±0.0156px を足しても幾何が変わらない。(3) 台詞のテキストだけを変えても、コマ・人物の位置が変わらない。(4) 6 つの台詞(作り話)で、語の途中・孤立行・穴の後ろの分離が 0。(5) PowerPoint の挙動を確かめて、影響の節を埋める。(6) 既存の golden が変わらない。
- テスト: 配置の golden(2 種)、`wrapStyledAtoms` に穴の塊を渡したときの行の分け、箱が 4px の格子に乗る、しっぽの向き(10° 以内)、`test/web-entry.test.ts` と同じ「`node:*` に届かない」の束ね確認。

### U2: 顔と素材の形

- 範囲: パラメトリックな顔(8 表情、髪型 2 種、色相)、`character.json` の型と読み込み(D3 の 3 点の規則)、`renderComic({characters})`、アンカー。
- 完了の基準: 8 表情が描ける。同じ入力は同じ SVG。素材に差し替えても、コマ・ふきだしの配置がアンカーだけで決まる(200×240 の素材でずれない)。ライセンスが無いと投げる。
- テスト: 表情ごとの golden、掃除(外部参照や `script` を落とす。名前つきの色を拒む)、`box` が正方形でないときのアンカー、`<defs>` の id の書き換え、ライセンス欠落。

### U3: 穴、幾何の地図、値だけの描き直し

- 範囲: `{id}` の解析(`{{` / `}}`)、3 状態と切り、`slot-overflow`、幾何の地図(`points` を含む)と `data-node`、`renderComic` の `update`(非同期)、縮小図。
- 完了の基準: **空・埋めた・飛ばし・長すぎるの 4 状態で `geometry` が `deepEqual`**。`update` は変わった穴だけを測る(測定の呼び出しを数える)。地図は 12 穴で 4 KB 未満。`blank: 'line'` が案内を出さない。本物の `svgMeasurer` で、変わった穴が 1・5・12 個のときの `update` の時間と、4 コマの `comic` の最初の `renderComic` の時間を測り、この ADR に書く。
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

## 未決(決める人への質問。それぞれ推奨を付ける)

- **Q1. 第 1 版で縦書きのふきだしを出すか。** 推奨: 出さない(第 2 版)。横書きで穴埋めの価値は確かめられる。縦書きは `verticalColumns` を再利用できるが、右から左の読む順とコマの並び(`dir: 'rtl'`)まで一緒に決めないと半端になる。型の予約(`writing`、`dir`)だけ第 1 版に入れる。
- **Q2. 簡単な顔が先か、絵師の素材が先か。** 推奨: 簡単な顔が先。絵師なしで決定的に動き、ライセンスの問題がなく、素材の形(D3)を実際の使い方で確かめられる。見た目は粗い(スパイクの絵)。素材は、形が固まってから差し替える。
- **Q3. 入力は HTML の入力欄を重ねるか、SVG の中で編集するか。** 推奨: HTML の入力欄を重ねる。日本語の IME(変換中の文字)は SVG の `<text>` で扱えない。`geometry` の矩形に入力欄を置き、確定したら `update` を呼ぶ。位置合わせの補助(`toClientRect`)を一緒に出す。
- **Q4. 幾何の地図と値だけの描き直しを公開 API にするか。** 推奨: 公開する(`svg-diagram/browser`。README に実験的と書く)。見本と実際の Artifact がどちらも使う。使わなくても動く(毎回 `renderComic`)。
- **Q5. 穴の幅の隙間をどう扱うか。** 推奨: 第 1 版は `max` = 入力欄の `maxlength` の字数とし、`choices` から既定の `max` を出す(D4)。LLM の判断には頼らない。見た目が悪ければ、第 2 版で穴の後ろの文字を行の中で詰める。
- **Q6. 印刷用の輪郭化をどの経路にするか。** 推奨: 第 1 版は MCP / Node の経路で作り、Artifact は生きた文字の SVG と canvas の PNG を出す(字体は端末のもの)。ブラウザで日本語の字形(opentype.js + woff のフォント)を持ち込めるかは、U6 のあとで別に測る。重い(数 MB)ので既定にはしない。
- **Q7. 実際の Artifact の枠で、jsDelivr の `import()` が動くか。** headless Chromium では動いた。Artifact の枠の制限(CSP など)は未確認。推奨: **U6 の頭のゲート**にする(U1〜U5 は Artifact なしで進められる)。動かなければ、`+esm` か `<script type=module>` の形に変える。
- **Q8. 幅の数え方。** 推奨: D2 の 2 のとおり(全角は 1 em、英字は 0.03px の揺れを許して整数 px に切り上げ、`comic` / `chat` の中だけ)。ほかの帯の箱は変えない。
- **Q9. 文字の最小の大きさ。** 既定の下限 14px が縮める余地を決める(18px → 14px で 22%)。推奨: 下げない(読めない大きさのものは意味がない)。値が長すぎるときは、入力欄の `max` で止める。

## スパイクの再現

```
node spikes/comic-worksheet/run.ts [outdir]        # Node(HarfBuzz)。4 状態の一致、揺れへの強さ、地図の大きさ、行分け、検査
node spikes/comic-worksheet/browser-check.mjs      # headless Chromium。jsDelivr の 0.9.0、Node の SVG との一致、PNG(ネットワークが要る)
```

`spikes/comic-worksheet/out/` に、空の状態と埋めた状態の SVG を置いた(文字は生きたまま。Noto Sans JP で測った)。この ADR を採るなら、スパイクは U1 の PR で `lib/comic/` に置き換えて消す。
