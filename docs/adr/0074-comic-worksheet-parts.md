# ADR 0074: 穴埋めのマンガ・ワークシート向けの部品 — `comic()`(コマ)、`bubble()`(ふきだし)、キャラクター、穴(slot)、Artifact への橋渡し、`chat()`

- 状態: 草案(Draft。2026-11-22。設計と小さなスパイク。`lib/` は変えていない。決める人への質問は末尾の Q1〜Q7)
- 日付: 2026-11-22
- 基点: `main`(eec05f8c、PR #431 まで)
- 関連: ADR 0045(`svg-diagram/browser`、測定を外から渡す)、ADR 0057(spec の `canvas`)、ADR 0071(JSON Schema をパッケージに入れる)、ADR 0034(`data-node`)、ADR 0050(組み合わせられる帯)、ADR 0012(id のスコープ)、ADR 0009(縦書き)、ADR 0007(Ports)
- 範囲外(記録だけして、あとの ADR に回す): `ripple()`(人の反応の同心円の図)と「小さな一歩の橋」の図(D8)。Artifact の画面(スワイプ・状態・保存)は svg-diagram の外。ここで出すのは見本のテンプレートだけ
- 例のデータはすべてこの ADR のための作り話(テーマ「週に一度は早く帰る」。同僚の台詞「最近、{change}ね」など)

## 背景

claude.ai の Artifact(1 枚の HTML。`svg-diagram/browser` を jsDelivr から読む)で、**穴埋めのマンガ・ワークシート**を作りたい。流れは次のとおり。

1. 利用者がいくつかの場面の候補(カード)から 1 つを選ぶ。
2. 場面が 4 コマのマンガに広がる。
3. 利用者が、ふきだしの中の短い穴(数文字)を埋める。
4. 結果を SVG / PNG で保存する(印刷用には文字を輪郭にする)。

同じ台詞のデータは、LINE 風のチャットとしても描けること。あとで「反応の波紋」と「小さな一歩の橋」の図にも使う。そのため、**データは意味が先**(テンプレートと穴の値)で、配置とは別にする。台詞を書き換えてもキャラクターやコマは動かず、同じデータは必ず同じ絵になる。

### コードで確かめたこと(再利用できるもの)

| 部品 | 場所 | この ADR での使い道 |
|---|---|---|
| ブラウザ入口 | `lib/web.ts`(`renderInBrowser(diagram, {measure})`、`svgMeasurer`)。結果の `WebRender` は `laidOut`(配置済みの帯)を持つ。`image()` と `math()` はここでは投げる | 描画の入口。`laidOut` から矩形の地図を作れる(D5)。`image()` が使えないので、キャラクターは絵のファイルでなく SVG の断片で持つ(D3) |
| JSON の spec と Schema | `lib/spec.ts`、`lib/spec-parts/r1〜r7.ts`、`lib/schema-files.ts`、`schema/*.schema.json`、`test/schema-files.test.ts`(ADR 0071) | `comic` を部品として spec に足し、`schema/comic.schema.json` を同じやり方で出す(D6) |
| 日本語の折り返し | `lib/wrap.ts` の `wrapStyledAtoms`(禁則、`phrase` / `char` / `bunsetsu`)、`lib/atoms.ts` の `splitAtoms` | ふきだしの行分け(D2) |
| 縦書き | `lib/wordart-vertical.ts` の `verticalColumns(text, size, weight, widthOf, {limit, spacing})`、`COLUMN_PITCH = 1.4`、約物のぶら下げ | 縦書きのふきだし(D2、第 2 版) |
| 文字の輪郭化 | `lib/svg-outline.ts` の `outlineText(svg, OutlineFont, textBox)`。字形は呼び出し側が渡す(ADR 0007)。`svg-diagram/spec/edge` が同じ形で公開 | 印刷用の書き出し。ブラウザ側の `OutlineFont` は今は無い(下のスパイク) |
| ラスタ | `lib/raster.ts`(resvg / Chromium)。Node のみ | Node 側の PNG。ブラウザでは canvas を使う(スパイクで確認) |
| アイコン | `lib/icon-registry.ts` の `icon.use(manifest)`、`lib/icon-store.ts` の `IconGlyph`(`d` か、掃除した断片 `body`)、`glyphFromBody(..., {color: true})` | 差し替え式のキャラクターの置き場と掃除のやり方(D3) |
| 人のかたち | `lib/people.ts` の `PERSON_PATH`(24px の箱の頭と肩) | 顔のない人物(群衆・波紋の人)の既定。第 2 版以降 |
| 注釈の吹き出し | `lib/dsl/connect.ts` の `callout()`(`ConnectBand` の `annot`。箱への引き出し線と角丸の札) | マンガのふきだしとは別物(下の「代替案」)。使わない |
| 帯を足す手間 | `valueChain` を grep すると 21 ファイル(`layout-handlers`・`emit-handlers`・`verify-handlers`・`fit-handlers`・`reveal-handlers`・`band-ids`・`emit-node-ids`・`spec-kit`・`pptx/bands` など) | 帯 1 つの追加は約 20 ファイル。`lib/comic/` に実装を集め、表への登録だけを散らす(影響) |
| 検査の仕組み | `lib/rules.ts` の `RULE_DOCS`(助言)、`lib/verify-handlers.ts` の `rects` / `check`(失敗する問題)、`lib/finding-rules.ts` の `at()`、`lib/emit-node-ids.ts`(`data-node`) | D6 の検査と D5 の地図の土台 |
| canvas・reveal | `lib/canvas.ts`、`lib/reveal.ts`、`lib/reveal-handlers.ts`(`plain` は「段として出す」だけ) | コマ単位の `reveal`(present で 1 コマずつ)。第 1 版は `plain` |
| 最小の文字 | `lib/tokens.ts` の `MIN_FONT_SIZE = 14`(`canvas.minText` は 10 まで下げられる) | ふきだしの文字を縮める下限(D2)。スパイクの最初の版(16px・穴の案内 11px)はこの下限に触れたので、18px / 14px に直した |

### スパイクの結果(`spikes/comic-worksheet/`。`lib/` は触っていない)

`proto.ts`(約 170 行)は、意味が先のデータ(コマ・台詞のテンプレート・穴の定義)から、縦 1×4 のマンガの SVG と矩形の地図を作る使い捨ての試作。測定は関数で受け取る(ブラウザ入口と同じ)。`run.ts` は Node(HarfBuzz)で、`browser-check.mjs` は headless Chromium で、同じ試作を動かす。

| 測ったこと | 結果 |
|---|---|
| 1×4(1 コマ 420×300、余白と溝 16)、パラメトリックな顔 8 表情、ふきだし 6 個、穴 5 個 | 描ける。顔は約 60 行で 8 表情(目 4 種・眉の傾き・口 8 種・髪と服の色相)。決定的で、ライセンスの問題がない。見た目は最小限(髪が眉に近い等、絵としては粗い) |
| 日本語(横書き)が収まるか | ふきだしの箱は「穴を最大の文字数分で埋めた文」から決める。18px・内側 162px(1 行 9 字)で、箱は 168〜204 × 72〜100。4 コマに 3 つの検査(ふきだしが顔を隠す・しっぽが話し手の口を向く・穴の数)を掛けると、最初の版(楕円で √2 倍、16px)は 1 コマに 2 個のふきだしが入らず、検査が 2 件を報告した(`bubble-overlaps-face` と `tail-misses-speaker`)。丸角の四角(角丸は最大 24px)にして直ると 0 件 |
| 穴を埋めても幾何が変わらないか | 空・埋めた・飛ばしの 3 状態で、穴の中身(`<g data-slot>`)を除いた SVG が完全に一致する。穴の幅は最大の文字数で固定なので、後ろの文字も動かない |
| 長すぎる値 | 18px から 14px(`MIN_FONT_SIZE`)まで縮め、それでも入らなければ `slot-overflow` を返す(値で決まる検査は幾何から分けた) |
| 矩形の地図の大きさ | コマ 4・ふきだし 6・穴 5・頭 8 の 23 件で 1119 バイト(約 50 バイト / 件)。12 穴の 1×4 でも 2 KB 前後 |
| 穴を埋めたときの再描画 | 配置を持ち越して SVG を作り直す関数(全 6 穴の測定を含む)が 0.7〜1.3 ms。最初の配置は 65〜90 ms(試作が 1 文字ごとに測るので不利。比較の目安にしかならない) |
| Node とブラウザで同じ絵か | 初め、ふきだしの幅が 168(Node)と 172(Chromium)に割れた。同じ文字を HarfBuzz は 16、Chromium は 16.0156 と測り、4px の格子へ切り上げるところで跨ぐため。**原子の幅を整数 px に丸めてから足す**と、全ふきだしが一致した(188×100、188×72 …)。D2 に決定として入れる |
| 見た目の問題 | (1) 文字ごとの折り返し(`char`)は「上が / ります」と語の途中で切る。`bunsetsu` は未検証(U1 で比べる)。(2) 穴は分けない 1 つの塊なので、行の最後に置けず次の行へ追い出されることがある(「最近、/ ____ ね。」)。(3) 穴の幅が値より広いと、後ろの文字との間が空く(「先に  資料を共有  しておきます」)。穴の最大の文字数を実際の長さに近づけるか、第 2 版で行の中で詰める(D4 の注、Q5) |
| 配布経路(jsDelivr、headless Chromium、npm の 0.9.0) | `import('https://cdn.jsdelivr.net/npm/svg-diagram@0.9.0/dist/lib/web.js')` が動く。168 リクエスト・約 170 KB(読み込み 0.2〜0.3 秒。初回は 2.9 秒かかった)。`diagram` / `box` / `row` / `wordart` / `people` を `renderInBrowser` + `svgMeasurer` で描けて、verdict は ok、描画 34〜46 ms。`callout` / `canvas` / `icon` / `image` も公開名にある(`image()` は設計どおり投げる)。`…/browser/+esm`(jsDelivr がまとめる)は 1 リクエストで 135 の公開名が取れた(初回 4 秒)。同じページで SVG → `<img>` → canvas → PNG(2 倍、約 290 KB)も動いた |
| まだ確かめていないこと | 実際の Artifact の枠(CSP や iframe の制限)の中での動作。`import()` の許可、`svgMeasurer` が使うフォント。ブラウザでの**文字の輪郭化**(`OutlineFont` を作る字形の読み込みは Node の HarfBuzz だけ。ブラウザで opentype.js 等と日本語フォントのファイルを持ち込めるかは未確認) |

## 決定

全体の方針: **コマ・ふきだし・穴・キャラクターは、帯 `comic()` の中で閉じた 1 つのモデルとして配置する**(個別の `box` の寄せ集めにしない)。理由は、しっぽ・顔・穴の検査に「話し手」「口の位置」「穴の矩形」という関係が要り、一般の箱と矢印では持てないため。実装は `lib/comic/` に集める。入力は D6 の JSON が正で、TS の DSL(`comic({...})`)は同じ形を書くだけの薄い入口にする。

### D1. `comic()` 帯(コマの割り)

**選択肢**

- A. 縦 1×4 だけ。
- B. 名前付きの割り(`1x4` / `2x2` / `1x3` / `1x2`)を持ち、`span` は持たない。
- C. 自由な格子(`cols` / `rows` / `span`)。

**推奨: B。** 日本の 4 コマの標準は縦 1×4(スマホの縦長の画面にも合う)で、2×2 は印刷の A4 用に要る。C は大ゴマが要るマンガに向くが、検査の幾何と LLM の出力の安定が先に崩れる。名前を数個に絞れば Schema の `enum` で止められる。

- 大きさ: コマの幅は内容幅(1×4 は 420px を基準に、`canvas` の幅に合わせる)、縦横比は 7:5(`aspect` で変えられる。スパイクは 420×300)。2×2 は正方形に近づける(縦横比 1:1 が既定)。
- 枠と溝: 枠線 3px、コマの間(溝)16px、外側の余白 16px。すべて 4px の格子に乗せる(`coordinate-grid` の助言を通すため)。
- 番号: 左上に 24px の黒い札で 1〜4(`numbering: true` が既定)。`labels: ['起', '承', '転', '結']` で札の中身を変えられる。
- 読む順: コマは上から下(1×4)、左から右へ行ごと(2×2)。1 コマの中のふきだしは `dialogue` の並びの順(上から)。`dir: 'rtl'` は縦書き(第 2 版)で右から左になる。第 1 版では予約するだけで、`ltr` 以外は未実装のエラーにする。
- コマの中の置き方(決定的で、データだけから決まる):
  - 舞台: 人物は `at: 'left' | 'center' | 'right'` で、コマの幅の 25% / 50% / 75% に、頭の中心の高さを下から固定(スパイクは下から 76px。頭の半径 36px、胸から下は枠で切る)。
  - 背景: `bg` は色のつけ方(`tint: 'warm' | 'cool' | 'plain'`)と、あれば 1 つのアイコン(`icon.use` したもの)。絵の背景は範囲外。
  - ふきだし: 話し手の頭の上に中心をそろえ、コマの中に収まるよう寄せる。順に、コマの上から置き、先のふきだしと横の範囲が重なるときだけその下に積む(横が離れていれば同じ高さに並べる)。`anchor: 'top-left'` 等で上書きできる(任意)。
  - ふきだしを置ける高さ(頭の上の帯)に収まらないときは検査(D6)が止める。スパイクで、1 コマ 2 個が入る条件が数値で分かった(D2)。

### D2. `bubble()`(ふきだし)

**種類**

| `kind` | 形 | しっぽ |
|---|---|---|
| `say` | 角丸の四角(角丸 `min(高さ/2, 24)`。ほぼ楕円に見える) | 三角。話し手の口へ向ける |
| `think` | 同じ形を破線に | 小さな丸 3 つが口の向きに小さくなる。第 1 版は破線の三角で代用し、丸は U1 で足す |
| `shout` | 太い枠の四角(ぎざぎざは U1 で試す) | 三角 |
| `narration` | 四角、しっぽなし | なし(コマの隅に置く) |

**楕円にしない理由。** 楕円の中に文字の四角を収めるには、両方向に √2 倍が要る(スパイクの最初の版)。内側 168px の文が幅 260px になり、420px のコマに 2 個が横に並ばない。丸角の四角なら余白 12 / 10px で足りる。本物の楕円は `shape: 'ellipse'` として後で足せる(未決にしない)。

**しっぽの向き(規範)。** ふきだしの中心から話し手の口のアンカーへ引いた線上に、しっぽの先を置く。先は、その線が顔(頭の円)に入る点の手前 6px で止める(顔を覆わない)。付け根は、その線がふきだしの縁を通る点。検査は、付け根から先への向きと、付け根から口への向きの差が 10°(0.17 rad)以内かを見る。

**文字**

- 横書きを第 1 版で出す(Q1)。縦書きは `writing: 'vertical'` として、同じ「箱は最大の文字数から決める」規則のまま、`verticalColumns` で列に割る第 2 版にする。列の幅は `COLUMN_PITCH`(1.4)の倍数、読む順は右から左。
- 文字の大きさは 18px(`MIN_FONT_SIZE` = 14 まで縮める余地を 22% 残す)。行の高さは 26px。穴の案内と札の数字は 14px(下限)。

**大きさ(規範。「穴を埋めても配置が動かない」を成り立たせる決定)**

1. ふきだしの箱は、**テンプレートの穴を、それぞれの最大の文字数(`max`)×全角 1 文字分で置き換えた文**から決める。穴は途中で折らない 1 つの塊として扱う。
2. 折り返しは `wrapStyledAtoms` に、内側の最大幅(既定 162px = 18px で 9 字)を渡して行う。行の分け方と、穴の矩形の位置は、この「最大の文」で決まる。実際の値は、その穴の矩形の中に中央ぞろえで書く。そのため、行数・穴の位置・後ろの文字の位置は、値に左右されない。
3. 原子の幅は**整数 px に丸めてから足す**。そのうえで、箱の幅と高さを 4px の格子に切り上げる。スパイクで、同じ文字を Node(HarfBuzz)が 16、Chromium が 16.0156 と測り、格子の境で箱が 168 と 172 に割れた。丸めると、両者で全ふきだしが一致した。「同じデータは必ず同じ絵」は、測定の実装が違っても守る。
4. 値が穴の幅より広いときは、文字を縮める(下限 14px = `MIN_FONT_SIZE`。`canvas.minText` があればそちら)。下限でも入らなければ `slot-overflow` を返す。値を入れる側(Artifact)は、入力欄の `maxlength` に `max` を使う。

**折り返しの方式。** 既定は `bunsetsu`、検査で語の途中の改行(`midWordBreaksIn`、`lib/text-rules.ts`)を見る。スパイクが使った `char` は「上が / ります」と切ったので採らない。U1 で `phrase` / `bunsetsu` を比べて決める(未決)。

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

- `box` は座標の基準(表情の SVG はこの `viewBox` で描く)。`anchors` は `box` の座標で、描くときに倍率をかけてコマの座標へ移す。`bubbleSides` はふきだしを置いてよい側(顔の向きや手の位置で決まる)。`license` は必須(`comic-license-missing`)。
- 表情の SVG は、`icon-store` の `glyphFromBody(..., {color: true})` と同じ掃除(`script`・外部参照・`style` などを除く)を通した断片として取り込む。ブラウザ入口では `image()` が使えない(`lib/web.ts`)ので、絵のファイルでなく断片を SVG に埋める。

**既定: パラメトリックな簡単な顔。** 目(4 種)・眉(傾きと高さ)・口(8 種)の組み合わせで 8 表情(`neutral` / `smile` / `laugh` / `surprise` / `worry` / `angry` / `think` / `sad`)を、頭の円・髪・肩から数値だけで描く(スパイクの `face()`)。人物の違いは髪と服の色相(0〜359)と髪型(2 種で始める)で出す。アンカー(口・頭・手)は式で出す。**絵師がいなくても PoC が動き、決定的で、ライセンスの問題がない**。素材の形(`character.json`)と同じインタフェース(`{fragment(expression), anchors, box}`)を持つので、あとで絵師の素材に差し替えても、コマ・ふきだし・検査は変わらない。

**どう束ねて、どう参照するか**

- パラメトリックな顔は入口に内蔵する(ファイルを読まない)。
- 絵師の素材は、`icon.use(manifest)` と同じ形の `character.use(manifest)` で渡す(ADR 0045 D3 と同じく、ブラウザには `fs` が無い)。manifest は 1 つの JSON(表情の断片を入れたもの)で、パッケージの `characters/` に入れて配るか、ページが自分で取得して渡す。
- 参照は、データでは `cast` の `asset: "colleague-a"`(manifest の id)か `face: {hue, hair}`(パラメトリック)。同じ `cast` の中で混ぜてよい。見つからなければ `comic-asset-missing`(失敗する問題)。
- 第 2 版以降: 顔のない人物(群衆・波紋の人)の既定として、`people()` の `PERSON_PATH`(`lib/people.ts`)を使う。

### D4. 穴(slot)

**テンプレートの書き方**: `"tpl": "最近、{change}ね。"`。`{id}` は `[A-Za-z_][\w-]*`。波括弧そのものは `{{` / `}}`。穴の id は **ワークシート全体で一意**(Artifact が値を 1 つの平らな表 `{change: '…'}` で持てる。コマごとの名前空間にすると、値の表が入れ子になり、チャットとの共有も面倒になる)。重複は `comic-slot-duplicate`。

**穴の定義**(台詞の `slots`): `{max, prompt, fallback?, choices?}`。`max` は最大の文字数(全角 1 文字 = 1。1〜12)、`prompt` は空のときの案内(2〜4 字)、`fallback` は飛ばしたときの文言(既定 `…`)、`choices` は Artifact が候補のチップを出すための候補(描画には使わない)。

**状態と描き方**(値の表では、未設定 = 空、`null` = 飛ばし、文字列 = 埋めた)

| 状態 | 描き方 |
|---|---|
| 空 | 穴の矩形の下に点線の下線(2px)。中央に案内(14px、薄い灰色)。`blank: 'line'` では案内を出さず下線だけ(紙に手で書く用) |
| 埋めた | 矩形の中央に値(太字、強調色)。下線は出さない。長ければ縮める(D2 の 4) |
| 飛ばし | `fallback`(既定の `…`)を薄い灰色で、通常の太さで |

どの状態でも、穴の矩形と周りの文字は同じ位置にある(スパイクで、3 状態の SVG が穴の中身を除いて完全に一致することを確かめた)。

**1 コマに穴は 1〜2 個**: 検査 `comic-slots-per-panel` が 3 個以上を止める(失敗する問題)。0 個のコマは許す(説明のコマ)。「1 個のふきだしの中の穴は 2 個まで」はこの検査に含める。

**穴の幅の隙間(未解決の注)。** 穴は最大の幅で固定するので、短い値だと後ろの文字との間が空く(スパイクの見た目の問題)。第 1 版は `max` を実際の長さに近づけて対処する(LLM に「想定の長さ」を `max` に書かせる)。穴の後ろの文字を行の中で詰める方式は、ふきだしの箱は動かないが、文字の位置が値で動くので、第 2 版の選択肢にとどめる(Q5)。

### D5. Artifact への橋渡し

**API の形(案。第 1 版は `svg-diagram/browser` だけに出す)**

```ts
import {renderComic, svgMeasurer} from 'svg-diagram/browser';

const r = await renderComic(sheet, {measure: svgMeasurer(), values: {}, characters});
r.svg;        // 完全な SVG(状態は values から)
r.width, r.height;
r.geometry;   // {panels: {p1: Rect}, bubbles: {'p1.b0': Rect}, slots: {change: Rect}, heads: {'p1.me': Rect & {mouth: [x, y]}}}
r.findings;   // D6 の検査の結果(問題と助言)
r.update({change: '早く帰る'});   // 文字だけの再描画(下)
r.thumbnail('p1', {width: 160});  // 場面カードの縮小図
```

- **幾何の地図(`geometry`)。** 矩形は SVG の座標(viewBox の座標)で、ページは `getBoundingClientRect().width / r.width` の倍率で HTML の入力欄を重ねたり、クリックの当たりを調べたりする。作り方は、配置済みの帯の `anchors`(接続の端に使うもの)から出す。`WebRender` はすでに `laidOut` を返しているので、地図は**部品に共通の関数 `geometryOf(laidOut)`**(id → 矩形。`scope.id` で修飾、ADR 0012)として足し、`comic` はコマ・ふきだし・穴・頭を `anchors` に登録する。SVG の側には `data-node`(ADR 0034)で同じ名前を付ける(`nodeIds: true`)ので、クリックは DOM からも引ける。スパイクの大きさは 23 件で 1.1 KB。
- **文字だけの再描画(`update(values)`)。** `renderComic` は配置を閉じ込めて返し、`update` はその配置を使い回す。測るのは、値が変わった穴の文字だけ。返すのは新しい `svg` と、変わった穴の断片 `slots: {id: '<g data-slot>…'}`(ページは SVG を差し替えても、`data-slot` の要素だけ差し替えてもよい)。**保証: `update` は幾何を変えない**(`geometry` は同じ値を返す。テストで `deepEqual`)。スパイクで 0.7〜1.3 ms。
- **公開するか(Q4)。** 推奨は、`renderComic` と `geometry`・`update` を `svg-diagram/browser` に出し、`@experimental`(0.x の間は壊れる変更を許す)と書く。Artifact の見本(U6)がこれを使うので、内部だけにすると見本が深い import に頼る。`update` を使わず、毎回 `renderComic` を呼んでも正しく動く(速度だけの最適化)ので、公開を取り消すときの被害は小さい。
- **場面カードの縮小図。** 同じ配置の SVG の `viewBox` を 1 コマ(`thumb: true` の付いたコマ。既定は 1 コマ目)に切って、`width` を縮める。穴は空のまま(案内の文字が 14px 未満になる縮小では案内を出さない)。配置を作り直さないので、カード 4 枚でも安い。

**注意(印刷用の輪郭化)。** ブラウザには、日本語の字形から `OutlineFont` を作る手段が今ない(Node は HarfBuzz、Worker は `svg-diagram/spec/edge` に呼び出し側が渡す)。第 1 版の Artifact は、(a) 文字が生きた SVG と、(b) canvas 経由の PNG(スパイクで動作)を出す。輪郭化した SVG は、MCP / Node の経路(`svg-diagram` の CLI、プラグイン)で作るか、ブラウザで字形を持ち込めるか(opentype.js + woff のフォントファイル)を U6 のあとで測る(Q6)。

### D6. データの型、JSON Schema、検査

**型(JSON。`comic` 部品の `spec` の形でもある)**

```ts
interface ComicWorksheet {
  version: 1;
  title: string;
  layout: '1x4' | '2x2' | '1x3' | '1x2';
  cast: Record<string, Cast>;          // 人物。id → 素材か顔のパラメータ
  panels: ComicPanel[];                // 4 コマ(layout の数と一致)
  numbering?: boolean; labels?: string[]; blank?: 'prompt' | 'line';
}
interface Cast { name: string; asset?: string; face?: {hue: number; hair?: 'short' | 'long'} }
interface ComicPanel {
  id: string; bg?: {tint?: 'warm' | 'cool' | 'plain'; icon?: string}; thumb?: boolean;
  stage: {who: string; at: 'left' | 'center' | 'right'; expression: Expression}[];   // 舞台
  dialogue: Dialogue[];                // 読む順
}
interface Dialogue {                   // チャットと共有する型
  id: string; who: string; kind: 'say' | 'think' | 'shout' | 'narration';
  tpl: string; slots?: Record<string, {max: number; prompt: string; fallback?: string; choices?: string[]}>;
}
type Values = Record<string, string | null>;   // 値は別(状態)。無い = 空、null = 飛ばし
```

意味が先であることの保証: **データには座標も大きさも置かない**(`at` と `expression` は意味の名前)。値(`Values`)はデータに含めず、状態として別に持つ。だから、台詞を書き換えてもキャラクターやコマは動かず、同じ `ComicWorksheet` + `Values` は常に同じ絵になる。

**Schema**: `schema/comic.schema.json`(ADR 0071 D1〜D3 と同じ形。`lib/schema-files.ts` から作り、`pnpm schema` で書く。`test/schema-files.test.ts` が古さを見張る)。`comic` は spec の部品としても登録する(`spec-parts`)ので、デッキ・MCP・ChatGPT からも描ける。LLM が出した場面の JSON は、Schema で形を、検査で中身を確かめられる。`layout` と `panels` の数、`dialogue` の `who` が `cast` にあること、`tpl` の `{id}` が `slots` に定義されていること(逆も)は、Schema では言えないので検査に回す(ADR 0071 D5 と同じ分担)。

**検査**(規則名は案。失敗する問題は `verify-handlers`、助言は `rules.ts` の `RULE_DOCS`)

| 規則 | 重さ | 内容 |
|---|---|---|
| `comic-asset-missing` | 問題 | `cast` の素材 id が manifest に無い、`expression` が素材に無い |
| `comic-speaker-unknown` | 問題 | `who` が `cast` に無い、または `stage` にいない(しっぽが向く先が無い) |
| `comic-slots-per-panel` | 問題 | 1 コマに穴が 3 個以上 |
| `comic-slot-duplicate` / `comic-slot-undefined` | 問題 | 穴の id の重複、`tpl` と `slots` の食い違い |
| `comic-bubble-covers-face` | 問題 | ふきだしの矩形が、頭の円(+ 4px)と重なる(スパイクで実装・動作) |
| `comic-tail-off-speaker` | 問題 | しっぽの向きが口への向きから 10° を超えてずれる(スパイクで実装・動作) |
| `comic-bubble-zone` | 問題 | ふきだしが頭の上の帯に収まらない(積みきれない) |
| `slot-overflow` | 助言(値が入ったときだけ) | 値が下限の文字の大きさでも穴に入らない |
| `comic-license-missing` | 問題 | 素材にライセンスが無い |
| `comic-midword-break` | 助言 | 折り返しが語の途中(`midWordBreaksIn`) |

スパイクで、最初の 2 つの幾何の検査(顔を隠す・しっぽ)は、実際に設計の誤り(楕円での積み上げ)を見つけた。

### D7. `chat()` 帯(同じ `Dialogue` を LINE 風に)

- 入力は、同じ `ComicWorksheet`(または `dialogue` の列と `cast`)。コマの順に `dialogue` をつなげて、縦に積む。`who` が「自分」(`self: 'me'`)なら右、それ以外は左。
- 見た目: 角丸の吹き出し(しっぽは小さく、片側のみ)、左側の人物は顔(同じ素材の頭の部分を丸く切る)と名前。時刻や既読は出さない(意味のないデータを作らない)。
- 大きさ: D2 と同じ「最大の文から箱を決める」規則(`lib/comic/` の共有の関数 `reserveDialogue`)。内側の最大幅は列の 70%。穴の 3 状態の描き方も同じ。
- 穴の id と `Values` は共有なので、マンガに入れた値が、そのままチャットにも出る。コマの区切り(`separators: true` で細い線)は任意。

### D8. この ADR で扱わないもの(あとの ADR に回す)

- `ripple()`(人の反応の同心円)と「小さな一歩の橋」の図: この ADR の `Dialogue` / `cast` / `Values` が、プレーンな JSON の平らな形であることを保つだけ。`people()` の顔のない人物(`PERSON_PATH`)を波紋の人に使う案は、その ADR で決める。
- Artifact の画面(カード選び、スワイプ、状態の保存、入力欄)は svg-diagram の外。U6 で見本のテンプレート(1 枚の HTML)を `examples/artifact/` に出すだけ。

## 代替案

- **既存の `box` / `row` / `connect` / `callout` で描く(新しい帯を作らない)**: 帯の追加(約 20 ファイル)を避けられる。しかし、`callout()` は箱への引き出し線と札で(`annot`)、しっぽの向き・穴の矩形・顔との重なりを検査できない。コマの中の自由な座標も持てない。却下。
- **別のパッケージ(`svg-diagram-comic`)にする**: 核を小さく保てる。しかし spec・デッキ・MCP・check・reveal の仕組みに乗れない。ただし `lib/comic/` に実装を閉じ込めるので、あとで切り出せる。
- **HTML / CSS でマンガを描く**: 入力欄との相性はよい。SVG・PNG への書き出しと、印刷用の輪郭化ができない。却下。
- **画像生成や絵のファイルを既定の顔にする**: 決定的でなく、ライセンスと配布の手間がある。差し替えの口(D3)だけ用意する。
- **楕円のふきだしを既定にする**: 見た目は典型的だが、幅が √2 倍になり 1×4 に 2 個入らない(D2)。後で `shape: 'ellipse'`。
- **穴の後ろの文字を値に合わせて詰める**: 見た目はよいが、文字の位置が値で動く。D4 の注のとおり第 2 版で測る。
- **穴の id をコマごとの名前空間にする**: コマの複製や LLM の場面の入れ替えに強い。しかし値の表が入れ子になり、チャットとの共有が増える。ワークシート全体で一意にして、重複は検査で止める。

## 影響

- 新しい帯 `comic`・`chat`(と部品としての `bubble`)。約 20 ファイルに表の登録が入る。実装は `lib/comic/`(約 8 ファイル: 配置・ふきだし・顔・穴・地図・検査・チャット・素材)。
- `svg-diagram/browser` に `renderComic`・`character.use` が増える(`@experimental`)。パッケージが `characters/`(manifest。既定のパラメトリックな顔は内蔵なので、第 1 版は空でよい)と `schema/comic.schema.json`(数 KB)の分だけ大きくなる。
- PowerPoint の書き出し(`lib/pptx/bands.ts`)は対象外(第 1 版は未対応のエラー、または絵として扱う。U1 で今の挙動を確かめて決める)。
- golden の例(`examples/`)に 2 つ足す(1×4 と 2×2)。既存の図の出力は変わらない。
- 描画は決定的(測定を整数 px に丸める)。ただし、ブラウザと Node で字形が違えば、ふきだしの幅は違いうる(丸めで、同じ字形の測定の誤差は吸収した)。

## 実装計画

どの単位も、`main` に入れる PR を 1 つとし、Opus のレビューで Blocker と Major がなくなってから入れる(ADR 0073 と同じ)。

### U1: `comic()` と `bubble()`

- 範囲: 1×4 と 2×2 の割り、枠・溝・番号、舞台の置き方、ふきだし 4 種(`say` / `think` / `shout` / `narration`)、しっぽ、横書き、D2 の大きさの規則(穴は 1 つの塊として扱う前提。穴の描画は U3)。顔はまず丸だけの仮でよい(U2 で置き換える)。
- 完了の基準: (1) 4 コマ・ふきだし 6 個の図が、Node とブラウザ入口で同じ SVG になる(測定を整数 px に丸める)。(2) 台詞のテキストだけを変えても、コマ・人物の位置が変わらない。(3) `bunsetsu` と `phrase` を比べ、語の途中の改行が最少のものを既定にする(結果をこの ADR に追記)。(4) `PowerPoint` の挙動を確かめて、影響の節を埋める。
- テスト: 配置の golden(2 種)、`wrapStyledAtoms` に穴の塊を渡したときの行の分け、ふきだしの箱が 4px の格子に乗る、しっぽの向きの角度(口へ 10° 以内)、`test/web-entry.test.ts` と同じ「`node:*` に届かない」の束ね確認。

### U2: 顔と素材の形

- 範囲: パラメトリックな顔(8 表情、髪型 2 種、色相)、`character.json` の型と読み込み、`character.use(manifest)`、断片の掃除(`glyphFromBody` の再利用)、アンカー。
- 完了の基準: 8 表情が描ける。同じ入力は同じ SVG。manifest の素材に差し替えても、コマ・ふきだしの配置が変わらない(アンカーだけで決まる)。`license` が無いと止まる。
- テスト: 表情ごとの golden、素材の掃除(外部参照や `script` を落とす)、アンカーの倍率、ライセンス欠落。

### U3: 穴、幾何の地図、文字だけの再描画

- 範囲: `{id}` の解析(`{{` / `}}`)、3 状態の描き方、縮める・`slot-overflow`、`geometryOf`、`renderComic` の `geometry` と `update`、場面カードの縮小図。
- 完了の基準: **空・埋めた・飛ばし・長すぎるの 4 状態で、`geometry` が `deepEqual`**。`update` は値が変わった穴だけを測る(測定の呼び出しを数えるテスト)。地図は 12 穴で 4 KB 未満。`blank: 'line'` が案内を出さない。
- テスト: 4 状態の幾何の一致、`update` と `renderComic(values)` の SVG が同じ、測定回数、縮小図の `viewBox`。

### U4: Schema と検査

- 範囲: `schema/comic.schema.json` と `lib/schema-files.ts` への登録、`comic` を spec の部品に、D6 の検査の全部。
- 完了の基準: LLM が書いた場面(作り話の 3 例)が Schema と検査を通る。誤った例(穴が 3 個、`who` が舞台にいない、素材がない)が、期待の規則で止まる。`pnpm schema` のあとで `test/schema-files.test.ts` が通る。
- テスト: 正しい例と誤った例のそれぞれ、Schema(ajv)と CLI の判定の一致(ADR 0071 のやり方)、規則ごとの単体。

### U5: `chat()`

- 範囲: D7 の帯。`reserveDialogue` を U1 と共有する。
- 完了の基準: U1 と同じデータが、チャットでも描ける。穴の `Values` を共有しても幾何が動かない。吹き出しの幅が列の 70% を超えない。
- テスト: golden、同じ `Values` での穴の一致、長い台詞の折り返し。

### U6: Artifact の見本のテンプレート

- 範囲: `examples/artifact/comic-worksheet.html`(1 枚の HTML。`svg-diagram/browser` を jsDelivr から読み、カード選び → 4 コマ → 穴の入力(HTML の入力欄を `geometry` の位置に重ねる)→ SVG / PNG の保存)。`+esm`(1 リクエスト)と、版を固定した URL を使う。
- 完了の基準: headless Chromium(`browser-check.mjs` の方式)で、読み込み・描画・入力 → `update` → 保存まで通る。実際の Artifact の枠での動作を、人が 1 回確認する(Q7)。
- テスト: headless の通し(CI では任意。ネットワークが要る)、見本の HTML が `renderComic` の公開 API だけを使うこと。

## テスト方針

- 配置は純粋な関数にして、測定を関数で渡す(ADR 0045 D2 と同じ)。単体のテストは、固定の幅の測定(1 文字 = 全角 18px)で行い、フォントに依存しない。
- Node(HarfBuzz)とブラウザ(`svgMeasurer`)で同じ SVG になることを、スパイクの `run.ts` と `browser-check.mjs` の方式でテストに取り込む。
- 「穴を埋めても幾何が変わらない」は、状態の組(空・埋めた・飛ばし・長すぎる)ごとの `deepEqual` を、すべての golden で取る。

## 未決(決める人への質問。それぞれ推奨を付ける)

- **Q1. 第 1 版で縦書きのふきだしを出すか。** 推奨: 出さない(第 2 版)。横書きで穴埋めの価値は確かめられる。縦書きは `verticalColumns` を再利用できるが、右から左の読む順と、コマの並び(`dir: 'rtl'`)まで一緒に決めないと半端になる。型の予約(`writing`、`dir`)だけ第 1 版に入れる。
- **Q2. 簡単な顔が先か、絵師の素材が先か。** 推奨: 簡単な顔が先。絵師なしで決定的に動き、ライセンスの問題がなく、素材の形(D3)を実際の使い方で確かめられる。ただし見た目は粗い(スパイクの絵)。絵師の素材は、形が固まってから差し替える。D3 の差し替えの口で、検査と配置は変わらない。
- **Q3. Artifact の入力は HTML の入力欄を重ねるか、SVG の中で編集するか。** 推奨: HTML の入力欄を重ねる。日本語の IME(変換中の文字)は、SVG の `<text>` では扱えない。`geometry` の矩形に入力欄を置き、確定したら `update` を呼ぶ。SVG の中の編集は、IME・選択・スマホのキーボードで破綻する。
- **Q4. 幾何の地図と文字だけの再描画を公開 API にするか。** 推奨: 公開する(`svg-diagram/browser`、`@experimental`)。見本と実際の Artifact がどちらも使う。使わなくても動く(毎回 `renderComic`)ので、変更の被害は小さい。
- **Q5. 穴の幅の隙間をどう扱うか。** 推奨: 第 1 版は `max` を実際の長さに近づける(LLM に書かせる)。見た目が悪ければ、第 2 版で穴の後ろの文字を行の中で詰める(ふきだしの箱は動かさない)。
- **Q6. 印刷用の輪郭化をどの経路にするか。** 推奨: 第 1 版は MCP / Node の経路で作り、Artifact は生きた文字の SVG と canvas の PNG を出す。ブラウザで日本語の字形(opentype.js + woff のフォント)を持ち込めるかは、U6 のあとで別に測る。重い(数 MB)ので、既定にはしない。
- **Q7. 実際の Artifact の枠で、jsDelivr の `import()` が動くか。** headless Chromium では動いた(168 リクエスト、または `+esm` で 1 リクエスト)が、Artifact の枠の制限(CSP など)は確かめていない。推奨: U1 の前に、人が小さなページを 1 回公開して確かめる(動かなければ、`+esm` か、`<script type=module>` の形に変える)。
- **Q8(ほかに見つけたこと). 同じ文字の測定が 16 と 16.0156 に割れて、箱が 4px ずれる。** 推奨: D2 の 3 のとおり、原子の幅を整数 px に丸める。この丸めを、ほかの帯の箱にも広げるかは別の話(この ADR は `comic` / `chat` の中だけ)。
- **Q9(ほかに見つけたこと). 文字の最小の大きさ。** 既定の下限 14px が、ふきだしの縮める余地を決める(18px → 14px で 22%)。紙・スマホで読む用途なので、`canvas.minText` を 12 に下げて、縮める余地を広げる案もある。推奨: 下げない(読めない大きさのワークシートは意味がない)。値が長すぎるときは、入力欄の `max` で止める。

## スパイクの再現

```
node spikes/comic-worksheet/run.ts [outdir]        # Node(HarfBuzz)。3 状態の SVG の一致、地図の大きさ、検査
node spikes/comic-worksheet/browser-check.mjs      # headless Chromium。jsDelivr の 0.9.0、SVG → PNG(ネットワークが要る)
```

`spikes/comic-worksheet/out/` に、空の状態と埋めた状態の SVG を置いた(文字は生きたまま。Noto Sans JP で測った)。この ADR を採るなら、スパイクは U1 の PR で `lib/comic/` に置き換えて消す。
