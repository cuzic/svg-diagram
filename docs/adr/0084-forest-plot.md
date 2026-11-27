# ADR 0084: フォレストプロット（`forest()`）— 行ごとの点推定と区間を、基準の線（1 = 差がない）と数値の列といっしょに描く

- 状態: 承認(Accepted。2026-11-27。Q1〜Q8 は決める人がすべて推奨どおりに決定。U1 → U2 の順で実装する。**U1 実装中 (PR #506)**)
- 日付: 2026-11-26
- 基点: `main`（3c403fa3）
- 関連: ADR 0080（帯の定義 `BandDef`、tree shaking）、ADR 0054（PPTX の部品と名前）、ADR 0055 / 0060（デッキ、`fit`、9pt の警告）、ADR 0069（`partCatalog`）、ADR 0071（JSON Schema）
- 試し: ブランチ `spike/forest-plot`（67aab13e。マージしない。型の検査は通していない）。図と測った値は `spikes/forest-plot/`
- 範囲外: 数値の列を 2 つ以上（人数・重みの % など）、異質性の統計量（I²・p 値）の自動の文、予測区間、行ごとの色
- 例のデータはすべてこの ADR のための作り話（架空の学習アプリの試験を、架空の 10 会場で行ったときの、修了のオッズ比）

## 背景

研究の発表のデッキ（JSON の spec / `deck.json`）で、いちばん多く使う図がフォレストプロットである。要るものは次のとおり。

- 1 行に 1 つの研究（または群）。点推定（estimate）と区間（low, high）。
- 基準の縦線（既定 1 = 差がない）。比（オッズ比・ハザード比）では対数目盛。
- 群の見出しの行。右端に「1.54 (1.22–1.95)」の数値の列。軸の下に「← A が良い　B が良い →」の向きの注。
- 多くの図では、最後に統合した推定（ひし形）がある。

今の部品での代用には、それぞれ欠けるところがある。

| 代用 | 欠けるところ |
|---|---|
| `rangeBars` | 点が無い、基準の線が無い、対数目盛が無い、値が 0 以上に限られる、値の文字は「1.22〜1.95」 |
| 数値の `timeline` | ラベルが 2 重になる、文字が小さい |
| `tornado` | 凡例が「低ケース / 高ケース」に固定、棒は基準から伸びる（区間ではない） |

### 測ったこと（試し。`spikes/forest-plot/out/measurements.txt`）

`svg-diagram pptx-deck spikes/forest-plot/deck.json`（1280×720、`fit` は既定の `fill`）。試しはスライドの計画の `scale` と `minTextPt` を表示する。図の文字はすべて 14px（ラベル・数値・目盛・見出し・軸の題・向きの注）。

| スライド | 図の大きさ | 倍率 | いちばん小さい文字 | PNG の絵 |
|---|---|---|---|---|
| `forest-10`（10 行 + 見出し 2 + 統合 1、対数目盛、数値の列、向きの注） | 940×488 | 1.184 | **12.4pt** | 0（すべて図形。文字は編集できる） |
| 同じ図、`lead` の 1 行あり | 940×488 | 1.133 | 11.9pt | 0 |
| 同じ図、`fit: "width"` | 940×488 | 1.184 | 12.4pt | 0 |
| 比べる: `rangeBars` で同じ 11 区間（点・基準の線・対数目盛なし） | 940×564 | 1.025 | 10.8pt | 0 |
| `forest-23`（22 行 + 統合 1） | 940×748 | 0.773 | **8.1pt**（9pt 未満の警告） | 0 |

- 行の間隔は 26px（`max(14 + 12, 26)`）。図の高さ = 見出し 32 + 26 × 行数 + 6 + 軸（目盛 28、軸の題 22、向きの注 24）+ 4。題だけのスライドで 9pt を保てるのは、**約 20 行**（研究・見出し・統合の行の合計）まで。
- `check-diagram --strict`: `forest-10`・`forest-23`・比べる `rangeBars` は通る（chart の帯の重なりの検査で問題 0）。
- PPTX: chart の帯は今の SVG → 図形の変換（`lib/pptx/bands.ts` の `chart: 'image'` → `drawBandFallback` + `svgShapesXml`）で、PNG なしの図形になる。数値の列「1.54 (1.22–1.95)」も `<a:t>` として入る（試しで確かめた）。
- 線形の目盛（平均の差、基準 0。`forest-linear`）では「-4.2 (-7.9–-0.5)」が読めない。負の数のときの区切りを変える（D4）。
- 対数の目盛: データが 0.22〜5.90（27 倍）で 0.2 0.5 1 2 5 10、0.41〜2.52（6 倍）で 0.25 0.5 1 2 4（D3）。

## 検討

| 案 | 内容 | 判断 |
|---|---|---|
| A: `rangeBars` を広げる | `estimate`・`ref`・`scale`・見出しの行・数値の列・`favours` を足す | **取らない**。`rangeBars` は `bars` の帯（値 0 以上、0 からの棒の軸、`3.2〜5.8万円` の値の文字、`dir: 'v'`）の別名で、足す 6 つの選択肢は全部そろったときだけ意味を持つ。`bars` に対数目盛と見出しの行を入れると、棒グラフ全体の分岐が増える |
| B: 新しい帯の種類 `forest` | 配置・描画・検査・PPTX を新しく作る | 取らない。描画・重なりの検査・anchor・`reveal`・`focus`（spotlight）・PPTX の変換は、chart の帯（`type: 'chart'`）がもう持っている |
| C: **chart の新しい種類 `kind: 'forest'`** | `tornado` と同じ形（`lib/charts-forest.ts` の配置、`lib/bands/forest.ts` の帯の定義、`ChartKind` に 1 つ） | **採る**。試しは約 130 行で、重なりの検査と PPTX が手を入れずに通った |

## 決定

### D1: API

```ts
forest(
  [
    {heading: '東の会場'},
    {label: '会場 A', estimate: 1.54, low: 1.22, high: 1.95, weight: 180},
    {label: '会場 B', estimate: 1.31, low: 0.98, high: 1.75, weight: 140},
    {heading: '西の会場'},
    {label: '会場 F', estimate: 1.12, low: 0.84, high: 1.49, weight: 130},
    {label: '全体(統合)', estimate: 1.29, low: 1.12, high: 1.49, summary: true},
  ],
  {valueHeader: 'OR (95% CI)', axisLabel: 'オッズ比(対数目盛)', favours: ['対照が良い', 'アプリが良い']},
)
```

- 行は 3 種類。並べた順に上から描く。
  - 研究の行: `{label, estimate, low, high, weight?, id?}`。
  - 見出しの行: `{heading}`（ほかの欄を持たない）。
  - 統合の行: `{label, estimate, low, high, summary: true, id?}`（`weight` を持たない）。ひし形で描く（D6）。
- 選択肢: `scale: 'log' | 'linear'`（既定 `'log'`。Q3）、`ref`（基準の線。既定 1。差のときは `{scale: 'linear', ref: 0}`）、`decimals`（数値の列の桁。既定 2）、`values: false`（数値の列を出さない）、`valueHeader`（数値の列の見出し）、`axisLabel`（軸の題）、`favours: [左, 右]`（向きの注）、`domain: [lo, hi]`（軸の端を決める。D3）、`id`・`alt`・`reveal` / `until`・`scope`（ほかの chart と同じ）。
- 群は見出しの行で書く（`group` の欄にしない。Q4）。並び順が書いたとおりになり、見出しの無い行と混ぜても迷わない。
- 行の `id` は anchor になる（`connect()` や `focus` から指せる）。anchor は区間の線（統合ならひし形）を囲む矩形。

### D2: 配置（`lib/charts-forest.ts`）

- 3 列: 左にラベル（見出しの行があれば、研究と統合の行は 12px 字下げ）、中に図、右に数値の列（右揃え）。ラベルの列は図の幅の 34% まで。超えるラベルは折り返し、その行を高くする（`tornado` と同じ）。
- 行の間隔は `max(文字 + 12, 26)`。見出しは太字、統合の行のラベルと数値も太字。
- 図: 区間は横線（1.5px）、点推定は四角（D5）、統合はひし形（D6）。基準の線は全行を貫く破線。
- 軸は図の下に 1 本。目盛の文字、その下に `axisLabel`、その下に `favours` を基準の線の左右に置く（左は右揃えで `← 左`、右は左揃えで `右 →`）。
- 見出しの列（`valueHeader`）は数値の列の上。無ければ上の余白は 6px。
- 行数の上限は 40（spec も同じ）。読みやすさは、デッキの 9pt の警告（ADR 0055）に任せる（約 20 行が境目）。

### D3: 目盛

- 線形: 今の `niceScale` に、データと `ref` を入れる。
- 対数: データ（と `ref`）の幅が 16 倍以内なら `ref × 2^k`（0.25 0.5 1 2 4 …）、超えるなら 10 のべきごとの 1・2・5。両端はデータを含む最も近い目盛。目盛の文字は有効数字 3 桁まで（`0.25`、`0.5`、`10`）。混み合う目盛は今の `thinTicks` で間引く。
- `scale: 'log'` で `low` が 0 以下ならエラー（「対数目盛には 0 より大きい値が要る。差なら `scale: 'linear', ref: 0`」）。
- `domain` は、複数のスライドで軸をそろえるためのもの。点推定や `ref` が `domain` の外ならエラー。区間の端だけが外なら、端で切って矢じりを描き、info `forest-clipped` を出す（Q8）。
- chart の軸の不一致の規則（`chart-axis-mismatch`）には v1 では加わらない（対数の軸を比べる仕組みが無い。`domain` で手でそろえる）。

### D4: 数値の列

- 形は固定: `推定 (下限–上限)`。桁は `decimals`（既定 2、0〜3）。
- 下限か上限が負のときは、区切りを `–` から `, ` に変え、負の記号は `−`（U+2212）にする: `−4.2 (−7.9, −0.5)`。試しで `-4.2 (-7.9–-0.5)` が読めなかったため。
- 書式のひな形（`'{e} [{lo}; {hi}]'` など）は v1 では受け付けない（Q7）。列を 2 つ以上（人数・重みの %）は範囲外。

### D5: 重み（任意）

- `weight` のある研究の行は、四角の一辺を `8 + 10·√(weight / 最大の weight)` にする（面積がほぼ重みに比例。8〜18px）。`weight` の無い行は 10px。
- 一部の行にだけ `weight` があるときは info（重みの無い行は 10px で描く。試しでは警告しない）。

### D6: 統合の行（ひし形）

- **v1 に入れる**（Q5）。試しでは、ひし形 1 つと点線 1 本で済んだ。
- ひし形は `low`〜`high` の幅、高さは行の間隔 − 6（最大 18px）。統合の行が**1 つだけ**のときは、その推定に縦の点線（細い、色は accent）を全行に引く。2 つ以上（群ごとの小計）のときは引かない。

### D7: 検査

組み立て（`resolveForest`）でのエラー（何が悪いか + どう直すか、1 行）:

- 行が 0、行が 40 を超える、数が有限でない。
- `low ≤ estimate ≤ high` が成り立たない（「low と high を入れ替えるか、estimate を直す」）。
- 対数目盛で 0 以下の値（D3）。`domain` の外の点推定・`ref`（D3）。
- 見出しの行に `estimate` などがある、統合の行に `weight` がある、`heading` と `label` を両方持つ。
- `favours` の片方の文字が、基準の線から図の端までより広い（「favours を短くするか、図を広げる」）。
- id の重複（今の `checkIds`）。

警告・info: `forest-clipped`（D3。info）、一部の行だけ `weight`（D5。info）。重なり・はみ出しは chart の帯の今の検査（`verifyChart`）で見る。

### D8: PPTX

- コードは変えない。chart の帯は今の SVG → 図形の変換で、四角・線・ひし形・文字が編集できる図形として入る（試しで PNG 0、数値の列も `<a:t>`）。
- PowerPoint の native のグラフ（`c:chart`）は使わない。今の chart の部品はどれも使っておらず、フォレストプロットは PowerPoint のグラフの種類に無い。

### D9: spec（JSON）

- 新しい部品 `forest`（`lib/spec-parts/forest.ts`。`tornado` と同じ形。選んで読み込む入口 `lib/spec-parts/selective/forest.ts` と `spec-cli-parts.ts` の 1 行）。
- `rows`: 1〜40 の list。各行は 1 つの object で、`heading`、`label`（40 字まで）、`estimate`、`low`、`high`、`weight`（0 より大）、`summary` を持てる。どの組み合わせが良いかは `check()` が D7 のとおり見る（JSON Schema の `oneOf` で 3 つに分けると、AI が読むエラーが長くなるため）。
- そのほか: `scale`、`ref`、`decimals`、`values`、`valueHeader`（20 字）、`axisLabel`（30 字）、`favours`（2 つの文字、各 20 字）、`domain`。
- 説明文（`list_diagram_parts` に出る）:「フォレストプロット: 行ごとに点推定と区間（信頼区間など）を、基準の線（既定 1 = 差がない）と右の数値の列といっしょに描く。比は対数目盛（既定）、差は scale: linear, ref: 0。見出しの行と、統合のひし形を書ける」。`rangeBars` の説明に「点推定と基準の線が要るなら forest」を 1 文足す。
- `pnpm schema` で作り直す。

## 決める人への質問（決定済み: すべて推奨どおり）

| # | 質問 | 推奨 |
|---|---|---|
| Q1 | `rangeBars` を広げるか、新しい部品にするか | **新しい部品**（chart の `kind: 'forest'`、案 C）。`rangeBars` は値 0 以上の棒の別名で、足すものが多すぎる |
| Q2 | 名前 | **`forest`**（spec の `type` も同じ）。chart の部品は `tornado`・`waterfall` のように短い名前で、spec の部品の一覧の中では迷わない |
| Q3 | 既定の目盛と基準 | **`scale: 'log'`、`ref: 1`**（比のフォレストプロットがいちばん多い）。差は `{scale: 'linear', ref: 0}` と書く。対数で 0 以下はエラーで、この書き方を案内する |
| Q4 | 群の書き方 | **見出しの行 `{heading}`**。`group` の欄より並び順が明らか |
| Q5 | 統合のひし形 | **v1 に入れる**（試しで安い。統合が 1 つのときだけ縦の点線） |
| Q6 | 重みで四角の大きさを変えるか | **入れる（任意）**。面積が重みに比例、8〜18px |
| Q7 | 数値の列の書式 | **固定の形 + `decimals`**。負の数のときは `, ` 区切り（D4）。ひな形と列の追加は、要望が出たら別の ADR |
| Q8 | `domain` の外に出る区間 | **端で切って矢じり + info**（論文のフォレストプロットの慣習）。点推定が外ならエラー |

## 作業の順

1. **U1 配置と DSL**: `lib/charts-forest.ts`（D2〜D7。試しのコードはそのまま使わず、ラベルの折り返し・`domain` と矢じり・負の数の区切り・D7 のエラーを足して書き直す）、`lib/bands/forest.ts`、`ChartKind` と `full-definitions.ts`・`charts.ts` の表、`dsl-pure.ts` の export。テスト: (i) 対数の目盛（16 倍の境目の両側）、(ii) `low > estimate` などのエラーの文言、(iii) 重みの四角の大きさの順、(iv) 統合が 1 つのときだけ点線、(v) 負の数の数値の列、(vi) `domain` の外の区間に矢じりと info、(vii) 10 行の図が `check --strict` を通る。
2. **U2 spec と文書と例**: `lib/spec-parts/forest.ts`（D9）、`pnpm schema`、`rangeBars` の説明文、README、`skills/svg-diagram/` の部品の参照、`examples/forest.ts`（10 行・対数・数値の列・向きの注）と golden（Docker）、デッキの例を 1 枚（`examples/` のデッキ）。
