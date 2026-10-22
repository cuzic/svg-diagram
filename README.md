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
    pnpm exec svg-diagram typecheck     # 図のソースを型検査（案件側の tsc を使う。なければ clone 版のこのツール自身の typescript）
    pnpm exec svg-diagram build diagrams/*.ts

**グローバルに入れて使う場合**（`~/.local/bin/svg-diagram` のように、案件に `svg-diagram` を入れない）も `svg-diagram typecheck` は動く。tsconfig.json がない案件でも、`svg-diagram init` が書くのと同じ既定の設定（`diagrams/**/*.ts`）で動く。コンパイラは案件の `typescript`、なければこのツール自身の `typescript`（clone で `pnpm install` した版にだけある）、それもなければ PATH 上の `tsc`（`pnpm add -g typescript`）を使い、案件に `svg-diagram` や `@types/node` がなければ、一時的な tsconfig（`.svg-diagram-tsconfig.<pid>-<乱数>.json`、終了時に消える。並列に走らせても互いに干渉しない。案件の tsconfig を `extends` する）でこのツール自身の型定義へ向ける。手で書くなら、案件の `tsconfig.json` の `compilerOptions` に `"paths": {"svg-diagram": ["<このツールの場所>/lib/dsl.ts"]}` を足す（パッケージ版は `dist/lib/dsl.d.ts`）。

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

**ビルドが失敗したとき（古い SVG）**: `build` は、失敗しても既存の SVG（`.html`、`name.revealN.svg` も）を**消さず、書き換えない**。出力先には手で置いた SVG や他のツールの SVG があり、`<img src>` で参照されていることもあるので、削除はしない。そのため前回の成功時の SVG がそのまま残る。失敗した出力が**そのソース自身の前回の出力**（SVG に埋め込んだ `source` が一致する）なら、`✗` の行の次に `⚠ 前回の svg/flow.svg が残っている(ソースと一致しない古い絵)` を出す。手置きの SVG や別のソース由来の SVG、初回の失敗では出ない。
`lint-svg --strict` で落ちた `build` は exit 1 を返すが、その SVG は**新しい内容で既に書かれている**（古い絵ではない）。直すまで、`--no-lint` なしの `build` は exit 1 のまま。
**古さの警告**: `svg-diagram preview x.svg` と `show x.svg` は、SVG の生成元の情報（`<metadata id="svg-diagram">` のソースと import 先のハッシュ。ファイルの時刻は使わない）を今のソースと比べ、違えば古いと警告する（stderr に理由と `svg-diagram build <ソース>` の直し方。`preview` は stdout の `wrote ...` の行にも ` (古い: ソースが変わっている)` を足し、PNG の上端に赤い帯を描く。`show` は `--png` のときだけ帯）。ソースが見つからない SVG と、メタデータのない SVG（手置き・他ツール）は判定しない。exit code は 0 のまま。`--no-stale-banner`（`preview` のみ）で帯だけ消せる。`--require-fresh` を付けると古いときに exit 1（CI やエージェントの自動手順用）。SVG ファイルは書き換えない。

`svg-diagram preview` / `contact` / `show` は SVG をブラウザなしで描く（Rust 製の resvg。フォントは、文字幅の測定に使うのと同じファイルを、その図で使う字だけに切り詰めて渡す。resvg は描くたびにフォントを丸ごと解析し直すので、14MB の日本語フォントだと 1 枚 3 秒かかるが、切り詰めると 50〜100ms で、画素は同じ）。`--engine chromium` を付けると、実ブラウザが `<img>` として描いた絵になる（`playwright-chromium` が要る）。resvg が読めない環境（ビルド済みバイナリがない）では、`--engine` を省くと自動でブラウザに切り替わる。
`svg-diagram show` は人が端末で見るためのコマンド（Windows Terminal 1.22 以降、WezTerm、foot など sixel 対応の端末）。文書の `<img>` と同じ読み方（XML）で描くので、整形式でない SVG はエラーになる。`.ts` は検証に落ちても描き、問題を stderr に出して終了コード 1 にする。tmux 3.4 未満は sixel を通さないので、`--passthrough`（`set -g allow-passthrough on` が要る）か `--png FILE` を使う。端末のない環境（エージェントなど）は `--png FILE` で書いて画像として読む。
`canvas.minText` を 14 未満に下げた図は、`build` が書き出すたびに標準エラーへ 1 行出す（`⚠ svg/x.svg: 文字の下限を 10px に下げている(fontFloor 10。投影には向かない)`。ビルドは失敗しない。`lint-svg` のお知らせは、`build` が呼ぶときは終了コード 0 で捨てられるので、別に出す）。`build` が `lint-svg` を呼ぶときは、自分が読んだ `.svg-diagram.json` を `--config` で渡すので、出力先の近くに別の設定があっても、許可が食い違わない。詳しくは「スライド 1 枚のキャンバス」と「共通設定」。
動作確認: `pnpm test`、`svg-diagram build examples/inventory-wireframe.ts --out /tmp/x.svg`。

**複数の図をまとめて見る（`svg-diagram deck`）**: `svg-diagram deck a.ts b.svg --out deck.html` は、複数の図を、前へ・次へで見られる 1 つの自己完結 HTML にする（`--out` の既定は `deck.html`）。人が見る・人に渡す用の完成品で、図 1 枚の断片を書く `build --html` や、文書に埋める `md` の代わりではない。
- 入力は `.ts` と `.svg` を混ぜてよく、**引数の順がスライドの順**。`.ts` はメモリ上で描く（中間ファイルを作らない）。`deck` は `lint-svg` を走らせない: `build` / `check` を通した図を見る道で、検査の代わりではない。
- `--title TEXT` は文書の題、`--cols N`（1 以上の整数）は一覧の列数（既定は幅で自動）、`--csp` は `style-src` / `script-src` を SHA-256 で名指しする `<meta http-equiv="Content-Security-Policy">` を埋める（既定は出さない）。`--render svg` が既定で、`--render html` はまだない（終了コード 2）。
- 操作: `←` `→` / `PageUp` `PageDown` / `Space`（`Shift+Space` で戻る）/ `Home` `End`、`g` で一覧（`Esc` で閉じる。一覧は SVG を複製せず、同じ図を格子に縮める。縮小のボタンで 1 枚に移る）、`z` または図のクリックで等倍（一覧では効かない）。`input` や `Ctrl` / `Alt` / `Meta` 付きのキー、ボタン・リンクにフォーカスがある間の `Space` は奪わない。
- URL ハッシュで 1 枚を指せる: `#3`（1 始まり）、`#<名前>`（拡張子を除いたファイル名）、`#grid`（一覧）。スライドの読み上げ名と一覧のボタンの名前は、図の `<title>`（文書向けの図）、なければファイル名。移動のたびに `replaceState` で更新する（戻るボタンで 1 枚ずつ遡らない）。
- 印刷は 1 枚 1 ページ（`@page` の大きさは最大の図の論理サイズ）で、枠・ボタン・一覧は出ない。JS が使えなくても（無効、または CSP で止まったとき）全スライドが縦に並んで読める。ビューアの枠はダーク設定に追従し、図は図自身の `appearance` に従う。
- 外部への参照は出さない（外部 URL の `<image>` などは `⚠` の warning）。図の id は `s<番号>-<名前>-…` になり、`<metadata>`（ソースのパスとハッシュ）は取り除く。同じ入力から同じバイト列になる（CI で差分を見られる）。
- **1 つでも入力が失敗**（検証、`define` / レイアウトの例外、壊れた XML、ファイルなし）したら、失敗を全部表示して**何も書かず**終了コード 1。既存の `deck.html` は削除も書き換えもせず、前回の deck なら「the previous deck.html is still there, untouched」と知らせる。使い方の誤り（入力なし、未知の旗、`--cols` が整数でない、`.ts` / `.svg` 以外）は終了コード 2。
- まだない（第 2 段）: `--lazy`（大きい図の遅延描画）、全画面（`f`）、図ごとの名前付き `@page`、`--render html`、reveal の段階表示（最終の段階だけを見せる）。

**Markdown から使う**: 図のソースを画像として書く（`![流れ図](./diagrams/flow.diagram.ts)`。パスは Markdown ファイルからの相対）。

- **対象は `.diagram.ts` で終わるファイルだけ**で、ほかの `.ts` や外部 URL の画像には触らない。対象はソースとして `import` されて実行されるので、**信頼できない Markdown（ユーザー投稿など）には使わない**。絶対パス（`/…`、`//host/…`、`C:/…`）は拒否し、ソースは `root`（既定は作業フォルダ。`md` は `--root`）の中にあるものだけ読む。
- 出力は SVG（既定）か HTML/CSS（`build --html` と同じ。文字を選択でき、CSS から触れる）で、どのプラグインも `render: 'svg' | 'html'` で選ぶ。1 枚だけ変えるときは、画像の対象の後ろに `#html` / `#svg` を付ける（`![](flow.diagram.ts#html)`。こちらが優先）。**HTML 版は `<div>` でできているので、段落に図だけがある場合のみ**（文中の画像は、HTML を選んでいても SVG で描く。`<div>` は開いている `<p>` を閉じてしまう）。
- 画像の `alt` が図の名前（`aria-label`）になる。SVG は、ページに 2 枚置いても id が重ならないよう図ごとに接頭辞を付け、`<style>` はその図だけに効かせ、幅は本文に収める（`max-width:100%`）。
- 検査に通らない図は、既定でエラーにして止める。コードブロック（フェンス・インデント）、インラインコード、HTML コメントの中は触らない。`![alt][ref]` の参照形式は対象外。

**`svg-diagram md page.md --out out/page.md`**: ソースを描いて `out/svg/<名前>-<root からのパスのハッシュ>.svg` に書き、`![流れ図](svg/….svg)` に差し替えた普通の Markdown を出す（どの描画系でも読める。名前にハッシュを付けるので、複数のページが 1 つの `svg/` を共有しても上書きしない）。`--inline` は `<svg>` を、`--html` は HTML/CSS を Markdown に埋め込む。埋め込みは行を単独で占める図だけで、リスト・引用・表の中の `--inline` は SVG ファイルへの画像に戻し（`!` で知らせる）、`--html` はエラーにする。1 つでも失敗すれば何も書かず終了コード 1。プログラムからは `import {expandMarkdown} from 'svg-diagram/markdown'`（`{file, mode, render, root}`）。

**markdown-it**: `import svgDiagram from 'svg-diagram/markdown-it'; new MarkdownIt().use(svgDiagram, {render: 'svg'})`。図だけの段落は `<p>` に入れずブロックにする。パスはページからの相対（`env.path`、なければ `baseDir`、なければ cwd）。markdown-it の描画は同期で、図の描画は非同期なので、図は子プロセスで 1 枚ずつ描いて待つ（1 枚 1〜2 秒。`timeout` 既定 120 秒。ソース・import 先・`.svg-diagram.json`・アイコンの JSON が変わるまでキャッシュ）。図のソースが標準出力に何か書いても、結果には混ざらない。`{strict: false}` なら、検査に通らない図も描き、読めない図はページにエラーを出す。すでに描いた後に作った `.svg-diagram.json` は、次にそのソース（か import 先）を編集するまで気づかない。

**VitePress**: `.vitepress/config.ts` に `import svgDiagram from 'svg-diagram/vitepress'` と `markdown: {config: svgDiagram({render: 'html'})}`（中身は markdown-it プラグイン）。VitePress はページを Vue のテンプレートとして読み、`{{ }}` を式として評価し、`<style>` をクライアント側のビルドから落とし、ハイドレーションで DOM が食い違うので、図は Vue の `v-html` の値として出す（SSR・クライアントとも同じ文字列で、`{{ }}` は文字のまま）。図のソースと import 先・設定ファイルは VitePress の `env.includes` に登録するので、`vitepress dev` で編集するとページが描き直される（`vitepress dev` の再描画は、VitePress の監視の仕組みを読み、`createServer` で図のソースを書き換えて確かめた。`vitepress build` と、ブラウザでのハイドレーション・SPA 遷移後の見た目は実物で確認した）。`v-html` の中の文字は、VitePress のローカル検索の索引には入らない。

**remark**: `import svgDiagram from 'svg-diagram/remark'`、`unified().use(remarkParse).use(svgDiagram, {render: 'svg'}).use(remarkRehype).use(rehypeStringify)`。図は生の `html` ノードではなく本物の要素（hast。`className` `strokeWidth` など hast のプロパティ名）になるので、`allowDangerousHtml` も `rehype-raw` も要らない（`rehype-sanitize` を使うなら、svg と style を許すスキーマが要る）。図だけの段落は段落ごと置き換える。HTML 版は `<div class="svg-diagram">`。MDX・Astro・Docusaurus の remark 設定にも入る（それらでの動作は未確認）。remark の変換は非同期にできるので子プロセスは使わず同じプロセスで描き、同じプロセスでソースを編集すれば描き直す。使った図のファイルは `file.data.svgDiagramDeps` に入る。

## 使い方

    svg-diagram init [dir]                               # 案件の初期設定（package.json の type、tsconfig.json）
    svg-diagram typecheck                                # 図のソースの型検査
    svg-diagram check --typecheck <ソース.ts>...           # check に型検査も足す（build と check は型を読まないので、実行時に無視される誤った引数・キーが素通りする。tsc が約 3 秒/250 本）
    svg-diagram build <source.ts>... [--out file.svg | --out-dir DIR] [--stale] [--no-lint] [--png DIR [--scale N]]   # 既定の出力: ./svg/<name>.svg（.svg-diagram.json の "outDir" で変えられる）。--png: SVG と同時に PNG も DIR に書く（既定の倍率 2）
    svg-diagram build <source.ts> --dark --transparent   # 暗い配色／背景の矩形なしで描く（図の appearance / transparent を上書き）
    svg-diagram build <source.ts> --no-source-line       # diagram({sourceLine}) を描かない（スライド用と文書用を 1 つのソースで使い分ける。ソースは変えない。deck も同じフラグを受ける）
    svg-diagram build|check [--today YYYY-MM-DD] <source.ts>...   # gantt({today: 'auto'}) の日付を渡す（環境変数 SVG_DIAGRAM_TODAY、.svg-diagram.json の "today" でも可。「ガントチャート」の節）
    svg-diagram build <source.ts> --html                 # <name>.html も書く（文字・箱・表・線・矢印・曲線を HTML/CSS で。docs/adr/0006）
    svg-diagram build <source.ts>... --id-prefix <p|auto>   # 複数の図を 1 つの HTML に貼るとき、SVG/HTML の内側の id（svg-title・dsl-arrow など）と参照に <p>-<id> を付ける。ソースが複数なら <p>-<ソース名>-<id>、auto は内容ハッシュ（sd<8 桁>）。<metadata id="svg-diagram"> は書き換えない（check --drift・--stale が読む）。付けなければ出力は 1 バイトも変わらない。--stale とは併用しても毎回作り直す（docs/adr/0012 D2）
    svg-diagram check [--strict] [--verbose] <source.ts>...        # ルール検査（SVG は書かない）
    svg-diagram check --forbid-draft <source.ts>...      # diagram({status: 'draft'}) の図を warn にする（公開ジョブだけが付ける。「下書きバッジ」の節）
    svg-diagram check --drift [--svg-dir DIR] [--rebuild [--jobs N] [--no-cache] [--cache-dir DIR]] <source.ts>...   # 生成済み SVG が最新か（--rebuild: 再生成と比べ、違いを言葉で説明。並列＋成功のキャッシュ: 下の「ズレ検査を速くする」）
    svg-diagram check --changed[=REF] <source.ts>...   # 変わった図だけ検査
    svg-diagram check --rules | --explain RULE   # ルールの一覧 / 1 つの意味と許容の書き方
    svg-diagram check [--baseline FILE | --write-baseline FILE] [--format text|json|github|sarif] <source.ts>...   # 既存の警告を凍結して、新しい警告だけ見る / SARIF 出力
    svg-diagram check --covers 表.md|表.csv [--svg-dir DIR] <ソース.ts|図.svg>...   # 表を図に置き換えたとき、表のセルの語・数値が図に残っているか
    svg-diagram check --docs PATH... [--only GLOB]... [--svg-dir DIR] [--src-dir DIR] [--map]   # 文書（Markdown）と図が食い違っていないか（--map: 図・ソース・SVG・文書の対応表を Markdown で出す）
    svg-diagram md <page.md> [--out FILE] [--svg-dir DIR] [--inline | --html]   # Markdown の ![alt](flow.diagram.ts) を図に展開（SVG を書いて画像に差し替える。--inline は <svg>、--html は HTML/CSS を埋め込む）
    svg-diagram notes <source.ts>                        # 図の番号つき注釈を Markdown のリスト（1. **題名**：本文）で出す。文書に貼る
    svg-diagram diff old.svg new.svg                     # 2 つの SVG の違いを言葉で（見た目が変わるか）
    svg-diagram diff --text old.svg new.svg [--no-added] [--strict]   # 手書き SVG を DSL に直したとき、旧の文字・数値が新に残っているか（折り返し・tspan・全角半角・CJK を吸収。--strict: 欠けたら終了コード 1）
    svg-diagram contact a.svg b.svg ... --out sheet.png [--cols N] [--width PX] [--per-page N | --pages N]  # 図の集まりを 1 枚に並べて、一度に目視する（--out の置き場が無ければ作る）
    svg-diagram lint  [file.svg / file.ts / "glob" ...] [--svg-dir DIR] [--strict] [--fix] [--engine geometry|browser] [--config .svg-diagram.json]   # 描画後の検査も、既定は SVG の幾何から（ブラウザなし）。設定は SVG のあるディレクトリから探す（--config で明示）
    svg-diagram preview <in.svg> [out.png] [scale] [--engine resvg|chromium] [--gray] [--no-stale-banner] [--require-fresh]   # 既定の倍率 2。--gray: 白黒で描く。ソースより古い SVG は警告と赤い帯（--require-fresh: exit 1）。out を省くと一時ディレクトリに重ならない名前で書き、パスを表示
    svg-diagram deck <a.ts|a.svg>... [--out deck.html] [--title TEXT] [--cols N] [--csp]   # 複数の図を、前へ・次へで見られる 1 つの自己完結 HTML に（一覧・拡大・印刷つき）
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
| group(children, {title, tone, titleAlign, valign, flex, width, span, col}) | ラベル付きの枠。**入れ子可**（ホスト > コンテナ > プロセス）。`row([group(...), group(...)])` で横に並べると、枠の高さは一番高いものにそろい、低いほうの中身は余りの中で縦中央に寄る（余りが 16px 未満なら動かない。`valign: 'top'` で上詰め、`'stretch'` で箱 1 つが余りを埋める。`flex` / `width` / `span` / `col` は box と同じ。`arrows: 'between'` は不可）。中の box の id も、`connect()` の参照先になる |
| versus(left, right, {shared, connectLabels}) | 左右の `group()` を 12 列の半分ずつに並べる対比。各部は `{title, children, tone, id}`。`shared` を付けると、その共通部を下に置いて左右から接続する（3 部すべてに `id` が必要）。接続ラベルは `connectLabels.left` / `.right`、接続線は各部の中央から共通部へ垂直に降りる（`connectRoute` は `'straight'` 既定 / `'elbow'`、`connectArrow: 'none'` で矢頭なし）。各部の `children` は配列（縦積み）で、`direction: 'row'` なら横並び |
| hero({banner, stat, flow, caption, note}) | 章の頭に置く 1 枚: 帯（任意）の下に、流れの箱（`flow: [box(...), ...]`、矢印でつなぐ）とその行き着く大きな数字（`stat: {value, label, tone}`）を 1 行に並べ、その下に一言（`caption`）と出典・注（`note`）。箱が 5 つ以上なら数字を上に置く（`layout: 'stack'`）。既存の部品を並べるだけ。下の「章の頭の 1 枚」 |
| connect / branch | 矢印。route(straight/elbow/loop-under/loop-side)、arrow(end/both/start/none)、line(solid/dashed/dotted/double)、weight(strong)、chip、labelAt、アンカー `id:side@0.2` |
| legend(items) | 線種・トーンの凡例 |
| swimlane(lanes, steps, {flows, phases, fit}) | スイムレーン図。レーン=担当（人・チーム・システム）、列=時間。引き継ぎの矢印を自動で向きづけ。`col` で並行作業を揃える。列が狭くなるときは `fit: 'shrink'` でレーン名の列と列の間隔を詰める |
| sequence(actors, steps) | シーケンス図。message / self / note / divider、自動番号 |
| table(columns, rows, {title}) | 見出し付き表（ER の entity 兼用）。セルは {text, tone, bold, mono}、`cell('通る', {mark: 'ok'})` で ○△×◎ の記号つき（色だけに頼らない） |
| wireframe(root, {title, tag, h, frame, notes, skeleton}) | 画面 1 枚のローファイ・ワイヤーフレーム + 番号つき注釈欄。部品は `wf.*`（下記）。`n:` で番号の丸、`mark:'new'/'changed'` で新規・改修の枠 |
| screens(items, {cols, gap, rowGap, h, skeleton}) | 画面のサムネイルを並べる（画面遷移図）。item の `at:[行, 列]`（列は小数可）で配置、各 `id` を `connect()` で結ぶ。`skeleton` で文字を帯に |
| stateMatrix(cols, rows, {required, cellH, cellFrame}) | 部品の**状態の一覧**。行=部品、列=状態（通常・読み込み中・空・エラー…）。欄は `wf.*` の図、`'na'` / `{na: '理由'}`（対象外）、未指定（**未設計**。`check` が警告）。`required` の列がなければ警告。行は `stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', ...})` で「部品 1 つ + 状態ごとの差分」としても書ける |
| timeline({from, to, now, deadline, marks, remaining}) | 横軸が時間の部品。期限（danger 色の大きな点）、今日、途中の日付（`marks`）を旗で示し、今日から期限までを太い帯と「あと 1 年 5 か月」で見せる。詳細は下の「時間軸と期限」 |
| timeline({unit, from, to, lanes, events, spans}) | **数値の軸**（`unit: 'ms'`、`from: 0`、`to: 700`）の時間軸。レーン・イベント（点と名前と値）・区間（棒、`dim: true` なら寸法線で長さを自動で書く）。下の「数値の時間軸」 |
| steps(items, {numbered, highlight, highlightTone, arrows, id}) | 日付のない「順序だけの出来事」。番号バッジ・アイコン・タグ・本文つきの箱を矢印でつなぎ、1つだけ強調する。中身は普通の `row()`（`id#n` で `connect()`・`bracket()` の端点になる）。下の「順序だけの出来事」 |
| bracket(from, to, {label, side, tone}) / callout(target, {text, side}) | 注釈用のコネクタ。`bracket` は 2 つの箱にまたがる括弧、`callout` は箱を指す吹き出し。下の「注釈のコネクタ」 |
| tree(root, {dir, maxNodeW, id}) | 組織図・階層図。配置は自動（親は子の中央、同じ階層は揃う）。節は `{label, sub?, id?, tone?, children?}`。`id` を付けた節は `connect()` の端点になる（`t.anchors.<id>` でも取れる）。詳細は下の「組織図（`tree`）」 |
| mindmap(root, {layout, edges, sides, maxNodeW, id}) | マインドマップ。節は `tree()` と同じ。`layout` で形を選ぶ: `radial`（既定。中央から左右へ）/ `right`・`left`（片側。ロジックチャート）/ `down`・`up`（ツリー）/ `org`（組織図型）/ `list`（リスト・アウトライン型）/ `brace`（ブレース型）/ `fishbone`（特性要因図）/ `timeline`（タイムライン型）。`edges` で枝を `elbow`（既定）・`curve`・`straight` に。`sides: {枝の id: 'left'｜'right'}` は `radial` のとき、ルートの子を左右に固定する。下の「組織図（`tree`）」 |
| stateDiagram(states, transitions, {initial, dir, maxNodeW, id}) | 状態遷移図。状態 `{id, label, sub?, tone?, final?}` と遷移 `{from, to, label?, line?}` を書くだけで、層に分けて自動配置する。戻る矢印・飛ばす矢印・自己ループも、ほかの状態を避けて引く。状態は `connect()` の端点になる。詳細は下の「状態遷移図（`stateDiagram`）」 |
| causeTree(nodes, links, {dir, maxNodeW, id}) | TOC（制約理論）の因果の図: 現状ツリー・未来現実ツリー・前提条件ツリー・移行ツリー。実体 `{id, label, role?}` と `{from, to}`（`from` を配列にすると AND）を書くだけで、下が原因・上が結果に自動配置する。詳細は下の「TOC の思考プロセス」 |
| cloud({a, b, c, d, d2}, {assumptions, conflictLabel, id}) | TOC のクラウド（対立解消図）。共通目的 A・必要条件 B/C・対立する要望 D/D' の 5 つの箱と、前提の番号付き一覧。詳細は下の「TOC の思考プロセス」 |
| gantt(rows, {from, to, today, id}) | ガントチャート。行は、タスク `{label, start, end｜days, id?, progress?, after?, tone?, milestone?}` と、見出し `{section}`。日付は `'YYYY-MM-DD'`（`end` はその日を含む。`'2026-10'` のような略記は止まる）。軸・目盛り・今日の線・依存の矢印・進捗は自動。詳細は下の「ガントチャート（`gantt`）」 |
| classDiagram(classes, relations, {dir, id}) | UML クラス図。クラス `{id, name?, stereotype?, abstract?, attrs?, methods?, tone?}` と関係 `{from, to, kind?, label?, fromMult?, toMult?}`。親が上になる層に自動配置し、矢印の端の記号は `kind` で決まる。詳細は下の「クラス図（`classDiagram`）」 |
| bpmn(lanes, nodes, flows, {id, fit}) | BPMN 風の業務フロー。レーン（担当）に、タスク・開始/終了イベント・ゲートウェイ（排他 `xor`・並行 `and`・包括 `or`）を置き、矢印で結ぶ。列は流れから、行はレーンから決まる。破線は、レーンをまたぐメッセージ。詳細は下の「業務フロー（`bpmn`）」 |
| faultTree(top, {id, maxNodeW, cutSets, quant, quantPeriod}) | 故障の木（FTA）。頂上事象から、ゲート（`and` / `or` / `vote`（`k`）/ `inhibit`（`condition`））で原因をたどり、基本事象（円）・未展開（ひし形）・家（`state`）で終わる。`inhibit` の `condition` は楕円（条件事象）。事象の文は矩形、記号はその下。同じ基本事象は `{ref: id}` で描き直す（線は飛ばさない）。線に矢じりは無い（下へ読む）。幅が足りないとき `maxNodeW` を省略すると縮めて警告、`'auto'` なら注、数値なら縮めず止まる。`ref` は葉の事象だけ。`cutSets: true` は単独で頂上を起こす事象（大きさ 1 の最小カットセット）に太枠とバッジ（基本事象は「単一故障点」、未展開は「未展開・単独で頂上へ」）。カットセットが多すぎる木（途中 5000 超）は止まる。`quant: true` は各葉の `p`（0〜1、ある期間の確率。家形以外の葉はすべて必須。ゲートのある事象と家形には書けない）から頂上の確率を求め、注に書く（`quantPeriod: '1 年間'` で期間も）。独立を仮定し、`ref` で共有した事象は場合分けで厳密に、共有が 12 個を超えると min-cut upper bound の上限（概算）。頻度（/年）は扱わない。`diagram({legend: 'auto'})` は使った事象と**ゲートの記号**の凡例を足す（`legend([{ftaEvent: 'basic', label}, {ftaGate: 'and', label}])` も可）。例は `examples/fta.ts` |
| pareto(items, {top, other, guide, highlight, unit}) | パレート図（QC 七つ道具）。項目 `{label, value}` を大きい順の棒にし、右の 0〜100% の軸に累積比率の折れ線。80% に届くまでの項目だけ色が付く。詳細は下の「QC 七つ道具と新 QC 七つ道具」 |
| histogram(values, {bins, width, lsl, usl, target, normal}) | ヒストグラム。測定値をそのまま渡す。区間の幅は切りのよい数、棒は接し、区間の境目が下に付く。規格の上下限・平均・正規分布の曲線 |
| scatter(points, {x, y, regression}) | 散布図。軸は点に合わせて自動。`group` で層別（色と形が変わる）、`regression: true` で回帰直線と相関係数 r（`plane` を返す） |
| controlChart(type, data, {limits, at, rules}) / xbarR(subgroups) | 管理図。`'x'｜'mr'｜'xbar'｜'r'｜'p'｜'np'｜'c'｜'u'`。中心線と 3σ の管理限界を計算し、外れた点（✕）・連と傾向（○）を赤にする（`plane` を返す） |
| checkSheet(items, columns, {as, total, boxes}) | チェックシート。件数は「正」の字、計の行と列は自動。`counts` なし・`boxes: true` で手書き用の空の用紙（`table` を返す） |
| matrix(rows, cols, cells, {weights, values, total}) | マトリックス図（L 型）。◎ ○ △ × の記号、重み付きの評価点と最高点の印（`table` を返す） |
| canvas(template, content, {title, emphasis, id, h, fit}) | 枠が決まったキャンバス。`bmc`（ビジネスモデルキャンバス）・`lean`・`vpc`・`swot`・`tows`・`errc`・`pest`（`pestle: true` で PESTLE）・`threeC`・`sevenS`・`fiveForces`・`empathy`・`persona`・`a3`。内容は領域ごとの箇条書き（`grid` を返す） |
| affinity(groups, {cols, cardCols}) | 親和図。カードを表札付きのグループに、グループの中にグループを入れ子にできる（`group` と `row` を返す） |
| relationDiagram(nodes, links, {problem, counts}) | 連関図。要因と因果の矢印（戻る矢印も可）。出る矢印・入る矢印の数を書き、出る矢印が最多の要因を主原因に（`causeTree` を返す） |
| pdpc(nodes, links, {dir}) | PDPC 法。道筋（実線）と、懸念（六角形）・対策（点線）。`role`: start / step / risk / measure / goal（`causeTree` を返す） |
| arrowDiagram(activities, {dir, times, summary}) | アロー・ダイヤグラム。丸が結合点、矢印が作業。最早/最遅の時刻・余裕・クリティカルパス（赤い太線）を計算する（`stateDiagram` を返す） |
| waterfall(steps, {unit, dir, axis, connectors}) | ウォーターフォール図。開始 `{label, value}`・増減（`value` は ± の差）・小計/合計（`kind: 'subtotal'｜'total'`、`value` なしで累計）。棒は前の水準から浮き、コネクタで水準をつなぐ。値は `+220` / `-130` と符号つきで必ず書く。詳細は下の「コンサル系のチャート」 |
| radar(axes, series, {max, values, unit}) | レーダーチャート。3〜12 軸・1〜4 系列。同心の目盛りに値、系列は線の種類と印の形（○ □ ◇ △）が違い、凡例に同じ線と印が出る |
| heatmap(rows, cols, values, {unit, levels, corner, scale}) | ヒートマップ・コホート表・リテンション表。セルには数字を必ず書き、濃さは 3〜6 段階。`null` は空欄（–）。段階の凡例つき |
| lines(series, {x, y, target, annotate}) / strategyCanvas / burndown / burnup | 折れ線（`plane` の薄い層）。系列ごとに印の形と線の種類が違い、名前は線の右端に直接書く。目標線・注目点。戦略キャンバス・バーンダウン・バーンアップのひな形つき |
| stackedBars(columns, {unit, percent}) / mekko(columns, {unit}) | 積み上げ棒（`percent: true` で 100%）とマリメッコ図（列の幅 ∝ 合計、高さ ∝ 構成比）。各部分に数字。入らない部分は描かず `<desc>` に残る |
| treemap(tree, {unit, percent, strict}) | ツリーマップ（squarified）。面積 ∝ 値（グループの枠と見出しの分も補正し、グループの中でも外でも同じ比）。名前と値が入らない小さなセルは描かず `<desc>` に残る（`strict: true` はエラー） |
| sankey(nodes, links, {unit, align}) | サンキー図。層に分け、ノードの高さとリボンの太さは値に比例（目盛りは図全体で一つ）、ノードの名前に値、重ならない。リンクのないノードはエラー |
| tornado(items, {base, unit}) | トルネード図（感度分析）。基準値から低ケース・高ケースの棒、幅の大きい順 |
| bubble(points, {x, y, sizeTitle, sizeUnit}) | バブルチャート。x・y が数値軸、円の**面積**が 3 つ目の指標（凡例の円つき）。`x.line` / `y.line` で境目の破線。名前は円の中か横、軸は円がはみ出さないよう自動で広がる |
| butterfly(rows, {leftLabel, rightLabel, unit}) | バタフライチャート。中央の項目名をはさんで、左右の群の棒を同じ目盛りで比べる。`sort: 'left'｜'right'` |
| combo(categories, series, {y, y2}) | コンボチャート（棒 + 折れ線）。棒は左軸、折れ線は右軸（`axis: 'left'` で左）。値は単位つきで全部書き、入らないものは `<desc>` に残る |
| harvey(rows, cols, values, {levels, highlight}) | ハーベイボールの評価表。値は 0〜4（四分円の数）、`null` は未評価。形（扇）で段階を示し、凡例つき |
| pyramid / curve | ピラミッド、曲線 |
| people(total, count, {cols, size, gap, align, tone, alt}) / dots(values, {zones, lowLabel, highLabel, min, max, r}) | 人数の絵（`people(100, 76)` = 100 人中 76 人）、レーン上の点の分布。下の「人数の絵とレーン上の点」 |
| math(tex, {role, inline, align, tone, alt}) | TeX の数式（MathJax で輪郭にして SVG へ。Web フォント・foreignObject 不要）。下の「数式」 |
| quadrant({x, y, grid, cells, items, arrows, preset}) / quadrant.preset(name, opts) | 象限図・分類マトリクス（2×2・3×3・任意の N×M）。軸は名前と両端の言葉（`x: {title, low, high, reversed}`）、マスは文字の見出し（`cells[行][列]`: `{title, note, tone}`）、項目は `{label, cell: [列, 行]｜at: [x, y], size?, tone?, group?, id?}`。プリセット `bcg｜ge｜ansoff｜nineBox｜impactEffort｜risk｜stakeholder｜positioning｜eisenhower`。重なりは出ない。詳細は下の「象限図・分類マトリクス」 |
| chevron / funnel / cycle / venn / concentric / emblem | 流れ・絞り込み・循環・集合・階層・図形に入れた文字を表す flowShapes。各項目の `id` は `connect()` / spotlight の対象。詳細は下の「flowShapes」 |
| wordart(text, {style, writing, size, tone, gradient, outline, shadow, glow, bevel, extrude, reflection, arc, rotate, flip, font, plate, limit}) | 太字・縁取り・影・光彩・立体・反射・グラデーション・弧・回転の飾り文字と**縦書き**を band 1 つで。下の「ワードアート・縦書き」 |
| plane({x, y, points, lines, dims, labels}) | 座標平面。軸・目盛り・点・補助線・**寸法線**・ラベルを、座標の単位のまま宣言する（地図 ↔ 画像の座標変換、位置の誤差）。`yDown: true` で画像座標。ラベルが、他のラベル・軸と矢印・目盛り・点・補助線・寸法線に重なる、または図からはみ出すと検査で止まる（寸法線の文字は、その線の上に載るのが正） 。`paths: [{through: [点の id か座標…], smooth?, dashed?, tone?, arrow?, reveal?}]` で複数点を通る線を引く（実線が既定。`smooth: true` は点を必ず通る曲線で、x が増える道筋は単調な 3 次補間（値を行き過ぎない）、そうでない道筋は centripetal Catmull-Rom。`smooth` なしは折れ線。曲線が軸の外に出る・ラベルに重なると検査で止まる。`examples/plane-paths.ts`）。`grow: true` を付けた path は、段階（`reveal`）ごとに、出ている点までの曲線を同じ形のまま伸ばす（`examples/plane-grow.ts`）。点のラベルは `labelAt` を書かなければ右に置き、線や他のラベルと重なるときは空いている側（左・上・下・斜め）へ自動で移る。`labelAt` で側を書くとそのまま、`labelOffset: [dx, dy]` で位置をずらせる。自動の置き場は寸法線（延長線を含む）・補助線・軸・目盛りも避ける。軸に `categories: ['営業', '開発', …]` を書くと、レーン名・段階名が 1, 2, 3 … の位置の目盛りになる（`max` は個数 + 1） |

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

`stat(value, label, opts)` は、大きな値と補足ラベルを中央揃えにした plain の `box()` を返すため、そのまま `row()` に入れられる。`size` は `'stat'`（34px、既定）または `'display'`（56px）。`tone` は値の文字色で、ラベルは muted。`'accent'` だけは箱も accent の塗り（`tones.accent.fill` の上書きに従う）にし、白黒でも plain の数値と見分けがつく。`'solid'` / `'solid-danger'` は箱全体を濃く塗り、文字は白。他の tone は箱の見た目を変えない。値は折り返さない。箱の幅に収まらなければ、1px 刻みで 24px（canvas / fill では `round(24 × 倍率)`。下限は `min(run.size, max(round(24 × 倍率), minText))`）まで自動で縮め、縮めたら info の `stat-fit-shrunk` を出す（同じ列の `stat` と大きさがそろわない。`accept` で許容できる。箱を広げるか値を短くするとそろう）。それでも収まらなければ検証エラーで、下限・実測の幅・箱の幅と `fix:` の行（箱を広げる / 値を短くする / 単位をラベルへ）が出る。`size` の語彙は `'stat'` / `'display'` の 2 段のまま。収まっている図の出力は変わらない。

```ts
row([
  stat('76%', '導入前', {tone: 'danger'}),
  stat('31%', '導入後', {tone: 'accent', size: 'display'}),
])
```

**数字の出典と根拠の強さ**: `stat(value, label, {source, confidence})` は、箱の 3 行目に `出典: <source>  ◎ 一次資料` を足す（14px・muted・中央。`solid` / `accent` の箱では色を付けず箱の文字色）。`confidence` は `'primary'`（◎ 一次資料）/ `'secondary'`（○ 報道・二次資料）/ `'unverified'`（△ 未確認）で、記号と語で伝え、色は使わない（ラベルの差し替えは不可）。`source` は必須で、`confidence` だけを書く・`source` が空や複数行だと throw。`hero({stat: {...}})` でも同じオプションが使える。箱の高さは 3 行目のぶん増え、出典が長いと箱の中で折り返す（長い出典は本文へ）。縮小（上）の対象は値だけで、3 行目は縮めない。`source` を書かない `stat` の出力は変わらない。　記号（◎ ○ △）の意味を図に書かない運用なら、`confidenceStyle: 'text'` で記号なしの語だけ（`一次資料`）にするか、`confidenceLabels: {primary: '一次資料（公的統計）'}` で文言を差し替える。多くの `stat()` に同じ指定をするなら、`const s = (v, l, o) => stat(v, l, {confidenceStyle: 'text', ...o})` のような自作の関数に包む。
`diagram({evidenceCheck: 'info' | 'strict'})` を書いた図だけ、`source` の無い `stat`（`row` / `hero` の中も）ごとに `stat-no-source`（`数字 76% に出典がない`）を出す。`'strict'` で warn（`check --strict` で落とすならこちら）。書かなければ検査は出ない。描画は変わらない。許容する数字は `accept: {'stat-no-source': '理由'}`。`.svg-diagram.json` での既定は未実装。

`bars(data, opts)` は横棒（既定）、縦棒（`dir: 'v'`）、積み上げ（`stack: true`）を描く。`series` は `a | b | c` で、それぞれ accent / text / muted。棒ごとに `tone: 'accent' | 'danger' | 'muted'` も選べる（`danger` が赤。`series` とは併用できない。`examples/spotlight-dim-fill.ts`）。`max` を省くと通常は最大値、積み上げでは合計値になる。値ラベルは必ず描かれ、`unit` は値の後ろに付く。各項目の `id` は `connect()` のアンカーとして使える。

**範囲の浮き棒（`range` / `rangeBars`）**: 見積りの幅や信頼区間のように「最小〜最大」を 1 本で描くなら、データに `value` の代わりに `range: [lo, hi]` を書く（`rangeBars([{label: '設計', range: [3.2, 5.8]}], {unit: '万円'})` も同じ。`value` と `range` はどちらか 1 つ）。棒は 0 から伸びず、`lo` から `hi` まで浮く（軸は 0 から。`max` を省くと、いちばん大きい `hi`）。値の文言は `3.2〜5.8万円`、`<desc>` も範囲で書く。`0 <= lo < hi` で、`lo` が負だと止まる。`stack` / `cumulative` / `hideZero` / `replaces` とは併用できない。範囲を読むための凡例は自動では出さない（棒の両端と文言が説明する）。例は `examples/bars-range.ts`。

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
| `valueFormat` | 値の書き方。既定は、整数はそのまま（1055 は 1055）、小数は有効数字 3 桁（ただし整数部は削らない: 1055.5 は 1056）。`'exact'`（与えた数のまま）、小数の桁数（`1` なら 1055.3）、関数（`` v => `${v}件` ``）も書ける |
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
- 兄弟が多くて図の幅を超えるとき、`dir` を省略するか `dir: 'auto'` にすると、節を狭め（`maxNodeW` 200 → 110）、`right` に回して収める（`mindmap` は `layout` を変えず、`maxNodeW` を省略したときだけ狭める）。`dir` / `maxNodeW` を書いた図は変えず、試した案を書いて止まる（`dir: 'right'`、`maxNodeW` を小さく、階層を分ける。`mindmap` は `layout: 'list'`）。詳しくは「幅に収まらない自動配置の図」。
- `id` を付けた節は、`connect()` の端点（`connect('pf', '外部')`）。`tree()` 自身の `id` は、図全体の端点と spotlight の対象。`reveal` は図全体に付く。例は `examples/org-chart.ts`、`examples/org-chart-right.ts`。

`mindmap(root, {layout, edges, sides})` は同じ節の書き方で、`layout` を替えるだけで形が変わる（既定は `radial`）。

| `layout` | 形 | 使いどころ |
|---|---|---|
| `radial` | ルートを中央に、枝が左右へ。書いた順に、前の半分を右、残りを左へ振り分け（高さで釣り合わせ、どちら側も上から下へ）。`sides` でルートの子を左右に固定 | 発想、全体像 |
| `right` / `left` | 起点を左（右）端に置き、片側へ親→子→孫と展開（ロジックチャート） | 大きなテーマを分解する |
| `down` / `up` | 上（下）から下（上）へ分岐するツリー。兄弟が多いと幅を超える | 分類、階層 |
| `org` | ルートの下に子が横一列、各子の下に子孫のリストが字下げでぶら下がる（組織図型） | 組織、役割 |
| `list` | 全ノードを縦に並べ、字下げで階層を示す（アウトライン） | 議題、ToDo |
| `brace` | 右へ展開し、親から子へ `{` のブレースで分解する（ブレースマップ） | 全体と部分の分解 |
| `fishbone` | ルートが魚の頭（右）、背骨に斜めの骨。ルートの子がカテゴリ（大骨）、その子が原因（中骨）、孫以下は原因の下に字下げでぶら下がる（小骨。下半分の骨では上下が逆になり、小骨が原因の上に付く）。特性要因図（`examples/qc-fishbone.ts`） | 原因分析 |
| `timeline` | ルートを左端に、横の軸に沿って子を上下交互に並べ、各子のリストが軸から遠ざかる向きに伸びる | 経緯、計画 |

`edges: 'curve' | 'straight'` は、`radial` / `right` / `left` / `down` / `up` で枝の線を滑らかな S 字・直線にする（ほかの形で指定すると、そう書いて止まる）。`sides` は `radial` のときだけで、ルートの子だけを `id` で左右に固定できる（深い節や未知の id は止まる）。幅を超えるときは、`layout` を `list` / `right` / `left` に替えるか、`maxNodeW` を小さくする。マトリクス型・ツリーテーブル型は、マインドマップの配置ではなく表なので `table()` で描く。節の `id` は `connect()` の端点になる。例は `examples/mindmap.ts`（radial）、`examples/mindmap-brace.ts`、`mindmap-fishbone.ts`、`mindmap-org.ts`、`mindmap-timeline.ts`、`mindmap-list.ts`。

### 状態遷移図（`stateDiagram`）

```ts
stateDiagram(
  [{id: 'idle', label: '待機'}, {id: 'run', label: '実行中'}, {id: 'done', label: '完了', final: true}],
  [{from: 'idle', to: 'run', label: '開始'}, {from: 'run', to: 'idle', label: '中止'}, {from: 'run', to: 'run', label: '再試行'}, {from: 'run', to: 'done'}],
  {initial: 'idle', dir: 'right'},
)
```

- 座標は書かない。状態を、遷移の向きに沿って層に分け（循環は、戻る遷移として逆向きに扱う）、交差が減るように並べる。`dir: 'right'`（既定）は左から右、`'down'` は上から下。
- `initial` は、黒い点と、そこから入る矢印。`final: true` の状態は二重の枠。`tone` は箱と同じ（`danger` のほか、主役の `'solid'` と異常の `'solid-danger'` は、塗りつぶして白い文字になる）。戻る遷移は同じ層の間で別の帯を通り、絡まない。
- 幅を超えるとき、`dir` を省略するか `dir: 'auto'` にすると、状態を狭め、`right` ⇄ `down` を替えて収める（書いた `dir` / `maxNodeW` は変えない。「幅に収まらない自動配置の図」）。層を 2 つ以上飛ぶ戻りの遷移は、`returns: 'outer'`（既定 `'inline'`）で状態の外側のレーンに回せる（`dir: 'down'` で自己ループがあると、レーンと重なることがある）。
- 遷移は、直角に折れる矢印で、層を飛ばすものは間の状態を避けて迂回する。同じ 2 状態の間の行き来や、同じ側に出入りする矢印は、位置をずらして重ならないようにする（1 つから出る矢印は遠い行き先ほど先に、1 つへ入る矢印は近い尾ほど先に曲がり、互いに交差しない）。自己ループは、`dir: 'right'` では状態の上、`'down'` では右に出る。
- ラベルは、矢印の直線部分の脇に置く。矢印の先や、状態・ほかのラベルに重なるときは、矢印に沿って場所を探し、それでも入らなければ矢印の脇に動かす。それも無理なら `check` / `build` が、どのラベルが何に重なるかを書いて止まる。矢印が無関係の状態を貫くときも止まる。ラベルが長いと層の間隔が広がるので、図の幅を超えたら、幅と直し方（`dir: 'down'`、`maxNodeW`、ラベルを短く）を書いて止まる。
- 矢じりはマーカーではなく図形で描く（resvg は、左向きの終端マーカーを回さないため）。状態の `id` は `connect()` の端点で、`t.anchors.<id>` でも取れる。例は `examples/state-diagram.ts`。

### 判断のある流れ図（`flowchart`）

```ts
flowchart(
  [
    {id: 'start', kind: 'terminator', label: '新人からの相談'},
    {id: 'q1', kind: 'decision', label: '自分で答えられる？'},
    {id: 'a1', label: '回答する', sub: '終了'},
    {id: 'q2', kind: 'decision', label: '調べればわかる？'},
    {id: 'a2', label: '調べて回答する'},
  ],
  [{from: 'start', to: 'q1'}, {from: 'q1', to: 'a1', label: 'Yes'}, {from: 'q1', to: 'q2', label: 'No'}, {from: 'q2', to: 'a2', label: 'Yes'}, {from: 'a2', to: 'q1', label: 'まだ解決しない', line: 'dashed'}],
)
```

- 座標は書かない。`stateDiagram` と同じ配置（層に分け、直角の矢印で結ぶ）で、**既定は上から下**（`dir: 'right'` / `'auto'` も書ける）。節の `kind`: `process`（角丸の箱。既定。`sub` で 2 行目、`tone`、`icon` も）/ `decision`（ひし形。**質問が中に入り、文字の長さに合わせて大きくなる**）/ `terminator`（開始・終了の、両端が丸い箱）。`initial` / `final` は無い（開始・終了は `terminator`）。
- 矢印は `stateDiagram` の遷移と同じ（`label` / `line` / `tone` / `strong`）。判断から出る矢印の `label`（Yes / No など）は、ひし形のそばの矢印の脇に置かれる。ひし形に出入りする矢印の端は、ひし形の輪郭まで延びる。
- **戻る矢印（やり直し）は、既定で図の外側を回る**（`returns: 'outer'`。判断へ戻る矢印は横の頂点に入る）。`returns: 'inline'` にもできる（別のノードを通ると build が止まる）。判断・開始終了の自己ループは書けない。
- ひし形は同じ文でも箱の 2〜3 倍の高さになる。判断が多い流れで縦に長くなるときは、`dir: 'right'` にするか、図を分ける（`aspect-tall` が知らせる）。レーン（担当）が要る業務フローは `bpmn`。
- 検査: 判断から出る矢印が 2 本未満・3 本以上・ラベルなし（情報 `flowchart-decision-edges`）。ほかは `stateDiagram` と同じ（`text-mid-word-break`・`edge-crossings` など）。例は `examples/flowchart.ts`、設計は ADR 0041。

### TOC の思考プロセス（`causeTree` / `cloud`）

Goldratt の制約理論（TOC）の図は、箱の形より**矢印の意味**が約束事になっている。十分原因（「Xが成り立てばYが起きる」）の現状・未来現実・移行ツリーと、必要条件（「Yのためには X が必要」）の前提条件ツリー・クラウドは、同じ箱と矢印で描いても読み方が違うので、図の見出しか凡例で書く。

```ts
causeTree(
  [{id: 'late', label: '納期に遅れる', role: 'ude'}, {id: 'cost', label: '残業費が膨らむ', role: 'ude'},
   {id: 'switch', label: '作業の切り替えが多い'}, {id: 'rush', label: '急ぎの割り込みが入る'}, {id: 'kpi', label: '稼働率で評価される', role: 'root'}],
  [{from: 'kpi', to: 'switch'}, {from: 'kpi', to: 'rush'}, {from: 'switch', to: 'late'}, {from: ['switch', 'rush'], to: 'cost'}],
)
cloud({a: '製品を成功させる', b: '品質を確保する', c: '市場機会を逃さない', d: '検証に時間をかける', d2: '早くリリースする'},
      {assumptions: [{on: 'bd', text: '品質確保には長い検証期間が必須だ', injection: '自動テストで検証を短くする'}]})
```

| 図 | 書き方 |
|---|---|
| 現状ツリー（CRT） | `causeTree`。好ましくない現象は `role: 'ude'`、根本原因は `role: 'root'`（二重枠） |
| 未来現実ツリー（FRT） | `causeTree`。入れる施策は `role: 'injection'`、望む結果は `role: 'de'`。凡例は `diagram({legend: 'auto'})` で出る |
| 前提条件ツリー（PRT） | `causeTree`。目標 `role: 'goal'`（二重枠）、中間目標 `role: 'io'`、障害 `role: 'obstacle'`（六角形）。中間目標は「〜が得られている」と、障害を越えた状態で書く |
| 移行ツリー（TT） | `causeTree`。行動は `role: 'action'`、ニーズは `role: 'need'`（塗りつぶし）。現在の状態・ニーズ・行動を `from: [...]`（AND）で束ねて、次の状態へ。単位ごとの書き方は `transitionUnits()` |
| ネガティブブランチ（NBR） | `causeTree(…, {tree: 'nbr'})`。施策 `role: 'injection'`、転換点 `role: 'tipping'`（危険色の二重枠）、悪い結果 `role: 'ude'`、転換点を断つ施策 `role: 'trim'`（破線の枠。`kind: 'blocks'` の辺で転換点へ） |
| クラウド | `cloud`。矢印は「A のために B が必要、B のために D が必要」と読む向き（目的へ向かう）。D と D' の間の赤いジグザグが対立 |

- `causeTree` は座標を書かない。`dir: 'up'`（既定。原因が下、結果が上）・`'down'`・`'right'`・`'left'`。`from` が配列のリンク（AND）は、矢じりの手前にまたがる弧で束ねる。束ねずに別々に書いたリンクは、それぞれ独立に十分な原因（OR）。矢印は十分原因・必要条件のどちらでも同じ描き方なので、どちらの論理かは見出しに書く。
- 悪循環・好循環の戻りの矢印（UDE → 根本原因、成果 → 信頼）には `back: true` を付ける（`{from: 'late', to: 'kpi', back: true}`。`from` は 1 つの節で、AND の配列とは併用できない）。宣言した矢印は、層を決めるときに最初から「戻り」として外すので、**節を書く順を変えても層（UDE が根本原因より結果側）が変わらない**。戻りの矢印は太く描く。付けないと、DFS が節の並びの先頭からたどって見つけた辺を戻りにするため、順方向の辺が戻り扱いになり、UDE が根本原因の側へ落ちることがある。付ける辺は、`b` から他の辺をたどって `a` に戻れる辺（循環を閉じる辺）で、1 つの循環に 1 本まで（違うと理由と直し方つきで止まる）。`relationDiagram` / `pdpc` のリンクにも書ける。`back` を書かない図の配置は変わらない。
- `role` は箱の色・形を決める（`tone` を書けば上書き）。`ude`=赤の破線、`root`/`goal`=アクセント色の二重枠、`de`/`io`=薄いアクセント、`injection`/`action`=アクセントの枠、`obstacle`=六角形、`precondition`=灰色の破線（統制できない現状の事実。FRT で `from: ['施策の結果', 'precondition の節']` と AND にする）、`tipping`=危険色の二重枠、`trim`=変更色の破線の枠、`need`=塗りつぶし（`io` の薄い箱と見分けるため）。ふつうの実体は `role` なし。
  統制できるかは役割で分かれる: 統制できる行動は `injection`（FRT の施策）・`action`（移行ツリーの行動）、CRT の根本原因は `root`（二重枠）、統制できない現状の事実は `precondition`。
- リンクに `kind: 'blocks'` を書くと、その実体がその実体を**断つ**（トリミング）辺になる。破線で、矢じりの代わりに横棒（T 字の端）で止まるので、因果の矢印と形で区別できる。ネガティブブランチは、悪い結果を `role: 'ude'` で書き、施策から `blocks` の辺を引く。`from` は 1 つの実体（配列にした AND は書けない）。層の決め方は通常の辺と同じ（断つ側が下、断たれる側が上）。`coreDriver` の到達数には数えない（防ぐ辺は引き起こさない）。辺そのものを断つ（辺への辺）書き方は無い。例は `examples/toc-blocks.ts`。
- **ネガティブブランチ（NBR。`tree: 'nbr'`）**: 施策が招く悪い結果の道と、それを断つ手を 1 枚に描く。道の途中の「複数の条件が揃って越える節」は `role: 'tipping'`（AND の結果で書く）、断つ施策は `role: 'trim'` で、`{from: 'cut', to: 'tip', kind: 'blocks'}` と転換点（またはその手前）へ引く。`trim` の実体には `foldsInto: '施策 1'` を書ける（文字列。`trim` 以外に書くと throw）。辺ではなく、箱の下に「→ 施策 1 に組み込む」の 1 行が付く（組み込み先の節は図に無くてよい。`sub` に足すので文字の幅も測られる）。`coreDriver` は `trim` を数えない。`tree: 'nbr'` は `layer` の既定が `'alap'`。検査は 4 つ（下の「`check` の規則」の TOC の項）。例は `examples/toc-nbr.ts`（`legend: 'auto'`・`tocCheck: 'strict'` で警告なし）。
- **移行ツリーの単位（`transitionUnits(units)`）**: 単位 `{id, current?, need, action, result, resultRole?}` の並びから、3 入力の AND（現状 + ニーズ + 行動 → 結果）の `{nodes, links}` を作り、`causeTree(nodes, links, {tree: 'tt'})` に渡す。`id` は結果の節の id で、ニーズ・行動は `<id>.need`・`<id>.action`、最初の単位の現状は `<id>.current`（`precondition`）になる。2 つ目以降の単位は前の結果から始まるので `current` を書かない（書くと throw。最初の単位は `current` が必須）。結果の役割は既定は `io` で、`resultRole: 'goal'` のように上書きできる。文字が空・`id` の重複も throw。例は `examples/toc-tt.ts`。
- **FRT の望む結果と CRT の UDE の対応（`mirrors`）**: `causeTree(nodes, links, {tree: 'frt', mirrors: crt})` の `crt` は、`tree: 'crt'` の `causeTree` が返した帯。FRT の `role: 'de'` / `'goal'` の節に `mirrors: 'u3'`（CRT の UDE の id）を書くと、`check` が対応を見る（`toc-mirror`）。FRT が持つのは CRT の節の id と UDE の id だけで、ラベルは読まない（`consistency` の用語の揺れにも入らない）。`mirrors` に `tree: 'crt'` でない帯を渡す、`de` / `goal` 以外の節に `mirrors` を書く、と throw。
- **入力側の層（`layer: 'asap' | 'alap'`）**: 原因が入らない実体（と、そこから入る辺だけでできた連鎖。PRT の障害 → 行動 → 中間目標）を、**行き先の 1 つ手前の層**に置くか（`'alap'`）、最初の層に置くか（`'asap'`）。**既定は `tree` が `'prt'` / `'frt'` / `'tt'` / `'nbr'` のとき `'alap'`**、それ以外（`'crt'`、`tree` を書かない図、`pdpc` / `relationDiagram`）は `'asap'`（従来の図のまま）。`'alap'` では長い矢印が消え、入力側が行き先の手前に並ぶ。`root` / `injection` / `start` の役割の実体は最初の層に残る。`tree: 'prt' | 'frt' | 'tt'` を書いた図は配置も変わるので、戻すなら `layer: 'asap'`。例は `examples/toc-prt.ts` / `toc-frt.ts` / `toc-tt.ts`。
- `causeTree(nodes, links, {coreDriver: true})` は、起点の実体（原因が入らない実体）ごとに、矢印をたどって届く `ude` の数を数え（AND の各原因も届く。自分は数えない）、最も多く、かつ 2 以上の起点（同数なら全部）に**中核ドライバーの印**を付ける: 太い枠と「中核」のバッジ。`role` は変えない（根本原因は `root` の二重枠のまま）。起点の全部に ``{n}/{total} 件に届く`` が下の行に書かれる（`counts: false` で消す）。「中核」のバッジは箱の**外**に置かれ（端の文字に重ならない）、`coreDriver` を使う図だけ、矢印の向きの軸の両端（`dir` が `up` / `down` なら上下、`left` / `right` なら左右）にバッジの分の余白が付く。`relationDiagram` の「出る矢印の本数」と違い、間接に届く UDE の数。例は `examples/toc-core.ts`。　文言は `coreDriverLabel: '中核（{n}/{total} 件）'` のように差し替えられる（`{n}` は届く数、`{total}` は `ude` の総数）。
- **役割を文字で書く（`roleTags`）**: `causeTree(…, {roleTags: true})` は、見た目が同じ役割（`root` / `goal` / `start` はアクセント色の二重枠、`injection` もアクセント系）に、節のラベルの下へ `【根本原因】` `【ゴール】` `【施策】` `【開始】` と文字を足す（作者の `sub`・`foldsInto`・`coreDriver` の件数より前）。現状ツリーの根本原因と、未来現実ツリーのゴール・施策が、**別々の図で同じ青い二重枠**に見えて取り違えられるのを、色や凡例に頼らず防ぐ（白黒印刷でも読める）。文言は `roleTags: {root: '真因'}` のように一部を差し替えられる。`legend: 'auto'` は、文字で書いた役割の見本を出さない（二重枠の見本が文言違いで並ぶだけになるため）。既定は off で、書かなければ何も変わらない。例は `examples/toc-prt.ts` / `toc-tt.ts`。
- **FRT の最終のゴール**は、`role: 'de'` でも `role: 'goal'` でもよい（`toc-no-desired-result`（以前は `toc-parts`）は `goal` を `de` と同じに数える。どちらも無いときのエラーは「望む結果（role: 'de'。最終のゴールを 'goal' で書いてもよい）」）。
- PRT の障害は、書き方の流派が分かれる。ここでは `role: 'obstacle'` の六角形から中間目標へ矢印を引く。この矢印だけは、ほかの矢印（尾が頭の十分原因・必要条件）と違い、「この障害を、その中間目標が越える」と読む。障害を矢印の脇に付ける描き方と、矢じりの無い線は、まだ無い。
- `diagram({legend: 'auto'})` は、`causeTree` / `relationDiagram` / `pdpc` で使った**役割**（`ude` 好ましくない現象、`root` 根本原因、`de` 望む結果、`injection` 施策、`precondition` 現状の事実、`goal` 目標、`io` 中間目標、`obstacle` 障害、`action` 行動、`tipping` 転換点、`trim` トリミング(施策)、`need` ニーズ、`start` 開始、`risk` 懸念、`measure` 対策。`effect` と `step` は除く）の見本の箱、AND の弧（`edge:and`）、戻りの矢印（`edge:back`。太い矢印）、断つ辺（`edge:blocks`。破線と横棒）、中核の印（`mark:core`。バッジの無い太枠）を凡例に足す。使っていない役割は出ない。文言は `legendLabels: {'role:precondition': '与件'}` のように差し替える。手書きの `legend([{role: 'ude', label: '…'}, {edge: 'and', label: '…'}, {mark: 'core', label: '…'}])` も書け、自動と二重にならない。`legend-missing` / `legend-incomplete` は従来どおり `role` を数えない。`tone` を直接書いた実体の色は凡例に入らない。例は `examples/toc-legend.ts`。
- 幅に収まらないとき（`dir` は `'up'` が既定）: `dir` を省略するか `dir: 'auto'` にすると、`causeTree` は向きを変えずに、まず `maxNodeW` を 200 → 160 → 130 → 110 と狭め、それでも収まらなければ幅を超える層を**行に折り返す**（`fold`。1 行は図の幅の 100 / 85 / 70 / 55% の順に試す）。折ると層をまたぐ矢印が行を通るので、折れが増える。`pdpc()` / `relationDiagram()`（既定は `down`）は、省略・`'auto'` のとき `right` に回ることもある（`fold` はしない）。`dir` や `maxNodeW` を**書いた図は変えない**: `dir` を書いた図の折り返しは `fold: true` を書いたときだけ（`fold: false` で折らない）。収まらなければ、試した案（幅と高さ）・試さなかった案とその理由・直し方 1 つを書いて止まる（高さだけが予算を超えるときは、幅を広げる案ではなく、図を分ける・`canvas` の高さを増やす案を書く。末尾に `split:` の提案が付く: 下の `split:` の箇条）。変えたことは `check` の `auto-fit-applied`（`dir` を省略したときは warn、`dir: 'auto'` は info）が知らせる。
- **`maxNodeW: 'auto'`**: 箱の幅を、260 から 100 まで 10px 刻み（広い方から）で試し、**幅と高さの予算の両方に収まる最初の値**を選ぶ（最も広い箱。行数が減る）。`dir` を書いた図にも効く（幅の軸だけを自動にする宣言。向きは変えない）。全部だめなら `fold` が最後の手段（`'auto'` では `dir` を書いていても折り返す）。余裕のある図でも 200 より広い箱（最大 260px）になる。高さの予算は、`canvas.height` があれば、バンドの上端 y を引いた値（近似）。`maxDisplayHeight` だけのときは従来どおり（好み扱いで throw しない換算は、まだない）。変えたことは `auto-fit-applied`（info）に、`maxNodeW` / `fold` が `'auto'` による、と書かれる。数値の `maxNodeW` と省略の図は変わらない。
- **収まらないときの `split:`**: `causeTree` が幅にも高さにも収まらず止まるとき、エラーに `split:` の 1 行が付く（図は自動では分けない）。高さの失敗では、幅に収まった最初の案の層のうち、両側が高さの予算に収まる境界で、またぐ矢印が最少（同数なら両側の節数の差が最小）のものを、またぐ矢印の名前つきで書く（戻りの辺は数えない。収まる切り方がなければ「3 つ以上に分ける」）。幅の失敗では、最も狭い案で最も広い層とその節を挙げ、節を 2 つの図に分けるよう書く（層の間で切っても幅は減らない）。`states` / `classes` / `tree` の失敗の文面は変わらない。
- **`cause-crossing` の再探索**: AND のある結果へ入る矢印どうしが交差するとき、`causeTree` は節を書いた順を決定的に変え（逆順、1〜6 個ずらし。最大 7 回の再レイアウト）、**層・高さ・AND の弧が描けること・自動で収めた内容が増えず、点数（AND の矢印の交差、交差、折れ）が厳密に良くなるときだけ**採る。交差が無い図、`pdpc` / `relationDiagram` は 1 回のレイアウトのまま（出力は変わらない）。並走（`cause-parallel`）は経路の問題なので、この再探索では直らない。
- 層を 2 つ以上飛ぶ戻りの矢印は、`returns: 'outer'` で図の外側（右または下）の専用レーン（14px 間隔、長いものほど外。折れは 4 まで）に回せる。`causeTree` / `relationDiagram` の既定は、`back: true` の辺だけ外周、付けない循環は図の中。`pdpc` の既定は全部外周（幅がはみ出すときは自動で図の中に戻す。`returns: 'outer'` と書いて収まらないと、`returns: 'inline'` を案に止まる）。`'inline'` は全部図の中。 外周のレーンは、戻りの両端が近い側（図の上下・左右のどちらか）に付き、図が大きくならず、（交差, 折れ）が厳密に良くなるときだけその側になる（`straighten: false` は従来どおり遠い側だけ）。例は `examples/toc-crt-loop.ts`（CRT の悪循環）。座標は `straighten: false` で従来のままにできる（下の「自動配置の図の共通の注意」）。
- 同じ実体に着く矢印が多いと、その辺が足りなくなる前に実体の方が大きくなる（矢じりが重ならないように）。AND の弧は自分の矢印だけにまたがり、別の AND や OR の矢印には触れない（触れるときは `check` が止める）。
- 循環（フィードバックループ）も書ける（戻る矢印として描く）。AND の矢印が実体の同じ側に着かないときは、弧を描けないので `check` / `build` がそう書いて止まる。幅を超えるときの自動の収め方は、上の「幅に収まらないとき」の箇条を参照（書いた `dir` で収まらなければ、`dir: 'auto'`、`fold: true`、`maxNodeW` を小さくする、のどれかを案に止まる）。
- `cloud` の箱は文字列か `{text, id?, tone?}`。箱の文頭に `A：` `B：` `C：` `D：` `D'：` が付く。`assumptions` は書いた順に 1, 2, … と番号が付き、その番号が `on` の矢印（`ab` `ac` `bd` `cd`、`dd` は対立そのもの）の上に載り、一覧は図の下に出る。`injection` は前提を崩す変更で、一覧の下にアクセント色で出る。`conflictLabel` で対立の矢印に一言添えられる。
- 矢じりは図形で描く。実体・箱の `id` は `connect()` の端点。例は `examples/toc-crt.ts`、`examples/toc-cloud.ts`。

### QC 七つ道具と新 QC 七つ道具

どの道具も、データか関係を渡すと、軸・区間・限界・配置を計算して描く。座標は書かない。

| 道具 | 書き方 | 例 |
|---|---|---|
| チェックシート | `checkSheet` | `examples/qc-check-sheet.ts` |
| パレート図 | `pareto` | `examples/qc-pareto.ts` |
| 管理図 | `controlChart` / `xbarR` | `examples/qc-control.ts` |
| ヒストグラム | `histogram` | `examples/qc-histogram.ts` |
| 特性要因図 | `mindmap(root, {layout: 'fishbone'})`（大骨・中骨・小骨の 3 階層以上） | `examples/qc-fishbone.ts` |
| 散布図 | `scatter` | `examples/qc-scatter.ts` |
| 層別 | 図を層ごとに分けて描く。`scatter` は `group` で層ごとに色と形を変える。`bars` は `stack: true` で積む | |
| 親和図法 | `affinity` | `examples/qc-affinity.ts` |
| 連関図法 | `relationDiagram` | `examples/qc-relation.ts` |
| 系統図法 | `tree(root, {dir: 'right'})`（目的が左、手段が右） | `examples/qc-systematic.ts` |
| マトリックス図法 | `matrix`（L 型）。多元の表は `table` | `examples/qc-matrix.ts` |
| アロー・ダイヤグラム法 | `arrowDiagram` | `examples/qc-arrow.ts`（縦向きは `qc-arrow-long.ts`） |
| PDPC 法 | `pdpc` | `examples/qc-pdpc.ts` |
| マトリックス・データ解析法 | 対象外（主成分分析の計算は持たない）。結果の散布図は `scatter` で描く | |

```ts
pareto([{label: '傷', value: 42}, {label: '汚れ', value: 25}, {label: '欠け', value: 12}, {label: 'その他', value: 6}], {unit: '件'})
histogram(lengths, {lsl: 9.8, usl: 10.4, normal: true, unit: '個'})
scatter(points, {x: '温度 (℃)', y: '不良率 (%)', regression: true})
controlChart('xbar', subgroups)            // 群ごとの測定値 number[][]。R 管理図は 'r'、まとめて 2 枚なら ...xbarR(subgroups)
controlChart('p', [{n: 200, d: 6}, ...])   // 不良率。n が変わると限界が段を作る
checkSheet([{label: '傷', counts: [3, 5, 2]}, ...], ['月', '火', '水'], {corner: '不良の種類'})
matrix(['A 案', 'B 案'], ['コスト', '速さ'], [['○', '◎'], ['◎', '△']], {weights: [5, 3]})
```

- **`pareto`**: `max` は合計に固定される（100% が図の上端）。「その他」は大きさに関わらず最後（`other` で名前を変える）。`top: 5` は 5 位までを残して残りを「その他」にまとめる。`guide`（既定 80）の破線、`highlight: false` で色分けなし。累積の折れ線は原点から各棒の右上の角を通る（教科書の形）。
- **`bars` の追加の指定**（縦棒・積み上げなし）: `lines: [{at, label?, tone?}]` は値の位置の横線、`vlines` は棒の並びの上の位置（0 が最初の棒の左端、1 が最初と 2 番目の境目）の縦線、`curve: {through: [[位置, 値], …]}` は棒の上に重ねる曲線、`cumulative: {guide?}` は累積の線と右の 0〜100% の軸、`edges: [...]` は棒の境目の下に書く文字（棒の数 + 1 個）。ラベルが重なったら `check` が止める（縦線の文字は、近いものや値の文字にかかるものを段にずらす。縦線にかかる値の文字は棒の中で横へよける。線が文字を貫くときも止まる。曲線だけは文字の上を通ってよい）。
- **`histogram`**: 区間は最大 60（限界がデータから遠いと止まる）。区間の幅はデータだけから決め、限界は範囲を広げるだけ。区間の境目の文字は、混むと k 個おきに書き、度数 0 の棒には値を書かない。区間の幅はデータだけから、1・2・5 × 10 のべき乗のうち `bins`（既定は Sturges の式）に近いものを選ぶ。`width` で指定もできる。境目の値は上の区間に入り、最大値は最後の区間に入る。`lsl` / `usl` の外の区間は赤。平均線は既定で付く（`mean: false` で消す）。`normal: true` で、データの平均と標準偏差の正規分布の曲線を重ねる。
- **`controlChart`** の限界は 3σ（`x` は 2.66 × 移動範囲の平均、`xbar` / `r` は A2・D3・D4 の係数で群の大きさ 2〜10、`p` / `np` / `c` / `u` は二項・ポアソン分布）。`limits: {cl, ucl, lcl}` で、安定した期間から決めた限界を固定できる（外れた点を除いて計算し直すのは、書く側の仕事）。`rules: false` で外れの印を消す。連・傾向は 7 点（JIS Z 9021 の流儀。新しい JIS Z 9020-2 / ISO 7870-2 は連 9 点・傾向 6 点）。限界の一部だけ（`{cl}` だけ）を渡すと、`x` / `xbar` / `r` / `mr` は残りの限界が中心線と同じだけずれ、`p` / `np` / `c` / `u` は与えた中心線（標準の値）から限界を計算し直す。n が変わる p / u 管理図の限界は段になり、ラベルは「UCL（n による）」（最後の標本の下限が 0 のときは下限のラベルを省く）。`lcl < cl < ucl` でないと止まる。`at: ['10/1', …]` は軸の下に書く文字。印は色だけでなく形も違う（外れ ✕、連・傾向 ○）。
- **`xbarR`** の 2 枚は、左の余白がそろう（サンプルが縦に並ぶ）。`limits` と `yLabel` は `{xbar, r}` で別々に、値だけ書くと X̄ 管理図に付く。
- **図の幅**: 区間ラベルの間引きや凡例の並べ方は、図の幅 800px 前後（既定）を前提にする。`diagram({width})` を 640px より狭くすると、ラベルが重なって検査で止まることがある。
- **`scatter`** の層は 4 つまで。回帰直線は最小二乗法で、全体に 1 本。軸の範囲は `x: {label, min, max, step}` で指定できる。
- **`checkSheet`** の「正」の字は、一 丅 下 止 が 1〜4、正が 5（6 以上は 5 ずつ続ける）。`as: 'number'` は数字、`'both'` は両方。`tally(n)` だけ取り出して使うこともできる。
- **`matrix`** の記号は `◎ ○ △ ×`（`best / ok / mid / ng` でも書ける）。`weights`（列の重み）を書くと評価点 = Σ 重み × 点（◎ 9 / ○ 3 / △ 1 / × 0。`values` で変える）が行ごとに付き、最高点に印が付く。`weights` なしでも `total: true` で行ごとの合計。T 型・Y 型・X 型（3 つ以上の要素群の対応）は対象外。
- **`affinity`** は、`groups` の中に `groups` を入れると小さなまとまりから大きなまとまりへ重なる。グループの幅は、中のグループの数だけの列になる。カードは 1 グループ内に縦に並ぶ（`cardCols` で横にも）。
- **`relationDiagram`** は `causeTree` なので、`role`・`dir`・`maxNodeW` や、戻る矢印の描き方も同じ。主原因の印は、出る矢印が 2 本以上で最多の要因にだけ付く（同数なら全部）。`problem`（取り上げる結果）は赤の破線。
- **`pdpc`** も `causeTree` で、既定は上から下（`dir: 'right'` は、道筋が短いときだけ。幅を超えると止まる）。懸念（`risk`）・対策（`measure`）に出入りする矢印は、書かなくても点線になる（`line` で上書き）。
- **`arrowDiagram`**: 作業は `{from, to, name, days}`（結合点は番号か文字）、`dummy: true` は時間のない順序だけの矢印（点線）。始まりの結合点と終わりの結合点は、それぞれ 1 つ（行き止まりはダミーで終点につなぐ）。丸の中は「番号 / 最早/最遅」、余裕のある作業の札には「（余裕 n）」が付き、図の下に全体の長さとクリティカルパスが出る（`summary: false` で消す）。`times: false` で時刻と余裕を消す。横に並べて幅（940px）を超えるときは `dir: 'down'`。矢印の色・太さ（`tone` / `strong`）と丸い節（`shape: 'circle'`）は `stateDiagram` でも使える。
- 計算だけ取り出したいときは、`lib/qc.ts`（`paretoOrder` / `histogramBins` / `capability`（全体の標準偏差から出す Cp・Cpk。群内のばらつきで出す工程能力ではなく、Pp・Ppk に当たる）/ `criticalPath`）と `lib/qc-plane.ts`（`controlStats` / `controlSignals` / `correlation`）が純粋な関数。

### flowShapes（流れ・集合・階層）

よく使うビジネス図を band 1 つで描く。項目の `id` は `connect()` と spotlight のアンカーになり、図の `reveal` / `until` と一緒に現れる。

```ts
chevron([{id: 'plan', label: '計画', sub: '要件を確認'}, {id: 'build', label: '実装'}], {current: 1})
funnel([{label: '訪問', value: 1200}, {label: '成約', value: 52}], {scale: 'value', showRate: true})
cycle([{label: 'Plan'}, {label: 'Do'}, {label: 'Check'}, {label: 'Act'}], {centre: '継続改善'})
venn([{name: '技術'}, {name: '顧客'}], {overlaps: [{sets: ['技術', '顧客'], label: '価値'}]})
concentric([{label: '境界'}, {label: 'アプリ'}, {label: 'データ'}], {centre: '重要情報'})
emblem('重要', {kind: 'triangle', tone: 'danger', sub: '期限厳守', id: 'warn'})
```

- `chevron`: 横（既定）または縦の矢羽根。`first: 'pentagon' | 'chevron'`（先頭の形）、`gap`、`current`（`highlight` も可。色に加えて太い枠で示す）。`sub` は見出しの下に小さく出る。長い文字は矢羽根の内側で折り返し、必要な高さまで伸びる。縦の幅は 360px まで（`width` を書けばその幅）。
- `funnel`: 下ほど狭い漏斗。各段は上の段の下端と同じ幅で始まる。`scale: 'value'` は全段の `value` が必要で、幅が値に比例する（下の段で値が増えると警告 `funnel-values-rise`）。`showRate` は前段からの率を段の左に出す（左に余地がなければ段の文字の下）。段に入らない文字は段の右へ出す。
- `cycle`: 3〜8 個の節を、円周に沿った矢印で閉じる（矢印は節の間だけを通り、節や文字に重ならない）。`direction: 'cw' | 'ccw'`、`centre`、各節の `sub`。
- `venn`: 2 または 3 集合。色に加えて線種（実線・破線・点線）を変え、色だけに頼らない。集合の名前はその集合だけの部分に、`overlaps` の 2 集合のラベルはその 2 つだけが重なる部分に、`centre` は全集合が重なる部分に入る（`centre` と全集合の overlap を両方書くと throw）。`universe` で全体の枠（文字列ならその名前）。
- `concentric`: 同心円。`order: 'outer-first' | 'inner-first'`（`rings` を書く順）、`centre`。`labels: 'inside'`（既定）は各層の帯の上部に、`'side'` は右の凡例に出して引き出し線で層につなぐ（円とキーは 1 つの塊として帯の幅の中央に置く）。`description` は「ラベル — 説明」で続く。
- `emblem`: 円・三角・四角・ひし形・六角形（`kind: 'circle' | 'triangle' | 'square' | 'diamond' | 'hexagon'`）の中に、1 語〜数語の文字を入れる。他の作図ツールの「図形（Shape）」「ノード」にあたる、文字入りで単独で置く部品。`emblem('重要', {kind, sub, tone, id})` は 1 個（`id` は図形の id）、`emblem([{label, sub, kind, tone, id}, …], {kind})` は複数（`kind` は項目に書かなかったときの既定、既定は `circle`。`id` は帯の id、項目の id は各項目に書く）。形は文字が入る大きさまで 8px ずつ広がり、同じ帯の中は同じ大きさ（`size` は最小の幅、既定 96、64〜320。8px の刻みに切り上げる）。幅が足りなければ次の行へ折り返す（`gap` は 4px の格子に丸める）。文字は、形ごとに決めた「文字が入る長方形」（三角形は下寄り、ひし形は狭い）に折り返して入れるので、輪郭に触れない（実フォントで 325 通りを測って、輪郭との余白は最小 2.3px）。カタカナ・英数字の語は、240px まで広げて割らずに入れる（それでも入らない語は、320px まで広げて割る）。320px（帯が狭ければ帯の幅）でも入らない文字、帯より広い `size` は throw する（短くする、`sub` に移す、`kind: 'square'`、帯を広げる）。`connect()` の anchor は、円・四角・ひし形が外接矩形、六角形は左右の頂点、三角形は頂点・底辺の中点・斜辺の中点（`:top` / `:bottom` / `:left` / `:right` が輪郭に乗る）。辺を書かない `connect('a', 'b')` は文字の上を通るので、`connect('a:bottom', 'b:top')` のように辺を書く。同じ帯の下の行を越える線は、経路が止まることがある（`size` を下げて 1 行に収める、`width` を広げる）。種類（`kind`）が混ざる行は、各図形の外接矩形を行の中で縦に中央寄せにするので、三角形の文字だけ少し下にある。`tone` は箱と同じ色で、**線種が変わるのは `danger` / `removed`（破線）だけ**。`accent` と `new` のように色だけが違う組は、意味の違いを `sub` にも書く。`spotlight` は帯単位（`chevron` などと同じ。1 個だけ強調したいときは `emblem` を別の帯に分ける）。他のツールの「判断のひし形」を流れ図で使うなら `flowchart()`（矢印の出口・Yes/No の札・質問文に合わせた大きさ）、判断でない文字入りの図形を 1 個ずつ置くなら `emblem()`。ワイヤーフレームの番号の印 `badge` とは別で、`badge` は短い印、`emblem` は文字を折り返して入れる大きめの図形。星形やパス指定の図形はまだない。
- ラベルが図からはみ出す・ラベル同士が重なると検査で止まる。
- 例: `examples/chevron-*.ts`、`funnel-*.ts`、`cycle-*.ts`、`venn-*.ts`、`concentric-*.ts`、`emblem-*.ts`。

### ワードアート・縦書き（`wordart`）

見出し・表紙・縦長の飾りに使う飾り文字。水平でも縦書きでも同じ飾りが使える。色は token の鍵（`text | accent | muted | danger | bg | soft`）だけで、生の色は持たない。ぼかしフィルタも使わない（光彩は半透明の縁を重ねて作るので、描画器による差が出ない）。

```ts
wordart('新製品発表会', {style: 'sticker', size: 64})
wordart('SALE 50% OFF', {style: 'outline', size: 56})
wordart('虹形の見出し', {style: 'gradient', arc: 120})
wordart('縦書きの見出し、「括弧」も整う。', {writing: 'vertical', size: 32, limit: 300})
```

| 機能 | 書き方 |
|---|---|
| スタイル | `style`: `plain`（細字）｜`bold`（既定）｜`outline`（白抜き + 濃い縁）｜`shadow`｜`sticker`（白い縁 + 濃い縁 + 影）｜`glow`｜`emboss`｜`3d`｜`gradient`｜`reflect`。以下のオプションで個別に上書きする |
| フォント | `font: 'sans' | 'mono'`、`weight: 'normal' | 'bold'`、`spacing`（字間 px） |
| 塗りつぶし | `tone`（token）。`tone: 'none'` は中抜き（縁取りが要る）。`gradient: {from, to, angle?}` は 2 色のグラデーション（`angle` は度、既定 90 = 上から下） |
| 輪郭（縁取り） | `outline`: `true`、`{tone, width}`、または配列（内側から外側へ二重・三重）。`width` は px（省略は文字サイズの 6%） |
| 影 | `shadow`: `true` か `{tone, dx, dy}`（ぼかしなしのずらし影） |
| 光彩 | `glow`: `true` か `{tone, radius}` |
| 面取り | `bevel: true`（左上に明るい縁、右下に暗い縁） |
| 立体 | `extrude`: `true` か `{tone, depth}`（斜め右下へ奥行きを引く） |
| 反射 | `reflection`: `true` か `{opacity, gap}`（文字の下に薄い鏡像。横書きだけ） |
| 変形 | `arc: 度`（正は上に反る虹形、負は下に垂れる笑顔形。1 行の横書きだけ。内側で文字が重なるほどきつい曲げは throw） |
| 回転・反転 | `rotate: 度`（時計回り。帯は回した形の外接箱になる）、`flip: 'horizontal' | 'vertical' | 'both'`（回転より先に適用） |
| サイズ・配置 | `size`（役割名、既定 `display`、または px で 14 以上）、`align`（`start｜center｜end`）、`limit`（横書き: 幅の上限で折り返す / 縦書き: 列の高さ） |
| 板 | `plate`: 文字の下に敷く板の色（白い文字を濃い板に載せる） |

- 縦書き（`writing: 'vertical'`）: 列は右から左、`\n` で列を替える。`limit`（px）を書くと、列がそれを超える手前で次の列へ移る（行頭禁則: `、。）」ー` や小さい仮名は前の列に残す。開き括弧は列末に残さない）。句読点は右上へ寄り、`ー`・`…`・`～`・括弧は縦組みの字形（90° 回転）、1〜2 桁の数字は縦中横、それ以外の英数字（`SVG`・`2026`）は右へ倒して 1 まとまりで置く。1 文字ずつ位置を決めるので、描画器による差が出ない。
- 検査: 文字（グラデーションは途中の色も）が、描かれる色（`appearance: 'dark'` も）で背景（板があれば板）と 3:1 に満たず、縁取りでも読めない指定（縁が細すぎる〔文字の 3% か 1px 未満〕ものも含め、白い文字を縁取りなしで白い紙に置く、中抜きに縁取りがない、など）は `verifyDiagram` が止める。影・光彩・立体・面取り・鏡像・外側の縁取りは `aria-hidden` + `data-decor` の複製で、読み上げ・コピーでは本文が 1 回だけ出る（lint は `data-decor` だけを装飾として扱う）。暗くする（spotlight）と、1 層の muted になる。HTML 出力でも SVG のまま出る。
- 遠近のある 3-D 回転は持たない（`extrude` の斜めの奥行きで立体感を出す）。今は band として縦に積むだけで、行の中で箱と並べる・箱の中を縦書きにする、は未対応。設計は `docs/adr/0009-vertical-text-and-wordart.md`。
- 例: `examples/wordart.ts`。

### 象限図・分類マトリクス（`quadrant`）

2 本の軸でマスに分ける図（BCG・GE・アンゾフ・人材 9 ボックス・リスクマトリクス・ポジショニングマップ ...）。マスの見出し・軸・項目の置き場所を宣言すると、配置・重ならない調整・凡例は自動。

```ts
quadrant.preset('bcg', {
  sizeTitle: '売上高', sizeUnit: '億円',
  items: [
    {id: 'cloud', label: 'クラウド', at: [0.85, 0.82], size: 120},   // 座標で置く（0〜1。1 が高い側）
    {label: 'パッケージ', at: [0.82, 0.25], size: 300},
    {label: 'AI 新規', cell: [1, 0], size: 40},                       // マスに入れる（[列, 行]。左上が [0, 0]）
  ],
  arrows: [{from: 'cloud', to: [0.5, 0.9], label: '来期'}],
})
quadrant({x: {title: '価格', low: '安い', high: '高い'}, y: {title: '携帯性', low: '重い', high: '軽い'}, crosshair: true, items: [...]})
```

| プリセット | 軸（x × y） | マスの見出し |
|---|---|---|
| `bcg` | 相対市場シェア（高→低）× 市場成長率 | 花形・問題児・金のなる木・負け犬 |
| `ge` | 事業の競争力（強→弱）× 業界の魅力度。3×3 | 投資・成長 / 選別的投資 / 収穫・撤退 |
| `ansoff` | 製品（既存・新規）× 市場（既存・新規） | 市場浸透・新製品開発・新市場開拓・多角化 |
| `nineBox` | 業績 × 潜在能力（右上がスター）。3×3 | スター・中核人材・専門人材・有望株・堅実人材・貢献人材・原石・要改善・要対応 |
| `impactEffort` | 実行容易性 × インパクト | クイックウィン・大型案件・ついでに・後回し |
| `risk` | 影響度 × 発生可能性。3×3 | 「リスク 低｜中｜高｜重大」（発生と影響の積。評価は文字で書く） |
| `stakeholder` | 関心度 × 影響力 | 重点管理・満足させる・情報提供・監視 |
| `positioning` | 自由（価格 × 機能の充実度が既定）。マスの名前なし、十字線 | |
| `eisenhower` | 緊急度（高→低）× 重要度 | 今すぐやる・計画してやる・任せる・やめる |

- **プリセットは上書きできる**: `x` / `y`（書いた項目だけ置き換わる）、`cells`（書いたマスだけ置き換わる）、`grid`。`grid` がプリセットと違うと、プリセットの見出しは使わない。`preset:` を `quadrant({preset})` の option として書いても同じ。
- **項目の置き方**: `cell: [列, 行]` はマスの中に重ならず並べる（置ききれなければ行が伸びる）。`at: [x, y]` は座標（0〜1、**値の空間**で 1 が高い側。軸を逆向きに描いても数字は変わらない）で、マスの見出しを避けて、そのマスの中に置く。ちょうど境目の値は、高い側のマスに入る。
- **重ならない**: 項目と項目、項目と他のラベル・マスの見出し・矢印は重ならない。項目の印とラベルは自分のマスの枠の中に収まる（枠をまたぐと別のマスに見える）。`cell` の項目が多いと、その行が伸びる。座標が近い項目は、同じマスの中で最も近い空きへ動く（動かせないほど混むと、行の高さ（`height` は最小値）を伸ばす。それでも置けなければ、どの項目か書いて throw）。座標から 16px 以上動いた項目は `quadrant-item-moved`（警告）で知らせる。
- **大きさ**: `size` を書くと円の**面積**が値に比例する。1 つに書いたら全部の項目に書く（書かない項目は小さな値に見えるので throw）。図の下に「円の面積 = {sizeTitle}」と基準の円（切りのよい値、`sizeUnit` 付き）が付く。最大の 1/50 ほどより小さい値は最小の円（半径 6px）で描き、`quadrant-size-floor`（警告）で知らせる（面積が値より大きく見える）。
- **色だけにしない**: マスの評価は常に見出し・説明の文字で書く（色・破線は補助）。項目の種類は `group` で分ける（円・四角・ひし形・三角と色の組み合わせ、5 つ目からは中抜きの形。凡例付き。8 グループまで）。1 つに書いたら全部の項目に書く（書かない項目は 1 つ目のグループと同じ印に見えるので throw）。`tone` だけで分けると `quadrant-tone-only`（警告）。凡例の順は `groups: [...]`。
- **斜めの領域（`regions`）**: マスでは切れない領域（フロー理論の「釣り合う帯」など）は `regions: [{title, note?, tone?, points: [[x, y], ...], at?}]` で重ねる。`points` は値の空間（0〜1、1 が高い側。軸を逆向きにしても数字は同じ）の 3 点以上の多角形、`at` は見出しの中心（既定は多角形の中心）。後ろに書いたものが上に描かれる。見出しは領域が持つので、`crosshair: true` で、マスに title / note がない型（`positioning`）と組む（違うと throw）。項目は領域の見出しを避けて置かれる。領域があるとマスは分類でないので、`quadrant-empty-cell` は出ない。例: `examples/quadrant-flow.ts`（`[[0, 0], [0.25, 0], [1, 0.75], [1, 1], [0.75, 1], [0, 0.25]]` が右上がりの帯）。多角形の重ね合わせ・切り取りといった汎用の図形操作は持たない。
- **空のマス**: 項目が 1 つもないマスは「空の枠」が残るので `quadrant-empty-cell`（警告。マスは「見出し [列, 行]」で示す。`allowEmpty` と同じ数え方）。項目を入れるか、意図した空きなら `allowEmpty: [[col, row]]`（上から数えた 0 始まり。全部なら `allowEmpty: true`）で示す。図ごとに理由を残すなら `accept: {'quadrant-empty-cell': '理由'}`（情報に下がる）。
- **矢印**（ポートフォリオの移動）: `arrows: [{from: 項目の id｜[x, y], to: 同左, label?, dashed?}]`。円の縁から縁へ引き、ラベルは線上の白い札。矢印が項目やラベルを横切ると検査で止まる。
- **id**: 項目の `id` は `connect()` と spotlight の対象（図全体の `id` も）。段階表示は図ごと（項目単位の reveal はない）。
- **幅**: x 軸の名前（低・タイトル・高）が 1 行で入らない、1 マスが 90px 未満（列が多すぎる）、1 つのラベルがマスより広いときは throw。
- 例: `examples/quadrant-bcg.ts` / `-ge` / `-ansoff` / `-nine-box` / `-impact-effort` / `-risk` / `-stakeholder` / `-positioning` / `-eisenhower`。

### 枠が決まったキャンバス（`canvas`）

ビジネスモデルキャンバスや SWOT のように、領域の位置と名前が決まっている図。テンプレート名と、領域ごとの内容（短い文の配列）を渡す。領域の位置・大きさ・見出し（日本語）は自動で、文が多い領域は伸びる（行は一番高い領域に揃う）。

```ts
canvas('swot', {
  strengths: ['地域の学校との取引', '目利きのいる選書'],
  weaknesses: ['在庫管理が人頼み'],
  opportunities: ['読書イベントの需要'],
  threats: ['大手ネット書店の値引き'],
}, {title: '現状分析', stamp: '架空の例', id: 'sw'})
```

| テンプレート | 領域の id | 配置 |
|---|---|---|
| `bmc` | `partners` `activities` `resources` `value` `relationships` `channels` `segments` `cost` `revenue` | Strategyzer の配置（5 列、下に 2 つ） |
| `lean` | `problem` `solution` `metrics` `uvp` `unfair` `channels` `segments` `cost` `revenue` | リーンキャンバス（`bmc` と同じ形） |
| `vpc` | `gainCreators` `products` `painRelievers`（価値側）／`gains` `jobs` `pains`（顧客側） | 左が価値提案、右が顧客。同じ高さが対応 |
| `swot` | `strengths` `weaknesses` `opportunities` `threats` | 2 × 2。タグに「内部／外部・プラス／マイナス」 |
| `tows` | `so` `wo` `st` `wt`（と、任意で `strengths` `weaknesses` `opportunities` `threats`） | 左と上が SWOT の見出し、中が 4 つの戦略 |
| `errc` | `eliminate` `raise` `reduce` `create` | 2 × 2（見出しに － ▲ ▼ ＋） |
| `pest` | `political` `economic` `social` `technological`（`legal` `environmental`） | `pestle: true`、または `legal` / `environmental` を書くと 6 領域 |
| `threeC` | `customer` `competitor` `company`（任意で `insight`） | 3 列、下に示唆 |
| `sevenS` | `strategy` `structure` `systems` `style` `staff` `skills` `values` | 中央に共通の価値観、まわりに 6 つ。ハード／ソフトはタグ |
| `fiveForces` | `newEntrants` `suppliers` `rivalry` `buyers` `substitutes` | 十字。中央が業界内の競争。見出しの ▼ ▶ ◀ ▲ が中央へ向かう力 |
| `empathy` | `thinks` `says` `does` `feels` `pains` `gains`（任意で `person`） | 中央に対象、上下左右に 4 つ、下にペインとゲイン |
| `persona` | `profile` `quote` `goals` `frustrations` `behaviors` `needs` | プロフィールと 5 つの欄 |
| `a3` | `background` `current` `goal` `cause` / `countermeasures` `plan` `followup` | 左に現状把握、右に対策と計画 |

- 内容は文字列（1 文）か文字列の配列（箇条書き。先頭の `・` や、後ろに空白のある `- ` `* ` は 1 つの `・` に揃う。`-5%` のように空白のない `-` は文の一部として残る）。テンプレートにない id は型エラーで、実行時にも有効な id の一覧つきで止まる。
- オプション: `fit`（`'content'` 既定 / `'aspect'`）、`title`（上の見出し）、`titles`（領域の見出しの差し替え）、`tone`（領域ごとのトーン）、`emphasis`（重点の領域。アクセント色に「重点」のタグが付き、色だけに頼らない）、`stamp`、`h`（領域部分の最小の高さ。`title` の見出しは含まない。内容が収まらないと、必要な高さを示して止まる。省略すると内容に合わせて伸びる）、`gap`（4px 単位に丸める。領域の縁は 4px の格子に乗り、隙間はどこも同じ幅。2 行目以降の領域にタグがあるときは、上下の隙間を 16px 以上とってタグが上の領域に重ならないようにする）、`requireAll`、`reveal`（領域ごとの段階）、`id`。
- 幅は `diagram({width})` で決まる。領域の幅が 96px 未満になる幅・`gap` は、狭すぎる領域の名前を示して止まる。空白で区切れない長い語（URL など）が領域より広いときも、その語と領域を示して止まる（箱からはみ出させない）。
- 高さは内容で決まる（既定 `fit: 'content'`）。各行は、その行の領域が必要とする高さまでで、記入する領域（内容のある領域と、任意でない空の領域）は 96px を下回らない。見出しだけのセル（`vpc` の上の帯など）と、空の任意の領域には下限がない。書き込み用紙のように広い枠が要るときは `canvas(..., {fit: 'aspect'})`（テンプレートの縦横比を床にする従来の見た目）か `h`。`diagram({canvas: 'slide'})` で `fit: 'aspect'` のときは、縦横比よりスライドの高さ（720px）を優先する（内容が多いときだけ伸び、`slide-canvas-overflow` になる）。
- `id: 'bmc'` を付けると、各領域が `bmc-value` のようなアンカーになる（`connect('bmc-value:right', ...)`、`diagram({spotlight})`、`reveal` がそのまま効く。型でも `bmc-` の後ろは領域の id だけ通る）。
- `requireAll: true` のとき、内容のない領域は `canvas-region-empty`（警告）。任意の領域（`person` / `insight` ほか）は数えない。
- 各領域は `box` なので、はみ出し・コントラスト・密度などの検査は他の部品と同じ。`tone` を自分で選んだ領域は、`legend` が必要（タグで言葉にした既定のトーンは要らない）。
- 例: `examples/canvas-bmc.ts` / `canvas-swot.ts` / `canvas-vpc.ts` / `canvas-seven-s.ts` / `canvas-five-forces.ts` / `canvas-empathy.ts`。
- 対象外: 領域どうしをつなぐ矢印（5 フォースの矢印、VPC の対応線）は描かない（見出しの記号と並びで示す。必要なら `connect` で足す）。7S の六角形・円形の枠は四角で描く。

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
- `today` は必ず書く（ビルドは時計を読まない）。軸の外だと止まる（文面に軸の範囲と直し方が出る）。`todayLabel` で「今日」を変えられる。
- **今日が軸の外のとき**: `gantt(rows, {today, extendToToday: true})` は、`from` / `to` を書いていない側だけ軸を今日まで広げる（計画の開始日を今日に合わせなくてよい）。`from` / `to` を明示した側は広げず、止まる。書かない図の出力は変わらない。
- **日付をビルドに渡す**: `today: 'auto'` と書くと、ビルドが日付を受け取る。優先順は `--today <YYYY-MM-DD>`（`build` と `check`）、環境変数 `SVG_DIAGRAM_TODAY`、`.svg-diagram.json` の `"today"`。どれも無いと、直し方つきで止まる。実在しない日付はどれも拒否する。時計は読まない（`--today now` は無い）ので、`SVG_DIAGRAM_TODAY=$(date +%F) svg-diagram build gantt.ts` のように呼び出し側が渡す。解決した日付は `<metadata>` の `today` に残り（`today: 'auto'` の図だけ。日付を直接書いた図は変わらない）、`check --drift --rebuild` はそれで作り直す（環境変数の日付が違っても誤報しない）。**限界**: `changed` / `--stale` の判定は日付を見ないので、`today: 'auto'` の図は日付が違っても fresh と出る。日付を進めたら `build` を `--stale` なしで回す。
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

### 業務フロー（`bpmn`）

```ts
bpmn(
  [{id: 'cust', label: '顧客'}, {id: 'shop', label: '店舗'}],
  [{id: 's', lane: 'cust', kind: 'start', label: '注文'}, {id: 'chk', lane: 'shop', label: '在庫を確認'},
   {id: 'g', lane: 'shop', kind: 'xor', label: '在庫'}, {id: 'e', lane: 'cust', kind: 'end', label: '受け取り'}],
  [{from: 's', to: 'chk'}, {from: 'chk', to: 'g'}, {from: 'g', to: 'e', label: 'あり', line: 'dashed'}],
)
```

- ノードの `kind`: `task`（既定。角丸の箱。`label` 必須、`sub` で 2 行目）/ `start`（細い円）/ `end`（太い円）/ `xor`（×）/ `and`（＋）/ `or`（○）の菱形。イベントの `label` は図形の下に、ゲートウェイの `label` は図形の左上に出る。
- レーンは上から並ぶ。列は、矢印の向きに沿った層（`start` が先頭）。同じレーンの同じ列に 2 つ以上あれば、縦に積む。レーンの高さは中身に合わせる。
- 矢印は直角に折れる。同じ行なら一直線、ゲートウェイからほかのレーンへは、上か下の頂点から出る。戻る矢印（差し戻し）は、ノードの下を回る。間のノードを貫くときは、レーンの縁に沿って迂回し、それでも無関係なノードを貫くと `check` / `build` が止まる。`line: 'dashed'` は、レーンをまたぐメッセージ。ゲートウェイから出る矢印の `label` は、条件。
- 標準の BPMN のすべては描かない（サブプロセス、タイマーやメッセージのイベント、プール間のメッセージ、データなどは対象外）。
- **幅に収まらないとき**: 図が帯の幅より広いと、何 px 足りないかを書いて throw する（既定のまま）。`bpmn(..., {fit: 'shrink'})` を付けると、レーン名の列・列の間隔・タスクの幅を、収まるまで段階的に詰める（収まる最初の段階で止まる。もともと収まる図は変わらない）。詰めすぎて矢印のラベルが箱に重なると `check` / `build` が止まるので、ノードを減らすか図を 2 つに分ける。縦向き（レーンを列にして上から下へ）には自動で切り替えない。例は `examples/bpmn-shrink.ts`。
- ノードの `id` は `connect()` の端点（`b.anchors.<id>` でも取れる）。例は `examples/bpmn.ts`。

### 自動配置の図の共通の注意（`tree` / `mindmap` / `stateDiagram` / `causeTree` / `cloud` / `gantt` / `classDiagram` / `bpmn` / `relationDiagram` / `pdpc` / `arrowDiagram`）

- 図の中の節（`id` を付けたもの）は、`connect()` の端点になり、`reveal` では図と一緒に出る。ただし spotlight は図ごと（図の `id`）で、節の `id` を指すと、そう書いて止まる。
- `check` の「自動の凡例」（`legend: 'auto'`）と、色だけに頼る強調の検査は、これらの図の `tone`・破線・点線を数えない（`causeTree` 系の `role`・AND の弧・戻り・断つ辺・中核の印は例外で、凡例に入る）。`new` / `changed` / `removed` や破線の遷移・メッセージを使うときは、自分で `legend()` を置く。
- 節の副題（`sub`）や «ステレオタイプ» の薄い文字は、`accent` / `new` の塗りの上でも 4.5:1 を保つよう、その塗りの上だけ通常の文字色になる。
- ラベルの白いチップは、自分の矢印以外の矢印や、状態・クラス・ノードに乗らないよう置き場所を探す。見つからないときは `check` / `build` が、どれとどれが重なるかを書いて止まる。

### 幅に収まらない自動配置の図（`dir: 'auto'` / `fold` / `maxWidth` / `width: 'fit'`）

自動配置の図が `diagram({width})`（既定 940）より広くなるとき、**`dir` を書かなかった図と `dir: 'auto'` の図だけ**、レイアウトが自分で収める。書いた `dir` と `maxNodeW` は変えない（収まらなければ、試した案とその幅・高さ、試さなかった案とその理由、直し方 1 つを書いて throw する）。最初に収まった案を採るので、もともと収まる図は変わらない。

| 部品 | 試す順 |
|---|---|
| `causeTree` | 向きは変えず、`maxNodeW` を 200 → 160 → 130 → 110、最後に層の行への折り返し（`fold`。上の「TOC の思考プロセス」）。`maxNodeW: 'auto'` は 260 → 100 を 10px 刻みで、幅と高さの両方に収まる最初の値 |
| `pdpc` / `relationDiagram` | `down`・`right` の両方を、`maxNodeW` の各幅で（down@200、right@200、down@160 …）。`fold` はしない |
| `stateDiagram` | `right`・`down` の両方を、`maxNodeW` の各幅で。ループ辺のための幅（`reserve`）も判定に含める |
| `classDiagram` | `down` ⇄ `right` だけ（狭める幅が無い） |
| `tree` | `down`・`right` の両方を、`maxNodeW` の各幅で。以前は throw していた図が `right` に回る |
| `mindmap` | `layout` は変えず、`maxNodeW` を省略したときだけ狭める。収まらなければ `layout: 'list'` などを勧めて止まる |

- `dir` を**省略**した図が変わると、`check` の `auto-fit-applied` が **warn**（`check --strict` が落ち、`build` の警告にも載る。`dir を up から right に変えた(1460→880px)` のように何が変わったかを書く）。`dir: 'auto'` と書くと **info**（変えてよいと宣言した図）。`accept: {'auto-fit-applied': '理由'}` でも外せる。
- `'auto'` のときは、収まる案の中で（交差, 折れ）が最良のものを選ぶ（高さが `canvas.height ?? maxDisplayHeight` を超える案は除く）。省略のときは最初に収まった案。
- `diagram({maxWidth: 1200})` は、その図だけ `doc-width` の閾値を上げる（案件全体は `.svg-diagram.json` の `maxWidth`。図の指定が勝つ。正の有限数でなければ throw。`canvas` の図は検査しない）。**図の幅は広がらない**ので、広い図にするなら `width: 1200` も書く。
- **縦に長い図**（情報 `aspect-tall`、`--verbose`）: 文書の図で、高さが幅の 1.5 倍を超えると出る（本の版面は縦横比が 1.5〜1.6 ほど）。使っている部品に応じた直し方を添える（`causeTree` は `fold`、`row` / `group` の積み重ねは `row({cols})` で横に並べる、どれでもなければ図を分ける）。自動では変えない（図の見え方が黙って変わるため）。
- `diagram({width: 'fit'})` は、細い図（`concentric`、縦の `chevron`、`cycle`、`venn`、`funnel`）の幅を内容 + 左右の余白（4px の格子、下限 320px）に縮める。文字の大きさは変わらない。既定の 940 は変えない（文書での図の大きさが変わるので opt-in）。縮むのは flow-shape の帯だけで、box / banner / 表など全幅の帯を持つ図は 940 のまま。`canvas` / `fill` / `slide` とは併用できない（throw）。`layout-figure-narrow`（info）の直し方になる。例は `examples/width-fit.ts`。

### 折れの少ない配置（`straighten` / `returns` / 直線の矢印）と `edge-bends`

層状の自動配置の図（`stateDiagram` / `arrowDiagram` / `causeTree` 系 / `classDiagram` / `pert` / `dependencyNetwork` / `causalLoop`）は、矢印の折れ・交差を減らすために次をする。`tree` / `mindmap` / `bpmn` は変わらない。

- **座標の候補を 2 つ作る**: 従来の座標と、Brandes-Köpf 法で層を飛ぶ長い矢印の鎖を揃えた座標。**（交差, 折れ）が辞書式で厳密に良いときだけ**新しいほうを採る（従来が幅に収まらず新しいほうが収まるときも採る）。描けない AND の弧が増える、無関係な箱を矢印が通る、従来が収まる幅に収まらない候補は捨てる。だから図が悪くなることはない。連関図 `qc-relation` は折れが 64 → 36、交差が 4 → 2 になった。独立した複数の塊は、並びに依らず `gap` で詰めて並ぶ（新しい座標のとき）。
- **戻りの矢印が他の線を横切る箇所の見せ方（`hop: true`。`causeTree` / `relationDiagram` / `pdpc`。ADR 0028）**: 並びの探索で直らない交差（外周のレーンを走る戻りが図を横切る箇所など）は、`hop: true` を書くと、戻りの線が**層の流れに逆らう側へ小さな弧を描いて、他の線を飛び越す**（判定はレイアウトで一度だけ。経路の点は変えない）。付けない箇所: 戻り自身や相手の折れ・矢じり・`blocks` のバーの近く、別の交点が近い箇所、AND の弧の近く、帯や箱の外へ弧が出る箇所、弧の隣に平行な線がある箇所、破線・点線の戻り。`blocks` は対象外。`hop: 'all'` にすると、戻りでない矢印の「層を横切る区間」も、流れに沿って走る線を飛び越す（折れ・矢じり・AND の弧・別の交点が近い交差には弧が付かない。例は `examples/toc-hop-all.ts`）。既定は off（書かない図の SVG は変わらない）。例は `examples/toc-hop.ts`。
- `straighten: false`（`causeTree` / `relationDiagram` / `pdpc` / `stateDiagram` / `arrowDiagram` / `classDiagram` / `pert` / `dependencyNetwork` / `causalLoop`）は、従来の座標のままにする（過去の SVG を動かしたくないとき。既定は `true`。ほかの値は throw）。`returns` とは独立（`straighten: false` でも戻り辺の外周は変わる）。
- **高さの重なる箱への矢印は 1 本の直線にする**: 隣り合う層の 2 つの箱が高さ（`dir: 'right'` なら縦、`'down'` なら横）で重なるとき、端点を同じ高さにそろえて折れずに引く。条件は、箱の辺から 6px 内側、同じ辺のほかの矢印と間隔を保つ、（交差, 折れ）が増えない、ほかの矢印の線と 1 本に見えない。円（`shape: 'circle'`）・六角形（`obstacle` / `risk`）の端と AND の矢印は動かさない。満たせないときは従来どおり肘。
- 層を 2 つ以上飛ぶ戻りの矢印は `returns: 'outer'` で外周の専用レーンに回せる（`causeTree` / `relationDiagram` / `pdpc` / `stateDiagram`。既定は部品ごとに違う。上の「TOC の思考プロセス」）。層を 1 つだけ戻る矢印は、今までどおり同じ層の間で別の帯を通る。
- `check` の `edge-bends`（info）が、折れの多い図を知らせる。条件は、1 本の矢印が 5 回以上折れる、または帯ごとの「折れの合計 ÷ 矢印の数」が 3 を超える（閾値は原則から固定で、図に合わせて動かさない）。数える対象は上の層状の帯と `bpmn`（`causalLoop` の `layout: 'ring'` は曲線なので数えない）。`connect()` の線・自己ループ・曲線は数えない。`check --verbose` で出て、`diagram({layoutCheck: 'strict'})` の図だけ warn になる。`accept: {'edge-bends': '理由'}` で許容できる。直し方は、層を飛ぶ矢印・戻る矢印を減らす（節の分け方・辺の向きを見直す）。SVG は変わらない。

### 同じ id を別の帯で使う（`scope`）

自己配置の帯は、中の項目に `id` を持てる。その id は図全体で 1 つなので、別々の帯が同じ id（`p0` など）を持つと `duplicate anchor id` で止まる。帯の opts に `scope` を書くと、項目が `scope.id` の名前で登録され、帯をまたいで同じ素の id を使える。

```ts
chevron([{label: '設計', id: 'p0'}, {label: '実装', id: 'p1'}], {scope: 'plan'})
gantt(rows, {today: '2026-04-01', scope: 'sched'})   // rows の中にも id: 'p0' がある
connect('plan.p0:right', 'sched.p0:left')
```

- `scope` を付けられるのは、`tree` / `mindmap` / `stateDiagram` / `causeTree`（`relationDiagram`・`pdpc` を含む）/ `cloud` / `gantt` / `classDiagram` / `bpmn` / `quadrant` / チャート（`causalLoop` / `pert` / `dependencyNetwork` を含む）/ `bars` / `image` / `swimlane` / `chevron` / `funnel` / `cycle` / `venn` / `concentric` / `emblem`。`group` と、トップレベルの `box` / `row` の `id` は対象外。帯自身の `id`（図全体の名前）も scope の対象外。scope の名前に空白と `:` `@` `#` `.` は使えない。
- 参照は**修飾名** `plan.p0`（常に通る）。素の `p0` は、その名前に決まるものが 1 つのときだけ通る。2 つ以上あると `ambiguous anchor id "p0": plan.p0, sched.p0 — write one of them` で止まり、未知の名前は `did you mean "plan.p0"?` の候補を添える。`connect()` / `reveal` / `until` / `diagram({spotlight: 'plan.p1'})` が修飾名を読む。scope なしの箱 `p0` と scope 付きの `plan.p0` が共存すると素の `p0` は曖昧になるので、片方を scope で書き分ける。
- `resolveAnchor(table, id, has)`（`lib/anchor-scope.ts`。純関数）が、完全一致 → 素の名前が 1 つ → 曖昧（error）→ なし（error）の 4 段で決める。
- ハンドル `.anchors.p0` は、scope 付きの帯では修飾名（`sched.p0:right`）を返すので、同じ素の id が複数あっても使える。型は、`.` を含む参照を形だけで通す（綴り間違いは実行時の候補つきエラーで捕まる。素の id が曖昧かどうかも実行時）。`@` を含む id は従来どおり型エラー。
- `reveal` の段階は項目ごとに記録され、同じ素の id を持つ別の帯と混ざらない（`connect` の `reveal` の自動導出は、参照した側の段階になる）。spotlight は、gantt の task と tree の node を直接は指せない（scope があっても変わらない。図全体の `id` で指す）。
- 複数の SVG を 1 つの HTML に貼るときの内部 id の衝突は、`build --id-prefix`（上の「使い方」）が別に防ぐ。

### コンサル系のチャート（`waterfall` / `radar` / `heatmap` / `lines` / `stackedBars` / `mekko` / `treemap` / `sankey` / `tornado` / `bubble` / `butterfly` / `combo` / `harvey`）

データを渡すと、軸・目盛り・配置・ラベルの避け方を計算して描く。座標は書かない。どれも次を満たす。

- **数字は必ず読める**: 値のラベルを出す。入らないセル・部分は描かずに `<desc>`（`diagram({title})` のある doc 媒体）に値を残す（`treemap({strict: true})` はエラー）。
- **色だけに頼らない**: 増減は符号（`+` / `-`）と棒の向き、系列は線の種類と印の形、濃淡は数字と凡例。
- **`id`**: 図に付けた `id` は図全体の `connect()` / `spotlight` の端点。要素の `id`（`waterfall` の段、`tornado` の行、`sankey` のノード、`treemap` の節、`radar` の系列、`stackedBars` / `mekko` の列）も端点になり、`spotlight` はその要素だけを残して他を薄くする（`treemap` の枠は残す）。`reveal` / `until` は図ごと。
- **`labelRole`**（`'note'`｜`'banner'`｜`'stat'`）で文字の大きさを選べる。暗い背景（`appearance: 'dark'`）でも使える。
- 色は既存のパレット。濃淡は強調色の 3〜6 段階（`pyramid` と同じ考え方）で、白い文字は濃い段にだけ載る（コントラストは `check` が見る）。

| 図 | 書き方 | 例 |
|---|---|---|
| ウォーターフォール図 | `waterfall(steps, {unit, dir: 'v'｜'h'})` | `examples/chart-waterfall.ts` |
| レーダーチャート | `radar(axes, series, {max, values})` | `examples/chart-radar.ts` |
| ヒートマップ / コホート表 | `heatmap(rows, cols, values, {unit, corner})` | `examples/chart-heatmap.ts` |
| 戦略キャンバス | `strategyCanvas(factors, series)` | `examples/chart-lines.ts` |
| バーンダウン / バーンアップ | `burndown({total, days, actual})` / `burnup({scope, days, done})` | `examples/chart-burndown.ts` |
| 折れ線（S カーブ・リテンション・カノモデル） | `lines(series, {x, y, target, annotate})` | |
| 積み上げ棒 / 100% 積み上げ | `stackedBars(columns, {percent})` | `examples/chart-stacked.ts` |
| マリメッコ図 | `mekko(columns)` | `examples/chart-mekko.ts` |
| ツリーマップ | `treemap(tree)` | `examples/chart-treemap.ts` |
| サンキー図 | `sankey(nodes, links)` | `examples/chart-sankey.ts` |
| トルネード図 | `tornado(items, {base})` | `examples/chart-tornado.ts` |
| 回帰つき散布図 / 残差プロット（seaborn の `regplot` / `lmplot` / `residplot`） | `regplot({x, y, group?}, {order, stats})` / `residplot({x, y})` | `examples/chart-reg.ts` |
| パネル分割（seaborn の `FacetGrid` / `col=`） | `...facet({東京: a, 大阪: b}, (名前, 値, _i, axes) => histplot(値, {...axes}), {cols: 3})` | `examples/facet.ts` |
| 2次元の密度（等高線） | `kde2d({x, y})` | `examples/chart-kde2d.ts` |
| クラスタ付きヒートマップ（seaborn の `clustermap`） | `clustermap(行名, 列名, 値の表, {scale, unit})` | `examples/chart-clustermap.ts` |
| 2次元ヒストグラム / ジョイントプロット / 散布図行列（seaborn の `histplot(x, y)` / `jointplot` / `pairplot`） | `hist2d({x, y})` / `jointplot({x, y, group?})` / `pairplot({変数: [..], ...}, {groups, corner})` | `examples/chart-multi.ts` |
| ヒストグラム / KDE / ECDF / ラグ（seaborn の `displot`） | `histplot` / `kdeplot` / `ecdfplot` / `rugplot(values｜groups, {label, stat, binWidth})`、重ねるなら `displot(values, {kind: ['hist', 'kde', 'rug']})` | `examples/chart-dist.ts` |
| 箱ひげ図 / バイオリン / ストリップ / スウォーム / ポイント / 誤差つき棒（seaborn の `catplot`） | `boxplot` / `violinplot` / `stripplot` / `swarmplot` / `pointplot` / `barplot(groups, {label, dir, hues})`、重ねるなら `catplot(groups, {kind: ['violin', 'strip']})` | `examples/chart-cat.ts` |
| バブルチャート | `bubble(points, {x, y, sizeTitle, sizeUnit})` | `examples/chart-bubble.ts` |
| バタフライチャート | `butterfly(rows, {leftLabel, rightLabel, unit})` | `examples/chart-butterfly.ts` |
| コンボチャート（棒 + 折れ線） | `combo(categories, series, {y, y2})` | `examples/chart-combo.ts` |
| ハーベイボール | `harvey(rows, cols, values, {levels, highlight})` | `examples/chart-harvey.ts` |

```ts
waterfall([{label: '前期', value: 1000}, {label: '価格', value: 220}, {label: '数量', value: -130}, {label: '小計', kind: 'subtotal'}, {label: '今期', kind: 'total'}], {unit: '百万円'})
radar(['品質', '価格', '納期'], [{label: '自社', values: [4, 3, 5]}, {label: 'A 社', values: [5, 2, 3]}], {max: 5, values: true})
heatmap(['4月登録', '5月登録'], ['0か月', '1か月', '2か月'], [[100, 62, 48], [100, 66, null]], {unit: '%', corner: '登録月 ＼ 経過月'})
lines([{label: '自社', values: [3, 4, 5]}, {label: '競合', values: [5, 3, 2]}], {x: {categories: ['価格', '品質', '速さ']}, y: {min: 0, max: 5}})
mekko([{label: '北米', parts: [{label: 'A 社', value: 520}, {label: 'B 社', value: 310}]}, {label: '欧州', parts: [{label: 'A 社', value: 240}, {label: 'B 社', value: 280}]}], {unit: '億円'})
treemap([{label: 'クラウド', children: [{label: 'ストレージ', value: 420}, {label: '計算基盤', value: 310}]}, {label: 'その他', value: 40}], {unit: '億円'})
sankey(['広告', '訪問', '購入', '離脱'], [{from: '広告', to: '訪問', value: 100}, {from: '訪問', to: '購入', value: 15}, {from: '訪問', to: '離脱', value: 85}], {unit: '人'})
tornado([{label: '販売単価', low: 640, high: 1360}, {label: '為替', low: 880, high: 1130}], {base: 1000, unit: '百万円'})
histplot([62, 65, 70, 71, 72, 74, 80], {label: '体重（kg）', stat: 'probability'})
displot({男性: [62, 70, 74, 80], 女性: [48, 55, 58, 66]}, {kind: ['hist', 'kde', 'rug']})
boxplot({東京: [52, 58, 61, 63, 96], 大阪: [41, 47, 50, 55, 71]}, {label: '売上（百万円）', counts: true, values: 'median'})
catplot([{label: '第1四半期', hues: [{name: '新規', values: [32, 35, 41]}, {name: '既存', values: [51, 56, 66]}]}], {kind: ['violin', 'swarm']})
bubble([{label: 'A 事業', x: 1.8, y: 6, size: 520}, {label: 'B 事業', x: 0.7, y: 18, size: 240}], {x: {title: '相対シェア', line: 1}, y: {title: '成長率', unit: '%', line: 10}, sizeTitle: '売上', sizeUnit: '億円'})
butterfly([{label: '品質', left: 82, right: 74}, {label: '価格', left: 58, right: 88}], {leftLabel: '自社', rightLabel: '競合', unit: '点'})
combo(['2024', '2025'], [{label: '売上', type: 'bar', values: [1180, 1330]}, {label: '営業利益率', type: 'line', values: [11, 13]}], {y: {unit: '億円'}, y2: {unit: '%'}})
harvey(['価格', '品質'], ['A 社', 'B 社'], [[4, 2], [1, 3]], {highlight: ['A 社']})
// 行を connect() / spotlight の対象にするなら、行を {label, id} で書く: harvey([{label: '価格', id: 'price'}, '品質'], ...)
```

- **`waterfall`**: 最初の段は開始（`value` が水準）、ほかは増減（`value` が差）。`kind: 'subtotal'｜'total'` は 0 から立つ棒で（先頭には置けない）、`value` を書かなければ累計、書けば累計と合わなければ止まる。水準が 0 をまたいでも、負の合計でも描ける（0 の線が太い）。`dir: 'h'` は横向き（段の名前が長いとき）。棒の色は開始・合計が濃い色、小計が灰色、増加がアクセント、減少が赤（`tone` で変える）。
- **軸をそろえる（`domain` と `chart-axis-mismatch`）**: `waterfall` / `stackedBars`（積み上げ。`percent` と `mekko` は値の軸が無い）/ `tornado` は、値の軸を**自分のデータに合わせて**決める。同じ単位の 2 つを並べると、5.76 と 9.5 の棒がほぼ同じ長さに見える（それぞれ 0〜6、0〜10 の軸だから）。両方に `domain: [0, 10]` を書くと、軸の端が同じになり（目盛りの刻みにそろえて広がる）、同じ値は同じ長さになる。データが `domain` からはみ出すと止まる。`bars` は今まで通り `max` をそろえる。検査 `chart-axis-mismatch`（警告）は、**比べて読む並び**の 2 つのチャート（同じ `row` の別々の `group` の中で、値の軸が縦のもの。または間に別のチャートを挟まず縦に続く、値の軸が横のもの）が、同じ `unit` で軸が違うときに出る。`unit` が無いチャート、向きが違うものどうしは対象外。意図して別の量を別の軸で描くなら `axisGroup: false` か `accept`。注意: 軸の端が同じでも、プロットの幅・高さが違えば長さは揃わない。**横向きのチャート**（`bars` の `dir: 'h'`、`waterfall` の `dir: 'h'`、`tornado`）は、ラベルの列の幅が図ごとに違うので、`plotInset: [左, 右]`（プロット領域が、チャートの左端から何 px で始まり、右端の何 px 手前で終わるか）を同じにすると、同じ値が同じ長さになる。ラベルが入りきらない値を書くと、必要な最小値を挙げて止まるので、並べるチャートのうち最大の値に揃える。縦向きのチャートは `height` を揃える。
- **`radar`**: 軸の値は同じ目盛り（`max`、既定は切りのよい数）。`values: true` で頂点に値を書く。ほかの系列と同じ場所で入らない値は描かず、`<desc>` に残る。系列の見分けは、実線・破線・点線・一点鎖線と、○ □ ◇ △ の印（凡例に同じものが出る）。目盛りの値は、系列の線と印に重ならない軸の横に書く（輪が文字より狭いときは 1 つおき、場所のない輪には書かない）。
- **`heatmap`**: `null` は空欄（点線の枠にダッシュ）。濃さの境目は、`min` / `max` を省くと切りのよい数になり（段数は `levels` が上限）、凡例に範囲が出る。`rowHeader: false` で行の名前を太字にしない。長い行の名前は折り返し、行が高くなる。
- **`lines`**: `plane` を返すので、`labelRole`・`id`・`reveal` はそのまま効く。`x: {categories}` なら系列は値の配列（`null` は途切れ）、数値軸なら `[x, y]` の配列。系列名は線の右端に書き、同じ高さで終わる名前は縦にずらす。早く終わる系列の名前は、近くに空きがなければ右端へ点線でつなぐ。`ideal: true` は破線の計画線（名前は線の途中に付く）、`target: {at, label}` は目標の横線、`annotate: [{at: [x, y]｜{series, index}, label}]` は注目点の輪と名前。カノモデルは `[x, y]` の点と `smooth: true`。系列は 6 つまで（印は ● ■ ◆ ▲ ○ ✕）。
- **`mekko` / `stackedBars`**: 部分の名前は、列の最初の登場順に下から積む。7 つ以上の部分は止まる（「その他」にまとめる）。`stackedBars` の列は数字が入る幅まで広がる（区画の幅まで）。それでも数字が入らない部分は描かず `<desc>` に残る。`mekko` の列は最大 12、`stackedBars` は 20。
- **`treemap`**: 葉は `{label, value}`、グループは `children`（4 階層まで。グループの値は子の合計で、書くなら一致が必要）。葉の `tone: 'accent'｜'danger'` は塗りつぶし。グループの名前が入らないときも `<desc>` に残る。グループの枠と見出しの帯が子の場所を取る分は重みを補正するので、葉の面積はグループの中でも外でも値に比例する。`percent: true` で全体に対する割合を添える。
- **`sankey`**: ノードは文字列か `{id, label?, tone?}`（どのリンクにも出てこないノードはエラー）。層は最長経路で決まり（循環は止まる）、出ていかないノードは最後の層に寄る（`align: 'left'` で寄せない）。ノードの並びは交差が少なくなるように入れ替える。ノードの高さが値に比例するので、名前が収まらないほど低いノードでも、名前の高さ分の場所は空ける。リボンには、両端のどちらの名前にも載っていない値（分岐・合流の途中）だけ数字が入る。`tone: 'danger'` のリボンは赤の破線で縁取る。
- **`tornado`**: `low` / `high` は「その入力が低い / 高いときの結果」（結果が低いとは限らない）。結果が基準と同じならその棒は描かず数字だけ書く。両方が基準の同じ側に出るときは、棒を 2 段に分ける。
- **`regplot` / `residplot`**: `{x: [..], y: [..], group?: [..]}`（生の値）。最小二乗の直線（`order: 2｜3` で多項式の曲線）と、平均の 95% 信頼帯（解析解。t 分布）を描き（`lowess: true` は多項式の代わりに LOWESS = 局所回帰の曲線。外れ値に強い反復つきで、`frac`（各点の当てはめに使う点の割合、既定 2/3）が小さいほど細かく追う。帯・式・R² はない（`stats` と併用すると止まる）。`order` とも併用できない）、`band: false` で帯なし、`stats: true` で凡例に式（直線のとき）と R²。グループごとに別の回帰（印・線の種類・色が違う）。x の異なる値が `order + 1` 個、点が `order + 2` 個ないと止まる。`residplot` は同じ当てはめからの残差と、破線の 0 の線（曲がりが残っていれば形に出る）。`lowess: true` は残差の LOWESS 曲線を重ね、直線が取りこぼした形を見せる。
- **`facet(data, make, {cols, share})`**: `data` のキーごとに 1 枚、`make(キー, 値, 番号, axes)` が返す図を枠つき（キーが見出し）で並べる（`cols` 列ずつ、最後の行も同じ列幅）。**軸は既定で全パネル共通**（seaborn の sharex / sharey）: 一度ふつうに描いて各パネルの軸を調べ、全体の範囲を `axes`（`{xRange, yRange}`）として渡して描き直すので、`make` は `axes` をそのまま図の opts に展開する（`histplot(値, {...axes})`）。`share: 'x'｜'y'｜'xy'｜'none'`。共有できるのは `histplot` / `kdeplot` / `ecdfplot` / `displot` / `regplot` / `residplot` のパネル（ほかの図は何もされず、そういうパネルしかないのに `share` を明示すると止まる）。`...facet()` で `.add()` に展開する。
- **`kde2d`**: 2 変数のガウス KDE（各軸 Scott の帯域幅）を、最大密度の 10・30・50・70・90% の 5 段の塗りと等高線（marching squares）で。点を小さく重ねる（400 点まで）。
- **`clustermap`**: 行×列の数の表（40×40 まで）。行と列を平均連結法（ユークリッド距離）で並べ替え、樹形図を上と左に付ける（`rows: false` / `cols: false` でその向きは並べ替えない）。`scale: 'row'｜'col'` は行（列）ごとに 0〜1 にしてからクラスタリングと濃淡を決める（セルの数字は元の値）。`values: false` で数字を省く。木は決まった順で作るので、同じ表は同じ並びになる。
- **`hist2d` / `jointplot` / `pairplot`**: 列ごとの**生の値**を渡す（`{x: [..], y: [..]}`、`pairplot` は `{身長: [..], 体重: [..]}` で 2〜6 変数）。`hist2d` は切りのよい幅の升に点を数え、度数を升に書いて濃淡にする（入らない度数は書かず、凡例の 5 段階に最大値と 0）。`jointplot` は散布図と、上・右に各変数のヒストグラム。`pairplot` は全組の散布図と、対角線にその変数のヒストグラム（`corner: true` は対角線の下だけ）。目盛りは下と左（1 行目だけ右）に 1 回ずつ。`group`（`pairplot` は `groups`）は行ごとのラベルで、4 グループまで。印の形（● ◆ ■ ▲）と、ヒストグラムの輪郭の線の種類（実線・破線…）で見分け、凡例が付く。`bins` は階級数の目安、`xLabel` / `yLabel` は軸名。乱数は使わない。
- **`histplot` ほか（seaborn の distribution plots）**: **生の値**（数の配列、または `{男性: [..], 女性: [..]}` で 4 グループまで）を渡す。`kind` は関数名で決まる 1 層か、描く順の配列（`['hist', 'kde', 'rug']`。`ecdf` は別の軸なので `hist` / `kde` とは重ねられず、`rug` とだけ）。`hist` の階級幅は切りのよい数（`bins` で個数の目安、`binWidth` で幅。グループは階級を共有する）で、`stat` は `count`（既定）／`density`／`probability`／`percent`。`element: 'step'` は棒を輪郭の 1 本線にする（グループが重なるとき見やすい）。`kde` は Scott の帯域幅のガウス KDE（`bw` はその倍率）で、データの両端から帯域幅 2 つ分まで伸ばし、`hist` と重ねると `stat` に合わせて高さが揃う（`kde` だけなら密度）。`ecdf` の `stat` は `probability`（累積割合、既定）／`count`／`percent`。グループは色と線の種類（実線・破線・点線・一点鎖線）の両方で見分け、凡例が付く。乱数は使わない。`id` はグループの端点。
- **`boxplot` ほか（seaborn の categorical plots）**: 集計済みの数字ではなく**生の値**を渡す（`{東京: [..], 大阪: [..]}`、または `[{label, values, id?}]`）。四分位・カーネル密度・信頼区間・ビースウォームは `lib/stats.ts` が計算し、乱数を使わないので同じ値は同じ図になる。`kind` は 1 層（`boxplot` などの関数名で決まる）か、描く順の配列（`['box', 'strip']` は箱の上に点）。`box` はひげが 1.5 IQR 以内の最も遠い値までで、外れ値は○（`strip` / `swarm` を重ねると点が示すので省く）。`violin` は Scott の帯域幅のガウス KDE を、データの範囲で切って（seaborn の `cut=0`）左右対称に描き、中に四分位の太線と中央値の点。`scale: 'area'`（既定。面積が揃う）／`'width'`（どれも幅いっぱい）。`strip` は決まった順の揺らし、`swarm` は点が重ならない配置（入らなければ、幅・高さを上げるか `stripplot` に、と止まる）。`point` は平均と誤差の棒を、hue ごとの線（実線・破線・点線）でつなぐ。`bar` は 0 から平均まで。誤差は `error: 'ci'`（既定。t 分布の 95% 信頼区間）／`'sd'`／`'se'`／`'range'`／`'none'`。`hues: [{name, values}]`（`label` と `values` の代わり）で第二のカテゴリを横に並べる（4 つまで。凡例つき、濃淡と ● ◆ ■ ▲ で見分ける）。`dir: 'h'` は横向き、`values: 'median'｜'mean'` は各グループの値を添える（`bar` は平均が既定）、`counts: true` は `n = …`。`id` はグループの端点。
- **`bubble`**: 面積が値に比例（半径は √値）。`size` は 0 より大きい。軸は点と `x.line` / `y.line` に合わせて自動で、端の円がはみ出すときは目盛りを足して広げる（`x.min` / `x.max` を書いた軸は広げず、はみ出すなら止まる）。名前は円に収まれば中、だめなら右・左・上・下・斜めの順で、他の円・名前・軸の数字に重ならない場所へ（どこにも置けなければ止まる。点を減らすか、`width` / `height` を上げる）。重なる円は大きい方を先に描く。`tone` は円の色（`accent`｜`danger`｜`muted`｜`text`）。
- **`butterfly`**: 左右の棒は同じ目盛り（長い方が半分の幅）。値は棒の外側に書き、0 は棒なしで数字だけ。群の名前は色見本つきで上に出る。行は 20 まで。
- **`combo`**: 棒は 3 系列まで（横に並べる）、折れ線は 3 系列まで（実線・破線と ● ■ ◆）。棒は薄い塗りで、折れ線とその数字が上を通れる。右軸の目盛りは左軸の罫線に合わせた間隔にし、合わなければ罫線なしで右軸だけ書く。`null` は棒なし・線の途切れ。入らない値は描かず `<desc>` に残る（`values: false` で数字を全部消す）。
- **`combo` の積み上げ**: `stack: true` で棒の系列を 1 本に積み、合計を上に書く（棒は 2 系列以上、値は 0 以上）。各区画の数字は区画に収まり、折れ線に重ならないものだけ書く（残りは `<desc>`）。
- **`harvey`**: 値は 0〜4 の整数（0 = 空、4 = 全塗り）。色ではなく扇の形で示すので、白黒でも読める。`levels` で 5 段階の呼び名を変える（既定 なし / 一部 / 半分 / ほぼ / 十分）。表の中の `—` は未評価。<desc> に「行: 列 呼び名」の形で全部残る。
- 全部の検査（重なり・はみ出し・コントラスト）は `check` で、描画後の確認は `svg-diagram preview`。入らないラベル・列は、エラーに直し方（幅・高さ・省略）が書いてある。
- 計算だけ取り出したいときは、`lib/charts-treemap.ts`（`squarify`）、`lib/charts-sankey.ts`（`layersOf`）、`lib/charts-heatmap.ts`（`heatLevel`）、`lib/charts-base.ts`（`niceScale`）が純粋な関数。
- **`plane` の追加**: 点の `shape` は `dot` / `ring` / `cross`（4px の格子に載る）のほか、頂点にぴったり載る `disc` / `hole` / `square` / `diamond` / `triangle`。`endLabels: true` は `labelAt: 'right'` の点の名前を図の右端に集めて縦にずらす。`labelLeader: true` の点は、空いた側がないとき名前を右端へ移して点線でつなぐ。`labels` の `offset: [dx, dy]` で位置をずらせる。

### 意味付きネットワーク（`pert` / `causalLoop` / `dependencyNetwork`）

ノードとリンクに業務上の意味を持たせたネットワークを、既存の階層型レイアウトで自動配置する。`direction: 'LR' | 'TB'`（既定 LR）、`width` / `height`、`labelRole`、図とノードの `id`、dark theme はチャートと共通。`height` を内容より大きく指定すると、図は縦中央に置かれる（介入点の帯と凡例の間。上詰めに戻す指定は無い）。

```ts
pert([{id: 'design', label: '設計', duration: 4}, {id: 'build', label: '実装', duration: 6, predecessors: ['design']}], {unit: '日'})
causalLoop([{id: 'quality', label: '品質'}, {id: 'orders', label: '受注'}], [{from: 'quality', to: 'orders', polarity: '+'}, {from: 'orders', to: 'quality', polarity: '-', delay: true}])
dependencyNetwork([{id: 'web', label: 'Web', kind: 'app'}, {id: 'api', label: 'API', kind: 'service'}], [{from: 'web', to: 'api', type: 'uses', weight: 3}], {nodeKinds: {app: 'アプリ', service: 'サービス'}, edgeTypes: {uses: '利用'}})
```

- `pert`: activity-on-node の PERT（作業を矢印で描く activity-on-arrow は `arrowDiagram`）。ES / EF / LS / LF / slack を計算し、slack 0 のノードとリンクを強調する。未知の先行タスクと循環はエラー。`compact: true` は小さい箱。純粋関数 `analyzeCriticalPath(tasks)` も公開。
- `causalLoop`: `polarity` は `'+' | '-' | 'same' | 'opposite'`。`delay: true` は `||`。単純ループの負リンクが偶数なら Reinforcing (`R1`)、奇数なら Balancing (`B1`)。番号は R / B それぞれで 1 から振る。純粋関数 `analyzeCausalLoops(nodeIds, links)` も公開。`interventions: [{id, label, to, polarity, delay?}]`（ループの外の介入点。`to` は node id か配列、`polarity` は必須）は、ループの**外側の帯**に描かれる: LR は上、TB は左、`layout: 'ring'` は円の上下（対象が上半分なら上、下半分なら下。上下に分かれる対象を 1 つの介入点に書くと矢印が円を横切るので、箱を貫けば止まる）。箱も矢印も破線で、`+` / `-` と遅延 `||` は矢印に付く。帯の中は対象の中心の順に並び、16px 以上離れる。置けないときは帯を 8px ずつ最大 3 回厚くしてやり直し、それでも駄目なら、どの介入点のどの矢印が何に当たるかを書いて止まる（ラベルを短くする、`to` を減らす、リンクかノードを減らす）。介入点の `id` は `connect()` / `spotlight` の対象になる。alt には `Interventions: …` が入る。R / B の分類とループ名は変わらない。`height` は最小値で、介入点があると図は帯の分だけ高くなる（TB は箱の列の分）。例は `examples/semnet-causal-intervene.ts`。`layout: 'ring'` は、**閉路がちょうど 1 つの図**（全ノードが長さ 2〜8 のそのループの上にあり、ループの辺以外に辺がない。自己ループは可）を楕円の円周に時計回り（先頭が上）に置き、辺を弧で結ぶ。ループ名は中央。満たさない図（8 の字・弦・ループ外のノード・9 ノード以上）と `direction` との併用は、`causalLoop({layout: 'ring'}): the graph must be one loop (...)` で止まる。ループの外のノードは介入点（`interventions`）に回す（介入点つきの輪は、外側の上下の帯に置く）。`height` が足りないと必要な高さを書いて止まる。既定は `'layered'`（今のまま）。例は `examples/semnet-causal-ring.ts`。
- `dependencyNetwork`: ノードの `kind` は色と枠、リンクの `type` は線種、`weight` は線幅と数値に対応する。使用した kind / type の凡例を自動で描き、表示名を `nodeKinds` / `edgeTypes` で指定できる。`blocks` は danger、`relates` は矢じりなし。
- 例は `examples/semnet-pert*.ts`、`examples/semnet-causal*.ts`、`examples/semnet-deps*.ts`。

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

### 数値の時間軸（`timeline({unit})`）

日付ではなく ms・秒・ステップ数の軸には、`from` / `to` を**数**で書き、`unit` を付ける（`unit` があるとこの形になる。日付の形とは混ぜない）。

```ts
timeline({
  unit: 'ms', from: 0, to: 700,
  lanes: ['UI', '通信'],
  events: [{at: 44, label: '再初期化', lane: 'UI', tone: 'danger'}, {at: 120, label: '要求', lane: '通信', tone: 'accent'}],
  spans: [{from: 44, to: 388, dim: true, lane: 'UI'}, {from: 120, to: 560, label: '応答待ち', lane: '通信'}],
})
```

- 目盛りと値には `unit` が付く（`0ms`、`44ms`）。目盛りは 1・2・5 × 10^n の刻みで 8 本まで（`step` で固定）。
- `lanes` は上から下の行で、名前が左に出る（省くと名前のない 1 行）。`events` / `spans` の `lane` で行を選ぶ（省くと先頭の行）。
- `events` は点と、名前・値の旗。近いと段を変えて階段にする（それでも収まらなければ、行を分けるか短くするよう言って止まる）。
- `spans` は既定が棒（`label` は棒に収まれば中、収まらなければ横）。`dim: true` は寸法線（両端に目盛り）で、`label` を省くと長さ（`344ms`）を上に書く。重なる区間は行を分ける。
- 範囲外の値・`from >= to`・知らない `lane` は throw。例は `examples/timeline-ms.ts`。

### 順序だけの出来事（`steps`）

```ts
const s = steps([{title: '1回目', body: '原因は不明'}, {title: '4回目', tag: '気づく'}, {title: '5回目', icon: 'shield'}], {numbered: true, highlight: 3, id: 's'});
```

`numbered: true` で各タイトルに番号バッジ、`highlight: n` で n 番目だけを強調（`highlightTone` は既定 `'danger'`、`'accent'` も可）。矢印は既定で付く（`arrows: false` で外す）。項目は `{title, body?, icon?, tag?, tagTone?, tone?}`（`icon` は `box({icon})` と同じ）。返るのは `row()` なので、`s.col(2).left` のように端点にできる。例は `examples/steps.ts`。

**戻る線・飛ばす線**: `steps` / `chevron` / `row` の箱から**前の箱へ戻る**線（「差し戻し」「繰り返す」）は、`connect('s#4:bottom', 's#2:bottom', {route: 'loop-under', label: '差し戻し'})` と書く。線は箱の下をコの字に回るので、途中の箱を貫かない。`straight` / `elbow` のままだと、途中の箱と重なって build が止まる（`path overlaps`）。戻りを複数書くときは、`dip` で高さをずらす（同じ高さの戻りが重なっても、`4→2` と `3→1` のように交差しても、いまの検査は止めないので、仕上がりを目で確かめる）。

**縦に積んだ箱の戻り（`route: 'loop-side'`）**: 縦の列で、最後の箱から最初の箱へ戻る線は、同じ側どうしのアンカー（`connect('s7:left', 's1:left', {route: 'loop-side'})`）を、箱の外側（`dip` px、既定 32）へ回して結ぶ。`left` / `right` / `top` の同じ側だけ（下は `loop-under`）。**箱が図の幅いっぱいだと、回る余白が無く、線が図の外へ出る**ので `build` が止まる: 各段を `row([box({id, width: 600})], {justify: 'center'})` で狭める。ラベルは線の外側に置かれる（収まらなければ同じく止まる。`chip: true` なら線の上）。

**前の箱へ戻る線（`loopBack`）**: `steps(items, {loopBack: {from: 4, to: 2, label: '差し戻し'}})` は、4 番目から 2 番目へ戻る線を、箱の下に弧（コの字）で描く（`row()` の箱の列、横向きの `chevron()` も同じ。`chevron` は番号のほか項目の `id` でも指せる）。`from` は `to` より後ろ。複数書けて、**入れ子（一方のスパンが他方の内側）なら高さが自動でずれて重ならない**。`4→2` と `3→1` のように範囲が半端に重なる 2 本は交差するので、書くとエラーになる（戻り先か戻り元を変えるか、1 本にまとめる）。`chip: true`（ラベルを線の上の札に）、`tone`、`line: 'dashed'`（例外の経路）も書ける。中身は `connect(…, {route: 'loop-under'})` なので、検査（箱を貫かない・ラベルが矢印を覆わない）も同じように効く。縦向きの `chevron` と、group を含む `row` には書けない。例は `examples/steps-loop-back.ts`。

### 注釈のコネクタ（`bracket` / `callout`）

- `bracket(a.left, b.right, {label, side: 'below' | 'above'})` は、2 つの箱（行の列でも可）の下（`above` なら上）に、左の端点の x から右の端点の x まで括弧を引き、ラベルを括弧の外に書く。下に付けるときは、括弧とラベルの分の高さを空ける。`connect(arrow: 'none', line: 'dotted')` を 2 本引く代わり。
- `callout('id' または 'id:side', {text, side: 'above' | 'below' | 'left' | 'right'})` は、箱を指す矢印と、その先の吹き出し（1 行）。`side` の既定は `above`。`below` のときだけ高さを空ける（ほかは周りの箱に重ならないよう、余白を見て選ぶ）。`bracket` の `above` と `callout` の `above` / `left` / `right` が図の外にはみ出す、または caption に重なると、検査（verify）が止める。上に余白が要るなら、行の前に `spacer()` を置く。
- どちらも `connect()` の一種で、`reveal` / `until` と `tone` が使える。`diagram({connectDefaults})` は適用されない。例は `examples/bracket-callout.ts`。

### 題名を図の見出しに出す（`showTitle`）

`diagram({title: '離職の流れ', showTitle: true})` は、`title`（SVG の `<title>`）を**図の最初の行**（左寄せ・太字・title の大きさ。group の題名と同じ）にも描く。既定は off（書かなければ、`title` は今までどおりメタデータだけで、SVG は変わらない）。`title` が無いと throw する。`caption(同じ文字列, {bold: true, tone: 'text'})` を先頭に置いていた図は、caption を消して `showTitle` に寄せられる（`check` が情報 `title-duplicated` で知らせる）。移行すると見た目（寄せ・太さ）が変わるので、golden の差分は大量に出る。題名も見出しなので、`cjk-line-long` の対象になる。

### 出典行（`sourceLine`）

`diagram({sourceLine: '出典: 総務省 2025'})` は、出典を**図の最後の 1 行**（左寄せ・muted・14px）に固定する。`add()` の順や他の部品に関係なく、いつも一番下にあるので、本文の部品と重ならない。キャンバスの高さに含まれる。空・複数行の文字列は throw。1 行に収まらず折り返すと `source-wraps` を warn する（出典の細部は本文へ）。文字のコントラストは、他の caption と同じ検査（`a11y-text-contrast`、verify）に通る。`sourceLine` を使わない図の出力は変わらない。例は `examples/timeline.ts`。

**出典行を描かない（`build --no-source-line`）**: `svg-diagram build x.ts --no-source-line` は、`diagram({sourceLine})` を描かずに作る（スライド用と文書用を 1 つのソースで使い分ける。ソースは変えず、`sourceLine` が無い図では何も起きない）。使ったときだけ `<metadata>` に `noSourceLine: true` が残り、`check --drift --rebuild` と `build --stale` はそれを読む（`--stale` は同じフラグで繰り返し作る使い方を想定）。`deck --no-source-line` は `.ts` にだけ効き、入力に `.svg` があれば `⚠ <file>: .svg の出典行は消えない(.ts から描き直す)` を出す。`renderSource({noSourceLine: true})` も同じ。`preview` / `show` にフラグは無い（描画済みの SVG を読むだけ）ので、出典行なしを見たいときは `build --no-source-line --out-dir <別の場所>` の SVG を渡す。環境変数は無い。

### 下書きバッジ（`status`）

`diagram({status: 'draft'})` は、最上段に 1 段（約 28px）足し、右端に破線の札「下書き」を描く（塗りは背景色・枠は muted の破線 1.5px・文字は太字の `note`。`<g role="img" aria-label data-status>`）。`statusLabel: '仮説'` で「仮説」「仮置き」などに差し替える（単一行・非空・`status` と一緒に。`status` は `'draft'` だけで、ほかは throw）。出典行の隣の固定位置なので、本文の部品と重ならず、題にはならない。スライド（`canvas`）では 1 段ぶんの高さが予算に入る。spotlight で暗くならず、ダークでは自動で色が替わる。札が図の幅に入らないと、`statusLabel` を短くするよう書いて止まる。`--html` の出力にも札は出るが、HTML/CSS への写しは未対応（SVG のオーバーレイ）。`<desc>` の先頭に札と同じ文言の「(下書き)」（`statusLabel: '仮説'` なら「(仮説)」）が付き、`desc` を自分で書いていても足される。`<title>` は変わらない。`<metadata>` には `"status":"draft"` が残る。`check` は info の `draft-status`（図が下書きのまま。`--strict` でも失敗しない）を出し、公開ジョブで `check --forbid-draft` を付けると warn になる（`accept` で許容済みのものは info のまま）。`status` を書かない図の出力は変わらない。

### 大きい文字（ロールで選ぶ）

主役の絵の文字は、px ではなく**ロール**で大きくする。入口は次の 4 つ。

| 入口 | 指定 | 大きさ |
|---|---|---|
| `caption` | `caption(text, {role: 'display'})` | `label` 14 / `banner` 16 / `stat` 34 / `display` 56 |
| `stat` | `stat(v, label, {size: 'stat' \| 'display'})` | 値が 34px（既定）/ 56px |
| `banner` | `banner({headline, headlineRole: 'banner' \| 'stat' \| 'display'})` | 見出しが 16px（既定）/ 34px / 56px。banner の高さも増える |
| `bars` / `plane` | `labelRole: 'note' \| 'banner' \| 'stat'` | 図のすべての文字（軸名・目盛り・値・カテゴリ・点・寸法）が 14px（既定）/ 16px / 34px |

`labelRole` を付けると、図の余白・目盛りの間隔・寸法線の離れ・横棒の太さも文字に合わせて広がる（指定しない図は 1 ピクセルも変わらない）。`plane` の `height` が足りなければ throw する。`fill: true` の拡大（最大 1.8 倍）は、`headlineRole` / `labelRole` を付けた文字が **72px を超えない**ところで止まる（`display` の見出しは約 1.28 倍まで。`stat` のラベル 34px は 61px で上限内）。指定のない図は従来どおり 1.8 倍まで。

**縦の位置は 4px の格子に乗る**(ADR 0014 U1b): 箱・banner・見出し・group の枠の上端は、配置の段階で 4px の格子に置く(emit で丸め直さない)。枠の下端は上端 + 高さの 4px への丸めなので、上端も下端も格子に乗り、**枠の上端から文字の baseline までの距離は、図の中の位置によらず一定**になる。以前は枠だけを丸めて文字を丸めなかったので、その距離が位置によって最大 4px 振れ、`padY` が小さい箱・banner では、字面の上端が枠の内側 4px を割って lint が「枠からはみ出す」と言うことがあった(`padY: 0` の 16px の見出しで 4px)。今は `padY` を足さなくても、この振れでは出ない。縦の位置の累積は、丸めた高さではなく実の高さで進めるので、下の帯ほど少しずつずれていくことはない。plane・quadrant・timeline・wireframe・screens・wordart は、内側の座標がまだ格子に乗っていないので、従来どおり丸め前の位置から置く(縦の格子化の対象外)。

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

台所の絵のような画像を部品として置き、その上に印と文字を重ねる。ファイルは図を描く（検査する）ときに**一度だけ**読み（`image()` を呼ぶ時点ではディスクに触れない。壊れたファイルのエラーも描くときに出る）、data URI として SVG の中に入れる。SVG 1 つで完結し（隣にファイルを置かない・ネットワークに出ない）、`--html`、ラスタ（resvg）、段階表示の各ファイルでも同じ絵が出る。

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
svg-diagram icons sets                          # 用途別のおすすめセット（accounting / office / infra）
svg-diagram icons add-set accounting            # セットを 1 コマンドで入れる（すべて mdi。ライセンス・出典は add と同じ扱い）
svg-diagram icons list                          # 名前・出典・ライセンス
svg-diagram icons remove logo
svg-diagram icons notice                        # 入れたアイコンのクレジットを Markdown で
```

- **`icons find <英単語>...`**: 検索結果から、ライセンスと形が合うものだけを残し、**プロジェクトの主セットを先頭**に出す（`--style fill|line|color`、`--set mdi,lucide`、`--limit N`）。各候補に `icons add` の行が付く。`--png sheet.png` で、`box({icon})` で描いた候補の一覧画像を作る（主セットの枠は色つき）。日本語は英語に直して渡す（Iconify の検索は英語。`svg-diagram` スキルがその手順を持つ）。
- **書き込み先**: `add` / `add-set` / `remove` は、書いた `svg-diagram.icons.json` の絶対パスを毎回出す（親ディレクトリのファイルを遡って書いたときは、その旨も付く）。形式エラーには最小の正しい例 `{"version": 1, "icons": {}}` が付く（空の `{}` は不可）。
- **用途別セット**: `icons sets` で一覧、`icons add-set <名前>` で入れる。`accounting`（領収書・請求書・銀行・承認・印鑑・財布・硬貨・電卓・契約書など 61 個）、`office`（人・会議・文書・メール・予定など）、`infra`（サーバー・DB・ネットワーク・クラウド・コンテナ・監視など）。名前は図のソースでそのまま使う（`box({icon: 'receipt'})`）。すでに入っている名前は上書きしない（自分で入れたアイコンはそのまま）。一覧は `lib/icon-sets.ts`（Iconify の id と短い名前の表）。
- **名前がセットに無いとき**: 既定では、無い名前を**全部まとめて**報告して何も入れない（1 つの綴り違いで他が隠れない）。`icons add ... --skip-missing` なら、あるものだけ入れて、無かった名前を「飛ばした」と一覧する（ライセンス・形式のエラーは従来どおり中断。どれも無かったときは何も書かず終了コード 1。全部飛ばされたセットは主セットにならない）。
- **並行実行**: `icons add` / `remove` / `add-pack` / `main` は `svg-diagram.icons.json.lock` で排他し、一時ファイル + rename で書く。複数のプロセスから同時に実行しても更新は失われない（落ちたプロセスのロックは自動で引き継ぐ）。
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
| 置ける場所 | 箱の左端（32px）・swimlane の step・table のセル・状態・sankey のノード・bpmn のタスク・sequence の参加者。文字列の中には置けない | タイトル・本文・ラベルなど文字列の中 |
| 見た目 | 入れたセットのとおり（固定）。色は `iconTone`（text / accent / muted / danger）で、spotlight で薄くする箱は muted | 環境の絵文字フォント（Noto Color Emoji / Segoe UI Emoji）で変わる。色は色トークンの外 |
| 数 | プロジェクトが入れた分 | 18（`EMOJI_RE` の範囲内でフォントに実在するものだけ。U+FE0F が要る ⚠️ ⚙️ ☁️ ✅ は無い） |

- **アイコンを付けられる場所**: `box({icon})`（箱の左端 32px、`iconAt: 'top'` で上）と `iconRow()` / `node()`、**swimlane の step**（`{lane, title, icon}`。box の項目はそのまま効く）、**table のセル**（`cell('鍵', {icon: 'key', iconTone?})`。文字の前に 18px。文字が無ければアイコンだけが中身で `role="img"`）、**stateDiagram の状態**（`{id, label, icon}`。ラベルの上に 24px、box も circle も）、**sankey のノード**（`{id, icon}`。ラベルの前に 1 行の高さで）、**bpmn のタスク**（`{id, lane, label, icon, iconTone?}`。ラベルの上に 20px、タスクがその分（24px）高くなる。イベント・ゲートウェイには付けられず throw。`fit: 'shrink'` はそのまま効く）、**sequence の参加者**（`{id, label, icon, iconTone?}`。ヘッダーのラベルの上に 20px。ヘッダーは全員同じ高さのまま、アイコンの無い参加者のラベルは余白の中央）。bpmn のタスクと sequence の参加者はラベルが必須なので、アイコンは常に装飾（`aria-hidden`）。入っていない名前はどこでも入れ方つきで throw する。
- **`step` と `icon` は併用できる**: 左からアイコン、丸番号、タイトルの順（`iconAt: 'top'` ならアイコンは上、番号はタイトルの左）。
- `iconRow()` のラベルは、アイコン（32px）の高さの中央に揃う（箱の上寄せで下に余白が出ない）。
- 絵記号は記憶には効くが、理解や検索には効きにくい。**核心の数枚だけ**に使い、全部の箱には付けない。
- アイコンだけで意味を伝えない。`box({icon})` は `title` を併記する（title があるとアイコンは `aria-hidden`、title が無いと `role="img"` と名前を持つ）。`iconRow()` は label が必須。
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
- PNG のプレビュー（既定の resvg）でも、曲がる線の矢じりは線の向きに合う（resvg は `orient="auto-start-reverse"` の終端マーカーを曲がり角で横に向けるので、描くときだけ `auto` のマーカーと、始端用の 180° 回した複製に置き換える。SVG 自体は変えない）。

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
**ダークモードに追従する（`appearance: 'auto'`）**: 1 枚の SVG が、埋め込み先の `prefers-color-scheme` に追従する。図は明るい色で描かれ（背景の矩形も）、`<style>` の末尾に `@media (prefers-color-scheme: dark)` を 1 ブロック足して、**図が実際に使っている色だけ**を暗い版に替える（`svg[data-appearance="auto"] [fill="#ffffff" i] { fill: … }` の形。CSS 変数は使わない）。ルートは `data-appearance="auto"`。`transparent: true` なら背景の矩形が無く、埋め込み先の色に重なる。deck や `inlineSvg` に入れても、規則は自分の図に閉じる。`auto` を使わない図の出力は変わらない。
- SVG だけ。`--html` / `html: true` との併用は throw（`'dark'` を使う）。`build --dark` は `'auto'` も `'dark'` に上書きする。
- `<img src>` の追従は、ページの `class="dark"` ではなく OS / ブラウザの設定に従う。Slidev の `html.dark` に追従させたいときは `<object>` かインライン SVG にする（それでも判定は `prefers-color-scheme`）。
- `preview` / `show` / PNG（resvg）は明るい側で描かれる（resvg は `@media (prefers-color-scheme)` を評価しない）。
- **検査は明暗の 2 回**: `check`（`verifyDiagram` と `lintDiagram`）と `lint-svg`（既定の geometry でも `--engine browser` でも）は、明るい配色と暗い配色の両方で検査する。暗い側にだけ出た指摘は末尾に ` (暗い配色)` が付く（`lint-svg` は `file (暗い配色)`）。許す色も側ごとで、明側に暗い色が混ざると `off-token-color`。`transparent: true` の `auto` は、明るい側は白、暗い側は暗い版の背景の上に置かれたものとして検査する。

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

### 章の頭の 1 枚

`hero()` は、章の頭に置く「大きな数字 + それを生む流れ + 一言」を 1 回で書く糖衣構文。新しいレイアウト規則は持たない（`banner()`、`row({arrows: 'between'})`、`stat()`、`caption()` を並べるだけ）。

```ts
hero({
  banner: {headline: '承認の待ち時間が 3 日から 1 日に縮んだ', tone: 'accent'},
  stat: {value: '-67%', label: '承認の待ち時間', tone: 'accent'},
  flow: [box({title: '申請'}), box({title: '一次承認'}), box({title: '決裁'})],
  caption: '差し戻しの往復をなくしたのが効いた',
  note: '出典: 社内調査(2026 年上期)',
})
```

- `flow` は `box()` だけ（`id` は `connect()` の端点になる）。`layout: 'side'`（箱が 4 つ以下の既定）は、箱の列の最後に数字を置き、矢印で「流れの行き着く先」として結ぶ。`'stack'`（5 つ以上の既定）は、数字の行を箱の列の上に置く。
- `stat` は `stat()` の `value` / `label` / `tone` / `size`（既定 `'display'`）/ `id`。`banner` は `banner()` の引数そのまま。`caption` は太字、`note` は薄い 1 行。どれも省ける（`stat` と `flow` は必須）。
- 例は `examples/hero.ts`。

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

- **children と接続線**: `children` は箱 1 つでも配列でもよい（配列は縦に積む。`direction: 'row'` で横に等幅で並べる）。接続線は左右の枠の中央から共通部へ垂直に降り（以前は共通部の 1/4・3/4 に向かい、数 px 斜めだった）、ラベルは線の右に置く。`connectArrow: 'none'` で矢頭なし。`row()` の子には `box()` / `group()` のほか `caption()` / `banner()` などの帯も置ける（枠なしの `group()` に自動で包まれる）。
- **PNG の矢頭**: `svg-diagram preview` などの PNG（resvg）は、矢頭を線の向きに回して描く（以前は向きを無視して、下向きの線でも右向きに描いていた）。縦の直線に付けた（chip でない）ラベルは、線に貫かれないよう線の右に置く。
- **帯と幅がそろう**: 枠の右端は、帯と同じ位置で 4px の格子に丸める（以前は幅だけを丸めていたので、`versus()` の右の枠が帯より最大 4px はみ出すことがあった）。
- `group()` に `gap` は無い（書くと throw）。箱の間は、入っている `row([...], {gap})`、帯の間は `diagram({gap})`。グループを並べた行の `gap` はそのまま効く。
- **12 列の行**: `row([a, b], {cols: [6, 6]})`（子ごとの幅だけを並べる。`col` を手で数えない）。`span` を各子に書く形では、`col` は前の子の次の列から自動で進む。`cols` を指定した行は、ラベルつきの接続線のために隙間が広がるとき、**同じ `cols` と `gap` の行すべて**で広がり、列の縁はそろったまま。
- **`cols: 12` だけで子に `span` / `col` を書かない行**は、子が 12/n 列ずつを等分する（余りは前の子から 1 列ずつ。3 個なら 4+4+4）。以前は 1 列幅ずつになり、名前が縦に折れた。列をそろえたいときは、子に `span`（`span: 1` でもよい）か `col` を書く。
- **別の行の N 列目へ矢印をつなぐ**: `const top = row([...], {cols: 12, id: 'top'})` のあと `connect(a.bottom, top.col(5).top)`、`top.col(5, 6)` は 5〜6 列。`cols` のない行では N 番目の子。列の中の箱は、その端点の一部とみなされ、線が通っても重なりの警告にならない。
- **接続線の既定値**: `diagram({connectDefaults: {chip: true, route: 'elbow'}})` と `d.connect(from, to, {label})`（`d.add(connect(...))` と同じ。`chip` は `label` のある線だけに効く。線ごとに指定した値が優先）。
- **ワイヤーフレームの外枠**: `diagram({wireframeDefaults: {appbar: {title, nav, right}, h, frame}})` で、全画面の上にナビが付く。画面ごとに `wireframe(root, {shell: {active: '在庫'}})`（`shell: false` で外枠なし）。構造が違うときは `shell: (content, props) => ...` で包み方を渡す。`screens()` の項目も同じ。
- **状態の一覧**: `stateRow(ラベル, 部品を作る関数, {状態: 差分 | 'loading' | 'na' | {na: 理由} | undefined}, {base, note})`。状態の漏れは型エラー。
- **表の記号セル**: `cell('通る', {mark: 'ok' | 'mid' | 'ng' | 'best'})`（○ △ × ◎ + 文字）。

新部品は「同じパターンが 3 回出たら」が原則だが、ユーザーが明示したときは例外。
既存の `day:` 図の出力が変わらないこと（回帰）を確認してから足す。

### スライド 1 枚のキャンバス（`canvas`）

`diagram({canvas: 'slide'})` は、スライド 1 枚ぶんの図を **16:9（1280×720）で、拡大縮小なしに** 描く。文字は、最小のもの（既定の 14px の role・矢印のラベル・タグ）が 24px になる倍率（1.72 倍）で全体を拡大し、余白・間隔も同じ倍率にする。高さは 720px に固定で、内容が足りなければ下を空ける。`{canvas: {width, height, minText}}` で寸法と最小文字を変えられる（`minText: 30` なら 30px 以上）。

**文字の下限を 14px 未満に下げる（`minText` と `fontFloor`）**: 投影しない、手元・配布用の稠密な `canvas` の図（キャンバスを 1:1 で読む）に限り、`diagram({canvas: {width: 2304, height: 1296, minText: 10}})` のように `minText` を 14 未満（**最小 10**）にできる。10 未満・有限でない値・数でない値は throw する（`canvas.minText must be a number >= 10`）。これは `slide` / `fill` の「実効 12px」（縮小後の文字の下限）とは**別の層**で、`canvas` の図の、キャンバスの単位での下限である。下げるには、案件の `.svg-diagram.json` が許可する必要がある（「共通設定」の `fontFloor`）。許可がない案件では、図の `minText` が 14 未満だと throw する（`canvas: {minText: 10} is below the project's fontFloor (14). Lower "fontFloor" in .svg-diagram.json (10 at the lowest) or raise minText`）。下げた図は、出力の SVG のルートに `data-min-text="10"` が付く（`minText` が 14 以上の図、`canvas: 'slide'`、`canvas` なしの図は 1 バイトも変わらない）。`lint-svg` はこれを `font-size-too-small` の床として読む。`check` は `font-floor-lowered`（info）で知らせ、`build` は 1 行出す。縮めて見せるキャンバスの換算（2304 幅を 1280 に縮めて見せるなら、実効 10px は `minText` 約 18）は著者が行う。

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
| `quadrant` の band | opts の `reveal` / `until`（項目・矢印は図と一緒。項目単位の reveal はない。項目の id は図の段階で `connect` に出る） |
| `chevron` / `funnel` / `cycle` / `venn` / `concentric` / `emblem` の band | opts の `reveal` / `until`（各項目の id は図と同じ段階で `connect` に出る） |
| `wordart` の band | opts の `reveal` / `until`（`id` は図と同じ段階で `connect` に出る） |
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

## 数式

`math(tex, opts)` は TeX の数式を 1 つの部品として置く。MathJax（tex → svg、ブラウザ不要）が式を**輪郭（`<path>`）**に変換するので、SVG は自己完結で、フォントがなくても、`<img>` でも、どのビューアでも同じ見た目になる（`<text>` も `<foreignObject>` も使わない）。変換は `math()` を呼んだときに 1 回だけで、MathJax は最初の `math()` で読み込まれる（数式のない図は読み込まない）。

```ts
math(String.raw`\int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}`, {role: 'stat', alt: 'e の -x 二乗乗を全実数で積分すると √π'})
```

- **日本語は `\text{…}` の中に書く**: 分数の分子・分母、上付き・下付きにも使える（`String.raw`\frac{\text{効果額}-\text{研修費用}}{\text{研修費用}}\times 100``、`(1+r)^{\text{経過年数}}`）。日本語の語は輪郭でなく `<text>`（1 語 1 要素、文字の大きさは `role` のまま、`textLength` で幅を 1 字 = 1 em に固定）で描くので、フォントが違っても式の幅は変わらず、`diff --text` / `check --covers` / `--fidelity` は語として読める。書体は図の他の文字と同じ。上付きは約 70% の大きさになる（TeX の標準）。半角の英数字は MathJax の字形（輪郭）のまま。ADR 0040。
- バックスラッシュが残るよう **`String.raw`** で書く。`\frac` `\sqrt` `\sum` `\mathbf` `\begin{pmatrix}` など MathJax の標準パッケージ一式が使える。
- 大きさは文字の `role`（既定 `'body'`。`'banner'` `'stat'` `'display'` など）で決まり、`fill` モードでは他の文字と一緒に拡大される。段落中の式のように分数や和の添え字を小さく組むときは `inline: true`。
- `align`（`'center'` 既定 / `'left'` / `'right'`）、`tone`（`'text'` 既定 / `'accent'` / `'muted'` / `'danger'`）、`id`（`connect` の端点にできる）。`reveal` は付けられない。
- 使えない TeX は throw する: 読めない式（閉じていない `{`、未定義のコマンド）、絵文字など MathJax のフォントになく幅を決められない文字（日本語は `\text{…}` に書ける: 下）、式番号と相互参照（`\tag` `\ref` `\eqref`。同じく caption で。`\label` は無視される）、列より幅が広い式。式は赤字で図に残らない。`fill` モードでは、列に収まる範囲までしか拡大しない（`canvas` は倍率が決まっているので、収まらなければ throw する）。
- 許可リスト方式のパッケージだけが使える。`\href` `\style` `\class`（属性を図に直接書き込む）、`\color` `\textcolor` `\bbox` `\mmlToken` の色（テーマ・暗色・spotlight に追従しない）、`\unicode` は使えない。出力に属性・リンク・独自の色が混じる式（`\rule` を含む）や、MathJax のフォントにない字（`\upalpha` など）は throw する。色は `tone` で付ける。
- `\def` `\newcommand` は、その `math()` の中だけで効く（次の式にも別の図にも漏れない）。
- MathJax は任意の peer 依存。数式を使う案件で `pnpm add mathjax-full` する（初回の変換に数秒かかる）。
- `alt` の既定は TeX のソースそのもの。読み上げ向けに言葉で書くのが望ましい（`examples/math-formula.ts`）。

## 文書と図の整合（`check --docs`）
`svg-diagram check --docs docs --svg-dir docs/assets/diagrams/svg --src-dir docs/diagrams` は、Markdown の画像参照と、図のソースを突き合わせる。
- 参照先の SVG がない（`doc-image-missing`、エラー）、代替テキストが空・155 文字超（`doc-alt-empty` / `doc-alt-long`）、どの文書からも参照されていない SVG（`doc-orphan-svg`）、参照されている SVG に対応する図のソースがない（`doc-svg-no-source`。ソースを消して SVG だけ残った静的な絵は `--drift` の対象にならず古くなるので、ここで見つける。ソースは `--src-dir`、なければ `./diagrams`、それと SVG の `<metadata>` に記録された生成元から探す。手描きの絵などは `.svg-diagram.json` の `accept` で許容する）。`![alt](images/x.png)` の PNG 参照も見る: ファイルがない（`doc-image-missing`）、同じ名前の図のソース（`--src-dir`）も SVG（`--svg-dir`）もない（`doc-png-no-source`）、参照された PNG と同じフォルダにある、どこからも参照されていない PNG（`doc-orphan-png`。文書を絞ると行わない）。
- **PNG から SVG への置き換え忘れ**（情報 `doc-png-has-svg`、`--verbose`）: PNG を参照しているのに、同名の SVG（PNG の隣、または `--svg-dir`）もあるとき、書き換える参照（`![](../svg/x.svg)`）を示す。PNG が消えて `doc-image-missing` になるときも、同名の SVG があれば同じ案を添える。PNG を残す意図（EPUB 用など）なら `accept` で許容する。書き換えは手か、`sed` で。
- 図に `notes` があるとき、画像の直後の**番号つきリスト**（`1. **題名**：本文`）と、題名・本文が一致するか（`doc-notes-mismatch` / `doc-notes-missing`）。図と文書の**二重管理**で、片方の直し忘れを見つける。
- **図番号と本文**（警告）: キャプション `図N-M`（代替テキスト、または画像の前後の行の**行頭**）が章内で 1 から連番か・重複や順序の入れ替えがないか・章番号がファイル名の章（`03-x.md` / `ch3.md`）と合うか（`doc-fig-number`）、本文の `図N-M` が、この文書にない図を指していないか（`doc-fig-ref-missing`。別の章への参照とコードブロックは見ない）、代替テキストが `image` / `図` / ファイル名のままでないか（`doc-alt-placeholder`。空は従来どおり `doc-alt-empty`）、図の下の注釈の番号が 1 から順か（`doc-notes-number`）。
- **一章だけ検査する**: `--docs` は**ディレクトリでも .md ファイルでもよく、何度でも**書ける（`--docs A.md B.md dir` のように空白で並べてもよい。後ろの .md とディレクトリはすべて文書で、図のソースではない。.ts / .mjs 以外をソースに渡すと分かるエラーで終わる）。`--only 'docs/03-*.md'`（繰り返し可。`**` はフォルダをまたぎ、`*` `?` は 1 階層内。カレントからの相対パスかファイル名に合わせる）で、対象のページを絞る。**絞ったとき（.md 指定または `--only`）は、孤立 SVG（`doc-orphan-svg`）の検査をしない**（全ページを見ないと「参照されていない」とは言えないため）。その旨を 1 行出す。全体を見るときは、ディレクトリだけを指定する。
- `--map` で、図 / 図のソース / SVG / 使っている文書の**対応表**（Markdown）を標準出力に出す（参照のない SVG は「（参照なし）」）。手で書いた表の代わりに貼る。注釈の文は `svg-diagram notes <ソース>` で出せる（複数の画面に注釈があれば `<!-- 画面 N -->` で区切る）。
- **図に書いた数値・語が本文にあるか**（`--fidelity`、警告 `doc-fidelity-missing`）: 図の `<text>` にある**2 桁以上の数値と英数字の語**が、その図を参照する文書のどこにも書かれていないものを挙げる（`1,240` と `1240`、全角と半角、大文字小文字は同じとみなす。`30` は `300` の一部とみなさない）。`--base REF` を付けると、文書の REF 時点の版に書かれていた語も「書かれている」とみなす（本文を書き直したあとに図だけが古い、を見分けるため）。出版物で「本文にない数値・用語を図に載せない」運用に使う。
- `--format json`（機械可読）、`--format github`（PR の注釈 `::warning file=…,line=…`）。

## ルールの説明・ベースライン・SARIF（`check`）
- **ソースが読み込めない・レイアウトで throw するとき**: `build` と同じ `✗ <ソース>: <メッセージ>` の 1 行（スタックなし。`SVG_DIAGRAM_DEBUG=1` でスタックも出す）を出し、**残りのファイルも検査して**、最後に `N 件中 M 件が検査できなかった` を出す。exit は 1（`--strict` なしでも）。`--format json` では規則名 `build-error` の `error` として `findings` に入り、`--format github` では `::error file=...` になる。`--drift --rebuild` と `--docs --src-dir` の中で読み込めないソースも同じ扱い。
- `svg-diagram check --rules` はルール ID の一覧、`svg-diagram check --explain edge-crossings` は 1 つのルールの意味と、`accept`（案件全体は `.svg-diagram.json`、1 つの図は `diagram({accept})`）の書き方を出す。
- **ベースライン**: 警告が多い案件に段階導入する。`check --write-baseline .svg-diagram.baseline.json diagrams/*.ts` で今ある警告を記録し、以後 `check --strict --baseline .svg-diagram.baseline.json diagrams/*.ts` は、**記録にない新しい警告**だけを失敗にする（記録済みは info になり「ベースライン済み」と添える）。照合はファイル・ルール・メッセージで、行番号は見ない。エラーはベースラインに入らない。
- `--format sarif` は SARIF 2.1.0 を標準出力に出す（GitHub Code Scanning などへ）。
- **つながりの検査**（`graph-orphan-node` / `graph-disconnected`）: 矢印が 3 本以上ある図で、`id` を持つ箱がどの矢印にもつながっていない、または矢印が互いにつながらない 2 つ以上のかたまりに分かれていると警告する（行・列を端にした矢印は、その中の箱を含む）。注記の箱は `id` を付けなければ対象外。意図した形なら `accept` に理由を書く。
- **TOC の図の検査**（`toc-ude-count` / `toc-parts` / `toc-no-desired-result` / `toc-source-has-cause` / `toc-chain-only` / `toc-orphan` / `toc-cycle-undeclared`、NBR・TT・PRT・FRT の `toc-nbr-*` / `toc-tt-unit` / `toc-prt-*` / `toc-obstacle-phrase` / `toc-mirror` / `toc-injection-to-obstacle` / `toc-role-indistinct` / `toc-legend-suggested`）: `causeTree(..., {tree: 'crt' | 'frt' | 'prt' | 'tt' | 'nbr'})` と種類を書いた図だけが対象（書かなければ何も検査しない。`relationDiagram` / `pdpc` は対象外）。`crt` の UDE が 5〜10 個の外（部分図なら `accept` で許容）、`crt` に `root` が無い・`frt` に `injection` か `de` が無い・`frt` に `root` がある、`root`（crt）/ `injection`（frt）/ `precondition` に入る矢印がある、`crt` / `frt` が分岐も合流も AND も無い 1 本鎖、どのリンクにも出てこない実体、`back: true` の戻り・`kind: 'blocks'` を除いた因果の辺に循環が残るのに戻りの矢印に `back: true` が付いていない（`toc-cycle-undeclared`。配置が戻りとして扱った矢印を名指しする）。数える辺は `back` と `kind: 'blocks'` を除く。既定は info（`check --verbose`）で、`diagram({tocCheck: 'strict'})` の図だけ warn（`check --strict` が落ちる）。`layoutCheck` とは別の指定で、描画は変わらない。
  - `nbr`: `toc-nbr-parts`（`trim` か `ude` が無い）、`toc-nbr-no-tipping`（`tipping` を通らずに、原因を持たない実体から `ude` へ至る因果の道がある。たどるのは因果の辺だけで、`blocks` と `back` は通らない）、`toc-nbr-tipping-not-and`（`tipping` が AND の結果でない）、`toc-nbr-trim-too-late`（`trim` の `blocks` が、転換点より結果側を断つ。転換点そのものを断つのは可）。`toc-source-has-cause` は `nbr` の `injection` と `trim` にも効く。
  - `tt`: `toc-tt-unit`（AND の結果が、ニーズ（`need` または `precondition`）と行動（`action`）の両方を原因に持たない。OR は単位でないので対象外）。
  - `toc-role-indistinct`（情報）と `toc-legend-suggested`（情報）は、`tree` を書いた図で root / goal / start が見分けにくい・凡例の指定がないときの案内（`roleTags: true`、`legend: 'auto'`）。`check --strict` は落ちない。`legend: false` と書けば後者は出ない。
  - `prt`: `toc-prt-bottom-not-action`（中間目標の鎖の底、つまり入る辺に `io` が無い `io` に、`action` がつながっていない。障害は入る辺の無い節で書くことが多いので、「入る辺が無い節」では見ない）、`toc-prt-one-to-one`（`io` が 2 つ以上で、障害と中間目標が全部 1 対 1 だけ）、`toc-obstacle-phrase`（障害のラベルが「ない」「無い」「不足」で終わる。末尾の句読点・閉じ括弧は除く。**常に info**で、`tocCheck: 'strict'` でも warn にならない。日本語の文末の判定なので偽陽性は `accept` で外す）。
  - `frt` + `mirrors`: `toc-mirror`（`mirrors` の id が UDE でない・UDE に対応する望む結果が無い・同じ UDE を複数が `mirrors` している、の 3 つを 1 つの規則で。部分図は `accept` で理由を書く）。

- **原因分析の図の検査の重大度**（`diagram({rcaCheck: 'strict'})`）: 故障の木・IS/IS NOT・なぜなぜ・ボウタイの検査（ADR 0025 / 0026）を warn にする。既定は info。`tocCheck` / `layoutCheck` とは別に指定でき、絵は変わらない。検査は図ごとに足してある（故障の木・IS/IS NOT・なぜなぜ・ボウタイ。下に規則を並べる）。
  - 故障の木: `fta-gate-one-input`（AND / OR / vote の入力が 1 つ）、`fta-vote-degenerate`（k が 1 か入力の数。OR / AND と同じ）、`fta-top-is-leaf`（頂上にゲートが無い）、`fta-undeveloped-left`（展開していない事象が残っている。常に info）、`fta-single-point`（単独で頂上を起こす事象がある。常に info）。
  - IS/IS NOT 表: `isisnot-no-isnot`（IS NOT が空の行）、`isisnot-no-distinct-at-all`（「違い」が 1 つも無い）、`isisnot-no-hypothesis-stands`（説明できない行が 0 の仮説が無い。常に info）。
  - なぜなぜ分析: `whywhy-no-root`（真因の無い鎖）、`whywhy-measure-without-root`（真因が無いのに対策がある）、`whywhy-single-chain`（鎖が 1 本だけ。常に info）、`whywhy-dig-below-root`（真因の下を掘っている。木のみ・常に info）。
  - ボウタイ図: `bowtie-barrier-missing`（バリアが 1 つも無い脅威・結果）。

## 表記・数値の整合と差分だけの検査（`check`）
- **表記の揺れ**（`term-variant`）: 1 つの図の中で、同じ語が `ユーザ` / `ユーザー`（末尾の長音）や `API` / `Api`（大文字・大小混在）のように揺れていると警告する。`Server` と `server` のような文頭の大文字だけの差、数字や `-` `_` を含む ID は見ない。
- **用語集**（`term-avoid`）: `.svg-diagram.json`（または `diagram({terms})`）に `"terms": {"ユーザー": ["利用者", "ユザー"]}` と書くと、右の語が図に出たとき「ユーザーに統一」と警告する（用語集が決めている揺れは `term-variant` で二重に出さない）。
- **表の合計**（`table-sum-mismatch`）: 表の「合計」「小計」「計」の行・列が、並ぶ値の和と合わないと警告する（小計をはさんだ合計、`%` の丸めは許す）。`table-share-not-100`: 「構成比」「割合」の列が、合計行なしで 100% にならないとき。
- **`--changed[=REF]`**: 図のソースと一緒に使うと、変わったものだけを検査する。ソース自身・`import` しているファイル・（`--drift` のとき）コミット済みの SVG のどれかが、作業ツリーと REF 以降のコミットで変わったもの。REF の既定は `origin/main`（なければ `main`）との共通祖先で、`.svg-diagram.json` が変わったときは全部を検査する。変わったものがなければ何も検査せず終了コード 0。編集中の速い確認と、図が多い案件の PR の検査に。

## 表と図の突き合わせ（`check --covers`）
`svg-diagram check --covers table.md --svg-dir svg diagrams/flow.ts` は、本文の Markdown 表（または CSV）を図に置き換えたとき、表のセルの文字列が図の `<text>` に残っているかを調べ、欠けたセルを `covers-missing`（警告）で一覧する。
- 全角/半角・大文字小文字・空白・句読点・桁区切りの違いは無視する（`ＡＢＣ１２３` = `abc123`、`1,200 円` = `1200円`）。
- 数値は数値として比べる（`30` は `300` の一部とみなさない。`3.5` と `35` は別）。
- Markdown は見出し行と `|---|` の行がある GFM の表を読む（外側の `|` は省略可、コードブロックの中は読まない）。CSV は引用符の中のカンマ・改行・`""` を扱う。表が見つからなければ終了コード 2。
- セルがそのまま見つからなければ、固有名詞と数値のトークン（英単語、カタカナ語、漢字 2 字以上の語、数値）で判定し、欠けたトークンを示す。ひらがなの助詞や言い換えでは警告しない。
- ソース（`.ts`）は、`--svg-dir`（既定 `./svg`）の生成済み SVG を読む。`.svg` を直接渡してもよい。

## 図の違いの説明（`--rebuild`、`diff`）
### ズレ検査を速くする（`check --drift --rebuild`: 並列とキャッシュ、ADR 0038）

数百枚の図でも待たないように、`--rebuild` は次の 2 つをする。出力は、どちらも使わない場合（`--jobs 1 --no-cache`）と 1 文字も変わらず、引数の順に並ぶ。
- **並列**: 子プロセスに図を配る（`--jobs N`。指定しなければ、空いているコアの数（最大 8）で、1 つの子に 8 枚以上が回る数まで。小さい図が多いと子の起動（約 2 秒）のほうが高くつくため。足りなければ順番に処理する。`1` でも順番）。時間のほとんどは配置と経路探索（`layered-route` / `polyline-metrics` / `graph-layout` で計った時間の約半分）で、1 つの関数が支配していないので、プロセスを増やすのが効く。
- **キャッシュ**: 再生成がコミット済みの SVG と一致した（成功した）ときだけ、`./.svg-diagram-cache/`（`--cache-dir DIR` で変更。中身は `.gitignore` で自分を除外）に残す。次の実行で、鍵と、ビルドが読んだファイルがすべて同じなら、再生成を飛ばす。**鍵**: ソースと import 先の内容、コミット済みの SVG（と reveal）の内容、`<metadata>`、ツール自身のコード（`lib/` 全体）と依存パッケージ・Node の版、解決した `.svg-diagram.json`、`fc-list` のフォント一覧と `SVG_DIAGRAM_*` 環境変数。**ビルドが読んだファイル**: 絵、アイコンの定義、フォントなど、鍵に入らないものは、読んだ内容のハッシュと「あるか」を記録し、1 つでも違えば飛ばさずに再生成する。失敗はキャッシュしない。`import()` を変数で組む図と Chromium 計測（`SVG_DIAGRAM_MEASURE=chromium`）はキャッシュしない。**飛ばしたくないとき**は `--no-cache`（CI で毎回確かめるなど）。

`check --drift --rebuild` は、再生成した SVG が違うとき、**何が変わったか**を示す（メタデータのみ / 不可視の下地 / 文字の移動 / 図形の増減 / キャンバスの大きさ）。
「見た目は変わらない。再生成してよい」か「見た目が変わる。再生成して、目で確かめる」かが分かる。`<metadata>` に残した `today`（`gantt` の `today: 'auto'`）と `noSourceLine`（`build --no-source-line`）も読んで、同じ条件で作り直す。`pnpm golden` は、`examples/out/` の SVG が、今のコードの再生成と一致するかを調べる。

## 日本語の折り返し（`diagram({wrap})`）
ラベルは文節に近い単位で折り返す（既定 `wrap: 'phrase'`）。**カタカナの連続**と**漢字の連続**は 1 語として扱い、「アプリ」が「ア / プ / リ」に割れない。英数字の連続は以前から割らない。禁則（行頭に句読点・小書きかな、行末に開き括弧を置かない）はそのまま。語が 1 行より長いときだけ、その語を 1 文字ずつ折る。従来どおり 1 文字ごとに折るなら `diagram({wrap: 'char'})`。外部の分かち書きライブラリは使わず、文字種で決める簡易な方式（ひらがなの中の助詞では切らない）。`'phrase'` と `'char'` は辞書を持たず、`'bunsetsu'` も形態素解析（`Intl.Segmenter`）は使わない（ICU の版で切れ目が変わり、出力が環境で変わるため）。

日本語の長い文を**文節で**折るなら `diagram({wrap: 'bunsetsu'})`。ひらがなは直前の文字（漢字・カタカナ・英数字・ひらがな）に付き、折るのは「ひらがなの直後で、次がひらがな以外（漢字・カタカナ・英数字・記号）」のときと、`、` `。` の後だけ（「評価されるため / 仕掛りが」）。禁則・1 文字だけの最終行の直し・単位が 1 行より長いときの文字ごとの折り返しは `'phrase'` と同じ。`tree` / `mindmap` / `causeTree` / `stateDiagram` などの箱は、最も長い単位に合わせて広がる（`maxNodeW` の 1.5 倍まで。`maxNodeW` は語を割らない範囲での目安になる）。`wrap` は図全体の指定で、帯ごとには変えられない。既定は `'phrase'` のまま。

**カタカナの語を割らない（`keepWords`）**: 箱が最長の語より狭いと、`phrase` でも「コンテキス/ト」と割れる（語が 1 行より広いと、文字単位に戻すため）。`diagram({keepWords: true})`（`.svg-diagram.json` の `"keepWords": true` で案件全体にも書ける）は、箱を**最長のカタカナの語より狭くしない**（内側の幅で 240px まで。それより長い語は割れる）。`causeTree` / `tree` / `mindmap` / `faultTree` / `stateDiagram`（円のノードを除く）/ `bpmn` の task に効く。`cloud`、枠が先に決まる `chevron` / `cycle` / `swimlane` には効かない。`maxNodeW` を書いた図にも効く。幅に収まらないときは、語を守る試行（狭める → 折る）を先に全部試し、それでも収まらなければ、語を守らない試行（従来と同じ）に戻る（割れは `text-mid-word-break` が報告する）。既定は off で、書かなければ何も変わらない。

**文節で折る、収まらなければ従来に戻る（`wrap: 'bunsetsu-soft'`）**: 狭い箱で「確/かめられる」「育てら/れる」のように、ひらがなの手前で行が割れるのは、`wrap: 'bunsetsu'`（ひらがなを直前の文字に付けて、文節で折る）で防げる。ただし文節の単位は長いので、密な図は 940px に収まらず build が止まる。`'bunsetsu-soft'` は、まず `bunsetsu` で配置し、**収まらない図だけ**従来の折り方（`phrase`）で配置する（止まらない。`check` が情報 `wrap-fell-back` で、従来の折り方にしたことを知らせる。図を 2 枚に分ける・文言を短くすると文節で折れる）。`.svg-diagram.json` の `"wrap": "bunsetsu-soft"` で案件全体に効く（図の `wrap` が優先）。図の中に収まらない帯が 1 つでもあると、その図は全体が `phrase` になる。

### 画像（PNG）を図に置き換えるとき: 原画の語が残っているか

`check --covers` は表だけでなく、**1 行 1 語の CSV** も受け付ける。PNG の原画を画像が読めるエージェント（または人）が読み、見えた語を 1 行 1 語の CSV に書き出して、新しい図と突き合わせる。

```
# 原画の語（崩れた字は見えたまま書く。そのほうが差が出る）
echo '効果額' > words.csv; echo '研修費用' >> words.csv
svg-diagram check --covers words.csv --svg-dir svg diagrams/formula.ts
```

欠けた語は `covers-missing`（警告）で出る。原画の読み間違い（書き起こしの誤字）と、図に書き写し忘れた語は、どちらもここで見つかるので、出た語は原画で見直す。逆向き（図にだけある語）は `diff --text 旧.svg 新.svg` の「追加」で見る。数式（`math()`）の中の日本語も `<text>` なので、語として見つかる。

## 共通設定（`.svg-diagram.json`）
カレントディレクトリから上へたどって見つかる。`{"accept": {"rule-id": "理由"}, "maxWidth": 940}`。図ごとの `accept` が優先される。`maxWidth` も図ごとに `diagram({maxWidth: 1200})` で変えられる（`doc-width` の閾値だけで、図の幅は変えない。広い図にするなら `width: 1200` も書く。図の値が設定ファイルに勝つ）。`accept` のキーはルール ID（`RULE_DOCS` にある名前）で、知らない ID・空の理由はファイル名つきのエラー（綴り違いで何も許容されないのを防ぐ）。許容された指摘は info に下がり、理由が添えられる。

**並列で使うときの注意**: 複数のエージェントが同じディレクトリで動くとき。
- `build` は**引数に書いたソースだけ**を作る（glob の展開は呼び出し側。他の人のソースまで巻き込まないよう、自分のソースだけを書く）。書いたファイルは 1 行ずつ `✓ svg/x.svg (WxH)` で出る。
- `.svg-diagram.json` は、ソースの場所ではなく**カレントディレクトリから上へ**探す。別のディレクトリから走らせると、その図の設定（`accept`・`maxWidth`・`fonts`）が読まれず、結果が揺れる。ディレクトリごとの設定は、そのディレクトリ（または上）に `.svg-diagram.json` を置き、そこへ `cd` して走らせる。
- `typecheck` の一時ファイル（`.svg-diagram-tsconfig.<pid>-<乱数>.json`）は実行ごとに名前が違うので、並列に走らせても互いに消さない。
- `check --drift --rebuild` のキャッシュ（`.svg-diagram-cache/`）は共有してよい（書き込みは rename で原子的）。
- `pkill -f svg-diagram` のような名前での強制終了は、他の人のビルドも止める。止めるなら自分の PID だけ。
- **TOC の `toc-ude-count` / `toc-no-desired-result` は既定で info**（`diagram({tocCheck: 'strict'})` の図だけ警告）なので、章単位の部分図でも `accept` は要らない。出したくなければ、図のディレクトリの `.svg-diagram.json` に `{"accept": {"toc-ude-count": "章単位の部分図"}}` を 1 つ置く。`gray-tone-collision` や `density` を帳票の図でまとめて許容するのも同じ（案件の `.svg-diagram.json` の `accept`）。

**出力先（`outDir`）**: `"outDir": "images"` は、`build` の既定の出力先（`./svg` の代わり。`.svg-diagram.json` のあるフォルダからの相対）で、`lint`（引数なし）と `check --drift` が SVG を探す先でもある。`--out` / `--out-dir` が優先される。

**`lint` の引数**: `.svg`、引用符つきの glob、図のソース（`.ts`。それが作る SVG を探す）を渡せる。パスはカレントから、なければ上のフォルダから順に探す（リポジトリのルートからのパスもそのまま通る）。見つからないときは、探した場所を全部出す。ブラウザなしの `--engine geometry` が既定。`--engine browser` でブラウザがないときは、原因と `--engine geometry` への切り替えを案内する。

**`check` が図として扱わないもの**: 先頭が `_` のファイル（共通部品）と、default export の関数がない `.ts` は、失敗にせず info で飛ばす。

**今日の日付（`today`）**: `"today": "2026-10-19"` は、`gantt({today: 'auto'})` の日付になる（`--today` と環境変数 `SVG_DIAGRAM_TODAY` が優先。実在しない日付はファイル名つきのエラー）。「ガントチャート」の節。

**文字の下限（`fontFloor`）**: `"fontFloor": 10` のように、**`diagram({canvas: {minText}})` を 14 未満に下げてよい下限**を案件として許可する（10〜14 の数。既定は 14。範囲外・数でない値はファイル名つきのエラー）。`fontFloor` だけでは図は小さくならない（許可であって、文字を縮める設定ではない）。図の `minText` が `fontFloor ?? 14` 未満だと、描画の時点で throw する（`canvas` の図だけが対象。文書向けの図、`canvas: 'slide'` / `fill`、`size` の直接指定の下限 14 は変わらない）。対象は、投影しない手元・配布用の稠密な `canvas` の図で、`slide` / `fill` の実効 12px とは別の層（「スライド 1 枚のキャンバス」）。`lint-svg` も同じ設定を、SVG のあるディレクトリから探して読む。

**gray-tone-collision と solid × solid-danger**: `solid` は accent、`solid-danger` は danger の色で塗る。danger は全テーマ共通の赤（L* 約 40）、accent はテーマごとに違うので、テーマに依らず明度差を付ける既定色は作れない（danger を変えると danger を使う全図の見た目が変わる）。出たら `diagram({tones: {'solid-danger': {fill: '#7f1d1d'}}})`（案件全体なら `"tones"`）で濃くするか、`accept` で許容する。

**凡例の既定**: `"legend": false`（凡例は要らない）または `"legend": "auto"` を書くと、`diagram({legend})` を書いていない図すべての既定になる（図ごとの指定が優先）。凡例の文言は `"legendLabels": {"tone:accent": "注意", "tone:solid": "結論"}` で案件全体を揃える（図の `legendLabels` がキーごとに優先）。キーは `diagram({legendLabels})` と同じ（知らないキー・`legend` の他の値・空の文言は、ファイル名つきのエラー）。

**トーンの色を上書きする**: `diagram({tones: {accent: {fill: '#e6d3bd'}}})`、または `.svg-diagram.json` の `"tones"`（案件の図すべて。図の `tones` が色ごとに優先）。トーンごとに `fill`（塗り）・`stroke`（枠線）・`text`（その塗りの上の文字。solid / solid-danger の箱の文字、ワイヤーフレームのチップなど）・`ink`（そのトーンを色として使う所: タグ・矢印の線・「そのトーンで書いた文字」）を `#rrggbb` で替えられる。効くのはトーンで色を決める所（箱・バナー・凡例・タグ・矢印・文字・ワイヤーフレーム・画像の札）で、テーマの色をそのまま使う所（グラフ・ガント・年表・スイムレーンのレーン名・表の題名帯・手順番号）は変わらない。`appearance: 'dark'` の図で使う色は `dark: {fill: '#2a4a70'}` で書く（書かなければ明るい色のまま描かれるので、暗い背景で見えにくいときはコントラストの警告が出る。組み込みの色と同じ明るい色や、2 か所で違う暗い色を付けた明るい色はエラー）。トーン名は `plain` `accent` `danger` `muted` `new` `changed` `removed` `solid` `solid-danger`（`ok` / `warn` / `off` の別名は不可）。知らないトーン名・色のキー・`#rrggbb` でない値はエラーになる。上書きした色は、描画と同じ経路で `a11y-text-contrast` / `a11y-nontext-contrast` / `gray-tone-collision` の検査に入る。例: accent の soft（L* 約 92）が plain の白と近いと言われたとき `{"tones": {"accent": {"fill": "#d7c1a8"}}}` のように濃くして L* の差を 10 以上にする（`new` は塗りも色も別のトーンなので、そろえるなら両方書く）。

**文字幅の測定**: 既定は、文字幅と高さをフォントファイルから読む（`"measure": "font"`。HarfBuzz。kerning・合字込みで、ブラウザは起動しない）。Chromium で測るなら `{"measure": "chromium"}`（または環境変数 `SVG_DIAGRAM_MEASURE=chromium`）。`measure` を書いていないのにフォントが見つからないときは、警告を出して Chromium で測る（`"font"` と書いたのに見つからないときはエラー）。
使うフォントは、`FONT_STACKS` の先頭から見て最初に入っているファミリー（fontconfig の `fc-match` で探す）。ファイルを直接指定するなら（相対パスは、`.svg-diagram.json` のあるフォルダ基準。どこから実行しても同じ） `{"fonts": {"sans": {"regular": "/path/YuGothR.ttc#0", "bold": "/path/YuGothB.ttc#0"}}}`（`#N` は .ttc の何番目か。`mono` `emoji` も同じ）。fontconfig のない環境（macOS など）や、どのマシンでも同じ値にしたいときは指定する。
Chromium の値との差は `test/font-metrics.test.ts` が見る。sans（Yu Gothic）は幅 1px・高さ 1px 以内、mono（Consolas など hinting の効くフォント）は Chromium が advance を整数ピクセルに丸める（切り上げることもある）ため、1 字あたり 1px 以内。例の図 3 つは、どちらの方式でも SVG がバイト単位で同じだった。フォントに無い字は emoji → sans のフォントで測り、どれにも無ければ 1em（全角）か 0.5em。`lint-svg` と `show` と `preview` は引き続き Chromium を使う。

## check のルール（lib/rules.ts）
`legend-missing` / `legend-incomplete`（`legend: 'auto'` で補える。記法が少なく凡例が要らない図は `diagram({legend: false})` で「凡例は要らない」と宣言する。凡例を足すためだけに足さない）、`quadrant-empty-cell`（`quadrant()` に項目のないマスがある。意図した空きは `allowEmpty`）、`a11y-text-contrast`（WCAG 4.5:1）、`a11y-nontext-contrast`（3:1）、
`a11y-no-title`、`box-size-ignored`（警告: `box({size})` は効果がない。大きい文字は `stat()` などの役割で。次の版で throw する）、`source-wraps`（出典行が折り返している）、`connect-label-covers-arrow`（警告: 矢印のラベルが経路の 6 割超を覆い、見える部分が 20px 未満。箱の間隔を広げる・ラベルを短くする）、`glyph-missing`（警告: 絵文字として扱われない絵記号 ✅ ❌ など。字形が無いと空白になる。`icon.emoji()` か SVG アイコンへ）、`text-mid-word-break`（警告: カタカナ・英数字の語の途中で行が割れている。箱を広げる・`maxNodeW` や `dir` を変える・文言を短くする。漢字の途中は対象外）、`stat-fit-shrunk`（情報: `stat()` の値が箱に収まらず、自動で縮めた。`accept` で許容）、`draft-status`（情報: `diagram({status: 'draft'})` のまま。`check --forbid-draft` で warn。`accept` で許容）、`stat-no-source`（`diagram({evidenceCheck})` を書いた図だけ。出典のない `stat()` の数字。info、`'strict'` で warn）、`cjk-line-long`（見出し＝caption の title / display / stat と banner の headline の 1 行が、全角換算で本文幅 600px に収まる字数 — title 40・banner 37・stat 17・display 10 字 — を超える。半角は 0.5 字。目安以内でも、図が狭くて見出しが自動で折り返したときも出す。改行で分けるか短くする）、`a11y-color-only-emphasis`（色だけの強調。`em.b()` を併用する）、`swimlane-lane-order`（レーン間の距離が最小になる順を提案。`fixed: true` のレーンは動かさない）、`swimlane-lanes`（6 本まで）、`rowheader-tone-collides`（表の行ラベルと同じ塗りの行トーン）、`shrink-narrow-text`（`bpmn` / `swimlane` の `fit: 'shrink'` で詰めた結果、task / step の本文が 1 行 2〜3 字ずつ折れている。図を縦向きにする・2 つに分ける・文言を短くする・`maxWidth` を広げる）、`gray-tone-collision`（使っている 2 つのトーンの塗りが、白黒にすると見分けにくい。塗りを CIE L* にして、差が 10 未満なら警告。10 は、紙の白黒印刷で 2 つの平らな灰色が「違う」と読めなくなるあたり。soft（L* 約 93）と plain の白（100）が当たり、solid との組は当たらない。控えめにするトーン（muted / removed）は除く。破線の有無が違う組と、塗りが同じ組（new と accent、changed と plain。色でも塗りでは見分けていない）は除く。canvas() の、ピル（重点・中心など）で言葉にした領域は数えない。`diagram({accept})` で許容できる。`preview --gray` で目でも確かめる）、
`image-large`（埋め込んだ画像が 300 KB 超）、`edge-crossings`、`edge-bends`（情報: 自動配置の図の矢印が 5 回以上折れる、または帯の平均が 3 回超。下の `layoutCheck` の節の隣）、`auto-fit-applied`（`dir` を省略した自動配置の図を、幅に収めるためにレイアウトが変えた。warn。`dir: 'auto'` は info）、`one-story`、`canvas-region-empty`（`canvas({requireAll})` で内容のない領域）、`slide-min-text` / `slide-canvas-overflow`（`diagram({canvas})` の図だけ。上の節）、`font-floor-lowered`（情報: `canvas.minText` が 14 未満の図。「文字の下限を 14px から Npx に下げている（最小の文字 Mpx）。キャンバスは 1:1 で読まれる前提。投影には向かない」。`accept` で理由つきの info のまま許容できる）、`doc-width`（940px 以下。`maxWidth` で変更。図ごとは `diagram({maxWidth})`）、`density`、`arrow-labels`（情報: 矢印の一部にだけラベルがある。全部ラベルなしの図は「依存・次」を示す約束とみなして指摘しない）、`wf-callout-order`（情報: 図の番号が読む順でない。次の番号が、下の行か右の列にあれば順どおり。上かつ左へ戻るときだけ指摘）。案件全体で許容するなら `.svg-diagram.json` の `accept` に理由を書く（図ごとの `accept` が優先）。
`lint-svg`（描画後の検査: コントラスト・キャンバスのはみ出し・文字の重なり・枠からのはみ出し・図形が文字に被る）は、SVG の幾何と文字の箱（レイアウトと同じフォントファイル）から調べる。`--engine browser` は同じ検査を実ブラウザで行う（`test/svg-lint-browser.test.ts` が両方を同じ SVG に当てて比べる。丸めの境界で 1px 違うことと、回転したグループの中のコントラストの比べ方（ブラウザ版は文字と図形を別々の座標系で比べていた）だけが違う）。
`lint-svg` の文字の下限（`font-size-too-small`）は 14px。ただし図のルートに `data-min-text="N"`（`canvas.minText` を 14 未満にした図）があれば、それが下限になる（`--fix` も N まで引き上げる）。案件の `fontFloor ?? 14` より小さい値、または 10 以上の数でない値だと、`font-floor-not-permitted`（**エラー**）。許可された図には、失敗に数えない第 3 の階層「お知らせ」に `font-floor-lowered`（`minText Npx(案件の fontFloor M)`）を 1 行出す（`--strict` でも失敗しない）。設定は、cwd ではなく**各 SVG のあるディレクトリから上へ**探し、`--config <path>` で明示できる（`fonts` の設定も同じ設定から読む）。`data-min-text` のない SVG の挙動は変わらない。
描画後の検査は、**後から描かれた図形が文字を覆う、または線が文字を貫く**ものも報告する（意図した重なりは、図形に `data-allow-cover`）。
残す警告は `diagram({accept: {'rule-id': '理由'}})`。`theme:` の図（文書向け）だけが対象で、`day:` の図（スライド）は従来どおり。

### 整列と余白の指標（`layout-*`、情報）と `diagram({layoutCheck})`

生成した図の整列・余白を測る規則である（`lib/layout-metrics.ts`。描かれる座標＝枠の縁を 4px の格子に丸めた後の値で測る）。**既定は情報（`info`）**なので、`check --strict` は落ちない。閾値は原則から固定している（4px の格子、1 行 24px の 2 倍＝48px、40%、50%）。図に合わせて動かさない。並びは同じ row / grid / quadrant（または同じ親の group）の中の同じ種類の枠だけを見る。

| 規則 | 内容 |
|---|---|
| `layout-sibling-size` | 横に並ぶ枠の幅が 1〜4px だけ違う（等分の行で丸めた結果）。直し方は `cols` / `flex` |
| `layout-edge-misalign` | 隣り合う枠の左端・右端・上端が 1〜4px ずれている（0 は一致、5px 以上は別物） |
| `layout-gutter-uneven` | 横に並ぶ 3 枠以上の間隔が 2px 以上不均一 |
| `layout-unused-space` | 枠の中身の下に 48px 以上かつ枠の高さの 40% 以上の空き（行の高さ揃え・canvas の床。stamp の帯は数えない） |
| `layout-figure-offset` | 内容（題・凡例・出典行を除く）の左右の余白が 48px 以上違う（`diagram({canvas})` の図は対象外） |
| `layout-figure-narrow` | 内容の幅が図の幅の 50% 未満。`diagram({width})` で狭められる。細い図（`concentric`・縦の `chevron`・`cycle` など）は `diagram({width: 'fit'})` |
| `layout-align-mixed` | 横に並ぶ箱で `align`（左・中央）が混在 |

木・マインドマップ・層状の自動配置の帯、`raw` / ワイヤーフレーム / `plane` など座標を手で置く帯、画像の上に重ねた部品、枠のない箱は測らない。`flex` / `span` / `width` が違う兄弟は等分ではないので `layout-sibling-size` の対象外。`layout-align-mixed` は書き手が `align` を書いた箱だけを見る。`layout-figure-*` の内容の範囲は、題・凡例・出典行（caption と legend）を除いた全部の帯。`check --format json` の各所見には、`data: {band, measured, threshold, fix}`（測った値・閾値・直し方）が付く（text の出力は 1 行のまま）。

**この図だけ warn にする**には `diagram({layoutCheck: 'strict'})`（既定は `'info'`。他の値は throw）。その図の `layout-*` と `edge-bends`（矢印の折れ。上の「折れの少ない配置」）が警告になり、`check --strict` が落ちる。描画（SVG）は 1 バイトも変わらない。意図した所見は規則ごとに理由つきで許容できる。

```ts
diagram({
  theme: 'blue',
  layoutCheck: 'strict',
  accept: {'layout-align-mixed': '数字の札は中央、説明の札は左（意図）'},
})
```

`layoutCheck: 'strict'` は文書向けの図（`theme:`）だけで使える。スライド向け（`day:`）の図は `density` 以外の規則を検査しないので、警告にならないまま素通りしないよう throw する。

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
| 14px 未満の文字 | `font-size N is below the 14px floor` | `size` は 14〜72 の整数のリテラル型（`MIN_FONT_SIZE` から導出） | 下限を下げるのは `canvas` の `minText`（案件の `fontFloor` が許すときだけ。「スライド 1 枚のキャンバス」） |
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

## 意味付き表（RACI / FMEA / QFD / カスタマージャーニー）

`table()` と同じレイアウト・段階表示・ハンドルを使いながら、セルの値を検証し、集計値と意味のある印を自動で付ける。どれも `{title, width, dense, id, reveal, until}` を受ける。

| 部品 | 入力と自動処理 |
|---|---|
| `raci(tasks, roles, assignments, opts)` | 行ごとの `R` / `A` / `C` / `I`（`A/R` も可）。各タスクは A がちょうど 1 つ、R が 1 つ以上。A が不要な表だけ `allowNoA: true`。`legend: true` で凡例行。空の役割列は check の警告になる |
| `fmea(rows, opts)` | `{item, mode, effect, cause, action, s, o, d, after?}`。S/O/D は 1〜10 の整数で、RPN = S×O×D を自動計算。`sort: 'rpn'`（降順）、`threshold`（既定 100 以上が danger）/ `midThreshold`（既定その半分以上が accent）で段階、最大の RPN は太字、`after: {s,o,d}` で改善後 RPN。見出しは `labels` で変えられる |
| `isIsNot(rows, opts)` / `isIsNotTests(rows, hypotheses, opts)` | KT 法の IS/IS NOT 表。`rows: {dim, is, isNot, distinct?, change?}[]`（`dim` は `'what'`〔何に〕/ `'where'` / `'when'` / `'extent'`、または自分の見出し）。**違い**（IS と IS NOT の差）と**変化**（その差に関わる最近の変更）は別の列。`isIsNotTests` は仮説ごとに、スペックの行ごとの `'yes'`（説明できる）/ `'ifAssumed'`（仮定すれば。`assumes` に仮定を書く）/ `'no'`（できない）を `results` に並べる。`no` が 0 個の仮説の行は太字、そのうち仮定が最少のものに「最少の仮定」と出る（図が原因を選ぶのではなく、手がかり。`◎○△×` は QFD の ◎ = 9 点と紛れるので使わない）。検査は `isisnot-*`（下の「`check` の規則」） |
| `whyWhyTable(problem, chains, opts)` | なぜなぜ分析の表。`chains: {whys: string[], trueCause?, measure?}[]`（1 鎖 = 1 行）。列は 問題 | なぜ 1…N（最も長い鎖）| 真因 | 対策。同じ原因を共有する鎖は同じ文を繰り返す（表に行の結合は無い）。検査は `whywhy-*`。木で描く `whyWhyTree` は別の関数 |
| `whyWhyTree(problem, whys, {id, maxNodeW, readingNote})` | なぜなぜ分析の木（`causeTree` で描く）。`whys: {why, because?, trueCause?: true, measure?, id?}[]`（`because` は「なぜ?」の答え）。問題を上に、答えを下へ並べ（辺は原因 → 結果で、矢印は問題へ向かう）、**なぜ n は枝が変わっても同じ段**（折り返さない。幅が足りなければ、折り返さずに理由つきで止まる）。真因（`trueCause: true`）は二重枠（役割 `root`）、`measure` は破線の箱で真因を「断つ」辺（棒）で結ぶ。`legend: 'auto'` では「根本原因」「対策」「断つ」が出る（`legendLabels: {'role:root': '真因'}` で言い換える）。返り値は木と、読む向きの 1〜2 行（`.add()` に渡す。`readingNote: false` で外す）。`opts.id` を付けると節は `<id>.problem`（問題）/ `<id>.w1` / `<id>.w1.1` / `<id>.w1.m`（対策）のアンカーになる（型も通る。ただし 1 回の `add()` に展開（`...`）と `connect()` を混ぜると型の追跡が切れるので、`.add(...whyWhyTree(...)).add(connect(...))` のように分けるか、展開せずに `.add(box, tree, connect(...))` と渡す）。付けない図では、自分で `id` を書いた節だけがアンカー（同じ図に 2 つ置いても衝突しない）。段が多いとスライドの高さを超えやすい（スライドなら `whyWhyTable`、または段を減らす）。例は `examples/why-why.ts` |
| `bowtie({hazard?, top, threats, consequences}, {id, maxNodeW})` | ボウタイ図。中央が頂上事象（`top`。制御を失うこと。説明は矩形、結び目の円をその上に添える）で、上に `hazard`（何を制御しているか）。左は `threats: {label, barriers?}[]`（脅威から順に予防バリア）、右は `consequences`（頂上事象から順に低減バリア、最後が結果）。流れはすべて左から右で、矢じりは流れの先に付く。脅威と結果の行数が違うときは少ない側を縦に均等に置く。幅が足りないとき `maxNodeW` を省略すると縮めて警告（`'auto'` なら注、数値なら縮めず止まる）。収まる量の目安は、1 行（脅威 + 予防バリア + 頂上事象 + 低減バリア + 結果）の箱が左右合わせて 6 個ほどまで（既定の幅 900px。箱は 88px、頂上事象は 150px より縮まない）。劣化要因・バリアの種類の印・凡例は未実装。検査は `bowtie-barrier-missing`。例は `examples/bowtie.ts` |
| `qfd(demands, characteristics, relations, opts)` | 要求 `{label, importance}` × 品質特性に `◎`(9) / `○`(3) / `△`(1) / `×`(0)。下段に得点（重要度 × 9 / 3 / 1 / 0 の列合計）と相対 %。単独首位の得点は太字（`highlight: false` で無効） |
| `journeyMap(stages, lanes, opts)` | レーン `{id, label, cells}` をステージ横断で表示。`id: 'emotion'` は数値範囲（既定 -2〜+2）を検証し、行の上側に値と記号（中央より上 ◎、中央 △、下 ×）、その下に折れ線と点を描く。破線は範囲の中央。範囲は `emotionRange: [min, max]` |

```ts
fmea([
  {item: '駆動軸', mode: '摩耗', effect: '停止', cause: '潤滑不足', action: '定期給油', s: 8, o: 5, d: 4,
   after: {s: 8, o: 2, d: 2}},
], {sort: 'rpn', threshold: 100});
```

色は補助で、RACI の文字、FMEA/QFD/感情の数値・記号を常に残す。感情曲線は専用の高さを確保した行の下側だけに描き、上側のスコア文字とは重ならない。

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
| `chart-waterfall.ts` ほか `chart-*.ts` | コンサル系のチャート（ウォーターフォール・レーダー・ヒートマップ・戦略キャンバス・バーンダウン・積み上げ・マリメッコ・ツリーマップ・サンキー・トルネード・ヒストグラム／KDE／ECDF・回帰・クラスタ付きヒートマップ・2次元ヒストグラム／ジョイント／散布図行列・箱ひげ／バイオリン／スウォーム） |
| `raci-project.ts` / `fmea-basic.ts` / `qfd-basic.ts` / `journey-map.ts` | 意味付き表（責任分担、故障リスク、品質機能展開、顧客体験） |
| `semnet-*.ts` | 意味付きネットワーク（PERT、因果ループ、型付き・重み付き依存関係） |
| `emphasis-tiers.ts` | 主役（solid）/ 次点（accent）/ その他（plain）の 3 段階と、凡例の「次点」 |

## Claude Code のスキル
`skills/svg-diagram/SKILL.md` は、Claude Code で図を作る手順（ビルド → 検査 → スクリーンショットで目視 → ズレ検査）をまとめたスキル。
`ln -s "$PWD/skills/svg-diagram" ~/.claude/skills/svg-diagram` で使える。

## ライセンス
MIT

## 開発（TypeScript）

全ソースは TypeScript（`.ts`）。ビルド工程はなく、Node の型ストリップ（Node ≥ 22.18）でそのまま実行する。このため `enum` / `namespace` などの非消去構文は使えない（`erasableSyntaxOnly`）。
型検査は `npx tsc -p .`（`pnpm typecheck`）、`strict: true`。図・画面の型は `lib/types.ts` にまとまっている（`Band`、`WfNode`、`LaidOutDiagram` など）。図のソースを `.ts` で書くと `import {diagram, box} from 'svg-diagram'` にも型が付く（`tsconfig` の `paths` で `lib/dsl.ts` を指す）。
