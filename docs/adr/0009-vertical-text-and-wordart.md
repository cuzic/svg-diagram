# ADR 0009: 縦書きとワードアート(太字・縁取り・影)を `wordart()` として足す

- 状態: 実装済み(改訂 2: Word のワードアートの機能一覧に合わせて、塗り・光彩・反射・面取り・立体・弧・回転・反転・フォントを追加)
- 日付: 2026-10-13
- 基点: `main`(4e58744)
- 関連: ADR 0003(部分強調: 太字・色は既にある)、ADR 0007(中核は純粋、状態は値)

## 背景

見出し・表紙・縦長の帯のラベルで、(1) 縦書き、(2) 太字・縁取り・影のついた「飾り文字」を使いたい。今あるのは、箱の文字の太字(`em.b()`、`line.bold`)と色(`TextTone`)だけで、縦書きも、縁取りや影もない。

## 既存コードで確認した事実

- 文字は band ごとに「測る文字の登録(`*Texts()`)→ 配置(`layout*`)→ 描画(`render*`)」の 3 段で、登録していない atom は幅 0(strict-width のテストは throw)。自己配置の band(flow-shapes など)はこの 3 点セットを 1 ファイルに持ち、`layout.ts` / `emit.ts` / `verify.ts` / `fit.ts` / `spotlight.ts` に名前を足して接続する。
- 色は token(`TextTone` / `ColorKey`)だけ。生の色を許さない(`lint` の off-token-color)。
- lint(`svg-lint.ts` / `lint-browser.ts`)は `<text>` の `fill` と背景の輝度差(< 70 で指摘)、`<text>` どうしの重なり(> 0.3)を見る。
- 箱の文字は折り返し(`wrapText`)で、行は水平方向だけを前提にしている(`textRuns` → `WrappedRun`)。

## 決定

### 1. 箱の文字ではなく、独立した band `wordart()` にする

縦書きは箱の折り返し・測定・アイコン・step バッジの前提(水平 1 方向)を全部ひっくり返すので、`box({writing})` には載せない。**`wordart(text, opts)` という 1 つの自己配置 band** にして、水平でも縦でも同じ飾りを使えるようにする。箱の中の縦書き(`box({writing: 'vertical'})`)は、この ADR の純粋な部品(`verticalColumns`)を使って後から足せる(別 ADR)。

```ts
wordart('新製品発表', {style: 'sticker', writing: 'vertical', size: 'display', tone: 'accent'})
wordart('SALE', {weight: 'bold', outline: {tone: 'text'}, shadow: true})
```

### 2. 飾りは「見た目の仕様(値)」と「描画」に分ける

- `WordArtStyle = {weight, tone, outline, shadow, spacing}` は**ただの値**。`style: 'plain' | 'bold' | 'outline' | 'shadow' | 'sticker'` は、この値を返す表(`PRESETS`)で、個別のオプションが上書きする。`resolveLook(opts)` は純粋で、プリセット → 個別指定の順に解決する。
- 色は `ArtTone = TextTone | 'bg' | 'soft'`(= token の鍵)だけ。生の色は持たない(token 外の色は lint が拒否するため)。グラデーションは token 2 色の線形で、座標は図の座標系(userSpaceOnUse)なので、縦書きの列や回した図でも 1 本につながる。
- 縁取りは `outline: boolean | {tone?, width?} | {tone?, width?}[]`。配列は内側から外側への二重・三重の縁取り。幅は px。
- 影は `shadow: boolean | {tone?, dx?, dy?}`。ぼかしのないずらし影(フィルタは resvg と Chromium で差が出るので使わない)。
- 文字の下に敷く板 `plate`(token)。縁取り・塗りが背景と同色(白抜き)のときの「背景」になる。

### 3. 縁取りの描き方

- 一番内側の縁取りは、本物の `<text>` の `stroke` + `paint-order="stroke"`(`stroke-width` は幅の 2 倍。外側半分だけが見える)。
- 外側の縁取りと影は、同じ文字の**複製 `<text aria-hidden="true">`** を先に描く(外側 → 内側 → 影は一番下)。本物の `<text>` は 1 つだけなので、読み上げ・コピーは 1 回。
- lint は `aria-hidden="true"` の `<text>` を装飾として、コントラスト・文字の重なり・はみ出しの検査から外す。縁取り付きの本物の `<text>` は、`fill` と `stroke` のどちらかが背景と輝度差 70 以上なら通す(白抜き文字 + 濃い縁取りが通る)。

### 4. 読めるかの検査(`verify.ts`)

`legible(look, backdrop)`: 文字の塗りと背景(板があれば板、なければ紙)の比が 3:1 以上、**または**(塗りと一番内側の縁取りが 3:1 以上、かつ一番外側の縁取りと背景が 3:1 以上)。満たさない指定は `verifyDiagram` が問題にする(影は装飾なので見ない)。

### 5. 縦書きの組み方(`verticalColumns`、純粋関数)

SVG の `writing-mode` は resvg と Chromium で差が出るので使わず、**1 文字ずつ位置を決めて**描く。

- 列は右から左へ、行送り `size × 1.4`。1 文字の送り幅 = `size`(全角)。`\n` で列を替える。`height`(px)を指定すると、それを超える手前で列を替える(禁則: 行頭に来てはいけない `、。，．）」』】〕！？ー ぁぃぅぇぉっゃゅょ…` は前の列に残す(ぶら下げ)、行末に来てはいけない開き括弧は次の列へ送る)。
- 句読点 `、。，．` は右上へ寄せる、小書きのかな(`ぁっゃ` など)は右上へ少し寄せる。
- 長音・ダッシュ・波ダッシュ・括弧(`ー ― … ～ （）「」『』【】〔〕`)は 90° 回転(縦組みの字形)。
- 半角の英数字: 1〜2 桁の数字だけの連なりは縦中横(正立、横並びで 1 マス)、それ以外の英数字の連なりは 1 まとまりで 90° 回転(右へ倒す)。回転する連なりの高さは測定幅(`widthOf`)。縦中横は幅が 1 マスに収まらなければ回転に回す。
- 直立の文字は列ごとに 1 つの `<text>`(各文字が `<tspan x y>`)で、`text-anchor="middle"` でマスの中央に置く。回転する連なりは別の `<text transform="rotate(90 cx cy)">`。

### 6. 接続点

`type: 'wordart'` を、flow-shapes と同じ場所に足す(`layout.ts` の登録と配置、`emit.ts`、`verify.ts`、`fit.ts` の最小文字サイズ、`spotlight.ts`、`rules.ts` の図の説明、`types.ts` の `Band` / `LaidOutBand`)。`id` を持てば anchor になり、`connect()` / spotlight / reveal の対象になる。

## しないこと

- 箱・表・swimlane の文字の縦書き(別 ADR)。
- ぼかしフィルタ・遠近のある 3-D 回転(描画器の差を持ち込むため)。

## 改訂 2: 追加した機能と、そのための設計

「描く層」を**純粋な関数 `paintLayers(art, theme)`**(下から: 鏡像 → 影 → 光彩(半透明の縁を 4 重) → 立体(斜めに最大 12 枚) → 外側の縁取り → 面取り(明暗のずらし) → 本文)にした。emit は層を順に描くだけで、「どれが装飾か」(`hidden`)・「どれが本文か」(`text`)・「鏡像か」(`mirror`)は層が持つ。ぼかしフィルタは使わない(光彩は重ねた縁で作る)。

- **塗り**: `tone: 'none'` は中抜き(縁取り自体が文字。縁取りがなければ検査が止める)。`gradient` は 2 色。読めるかの検査は、グラデーションの両端の色すべてで見る。
- **弧(`arc`)**: 1 文字ずつ弧の上に置く(`<tspan x y rotate>` を 1 つの `<text>` に)。内側で文字が詰まる曲げ(内縁の半径が元の 70% 未満)は throw。
- **回転・反転**: 図全体の変換。帯の矩形は回した図の外接箱で、図そのもの(`local`)はその中央にある。lint-svg は `<g transform>` を勧めないので、変換は**各 `<text>` が自分の `transform` として持つ**(鏡像の反転行列も同じ)。グラデーションとクリップは userSpaceOnUse なので、変換と一緒に動く。
- **反射**: 最後の基線で反転した複製を `gap` だけ離して置き、`clipPath` で上から 60% だけ残す。透明度は `opacity`。帯の高さがその分増える。
- `uid`(`wa<x>-<y>`)が、グラデーション・クリップの id になる(同じ図の中で帯ごとに一意)。

## 改訂 3: ファイルの分け方

1 ファイル 520 行に混ざっていた関心事を分けた(出力は 1 バイトも変わらない: golden と全テストで確認)。

- `wordart-types.ts` 型と、アイテムを動かす `translateItem`(影・光彩の複製も配置も、これ 1 つで動かす)。
- `wordart-look.ts` プリセット(値)・`resolveLook`・読めるかの検査・描く層(`paintLayers`)。
- `wordart-vertical.ts` 縦組み(分割・禁則・列)。縦中横が 1 マスに入らないかどうかは、ここで決めて `side` に倒す(配置側は判断しない)。
- `wordart-layout.ts` 測るもの(`wordArtTexts`)と配置。組み方ごとの `setArc` / `setVertical` / `setHorizontal` が、図の左上を原点にした `Figure` を返し、`layoutWordArt` が余白・反射・回転・位置づけだけをする。
- `wordart.ts` コンストラクタ(検査は `check(名前, 値, 述語, 説明)` の表)と、上の再エクスポート。外からは今までどおり `./wordart.ts` だけを import する。
