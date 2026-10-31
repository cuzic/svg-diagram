---
name: svg-diagram
description: 宣言的な DSL で文書向けの SVG 図（構成図・フロー・スイムレーン・シーケンス図・表・画面のワイヤーフレーム・画面遷移図・組織図・マインドマップ・状態遷移図・ガント・UML クラス図・BPMN 風の業務フロー）を作り、検査して仕上げる。図やワイヤーフレームを作る・直すとき、仕様書や設計書に図を入れるときに使う。
argument-hint: "[作りたい図 / 直したい図のソース]"
keywords:
  - svg
  - diagram
  - wireframe
  - 図
  - ワイヤーフレーム
  - 画面遷移図
  - スイムレーン
  - シーケンス図
  - 組織図
  - マインドマップ
  - 状態遷移図
  - ガントチャート
  - クラス図
  - BPMN
triggers:
  - 図を作って
  - ワイヤーフレーム
  - 画面遷移図
  - svg-diagram
  - 図を直して
  - 組織図を作って
  - 状態遷移図を作って
  - ガントチャートを作って
  - クラス図を作って
---

# svg-diagram で図を作る

図は SVG を直接書かず、`*.ts`（DSL）で宣言して生成する。レイアウト・重なり・コントラストの検査は DSL 側が行う。
SVG は生成物としてコミットし、Markdown からはそれを参照する。**SVG を手で編集しない**（ソースを直して再生成する）。

この入口には、**よく使うことだけ**を書く。特定の図の種類（TOC・チャート・ワイヤーフレーム・canvas ほか）と、手順の細かい指定は、下の「領域別の案内」のファイルを、その図を作るときに開く。

## 手順（要点。細かい指定と落とし穴は `references/workflow.md`）

1. **ソースを書く**: `import {diagram, ...} from 'svg-diagram'` / `export default () => diagram({theme: 'blue', title: '図の題名'}).add(...)`。文書向けは `theme: 'blue' | 'teal' | 'amber'`、`title` は必須、幅は 940px 以下。`.ts` なので、ビルドの前に `npx tsc -p .` を通す（型が `connect()` の参照先などを保証する）。
2. **ビルド**: `svg-diagram build src.ts --out out.svg`（重なり検査と lint まで走る。失敗しても前回の SVG は消えないので、`✗` の行を見落とさない）。PNG も要るなら `--png <dir>`。
3. **ルール検査**: `svg-diagram check --strict src.ts`（コントラスト・凡例・線の交差・幅・密度・題名。意図した指摘は `.svg-diagram.json` の `accept` に理由つきで書く）。
4. **目で見る**: `svg-diagram preview out.svg out.png 2` で PNG にして、画像として読む（配置は検査を通っても、読みやすさは見ないと分からない）。SVG がソースより古いと赤い帯が出る。出たら作り直す。
5. **ズレ検査**: `svg-diagram check --drift --svg-dir <SVG の置き場> src.ts`（SVG が最新のソースから生成されたものか）。再生成まで比べるなら `--rebuild`（図が多いときも、並列＋成功のキャッシュで速い。毎回確かめたいなら `--no-cache`、並列の数は `--jobs N`）。手書き SVG を DSL に直したときは `svg-diagram diff --text 旧.svg 新.svg [--strict]`（旧の文字・数値が新に残っているか。折り返しや全角半角は吸収。欠けた語が出たら、図に戻すか意図して外したと確かめる）。
6. **文書との整合**: `svg-diagram check --docs <docs> --svg-dir <SVG の置き場>`（参照先・代替テキスト・孤立した図・キャプションの連番）。表を図に置き換えたときは `check --covers`。
7. **まとめて目視・人に渡す**: `svg-diagram contact a.svg b.svg --out sheet.png`、`svg-diagram deck a.ts b.svg --out deck.html`。

## 部品（よく使うもの。全部は README の「部品」表）

| 部品 | 使い方 |
|---|---|
| `diagram({theme, title, sourceLine})` | 図の入れ物。`.add(...)` に部品を並べる。`sourceLine` は出典行 |
| `caption(text, {bold, tone: 'text'})` | 図の見出し・一言。ほぼ全部の図の 1 行目 |
| `box({title, body, icon, tone, id})` | 箱。`tone`: plain / accent / new / changed / removed / muted / danger（`solid`、`solid-danger` は強調） |
| `row([a, b], {cols})` | 横並び。`cols: [6, 6]`（12 列）。子は `box` / `group` / `caption` / `banner` ほか |
| `group(children, {title, tone})` | ラベル付きの枠。入れ子可 |
| `connect(a.right, b.left, {label, route})` | 矢印。`a` は `const a = box({id: 'a'})` のハンドル（id を打ち直さない） |
| `steps([{title, body, icon}], {numbered: true, highlight: 2})` | 日付のない順序だけの出来事。番号バッジと矢印つき |
| `table(columns, rows, {title})` / `cell(text, {mark})` | 見出し付き表。`mark: 'ok' / 'mid' / 'ng' / 'best'` で ○△×◎ |
| `banner({text, tone})` | 帯（章の見出しや結論の 1 行） |
| `versus(left, right, {shared})` | 左右の対比。各側は `{title, children, tone, id}` |
| `stat(value, label, {source, confidence})` | 大きな数字。数字の出典は `source` / `confidence` |
| `spacer(h)` | 縦の余白 |

接続線・凡例・トーンの使い分けなどは、README の該当節。`raw()` で SVG を手書きする前に、まず部品を探す。
新しい部品は「同じパターンが 3 回出たら」が原則。既存の図の出力が変わらないこと（回帰）を確認してから足す。

## くり返しは、まとめて書く

- 12 列の行: `row([a, b], {cols: [6, 6]})`（`col:` を手で数えない）。`row([a, b, c], {cols: 12})` のように子に `span` を書かなければ、12/n 列ずつの等分（3 個なら 4+4+4）。
- `row()` の子は `box()` / `group()` のほか `caption()` / `banner()` なども可（枠なし `group()` に自動で包まれる）。`versus()` の `children` は配列（縦積み）、`direction: 'row'` で横並び。共通部への接続線は垂直（矢頭なしは `connectArrow: 'none'`）。
- 折り返しは文節単位（既定 `wrap: 'phrase'`）: カタカナ・漢字の連続は割れない。1 文字ずつ折りたいときだけ `diagram({wrap: 'char'})`。別の行の N 列目への矢印は、`row({id: 'top'})` の `top.col(5).top`。
- 枠付きの `group` を `row` に並べて高さがそろうと、低いほうの中身は余りの中で縦中央に寄る。`group({valign: 'top'})` で上詰め、`'stretch'` で箱 1 つが余りを埋める（余りが 16px 未満なら動かない）。
- 接続線: `diagram({connectDefaults: {chip: true, route: 'elbow'}})` と `d.connect(from, to, {label})`。
- ワイヤーフレームの外枠: `diagram({wireframeDefaults: {appbar: {title, nav}}})` と、画面ごとの `shell: {active: '在庫'}`。
- 状態の一覧: `stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '理由'}})`。
- 表の記号セル: `cell('通る', {mark: 'ok' | 'mid' | 'ng' | 'best'})`。座標平面（軸・点・寸法線）は `plane()`。点ラベルは `labelAt` を省くと寸法線・補助線・他ラベルを避けて自動で置く。軸の `categories: [...]` でレーン名を目盛りにできる（`max` は個数 + 1）。木・マインドマップのノードに任意の band を使うには `{label, band: chevron([...]), w}`（`examples/tree-band-nodes.ts`）。親の band の中の段から線を出すには子に `from: 'id'`（漏斗。`examples/tree-band-funnel.ts`）、木の線を消すには `edges: false`。Wardley Map は `plane({stages: [...]})` と点の `evolves: {to}`（`examples/wardley-map.ts`）。サービスブループリントは `swimlane` のレーン（物的証拠・顧客の行動・表の業務・裏の業務・支援システム）に `boundaries: [{between: [上, 下], label}]` で相互作用線・可視線・内部相互作用線を引く（`examples/service-blueprint.ts`）。`raw()` で SVG を手書きする前に、これらを探す。

## 領域別の案内（その図を作るときに開く。入口からは 1 段）

| 作りたい・直したい図 | 開くファイル |
|---|---|
| 組織図・マインドマップ・状態遷移図・ガント・クラス図・BPMN・数値の時間軸・`tree` などの自動配置、幅に収まらない・折れが多い | `references/auto-layout.md` |
| TOC（因果ツリー・現状/未来現実/前提条件/移行ツリー・クラウド）、故障の木・なぜなぜ分析の木・ボウタイ図、戻り矢印の交差の見せ方（`hop`） | `references/toc.md` |
| QC 七つ道具・新 QC 七つ道具（パレート・ヒストグラム・散布図・管理図・親和図・連関図・PDPC・アロー・ダイヤグラム） | `references/qc.md` |
| コンサル系のチャート（ウォーターフォール・レーダー・ヒートマップ・折れ線・積み上げ・ツリーマップ・サンキー・バブルほか） | `references/charts.md` |
| 象限図・分類マトリクス | `references/quadrant.md` |
| 人間関係の図（Arbinger の「箱」: 共謀・氷山・イメージの型・箱から出る流れ） | `references/relationship.md` |
| ポジティブ心理学の図（PERMA・フロー・拡張–形成・幸福の決定要因） | `references/positive-psychology.md` |
| 枠が決まったキャンバス（BMC・SWOT・リーン・VPC ほか） | `references/canvas.md` |
| 意味付き表・意味付きネットワーク（PERT・因果ループ・依存ネットワーク） | `references/semantic.md` |
| ワイヤーフレーム・画面遷移図・画面仕様（`wireframe` / `screens` / `stateMatrix`） | `references/wireframe.md` |
| 免疫マップ（Immunity to Change）の面談を図にする（マップ・検証の表・自己調整のループ・蒸発雲。専用部品は無い） | `references/immunity.md` |
| 絵記号（アイコン）を入れる | `references/icons.md` |
| クラウド・ネットワークの構成図（`node` / `group` / VPC） | `references/cloud.md` |
| ビルド・検査・目視・文書との整合・渡し方の細かい指定、`draft` / `appearance` / `canvas` の最小文字など | `references/workflow.md` |

## 公開してよい内容か

図のソースは、案件の内容（社名・画面・数値）を含みやすい。ツール本体のリポジトリには**架空の例**だけを置き、案件の図は案件側のリポジトリに置く。
