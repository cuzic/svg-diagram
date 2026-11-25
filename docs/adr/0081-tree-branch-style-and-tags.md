# ADR 0081: 木（`tree` / `mindmap`）の枝ごとの線の見た目と、項目の札

- 状態: **提案**（Opus レビュー round 1 の B1・M1〜M8・m1〜m9 を反映。決める人の答え Q1〜Q3 を反映）
- 日付: 2026-11-25
- 基点: `main`（377c61d6。ADR 0080 D13 まで）
- 関連: ADR 0045（`svg-diagram/browser`、`renderInBrowser`）、ADR 0049（帯のノード）、ADR 0029（`keepWords`）、ADR 0027 / 0054（PPTX）、ADR 0069（`partCatalog`）、ADR 0071（JSON Schema）、ADR 0080（帯の定義、tree shaking、D2b の `.type ===` ラチェット）
- 範囲外: 日本語の折り返し（「背景」。v0.9.0 の `diagram({wrap: 'bunsetsu'})` で足りる）。枝の線に文字を付けること。木の説明文（`<desc>`。木は今も項目を説明文に出していない。D5）。`legend: 'auto'` と `legend-missing` が枝の線や札を数えること（D5）
- 例のデータはすべてこの ADR のための作り話（「導入するか」「費用が下がる」「移行に時間がかかる」など）

## 背景

議論の構造を `mindmap(root, {layout: 'right'})` で描く利用者（会議の議論グラフ: 問い・案・賛否の理由・決定・宿題）から、次の 3 つの依頼があった。

1. **枝ごとの線の見た目**: 子の項目に、親とつなぐ線の色と線種（実線・破線）を指定したい。賛成の理由と反対の理由を線で見分けるため。今の `edges` は図全体で 1 つしか選べず、線の色は `focus` の強調（accent）以外は常に muted（`lib/emit-tree.ts:17`）。
2. **項目の札**: 「決定」「反対」「要確認」などを、`sub`（2 行目）ではなく色付きの小さな札として出したい。`sub` は別の情報に使い続ける。
3. **日本語の折り返し**: `maxNodeW` で折り返すとき、語の途中で切れる（「どう対処す / るか」）。

条件:

- `svg-diagram/browser` で使えること（Node 専用の依存を入れない）。`pillSvg`（`lib/badge.ts`）と `lineAttrs`（`lib/emit-common.ts:90-92`）は純粋で、そのまま使える。
- 利用者は出力 SVG を要素・属性の許可リストで検査している（`rect` / `path` / `text` / `tspan`、`fill` / `stroke` は `#rrggbb` か `none`）。**新しく出す属性と値を一覧にする**（D6）。
- 指定しなければ、今の出力と**同じバイト列**になること（D8）。

### 3（折り返し）は既にある

v0.9.0 に `diagram({wrap: 'bunsetsu'})`（README「日本語の折り返し」）がある。ひらがなを直前の文字に付けて文節で折り、`tree` / `mindmap` の箱は最も長い単位まで広がる（`maxNodeW` の 1.5 倍まで。`lib/tree.ts:62-65`）。辞書も `Intl.Segmenter` も使わないので、ブラウザと Node で結果が同じ。収まらない図を従来の折り方に戻す `'bunsetsu-soft'` もある。幅 6 文字で `wrapText` を比べた結果:

| 文 | `phrase`（既定） | `bunsetsu` |
|---|---|---|
| この不具合にどう対処するか | この不具合に / どう対処す / るか | この / 不具合にどう / 対処するか |
| 仕様を確認してから決める | 仕様を確認し / てから決める | 仕様を / 確認してから / 決める |

3 はこの ADR では扱わない（利用者に `wrap: 'bunsetsu'` を案内した）。BudouX などの辞書・モデル方式は、バンドルの大きさ（ADR 0080 で削っている）と、環境で切れ目が変わらないこと（README の方針）に反するので採らない。

## 決定

### D1: 子の項目の `edge` — 親とつなぐ線の色と線種

```ts
export interface TreeItem {
  // …既存…
  /** ADR 0081: この項目を親とつなぐ線の見た目。書かなければ今と同じ（muted の実線）。 */
  edge?: {tone?: TagTone; line?: 'solid' | 'dashed' | 'dotted'};
}
```

- `tone` は `TagTone`（`'accent' | 'muted' | 'danger'`）。既定 `'muted'`。賛成 = `accent`、反対 = `danger` のように使う。
- 色: `muted` は今の既定の線と同じ `PALETTE.muted`（固定。`diagram({tones})` の上書きに従わない）。`accent` / `danger` は `colorOf(toneStyle(tones, tone).ink, theme)`（上書きに従う）。これで `{tone: 'muted'}` と書かない場合は同じ色になる。
- `line` は `lineAttrs()` と同じ: `dashed` = `stroke-dasharray="6,4"`、`dotted` = `stroke-dasharray="2,5" stroke-linecap="round"`。既定 `'solid'`（属性を出さない）。
- **正規化**: 既定値を入れた `{tone, line}` で扱う。`undefined`・`{}`・`{tone: 'muted', line: 'solid'}` は同じで、どれも今と同じ出力になる。
- 線の太さは今のまま（幹 `bold` は 4、それ以外は 2）。
- 使える場所とエラーは D3 の表。

### D2: 兄弟で共有する区間と、その項目だけの区間

配置ごとの点列（round 1 の表を検証した結果）:

| 配置 | 点列を作る場所 | 点列 | 兄弟で重なる区間 | その項目だけの区間（最後の 1 区間）の長さ |
|---|---|---|---|---|
| right / left | `lib/graph-layout.ts:78-80`（left は `mirror`、`lib/map-layouts.ts:15-19`） | `[a, (mid,a.y), (mid,b.y), b]` | 1 区間目と、x=mid の縦の親寄り | `levelGap/2`（22px。compact 16.5px） |
| down / up | 同上（up は `mirror`） | `[a, (a.x,mid), (b.x,mid), b]` | 1 区間目と、y=mid の横の同じ側 | 同上 |
| radial | 根の子 `lib/graph-layout.ts:131-136`、その下 `:138-141` | `[a, (m,a.y), (m,b.y), b]` | **左右それぞれ**の兄弟だけ | 同上 |
| org | 根 → 子 `lib/map-layouts.ts:62-68`、その下は list と同じ `:39` | 4 点（バス）、または 2 点（根の中心から 4px 以内の子 `:67`） | 縦の下り口と、バスの rcx の左右それぞれ。2 点の線は何も共有しない | 根の子 22px、その下 14px |
| list | `lib/map-layouts.ts:39` | 3 点 `[(x+14,y+h), (x+14,cy), (cx,cy)]` | 1 区間目（縦の柱） | `indent - 14` = 14px |
| `straight` / `curve` | `lib/tree.ts:132` | 2 点 | なし | 線全体 |

規則:

- **その項目だけの区間**（点列の最後の 1 区間。2 点の線では線全体）は、常にその項目の `edge` で描く。
- **共有区間**（それ以外）は、**同じ幹を持つ兄弟**（同じ親で、radial は同じ側、org の根のバスは rcx の同じ側。2 点の子は数えない）の正規化した `edge` がすべて同じなら、その見た目で描く。1 つでも違えば既定（muted の実線）で描く。
- **短い区間を広げる（round 1 M2）**: `edge` を 1 つでも書いた木（正規化して既定でないものが 1 つでもある木）だけ、その項目だけの区間が **24px 以上**になるよう間隔を広げる: `levelGap` を `max(levelGap, 48)`、`list` と `org` の下の段の `indent` を 38、`org` の根のバスから子の上端までを 24。`edge` を書かない木の配置は変えない（D8）。
- **分割は描く段階で行う（round 1 M1）**: `LaidOutTree.edges` の要素は今どおり 1 本の枝につき 1 つ。要素に、正規化した `style?: {tone, line}`（その項目だけの区間）と `trunk?: {tone, line}`（共有区間）を持たせ、配置の段階で決める（既定と同じなら持たせない）。`renderTree` が点列を `[0..n-2]`（共有）と `[n-2..n-1]`（その項目だけ）の 2 本の `path` に分けて描く。`style` も `trunk` もない枝は今と同じ 1 本の `path`。帯ノードの吸着（`lib/layout-tree.ts:22-49`）、漏斗（`:81-110`）、PPTX の糊付けは、今どおり 1 本の枝として扱う。
- **PPTX**: 枝を分割しない。1 本のコネクタ（両端を糊付け、`fitConnector` は今どおり）を、その項目の `style` で描く（`<a:prstDash val="dash"/>` / `"sysDot"`）。兄弟の幹が重なる部分は、後に描いた線の見た目になる（PPTX では受け入れる。編集でノードを動かしたときに線が付いてくることを優先する）。
- **描く順**（SVG と PPTX で同じ比べ方の関数を使う。round 1 m7）: 既定の線 → `style` のある線 → `focus` で光る線。

### D3: 使える場所とエラー（round 1 M8・m2）

| 場所 | `edge` | `tags` |
|---|---|---|
| `tree()`（`dir: 'down'` / `'right'` / `'auto'`） | 使える | 使える |
| `mindmap` の `radial` / `right` / `left` / `down` / `up` / `org` / `list` | 使える | 使える |
| `mindmap` の `brace` / `fishbone` / `timeline` | **エラー**（v1 では需要がないので入れない。後で足せる） | 使える（箱の中に置くので、配置の計算は箱が大きくなるだけ） |
| 根（`root`） | エラー（親がない） | 使える |
| 帯ノード（`band` を持つ項目） | 使える（親とつなぐ線は描かれる） | **エラー**（`sub` / `tone` と同じく、帯ノードは自分で描く。`lib/dsl/tree.ts:58`） |
| `from`（漏斗）を持つ子 | **エラー**（漏斗の 2 本は元の線を作り直す。`lib/layout-tree.ts:101-108`） | 使える |
| `edges: false` の図 | エラー（描く線がない）。`mindmap()` 側で `edges` を付けた後に確かめる（`lib/dsl/tree.ts:78-80`） | 使える |

エラーの文は「何が悪いか」と「どう直すか」を 1 行で言う（例「`edge` は `layout: 'brace'` では使えません。`edge` を消すか、`layout: 'right'` などにしてください」）。

### D4: 項目の `tags` — 色付きの札（Q1: 箱の中の最上段）

```ts
export interface TreeItem {
  // …既存…
  /** ADR 0081: 札（最大 3 つ。1 つ 8 文字まで）。文字列は accent の札。書かなければ今と同じ。 */
  tags?: readonly (string | {text: string; tone?: TagTone})[];
}
```

- **置き場所**: 箱の中の最上段に、札を横に並べた 1 行（中央寄せ）。その下に `label`、`sub` が続く。
- **大きさ**: 札の高さ `TAG_H`（24）、札 1 つの幅 = 文字の幅（`roles.tag ?? 14`、太字 700 で測る）+ 2 × `TAG_PAD_X`（8）、札の間 6px。札の行の下に 4px。箱の内側の高さは札の行（24 + 4）だけ増える。箱の幅は `札の行の幅 + 2 × PAD_X（14）` より狭くならない（広げるだけ。エラーにしない。round 1 M6）。
- **検査は DSL で 1 回だけ**（round 1 M6）: 空文字、9 文字以上、4 つ以上はエラー（`tree()` / `mindmap()` の検査。幅合わせの試行の中では投げない）。札の行が広くて図が収まらないときは、今の「収まらない」エラーと同じ経路で報告される。
- **色**（`box` の札と同じ形 `pillSvg`）:
  - ふつうの箱: 塗り = `toneStyle(tones, tone).ink` の色、文字 = 白（`PALETTE.bg`）、縁なし。
  - **塗りのある箱（`solid` / `solid-danger`）の中の札は白黒を反転**する（round 1 M4）: 塗り = 白、文字 = その札の色。`focus` の中心の項目（`solid`）に既定の accent の札を付けても見える。
- **`focus` と `dim`**（round 1 M3-5）: `focus` で `muted` になった項目（光らない項目）の札は muted の色で塗る。`diagram({spotlight})` で帯全体が `dim` のときも muted。
- **持ち方**（round 1 M5）: 札は `LaidOutTree.texts` に入れない。`LaidOutTree.nodes[i].tags?: {text, tone, x, y, w}[]` に置く（SVG の `ink()`、PPTX の `nodeRunsOf` が、箱の中の文字を箱の本文として扱うため）。`measureNode` には省略できる `opts.tags` を足すだけで、他の部品（`states` / `bpmn` / `fta` / `toc` / `cloud` / `bowtie` / `flow-nodes`）の呼び方と出力は変えない。札の文字は `treeTexts` で測る対象に入れる（`svgMeasurer` でも同じ）。
- **PPTX**: `box` の札と同じ角丸の図形（`lib/pptx/box-band.ts` の札）を、その項目の箱と同じグループに入れる。

### D5: 説明文と凡例（round 1 B1・m6）

- 木の説明文（`<desc>`）は変えない。木の帯は今 `describe` を持たず、項目の文字を説明文に出していない（`lib/bands/tree.ts:13-29`、`lib/core.ts:403-407`）。木の説明文は、すべての木に対して別の ADR で決める。
- `legend: 'auto'` は `edge` も `tags` も凡例にしない。`legend-missing`（`lib/legend-notation.ts:61-75`）も木の線を数えない。線の意味（赤 = 反対など）は利用者が決めるもので、ライブラリには名前がないため。必要なら `legend` 帯を手で書く（README に例を載せる）。

### D6: 出力 SVG に新しく現れるもの（許可リスト用。round 1 M7）

`edge` と `tags` を**書いたときだけ**現れる。書かなければ何も変わらない。

**新しい属性**（木の出力に今は無いもの）:

| 要素 | 属性と値 | どの指定で |
|---|---|---|
| `path`（枝の線） | `stroke-dasharray="6,4"` | `edge.line: 'dashed'` |
| `path`（枝の線） | `stroke-dasharray="2,5"`、`stroke-linecap="round"` | `edge.line: 'dotted'` |

**既にある属性の新しい値・新しい使われ方**:

| 要素 | 属性 | 値 | どの指定で |
|---|---|---|---|
| `path`（枝の線） | `stroke` | accent・danger の色（`#rrggbb`。`diagram({tones})` の上書きに従う） | `edge.tone` |
| `path` | — | 1 本の枝が 2 本の `path`（共有区間とその項目だけの区間）になる（D2） | 兄弟で `edge` が違うとき |
| `rect`（札） | `x` `y` `width` `height` `rx="12"` `fill`（`#rrggbb`） | 縁（`stroke`）は付けない | `tags` |
| `text`（札の文字） | `x` `y` `text-anchor="middle"` `font-size`（`roles.tag`。既定 14、キャンバスでは大きくなる） `font-weight="700"` `fill`（`#rrggbb`） | 文字は `emojiSpan` を通す（`tspan class="emoji"` が出うる） | `tags` |

新しい要素の種類（`line`、`circle` など）は出さない。

### D7: JSON spec（MCP。Q2: 同じ版で出す）

- `mindmap` 部品の項目に `edge` と `tags` を足す。`spec-kit` の `treeItem` に、部品ごとに有効にする引数を足す（他の部品の木には出さない）。
- 札の文字は 8 文字まで、3 つまで（DSL と同じ。spec を通ったのに描くと失敗する入力を作らない。round 1 m4）。
- `edge` を書けない配置（`brace` / `fishbone` / `timeline`）の検査は、部品の `check()` で行い、spec の位置（`parts[2].root.children[0].edge`）付きで返す。
- `treeItem` は深さごとに入れ子で作られる（`lib/spec-kit.ts:154-159`）。スキーマの大きさが増える量を U3 で測り、PR に書く（round 1 m5）。

### D8: 後方互換

- `edge` / `tags` のない木の出力は、SVG も PPTX もバイト単位で今と同じ。
  - SVG: `examples/out/` の golden（`pnpm golden`、CI は `scripts/golden-docker.sh`）が変わらないこと。
  - PPTX: `gh workflow run pptx-golden.yml -f update=false` で差がないこと（round 1 m8）。
- 新しい例 `examples/mindmap-branch-style.ts`（賛否の枝と札。作り話）を golden に足す。

## 実装の単位（Q3: Sonnet のサブエージェントが実装し、Claude が仕様とレビュー）

木の帯に足す処理は `lib/bands/tree.ts` の帯の定義の hook に置き、`lib/bands/` の外に `.type === 'tree'` を増やさない（ADR 0080 D2b。round 1 m9）。

| 単位 | 内容 |
|---|---|
| U1 | D1〜D3 の `edge`: 型、DSL の検査（D3 の表）、正規化、`layoutTreeBand` が `style` / `trunk` を決める、24px の間隔、`renderTree` の分割と描く順、PPTX の線種と描く順、テスト（配置ごと・兄弟の範囲・`focus` / `dim` との組合せ・バイト不変・その項目だけの区間が 24px 以上） |
| U2 | D4 の `tags`: 型、DSL の検査、`measureNode` の `opts.tags`、`LaidOutTree.nodes[i].tags`、`renderTree` の `pillSvg`（反転を含む）、PPTX、テスト |
| U3 | D7: spec、JSON Schema（`pnpm schema`）、部品の目録の例、スキーマの大きさの測定 |
| U4 | 例と golden、README（`legend` を手で書く例を含む）、CHANGELOG（D6 の一覧を載せる）、次の版のリリース（決める人の承認後） |

### `focus` / `dim` と `edge` の組合せ（round 1 M3）

| 図の状態 | 枝 | 共有区間 | その項目だけの区間 |
|---|---|---|---|
| ふつう | すべて | D2 の規則 | その項目の `edge` |
| `focus` あり | 光る枝（`lit`） | accent の実線（根までの道が途切れない） | accent、線種はその項目の `edge.line` |
| `focus` あり | 光らない枝 | muted の実線 | muted（`edge.tone` は使わない）、線種はその項目の `edge.line` |
| `diagram({spotlight})` で `dim` | すべて | muted の実線 | muted、線種はその項目の `edge.line` |

`danger` の枝を光らせると accent になる（`focus` の「ここを見る」を優先する）。線種は保つので、破線の反対意見を光らせても破線のまま。

## 決める人の答え（2026-11-25）

- **Q1（札の置き場所）**: 箱の中の最上段（D4）。
- **Q2（spec に出す時期）**: 同じ版で出す（D7）。
- **Q3（実装の担い手）**: Sonnet のサブエージェント。Claude は仕様とレビュー。

## 却下した案

- **図全体の `edgeStyle: (item) => …` の関数**: JSON spec にできず、データとしての木に見た目が書けない。
- **線の色を `tone`（項目の塗り）から自動で決める**: 依頼者は塗りと線を別々に使う（塗り = 種類、線 = 賛否）。
- **`TagTone` より多い色（`new` / `changed` など）**: 線の色として見分けられる数は少ない。`accent` / `danger` / `muted` の 3 つと線種 3 つで 9 通りあれば足りる。
- **`box` と同じく札を角に重ねる**: はみ出す分の隙間を、10 種類の配置すべてで確保し直す必要があり、兄弟の箱や線と重なりやすい（Q1 で箱の中に決定）。
- **`LaidOutTree.edges` の段階で枝を 2 つに分ける**: 帯ノードの吸着、PPTX の糊付け、`fitConnector` が 1 本の枝を前提にしている（round 1 M1）。
- **BudouX などで折り返す**: 「背景」のとおり。
