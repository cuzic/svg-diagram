# ADR 0082: 横の `chevron` を 2 段以上に折り返す

- 状態: **承認**（Opus レビュー round 1 の B1・M1〜M3・m1〜m7・n1〜n3、round 2 の M4・m8〜m10・n4〜n8、round 3 の m11・m12・n9・n10 を反映。round 3 で Blocker・Major なし（収束））。依頼はオーナー了承済み
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
/** 横の chevron を何段に折り返すか（ADR 0082）。'auto' はどの step の文字も折れない最少の段数（D3）。既定 1（今の振る舞い） */
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
  - `rows` が 1 以上の整数でも `'auto'` でもない。`0`、`1.5`、`NaN`、`'foo'` などが該当する（m10）。
  - `perRow` が 1 以上の整数でない。`0`、`1.5`、`NaN` などが該当する。
  - `direction: 'vertical'` と、`rows` か `perRow` を一緒に指定した。直し方: 「縦の chevron は折り返さない。横にして `rows` を使う」。
  - `loopBack` と、2 段以上になりうる指定を一緒に指定した（D5）。どの指定が該当するか:
    - `rows: 'auto'`
    - 2 以上の `rows`
    - `n` 未満の `perRow`
    - step が 2 つしかなく、実際には必ず 1 段になる場合も throw する。配置の前には段数を決めないので、判定を単純にするため（n8）。
  - この組み合わせの判定は、配置の前に `chevronBand` で行う。`loopBack` の線は配置の前に作られるため（`lib/core.ts:159-169`）。
- **1 段になる指定:** `rows: 1` と `perRow >= n`。どちらも、指定しないときと同じ出力になる（D8）。
  - `rows >= n` は 1 段にならない。`perRow` が 1 になり、n 段に積まれる。
- **`perRow: 1` は許す。** 縦に積んだ横向きの矢羽根になり、`vertical` とは形が違う。
- **`current` / `highlight` / `focus` / `tone` / `first` / `gap` / `id` / `scope` / `reveal` / `until` は変えない。** `current` は DSL では今と同じ 0 起点、JSON spec では 1 起点（ADR 0051）。

### D2. 形: 揃った幅と左寄せ

`layoutChevron` の横の分岐を、段のある形に一般化する。`rows = 1` のときの計算は、今の式と同じになるように書く。

- **列数:** `cols = min(perRow, n)`。
- **矢羽根の幅:** `cellW = (out.w - gap*(cols-1)) / cols`。すべての段で同じ（依頼 1）。
- **矢の深さ** `tip = min(22, cellW/4)` と**文字の幅** `textW` は、今の式のままで `cellW` から決める。
- **高さ:** `cellH` は**全段で 1 つ**。全段のうち最も高い文字ブロックで決め、式は今の `max(60, 最大の文字高 + 20)` のまま。段ごとに高さが違うと、続きの印（D4）の長さが段ごとに変わり、見た目が揃わないため。
- **段の間:** `rowGap = 40`（4px グリッドの倍数。m1）。続きの印の横線は段の間の真ん中を通る。
- **位置:** `i` 番目の段 `row = floor(i/cols)`、列 `col = i - row*cols`。
  - `xx = out.x + col*(cellW+gap)`。**左寄せ**なので、最後の段が短くても `col` は 0 から始まる。
  - `yy = out.y + row*(cellH + rowGap)`。
  - `out.h = rows*cellH + (rows-1)*rowGap`。
- **切り込み**（左の notch）は今と同じく `i > 0 || first === 'chevron'` で付く。2 段目以降の先頭にも切り込みが付き、前から続いていることが形にも出る。
- **アンカー**（`connect()` の接続先）は、今と同じく各矢羽根の外接矩形。

### D3. `rows: 'auto'`

- **段数の候補:** `r = minR, …, maxR`。`minR = ceil(n/8)` にして、1 段に 9 つ以上並ぶ形を候補から外す（m11。D7 で spec が 1 段の 9 つ以上を断るのと揃える）。
  - `maxR = max(minR, min(4, floor(n/3)))` にする。1 段にほぼ 3 つ以上並ぶ形だけを候補にする（m8）。
  - 例: 7 つなら `maxR` は 2（4 + 3）。12 なら 4。5 つ以下なら 1 で、`'auto'` は折り返さない。
- **「余分な行」と「折れない」の定義:** 余分な行 = `max(0, t.wrap(text, textW) の行数 − 文中の明示の \n で分けた行の数)`。余分な行が 0 なら「折れない」（`lib/wrap.ts:80`）。
  - `max(0, …)` にするのは、末尾が `\n` の文で `wrapText` の行数が分けた数より少なくなるため（m12）。
  - 明示の `\n` を含むラベルも、それ以上に折れなければ「折れない」と数える。
  - ラベルは `t.wrap(label, textW)` で、`sub` は `t.wrap(sub, textW, 400)` で測る。
- **選び方:** 次の 3 段階で決め、各段階で条件を満たす最初の `r` を使う。`textW` は、各 `r` で `perRow = ceil(n/r)` から D2 の式で求める。
  1. すべての step で、ラベルも `sub` も折れない `r`（M3）。
  2. 1 が無ければ、すべての step で、ラベルが折れず、`sub` の余分な行が 1 行以下の `r`（m8）。
  3. 2 も無ければ、step ごとの「ラベルと `sub` を合わせた行数」の最大が最も小さい `r`。同じなら小さい `r` を選ぶ。throw はしない。語が途中で割れていれば、既存の `text-mid-word-break` が知らせる。
- **`sub` も見る理由:** 背景の困りごとは、ラベルより `sub` が 2〜3 行に折れることにある。試しでは、幅 940 に 7 つ並べると、5 字のラベルは 1 行に収まるのに、7 字の `sub` は 2 行に折れた。
- **試しの結果（round 2）:** 7 つ、5 字のラベル、8 字の `sub` で、幅 940・1200・スライドのいずれでも 2 段（4 + 3）を選んだ。
- **U2 のテストで期待する値（n10）:** 7 つ、5 字のラベル。`maxR` は 2 なので、選ばれる `r` は 1 か 2。
  | `sub` の字数 | 幅 | 選ぶ `r` |
  |---|---|---|
  | 8 | 940 / 1200 / スライド | 2 |
  | 12 | 940 | 2（段階 1） |
  | 16 | 940 / スライド | 2（段階 2 か 3） |
  - 12 字の `sub` をスライドの幅に並べた場合は、実装の試しで確かめてテストに書く。
- **計算の方法:** `t.wrap` は何度呼んでも出力に何も足さない（round 1 の試しで確認）。計算は `layoutChevron` の中で閉じる。
- **出力:** `'auto'` で 1 段に決まったときは、指定しないときと同じ出力になる（D8）。
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
- **座標の丸め:** 4 点とも整数に丸める（`Math.round`）。
- **描く順:** 線の primitive は、すべての矢羽根の後に積む。矢じりが次の段の枠の下に隠れないようにするため（m3）。
- **線の描き方:** 既存の `{k: 'path', d, tone: 'text', arrow: true, thin: true}` の primitive を使う（`lib/flow-types.ts:66`）。
  - 色は `text` にする。矢じりの marker `dsl-arrow` は `PALETTE.text` で塗られる（`lib/emit-svg-core.ts:50`、n7）ので、線と矢じりの色が揃う（m2）。
  - SVG は `<path … fill="none" stroke=… stroke-width="1.5" marker-end="url(#dsl-arrow)">` になる（`lib/emit-flow-shape.ts:34`）。
  - 帯が暗くなるとき（spotlight）は、既存の分岐で `dsl-arrow-dim` になる。
  - PPTX は既存の `freeformPathXml` の線と矢じりになる（`lib/pptx/flow.ts` の path の分岐）。**新しい種類の primitive は足さない。**
  - **marker の宣言（B1）:** chevron の帯の定義（`lib/bands/chevron.ts`）に `svgDefs` の hook を足す。
    - 中身は `concentric` と同じ `laid => ({arrow: laid.primitives.some(p => p.k === 'path' && !!p.arrow)})`（`lib/bands/concentric.ts:24`）。
    - これがないと `<defs>` に `dsl-arrow` が出ず、`undefined-marker` で build が落ちる。
    - 1 段の chevron は path を持たないので、`<defs>` は今と同じになる（round 1 の試しで、バイト同一を確認）。
- **`data-node` は付けない。** この線は項目ではないため。
- **印を消す指定は今回は作らない。** 要るとわかったら `continuation: false` を足す。
- **段の間 `rowGap` と線:**
  - 線は細い（1.5）。矢じりは既存の marker の大きさで、長さはおよそ 10.5px。
  - `rowGap = 40` なら、下りる線と最後の縦線はそれぞれ 20px になり、矢じりを除いても 9px 以上の線が見える。
  - round 1 の試しでは、32px のとき最後の縦線は約 6.5px しか見えなかった（m1）。
- **重なりの検査（m5）:** 続きの線は、重なりの検査の対象にしない。`connect()` の線がこの線を横切っても、検査は知らせない。ここは既知の限界として受け入れる。続きの線は段の間だけを通り、項目へ向かう `connect()` が段の間を横に走ることは少ないため。

### D5. 一段を前提にしている機能との関係

| 機能 | 折り返した chevron での扱い |
|---|---|
| `current` / `highlight` / `focus` / step の `tone` | 変えない。どの段の step にも効く。 |
| `connect()` で step につなぐ | 変えない。アンカーは各矢羽根の矩形。矢羽根との重なりは既存の検査が見る。続きの線との交差は見ない（D4、n6）。 |
| `loopBack`（ADR 0029 D4） | **2 段以上になりうる指定と一緒なら、`chevronBand` で throw する（D1、M2）。** `loop-under` の線は 2 つのアンカーのうち下の方の下を通る（`lib/layout-connect.ts:82-84`）。別の段の間で引くと、下の段の矢羽根を横切る。エラー文の直し方: 「`loopBack` を外すか、`rows` / `perRow` を外す」。 |
| 木の帯ノードの `from`（ADR 0049） | **制限しない（M1）。** funnel の線は指した step の高さからではなく、親の帯の端（下向きの木なら下端、上向きなら上端）から出る（`lib/layout-tree.ts:105`、`:108`）。そのため、どの段の step を指しても何も横切らない。<br>残る問題は見た目だけ: 帯の端から遠い段の step を指すと、線が近い段の step の下（上）から出て、どの step から出ているかが紛れる。ここは README に書く。 |
| `reveal` / `until` | 帯の単位のまま。変えない。 |
| `fit-width`（`lib/layout-fit-width.ts`） | 多角形と文字の和で幅を測る（`:39`）。続きの線は測らない。線は矢羽根の x の範囲の内側だけを通るので、幅は変わらない（m4）。 |
| `text-mid-word-break` の直し方の文（`lib/mid-word-findings.ts:10`） | chevron の文を次に変える: 「矢羽根の幅は 1 段に並ぶ数で決まる。`rows` / `perRow` で 1 段の数を減らす（`'auto'` も使える）、`direction: 'vertical'` にする、文言を短くする」（n3）。 |
| `diagram-summary`（`<desc>`） | 変えない。 |

### D6. SVG に新しく出るもの

段が 1 つのときは、何も変わらない。段が 2 つ以上のときは、次のものが増える。

- **`<path>`:** 続きの線 1 本につき 1 つ。
  - 属性は `d`、`fill="none"`、`stroke`（`#rrggbb`。`text` の色）、`stroke-width="1.5"`、`marker-end="url(#dsl-arrow)"`、暗くなる帯では `url(#dsl-arrow-dim)`。
  - これらの属性と値は、どれも今の帯や connector が既に出しているもの。
  - ただし、帯の中で「細い線（1.5）と矢じり」を組み合わせて出すのは新しい（n5）。許可リストは要素と属性の値で見るので、影響はない。
- **新しい要素名と属性名:** なし。
- **`<defs>` の矢じり:** 今の図で矢じりが使われていないときは、`<defs>` と `dsl-arrow` の marker が新しく出る。D4 の `svgDefs` hook が出させる。

### D7. JSON spec

`lib/spec-parts/chevron.ts` を次のように変える。spec の description と issue のメッセージは、今ある spec の文に合わせて英語で書く（m9）。

- **`steps`:** `flowSteps(2, 8)` を `flowSteps(2, 12)` にする。
- **`rows`:** 整数 1〜4 か `'auto'`（M4）。
  - 書き方は、リポジトリで既に使っている形にする（pareto の `guide`、value chain の `margin`）: `{oneOf: [{type: 'integer', minimum: 1, maximum: 4}, {type: 'string', enum: ['auto']}]}`。
  - `anyOf` と `const` は使わない。`JsonSchema` の型に `anyOf` が無く、spec の検査も `anyOf` を見ないため。
  - テスト: `'foo'`、`9`、`1.5` が spec の検査で issue になること。
  - description: `"Wrap a horizontal chevron onto this many rows. 'auto': the fewest rows (up to 4) where no step's text wraps."`
- **`perRow`:** 整数 1〜8。1 段に 9 つ以上並べる指定は、schema の段階で断る。
- **`current`:** `maximum` を 12 にする。
- **`check` で issue にするもの:**

  | 条件 | メッセージの中身 |
  |---|---|
  | `rows` と `perRow` を両方指定した | どちらか 1 つにする（このときは、下の「9 つ以上」の issue は出さない。n9） |
  | `rows` か `perRow` を `direction: 'vertical'` と一緒に指定した | 縦は折り返さない。横にするか、`rows` / `perRow` を外す |
  | `direction: 'vertical'` で、steps が 9 つ以上 | 縦の chevron は 8 つまで |
  | 横で、steps が 9 つ以上、かつ `rows` も `perRow` もない（または `rows: 1`） | `rows`（`'auto'` も可）か `perRow` で折り返す |

  - `rows: 'auto'` は issue にしない（m9）。
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
- **グループ:** 帯のグループの中に入る。名前は既存の path の分岐どおり `'line'`（n1）。
- **golden:** `pptx-golden.yml` はすべての例を回すので、新しい例のエントリは workflow を回せば出る。手で足すものはない（n2）。

## 実装の単位

| 単位 | 中身 | テスト |
|---|---|---|
| U1 | D1・D2・D4・D5・D8（DSL、レイアウト、続きの線、throw、エラー文、`mid-word` の文）。例 `examples/chevron-rows.ts`（7 つを `rows: 2`、`current` あり）。 | `test/chevron-rows.test.ts`。各段の `cellW` が同じこと、最後の段の左寄せ、線の 4 点の座標、throw の各ケース（`loopBack` との組み合わせを含む）、D8 のバイト同一、`current` / `tone` / `focus` が別の段で効くこと、`connect()` のアンカー、`svgDefs` で `<defs>` に marker が出ること、暗くなる帯で `dsl-arrow-dim` になること（n4）、上の段を指す木の `from` が throw しないこと。 |
| U2 | D3（`'auto'`） | 狭い幅で 2 段に、広い幅で 1 段（今と同じ出力）に決まること。sub だけが折れる場合に段を増やすこと（M3）。`maxR` と、収まらないときの選び方。 |
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
