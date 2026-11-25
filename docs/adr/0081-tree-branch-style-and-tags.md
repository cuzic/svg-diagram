# ADR 0081: 木（`tree` / `mindmap`）の枝ごとの線の見た目と、項目の札

- 状態: **提案**
- 日付: 2026-11-25
- 基点: `main`（377c61d6。ADR 0080 D13 まで）
- 関連: ADR 0045（`svg-diagram/browser`、`renderInBrowser`）、ADR 0049（帯のノード）、ADR 0029（`keepWords`）、ADR 0027 / 0054（PPTX）、ADR 0069（`partCatalog`）、ADR 0071（JSON Schema）、ADR 0080（帯の定義、tree shaking）
- 範囲外: 日本語の折り返し（後述。v0.9.0 の `diagram({wrap: 'bunsetsu'})` で足りる）。枝の線に文字（ラベル）を付けること。`legend: 'auto'` が枝の線や札から凡例を作ること（v1 では作らない。D5）
- 例のデータはすべてこの ADR のための作り話（「導入するか」「費用が下がる」「移行に時間がかかる」など）

## 背景

議論の構造を `mindmap(root, {layout: 'right'})` で描く利用者（会議の議論グラフ: 問い・案・賛否の理由・決定・宿題）から、次の 3 つの依頼があった。

1. **枝ごとの線の見た目**: 子の項目に、親とつなぐ線の色と線種（実線・破線）を指定したい。賛成の理由と反対の理由を、線で見分けるため。今の `edges` は図全体で 1 つしか選べず、線の色は `focus` の強調（accent）以外は常に muted。
2. **項目の札**: 「決定」「反対」「要確認」などを、`sub`（2 行目）ではなく、色付きの小さな札として出したい。`sub` は別の情報に使い続ける。
3. **日本語の折り返し**: `maxNodeW` で折り返すとき、語の途中で切れる（「どう対処す / るか」）。

条件:

- `svg-diagram/browser` で使えること（Node 専用の依存を入れない）。
- 利用者は出力 SVG を要素・属性の許可リストで検査している（`rect` / `path` / `text` / `tspan`、`fill` / `stroke` は `#rrggbb` か `none`）。**新しく出す要素・属性は一覧にする**（D6）。
- 指定しなければ、今の出力と**同じバイト列**になること。

### 3（折り返し）は既にある

v0.9.0 に `diagram({wrap: 'bunsetsu'})`（README「日本語の折り返し」）がある。ひらがなを直前の文字に付けて文節で折り、`tree` / `mindmap` の箱は最も長い単位まで広がる（`maxNodeW` の 1.5 倍まで）。辞書も `Intl.Segmenter` も使わないので、ブラウザと Node で結果が同じ。収まらない図を従来の折り方に戻す `'bunsetsu-soft'` もある。幅 6 文字で `wrapText` を比べた結果:

| 文 | `phrase`（既定） | `bunsetsu` |
|---|---|---|
| この不具合にどう対処するか | この不具合に / どう対処す / るか | この / 不具合にどう / 対処するか |
| 仕様を確認してから決める | 仕様を確認し / てから決める | 仕様を / 確認してから / 決める |

このため 3 はこの ADR では扱わない（利用者に `wrap: 'bunsetsu'` を案内した）。BudouX などの辞書・モデル方式は、バンドルの大きさ（ADR 0080 で削っている）と、環境で切れ目が変わらないこと（README の方針）に反するので採らない。

## 決定

### D1: 子の項目の `edge` — 親とつなぐ線の色と線種

```ts
export interface TreeItem {
  // …既存…
  /** ADR 0081: この項目を親とつなぐ線の見た目。書かなければ今と同じ（muted の実線）。 */
  edge?: {tone?: TagTone; line?: 'solid' | 'dashed' | 'dotted'};
}
```

- `tone` は `TagTone`（`'accent' | 'muted' | 'danger'`）。色は `colorOf(toneStyle(tones, tone).ink, theme)`（`diagram({tones})` の上書きに従う）。既定は `'muted'`。賛成 = `accent`、反対 = `danger` のように使う。
- `line` は `lineAttrs()`（`lib/emit-common.ts`）と同じ: `dashed` = `stroke-dasharray="6,4"`、`dotted` = `stroke-dasharray="2,5" stroke-linecap="round"`。既定は `'solid'`（属性を出さない）。
- 根（`root`）の `edge` はエラー（親がない）。`edges: false` の図で `edge` を書いた項目があればエラー（描く線がない）。
- 線の太さは今のまま（幹 `bold` は 4、それ以外は 2）。

### D2: 兄弟で共有する幹の扱い

`elbow`（既定）の線は、兄弟どうしで親側の区間（親 → 分岐の列）を共有する（`graph-layout.ts` の `[a, (a.x, mid), (b.x, mid), b]`）。共有区間を項目ごとの色で描くと、最後に描いた線の色が残り、意味が読めない。

- **共有区間は、兄弟全員の `edge` が同じときだけ、その見た目で描く**。1 人でも違えば、共有区間は既定（muted の実線）で描く。
- **項目だけの区間**（分岐の列 → 子。折れ線の最後の 1 区間）は、常にその項目の `edge` で描く。
- `straight` / `curve` は線を共有しないので、線全体がその項目の `edge`。
- 描く順は今と同じ規則に足す: 既定の線 → `edge` のある線 → `focus` で強調された線。

`focus` との関係: 強調された線（`lit`）の**色**は今どおり accent。**線種**は `edge.line` を保つ（破線の反対意見の枝を `focus` しても破線のまま）。図が `dim` のときは色だけ muted にして、線種は保つ。

### D3: 線を描ける配置

`radial` / `right` / `left` / `down` / `up` / `org` / `list` で使える。`brace`（線ではなく括弧で描く）、`fishbone`、`timeline`（骨・軸が線を兼ねる）では、`edge` を書いた項目があれば**エラー**（黙って無視しない）。v1 の後で需要があれば足す。

### D4: 項目の `tags` — 色付きの札

```ts
export interface TreeItem {
  // …既存…
  /** ADR 0081: 札（最大 3 つ）。文字列は accent の札。書かなければ今と同じ。 */
  tags?: readonly (string | {text: string; tone?: TagTone})[];
}
```

- 見た目は `box({tag, tagTone})` の札と同じ（`pillSvg`: 高さ 24、両端が丸い `rect`、白い太字 14px、塗りは `toneStyle(tone).ink`）。
- **置き場所: 箱の中の最上段に、札を横に並べた 1 行**（中央寄せ。札の間は 6px）。その下に `label`、`sub` が続く。箱の高さは札の行（24 + 4）だけ増え、箱の幅は札の行の幅より狭くならない。
  - 角に重ねる置き方（`box` の札）は採らない。札が箱の外へはみ出す分を、10 種類の配置すべてで隙間として確保し直す必要があり、兄弟の箱や線と重なりやすいため。箱の中に置けば、配置の計算は「箱が少し大きい」だけで済む。
- 札の文字は 1 行。札の行が `maxNodeW`（`bunsetsu` では 1.5 倍）より広いときはエラー（札は短い語のためのもの）。空文字、4 つ以上はエラー。
- 札の文字は `treeTexts` に入れて測る（`svgMeasurer` でも同じ）。
- `focus` で `dim` になった項目の札は muted で塗る（`box` の札と同じ）。
- 使える配置は D3 と同じ（`brace` / `fishbone` / `timeline` ではエラー）。

### D5: 凡例

`legend: 'auto'` は v1 では `edge` も `tags` も凡例にしない（意味は利用者が決めるもので、ライブラリには名前がない）。必要なら `legend` 帯を手で書く。図の説明（`diagramDesc`）には札の文字を項目の文字の前に含める（「[決定] 導入する」）。

### D6: 出力 SVG に新しく現れるもの（許可リスト用）

`edge` と `tags` を**書いたときだけ**現れる。書かなければ何も変わらない。

| 要素 | 新しく現れる属性・値 | どの指定で |
|---|---|---|
| `path`（枝の線） | `stroke-dasharray="6,4"` | `edge.line: 'dashed'` |
| `path`（枝の線） | `stroke-dasharray="2,5"`、`stroke-linecap="round"` | `edge.line: 'dotted'` |
| `path`（枝の線） | `stroke` に accent・danger の色（`#rrggbb`） | `edge.tone` |
| `rect`（札） | `rx`（高さの半分 = `12`） | `tags` |
| `text`（札の文字） | `text-anchor="middle"`、`font-size`、`font-weight="700"`、`fill`（`#rrggbb`。白） | `tags` |

`path` を 1 本の枝で 2 本に分けることがある（D2: 共有区間と項目だけの区間）。新しい要素の種類（`line`、`circle` など）は出さない。PPTX は線種を `<a:prstDash val="dash"/>` / `"sysDot"`、札を角丸の図形で出す（既存の `box` の札の PPTX と同じ）。

### D7: JSON spec（MCP）

`mindmap` 部品の項目に `edge` と `tags` を足す（`spec-kit` の `treeItem` に、部品ごとに有効にする引数を足す。他の部品の木には出さない）。`MAX_TREE_NODES` の数え方は変えない。札の文字は 12 文字まで。

### D8: 後方互換

- `edge` / `tags` のない木の出力（SVG・PPTX）は、今とバイト単位で同じ。`examples/out/` の golden（`pnpm golden`、CI は `scripts/golden-docker.sh`）が変わらないことで確かめる。
- 新しい例 `examples/mindmap-branch-style.ts`（賛否の枝と札。作り話）を golden に足す。

## 実装の単位

| 単位 | 内容 |
|---|---|
| U1 | D1〜D3: 型、`layoutTreeBand` が子の `edge` を `LaidOutTree.edges` に写す（`tone` / `line`、共有区間の分割）、`renderTree` と `lib/pptx/tree.ts`、エラー、テスト（`test/mindmap-layouts.test.ts` に配置ごと・`focus` との組合せ・バイト不変） |
| U2 | D4・D5: 型、`measureNode` の札の行、`nodeRuns` の札、`renderTree` の `pillSvg`、PPTX、説明文、テスト |
| U3 | D7: spec・JSON Schema（`pnpm schema`）・部品の目録の例 |
| U4 | 例と golden、README、CHANGELOG（D6 の一覧を載せる）、次の版のリリース（オーナーの承認後） |

U1 と U2 は別々に進められる（触る場所は `renderTree` で重なるので、後から入れる方が合わせる）。

## 決める人への問い

- **Q1（札の置き場所）**: 箱の中の最上段（推奨。D4）か、`box` と同じ角に重ねる形か。
- **Q2（spec に出す時期）**: U3 を同じ版に入れる（推奨。ChatGPT / Claude からも賛否の枝を描ける）か、後の版にするか。
- **Q3（実装の担い手）**: Sonnet のサブエージェント（推奨。最近の tree shaking と同じ）か Codex か。

## 却下した案

- **図全体の `edgeStyle: (item) => …` の関数**: JSON spec にできず、データとしての木に見た目が書けない。
- **線の色を `tone`（項目の塗り）から自動で決める**: 依頼者は塗りと線を別々に使う（塗り = 種類、線 = 賛否）。
- **`TagTone` より多い色（`new` / `changed` など）**: 線の色として見分けられる数は少ない。`accent` / `danger` / `muted` の 3 つと線種 3 つで 9 通りあれば足りる。
- **BudouX などで折り返す**: 「背景」のとおり。
