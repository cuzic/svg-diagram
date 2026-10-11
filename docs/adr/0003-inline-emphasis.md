# ADR 0003: 箱の文字の一部だけを太字・色にする(部分強調)

- 状態: 提案(実装前)
- 日付: 2026-10-11
- 基点: 0.5.0 + ADR 0002 の実装(`main` = 0d59ae1 以降)
- 関連: ADR 0002 の「部分強調」(別 ADR が先と決めた項目)

## 背景

「Claude in Chrome」のように、箱の文章の中の一部だけを太字・色にしたい場面がある。今は 1 つの文字列(run)が 1 つの太さ・1 つの色しか持てないので、回避として run を分けて別の行にするか、強調をあきらめている。

## 既存コードで確認した事実

- 箱の文字は `TextRun`(`text, size, weight, mono, tone, indent, nowrap`、`lib/types.ts`)で、**run ごとに太さ 1 つ・色 1 つ**。`textRuns()`(`layout.ts:49`)が title / body / lines / note から作る。
- 幅の測定は atom 単位。`registerRequests`(`layout.ts:96`)が `(atom, size, weight, font)` をキーに集め、`layoutBoxContent`(`layout.ts:110`)が run の `weight` で `widthOf` を引いて `wrapAtoms` に渡す。**1 つの run の中で太さが変わる前提になっていない**。
- `wrapAtoms`(`wrap.ts`)は atom の配列を貪欲に折り返し、禁則(行頭禁止・行末禁止)を適用して **`string[]`(行ごとの文字列)** を返す。行は文字列なので、どこが強調かの情報は折り返しで失われる。
- 描画は `renderTextRuns`(`emit.ts:58`)で、1 行 = 1 つの `<text font-weight fill>`、中身は `emojiSpan(line)`。**絵文字用の `<tspan class="emoji">` が既にある**ので、`<tspan>` を使う描画の前例はある。
- 検査は `svg-lint.ts` → `svg-geom.ts` の `textBoxOf`(`svg-geom.ts:192`)。`<text>` の子の `<tspan>` を辿り、**run ごとに `r.style.fontWeight` / `fontSize` で測る**。したがって `<tspan font-weight="700">` で出した強調の幅は、描画後の検査(はみ出し・重なり・コントラスト)で正しく扱える。tspan の `fill` も `computeStyles` が継承・上書きを解決する(コントラストは文字の中心の背景で判定)。
- `budget.ts` の `displayWidth(r.text)`、`fit.ts` の最小サイズ、`verify.ts` の `nowrapOverflow` は run の `text` を文字列として使う。
- 表のセル(`seq-table.ts`)とワイヤーフレームの文字は別の描画経路で、`lines: string[]` を `textLines()` で出す。**本 ADR の範囲は box / banner / caption / group title(`renderTextRuns` を通るもの)**。

## 決定案

### 1. 記法: 文字列の中の最小のインライン記法

```ts
box({title: 'Claude in Chrome を使う', body: '**Claude in Chrome** だけが画面を操作できる'})
box({lines: [{text: '許可は {danger:ユーザー} が決める'}]})
```

- `**太字**`: その範囲を太字(700)にする。
- `{tone:文字}`: その範囲を `accent` / `danger` / `muted` / `text` の色にする。`tone` は `TextTone`(既存の 4 値)のみ。トークン外の色は書けない。
- 組み合わせは `**{danger:危険}**`(外側が太字、内側が色)の入れ子 1 段までを許す。
- エスケープ: `\*\*` と `\{` で文字そのものを出す。閉じていない記法(`**` が 1 個だけ、`{` が閉じない)は **エラー**(黙って文字として出すと、強調したつもりが出ない)。
- **記法が使われていない文字列は、今とまったく同じ出力**(既存の図の SVG は 1 バイトも変わらない)。`**` や `{` を含む既存の文字列(コード例など)は影響を受けうるので、後述の移行を決める。
- 代案(オブジェクト配列 `[{text:'a'},{text:'b', bold:true}]`)は型で安全だが、書きにくく、`title` / `body` / `note` / 表のセルに一貫して足すと API が膨らむ。まず文字列記法を採り、必要なら配列形を後から足せる(内部は同じ構造に落とす)。

### 2. 内部表現: span 付きの run

`TextRun` に任意の `spans?: {text: string; bold?: boolean; tone?: TextTone}[]` を足す(`text` は記法を除いた**平文**のままにする)。

- `text`(平文)を持ち続けるので、`budget.ts` の `displayWidth`、`verify`/`rules` の文字列検査、既存のテストは変えない。
- span が無い run は今の経路そのまま。
- span の範囲は平文上の文字オフセット `[start, end)` で持つ(`spans` は区間の配列、重ならない・順序どおり)。

### 3. 測定と折り返し

- `registerRequests` は、強調範囲の atom を **太字の weight で別に** 登録する(キーが `(atom, size, 700, font)` になるので既存と衝突しない)。
- `layoutBoxContent` は atom ごとに、その atom がどの span に属するかで `weight` を選んで `widthOf` を引く。`wrapAtoms` は `atomWidth(atom)` を受け取る形なので、**atom → 幅の関数に「位置」を渡せるようにする**(atom のインデックスで span を引く)。`wrapAtoms` のシグネチャは `atomWidth(atom, index)` のように後方互換で拡張する。
- `wrapAtoms` は行を `string[]` で返しており、折り返し後に span を引き継げない。**行ごとの atom 配列(`string[][]`)を返す内部版を足し**、既存の `wrapAtoms` はそれを `join` する薄い包みにする。内部版では各行の先頭 atom の平文オフセットを持たせ、span を行ごとに切り出す(`lineSpans: Span[][]`)。
- 禁則処理は平文上で働くので、強調の境界で挙動が変わらない。強調の途中で行が切れる場合は、その行の範囲に切り出す。
- `nowrap` の run(stat の値)に span を付けた場合は、そのまま 1 行で出す。

### 4. 描画

`renderTextRuns` で、span のある行は `<text>` の中を `<tspan>` に分ける:

```xml
<text x=".." y=".." font-size="14" font-weight="400" fill="#..">
  <tspan>許可は </tspan><tspan font-weight="700" fill="#..">ユーザー</tspan><tspan> が決める</tspan>
</text>
```

- 強調のない範囲も `<tspan>` で出さず、地の文字のまま(`<text>` 直下のテキストノード)にして、`<tspan>` の数を最小にする。
- **`xml:space="preserve"`**: 範囲の境目の空白が `textBoxOf` の正規化(`norm`)で落ちて幅が合わなくなるのを避けるため、span のある `<text>` は `xml:space="preserve"` を付ける(`measure.ts` の測定用 `<text>` と同じ扱い)。
- 絵文字の `<tspan class="emoji">` とは入れ子にしない。強調の範囲に絵文字が含まれる場合は、絵文字を外へ出して(`emojiSpan` を各断片に適用する形で)出力する。
- `dim`(spotlight)のときは、強調の色も `muted` に寄せる(色の強調は dim 下で無効)。太字は残す。
- 色の強調は **色だけに頼らない原則**に反しないよう、`danger` / `accent` の強調は太字を伴うことを推奨する(強制はしないが、`rules` の warn に「色だけの強調」を足す案を未決とする)。

### 5. 検査

- `svg-lint` は `<tspan>` の太さ・色を既に解決する(上記)。コントラストは強調色 × 箱の塗りで評価される。
- `verify.ts` / `rules.ts` のコントラスト検査(laidOut の tone から色を引く)は run 単位なので、**span の色も同じ規則で検査する**ように足す(span の `tone` と箱の背景)。
- `nowrapOverflow`(stat の値)は、span の太さも含めた幅で判定する。

### 6. 範囲と段階

1. `box` の `title` / `body` / `lines` / `note` と `banner` の `headline` / `sub`、`caption`(= `renderTextRuns` を通るもの)。
2. 表のセル・シーケンス図・ワイヤーフレームは後続(別経路で、`lines: string[]`)。必要なら続きの ADR。
3. 記法をエスケープなしで使っている既存の文字列(`**` や `{tone:` を含むもの)があるか、`examples/` と README を grep して確認し、あれば移行の注記を書く。

## 検討した代替案

| 案 | 判断 |
|---|---|
| オブジェクト配列(`[{text, bold, tone}]`)を主にする | 型は安全だが、title / body / note / セルすべてに足すと API が膨らむ。内部表現として採り、文字列記法が入口 |
| Markdown の全記法(斜体・リンク・コード) | 範囲が広すぎる。太字と色の 2 つに絞る(色は `TextTone` のみ) |
| 強調を run の別の行にする(現状の回避策) | 折り返しの途中で強調できず、行が増える。不採用 |
| 強調を SVG の後処理で `<tspan>` に分ける | 幅の測定(折り返し)が太字を知らないので、はみ出す。レイアウト側で扱う必要がある |
| 任意の色(`#rrggbb`)を許す | トークン外の色は lint が落とす。`TextTone` に限る |
| 記法が壊れていても文字としてそのまま出す | 強調したつもりが出ないのを黙って通す。エラーにする |

## 実装順と受け入れ条件

1. `wrapAtoms` の内部版(行ごとの atom 配列)と、`atomWidth(atom, index)` の拡張。既存の `wrapAtoms` の出力は不変(既存テスト + golden)。
2. 記法のパーサ(平文 + span の区間)とエラー規則、`TextRun.spans`。
3. `registerRequests` / `layoutBoxContent` の太字測定、`renderTextRuns` の `<tspan>` 出力、`xml:space`。
4. `verify` / `rules` の span コントラスト、dim の扱い。
5. examples と README(強調の例、エスケープ、エラー)。

どの段階でも `pnpm test` / `pnpm typecheck` / `pnpm golden` を通し、**記法を使わない図の出力は 1 バイトも変えない**。レビューでは、太字で幅が増えて折り返しが変わる箱が、描画後の lint(はみ出し)を通ることを必ず確かめる。

## 影響とリスク

- 良い点: 「Claude in Chrome だけ強調」のような場面が、文字列の中で書ける。検査の側(`svg-lint`)は `<tspan>` に既に対応しており、描画後の検査を新設しなくてよい。
- リスク:
  - `wrapAtoms` の拡張が、折り返し全体(禁則を含む)に触る。内部版を足して既存の関数を包みに変える形で、既存の出力を守る。
  - 太字の幅は等幅でないので、強調で行が増える(箱が高くなる)。レイアウトで吸収されるが、row の高さ揃えに影響する。
  - 記法の `**` / `{` が既存の文字列と衝突しうる(コード例など)。エスケープと移行の確認が要る。
  - tspan 境界の空白の扱い(`xml:space="preserve"`)を間違えると、測定と描画で幅が合わない。
- 未決: 色だけの強調に対する warn(太字の併用を促すか)、表のセル・ワイヤーフレームへの拡張、`{tone:..}` の記号(`{danger:..}` は JSON 風で目立つ。`[[danger|..]]` 等との比較)。
