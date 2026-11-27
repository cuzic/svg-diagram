# ADR 0086 Opus レビュー round 1

- 対象: `docs/adr/0086-bpmn-into-swimlane.md`（基点 `origin/main` 064997b1、未コミットの初版）
- 判定: 変更を求める（Blocker 1・Major 5・Minor 6）。反映後は round 2 を回さず U0 スパイクで判断する（ハンドオフ: 設計レビューは 1 回まで）。
- 確かめたこと: 下の各指摘の `ファイル:行` を基点のコードで読んだ。`examples/out/bpmn.svg` は `<title>` だけで `<desc>` がない。`git grep -n -i bpmn -- '*.ts' '*.json' '*.md'` は 544 件（ADR の記載と一致）。

案 B（swimlane 帯に 2 つの配置エンジン、置いた後は `LaidOutBpmn`）は成り立つ。swimlane 定義は `internal: true` なので、`core.ts:196/244` と `figure-definitions.ts:28` は `outputDefinitions` を読む。穴は、`outputDefinitions` を読まない経路と、コードと合わない主張にある。

## 指摘と反映

| ID | 重さ | 指摘 | 根拠 | 反映 |
|---|---|---|---|---|
| B1 | Blocker | `FULL_DEFINITIONS` から `bpmn` を外すと、型名で定義を引く経路がみな壊れる | `placed-definitions.ts:11-13`（`outputDefinitions` を読まない）。使う所: `pptx/image-band.ts:9` → `emit.ts:24-26` が throw、`legacy-core.ts:319`・`dsl/render.ts:70`（`--node-ids`）、`locations-map.ts:37/41/78/96`、`deck-render-spec.ts:32` | D6: `FULL_DEFINITIONS` の `bpmn` を残し `swimlaneAutoDefinition` を指す。`UNDEFINED_BANDS` は空のまま。D11 (a) |
| M1 | Major | swimlane の `describe` で別名に `<desc>` が増え、D8 のバイト一致・D7 の PPTX 無変更と矛盾 | `core.ts:405`、`emit-svg-core.ts:69-72`、`diagram-summary.ts:29` → `diagram-description.ts:45`、`pptx/slide.ts:14` | D6: `via: 'bpmn'` は説明を出さず、`cols: 'auto'` で書いた図は出す（Q 化しない。新 API で互換影響なし）。D11 (b) |
| M2 | Major | `one-story` は laid-out 基準という主張が誤り。データの帯を数える | `bands/swimlane.ts:21-23`、`types/index.ts:68`（`LaidOutDiagram extends DiagramData`） | D6: `via: 'bpmn'` は数えない。`cols: 'auto'` で書いた図は数える。D11 (c) |
| M3 | Major | 自動図の手順のデータの形が決まっておらず、箱の帯として辿られる。「`kind` を持つ手順は外す」では task が漏れる | `SwimlaneStepBand extends BoxBand`（`types/sequence-table-swimlane.ts:183-204`）、`band-children.ts:20`、`band-def.ts:243`、`legend-notation.ts:77`、`BpmnNode.kind` は省略可（`types/diagrams.ts:406`） | D1: `SwimlaneBand` を判別共用体にし、自動図は `steps`/`cols` を持たず `nodes` を持つ。D6: 辿る 2 か所は自動図で `[]`。D7 の凡例の行。D11 (d) |
| M4 | Major | `bpmn-deprecated` が warn だと `check --strict examples/*.ts` が落ちる。例を書き換えると golden のバイトが変わる | `check-diagram.ts:534`、golden の `<metadata>` の `sourceSha256` | D8: `warn` のまま、3 例はリポジトリの `.svg-diagram.json` で許容（Q 化しない。ハンドオフは「非推奨の警告」と定める）。D11 (e) |
| M5 | Major | D10 が予算しか見ておらず、`exclude` の見張りが漏れる | `scripts/check-package-bundles.ts:113, 215`（spec `bpmn` が `swimlane-rules.js` を含まない前提）、`:980, :984`（改名で効かなくなる `'bpmn.js'`）、`:981-982` | D10 に `exclude` の直しを足す。U0 で実測する |
| m1 | Minor | `LaneCheck` が 6 本を超えると型の誤りで、縦の bpmn（8 本）を `swimlane()` に移せない | `strict.ts:221-224` | D1: `cols: 'auto'` のときの上限を 8 にする |
| m2 | Minor | `bpmn()` の戻り値の型が実体と合わなくなる | `lib/dsl/bpmn.ts:16` | D1: 戻り値の型は変わると明記し、README に書く |
| m3 | Minor | 生の `{type: 'bpmn'}` データの扱いが無い | `legacy-core.ts:46-52` | D6: 直し方を言う文言で throw する。D11 (f) |
| m4 | Minor | swimlane の `layout` は内部の形で、bpmn の公開の形の変換を再現する必要がある | `bands/swimlane.ts:29-33`、`bands/bpmn.ts:26-31`、`core.ts:256-260` | D6 に明記し、U0 で確かめる |
| m5 | Minor | `legend-notation.ts` の置き換えでラチェットが減るという主張が示されていない | `legend-notation.ts:45, 79, 81`、`test/band-type-literals.test.ts:72` | D6: 判定を 1 つの helper にまとめ、3 → 1。上限を U1 で 15 に下げる |
| m6 | Minor | D11 が `pnpm golden` を正にしている（AGENTS.md と矛盾）。spec の部品が読む `band.cols` の自動図での値が無い | AGENTS.md、`spec-parts/swimlane.ts:4, 77` | D11: 正は `golden-docker.sh`。D9: 自動図は `cols` を持たず列数検査の対象外 |

## 質問にしなかった 2 件（ADR で決めた）

- M1 の説明文: `via` は出さず、`cols: 'auto'` で書いた図は出す（D6）。新しい書き方の振る舞いで互換影響がないため、決める人への質問にしない。
- M4 の重さ: `warn` のまま、3 例は `.svg-diagram.json` で許容（D8）。ハンドオフが「非推奨の警告」と定めているため、質問にしない。
