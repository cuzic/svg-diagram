# ADR 0013: ビルドに失敗したあとの古い SVG と、`check` のエラー整形

- 状態: 提案
- 日付: 2026-10-13
- 基点: `main`(`--html`、`--stale`、`check --drift` まで)
- 関連: ADR 0001(`show` / `preview`), ADR 0008(実装計画の書き方)
- マージ順: 他の ADR(0010〜0012・0016)から独立。**最初にマージする**
- 扱う要望: E1(ビルド失敗後に古い SVG が残る)、E2(`check` のエラー表示と全ファイル継続)

## 背景

図を作る側(現状ツリー、因果ループ図、連関図)から、次の 2 件の要望が届いた。

| ID | 要望 | 提案(要望側) | 優先度 |
|---|---|---|---|
| E1 | `build` に失敗しても直前の SVG が残る。`preview` がその古い絵を出し、直ったと誤解した | 失敗したビルドは既存の出力を削除するか `.stale` の印を付ける。`preview` は SVG がソースより古いと警告する | 高 |
| E2 | `check --strict` がレイアウトの失敗で Node のスタックトレースを数十行出した(`build` は整形される) | `build` と同じ整形にする。複数ファイルのとき、1 つ失敗しても残りを検査してまとめて報告する | 中 |

### 現状(コードを読んで確かめたこと)

**build(`build-diagram.ts`、`lib/dsl.ts` の `finishBuild`)**

- 入力ごとに `try/catch` があり、1 つ失敗しても次へ進む。失敗は `✗ <ソース>: <message>`(スタックなし)で出て、最後に exit 1。ここは既に整形されている。
- 失敗の種類は 5 つ。どれも**既存の SVG には触らない**。
  1. 既定エクスポートが関数でない(`✗ ...: no default export function`)。
  2. `define()` やレイアウトが throw した。
  3. 検証(`verdict.ok` が偽)で `finishBuild` が「SVG を書く前に」throw した。
  4. 出力の XML が壊れている。これも書く前に throw する。
  5. ソースの `import` 自体が throw する(構文エラーなど)。実装時に判明: `build` のループの try の外にあり、ビルド全体がスタックトレースで落ちていた。try の内側に入れて他の失敗と同じ扱いにする。
- 書いたあとに失敗する経路が 1 つある。`--no-lint` なしのとき、全部を書いてから `lint-svg.ts --strict` を 1 回走らせ、通らなければ exit 1。このとき SVG は**新しい内容で書かれたまま**残る。これは古い絵ではない(ソースと一致している)ので E1 の対象外。
- したがって E1 の原因は単純で、1〜4 で失敗すると前回の成功時の SVG がそのまま残る。ビルドログを見落とす(複数ファイルのビルド、`--stale` の「N 件を生成」だけを見る、エディタの保存フックで流れる、など)と、ディスク上には「直ったように見える」ファイルしかない。
- `--stale` という名前は**既にある**。意味は「SVG が今のソース・ツール版・設定・import 先に一致していれば再生成を飛ばす」で、要望の「`.stale` の印」とは別物。印の名前に `stale` を使うと紛らわしい。
- `--watch` は無い(ADR 0001 が「範囲外」としたまま)。編集 → ビルド → `preview` は人またはエージェントが手で回している。だから「失敗を見落とす」ことが起きる。
- 各 SVG は `<metadata id="svg-diagram">` に `source`(ソースのパス、ビルド時のカレントからの相対)、`sourceSha256`、`configSha256`、`depsSha256`、`toolVersion` を持つ(`lib/emit.ts`、`DiagramSource`)。つまり**SVG だけから「どのソースの、どの版から作られたか」が分かる**。`reveal` の段階ファイル(`name.revealN.svg`)も同じ情報を持つ。

**preview(`preview-svg.ts`)と show(`show-diagram.ts`)**

- `preview <in.svg>` は SVG を読んで PNG にするだけ。ソースを見に行かない。成功時に出すのは `wrote <path> (WxH)` だけで、古さの手がかりが無い。
- `show <file.svg>` も同じ。`show <file.ts>` はメモリ上で組み立てて描く(何も書かない)ので、古い絵の問題は起きない。失敗しても描いて exit 1 にする。
- 古さを調べる道具は `check --drift` だけで、見るのは `build` の出力ではなく、人が明示的に呼んだときのみ。

**check(`check-diagram.ts`)**

- ソースごとのループ(`for (const src of sources)`)に `try/catch` が無い。外側は `try { ... } finally { closeMeasurer() }` だけ。
- `loadDiagram`(ソースの import、`define()`)と `checkDiagram`(レイアウト)が throw すると、例外がループを抜けて `finally` のあと未処理例外になり、Node がスタックトレースを出して終了する。**残りのファイルは検査されない**。E2 の症状そのもの。
- `verdict.ok` が偽(検証の失敗)の場合は整形されて `continue` するので問題ない。問題は「throw」の経路だけ。
- 同じ型の穴が `--drift --rebuild`(`loadDiagram` が try の外)、`--docs` の注釈突き合わせ(`loadDiagram`)にもある。
- `--format json|github` でも、例外は結果に載らず落ちる(CI の注釈が出ない)。

## 論点

1. 失敗したビルドは、既存の出力を**削除**するか、**印のファイルを置く**か、**何もしない**か。
2. 「古い」をどう判定するか(mtime か、ハッシュか)。
3. ユーザーが手で置いた SVG、ほかのツールが作った SVG を、巻き込んで消さないか。
4. 警告をどこで出すか(`preview` だけか、`show` と `check` も)。人は PNG を見て、ログを見ないことが多い。
5. `check` の例外をどう整形し、どこまで `build` と揃えるか。

## 決定

### E1-1. 既存の出力は**削除しない**

失敗したビルドは、既存の SVG(と `.html`、`.revealN.svg`)に触らない。今と同じ。理由は代替案の表のとおりで、要点は 2 つ。

- 出力ディレクトリには、人が手で置いた SVG、別のツールが作った SVG、コミット済みでレビューを待つ SVG がある。`build` は `svg/<名前>.svg` という**名前だけ**で出力先を決めるので、同名の手置きファイルを区別できない。消すのは取り返しがつかない。
- Slidev や Markdown が `<img src=svg/foo.svg>` で参照している。保存のたびに打ち間違いで画像が消えると、プレビューが壊れた画像の表示に変わり、本当の原因(ソースの打ち間違い)から目が逸れる。`--watch` 的な運用(今は手動)では特に損。

### E1-2. 古さは**メタデータのハッシュ**で判定する(mtime は使わない)

`preview` と `show <file.svg>` は、SVG の `<metadata id="svg-diagram">` から `source` と `sourceSha256`(と `depsSha256`)を読み、現在のソースのハッシュと比べる。違えば**古い**。

- mtime は信用できない。`git checkout` や CI のキャッシュ復元、`cp` でファイルの時刻は揃ってしまい、ソースのほうが新しく見える(または逆)。ハッシュは `--stale` と `check --drift` が既に使っている判定と同じで、定義が 1 つで済む。
- ソースの場所は、`source`(ビルド時のカレントからの相対)を、(1) 今のカレント、(2) SVG のあるディレクトリの親、(3) `.svg-diagram.json` のあるディレクトリ、の順に探す。見つからなければ**判定しない**(警告も出さない)。メタデータが無い SVG(手置き、他ツール)は**無印のまま**扱う。誤警報で「手置きの SVG が古い」と言わない。
- 再利用: ハッシュ計算は `lib/source-deps.ts` の `depsSha256` と、`build-diagram.ts` にある `sha` / `embeddedSource` を、`lib/freshness.ts`(新規、下の計画)にまとめて、`build`・`check --drift`・`preview`・`show` が同じ関数を使う。

### E1-3. 警告は**画像の中にも**入れる

`preview` が出した PNG は、ログと別に目で見られる。古い場合は、

1. stdout の `wrote ...` の行に ` (古い: ソースが変わっている)` を足す。stderr にも 1 行、理由と直し方(`svg-diagram build <source>`)を出す。
2. PNG の上端に細い赤い帯と「古い: ソースが変わっています」を描く。SVG のファイルは書き換えず、ラスタライズ直前の文字列に帯を差し込む(`--no-stale-banner` で抑止できる。`--gray` と同じ位置のフィルタとして実装する)。
3. exit code は 0 のまま。「失敗」ではなく「注意」。`--require-fresh` を付けたときだけ exit 1(CI やエージェントの自動手順用)。

`show <file.svg>` は 1 と同じ stderr の警告と `--require-fresh` を持つ。sixel の帯は付けない(PNG 出力 `--png` のときだけ 2 を適用する)。

### E1-4. 失敗の印のファイル(`*.svg.failed`)は**見送る**

初稿では、失敗したビルドが出力の隣に `<out>.svg.failed` を書く案を入れていたが、見送る。

- 出力ディレクトリに成果物でないファイルが増える。`svg-diagram init` は `.gitignore` の雛形を作らない(あるのは `node_modules/` と `dist/` などリポジトリ自身の `.gitignore` だけ)ので、利用者の `git status` に出続け、`git add -A` でコミットされうる。Slidev の `public/svg/` に出す構成では dist に配信される。
- `md` サブコマンドなど、`build-diagram.ts` を通らない経路には印が付かず、ばらつく。
- E1-2 / E1-3(ハッシュ判定と帯)だけで、要望の場面(`preview` が古い絵を出して直ったと誤解した)は解決する。印が足すのは「なぜ古いか(ビルド失敗の理由)」だけで、`build` の失敗の表示がその役を既に持つ。
- 代わりに `build` の失敗時の表示を 1 行足す(U2)。**既存の `<out>.svg` のメタデータの `source` が、今ビルドしているソースのパスと一致するとき**(= 自分が作った出力が古いまま残るとき)、`✗` の行の次に `  ⚠ 前回の svg/flow.svg が残っている(ソースと一致しない古い絵)` を出す。「自分の出力か」は **`source` パスの一致だけ**で決める(ハッシュの一致ではない。失敗しているのでハッシュは一致しないのが普通)。出力が無い、メタデータが無い(手置き)、別のソース由来のときは何も足さない。ファイルは書かない。
- **将来**: 失敗の理由を `preview` に出したくなったら、出力ディレクトリの**外**のキャッシュに置く(`node_modules/.cache/svg-diagram/failed.json`、出力の絶対パスをキーにする)。ワークツリーを汚さず、`.gitignore` も要らない。要望が出てから。

### E1-5. 書いたあとの lint 失敗はそのまま

`lint-svg.ts --strict` の失敗は、SVG が新しく書かれたあとの失敗なので、古い絵の問題ではない。挙動は変えない。ただし「`build` が exit 1 でも、新しい SVG はディスクに残る」ことは意外なので、README に 1 文書く(lint で落ちる図はその SVG が既に書かれている。直すまで `--no-lint` なしの `build` は exit 1 を返し続ける)。

### E2. `check` は例外を整形し、全ファイルを検査する

- ソースごとの処理(`--drift`、`--rebuild`、`--covers`、通常の検査、`--docs` 内の `loadDiagram` を含む)を `try/catch` で包み、throw を 1 件の `error` の所見にする(規則名 `build-error`、メッセージは `build` と同じく `err.message` のみ)。`add({file, rule: 'build-error', severity: 'error', message})`、text では `✗ <ソース>: <message>`。スタックは出さない。`SVG_DIAGRAM_DEBUG=1` のときだけスタックも出す。
- 続けて残りのファイルを検査する。最後に 1 行の集計を出す(`3 件中 1 件が検査できなかった`)。exit は、`error` が 1 件でもあれば 1(`--strict` でなくても。layout の失敗と同じ扱い)。
- `--format json` では `findings` に載る(`errors` に数える)。`--format github` では `::error file=...` になる。
- 整形は `build-diagram.ts` と共有する。`lib/error-format.ts`(新規)に `formatBuildError(src, err)`(1 行目はメッセージ、`lint-svg` や検証の複数行メッセージはそのまま保持。現在の `build` は字下げしない)を置き、`build`・`check`・`show` が同じ関数を使う。`build` の現在の表示と同じ文面になることをテストで固定する。

## 代替案

| 案 | 長所 | 短所 | 判断 |
|---|---|---|---|
| 失敗したら既存の SVG を削除する(要望の案 1) | 古い絵が残らない。単純 | 手置きや他ツール由来の同名ファイルを消す。参照元(Slidev、Markdown)が壊れた画像になる。誤った打鍵 1 回で成果物が消える。git 管理外なら戻せない | 採らない |
| 削除を、メタデータで自分の出力と確かめたものだけに限る | 手置きは守れる。古い絵は残らない | 自分の出力でも、参照元が壊れる問題は残る。直前の成功物は「ひとつ前に戻る」手がかりで、消すと比較(`svg-diagram diff`)もできない | 採らない |
| `<out>.svg.stale` の印のファイルを置く(要望の案 2) | 実装が小さい。失敗の理由も残せる | 出力ディレクトリにファイルが増え、`.gitignore` の雛形が無いので `git status` に出続け、コミットや dist への配信が起きうる。`build` を通さない経路(`md`)には付かない。印を見に行くのは `preview` だけ。`--stale` と名前が紛らわしい | 採らない(E1-4)。要るなら出力ディレクトリ外のキャッシュを「将来」に残す |
| `preview` が SVG と**ソースの mtime**を比べて警告する(要望の案 3) | 追加の仕組みが要らない | git checkout / CI キャッシュ / コピーで時刻が揃い、誤警報も見逃しも出る。ソースの場所を知る手がかりが無い(結局メタデータが要る) | 採らない。ハッシュのほうが確実で、既存の判定と同じ |
| 失敗したら出力を `<name>.svg` から `<name>.failed.svg` などに**移す** | 古い絵は `<name>.svg` に残らない | 実質は削除と同じ。参照元が壊れる。元に戻す手順が要る | 採らない |
| `build` が失敗したら SVG の中身を「ビルド失敗」の絵に差し替える | 参照元は壊れず、誰が見ても分かる | 手置きの同名ファイルを上書きする(削除と同じ危険)。成功時の絵が失われる | 採らない |
| `--watch` を足して、失敗を常に画面に出す | 見落としが減る | 古さの根本(ディスクに古い絵が残る)は直らない。ADR 0001 が範囲外とした大きな機能 | 別 ADR。本 ADR は `--watch` が来ても必要な土台 |
| `check` だけ、例外を捕まえて 1 つ目で止める | 実装が小さい | 要望の「残りも検査してまとめて報告」を満たさない | 採らない |

## 影響

- 既存の挙動は変えない。SVG は消えず、書かれる内容も同じ。`build` の成功時の出力、終了コード、表示は同じ。追加されるのは `build` 失敗時の注意の 1 行(自分の出力が残るときだけ)、`preview` / `show` の警告と帯、`check` の整形されたエラーと継続。ファイルは増えない。
- `preview` は、ソースを探して読み、依存先のハッシュまで計算する(`check --drift` と同じ程度の処理)。ソースが見つからなければ何もしない。性能への影響は図 1 枚あたりミリ秒。
- PNG に帯を入れるのは `preview` の出力だけ。SVG の本体は書き換えない。`rasterize` を通すので、既存の `--gray`、`--engine` と併用できる。`preview` を自動処理が読む場合(画像の比較など)は、帯が差分に出る。`--no-stale-banner` で抑えられる。
- 古い判定の誤警報の可能性: ソースを編集して**保存しただけ**(ビルド前)でも「古い」と出るのは意図どおり。`check --drift` と同じ基準。ソースを移動した、`source` が相対で今のカレントから解決できない場合は、判定しない(誤警報より見逃しを選ぶ)。
- E3(gantt の `today`)や E4(下書きのバッジ)は扱わない。

## 実装計画

独立に進められる作業単位は 4 つ(U2 は小さい)。U1 は U2〜U4 が使う共通部品なので先に入れる(小さい)。U2〜U4 は U1 のインターフェースが決まれば互いに独立で、別々のエージェントで並行できる。ファイルが重ならない。

### U1. 共通部品(先行。小さい)

- 新規 `lib/freshness.ts`: 
  - `readProvenance(svgPath): DiagramSource | null`(`build-diagram.ts` の `embeddedSource` と `check-diagram.ts` の `embedded` を統合。`&quot;` などの復号も同じ)。
  - `locateSource(prov, {svgPath, cwd}): string | null`(カレント → SVG の親 → `.svg-diagram.json` のあるディレクトリ、の順。`reveal` ファイル、`--out` で別の場所に出した SVG にも使える)。
  - `freshness(svgPath, cwd): {state: 'fresh' | 'stale' | 'unknown'; reason?: 'source' | 'deps'; source?: string}`。`sourceSha256` と `depsSha256`(`lib/source-deps.ts`)を比べる。`configSha256` と `toolVersion` は比べない(`--stale` は比べるが、警告の対象としては過剰。ツール版の更新で全図が「古い」になるのを避ける)。
  - `ownsOutput(svgPath, sourcePath): boolean`(メタデータの `source` を解決したパスが一致するか。ハッシュは見ない)。
  - (印のファイルは作らないので、書き込みの関数は無い。)
- 新規 `lib/error-format.ts`: `formatBuildError(src, err): string`(整形、`SVG_DIAGRAM_DEBUG` でスタックも)。
- テスト(新規 `test/freshness.test.ts`): ハッシュ一致 / ソース変更 / import 先の変更 / メタデータなし(unknown)/ ソースが見つからない(unknown)/ reveal ファイル / `source` パスの一致判定(`ownsOutput(svgPath, sourcePath)`)。`test/core-purity.test.ts` の制約(ファイル I/O を `lib/` のどこに置いてよいか)を先に読み、ポート(ADR 0007)の規則に合う場所に置く。

### U2. `build` の失敗時の注意の 1 行(E1-4。小さい)

- 触る: `build-diagram.ts` のみ(U1 を import)。`catch` ブロックと「既定エクスポートが関数でない」の経路で、`ownsOutput(outPath, abs)` が真なら `  ⚠ 前回の <outPath> が残っている(ソースと一致しない古い絵)` を 1 行出す。`embeddedSource` は U1 の `readProvenance` に置き換える。ファイルは書かない・消さない。
- 触らない: `lib/dsl.ts` の `finishBuild`。lint 失敗(E1-5)の挙動。
- テスト(`test/cli.test.ts` に追加): (a)成功→ソースを壊す→失敗して `svg/flow.svg` が**残り、中身が変わらず**、stderr に注意の行がある。(b)初回の失敗では注意の行が出ない。(c)メタデータのない手置きの `svg/x.svg` と同名のソースが失敗しても、注意の行が出ず、SVG は無傷。(d)別のソース由来(`source` が違う)の SVG には出ない。(e)`svg/` 以下にファイルが増えない(`.failed` が無い)。(f)lint 失敗では新しい SVG が残り、注意の行は出ない。


### U3. `preview` / `show` の古さの警告(E1-2, E1-3)

- 触る: `preview-svg.ts`、`show-diagram.ts`(`.svg` の入力の分岐のみ)、`bin/svg-diagram` の先頭コメントの使い方。
- `preview`: `rasterize` の前に `freshness` を呼ぶ。`stale` なら stdout の行に注記、stderr に理由、PNG に帯(SVG 文字列の末尾の `</svg>` の前に `<rect>` と `<text>` を差し込む関数 `staleBannerSvg(svg, message)` を `lib/raster.ts` の近くに置く。帯の文字は、レイアウトに使うフォント(resvg に渡しているもの)で描く。フォントが無い環境では、文字なしの赤い帯だけにフォールバックする)。`--no-stale-banner`、`--require-fresh`(stale のとき exit 1)を追加。USAGE と引数の検査も更新。
- `show <file.svg>`: stderr の警告と `--require-fresh`。`--png` のときだけ帯。未知のオプションの検査(`for (const a of args) if (a.startsWith('--') ...`)の許可リストに足す。
- テスト: 新規 `test/preview.test.ts`(今は `preview` のテストが無い)と `test/show.test.ts` に追加。(a)新しい SVG は警告なし・PNG の見た目は帯なし。(b)ソースを変えると警告が出て、PNG に赤い帯がある(上端の画素の色で確かめる)。(c)`--no-stale-banner` で帯なし、警告は残る。(d)`--require-fresh` が exit 1。(e)メタデータのない SVG は警告なし。

### U4. `check` の整形と継続(E2)

- 触る: `check-diagram.ts` のみ(`lib/error-format.ts` を import)。ソースごとのループ全体、`--docs` の `loadDiagram`(注釈の突き合わせ)、`--drift --rebuild` の `loadDiagram` を `try/catch` で包み、`build-error` の所見にする。末尾に集計の 1 行(失敗があるときだけ)。`RULE_DOCS`(`lib/rules.ts`)には載せない(検査の規則ではなく実行の失敗。`--verbose` の規則表を汚さない)。ただし `docs/` の規則一覧にあれば 1 行足す。
- テスト(`test/cli.test.ts`): `throws.ts`(`define` が throw)と `flow.ts` を `check --strict src/throws.ts src/flow.ts` で。(a)stderr に `✗ src/throws.ts: boom from define` があり、`at ` で始まるスタック行が**無い**。(b)`flow.ts` の結果(`✓ src/flow.ts`)が出る。(c)exit 1。(d)`--format json` の `findings` に `build-error` が 1 件で `errors: 1`。(e)`--format github` に `::error file=src/throws.ts`。(f)`--drift --rebuild` で、壊れたソースがあっても残りを検査する。(g)`SVG_DIAGRAM_DEBUG=1` でスタックが出る。(h)レイアウトの throw(幅が足りない gantt など、実際に `checkDiagram` が throw する小さな図)でも同じ。`build` の表示との一致は、同じソースで `build` と `check` の `✗` の行が同じ文面になることで確かめる。

### 進め方

1. 本 ADR は他の ADR から独立で、最初にマージする(`graph-layout.ts` や `types.ts` に触らない)。U1 を 1 人が先に入れる(PR は U1 だけ。または U2〜U4 のブランチに共通で取り込む)。
2. U2・U3・U4 を並行(ファイルが重ならない: `build-diagram.ts` / `preview-svg.ts` と `show-diagram.ts` / `check-diagram.ts`)。`test/cli.test.ts` は U2 と U4 の両方が追記するので、末尾に節を分けて足し、コンフリクトを避ける。
3. 最後に、`README.md` と `skills/svg-diagram/SKILL.md` に、(1) `build` が失敗しても古い SVG は残ること、(2) lint で落ちた `build` でも新しい SVG は書かれて残ること(E1-5)、(3) `preview` / `show` の警告、`--require-fresh`、(4) `check` が全ファイルを検査して続けること、を 1 か所ずつ書く。`pnpm test` と `svg-diagram typecheck`(型の検査)が通ること、実際のプロジェクト(`hisco-2026-10/diagrams/` など)で `check` と `preview` を手で 1 回ずつ確かめることを完了条件にする。

### 見送り・後続

- `--watch`(失敗を常に画面に出す)は別 ADR(ADR 0001 の範囲外のまま)。
- 失敗の理由を `preview` に出す印は、出力ディレクトリ外のキャッシュ(`node_modules/.cache/svg-diagram/failed.json`、出力の絶対パスがキー)に置く。要望が出てから。
