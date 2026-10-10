# svg-diagram

文書（仕様書・設計書）に入れる図を、宣言的な DSL で作るツール。構成図、フロー、スイムレーン、シーケンス図、表、**画面のワイヤーフレームと画面遷移図**に対応する。
レイアウト、重なり、コントラスト、ルール（WCAG・凡例・線の交差・幅）の検査まで自動で行う。SVG を手で描かず、ソース（`*.mjs`）を直して再生成する。

![在庫管理アプリのワイヤーフレーム（例）](examples/out/inventory-wireframe.svg)

## 導入

Node.js 20 以上と pnpm が必要。

    git clone https://github.com/cuzic/svg-diagram.git
    cd svg-diagram
    pnpm install                      # playwright-chromium（文字幅の測定に使う）も入る
    ln -s "$PWD/bin/svg-diagram" ~/.local/bin/svg-diagram

`svg-diagram preview` は PNG 化に Chrome / Chromium を使う（`CHROME=/path/to/chrome` で指定できる）。
動作確認: `pnpm test`、`svg-diagram build examples/inventory-wireframe.mjs --out /tmp/x.svg`。

## 使い方

    svg-diagram build <source.mjs>... [--out file.svg]   # 既定の出力: ./svg/<name>.svg
    svg-diagram check [--strict] [--verbose] <source.mjs>...        # ルール検査（SVG は書かない）
    svg-diagram check --drift [--svg-dir DIR] [--rebuild] <source.mjs>...   # 生成済み SVG が最新か
    svg-diagram lint  [file.svg] [--strict]
    svg-diagram preview <in.svg> <out.png> [scale]

ソース: `import {diagram, box, ...} from 'svg-diagram'` / `export default () => diagram({theme: 'blue'})...`
`theme`: blue | teal | amber（docs 向け。スライド警告なし）。`day: 1|2` は研修スライド用（slide-fit 警告あり）。

## 部品
| 部品 | 用途 |
|---|---|
| caption / box / banner / spacer / raw | 基本。box は tag・tagAt・tone(new/changed/removed/accent/muted/danger/plain) |
| row / grid | 横並び（row は cols:N の共有列グリッド、span/col） |
| group(children, {title, tone, titleAlign}) | ラベル付きの枠。入れ子可 |
| connect / branch | 矢印。route(straight/elbow/loop-under)、arrow(end/both/start/none)、line(solid/dashed/dotted/double)、chip、labelAt、アンカー `id:side@0.2` |
| legend(items) | 線種・トーンの凡例 |
| swimlane(lanes, steps, {flows, phases}) | スイムレーン図。レーン=担当（人・チーム・システム）、列=時間。引き継ぎの矢印を自動で向きづけ。`col` で並行作業を揃える |
| sequence(actors, steps) | シーケンス図。message / self / note / divider、自動番号 |
| table(columns, rows, {title}) | 見出し付き表（ER の entity 兼用）。セルは {text, tone, bold, mono} |
| wireframe(root, {title, tag, h, notes, skeleton}) | 画面 1 枚のローファイ・ワイヤーフレーム + 番号つき注釈欄。部品は `wf.*`（下記）。`n:` で番号の丸、`mark:'new'/'changed'` で新規・改修の枠 |
| screens(items, {cols, gap, rowGap, h, skeleton}) | 画面のサムネイルを並べる（画面遷移図）。item の `at:[行, 列]`（列は小数可）で配置、各 `id` を `connect()` で結ぶ。`skeleton` で文字を帯に |
| pyramid / curve | ピラミッド、曲線 |

`wf.*`: col / row / card / spacer、text / btn / input / select / chip / tabs / appbar / seek、kv / stat / list / table / alert、map / video / heat / pointcloud / chart / image。
map・video 等は残りの高さを埋める。`overlay` / `overlayRight` でチップ、`label` / `stamp` で枠内の文字。

新部品は「同じパターンが 3 回出たら」が原則だが、ユーザーが明示したときは例外。
既存の `day:` 図の出力が変わらないこと（回帰）を確認してから足す。

## check のルール（lib/rules.mjs）
`legend-missing` / `legend-incomplete`（`legend: 'auto'` で補える）、`a11y-text-contrast`（WCAG 4.5:1）、`a11y-nontext-contrast`（3:1）、
`a11y-no-title`、`swimlane-lane-order`（レーン間の距離が最小になる順を提案。`fixed: true` のレーンは動かさない）、`swimlane-lanes`（6 本まで）、
`edge-crossings`、`one-story`、`doc-width`（940px 以下）、`density`、`arrow-labels`（情報）。
残す警告は `diagram({accept: {'rule-id': '理由'}})`。`theme:` の図（文書向け）だけが対象で、`day:` の図（スライド）は従来どおり。
文書向けの図の SVG には `role="img"`・`<title>`・`<desc>`・生成元（ソースの SHA-256）が入る。`npm test` / `pnpm test` でルールの単体テスト。

## 例
`examples/` に架空の在庫管理アプリの例がある（生成済みの SVG は `examples/out/`）。

| ソース | 内容 |
|---|---|
| `inventory-wireframe.mjs` | 画面のワイヤーフレーム。番号つき注釈、トースト、確認ダイアログ、地図の凡例 |
| `inventory-flow.mjs` | 画面遷移図。画面のサムネイルを並べ、`connect()` で結ぶ |

## Claude Code のスキル
`skills/svg-diagram/SKILL.md` は、Claude Code で図を作る手順（ビルド → 検査 → スクリーンショットで目視 → ズレ検査）をまとめたスキル。
`ln -s "$PWD/skills/svg-diagram" ~/.claude/skills/svg-diagram` で使える。

## ライセンス
MIT
