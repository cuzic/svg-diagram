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
| pyramid / curve | ピラミッド、曲線 |
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

`labels` が `'all'` でなく `axis: false` のとき、図から値は読めない。ハードル（高さが値に比例する壁）や階段のような「量の感じ」を見せる図で使い、**数値は本文・`caption`・隣の表など図の外に必ず書く**（長さや色だけで量を伝えない）。そのとき SVG の `<desc>` に値の列（`値: A 20%、B 40%`）を自動で追記する（`diagram({desc})` を自分で書いた図には追記しない）。doc 媒体で題名がない図は、`<title>` も `<desc>` も出ないので `bars-values-hidden` で warn する。reveal の段階ごとのファイルでも `<desc>` は同じで、後の段階の値も入る。目盛りも値ラベルも出さない縦棒は、`height: 60` のような小さい図が書ける（目盛りか値ラベルがあるときの最小の高さは従来のまま）。棒が 1px 以下になる図は throw ではなく `bars-thin-bar` の warn。例は `examples/bars-bare.ts`。

### 大きい文字（ロールで選ぶ）

主役の絵の文字は、px ではなく**ロール**で大きくする。入口は次の 4 つ。

| 入口 | 指定 | 大きさ |
|---|---|---|
| `caption` | `caption(text, {role: 'display'})` | `label` 14 / `banner` 16 / `stat` 34 / `display` 56 |
| `stat` | `stat(v, label, {size: 'stat' \| 'display'})` | 値が 34px（既定）/ 56px |
| `banner` | `banner({headline, headlineRole: 'banner' \| 'stat' \| 'display'})` | 見出しが 16px（既定）/ 34px / 56px。banner の高さも増える |
| `bars` / `plane` | `labelRole: 'note' \| 'banner' \| 'stat'` | 図のすべての文字（軸名・目盛り・値・カテゴリ・点・寸法）が 14px（既定）/ 16px / 34px |

`labelRole` を付けると、図の余白・目盛りの間隔・寸法線の離れ・横棒の太さも文字に合わせて広がる（指定しない図は 1 ピクセルも変わらない）。`plane` の `height` が足りなければ throw する。`fill: true` の拡大（最大 1.8 倍）は、`headlineRole` / `labelRole` を付けた文字が **72px を超えない**ところで止まる（`display` の見出しは約 1.28 倍まで。`stat` のラベル 34px は 61px で上限内）。指定のない図は従来どおり 1.8 倍まで。

**`padY` を小さくするとき**: 図形は 4px の格子に丸めて描くが、文字の位置は丸めない。そのため `padY` が小さい箱・banner は、図の中の位置によって、字面の上端が枠から出て、lint が「枠からはみ出す」（枠の内側 4px を要求）と言うことがある（`padY: 0` の 16px の見出しで 4px）。16px の見出しなら `padY` を 9 以上にすれば、どの位置でも通る（大きい文字は、字面が baseline の上に出る分、比例して増やす）。

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
- **ラベルの位置は後から動かせる**: `labels[].at` と `marks[].rect` は絵に対する割合なので、絵ができてから数字だけ直せばよく、絵を差し替えたり `width` を変えても付いてくる。`anchor`（`start` / `middle` / `end`）で板のどの端を `at` に合わせるかを選ぶ。板の大きさは文字から決まり（調整用の引数はない）、絵の外に出る位置は内側に寄せられる。長い文字や近すぎる位置で板どうしが重なると `verify` が止める。4 つの板の例は `examples/image-labels.ts`。
- **reveal**: 絵の band、各印、各 label が `reveal` を受ける（印の id を端点にした矢印は、その印の段階に従う）。
- **対応する形式と大きさ**: PNG / JPEG / GIF / WebP。SVG は埋め込まない（ほかの部品で描く）。8 MB を超えると throw。**300 KB を超えると `image-large` の warn**（ファイルがそのまま SVG に入り、段階表示では各ファイルに入る。縮小・圧縮してから使う）。
- **ソースの変更検出**: 絵のファイルの変更は `--stale` / `check --drift` の依存には入らない（`import` を静的に追う仕組みのため）。`--rebuild` で SVG を作り直して比べると見つかる。

**絵の上の文字と、コントラストの検査**: 絵の画素は検査できない。だから文字を絵の裸の上に置く書き方は**用意していない**。`marks` の `label` と `labels` は、必ず**不透明な板**（トーンの塗り。既定は白地に濃い文字、`tone: 'solid'` は accent 地に白）の上に描く。板と文字の組み合わせは、箱と同じ検査（`verify`）でコントラストを確かめる。さらに描画後の検査（`lint`。幾何エンジンも `--engine browser` も）は、`<image>` の上にある文字を調べ、**文字の全体を覆う不透明な図形（不透明度 0.9 以上）が絵と文字のあいだになければ、コントラスト違反として報告する**（`raw()` などで絵の上に直接書いた文字を捕まえるため）。板が文字より小さい・半透明でも同じ。板どうしの重なり、絵からはみ出す板は `verify` が止める。
例は `examples/image.ts`、`examples/image-spotlight.ts`。

### 主役以外を薄くする（spotlight）

`diagram({spotlight: 'main'})` は、指定した id 以外を muted 色へ寄せ、主役を残す。group の id なら子孫も主役になり、row の特定の子は `'flow#2'` のように指定できる。矢印は既定で主役に片端でも接するものを残す (`edges: 'touching'`)。両端が主役の矢印だけを残す場合は `spotlight: {ids: ['a', 'b'], edges: 'between'}` とする。`bars` は band の `id` で band ごと（棒も含めて）、棒の `id` で 1 本だけを指せ、`plane({id})` も指せる。band の id は `connect` の端点（`chart:bottom` など）にもなり、棒の id と重ねられない（`bars(): the band's id ... is also a bar's id`）。例は `examples/spotlight-bars-band.ts`。dim 側も破線・点線・二重線など形の手がかりは維持される。薄くした棒は既定では点線の枠だけになるが、`spotlight: {ids: 'wait', dim: 'fill'}` にすると薄い塗り（border 色）が残り、値の長さを読める。muted トーンの箱との併用は見分けにくいため check が警告する。

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

人・書類・鍵・橋・柵・階段などの小さな絵記号を 2 系統で出せる。名前は `lib/icons.ts` に集約してあり、同じ名前（key, lock, person ...）で両方から引ける。片方にしか無い名前（パスだけ: `stairs` `check` `gear` など、絵文字だけ: `ladder` `globe`）は型（`IconName` / `EmojiName`）で分かり、`icon.has('key')` は `{path, emoji}` を返す。未知の名前は throw。

```ts
// 図形として出す（SVG パス）
box({icon: 'key', iconTone: 'accent', title: '鍵の管理', body: '発行と失効'})
iconRow([{icon: 'bridge', label: '橋'}, {icon: 'fence', label: '柵'}, {icon: 'stairs', label: '階段'}])
// 文字列の中に埋め込む（絵文字）
box({title: `${icon.emoji('key')} 鍵の管理`})
```

| | SVG パス（`box({icon})` / `iconRow()`） | 絵文字（`icon.emoji()`） |
|---|---|---|
| 置ける場所 | 箱の左端（32px）。文字列の中には置けない | タイトル・本文・ラベルなど文字列の中 |
| 見た目 | 固定（Material Design Icons / Material Symbols）。色は `iconTone`（text / accent / muted / danger）で、spotlight で薄くする箱は muted | 環境の絵文字フォント（Noto Color Emoji / Segoe UI Emoji）で変わる。色は色トークンの外 |
| 数 | 25 | 18（`EMOJI_RE` の範囲内でフォントに実在するものだけ。U+FE0F が要る ⚠️ ⚙️ ☁️ ✅ は無い） |

- 絵記号は記憶には効くが、理解や検索には効きにくい。**核心の数枚だけ**に使い、全部の箱には付けない。
- アイコンだけで意味を伝えない。`box({icon})` は `title` を併記する（title があるとアイコンは `aria-hidden`、title が無いと `role="img"` と名前を持つ）。`iconRow()` は label が必須。`step` との併用は throw。
- パスのデータは `scripts/gen-icons.ts` が `@mdi/js`（Pictogrammers）と `@material-symbols/svg-400`（Google）から選んだ分だけ `lib/icon-paths.ts` に取り出したもの（devDependency、実行時の依存なし）。どちらも Apache-2.0 で、出典は `NOTICE` と各エントリの `src` にある。
- `preview` / `show` の既定（resvg）は色つき絵文字を描けない。絵文字を使う図は `--engine chromium` で確認する。

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

### クリックごとの段階表示

`reveal: n`（1 始まり）を付けると、その要素は n 回目のクリックから表示される。対象は下の表のとおり。未指定の要素は最初から表示される。

| reveal を受ける | 付け方 |
|---|---|
| `box` / `banner` / `stat` / `caption` | opts の `reveal`（`stat` と `caption` は最後の引数の opts） |
| `group` / `table` / `sequence` / `swimlane` / `plane` / `bars` / `image` の band | opts の `reveal`（`swimlane` は枠・手順・つなぎ線がまとめて）。`group` の子は親と自分の大きい方 |
| `row` / `grid` の子 | 各子の `reveal`（`row({reveal})` / `grid({reveal})` は throw） |
| `bars` の各棒 | データの `reveal` |
| `image` の印・文字 | 各 `marks` / `labels` の `reveal`（絵の band の `reveal` との大きい方） |
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
`a11y-no-title`、`a11y-color-only-emphasis`（色だけの強調。`em.b()` を併用する）、`swimlane-lane-order`（レーン間の距離が最小になる順を提案。`fixed: true` のレーンは動かさない）、`swimlane-lanes`（6 本まで）、`rowheader-tone-collides`（表の行ラベルと同じ塗りの行トーン）、
`image-large`（埋め込んだ画像が 300 KB 超）、`edge-crossings`、`one-story`、`doc-width`（940px 以下。`maxWidth` で変更）、`density`、`arrow-labels`（情報: 矢印の一部にだけラベルがある。全部ラベルなしの図は「依存・次」を示す約束とみなして指摘しない）、`wf-callout-order`（情報: 図の番号が読む順でない。次の番号が、下の行か右の列にあれば順どおり。上かつ左へ戻るときだけ指摘）。案件全体で許容するなら `.svg-diagram.json` の `accept` に理由を書く（図ごとの `accept` が優先）。
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
| `icons.ts` | 絵記号の一覧と、メタファー図の例（`icon()` と `box({icon})`） |
| `emphasis.ts` | 文の一部だけの太字・色（`em.b()` / `em.danger()` ほか） |
| `text-roles.ts` | 大きい文字: `banner` の `headlineRole: 'display'` と、`bars` / `plane` の `labelRole` |
| `emphasis-tiers.ts` | 主役（solid）/ 次点（accent）/ その他（plain）の 3 段階と、凡例の「次点」 |

## Claude Code のスキル
`skills/svg-diagram/SKILL.md` は、Claude Code で図を作る手順（ビルド → 検査 → スクリーンショットで目視 → ズレ検査）をまとめたスキル。
`ln -s "$PWD/skills/svg-diagram" ~/.claude/skills/svg-diagram` で使える。

## ライセンス
MIT

## 開発（TypeScript）

全ソースは TypeScript（`.ts`）。ビルド工程はなく、Node の型ストリップ（Node ≥ 22.18）でそのまま実行する。このため `enum` / `namespace` などの非消去構文は使えない（`erasableSyntaxOnly`）。
型検査は `npx tsc -p .`（`pnpm typecheck`）、`strict: true`。図・画面の型は `lib/types.ts` にまとまっている（`Band`、`WfNode`、`LaidOutDiagram` など）。図のソースを `.ts` で書くと `import {diagram, box} from 'svg-diagram'` にも型が付く（`tsconfig` の `paths` で `lib/dsl.ts` を指す）。
