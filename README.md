# svg-diagram

文書（仕様書・設計書）に入れる図を、宣言的な DSL で作るツール。構成図、フロー、スイムレーン、シーケンス図、表、**画面のワイヤーフレームと画面遷移図**に対応する。
レイアウト、重なり、コントラスト、ルール（WCAG・凡例・線の交差・幅）の検査まで自動で行う。SVG を手で描かず、ソース（`*.ts`。`*.mjs` も可）を直して再生成する。

![在庫管理アプリのワイヤーフレーム（例）](examples/out/inventory-wireframe.svg)

## 導入

Node.js 22.18 以上と pnpm が必要。

### 案件のリポジトリに入れる（推奨）

npm パッケージとして配る（コンパイル済みの `dist/`＝JS と型定義が入っている）。`pnpm add` だけで入り、ブラウザのダウンロードはない。リリースタグ（`dist/` 入り）からも入る: `github:cuzic/svg-diagram#vX.Y.Z`。

    pnpm add -D typescript @types/node svg-diagram
    pnpm exec svg-diagram init          # package.json に "type": "module"、tsconfig.jsonを用意
    pnpm exec svg-diagram typecheck     # 図のソースを型検査（案件側の tsc を使う）
    pnpm exec svg-diagram build diagrams/*.ts

**ブラウザ（`playwright-chromium`）は要らない。** レイアウト、`build`（lint を含む）、`check`、`lint`、`show`、`preview`、`contact`、`renderSource` は、どれもブラウザなしで動く（文字幅はフォントファイルから、描画は resvg、描画後の検査は SVG の幾何から）。ブラウザが要るのは、実ブラウザで確かめたいときだけで、`pnpm add -D playwright-chromium`（pnpm 10 以降は `pnpm approve-builds` も）と `pnpm exec playwright install chromium` で足す: `lint --engine browser`、`show` / `preview` / `contact` の `--engine chromium`、`"measure": "chromium"`、`diagram({slide})` の空き寸法の実測（Slidev のテーマが実際に空ける余白を測る）。
CI で「SVG が最新か」だけ見るなら `svg-diagram check --drift diagrams/*.ts`（ソースのハッシュと SVG の埋め込み情報を比べるだけ。`--rebuild` を付けても、ブラウザは要らない）。

### 開発（このリポジトリ）

    git clone https://github.com/cuzic/svg-diagram.git
    cd svg-diagram
    pnpm install
    ln -s "$PWD/bin/svg-diagram" ~/.local/bin/svg-diagram   # dist/ が無ければ .ts を直接実行する

リリース: `package.json` の version を上げてから `pnpm release`（`dist/` を含むコミットにタグ `vX.Y.Z` を付ける。push は手動。そのコミットは main に入れない）。

**たくさんの図を作るとき**は、ソースを 1 回の呼び出しにまとめる（`svg-diagram build diagrams/*.ts --out-dir public/svg`）。文字幅の測定と lint の描画を、1 つのブラウザで済ませる（ソースごとに呼ぶと、そのたびにブラウザを起動して遅い）。
反復の作業中は `--no-lint` で lint を省ける（仕上げの build や `svg-diagram check` で通す）。
`--stale` を付けると、SVG が今のソース・ツールの版・`.svg-diagram.json` から作られたものならスキップする。判定に使うのは SVG に埋め込んだ生成元の情報（ソース・import しているローカルファイル・ツールの版・設定の各ハッシュ）。共通部品を直せば、それを使う図は古いと判定される。import は静的に読むだけなので、相対パスの import だけが対象（`tsconfig` の `paths` の別名や、変数で組み立てた `import()` は追えない。後者は build が警告する）。

`svg-diagram preview` / `contact` / `show` は SVG をブラウザなしで描く（Rust 製の resvg。フォントは、文字幅の測定に使うのと同じファイルを、その図で使う字だけに切り詰めて渡す。resvg は描くたびにフォントを丸ごと解析し直すので、14MB の日本語フォントだと 1 枚 3 秒かかるが、切り詰めると 50〜100ms で、画素は同じ）。`--engine chromium` を付けると、実ブラウザが `<img>` として描いた絵になる（`playwright-chromium` が要る）。resvg が読めない環境（ビルド済みバイナリがない）では、`--engine` を省くと自動でブラウザに切り替わる。
`svg-diagram show` は人が端末で見るためのコマンド（Windows Terminal 1.22 以降、WezTerm、foot など sixel 対応の端末）。文書の `<img>` と同じ読み方（XML）で描くので、整形式でない SVG はエラーになる。`.ts` は検証に落ちても描き、問題を stderr に出して終了コード 1 にする。tmux 3.4 未満は sixel を通さないので、`--passthrough`（`set -g allow-passthrough on` が要る）か `--png FILE` を使う。端末のない環境（エージェントなど）は `--png FILE` で書いて画像として読む。
動作確認: `pnpm test`、`svg-diagram build examples/inventory-wireframe.ts --out /tmp/x.svg`。

## 使い方

    svg-diagram init [dir]                               # 案件の初期設定（package.json の type、tsconfig.json）
    svg-diagram typecheck                                # 図のソースの型検査
    svg-diagram build <source.ts>... [--out file.svg | --out-dir DIR] [--stale] [--no-lint]   # 既定の出力: ./svg/<name>.svg
    svg-diagram build <source.ts> --dark --transparent   # 暗い配色／背景の矩形なしで描く（図の appearance / transparent を上書き）
    svg-diagram build <source.ts> --html                 # <name>.html も書く（文字・箱・表・線・矢印・曲線を HTML/CSS で。docs/adr/0006）
    svg-diagram check [--strict] [--verbose] <source.ts>...        # ルール検査（SVG は書かない）
    svg-diagram check --drift [--svg-dir DIR] [--rebuild] <source.ts>...   # 生成済み SVG が最新か（--rebuild: 再生成と比べ、違いを言葉で説明）
    svg-diagram check --docs DIR [--svg-dir DIR] [--src-dir DIR] [--map]   # 文書（Markdown）と図が食い違っていないか（--map: 図・ソース・SVG・文書の対応表を Markdown で出す）
    svg-diagram notes <source.ts>                        # 図の番号つき注釈を Markdown のリスト（1. **題名**：本文）で出す。文書に貼る
    svg-diagram diff old.svg new.svg                     # 2 つの SVG の違いを言葉で（見た目が変わるか）
    svg-diagram contact a.svg b.svg ... --out sheet.png [--cols N] [--width PX]  # 図の集まりを 1 枚に並べて、一度に目視する
    svg-diagram lint  [file.svg ...] [--strict] [--fix] [--engine geometry|browser]   # 描画後の検査も、既定は SVG の幾何から（ブラウザなし）
    svg-diagram preview <in.svg> <out.png> [scale] [--engine resvg|chromium]   # 既定の倍率 2
    svg-diagram show <file.svg|file.ts>... [--png FILE] [--scale N] [--width PX] [--engine resvg|chromium]   # ターミナルに sixel で直接表示（.ts は SVG を書かずに作って描く）

型もすべて同じ所から取れる: `import type {WfNode, TableCell, TextTone, RawColorTone} from 'svg-diagram'`。変数に切り出した表のセルは `cell('通る', {tone: 'accent'})` で作ると、tone が文字列に広がらない（`as const` でも可）。`row()` に入れられるのは `box()` と `group()`、`grid()` は `box()` だけ（違うものを入れると実行時エラー）。

ソース: `import {diagram, box, ...} from 'svg-diagram'` / `export default () => diagram({theme: 'blue'})...`
`theme`: blue | teal | amber（docs 向け。スライド警告なし）。`day: 1|2` は研修スライド用（slide-fit 警告あり）。

## 部品
| 部品 | 用途 |
|---|---|
| image(src, {alt, marks, labels}) | 絵（PNG / JPEG / GIF / WebP）を部品として置き、上に印（`marks`）と文字（`labels`）を重ねる。ファイルは data URI で SVG に埋め込まれる（下の「絵を置く」） |
| caption / box / banner / spacer / raw | 基本。box は tag・tagAt・tone(new/changed/removed/accent/muted/danger/plain、box / banner / stat は solid / solid-danger も) |
| row / grid | 横並び（row は cols:N の共有列グリッド、span/col。`cols: [6, 6]` と span を並べて書ける。`id` を付けると、`r.col(5).top` で N 列目を接続点にできる） |
| node({icon, label, sub, size, frame}) | 構成図の 1 点: アイコンを大きく（既定 48px）中央に置き、名前を下に付ける。枠は付けない（`frame: true` で付く）。`row()` / `grid()` に並べ、`group()` でネットワーク・VPC・ゾーンの境界を作り、`connect()` で結ぶ（下の「構成図（クラウド・ネットワーク）」） |
| group(children, {title, tone, titleAlign, flex, width, span, col}) | ラベル付きの枠。**入れ子可**（ホスト > コンテナ > プロセス）。`row([group(...), group(...)])` で横に並べると、枠の高さは一番高いものにそろう（`flex` / `width` / `span` / `col` は box と同じ。`arrows: 'between'` は不可）。中の box の id も、`connect()` の参照先になる |
| versus(left, right, {shared, connectLabels}) | 左右の `group()` を 12 列の半分ずつに並べる対比。各部は `{title, children, tone, id}`。`shared` を付けると、その共通部を下に置いて左右から接続する（3 部すべてに `id` が必要）。接続ラベルは `connectLabels.left` / `.right` |
| connect / branch | 矢印。route(straight/elbow/loop-under)、arrow(end/both/start/none)、line(solid/dashed/dotted/double)、weight(strong)、chip、labelAt、アンカー `id:side@0.2` |
| legend(items) | 線種・トーンの凡例 |
| swimlane(lanes, steps, {flows, phases}) | スイムレーン図。レーン=担当（人・チーム・システム）、列=時間。引き継ぎの矢印を自動で向きづけ。`col` で並行作業を揃える |
| sequence(actors, steps) | シーケンス図。message / self / note / divider、自動番号 |
| table(columns, rows, {title}) | 見出し付き表（ER の entity 兼用）。セルは {text, tone, bold, mono}、`cell('通る', {mark: 'ok'})` で ○△×◎ の記号つき（色だけに頼らない） |
| wireframe(root, {title, tag, h, frame, notes, skeleton}) | 画面 1 枚のローファイ・ワイヤーフレーム + 番号つき注釈欄。部品は `wf.*`（下記）。`n:` で番号の丸、`mark:'new'/'changed'` で新規・改修の枠 |
| screens(items, {cols, gap, rowGap, h, skeleton}) | 画面のサムネイルを並べる（画面遷移図）。item の `at:[行, 列]`（列は小数可）で配置、各 `id` を `connect()` で結ぶ。`skeleton` で文字を帯に |
| stateMatrix(cols, rows, {required, cellH, cellFrame}) | 部品の**状態の一覧**。行=部品、列=状態（通常・読み込み中・空・エラー…）。欄は `wf.*` の図、`'na'` / `{na: '理由'}`（対象外）、未指定（**未設計**。`check` が警告）。`required` の列がなければ警告。行は `stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', ...})` で「部品 1 つ + 状態ごとの差分」としても書ける |
| timeline({from, to, now, deadline, marks, remaining}) | 横軸が時間の部品。期限（danger 色の大きな点）、今日、途中の日付（`marks`）を旗で示し、今日から期限までを太い帯と「あと 1 年 5 か月」で見せる。詳細は下の「時間軸と期限」 |
| tree(root, {dir, maxNodeW, id}) | 組織図・階層図。配置は自動（親は子の中央、同じ階層は揃う）。節は `{label, sub?, id?, tone?, children?}`。`id` を付けた節は `connect()` の端点になる（`t.anchors.<id>` でも取れる）。詳細は下の「組織図（`tree`）」 |
| mindmap(root, {sides, maxNodeW, id}) | マインドマップ。節は `tree()` と同じ。中央のルートから、枝が左右へ自動で伸びる（書いた順に、前の半分を右、残りを左に振り分ける。高さで釣り合わせる。どちら側も上から下へ）。`sides: {枝の id: 'left'｜'right'}` で、ルートの子を左右に固定できる。下の「組織図（`tree`）」 |
| stateDiagram(states, transitions, {initial, dir, maxNodeW, id}) | 状態遷移図。状態 `{id, label, sub?, tone?, final?}` と遷移 `{from, to, label?, line?}` を書くだけで、層に分けて自動配置する。戻る矢印・飛ばす矢印・自己ループも、ほかの状態を避けて引く。状態は `connect()` の端点になる。詳細は下の「状態遷移図（`stateDiagram`）」 |
| gantt(rows, {from, to, today, id}) | ガントチャート。行は、タスク `{label, start, end｜days, id?, progress?, after?, tone?, milestone?}` と、見出し `{section}`。日付は `'YYYY-MM-DD'`（`end` はその日を含む。`'2026-10'` のような略記は止まる）。軸・目盛り・今日の線・依存の矢印・進捗は自動。詳細は下の「ガントチャート（`gantt`）」 |
| classDiagram(classes, relations, {dir, id}) | UML クラス図。クラス `{id, name?, stereotype?, abstract?, attrs?, methods?, tone?}` と関係 `{from, to, kind?, label?, fromMult?, toMult?}`。親が上になる層に自動配置し、矢印の端の記号は `kind` で決まる。詳細は下の「クラス図（`classDiagram`）」 |
| pyramid / curve | ピラミッド、曲線 |
| people(total, count, {cols, size, gap, align, tone, alt}) / dots(values, {zones, lowLabel, highLabel, min, max, r}) | 人数の絵（`people(100, 76)` = 100 人中 76 人）、レーン上の点の分布。下の「人数の絵とレーン上の点」 |
| plane({x, y, points, lines, dims, labels}) | 座標平面。軸・目盛り・点・補助線・**寸法線**・ラベルを、座標の単位のまま宣言する（地図 ↔ 画像の座標変換、位置の誤差）。`yDown: true` で画像座標。ラベルが、他のラベル・軸と矢印・目盛り・点・補助線・寸法線に重なる、または図からはみ出すと検査で止まる（寸法線の文字は、その線の上に載るのが正） 。`paths: [{through: [点の id か座標…], smooth?, dashed?, tone?, arrow?, reveal?}]` で複数点を通る線を引く（実線が既定。`smooth: true` は点を必ず通る曲線で、x が増える道筋は単調な 3 次補間（値を行き過ぎない）、そうでない道筋は centripetal Catmull-Rom。`smooth` なしは折れ線。曲線が軸の外に出る・ラベルに重なると検査で止まる。`examples/plane-paths.ts`）。`grow: true` を付けた path は、段階（`reveal`）ごとに、出ている点までの曲線を同じ形のまま伸ばす（`examples/plane-grow.ts`）。点のラベルは `labelAt` を書かなければ右に置き、線や他のラベルと重なるときは空いている側（左・上・下・斜め）へ自動で移る。`labelAt` で側を書くとそのまま、`labelOffset: [dx, dy]` で位置をずらせる |

`wf.*`: col / row / card / spacer、text / btn / input / select / chip / tabs / appbar / seek、kv / stat / list / table / alert、map / video / heat / pointcloud / chart / image。
map・video 等は残りの高さを埋める。`overlay` / `overlayRight` でチップ、`label` / `stamp` で枠内の文字。

**画面全体は粗く、部品は別の図で詳しく**（ワイヤーフレームの進め方）:

- 粗い全体像: `wf.region(名前, {n, emphasis, hint})`。領域の名前と見る順だけを示す。`n: true` で、読む順に自動採番。
- 部品の構成: `wireframe(部品, {frame: 'light' | 'none', h: 'fit'})` で、画面の太い枠を使わず、中身の高さに合わせる。`parts: {level: 1, evidence: 2}`（または `true` で自動採番）で、部品の**内側**に番号を付けられる（`wf.insight`、`wf.robot`、`wf.fusion`、`wf.compare`）。
- 部品の状態: `stateMatrix()`。`state: 'missing' | 'disconnected' | 'loading' | 'empty' | 'stale'` は、**どの部品にも**付けられる（映像・地図は斜線、一覧・カード・数値は骨組み。`stale` は読めるまま、点線の枠と札）。`fusion` の `layers: [{label, state}]` で、層ごとの状態も示せる。
- 部品: `wf.fusion`（カメラ・点群・赤外線の重ね）、`wf.compare`（左右の比較）、`wf.robot` / `battery` / `signal`（機体状態）、`wf.insight`（根拠と取得時刻が必須の所見）、`wf.breadcrumb`、`wf.toggle` / `checkbox` / `radio` / `slider`、`heat` の `scale` / `probe`、地図マーカーの `id` / `shape` / `heading` / `fov`。
- `check` が見ること: 図の番号と注釈の一対一（`wf-callout-no-note` / `wf-note-no-callout` / `wf-callout-gap`）、状態の一覧の「未設計」と必須の状態（`wf-states-todo` / `wf-states-required`）。

### 小さな制約の解消（枠なしの group、表の行高、stamp）

- `group(children, {frame: false})`: 枠も title も付けない入れ物（pad 0）。row に table / plane / banner を並べるとき、group で包んでも外枠が二重にならない。`title` / `tone` / `dashed` と一緒には使えない（出ないので throw）。
- `table(columns, rows, {cellH})`: 全行（見出しも）を同じ固定高にして、文字を縦中央にそろえる。足りなければ throw（伸ばさない）。未指定の表は従来どおり。`stateMatrix` の `cellH` と同じ意味。
- 表の行ごとの高さ: 行を `{cells: [...], h: 60}` と書くと、その行だけ固定高にする。見出し行は `table(..., {headerH: 30})`。優先順は 行の `h` > `headerH`（見出し行のみ）> `cellH` > 内容に合わせた高さ。固定した行は文字を縦中央にそろえ、足りなければ `h` / `headerH` / `cellH` のどれが小さいかを書いて throw する（伸ばさない）。
- `table(..., {dense: true})`: 行の上下の余白を 8px から 4px に詰める（文字は 14px のまま。title の帯は変えない）。`cellH` / `h` / `headerH` と併用でき、固定高が優先される。ただし「その行に必要な高さ」は dense の余白で計算するので、dense なしでは足りない高さでも dense なら通る。`h` / `headerH` / `dense` を使わない表の出力は変わらない。例は `examples/table-row-h.ts`。
- `table(columns, rows, {rowHeader: true})`: 左端の列を行ラベルにする。行ラベルのセルは**常に `soft` で塗り、太字**にし、右側に太い縦罫線（幅 3、文字色）を引く（塗りに頼らない区別）。見出し行との左上のセルは見出し行のまま。`cellH` / 行の `h` が無いときは本文と同じく上揃え、あるときは縦中央。行ラベルの折り返しも行の必要高さに入り、`h` / `headerH` / `dense` / `cellH` と併用できる。行の `tone` が `accent` / `new`（塗りが `soft`）だと行ラベルと本文が同じ塗りになるので `rowheader-tone-collides` を warn する（`muted` / `removed` は塗りが `code` なので出ない）。列が 1 つだけだと throw。`rowHeader` を使わない表の出力は変わらない。例は `examples/table-row-header.ts`。
- `stamp: '架空の例'`: box / banner / group の右下に小さなチップを出す（「架空の例」「イメージ」「要確認」）。内容の下に 1 段ぶんの帯を確保するので、本文に重ならない。箱より幅が広いスタンプは throw。画面部品（wf）の `stamp` は従来のまま。

## くり返しをまとめる書き方
同じ指定を図の中で何度も書くときの、まとめ方。

### 大きな数値と棒グラフ

`stat(value, label, opts)` は、大きな値と補足ラベルを中央揃えにした plain の `box()` を返すため、そのまま `row()` に入れられる。`size` は `'stat'`（34px、既定）または `'display'`（56px）。`tone` は値の文字だけに付き、ラベルは muted、箱の見た目は変わらない。値は折り返さず、幅に収まらない図は検証エラーになる。

```ts
row([
  stat('76%', '導入前', {tone: 'danger'}),
  stat('31%', '導入後', {tone: 'accent', size: 'display'}),
])
```

`bars(data, opts)` は横棒（既定）、縦棒（`dir: 'v'`）、積み上げ（`stack: true`）を描く。`series` は `a | b | c` で、それぞれ accent / text / muted。棒ごとに `tone: 'accent' | 'danger' | 'muted'` も選べる（`danger` が赤。`series` とは併用できない。`examples/spotlight-dim-fill.ts`）。`max` を省くと通常は最大値、積み上げでは合計値になる。値ラベルは必ず描かれ、`unit` は値の後ろに付く。各項目の `id` は `connect()` のアンカーとして使える。

```ts
bars([
  {id: 'before', label: '導入前', value: 76, series: 'a'},
  {id: 'after', label: '導入後', value: 31, series: 'b'},
], {max: 100, unit: '%'})

bars([
  {label: '企画', value: 16, series: 'a'},
  {label: '実装', value: 34, series: 'b'},
  {label: '運用', value: 50, series: 'c'},
], {max: 100, unit: '%', stack: true})
```

出し分けの指定（既定はすべて従来どおり）。

| 指定 | 内容 |
|---|---|
| `labels: 'all' \| 'category' \| 'none'` | 値ラベルとカテゴリラベルの両方（既定）／カテゴリだけ／どちらも出さない |
| `axis: false` | 目盛りの数値・目盛り線・値の軸線を消す。棒の立つ基線は残る（横棒は x = 0 の縦線を引く） |
| `grid` | 目盛りに沿った格子。既定は `axis` に連動。`axis: false, grid: true` は throw |
| `baseline: false` | 基線も消す |
| `barRatio` | 棒の幅の比率（0 < r ≤ 1）。指定すると最大幅の上限（縦棒 64px）を外す。`1` で棒が接して階段になる。横棒は行の高さ（28+18）に対する棒の高さ。省略時は従来の幅。`stack` とは併用できない |

`labels` が `'all'` でなく `axis: false` のとき、図から値は読めない。ハードル（高さが値に比例する壁）や階段のような「量の感じ」を見せる図で使い、**数値は本文・`caption`・隣の表など図の外に必ず書く**（長さや色だけで量を伝えない）。そのとき SVG の `<desc>` に値の列（`値: A 20%、B 40%`）を自動で追記する（`diagram({desc})` を自分で書いた図には追記しない）。doc 媒体で題名がない図は、`<title>` も `<desc>` も出ないので `bars-values-hidden` で warn する。reveal の段階ごとのファイルの `<desc>` は、その段階で見えている要素だけを挙げる（まだ出ていない値・消えた値は入らない）。目盛りも値ラベルも出さない縦棒は、`height: 60` のような小さい図が書ける（目盛りか値ラベルがあるときの最小の高さは従来のまま）。棒が 1px 以下になる図は throw ではなく `bars-thin-bar` の warn。例は `examples/bars-bare.ts`。

### 人数の絵とレーン上の点（people / dots）

`people(total, count, opts)` は、人のアイコン `total` 個を行ごとに並べ、先頭の `count` 個を強調する（「100 人中 76 人」）。強調は塗りつぶし、残りは輪郭だけなので、色が見えなくても数が読める。`cols` の既定は 10 個以下ならその個数、それ以上なら平方根の切り上げ（100 → 10 列）。

- 色: `tone`（強調の塗り。`'accent'` 既定 / `'danger'` / `'muted'`）と `rest`（輪郭の色。既定 `'muted'`）。「悪い数字」に見せたくないときは `accent`、灰色の図（例: 経営者の認識）は `tone: 'muted'`。
- 2 色: `people(100, [35, 47], {tone: 'accent', tone2: 'danger'})` は、先頭の 35 個を `tone`、続く 47 個を `tone2`、残りを `rest` で描く（`k1 + k2 > total` は throw。`tone2` の既定は `danger`、`tone` が `danger` なら `accent`）。2 色は色だけの違いなので、`side` / `alt` / 近くの文に**どちらが何人かを書く**（`examples/people-two-tone.ts`）。
- 数字: `side: {value: '76%', label: '離脱した', tone?, size?: 'stat' | 'display'}` で、グリッドの右横・縦中央に大きい数字と一行のラベルを置く（`stat()` を下に積むより縦が短い）。`side` の `tone` は数字の色で、アイコンの `tone` とは別に選べる。
- 寸法: アイコンは `size`（既定 28px）、間は `gap`（既定 8px）。10 列の幅（高さ）は `10 × size + 9 × gap` で、`size: 28, gap: 8` なら 352px、`size: 24, gap: 6` なら 294px、`size: 20, gap: 4` なら 236px。`side` を付けると、これに 24px + 数字の幅（`stat` で約 100px、`display` で約 150px）が足される。10×10 を 2 つ縦に積むと 600px を超えるので、スライドでは `size: 20〜24` にするか、`row([group([people(...)], {frame: false}), group([...], {frame: false})])` で横に並べる（`examples/people.ts`）。
- そのほか: `align`（`'center'` 既定 / `'left'`）、`alt`（既定 `76 / 100`）、`id`。列に収まらないときは throw（`cols` / `size` / `gap` を見直す）。`side` を付けない図では数字の文字を持たないので、`stat()` / `caption()` を並べる。数字は図の外にも書く前提（ADR 0002 の量の部品と同じ）。

`dots(values, opts)` は、横のレーン（軸）に点を置く。値は `min`..`max`（既定 0..1）の位置で、近い点は上へ積むので**点は決して重ならない**（座標は 4px 格子に載るので lint の `coordinate-grid` も通る）。`zones: [{from, to, label, tone?}]` はレーンの一部を、淡い色の帯（点の背景）と軸上の濃い帯で示し、ラベルを下に置き、帯の中の点を `tone`（既定 `'danger'`）の濃い色で塗る。点は既定で半径 10px（直径 20px。`r` で 2〜24px）（点ごとに `{at, tone}` で上書き可）。帯は重ねられず、ラベルが互いに重なる・図からはみ出す・`height` が一番高い山に足りないときは throw。`lowLabel` / `highLabel` は両端の文字、`r`（10px）、`width` / `height`、`alt`、`id`（`spotlight` の対象にできる）。`reveal` は付けられない（`examples/dots-lane.ts`）。

```ts
people(100, 76, {tone: 'danger', alt: '100 人中 76 人'})
dots([0.04, 0.1, 0.12, 0.5, 0.9], {
  zones: [{from: 0, to: 0.3, label: 'ついてこれない人'}, {from: 0.3, to: 1, label: 'ついてこれる人', tone: 'accent'}],
  lowLabel: '遅い', highLabel: '速い',
})
```

### 組織図・階層図（`tree`）

```ts
tree({
  label: '開発本部', sub: '本部長', tone: 'accent',
  children: [
    {label: 'プラットフォーム部', id: 'pf', children: [{label: 'インフラ'}, {label: 'SRE'}]},
    {label: 'プロダクト部', children: [{label: 'Web'}, {label: 'モバイル'}]},
  ],
}, {dir: 'down'})
```

- 座標は書かない。親は子の列の中央に、同じ階層は同じ高さ（`dir: 'right'` なら同じ左端）に並び、重ならない。配置の計算は `lib/graph-layout.ts`（ほかの自動配置の図と共通）。
- 節は、太字の `label` と、薄い `sub`（役職・人数など）。`maxNodeW`（既定 200px）を超えると折り返す（句読点はぶら下がることがある）。`tone` は `box` と同じ。
- 兄弟が多くて図の幅を超えるときは、何が足りないかを書いて止まる（`dir: 'right'`、`maxNodeW` を小さく、階層を分ける）。
- `id` を付けた節は、`connect()` の端点（`connect('pf', '外部')`）。`tree()` 自身の `id` は、図全体の端点と spotlight の対象。`reveal` は図全体に付く。例は `examples/org-chart.ts`、`examples/org-chart-right.ts`。

`mindmap(root, {sides})` は同じ節の書き方で、ルートを中央に置き、子を左右に振り分ける（書いた順に、前の半分を右、残りを左へ。枝の高さで釣り合わせ、どちら側も上から下へ並ぶ）。`sides` は、ルートの子だけを `id` で左右に固定できる（深い節や未知の id は止まる）。節の `id` は `connect()` の端点になる。例は `examples/mindmap.ts`。

### 状態遷移図（`stateDiagram`）

```ts
stateDiagram(
  [{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
  [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'run', label: '再試行'}, {from: 'run', to: 'done'}],
  {initial: 'idle', dir: 'right'},
)
```

- 座標は書かない。状態を、遷移の向きに沿って層に分け（循環は、戻る遷移として逆向きに扱う）、交差が減るように並べる。`dir: 'right'`（既定）は左から右、`'down'` は上から下。
- `initial` は、黒い点と、そこから入る矢印。`final: true` の状態は二重の枠。`tone` は箱と同じ。
- 遷移は、直角に折れる矢印で、層を飛ばすものは間の状態を避けて迂回する。同じ 2 状態の間の行き来や、同じ側に出入りする矢印は、位置をずらして重ならないようにする。自己ループは、`dir: 'right'` では状態の上、`'down'` では右に出る。
- ラベルは、矢印の直線部分の脇に置く。矢印の先や、状態・ほかのラベルに重なるときは、矢印に沿って場所を探し、それでも入らなければ矢印の脇に動かす。それも無理なら `check` / `build` が、どのラベルが何に重なるかを書いて止まる。矢印が無関係の状態を貫くときも止まる。ラベルが長いと層の間隔が広がるので、図の幅を超えたら、幅と直し方（`dir: 'down'`、`maxNodeW`、ラベルを短く）を書いて止まる。
- 矢じりはマーカーではなく図形で描く（resvg は、左向きの終端マーカーを回さないため）。状態の `id` は `connect()` の端点で、`t.anchors.<id>` でも取れる。例は `examples/state-diagram.ts`。

### ガントチャート（`gantt`）

```ts
gantt([
  {section: '設計'},
  {id: 'req', label: '要件定義', start: '2026-10-05', end: '2026-10-16', progress: 1},
  {label: '実装', start: '2026-10-26', days: 20, after: 'req', tone: 'danger'},
  {label: 'リリース', start: '2026-11-27', milestone: true},
], {today: '2026-10-19'})
```

- 日付だけを書く。軸は最初の開始から最後の終了まで（`from` / `to` で広げられる）。7 日あたりの幅が足りるだけ、週（月曜）の目盛り、約 20 週を超えると月の目盛り。
- `today` は必ず書く（ビルドは時計を読まない）。軸の外だと止まる。`todayLabel` で「今日」を変えられる。
- `progress`（0〜1）は、バーの塗りつぶしの割合。`milestone: true` は 1 日の菱形（`end` / `days` は要らない）。`tone` は `accent`（既定）/ `danger` / `muted`。
- `after: 'id'`（または id の配列）で、先行タスクの終わりから、このタスクの始まりへ矢印を引く。縦の線は、間の行のバーを避けた最初の空き（先行タスクの終わりのすぐ右から）を通る。そこが空いていない（後続が先に始まる、間のバーが長い）ときは、行と行のあいだの線に沿って、バーのない列まで回る（後ろ向き・上向きの依存も同じ）。軸のどこにも空きがない（間の行のバーが軸いっぱい）ときだけ、どのバーを貫くかを書いて `check` / `build` が止まる（行の並びを替えるか、`from` / `to` で軸を広げる）。`after` が自分自身や輪になると止まる。
- 行のラベルは図の幅の 4 割までの 1 行（超えると、短くするよう書いて止まる）。`id` を付けたタスクは `connect()` の端点で、`g.anchors.<id>` でも取れる。例は `examples/gantt.ts`。

### クラス図（`classDiagram`）

```ts
classDiagram(
  [{id: 'Payable', stereotype: 'interface', methods: ['+ pay(amount: number)']},
   {id: 'Card', name: 'CardPayment', methods: ['+ pay(amount: number)']},
   {id: 'Order', attrs: ['- total: number'], methods: ['+ cancel()']}],
  [{from: 'Card', to: 'Payable', kind: 'implement'}, {from: 'Order', to: 'Payable', kind: 'depend', label: '支払い'}],
)
```

- クラスは、名前（`stereotype` / `abstract` は名前の上に «…»）、属性、メソッドの 3 区画。中身のない区画の仕切りは出ない。メンバーは 1 行ずつの文字列で、折り返さない（長いと図の幅を超えて、止まる）。
- `kind`: `assoc`（線、既定）/ `arrow`（矢印つきの関連）/ `inherit`（子から親へ。親の側に白抜きの三角）/ `implement`（破線 + 三角）/ `compose`・`aggregate`（`from` 側＝全体に、塗りつぶし・白抜きのひし形）/ `depend`（破線 + 開いた矢印）。`fromMult` / `toMult` は両端の多重度（`'1'`、`'0..*'`）、`label` は関係の名前。
- 親が上（`dir: 'right'` なら左）になる層に並ぶ。継承の矢印が同じ親に集まるときは、辺の上で位置をずらす。自分自身への関係は、クラスの右に小さな輪で出る。
- 関係が無関係なクラスを貫く・ラベルや多重度がクラスやほかのラベルに重なると、`check` / `build` が止まる（クラスの順を入れ替える、`dir` を変える、ラベルを短くする）。`id` はクラスごとに必須で、`connect()` の端点（`c.anchors.<id>` でも取れる）。例は `examples/class-diagram.ts`。

### 時間軸と期限（`timeline`）

```ts
timeline({
  from: '2026', to: '2029',
  now: {at: '2026-10', label: '今'},
  deadline: {at: '2028-03-31', label: 'サポート終了'},
  marks: [{at: '2027-04', label: '予算申請'}, {at: '2027-10', label: '移行開始の期限', tone: 'accent'}],
})
```

- 日付は `'YYYY'` / `'YYYY-MM'` / `'YYYY-MM-DD'`（年・月だけなら、その初日）。**`now` は必ず書く**（ビルドは時計を読まないので、同じソースは同じ SVG になる）。`from` < `to`、`now` / `deadline` / `marks` が軸の外にある、実在しない日付、`deadline.label` が空、は throw。
- 今日から期限までは太い帯（期限が先なら accent、過ぎていれば danger）で、下の括弧に残りを書く。既定の文言は暦の月で数える（`あと 1 年 5 か月` / `あと 5 か月` / 1 か月未満は `あと 19 日` / 過ぎていれば `期限を 2 か月 過ぎた`）。`remaining: '残り 1.5 年'` で文言を替え、`remaining: false` で文言と括弧を消す（帯は残る）。
- `deadline: {…, line: 'full'}` は、期限の縦線を図の高さいっぱいに引く（danger 色。どの文字もこの線にかからないよう旗の位置を選び、かかるなら verify が止める。期限の旗は線の右に置く）。`span: 'fill'` は、今日から期限までを、軸の上下 12px ずつの淡い面（accent のとき `soft`、期限を過ぎていれば `border` 色）で塗る（既定の `'bar'` は軸上の太線）。目盛りの文字は面にかからないよう 4px 下げる。例は `examples/timeline-line-fill.ts`。
- 旗（今日・期限・`marks`）は、日付が近いと段を変えて階段にする（左の旗が高い）。旗は茎の位置から右へ置き、収まらなければ中央・左へ。最大 5 段で、それでも文字が重なるなら throw（マークを減らす・短くする・幅を広げる）。検査（verify）は、文字どうしの重なりと図からのはみ出しも止める。
- 目盛りは範囲に応じて 1 / 3 / 6 / 12 か月…刻み（約 8 本まで）。文字は 14px 固定。`id` は `connect()` の端点と spotlight の対象になり、`reveal` は図全体に付く。例は `examples/timeline.ts`（ふつう）と `examples/timeline-crowded.ts`（日付が近い旗）。

### 出典行（`sourceLine`）

`diagram({sourceLine: '出典: 総務省 2025'})` は、出典を**図の最後の 1 行**（左寄せ・muted・14px）に固定する。`add()` の順や他の部品に関係なく、いつも一番下にあるので、本文の部品と重ならない。キャンバスの高さに含まれる。空・複数行の文字列は throw。1 行に収まらず折り返すと `source-wraps` を warn する（出典の細部は本文へ）。文字のコントラストは、他の caption と同じ検査（`a11y-text-contrast`、verify）に通る。`sourceLine` を使わない図の出力は変わらない。例は `examples/timeline.ts`。

### 大きい文字（ロールで選ぶ）

主役の絵の文字は、px ではなく**ロール**で大きくする。入口は次の 4 つ。

| 入口 | 指定 | 大きさ |
|---|---|---|
| `caption` | `caption(text, {role: 'display'})` | `label` 14 / `banner` 16 / `stat` 34 / `display` 56 |
| `stat` | `stat(v, label, {size: 'stat' \| 'display'})` | 値が 34px（既定）/ 56px |
| `banner` | `banner({headline, headlineRole: 'banner' \| 'stat' \| 'display'})` | 見出しが 16px（既定）/ 34px / 56px。banner の高さも増える |
| `bars` / `plane` | `labelRole: 'note' \| 'banner' \| 'stat'` | 図のすべての文字（軸名・目盛り・値・カテゴリ・点・寸法）が 14px（既定）/ 16px / 34px |

`labelRole` を付けると、図の余白・目盛りの間隔・寸法線の離れ・横棒の太さも文字に合わせて広がる（指定しない図は 1 ピクセルも変わらない）。`plane` の `height` が足りなければ throw する。`fill: true` の拡大（最大 1.8 倍）は、`headlineRole` / `labelRole` を付けた文字が **72px を超えない**ところで止まる（`display` の見出しは約 1.28 倍まで。`stat` のラベル 34px は 61px で上限内）。指定のない図は従来どおり 1.8 倍まで。

**`padY` を小さくするとき**: 図形は 4px の格子に丸めて描くが、文字の位置は丸めない(文字も丸める案は、実測して見送った: ADR 0005 の追記)。そのため `padY` が小さい箱・banner は、図の中の位置によって、字面の上端が枠から出て、lint が「枠からはみ出す」（枠の内側 4px を要求）と言うことがある（`padY: 0` の 16px の見出しで 4px）。16px の見出しなら `padY` を 9 以上にすれば、どの位置でも通る（大きい文字は、字面が baseline の上に出る分、比例して増やす）。

**破壊的変更**: `Role` 型と `ROLES` から `hero`（18px）を削除した（どこでも使われていなかった。ADR 0002 の「hero は触らない」を覆す）。`box({size})` は以前から layout も emit も読まない**何もしない引数**で、使うと「効果がない」と warn する（14〜72 の検証はそのまま。次の版で throw にする）。大きい文字は上の表のロールを使う。例は `examples/text-roles.ts`。

### 文の一部だけを太字・色にする（`em`）

箱の文章の一部だけを強調するには、`title` / `body` / `note` / `lines[].text` などに、**文字列と `em.*` の部品の配列**を渡す。`em` は `svg-diagram` から import する。

```ts
import {box, caption, em} from 'svg-diagram';

caption(['ブラウザ操作を ', em.b('Claude in Chrome'), ' に任せる'])
box({title: '許可', body: ['許可は ', em.danger(em.b('ユーザー')), ' が決める'], lines: ['手順 1', {text: ['戻せない操作は ', em.danger(em.b('止まる'))]}]})
```

- 部品は `em.b(x)`（太字）、`em.accent(x)` / `em.danger(x)` / `em.muted(x)` / `em.text(x)`（色。`TextTone` だけ。任意の色は書けない）。入れ子は `em.danger(em.b('..'))` と `em.b(em.danger('..'))`（どちらも太字 + 色）だけ。引数は文字列か別の部品。
- **文字列は、どのフィールドでも、書いたとおりの文字**。`'**API**'` や `'{frame: false}'`、`'lib/**/*.ts'` は記号を解釈しない（エスケープも要らない）。配列の中の文字列も同じで、`['API', 's']` は `'APIs'` と同じ出力。`<title>` / `<desc>` や `check` の文言には記号の無い平文が入る。
- 強調を書ける範囲は、`box`（`title` / `body` / `note` / `lines` の `{text}`）、`banner`（`headline` / `sub`）、`caption` の第 1 引数、`group` の `title`、`stat` のラベル、`swimlane` の手順（box と同じ）。**tag / stamp / legend / connect のラベル / レーンの名前 / 表のセル / ワイヤーフレーム**は文字列のまま（`em.*` を渡すと型エラー）。
- `lines` の要素は文字列か `{text: [...]}`。部品を `lines` に直接並べる（`lines: ['a', em.danger('b')]`）と、別々の行になるので型エラー。強調の入る 1 行は `lines: [{text: ['a ', em.danger('b')]}]` と書く。
- エラー（throw）: 太字の文字（`title`、`headline`、group の `title`、`bold: true` の caption / 行）の中の `em.b()`（太字は元から。強調したい語は body など太字でない所に置く）、文字の色と同じ色の部品（`em.danger()` を danger の文字に）、色の入れ子（`em.danger(em.muted(..))`）、部品の単独渡し。`title: []` は `title` を書かないのと同じ。
- 折り返しは太字の幅で測る。`['API'を太字, 's を呼ぶ']` のように語の途中で強調が切れても、語は行の途中で割れない。`spotlight` で薄くした箱は、色の強調が muted に寄り、太字は残る。
- 検査: 描画後の検査（`lint-svg`、`--engine browser` も）は色の違う `tspan` ごとにコントラストを見る。`verify` は部品の色も箱の塗りに対して見る。`em.danger()` / `em.accent()` だけで太字を伴わない強調は、文書向けの図で `a11y-color-only-emphasis`（warn。`em.muted()` は対象外。太字の文字の中は色だけにならざるを得ないので、色は body などで太字と併用する）。

### 絵を置く（image）

台所の絵のような画像を部品として置き、その上に印と文字を重ねる。ファイルは `image()` を呼んだときに**一度だけ**読み、data URI として SVG の中に入れる。SVG 1 つで完結し（隣にファイルを置かない・ネットワークに出ない）、`--html`、ラスタ（resvg）、段階表示の各ファイルでも同じ絵が出る。

```ts
const kitchen = image('./assets/kitchen.png', {            // 相対パスは「図のソースの隣」から（new URL('./a.png', import.meta.url) も可）
  id: 'kitchen', alt: '台所。左にコンロと赤い鍋、右に窓がある', width: 480,
  marks: [                                                    // 絵の中の領域の枠。位置は絵に対する割合 [x, y, w, h]（0〜1）
    {id: 'pot', rect: [0.16, 0.42, 0.24, 0.3], tone: 'danger', label: '火の元'},
    {id: 'window', rect: [0.62, 0.12, 0.3, 0.38], label: '窓'},
  ],
  labels: [{text: '台所', at: [0.02, 0.06], tone: 'solid'}],   // 絵の上の文字（板つき）。at は絵に対する割合 [x, y]
});
d.add(kitchen, row([box({id: 'note', title: '見る所'})]), connect(kitchen.anchors.pot.bottom, 'note:top'));
```

- **大きさ**: 既定は本文の幅いっぱい。`width`（px）か `height`（px）の**どちらか**を書くと、もう一方は画像の縦横比から決まる（両方は throw。本文の幅を超えない）。`align` は幅が余るときの寄せ（既定 `center`）。
- **alt は必須**: 何が写っているかを書く（SVG の `<image>` の名前と `<desc>`（`画像: …`）に入る）。意味のない飾りなら `decorative: true`。
- **印（`marks`）**: 領域の枠線。`id` を付けると `diagram({spotlight: 'pot'})` と `connect(kitchen.anchors.pot.bottom, …)` の対象になる（band の id は絵全体）。`tone` は枠の色（既定 accent）、`label` は枠の左上に付く板。絵の中から出る矢印は、その絵を横切っても衝突として数えない。
- **spotlight**: 印を指すと、その領域だけを明るく残し、絵のほかの部分に白いベール（70%）をかけ、ほかの印は点線にする。印以外（ほかの箱など）を指すと、絵全体がベールで薄くなる。絵の id か、それを含む group を指すと何も薄くならない。
- **ラベルの位置は後から動かせる**: `labels[].at` と `marks[].rect` は絵に対する割合なので、絵ができてから数字だけ直せばよく、絵を差し替えたり `width` を変えても付いてくる。`anchor`（`start` / `middle` / `end`）で板のどの端を `at` に合わせるかを選ぶ。文字の大きさは `labelRole`（絵全体）と、各 `labels` / `marks` の `role`（`'note'` 14px・`'banner'` 16px・`'stat'` 34px。`bars` / `plane` の `labelRole` と同じ語彙）で選び、板は文字に追従して大きくなる。絵の外に出る位置は内側に寄せられる。長い文字や近すぎる位置で板どうしが重なると `verify` が止める。4 つの板の例は `examples/image-labels.ts`。
- **絵を背景にして部品を重ねる（`over`）**: `over: [box(...), row(...), banner(...)]` に書いた部品は、絵の上端（`pad` 分、既定 16px）から group の子のように縦に積まれ、絵の後に描かれる。絵が背景なので、**その絵だけ**は重なり検査と矢印の衝突検査の対象外になる（重ねた部品どうし、ほかの部品との検査は従来どおり）。矢印は `connect()` を図の直下に書き、`over` の中の id や印の id を端点にできる（`connect()` を `over` に入れると throw）。重ねた部品が絵の高さに収まらないと、必要な高さを書いて throw する（`width` / `height` で絵を大きくする）。絵の `reveal` と spotlight は重ねた部品にも及ぶ（重ねた箱を spotlight すると、絵はベールで薄くなり、その箱だけが残る）。例は `examples/image-backdrop.ts`。
  - **重ねた文字の検査**: 不透明な箱・バナーの上の文字と、板つきのラベルだけが許される。`caption` や group の見出しのような**素の文字**を絵の上に置くと、描画後の検査（`lint`）がコントラスト違反として止める（上の「絵の上の文字」と同じ規則）。
- **reveal**: 絵の band、各印、各 label が `reveal` を受ける（印の id を端点にした矢印は、その印の段階に従う）。
- **対応する形式と大きさ**: PNG / JPEG / GIF / WebP。SVG は埋め込まない（ほかの部品で描く）。8 MB を超えると throw。**300 KB を超えると `image-large` の warn**（ファイルがそのまま SVG に入り、段階表示では各ファイルに入る。縮小・圧縮してから使う）。
- **ソースの変更検出**: 絵のファイルの変更は `--stale` / `check --drift` の依存には入らない（`import` を静的に追う仕組みのため）。`--rebuild` で SVG を作り直して比べると見つかる。

**絵の上の文字と、コントラストの検査**: 絵の画素は検査できない。だから文字を絵の裸の上に置く書き方は**用意していない**。`marks` の `label` と `labels` は、必ず**不透明な板**（トーンの塗り。既定は白地に濃い文字、`tone: 'solid'` は accent 地に白）の上に描く。板と文字の組み合わせは、箱と同じ検査（`verify`）でコントラストを確かめる。さらに描画後の検査（`lint`。幾何エンジンも `--engine browser` も）は、`<image>` の上にある文字を調べ、**文字の全体を覆う不透明な図形（不透明度 0.9 以上）が絵と文字のあいだになければ、コントラスト違反として報告する**（`raw()` などで絵の上に直接書いた文字を捕まえるため）。板が文字より小さい・半透明でも同じ。板どうしの重なり、絵からはみ出す板は `verify` が止める。
例は `examples/image.ts`、`examples/image-spotlight.ts`。

### 主役以外を薄くする（spotlight）

`diagram({spotlight: 'main'})` は、指定した id 以外を muted 色へ寄せ、主役を残す。group の id なら子孫も主役になり、row の特定の子は `'flow#2'` のように指定できる。矢印は既定で主役に片端でも接するものを残す (`edges: 'touching'`)。両端が主役の矢印だけを残す場合は `spotlight: {ids: ['a', 'b'], edges: 'between'}` とする。`bars` は band の `id` で band ごと（棒も含めて）、棒の `id` で 1 本だけを指せ、`plane({id})` も指せる。band の id は `connect` の端点（`chart:bottom` など）にもなり、棒の id と重ねられない（`bars(): the band's id ... is also a bar's id`）。例は `examples/spotlight-bars-band.ts`。dim 側も破線・点線・二重線など形の手がかりは維持される。薄くした棒は既定では点線の枠だけになるが、`spotlight: {ids: 'wait', dim: 'fill'}` にすると薄い塗り（border 色）が残り、値の長さを読める。muted トーンの箱との併用は見分けにくいため check が警告する（`spotlight-muted`）。意図した併用なら `spotlight: {ids: 'main', mutedOk: true}` と書くと警告しない（dim と muted が形で見分けられると確かめた、という宣言）。

```ts
diagram({theme: 'blue', spotlight: {ids: ['main', 'choices#2'], edges: 'touching'}}).add(
  group([box({id: 'main', title: '今回の判断'})], {id: 'scope'}),
  row([box({title: '候補 A'}), box({title: '候補 B'})], {id: 'choices'}),
)
```

### 主役・次点・その他の 3 段階（`solid`）

新しい色を足さず、**塗りの有無**で 3 段階を作る。主役 = `tone: 'solid'`（accent の塗り + 白文字）、次点 = `accent`（薄い塗り + accent の枠）、その他 = `plain` / `changed`。`'solid-danger'` は danger の塗り + 白文字（異常の強い方）。白文字は blue 6.45 / teal 5.94 / amber 4.68 で、どのテーマでも 4.5:1 以上になる。

```ts
diagram({theme: 'blue', legend: 'auto'}).add(
  banner({headline: '今期は検索改善に集中する', tone: 'solid'}),
  row([
    box({title: '検索改善', body: '離脱の最大要因', note: '工数 3 人月', tone: 'solid'}),
    box({title: 'オンボーディング', tone: 'accent'}),
    box({title: 'その他の改善'}),
  ]),
  stat('-30%', '検索からの離脱', {tone: 'solid'}),
)
```

- **受ける所**: `box()` / `banner()` / `stat()` / `swimlane()` の手順 / `legend()` の項目だけ。`stat` の `tone` は、`'solid'` / `'solid-danger'` のときだけ箱全体を塗り、それ以外（`accent` など）は従来どおり値の文字色。`group` / `table`（行も）/ `sequence` / `swimlane` のレーンは、中の文字や白い箱が塗りの上で読めなくなるので、型エラーで、JS からは throw になる。
- **文字は自動で白**: title / body / note / lines / stat の値とラベル / banner の見出しと sub は、色を指定しなければ白になる（他の tone では note と stat のラベルは muted）。**solid の上では、文字の色指定（`titleTone` / `bodyTone` / `noteTone` / `iconTone` / `headlineTone` / `subTone`、行の `tone`、`em.accent()` / `em.danger()` / `em.muted()` / `em.text()`）は throw**（塗りと同じ色か暗い色になって読めない）。太字（`em.b()`）は使える。
- **spotlight で薄くした solid の箱**は、他の箱と同じく白地・muted の枠・muted の文字になる。
- **step の番号バッジと tag の pill**は、solid の箱では白い縁が付く（塗りと同じ色で溶けないように）。
- **凡例**: `solid` は「主役」、`solid-danger` は「異常(強)」。**solid を使う図では、`accent` の凡例ラベルが自動で「次点」になる**（「主役 / 強調」だとどちらが上か読めない）。`legendLabels: {'tone:accent': '準主役'}` のように指定すれば、そちらが優先される。ラベルの無い tone で `legend: 'auto'` を使うと、`legendLabels` に足すよう throw する。
- 例: `examples/emphasis-tiers.ts`。

### メタファー用の絵記号（icon）

人・書類・鍵・橋・柵・階段などの小さな絵記号を 2 系統で出せる。**SVG パスのアイコンは本体に同梱しない。** 使うものを、プロジェクトごとに `svg-diagram icons add` で入れる（ライセンスの違う無料セットから選ぶので、出典とライセンスをプロジェクト側に残すため）。絵文字は文字なので本体に入っている（`EmojiName`）。

```sh
svg-diagram icons find key bridge --png sheet.png   # 欲しい絵記号（英語）から、入れられる候補を絵つきで出す
svg-diagram icons search key --set mdi          # Iconify の id を探す（mdi:key-variant など）
svg-diagram icons add mdi:key-variant=key mdi:account=person ./brand/logo.svg=logo
svg-diagram icons list                          # 名前・出典・ライセンス
svg-diagram icons remove logo
svg-diagram icons notice                        # 入れたアイコンのクレジットを Markdown で
```

- **`icons find <英単語>...`**: 検索結果から、ライセンスと形が合うものだけを残し、**プロジェクトの主セットを先頭**に出す（`--style fill|line|color`、`--set mdi,lucide`、`--limit N`）。各候補に `icons add` の行が付く。`--png sheet.png` で、`box({icon})` で描いた候補の一覧画像を作る（主セットの枠は色つき）。日本語は英語に直して渡す（Iconify の検索は英語。`svg-diagram` スキルがその手順を持つ）。
- **主セット**: 最初に `icons add` した Iconify のセットが `svg-diagram.icons.json` の `mainSet` になり、`find` はそれを優先する（図の中のアイコンの見た目が揃う）。別のセットから入れると警告が出る。`icons main lucide` で変更、`icons main -` で解除。
- 入った先は**カレントかその親の `svg-diagram.icons.json`**（`.svg-diagram.json` と同じ探し方。無ければカレントに作る）。コミットする。図のビルドはネットワークを使わない。
- 取得元は [Iconify](https://iconify.design) の API（`SVG_DIAGRAM_ICONIFY_API` でミラーに替えられる）。`mdi:名前=自分の名前` で名前を付ける。`./logo.svg` のような自作の SVG も入る。
- **入れられる形**: 塗りの 1 パス(mdi・material-symbols など)、**線画**(lucide・tabler・heroicons outline など。線の太さ・端の形は集合のまま)、複数パーツ、`currentColor` + 透明度のデュオトーン(phosphor duotone など)。これらは**トーンの色**で描くので、ダーク背景・spotlight・コントラスト検査がそのまま効く。幅と高さが違うアイコン(ロゴなど)は正方形の中央に置く。
- **取り込み時に拒否するもの**: 図形以外(`<script>` `<style>` `<text>` `<image>`)、グラデーション・マスク・クリップ、`url(...)`、イベント属性、許可リスト外の属性。`svg-diagram.icons.json` は手で書き換えられるので、読み込むたびに同じ検査をする。
- **多色(固定色)**: グラデーション（`<linearGradient>` `<radialGradient>`）と `<clipPath>` も、アイコンの中で定義したものなら使える。 自前の色(`#hex`)を持つアイコン(flat-color-icons、logos など)は **`--color` を付けたときだけ**入る。`icons list` に「固定色」と出る。**トーンにもダークテーマにも従わない**(色トークンの外)ので、検査はこの色を見ない。spotlight で薄くする箱では、色を変えずに透明度 0.35 に落とす。使うのは、色そのものに意味がある 1〜2 枚に留める。
- ライセンス: MIT / ISC / Apache-2.0 / CC0 / 0BSD / Unlicense / BSD は黙って入る。それ以外（CC BY など）は `--allow-license <SPDX>` が要る。出典・ライセンスは各アイコンに記録され、`icons notice` で一覧にできる。
- 入れていない名前を `box({icon})` に渡すと、入れ方つきで throw する。`icon.use(manifest)` で、ファイルでなくオブジェクトを使わせることもできる（テストや複数プロジェクトを描くツール向け）。

```ts
// 図形として出す（入れたパスのアイコン）
box({icon: 'key', iconTone: 'accent', title: '鍵の管理', body: '発行と失効'})
iconRow([{icon: 'bridge', label: '橋'}, {icon: 'fence', label: '柵'}, {icon: 'stairs', label: '階段'}])
// 文字列の中に埋め込む（絵文字。本体に入っている）
box({title: `${icon.emoji('key')} 鍵の管理`})
```

| | SVG パス（`box({icon})` / `iconRow()`） | 絵文字（`icon.emoji()`） |
|---|---|---|
| 置ける場所 | 箱の左端（32px）。文字列の中には置けない | タイトル・本文・ラベルなど文字列の中 |
| 見た目 | 入れたセットのとおり（固定）。色は `iconTone`（text / accent / muted / danger）で、spotlight で薄くする箱は muted | 環境の絵文字フォント（Noto Color Emoji / Segoe UI Emoji）で変わる。色は色トークンの外 |
| 数 | プロジェクトが入れた分 | 18（`EMOJI_RE` の範囲内でフォントに実在するものだけ。U+FE0F が要る ⚠️ ⚙️ ☁️ ✅ は無い） |

- 絵記号は記憶には効くが、理解や検索には効きにくい。**核心の数枚だけ**に使い、全部の箱には付けない。
- アイコンだけで意味を伝えない。`box({icon})` は `title` を併記する（title があるとアイコンは `aria-hidden`、title が無いと `role="img"` と名前を持つ）。`iconRow()` は label が必須。`step` との併用は throw。
- `preview` / `show` / `contact` の既定（resvg）も絵文字を色つきで描く。resvg 自体はカラーフォントの色を描けない（Noto Color Emoji はビットマップなので空白、Segoe UI Emoji は単色の輪郭）ので、`lib/emoji-color.ts` が描画の直前だけ、`class="emoji"` の字を透明にして幅だけ残し、同じ絵文字フォントから取り出した絵（CBDT / sbix の PNG は `<image>`、COLR のレイヤーは色つきの `<path>`）を `<text>` の直後に重ねる。ディスクの SVG は変わらない。図 1 枚あたりの増分は絵文字 30 個で約 50ms（1〜数個ならごく僅か）。限界: 肌色や国旗などの絵文字の列は、絵は描けるが、resvg が（絵文字なしでも）その `<text>` ごと落とす。`class="emoji"` の無い自前の `<text>` の絵文字は対象外。実ブラウザの見え方は `--engine chromium` で確かめる。

### 構成図（クラウド・ネットワーク）

Visio のように、**アイコン + 名前**の点を置き、境界の枠で囲み、線でつなぐ。部品は新しいものを 1 つ足しただけで、あとは今の `row()` / `group()` / `connect()` をそのまま使う（重なり・交差・コントラストの検査もそのまま効く）。

```ts
import {connect, diagram, group, node, row} from 'svg-diagram';
diagram({theme: 'blue', title: 'Web サービスの構成'}).add(
  row([node({id: 'user', icon: 'user', label: '利用者'}), node({id: 'dns', icon: 'dns', label: 'DNS', sub: 'example.com'})], {cols: 12}),
  group([row([node({id: 'lb', icon: 'lb', label: 'ロードバランサー'}), node({id: 'app', icon: 'vm', label: 'アプリ'})])], {title: 'VPC 10.0.0.0/16'}),
  connect('user:right', 'dns:left'),
  connect('lb:right', 'app:left'),
)
```

- **`node()`** = `box({icon, iconAt: 'top', title: label, body: sub, frame: false})`。`size`（16〜96px）でアイコンの大きさ、`frame: true` で箱、`tone` で箱の色。例: `examples/cloud-architecture.ts`。
- **線は辺を指す**（`connect('a:right', 'b:left')`）。node の左・右・上は**アイコン**に付き、**下（`:bottom`）は名前の下**に付く。辺を書かないと中心同士を結ぶので、枠のない node では線がアイコンを貫く。
- 境界（VPC・サブネット・ゾーン・リージョン）は `group({title, dashed})` の入れ子。ゾーンを並べるときは `row([group(..), group(..)], {cols: [6, 6]})`。
- 曲がる線が枠の見出しや隣の node にかかると、`build` が理由つきで止まる。`route: 'elbow'` の `bend`（0〜1）で曲がる位置をずらす。
- **PNG のプレビュー（既定の resvg）は、曲がる線の矢じりが横を向いて見える**ことがある。SVG 自体は正しく、ブラウザや `--engine chromium` では下を向く。

#### アイコンの入手: 汎用は Iconify、公式は `add-pack`

```sh
svg-diagram icons find "load balancer" server database --set carbon --png sheet.png   # 汎用の絵（carbon は Apache-2.0）
svg-diagram icons add carbon:load-balancer-vpc=lb carbon:virtual-machine=vm
# AWS / Azure / Google Cloud / Kubernetes の公式アイコン集: 各社のサイトから zip（かフォルダ）を自分で DL して取り込む
svg-diagram icons add-pack ~/Downloads/Asset-Package.zip --prefix aws --terms https://aws.amazon.com/architecture/icons/ --accept-terms --match "Lambda|EC2|S3"
svg-diagram icons list aws                       # 入った名前（aws-lambda, aws-amazon-ec2 ...）
```

- Iconify には、AWS / Azure / GCP の**公式アーキテクチャアイコンは無い**（技術ロゴと汎用の絵だけ）。公式のものは `add-pack` で入れる。
- **公式集は各社の独自規約**で、オープンなライセンスではない。`--terms`（規約の場所）と `--accept-terms`（読んだ）の**両方が無いと入らない**。どちらも `svg-diagram.icons.json` の `packs` に日付つきで残り、`icons notice` に出る。自動ダウンロードはしない。
- 数百個あるので、`--match`（パスの正規表現）か `--all` が要る。`--list` で名前だけ確認できる（何も書かない）。サイズ違いのファイルは 48px のものを優先する。zip はシステムの `unzip` で展開する（無ければ自分で展開してフォルダを渡す）。
- 公式集のアイコンは**固定色**（`fixed`）で、グラデーションやクリップも使う。取り込み時に検査し、`<style>` / `<text>` / `<image>` / `<use>` / マスク / フィルタ / 外部参照を使うファイルは理由つきで取り込まない。図に同じアイコンを何度置いても、中の id は置く場所ごとに付け替えるので衝突しない。

### 暗い背景と透明背景（`appearance` / `transparent`）
`diagram({theme: 'teal', appearance: 'dark'})` で、暗い配色（文字は明るく、背景は暗い）で描く。トークンは明るい版と 1 対 1 に対応し（`DARK_PALETTE`）、レイアウト・トーン・文字の大きさは変わらない。明るい版の色（`#ffffff` など）を暗い版の色に置き換えるだけなので、新しいトーンに暗い版を別に書く必要はない。`raw()` の中の色はトークンでなければそのまま。
`transparent: true` は、背景の矩形を描かない（スライドや Web ページの背景の上にそのまま置く）。`appearance` と組み合わせられる（`HTML` 出力も同じ）。
**コントラスト検査**: `check` / `lint-svg` は、`appearance` の色（暗い図なら暗い版）で比べる。透明の図は、背景色が分からないので、**その図が想定する背景（明るい図は白、暗い図は暗い版の背景）の上に置かれたもの**として検査する（SVG のルートに `data-assumed-bg` として残る）。想定と違う背景に置くと、検査の外になる。
CLI は `svg-diagram build x.ts --dark --transparent`（図の指定を上書きする。`--stale` は無視して再生成する）。`show` / `preview` は図の指定どおりに描く。
**色の差し替え**: `appearance: {dark: {bg: '#0b1220', text: '#ffffff', muted: '#94a3b8', accent: '#60a5fa', soft: '#1e3a8a'}}` のように、組み込みの暗い版のうち書いたトークンだけを置き換える（キーは `bg` `text` `muted` `border` `code` `danger` `accent` `soft`、値は `#rrggbb`。`accent` / `soft` はどのテーマにも効く）。コントラスト検査は差し替えた色で行うので、読めない組み合わせは `a11y-text-contrast` で出る。差し替えた色は SVG のルートの `data-palette` に残り、`lint-svg` の off-token-color の対象から外れる。
**濃い赤（danger）**: 既定の暗い版の danger は彩度の高い赤（`#f05252`。暗い背景に対し文字で 4.5:1 以上）。もっと濃い赤（`#dc2626` など）にしたいときは `danger` を差し替える。濃い赤は文字では 4.5:1 に届かないが、棒の塗りや枠は 3:1 で足りる。`bars` の `tone: 'danger'` の棒（塗り）に使う分には検査を通り、その色を文字（`caption` の `tone: 'danger'`、`em.danger()`）に使うと `a11y-text-contrast` が出る。塗り用と文字用の色を分けてはいない（文字に使わなければ濃い赤のままでよい）。例は `examples/dark-bars-wall.ts`。
暗い版の色は `lib/tokens.ts` の `DARK_PALETTE`。全トーン × 全テーマの文字 4.5:1・枠 3:1 は `test/dark-theme.test.ts` が見る。例は `examples/dark-theme.ts`。

### 矢印の太さ（weight）

`connect(from, to, {weight: 'strong'})` は、5px の太い矢印を引く（任意の px は指定できない。「強い流れ」という意味に名前を付けたもの）。「同じ力」の 2 本を並べる、主な流れだけを強調する、といった使い方で、`line: 'solid' | 'dashed' | 'dotted'` と併用できる。`line: 'double'` は別の意味（二重線）を持つので併用すると例外になる。矢じりは線の太さに比例せず固定の大きさで、先端が箱の縁に合う。

```ts
connect('left:right', 'rope:left', {weight: 'strong', label: '100'}),
connect('right:left', 'rope:right', {weight: 'strong', label: '100'}),
connect('rope:bottom', 'note:top'),
```

`legend: 'auto'` は使った weight を「強い流れ」として凡例に足す（`legend([{line: 'solid', weight: 'strong', label: '強い流れ'}])` と手で書くこともできる）。凡例がないと `legend-missing` / `legend-incomplete` で警告する。`check` の矢印の重なり判定は、太い線ほど広い間隔まで重なりとみなす。`diagram({connectDefaults})` には weight を入れられない（個々の矢印に書く）。例: `examples/arrow-weight.ts`。

### 左右の対比

`versus()` は `row({cols: [6, 6]})`、左右の `group()`、任意の共通部への `connect()` をまとめた糖衣構文。新しいレイアウト規則は持たない。左右だけなら `id` は任意で、`shared` を接続する場合は左右と共通部に `id` を付ける。

```ts
versus(
  {id: 'usual', title: 'よくある見立て', tone: 'muted', children: box({title: '利用者が慣れていない'})},
  {id: 'actual', title: '実際の原因', tone: 'accent', children: box({title: '判断材料が画面にない'})},
  {
    shared: {id: 'evidence', title: '共通して観察するもの', children: box({title: '操作ログと聞き取り'})},
    connectLabels: {left: '見立てを照合', right: '原因を裏づけ'},
  },
)
```

- **12 列の行**: `row([a, b], {cols: [6, 6]})`（子ごとの幅だけを並べる。`col` を手で数えない）。`span` を各子に書く形では、`col` は前の子の次の列から自動で進む。`cols` を指定した行は、ラベルつきの接続線のために隙間が広がるとき、**同じ `cols` と `gap` の行すべて**で広がり、列の縁はそろったまま。
- **別の行の N 列目へ矢印をつなぐ**: `const top = row([...], {cols: 12, id: 'top'})` のあと `connect(a.bottom, top.col(5).top)`、`top.col(5, 6)` は 5〜6 列。`cols` のない行では N 番目の子。列の中の箱は、その端点の一部とみなされ、線が通っても重なりの警告にならない。
- **接続線の既定値**: `diagram({connectDefaults: {chip: true, route: 'elbow'}})` と `d.connect(from, to, {label})`（`d.add(connect(...))` と同じ。`chip` は `label` のある線だけに効く。線ごとに指定した値が優先）。
- **ワイヤーフレームの外枠**: `diagram({wireframeDefaults: {appbar: {title, nav, right}, h, frame}})` で、全画面の上にナビが付く。画面ごとに `wireframe(root, {shell: {active: '在庫'}})`（`shell: false` で外枠なし）。構造が違うときは `shell: (content, props) => ...` で包み方を渡す。`screens()` の項目も同じ。
- **状態の一覧**: `stateRow(ラベル, 部品を作る関数, {状態: 差分 | 'loading' | 'na' | {na: 理由} | undefined}, {base, note})`。状態の漏れは型エラー。
- **表の記号セル**: `cell('通る', {mark: 'ok' | 'mid' | 'ng' | 'best'})`（○ △ × ◎ + 文字）。

新部品は「同じパターンが 3 回出たら」が原則だが、ユーザーが明示したときは例外。
既存の `day:` 図の出力が変わらないこと（回帰）を確認してから足す。

### スライド 1 枚のキャンバス（`canvas`）

`diagram({canvas: 'slide'})` は、スライド 1 枚ぶんの図を **16:9（1280×720）で、拡大縮小なしに** 描く。文字は、最小のもの（既定の 14px の role・矢印のラベル・タグ）が 24px になる倍率（1.72 倍）で全体を拡大し、余白・間隔も同じ倍率にする。高さは 720px に固定で、内容が足りなければ下を空ける。`{canvas: {width, height, minText}}` で寸法と最小文字を変えられる（`minText: 30` なら 30px 以上）。

| 検査 | 内容 |
|---|---|
| `slide-min-text`（warn） | `minText` より小さい文字がある。倍率で届かない、固定サイズの文字（`size` を直接指定したもの）で出る |
| `slide-canvas-overflow`（warn） | 内容の高さが `height`（720px）を超える。行・文字を減らすか、図を分ける |

`slide`（Slidev のスライドの空き寸法を実測して、`<img>` の枠に合わせる）とは別の用途で、**同時には使えない**（`slide` / `fill` と併用すると throw）。`slide` は「本文のあるスライドの中の図」、`canvas` は「図がスライド 1 枚そのもの」。`canvas` の図は表示倍率が 1 なので、`slide` 向けの縮小警告（`on-slide text is ~Npx`）は出さず、`doc-width` も見ない。例: `examples/slide-canvas.ts`。

### クリックごとの段階表示

`reveal: n`（1 始まり）を付けると、その要素は n 回目のクリックから表示される。対象は下の表のとおり。未指定の要素は最初から表示される。

| reveal を受ける | 付け方 |
|---|---|
| `box` / `banner` / `stat` / `caption` | opts の `reveal`（`stat` と `caption` は最後の引数の opts） |
| `group` / `table` / `sequence` / `swimlane` / `plane` / `bars` / `image` の band | opts の `reveal`（`swimlane` は枠・手順・つなぎ線がまとめて）。`group` の子は親と自分の大きい方 |
| `row` / `grid` の子 | 各子の `reveal`（`row({reveal})` / `grid({reveal})` は throw） |
| `bars` の各棒 | データの `reveal`（消すのは `until`、置き換えは `replaces`。下記） |
| `image` の印・文字・重ねた部品 | 各 `marks` / `labels` の `reveal` / `until`（絵の band の値との**遅い方**の reveal、早い方の until。絵より先には出ない） |
| `versus` の左・右・共通部 | 各 part の `reveal`（枠と中身。共通部への矢印は両端の大きい方） |
| `plane` の `points` / `lines` / `paths` / `dims` / `labels` | 要素の `reveal`（点のラベルは点と一緒）。未指定は plane 自身と、`id` で指した点の大きい方（座標で指した端点は 0）。端点より早い明示は警告 |
| `connect` / `branch` | `reveal`（未指定は両端の大きい方） |
| **受けない** | `legend` / `spacer` / `raw` / `pyramid` / `curve` / `wireframe` / `screens` / `stateMatrix` / `row` / `grid` / `iconRow` の opts。`reveal` を渡すと構築時に throw する |


```ts
const summary = box({id: 'summary', title: '概要'});
const detail = box({id: 'detail', title: '詳細', reveal: 1});

d.add(
  row([summary, detail]),
  connect(summary.right, detail.left), // 両端の reveal の大きい方（ここでは 1）
  bars([
    {label: '導入前', value: 76, reveal: 2},
    {label: '導入後', value: 31, reveal: 3},
  ], {max: 100, unit: '%'}),
);
```

#### 段階で消える・置き換わる（`until` / `replaces`）

`until: n` を付けた要素は、n 回目のクリックで消える（`reveal` から `until` の手前の段階だけ表示される）。`reveal` を受ける要素と同じ場所に書ける（`box` / `banner` / `stat` / `caption` / `group` / `table` / `sequence` / `swimlane` / `plane` / `bars` の band、`row` / `grid` の子、棒のデータ、`connect`。`plane` の中の点・線などは受けない）。`until` は `reveal` より後でなければ throw する。`group` の `until` は子も一緒に消し、`connect` は未指定なら両端のうち先に消える方に合わせて消える。レイアウトは全段階で共通なので、消えた要素の場所は空いたまま残る。

棒を別の棒に置き換えるときは、データに `replaces: '<前の棒の id>'` と `reveal` を書く。新しい棒は前の棒と同じ行（縦棒なら同じ列）に入り、前の棒はその `reveal` の段階で消える（`until` を自分で書く必要はない）。前の棒より後ろに書き、`stack` とは併用できない。同じ場所に重なる 2 本は同時に表示されないので、重なりの検査から外れる。例は `examples/reveal-replace.ts`。箱の置き換えは、消す箱に `until`、出す箱に `reveal` を同じ値で書く（別の場所に並ぶ）。

`group` の子は親と自分の大きい方を継承する。`connect` は未指定なら両端の大きい方になり、端点が `row#N` の場合はその列の子を使う。端点より早い `reveal` を明示した矢印は警告になる。

build は通常の最終形 `name.svg` に加え、段階表示を使う図だけ `name.reveal0.svg`（クリック前）から `name.revealN.svg`（累積）までを生成する。全ファイルは同じレイアウトとキャンバス寸法で、段数を減らして再 build すると古い段階ファイルは削除される。`check --drift` は全段階を再生成して比べ、残った古い段階ファイルも報告する。`doc-orphan-svg` は `*.revealN.svg` を数えない。スライドの高さ計測（`slide-budget`）は `name.svg` でも `name.revealN.svg` でも同じ値になる。

## 文書と図の整合（`check --docs`）
`svg-diagram check --docs docs --svg-dir docs/assets/diagrams/svg --src-dir docs/diagrams` は、Markdown の画像参照と、図のソースを突き合わせる。
- 参照先の SVG がない（`doc-image-missing`、エラー）、代替テキストが空・155 文字超（`doc-alt-empty` / `doc-alt-long`）、どの文書からも参照されていない SVG（`doc-orphan-svg`）。
- 図に `notes` があるとき、画像の直後の**番号つきリスト**（`1. **題名**：本文`）と、題名・本文が一致するか（`doc-notes-mismatch` / `doc-notes-missing`）。図と文書の**二重管理**で、片方の直し忘れを見つける。
- `--map` で、図 / 図のソース / SVG / 使っている文書の**対応表**（Markdown）を標準出力に出す（参照のない SVG は「（参照なし）」）。手で書いた表の代わりに貼る。注釈の文は `svg-diagram notes <ソース>` で出せる（複数の画面に注釈があれば `<!-- 画面 N -->` で区切る）。
- `--format json`（機械可読）、`--format github`（PR の注釈 `::warning file=…,line=…`）。

## 図の違いの説明（`--rebuild`、`diff`）
`check --drift --rebuild` は、再生成した SVG が違うとき、**何が変わったか**を示す（メタデータのみ / 不可視の下地 / 文字の移動 / 図形の増減 / キャンバスの大きさ）。
「見た目は変わらない。再生成してよい」か「見た目が変わる。再生成して、目で確かめる」かが分かる。`pnpm golden` は、`examples/out/` の SVG が、今のコードの再生成と一致するかを調べる。

## 共通設定（`.svg-diagram.json`）
カレントディレクトリから上へたどって見つかる。`{"accept": {"rule-id": "理由"}, "maxWidth": 940}`。図ごとの `accept` が優先される。

**文字幅の測定**: 既定は、文字幅と高さをフォントファイルから読む（`"measure": "font"`。HarfBuzz。kerning・合字込みで、ブラウザは起動しない）。Chromium で測るなら `{"measure": "chromium"}`（または環境変数 `SVG_DIAGRAM_MEASURE=chromium`）。`measure` を書いていないのにフォントが見つからないときは、警告を出して Chromium で測る（`"font"` と書いたのに見つからないときはエラー）。
使うフォントは、`FONT_STACKS` の先頭から見て最初に入っているファミリー（fontconfig の `fc-match` で探す）。ファイルを直接指定するなら `{"fonts": {"sans": {"regular": "/path/YuGothR.ttc#0", "bold": "/path/YuGothB.ttc#0"}}}`（`#N` は .ttc の何番目か。`mono` `emoji` も同じ）。fontconfig のない環境（macOS など）や、どのマシンでも同じ値にしたいときは指定する。
Chromium の値との差は `test/font-metrics.test.ts` が見る。sans（Yu Gothic）は幅 1px・高さ 1px 以内、mono（Consolas など hinting の効くフォント）は Chromium が advance を整数ピクセルに丸める（切り上げることもある）ため、1 字あたり 1px 以内。例の図 3 つは、どちらの方式でも SVG がバイト単位で同じだった。フォントに無い字は emoji → sans のフォントで測り、どれにも無ければ 1em（全角）か 0.5em。`lint-svg` と `show` と `preview` は引き続き Chromium を使う。

## check のルール（lib/rules.ts）
`legend-missing` / `legend-incomplete`（`legend: 'auto'` で補える）、`a11y-text-contrast`（WCAG 4.5:1）、`a11y-nontext-contrast`（3:1）、
`a11y-no-title`、`source-wraps`（出典行が折り返している）、`a11y-color-only-emphasis`（色だけの強調。`em.b()` を併用する）、`swimlane-lane-order`（レーン間の距離が最小になる順を提案。`fixed: true` のレーンは動かさない）、`swimlane-lanes`（6 本まで）、`rowheader-tone-collides`（表の行ラベルと同じ塗りの行トーン）、
`image-large`（埋め込んだ画像が 300 KB 超）、`edge-crossings`、`one-story`、`slide-min-text` / `slide-canvas-overflow`（`diagram({canvas})` の図だけ。上の節）、`doc-width`（940px 以下。`maxWidth` で変更）、`density`、`arrow-labels`（情報: 矢印の一部にだけラベルがある。全部ラベルなしの図は「依存・次」を示す約束とみなして指摘しない）、`wf-callout-order`（情報: 図の番号が読む順でない。次の番号が、下の行か右の列にあれば順どおり。上かつ左へ戻るときだけ指摘）。案件全体で許容するなら `.svg-diagram.json` の `accept` に理由を書く（図ごとの `accept` が優先）。
`lint-svg`（描画後の検査: コントラスト・キャンバスのはみ出し・文字の重なり・枠からのはみ出し・図形が文字に被る）は、SVG の幾何と文字の箱（レイアウトと同じフォントファイル）から調べる。`--engine browser` は同じ検査を実ブラウザで行う（`test/svg-lint-browser.test.ts` が両方を同じ SVG に当てて比べる。丸めの境界で 1px 違うことと、回転したグループの中のコントラストの比べ方（ブラウザ版は文字と図形を別々の座標系で比べていた）だけが違う）。
描画後の検査は、**後から描かれた図形が文字を覆う、または線が文字を貫く**ものも報告する（意図した重なりは、図形に `data-allow-cover`）。
残す警告は `diagram({accept: {'rule-id': '理由'}})`。`theme:` の図（文書向け）だけが対象で、`day:` の図（スライド）は従来どおり。
文書向けの図の SVG には `role="img"`・`<title>`・`<desc>`・生成元（ソースの SHA-256）が入る。`npm test` / `pnpm test` でルールの単体テスト。

## コンパイル時に検出されるもの
図のソースを `.ts` で書き `npx tsc -p .`（エディタでも同じ）を通すと、`check` や実行時エラーが後で見つける問題の多くを、**書いた場所で**型エラーにできる。
実行時の検査は**そのまま残る**（`.mjs` のソースや JS の呼び出しには型が付かないため）。型を通る・通らないで、出力される SVG は変わらない。

| 問題 | 置き換える検査（ルール / 実行時エラー） | 型での検出 | 注意 |
|---|---|---|---|
| `connect()` の参照先の id がない | `connect(): unknown anchor id` | `add()` が、同じ呼び出しの中の id と、チェーンした前の `add()` の id を集めて突き合わせる。box / 行・グリッドの子 / group / banner / screens の項目 / wireframe / table / sequence / swimlane の step の id が対象 | **別々の `add()` をまたぐ前方参照は型エラー**（実行時は通る）。`d.add(a); d.add(connect(...))` のように結果を受け取らない書き方では、前の id を型が知らず、id を宣言しない呼び出しは検査されない。**1 回の `d.add(...)` にまとめるか、`d.add(a).add(b)` とつなぐ**と検査される。`string`（実行時に決まる id）や `` `step${n}` `` は検査せず通す |
| 参照の書式（`id:side@t`）の誤り | 実行時は黙って中央扱い | side は `left｜right｜top｜bottom｜center`、`@t` は 0〜1 の数。`connect()` を書いた場所で、メッセージつきの型エラー | `@` の範囲は形だけ見る（`@0.5` ○、`@x` ×、`@7` ×） |
| swimlane の step の `lane` が未宣言 | `swimlane(): step ... uses unknown lane` | `lane` は宣言したレーンの id だけ | レーンを `string[]` で渡すと検査されない |
| swimlane の flow の `from` / `to` が step にない | `swimlane(): flow ... unknown step id` | step の id（`:side[@t]` つき可）だけ。step の id の重複も型エラー | |
| レーンが 7 本以上 | `swimlane-lanes` | レーンの個数が 1〜6 でないと型エラー | レーンを配列変数で渡すと検査されない |
| `box({step})` に `title` がない | `box({step}) needs a title` | `step` を書くと `title` が必須 | |
| `diagram({fill: true})` に `slide` がない | `diagram({fill: true}) needs diagram({slide})` | `fill: true` なら `slide` が必須。`theme` / `day` のどちらかも必須 | |
| `connect()` の `dip` / `bend` / `bendOffset` / `chip` / `labelAt` の組み合わせ違い | 実行時は黙って無視 | `dip` は `route: 'loop-under'` だけ、`bend` / `bendOffset` は `route: 'elbow'` だけ（`branch()` は既定が elbow）、`chip` / `labelAt` は `label` があるときだけ | |
| `grid()` に `cols` がない | `grid(children, {cols}) needs cols` | `opts` と `cols` が必須 | |
| `pyramid()` の段が 2 未満、`curve()` の点が 2 未満・`y` が数でない | `pyramid(layers) needs at least 2 layers` ほか | 2 要素以上のタプル型。`y` は `number` | 配列変数（`string[]`）は渡せない。リテラルで書く |
| `raw()` に `draw` がない | `raw({draw}) needs a draw(ctx) function` | `draw` が必須の関数 | |
| 14px 未満の文字 | `font-size N is below the 14px floor` | `size` は 14〜72 の整数のリテラル型（`MIN_FONT_SIZE` から導出） | |
| 状態の一覧の `required` が列にない | `wf-states-required` | `required` の要素は `cols` のいずれか | 列を `string[]` で渡すと検査されない |
| 状態の一覧の行のセルが列より多い | `wf-states-ragged`（`N cells for M columns`） | `cells` の長さは列の数と**ちょうど同じ** | |
| 状態の一覧の行のセルが列より少ない（「未設計」が黙って出る） | `wf-states-todo` | 同上。未設計にするなら、明示的に `undefined` を書く。`'na'` / `{na: '理由'}` は今までどおり | |
| sequence の `from` / `to` / `self` / `over` が actor にない、自分宛ての `from === to` | `sequence(): unknown actor` / `has from === to` | actor の id だけ。`from` と `to` は別の actor | actor を `string` の id で渡すと検査されない |
| 強調の部品を範囲外に渡す、`lines` に部品を直接置く、帯に配列を渡す | 実行時の検査はない（部品はオブジェクトで、文字として描かれない） | `em.*` は `box` / `banner` / `caption` / `group` / `stat` / swimlane の手順の文字だけが受ける。tag / stamp / ラベル / 表 / wf は `string`。`lines` の要素は `string` か `{text}`。`add()` に渡す帯の `title` などは `string` | `lines` の部品の直置きは、実行時にも throw |
| オプションの綴り違い・値の違い | 実行時は黙って無視 | `tone` / `mark` / `state` / `route` / `arrow` などは文字列のリテラル型、`at` は `[row, col]`、オプションの未知のキーはエラー | 変数に入れてから渡すとキーの余りは検査されない |

### 推奨の書き方: ハンドル（id を文字列で打ち直さない）
`id` つきで作った帯は、そのまま**接続点のハンドル**になる。`connect()` に `list.right` のように渡すと、存在しない id・存在しない辺を**作れない**（別々の文や `add()` をまたいでも、検査の取りこぼしがない）。

```ts
const list = box({id: 'list', title: '一覧'});
const detail = box({id: 'detail', title: '詳細'});
d.add(row([list, detail]), connect(list.right, detail.left), connect(list.at('bottom', 0.25), detail.top));
const flow = screens([{id: 'a', root: …}, {id: 'b', root: …}]);
d.add(flow, connect(flow.anchors.a.right, flow.anchors.b.left));   // screens() / swimlane() は .anchors.<id>
```
`left / right / top / bottom / center` と `at(辺, t)` がある（box / banner / group / table / sequence / wireframe）。実行時はただの文字列（`'list:right'`）で、ハンドルの部品は列挙されないプロパティなので SVG は変わらない。
文字列の書き方（`'list:right'`）も使えて、同じ検査を受ける。`accept` のキーはルール ID、`legendLabels` のキーは凡例のキー（`'tone:new'` など）に限られ、綴りを間違えると型エラーになる（`RULE_DOCS` と `DEFAULT_LEGEND_LABELS` から導出しているので、表と型がずれない）。

型エラーのメッセージは、たとえば `unknown anchor id "zzz" — declare it with {id: 'zzz'} (declared ids: a | b | c)` のように、原因と宣言済みの id が出る。
型の仕組みは `lib/strict.ts`、保証の一覧は `test/types/*.ts`（`@ts-expect-error` つきの型テスト。`npx tsc -p .` で検査される）。
**型で検出できないもの**: 番号つき注釈と `n:` の対応（`wf-callout-*`。`n: true` の自動採番と、`wf.*` の入れ子・関数での組み立てを型で数えるのは割に合わない）、コントラスト・凡例・線の交差・幅・密度などの描画結果に依存するルール、`row({cols})` の `col` / `span` が枠をはみ出すこと。これらは従来どおり `build` / `check` が見つける。

## 例
`examples/` に架空の在庫管理アプリの例がある（生成済みの SVG は `examples/out/`）。

| ソース | 内容 |
|---|---|
| `inventory-wireframe.ts` | 画面のワイヤーフレーム。番号つき注釈、トースト、確認ダイアログ、地図の凡例 |
| `inventory-flow.ts` | 画面遷移図。画面のサムネイルを並べ、`connect()` で結ぶ |
| `inventory-component-spec.ts` | 部品の仕様。粗い全体の領域、部品の構成（内側の番号）、状態の一覧 |
| `cloud-architecture.ts` | クラウド構成図: `node()` + `group()` の入れ子 + `connect()` |
| `icons.ts` | 絵記号の一覧と、メタファー図の例（`icon()` と `box({icon})`）。このリポジトリの `svg-diagram.icons.json` のアイコンを使う |
| `emphasis.ts` | 文の一部だけの太字・色（`em.b()` / `em.danger()` ほか） |
| `text-roles.ts` | 大きい文字: `banner` の `headlineRole: 'display'` と、`bars` / `plane` の `labelRole` |
| `dark-theme.ts` | 暗い背景＋背景なし（`appearance: 'dark'`、`transparent: true`） |
| `dark-bars-wall.ts` | 濃い背景の資料の色＋濃い赤の danger で描く棒グラフ（透明） |
| `emphasis-tiers.ts` | 主役（solid）/ 次点（accent）/ その他（plain）の 3 段階と、凡例の「次点」 |

## Claude Code のスキル
`skills/svg-diagram/SKILL.md` は、Claude Code で図を作る手順（ビルド → 検査 → スクリーンショットで目視 → ズレ検査）をまとめたスキル。
`ln -s "$PWD/skills/svg-diagram" ~/.claude/skills/svg-diagram` で使える。

## ライセンス
MIT

## 開発（TypeScript）

全ソースは TypeScript（`.ts`）。ビルド工程はなく、Node の型ストリップ（Node ≥ 22.18）でそのまま実行する。このため `enum` / `namespace` などの非消去構文は使えない（`erasableSyntaxOnly`）。
型検査は `npx tsc -p .`（`pnpm typecheck`）、`strict: true`。図・画面の型は `lib/types.ts` にまとまっている（`Band`、`WfNode`、`LaidOutDiagram` など）。図のソースを `.ts` で書くと `import {diagram, box} from 'svg-diagram'` にも型が付く（`tsconfig` の `paths` で `lib/dsl.ts` を指す）。
