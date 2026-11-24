# Tree shaking 移行チェックリスト

対象は [ADR 0080](adr/0080-band-plugin.md) と、実装の `Band` と `LAYOUT_HANDLERS` が扱う全種類。公開ビルダーが同じ帯を作る場合は、その帯の行で派生形も検証する。

各帯の完了には、配布パッケージの入口から最小構成で描画できること、esbuild と Vite の出力に無関係な帯が入らないこと、既存の SVG と該当する他形式の出力・検査が保持されることが必要。試験的な縦積み SVG の検証は移行全体とは別に記録する。

## 共有基盤

- [x] SVG から HTML 出力を分離し、ブラウザの文字測定器を個別に公開する。
- [x] 既存の配置・測定処理を帯ハンドラーの解決元と分離する。
- [x] 子の探索・幅・スコープ・inventory の全帯テーブルを配置コアの外で結び付ける。
- [x] SVG の組み立て、共通の検査、パイプラインから全帯の描画・検査・規則テーブルへの直接依存を外す。
- [ ] 子の探索、ID、reveal、配置のフィードバック、inventory、出力、検査と規則を帯の定義から呼ぶ。
- [ ] 既存と同じ配置処理を選択的な公開入口に接続する。
- [ ] パッケージ入口ごとの実描画、依存の除外、サイズ予算、互換性を CI で全構成に検証する。

## 共通・接続

- [ ] `caption`（個別入口からの SVG と依存除外は検証済み）
- [ ] `spacer`（個別入口からの SVG と依存除外は検証済み）
- [ ] `status`（個別入口からの SVG と依存除外は検証済み）
- [ ] `legend`（明示指定の個別入口からの SVG と依存除外は検証済み。自動生成は移行対象）
- [ ] `connect`（接続線、ラベル、戻り線、端点指定。個別入口からの SVG と依存除外は検証済み）
- [ ] `group`（入れ子・見出し・スタンプの SVG と依存除外は検証済み）

## コンテナ

- [ ] `row`（行、列幅指定、ステップ、戻り線。個別入口からの SVG と依存除外は検証済み）
- [ ] `grouprow`（グループと箱を含む行の SVG、枠の伸縮、依存除外は検証済み）
- [ ] `grid`（グリッド、行・列スパン。個別入口からの SVG と依存除外は検証済み）
- [ ] `areas`（領域・自由配置。個別入口からの SVG と依存除外は検証済み）
- [ ] `image`（data URI と Node.js ファイル読み込みの個別 SVG、重ねた帯、注釈、接続、依存除外を検証。他形式は移行対象）

## テキスト・基本図形

- [ ] `box`（縦積み SVG は個別バンドルで検証済み）
- [ ] `banner`（個別入口からの SVG と依存除外は検証済み。派生形は未検証）
- [ ] `raw`（個別入口からの SVG と依存除外は検証済み）
- [ ] `math`（Node.js の個別入口からの SVG と依存除外は検証済み）
- [ ] `wordart`（個別入口からの SVG と依存除外は検証済み）
- [ ] `curve`（個別入口からの SVG と依存除外は検証済み）
- [ ] `pyramid`（個別入口からの SVG と依存除外は検証済み）

## 数量・座標

- [ ] `gantt`（縦積み SVG は個別バンドルで検証済み）
- [ ] `timeline`（時系列・数値軸。個別入口からの SVG と依存除外は検証済み）
- [ ] `chart`（種類別の個別 SVG 入口とバンドル検証）
  - [x] `waterfall`
  - [x] `tornado`
  - [x] `heatmap`
  - [x] `stacked`（積み上げ棒・100% 積み上げ棒・メッコ。依存検証は積み上げ棒の入口で実施）
  - [x] `radar`
  - [x] `treemap`
  - [x] `sankey`
  - [x] `catplot`
  - [x] `distplot`
  - [x] `multiplot`
  - [x] `regplot`
  - [x] `clustermap`
  - [x] `bubble`
  - [x] `butterfly`
  - [x] `combo`
  - [x] `harvey`
  - [x] `compare`
  - [x] `pert`
  - [x] `causal`
  - [x] `dependency`
- [ ] `bars`（段階表示、範囲棒、パレート、ヒストグラムと、個別入口からの SVG・依存除外は検証済み）
- [ ] `people`（個別入口からの SVG と依存除外は検証済み）
- [ ] `dots`（個別入口からの SVG と依存除外は検証済み）
- [ ] `plane`（段階表示と、個別入口からの SVG・依存除外は検証済み）
- [ ] `quadrant`（SWOT、2×2 など。個別入口からの SVG と依存除外は検証済み）

## フロー図形

- [ ] `chevron`（個別入口からの SVG と依存除外は検証済み）
- [ ] `funnel`（個別入口からの SVG と依存除外は検証済み）
- [ ] `cycle`（個別入口からの SVG と依存除外は検証済み）
- [ ] `venn`（個別入口からの SVG と依存除外は検証済み）
- [ ] `concentric`（個別入口からの SVG と依存除外は検証済み）
- [ ] `emblem`（個別入口からの SVG と依存除外は検証済み）
- [ ] `valueChain`（個別入口からの SVG と依存除外は検証済み）

## 表・画面・会話

- [ ] `sequence`（個別入口からの SVG と依存除外は検証済み）
- [ ] `table`（行見出しを含む個別入口の SVG と依存除外は検証済み。RACI、FMEA、比較表などの派生ビルダーは移行対象）
- [ ] `swimlane`（レーン間の接続・段階表示と、個別入口からの SVG・依存除外は検証済み）
- [ ] `wireframe`（個別入口からの SVG と band の依存除外は検証済み。部品単位の依存分離は移行対象）
- [ ] `screens`（画面遷移。個別入口からの SVG と依存除外は検証済み。状態マトリクスは移行対象）
- [ ] `comic`

## グラフ・図式

- [ ] `tree`（組織図・マインドマップ・子 band の段階表示と、個別入口からの SVG・依存除外は検証済み）
- [ ] `states`（状態遷移図・フローチャートの SVG と依存除外は検証済み。アロー・ダイヤグラムは移行対象）
- [ ] `cause`（causeTree、連関図、PDPC の SVG と依存除外は検証済み。なぜなぜ分析と RCA 規則は移行対象）
- [ ] `cloud`（前提・解消策と、個別入口からの SVG・依存除外は検証済み）
- [ ] `classes`（個別入口からの SVG と依存除外は検証済み）
- [ ] `bpmn`（横・縦の配置と、個別入口からの SVG・依存除外は検証済み）
- [ ] `fta`（個別入口からの SVG と依存除外は検証済み。RCA 規則は移行対象）
- [ ] `bowtie`（個別入口からの SVG と依存除外は検証済み。RCA 規則は移行対象）

## 合成・入出力

- [x] composer の `canvas`、`hero`、`iconRow`、`versus` がそれぞれ使用する帯だけを引く。代表作例で従来の SVG と照合済み。
- [ ] spec 部品ごとの入口が必要な帯だけを引き、全部入りの入口は既存の部品とスキーマを保つ。
  - [x] フローチャート・ファネル・ピラミッドを `spec/selective` で描画。ピラミッドの個別バンドルと既存スキーマの同値を検証。
  - [x] `cause-tree`、`cloud`、`value-chain`、`mindmap`、`quadrant`、`chevron`、`cycle`、`state-diagram`、`gantt`、`venn`、`table`、`journey-map`、`raci`、`swimlane`、`sequence` を追加し、既存カタログの SVG と照合。表の単独バンドルを検証。
  - [x] `bars` から `strategy-canvas` までの数量図 12 種類と、`bpmn`、`class-diagram`、`pert`、`timeline`、`tree`、`dependency-network` を追加。ヒートマップの単独バンドルを検証。
  - [x] 品質・比較の 14 部品（`histogram`、`scatter`、`control-chart`、`check-sheet`、`range-bars`、`boxplot`、`qfd`、`why-why-table`、`concentric`、`harvey`、`compare`、`mekko`、`butterfly`、`combo`）を追加。箱ひげ図の単独バンドルを検証。
  - [x] `fault-tree`、`bowtie`、`fmea`、`is-is-not`、`matrix`、`pdpc`、`relation-diagram`、`causal-loop`、`why-why-tree` を追加。障害木の単独バンドルを検証。
  - [x] `affinity`、`steps`、`versus`、`burndown`、`burnup`、`board` を追加。全 65 部品の個別入口、schema、作例を確認。
  - [ ] 図全体の設定、edge・CLI の配線、全入口の単独バンドル検証。
- [ ] HTML、PPTX、該当する Excel のアダプターを帯ごとに選べる。
  - [x] HTML で箱・行・グリッド・キャプション・バナー・グループ・表のアダプターを選べる。SVG に切り替えた帯を報告し、strict ではエラーにする。
  - [x] PPTX で箱系のアダプターを選択し、絵への切り替えを報告できる。PNG 生成・文字の輪郭化は呼び出し側から渡す。
  - [x] PPTX の既存の専用レンダラーを個別の入口に移す。表の単独バンドルを検証。
  - [x] PPTX のグループ・スイムレーンをまとめる処理を個別フックに分離。
  - [x] PPTX のフロー図形・ピラミッド・タイムラインを相互に除外できる。フロー図形は種類に依存しない図形変換を共有する。
  - [ ] Excel の対応と出力全体の互換性。
- [ ] Node / ブラウザの測定と PNG / ZIP の依存を入口ごとに分離する。
- [ ] 既存のパッケージ入口、CLI、デッキ、Markdown、MCP の描画互換性を確認する。
