# ADR 0086: `bpmn()` を `swimlane()` に統合する — 手順に `kind`（イベント・ゲート）、列に `cols: 'auto'` を足し、`bpmn()` は非推奨の別名にする

- 状態: 承認(Accepted。U1 merged・U2 はこの PR。Q1: 部品名 `bpmn` を残して委譲。Q2: `bpmn()` は v1.0 で削除、それまで非推奨 warn)
- 日付: 2026-11-27
- 基点: `origin/main`（601feee0）
- 関連: ADR 0042（`dir: 'v'`）、ADR 0048（swimlane の boundaries）、ADR 0051（`focus`）、ADR 0027 / 0054 / 0055（PPTX）、ADR 0069（`partCatalog`）、ADR 0071（JSON Schema）、ADR 0080（`BandDef`、D2b のラチェット、tree shaking）、ADR 0041（`flowchart()` を薄い入口にした前例）、ADR 0083（`arrange: 'ladder'` の前例）
- 試し: ブランチ `spike/0086-bpmn-swimlane`（マージしない）。報告と実測値は `spikes/0086-bpmn-swimlane/`（`report.md`、`measurements.txt`。q1/q3/q4 プローブはブランチのみ）。判定: 条件付き成立（D10 の予算・D6 の2点・D11 の1点に反映。詳細は「作業の順」の U0）
- 範囲外: `bpmn()` の削除（Q2、別の作業）、spec の部品名の変更（Q1）、プラグインのデプロイ、リリース、明示列と `kind` の混ぜ書き（将来の ADR）
- 例のデータはすべてこの ADR のための作り話（既存の `examples/bpmn*.ts` と同程度の汎用の文言）

## 背景

`bands/bpmn` と `bands/swimlane` はどちらも「レーン × 手順 × 矢印」の図で、利用者（特に AI）がどちらを使うか迷う。

**オーナーの決定（2026-11-27）: bpmn の全機能を swimlane に移し、公開する帯は swimlane 1 つにする。**
`bpmn()` は移行期間のあいだ薄い別名として残し、非推奨の警告を出す。削除は次の段階で行う。

## 現状（基点で確認）

| | swimlane | bpmn |
|---|---|---|
| 手順 | `box()` の全項目（`SwimlaneStep extends BoxOpts` + `lane`、`row`） | `BpmnNode`: `task`/`start`/`end`/`xor`/`and`/`or`、`label`/`sub`/`icon`/`iconTone`/`tone`（EmphasisTone） |
| 列 | 時間の列。手順ごとに決まり、`row` で重ねる | 流れのグラフから自動で決まる（`layoutLayered`） |
| 矢印 | `flows` → `connect` 帯（chip/bend/tone/labelAt…）。第4引数に `connectDefinition` が要る | 専用の線。`line: 'dashed'` はメッセージフロー |
| 固有 | `phases`、`boundaries`、`laneOrder: 'auto'`、`labelW`、`colGap`、`fit: 'shrink'`、PowerPoint の `swimlaneSpan`、one-story 規則 | `dir: 'v'`（ADR 0042）、`fit: 'shrink'`（箱まで縮める）、`focus` → `focused` で矢印の色、`verify-bpmn.ts`、edge-bends の対象、凡例（`legend-notation.ts`）、`spec-parts/bpmn.ts`（JSON spec / MCP の部品） |

bpmn を参照する主なファイル: `lib/bands/bpmn.ts`、`lib/bpmn.ts`、`lib/bpmn-vertical.ts`、`lib/dsl/bpmn.ts`、`lib/emit-bpmn.ts`、`lib/verify-bpmn.ts`、`lib/types/diagrams.ts`、`lib/full-definitions.ts`、`lib/rules.ts`、`lib/focus.ts`、`lib/legend-notation.ts`、`lib/emit-node-ids.ts`、`lib/orthogonal-route.ts`、`lib/verify-edge-bends.ts`、`lib/verify-shrink.ts`、`lib/pptx/*`、`lib/spec-parts/{bpmn,r3,r3-common,selective/bpmn}.ts`、`lib/spec-cli-parts.ts`、`lib/web.ts`、`schema/*.json`、`package.json` の exports、`scripts/check-package-bundles.ts`、`skills/svg-diagram/**`、README、`examples/bpmn*.ts`、`test/bpmn.test.ts` ほか。漏れがないよう `git grep -n -i bpmn` で全部数える（基点で 546 件、`-- '*.ts' '*.json' '*.md'`。ADR 0025 の注: 引用符のない `bpmn:` キーがある）。

## 検討

| 案 | 内容 | 判断 |
|---|---|---|
| A: 完全正規化 | 自動図も `LaidOutSwimlane` + `LaidOutStep`（`kind` の形）+ `connect` の辺に寄せる | 取らない。`connect` の経路では bpmn の辺（ゲートウェイの頂点出し・chip の置き場・レーン端の迂回）を再現できず、別名の出力一致が不可能。工数も大きい |
| B: swimlane 帯に 2 つの配置エンジン | 明示列は今のまま、自動列は移した bpmn エンジン。自動図の laid-out は `LaidOutBpmn` のまま返し、置いた後の hook は `outputDefinitions` の `'bpmn'` 経由で今の定義に流す | **採る**。既存の swimlane と bpmn の golden・検査挙動を両方保てる。下流（emit・verify・PPTX・edge-bends・spotlight）は無変更 |
| C: 現状維持 | 文書で使い分けを書く | 取らない。オーナーが統合を決定済み |

## 決定

### D1: API

```ts
swimlane(
  [{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}],
  [
    {id: 's', lane: 'cust', kind: 'start', title: '注文'},
    {id: 'chk', lane: 'shop', title: '在庫を確認'},
    {id: 'g', lane: 'shop', kind: 'xor', title: '在庫'},
    {id: 'e', lane: 'cust', kind: 'end', title: '受け取り'},
  ],
  {cols: 'auto', flows: [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: 'あり'}]},
)
```

- 手順に `kind?: 'task' | 'start' | 'end' | 'xor' | 'and' | 'or'` を足す。既定 `'task'` は今の box の手順（全項目が使える）。
- 列に `cols?: 'auto'` を足す（`SwimlaneOpts`）。書かない図は今の逐次列のまま、出力は 1px も変えない。列を書かない図の自動推論はしない（既存図の golden を守るため、明示の opt のみ）。
- `dir?: 'h' | 'v'` を足す（既定 `'h'`）。`'v'` は `cols: 'auto'` が要る。`'v'` と `fit` の併用は throw（今の bpmn と同じ文言）。
- `kind`（`task` 以外）は `cols: 'auto'` が要る。明示列に `kind` を書いたら throw（「`cols: 'auto'` を付けるか、`kind` を消す」）。明示列と `kind` の混ぜ書きは v1 では作らない（範囲外）。
- 自動図（`cols: 'auto'`）の手順に使える項目は `id`、`lane`、`kind`、`title`、`body`、`icon`、`iconTone`、`tone` だけ。それ以外の box の項目（`tag`、`note`、`size`、`padX`/`padY`、`dashed`、`step`、`lines`…実装時に `BoxOpts` から列挙）を書いたら throw。`title`/`body` は plain string（装飾付きテキストは throw）。`tone` は `TREE_TONES` の検査（今の bpmn と同じ）。`icon` は task のみ（同じく）。
- 自動図の `flows` に使える項目は `from`、`to`、`label`、`line`（`'solid'` | `'dashed'`）だけ。`chip`/`labelAt`/`bend`/`bendOffset`/`arrow`/`tone` と `'id:side@t'` 形式を書いたら throw。線種は `solid`/`dashed` のみ（`dotted`/`double` は throw）。
- 自動図で throw する opts・項目: 手順の `col`/`span`/`row`/`reveal`/`until`、`phases`、`boundaries`、`labelW`、`colGap`。許すのは `laneOrder: 'auto'`（DSL でレーンを並べ替え、エンジンは順序を読むだけ。U0 スパイクで確認し、だめなら throw に落とす）、`fit: 'shrink'`、`focus`、`id`、帯全体の `reveal`/`until`、`scope`。
- 型（書く側）: `SwimlaneStep` に `kind?: SwimlaneStepKind`（値は今の `BpmnNodeKind`。`BpmnNodeKind` は別名で残す）。`SwimlaneOpts` に `cols?: 'auto'` と `dir?: 'h' | 'v'`。`strict.ts` の `StepCheck` は `UnknownKeys` で `kind` を自動許可する（変更なし）。
- 型（レーン数）: `LaneCheck` は今 6 本を超えると型の誤り（`strict.ts:221-224`）。縦の bpmn は 8 本まで描けるので、`swimlane()` の型引数に opts を足し、`cols: 'auto'` のときの上限を 8 にする（`MAX_LANES_TO_ORDER` と同じ）。明示図は 6 のまま（型推論が難しければ cast を文書化する方式に落とす。U1 で確定）。
- 型（帯のデータ）: `SwimlaneBand` を判別共用体にする。
  - 明示図 `SwimlaneTimedBand`: 今の `SwimlaneBand` のまま（`steps: SwimlaneStepBand[]`、`cols: number`、`phases`、`boundaries`…）。`arrange` は持たない。
  - 自動図 `SwimlaneAutoBand`: `arrange: 'auto'`、`lanes`、`nodes: SwimlaneAutoNode[]`、`flows: SwimlaneAutoFlow[]`、`dir?: 'v'`、`fit?`、`focused?`、`id`/`reveal`/`until`/`scope`、内部の `via?: 'bpmn'`（D8 の印）。**`steps` と `cols` は持たない。** `SwimlaneAutoNode` は今の `BpmnNode` と同じ形（`id`/`lane`/`kind?`/`label?`/`sub?`/`tone?`/`icon?`/`iconTone?`/`iconGlyph?`）で、`type` を持たない（帯ではない）。DSL の `title`/`body` は `label`/`sub` に入れる。
  - 理由: 手順が `type: 'box'` の帯のままだと、`steps` を入れ子の帯として辿るところ（`band-children.ts:20` の `nestedBandsOf`、`band-def.ts:243` の `definedNestedBandsOf`）から、凡例・`located`・spotlight の凡例・`attachDefinitions`・source の記録・`box-size-ignored` などがみな箱として読み、bpmn にはなかった検査が出る（round 1 M3）。`steps` を持たない形にすると、この 2 か所は自動図で `[]` を返すよう直すことになり、`band.steps` を読むほかの所（`describeSwimlane`、`swimlaneFindings`、`revealElements`、`measure`、spec の部品）は tsc がすべて教える。
- `bpmn()` から `swimlane()` への写像: `lanes` はそのまま、`nodes` はそのまま `SwimlaneAutoBand.nodes`、`flows` はそのまま、`fit`/`dir`/`focus`/`id`/`reveal`/`until`/`scope` はそのまま、`arrange: 'auto'` と `via: 'bpmn'` を付ける。`bpmn(lanes, nodes, flows, opts)` の引数の型は変えない。**戻り値の型は変わる**（今は `BpmnBand & …`（`lib/dsl/bpmn.ts:16`）。後は `SwimlaneAutoBand & Declares<…> & HandleOf<…> & AnchorsOf<…>`）。公開の型の変更なので README に書く。

### D2: 列の自動配置

- 明示の `cols: 'auto'` のみ。列を書かない図の推論はしない（D1）。
- 配置は今の bpmn エンジン（`layoutLayered`、`starts` は start イベント）のまま移す。列幅は層ごとに変わる（bpmn 方式）。明示図の均等 `colW` とは別の計算で、明示経路のコードには足さない（PR #501 との衝突を減らす）。
- 列番号は層の順（1 から）。`phases` は v1 では併用不可（D1 の throw）。

### D3: `dir: 'v'`

- 移した縦エンジン（ADR 0042 の配置・経路のまま）。`phases`/`boundaries` との併用は自動全体の throw で不可。`laneOrder` は横と同じ扱い（D1）。

### D4: 矢印

- 自動図の `flows` は帯内に保持し、専用の辺（今の bpmn の経路・chip・ゲートウェイの頂点出しのまま）で引く。`connect` 帯には寄せない（D1 の throw で、辺の選択肢は bpmn と同じ `label`/`line` だけ）。
- 明示図は今の通り `connect` 帯（挙動不変）。
- 自動図だけの `swimlane()` 呼び出しに第4引数（`connectDefinition`）は要らない（`flows` が `connect` 帯を生まないため）。

### D5: `fit: 'shrink'` の合わせ方

- 同じ opt 名のまま、意味は配置方式に従う。明示図は今の swimlane の段階（レーン名の列・列の間隔・余白）、自動図は今の bpmn の `SHRINK_STEPS`（レーン名の列・列の間隔・タスクの幅・flowRoom）。両方の golden が保たれる。違いは README に書く。

### D6: 配置と定義の分岐（核心の仕組み）

- DSL: `swimlaneOf` の中で自動／明示に分岐する。自動は列計算・`connect` 帯化をせず、`flows` を帯内に保持する。明示経路の振る舞いは変えない（追加のみ）。
- `measure`/`layout`/`revealElements`: swimlane 定義の中で `arrange` で分岐する。自動は移した `swimlaneAutoTexts` / `layoutSwimlaneAuto`（`dir: 'v'` なら `layoutSwimlaneAutoVertical`）と、`nodes` を項目にした `revealElements`（今の bpmn の `ids` と同じ id を登録する）。明示は今のまま。swimlane 定義は `internal: true` で、`layout` は内部の `BandLayoutHandler` の形（`bands/swimlane.ts:29-33`）。今の bpmn 定義の `layout` は公開の形で、`core.ts:256-260` の変換（`{x, y: ctx.y, w, …}` を渡し `{laid, h, anchors}` を受ける）を通っている。自動の分岐はこの変換（`snapGrid(y)`、`scope` の付け方、`anchors`、帯 id と anchor の `ctx.register`、`ctx.y` の進め方）を自前で再現する。U0 で確かめた。1 点だけ受け入れる効果: 内部の分岐は core の `authored` を見られないので、重複 anchor の文言は authored の形（「a figure item takes an id that another anchor already has」）に統一する。`authored` を `LayoutCtx` に通すことはしない。テストの対象外。
- 置いた後: 自動図は `LaidOutBpmn`（`type: 'bpmn'`）をそのまま返す。置いた帯の定義の引き方は 2 通りあり、**両方**に bpmn の置後定義を載せる。
  - 帯が定義を持っている経路（`core.ts:196/244` の `syntheticOutputs`、`figure-definitions.ts:28` の `definitionsOf`）: swimlane 定義（`internal: true`）の `outputDefinitions` に `bpmn: swimlaneAutoDefinition` を足す。
  - 型名から全定義表を引く経路（`placed-definitions.ts:11-13` の `placedDefinitionOf` → `FULL_DEFINITIONS`）: PPTX の画像（`pptx/image-band.ts:9`）、`--node-ids`（`legacy-core.ts:319`、`dsl/render.ts:70`）、位置の表（`locations-map.ts`）、デッキの fit（`deck-render-spec.ts:32`）が使う。`outputDefinitions` を読まないので、**`FULL_DEFINITIONS` の `bpmn` は残し**、`swimlaneAutoDefinition` を指す（round 1 B1）。`UNDEFINED_BANDS` は空のまま。
  - これで置いた後の参照（`emit`・`verify.check`・`rects`・`nameNodes`・`locations`・`textSizes`・`selfDimming`・inventory）は今の bpmn 定義の hook がそのまま動く。下流の型表（PPTX の `BAND_HANDLERS`、`verify-edge-bends.ts`、`verify-shrink.ts`、`LaidOutType` の網羅）は無変更。
  - テスト: 別名の図で PPTX（画像の帯）、`--node-ids` の `data-node`、`locations` の項目が今と同じになること。
- `diagramFindings`: swimlane 定義に `edgeBendFindings` を足す（明示だけの図では対象の laid-out が無いので no-op。`core.ts` の `Set` で重複排除される）。
- `one-story`: `oneStoryFindings`（`bands/swimlane.ts:21-23`）は `diagram.bands`、つまり**データ**の帯を数える（`LaidOutDiagram extends DiagramData`、`types/index.ts:68`）。自動図もデータでは `type: 'swimlane'` なので、そのままだと `bpmn()` を 2 つ、または `bpmn()` と `swimlane()` を 1 図に置いたときに、今は出ない warn が出る（round 1 M2）。`via: 'bpmn'` の帯は数えない。`swimlane({cols: 'auto'})` で書いた自動図は数える（スイムレーンが 2 つあるのは、書き方によらず 1 図 2 話）。
- `findings`（data 基準）: 自動図は D8 の `bpmn-deprecated`（`via: 'bpmn'` のときだけ）を出し、`swimlaneFindings`（レーン数・引き継ぎ・並べ替え）は出さない（bpmn の検査挙動を保つ。縦 bpmn は 8 レーンまで入るので、6 本の warn を出すと移行図に雑音が出る）。明示図は今のまま。
- `describe`: 今の bpmn には `describe` がなく、`examples/out/bpmn.svg` は `<title>` だけで `<desc>` がない。swimlane の `describe` を自動図にそのまま効かせると、`<desc>` が増え `aria-labelledby` が変わる（`core.ts:405`、`emit-svg-core.ts:69-72`）。`emitSvg` と PPTX の説明（`diagram-summary.ts:29` → `describeBands`（`diagram-description.ts:45`）、`pptx/slide.ts:14`）も同じ（round 1 M1）。決め方:
  - `via: 'bpmn'` の帯は説明を出さない（`describe` と `describeBands` の両方で）。別名の出力は 1 バイトも変わらない。
  - `swimlane({cols: 'auto'})` で書いた自動図は説明を出す（「レーン: …。手順: …」。手順は `nodes` の `label` のうち空でないもの）。新しい書き方なので既存の golden に影響しない。
- 自動図の手順は `steps` にないので、`nestedBandsOf`（`band-children.ts:20`）と `definedNestedBandsOf`（`band-def.ts:243`）は自動図で `[]` を返す（D1 の型の判別で書く。`.type === 'swimlane'` の比較は今ある 1 か所のまま増やさない）。この 2 つを経由する所（`legend-notation.ts` の `walkBands`、`located.ts:16`、`spotlight-legend.ts:16`、`legacy-core.ts:58` の `attachDefinitions`、`dsl/diagram.ts:99` の source の記録、`locations-map.ts:64`、`spec.ts:115`、`verify-box-like.ts` の `boxSizeFindings`）は、今の bpmn と同じく自動図の中身を辿らない。
- `BpmnBand` 型は残す（公開型）が DSL は作らない。`FULL_DEFINITIONS` の `bpmn` は上のとおり残して `swimlaneAutoDefinition` を指す。この定義の data の hook（`measure`/`layout`）は、生の `{type: 'bpmn'}` データ（JSON で読んだ `DiagramData` など）が来たら「帯「bpmn」のデータは描けなくなりました。`bpmn()` か `swimlane({cols: 'auto'})` で作り直してください（ADR 0086）」で throw する（round 1 m3。黙って壊れず、直し方を言う。U1 以降、生の `BpmnBand` を作る経路はリポジトリにない。modern core は定義を持たない手書きデータを全帯で拒否する）。README に書く。
- `bpmnDefinition` の置後 hook 群は `bands/swimlane.ts` に `swimlaneAutoDefinition`（`type: 'bpmn'`）として移す（`bands/bpmn.ts` が別名のために swimlane を import するので、逆向きに置くと循環 import になる。`bands/bpmn.ts` は別名関数のみにする）。`full-definitions.ts` は `bands/swimlane.ts` から両方を import する。
- `legend-notation.ts` の data-bpmn 分岐（45・79・81 行の 3 か所）は自動 swimlane の読み（D7）に置き換える。判定は 1 か所の helper（`b.type === 'swimlane' && b.arrange === 'auto'`）にまとめ、`bandTones` と線種の読みはそれを使う。比較の数は 3 → 1 で、ラチェットの上限（`test/band-type-literals.test.ts:72`、17）を U1 で実数に下げる（round 1 m5。spike 計測では legend −2・`describeBands` ＋1 の見込み。`(b: Band) => b is SwimlaneAutoBand` の helper で新しい比較を足さずに済むか U1 で確かめる）。
- ファイルの移動（機械的な移動と改名。部品名 `'task'`/`'event'`/`'gateway'`/`'lane'`（`nodePart`）は変えない。SVG の `data-part` は golden のバイトのため）:

| 今 | 後 | 主な改名 |
|---|---|---|
| `lib/bpmn.ts` | `lib/layout-swimlane-auto.ts` | `layoutBpmn` → `layoutSwimlaneAuto`、`bpmnTexts` → `swimlaneAutoTexts`、`checkBpmnInput` → `checkSwimlaneAutoInput`、`measureBpmnNodes` → `measureSwimlaneAutoNodes`、`BPMN_KINDS` → `SWIMLANE_STEP_KINDS` |
| `lib/bpmn-vertical.ts` | `lib/layout-swimlane-auto-vertical.ts` | `layoutBpmnVertical` → `layoutSwimlaneAutoVertical` |
| `lib/emit-bpmn.ts` | `lib/emit-swimlane-auto.ts` | `renderBpmn` → `renderSwimlaneAuto` |
| `lib/verify-bpmn.ts` | `lib/verify-swimlane-auto.ts` | `bpmnProblems` → `swimlaneAutoProblems` |
| `lib/dsl/bpmn.ts` | 同じ path（別名に書き換え） | D1 の写像 |
| `lib/bands/bpmn.ts` | 同じ path（別名関数のみ） | `band(swimlaneDefinition, data)` で wrap |
| `lib/emit-node-ids.ts` | 変更なし | `nameBpmnNodes` は置後定義経由で使う |
| `lib/types/diagrams.ts` | `BpmnBand` を残す、`BpmnNodeKind` は別名に | `LaidOutBpmn` は変更なし |

### D7: focus・凡例・検査・PowerPoint の引き継ぎ

| 機能 | 自動図 | 明示図 |
|---|---|---|
| `focus` | bpmn の通り（`graphTones` + `focused` の id。辺の accent/muted は置後定義経由） | 変わらず |
| 凡例の検査・`legend: 'auto'` | bpmn の通り。`legend-notation.ts` の data-bpmn 3 か所を、swimlane-auto 読み（`nodes` の tone、帯内 `flows` の dashed）の helper 1 か所に置き換える（D6）。box の分岐は触らない（辿ると自動図は `[]`）。生の `{type: 'bpmn'}` データは凡例では読まず、配置で throw する（D6） | 変わらず |
| `bpmn` 規則・edge-bends・narrow-text | 置後 `type: 'bpmn'` のままなので無変更 | 変わらず |
| `data-node` | `nameBpmnNodes` を置後定義経由で無変更（task のみ。イベント・ゲートは付かない。README の記載もそのまま） | 変わらず |
| PowerPoint | 置後 `type: 'bpmn'` → `'image'` で無変更。`swimlaneSpan` は `span` の無い自動図では `undefined` を返して今の bpmn と同出力に落ちる | 変わらず（`swimlaneSpan`） |
| aria・説明 | `via` は出さない（バイト一致）。`cols: 'auto'` で書いた図は「レーン: …。手順: …」を出す（D6） | 変わらず |
| `keepWords` の対象 | 置後 type 基準のまま（`bpmn の task`）。文言は U1 で見直す | 対象外のまま |

### D8: `bpmn()` 別名と非推奨

- `bands/bpmn.ts` の `bpmn()` は D1 の写像 + `swimlaneDefinition` で wrap する薄い別名にする。出力は今の bpmn の golden とバイト一致させる（`examples/bpmn.ts`、`bpmn-vertical.ts`、`bpmn-shrink.ts` とテストで検証する。違いが出るなら本 ADR に追記し、オーナーの OK を取る）。
- 非推奨の出し方: JSDoc の `@deprecated` + `check` の warn ルール `bpmn-deprecated`（`via: 'bpmn'` の marker を `findings` で読む。spec の `bpmn` 部品からも出る）。重さは `warn` のまま（ハンドオフは「非推奨の警告」と定める。`info` に落とさない）。文言案: 「`bpmn()` は非推奨です。`swimlane()` に `kind` と `cols: 'auto'` を書いてください（ADR 0086）」。
- 3 例（`examples/bpmn*.ts`）は別名のまま残し、バイト一致の証拠にする。`check --strict` が warn で落ちないよう（`check-diagram.ts:534`）、リポジトリ直下の `.svg-diagram.json` に `bpmn-deprecated` の許容（理由: 「別名のバイト一致の証拠として v1.0 まで残す」）を書く。例の源は 1 バイトも変えない（`sourceSha256` が golden に入るため）。
- 削除の時期は Q2。

### D9: JSON spec / MCP の部品

- 部品 `bpmn` は名前・schema・`build` の呼び形を残し、builder（別名）経由で委譲する。`spec-parts/bpmn.ts` の実装は変えずに動く。ChatGPT / Copilot プラグイン（`svg-diagram-mcp-plugin`）が部品の一覧を持っているので壊さない。プラグインの変更とデプロイは別の作業にして、ここではしない。部品の説明文に「非推奨だが動作する。`swimlane` に `kind` / `cols: 'auto'` / `dir` が加わった」旨を足す（MCP の `list_diagram_parts` に出る）。
- `swimlane` 部品に `kind`（steps）、`cols`（`'auto'` のみ）、`dir`（`'h'` | `'v'`）を足す。`cols: 'auto'` のときは `SwimlaneAutoBand`（`nodes`/`flows`）を作り、`check()` で D1 の制限（帯内フローは `from`/`to`/`label`/`line` のみ、`phases` 不可など）を鏡写しする。列数の検査（`MAX_SWIMLANE_COLS`）は自動図の対象外にする（自動図は `cols` を持たず、層の数は流れで決まり、幅の throw が守る。`bpmn` 部品に列数の上限は無い。`band.cols` を読む所は tsc に従い分岐する）。`example` を足す。
- `spec-cli-parts.ts` の `'bpmn'` キーは残す。`selective/bpmn.ts` は別名 builder を束ねる。`selective/swimlane.ts` は第4引数ありのまま（自動図の `flows` は帯内なので `connectors` は未使用。渡してあっても無害）。
- `pnpm schema` で作り直す。
- 部品名を変えるかどうかは Q1。

### D10: tree shaking とバンドルの予算

- `bands/swimlane.js` は自動エンジン（配置・描画・検査・置後定義・`edgeBendFindings`）を静的に含む。配置は同期なので遅延読み込みはできず、明示だけの図でもバンドルは増える。U0 スパイクで実測し、本 ADR に記録する。
- `bands/bpmn.js`（別名）は swimlane の実装を束ねる。予算は swimlane 並みに更新する。
- `scripts/check-package-bundles.ts` の予算（Swimlane・BPMN・Selective PPTX Swimlane・spec 部品）を U1 で更新する。`/* @__PURE__ */` 注釈は維持する。
- `exclude` の見張りも直す（round 1 M5）。spec の `bpmn` は単独（`standaloneSpecBands`）から swimlane の組に移す（`bands/bpmn.js` が swimlane の実装を束ねるため、`:215` の `swimlane-rules.js` 除外の前提が崩れる。U0 で崩壊を確認）。改名で効かなくなる `exclude`（`:980, :984` の `'bpmn.js'`/`'bpmn-vertical.js'`）は `layout-swimlane-auto*.js` に直す（黙って no-op にしない。U0 で空振りを確認）。BPMN の `bands` は `['box.js', 'bpmn.js', 'swimlane.js']` に直す。
- U0 の実測（`spikes/0086-bpmn-swimlane/measurements.txt`。検査スクリプトをそのまま複製して測定）: `bands/bpmn.js` は esbuild 138236（+30%）/ Vite 181672（+27%）、`bands/swimlane.js` は esbuild 151099（+60%）/ Vite 197739（+66%）。予算の案（1 割の余裕）: BPMN 153000/200000（今 121000/165000）、Swimlane 167000/218000（今 101500/130000）。`./browser`（`scripts/bundle-size.ts`）も +5592 で上限を超えるので 1085440 → 1092000 に上げる。古い `lib/bpmn*.js` は全バンドルから完全に外れる（esbuild の metafile）。spec の `bpmn`/`swimlane` と Selective PPTX Swimlane の予算は U1 で測り直す。

### D11: テスト方針

- `test/bpmn.test.ts` は別名の振る舞いとして維持し、全 pass させる。新規 `test/swimlane-auto.test.ts` に `swimlane()` の自動 API のテストを書く: (a) 別名の図で PPTX（画像の帯）・`--node-ids` の `data-node`・`locations` が今と同じ（B1）、(b) `via` は説明を出さず `cols: 'auto'` は出す（M1）、(c) `via` は one-story に数えない（M2）、(d) 自動図の中身は辿らず凡例の検査が bpmn と同じ（M3。`focus` と tone 付き task を含む）、(e) `bpmn-deprecated` の warn と 3 例の許容（M4）、(f) 生の `{type: 'bpmn'}` データは直し方を言って throw（m3）。D1 の throw 網羅、`laneOrder`、3 例のバイト一致も書く。`test/source-ref.test.ts` は、自動図の data（`swimlane`）と置後（`bpmn`）の対応に直す（設計 B に固有の更新。U0 で確認）。
- golden の正は `golden-docker.sh`（`pnpm golden` は速い事前確認。AGENTS.md）。既存の swimlane と bpmn の例の差分 0 を示す。新例 `examples/swimlane-auto.ts`（汎用の文言。start・task・xor・end の小さな図）を足して golden に加える。`examples/out` の再生成。
- 各 PR で `pnpm test`、型検査、lint、予算検査（`check-package-bundles`）を通す。

## 決める人への質問

| # | 質問 | 推奨 |
|---|---|---|
| Q1 | JSON spec / MCP の部品名 `bpmn` を残すか、変えるか | **残して委譲**（D9）。プラグイン互換のため。変えるなら名前と時期を別途決める |
| Q2 | `bpmn()` の削除の時期 | **v1.0 で削除**、それまで非推奨 warn（D8）。v0 のあいだは別名が動き続ける |

## 作業の順

1. 本 ADR の設計レビュー（Opus、1 回。round 1 済み、反映済み）→ 仮承認。再レビューは回さない。
2. **U0 スパイク**（済み。`spike/0086-bpmn-swimlane`、マージしない。`spikes/0086-bpmn-swimlane/`）: 判定は条件付き成立。D6 の委譲は端から端まで動いた（内部 layout 形での変換再現を含む。`test/bpmn.test.ts` 33/33 が別名経由で無改変 pass）。3 例は 0 バイト差（再現性あり。PPTX の zip 項目も一致）。`laneOrder` は自動図で動く（許す。throw 落ち不要）。バンドルは D10 のとおり（`./browser` の上げ幅も判明）。`test/bpmn.test.ts` 33/33 と 2 例のバイト一致は親が再実行して裏付けた。
3. **U1 PR**（DSL・配置・別名）: D1〜D8、D10、D11。ファイル移動、DSL・型、別名、非推奨ルール、凡例・`focus`・検査の引き継ぎ、テスト、予算更新。`golden-docker.sh` の差分 0（swimlane・bpmn の既存例）。
4. **U2 PR**（spec・文書）: D9、README、`skills/svg-diagram/`、新例 `examples/swimlane-auto.ts`、schema 再生成、`examples/out` の再生成。
5. 各 PR で Opus のレビューを回し、Blocker / Major がなくなったら merge する。PR ブランチは `origin/main` を merge して更新し、rebase + force-push はしない。

## 注意

- open PR #501（`fix/swimlane-backflow-label`）が swimlane の明示経路（`lib/dsl/swimlane.ts`、`lib/bands/swimlane.ts`、`lib/layout-swimlane.ts` ほか）を触っている。U1 は明示経路の振る舞いを変えない設計だが、同じファイルに足すため衝突しうる。先に merge されるのを待つか、そこから派生させる。衝突は merge で解く。
- 公開リポジトリなので、ADR・PR・コミットにはユーザーの実際の図の文言を書かない。例は汎用の文言にする。
- リリース（npm publish / GitHub release）はしない。プラグインのデプロイもしない。
