# ADR 0082: 横の `chevron` を 2 段以上に折り返す

- 状態: **提案**（Opus レビュー前）
- 日付: 2026-11-26
- 基点: `main`（v0.10.0 の後）
- 関連: ADR 0029（D3 の矢羽根の幅、D4 の `loopBack`）、ADR 0049（帯のノードと `from`）、ADR 0051（`current` / `focus`）、ADR 0027 / 0054（PPTX）、ADR 0071（JSON Schema）、ADR 0080（帯の定義、D2b の `.type ===` ラチェット）
- 範囲外:
  - 縦の `chevron` の折り返し（縦の列を横に並べること）
  - 段の右寄せと中央寄せ
  - 段ごとに違う数を並べること（「4 と 3」は D1 の `perRow: 4` で表せる）
  - `valueChain` の折り返し（`valueChain` は `layoutChevron` を使わない）
- 例のデータはすべてダミー（「手順A」〜「手順G」、「説明の文」）

## 背景

16:9 のスライドで、横の `chevron` に手順を 7 つ並べたい。

**今の振る舞い:** 矢羽根の幅は `cellW = (out.w - gap*(n-1)) / n` で、段の数だけで決まる（`lib/flow-chevron.ts:32`）。
- 7 つでは 1 つの矢羽根が狭い。短いラベル（5〜6 字）が 2 行に、sub（8 字ほど）が 2〜3 行に折れる。
- 図は低く横長になり、スライドの上下が空く。
- `direction: 'vertical'` にすると、今度は縦に長すぎる。

**今の回避策:** `chevron` を 2 つに分けて縦に積む（4 と 3）。これには 2 つの問題が残る。
1. 段ごとに矢羽根の幅が違う。3 つの段の矢羽根は、4 つの段より横に長い。
2. 上の段の最後から下の段の最初へ続くことが、図に出ない。

**依頼された点:**
- 段数か、1 段あたりの数を指定して折り返す。自動でもよい。
- どの段も矢羽根の幅を揃え、最後の段が短ければ左寄せにする。
- 段の終わりから次の段の初めへ続く印を付ける。
- `current` と `tone` は今のまま使える。

**似た仕組み:** `emblem` は既に段に折り返している（`lib/flow-emblem.ts:82-96`）。
- `perRow = floor((w+gap)/(d+gap))`、`rows = ceil(n/perRow)` で、すべての段が同じ高さ。
- 段は**中央寄せ**で、続きの印はない。
- 本 ADR は計算の形（`perRow` / `rows` / `row` / `col`）だけを真似る。寄せ方は依頼に合わせて左寄せにする。

## 決定

### D1. 公開の指定: `rows` と `perRow`

`ChevronOpts`（`lib/flow-types.ts:7`）に次を足す。

```ts
/** 横の chevron を何段に折り返すか（ADR 0082）。'auto' はラベルが 1 行に収まる最少の段数（D3）。既定 1（今の振る舞い） */
rows?: number | 'auto';
/** 1 段に並べる数（ADR 0082）。rows とは一緒に使わない */
perRow?: number;
```

- **段数の決まり方:**
  - `perRow` を指定したとき: `perRow` をそのまま使い、段数は `ceil(n/perRow)`。
  - `rows: r`（数）を指定したとき: `perRow = ceil(n/r)` で、段数は `ceil(n/perRow)`。7 つを `rows: 2` にすると 4 + 3、8 つを `rows: 3` にすると 3 + 3 + 2。
  - 段数が `r` より少なくなることがある（例: 5 つを `rows: 4` にすると `perRow` は 2、段数は 3）。その場合も throw しない。
- **throw する指定**（エラー文は既存の `chevron(): …` の形。何が悪いかと直し方を 1 行で言う）:
  - `rows` と `perRow` を両方指定した。
  - `rows` が 1 未満の整数、または `'auto'` 以外の値。
  - `perRow` が 1 未満の整数。
  - `direction: 'vertical'` と、`rows` か `perRow` を一緒に指定した。直し方: 「縦の chevron は折り返さない。横にして `rows` を使う」。
- **1 段になる指定**は、指定しないときと同じ出力になる（D8）。`rows: 1`、`perRow >= n`、`rows >= n` で `perRow` が 1 になる場合は除く。
- **`perRow: 1` は許す。** 縦に積んだ横向きの矢羽根になり、`vertical` とは形が違う。
- **`current` / `highlight` / `focus` / `tone` / `first` / `gap` / `id` / `scope` / `reveal` / `until` は変えない。** `current` は DSL では今と同じ 0 起点、JSON spec では 1 起点（ADR 0051）。

### D2. 形: 揃った幅と左寄せ

`layoutChevron` の横の分岐を、段のある形に一般化する。`rows = 1` のときの計算は、今の式と同じになるように書く。

- **列数:** `cols = min(perRow, n)`。
- **矢羽根の幅:** `cellW = (out.w - gap*(cols-1)) / cols`。すべての段で同じ（依頼 1）。
- **矢の深さ** `tip = min(22, cellW/4)` と**文字の幅** `textW` は、今の式のままで `cellW` から決める。
- **高さ:** `cellH` は**全段で 1 つ**。全段のうち最も高い文字ブロックで決め、式は今の `max(60, 最大の文字高 + 20)` のまま。段ごとに高さが違うと、続きの印（D4）の長さが段ごとに変わり、見た目が揃わないため。
- **段の間:** `rowGap = 32`（4px グリッドの倍数）。続きの印の横線は段の間の真ん中を通る。
- **位置:** `i` 番目の段 `row = floor(i/cols)`、列 `col = i - row*cols`。
  - `xx = out.x + col*(cellW+gap)`。**左寄せ**なので、最後の段が短くても `col` は 0 から始まる。
  - `yy = out.y + row*(cellH + rowGap)`。
  - `out.h = rows*cellH + (rows-1)*rowGap`。
- **切り込み**（左の notch）は今と同じく `i > 0 || first === 'chevron'` で付く。2 段目以降の先頭にも切り込みが付き、前から続いていることが形にも出る。
- **アンカー**（`connect()` の接続先）は、今と同じく各矢羽根の外接矩形。

### D3. `rows: 'auto'`

- **段数の決め方:** `r = 1, 2, …, min(4, n)` の順に `perRow = ceil(n/r)` で D2 の `textW` を求める。**すべての step のラベル**が `t.wrap(label, textW)` で 1 行に収まる最初の `r` を使う。`sub` の行数は見ない。
- **どの `r` でも収まらないとき:** `r = min(4, n)` を使う。throw はしない。語が途中で割れていれば、既存の `text-mid-word-break` が知らせる。
- **計算の方法:** 測り直しはせず、既存の `Texts.wrap` を使う。計算は同じ `layoutChevron` の中で閉じる。
- **出力:** `'auto'` で 1 段に決まったときは、指定しないときと同じ出力になる（D8）。つまり `'auto'` は「狭ければ折り返す」の意味になる。
- **既定値にはしない。** 既定にすると、今ある図の出力が変わるため。

### D4. 続きの印

1 段目から最後の 1 つ前の段まで、各段の**最後の矢羽根**から**次の段の最初の矢羽根**へ、折れ線の矢印を 1 本引く。

- **線の形:** 4 点の折れ線。
  1. 始点: 段の最後の矢羽根の下辺の中点 `(xL + cellW/2, yy + cellH)`。
  2. 段の間の真ん中まで下りる `(xL + cellW/2, yMid)`。`yMid = yy + cellH + rowGap/2`。
  3. 次の段の先頭の中心まで左へ戻る `(xF + cellW/2, yMid)`。
  4. 終点: 次の段の先頭の矢羽根の上辺 `(xF + cellW/2, yy + cellH + rowGap)` で、ここに矢じりを付ける。
- **なぜこの形か:**
  - 段の間だけを通るので、矢羽根とも文字とも重ならない。
  - 右の外へ回る形（行末の右から出て、次の段の左へ入る）は図の幅をはみ出す。そのぶん `out.w` から余白を取ると全段の矢羽根が狭くなり、折り返した意味が薄れる。
- **線の描き方:** 既存の `{k: 'path', d, tone: 'muted', arrow: true, thin: true}` の primitive を使う（`lib/flow-types.ts:66`）。
  - SVG は `<path … fill="none" stroke=… stroke-width="1.5" marker-end="url(#dsl-arrow)">` になる（`lib/emit-flow-shape.ts:34`）。
  - 帯が暗くなるとき（spotlight）は、既存の分岐で `dsl-arrow-dim` になる。
  - PPTX は既存の `freeformPathXml` の線と矢じりになる（`lib/pptx/flow.ts` の path の分岐）。**新しい種類の primitive は足さない。**
- **`data-node` は付けない。** この線は項目ではないため。
- **印を消す指定は今回は作らない。** 要るとわかったら `continuation: false` を足す。
- **段の間 `rowGap` と線:** 線は細い（1.5）。矢じりは既存の marker の大きさになる。32px あれば、下りる線・横線・矢じりがそれぞれ 8px 以上の長さを取れる。この数字は試し（spike）で確かめてから決める。

### D5. 一段を前提にしている機能との関係

| 機能 | 折り返した chevron での扱い |
|---|---|
| `current` / `highlight` / `focus` / step の `tone` | 変えない。どの段の step にも効く。 |
| `connect()` で step につなぐ | 変えない。アンカーは各矢羽根の矩形。重なりは既存の検査が見る。 |
| `loopBack`（ADR 0029 D4） | **段が 2 以上なら throw する。** `loop-under` の線は 2 つのアンカーのうち下の方の下を通る（`lib/layout-connect.ts:82-84`）。別の段の間で引くと、下の段の矢羽根を横切る。エラー文の直し方: 「`loopBack` を外すか、1 段にする」。 |
| 木の帯ノードの `from`（ADR 0049） | **`from` に指せるのは最後の段の step だけ。** 線は帯全体の下辺から出る（`lib/layout-tree.ts:111`）。上の段の step から引くと、下の段を横切る。上の段を指したら throw する。エラー文の直し方: 「`from` に最後の段の step を指すか、`rows` を外す」。 |
| `reveal` / `until` | 帯の単位のまま。変えない。 |
| `fit-width`（`lib/layout-fit-width.ts`） | 多角形と文字の和で幅を測る。今の仕組みのまま、続きの線も含めて測る。 |
| `text-mid-word-break` の直し方の文（`lib/mid-word-findings.ts:10`） | chevron の文を次に変える: 「矢羽根の幅は 1 段に並ぶ数で決まる。`rows: 2`（か `'auto'`）で折り返す、`direction: 'vertical'` にする、文言を短くする」。 |
| `diagram-summary`（`<desc>`） | 変えない。 |

### D6. SVG に新しく出るもの

段が 1 つのときは、何も変わらない。段が 2 つ以上のときは、次のものが増える。

- **`<path>`:** 続きの線 1 本につき 1 つ。
  - 属性は `d`、`fill="none"`、`stroke`（`#rrggbb`）、`stroke-width="1.5"`、`marker-end="url(#dsl-arrow)"`、暗くなる帯では `url(#dsl-arrow-dim)`。
  - これらの属性と値は、どれも今の `cycle` などの帯が既に出しているもの。
- **新しい要素名と属性名:** なし。
- **`<defs>` の矢じり:** 今の図で矢じりが使われていないときは、`dsl-arrow` の marker が新しく出る。marker の出し方は既存の仕組みに従う。実装で、marker が `<defs>` に入ることを確かめる。

### D7. JSON spec

`lib/spec-parts/chevron.ts` を次のように変える。

- **`steps`:** `flowSteps(2, 8)` を `flowSteps(2, 12)` にする。
  - `check` で、9 つ以上を 1 段に並べる指定は issue にする。メッセージ: 「`rows` か `perRow` で折り返す」。
  - 9 つ以上で段の指定がないときは 1 段になり、矢羽根が狭すぎるため。
- **`rows`:** `oneOf` で、整数 1〜4 か `'auto'`。description: 「横の矢羽根を何段に折り返すか。'auto' はラベルが 1 行に収まる最少の段数」。
- **`perRow`:** 整数 1〜12。
- **`check` で issue にする組み合わせ:**
  - `rows` と `perRow` を両方指定した。
  - `rows` か `perRow` を `direction: 'vertical'` と一緒に指定した。
- **`current`:** `maximum` を 12 にする。
- **`build`:** 変えない（`rows` と `perRow` はそのまま DSL に渡す）。
- **生成物:** `pnpm schema` で作り直す。
- **バンドルの予算:** 予算（`scripts/check-package-bundles.ts`）は増えるかもしれない。増えたら、実装の PR で、測った値と小さな余裕を決める人に見せて承認を得る（ADR 0080 D12）。

### D8. バイト同一

次の指定では、SVG と PPTX の出力が今と同じバイト列になる。
- 指定しない
- `rows: 1`
- `perRow >= n`
- 1 段に決まった `'auto'`

**確かめ方:**
- 今ある `examples/out/` の golden が 1 バイトも変わらないこと。
- テストで、2 つの出力が同じ文字列になること。指定なしと `rows: 1`、指定なしと `perRow: n` で確かめる。

### D9. PPTX

- **矢羽根:** 今と同じ `polygonHolder`。座標をそのまま写す。
- **続きの線:** path の分岐で、`freeformPathXml` の矢じり付きの線になる。
- **グループ:** 帯のグループの中に入る。名前は既存の規則どおり、文字のない線の名前（`nameOf('line', …)`）。
- **golden:** `pptx-golden.yml` で新しい例のエントリを足す。

## 実装の単位

| 単位 | 中身 | テスト |
|---|---|---|
| U1 | D1・D2・D4・D5・D8（DSL、レイアウト、続きの線、throw、エラー文、`mid-word` の文）。例 `examples/chevron-rows.ts`（7 つを `rows: 2`、`current` あり）。 | `test/chevron-rows.test.ts`。各段の `cellW` が同じこと、最後の段の左寄せ、線の 4 点の座標、throw の各ケース、D8 のバイト同一、`current` / `tone` / `focus` が別の段で効くこと、`connect()` のアンカー、木の `from` の制限。 |
| U2 | D3（`'auto'`） | 狭い幅で 2 段に、広い幅で 1 段（今と同じ出力）に決まること。上限の 4 段。 |
| U3 | D7（spec、schema、予算） | `test/spec*.test.ts` に、エラーの path と、12 個の steps の例を足す。 |
| U4 | README の chevron の節、`skills/svg-diagram/references/*.md`、この ADR の状態の行 | — |

- **実装:** Sonnet のサブエージェントに任せる。Claude は設計とレビューをする（ADR 0081 と同じ分担）。
- **golden:** U1 で新しい例の SVG を足す。Docker で作り直す（`scripts/golden-docker.sh --write`）。
- **ラチェット:** `.type === 'chevron'` の新しい分岐は足さない（ADR 0080 D2b）。続きの線は `layoutChevron` が作る primitive なので、分岐は要らない。

## 考えて採らなかった案

- **段ごとに `chevron` を分けたまま、つなぐ線を `connect()` で引く:**
  - 矢羽根の幅が揃わない（依頼 1 が残る）。
  - 利用者が段の分け方を毎回計算することになる。
- **最後の段を中央寄せにする（`emblem` と同じ）:** 手順の流れでは、左から読み始めることがはっきりしている方が読みやすい。依頼もそう言っている。
- **折り返しで蛇行させる（2 段目を右から左へ並べる）:**
  - 矢羽根の向きを逆にすると、読む向きが段ごとに変わる。
  - PPTX で逆向きの矢羽根を足すことにもなる。
- **段ごとに高さを決める:** 続きの線の長さが段ごとに変わり、全体が揃って見えない。高さの差は小さく、1 つに揃える方が単純。
- **`rows` を既定で `'auto'` にする:** 今ある図の出力が変わる（D8 に反する）。
